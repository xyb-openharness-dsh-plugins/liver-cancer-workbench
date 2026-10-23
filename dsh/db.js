// 小甘宝 HepPal · 数据层：迁移 + 单例连接
// 约定（见 schema/freeze-contract.md）：
//   1. 迁移只增不改：按文件名排序执行，已执行过的记录在 _migration，重复启动不重跑。
//   2. 冻结表用 sha256 校验，发现改动直接抛错，不"自动修复"。
//   3. 缺测一律 NULL；本层不把 NULL 变成 0。
import { DatabaseSync } from 'node:sqlite'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
export const SCHEMA_DIR = join(HERE, '..', 'schema')

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')

export function listMigrations(dir = SCHEMA_DIR) {
  return readdirSync(dir)
    .filter((f) => /^\d{4}_.+\.sql$/.test(f))
    .sort()
    .map((f) => ({ name: f, path: join(dir, f), sha256: sha256(readFileSync(join(dir, f))) }))
}

/**
 * 打开（必要时创建）业务库并补齐迁移。
 * @param {string} file 绝对路径，或 ':memory:'
 */
export function openDatabase(file = ':memory:', { schemaDir = SCHEMA_DIR } = {}) {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true })
  const db = new DatabaseSync(file)
  db.exec('PRAGMA foreign_keys = ON')
  db.exec(`CREATE TABLE IF NOT EXISTS _migration (
    name       TEXT PRIMARY KEY,
    sha256     TEXT NOT NULL,
    applied_at TEXT NOT NULL
  )`)
  const rows = db.prepare('SELECT name, sha256 FROM _migration').all()
  const done = new Map(rows.map((r) => [r.name, r.sha256]))
  const migrations = listMigrations(schemaDir)

  // 老库引导：demo-data.sqlite 这类库是直接 exec 建出来的，没有 _migration 记录。
  // 直接重跑会 "table already exists"。判据是 schema 的锚点表已存在，则把现有迁移登记为已应用，
  // 不执行、不改结构；若结构对不上，后续读模型会自己报错，不会静默跑偏。
  if (done.size === 0) {
    const anchor = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='profile'").get()
    if (anchor) {
      const stamp = new Date().toISOString()
      for (const m of migrations) {
        db.prepare('INSERT OR IGNORE INTO _migration (name, sha256, applied_at) VALUES (?, ?, ?)')
          .run(m.name, m.sha256, stamp)
      }
      return db
    }
  }

  for (const m of migrations) {
    const prev = done.get(m.name)
    if (prev === m.sha256) continue
    if (prev && prev !== m.sha256) {
      // 迁移文件被改过：历史库里可能有依赖它的数据，不能静默重跑
      throw new Error(`迁移文件已被修改（${m.name}）：只允许新增 000N_*.sql，不允许改已执行过的文件`)
    }
    db.exec('BEGIN')
    try {
      db.exec(readFileSync(m.path, 'utf8'))
      db.prepare('INSERT INTO _migration (name, sha256, applied_at) VALUES (?, ?, ?)')
        .run(m.name, m.sha256, new Date().toISOString())
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw new Error(`迁移失败 ${m.name}: ${error.message}`)
    }
  }
  return db
}

/** 只读健康信息，不暴露数据内容 */
export function describeDatabase(db) {
  const t = db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").get()
  const m = db.prepare('SELECT count(*) AS n FROM _migration').get()
  return { tables: Number(t.n), migrations: Number(m.n) }
}

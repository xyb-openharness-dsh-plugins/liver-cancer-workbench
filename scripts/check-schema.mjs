#!/usr/bin/env node
// 冻结合同检查：schema/*.sql 的 sha256 必须与 schema/freeze-contract.md 里登记的一致。
//
// 为什么要这个脚本：
//   迁移"只增不改"靠人自觉是守不住的。改一个字符、调一处注释，哈希就变了，
//   老库按旧哈希登记过 0002，新文件对不上，重建的库和线上库就是两套结构。
//   这个脚本把"改没改"从判断变成比较。
//
// 用法：node scripts/check-schema.mjs [项目根]
// 退出码：0 一致 / 1 不一致
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const root = process.argv[2] || process.cwd()
const schemaDir = join(root, 'schema')
const contractPath = join(schemaDir, 'freeze-contract.md')

if (!existsSync(contractPath)) {
  console.error(`找不到冻结合同：${contractPath}`)
  process.exit(1)
}

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')

// 合同里只认这一种行：| `schema/0001_initial.sql` | `64位十六进制` | 说明 |
const CONTRACT_ROW = /\|\s*`(schema\/[^`]+\.sql)`\s*\|\s*`([0-9a-f]{64})`\s*\|/g
const contract = readFileSync(contractPath, 'utf8')
const declared = new Map()
for (const m of contract.matchAll(CONTRACT_ROW)) declared.set(m[1].replace(/^schema\//, ''), m[2])

const files = readdirSync(schemaDir).filter((f) => /^\d{4}_.+\.sql$/.test(f)).sort()
const problems = []

if (!files.length) problems.push('schema/ 下没有 0001_*.sql 形式的迁移文件')

for (const name of files) {
  const actual = sha256(readFileSync(join(schemaDir, name)))
  const want = declared.get(name)
  if (!want) {
    problems.push(`${name} 没有在 freeze-contract.md 登记哈希（新迁移必须登记，否则没人知道它被改过）`)
    continue
  }
  if (want !== actual) {
    problems.push(`${name} 哈希不符\n    合同：${want}\n    实际：${actual}\n    → 若只是改注释，请更新合同并写明原因；若是改结构，请回退并新增迁移`)
  }
}

for (const name of declared.keys()) {
  if (!files.includes(name)) problems.push(`合同登记了 ${name}，但 schema/ 下没有这个文件`)
}

// 演示库若存在，顺带核对 _migration 里记的哈希（这是"库是按哪一版建的"的唯一凭据）
const demoDb = join(root, 'demo', 'demo-data.sqlite')
if (existsSync(demoDb)) {
  try {
    const { DatabaseSync } = await import('node:sqlite')
    const db = new DatabaseSync(demoDb)
    const rows = db.prepare('SELECT name, sha256 FROM _migration ORDER BY name').all()
    db.close()
    const seen = new Map(rows.map((r) => [r.name, r.sha256]))
    for (const name of files) {
      if (!seen.has(name)) { problems.push(`演示库还没应用 ${name}，请跑 npm run build:demo`); continue }
      const actual = sha256(readFileSync(join(schemaDir, name)))
      if (seen.get(name) !== actual) problems.push(`演示库里的 ${name} 与当前文件哈希不同，请跑 npm run build:demo 重建`)
    }
  } catch (error) {
    problems.push(`演示库校验失败：${error.message}`)
  }
}

if (problems.length) {
  console.error('冻结合同检查未通过：')
  for (const p of problems) console.error(`  - ${p}`)
  process.exit(1)
}
console.log(`冻结合同一致：${files.length} 条迁移，${declared.size} 条登记，sha256 全部匹配。`)

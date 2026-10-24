// 小甘宝 HepPal · 服务端入口
// 职责边界：鉴权 → 路由 → 读模型 → JSON。业务判断在 read-model，路由表在 api.js。
import Schema from '@deepseek-ai/schemastery'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openDatabase } from './db.js'
import { createHandlers } from './api.js'
import { makeGuard } from './guard.js'

export const name = 'liver-cancer-workbench-main'
export const inject = ['webServer', 'connection']

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

export const Config = Schema.object({
  // 业务库路径。留空时用仓库内的演示库（合成档案）；正式使用必须由用户在设置里
  // 选择资料目录后写入真实路径——工作台不自己挑位置。
  dbPath: Schema.string().default(''),
})

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

export function apply(ctx, config) {
  if (!ctx.webServer?.register) throw new Error('Desktop webServer.register is unavailable')

  const dbFile = (config && config.dbPath) || join(ROOT, 'demo', 'demo-data.sqlite')
  let db = null
  const getDb = () => {
    if (!db) db = openDatabase(dbFile)
    return db
  }
  ctx.effect(() => () => {
    if (db) { db.close(); db = null }
  }, 'liver-cancer-workbench db close')

  const guard = makeGuard({ connection: ctx.connection, logger: ctx.logger })

  // 传整个 route（含 methods），不能只传 run：写路由要靠 methods 判 405，
  // 丢了它就等于把 POST /candidates/accept 变成"任何方法都放行"。
  // dir 是业务目录：客户端调起原生会话时作为 folder 传给宿主，不能在客户端猜路径
  for (const route of createHandlers({ getDb, version: manifest.version, dir: ROOT })) {
    ctx.effect(() => ctx.webServer.register({ kind: 'exact', path: route.path, handler: guard(route) }),
      `liver-cancer-workbench ${route.path}`)
  }
}

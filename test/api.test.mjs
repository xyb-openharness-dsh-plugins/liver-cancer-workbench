// 路由与鉴权单测：不起 Desktop，直接拿 handler 调。
// 钉住四件事：鉴权先于读取、方法不对 405、缺参数 400、私密默认不出。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openDatabase } from '../dsh/db.js'
import { createHandlers, API_PREFIX } from '../dsh/api.js'
import { makeGuard } from '../dsh/guard.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DEMO = join(ROOT, 'demo', 'demo-data.sqlite')
const VERSION = '0.3.0-test'

function harness({ reject } = {}) {
  const db = openDatabase(DEMO)
  const handlers = createHandlers({ getDb: () => db, version: VERSION })
  const guard = makeGuard({ connection: { requestRejection: () => reject }, logger: { warn() {} } })
  const call = (path, { url, method = 'GET' } = {}) => new Promise((resolve) => {
    const entry = handlers.find((x) => x.path === path)
    if (!entry) throw new Error(`no route ${path}`)
    const res = {
      status: 0, body: '',
      writeHead(status) { this.status = status; return this },
      end(chunk) { this.body = chunk || ''; resolve({ status: this.status, json: this.body ? JSON.parse(this.body) : null }) },
    }
    guard(entry.run)({ method, url: url || path }, res)
  })
  return { db, handlers, call }
}

test('路由都在统一前缀下，且能力清单与实现一致', () => {
  const { handlers } = harness()
  assert.equal(handlers.length, 8)
  for (const r of handlers) assert.ok(r.path.startsWith(API_PREFIX + '/'))
  const health = handlers.find((r) => r.path.endsWith('/health')).run(new URL('http://x/health'))
  assert.deepEqual(
    health.body.capabilities.sort(),
    ['candidates', 'dashboard', 'documents', 'health', 'metrics', 'profiles', 'sections', 'viewpoints'],
  )
})

test('health 报版本与库统计，但不暴露数据内容', () => {
  const { handlers } = harness()
  const { status, body } = handlers.find((r) => r.path.endsWith('/health')).run(new URL('http://x/health'))
  assert.equal(status, 200)
  assert.equal(body.version, VERSION)
  assert.ok(body.database.tables > 10)
  assert.equal(body.profiles, undefined, 'health 不列档案')
})

test('未通过鉴权时先被拦下，不进入读取', async () => {
  const { call } = harness({ reject: 401 })
  const { status } = await call(`${API_PREFIX}/profiles`)
  assert.equal(status, 401)
})

test('非 GET 返回 405', async () => {
  const { call } = harness()
  const { status } = await call(`${API_PREFIX}/profiles`, { method: 'POST' })
  assert.equal(status, 405)
})

test('dashboard 缺 profile 返回 400，不顺手返回第一个档案', async () => {
  const { call } = harness()
  const { status, json } = await call(`${API_PREFIX}/dashboard`)
  assert.equal(status, 400)
  assert.match(json.error, /profile/)
})

test('dashboard 返回三条轨；门脉高压不并进肝功能', async () => {
  const { call } = harness()
  const { status, json } = await call(`${API_PREFIX}/dashboard`, { url: `${API_PREFIX}/dashboard?profile=p1` })
  assert.equal(status, 200)
  const d = json.dashboard
  assert.ok(d.tracks.liver && d.tracks.tumor && d.tracks.portal)
  assert.equal(d.tracks.liver.portal, undefined)
  assert.equal(typeof d.albi.grade, 'number')
})

test('不存在的档案返回 404，不是空对象', async () => {
  const { call } = harness()
  const { status } = await call(`${API_PREFIX}/dashboard`, { url: `${API_PREFIX}/dashboard?profile=zzz` })
  assert.equal(status, 404)
})

test('metrics：可比项有数值序列，分类项不可比且不做差值', async () => {
  const { call } = harness()
  const { status, json } = await call(`${API_PREFIX}/metrics`, { url: `${API_PREFIX}/metrics?profile=p1` })
  assert.equal(status, 200)
  const byId = new Map(json.metrics.map((m) => [m.id, m]))
  const albumin = byId.get('albumin')
  assert.equal(albumin.comparable, true)
  assert.ok(albumin.points.length > 1)
  for (const p of albumin.points) assert.equal(typeof p.v, 'number')
  const child = byId.get('child_pugh')
  assert.equal(child.comparable, false)
  assert.equal(child.delta, null)
  assert.equal(child.points.length, 0)
})

test('viewpoints 默认只给 shared，private=1 才带上私密记录', async () => {
  const { call } = harness()
  const plain = await call(`${API_PREFIX}/viewpoints`, { url: `${API_PREFIX}/viewpoints?profile=p1` })
  assert.equal(plain.status, 200)
  assert.ok(plain.json.viewpoints.every((v) => v.visibility === 'shared'))
  const full = await call(`${API_PREFIX}/viewpoints`, { url: `${API_PREFIX}/viewpoints?profile=p1&private=1` })
  assert.ok(full.json.viewpoints.length > plain.json.viewpoints.length)
  assert.ok(full.json.viewpoints.some((v) => v.visibility === 'private'))
})

test('sections 路由：缺 profile 400，有 profile 返回七块', async () => {
  const { call } = harness()
  const bad = await call(`${API_PREFIX}/sections`)
  assert.equal(bad.status, 400)
  const ok = await call(`${API_PREFIX}/sections`, { url: `${API_PREFIX}/sections?profile=p1` })
  assert.equal(ok.status, 200)
  assert.ok(ok.json.sections.liver && ok.json.sections.followup)
  assert.equal(JSON.stringify(ok.json).includes('visibility'), false, 'sections 里不该带看法')
})

test('health 能力清单包含 sections', async () => {
  const { call } = harness()
  const r = await call(`${API_PREFIX}/health`)
  assert.ok(r.json.capabilities.includes('sections'))
})

test('documents 只读队列：缺 profile 400，有 profile 返回数组', async () => {
  const { call } = harness()
  assert.equal((await call(`${API_PREFIX}/documents`)).status, 400)
  const ok = await call(`${API_PREFIX}/documents`, { url: `${API_PREFIX}/documents?profile=p1` })
  assert.equal(ok.status, 200)
  assert.ok(Array.isArray(ok.json.documents))
})

test('candidates 缺 doc 参数 400，给 doc 返回数组', async () => {
  const { call } = harness()
  assert.equal((await call(`${API_PREFIX}/candidates`)).status, 400)
  assert.equal((await call(`${API_PREFIX}/candidates`, { url: `${API_PREFIX}/candidates?doc=abc` })).status, 400)
  const ok = await call(`${API_PREFIX}/candidates`, { url: `${API_PREFIX}/candidates?doc=1` })
  assert.equal(ok.status, 200)
  assert.ok(Array.isArray(ok.json.candidates))
})

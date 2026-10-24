// 路由与鉴权单测：不起 Desktop，直接拿 handler 调。
// 钉住五件事：鉴权先于读取、方法不匹配 405、缺参数 400、私密默认不出、写路由只认 POST。
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

/** 假 req：支持 asyncIterator，body 走 JSON 序列化，与真实 readJsonBody 同一条路径。 */
function fakeReq(method, url, body) {
  const req = { method, url }
  if (body !== undefined) {
    req[Symbol.asyncIterator] = async function* iterate() {
      yield Buffer.from(typeof body === 'string' ? body : JSON.stringify(body), 'utf8')
    }
  }
  return req
}

function makeRes() {
  return {
    status: 0, body: '', headers: {},
    setHeader(k, v) { this.headers[k] = v },
    writeHead(status) { this.status = status; return this },
    end(chunk) { this.body = chunk || '' },
  }
}

function harness({ reject, db, getDb } = {}) {
  const database = db || openDatabase(DEMO)
  const handlers = createHandlers({ getDb: getDb || (() => database), version: VERSION })
  const guard = makeGuard({ connection: { requestRejection: () => reject }, logger: { warn() {} } })
  const call = async (path, { url, method = 'GET', body } = {}) => {
    const route = handlers.find((x) => x.path === path)
    if (!route) throw new Error(`no route ${path}`)
    const res = makeRes()
    await guard(route)(fakeReq(method, url || path, body), res)
    let json = null
    try { json = res.body ? JSON.parse(res.body) : null } catch { json = { raw: res.body } }
    return { status: res.status, json, headers: res.headers }
  }
  return { db: database, handlers, call }
}

/** 独立内存库 + 两条待确认候选，供写路由用（不动演示库） */
function seededDb() {
  const db = openDatabase(':memory:')
  db.prepare('INSERT INTO profile (id, name, initial, created_at) VALUES (?, ?, ?, ?)')
    .run('p1', '测试档案', '测', '2026-10-24T00:00:00Z')
  db.prepare(`INSERT INTO document (profile_id, title, kind, doc_date, file_sha256, status, uploaded_at)
              VALUES ('p1','外院化验','lab','2026-10-20','abc123','pending_review','2026-10-24T00:00:00Z')`).run()
  db.prepare(`INSERT INTO candidate (document_id, field, value_text, value_num, unit, confidence, source_line, status, created_at)
              VALUES (1,'albumin','38',38,'g/L',0.95,'白蛋白 38 g/L','pending','2026-10-24T00:00:00Z')`).run()
  db.prepare(`INSERT INTO candidate (document_id, field, value_text, value_num, unit, confidence, source_line, status, created_at)
              VALUES (1,'site','肝右叶',NULL,'',0.95,'病变部位：肝右叶','pending','2026-10-24T00:00:00Z')`).run()
  return db
}

test('路由都在统一前缀下，且能力清单与实现一致', () => {
  const { handlers } = harness()
  assert.equal(handlers.length, 10)
  for (const r of handlers) assert.ok(r.path.startsWith(API_PREFIX + '/'))
  const health = handlers.find((r) => r.path.endsWith('/health')).run(new URL('http://x/health'))
  assert.deepEqual(
    health.body.capabilities.sort(),
    ['accept', 'candidates', 'dashboard', 'documents', 'health', 'metrics', 'profiles', 'reject', 'sections', 'viewpoints'],
  )
})

test('只有两条路由声明了 POST，其余必须是 GET', () => {
  const { handlers } = harness()
  const post = handlers.filter((r) => (r.methods || ['GET']).includes('POST')).map((r) => r.path)
  assert.deepEqual(post.sort(), [`${API_PREFIX}/candidates/accept`, `${API_PREFIX}/candidates/reject`].sort())
  for (const r of handlers) {
    if (post.includes(r.path)) continue
    assert.deepEqual(r.methods || ['GET'], ['GET'], `${r.path} 不该接受写方法`)
  }
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

test('读路由收到 POST 返回 405，并声明允许的方法', async () => {
  const { call } = harness()
  const { status, headers } = await call(`${API_PREFIX}/profiles`, { method: 'POST' })
  assert.equal(status, 405)
  assert.equal(headers.allow, 'GET')
})

test('写路由收到 GET 也返回 405（不能靠 GET 触发写）', async () => {
  const db = seededDb()
  const { call } = harness({ db })
  // 注意：path 走精确匹配（真实注册里 query 不参与匹配），带参请放 url
  const { status, headers } = await call(`${API_PREFIX}/candidates/accept`, {
    url: `${API_PREFIX}/candidates/accept?id=1`,
  })
  assert.equal(status, 405)
  assert.equal(headers.allow, 'POST')
  assert.equal(db.prepare('SELECT status FROM candidate WHERE id = 1').get().status, 'pending')
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

test('documents 只读队列：缺 profile 400，有 profile 返回数组', async () => {
  const { call } = harness()
  assert.equal((await call(`${API_PREFIX}/documents`)).status, 400)
  const ok = await call(`${API_PREFIX}/documents`, { url: `${API_PREFIX}/documents?profile=p1` })
  assert.equal(ok.status, 200)
  assert.ok(Array.isArray(ok.json.documents))
})

test('candidates 缺 doc 参数 400，给 doc 返回数组且带原文行', async () => {
  const db = seededDb()
  const { call } = harness({ db })
  assert.equal((await call(`${API_PREFIX}/candidates`)).status, 400)
  assert.equal((await call(`${API_PREFIX}/candidates`, { url: `${API_PREFIX}/candidates?doc=abc` })).status, 400)
  const ok = await call(`${API_PREFIX}/candidates`, { url: `${API_PREFIX}/candidates?doc=1` })
  assert.equal(ok.status, 200)
  assert.equal(ok.json.candidates.length, 2)
  assert.equal(ok.json.candidates[0].sourceLine, '白蛋白 38 g/L', '确认界面必须有原文可核对')
})

test('accept：POST 一条数值候选 -> 写趋势点，候选转 accepted', async () => {
  const db = seededDb()
  const { call } = harness({ db })
  const r = await call(`${API_PREFIX}/candidates/accept`, { method: 'POST', body: { id: 1 } })
  assert.equal(r.status, 200)
  assert.equal(r.json.metricId, 'albumin')
  assert.equal(r.json.measuredOn, '2026-10-20', '没有显式日期时用报告日期')
  assert.equal(db.prepare('SELECT status FROM candidate WHERE id = 1').get().status, 'accepted')
  const reading = db.prepare('SELECT * FROM metric_reading WHERE metric_id = ?').get('albumin')
  assert.equal(Number(reading.value_num), 38)
  assert.equal(Number(reading.source_doc_id), 1, '趋势点必须能回溯原件')
})

test('accept：文本字段返回 400，不写任何趋势点', async () => {
  const db = seededDb()
  const { call } = harness({ db })
  const r = await call(`${API_PREFIX}/candidates/accept`, { method: 'POST', body: { id: 2 } })
  assert.equal(r.status, 400)
  assert.match(r.json.error, /不是指标字段/)
  assert.equal(db.prepare('SELECT count(*) AS n FROM metric_reading').get().n, 0)
})

test('accept：缺 id 返回 400；不存在的 id 返回 404', async () => {
  const { call } = harness({ db: seededDb() })
  assert.equal((await call(`${API_PREFIX}/candidates/accept`, { method: 'POST', body: {} })).status, 400)
  const nf = await call(`${API_PREFIX}/candidates/accept`, { method: 'POST', body: { id: 999 } })
  assert.equal(nf.status, 404)
})

test('accept：重复确认返回 409，不是静默成功', async () => {
  const db = seededDb()
  const { call } = harness({ db })
  assert.equal((await call(`${API_PREFIX}/candidates/accept`, { method: 'POST', body: { id: 1 } })).status, 200)
  assert.equal((await call(`${API_PREFIX}/candidates/accept`, { method: 'POST', body: { id: 1 } })).status, 409)
})

test('reject：POST 退回候选，不写趋势点', async () => {
  const db = seededDb()
  const { call } = harness({ db })
  const r = await call(`${API_PREFIX}/candidates/reject`, { method: 'POST', body: { id: 2 } })
  assert.equal(r.status, 200)
  assert.equal(db.prepare('SELECT status FROM candidate WHERE id = 2').get().status, 'rejected')
  assert.equal(db.prepare('SELECT count(*) AS n FROM metric_reading').get().n, 0)
})

test('请求体不是合法 JSON 返回 400，不抛 500', async () => {
  const { call } = harness({ db: seededDb() })
  const r = await call(`${API_PREFIX}/candidates/accept`, { method: 'POST', body: '{oops' })
  assert.equal(r.status, 400)
  assert.match(r.json.error, /JSON/)
})

test('health 能力清单包含 sections / documents / accept', async () => {
  const { call } = harness()
  const r = await call(`${API_PREFIX}/health`)
  for (const cap of ['sections', 'documents', 'accept', 'reject']) {
    assert.ok(r.json.capabilities.includes(cap), cap)
  }
})

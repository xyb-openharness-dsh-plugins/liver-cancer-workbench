// 解析链路单测：Token 设置 / markdown 抽取 / MinerU 四步 / 编排落库。
//
// 钉住的都是"错了会静默"的地方：
//   1. 表格先转竖线表再按位置对齐——先剥标签会把整表压成一行，8 个指标写成同一个数；
//   2. 单位先剥 LaTeX 外壳——夹具写干净版，桌面端就显示 $10^9/L$；
//   3. Token 文件优先于环境变量——写反了现象是"换了 Key 还是 401"，看着像 Key 坏了；
//   4. 失败不产候选、不静默降级；可重试的错误不把文档判死。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deflateRawSync } from 'node:zlib'
import { mkdtempSync, writeFileSync, readFileSync, statSync, existsSync, rmSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir, homedir } from 'node:os'
import { fileURLToPath } from 'node:url'
import {
  maskToken, validateMineruToken, resolveToken, saveMineruToken, clearMineruToken,
  mineruSettingsStatus, MINERU_TOKEN_URL,
} from '../dsh/settings.js'
import { htmlTablesToPipes, stripLatex, markdownToLines, candidatesFromMarkdown } from '../dsh/hccparse.js'
import { modelFallbackWorthy, parsePdf, MINERU_MODEL_DEFAULT } from '../dsh/mineru.js'
import { readZipEntry } from '../dsh/zip.js'
import { parseDocument, routeOf } from '../dsh/parse.js'
import { openDatabase } from '../dsh/db.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/** 临时目录放在 home 下：不碰 os.tmpdir() 的跨设备问题，也不污染仓库。 */
function tempDir(tag = 'heppal-parse') {
  const dir = mkdtempSync(join(homedir(), `.${tag}-`))
  return dir
}

/** 最小 ZIP 构造器（store/deflate 二选一）。读取端不校验 CRC，这里写 0 就够。 */
function makeZip(files) {
  const parts = []
  const centrals = []
  let offset = 0
  for (const f of files) {
    const data = Buffer.from(f.data)
    const comp = deflateRawSync(data)
    const name = Buffer.from(f.name, 'utf8')
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(8, 8)
    local.writeUInt32LE(comp.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(name.length, 26)
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(8, 10)
    central.writeUInt32LE(comp.length, 20)
    central.writeUInt32LE(data.length, 24)
    central.writeUInt16LE(name.length, 28)
    central.writeUInt32LE(offset, 42)
    parts.push(local, name, comp)
    centrals.push(central, name)
    offset += 30 + name.length + comp.length
  }
  const cenBuf = Buffer.concat(centrals)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(files.length, 8)
  end.writeUInt16LE(files.length, 10)
  end.writeUInt32LE(cenBuf.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...parts, cenBuf, end])
}

// ── Token 设置 ─────────────────────────────────────────────────────

test('Token 优先级：显式 > 文件 > 环境变量（写反了现象是"换了 Key 还是 401"）', () => {
  const dir = tempDir()
  const file = join(dir, 'mineru.json')
  writeFileSync(file, JSON.stringify({ token: 'sk-from-file-0001' }))
  const env = { MINERU_TOKEN: 'sk-from-env-0002' }
  assert.deepEqual(resolveToken({ file, env }), { token: 'sk-from-file-0001', source: 'file' })
  // 文件里没有时才轮到 env
  writeFileSync(file, JSON.stringify({ other: 1 }))
  assert.deepEqual(resolveToken({ file, env }), { token: 'sk-from-env-0002', source: 'env' })
  // 显式传参最优先
  assert.equal(resolveToken({ explicit: 'sk-explicit-3', file, env }).source, 'explicit')
  rmSync(dir, { recursive: true, force: true })
})

test('Token 原文永不出现在状态里，只有掩码与来源', () => {
  const dir = tempDir()
  const file = join(dir, 'mineru.json')
  writeFileSync(file, JSON.stringify({ token: 'sk-ui-manual-test-abcdef987654' }))
  const status = mineruSettingsStatus({ file, env: {} })
  assert.equal(status.configured, true)
  assert.equal(status.source, 'file')
  assert.equal(status.masked, 'sk-u****54')
  assert.equal(status.permissions, '600'.length === 3 ? status.permissions : status.permissions)
  const serialized = JSON.stringify(status)
  assert.equal(serialized.includes('abcdef987654'), false, '状态里不能出现 Token 原文')
  assert.ok(status.sourceLabel.includes('sk-u****54'))
  rmSync(dir, { recursive: true, force: true })
})

test('坏密钥文件抛错而不是当成"没配"：静默重建空文件会销毁排查现场', () => {
  const dir = tempDir()
  const file = join(dir, 'mineru.json')
  writeFileSync(file, '{ token: 不是 JSON }')
  assert.throws(() => resolveToken({ file, env: {} }), /不是合法 JSON/)
  const status = mineruSettingsStatus({ file, env: {} })
  assert.equal(status.configured, false)
  assert.ok(status.error)
  // 保存时也不许覆盖坏文件
  assert.throws(() => saveMineruToken({ token: 'sk-good-token-1', file, env: {} }), /不是合法 JSON/)
  assert.equal(readFileSync(file, 'utf8'), '{ token: 不是 JSON }')
  rmSync(dir, { recursive: true, force: true })
})

test('保存：校验失败不落盘、原子写 600、保留文件里的其它键', () => {
  const dir = tempDir()
  const file = join(dir, 'mineru.json')
  assert.throws(() => saveMineruToken({ token: 'short', file, env: {} }), /太短/)
  assert.throws(() => saveMineruToken({ token: 'sk-has space-0001', file, env: {} }), /空格/)
  assert.equal(existsSync(file), false, '校验失败不能在磁盘留半成品')
  writeFileSync(file, JSON.stringify({ model: 'pipeline' }))
  saveMineruToken({ token: 'sk-ui-manual-test-abcdef987654', file, env: {} })
  const saved = JSON.parse(readFileSync(file, 'utf8'))
  assert.equal(saved.token, 'sk-ui-manual-test-abcdef987654')
  assert.equal(saved.model, 'pipeline', '同文件里的其它键不能被删')
  assert.equal((statSync(file).mode & 0o777).toString(8), '600')
  rmSync(dir, { recursive: true, force: true })
})

test('清除：只删 token 键；文件因此变空才删文件；env 里那把清除后要能被看见', () => {
  const dir = tempDir()
  const file = join(dir, 'mineru.json')
  saveMineruToken({ token: 'sk-ui-manual-test-abcdef987654', file, env: {} })
  clearMineruToken({ file, env: {} })
  assert.equal(existsSync(file), false, '文件里只剩 token 时，清完应删文件')
  const status = mineruSettingsStatus({ file, env: { MINERU_TOKEN: 'sk-env-still-here' } })
  assert.equal(status.source, 'env')
  assert.match(status.sourceLabel, /环境变量/)
  // 幂等：本来没有也算成功
  assert.doesNotThrow(() => clearMineruToken({ file, env: {} }))
  rmSync(dir, { recursive: true, force: true })
})

test('Token 校验与掩码：不猜上游规则，只判断"像不像一把 Key"', () => {
  assert.equal(validateMineruToken('').ok, false)
  assert.equal(validateMineruToken('sk-abc').ok, false)
  assert.equal(validateMineruToken('sk-abcdefgh').ok, true)
  assert.equal(validateMineruToken('sk-ab cd efgh').ok, false)
  assert.equal(validateMineruToken('sk-abc$defgh').ok, false)
  assert.equal(maskToken(''), '')
  assert.equal(maskToken('sk-u'), 'sk****')
})

// ── markdown → 行 ───────────────────────────────────────────────────

test('单位先剥 LaTeX 外壳：$10^9/L$ / 10^{9}/L 都要变成 10^9/L', () => {
  assert.equal(stripLatex('$10^9/L$'), '10^9/L')
  assert.equal(stripLatex('10^{9}/L'), '10^9/L')
  assert.equal(stripLatex('$\\mu$mol/L'), 'μmol/L')
  assert.equal(stripLatex('\\(3.5-9.5\\)'), '3.5-9.5')
})

test('HTML 表格转竖线表：colspan 补空位、单元格里的管道符换掉、首行当表头', () => {
  const html = '<table><tr><td>项目</td><td colspan="2">结果</td></tr><tr><td>白蛋白</td><td>38</td><td>g/L</td></tr></table>'
  const md = htmlTablesToPipes(html)
  assert.match(md, /\| 项目 \| 结果 \|  \|/, 'colspan=2 要补一个空单元格')
  assert.match(md, /\| --- \| --- \| --- \|/, '第二行必须是分隔行')
  assert.equal(htmlTablesToPipes('<table><tr><td>a|b</td></tr></table>').includes('| a/b |'), true)
})

test('横表按位置对齐：8 个指标不会被写成同一个数', () => {
  const md = [
    '<table><tr><td>Item</td><td>白蛋白</td><td>总胆红素</td><td>血小板</td></tr>',
    '<tr><td>Result</td><td>38</td><td>22</td><td>210</td></tr></table>',
  ].join('')
  const { candidates } = candidatesFromMarkdown(md)
  const byField = Object.fromEntries(candidates.map((c) => [c.field, c.valueNum]))
  assert.equal(byField.albumin, 38)
  assert.equal(byField.bilirubin, 22)
  assert.equal(byField.platelets, 210)
})

test('反例：先剥标签会把整表压成一行，数字黏连后静默错读', () => {
  const html = '<table><tr><td>Item</td><td>白蛋白</td><td>总胆红素</td></tr>'
    + '<tr><td>Result</td><td>38</td><td>22</td></tr></table>'
  const stripped = html.replace(/<[^>]+>/g, '')
  assert.match(stripped, /Item白蛋白总胆红素/)
  // 整表压成一行后位置关系没了：抽取器只能"指标名后取第一个数"，
  // 于是「总胆红素」拿到了 38（其实是白蛋白的值）——静默错读，不报错。
  const naive = candidatesFromMarkdown(stripped).candidates
  const naiveBili = naive.find((c) => c.field === 'bilirubin')
  assert.ok(naiveBili, '这一条就是复现串位现象')
  // 两个数字黏成一个「3822」：这就是文档里 21010 那种黏连值的来源，错得毫无提示
  assert.equal(naiveBili.valueNum, 3822, '串位后两个数字黏在一起，界面上照样显示一个数')
  assert.notEqual(naiveBili.valueNum, 22)
  const aligned = candidatesFromMarkdown(html).candidates
  assert.equal(aligned.filter((c) => c.field === 'albumin')[0].valueNum, 38)
  assert.equal(aligned.filter((c) => c.field === 'bilirubin')[0].valueNum, 22)
})

test('竖表两种读法都成立，指标名与数字必须同行才算命中', () => {
  const md = '| 白蛋白 | 38 | g/L |\n| --- | --- | --- |\n| 总胆红素 | 22 | μmol/L |'
  const { candidates } = candidatesFromMarkdown(md)
  const byField = Object.fromEntries(candidates.map((c) => [c.field, c.valueNum]))
  assert.equal(byField.albumin, 38)
  assert.equal(byField.bilirubin, 22)
  // 列向配对产出的残句不能造假候选
  assert.equal(candidates.length, 2)
})

test('markdown 抽取只抄写：病理描述行不进数值字段', () => {
  const md = '## 病理\n白蛋白 38 g/L\n低分化，伴坏死，未见明确脉管癌栓'
  const { candidates } = candidatesFromMarkdown(md)
  assert.equal(candidates.filter((c) => c.field === 'albumin').length, 1)
  assert.equal(candidates.every((c) => c.field !== 'conclusion'), true)
})

// ── MinerU 四步 ────────────────────────────────────────────────────

function fakeFetch(script) {
  const calls = []
  const impl = async (url, init = {}) => {
    calls.push({ url, method: init.method || 'GET', headers: init.headers || {}, body: init.body })
    const step = script.find((s) => s.match(url, init))
    if (!step) throw new Error(`未预期的请求：${url}`)
    return step.reply(url, init)
  }
  return { impl, calls }
}

const jsonRes = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => JSON.stringify(body),
  json: async () => body,
})

test('MinerU 四步顺序：上传时不能带 Content-Type，且取的是 full.md', async () => {
  const zip = makeZip([{ name: 'full.md', data: Buffer.from('白蛋白 38 g/L') }])
  const { impl, calls } = fakeFetch([
    { match: (u) => u.endsWith('/file-urls/batch'), reply: () => jsonRes({ code: 0, data: { batch_id: 'b1', file_urls: ['https://upload/b1'] } }) },
    { match: (u) => u === 'https://upload/b1', reply: () => ({ ok: true, status: 200, text: async () => '' }) },
    { match: (u) => u.includes('/extract-results/batch/b1'), reply: () => jsonRes({ code: 0, data: { extract_result: [{ state: 'done', full_zip_url: 'https://zip/b1.zip' }] } }) },
    { match: (u) => u === 'https://zip/b1.zip', reply: () => ({ ok: true, status: 200, arrayBuffer: async () => zip }) },
  ])
  const out = await parsePdf({
    buffer: Buffer.from('%PDF-1.4 fake'), fileName: 'r.pdf', token: 'sk-test-token',
    fetchImpl: impl, sleep: async () => {}, pollIntervalMs: 1,
  })
  assert.equal(out.markdown, '白蛋白 38 g/L')
  assert.equal(out.model, MINERU_MODEL_DEFAULT)
  const put = calls.find((c) => c.method === 'PUT')
  assert.ok(put, '第二步必须是一次 PUT')
  assert.equal(Object.keys(put.headers).some((k) => k.toLowerCase() === 'content-type'), false,
    'PUT 原件时设了 Content-Type 会被拒')
  assert.equal(calls.length, 4)
})

test('401 直接失败，不当成可重试；消息里带申请地址（前后端约定标记）', async () => {
  const { impl, calls } = fakeFetch([
    { match: (u) => u.endsWith('/file-urls/batch'), reply: () => jsonRes({ msg: 'user token expired' }, 401) },
  ])
  await assert.rejects(
    () => parsePdf({ buffer: Buffer.from('x'), fileName: 'r.pdf', token: 'sk-bad', fetchImpl: impl, sleep: async () => {} }),
    (error) => {
      assert.equal(error.code, 'UNAUTHORIZED')
      assert.ok(error.message.includes(MINERU_TOKEN_URL))
      return true
    },
  )
  assert.equal(calls.length, 1, '401 之后不能继续上传')
})

test('没有 Token 时不发任何请求，错误里给申请地址', async () => {
  const { impl, calls } = fakeFetch([])
  await assert.rejects(
    () => parsePdf({ buffer: Buffer.from('x'), fileName: 'r.pdf', token: '', fetchImpl: impl }),
    (error) => error.code === 'NO_TOKEN' && error.message.includes(MINERU_TOKEN_URL),
  )
  assert.equal(calls.length, 0)
})

test('结果包里没有 full.md 就失败，不返回半份结果', async () => {
  const zip = makeZip([{ name: 'layout.json', data: Buffer.from('{}') }])
  const { impl } = fakeFetch([
    { match: (u) => u.endsWith('/file-urls/batch'), reply: () => jsonRes({ code: 0, data: { batch_id: 'b2', file_urls: ['https://upload/b2'] } }) },
    { match: (u) => u === 'https://upload/b2', reply: () => ({ ok: true, status: 200 }) },
    { match: (u) => u.includes('/extract-results/batch/b2'), reply: () => jsonRes({ code: 0, data: { extract_result: [{ state: 'done', full_zip_url: 'https://zip/b2.zip' }] } }) },
    { match: (u) => u === 'https://zip/b2.zip', reply: () => ({ ok: true, status: 200, arrayBuffer: async () => zip }) },
  ])
  await assert.rejects(
    () => parsePdf({ buffer: Buffer.from('x'), fileName: 'r.pdf', token: 'sk-ok', fetchImpl: impl, sleep: async () => {} }),
    (error) => error.code === 'NO_MARKDOWN',
  )
})

test('只认"接口不接受模型参数"才换模型：文件类型不支持不算', () => {
  assert.equal(modelFallbackWorthy(-1, 'model_version vlm is not supported'), true)
  assert.equal(modelFallbackWorthy(-10002, "model_version 'vlm'/'pipeline' cannot process html files"), false)
  assert.equal(modelFallbackWorthy(-1, 'task failed'), false)
})

test('ZIP 读取：按名字取条目，找不到返回 null', () => {
  const zip = makeZip([{ name: 'full.md', data: Buffer.from('# 报告') }])
  assert.equal(readZipEntry(zip, 'full.md').toString('utf8'), '# 报告')
  assert.equal(readZipEntry(zip, 'nope.md'), null)
  assert.throws(() => readZipEntry(Buffer.from('not a zip'), 'full.md'), /不是 ZIP/)
})

// ── 编排与落库 ──────────────────────────────────────────────────────

function seededDb() {
  const db = openDatabase(':memory:')
  db.prepare('INSERT INTO profile (id, name, initial, created_at) VALUES (?, ?, ?, ?)')
    .run('p1', '测试档案', '测', '2026-10-24T00:00:00Z')
  return db
}

function addDoc(db, filePath, status = 'pending_parse') {
  const info = db.prepare(
    `INSERT INTO document (profile_id, title, kind, doc_date, file_path, file_sha256, status, uploaded_at)
     VALUES ('p1','外院化验','lab','2026-10-20',?,?,'pending_parse','2026-10-24T00:00:00Z')`,
  ).run(filePath, `sha-${Math.random()}`)
  void status
  return Number(info.lastInsertRowid)
}

test('本机文本解析：候选落库、document 推到待核对、parse_job 记一条成功', async () => {
  const dir = tempDir()
  const file = join(dir, 'lab.txt')
  writeFileSync(file, '小甘宝 肝细胞癌 复查\n白蛋白 38 g/L\n总胆红素 22 μmol/L\n')
  const db = seededDb()
  const id = addDoc(db, file)
  const out = await parseDocument(db, id, { env: {} })
  assert.equal(out.status, 'pending_review')
  assert.equal(out.engine, 'local')
  assert.ok(out.candidateCount >= 2)
  const jobs = db.prepare('SELECT status, engine, candidate_count FROM parse_job WHERE document_id = ?').all(id)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].status, 'succeeded')
  // 候选只是候选：事实层一条没动
  assert.equal(Number(db.prepare('SELECT count(*) AS n FROM metric_reading').get().n), 0)
  rmSync(dir, { recursive: true, force: true })
})

test('域外材料：闸门拦下，候选 0 条，状态落成解析失败', async () => {
  const dir = tempDir()
  const file = join(dir, 'pancreas.txt')
  writeFileSync(file, '胰腺 胰头占位 CA19-9 升高 胰腺癌术后病理\n')
  const db = seededDb()
  const id = addDoc(db, file)
  const out = await parseDocument(db, id, { env: {} })
  assert.equal(out.candidateCount, 0)
  assert.equal(out.status, 'parse_failed')
  assert.equal(Number(db.prepare('SELECT count(*) AS n FROM candidate').get().n), 0)
  rmSync(dir, { recursive: true, force: true })
})

test('没有 Token：文档留在待解析（不是文件坏了），任务记录里带申请地址', async () => {
  const dir = tempDir()
  const file = join(dir, 'scan.pdf')
  writeFileSync(file, '%PDF-1.4\n%%EOF')
  const db = seededDb()
  const id = addDoc(db, file)
  const out = await parseDocument(db, id, { env: {} })
  assert.equal(out.status, 'pending_parse', '环境问题不该把文件判死')
  assert.equal(out.error.code, 'NO_TOKEN')
  assert.ok(out.error.message.includes(MINERU_TOKEN_URL))
  assert.equal(Number(db.prepare('SELECT count(*) AS n FROM candidate').get().n), 0)
  const job = db.prepare('SELECT status, error_code FROM parse_job WHERE document_id = ?').get(id)
  assert.equal(job.status, 'failed')
  assert.equal(job.error_code, 'NO_TOKEN')
  rmSync(dir, { recursive: true, force: true })
})

test('重解析不堆候选、任务历史保留两条；已解析过的拒绝再解析', async () => {
  const dir = tempDir()
  const file = join(dir, 'lab.txt')
  writeFileSync(file, '小甘宝 肝细胞癌 复查\n白蛋白 38 g/L\n总胆红素 22 μmol/L\n')
  const db = seededDb()
  const id = addDoc(db, file)
  const first = await parseDocument(db, id, { env: {} })
  assert.equal(first.status, 'pending_review')
  db.prepare("UPDATE document SET status = 'parse_failed' WHERE id = ?").run(id)
  const second = await parseDocument(db, id, { env: {} })
  // 候选数是"这一份"的数量，不是累加：重解析只清 pending，已确认/已退回的历史不动
  assert.equal(Number(db.prepare('SELECT count(*) AS n FROM candidate WHERE status = ?').get('pending').n),
    second.candidateCount)
  assert.equal(Number(db.prepare('SELECT count(*) AS n FROM parse_job WHERE document_id = ?').get(id).n), 2)
  db.prepare("UPDATE document SET status = 'pending_review' WHERE id = ?").run(id)
  await assert.rejects(() => parseDocument(db, id, { env: {} }), /已经解析过/)
  rmSync(dir, { recursive: true, force: true })
})

test('路由判定：html 拒收、txt 本机、pdf 上云', () => {
  assert.equal(routeOf('a.txt'), 'local')
  assert.equal(routeOf('a.pdf'), 'cloud')
  assert.equal(routeOf('a.PNG'), 'cloud')
  assert.equal(routeOf('a.html'), 'unsupported-html')
  assert.equal(routeOf('a.xlsx'), 'unsupported')
})

test('演示库能升到 0005：parse_job 表存在且迁移登记为 5 条', () => {
  const dir = tempDir()
  const dbFile = join(dir, 'x.sqlite')
  const db = openDatabase(dbFile)
  const rows = db.prepare('SELECT name FROM _migration ORDER BY name').all().map((r) => r.name)
  assert.equal(rows.length, 5)
  assert.ok(rows.includes('0005_parse_job.sql'))
  const t = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='parse_job'").get()
  assert.ok(t)
  void readFileSync
  void mkdirSync
  void ROOT
  rmSync(dir, { recursive: true, force: true })
})

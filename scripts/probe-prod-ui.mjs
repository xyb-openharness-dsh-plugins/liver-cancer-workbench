#!/usr/bin/env node
// 生产版 UI 冒烟：把 lib/client.js 放进一个假宿主里，用真 Chrome 点一遍。
//
// 为什么不是单元测试：前端这套是模板字符串 + createElement，语法检查过得去、逻辑照样能错。
// 之前就吃过"卡片点了不翻""按钮只切显隐"的亏，只有真 DOM、真事件、真 fetch 才看得出来。
//
// 做法：起一个本地 http 服务，同时提供
//   /               假宿主页面（React UMD + __ModuleLoader__ + 假 ctx）
//   /client.js      被测文件
//   /api/*          直接复用 dsh/api.js 的 handler，返回真实演示库数据
// 浏览器操作：切到「导入与候选」→ 点队列第一份 → 确认一条候选 → 看趋势是否多出一个点。
//
// 用法：node scripts/probe-prod-ui.mjs [--keep]
// 退出码：0 全通过 / 1 有断言失败
import { createServer } from 'node:http'
import { readFileSync, copyFileSync, mkdirSync } from 'node:fs'
import { mkdtemp, copyFile } from 'node:fs/promises'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const NM = '/Users/qinxiaoqiang/.workbuddy/binaries/node/workspace/node_modules'

const { openDatabase } = await import(join(ROOT, 'dsh/db.js'))
const { createHandlers } = await import(join(ROOT, 'dsh/api.js'))

// 演示库只读用，写操作在临时副本上做——探针不能污染 repository 里的 demo 库
const tmp = await mkdtemp(join(homedir(), '.xyb-probe-'))
const dbPath = join(tmp, 'probe.sqlite')
await copyFile(join(ROOT, 'demo/demo-data.sqlite'), dbPath)
const db = openDatabase(dbPath)
const handlers = createHandlers({ getDb: () => db, version: 'probe' })

const PAGE = `<!doctype html><meta charset="utf-8">
<title>probe</title>
<style>html,body{margin:0;height:100%}#root{height:100%;display:flex}</style>
<div id="root"></div>
<script src="/vendor/react.js"></script>
<script src="/vendor/react-dom.js"></script>
<script>
  window.__probeErrors__ = [];
  window.addEventListener('error', (e) => window.__probeErrors__.push(String(e.message)));
  const require = (name) => {
    if (name === 'react') return window.React;
    throw new Error('unexpected require: ' + name);
  };
  let mounted = null;
  window.__ModuleLoader__ = {
    load({ id, factory }) {
      const mod = factory(require);
      const ctx = {
        effect(fn) { fn(); return () => {}; },
        desktopWorkbenches: {
          register(meta, Component) { mounted = { meta, Component }; },
        },
      };
      mod.apply(ctx);
      if (!mounted) throw new Error('workbench 没有注册');
      document.title = mounted.meta.title;
      ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(mounted.Component));
    },
  };
</script>
<script src="/client.js"></script>`

const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1')
  if (url.pathname === '/favicon.ico') { res.writeHead(204).end(); return }
  if (url.pathname === '/') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(PAGE)
    return
  }
  if (url.pathname === '/client.js') {
    res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' }).end(readFileSync(join(ROOT, 'lib/client.js')))
    return
  }
  if (url.pathname.startsWith('/vendor/')) {
    const name = url.pathname.slice('/vendor/'.length)
    const file = name === 'react.js' ? join(NM, 'react/umd/react.development.js') : join(NM, 'react-dom/umd/react-dom.development.js')
    res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' }).end(readFileSync(file))
    return
  }
  const route = handlers.find((r) => r.path === url.pathname)
  if (!route) { res.writeHead(404).end('{}'); return }
  // 方法白名单照 dsh/guard.js 的做法拦一道：读路由只认 GET，写路由只认 POST
  const allow = route.methods || ['GET']
  if (!allow.includes(req.method)) {
    res.writeHead(405, { 'content-type': 'application/json', allow: allow.join(', ') }).end(JSON.stringify({ error: 'method_not_allowed' }))
    return
  }
  const chunks = []
  req.on('data', (c) => chunks.push(c))
  req.on('end', () => {
    let body = {}
    if (chunks.length) {
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch {
        res.writeHead(400, { 'content-type': 'application/json' }).end(JSON.stringify({ error: '请求体不是合法 JSON' }))
        return
      }
    }
    Promise.resolve(route.run(url, body))
      .then((out) => res.writeHead(out.status, { 'content-type': 'application/json; charset=utf-8' }).end(JSON.stringify(out.body)))
      .catch((e) => res.writeHead(500).end(JSON.stringify({ error: e.message })))
  })
})

await new Promise((r) => server.listen(0, '127.0.0.1', r))
const port = server.address().port
const base = `http://127.0.0.1:${port}`

const puppeteer = (await import(join(NM, 'puppeteer-core/lib/puppeteer/puppeteer-core.js'))).default
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const browser = await puppeteer.launch({
  executablePath: chrome, headless: 'new',
  args: ['--no-sandbox', `--proxy-server=${process.env.http_proxy || ''}`, '--proxy-bypass-list=127.0.0.1'],
})

const fails = []
const check = (ok, msg) => { if (!ok) fails.push(msg); return ok }

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 900 })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  await page.goto(base, { waitUntil: 'networkidle0' })
  try {
    await page.waitForSelector('.wb-liver-cancer-workbench .wb-card', { timeout: 10000 })
  } catch (e) {
    const dump = await page.evaluate(() => ({ html: document.body.innerHTML.slice(0, 1200), err: window.__probeErrors__ }))
    console.error('首屏没渲染出卡片。DOM：', dump.html)
    console.error('页面错误：', dump.err, errors)
    throw e
  }

  // 1) 切到导入视图
  const tabs = await page.$$('.wb-nav button')
  const names = await Promise.all(tabs.map((t) => t.evaluate((n) => n.textContent)))
  check(names.length === 10, `导航是 ${names.length} 项，应为 10：${names.join('/')}`)
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('.wb-nav button')].find((n) => n.textContent === '导入与候选')
    b.click()
  })
  await page.waitForSelector('.wb-qrow', { timeout: 8000 })

  // 2) 队列要有三种状态
  const queue = await page.$$eval('.wb-qrow', (rows) => rows.map((r) => ({
    title: r.querySelector('b').textContent,
    status: r.querySelector('.wb-st').textContent,
    note: r.querySelector('.csrc') ? r.querySelector('.csrc').textContent : '',
  })))
  check(queue.length === 3, `队列 ${queue.length} 份，应为 3`)
  check(queue.some((q) => q.status === '未接收' && q.note.startsWith('[guard]')), '域外材料的状态或理由没显示出来')
  check(queue.some((q) => q.status === '线索不足'), '线索不足的文件没有单独状态')
  check(queue.some((q) => q.status === '待确认'), '没有待确认的文件')

  // 3) 点开待确认那份，候选必须带原文行
  await page.evaluate(() => {
    const r = [...document.querySelectorAll('.wb-qrow')].find((n) => n.querySelector('.wb-st').textContent === '待确认')
    r.click()
  })
  await page.waitForSelector('.wb-cand', { timeout: 8000 })
  const cands = await page.$$eval('.wb-cand', (rows) => rows.map((r) => ({
    field: r.querySelector('.cfield').textContent,
    src: r.querySelector('.csrc') ? r.querySelector('.csrc').textContent : '',
    acceptDisabled: r.querySelector('.wb-btn.primary').disabled,
  })))
  check(cands.length === 5, `候选 ${cands.length} 条，应为 5`)
  check(cands.every((c) => c.src.includes('g/L') || c.src.includes('μmol/L') || c.src.includes('U/L') || c.src.includes('10⁹/L')),
    '有候选没显示原文行，用户没法核对')

  // 4) 确认一条 —— 走真实 POST，落库后趋势应多一个点
  const before = await page.evaluate(async (p) => {
    const r = await fetch(`/api/liver-cancer-workbench/metrics?profile=${p}`).then((x) => x.json())
    return r.metrics.find((m) => m.id === 'albumin').count
  }, 'p1')
  await page.evaluate(() => document.querySelector('.wb-cand .wb-btn.primary').click())
  await page.waitForFunction(() => document.querySelectorAll('.wb-cand .wb-tag')[0].textContent !== '待确认', { timeout: 8000 })
  const after = await page.evaluate(async (p) => {
    const r = await fetch(`/api/liver-cancer-workbench/metrics?profile=${p}`).then((x) => x.json())
    return r.metrics.find((m) => m.id === 'albumin').count
  }, 'p1')
  check(after > before, `确认后面白蛋白记录数没变（${before} → ${after}），写链路没通`)

  // 5) 退回一条：状态变、不写指标
  const rejected = await page.evaluate(async () => {
    const btns = [...document.querySelectorAll('.wb-cand')]
    const row = btns.find((r) => r.querySelector('.wb-tag').textContent === '待确认')
    row.querySelectorAll('.wb-btn')[1].click()
    await new Promise((r) => setTimeout(r, 700))
    return [...document.querySelectorAll('.wb-cand .wb-tag')].map((t) => t.textContent)
  })
  check(rejected.includes('已退回'), '退回没有生效')

  mkdirSync(join(ROOT, 'prototypes/v0.1'), { recursive: true })
  await page.screenshot({ path: join(ROOT, 'prototypes/v0.1/prod-view-import.png'), fullPage: true })

  check(errors.length === 0, `控制台报错：${errors.slice(0, 3).join(' | ')}`)
} finally {
  await browser.close()
  server.close()
  db.close()
  if (!process.argv.includes('--keep')) {
    const { rm } = await import('node:fs/promises')
    await rm(tmp, { recursive: true, force: true })
  }
}

if (fails.length) {
  console.error('UI 冒烟未通过：')
  for (const f of fails) console.error(`  - ${f}`)
  process.exit(1)
}
console.log('UI 冒烟通过：10 个视图、导入队列三态、候选带原文、确认写库、退回不写库、无控制台报错。')

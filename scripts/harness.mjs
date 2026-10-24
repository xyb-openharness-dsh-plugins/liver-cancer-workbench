// 假宿主外壳：把 lib/client.js 放进一个最小的 DSH 桌面宿主里跑，供两个探针共用。
//
// 为什么要有这个文件：会话面板这块的合同（语义 header 首位、conversation 是 DOM 节点、
// 会话归属靠 currentSession + ownsSession）只有真 DOM 才验证得了；如果每个脚本各写一份
// 假宿主，两份会各自漂移，最后谁也证明不了什么。
import { createServer } from 'node:http'
import { readFileSync, mkdirSync } from 'node:fs'
import { mkdtemp, copyFile, rm } from 'node:fs/promises'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const NM = '/Users/qinxiaoqiang/.workbuddy/binaries/node/workspace/node_modules'

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
  // 假宿主：会话归属、订阅、调起会话都按官方合同的最小面实现，
  // 这样顶栏「AI 对话」按钮走的是真分支，而不是永远 disabled。
  const listeners = new Set();
  let currentId = null;
  const conversationNode = document.createElement('div');
  conversationNode.id = 'fake-conversation';
  conversationNode.textContent = '原生会话占位（假宿主）';
  conversationNode.style.padding = '16px';
  conversationNode.style.fontSize = '13px';
  window.__ModuleLoader__ = {
    load({ id, factory }) {
      const mod = factory(require);
      const ctx = {
        effect(fn) { fn(); return () => {}; },
        sessions: { scope() { return null; } },
        desktopWorkbenches: {
          register(meta, Component) { mounted = { meta, Component }; },
          currentSession() { return currentId; },
          ownsSession(id) { return id === currentId; },
          subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
          async ensureSession() {
            currentId = 'probe-session-1';
            listeners.forEach((fn) => fn());
            return currentId;
          },
        },
      };
      window.__probeService__ = ctx.desktopWorkbenches;
      mod.apply(ctx);
      if (!mounted) throw new Error('workbench 没有注册');
      window.__probeMeta__ = mounted.meta;
      document.title = mounted.meta.title;
      ReactDOM.createRoot(document.getElementById('root'))
        .render(React.createElement(mounted.Component, { conversation: conversationNode }));
    },
  };
</script>
<script src="/client.js"></script>`

/**
 * 起一个本地 http 服务，同时提供假宿主页面、被测 client.js、以及真实 dsh/api.js 的读路由。
 * 演示库只读用，写操作在临时副本上做——探针不能污染 repository 里的 demo 库。
 */
export async function startHarness() {
  const { openDatabase } = await import(join(ROOT, 'dsh/db.js'))
  const { createHandlers } = await import(join(ROOT, 'dsh/api.js'))

  const tmp = await mkdtemp(join(homedir(), '.xyb-probe-'))
  const dbPath = join(tmp, 'probe.sqlite')
  await copyFile(join(ROOT, 'demo/demo-data.sqlite'), dbPath)
  const db = openDatabase(dbPath)
  const handlers = createHandlers({ getDb: () => db, version: 'probe' })

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
  return {
    base: `http://127.0.0.1:${port}`,
    async close({ keep = false } = {}) {
      server.close()
      db.close()
      if (!keep) await rm(tmp, { recursive: true, force: true })
    },
  }
}

/** 真 Chrome，连本机 127.0.0.1 不走代理 */
export async function launchBrowser() {
  const puppeteer = (await import(join(NM, 'puppeteer-core/lib/puppeteer/puppeteer-core.js'))).default
  return puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', `--proxy-server=${process.env.http_proxy || ''}`, '--proxy-bypass-list=127.0.0.1'],
  })
}

export function ensureShotDir() {
  const dir = join(ROOT, 'prototypes/v0.1')
  mkdirSync(dir, { recursive: true })
  return dir
}

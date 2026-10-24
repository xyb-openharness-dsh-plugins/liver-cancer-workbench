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
import { join } from 'node:path'
import { readFileSync, statSync, existsSync } from 'node:fs'
import { startHarness, launchBrowser, ensureShotDir, ROOT } from './harness.mjs'

const SHOT = ensureShotDir()
const harness = await startHarness()
const base = harness.base
const browser = await launchBrowser()

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

  // 0) 面板骨架：语义 header 必须在首位、一级导航在侧栏、顶栏有 AI 对话按钮
  const frame = await page.evaluate(() => {
    const root = document.querySelector('.wb-liver-cancer-workbench')
    const agent = document.querySelector('.wb-agent')
    return {
      firstTag: root.firstElementChild ? root.firstElementChild.tagName : '',
      sideNav: document.querySelectorAll('.wb-side .wb-nav button').length,
      agentLabel: (document.querySelector('.wb-btn-agent') || {}).textContent || '',
      paneDisplay: agent ? getComputedStyle(agent).display : 'missing',
      meta: window.__probeMeta__,
    }
  })
  check(frame.firstTag === 'HEADER', `根节点首个子元素是 ${frame.firstTag}，必须是语义 header`)
  check(frame.sideNav === 12, `侧栏一级导航 ${frame.sideNav} 项，应为 12`)
  check(frame.meta?.customFrame === true, 'register 没有声明 customFrame')
  check(frame.meta?.layout?.businessSide === 'left', 'layout.businessSide 不是 left')
  check(frame.paneDisplay === 'none', `没有会话时会话区应隐藏，实际 display=${frame.paneDisplay}`)

  // 0b) 点「AI 对话」调起会话 → 按钮文案翻转、会话区出现、splitter 出现
  await page.evaluate(() => document.querySelector('.wb-btn-agent').click())
  await page.waitForFunction(
    () => document.querySelector('.wb-btn-agent').textContent === '收起 AI 对话',
    { timeout: 6000 })
  const opened = await page.evaluate(() => ({
    pane: getComputedStyle(document.querySelector('.wb-agent')).display,
    splitter: Boolean(document.querySelector('.wb-splitter')),
    conv: Boolean(document.getElementById('fake-conversation')),
    // 真宿主交给我们的是 React 元素，必须当子节点渲染；appendChild 那条路会挂不上
    convInPane: Boolean(document.querySelector('.wb-agent #fake-conversation')),
  }))
  check(opened.pane !== 'none', '调起会话后会话区仍是隐藏的')
  check(opened.conv, '原生会话节点没被渲染进会话区')
  check(opened.convInPane, '原生会话元素没有作为 React 子节点渲染进 .wb-agent（真机会是空面板）')
  check(opened.splitter, '宽屏下没有 splitter，调不了宽度')
  await page.screenshot({ path: join(SHOT, 'prod-view-agent.png') })

  // 0c) 键盘调宽：← 应为 +2%，且写进 localStorage
  const w0 = await page.evaluate(() => Number(document.querySelector('.wb-splitter').getAttribute('aria-valuenow')))
  await page.focus('.wb-splitter')
  await page.keyboard.press('ArrowLeft')
  await page.waitForFunction((prev) => Number(document.querySelector('.wb-splitter').getAttribute('aria-valuenow')) > prev, { timeout: 3000 }, w0)
  const w1 = await page.evaluate(() => Number(document.querySelector('.wb-splitter').getAttribute('aria-valuenow')))
  const saved = await page.evaluate(() => localStorage.getItem('ganbao.liver.agent-pane.v1'))
  check(w1 === w0 + 2, `键盘 ← 应 +2%，实际 ${w0} → ${w1}`)
  check(Boolean(saved && JSON.parse(saved).width), '宽度没有写进 localStorage，重开就忘了')

  // 0d) 鼠标拖动：往左拖应继续变宽
  const box = await page.evaluate(() => {
    const r = document.querySelector('.wb-splitter').getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })
  await page.mouse.move(box.x, box.y)
  await page.mouse.down()
  await page.mouse.move(box.x - 60, box.y, { steps: 5 })
  await page.mouse.up()
  const w2 = await page.evaluate(() => Number(document.querySelector('.wb-splitter').getAttribute('aria-valuenow')))
  check(w2 > w1, `拖 splitter 没有变宽：${w1} → ${w2}`)

  // 0e) 收起 → 只隐藏、不卸载会话；再打开回到同一栏
  await page.evaluate(() => [...document.querySelectorAll('.wb-btn-ghost')].find((b) => b.textContent === '×').click())
  const collapsed = await page.evaluate(() => ({
    pane: getComputedStyle(document.querySelector('.wb-agent')).display,
    label: document.querySelector('.wb-btn-agent').textContent,
    splitter: Boolean(document.querySelector('.wb-splitter')),
    convStillMounted: Boolean(document.getElementById('fake-conversation')),
  }))
  check(collapsed.pane === 'none', '点 × 后会话区没隐藏')
  check(collapsed.label === '打开 AI 对话', `收起后按钮应显示「打开 AI 对话」，实际「${collapsed.label}」`)
  check(!collapsed.splitter, '收起了还留着 splitter')
  check(collapsed.convStillMounted, '收起把会话节点卸载了（输入框状态会丢）')

  await page.evaluate(() => document.querySelector('.wb-btn-agent').click())
  await page.waitForFunction(() => document.querySelector('.wb-btn-agent').textContent === '收起 AI 对话', { timeout: 3000 })

  // 0f) 窄屏：侧栏折叠成横排、会话改覆盖式抽屉、splitter 消失
  await page.setViewport({ width: 700, height: 900 })
  await page.waitForFunction(() => !document.querySelector('.wb-splitter'), { timeout: 4000 })
  const narrowState = await page.evaluate(() => ({
    navDir: getComputedStyle(document.querySelector('.wb-side .wb-nav')).flexDirection,
    sideCols: getComputedStyle(document.querySelector('.wb-business')).gridTemplateColumns.split(' ').length,
    drawer: getComputedStyle(document.querySelector('.wb-agent')).position,
  }))
  check(narrowState.navDir === 'row', `窄屏一级导航应横排，实际 ${narrowState.navDir}`)
  check(narrowState.sideCols === 1, `窄屏业务区应为单列，实际 ${narrowState.sideCols} 列`)
  check(narrowState.drawer === 'absolute', '窄屏会话应为覆盖式抽屉')
  await page.screenshot({ path: join(SHOT, 'prod-view-narrow.png') })

  // 0g) 抽屉要能点遮罩关掉：不点遮罩的话手机上一个浮层盖住半个屏幕就没出口
  await page.evaluate(() => document.querySelector('.wb-scrim').click())
  await page.waitForFunction(
    () => getComputedStyle(document.querySelector('.wb-agent')).display === 'none', { timeout: 3000 })
  await page.evaluate(() => document.querySelector('.wb-btn-agent').click())
  await page.waitForFunction(() => document.querySelector('.wb-btn-agent').textContent === '收起 AI 对话', { timeout: 3000 })

  await page.setViewport({ width: 1280, height: 900 })
  await page.waitForFunction(() => Boolean(document.querySelector('.wb-splitter')), { timeout: 4000 })

  // 1) 切到导入视图
  const tabs = await page.$$('.wb-nav button')
  const names = await Promise.all(tabs.map((t) => t.evaluate((n) => n.textContent)))
  check(names.length === 12, `导航是 ${names.length} 项，应为 12：${names.join('/')}`)
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
  check(queue.length === 4, `队列 ${queue.length} 份，应为 4`)
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

  await page.screenshot({ path: join(SHOT, 'prod-view-import.png'), fullPage: true })

  // 6) 解析：演示库三份原件正好是闸门的三种结局，逐个点一遍——
  //    只测"按钮存在"是不够的，之前就吃过"按钮在、点了没反应"的亏。
  const PARSE_ROWS = await page.$$eval('.wb-qrow-wrap', (ws) => ws.map((w) => ({
    title: w.querySelector('b').textContent,
    label: w.querySelector('.wb-qparse') ? w.querySelector('.wb-qparse').textContent : '',
  })))
  check(PARSE_ROWS.filter((r) => r.label).length === 3,
    `带解析按钮的队列行 ${PARSE_ROWS.filter((r) => r.label).length} 行，应为 3（待解析 2 + 解析失败 1）`)

  const clickParse = async (title) => {
    await page.evaluate((t) => {
      const w = [...document.querySelectorAll('.wb-qrow-wrap')].find((n) => n.querySelector('b').textContent === t)
      if (!w) throw new Error('队列里没有这一行：' + t)
      w.querySelector('.wb-qparse').click()
    }, title)
    await page.waitForFunction(() => {
      const b = document.querySelector('.wb-notice[data-tone=info] b')
      return Boolean(b && b.textContent.includes('解析完成'))
    }, { timeout: 20000 })
    return page.evaluate(() => document.querySelector('.wb-notice[data-tone=info] b').textContent)
  }

  const okNote = await clickParse('肝外科门诊病历（2026-08-28）')
  check(/5 条候选/.test(okNote) && /待确认/.test(okNote), `通过闸门那份的解析结果不对：${okNote}`)
  await page.evaluate(() => {
    const w = [...document.querySelectorAll('.wb-qrow-wrap')].find((n) => n.querySelector('b').textContent === '肝外科门诊病历（2026-08-28）')
    w.querySelector('.wb-qrow').click()
  })
  await page.waitForSelector('.wb-cand', { timeout: 8000 })
  const parsedCands = await page.$$eval('.wb-cand', (rows) => rows.map((r) => r.querySelector('.cfield').textContent))
  check(parsedCands.length === 5, `解析后候选 ${parsedCands.length} 条，应为 5：${parsedCands.join('/')}`)
  check(parsedCands.includes('白蛋白') && parsedCands.includes('总胆红素'),
    `解析出的字段不像化验单：${parsedCands.join('/')}`)

  const poorNote = await clickParse('常规体检报告（2026-08-12）')
  check(/0 条候选/.test(poorNote) && /线索不足/.test(poorNote), `线索不足那份的解析结果不对：${poorNote}`)
  const offNote = await clickParse('胰腺增强 CT 报告')
  check(/0 条候选/.test(offNote) && /未接收/.test(offNote), `域外那份的解析结果不对（不该抽出候选）：${offNote}`)
  check(!/mineru\.net\/apiManage\/token/.test(offNote), '本机解析不该弹出 Token 申请入口')
  await page.screenshot({ path: join(SHOT, 'prod-view-parse.png'), fullPage: true })

  // 7) 设置页：Token 只进文件不回界面、三档字号共用一个开关
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('.wb-nav button')].find((n) => n.textContent === '设置')
    b.click()
  })
  await page.waitForSelector('.wb-set-tiers', { timeout: 8000 })
  await page.waitForFunction(() => [...document.querySelectorAll('.wb-set-main b')]
    .every((b) => !b.textContent.includes('正在读取状态')), { timeout: 8000 })
  const settings = await page.evaluate(() => ({
    tiers: document.querySelectorAll('.wb-tier').length,
    checked: [...document.querySelectorAll('.wb-tier')].filter((b) => b.getAttribute('aria-checked') === 'true').length,
    inputType: (document.querySelector('.wb-input') || {}).type,
    mains: [...document.querySelectorAll('.wb-set-main b')].map((b) => b.textContent),
    hint: (document.querySelector('.wb-set-form + p, .wb-set-note') || {}).textContent || '',
  }))
  check(settings.tiers === 3 && settings.checked === 1,
    `字号档位 ${settings.tiers} 个 / 选中 ${settings.checked} 个，应为 3 / 1`)
  check(settings.inputType === 'password', 'Token 输入框不是 password 类型（会明文露在屏幕上）')
  check(settings.mains.some((t) => t.includes('尚未配置')), `没配 Token 时状态文案不明确：${settings.mains.join(' | ')}`)
  check(settings.mains.some((t) => t.includes(ROOT)), '资料目录没显示出来')

  const TOKEN = 'sk-probe000000000054'
  await page.type('.wb-input', TOKEN)
  await page.evaluate(() => [...document.querySelectorAll('.wb-set-form .wb-btn')]
    .find((b) => b.textContent === '保存').click())
  await page.waitForFunction(() => [...document.querySelectorAll('.wb-set-main b')]
    .some((b) => b.textContent.includes('当前生效')), { timeout: 8000 })
  const savedToken = await page.evaluate(() => {
    const b = [...document.querySelectorAll('.wb-set-main b')].find((x) => x.textContent.includes('当前生效'))
    return {
      label: b.textContent,
      tone: b.getAttribute('data-tone'),
      leakedDom: document.body.innerHTML.includes('sk-probe000000000054'),
      inputValue: document.querySelector('.wb-input').value,
      clearEnabled: ![...document.querySelectorAll('.wb-set-form .wb-btn')]
        .find((x) => x.textContent === '清除').disabled,
    }
  })
  check(savedToken.label.includes('sk-p****54'), `掩码不对（应只露首 4 尾 2）：${savedToken.label}`)
  check(savedToken.tone === 'ok', `保存后状态色是 ${savedToken.tone}，应表示"已保存到文件"`)
  check(!savedToken.leakedDom, 'Token 原文出现在 DOM 里了')
  check(savedToken.inputValue === '', '保存后输入框没清空，明文还留在屏幕上')
  check(savedToken.clearEnabled, '保存后「清除」还是禁用状态')

  // 落盘才算数：界面掩码可以是假的，文件权限与内容不会
  const secret = JSON.parse(readFileSync(harness.secretPath, 'utf8'))
  const mode = (statSync(harness.secretPath).mode & 0o777).toString(8)
  check(secret.token === TOKEN, 'Token 没真正写进密钥文件')
  check(mode === '600', `密钥文件权限是 ${mode}，应为 600`)

  await page.evaluate(() => [...document.querySelectorAll('.wb-set-form .wb-btn')]
    .find((b) => b.textContent === '清除').click())
  await page.waitForFunction(() => [...document.querySelectorAll('.wb-set-main b')]
    .some((b) => b.textContent.includes('尚未配置')), { timeout: 8000 })
  check(!existsSync(harness.secretPath), '清除后密钥文件还在，应该连文件一起删掉')

  // 7b) 三档字号：一个变量乘到每一处，所以标题必须真的变大
  const sizeOf = () => page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('h1')).fontSize))
  const pickTier = async (label) => {
    await page.evaluate((t) => [...document.querySelectorAll('.wb-tier')]
      .find((b) => b.textContent.includes(t)).click(), label)
  }
  const s0 = await sizeOf()
  await pickTier('大字')
  await page.waitForFunction(() => document.querySelector('.wb-liver-cancer-workbench').getAttribute('data-tz') === 'md', { timeout: 3000 })
  const s1 = await sizeOf()
  await pickTier('特大')
  await page.waitForFunction(() => document.querySelector('.wb-liver-cancer-workbench').getAttribute('data-tz') === 'lg', { timeout: 3000 })
  const s2 = await sizeOf()
  const tzSaved = await page.evaluate(() => localStorage.getItem('ganbao.liver.font-scale.v1'))
  check(s0 > 0 && s1 > s0 && s2 > s1, `三档字号没逐级变大：${s0} → ${s1} → ${s2}`)
  check(tzSaved === 'lg', `字号档位没写进 localStorage：${tzSaved}`)
  check(Math.abs(s1 / s0 - 1.15) < 0.05 && Math.abs(s2 / s0 - 1.32) < 0.05,
    `档位倍数不对（应为 1.15 / 1.32）：${(s1 / s0).toFixed(3)} / ${(s2 / s0).toFixed(3)}`)
  await page.screenshot({ path: join(SHOT, 'prod-view-settings.png'), fullPage: true })
  await pickTier('标准')
  await page.waitForFunction(() => document.querySelector('.wb-liver-cancer-workbench').getAttribute('data-tz') === 'sm', { timeout: 3000 })

  // 8) 一图秀：左栏勾选上限 4 条、画布出线、点记录点能固定详情、范围 chips 生效
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('.wb-nav button')].find((n) => n.textContent === '一图秀')
    b.click()
  })
  await page.waitForSelector('.wb-onepage svg', { timeout: 8000 })
  const onePage = await page.evaluate(() => {
    const items = [...document.querySelectorAll('.wb-op-item')]
    return {
      rail: Boolean(document.querySelector('.wb-op-rail')),
      items: items.length,
      picked: items.filter((b) => b.getAttribute('aria-checked') === 'true').length,
      paths: document.querySelectorAll('.wb-op-canvas svg path').length,
      labels: [...document.querySelectorAll('.wb-op-canvas svg text')].length,
      legend: document.querySelectorAll('.wb-op-legend span').length,
      txBands: document.querySelectorAll('.wb-op-canvas svg rect').length,
    }
  })
  check(onePage.rail && onePage.items >= 8, `一图秀左栏应有可选指标，实际 ${onePage.items} 项`)
  check(onePage.picked === 4, `默认应选 4 条，实际 ${onePage.picked}`)
  check(onePage.paths >= 2, `画布上的线只有 ${onePage.paths} 条`)
  check(onePage.legend === onePage.picked, `图例 ${onePage.legend} 条与选中 ${onePage.picked} 条不一致`)
  check(onePage.txBands > 0, '治疗条没画出来')

  // 8b) 上限：再点两条不应超过 4
  await page.evaluate(() => {
    const items = [...document.querySelectorAll('.wb-op-item')]
    const off = items.filter((b) => b.getAttribute('aria-checked') === 'false')
    off[0].click(); off[1].click()
  })
  await page.waitForFunction(() => [...document.querySelectorAll('.wb-op-item')]
    .filter((b) => b.getAttribute('aria-checked') === 'true').length === 4, { timeout: 3000 })

  // 8c) 点一个记录点 → 详情固定
  await page.evaluate(() => {
    const dot = document.querySelector('.wb-op-canvas svg circle[fill="#fff"]')
    dot.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  await page.waitForSelector('.wb-op-detail', { timeout: 3000 })
  const detail = await page.evaluate(() => document.querySelector('.wb-op-detail').textContent)
  check(/前一次|最早/.test(detail), `详情里没有可与前次比较的说明：${detail}`)

  // 8d) 缩放滑杆：拉到 25% 仍然有线（只是窗口变窄）
  await page.evaluate(() => {
    const input = document.querySelector('.wb-op-slider input')
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(input, '25')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await page.waitForFunction(() => document.querySelector('.wb-op-slider').textContent.includes('25%'), { timeout: 3000 })
  const zoomed = await page.evaluate(() => document.querySelectorAll('.wb-op-canvas svg path').length)
  check(zoomed >= 1, '缩放到 25% 后画布没有线了')
  await page.screenshot({ path: join(SHOT, 'prod-view-onepage.png') })

  check(errors.length === 0, `控制台报错：${errors.slice(0, 3).join(' | ')}`)
} finally {
  await browser.close()
  await harness.close({ keep: process.argv.includes('--keep') })
}

if (fails.length) {
  console.error('UI 冒烟未通过：')
  for (const f of fails) console.error(`  - ${f}`)
  process.exit(1)
}
console.log('UI 冒烟通过：12 个视图、会话元素按 React 子节点渲染、一图秀 4 条上限与点选详情、导入队列三态、候选带原文、确认写库、退回不写库、无控制台报错、设置页 Token 只落文件、三档字号逐级生效、解析三态与实际闸门一致。')

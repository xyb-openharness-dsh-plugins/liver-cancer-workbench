#!/usr/bin/env node
// 36 号 v2 专项探针：疾病概要整页视图（§2.5 链接 / 32 号导航）+ 看板状态卡（§2.6）。
//
// 为什么要独立探针：这两块是「原型验收过、装机版新接线」的部分，
// 原型里的断言证明不了 React 版行为——history、Esc、焦点、滚动恢复全得在真 DOM 里点。
//
// 用法：node scripts/probe-primer-ui.mjs [--keep]
// 退出码：0 全通过 / 1 有断言失败
import { startHarness, launchBrowser, ensureShotDir } from './harness.mjs'

const SHOT = ensureShotDir()
const harness = await startHarness()
const base = harness.base
const browser = await launchBrowser()

const fails = []
const check = (ok, msg) => { if (!ok) fails.push(msg); return ok }
const log = (id, ok, extra) => console.log(`${ok ? 'PASS' : 'FAIL'} ${id}${extra ? ' · ' + extra : ''}`)

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 900 })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })

  await page.goto(base, { waitUntil: 'networkidle0' })
  await page.waitForSelector('.wb-liver-cancer-workbench .sc-card', { timeout: 15000 })

  /* ---------- P1 顶栏「?」入口 ---------- */
  const trigger = await page.$('.wb-primer-trigger')
  const triggerAria = trigger ? await page.evaluate((el) => el.getAttribute('aria-label') || '', trigger) : ''
  const p1 = check(!!trigger, 'P1 顶栏找不到「?」入口') && check(
    triggerAria.includes('疾病概要') && triggerAria.includes('肝细胞癌'),
    `P1 入口 aria-label 不含「疾病概要 / 肝细胞癌」：${triggerAria}`,
  )
  log('P1 顶栏「?」入口', p1, triggerAria.slice(0, 40))

  /* ---------- P11 状态卡不能被父容器压扁 ----------
     .wb-body 是 flex column，.sc-card 带 overflow:hidden，
     flex 子项 min-height:auto 在这种组合下不生效——少写 flex:0 0 auto 就会只剩卡头一行。 */
  const squash = await page.evaluate(() => {
    const card = document.querySelector('.sc-card')
    const kids = [...card.children]
    const sum = kids.reduce((n, el) => n + el.getBoundingClientRect().height, 0)
    return { card: Math.round(card.getBoundingClientRect().height), sum: Math.round(sum), kids: kids.length }
  })
  const p11 = check(squash.card >= squash.sum * 0.9,
    `P11 状态卡被压扁：卡高 ${squash.card}px，但 ${squash.kids} 个子元素合计 ${squash.sum}px`)
  log('P11 状态卡没被压扁', p11, `卡高 ${squash.card}px / 子元素合计 ${squash.sum}px`)

  /* ---------- P8 状态卡四件 ---------- */
  const card = await page.evaluate(() => {
    const el = document.querySelector('.sc-card')
    if (!el) return null
    const txt = (sel) => (el.querySelector(sel)?.textContent || '').trim()
    const buttons = [...el.querySelectorAll('.sc-actions button')].map((b) => b.textContent.trim())
    return {
      eyebrow: txt('.sc-eyebrow'), day: txt('.sc-day b'), anchor: txt('.sc-anchor'),
      stage: txt('.sc-stage b'), next: txt('.sc-next'), buttons,
      rect: el.getBoundingClientRect().toJSON(),
    }
  })
  const cardOk = check(!!card, 'P8 看板首屏找不到状态卡')
    && check(/^D\+\d+ 状态卡 · /.test(card?.eyebrow || ''), `P8 卡头格式不对：${card?.eyebrow}`)
    && check(/^第 \d+ 天$/.test(card?.day || ''), `P8 大字天数格式不对：${card?.day}`)
    && check((card?.buttons || []).length >= 2, `P8 出口按钮不足两个：${JSON.stringify(card?.buttons)}`)
    && check((card?.buttons || []).some((t) => t.includes('疾病概要')), 'P8 缺少「疾病概要」副按钮')
  log('P8 状态卡四件', cardOk, `${card?.eyebrow} / ${card?.day} / ${card?.buttons?.length} 个按钮`)

  /* 锚点日期与大字天数必须自洽（防手填） */
  const anchorMatch = /锚点 (\d{4})\.(\d{2})\.(\d{2})/.exec(card?.anchor || '')
  const dayMatch = /^第 (\d+) 天$/.exec(card?.day || '')
  let selfConsistent = false
  if (anchorMatch && dayMatch) {
    const anchorISO = `${anchorMatch[1]}-${anchorMatch[2]}-${anchorMatch[3]}`
    const todayISO = await page.evaluate(() => {
      const n = new Date()
      return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
    })
    const gap = Math.round((Date.parse(todayISO + 'T00:00:00') - Date.parse(anchorISO + 'T00:00:00')) / 86400000)
    selfConsistent = gap === Number(dayMatch[1])
  }
  const p9 = check(selfConsistent, `P9 天数与锚点不自洽：锚点 ${card?.anchor} / 大字 ${card?.day}`)
  log('P9 天数为锚点派生', p9, card?.anchor)

  /* ---------- 打开整页视图 ---------- */
  const before = await page.evaluate(() => ({
    scroll: document.querySelector('.wb-body')?.scrollTop || 0,
    history: history.length,
  }))
  await page.evaluate(() => { const b = document.querySelector('.wb-body'); if (b) b.scrollTop = 180 })
  const scrollBefore = await page.evaluate(() => document.querySelector('.wb-body')?.scrollTop || 0)

  await page.click('.wb-primer-trigger')
  await page.waitForSelector('#disease-primer', { timeout: 5000 })

  /* ---------- P2 四段顺序 ---------- */
  const sections = await page.$$eval('#disease-primer [data-dp-section]', (els) => els.map((e) => e.getAttribute('data-dp-section')))
  const p2 = check(JSON.stringify(sections) === JSON.stringify(['definition', 'evidence', 'landscape', 'trend']),
    `P2 四段顺序不对：${JSON.stringify(sections)}`)
  log('P2 四段顺序', p2, sections.join(' → '))

  /* ---------- P3 面板近全屏 ---------- */
  const size = await page.evaluate(() => {
    const r = document.querySelector('#disease-primer .dp-panel').getBoundingClientRect()
    return { w: r.width, h: r.height, vw: innerWidth, vh: innerHeight }
  })
  const p3 = check(size.w >= size.vw * 0.9 && size.h >= size.vh * 0.9,
    `P3 面板尺寸不足视口 90%：${Math.round(size.w)}x${Math.round(size.h)} / ${size.vw}x${size.vh}`)
  log('P3 面板尺寸', p3, `${Math.round(size.w)}×${Math.round(size.h)} / 视口 ${size.vw}×${size.vh}`)

  /* ---------- P4 指南原件可点（§2.5） ---------- */
  const links = await page.evaluate(() => {
    const panel = document.querySelector('#disease-primer')
    const all = [...panel.querySelectorAll('a.dp-link')].map((a) => a.getAttribute('href') || '')
    const bad = all.filter((h) => !/^https:\/\//i.test(h))
    return {
      total: all.length, bad, miss: panel.querySelectorAll('.dp-miss').length,
      tableLinks: panel.querySelectorAll('.dp-table a.dp-link').length,
      tableRows: panel.querySelectorAll('.dp-table tbody tr').length,
    }
  })
  const p4 = check(links.total > 0, 'P4 面板里没有任何可点链接')
    && check(links.miss === 0, `P4 出现 ${links.miss} 处红色缺链接标记（违反 §2.5）`)
    && check(links.bad.length === 0, `P4 有非 https 链接：${links.bad.join(', ')}`)
    && check(links.tableLinks >= links.tableRows, `P4 指南表 ${links.tableRows} 行只有 ${links.tableLinks} 个可点链接`)
  log('P4 原件可点无红标', p4, `${links.total} 个链接 / 表格 ${links.tableRows} 行 ${links.tableLinks} 链接 / 红标 ${links.miss}`)

  /* ---------- P5 back 与 close 是两个独立节点 ---------- */
  const btns = await page.evaluate(() => {
    const panel = document.querySelector('#disease-primer')
    const back = panel.querySelector('[data-dp="back"], .dp-back')
    const close = panel.querySelector('[data-dp="close"], .dp-close')
    const vis = (el) => !!el && el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0
    return { back: vis(back), close: vis(close), same: back === close }
  })
  const p5 = check(btns.back && btns.close && !btns.same, `P5 返回/关闭不是两个独立可见节点：${JSON.stringify(btns)}`)
  log('P5 返回与关闭两个入口', p5, `back=${btns.back} close=${btns.close} same=${btns.same}`)

  await page.screenshot({ path: `${SHOT}/36v2-primer-top.png` })

  /* ---------- P6 Esc 只退一层 ---------- */
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => !document.querySelector('#disease-primer'), { timeout: 3000 })
  const afterEsc = await page.evaluate(() => ({
    panel: !!document.querySelector('#disease-primer'),
    card: !!document.querySelector('.sc-card'),
    view: document.querySelector('.wb-nav [aria-current="true"], .wb-nav [aria-current="page"]')?.textContent?.trim() || '',
  }))
  const p6 = check(!afterEsc.panel && afterEsc.card, 'P6 Esc 没有只退一层（面板仍在或看板被带走）')
  log('P6 Esc 只退一层', p6, `面板关闭=${!afterEsc.panel} 看板仍在=${afterEsc.card}`)

  /* ---------- P7 焦点回触发者 + 滚动位置恢复 ---------- */
  await page.waitForFunction(() => document.activeElement?.classList?.contains('wb-primer-trigger'), { timeout: 3000 })
    .catch(() => {})
  const afterClose = await page.evaluate(() => ({
    focusOnTrigger: !!document.activeElement?.classList?.contains('wb-primer-trigger'),
    scroll: document.querySelector('.wb-body')?.scrollTop || 0,
  }))
  const p7 = check(afterClose.focusOnTrigger, 'P7 关闭后焦点没有回到触发者')
    && check(Math.abs(afterClose.scroll - scrollBefore) <= 4, `P7 关闭后滚动位置变了：${scrollBefore} → ${afterClose.scroll}`)
  log('P7 焦点与滚动恢复', p7, `focusOnTrigger=${afterClose.focusOnTrigger} scrollTop=${scrollBefore}→${afterClose.scroll}`)

  /* ---------- P10 history 行为：open 压一层自己的状态，close 退回到原来那层 ----------
     注意不能用 history.length 判压栈次数：back() 只移动指针不减长度，
     重新 push 会截断指针之后的历史再填回，长度可能原地不动。判据只能是 history.state。 */
  const st0 = await page.evaluate(() => !!(history.state && history.state.wbPrimerOpen))
  await page.click('.wb-primer-trigger')
  await page.waitForSelector('#disease-primer', { timeout: 5000 })
  const st1 = await page.evaluate(() => !!(history.state && history.state.wbPrimerOpen))
  await page.click('#disease-primer [data-dp="close"], #disease-primer .dp-close')
  await page.waitForFunction(() => !document.querySelector('#disease-primer'), { timeout: 3000 })
  const st2 = await page.evaluate(() => !!(history.state && history.state.wbPrimerOpen))
  const p10 = check(st0 === false, 'P10 打开前 history.state 里已经有 wbPrimerOpen')
    && check(st1 === true, 'P10 打开没有压入自己的历史状态（history.state.wbPrimerOpen 不是 true）')
    && check(st2 === false, 'P10 关闭没有退回原来那层历史（history.state 仍是 wbPrimerOpen）')
  log('P10 history 压栈与退栈', p10, `打开前 ${st0} → 打开后 ${st1} → 关闭后 ${st2}`)

  /* ---------- E0 无控制台报错 ---------- */
  const e0 = check(errors.length === 0, `E0 控制台有报错：${errors.slice(0, 3).join(' | ')}`)
  log('E0 无 console error', e0, errors.length ? errors[0].slice(0, 80) : '干净')

  console.log(`\n截图：${SHOT}/36v2-primer-top.png`)
} finally {
  await browser.close()
  await harness.close()
}

if (fails.length) {
  console.error(`\n${fails.length} 条断言失败：`)
  fails.forEach((f) => console.error(' - ' + f))
  process.exit(1)
}
console.log('\n36 号 v2 专项探针全过。')

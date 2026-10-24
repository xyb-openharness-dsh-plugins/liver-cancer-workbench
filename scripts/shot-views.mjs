#!/usr/bin/env node
// 十一个视图的截图：文档里的 parity 证据图（prod-view-*.png）都出自这里。
//
// 和 probe-prod-ui.mjs 的区别：probe 管断言（点一遍看行为对不对），这里只管"长得对不对"。
// 两者共用 scripts/harness.mjs 的假宿主，避免两份外壳各自漂移。
//
// 用法：node scripts/shot-views.mjs [--keep]
import { join } from 'node:path'
import { startHarness, launchBrowser, ensureShotDir } from './harness.mjs'

const SHOT = ensureShotDir()
const harness = await startHarness()
const browser = await launchBrowser()

const VIEWS = [
  ['dash', '看板'], ['onepage', '一图秀'], ['metrics', '指标分析'], ['liver', '我的肝'], ['tumor', '我的瘤'],
  ['tx', '治疗与转化'], ['safety', '安全线'], ['nutrition', '营养与体重'],
  ['mind', '心理与家庭'], ['followup', '复诊与回顾'], ['import', '导入与候选'],
]

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 900 })
  await page.goto(harness.base, { waitUntil: 'networkidle0' })
  await page.waitForSelector('.wb-liver-cancer-workbench .wb-card', { timeout: 10000 })

  for (const [id, name] of VIEWS) {
    await page.evaluate((label) => {
      const b = [...document.querySelectorAll('.wb-nav button')].find((n) => n.textContent === label)
      if (!b) throw new Error('没有这个一级项：' + label)
      b.click()
    }, name)
    // 导入视图要有一份材料打开，否则右边空着看不出候选长什么样
    if (id === 'import') {
      await page.waitForSelector('.wb-qrow', { timeout: 8000 })
      await page.evaluate(() => {
        const r = [...document.querySelectorAll('.wb-qrow')].find((n) => n.querySelector('.wb-st').textContent === '待确认')
        r.click()
      })
      await page.waitForSelector('.wb-cand', { timeout: 8000 })
    } else {
      await page.waitForFunction((n) => {
        const crumb = document.querySelector('.wb-crumb b')
        return crumb && crumb.textContent === n
      }, { timeout: 8000 }, name)
      await new Promise((r) => setTimeout(r, 120)) // 让布局与翻转动画落定
    }
    await page.screenshot({ path: join(SHOT, `prod-view-${id}.png`) })
    process.stdout.write(`· ${id}\n`)
  }

  // 翻面卡：看板与指标分析各截一张背面，证明 3D 翻面在真浏览器里真的转了
  for (const [id, name] of [['dash', '看板'], ['metrics', '指标分析']]) {
    await page.evaluate((label) => {
      [...document.querySelectorAll('.wb-nav button')].find((n) => n.textContent === label).click()
    }, name)
    await page.waitForFunction((n) => {
      const crumb = document.querySelector('.wb-crumb b')
      return crumb && crumb.textContent === n
    }, { timeout: 8000 }, name)
    await page.waitForSelector('.wb-card', { timeout: 8000 })
    await page.evaluate(() => document.querySelector('.wb-card').click())
    await new Promise((r) => setTimeout(r, 900)) // 翻转 780ms，留一点余量
    await page.screenshot({ path: join(SHOT, `prod-${id}-flip.png`) })
    process.stdout.write(`· ${id}-flip\n`)
  }

  const errors = await page.evaluate(() => window.__probeErrors__ || [])
  if (errors.length) {
    console.error('页面报错：', errors.slice(0, 3))
    process.exitCode = 1
  }
  console.log('截图完成：11 个视图 + 2 张翻面卡 → prototypes/v0.1/')
} finally {
  await browser.close()
  await harness.close({ keep: process.argv.includes('--keep') })
}

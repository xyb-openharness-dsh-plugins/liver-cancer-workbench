#!/usr/bin/env node
// 版本一致性检查：package.json / CHANGELOG 顶部 / README 状态行必须说同一个版本。
//
// 为什么需要：这个仓已经遇到过"package.json 升了、CHANGELOG 没记"和"README 还写着上一版"
// 两种漂移。装到桌面端时，用户看到的版本号来自 package.json，而人查变更看 CHANGELOG，
// 两边对不上就等于没有变更记录。
//
// 用法：node scripts/check-version.mjs [项目根]
// 退出码：0 一致 / 1 不一致
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const root = process.argv[2] || process.cwd()
const pkgPath = join(root, 'package.json')
const logPath = join(root, 'CHANGELOG.md')
const readmePath = join(root, 'README.md')

if (!existsSync(pkgPath)) {
  console.error(`找不到 ${pkgPath}`)
  process.exit(1)
}

const version = JSON.parse(readFileSync(pkgPath, 'utf8')).version
const problems = []

if (!/^\d+\.\d+\.\d+$/.test(version || '')) problems.push(`package.json 的 version 不是 x.y.z：${version}`)

// CHANGELOG 第一条版本标题必须是当前版本
if (existsSync(logPath)) {
  const log = readFileSync(logPath, 'utf8')
  const first = log.match(/^##\s*v?(\d+\.\d+\.\d+)/m)
  if (!first) problems.push('CHANGELOG.md 里找不到形如 "## v0.3.3" 的版本标题')
  else if (first[1] !== version) problems.push(`CHANGELOG.md 顶部是 v${first[1]}，package.json 是 v${version}`)
} else {
  problems.push('缺少 CHANGELOG.md')
}

// README 状态行里的版本（形如 "## 项目当前状态（2026-10-24 · v0.3.2）"）必须跟上
if (existsSync(readmePath)) {
  const readme = readFileSync(readmePath, 'utf8')
  const found = readme.match(/当前状态[^\n]*?v(\d+\.\d+\.\d+)/)
  if (found && found[1] !== version) {
    problems.push(`README.md 状态行写着 v${found[1]}，package.json 是 v${version}`)
  }
}

if (problems.length) {
  console.error('版本检查未通过：')
  for (const p of problems) console.error(`  - ${p}`)
  process.exit(1)
}
console.log(`版本一致：v${version}（package.json / CHANGELOG / README）。`)

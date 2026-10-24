#!/usr/bin/env node
// 文案红线检查：面向患者的界面与 README 里，不许出现"替医生下结论"的措辞。
//
// 为什么是硬禁而不是提醒：
//   这个工作台的立场是"只提供信息，不做诊断"。一句"建议治疗"就把记录工具变成了医嘱。
//   这类词一旦混进页面，事后很难靠人眼在几千行模板字符串里找回来。
//
// 允许例外：同一行带 `wording-allow` 注释（用于文档里讨论红线词本身）。
//
// 用法：node scripts/check-wording.mjs [项目根]
// 退出码：0 干净 / 1 命中
import { readFileSync, statSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = process.argv[2] || process.cwd()

// 只查"会到患者眼前"的东西。docs/ 与 CHANGELOG 属于工程记录，讨论红线词是正常的。
const TARGETS = ['lib', 'dsh', 'import', 'prototypes', 'assets', 'README.md']
const EXT = /\.(js|mjs|cjs|html|css|md|json|yml)$/

const RULES = [
  { re: /建议(治疗|用药|手术|化疗|介入|复查)/, why: '替医生给方案' },
  { re: /可能(已经)?复发/, why: '预测结局' },
  { re: /可以停药|停药观察/, why: '指导用药调整' },
  { re: /无需就医|不用就医|不必就医/, why: '淡化就医必要性' },
  { re: /治愈率|生存率\s*\d|五年存活/, why: '给未经证实的预后数字' },
  { re: /保证(有效|治愈)|一定能(治好|控制)/, why: '承诺疗效' },
  { re: /确诊为|诊断为.{0,6}(癌|瘤)/, why: '工作台不做诊断' },
]

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) walk(full, out)
    else if (EXT.test(name)) out.push(full)
  }
}

const files = []
for (const t of TARGETS) {
  const full = join(root, t)
  try {
    const st = statSync(full)
    if (st.isDirectory()) walk(full, files)
    else files.push(full)
  } catch { /* 该项目没有这一项，跳过 */ }
}

const hits = []
for (const file of files) {
  const text = readFileSync(file, 'utf8')
  text.split('\n').forEach((line, i) => {
    if (line.includes('wording-allow')) return
    for (const rule of RULES) {
      const m = line.match(rule.re)
      if (m) hits.push(`${relative(root, file)}:${i + 1}  「${m[0]}」 ${rule.why}\n    ${line.trim().slice(0, 120)}`)
    }
  })
}

if (hits.length) {
  console.error(`文案红线命中 ${hits.length} 处：`)
  for (const h of hits) console.error(`  - ${h}`)
  console.error('  → 改写成"记录/呈现"语气，例如「把医生写的方案原样记下来」而不是「建议治疗」。')
  process.exit(1)
}
console.log(`文案红线通过：${files.length} 个文件，${RULES.length} 条规则，0 处命中。`)

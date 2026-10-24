// markdown → 行：MinerU 的 full.md 不能直接扔给抽取器，中间有两道必修的加工。
//
// 一、**表格先转竖线表，再按位置对齐**（docs/18-MINERU-PARSING.md §8.1）。
//     云端把整张表塞进 <table><tr><td>，若先 replace(/<[^>]+>/g,'') 剥标签，整表会压成一行：
//       「发生部位胃体肿瘤最大径6.8 cm核分裂象计数12 个/50 HPF」
//     后果不是报错，是静默错读——指标名后取第一个数，看着都对，实际整表串位。
//     所以顺序固定：① htmlTablesToPipes → ② 补分隔行 → ③ 按位置对齐。
//     本文件提供 §8.1 要求的四条实现细节（colspan 补空位、["']? 正则、单元格内 | 换 /、首行当表头）。
//
// 二、**单位先剥 LaTeX 外壳**（§7.1）。真实 full.md 里单位是 `$10^9/L$`、`10^{9}/L`，
//     夹具若写纯文本 `10^9/L`，单测全绿、桌面端却原样显示 `$10^9/L$`。
import { extractCandidates } from '../import/extract.mjs'

/** 剥 LaTeX 外壳：认不出的只剥壳、不推断。 */
export function stripLatex(text) {
  let s = String(text ?? '')
  s = s.replace(/\$([^$]*)\$/g, '$1')
  s = s.replace(/\\\(([\s\S]*?)\\\)/g, '$1')
  s = s.replace(/\\\[([\s\S]*?)\\\]/g, '$1')
  s = s.replace(/\\(?:text|mathrm|mathbf|operatorname)\s*\{([^{}]*)\}/g, '$1')
  // `\mumol`（没有空格）也是真实写法：先认整体，再兜底单个 \mu
  s = s.replace(/\\mu\s*mol/g, 'μmol')
  s = s.replace(/\\mu/g, 'μ')
  s = s.replace(/\\times/g, '×')
  s = s.replace(/\^\{([^{}]*)\}/g, '^$1')
  s = s.replace(/_\{([^{}]*)\}/g, '_$1')
  s = s.replace(/[{}]/g, '')
  return s.trim()
}

/**
 * HTML 表格 → 竖线表。四条细节缺一条就静默少列：
 *   colspan 补空单元格；正则用 ["']? 而不是 "?'；单元格内 | 换 /；首行当表头并补分隔行。
 */
export function htmlTablesToPipes(md) {
  return String(md ?? '').replace(/<table\b[^>]*>([\s\S]*?)<\/table>/gi, (whole, inner) => {
    const rows = []
    const rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi
    let rm
    while ((rm = rowRe.exec(inner)) !== null) {
      const cells = []
      const cellRe = /<(t[hd])\b([^>]*)>([\s\S]*?)<\/\1>/gi
      let cm
      while ((cm = cellRe.exec(rm[1])) !== null) {
        // 注意是 ["']? ，写成 "?' 会把「可选双引号 + 字面单引号」当模式，colspan="2" 永远匹配不上
        const spanMatch = /\bcolspan\s*=\s*["']?(\d+)["']?/i.exec(cm[2] || '')
        const span = spanMatch ? Math.max(1, Number(spanMatch[1])) : 1
        const text = stripLatex(cm[3].replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' '))
          .replace(/\|/g, '/') // 单元格里的管道符会把一行撑成多列
          .replace(/\s+/g, ' ')
          .trim()
        cells.push(text)
        for (let k = 1; k < span; k += 1) cells.push('') // colspan 补空位
      }
      if (cells.length) rows.push(cells)
    }
    if (!rows.length) return '\n'
    const width = Math.max(...rows.map((r) => r.length))
    const padded = rows.map((r) => r.concat(Array(width - r.length).fill('')))
    // 首行当表头，第二行插分隔行：下游按"第二行是分隔行"跳过表头，否则表头会被当数据解析
    const lines = [`| ${padded[0].join(' | ')} |`, `| ${padded[0].map(() => '---').join(' | ')} |`]
    for (const r of padded.slice(1)) lines.push(`| ${r.join(' | ')} |`)
    return `\n${lines.join('\n')}\n`
  })
}

const SEPARATOR = /^\|[\s:|-]+\|$/

function parsePipeRow(line) {
  const trimmed = line.trim()
  if (!trimmed.startsWith('|')) return null
  const body = trimmed.replace(/^\|/, '').replace(/\|$/, '')
  return body.split('|').map((c) => stripLatex(c).replace(/\s+/g, ' ').trim())
}

/**
 * 表格按位置对齐。
 *
 * 两种排版都要对：
 *   横表  | Item | 白蛋白 | 总胆红素 |        → 列向配对：白蛋白 38，总胆红素 22
 *         | Result | 38 | 22 |
 *   竖表  | 白蛋白 | 38 | g/L |              → 行向本来就是一指标一行
 *
 * 做法是**两种读法都产**：横表的行向和竖表的列向都产不出「指标名 + 数值同一行」，
 * 抽取器又必须指标名与数字同行才算命中，所以多产的那一路是空转，不会造出假候选。
 * 真正被禁止的是「先把标签剥光再整表拼一行」——那样指标名与数字的**位置对应**就没了。
 */
export function alignTableRows(rows) {
  const out = []
  const width = Math.max(...rows.map((r) => r.length))
  for (const row of rows) {
    if (row.length !== width) continue // 对齐不了就整行放弃，宁可漏一条让用户手填
    out.push(row.filter(Boolean).join(' '))
  }
  for (let j = 0; j < width; j += 1) {
    const cells = rows.map((r) => r[j]).filter(Boolean)
    if (cells.length >= 2) out.push(cells.join(' '))
  }
  return out
}

/** 只做格式转换，不判断内容。 */
export function markdownToLines(md, { confidence = 0.9 } = {}) {
  const converted = htmlTablesToPipes(md)
  const lines = []
  let block = []

  const flush = () => {
    if (!block.length) return
    for (const text of alignTableRows(block)) {
      if (text) lines.push({ text, confidence })
    }
    block = []
  }

  for (const raw of converted.split(/\r?\n/)) {
    const line = raw.trim()
    const cells = parsePipeRow(line)
    if (cells) {
      if (!SEPARATOR.test(line)) block.push(cells)
      continue
    }
    flush()
    if (!line) continue
    if (/^```/.test(line)) continue
    // 非表格行：保留原样（图片、公式块除外），剥掉残余标签与 LaTeX
    const text = stripLatex(line.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '))
    if (text && !/^!\[[^\]]*\]\([^)]*\)$/.test(text)) lines.push({ text, confidence })
  }
  flush()
  return lines
}

/** 抽候选：复用本机那份抽取器，口径只有一份。 */
export function candidatesFromMarkdown(md, options) {
  return extractCandidates(markdownToLines(md), options)
}

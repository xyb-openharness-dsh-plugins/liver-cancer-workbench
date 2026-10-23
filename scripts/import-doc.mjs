#!/usr/bin/env node
// 导入一份材料：嗅探 -> 取行（必要时喂 OCR 结果）-> 部位闸门 -> 抽候选 -> 落库。
//
// 为什么是命令行而不是 HTTP 上传：
//   工作台的 API 是只读读模型（guard 只放行 GET），写入口留着由人来触发。
//   阶段 3 装机后再由桌面壳挂真正的上传通道，这里先把"写对了没有"跑通。
//
// 用法：
//   node scripts/import-doc.mjs <文件> --profile p1 --db <库路径> [--title 标题] [--kind lab]
//                                [--date 2026-10-20] [--ocr <Vision 的 json 或 raw.tsv>] [--dry-run]
//
// 退出码：0 已导入待确认 / 3 部位不符已拒收 / 4 需要先做文字识别 / 2 参数或读写错误 / 1 其他异常
import { readFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { openDatabase } from '../dsh/db.js'
import { decide, describeVerdict } from '../import/pipeline.mjs'
import { ingest, listCandidates } from '../import/store.mjs'

const EXIT = { ok: 0, usage: 2, rejected: 3, needsLines: 4 }

function parseArgs(argv) {
  const args = { _: [], dryRun: false }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--dry-run') { args.dryRun = true; continue }
    if (a.startsWith('--')) { args[a.slice(2)] = argv[++i]; continue }
    args._.push(a)
  }
  return args
}

/** OCR 结果两种形态都吃：Vision 脚本的 json，或 conf\ty\ttext 的 tsv。 */
function readOcrLines(path) {
  const raw = readFileSync(path, 'utf8')
  if (path.endsWith('.json')) {
    const j = JSON.parse(raw)
    const lines = j.lines || j
    return lines.map((l) => ({ text: String(l.text ?? ''), confidence: Number(l.confidence ?? 1) }))
  }
  return raw.split(/\r?\n/).filter(Boolean).map((row) => {
    const [conf, , ...rest] = row.split('\t')
    return { text: rest.join('\t'), confidence: Number(conf) || 0.8 }
  })
}

const args = parseArgs(process.argv.slice(2))
if (!args._.length || !args.profile || !args.db) {
  console.error('用法: node scripts/import-doc.mjs <文件> --profile <档案> --db <库路径> [--ocr <结果>] [--dry-run]')
  process.exit(EXIT.usage)
}

const file = resolve(args._[0])
const dbPath = resolve(args.db)

try {
  const buf = readFileSync(file)
  const lines = args.ocr ? readOcrLines(resolve(args.ocr)) : undefined
  const decision = decide({ buf, name: basename(file), lines })

  const bar = '─'.repeat(52)
  console.log(bar)
  console.log(`文件      ${basename(file)}`)
  console.log(`类型      ${decision.sniff.kind} · ${decision.sniff.bytes} 字节`)
  console.log(`指纹      ${decision.sniff.sha256.slice(0, 16)}…`)
  console.log(`文本层    ${decision.sniff.hasTextLayer ? '有' : '无'}`)
  console.log(`闸门      ${decision.verdict}（${decision.domain}）`)
  console.log(`理由      ${decision.reason}`)
  console.log(`结论      ${describeVerdict(decision.verdict, decision.domain)}`)
  console.log(bar)

  if (decision.candidates.length) {
    console.log('候选（未确认，不会进趋势）')
    for (const c of decision.candidates) {
      const flag = [c.needsReview ? '需核对' : '', c.note || ''].filter(Boolean).join('；')
      console.log(`  ${c.field.padEnd(14)} ${String(c.valueText).padEnd(8)} ${(c.unit || '').padEnd(9)} conf ${c.confidence}${flag ? '  ← ' + flag : ''}`)
    }
    console.log(bar)
  }

  if (decision.verdict === 'needs_lines') process.exit(EXIT.needsLines)
  if (args.dryRun) {
    console.log('--dry-run：没有写库')
    process.exit(decision.verdict === 'accept' ? EXIT.ok : EXIT.rejected)
  }

  const db = openDatabase(dbPath)
  const result = ingest(db, {
    profileId: args.profile,
    title: args.title || basename(file),
    kind: args.kind || 'other',
    docDate: args.date || null,
    filePath: file,
  }, decision)

  if (result.reused) {
    console.log(`这份文件已经导入过（document #${result.documentId}，状态 ${result.status}），未重复登记`)
    const pending = listCandidates(db, result.documentId).filter((c) => c.status === 'pending')
    if (pending.length) console.log(`仍有 ${pending.length} 条候选待确认`)
  } else {
    console.log(`已登记 document #${result.documentId} · 状态 ${result.status} · 候选 ${result.candidateCount} 条`)
    if (result.status === 'pending_review') console.log('下一步：在「导入」视图里逐条确认，确认后才写进趋势')
  }
  db.close()
  process.exit(decision.verdict === 'accept' ? EXIT.ok : EXIT.rejected)
} catch (error) {
  console.error(`导入失败：${error.message}`)
  process.exit(error.code === 'bad_request' ? EXIT.usage : 1)
}

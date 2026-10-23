// 导入流水线的"决策段"：纯函数，不碰库、不碰文件系统，只吃 buffer + 行。
//
// 顺序是硬约定，不能换：
//   1. sniff  —— 是什么文件、有没有文本层、指纹
//   2. 取行    —— 文本层直接切；扫描件必须由调用方先做 OCR 传进来
//   3. 闸门    —— 先判部位。域外直接停，extract 一行都不跑
//   4. extract —— 只有 accept 才抽候选
//
// 第 3 步在第 4 步之前，是这份代码存在的理由：胰腺样本一旦抽成候选，腺鳞 panel 会进肝的 A/B 轨。
import { sniffBuffer } from './sniff.mjs'
import { assessDomain, statusForVerdict } from './guard.mjs'
import { extractCandidates, probeFields } from './extract.mjs'

/** candidate.field 里哪些能直接对上 metric_def.id（落 reading 用）。 */
export const NUMERIC_FIELDS = new Set([
  'albumin', 'bilirubin', 'inr', 'platelets', 'alt', 'ast', 'afp', 'pivka2', 'max_diameter',
])

export const DOCUMENT_KINDS = new Set(['lab', 'imaging', 'pathology', 'discharge', 'prescription', 'other'])

/** 纯文本按行切开，统一成 { text, confidence }，与 OCR 输出同构。 */
export function linesFromText(text) {
  return String(text)
    .split(/\r?\n/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => ({ text: t, confidence: 1 }))
}

/**
 * @param {{ buf: Buffer, name?: string, lines?: {text:string,confidence?:number}[], lowConfidence?: number }} input
 */
export function decide({ buf, name = '', lines, lowConfidence = 0.5 }) {
  const sniff = sniffBuffer(buf, name)
  const base = { sniff }

  if (sniff.route === 'unsupported') {
    return {
      ...base,
      stage: 'sniff',
      documentStatus: 'parse_failed',
      verdict: 'unsupported',
      domain: 'unknown',
      reason: `未识别的文件类型（${sniff.bytes} 字节）`,
      candidates: [],
    }
  }

  // 行从哪来：调用方给的优先（OCR 结果），否则只有纯文本能自己切。
  // PDF 有文本层但没给行，是本机没装抽取器——如实报"待解析"，不假装解析成功。
  const sourceLines = lines ?? (sniff.kind === 'text' ? linesFromText(buf.toString('utf8')) : null)
  if (!sourceLines) {
    return {
      ...base,
      stage: 'text',
      documentStatus: 'pending_parse',
      verdict: 'needs_lines',
      domain: 'unknown',
      reason:
        sniff.route === 'ocr'
          ? '扫描件需要先做 OCR；本机 OCR 结果未提供'
          : 'PDF 有文本层，但需要文本抽取器输出；本机未提供',
      candidates: [],
    }
  }

  // ── 闸门 ──
  // probeFields 只回答"出现了哪些指标名"，不带任何数值。它是闸门的第二类证据
  // （化验单不写器官名），不是"先解析再审查"——数值在这里全部丢弃，accept 之后才正式抽。
  const panelFields = probeFields(sourceLines)
  const gate = assessDomain(sourceLines.map((l) => l.text), { minScore: 2, panelFields })
  if (gate.verdict !== 'accept') {
    return {
      ...base,
      stage: 'gate',
      documentStatus: statusForVerdict(gate.verdict),
      verdict: gate.verdict,
      domain: gate.domain,
      reason: gate.reason,
      via: gate.via,
      scores: gate.scores,
      // 关键：即使这里已经读到了文本，也不往下抽。候选必须是空数组。
      candidates: [],
    }
  }

  // ── 抽候选（只有通过闸门才到这里）──
  const { candidates, skipped } = extractCandidates(sourceLines, { lowConfidence })
  return {
    ...base,
    stage: 'extract',
    documentStatus: 'pending_review',
    verdict: 'accept',
    domain: gate.domain,
    reason: gate.reason,
    via: gate.via,
    scores: gate.scores,
    candidates,
    skippedCount: skipped.length,
    needsReviewCount: candidates.filter((c) => c.needsReview).length,
    importableCount: candidates.filter((c) => NUMERIC_FIELDS.has(c.field) && c.valueNum !== null).length,
  }
}

/** 给界面看的一句话，别让用户读 verdict 代码。 */
export function describeVerdict(verdict, domain) {
  const zh = {
    liver: '肝细胞癌', pancreas: '胰腺', lung: '肺', stomach: '胃',
    colorectal: '结直肠', esophagus: '食管', cervix: '宫颈', lymphoma: '淋巴瘤', unknown: '未知部位',
  }
  if (verdict === 'accept') return '可以导入，指标会先进「待确认」列表'
  if (verdict === 'reject_out_of_domain') return `这是${zh[domain] || domain}相关的材料，不属于小甘宝的肝脏范围，未写入任何指标`
  if (verdict === 'needs_review') return '部位线索不足，没有自动写入，请自己确认后再处理'
  if (verdict === 'needs_lines') return '文件里没有可读的文字层，需要先做文字识别'
  return '这个文件读不了'
}

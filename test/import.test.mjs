// 导入链路单测：嗅探 / 闸门 / 抽候选。
//
// 钉住的不是"能不能解析成功"，而是三件更贵的事：
//   1. 扫描件不许当成有文本层（否则 pypdf 静默返回空串，人以为报告没内容）；
//   2. 域外样本必须在 extract 之前被拦下（胰腺样本一旦入库，会带着腺鳞 panel 污染 A/B 轨）；
//   3. 候选只产 candidate，绝不替用户改数、绝不悄悄入库。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sniffBuffer, pdfHasTextLayer } from '../import/sniff.mjs'
import { scoreSites, assessDomain, statusForVerdict } from '../import/guard.mjs'
import { extractCandidates, probeFields } from '../import/extract.mjs'

// 很多闸门断言只需要"有哪些指标名"，不必带置信度
const toLine = (text) => ({ text, confidence: 0.95 })

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const FIXTURE = join(ROOT, 'research', 'import-tests', 'bingli1.ocr.json')
const PDF = join(ROOT, 'input', 'import-tests', 'bingli1.pdf')

const fixture = JSON.parse(readFileSync(FIXTURE, 'utf8'))
const pancreasLines = fixture.lines

// ── 嗅探 ────────────────────────────────────────────────────────────

test('扫描件 PDF 判定为无文本层 -> 走 OCR', () => {
  // 只有字体声明、没有文字绘制算子：典型的"图片包了层 PDF 壳"
  const scanned = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Page>>endobj\ntrailer<</Root 1 0 R>>', 'latin1')
  assert.equal(pdfHasTextLayer(scanned), false)
  const r = sniffBuffer(scanned, 'report.pdf')
  assert.equal(r.kind, 'pdf')
  assert.equal(r.route, 'ocr')
  assert.match(r.reason, /扫描件/)
})

test('有文字算子的 PDF 判定为有文本层 -> 走抽取', () => {
  const digital = Buffer.from(
    '%PDF-1.4\n1 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n' +
    '2 0 obj<</Length 44>>stream\nBT /F1 12 Tf 72 720 Td (Albumin 38) Tj ET\nendstream\nendobj',
    'latin1',
  )
  assert.equal(pdfHasTextLayer(digital), true)
  const r = sniffBuffer(digital, 'lab.pdf')
  assert.equal(r.route, 'extract')
})

test('嗅探给稳定的 sha256 与字节数，且不识别类型时不猜', () => {
  const a = sniffBuffer(Buffer.from('白蛋白 38 g/L\n'), 'lab.txt')
  const b = sniffBuffer(Buffer.from('白蛋白 38 g/L\n'), 'lab.txt')
  assert.equal(a.kind, 'text')
  assert.equal(a.route, 'extract')
  assert.equal(a.sha256, b.sha256, '同内容必须同指纹')
  assert.equal(a.sha256.length, 64)
  assert.equal(a.bytes, Buffer.byteLength('白蛋白 38 g/L\n'))

  const junk = sniffBuffer(Buffer.from([0x00, 0x01, 0x02, 0x03]), 'x.bin')
  assert.equal(junk.kind, 'unknown')
  assert.equal(junk.route, 'unsupported')
})

test('真实扫描件：能读到就断言 PDF 无文本层（仓库未带该文件则跳过）', (t) => {
  if (!existsSync(PDF)) return t.skip('input/ 被 .gitignore 排除，本机才有')
  const buf = readFileSync(PDF)
  const r = sniffBuffer(buf, 'bingli1.pdf')
  assert.equal(r.kind, 'pdf')
  assert.equal(r.hasTextLayer, false)
  assert.equal(r.route, 'ocr')
})

// ── 闸门 ────────────────────────────────────────────────────────────

test('胰腺穿刺病理被判为域外，不是"解析失败"含混过去', () => {
  const { scores } = scoreSites(pancreasLines.map((l) => l.text))
  assert.ok(scores.pancreas >= 2, `胰腺线索应≥2，实际 ${scores.pancreas}`)
  assert.equal(scores.liver, undefined, '这份报告里不该出现肝线索')

  const v = assessDomain(pancreasLines.map((l) => l.text))
  assert.equal(v.verdict, 'reject_out_of_domain')
  assert.equal(v.domain, 'pancreas')
  assert.match(v.reason, /胰腺/)
  // 与已存档结论一致，防止两侧各改各的
  assert.equal(v.verdict, fixture.summary.verdict)
  assert.equal(v.domain, fixture.summary.domainGuess)
})

test('域外一律落 parse_failed，绝不 pending_review 混进候选', () => {
  assert.equal(statusForVerdict('reject_out_of_domain'), 'parse_failed')
  assert.equal(statusForVerdict('accept'), 'pending_review')
  // 线索不足不是"解析失败"：文件是好的，只是没法自动判，留在待解析等人处理
  assert.equal(statusForVerdict('needs_review'), 'pending_parse')
})

test('真正的肝细胞癌报告能通过闸门', () => {
  const lines = [
    '病变部位：肝右叶',
    '病理诊断：肝细胞癌，中分化',
    '免疫组化结果：Hepa（+）、GPC3（+）、CK19（-）',
  ]
  const v = assessDomain(lines)
  assert.equal(v.verdict, 'accept')
  assert.equal(v.domain, 'liver')
})

test('长词优先计分，肝细胞癌不会被"肝"重复算两次', () => {
  const { scores, hits } = scoreSites(['病理诊断：肝细胞癌'])
  assert.equal(scores.liver, 1, `应只计 1 分，实际 ${scores.liver}`)
  assert.deepEqual(hits.liver, ['肝细胞癌'])
})

test('线索打平不给结论，交给人看', () => {
  const v = assessDomain(['肝脏及胰腺均见异常'])
  assert.equal(v.verdict, 'needs_review')
  assert.match(v.reason, /打平/)
})

test('完全没有部位线索时也是 needs_review，不默认放行', () => {
  const v = assessDomain(['血常规：白细胞 6.1'])
  assert.equal(v.verdict, 'needs_review')
  assert.equal(v.domain, 'unknown')
})

// ── 闸门的第二条证据线：指标组合 ──
// 外院化验单普遍不写器官名。只认部位词会把最常见的入参全部挡在门外。

const LAB = [
  'XX医院检验报告',
  '报告日期：2026-10-20',
  '总胆红素 21.5 μmol/L',
  '白蛋白 38 g/L',
  '血小板 118',
  'AFP 12.4',
]

test('化验单没写"肝"字，但指标组合是肝病随访 -> 放行', () => {
  assert.equal(scoreSites(LAB).scores.liver, undefined, '这份化验单确实没有器官词')
  const v = assessDomain(LAB, { panelFields: probeFields(LAB.map(toLine)) })
  assert.equal(v.verdict, 'accept')
  assert.equal(v.domain, 'liver')
  assert.equal(v.via, 'panel')
  assert.match(v.reason, /肝功能/)
})

test('只有 1 项肝相关指标不够，仍交给人', () => {
  const lines = ['血常规：白蛋白 38 g/L', '白细胞 6.1', '血红蛋白 121']
  const v = assessDomain(lines, { panelFields: probeFields(lines.map(toLine)) })
  assert.equal(v.verdict, 'needs_review')
})

test('部位词明确是别的器官时，指标组合不能翻案', () => {
  // 胰腺癌也会查肝功能，指标组合有白蛋白/胆红素，但部位词说了是胰腺
  const lines = ['病变部位：胰腺', '胰腺穿刺', '白蛋白 38 g/L', '总胆红素 21.5']
  const v = assessDomain(lines, { panelFields: probeFields(lines.map(toLine)) })
  assert.equal(v.verdict, 'reject_out_of_domain')
  assert.equal(v.domain, 'pancreas')
})

test('原发灶在别的器官时，写了"肝转移"也拒收（词频会算错，原发措辞不会）', () => {
  const lines = ['胰腺癌肝转移', '肝内多发转移灶']
  // 词频确实是肝占优——这正是不能只靠词频的原因
  const { scores } = scoreSites(lines)
  assert.ok(scores.liver > scores.pancreas)
  const v = assessDomain(lines)
  assert.equal(v.verdict, 'reject_out_of_domain')
  assert.equal(v.domain, 'pancreas')
  assert.equal(v.via, 'primary')
  assert.match(v.reason, /原发部位是胰腺癌/)
})

test('肝细胞癌本身不会被"原发性肝癌"这类措辞误伤', () => {
  for (const t of ['原发性肝细胞癌', '肝细胞癌，中分化', '原发性肝癌（HCC）']) {
    assert.equal(assessDomain([t, '肝右叶占位']).verdict, 'accept', t)
  }
})

test('probeFields 只回字段名，不回数值', () => {
  const fields = probeFields([toLine('白蛋白 38 g/L'), toLine('AFP 12.4')])
  assert.deepEqual(fields.sort(), ['afp', 'albumin'])
  for (const f of fields) assert.equal(typeof f, 'string')
})

// ── 抽候选 ──────────────────────────────────────────────────────────

const plain = (text, confidence = 0.95) => ({ text, confidence })

test('常规化验行能抽到数值，并带上单位与原文', () => {
  const { candidates } = extractCandidates([
    plain('白蛋白 38 g/L'),
    plain('总胆红素 21.5 μmol/L'),
    plain('血小板 118'),
  ])
  const byField = new Map(candidates.map((c) => [c.field, c]))
  assert.equal(byField.get('albumin').valueNum, 38)
  assert.equal(byField.get('albumin').unit, 'g/L')
  assert.equal(byField.get('albumin').sourceLine, '白蛋白 38 g/L')
  assert.equal(byField.get('bilirubin').valueNum, 21.5)
  assert.equal(byField.get('platelets').valueNum, 118)
  for (const c of candidates) assert.equal(c.needsReview, false)
})

test('前白蛋白不会被当成白蛋白，直接胆红素不会被当成总胆红素', () => {
  const { candidates } = extractCandidates([
    plain('前白蛋白 0.21 g/L'),
    plain('直接胆红素 6.8 μmol/L'),
  ])
  assert.equal(candidates.length, 0, `不应产出候选，实际 ${JSON.stringify(candidates)}`)
})

test('IHC 的百分比不会被误认成 AFP / PIVKA-II', () => {
  const { candidates } = extractCandidates([
    plain('免疫组化结果：Ki-67（+、40%）、p40（部分+）'),
    plain('（+、40%）、Syn（-）'),
  ])
  const fields = candidates.map((c) => c.field)
  assert.equal(fields.includes('afp'), false)
  assert.equal(fields.includes('pivka2'), false)
})

test('数值超范围时降置信度 + 注明核对原文，但不改数', () => {
  const { candidates } = extractCandidates([plain('白蛋白 88 g/L')])
  const c = candidates.find((x) => x.field === 'albumin')
  assert.equal(c.valueNum, 88, '数值必须原样保留')
  assert.ok(c.confidence < 0.95)
  assert.match(c.note, /超出常见范围/)
})

test('低置信度行标 needsReview，不自动入库', () => {
  const { candidates } = extractCandidates([plain('白蛋白 38 g/L', 0.31)])
  assert.equal(candidates[0].needsReview, true)
  const hi = extractCandidates([plain('白蛋白 38 g/L', 0.9)])
  assert.equal(hi.candidates[0].needsReview, false)
})

test('同一行重复出现只留一条候选', () => {
  const { candidates } = extractCandidates([plain('白蛋白 38 g/L'), plain('白蛋白 38 g/L')])
  assert.equal(candidates.filter((c) => c.field === 'albumin').length, 1)
})

test('病灶最大径必须带 mm，cm 不猜换算', () => {
  const hit = extractCandidates([plain('最大结节直径 42mm')])
  assert.equal(hit.candidates.find((c) => c.field === 'max_diameter').valueNum, 42)
  const miss = extractCandidates([plain('长0.8-1.1cm，直径0.1cm')])
  assert.equal(miss.candidates.some((c) => c.field === 'max_diameter'), false)
})

test('域外样本即使被抽，也抽不出任何数值指标（不污染 A/B 轨）', () => {
  const { candidates } = extractCandidates(pancreasLines)
  const numeric = candidates.filter((c) => c.valueNum !== null)
  assert.deepEqual(numeric, [], `域外样本不该产生数值候选：${JSON.stringify(numeric)}`)
  // 文本字段仍可抽到，但流水线里它们永远走不到 extract——闸门在前
  const site = candidates.find((c) => c.field === 'site')
  assert.equal(site.valueText, '胰腺')
})

test('抽候选只做候选：不返回任何"结论"字段', () => {
  const { candidates } = extractCandidates([plain('病理诊断：肝细胞癌，中分化')])
  for (const c of candidates) {
    assert.equal('conclusion' in c, false)
    assert.equal('grade' in c, false)
    assert.equal('diagnosis' in c, false)
  }
})

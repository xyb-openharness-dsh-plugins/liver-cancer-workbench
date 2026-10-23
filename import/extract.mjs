// 从 OCR / 文本抽取出的行里取候选字段。
//
// 三条纪律：
//   1. 只产 candidate，绝不直接写业务表——写不写由人在界面上逐条确认；
//   2. 每一条都带置信度与原文行，低于阈值的标 needsReview，不许悄悄入库；
//   3. 数值超出常见范围时降置信度并注明"请核对原文"，不替用户改数。

const NUM = '(\\d{1,4}(?:\\.\\d+)?)'

// range 只用于"这数看着像不像"，不是参考区间，也不产出任何结论
const PATTERNS = [
  // 「前白蛋白」是另一个指标（营养），不能当成白蛋白；「直接/间接胆红素」也不是总胆红素。
  // 这两处用后行断言排除，否则一份营养评估报告会把前白蛋白写进 A 轨。
  { field: 'albumin', re: new RegExp(`(?<!前)白蛋白[^\\d\\n]{0,8}${NUM}`), unit: 'g/L', range: [10, 60] },
  { field: 'bilirubin', re: new RegExp(`(?:总胆红素|(?<!直接)(?<!间接)胆红素)[^\\d\\n]{0,8}${NUM}`), unit: 'μmol/L', range: [1, 600] },
  { field: 'inr', re: new RegExp(`INR[^\\d\\n]{0,8}(\\d(?:\\.\\d+)?)`, 'i'), unit: '', range: [0.5, 6] },
  { field: 'platelets', re: new RegExp(`血小板[^\\d\\n]{0,8}${NUM}`), unit: '10⁹/L', range: [5, 800] },
  { field: 'alt', re: new RegExp(`(?:ALT|谷丙转氨酶)[^\\d\\n]{0,8}${NUM}`, 'i'), unit: 'U/L', range: [1, 5000] },
  { field: 'ast', re: new RegExp(`(?:AST|谷草转氨酶)[^\\d\\n]{0,8}${NUM}`, 'i'), unit: 'U/L', range: [1, 5000] },
  { field: 'afp', re: new RegExp(`(?:AFP|甲胎蛋白)[^\\d\\n]{0,8}${NUM}`, 'i'), unit: 'ng/mL', range: [0, 1000000] },
  { field: 'pivka2', re: new RegExp(`(?:PIVKA[-\\s]?II|异常凝血酶原)[^\\d\\n]{0,8}${NUM}`, 'i'), unit: 'mAU/mL', range: [0, 1000000] },
  { field: 'max_diameter', re: new RegExp(`最大(?:结)?(?:节)?(?:径|直径)[^\\d\\n]{0,8}${NUM}\\s*mm`), unit: 'mm', range: [1, 300] },
]

const TEXT_FIELDS = [
  { field: 'site', re: /病变部位[:：]\s*(\S+)/ },
  { field: 'specimen_type', re: /样本类型[:：]\s*(\S+)/ },
  { field: 'pathology_diagnosis', re: /(?:病理诊断|诊断意见)[:：]\s*(.+)/ },
  { field: 'ihc_panel', re: /免疫组化(?:结果)?[:：]\s*(.+)/ },
  { field: 'report_date', re: /(?:报告日期|报告时间)[:：]?\s*(\d{4}-\d{1,2}-\d{1,2})/ },
  { field: 'collection_date', re: /取材日期[:：]?\s*(\d{4}-\d{1,2}-\d{1,2})/ },
]

/**
 * 探针：只看"这份材料里出现了哪些指标名"，不取值、不留原文、不留置信度。
 *
 * 专门给闸门用。化验单（尤其外院报告）几乎不会写"肝"字，靠部位词判会一律挡掉；
 * 但"白蛋白 + 总胆红素 + INR + 血小板 + AFP"这种组合本身就是肝病/肝癌随访的面孔。
 * 所以闸门可以拿字段名当第二类证据——前提是它绝不带回数值，否则就成了"先解析再审"。
 */
export function probeFields(lines) {
  const fields = new Set()
  for (const line of lines) {
    const text = String(line.text || '')
    if (!text) continue
    for (const p of PATTERNS) if (p.re.test(text)) fields.add(p.field)
  }
  return [...fields]
}

/** @param {{text:string, confidence?:number}[]} lines */
export function extractCandidates(lines, { lowConfidence = 0.5 } = {}) {  const candidates = []
  const seen = new Set()
  const skipped = []

  const push = (c) => {
    const key = `${c.field}|${c.valueText}`
    if (seen.has(key)) return
    seen.add(key)
    candidates.push({ ...c, needsReview: c.confidence < lowConfidence })
  }

  for (const line of lines) {
    const text = String(line.text || '').trim()
    if (!text) continue
    const base = typeof line.confidence === 'number' ? line.confidence : 0.9

    for (const p of PATTERNS) {
      const m = text.match(p.re)
      if (!m) continue
      const valueNum = Number(m[1])
      const [lo, hi] = p.range
      const inRange = Number.isFinite(valueNum) && valueNum >= lo && valueNum <= hi
      push({
        field: p.field,
        valueText: m[1],
        valueNum: Number.isFinite(valueNum) ? valueNum : null,
        unit: p.unit,
        confidence: Number((base * (inRange ? 1 : 0.6)).toFixed(2)),
        sourceLine: text,
        note: inRange ? null : `数值 ${m[1]} 超出常见范围，请核对原文`,
      })
    }

    for (const t of TEXT_FIELDS) {
      const m = text.match(t.re)
      if (!m) continue
      const value = m[1].trim()
      if (!value) continue
      push({
        field: t.field, valueText: value, valueNum: null, unit: '',
        confidence: Number(base.toFixed(2)), sourceLine: text, note: null,
      })
    }

    // 完全没有可识别字段的行不是错误，但记下来，便于排查"OCR 读到了却没人认领"
    if (!candidates.some((c) => c.sourceLine === text)) skipped.push(text)
  }

  return { candidates, skipped }
}

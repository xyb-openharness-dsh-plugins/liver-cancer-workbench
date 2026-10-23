// 导入流水线的"落库段"：把 pipeline.mjs 的决策写进事实四层的前两层（document / candidate）。
//
// 三条纪律：
//   1. 同一份文件（sha256 相同）在同档案里只登记一次，重复导入不产生第二份候选；
//   2. 写入 candidate 不等于写进指标——确认是人的动作（acceptCandidate）；
//   3. 全部用事务，半句话失败不留在库里。
import { NUMERIC_FIELDS } from './pipeline.mjs'

const nowIso = () => new Date().toISOString()

function requireProfile(db, profileId) {
  const row = db.prepare('SELECT id FROM profile WHERE id = ?').get(profileId)
  if (!row) {
    const e = new Error(`没有这个档案：${profileId}`)
    e.code = 'not_found'
    throw e
  }
}

/**
 * 登记一次导入。
 * @param {object} db  openDatabase 的返回值
 * @param {{ profileId:string, title:string, kind:string, docDate?:string, filePath?:string }} meta
 * @param {ReturnType<import('./pipeline.mjs').decide>} decision
 */
export function ingest(db, meta, decision) {
  const { profileId, title, kind = 'other', docDate = null, filePath = null } = meta
  if (!profileId) throw Object.assign(new Error('缺少档案'), { code: 'bad_request' })
  if (!title) throw Object.assign(new Error('缺少标题'), { code: 'bad_request' })
  requireProfile(db, profileId)

  const { sha256 } = decision.sniff
  const existing = db.prepare(
    'SELECT id, status FROM document WHERE profile_id = ? AND file_sha256 = ?',
  ).get(profileId, sha256)
  if (existing) {
    // 同一份文件再导一次：不重复登记，也不重复造候选，把上次的结论原样告诉调用方
    const count = db.prepare('SELECT count(*) AS n FROM candidate WHERE document_id = ?').get(existing.id)
    return { documentId: Number(existing.id), reused: true, candidateCount: Number(count.n), status: existing.status }
  }

  const stamp = nowIso()
  db.exec('BEGIN')
  try {
    const info = db.prepare(
      `INSERT INTO document
         (profile_id, title, kind, doc_date, file_path, file_sha256, status, parse_note, uploaded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      profileId, title, kind, docDate, filePath, sha256,
      decision.documentStatus,
      // 闸门的理由必须留下来：'解析失败' 三个字分不清"文件坏了"和"不是肝的报告"
      `[${decision.stage}] ${decision.reason}`,
      stamp,
    )
    const documentId = Number(info.lastInsertRowid)

    const insert = db.prepare(
      `INSERT INTO candidate
         (document_id, field, value_text, value_num, unit, page_no, confidence, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
    )
    let candidateCount = 0
    if (decision.documentStatus === 'pending_review') {
      for (const c of decision.candidates) {
        insert.run(
          documentId, c.field, c.valueText ?? null,
          c.valueNum === null || c.valueNum === undefined ? null : c.valueNum,
          c.unit || null, null, c.confidence ?? null, stamp,
        )
        candidateCount += 1
      }
    }
    db.exec('COMMIT')
    return { documentId, reused: false, candidateCount, status: decision.documentStatus }
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

/** 某档案的导入队列：文件 + 状态 + 候选计数。不含候选内容。 */
export function listDocuments(db, profileId) {
  const rows = db.prepare(
    `SELECT d.id, d.title, d.kind, d.doc_date, d.status, d.parse_note, d.uploaded_at,
            (SELECT count(*) FROM candidate c WHERE c.document_id = d.id) AS total,
            (SELECT count(*) FROM candidate c WHERE c.document_id = d.id AND c.status = 'pending') AS pending
       FROM document d
      WHERE d.profile_id = ?
      ORDER BY d.uploaded_at DESC, d.id DESC`,
  ).all(profileId)
  return rows.map((r) => ({
    id: Number(r.id),
    title: r.title,
    kind: r.kind,
    docDate: r.doc_date,
    status: r.status,
    parseNote: r.parse_note,
    uploadedAt: r.uploaded_at,
    candidates: { total: Number(r.total), pending: Number(r.pending) },
  }))
}

/** 某文件的候选清单（逐条确认用）。 */
export function listCandidates(db, documentId) {
  return db.prepare(
    `SELECT id, field, value_text, value_num, unit, confidence, status
       FROM candidate WHERE document_id = ? ORDER BY id`,
  ).all(documentId).map((r) => ({
    id: Number(r.id),
    field: r.field,
    valueText: r.value_text,
    valueNum: r.value_num === null ? null : Number(r.value_num),
    unit: r.unit,
    confidence: r.confidence === null ? null : Number(r.confidence),
    status: r.status,
    importable: NUMERIC_FIELDS.has(r.field) && r.value_num !== null,
  }))
}

/**
 * 确认一条候选 -> 写 metric_reading。
 * 这是唯一把 candidate 变成指标的地方，且必须是人的显式动作。
 */
export function acceptCandidate(db, candidateId, { measuredOn = null, note = null } = {}) {
  const c = db.prepare(
    `SELECT c.*, d.profile_id, d.doc_date FROM candidate c
       JOIN document d ON d.id = c.document_id WHERE c.id = ?`,
  ).get(candidateId)
  if (!c) throw Object.assign(new Error('没有这条候选'), { code: 'not_found' })
  if (c.status !== 'pending') throw Object.assign(new Error(`这条候选已经是 ${c.status}`), { code: 'conflict' })
  if (!NUMERIC_FIELDS.has(c.field)) {
    throw Object.assign(new Error(`「${c.field}」不是指标字段，不能写进趋势`), { code: 'not_importable' })
  }
  if (c.value_num === null || c.value_num === undefined) {
    throw Object.assign(new Error('这条候选没有数值，无法写入指标'), { code: 'not_importable' })
  }
  const date = measuredOn || c.doc_date
  if (!date) {
    // 不拿 uploaded_at 顶替测量日期：那会让趋势图多出一个假时点
    throw Object.assign(new Error('这份报告没有日期，请先补上测量日期再确认'), { code: 'missing_date' })
  }

  const stamp = nowIso()
  db.exec('BEGIN')
  try {
    const dup = db.prepare(
      `SELECT id FROM metric_reading
        WHERE profile_id = ? AND metric_id = ? AND measured_on = ? ORDER BY id LIMIT 1`,
    ).get(c.profile_id, c.field, date)
    if (dup) throw Object.assign(new Error(`这一天（${date}）已有 ${c.field} 的记录`), { code: 'conflict' })

    const info = db.prepare(
      `INSERT INTO metric_reading
         (profile_id, metric_id, measured_on, value_num, value_text, unit, is_missing, source_doc_id, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
    ).run(
      c.profile_id, c.field, date, c.value_num, c.value_text ?? String(c.value_num),
      c.unit || null, c.document_id, note || '由导入候选确认', stamp,
    )
    db.prepare("UPDATE candidate SET status = 'accepted' WHERE id = ?").run(candidateId)
    settleDocument(db, c.document_id)
    db.exec('COMMIT')
    return { readingId: Number(info.lastInsertRowid), metricId: c.field, measuredOn: date }
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

/** 退回一条候选：只改状态，不写任何指标。 */
export function rejectCandidate(db, candidateId) {
  const c = db.prepare('SELECT id, document_id, status FROM candidate WHERE id = ?').get(candidateId)
  if (!c) throw Object.assign(new Error('没有这条候选'), { code: 'not_found' })
  if (c.status !== 'pending') throw Object.assign(new Error(`这条候选已经是 ${c.status}`), { code: 'conflict' })
  db.exec('BEGIN')
  try {
    db.prepare("UPDATE candidate SET status = 'rejected' WHERE id = ?").run(candidateId)
    settleDocument(db, c.document_id)
    db.exec('COMMIT')
    return { ok: true }
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

/** 候选都处理完了就把文件状态推到 parsed——这是"人已经看过"的标记，不是"解析成功"。 */
function settleDocument(db, documentId) {
  const left = db.prepare(
    "SELECT count(*) AS n FROM candidate WHERE document_id = ? AND status = 'pending'",
  ).get(documentId)
  if (Number(left.n) === 0) {
    db.prepare("UPDATE document SET status = 'parsed' WHERE id = ? AND status = 'pending_review'").run(documentId)
  }
}

// 落库段单测：用 :memory: 库，每次从零跑迁移，不碰演示数据。
//
// 钉住四件事：
//   1. 同一份文件只登记一次（sha256 幂等）；
//   2. 被闸门拒掉的文件一行候选都不许有，理由必须留下来；
//   3. candidate -> metric_reading 只能由人的显式确认触发；
//   4. 没有测量日期不许确认（不拿上传时间顶替，否则趋势图会多出假时点）。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { openDatabase } from '../dsh/db.js'
import { decide } from '../import/pipeline.mjs'
import {
  ingest, listDocuments, listCandidates, acceptCandidate, rejectCandidate,
} from '../import/store.mjs'

function freshDb() {
  const db = openDatabase(':memory:')
  db.prepare('INSERT INTO profile (id, name, initial, created_at) VALUES (?, ?, ?, ?)')
    .run('p1', '测试档案', '测', '2026-10-24T00:00:00Z')
  return db
}

const LAB_TEXT = 'XX医院检验报告\n报告日期：2026-10-20\n总胆红素 21.5 μmol/L\n白蛋白 38 g/L\n血小板 118\nAFP 12.4\n'
const PANCREAS_TEXT = '病理诊断：\n病变部位：胰腺\n样本类型：穿刺\n〈胰腺〉浸润性癌，大部分呈鳞状分化\n'
const VAGUE_TEXT = '血常规：白细胞 6.1、血红蛋白 121\n'

const decideText = (text, name = 'r.txt') => decide({ buf: Buffer.from(text), name })
const metaOf = (over = {}) => ({ profileId: 'p1', title: '外院报告', kind: 'lab', docDate: '2026-10-20', ...over })

test('肝病化验单：登记为待确认，候选写进 candidate 但没进趋势', () => {
  const db = freshDb()
  const d = decideText(LAB_TEXT)
  assert.equal(d.verdict, 'accept')

  const r = ingest(db, metaOf(), d)
  assert.equal(r.reused, false)
  assert.equal(r.status, 'pending_review')
  assert.ok(r.candidateCount >= 4)

  const doc = db.prepare('SELECT * FROM document WHERE id = ?').get(r.documentId)
  assert.match(doc.parse_note, /^\[extract\]/)
  assert.equal(db.prepare('SELECT count(*) AS n FROM metric_reading').get().n, 0, '未确认不该有趋势点')
  db.close()
})

test('同一份文件再导一次：不重复登记，也不重复造候选', () => {
  const db = freshDb()
  const d = decideText(LAB_TEXT)
  const first = ingest(db, metaOf(), d)
  const second = ingest(db, metaOf({ title: '换个标题也一样' }), d)

  assert.equal(second.reused, true)
  assert.equal(second.documentId, first.documentId)
  assert.equal(db.prepare('SELECT count(*) AS n FROM document').get().n, 1)
  assert.equal(db.prepare('SELECT count(*) AS n FROM candidate').get().n, first.candidateCount)
  db.close()
})

test('域外材料：落 parse_failed，0 候选，拒绝理由留在 parse_note', () => {
  const db = freshDb()
  const d = decideText(PANCREAS_TEXT, 'bingli.txt')
  const r = ingest(db, metaOf({ kind: 'pathology' }), d)

  assert.equal(r.status, 'parse_failed')
  assert.equal(r.candidateCount, 0)
  assert.equal(db.prepare('SELECT count(*) AS n FROM candidate').get().n, 0)

  const doc = db.prepare('SELECT * FROM document WHERE id = ?').get(r.documentId)
  assert.match(doc.parse_note, /^\[gate\]/)
  assert.match(doc.parse_note, /胰腺/)
  db.close()
})

test('线索不足：落 pending_parse，不是 parse_failed——文件没坏', () => {
  const db = freshDb()
  const d = decideText(VAGUE_TEXT)
  const r = ingest(db, metaOf(), d)
  assert.equal(r.status, 'pending_parse')
  assert.equal(r.candidateCount, 0)
  db.close()
})

test('扫描件没给 OCR 结果：如实报"待解析"，不假装成功', () => {
  const db = freshDb()
  const scanned = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Page>>endobj\ntrailer<</Root 1 0 R>>', 'latin1')
  const d = decide({ buf: scanned, name: 'scan.pdf' })
  assert.equal(d.verdict, 'needs_lines')
  const r = ingest(db, metaOf({ kind: 'pathology' }), d)
  assert.equal(r.status, 'pending_parse')
  assert.equal(r.candidateCount, 0)
  db.close()
})

test('确认一条候选：写进 metric_reading，候选转 accepted，文件转 parsed', () => {
  const db = freshDb()
  const r = ingest(db, metaOf(), decideText(LAB_TEXT))
  const cands = listCandidates(db, r.documentId)
  const albumin = cands.find((c) => c.field === 'albumin')
  assert.equal(albumin.importable, true)

  const out = acceptCandidate(db, albumin.id)
  assert.equal(out.metricId, 'albumin')
  assert.equal(out.measuredOn, '2026-10-20')

  const reading = db.prepare('SELECT * FROM metric_reading WHERE id = ?').get(out.readingId)
  assert.equal(Number(reading.value_num), 38)
  assert.equal(reading.unit, 'g/L')
  assert.equal(reading.is_missing, 0)
  assert.equal(Number(reading.source_doc_id), r.documentId, '趋势点必须能追溯回原件')

  assert.equal(db.prepare('SELECT status FROM candidate WHERE id = ?').get(albumin.id).status, 'accepted')
  assert.equal(db.prepare('SELECT status FROM document WHERE id = ?').get(r.documentId).status, 'pending_review',
    '还有别的候选没处理，文件不该提前变 parsed')
  db.close()
})

test('全部候选处理完，文件才转 parsed', () => {
  const db = freshDb()
  const r = ingest(db, metaOf(), decideText(LAB_TEXT))
  for (const c of listCandidates(db, r.documentId)) rejectCandidate(db, c.id)
  assert.equal(db.prepare('SELECT status FROM document WHERE id = ?').get(r.documentId).status, 'parsed')
  assert.equal(db.prepare('SELECT count(*) AS n FROM metric_reading').get().n, 0, '退回不该产生趋势点')
  db.close()
})

test('没有测量日期不许确认，也不拿上传时间顶替', () => {
  const db = freshDb()
  const r = ingest(db, metaOf({ docDate: null }), decideText(LAB_TEXT))
  const c = listCandidates(db, r.documentId).find((x) => x.field === 'albumin')
  assert.throws(() => acceptCandidate(db, c.id), /请先补上测量日期/)
  assert.equal(db.prepare('SELECT count(*) AS n FROM metric_reading').get().n, 0)
  // 显式传日期还是可以的
  const out = acceptCandidate(db, c.id, { measuredOn: '2026-10-18' })
  assert.equal(out.measuredOn, '2026-10-18')
  db.close()
})

test('文本字段（部位/诊断）不能写进趋势，只做候选', () => {
  const db = freshDb()
  const path = '病变部位：肝右叶\n病理诊断：肝细胞癌，中分化\n肝内占位 42mm 最大结节直径 42mm\n'
  const r = ingest(db, metaOf({ kind: 'pathology' }), decideText(path, 'p.txt'))
  const cands = listCandidates(db, r.documentId)
  const site = cands.find((c) => c.field === 'site')
  assert.ok(site, '部位应作为候选保留，供人看原文')
  assert.equal(site.importable, false)
  assert.throws(() => acceptCandidate(db, site.id), /不是指标字段/)
  db.close()
})

test('同一天同一指标已有记录时拒绝重复写入', () => {
  const db = freshDb()
  db.prepare(`INSERT INTO metric_reading (profile_id, metric_id, measured_on, value_num, unit, created_at)
              VALUES ('p1','albumin','2026-10-20',40,'g/L','2026-10-20T00:00:00Z')`).run()
  const r = ingest(db, metaOf(), decideText(LAB_TEXT))
  const c = listCandidates(db, r.documentId).find((x) => x.field === 'albumin')
  assert.throws(() => acceptCandidate(db, c.id), /已有 albumin 的记录/)
  assert.equal(db.prepare("SELECT status FROM candidate WHERE id = ?").get(c.id).status, 'pending')
  db.close()
})

test('确认过的候选不能重复确认', () => {
  const db = freshDb()
  const r = ingest(db, metaOf(), decideText(LAB_TEXT))
  const c = listCandidates(db, r.documentId).find((x) => x.field === 'afp')
  acceptCandidate(db, c.id)
  assert.throws(() => acceptCandidate(db, c.id), /已经是 accepted/)
  db.close()
})

test('不存在的档案直接报错，不静默建孤儿数据', () => {
  const db = freshDb()
  assert.throws(() => ingest(db, metaOf({ profileId: 'nobody' }), decideText(LAB_TEXT)), /没有这个档案/)
  assert.equal(db.prepare('SELECT count(*) AS n FROM document').get().n, 0)
  db.close()
})

test('导入队列只给文件状态与候选计数，不带候选内容', () => {
  const db = freshDb()
  ingest(db, metaOf(), decideText(LAB_TEXT))
  ingest(db, metaOf({ title: '胰腺病理', kind: 'pathology' }), decideText(PANCREAS_TEXT, 'b.txt'))
  const docs = listDocuments(db, 'p1')
  assert.equal(docs.length, 2)
  assert.deepEqual(docs.map((d) => d.status).sort(), ['parse_failed', 'pending_review'])
  for (const d of docs) {
    assert.equal('candidates' in d, true)
    assert.equal(typeof d.candidates.pending, 'number')
    assert.equal('valueNum' in d, false)
  }
  db.close()
})

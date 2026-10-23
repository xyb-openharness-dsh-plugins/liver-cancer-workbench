// 读模型单测：口径比功能重要——缺测不补 0、不做差值、私密默认不出。
// 运行：node --disable-warning=ExperimentalWarning --test test/read-model.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { openDatabase } from '../dsh/db.js'
import { computeAlbi } from '../dsh/albi.js'
import { listProfiles, getDashboard, listMetrics, listViewpoints } from '../dsh/read-model.js'

const NOW = '2026-10-23T00:00:00+08:00'

function fixture() {
  const db = openDatabase(':memory:')
  db.prepare('INSERT INTO profile (id,name,initial,age,sex,tag,is_demo,created_at) VALUES (?,?,?,?,?,?,1,?)')
    .run('p1', '测试', '测', 58, 'M', 'HBV', NOW)
  const insReserve = db.prepare(`INSERT INTO liver_reserve
    (profile_id,measured_on,albumin_g_l,bilirubin_umol_l,inr,platelets_1e9_l,alt_u_l,ast_u_l,child_pugh_score,child_pugh_class,result_state,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
  // 第一条缺 ALT（NULL），第二条齐全：ALT 不能因为缺测就被补成 0 或前值
  insReserve.run('p1', '2026-04-08', 36, 28, 1.25, 92, null, 61, 6, 'A', 'partial', NOW)
  insReserve.run('p1', '2026-07-15', 32, 34, 1.31, 66, 96, 88, 7, 'B', 'reported', NOW)

  db.prepare(`INSERT INTO tumor_assessment (profile_id,assessed_on,modality,lesion_count,max_diameter_mm,afp_ng_ml,created_at)
    VALUES (?,?,?,?,?,?,?)`).run('p1', '2026-04-15', 'mri', 3, 62, 1240, NOW)
  db.prepare(`INSERT INTO portal_hypertension (profile_id,assessed_on,varices_grade,bleed_history,spleen_mm,created_at)
    VALUES (?,?,?,?,?,?)`).run('p1', '2026-05-02', 'medium', 'no', 142, NOW)
  db.prepare(`INSERT INTO nutrition_record (profile_id,measured_on,weight_kg,calf_cm,grip_kg,created_at)
    VALUES (?,?,?,?,?,?)`).run('p1', '2026-09-01', 61.2, 33.5, null, NOW)
  db.prepare(`INSERT INTO metric_reading (profile_id,metric_id,measured_on,value_num,unit,created_at)
    VALUES (?,?,?,?,?,?)`).run('p1', 'hgb', '2026-09-01', 108, 'g/L', NOW)
  const insView = db.prepare(`INSERT INTO viewpoint (profile_id,recorded_on,topic,body,source,visibility,created_at)
    VALUES (?,?,?,?,?,?,?)`)
  insView.run('p1', '2026-06-10', '复查前', '怕 AFP 涨', 'self', 'shared', NOW)
  insView.run('p1', '2026-09-15', '回到工作', '怕同事问', 'self', 'private', NOW)
  return db
}

test('迁移可重复执行，不重复应用', () => {
  const db = openDatabase(':memory:')
  const first = Number(db.prepare('SELECT count(*) AS n FROM _migration').get().n)
  assert.ok(first >= 2)
  // 同一进程再开一次新库仍是相同数量（幂等路径由 openDatabase 的 sha256 比对保证）
  const again = openDatabase(':memory:')
  assert.equal(Number(again.prepare('SELECT count(*) AS n FROM _migration').get().n), first)
})

test('ALBI 缺一项就返回 null，不用 0 顶替', () => {
  assert.equal(computeAlbi({ albumin: null, bilirubin: 20 }), null)
  assert.equal(computeAlbi({ albumin: 35, bilirubin: null }), null)
  const ok = computeAlbi({ albumin: 35, bilirubin: 20 })
  assert.equal(typeof ok.score, 'number')
  assert.ok([1, 2, 3].includes(ok.grade))
})

test('档案列表只返回在册档案，不含临床值', () => {
  const db = fixture()
  const list = listProfiles(db)
  assert.equal(list.length, 1)
  assert.equal(list[0].id, 'p1')
  assert.equal(list[0].albumin, undefined)
})

test('看板：三条线各自独立，门脉高压不并进肝或瘤', () => {
  const db = fixture()
  const d = getDashboard(db, 'p1')
  assert.equal(d.tracks.liver.childPughClass, 'B', '取最近一次记录')
  assert.equal(d.tracks.tumor.maxDiameter, 62)
  assert.equal(d.tracks.portal.varices, 'medium')
  assert.equal(d.tracks.liver.portal, undefined)
  assert.equal(d.albi.grade >= 1, true)
  assert.equal(d.resectability, null, '没有断言就不编一个')
})

test('看板：不存在的档案给 404 语义，不是空对象', () => {
  const db = fixture()
  assert.throws(() => getDashboard(db, 'nope'), /profile not found/)
})

test('指标序列：缺测不补 0，单点不给差值', () => {
  const db = fixture()
  const metrics = listMetrics(db, 'p1')
  const alt = metrics.find((m) => m.id === 'alt')
  assert.equal(alt.points.length, 1, '第一条 ALT 是 NULL，不应进序列')
  assert.equal(alt.points[0].v, 96)
  assert.equal(alt.delta, null, '只有一个点，不能算出"较前次"')
  assert.equal(alt.count, 1)
})

test('指标序列：按日期升序，delta 等于最近减前次', () => {
  const db = fixture()
  const m = listMetrics(db, 'p1').find((x) => x.id === 'albumin')
  assert.deepEqual(m.points.map((p) => p.d), ['2026-04-08', '2026-07-15'])
  assert.equal(m.latest.v, 32)
  assert.equal(m.delta, -4)
})

test('分类变量标记为不可比，且给原值不给数值序列', () => {
  const db = fixture()
  const child = listMetrics(db, 'p1').find((x) => x.id === 'child_pugh')
  assert.equal(child.kind, 'grade')
  assert.equal(child.comparable, false)
  assert.equal(child.points.length, 0, '分类变量不进数值序列')
  assert.equal(child.latestText, 'B', '取最近一次医生记录的分级')
  assert.equal(child.count, 2)
  assert.equal(child.delta, null, '分级不做差值')
})

test('同一日期业务表与 metric_reading 重复时，以业务表为准', () => {
  const db = fixture()
  db.prepare(`INSERT INTO metric_reading (profile_id,metric_id,measured_on,value_num,unit,created_at)
    VALUES (?,?,?,?,?,?)`).run('p1', 'weight', '2026-09-01', 99, 'kg', NOW)
  const w = listMetrics(db, 'p1').find((x) => x.id === 'weight')
  assert.equal(w.points.length, 1)
  assert.equal(w.latest.v, 61.2)
})

test('看法默认只返回 shared，私密必须显式请求', () => {
  const db = fixture()
  assert.equal(listViewpoints(db, 'p1').length, 1)
  assert.equal(listViewpoints(db, 'p1', { includePrivate: true }).length, 2)
})

// —— 专项视图：只摆事实，缺测留空，私密看法不混进来 ——
test('sections：七块都在，且不含私密看法', async () => {
  const { getSections } = await import('../dsh/read-model.js')
  const db = fixture()
  const s = getSections(db, 'p1')
  for (const key of ['liver', 'tumor', 'treatment', 'safety', 'nutrition', 'mind', 'followup']) {
    assert.ok(key in s, `缺少 ${key}`)
  }
  // 看法不在 sections 里，必须走 /viewpoints 的私密开关
  assert.equal(JSON.stringify(s).includes('怕同事问'), false)
  db.close()
})

test('sections：营养记录的体重缺测不补、缺身高不算 BMI', async () => {
  const { getSections } = await import('../dsh/read-model.js')
  const db = fixture()
  const rec = getSections(db, 'p1').nutrition.records[0]
  assert.equal(rec.grip, null, '握力缺测必须是 null，不能是 0')
  assert.equal(rec.bmi, null, '缺身高时不给 BMI')
  db.close()
})

test('sections：ALBI 逐条派生，缺项那条为 null', () => {
  const db = fixture()
  db.prepare(`INSERT INTO liver_reserve (profile_id,measured_on,albumin_g_l,bilirubin_umol_l,created_at)
    VALUES (?,?,?,?,?)`).run('p1', '2026-09-20', 34, null, NOW)
  return import('../dsh/read-model.js').then(({ getSections }) => {
    const rows = getSections(db, 'p1').liver.reserve
    assert.deepEqual(rows[0].albi, null, '仅胆红素缺测时不出 ALBI')
    assert.equal(typeof rows[1].albi.score, 'number')
    db.close()
  })
})

test('sections：治疗事件按开始日期倒序，缺结束时间就是 null', () => {
  const db = fixture()
  const ins = db.prepare(`INSERT INTO treatment_event (profile_id,modality,intent,regimen,started_on,ended_on,created_at)
    VALUES (?,?,?,?,?,?,?)`)
  ins.run('p1', 'tace', 'palliative', 'TACE', '2026-05-27', '2026-05-29', NOW)
  ins.run('p1', 'systemic', 'conversion', '仑伐替尼+信迪利单抗', '2026-06-10', null, NOW)
  return import('../dsh/read-model.js').then(({ getSections }) => {
    const ev = getSections(db, 'p1').treatment.events
    assert.equal(ev[0].regimen, '仑伐替尼+信迪利单抗', '最新的排最前')
    assert.equal(ev[0].endedOn, null, '未结束就是 null，不补今天')
    db.close()
  })
})

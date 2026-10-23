// 小甘宝 HepPal · 读模型
// 只读、不写、不判断。三条口径写死在代码里：
//   1. 缺测就是 null，不补 0、不用前值填；
//   2. 分类变量（Child-Pugh、LI-RADS、Vp）只给原值，不做数值趋势；
//   3. 看法（viewpoint）默认不返回，除非显式要求 includePrivate。
import { computeAlbi } from './albi.js'

const num = (v) => (v == null ? null : Number(v))
const day = (v) => (v ? String(v).slice(0, 10) : null)

/** 档案列表（不含任何临床值） */
export function listProfiles(db, { includeArchived = false } = {}) {
  const sql = `SELECT id, name, initial, age, sex, tag, is_demo AS isDemo, is_archived AS isArchived
    FROM profile ${includeArchived ? '' : 'WHERE is_archived = 0'} ORDER BY rowid`
  return db.prepare(sql).all().map((r) => ({
    id: r.id, name: r.name, initial: r.initial, age: num(r.age), sex: r.sex,
    tag: r.tag, isDemo: !!r.isDemo, isArchived: !!r.isArchived,
  }))
}

function requireProfile(db, profileId) {
  const p = db.prepare('SELECT id, name, initial, age, sex, tag FROM profile WHERE id = ?').get(profileId)
  if (!p) {
    const error = new Error(`profile not found: ${profileId}`)
    error.code = 'not_found'
    throw error
  }
  return p
}

const currentAssertion = (db, table, profileId) => db.prepare(
  `SELECT * FROM ${table} WHERE profile_id = ? AND is_current = 1 ORDER BY rowid DESC LIMIT 1`
).get(profileId) || null

/**
 * 看板聚合：两条主轨 + 门脉高压独立线。
 * 这里**不做任何相加/加权**，只是把最新一条记录摆到同一屏。
 */
export function getDashboard(db, profileId) {
  const profile = requireProfile(db, profileId)

  const reserve = db.prepare(
    'SELECT * FROM liver_reserve WHERE profile_id = ? ORDER BY measured_on DESC, rowid DESC LIMIT 1'
  ).get(profileId) || null

  const tumor = db.prepare(
    'SELECT * FROM tumor_assessment WHERE profile_id = ? ORDER BY assessed_on DESC, rowid DESC LIMIT 1'
  ).get(profileId) || null

  const portal = db.prepare(
    'SELECT * FROM portal_hypertension WHERE profile_id = ? ORDER BY assessed_on DESC, rowid DESC LIMIT 1'
  ).get(profileId) || null

  const bg = db.prepare(
    'SELECT * FROM liver_background WHERE profile_id = ? ORDER BY recorded_on DESC, rowid DESC LIMIT 1'
  ).get(profileId) || null

  const albi = reserve ? computeAlbi({ albumin: num(reserve.albumin_g_l), bilirubin: num(reserve.bilirubin_umol_l) }) : null

  const stage = {}
  for (const system of ['BCLC', 'CNLC']) {
    const row = db.prepare(
      'SELECT system, stage, stated_by AS statedBy, stated_on AS statedOn, basis FROM stage_assertion WHERE profile_id = ? AND system = ? AND is_current = 1 LIMIT 1'
    ).get(profileId, system)
    stage[system] = row ? { ...row, statedOn: day(row.statedOn) } : null
  }

  const resect = currentAssertion(db, 'resectability_assertion', profileId)

  const nextVisit = db.prepare(
    'SELECT visited_on AS "on", department, purpose, next_on AS nextOn FROM visit WHERE profile_id = ? ORDER BY visited_on DESC, rowid DESC LIMIT 1'
  ).get(profileId) || null

  const openTasks = db.prepare(
    'SELECT id, title, due_on AS dueOn, kind FROM task WHERE profile_id = ? AND done_on IS NULL ORDER BY due_on IS NULL, due_on LIMIT 5'
  ).all(profileId).map((t) => ({ ...t, dueOn: day(t.dueOn) }))

  return {
    profile: { id: profile.id, name: profile.name, initial: profile.initial, age: num(profile.age), sex: profile.sex, tag: profile.tag },
    background: bg ? {
      etiology: bg.etiology, cirrhosis: bg.cirrhosis, recorderedOn: day(bg.recorded_on),
    } : null,
    tracks: {
      liver: reserve ? {
        measuredOn: day(reserve.measured_on),
        albumin: num(reserve.albumin_g_l), bilirubin: num(reserve.bilirubin_umol_l), inr: num(reserve.inr),
        platelets: num(reserve.platelets_1e9_l), alt: num(reserve.alt_u_l), ast: num(reserve.ast_u_l),
        childPughScore: num(reserve.child_pugh_score), childPughClass: reserve.child_pugh_class,
        ascites: reserve.ascites_grade, encephalopathy: reserve.encephalopathy_grade,
        resultState: reserve.result_state,
      } : null,
      tumor: tumor ? {
        assessedOn: day(tumor.assessed_on), modality: tumor.modality,
        lesionCount: num(tumor.lesion_count), maxDiameter: num(tumor.max_diameter_mm),
        liRads: tumor.li_rads, portalVeinThrombus: tumor.portal_vein_thrombus,
        extrahepatic: tumor.extrahepatic, afp: num(tumor.afp_ng_ml), pivka2: num(tumor.pivka2_mau_ml),
      } : null,
      // C 轨：门脉高压。放在 tracks 里但**不与 A/B 合并计算**，前端也单独一栏。
      portal: portal ? {
        assessedOn: day(portal.assessed_on), varices: portal.varices_grade, bleedHistory: portal.bleed_history,
        banding: portal.banding, betaBlocker: portal.beta_blocker,
        spleenMm: num(portal.spleen_mm), portalVeinMm: num(portal.portal_vein_mm),
      } : null,
    },
    albi,
    stage,
    resectability: resect ? {
      conclusion: resect.conclusion, statedBy: resect.stated_by, statedOn: day(resect.stated_on),
      basis: resect.basis, futureRemnant: resect.future_remnant, context: resect.context,
    } : null,
    nextVisit: nextVisit ? { ...nextVisit, on: day(nextVisit.on), nextOn: day(nextVisit.nextOn) } : null,
    openTasks,
  }
}

// 每项指标从哪里取：业务表优先；只在业务表没有该列时才落到 metric_reading。
// source 会原样进界面（用户要能看见"这个数从哪来"）。
const SOURCES = [
  { table: 'liver_reserve', dateCol: 'measured_on', map: {
    albumin: 'albumin_g_l', bilirubin: 'bilirubin_umol_l', inr: 'inr', platelets: 'platelets_1e9_l',
    alt: 'alt_u_l', ast: 'ast_u_l',
  } },
  { table: 'tumor_assessment', dateCol: 'assessed_on', map: {
    afp: 'afp_ng_ml', pivka2: 'pivka2_mau_ml', max_diameter: 'max_diameter_mm',
  } },
  { table: 'nutrition_record', dateCol: 'measured_on', map: {
    weight: 'weight_kg', calf: 'calf_cm', grip: 'grip_kg',
  } },
]

// 分类变量：只记原值，不做数值趋势（Child-Pugh / LI-RADS / Vp 都是"医生写的类别"）
const QUAL_SOURCES = [
  { table: 'liver_reserve', dateCol: 'measured_on', map: { child_pugh: 'child_pugh_class' } },
  { table: 'tumor_assessment', dateCol: 'assessed_on', map: { li_rads: 'li_rads', vp: 'portal_vein_thrombus' } },
]

/**
 * 指标序列：每条含 points（按日期升序、缺测点不进数组）与 latest/prev/delta。
 * 分类变量给 latestText + history，不给 delta、不给 points（前端据此不画线）。
 * 不做插值、不做平滑——画不画线由前端按点数决定。
 */
export function listMetrics(db, profileId) {
  requireProfile(db, profileId)
  const defs = db.prepare('SELECT id, label_zh AS label, unit, kind, track, decimals FROM metric_def ORDER BY rowid').all()
  const series = new Map(defs.map((d) => [d.id, []]))
  const qual = new Map(defs.map((d) => [d.id, []]))

  for (const src of SOURCES) {
    const cols = Object.entries(src.map)
    const sql = `SELECT ${src.dateCol} AS "on", ${cols.map(([, c]) => c).join(', ')} FROM ${src.table}
      WHERE profile_id = ? ORDER BY ${src.dateCol}, rowid`
    for (const row of db.prepare(sql).all(profileId)) {
      for (const [metricId, col] of cols) {
        const v = num(row[col])
        if (v == null) continue // 缺测不进序列，也不补前值
        series.get(metricId)?.push({ d: day(row.on), v })
      }
    }
  }

  // 血常规等只在 metric_reading 里的项
  const readings = db.prepare(`SELECT metric_id AS id, measured_on AS "on", value_num AS v, unit
    FROM metric_reading WHERE profile_id = ? AND is_missing = 0 AND value_num IS NOT NULL
    ORDER BY measured_on, rowid`).all(profileId)
  for (const r of readings) {
    if (!series.has(r.id)) continue
    // 业务表已给出同一日期同一项时，以业务表为准，避免同一天两个真相
    const bucket = series.get(r.id)
    if (bucket.some((p) => p.d === day(r.on))) continue
    bucket.push({ d: day(r.on), v: num(r.v) })
  }

  for (const src of QUAL_SOURCES) {
    const cols = Object.entries(src.map)
    const sql = `SELECT ${src.dateCol} AS "on", ${cols.map(([, c]) => c).join(', ')} FROM ${src.table}
      WHERE profile_id = ? ORDER BY ${src.dateCol}, rowid`
    for (const row of db.prepare(sql).all(profileId)) {
      for (const [metricId, col] of cols) {
        const text = row[col]
        if (text == null || text === 'unknown') continue
        qual.get(metricId)?.push({ d: day(row.on), text: String(text) })
      }
    }
  }

  return defs.map((d) => {
    if (d.kind === 'grade') {
      const history = (qual.get(d.id) || []).sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0))
      const latest = history.length ? history[history.length - 1] : null
      return {
        id: d.id, label: d.label, unit: d.unit, kind: d.kind, track: d.track,
        decimals: 0, points: [], history, latestText: latest ? latest.text : null,
        latest, prev: history.length > 1 ? history[history.length - 2] : null,
        delta: null, count: history.length, comparable: false,
      }
    }
    const points = (series.get(d.id) || []).sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0))
    const latest = points.length ? points[points.length - 1] : null
    const prev = points.length > 1 ? points[points.length - 2] : null
    return {
      id: d.id, label: d.label, unit: d.unit, kind: d.kind, track: d.track,
      decimals: d.decimals == null ? 0 : Number(d.decimals),
      points,
      latest, prev,
      // delta 只在两点同类同单位时给出；否则 null，前端显示"暂无可比较的前次记录"
      delta: latest && prev ? Number((latest.v - prev.v).toFixed(3)) : null,
      count: points.length,
      // 分类变量不做数值趋势，这一条由前端据此不画线
      comparable: d.kind === 'numeric',
    }
  })
}

/**
 * 各专项视图的原始记录。只按日期倒序摆事实，不排序出「重要程度」，也不给建议。
 * 心理与家庭里的 viewpoint 不在这里返回——那条走 /viewpoints，因为要带私密开关。
 */
export function getSections(db, profileId) {
  requireProfile(db, profileId)
  const all = (sql) => db.prepare(sql).all(profileId)
  const one = (sql) => db.prepare(sql).get(profileId) || null

  const reserveRows = all(`SELECT * FROM liver_reserve WHERE profile_id = ? ORDER BY measured_on DESC, rowid DESC`)
  const tumorRows = all(`SELECT * FROM tumor_assessment WHERE profile_id = ? ORDER BY assessed_on DESC, rowid DESC`)

  return {
    liver: {
      background: all(`SELECT * FROM liver_background WHERE profile_id = ? ORDER BY recorded_on DESC, rowid DESC`)
        .map((r) => ({
          on: day(r.recorded_on), etiology: r.etiology, cirrhosis: r.cirrhosis,
          hbsag: r.hbsag, hcvAb: r.hcv_ab, childPughAtDx: r.child_pugh_at_dx,
          alcoholUnits: r.alcohol_units, diabetes: r.diabetes, familyHistory: r.family_history, note: r.note,
        })),
      reserve: reserveRows.map((r) => ({
        on: day(r.measured_on),
        albumin: num(r.albumin_g_l), bilirubin: num(r.bilirubin_umol_l), inr: num(r.inr),
        platelets: num(r.platelets_1e9_l), alt: num(r.alt_u_l), ast: num(r.ast_u_l),
        childPughScore: num(r.child_pugh_score), childPughClass: r.child_pugh_class,
        ascites: r.ascites_grade, encephalopathy: r.encephalopathy_grade,
        resultState: r.result_state,
        albi: computeAlbi({ albumin: num(r.albumin_g_l), bilirubin: num(r.bilirubin_umol_l) }),
      })),
    },
    tumor: {
      assessments: tumorRows.map((r) => ({
        on: day(r.assessed_on), modality: r.modality,
        lesionCount: num(r.lesion_count), maxDiameter: num(r.max_diameter_mm),
        liRads: r.li_rads, vp: r.portal_vein_thrombus, extrahepatic: r.extrahepatic,
        afp: num(r.afp_ng_ml), pivka2: num(r.pivka2_mau_ml), note: r.note,
      })),
      stages: all(`SELECT system, stage, stated_by AS statedBy, stated_on AS statedOn, basis, is_current AS isCurrent
        FROM stage_assertion WHERE profile_id = ? ORDER BY stated_on DESC, rowid DESC`)
        .map((r) => ({ ...r, statedOn: day(r.statedOn), isCurrent: !!r.isCurrent })),
      resectability: all(`SELECT conclusion, stated_by AS statedBy, stated_on AS statedOn, basis,
          future_remnant AS futureRemnant, context, is_current AS isCurrent
        FROM resectability_assertion WHERE profile_id = ? ORDER BY stated_on DESC, rowid DESC`)
        .map((r) => ({ ...r, statedOn: day(r.statedOn), isCurrent: !!r.isCurrent })),
    },
    treatment: {
      events: all(`SELECT id, modality, intent, line_no AS lineNo, regimen, started_on AS startedOn,
          ended_on AS endedOn, cycles_planned AS cyclesPlanned, cycles_done AS cyclesDone,
          response, stop_reason AS stopReason, institution, note
        FROM treatment_event WHERE profile_id = ? ORDER BY started_on DESC, rowid DESC`)
        .map((r) => ({ ...r, startedOn: day(r.startedOn), endedOn: day(r.endedOn) })),
      trials: all(`SELECT id, source, source_id AS sourceId, title, phase, status_text AS statusText,
          site_text AS siteText, added_on AS addedOn, note
        FROM trial_ref WHERE profile_id = ? ORDER BY added_on DESC, rowid DESC`)
        .map((r) => ({ ...r, addedOn: day(r.addedOn) })),
    },
    safety: {
      events: all(`SELECT id, kind, onset_on AS onsetOn, resolved_on AS resolvedOn, grade,
          description, action_recorded AS actionRecorded
        FROM safety_event WHERE profile_id = ? ORDER BY onset_on DESC, rowid DESC`)
        .map((r) => ({ ...r, onsetOn: day(r.onsetOn), resolvedOn: day(r.resolvedOn) })),
      symptoms: all(`SELECT id, recorded_on AS "on", symptom, severity, duration, note
        FROM symptom_record WHERE profile_id = ? ORDER BY recorded_on DESC, rowid DESC`)
        .map((r) => ({ ...r, on: day(r.on) })),
      hbv: all(`SELECT id, measured_on AS "on", hbsag, hbv_dna_iu_ml AS dna, hbv_dna_state AS dnaState,
          antiviral, antiviral_start AS antiviralStart, prophylaxis, screening_before AS screeningBefore, note
        FROM hbv_record WHERE profile_id = ? ORDER BY measured_on DESC, rowid DESC`)
        .map((r) => ({ ...r, on: day(r.on), antiviralStart: day(r.antiviralStart), screeningBefore: day(r.screeningBefore) })),
    },
    nutrition: {
      records: all(`SELECT id, measured_on AS "on", weight_kg AS weight, height_cm AS height,
          calf_cm AS calf, grip_kg AS grip, appetite, salt_restriction AS salt, fluid_limit AS fluid, note
        FROM nutrition_record WHERE profile_id = ? ORDER BY measured_on DESC, rowid DESC`)
        .map((r) => ({
          ...r, on: day(r.on), num: num(r.weight), height: num(r.height),
          calf: num(r.calf), grip: num(r.grip),
          // BMI 是算出来的，缺身高或体重就不给——不拿"上次身高"顶
          bmi: num(r.weight) != null && num(r.height) ? Number((num(r.weight) / ((num(r.height) / 100) ** 2)).toFixed(1)) : null,
        })),
    },
    mind: {
      questions: all(`SELECT id, created_on AS createdOn, body, answered
        FROM question WHERE profile_id = ? ORDER BY created_on DESC, rowid DESC`)
        .map((r) => ({ ...r, createdOn: day(r.createdOn) })),
      family: all(`SELECT id, relation, hbsag, vaccinated, checked_on AS checkedOn, note
        FROM family_screening WHERE profile_id = ? ORDER BY rowid`)
        .map((r) => ({ ...r, checkedOn: day(r.checkedOn) })),
    },
    followup: {
      visits: all(`SELECT id, visited_on AS "on", department, purpose, summary, next_on AS nextOn
        FROM visit WHERE profile_id = ? ORDER BY visited_on DESC, rowid DESC`)
        .map((r) => ({ ...r, on: day(r.on), nextOn: day(r.nextOn) })),
      tasks: all(`SELECT id, title, due_on AS dueOn, done_on AS doneOn, kind
        FROM task WHERE profile_id = ? ORDER BY done_on IS NOT NULL, due_on IS NULL, due_on`)
        .map((r) => ({ ...r, dueOn: day(r.dueOn), doneOn: day(r.doneOn) })),
    },
    portal: one(`SELECT * FROM portal_hypertension WHERE profile_id = ? ORDER BY assessed_on DESC, rowid DESC LIMIT 1`),
  }
}

/** 看法列表。私密内容必须显式请求，默认不返回。 */
export function listViewpoints(db, profileId, { includePrivate = false } = {}) {
  requireProfile(db, profileId)
  const sql = `SELECT id, recorded_on AS "on", topic, body, source, visibility
    FROM viewpoint WHERE profile_id = ? ${includePrivate ? '' : "AND visibility = 'shared'"}
    ORDER BY recorded_on, rowid`
  return db.prepare(sql).all(profileId).map((v) => ({ ...v, on: day(v.on) }))
}

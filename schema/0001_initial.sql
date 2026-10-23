-- 小甘宝 HepPal · 肝细胞癌工作台业务库初始结构
-- 版本：v0.1.0（M3 数据模型草案，G3 未签认；签认前不得用于生产）
-- 设计主脊：双轨 —— A 轨「肝功能储备」/ B 轨「肿瘤负荷」，两轨永不加总、不互相折算。
-- 约定：
--   1. 本文件执行后冻结，改结构只能新增 0002_*.sql。
--   2. 缺测一律 NULL，不用 0 / '' 顶替；"未检测"由 result_state 表达。
--   3. 分类变量（Child-Pugh 分级、LI-RADS、Vp、CTCAE）只存原值，不做数值趋势。
--   4. 医生结论（分期、可切除性）只新增版本，不覆盖旧值（见 no_rewrite 触发器）。
--   5. 事实四层不合并：document / candidate / record / metric 各自独立。
--   6. 看法恒不为结论：viewpoint 无 is_conclusion，不进趋势、不进摘要事实区。
--   7. 复合主键表在读取层必须 ORDER BY rowid，不依赖隐式顺序。

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- 工作区（单行）
-- ---------------------------------------------------------------------------
CREATE TABLE workspace (
  id             INTEGER PRIMARY KEY CHECK (id = 1),
  root_path      TEXT,                                    -- 资料目录绝对路径；未选为 NULL
  consent_mineru INTEGER NOT NULL DEFAULT 0 CHECK (consent_mineru IN (0, 1)),
  token_masked   TEXT,                                    -- 只存掩码，不存明文
  token_source   TEXT CHECK (token_source IS NULL OR token_source IN ('file','env','bundled','none')),
  backup_at      TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);

-- ---------------------------------------------------------------------------
-- 档案
-- ---------------------------------------------------------------------------
CREATE TABLE profile (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  initial     TEXT NOT NULL,
  age         INTEGER CHECK (age IS NULL OR (age >= 0 AND age <= 130)),
  sex         TEXT CHECK (sex IS NULL OR sex IN ('F','M','X')),
  tag         TEXT,
  is_demo     INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
  is_archived INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1)),
  created_at  TEXT NOT NULL
);

-- ---------------------------------------------------------------------------
-- A 轨 · 肝背景（病因与传染病维度，HCC 独有）
-- ---------------------------------------------------------------------------
CREATE TABLE liver_background (
  id            INTEGER PRIMARY KEY,
  profile_id    TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  etiology      TEXT NOT NULL CHECK (etiology IN ('hbv','hcv','alcohol','masld','aflatoxin','other','unknown','mixed')),
  hbsag         TEXT CHECK (hbsag IS NULL OR hbsag IN ('positive','negative','unknown')),
  hcv_ab        TEXT CHECK (hcv_ab IS NULL OR hcv_ab IN ('positive','negative','unknown')),
  cirrhosis     TEXT CHECK (cirrhosis IS NULL OR cirrhosis IN ('yes','no','suspected','unknown')),
  child_pugh_at_dx TEXT,
  alcohol_units TEXT,
  diabetes      TEXT CHECK (diabetes IS NULL OR diabetes IN ('yes','no','unknown')),
  family_history TEXT,
  note          TEXT,
  recorded_on   TEXT,
  created_at    TEXT NOT NULL
);
CREATE INDEX ix_liver_bg_profile ON liver_background(profile_id, recorded_on);

-- HBV 专项：再激活风险与家庭防护的事实来源
CREATE TABLE hbv_record (
  id             INTEGER PRIMARY KEY,
  profile_id     TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  measured_on    TEXT NOT NULL,
  hbsag          TEXT,
  hbv_dna_iu_ml  REAL CHECK (hbv_dna_iu_ml IS NULL OR hbv_dna_iu_ml >= 0),
  hbv_dna_state  TEXT CHECK (hbv_dna_state IS NULL OR hbv_dna_state IN ('detected','undetected','unknown')),
  antiviral      TEXT,                                    -- 原样记录药名，不做推荐
  antiviral_start TEXT,
  prophylaxis    TEXT CHECK (prophylaxis IS NULL OR prophylaxis IN ('yes','no','unknown')),
  screening_before TEXT,                                  -- 免疫/激素/化疗前筛查日期
  source_doc_id  INTEGER,
  note           TEXT,
  created_at     TEXT NOT NULL
);
CREATE INDEX ix_hbv_profile ON hbv_record(profile_id, measured_on);

-- 家庭筛查与疫苗：只记录，不代替公共卫生建议
CREATE TABLE family_screening (
  id           INTEGER PRIMARY KEY,
  profile_id   TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  relation     TEXT NOT NULL,
  hbsag        TEXT CHECK (hbsag IS NULL OR hbsag IN ('positive','negative','unknown','not_tested')),
  vaccinated   TEXT CHECK (vaccinated IS NULL OR vaccinated IN ('yes','no','partial','unknown')),
  checked_on   TEXT,
  note         TEXT,
  created_at   TEXT NOT NULL
);
CREATE INDEX ix_family_profile ON family_screening(profile_id);

-- ---------------------------------------------------------------------------
-- A 轨 · 肝功能储备（化验原始值 + 医生给的评分）
-- 评分与分级只存原值；ALBI 由读模型用 albumin/bilirubin 计算，不落库，避免双真相。
-- ---------------------------------------------------------------------------
CREATE TABLE liver_reserve (
  id            INTEGER PRIMARY KEY,
  profile_id    TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  measured_on   TEXT NOT NULL,
  albumin_g_l   REAL CHECK (albumin_g_l IS NULL OR albumin_g_l > 0),
  bilirubin_umol_l REAL CHECK (bilirubin_umol_l IS NULL OR bilirubin_umol_l >= 0),
  inr           REAL CHECK (inr IS NULL OR inr > 0),
  pt_percent    REAL CHECK (pt_percent IS NULL OR pt_percent >= 0),
  alt_u_l       REAL,
  ast_u_l       REAL,
  platelets_1e9_l REAL CHECK (platelets_1e9_l IS NULL OR platelets_1e9_l >= 0),
  creatinine_umol_l REAL,
  ammonia_umol_l REAL,
  child_pugh_score INTEGER CHECK (child_pugh_score IS NULL OR (child_pugh_score BETWEEN 5 AND 15)),
  child_pugh_class TEXT CHECK (child_pugh_class IS NULL OR child_pugh_class IN ('A','B','C','unknown')),
  ascites_grade TEXT CHECK (ascites_grade IS NULL OR ascites_grade IN ('none','mild','moderate','severe','unknown')),
  encephalopathy_grade TEXT CHECK (encephalopathy_grade IS NULL OR encephalopathy_grade IN ('none','1','2','3','4','unknown')),
  icg_r15       REAL,
  result_state  TEXT NOT NULL DEFAULT 'reported' CHECK (result_state IN ('reported','partial','not_tested','unknown')),
  source_doc_id INTEGER,
  note          TEXT,
  created_at    TEXT NOT NULL
);
CREATE INDEX ix_reserve_profile ON liver_reserve(profile_id, measured_on);

-- 门脉高压：第三条风险线（不与肿瘤负荷合并）
CREATE TABLE portal_hypertension (
  id           INTEGER PRIMARY KEY,
  profile_id   TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  assessed_on  TEXT NOT NULL,
  varices_grade TEXT CHECK (varices_grade IS NULL OR varices_grade IN ('none','small','medium','large','unknown')),
  bleed_history TEXT CHECK (bleed_history IS NULL OR bleed_history IN ('yes','no','unknown')),
  banding      TEXT,                                      -- 套扎次数/日期原样
  beta_blocker TEXT,                                      -- 药名原样，不写剂量建议
  spleen_mm    REAL,
  portal_vein_mm REAL,
  ascites      TEXT,
  note         TEXT,
  created_at   TEXT NOT NULL
);
CREATE INDEX ix_pht_profile ON portal_hypertension(profile_id, assessed_on);

-- ---------------------------------------------------------------------------
-- B 轨 · 肿瘤负荷
-- 单结节表 + 每次评估汇总；癌栓是独立字段，不塞进 note。
-- ---------------------------------------------------------------------------
CREATE TABLE tumor_assessment (
  id              INTEGER PRIMARY KEY,
  profile_id      TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  assessed_on     TEXT NOT NULL,
  modality        TEXT NOT NULL CHECK (modality IN ('ct','mri','ceus','angio','pet','pathology','other')),
  lesion_count    INTEGER CHECK (lesion_count IS NULL OR lesion_count >= 0),
  max_diameter_mm REAL CHECK (max_diameter_mm IS NULL OR max_diameter_mm >= 0),
  li_rads         TEXT CHECK (li_rads IS NULL OR li_rads IN ('LR-1','LR-2','LR-3','LR-4','LR-5','LR-M','LR-TIV','LR-NC','unknown')),
  portal_vein_thrombus TEXT CHECK (portal_vein_thrombus IS NULL OR portal_vein_thrombus IN ('Vp0','Vp1','Vp2','Vp3','Vp4','unknown')),
  extrahepatic    TEXT CHECK (extrahepatic IS NULL OR extrahepatic IN ('yes','no','unknown')),
  afp_ng_ml       REAL CHECK (afp_ng_ml IS NULL OR afp_ng_ml >= 0),
  pivka2_mau_ml   REAL CHECK (pivka2_mau_ml IS NULL OR pivka2_mau_ml >= 0),
  vascular_invasion TEXT,
  source_doc_id   INTEGER,
  note            TEXT,
  created_at      TEXT NOT NULL
);
CREATE INDEX ix_tumor_profile ON tumor_assessment(profile_id, assessed_on);

CREATE TABLE tumor_lesion (
  id             INTEGER PRIMARY KEY,
  assessment_id  INTEGER NOT NULL REFERENCES tumor_assessment(id) ON DELETE CASCADE,
  seq            INTEGER NOT NULL,
  segment        TEXT,                                    -- Couinaud 段，原样
  size_mm        REAL,
  location_note  TEXT,
  treatment_naive TEXT CHECK (treatment_naive IS NULL OR treatment_naive IN ('yes','no','unknown')),
  UNIQUE (assessment_id, seq)
);

-- 分期断言：BCLC 与 CNLC 并存，各自版本链，不互相换算
CREATE TABLE stage_assertion (
  id            INTEGER PRIMARY KEY,
  profile_id    TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  system        TEXT NOT NULL CHECK (system IN ('BCLC','CNLC','TNM','other')),
  stage         TEXT NOT NULL,
  stated_by     TEXT,                                     -- 医生/机构，原样
  stated_on     TEXT,
  basis         TEXT,                                     -- 依据原文要点
  supersedes_id INTEGER REFERENCES stage_assertion(id),
  is_current    INTEGER NOT NULL DEFAULT 1 CHECK (is_current IN (0, 1)),
  created_at    TEXT NOT NULL
);
CREATE UNIQUE INDEX ux_stage_current ON stage_assertion(profile_id, system) WHERE is_current = 1;
CREATE INDEX ix_stage_profile ON stage_assertion(profile_id, system, stated_on);

-- 可切除性断言：转化治疗的核心。只记录医生结论与依据，工作台不判定。
CREATE TABLE resectability_assertion (
  id             INTEGER PRIMARY KEY,
  profile_id     TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  conclusion     TEXT NOT NULL CHECK (conclusion IN ('resectable','borderline','unresectable','unknown')),
  stated_by      TEXT,
  stated_on      TEXT,
  basis          TEXT,
  future_remnant  TEXT,                                   -- 未来残肝体积/比例原文
  context        TEXT CHECK (context IS NULL OR context IN ('initial','post_treatment','preop','other')),
  supersedes_id  INTEGER REFERENCES resectability_assertion(id),
  is_current     INTEGER NOT NULL DEFAULT 1 CHECK (is_current IN (0, 1)),
  created_at     TEXT NOT NULL
);
CREATE UNIQUE INDEX ux_resect_current ON resectability_assertion(profile_id) WHERE is_current = 1;
CREATE INDEX ix_resect_profile ON resectability_assertion(profile_id, stated_on);

-- ---------------------------------------------------------------------------
-- 治疗事件（局部/系统/手术/移植；intent 支持转化路径）
-- ---------------------------------------------------------------------------
CREATE TABLE treatment_event (
  id           INTEGER PRIMARY KEY,
  profile_id   TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  modality     TEXT NOT NULL CHECK (modality IN ('resection','ablation','tace','haic','tare','rt','systemic','transplant','supportive','other')),
  intent       TEXT CHECK (intent IS NULL OR intent IN ('curative','palliative','conversion','adjuvant','neoadjuvant','unknown')),
  line_no       INTEGER,
  regimen       TEXT,                                     -- 方案/药名原样
  started_on    TEXT,
  ended_on      TEXT,
  cycles_planned INTEGER,
  cycles_done    INTEGER,
  response      TEXT,                                     -- 医生记录的疗效原文（mRECIST 等）
  stop_reason   TEXT,
  institution   TEXT,
  source_doc_id INTEGER,
  note          TEXT,
  created_at    TEXT NOT NULL
);
CREATE INDEX ix_tx_profile ON treatment_event(profile_id, started_on);

-- ---------------------------------------------------------------------------
-- 安全线（HCC 专属事件类型）
-- ---------------------------------------------------------------------------
CREATE TABLE safety_event (
  id           INTEGER PRIMARY KEY,
  profile_id   TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL CHECK (kind IN ('post_embolization','liver_toxicity','irae','variceal_bleed','encephalopathy','ascites','sbp','hbv_reactivation','other')),
  onset_on     TEXT NOT NULL,
  resolved_on  TEXT,
  grade        TEXT,                                      -- CTCAE 原文或医生记录
  related_tx_id INTEGER REFERENCES treatment_event(id),
  description  TEXT,
  action_recorded TEXT,                                   -- 医生已采取的措施，原样记录
  source_doc_id INTEGER,
  created_at   TEXT NOT NULL
);
CREATE INDEX ix_safety_profile ON safety_event(profile_id, onset_on);

-- ---------------------------------------------------------------------------
-- 生活与家庭（营养/肌少症/限盐/症状）
-- ---------------------------------------------------------------------------
CREATE TABLE nutrition_record (
  id             INTEGER PRIMARY KEY,
  profile_id     TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  measured_on    TEXT NOT NULL,
  weight_kg      REAL,
  height_cm      REAL,
  calf_cm        REAL,
  grip_kg        REAL,
  appetite       TEXT CHECK (appetite IS NULL OR appetite IN ('good','fair','poor','unknown')),
  salt_restriction TEXT,                                  -- 医生交代原文
  fluid_limit    TEXT,
  note           TEXT,
  created_at     TEXT NOT NULL
);
CREATE INDEX ix_nutrition_profile ON nutrition_record(profile_id, measured_on);

CREATE TABLE symptom_record (
  id          INTEGER PRIMARY KEY,
  profile_id  TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  recorded_on TEXT NOT NULL,
  symptom     TEXT NOT NULL,
  severity    INTEGER CHECK (severity IS NULL OR (severity BETWEEN 0 AND 10)),
  duration    TEXT,
  note        TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX ix_symptom_profile ON symptom_record(profile_id, recorded_on);

-- 看法：永远不是结论
CREATE TABLE viewpoint (
  id          INTEGER PRIMARY KEY,
  profile_id  TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  recorded_on TEXT NOT NULL,
  topic       TEXT NOT NULL,
  body        TEXT NOT NULL,
  source      TEXT NOT NULL DEFAULT 'self' CHECK (source IN ('self','caregiver','clinician_summary')),
  is_conclusion INTEGER NOT NULL DEFAULT 0 CHECK (is_conclusion = 0),
  created_at  TEXT NOT NULL
);
CREATE INDEX ix_viewpoint_profile ON viewpoint(profile_id, recorded_on);

-- ---------------------------------------------------------------------------
-- 事实四层：文档 / 候选 / 记录 / 指标
-- ---------------------------------------------------------------------------
CREATE TABLE document (
  id           INTEGER PRIMARY KEY,
  profile_id   TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  kind         TEXT NOT NULL CHECK (kind IN ('lab','imaging','pathology','discharge','prescription','other')),
  doc_date     TEXT,
  file_path    TEXT,
  file_sha256  TEXT,
  status       TEXT NOT NULL DEFAULT 'pending_parse' CHECK (status IN ('pending_parse','pending_review','parsed','parse_failed')),
  uploaded_at  TEXT NOT NULL,
  UNIQUE (profile_id, file_sha256)
);

CREATE TABLE candidate (
  id           INTEGER PRIMARY KEY,
  document_id  INTEGER NOT NULL REFERENCES document(id) ON DELETE CASCADE,
  field        TEXT NOT NULL,
  value_text   TEXT,
  value_num    REAL,
  unit         TEXT,
  page_no      INTEGER,
  confidence   REAL,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  created_at   TEXT NOT NULL
);
CREATE INDEX ix_candidate_doc ON candidate(document_id, field);

CREATE TABLE metric_def (
  id        TEXT PRIMARY KEY,
  label_zh  TEXT NOT NULL,
  unit      TEXT,
  kind      TEXT NOT NULL CHECK (kind IN ('numeric','grade','qual')),
  track     TEXT NOT NULL CHECK (track IN ('liver','tumor','safety','nutrition','other')),
  decimals  INTEGER
);

CREATE TABLE metric_reading (
  id          INTEGER PRIMARY KEY,
  profile_id  TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  metric_id   TEXT NOT NULL REFERENCES metric_def(id),
  measured_on TEXT NOT NULL,
  value_num   REAL,
  value_text  TEXT,
  unit        TEXT,
  is_missing  INTEGER NOT NULL DEFAULT 0 CHECK (is_missing IN (0, 1)),
  source_doc_id INTEGER,
  note        TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX ix_reading_profile ON metric_reading(profile_id, metric_id, measured_on);

-- ---------------------------------------------------------------------------
-- 复诊 / 问题 / 任务 / 试验线索
-- ---------------------------------------------------------------------------
CREATE TABLE visit (
  id          INTEGER PRIMARY KEY,
  profile_id  TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  visited_on  TEXT NOT NULL,
  department  TEXT,
  purpose     TEXT,
  summary     TEXT,
  next_on     TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX ix_visit_profile ON visit(profile_id, visited_on);

CREATE TABLE question (
  id          INTEGER PRIMARY KEY,
  profile_id  TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  created_on  TEXT NOT NULL,
  body        TEXT NOT NULL,
  for_visit_id INTEGER REFERENCES visit(id),
  answered    TEXT,
  created_at  TEXT NOT NULL
);

CREATE TABLE task (
  id          INTEGER PRIMARY KEY,
  profile_id  TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  due_on      TEXT,
  done_on     TEXT,
  kind        TEXT CHECK (kind IS NULL OR kind IN ('visit','test','med','other')),
  created_at  TEXT NOT NULL
);

CREATE TABLE trial_ref (
  id           INTEGER PRIMARY KEY,
  profile_id   TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  source       TEXT NOT NULL,
  source_id    TEXT NOT NULL,
  title        TEXT NOT NULL,
  phase        TEXT,
  status_text  TEXT,
  site_text    TEXT,
  added_on     TEXT NOT NULL,
  note         TEXT,
  UNIQUE (profile_id, source, source_id)
);

-- ---------------------------------------------------------------------------
-- 版本链防改写：分期 / 可切除性（更正只新增行）
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_stage_no_update
BEFORE UPDATE ON stage_assertion
WHEN OLD.is_current = 0
BEGIN
  SELECT RAISE(ABORT, 'stage_assertion: 历史版本不可修改，请新增一行');
END;

CREATE TRIGGER trg_resect_no_update
BEFORE UPDATE ON resectability_assertion
WHEN OLD.is_current = 0
BEGIN
  SELECT RAISE(ABORT, 'resectability_assertion: 历史版本不可修改，请新增一行');
END;

-- 看法不可被改成结论
CREATE TRIGGER trg_viewpoint_no_conclusion
BEFORE UPDATE ON viewpoint
WHEN NEW.is_conclusion <> 0
BEGIN
  SELECT RAISE(ABORT, 'viewpoint: 看法不得标记为结论');
END;

-- ---------------------------------------------------------------------------
-- 基础字典（只放指标定义，不放临床建议）
-- ---------------------------------------------------------------------------
INSERT INTO metric_def (id, label_zh, unit, kind, track, decimals) VALUES
  ('albumin',      '白蛋白',        'g/L',    'numeric', 'liver',     1),
  ('bilirubin',    '总胆红素',      'μmol/L', 'numeric', 'liver',     1),
  ('inr',          'INR',           '',       'numeric', 'liver',     2),
  ('platelets',    '血小板',        '10⁹/L',  'numeric', 'liver',     0),
  ('alt',          'ALT',           'U/L',    'numeric', 'liver',     0),
  ('ast',          'AST',           'U/L',    'numeric', 'liver',     0),
  ('afp',          'AFP',           'ng/mL',  'numeric', 'tumor',     1),
  ('pivka2',       'PIVKA-II',      'mAU/mL', 'numeric', 'tumor',     1),
  ('max_diameter', '最大结节径',    'mm',     'numeric', 'tumor',     0),
  ('weight',       '体重',          'kg',     'numeric', 'nutrition', 1),
  ('child_pugh',   'Child-Pugh 分级','',      'grade',   'liver',     NULL),
  ('li_rads',      'LI-RADS',       '',       'grade',   'tumor',     NULL),
  ('vp',           '门静脉癌栓',    '',       'grade',   'tumor',     NULL);

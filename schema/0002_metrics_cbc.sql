-- 0002 · 指标字典扩项（2026-10-23）
--
-- 背景：v0.2 补齐「指标分析」功能线（对比乳腺癌「指标检测」），需要把血常规与肌少症
-- 相关指标纳入 metric_def，才能把值写进 metric_reading 而不是散在业务表里。
--
-- 纪律（沿用 freeze-contract.md）：
--   1. 只增不改：本迁移只 INSERT metric_def 行，不动 0001 的任何表结构、CHECK 与触发器；
--   2. 分类变量仍只存原值（kind='grade'），不做数值趋势；
--   3. 缺测一律 NULL，读写层用 is_missing=1 表达「未检测」，不用 0 顶替。
--
-- 为什么 wbc/anc/hgb 放在 track='safety' 而不是 'liver'：
--   它们是治疗相关不良事件的血象基础（CTCAE v5.0 血液学四项），与肝功能储备(A 轨)
--   不是同一件事。混在 liver 轨会让「白蛋白 35 + 中性粒 1.2」看起来像同一个恶化的信号。
--
-- 为什么 calf/grip 放在 'nutrition'：
--   肌少症线索是「体重 + 小腿围 + 握力」三件并列，缺一项不生成合计、不比大小。

INSERT INTO metric_def (id, label_zh, unit, kind, track, decimals) VALUES
  ('wbc',      '白细胞',           '10⁹/L', 'numeric', 'safety',    1),
  ('anc',      '中性粒细胞绝对值', '10⁹/L', 'numeric', 'safety',    1),
  ('hgb',      '血红蛋白',         'g/L',   'numeric', 'safety',    0),
  ('calf',     '小腿围',           'cm',    'numeric', 'nutrition', 1),
  ('grip',     '握力',             'kg',    'numeric', 'nutrition', 1);

-- 心理私密性（补乳腺癌心理线的关键约束：私密内容默认不进一图秀、摘要、导出）。
-- 只加列，不改 0001 的 CHECK 与触发器。默认 'shared'，心理页写入时显式给 'private'。
-- 为什么不用 viewpoint 的 source 兼任：source 回答「这话是谁说的」（患者/照护者/医生摘要），
-- visibility 回答「能不能被带走」。两件事正交，混在一列会出现"照护者说的就一定私密"的错误绑定。
ALTER TABLE viewpoint ADD COLUMN visibility TEXT NOT NULL DEFAULT 'shared'
  CHECK (visibility IN ('shared', 'private'));
CREATE INDEX ix_viewpoint_visibility ON viewpoint(profile_id, visibility);

-- CTCAE 覆盖说明：本迁移只加字典，不加阈值。阈值留在读模型（见 docs/METRIC-GRADING-LIVER.md），
-- 因为「用哪张化验单的参考上限」是运行时信息，不是 schema 能表达的。

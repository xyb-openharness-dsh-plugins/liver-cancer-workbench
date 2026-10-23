# SCHEMA-SPEC · 实体与写入语义

日期：2026-10-22（**2026-10-24 G3 签认，本文件所描述模型即定稿版本 v0.3.0**）。权威文件：`schema/0001_initial.sql`（冻结后 sha256 见 `schema/freeze-contract.md`）。
本文件说明「为什么这样建」与「怎么写」，不重复建表语句。

## 1. 实体分组

| 组 | 表 | 归属 |
| --- | --- | --- |
| 工作区 | `workspace` | 单行，资料目录与解析同意 |
| 档案 | `profile` | 患者/演示档案 |
| A 轨 | `liver_background`、`liver_reserve`、`portal_hypertension`、`hbv_record`、`family_screening` | 肝背景、储备、门脉高压、HBV、家庭 |
| B 轨 | `tumor_assessment`、`tumor_lesion`、`stage_assertion`、`resectability_assertion` | 负荷、分期、可切除性 |
| 治疗 | `treatment_event` | 局部/系统/手术/移植评估 |
| 安全 | `safety_event` | 8 类 HCC 事件 |
| 生活 | `nutrition_record`、`symptom_record`、`viewpoint` | 营养、症状、看法 |
| 事实四层 | `document`、`candidate`、`metric_def`、`metric_reading` | 严格分层 |
| 复诊 | `visit`、`question`、`task`、`trial_ref` | 沟通与线索 |

共 24 张表。

## 2. 四契约的落地方式

| 契约 | 在本 schema 里的实现 |
| --- | --- |
| ① 看法恒不为结论 | `viewpoint.is_conclusion` CHECK 恒 0 + 触发器 `trg_viewpoint_no_conclusion`；看法不进 `metric_reading`，不进趋势 |
| ② 缺项不生成差值/评分（NULL ≠ 0） | `liver_reserve` 各成分独立列，可空；`result_state` 区分「未检测/部分/已报告」；ALBI 不落库，读模型缺项返回 NULL |
| ③ 更正只新增版本 | `stage_assertion` / `resectability_assertion` 带 `supersedes_id` + `is_current`，触发器禁止修改 `is_current=0` 的历史行 |
| ④ 事实四层不合并 | `document` / `candidate` / 记录表 / `metric_*` 各自独立；`candidate.status` 默认为 `pending`，接受 ≠ 审核（审核字段保持空） |

## 3. 派生字段（不落库）

| 派生 | 公式 | 缺项行为 |
| --- | --- | --- |
| ALBI | 0.66 × log10(胆红素 μmol/L) − 0.085 × 白蛋白 g/L | 任一成分 NULL → 返回 NULL，不出分 |
| ALBI 分级 | ≤ −2.60 = 1 级；≤ −1.39 = 2 级；> −1.39 = 3 级 | 同上 |

理由：派生值落库会与医生记录形成两个真相，且患者可能看到「数值变了但医生说没变」。

## 4. 写入语义

- 所有 INSERT 写显式列名 + 显式问号数。
- 复合主键表（`tumor_lesion`）读取必须 `ORDER BY rowid`。
- `using` 是 SQLite 保留字 → 列名为 `in_use`（本 schema 未用到但保留规则）。
- 日期统一 `YYYY-MM-DD`（TEXT），事件日期不得晚于当天；计划类（`task.due_on`、`visit.next_on`）允许未来。
- 单位固定：g/L、μmol/L、10⁹/L、mm、ng/mL、mAU/mL、kg、cm。
- 分类字段枚举化：`li_rads`、`portal_vein_thrombus`、`varices_grade`、`ascites_grade`、`encephalopathy_grade`、`child_pugh_class`。

## 5. 读模型（M5 才实现，此处定契约）

- `getDashboard(profileId)` → `{ reserveLast, tumorLast, stageCurrent, resectabilityCurrent, metrics[], safetyRecent[], tasks[] }`
- 指标卡：`metrics[]` 每项 `{ id, label, value, unit, sub, series[], kind }`；`kind !== 'numeric'` 时不给 `series`。
- 双轨图：`{ xDates[], albumin: number[], afp: number[], childPugh: string[] }`；AFP 用 log10 缩放，单点不连线。
- 读模型必须与 `demo/build-demo-data.mjs` 的输出形状一致（parity 是这一层唯一验收标准）。

## 6. 变化矩阵

| 变化 | 处理 |
| --- | --- |
| 新增指标 | `metric_def` 加一行 + 新 `000N_*.sql`；不改 0001 |
| 新增事件类型 | `safety_event.kind` 枚举扩展走新迁移（CHECK 不能原地改） |
| 分期体系新增 | `stage_assertion.system` 枚举扩展走新迁移 |
| 影像结构化加深 | 新增 `tumor_lesion` 列或独立表，不动旧列 |
| 旧库 | 迁移幂等；`PRAGMA user_version` 递增 |

## 7. 未决（等 G3 签认后再定）

- 是否需要 `parse_job` / `extraction_run` 表（MinerU 任务历史，建议 M5 用 `0003_import.sql` 加；`0002` 已被指标扩项占用）。
- `treatment_event` 是否需要逐周期明细表（当前只有 `cycles_done`）。
- 移植后长期字段是否并入 `liver_background`。

## 8. 迁移 0002 · 指标扩项与私密标记（2026-10-23）

文件：`schema/0002_metrics_cbc.sql`。**只增不改**：本次未动 0001 任何结构（0001 的 sha256 在 2026-10-24 因品牌改名注释更新为 `3051629e…`，见 `schema/freeze-contract.md`）。

| 动作 | 内容 | 为什么 |
| --- | --- | --- |
| 新增 `metric_def` 行 | `wbc` / `anc` / `hgb`（track=`safety`）、`calf` / `grip`（track=`nutrition`） | 指标分析页需要血常规与肌少症指标走 `metric_reading`，而不是散进业务表 |
| 新增列 | `viewpoint.visibility`（`shared` / `private`，默认 `shared`）+ 索引 | 心理私密内容默认不进一图秀 / 摘要 / 导出 |

**两个刻意的取舍：**

1. 血常规放 `track='safety'` 而非 `'liver'`：它是治疗相关不良事件的基础（CTCAE 血液学四项），
   与肝功能储备不是同一件事。混在 liver 轨会让「白蛋白 35 + 中性粒 1.2」看起来像同一个恶化信号。
2. `visibility` 不合并进 `viewpoint.source`：`source` 回答「这话是谁说的」，`visibility` 回答
   「能不能被带走」。两件事正交；合并会出现「照护者说的就一定私密」这种错误绑定。

**没有跟着加的**：CTCAE 阈值不进 schema。阈值是读模型的纯函数（`ctcaeGrade()`），因为
「用哪张化验单的参考上限」是运行时信息，schema 表达不了；写死在表里必然要用通用上限凑倍数。

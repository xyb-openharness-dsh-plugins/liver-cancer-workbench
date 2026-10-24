# 冻结合同 · schema/0001_initial.sql + 0002_metrics_cbc.sql + 0003_import_gate.sql + 0004_candidate_source.sql + 0005_parse_job.sql

- 初冻日期：2026-10-22
- 重新冻结日期：2026-10-24（**仅注释改动**：品牌名「小肝宝」→「小甘宝」，无表、列、CHECK、触发器、索引变更）
- 追加迁移：2026-10-24（`0003_import_gate.sql`，只增一列 + 一索引，0001/0002 哈希不变）
- 追加迁移：2026-10-24（`0004_candidate_source.sql`，只增两列，前三份哈希不变）
- 追加迁移：2026-10-24（`0005_parse_job.sql`，只增一张 `parse_job` 表 + 一索引，前四份哈希不变）
- 状态：**G3 已签认（2026-10-24）**，见 `docs/GATE-RECORDS.md` G3 条目

| 文件 | sha256 | 内容 |
| --- | --- | --- |
| `schema/0001_initial.sql` | `3051629ec9d3fff73df3ac796b87eb6da543a18d22d02843053e26164cf6bac9` | 24 张业务表、3 个触发器、初始 `metric_def` |
| `schema/0002_metrics_cbc.sql` | `dd13be40bc0275452e4d7ad68d9caf103eb4333bb758847dc9a1272dbff2c88b` | 只增不改：补 wbc / anc / hgb / calf / grip 指标，加 `viewpoint.visibility` |
| `schema/0003_import_gate.sql` | `eb51c0d8111741b6d40734e4adf474badef274d50b997b60df23838ed534cddb` | 只增不改：`document.parse_note` + `idx_document_profile_uploaded` |
| `schema/0004_candidate_source.sql` | `d6752af22e22d6d495be2e070faa2c59355907b7007857048f1810a90fb14d29` | 只增不改：`candidate.source_line` + `candidate.note` |
| `schema/0005_parse_job.sql` | `28bfe9ed23b475aeb956b2524926d7ed3dc95a5f30dfba7cbafab56c14c9703b` | 只增不改：`parse_job`（每次解析一行：引擎/模型/状态/错误码/页数/候选数/耗时） |

## 0005 为什么是一张新表（不是给 document 加字段）

解析这件事是**一次一次发生的**，不是文档的属性。同一份材料可能今天没 Token 失败一次、
明天配好 Key 成功一次、后天又因为换了模型重跑一次。塞进 `document` 就只能留最后一次，
用户问"我明明试过三次，为什么只说失败"时没有答案。

`parse_job` 只写一条条尝试记录（`engine` 本机/云端、`model`、`status` 成功/失败、
`error_code` + `error_message`、`pages`、`candidate_count`、`elapsed_ms`），
**不参与任何计算**，也不是"解析中"这种僵尸状态——解析中不落库，只有跑完了才写。

## 0004 为什么要加两列（不是功能膨胀）

候选要人一条条确认，可确认界面上只有「白蛋白 38」这一个数字的话，用户没有可对照的东西——
他没法判断 38 是抽对了还是抽错了，只能盲点。`source_line` 存抽出这一条时命中的原文行
（如 `白蛋白 38 g/L`），界面上贴着数字显示；`note` 存抽取阶段的提示（如超范围降置信度时的说明）。

这两列只做「让人能核对」，不参与任何计算，也不进趋势。

## 0003 为什么要加一列（不是功能膨胀）

导入闸门会把胰腺、肺、胃等域外材料判成拒收。原来 `document.status` 只有 `parse_failed` 一个值，
用户看到「解析失败」分不清两件完全不同的事：

- 文件坏了 → 重拍、重传；
- 这不是肝的报告 → 别传了，或者传对了再来。

`parse_note` 存 `[阶段] 理由原文`（如 `[gate] 部位是胰腺（3 分：胰腺），不属于肝细胞癌工作台`），
让这两种情况在界面上可区分。同时把 `needs_review` 的落点改为 `pending_parse`（文件没坏，只是判不了），
`parse_failed` 留给真正的域外与读不了的文件。

历史哈希：0001 的初冻值为 `2000104d8eb6ed9655ea793e8011fa43075155496a6a87a33cf9757fa1468176`（2026-10-22）。
该值已作废，原因只有第一行注释里的品牌名；`_migration` 表内的 sha256 随之更新，演示库已按新文件重建。

## 边界（什么算改动，什么不算）

| 动作 | 是否允许 | 做法 |
| --- | --- | --- |
| 追加新表 / 新列 | 允许 | 新增 `0003_*.sql` 起，只增不改 |
| 修改 0001 的 CHECK 枚举 | 禁止 | 新表 + 视图，或新增迁移重列 || 修改 0001 的触发器 | 禁止 | 追加新触发器 |
| 新增索引 | 允许 | 新迁移 |
| 调整注释 | 允许（不改语义） | 但 sha256 会变，需重新冻结并在此记录原因 |
| 演示数据写入 | 允许 | 数据不是结构 |

## 内容边界（本文件声明过的关键约定）

1. 本文件执行后冻结，改结构只能新增 `0006_*.sql`（`0002`–`0005` 已占用）。
2. 缺测一律 NULL，不用 0 / '' 顶替；「未检测」由 `result_state` 表达。
3. 分类变量（Child-Pugh、LI-RADS、Vp、CTCAE）只存原值，不做数值趋势。
4. 医生结论（分期、可切除性）只新增版本，不覆盖旧值。
5. 事实四层不合并：`document` / `candidate` / 记录表 / `metric_*`。
6. 看法恒不为结论：`viewpoint.is_conclusion` 恒 0。
7. 复合主键表读取必须 `ORDER BY rowid`。
8. ALBI 不落库，由读模型派生，缺项不出分。
9. `candidate` 不等于指标：只有人确认后才写 `metric_reading`，且必须能回溯 `source_doc_id`。

## 校验方式

```
npm run check:schema                                                # 与上表逐条比 sha256，并核对演示库 _migration
NODE_OPTIONS= npm run build:demo                                    # 重建演示库并登记 _migration
```

最近一次复核（2026-10-24，含 0005）：业务表 **25** 张（含 `_migration` 共 26）、列 **266**（不含 `_migration` 的 3 列）、触发器 **3**、索引 **21**、
`PRAGMA foreign_key_check` **0 条**、`_migration` 登记五条，`scripts/check-schema.mjs` 校验 sha256 全等。

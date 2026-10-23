# 冻结合同 · schema/0001_initial.sql + 0002_metrics_cbc.sql

- 初冻日期：2026-10-22
- 重新冻结日期：2026-10-24（**仅注释改动**：品牌名「小肝宝」→「小甘宝」，无表、列、CHECK、触发器、索引变更）
- 状态：**G3 已签认（2026-10-24）**，见 `docs/GATE-RECORDS.md` G3 条目

| 文件 | sha256 | 内容 |
| --- | --- | --- |
| `schema/0001_initial.sql` | `3051629ec9d3fff73df3ac796b87eb6da543a18d22d02843053e26164cf6bac9` | 24 张业务表、3 个触发器、初始 `metric_def` |
| `schema/0002_metrics_cbc.sql` | `dd13be40bc0275452e4d7ad68d9caf103eb4333bb758847dc9a1272dbff2c88b` | 只增不改：补 wbc / anc / hgb / calf / grip 指标，加 `viewpoint.visibility` |

历史哈希：0001 的初冻值为 `2000104d8eb6ed9655ea793e8011fa43075155496a6a87a33cf9757fa1468176`（2026-10-22）。
该值已作废，原因只有第一行注释里的品牌名；`_migration` 表内的 sha256 随之更新，演示库已按新文件重建。

## 边界（什么算改动，什么不算）

| 动作 | 是否允许 | 做法 |
| --- | --- | --- |
| 追加新表 / 新列 | 允许 | 新增 `0003_*.sql` 起，只增不改 |
| 修改 0001 的 CHECK 枚举 | 禁止 | 新表 + 视图，或新增迁移重列 |
| 修改 0001 的触发器 | 禁止 | 追加新触发器 |
| 新增索引 | 允许 | 新迁移 |
| 调整注释 | 允许（不改语义） | 但 sha256 会变，需重新冻结并在此记录原因 |
| 演示数据写入 | 允许 | 数据不是结构 |

## 内容边界（本文件声明过的关键约定）

1. 本文件执行后冻结，改结构只能新增 `0003_*.sql`（`0002` 已占用）。
2. 缺测一律 NULL，不用 0 / '' 顶替；「未检测」由 `result_state` 表达。
3. 分类变量（Child-Pugh、LI-RADS、Vp、CTCAE）只存原值，不做数值趋势。
4. 医生结论（分期、可切除性）只新增版本，不覆盖旧值。
5. 事实四层不合并：`document` / `candidate` / 记录表 / `metric_*`。
6. 看法恒不为结论：`viewpoint.is_conclusion` 恒 0。
7. 复合主键表读取必须 `ORDER BY rowid`。
8. ALBI 不落库，由读模型派生，缺项不出分。

## 校验方式

```
shasum -a 256 schema/0001_initial.sql schema/0002_metrics_cbc.sql   # 应与上表一致
NODE_OPTIONS= npm run build:demo                                    # 重建演示库并登记 _migration
```

最近一次复核（2026-10-24）：业务表 **24** 张（含 `_migration` 共 25）、列 **254**、触发器 **3**、索引 **19**、
`PRAGMA foreign_key_check` **0 条**、`_migration` 登记两条且 sha256 与上表前 12 位一致。

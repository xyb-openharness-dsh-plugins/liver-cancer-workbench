# DEV-PLAN · 里程碑（唯一权威）

- 首次：2026-10-22 ｜ **本次更新：2026-10-24（v0.3.2 后重算）**
- 闸口顺序不可跳：**G1 业务流程 → G2 HTML 交互 demo → G3 数据模型**。通过必须留痕（确认人 / 原话要点 / 日期 / 产物版本），截图与脚本检查不算签认。

> 一句话：**M1–M4 全部完成且三闸口已签认，整体 81%；卡在 M5 的两个尾巴（前端路径偏差、scripts 缺三项检查）和 M6 的 UI parity，M7 未开始。**

## 进度总表

| 里程碑 | 内容 | 完成度 | 计分（项） | 状态 | 闸口 |
| --- | --- | --- | --- | --- | --- |
| M0 工程底座 | starter init、文档体系、prompts、`npm run check` 基线 | 100% | 3/3 | ✅ 完成 | — |
| M1 调研与场景 | SPEC / SCENARIOS / PATIENT-FLOW / DIFF-MATRIX / HCC-DOMAIN / 功能线框架 | 100% | 6/6 | ✅ 完成 | **G1 已签认**（2026-10-24） |
| M2 原型（demo） | 原型四件套 + 演示数据 + 3D 卡片 + 自适应 + 无头实测 | 100% | 6/6 | ✅ 完成 | **G2 已签认**（v0.2.1） |
| M3 数据模型 | `0001/0002/0003` + freeze-contract + SCHEMA-SPEC + 四项复核 | 100% | 5/5 | ✅ 完成 | **G3 已签认**（2026-10-24） |
| M4 临床库 | `research/hcc-cancer/` 34 条 2026 试验，逐来源终态 | 100% | 3/3 | ✅ 完成 | 与 G2 交叉验证 |
| M5 开发版 | 六步移植 + 导入链路 + MinerU + 设置 | **70%** | 5.5/8 | 🟡 进行中 | 已解锁（G2+G3 均过） |
| M6 自测 | check / 单测 / 生产版实跑 / UI parity / 三项脚本 | **70%** | 5/7 | 🟡 进行中 | — |
| M7 装机与市场 | tgz、Desktop 实测、市场投稿、落地页 | **25%** | 1/4 | ⬜ 未开始 | 装机只认目标 Desktop 实测 |

**整体：31.5 / 39 项 = 81%**

### 计分口径（避免进度条变成形容词）

- 一个里程碑 = 一张交付项清单，**完成度 = 已完成项 / 总项数**，不接受"差不多做完了"。
- **半分只用于一种情况**：做了但有明确缺口（例：前端九视图都通，但文件路径与六步要求不一致）。
- **闸口不因进度高而通过**：M5 到 70% 也不能替 G3 说话，反过来 G3 签认也不会自动把 M5 变成完成。
- 未开始就写 0，不写"初期"。

## 闸口留痕

| 闸口 | 结论 | 日期 | 依据 |
| --- | --- | --- | --- |
| G1 业务流程 | 已签认 | 2026-10-24 | `docs/GATE-RECORDS.md` G1 条目（9 一级 / 27 二级功能线） |
| G2 HTML 交互 demo | 已签认 | 2026-10-24 | v0.2.1 三档字号 + 3D 翻卡，用户原话「perfect……html确认ok，进行后续开发」 |
| G3 数据模型 | 已签认 | 2026-10-24 | 四项复核：24 表 / 255 列 / 3 触发器 / 20 索引 / 外键违规 0 |

## M5 开发版：六步 + 两项

| # | 交付项 | 状态 | 证据 |
| --- | --- | --- | --- |
| 1 | 库与服务入口 | ✅ | `dsh/db.js`（迁移只增不改 + 冻结合同）、`dsh/index.js`、`dsh/guard.js` |
| 2 | 演示播种 | ✅ | `demo/build-demo-data.mjs`（唯一来源，按目录遍历迁移） |
| 3 | 读模型 | ✅ | `dsh/read-model.js` 321 行，7 块 section + 5 个指标函数；ALBI 派生不落库 |
| 4 | 前端 | 🟡 半分 | `lib/client.js` 718 行，九视图 + 18 张 3D 卡全通；**偏差**：走 React 组件而非六步要求的 `public/app.js` |
| 5 | 导入链路 | ✅ | `import/` 五模块 + `scripts/import-doc.mjs` + 2 条只读路由（计划外新增） |
| 6 | `scripts/check-*` | 🟡 半分 | 仅 `check-workbench-package` / `check-install`；**缺** `check-schema` / `check-wording` / `check-version` |
| 7 | 单测 | 🟡 半分 | 75 条全绿（basic / api / read-model / import / store）；**缺** ui-parity |
| 8 | MinerU 解析 + 设置页 | ⬜ | 按 starter `docs/18-MINERU-PARSING.md` v2；`docs/SETTINGS-DESIGN.md` 只有设计 |

## M6 自测

| # | 项 | 状态 | 证据 |
| --- | --- | --- | --- |
| 1 | `npm run check` | ✅ | `staticPass: true`、`errors: []` |
| 2 | `npm test` | ✅ | 75/75，含域外拒收、近似词不误匹配、同日同指标拒绝重复 |
| 3 | 生产版无头实跑 | ✅ | 看板 6 卡 / 指标分析 18 卡 / 640px 退一列 / 翻面 `matrix3d` / 私密 5→8 / `errs: []` |
| 4 | 三档字号与溢出断言 | ✅ | `--tz` 三档 + `body.scrollWidth` 判溢出 |
| 5 | IM01–IM14 导入验收 | ✅ | 已全部写成 `test/import.test.mjs` + `test/store.test.mjs` |
| 6 | UI parity 对照 | ⬜ | `docs/PARITY.csv` **仍是模板示例行**，一条真实对照都没填 |
| 7 | 三项脚本（schema / wording / version） | ⬜ | 与 M5 第 6 项同一欠账 |

## M7 装机与市场

| # | 项 | 状态 | 证据 |
| --- | --- | --- | --- |
| 1 | 打包清单 | ✅ | `npm pack --dry-run` 35 文件；`files` 已补 `schema` / `import` / `demo` |
| 2 | Desktop 装机实测 | ⬜ | 装修目录 = `~/Library/Application Support/dsh-desktop/harness/profiles/web` |
| 3 | 市场投稿 | ⬜ | — |
| 4 | 落地页 / 官网 | ⬜ | — |

## 依赖关系

```
M0 ──► M1 ──► G1✅ ──► M2 ──► G2✅ ──┐
        └────► M3 ──► G3✅ ──────────┴──► M5(70%) ──► M6(70%) ──► M7(25%)
M4 ✅（临床库，与 M2 并行，已交叉验证）
```

M4 不阻塞 M2，但 M2 的「试验线索」页引用 M4 的字段结构。

## 仍未做（不许在验收里算通过）

- `0004` 迁移：`candidate.source_line`（确认界面必须能看原文，否则只有数字没有依据）
- 前端第 10 个视图「导入」：队列 + 候选逐条确认/退回
- `scripts/check-schema` / `check-wording` / `check-version`；`docs/PARITY.csv` 真实对照
- MinerU 云解析链路、设置页实现
- dsh-desktop 装机实测、市场投稿、落地页
- 真实患者访谈（招募 👤 与 🩺 补位中）

## 下一步（按顺序）

1. `0004` + 导入视图 —— 把 M5 第 4/7 项的半分补成满分，导入功能才算对用户可用。
2. 三项 check 脚本 + 填 `PARITY.csv` —— 把 M6 从 70% 推到 100%，装机前必须闭环。
3. `npm pack` → Desktop 装机 → 目标机实测（M7 从 25% 起步）。

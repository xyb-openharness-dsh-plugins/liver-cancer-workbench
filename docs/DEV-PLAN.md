# DEV-PLAN · 里程碑（唯一权威）

日期：2026-10-22。闸口顺序不可跳：**G1 业务流程 → G2 HTML 交互 demo → G3 数据模型**。通过后必须留痕（确认人 / 原话要点 / 日期 / 产物版本），截图与脚本检查不算签认。

| 里程碑 | 内容 | 状态 | 闸口 |
| --- | --- | --- | --- |
| M0 工程底座 | starter init、文档体系、prompts、`npm run check` 基线 | ✅ 完成（基线 pass） | — |
| M1 调研与场景 | SPEC / SCENARIOS / PATIENT-FLOW / DIFF-MATRIX / HCC-DOMAIN | 🟡 完成初稿 | **G1 未签认** |
| M2 原型（demo） | `prototypes/v0.1/` 四件套 + 演示数据 + 无头实测 | 🟡 完成初稿 | **G2 未签认** |
| M3 数据模型 | `schema/0001_initial.sql` + freeze-contract + SCHEMA-SPEC | 🟡 已冻结待签 | **G3 未签认** |
| M4 临床库 | `research/hcc-cancer/`（34 条，逐来源终态） | ✅ 完成 | 与 G2 同期交叉验证 |
| M5 开发版 | `dsh/{store,server,workbench,readmodels,demo,import,mineru,settings,parse}.js`、`public/`、`scripts/check-*` | ⬜ 未开始 | G2+G3 通过后 |
| M6 自测 | `npm run check`、UI parity、无头实测数字 | ⬜ 未开始 | — |
| M7 装机与市场 | tgz、`NODE_OPTIONS= npx pnpm@10.15.0 add -w …`、市场投稿 | ⬜ 未开始 | 装机实测只在目标 Desktop 上判 |

## 依赖关系

```
M0 ──► M1 ──► G1 ──► M2 ──► G2 ──┐
        └────► M3 ──► G3 ────────┴──► M5 ──► M6 ──► M7
M4（临床库，可与 M2 并行）
```

M4 不阻塞 M2，但 M2 的「试验线索」页要引用 M4 的字段结构。

## 本轮未做（不许在验收里算通过）

- 生产业务实现（读模型 / API / 导入）。
- MinerU 云解析链路（按 starter `docs/18-MINERU-PARSING.md` v2 实施，M5）。
- dsh-desktop 装机实测。
- Git 仓库初始化与推送、市场投稿。
- 真实患者访谈（招募 👤 与 🩺 补位中）。

## 下一步（按顺序）

1. 交 G1/G2/G3 确认：demo 打开方式、7 页截图、DIFF-MATRIX 摘要、临床库覆盖与缺口、未做清单。
2. 用户签认后建 Git 仓库并推（private，组织 `xyb-openharness-dsh-plugins`）。
3. M5 六步移植：store → demo → readmodels → public → scripts/check → test。

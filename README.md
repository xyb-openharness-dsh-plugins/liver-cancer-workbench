# 肝细胞癌患者工作台 · 小甘宝 HepPal

面向肝细胞癌（HCC）患者与照护者的本机优先工作台：肝功能储备与肿瘤负荷双轨记录、转化治疗评估、门脉高压与肝相关安全性、HBV 家庭防护

这是接入骨架，尚未实现真实业务。初始化后先将 [项目设计提示词](docs/DESIGN-PROMPT.md) 交给当前Agent；它应展示实际路径并以已有用户/场景/流程素材对齐设计者、研究与取舍原则。癌种项目另有 [完整专用提示词](prompts/NEW-CANCER-WORKBENCH.md)。需求见 [BRIEF](docs/BRIEF.md)，规格见 [SPEC](docs/SPEC.md)，任务见 [TASKS](docs/TASKS.md)；先读 [AGENTS](AGENTS.md)。CLI输出交接与首问，实际对话由Agent接续。

## 开发顺序

先共创SPEC和候选数据关系，再交付HTML交互工作台；由用户确认对应版本/模块后，复核SCHEMA/API并实现生产功能。确认记录见docs/PROTOTYPE-REVIEW.md；模型不依赖前端Tab/流程。模板骨架不是业务已确认。

## 项目当前状态（2026-10-24 · v0.3.4）

阶段：**M0–M4 完成，G1 / G2 / G3 均已签认**；M5 开发版 81%（十视图 + 导入在界面里闭环，缺 MinerU 与设置页）、
M6 自测 93%（83 条单测 + 三项 check 脚本 + 12 行真实 UI parity + 真 Chrome 冒烟）、M7 装机与市场 50%（打包与装机实测已做，缺投稿与落地页）。
整体 90%，逐项口径见 [DEV-PLAN](docs/DEV-PLAN.md)。**尚未投稿。**

| 交付物 | 位置 |
| --- | --- |
| 需求与场景 | `docs/SPEC.md`、`docs/SCENARIOS.md`（S1–S12）、`docs/PATIENT-FLOW.md`、`docs/DIFF-MATRIX.md`、`docs/HCC-DOMAIN.md` |
| 数据模型 | `schema/0001`–`0004`（24 表 / 257 列，只增不改）+ `schema/freeze-contract.md`（逐条 sha256）+ `docs/SCHEMA-SPEC.md` |
| HTML 原型 | `prototypes/v0.1/index.html`（`file://` 直接打开，无构建） |
| 生产版 | `dsh/`（库 / 10 条路由 / 读模型）+ `lib/client.js`（十视图）+ `import/`（导入五段） |
| 导入链路 | `docs/IMPORT-PIPELINE.md`、`scripts/import-doc.mjs`（命令行）、界面第 10 视图「导入与候选」；通用规则已回流脚手架 29 号文档 |
| 演示数据 | `demo/build-demo-data.mjs`（唯一来源）→ `demo/demo-data.sqlite`、`prototypes/v0.1/demo-data.js` |
| 2026 临床库 | `research/hcc-cancer/`（34 条，逐来源终态） |
| 自测 | `npm run check`（版本 / 冻结合同 / 文案红线三段）+ `npm test` 83 条 + `scripts/probe-prod-ui.mjs`（真 Chrome 冒烟）+ `docs/PARITY.csv`（12 行原型↔生产对照） |
| 里程碑 | `docs/DEV-PLAN.md` |
| 任务认领 | 组织 `.github` issue #10 |

主脊是**双轨**：A 肝功能储备 / B 肿瘤负荷，两轨并列、永不加总；门脉高压是第三条独立风险线。一级导航 9 项、二级 27 项（v0.2.0 起；原为 7 项一级、无二级）。与家族其他癌种只有「复诊」语义重合；营养、心理两条线按 HCC 的实际问题重写，不是照抄乳腺癌。

## 当前能力

- 一个 DSH 工作台注册、认证的健康接口、版本展示与标准/大字切换。
- 已明确选择布局：business-first。business-first 使用 customFrame；模板不创建会话或复制聊天。需要 AI 协助时按官方合同接入原生 conversation 和会话管理。
- 无业务数据库、无演示患者、无真实密钥；所有业务页按确认 spec 逐项实现。原型用的是合成演示数据。

## 本地命令

```bash
npm run check          # 包级静态 + 版本一致 + 冻结合同 sha256 + 文案红线
npm run test           # 83 条：schema / 读模型 / 路由 / 导入五段 / 落库
node scripts/probe-prod-ui.mjs   # 真 Chrome 跑生产版界面（需本机 Chrome）
npm run build:demo     # 重建演示数据与 prototypes/v0.1/demo-data.js
npm run fetch:trials   # 2026 临床试验采集（--dry-run 看口径）
```

## 开发与本地验收

需要 Node.js 22+、Git、包管理器和可用 DSH Desktop；采用 SQLite 时另核验 node:sqlite 版本条件。宿主 peers 的范围仅是模板基线，请与目标 Desktop 实际依赖核对。

```bash
npm install
npm run check
npm run pack:check
npm pack
```

`npm install` 可能按 npm 策略解析 peer；勿为消警告重复打包宿主 runtime。客户端本身是单文件；引入 TS/组件库后需添加构建步骤并保留单文件导出。

本地安装入口以当前 Desktop/CLI 帮助为准。安装后按 [docs/06-VALIDATION-AND-RELEASE.md](docs/06-VALIDATION-AND-RELEASE.md) 与官方自测完成真实 UI 验收，并填写 [docs/ACCEPTANCE.md](docs/ACCEPTANCE.md)。静态检查不代表已加载。

Logo 来源与使用限制见 assets/README.md。许可证、作者、仓库/发布策略由本项目维护者确认后填写；模板默认为 private/UNLICENSED。

感谢小x宝社区、DataElement 社区，以及 sam / hhx / 繁华的 ❤️ 贡献。

初始化来源记录见 `.dsh-wb-starter.json`。更新社区脚手架不会覆盖本项目；需要升级时先用相同确认配置在临时目录生成，再审阅差异。CLI 用法见 [docs/CLI-GIT.md](docs/CLI-GIT.md)。

## HTML先行与数据演进

业务开发前先交付HTML交互工作台原型、实际预览并由用户确认版本/hash和范围。数据设计先区分领域事实、流程状态和页面读模型，走查前端/流程变化、兼容与迁移；原型对象不直接作为表。见[规范](docs/14-HTML-AND-DATA-CONTRACT.md)。

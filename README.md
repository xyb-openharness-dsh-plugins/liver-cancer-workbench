# 肝细胞癌患者工作台 · 小甘宝 HepPal

面向肝细胞癌（HCC）患者与照护者的本机优先工作台：肝功能储备与肿瘤负荷双轨记录、转化治疗评估、门脉高压与肝相关安全性、HBV 家庭防护

这是接入骨架，尚未实现真实业务。初始化后先将 [项目设计提示词](docs/DESIGN-PROMPT.md) 交给当前Agent；它应展示实际路径并以已有用户/场景/流程素材对齐设计者、研究与取舍原则。癌种项目另有 [完整专用提示词](prompts/NEW-CANCER-WORKBENCH.md)。需求见 [BRIEF](docs/BRIEF.md)，规格见 [SPEC](docs/SPEC.md)，任务见 [TASKS](docs/TASKS.md)；先读 [AGENTS](AGENTS.md)。CLI输出交接与首问，实际对话由Agent接续。

## 疾病概要

> 四段固定：定义 → 医学资料规范和指南情况 → 目前治疗全景概要 → 发展趋势。整体属**解释层**（第 ② 层）：
> 只整理公开信息，不判断你的病情。用看板右上角的「?」看同一份内容的整页版。
> 原件状态照实写：**《原发性肝癌诊疗指南（2022/2024 年版）》已取得官方 PDF 原件**（页码按 PDF 页脚实测）；
> BCLC / AJCC / NCCN / CSCO / WHO 未取得原件，逐行标出并给二次来源链接；查不到的写「版本未核实」，页码不明的写「页码待核」。

### 定义

肝细胞癌是起源于肝细胞的恶性肿瘤，属于原发性肝癌的一种。这个病有三条各自独立的线：肝功能储备、肿瘤负荷、门脉高压。这三条线并列记录，不相加、不互相换算——本台不把它们压成一个分数。

肝功能储备是第一条线：白蛋白、总胆红素、INR、腹水、肝性脑病构成 Child-Pugh 的五个成分，ALBI 用白蛋白与胆红素派生；Child-Pugh 评分与分级只存医生记录，本台不重算。肿瘤负荷是第二条线：结节数目、最大径、段位、血管侵犯（Vp0–Vp4）、肝外扩散，以及 AFP / PIVKA-II；血管侵犯记的是癌栓位置，不是肿瘤大小。门脉高压是第三条独立风险线：血小板、脾大、食管胃底静脉曲张、腹水各自记录。分期体系至少三套并存：BCLC（0 / A / B / C / D）、CNLC（Ⅰa / Ⅰb / Ⅱa / Ⅱb / Ⅲa / Ⅲb / Ⅳ）、AJCC/UICC TNM（只有切除后才完整）；三套不换算，本台只记录医生说的是哪一套。

**来源**：国家卫生健康委 · 原发性肝癌诊疗指南（2024 年版）·「三、肝癌的分期」（CNLC Ⅰa–Ⅳ，图 4）（2024 年版，国卫办医政函〔2024〕97 号）· [原件已取得 ↗](https://wsjkw.hebei.gov.cn/zcfg2/402819.jhtml) · 页码 P32 ｜ 国家卫生健康委 · 原发性肝癌诊疗指南（2022 年版）·「三、分期」（2022 年版，国卫办医函〔2022〕12 号）· [原件已取得 ↗](https://wsjkw.hebei.gov.cn/zcfg2/385518.jhtml) · 页码 P22 ｜ BCLC · BCLC 2022 update（Reig 等，J Hepatol 2022;76(3):681-693）（2022）· [未取得原件，据 BCLC 官网 ↗](https://www.bclc.cat/default.php?q=professional-area%2Fmanagement-of-hcc.html&locale=en) · 页码待核 ｜ AJCC / UICC · AJCC Cancer Staging Manual, 8th ed.（肝细胞癌章节）（第 8 版，2017）· [未取得原件，据 ACS/AJCC 官方页 ↗](https://www.facs.org/quality-programs/cancer-programs/american-joint-committee-on-cancer/cancer-staging-systems/cancer-staging-system-products/) · 页码待核

### 医学资料规范和指南情况

| 机构 | 文件 | 版本 / 年份 | 原件 | 本台的用途 |
|---|---|---|---|---|
| 国家卫生健康委 | 原发性肝癌诊疗指南（2024 年版） | 2024 年版（2024-03-21） | [已取得（官方 PDF，143 页；见转发页附件）↗](https://wsjkw.hebei.gov.cn/zcfg2/402819.jhtml) | 国内分期（CNLC）与治疗各论的出处；页码按 PDF 页脚 |
| 国家卫生健康委 | 原发性肝癌诊疗指南（2022 年版） | 2022 年版（2022-01-10） | [已取得（官方 PDF，124 页；见转发页附件）↗](https://wsjkw.hebei.gov.cn/zcfg2/385518.jhtml) | CNLC 2022 分期的原始出处；「三、分期」在 P22 |
| BCLC | BCLC 2022 update（J Hepatol 2022;76(3):681-693） | 2022 | [未取得原件，据 BCLC 官网 ↗](https://www.bclc.cat/default.php?q=professional-area%2Fmanagement-of-hcc.html&locale=en) | 记录医生写的 BCLC 期别（0 / A / B / C / D），不换算 |
| AJCC / UICC | AJCC Cancer Staging Manual, 8th ed.（肝细胞癌章节） | 第 8 版（2017） | [未取得原件，据 ACS/AJCC 官方页 ↗](https://www.facs.org/quality-programs/cancer-programs/american-joint-committee-on-cancer/cancer-staging-systems/cancer-staging-system-products/) | 记录 pTNM 原文；只有切除后才完整 |
| NCCN | NCCN Guidelines · Hepatobiliary Cancers | 以打开当日页面为准（2026-10-27 核对） | [未取得原件（需订阅），据指南页 ↗](https://www.nccn.org/guidelines/guidelines-detail?category=1&id=1438) | 仅作外部对照，不作为本台的分期或路径依据 |
| CSCO | CSCO 原发性肝癌诊疗指南 2024 | 2024（ISBN 978-7-117-36792-9） | [未取得原件，据人卫社书目页 ↗](https://www.pmphmall.com/gdsdetail/653497-332094) | 仅作外部对照 |
| WHO / IARC | WHO Classification of Tumours · Digestive System Tumours, 5th ed. | 第 5 版（2019） | [未取得原件，据 IARC 出版页 ↗](https://publications.iarc.who.int/Book-And-Report-Series/Who-Classification-Of-Tumours/Digestive-System-Tumours-2019) | 病理分类名称的出处 |

指南给的是「通常怎么做」，不是「你该怎么做」。拿到原件的写「已取得」并给官方 PDF，没拿到的逐行写「据 BCLC 官网 / PubMed 记录 / 书目页」，都给可点的二次来源。BCLC 与 CNLC 并存时不换算：两行并列，各自标出处，各自保留医生原话。

**来源**：见上表逐行 ｜ 本项目 · `docs/DISEASE-PRIMER.md`（原件状态与待核项台账，2026-10-27）· 本仓内部文件，无对外 URL

### 目前治疗全景概要

按可切除性与线序列出指南里出现过的手段类别。这是「世界上大致有哪些办法」的地图，不含剂量、疗程与适用条件。

- **局限期（可切除时）**：手术切除（记录术式、切缘、病理与残肝比例，切缘按报告原文记 R0/R1/R2）／消融（RFA / MWA，记次数与部位）／移植评估（只记评估结论与日期）。
- **不可切除 / 局部晚期**：TACE / HAIC（记次数、起止与栓塞后事件）／钇-90（TARE）与放疗（按方案原文记录）／系统治疗（靶向、免疫、联合各自记方案、周期、疗效原文与肝毒性）。
- **贯穿全程**：转化治疗（intent 记 conversion，每次可切除性评估新增一行，不合并成「已转化」）／抗病毒与再激活监测（HBV 背景者记药名、开始日期、DNA 由阴转阳日期）／肝功能与门脉高压随访（各指标各自成线，食管胃底静脉曲张与腹水单独记录）。

以上是文献与指南里列出的手段，按病期与线序排列，**不代表任何一项适合你**。选哪一个，这一句需要问你的医生。

**来源**：国家卫生健康委 · 原发性肝癌诊疗指南（2024 年版）· 治疗各论（一）～（五）（2024 年版）· [原件已取得 ↗](https://wsjkw.hebei.gov.cn/zcfg2/402819.jhtml) · 页码 P36 / P54 / P61 / P72 / P78 起 ｜ BCLC · BCLC 2022 update（2022）· [未取得原件，据 BCLC 官网 ↗](https://www.bclc.cat/default.php?q=professional-area%2Fmanagement-of-hcc.html&locale=en) · 页码待核

### 发展趋势

只写已经发生的事，每条带日期或版本号。不预测、不评价、不给倾向。

- 2017-06 原国家卫生计生委医政医管局颁布《原发性肝癌诊疗规范（2017 年版）》；2019-12、2021-12 两次更新，形成 2019 年版与《原发性肝癌诊疗指南（2022 年版）》；2024-03-21 国卫办医政函〔2024〕97 号印发 **2024 年版**（现行版本，已取得官方 PDF，143 页）。
- 2022 年 BCLC 发表 2022 版更新（Reig 等，J Hepatol 2022;76(3):681-693），为 BCLC 分期体系的现行版本记录。
- 2019 年 WHO 消化系统肿瘤分类第 5 版出版（IARC），取代第 4 版（2010）。
- 2024-09-10 CSCO《原发性肝癌诊疗指南 2024》出版（ISBN 978-7-117-36792-9）。
- 本台尚未完成临床试验登记平台的检索采集，暂无登记数量与阶段分布可报；补齐前不写任何数字。

**来源**：国家卫生健康委 · 原发性肝癌诊疗指南（2024 年版）· 一、概述（2024 年版）· [原件已取得 ↗](https://wsjkw.hebei.gov.cn/zcfg2/402819.jhtml) · 页码 P1–P2 ｜ BCLC · BCLC 2022 update（2022）· [未取得原件，据 BCLC 官网 ↗](https://www.bclc.cat/default.php?q=professional-area%2Fmanagement-of-hcc.html&locale=en) ｜ WHO / IARC · Digestive System Tumours, 5th ed.（2019）· [未取得原件，据 IARC 出版页 ↗](https://publications.iarc.who.int/Book-And-Report-Series/Who-Classification-Of-Tumours/Digestive-System-Tumours-2019) ｜ CSCO · CSCO 原发性肝癌诊疗指南 2024（2024）· [未取得原件，据人卫社书目页 ↗](https://www.pmphmall.com/gdsdetail/653497-332094) ｜ 本项目 · docs/HCC-DOMAIN.md（2026-10-22）· 本仓内部文件，无对外 URL

## 开发顺序

先共创SPEC和候选数据关系，再交付HTML交互工作台；由用户确认对应版本/模块后，复核SCHEMA/API并实现生产功能。确认记录见docs/PROTOTYPE-REVIEW.md；模型不依赖前端Tab/流程。模板骨架不是业务已确认。

## 项目当前状态（2026-10-27 · v0.3.10）

阶段：**M0–M6 完成，G1 / G2 / G3 均已签认**；M5 开发版 94%（十二视图 + 导入与解析在界面里闭环，唯一半分是"前端没走 `public/app.js`"的路径偏差）、
M6 自测 100%（111 条单测 + 三项 check 脚本 + 12 行真实 UI parity + 真 Chrome 冒烟 12 视图）、
M7 装机与市场 50%（打包与装机实测已做；**投稿与落地页按用户指令本轮不发布**）。
整体 94%，逐项口径见 [DEV-PLAN](docs/DEV-PLAN.md)。**尚未投稿。**

| 交付物 | 位置 |
| --- | --- |
| 需求与场景 | `docs/SPEC.md`、`docs/SCENARIOS.md`（S1–S12）、`docs/PATIENT-FLOW.md`、`docs/DIFF-MATRIX.md`、`docs/HCC-DOMAIN.md` |
| 数据模型 | `schema/0001`–`0005`（25 表 / 266 列，只增不改）+ `schema/freeze-contract.md`（逐条 sha256，5 条迁移全登记）+ `docs/SCHEMA-SPEC.md` |
| HTML 原型 | `prototypes/v0.1/index.html`（`file://` 直接打开，无构建） |
| 生产版 | `dsh/`（库 / 13 条路由 / 读模型 / MinerU 解析）+ `lib/client.js`（十二视图，含一图秀与设置）+ `import/`（导入五段） |
| 导入链路 | `docs/IMPORT-PIPELINE.md`、`scripts/import-doc.mjs`（命令行）、界面第 11 视图「导入与候选」；通用规则已回流脚手架 29 号文档 |
| 扫描件解析 | `dsh/mineru.js`（MinerU API v4）/ `dsh/hccparse.js`（markdown → 行）/ `dsh/settings.js`（Token 唯一实现）/ 界面第 12 视图「设置」；本机 TXT·MD·CSV 不上云 |
| 演示数据 | `demo/build-demo-data.mjs`（唯一来源）→ `demo/demo-data.sqlite`、`prototypes/v0.1/demo-data.js` |
| 2026 临床库 | `research/hcc-cancer/`（34 条，逐来源终态） |
| 自测 | `npm run check`（版本 / 冻结合同 / 文案红线三段）+ `npm test` 111 条 + `scripts/probe-prod-ui.mjs`（真 Chrome 冒烟，12 视图 / 解析三态 / 设置页 / 三档字号）+ `docs/PARITY.csv`（12 行原型↔生产对照） |
| 里程碑 | `docs/DEV-PLAN.md` |
| 任务认领 | 组织 `.github` issue #10 |

主脊是**双轨**：A 肝功能储备 / B 肿瘤负荷，两轨并列、永不加总；门脉高压是第三条独立风险线。一级导航 12 项、二级 27 项（v0.2.0 起为 9 项；v0.3.3 加「导入与候选」、v0.3.5 加「一图秀」、v0.3.6 加「设置」）。与家族其他癌种只有「复诊」语义重合；营养、心理两条线按 HCC 的实际问题重写，不是照抄乳腺癌。

## 当前能力

- 一个 DSH 工作台注册、认证的健康接口、版本展示与**标准 / 大字 / 特大**三档字号（`--tz` 1 / 1.15 / 1.32）。
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

# DEV-REQUIREMENTS · 2026-10-22

> 阶段 0 的交付物，不是可选项。每条约束都要能被某条命令或某张截图验证；写不出验证方式的，删掉。

## 一、范围（交付物 × 落点 × 怎么验）

| # | 交付物 | 落点 | 怎么验 |
| --- | --- | --- | --- |
| 1 | 项目骨架与文档体系 | `docs/` 七件套 + `prompts/` | `npm run check` 通过 |
| 2 | 业务 schema | `schema/0001_initial.sql` + `freeze-contract.md` | 建库成功，表数 24，`foreign_key_check` 空 |
| 3 | 演示数据单一来源 | `demo/build-demo-data.mjs` | 执行后产出 `demo/demo-data.sqlite` 与 `prototypes/v0.1/demo-data.js` |
| 4 | HTML 交互原型 | `prototypes/v0.1/` 四件套 | `file://` 打开，控制台 0 error，7 页可切 |
| 5 | 2026 临床库 | `research/hcc-cancer/` | manifest 记录数 = jsonl 行数 = sqlite 行数 |
| 6 | 采集脚本 | `scripts/fetch-hcc-trials-2026.mjs` | `--dry-run` 输出口径；`--from-raw` 可复现 |

**本轮明确未做**（验收里不算通过）：DSH 接入、生产读模型、MinerU 接入、装机、市场投稿、真实病例。

## 二、照抄样板的产品要求

- 顶栏三段式 + AI 五态；面板默认 35%、范围 **25%–45%** 可拖；**不许按比例缩减**。
- 一图秀：单调三次插值、末点 13px 避让、分类序列只画节点不连线。
- 指标卡：186px 高、整卡 180° 翻转、背面迷你折线；`perspective:1200px`。
- 页脚贴底（`min-height:calc(100vh - 32px)` + `flex:1`）；`[hidden]{display:none!important}`。
- 字号基线 15px（大字 17px）；版本三处同源（顶栏 chip / 页脚 / 关于）。
- 客户端入口必须 `window.__ModuleLoader__.load({id, factory})` + `ctx.desktopWorkbenches.register`。

## 三、硬约束（每条带错误来源）

### 数据层

| 约束 | 错误来源 |
| --- | --- |
| 复合主键表裸 SELECT 必须 `ORDER BY rowid` | 家族通用坑：`tumor_lesion(assessment_id, seq)` |
| 缺测显式 NULL，不用 0 顶替；ALBI 缺项不出分 | 本项目新增：白蛋白/胆红素可缺，出分会造出假分级 |
| 分类指标 `dec IS NULL` 且 `kind ∈ {grade,qual}` | 家族：Child-Pugh / LI-Rads / Vp 不能当数值连线 |
| `using` 是 SQLite 保留字 → 列名为 `in_use` | 家族通用迁移事故 |
| 迁移只增不改；所有 INSERT 写显式列名 + 显式问号数 | 家族通用 |
| 面板参数唯一来源 `lib/layout.js`；`apiBase` 不含 `/api` | 家族通用 |

### 前端

| 约束 | 错误来源 |
| --- | --- |
| 页面只能引用所在目录内的相对路径 | 乳腺癌 v0.3：`../../assets/...` 在 `file://` 能显示、HTTP 预览 404 |
| 内联 svg 必须给宽高 | 家族通用：缺省撑破布局 |
| 窄屏 `body.scrollWidth === innerWidth` | 本次实测：820px 时 sidebar 被 `#nav` 撑到 1209px（已修：sidebar `min-width:0` + `overflow:hidden`、nav `flex-wrap:nowrap`） |
| 页脚高度不要写在 `.footer` 上（会撑出大片空白） | 本次实测：`.footer` 带 `min-height:100vh` 导致首屏下方巨大空白（已移到 `.work-area`） |
| 数值轴用对数时必须在图例写明 | 本次：AFP 跨 3 个数量级，线性轴会把早期值压平 |

### 工程

| 约束 | 错误来源 |
| --- | --- |
| 跑测试 / pnpm 前先 `NODE_OPTIONS=` | 家族通用：注入的 `--require` 会打断 pnpm |
| 单测用 `:memory:`；`--disable-warning=ExperimentalWarning`（node:sqlite） | 家族通用 |
| sh 里 `$var` 紧跟中文写 `${var}`；BSD sed 无 `0,/re/`；grep 或匹配用 `-E` | 本机多次踩坑 |
| 临时目录用 `mkdtemp(join(homedir(),'.xyb-…'))`，不用 `os.tmpdir()` | 家族通用 |

### 本癌种专属

| 约束 | 错误来源 |
| --- | --- |
| 两轨永不加总、不互相折算；UI 上必须物理分隔 | 若合成单分，患者会把「肝变差」读成「治疗无效」 |
| 门脉高压不与肿瘤负荷混算 | 出血风险不随肿瘤缩小而消失 |
| 分期两套并存，不换算 | 换算等于替医生下结论 |
| MinerU：Token 优先级 **文件 > 环境变量**；设置页可手工填；失败不产候选 | starter `docs/18-MINERU-PARSING.md` v2 的三起真事故 |
| 试验线索必须标「登记状态，未核实」；0 条结果要带来源覆盖声明 | unified-trial-mcp 诚实边界 |

## 四、本轮明确未做

- DSH 接入与装机（`dsh/index.js` 仍是占位）。
- 生产读模型与 API。
- MinerU 解析链路（M5，按 18 号文档 v2 实施）。
- 真实病例与用户访谈。
- CTV / ICTRP 通道覆盖补齐（见 CLINICAL-DATA）。

## 五、我替你定的默认值（默认执行，可回退）

1. 品牌 **小甘宝 HepPal**，目录 `liver-cancer-workbench`，API 前缀 `hcc`，DB 名 `xyb-hcc.sqlite`。理由：任务池里该条目就叫 `liver-cancer-workbench`。
2. 主色赭棕 `#9C5A3C` + 深 `#5E3324`，A 轨青 `#2F6F66`，B 轨铜橙 `#C2703D`。理由：肝的赭色作主色，两轨用冷/暖区分，避免用纯红（医疗红色易被读成危险）。
3. 分期并列 BCLC + CNLC，默认展示医生最近一次记录的一套。理由：患者通常只记得一套。
4. 演示档案 2 个（初诊不可切除→转化；早期术后随访）。理由：覆盖双轨的两端。
5. 临床数据走在线四通道，离线语料标「未配置」。理由：HCC 无语料，如实声明优于伪装覆盖。

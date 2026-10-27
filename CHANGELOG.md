## v0.3.10 · 2026-10-27（升版）

仅版本号升版：VERSION、package.json、README 状态行与 CHANGELOG 对齐，无功能变更。

## v0.3.9 · 2026-10-27（36 号 v2 链接复验修订 + 顶栏「?」挂载 + check 接入）

按 `primer-backfill-2026-10-27/AGENT-PROTOCOL.md`，用 `verify-links.mjs`（真 Chrome）逐条复验
v0.3.8 落位的 8 条唯一链接，只保留判定为 `OK` 的地址。

### 一、链接复验：4 条不合格，换可验证的同源页

| 原地址 | 复验 | 处置 |
| --- | --- | --- |
| NHC 2024 版 PDF 直链 | `THIN`（无头浏览器读 PDF 正文为 0） | 改指**河北省卫健委转发页** `https://wsjkw.hebei.gov.cn/zcfg2/402819.jhtml`（原文通知 + PDF 附件，`OK`；143 页已本地核对） |
| NHC 2022 版 PDF 直链 | `THIN` | 改指**河北省卫健委转发页** `https://wsjkw.hebei.gov.cn/zcfg2/385518.jhtml`（原文通知 + PDF 附件，`OK`；124 页已本地核对） |
| BCLC 2022 update（PubMed 34801630 / PMC8866082） | `AUTH` / `THIN`（403、203） | `secondaryUrl` 改指 **BCLC 官网专业区**（`OK`），note 保留 PMID / PMCID |
| AJCC 第 8 版（PubMed 28094848） | `AUTH`（403） | 改指 **ACS/AJCC 官方分期手册产品页**（`OK`，含第 8 版勘误） |
| BCLC 裸域名 `https://www.bclc.cat/` | `HOMEPAGE`（§2.5 L6 不合格） | 删除与 BCLC 2022 行重复的「BCLC（官网）」表行 |
| NCCN / CSCO（人卫社）/ WHO-IARC | `OK` | 不变 |

结果：**唯一链接 7 条 / 引用 19 处**，`prototypes/v0.1/primer-data.js`、`lib/client.js`（内联 `PRIMER_DATA`）、
`README.md`、`docs/DISEASE-PRIMER.md` 四处同源同步。未取得项照实保留：BCLC 2022 期刊原件、AJCC 原书。

### 二、顶栏「?」真正挂到 `.top-actions`

v0.3.8 只有状态卡副按钮 `data-primer-open`，模块 `mount()` 会接管第一个已存在的按钮而不再插顶栏；
`index.html` 补静态 `#primer-trigger`（`?`，带完整 aria-label），现在 P1 读到的是顶栏按钮而不是卡内副按钮。

### 三、check 接入

- 新增 `scripts/check-primer-links.mjs`（L1–L6 通用断言，自动识别活动原型）；
- `npm run check` 末尾追加 `&& node scripts/check-primer-links.mjs`，并加 `npm run check:primer-links` 别名。

### 验收

- `node scripts/check-primer-links.mjs`：21 项断言 21 通过；
- `node scripts/probe-disease-primer.mjs --port 8182 --url http://127.0.0.1:8182/prototypes/v0.1/index.html`：**10/10 PASS**（P9 三档对齐）；
- `node scripts/probe-primer-ui.mjs`（装机版）：**12/12 PASS**（19 链接 / 7 行表 / 红标 0）；
- `npm run check` 退出码 0；`npm test` **111/111**。

口径说明：`www.nhc.gov.cn` 对连续自动化复验会返回 `412` 风控挑战（首验 `200 OK`，人工点击正常）。
因此两份国内指南的原件行改指**河北省卫健委转发页**（原文通知 + PDF 附件，判定 `OK`），note 里写明链接来源；
org 仍记国家卫生健康委，页码按本地 PDF 页脚核对。

## v0.3.8 · 2026-10-27（36 号 v2 移植进装机版 + 重新打包）



v0.3.7 只把 36 号 v2 做在 `prototypes/v0.1/`（HTML 原型），装机版 `lib/client.js` 里一行没有，
而 `package.json` 的 `files` 不含 `prototypes/` —— 装进 Desktop 就看不到疾病概要与状态卡。
本轮把两块移植进装机版，并按装机口径重新打包。

### 一、疾病概要进装机版（§2.5 指南原件可点）

- 数据内联进 `lib/client.js`（`PRIMER_DATA`）：宿主不提供静态资源路由，家族里唯一已装机的
  先例（小肺宝）也是内联，不引外部 js/css。
- 样式取 starter `assets/patterns/disease-primer.css` 原版内联（`PRIMER_CSS`），
  `--dp-*` 令牌在 `.wb-liver-cancer-workbench` 上映射到本项目陶土色系，不覆盖骨架结构。
- 新增顶栏「?」入口（`wb-primer-trigger`）→ 整页视图：返回与关闭两个独立入口，
  open 压一条 `history.state.wbPrimerOpen`，关闭与 Esc 各只退一层；关闭后焦点回触发者、
  `.wb-body` 滚动位置复原。
- 面板实测 20 个 `dp-link`、8 行指南表 8 个可点「原件」、`dp-miss` 红标 0 处。

### 二、看板状态卡（§2.6）进装机版

- 四件齐：卡头 `D+N 状态卡 · 距下次安排 N 天` / 大字 `第 N 天` / 现状行（治疗原文＋分期＋下次）/
  出口按钮排（主按钮进当前阶段核心页 + `疾病概要：肝细胞癌是什么？`）。
- 天数由档案日期派生：锚点取「未结束治疗的开始日 → 手术日 → 最早一次治疗 → 背景记录日」，
  不手填；`openTasks` 里没有未来日期时写「原定 X 还没有完成记录」，不按指南间隔推算。
- 无锚点走「待初始化」，指向导入入口，不编占位数字。

### 三、修的坑

- **状态卡被压扁**：`.wb-body` 是 flex column，`.sc-card` 带 `overflow:hidden`，flex 子项
  `min-height:auto` 在 overflow 非 visible 时不生效，卡片被压到 42px 只剩卡头。
  加 `flex:0 0 auto` 后 190px 正常。已把这个坑写成探针 P11。
- **探针别用 `history.length` 判压栈**：`back()` 只移指针不减长度，二次 push 会截断重填，
  长度可能原地不动。判据只能是 `history.state`。

### 四、验证

- 新增 `scripts/probe-primer-ui.mjs`（`npm run probe:primer-ui`）：P1–P11 + E0 共 12 条全过。
- `npm run probe:ui`：12 个视图、一图秀、导入队列、候选确认、三档字号全过（老功能没被碰坏）。
- `npm run check:all` 全绿；`check:wording` 31 文件 0 命中。
- 重新打包 `xyb-community-liver-cancer-workbench-0.3.8.tgz`，装机到 Desktop profile 后实测。

## v0.3.7 · 2026-10-27（36 号 v2 补齐：指南原件可点 + 看板状态卡）

用户指令：「**更新肝癌项目**」，按 starter `prompts/PRIMER-BACKFILL.md` 六步补齐。模式层直接取
starter 1.8.1，业务侧只动 36 号（疾病概要）与看板首卡，不碰 schema、不碰导入链。

### 一、模式层同步（三件套与 starter 逐字一致）

| 文件 | 变化 |
| --- | --- |
| `prototypes/v0.1/primer.js` | 1.6.1 → **1.8.1**：新增 §2.5 链接渲染（`dp-link` / `dp-miss`）、表格单元格支持 `{text,url}` |
| `prototypes/v0.1/primer.css` | 同步（新增 `.dp-link` / `.dp-miss` 红标样式） |
| `scripts/probe-disease-primer.mjs` | 同步（新增 **P9 排版对齐**：正文/列表/表格/来源行同左基线，右边界极差 ≤2px，1440/900/390 三档） |

### 二、指南原件从"纯文字"变成"可点"（§2.5 硬约束）

改造前 `primer-data.js` 里 `url` / `secondaryUrl` 计数为 **0**，四段来源栏全是纯文字「未取得原件」，
按 §2.5 属违规。本次逐条取证后落位 **8 条唯一链接 / 19 处引用**，全部 `curl` 逐条验过：

| 文件 | 判定 | 链接 |
| --- | --- | --- |
| 《原发性肝癌诊疗指南（2024 年版）》 | **原件已取得**（官方 PDF，143 页） | `nhc.gov.cn/.../1732871166035_91949.pdf` |
| 《原发性肝癌诊疗指南（2022 年版）》 | **原件已取得**（官方 PDF，124 页） | `nhc.gov.cn/.../1732871378900_48829.pdf` |
| BCLC 2022 update（Reig 等，J Hepatol 2022;76(3):681-693） | 未取得原件 · 据 PMC 全文 | `pmc.ncbi.nlm.nih.gov/articles/PMC8866082/` |
| AJCC 第 8 版总述（CA Cancer J Clin 2017;67:93-99） | 未取得原件 · 据 PubMed 记录 | `pubmed.ncbi.nlm.nih.gov/28094848/` |
| BCLC 官网 / NCCN Hepatobiliary / CSCO 2024 / WHO 消化系统第 5 版 | 未取得原件 · 据官网或书目页 | 见 `primer-data.js` 的 `LINK` 表 |

两处硬伤顺手修掉：
- **页码不再是「页码待核」**：分期与治疗各论的页码取自本地这两份 PDF 的**页脚编号**——
  「三、分期」2024 版 **P32**（图 4）、2022 版 **P22**（图 3）；治疗各论 P36 外科 / P54 消融 /
  P61 经动脉介入 / P72 放疗 / P78 系统治疗。
- **AJCC 那条曾指向 `PMID 28294283`，实测是《Orthostatic Hypotension and Falls》（J Am Geriatr Soc 2017）**，
  与 AJCC 无关；已换成第 8 版总述的正确记录 `PMID 28094848`。

`nolink` 只用在两处没有对外 URL 的说明行（本仓 `docs/DISEASE-PRIMER.md`、`docs/HCC-DOMAIN.md`），
并在 `note` 里写明原因；没有一条是"图省事不写链接"。

### 三、看板首卡：状态卡四件（§2.6）

改造前 `grep stage-card` 在 `prototypes/v0.1/` 里**零命中**，状态卡完全缺失。本次新建 `stageCard()`：

1. **卡头**：`D+139 状态卡 · 距原定安排：日期已过`（有未来安排时写「距下次安排 N 天」，当天写「下次安排：今天」）；
2. **大字天数**：`第 139 天`，28px 品牌色；
3. **现状行**：当前阶段原文（`系统治疗 · 仑伐替尼 + 信迪利单抗` + `进行中 · 2026.06.10 起 · 第 4/6 周期 · 转化意图`）、
   分期行（`BCLC B（2026.04.15） · CNLC IIb（2026.04.15） · 两套不换算`）、下次行；
4. **出口按钮排**：主按钮 `看可切除性版本链 →`（指向档案里**最近一次决策性事件**所在页），
   副按钮 `疾病概要：肝细胞癌是什么？`（开 36 号浮窗）。

两条纪律写进代码注释，不只写在文档里：
- **锚点不手填**：① 有未结束的治疗 → 该治疗开始日；② 否则手术日；③ 否则初诊日；都没有 → 整卡「待初始化」+ 三步向导。
  现状行与大字天数**同源**（都取锚点那次事件），避免「天数按 A 算、阶段按 B 写」。
- **「下次」只取用户自己记下的未完成安排**，不由指南周期推算；日期已过就写「原定 X（事项）· 档案里还没有完成记录」，不写"逾期"。

### 四、验证

- `probe:primer`（`--url .../prototypes/v0.1/index.html`）**10/10 PASS**：P3 面板 1249×829 / 视口 1280×860、
  P4 `history.length=3`、P5 返回与关闭是两个节点、P6 焦点回触发者且 `scrollY 260→260`、P9 三档对齐、E0 无 console error；
- `--self-test` **7/10 → 3 条 FAIL**（注入的两处缺陷被抓住：面板尺寸 + 删返回、趋势段塞禁止词）；
- 面板实测：**20 个可点 `dp-link` / 0 个 `dp-miss` 红标**，四段顺序 `definition › evidence › landscape › trend`；
- `npm run check:all` 全绿（check 4 项 + 111 条单测）；`check:wording` 31 个文件 0 命中。

### 五、未做

- 临床试验登记采集未补，趋势段第 7 条仍是「本项目尚未完成……补齐前不写任何数字」；
- 装机副本与市场投稿未动（按上一轮「M7 不用发布」的指令）。

## v0.3.6 · 2026-10-24（MinerU 解析链路 + 设置页 + `--tz` 三档字号）

用户指令：「**ok，继续，M7不用发布，其它完成**」——M5 剩余（MinerU + 设置页）与 M6 剩余
（`--tz` 三档）都做完，M7 的投稿与落地页不做。

### 一、扫描件解析：从"只有设计"到能跑完整条链

按 starter `docs/18-MINERU-PARSING.md` v2 落地，五个新模块各自只做一件事：

| 文件 | 职责 | 不这么做会怎样 |
| --- | --- | --- |
| `dsh/zip.js` | 零依赖读 ZIP，按名字取一个条目 | 引 `adm-zip` 就得处理打包与 CJS 互操作，而这里只需要 `full.md` |
| `dsh/mineru.js` | API v4 四步（申请上传地址 → PUT 原件 → 轮询结果 → 下载 zip） | 包装 CLI 在 GUI 里必 ENOENT（PATH 只有系统四目录） |
| `dsh/hccparse.js` | markdown → 行：剥 LaTeX、表格转竖线表后对齐 | 先 `replace(/<[^>]+>/g,'')` 会把表格压成一行，实测把两个数字黏成 `3822` |
| `dsh/parse.js` | 编排：路由、落库、失败语义 | 把"没配 Key"和"文件不对"混成一个失败，用户不知道下一步做什么 |
| `dsh/settings.js` | Token 唯一实现（读、写、掩码、校验） | 三处各写一份，必然出现"换了 Key 还是 401" |

几个刻意的决定：

- **默认模型 `pipeline`，只有接口明确拒收模型参数才回退 `vlm`**；`flash` 通道作废。
- **`.html` 不进白名单**：v4 批量接口明确拒收（`-10002`），留个一定失败的入口就是骗用户，改为提示"导出成 PDF 再传"。
- **Token 优先级：显式 > 密钥文件 > 环境变量**。写反的现象是"我在设置里换了 Key，它还在用旧的"。
- **Token 原文永不回界面/日志/错误消息**：设置页只给掩码（`sk-u****54`）与来源；原子写（同目录 tmp → `chmod 600` → rename，目录 700），坏文件抛错而不是当成"没配"。
- **单位先剥 LaTeX 外壳**：真实 `full.md` 写的是 `$10^9/L$`、`10^{9}/L`、`\mumol/L`，夹具写干净版会让"本地绿、桌面显示 `$10^9/L$`"。
- **失败分两类**：`NO_TOKEN / UNAUTHORIZED / NETWORK / TIMEOUT` 是环境问题，文档**留在待解析**（配好 Key 直接重试，不必重传）；`TASK_FAILED / NO_MARKDOWN / BAD_FILE` 才是这份文件过不去，落 `parse_failed`。"解析中"不写进库，免得留下僵尸状态。

失败消息里带约定标记 `MINERU_TOKEN_URL`，前端只判这一处：命中就出三个动作
（① 去申请/重置 ② 去设置里填 ③ 让 Agent 提醒我怎么更新），非 Token 故障不弹这一块。

### 二、`schema/0005_parse_job.sql`（只增不改）

解析是**一次一次发生的**，不是文档属性：同一份材料可能今天没 Key 失败、明天成功、后天换模型重跑。
塞进 `document` 只能留最后一次，用户问"我明明试过三次"时没有答案。`parse_job` 只记尝试
（引擎/模型/状态/错误码/错误原文/页数/候选数/耗时），不参与任何计算。

冻结哈希已登记进 `schema/freeze-contract.md`（`28bfe9ed…`），`npm run check` 的冻结合同段随之通过。

### 三、设置页（一级第 12 视图）

只放三类配置，**不摆点了没反应的开关**：资料目录（只读 + 就绪徽标）、扫描件解析 Token
（`type="password"` 输入框 + 保存/清除 + 掩码 + 文件路径与权限 + 申请链接 + 云端代价提示）、
字号三档。「多档案切换 / 报告导出 / 参考数据包」如实写进"还没做的"块。

导入队列每行加了「解析 / 重试解析」按钮，窄屏也不会挤掉状态；`canParse` 取自 `/health` 的
`capabilities`，旧宿主 + 新前端时不出这个按钮。

### 四、`--tz` 三档字号（`PARITY-05` 转「一致」）

之前只有 standard / large 二档，且**73 处 `font-size` 全是死值**——那两档其实只放大了根字号。
本轮统一成 `calc(NNpx * var(--tz))`：`--tz` 1 / 1.15 / 1.32，`[data-tz=md|lg]` 一改全篇跟着变；
根字号 `font` 简写拆成 `font-family` + `font-size: calc(...)` + `line-height`（简写里放 calc 在老 Safari 不稳）。
顶栏 chip 点一下循环三档，设置页 radiogroup 直接选，同一个 localStorage 键。

### 五、演示库补了真实原件（否则「解析」按钮一定报 not_found）

`demo/build-demo-data.mjs` 原来只写 `file_sha256` 不写 `file_path`，演示库上点「解析」只会得到
"没有原件路径"。现在三份材料各带一份 `demo/files/*.txt`，正好对应闸门三种结局：

| 材料 | 解析后 |
| --- | --- |
| 肝外科门诊病历（2026-08-28） | 通过闸门 → 5 条候选（白蛋白 / 总胆红素 / ALT / AST / 血小板） |
| 常规体检报告（2026-08-12） | 线索不足 → 0 条候选，仍留待解析等人看 |
| 胰腺增强 CT 报告 | 域外拒收 → 0 条候选，落"未接收" |

`file_path` 用仓库相对路径，`dsh/parse.js` 对相对路径按 `root` 解析（不按 cwd——服务进程的 cwd
是装机 profile 目录，按 cwd 解析会让演示库点什么都报"原件不在这个位置了"）。

### 六、顺手修掉的一个假宿主偏差

`scripts/harness.mjs` 给 GET 路由传了 `{}` 而不是 `null`。真宿主（`dsh/guard.js`）传的是 `null`，
于是设置路由的"有没有请求体"判断在探针里走成了**写分支**，GET 状态直接 400 `请填入 Token`。
两侧都修：假宿主按真宿主传 `null`，路由也只把"带 `action` 或 `token` 的 body"当命令。

### 七、验收

- `npm test` **111 条全绿**（新增 `test/parse.test.mjs` 24 条：Token 优先级/掩码/坏文件/原子写 600/
  保留其它键/清除幂等、`stripLatex`、表格 colspan、横表对齐与反例、MinerU 四步（PUT 不带 Content-Type）、
  401 不重试、无 Token 零请求、缺 `full.md`、ZIP 读取、本机解析落库、重解析不堆候选、迁移到 0005）。
- `npm run probe:ui` 真 Chrome 通过：**12 视图** / 队列 4 份 / 解析三态逐个点过 / 设置页 Token 只落文件
  （掩码 + 600 权限 + DOM 里搜不到原文 + 输入框清空）/ 三档字号逐级 1.15 与 1.32。
- `npm run check` 通过：版本三方一致、**5 条迁移 5 条登记**、文案红线。

## v0.3.5 · 2026-10-24（修好真机「AI 对话」+ 新增第 11 个视图「一图秀」）

用户指令：「点击AI对话按钮无效。另外，缺失一图秀设计。」

### 一、按钮为什么在真机上"点了没反应"

0.3.4 把 `conversation` 当成 **DOM 节点**，用 `appendChild` 往容器里挂。这个判断的来源是假宿主：
`scripts/harness.mjs` 传的是一个 `document.createElement('div')`，于是错的那条路被假宿主验证通过了，
真机上一次都挂不上。

从 `DSH Desktop.app/Contents/Resources/app.asar` 里读出宿主渲染器原文：

```js
h(item.Component, { service, entry: item, active: id === item.id,
  conversation: id === item.id
    ? h('div', { style: { display: hasCurrentSession ? 'contents' : 'none' } },
        h(ConversationMount, { container: conversationContainer }))
    : null })
```

结论：`conversation` 是**一个 React 元素**，里面用 `createPortal` 把原生会话挂到宿主自己的容器上，
显隐由宿主按 `hasCurrentSession` 写成 `contents` / `none`。所以必须**当 React 子节点渲染**——
位置固定、类型固定，React 原地复用，输入树不会重挂。0.3.4 的空面板就是这么来的：面板打开了，
里面什么都没有。

同时补了三处可观测性，避免"错在别处也像没反应"：

- `inject` 加回 `sessions`（0.3.4 只 inject 了 `desktopWorkbenches`，填草稿那步必然降级）；
- `health.dir` 为空时**先自己拦住**，并说明"是服务端没给资料目录"，不再把宿主那句
  「创建会话需要业务项目文件夹。」原样塞进顶栏；
- 失败提示从 11px 小字改成通栏 `role="alert"` 色块；按钮也不再因为"宿主没提供 ensureSession"
  而 `disabled`（禁用按钮在用户眼里就是没反应）。

假宿主同步改成宿主真实合同（传 React 元素），并把 `dir: ROOT` 补给 `createHandlers`——
少传这一项时，真机才会走的"没有资料目录"分支测不到，正常分支反而会被测挂。

### 二、新增「病情一图秀」（一级第 2 项）

家族统一画布与口径，移植自结肠 v0.2 / 卵巢：`CW=980 · CH=420 · X0=62 · X1=898 · Y0=66 · Y1=366`。

| 区域 | 内容 | 约束 |
| --- | --- | --- |
| 左栏 | 时间范围 chips（近 3/6/12 月、全期）、缩放滑杆（25–100%）、「治疗节点」「末点数值」开关、按 4 组分类的指标勾选 | 最多 4 条，最少 1 条；取消到最后一条时不生效，避免画布空掉 |
| 画布 | 单调三次插值曲线 + 真实采样点 + 月份刻度 + 治疗条 | 每条线按**自身全期** min–max 归一化；缺测不补 0、不插空值 |
| 末点 | 右缘 82px 标签栏写数值，13px 最小间距，从下往上让位，整列不出顶边 | 0.3.5 初版把标签压在折线上且被底边裁掉，已改到数据区外 |
| 点选 | 点任一记录点 → 下方固定该次日期、数值、前次值与该项口径说明 | 详情里的口径来自 `NOTES`，与卡片背面同一份 |
| 空态 | 选中项没有记录点时给文案，不画空坐标轴 | — |

口径写进页面本身：纵向高度只对同一条线有意义；治疗条只标"发生过什么、什么时候"，
没写结束日的按 3 周示意，不代表疗效；一图秀回答"什么时候变了"，不回答"该不该换治疗"。

### 三、验证

- `npm run probe:ui`：11 个视图 / 会话元素必须是 `.wb-agent` 的 React 子节点 / 一图秀默认 4 条、
  上限 4 条、点选出详情、缩放 25% 仍有线 / 导入队列三态 / 候选带原文 / 确认写库 / 退回不写库 / 无控制台报错。
- `npm run shot:views`：`prod-view-onepage.png` 等 11 张全部重出；点选固定详情的证据图见 `prod-view-onepage-detail.png`。
- `npm run check`：语法、包结构、版本一致、冻结合同、文案红线全绿。

# CHANGELOG

## v0.3.4 · 2026-10-24（面板骨架按乳腺癌工作台对齐：左侧一级栏 + 顶栏 AI 对话）

用户指令：「1）一级菜单位置参考乳腺癌 2）没有顶部 AI 对话按钮，无法开启/收藏/调整对话窗口。」
本轮只动外壳与面板合同，业务视图与数据层零改动。

### 骨架：customFrame 真骨架

| 层 | 结构 | 约束 |
| --- | --- | --- |
| 顶栏 | 根节点首个子元素是语义 `<header>`：品牌 + 版本 + 提示 + 「AI 对话」按钮 + `×` + 便签 | 必须避让 macOS 窗口按钮（`--dsh-frame-leading-clearance`）；`<style>` 改注入 `document.head`，不再占首位 |
| 左栏 | 236px 竖栏：品牌块 / 档案块 / 竖排一级 10 项 / 侧栏页脚 | 一级菜单位置与乳腺癌工作台一致；窄屏（<900px）折叠成品牌行 + 单行横滑 |
| 主区 | 面包屑「小甘宝工作台 / 当前页」+ 「大字 Aa」+ 视图内容 | 面包屑只有一级，不假装有二级 |
| 会话区 | 右侧原生会话，默认 35%，可拖 25%–45%，步进 2% | 只切 `display`，不卸载——卸载会丢输入框与草稿 |
| 分隔条 | 夹在业务区与会话区之间 | 放在会话区后面会跑到整帧最右缘，拖动方向相反（本轮踩过） |

### 三个必须踩过才知道的坑

- **原生会话是 DOM 节点，不是 React 元素**。`conversation` 直接当子节点渲染会抛
  `Objects are not valid as a React child`，整页白屏。正确做法：容器 `div` + ref，`appendChild` 一次，之后不再动它。
- **`conversation` prop 在本工作台 active 时恒非空**（宿主传的是 `display:none` 容器），
  不能当"有没有会话"的判据。会话归属只能问 `currentSession()` + `ownsSession(id)`，
  否则「AI 对话」按钮永远只是切显隐、`ensureSession` 永不触发。
- **宽度取整不能按 2% 网格**。默认 35% 本身就在 2% 网格的半格上，`Math.round(0.35/0.02)*0.02` = 0.38，
  键盘一步就跳 3%。改为对齐 1% 网格，步进仍 2%。

### 窄屏

- 容器宽度 < 760px：会话区改覆盖式抽屉（最宽 420px）+ 一层可点关闭的遮罩；分隔条不渲染。
- 一级栏横排且 `flex-wrap:nowrap` + 横向滚动——wrap 会让 10 项堆成三行，把业务区压到看不见。
- `.wb-nav` 的基础规则排在 `@container` 之后，后写者赢，wrap 覆盖必须再声明一次（本轮踩过）。

### 服务端

- `/api/health` 增加 `dir`：客户端调起会话时作 `ensureSession({ folder })` 的 folder，
  空 folder 会被宿主拒绝。`dsh/index.js` 传 `ROOT`，探针里可为 null。

### 验证

- `scripts/probe-prod-ui.mjs` 的假宿主补齐 `currentSession / ownsSession / subscribe / ensureSession`
  与 `sessions.scope()`，新增 9 组断言：语义 header 首位、侧栏 10 项、`customFrame === true`、
  无会话时会话区隐藏、点按钮后文案翻转 + 会话区出现 + splitter 出现、键盘 ← 精确 +2% 且落 localStorage、
  鼠标拖动变宽、`×` 收起后会话节点仍挂载、窄屏三项（导航横排 / 业务区单列 / 抽屉 absolute）+ 遮罩可关。
- 新增 `scripts/harness.mjs`：假宿主（React UMD + `__ModuleLoader__` + 会话最小面 + 真实 `dsh/api.js` 路由）
  从探针里抽出来，探针与截图脚本共用一份，避免两份外壳各自漂移。
- 新增 `scripts/shot-views.mjs`（`npm run shot:views`）：重出 10 张视图截图 + 2 张翻面卡，
  文档里的 `prod-view-*.png` 全部换成左侧栏版式。
- 主区自身也是容器（`container-type:inline-size`）：会话区展开后主区变窄，卡片与两栏按主区宽度折叠，
  不会把导入队列压到 190px。
- `npm run check` 四段全过，`npm test` 83/83。

## v0.3.3 · 2026-10-24（导入在界面里闭环：队列 → 候选 → 确认写库）

用户指令：「继续M5，到M7，中间自己决策推进。」本轮把导入链路从"命令行能跑"推到"界面上能用"，
并把 M6 的自测欠账一次补齐。

### 界面：第 10 个视图「导入与候选」

| 区域 | 行为 | 约束 |
| --- | --- | --- |
| 导入队列 | 文件 + 日期 + 候选计数 + 状态徽标（待确认 / 线索不足 / 未接收 / 已处理完） | 状态与理由都来自库，不前端推算；`parse_note` 原文贴着显示，`[gate]` / `[guard]` 开头能看出是哪一步拦下的 |
| 候选列表 | 字段中文名 + 数值 + 单位 + 原文行 + 抽取置信 + 状态 | 原文行必显（`source_line`）；置信只写"匹配的把握"，不写成"数值对不对" |
| 确认 | `POST /candidates/accept` → 写 `metric_reading` 并重取指标 | 文本字段按钮禁用（不进趋势）；无报告日期时后端 400，不拿上传日期顶 |
| 退回 | `POST /candidates/reject` → 只改状态 | 退回不删候选，留痕 |

### 数据层

- `schema/0004_candidate_source.sql`：`candidate.source_line` + `candidate.note`，只增不改，sha256 `d6752af2…`。
  `freeze-contract.md` 已登记，列数 255 → 257。
- `demo/build-demo-data.mjs` 播种 3 份导入材料（待确认 5 候选 / 胰腺 CT 未接收 / 扫描件线索不足），
  演示库打开就能看到闸门的三种结局，不用先跑命令行。

### 路由

- `dsh/guard.js` 签名从 `(run)` 改为 `(route)`：少了 `methods` 白名单，POST 会变成"任何方法都放行"。
- 新增两条写路由，10 条路由里只有它们声明 `methods: ['POST']`；读路由收到 POST 返回 405 + `allow` 头。
- `readJsonBody` 限 64KB，坏 JSON 回 400 不抛 500。

### 新增检查

| 脚本 | 查什么 | 为什么必须有 |
| --- | --- | --- |
| `scripts/check-schema.mjs` | 迁移 sha256 与冻结合同逐条比对，并核对演示库 `_migration` | "只增不改"靠自觉守不住；顺带发现 0004 未登记 |
| `scripts/check-wording.mjs` | 界面与 README 的红线词（建议治疗 / 可能复发 / 可以停药 / 治愈率…） | 一句"建议治疗"就把记录工具变成医嘱 |
| `scripts/check-version.mjs` | package.json / CHANGELOG 顶部 / README 状态行三方一致 | 已经漂移过两次 |
| `scripts/probe-prod-ui.mjs` | 真 Chrome 跑 `lib/client.js`：10 个 tab、队列三态、候选带原文、确认写库、退回不写库、无控制台报错 | 模板字符串的界面只有真 DOM 才能验；本轮它抓出一个真 bug（见下） |

三个 check 已接进 `npm run check`；`probe-prod-ui` 因依赖本机 Chrome，单列不阻塞 CI。

### 修掉的问题

- **`other` 被提前求值**：改成三元链后，`[state.view]()` 在 dash / metrics 两个视图上立即执行并抛
  `is not a function`，整页白屏。`probe-prod-ui` 第一次跑就撞上了；改成惰性函数。
- `test/api.test.mjs` 把 query 写进 path 参与精确匹配 → 改为 path 与 url 分开，注释写明真实注册里 query 不参与匹配。
- 演示库构建曾硬编码"只跑 0001+0002"，加 0003 后 `openDatabase()` 会把 0003 登记成已应用却不执行 → 改按目录顺序遍历。

### 自测

`npm run check` 四段全过（staticPass / 版本 / 冻结合同 4 条 / 文案红线 0 命中）；`npm test` **83/83**；
`probe-prod-ui` 全通过并留下 `prototypes/v0.1/prod-view-import.png`。

## v0.3.2 · 2026-10-24（导入链路落地：嗅探 → 闸门 → 抽候选 → 落库）

用户指令：「测试通过。继续后续开发，现在开发状态序列图标记看一下。」（状态图已交付，本轮做导入链路）

### 新增：`import/` 四模块 + 命令行

| 文件 | 职责 | 关键约束 |
| --- | --- | --- |
| `import/sniff.mjs` | 类型 / 字节 / sha256 / 有无文本层 | 判据保守：`/Font` **且** `Tj\|TJ\|Tf` 才算有文本层。`pypdf` 对扫描件返回 0 字符且不报错，不能被当成"内容为空" |
| `import/guard.mjs` | 病种闸门 | 原发灶措辞 → 部位词计分 → 指标组合兜底，三级证据 |
| `import/extract.mjs` | 产 candidate | 9 个数值指标带常见范围；超范围降置信度并注明核对原文，不改数 |
| `import/pipeline.mjs` | 决策编排（纯函数） | 闸门必须在 extract 之前；域外时 `candidates` 恒为空数组 |
| `import/store.mjs` | 写 document + candidate | sha256 幂等；确认才写 `metric_reading`；必须带 `source_doc_id` |
| `scripts/import-doc.mjs` | 命令行入口 | 退出码 0/3/4/2/1 区分"待确认 / 拒收 / 需 OCR / 参数错 / 异常" |

### 闸门的两条证据线（本轮最重要的设计）

只认部位词会把最常见的入参挡在门外：外院化验单通常一个器官名都没有。实测一份
「总胆红素 21.5 / 白蛋白 38 / 血小板 118 / AFP 12.4」的化验单，按部位词判是"线索不足"整份拒收。

- 加 `probeFields()`：只回答"出现了哪些指标名"，数值与原文全部丢弃，作为第二类证据；
- 加 `PRIMARY_RE`：`胰腺癌肝转移` 按词频算肝占优（2:1），会误判成肝癌，故先认 `X癌` 原发措辞直接拒收。

### 变更：`document.status` 语义收紧

`needs_review` 的落点从 `pending_review` 改为 `pending_parse`——一个候选都没有却显示"待确认"，
用户点进去是空列表。`parsed` 的含义也明确为"人已经看过了"，不是"机器解析成功"。

### 数据库：`schema/0003_import_gate.sql`（只增不改）

- `document.parse_note`：存 `[阶段] 理由原文`，让"文件坏了"和"这不是肝的报告"在界面上可区分；
- `idx_document_profile_uploaded`：导入队列按档案+时间倒序。

`0001`/`0002` 哈希未变（`3051629e…` / `dd13be40…`），新增 `0003` 哈希 `eb51c0d8…`。
复核：24 张业务表 / **255** 列 / 3 触发器 / **20** 索引 / 外键违规 0 / `_migration` 3 条。

### 修复：演示库构建脚本硬编码迁移文件名

`demo/build-demo-data.mjs` 原来只 `exec` 0001+0002。加了 0003 之后，演示库会缺 `parse_note` 列，
而 `openDatabase()` 的"老库引导"看到 `profile` 表存在，会把 0003 登记成"已应用"却不执行——
结构悄悄落后一个版本，直到某条 SELECT 报 `no such column` 才暴露。改为按目录顺序遍历执行并登记 `_migration`。

### 只读路由

- `GET …/documents?profile=` 导入队列（文件 + 状态 + 候选计数，不含候选内容）
- `GET …/candidates?doc=` 某文件的候选清单

`health.capabilities` 从 6 项增至 8 项。

### 测试

`test/import.test.mjs` 25 条 + `test/store.test.mjs` 13 条，全量 **75/75** 通过。
体检/回归覆盖：扫描件判无文本层、胰腺样本拒收、`前白蛋白` 不误匹配 `白蛋白`、`直接胆红素` 不误匹配总胆红素、
`Ki-67 40%` 不产生 AFP 候选、`cm` 不换算 `mm`、同日同指标拒绝重复写入、无日期拒绝确认。

### 未做（见 `docs/IMPORT-PIPELINE.md` §6）

HTTP 上传通道、Node 内 OCR、`candidate.source_line` 落库（需 `0004`）、前端「导入」视图。

## v0.3.1 · 2026-10-24（定名「小甘宝」；G3 数据模型签认）

用户两条答复：「1. 确认」（同意签认 G3）、「2.小甘宝」（品牌中文名定稿）。

### 改名

- 品牌中文名 **小肝宝 → 小甘宝**，英文仍 **HepPal**。全仓 33 处统一（17 个文件）：界面标题、`project.config.json`、
  `dsh/*` 注释、`README` / `AGENTS` / `docs/*`、原型三件套、`assets/README`。
- `schema/0001_initial.sql` **只改了第一行注释**，无表、列、CHECK、触发器、索引变更。因 sha256 变化，
  迁移管理器会判定"文件被改过"，故按冻结合同的「注释改动 → 重新冻结并记录」流程处理：
  更新 `schema/freeze-contract.md`（新哈希 + 旧哈希作废原因），并跑 `npm run build:demo` 重建演示库、把新 sha256 登记进去。

### G3 签认（记录在 `docs/GATE-RECORDS.md`）

签认前把四项逐条跑了一遍，证据可复跑：

| # | 项 | 结果 |
| --- | --- | --- |
| 1 | 字段 | 24 张业务表 / 254 列，与 `SCHEMA-SPEC.md` §1 分组一致 |
| 2 | 枚举 | 9 组 CHECK 均有界面中文标签（`lib/client.js` 的 `LBL`） |
| 3 | 口径 | 八条内容边界各有测试或触发器兜底（缺测 NULL / 分类不趋势 / 结论只增版本 / 看法非结论 / ALBI 不落库） |
| 4 | 冻结 | `_migration` 2 条 + 哈希一致 + 3 触发器 + 19 索引 + 外键违规 0 |

签认后解锁：建生产表、写 `0003_*.sql`、导出、接真实数据。
**未覆盖**：临床口径的医生/药师复核（本次是项目所有者签认，不等于临床审核）、MinerU 解析（M5）、指南出处层、装机与投稿。

### 版本

`VERSION` / `package.json` → 0.3.1。测试 35/35 通过。

## v0.3.0 · 2026-10-23（生产版第一刀：数据层 + 六条路由 + 九个视图）

触发：G2 通过后的用户原话「html 确认 ok，进行后续开发」。原型停在 `prototypes/v0.1`（v0.2.1）不动，
生产代码另起一条线，从「读模型 → 路由 → 客户端」三层重写。

### 这一版新写了什么

- **`dsh/db.js` 迁移管理器**：`_migration(name, sha256, applied_at)` 按文件名顺序执行；**已执行文件被改过直接抛错**
  （冻结合同落地成代码）；老库引导——`_migration` 为空但 `profile` 表已存在时，把现有迁移登记为已应用，不重跑。
- **`dsh/albi.js`**：`0.66×log10(胆红素 μmol/L) − 0.085×白蛋白 g/L`，任一项缺测或非正数返回 `null`。
  **派生不落库**：库里只存白蛋白与胆红素两个原始值。
- **`dsh/read-model.js`**：`listProfiles / getDashboard / listMetrics / listViewpoints / getSections`。
  - 业务表优先于 `metric_reading`；同日期重复时以业务表为准（不留"同一天两个真相"）。
  - 数字序列返回 `{points, latest, prev, delta, count, comparable}`；分类变量返回 `{latestText, history, comparable:false}`。
  - **缺测就是 null**：不进序列、不补 0、不补前值。
  - `getSections` 一次给七块：肝（背景 + 储备全量 + 逐条 ALBI）、瘤（影像 + 分期 + 可切除性）、
    治疗（事件 + 试验）、安全（不良事件 + 症状 + HBV）、营养（含派生 BMI）、心理与家庭（问题 + 家属）、
    复诊（就诊 + 待办）。**看法不在这里**——它必须走 `/viewpoints` 的私密开关。
- **`dsh/api.js` + `dsh/guard.js`**：路由表与鉴权拆成两个纯函数模块。`api.js` 的 handler 返回
  `{status, body}`，不碰 `res`；`guard.js` 把「鉴权先于读取 → 方法不对 405 → 异常 404/500 且不回显堆栈」收在一处。
  单测因此不用假 `res`，也不必装宿主依赖（`@deepseek-ai/schemastery` 不在本地 node_modules）。
- **`lib/client.js` 生产版客户端**：九个视图——看板 / 指标分析 / 我的肝 / 我的瘤 / 治疗与转化 / 安全线 /
  营养与体重 / 心理与家庭 / 复诊与回顾。3D 翻面卡与 `@container` 自适应沿用 v0.2.1 的合同。

### 临床口径上刻意做的四件事

1. **可切除性单独成一列**：HCC 的"转化"不是一个结果，是若干次医生结论。治疗与转化页把结论按时间正序列出来，
   变化自己显形；工作台不算"转化成功"。
2. **BCLC 与 CNLC 并列不换算**：分期表两行并排，各自带 `basis` 原文与 `stated_on`，历史版本标"历史"。
3. **自评程度不冒充分级**：症状 0–10 与不良事件的"2 级（CTCAE 医生记录）"分开两栏，界面明写"自评不是分级"。
4. **私密看法默认不出**：`/viewpoints` 不带 `private=1` 只返回 shared；心理页要用户自己点"显示私密记录"才拉私密。
   实测 5 → 8 条（shared 2 + 问题 3；点开后再加 3 条私密）。

### 实测（`prod-run.mjs`，Chrome headless 1280×1000 @2x）

| 项 | 结果 |
|---|---|
| 看板 | 6 卡 / 276px / 2 列 / `perspective:1100px` / `transition:.48s` |
| 翻面 | `matrix3d(-1,…)`、`aria-pressed=true`、正面 `aria-hidden=true`、背面有 SVG |
| 指标分析 | 18 卡 / 2 列 |
| 640px 容器 | 18 卡 / **1 列** / 无横向溢出 |
| 我的肝 | 3 面板 / 24 行 |
| 我的瘤 | 3 面板 / 13 行 |
| 治疗与转化 | 3 面板 / 3 条事件 / 3 条可切除性结论 |
| 安全线 | 3 面板 / 3 张血常规卡 / 10 行 |
| 营养与体重 | 3 卡 + 4 行（BMI 22.1） |
| 心理与家庭 | 5 → 8 条（私密开） |
| 复诊与回顾 | 3 面板 / 3 条待办 |
| console / 网络错误 | **0**（上一版那条 404 是 Chrome 自动请求 `/favicon.ico`） |

### 测试

`npm test` **35/35 通过**（原 10 + 读模型 10 + 路由 9 + 本轮新增 6：
七块齐全且不含私密看法、握力缺测为 null 且缺身高不算 BMI、ALBI 逐条派生缺项为 null、
治疗事件倒序且未结束为 null、`/sections` 缺参 400 与正常返回、health 能力清单含 sections）。
`npm run check` staticPass true。

### 已知差异 / 未做

- **小数位**：原型把白蛋白写成 `35`、胆红素 `19`（硬编码取整），生产版按 `metric_def`（1 位小数）显示
  `35.0` / `19.0`。以 schema 为唯一来源，不回改原型——原型是签认物。
- **未做**：G3 数据模型签认、MinerU 解析（M5）、指南出处层、导出、装机、市场投稿、Git 建仓推送。

## v0.2.1 · 2026-10-23（看板指标卡接入 3D 翻面；修分级区间文案反向）

触发：用户「你所有的指标卡现在还是静态的……正面是名称和数据，反面是最近的动态趋势」。

根因两条，都不是样式问题：

- **看板那 6 张卡点了没反应**：卡上挂着 `data-action="flip"`，但**没有 `data-code`**，内层也是旧的
  `.metric-inner`（不是 `.mcard-inner`），翻面处理器拿不到 key、也找不到内层，点击后只写了个没人读的
  `aria-pressed`；CSS 的 `.mcard[aria-pressed="true"]` 又压根不匹配 `.metric`。所以看板（用户第一眼看到的页）
  100% 静态，只有「指标分析」页能翻。
- **指标分析页自己写着「点卡片不翻转（原型阶段只做静态卡）」**：实现早在，文案没删——用户读到这句就不会再点。

### 改了什么

- **统一组件**：看板 6 张卡改为与「指标分析」共用 `metricCardHTML()`。ALBI / Child-Pugh 两张按同一形状构造
  （`albiPts` / `childPts` 带真实采样日），AFP / 最大结节径 / 血小板 / 体重直接从 `metricCards()` 取，
  不再各写一套。旧的 `.metric` 三列网格不再渲染。
- **翻面处理器收口**：`data-code || data-card`，内层兼容 `.mcard-inner, .metric-inner`，缺 key 直接返回，
  不再写无人消费的状态。
- **数值格式**：`trendSVG(points, color, w, h, dec)` 补 `dec`，末点标签不再出现 `-2.131022623371133`；
  纵向上下各留 12% 余量，最高/最低点的圆点描边不再被裁一半。
- **正面补一句说明**（`m.note`）：276px 固定高，中段原本空一大块；写一句「分级只作记录，不是预后判断」比留白诚实。
- **翻面提示**：右上角弱符号 `↻`，hover 加深并转 180°；只在明确点击时翻转，hover 仍只做克制边框。
- **文案纠错**：`helpBody` 仍写着「左侧 7 个一级导航 / 生活与家庭 / 复诊与试验」，改为 9 项真实名称，
  并写明「点一下翻到背面看趋势，Tab + 回车也行」。
- **分级区间文案修反**：原来写成 `区间 <125–≥75`（方向相反且自相矛盾），新增 `bandText(code, grade)`，
  输出 `≥75 且 <125`；血红蛋白无 G4 时 G3 输出 `<80`。

### 实测（无头 Chrome，2026-10-23）

| 项 | 结果 |
| --- | --- |
| 看板卡数 / 高度 | 6 / 276px |
| perspective / transition | 1100px / 0.48s cubic-bezier(.2,.7,.2,1) |
| 点击后 | `matrix3d(-1,…)`，`aria-pressed=true`，正面 inert、背面可读 |
| 6 张看板卡背面都有 SVG 趋势 | 是（逐张验证） |
| 键盘 Enter | 有效 |
| 换页回来是否保留翻面 | 保留 |
| 网格列数 1440 / 860 | 2 列 / 1 列，无横向溢出 |
| 27 二级 × 3 宽度巡检 | 81 组，overflow / emptyish / errors / bad4xx 全为空 |

## v0.2.0 · 2026-10-23（功能线补齐：一级 7 → 9、二级 0 → 27）

触发：用户「功能线少了太多了，对比下乳腺癌，比如营养，心理，病情指标分析」。对照小粉宝 v0.12.0 的
8 个一级 / 27 个二级逐项比过，结论写在 [docs/FEATURE-GAP-BREAST.md](docs/FEATURE-GAP-BREAST.md)。

### 新增

- **二级导航结构**：一级 7 → 9，二级 0 → 27。宽屏竖排在侧栏、窄屏折成横向滚动条，同一份 DOM 两种形态。
- **指标分析**（新一级）：15 张指标卡按 5 组排列（A 轨肝功能 / 安全线血常规 / B 轨标志物 / 影像测量 / 营养与肌少症）；
  CTCAE v5.0 分级徽章只在 ≥1 级时挂；ALT/AST/总胆红素按 ×ULN 对照，缺参考上限显示「需参考上限」而不给级；
  「分级说明」页写明哪三类刻意不分级（标志物、影像测量、营养三项）。
- **营养与体重**（新一级）：当下困扰 / 进食与体重 / 肌少症线索。三件并列（体重 + 小腿围 + 握力），
  缺项显式标注「缺测」，不补 0、不合成评分、不算 SARC-F。
- **心理与家庭**（新一级）：私密记录默认不进一图秀 / 摘要 / 导出；照护者的记录单独归属 `source='caregiver'`；
  支持资源页明写未接入转介与危机服务；**家属线早筛提醒**分两条并行线（家庭 HBV 防护 + HCC 高危随访），
  只给「距上次检查 N 个月」的客观间隔，不写「你该去查了」、不出风险高低。
- **复诊与回顾**（原「复诊与试验」扩展）：新增「报告与导出」子页，问题可勾选、Markdown 预览、
  导出范围里不含私密记录与家属检查结果。
- **症状记录**从「生活与家庭」挪到「安全线 → 不适与症状」，与血常规并排（表达侧 vs 指标侧，不写因果）。

### 数据与 schema

- `schema/0002_metrics_cbc.sql`（只增不改）：`metric_def` 新增 wbc / anc / hgb / calf / grip 五行（track 分 safety / nutrition）；
  `viewpoint` 新增 `visibility` 列（`shared` / `private`）+ 索引。0001 未改动，sha256 不变。
- 演示数据：两个档案各新增 `cbc`（血常规）与 `mind`（心理记录）、`labRef`（化验单参考上限）；
  血常规与小腿围/握力写入 `metric_reading`，心理记录写入 `viewpoint`（`visibility='private'`）。

### 实测（2026-10-23，无头 Chrome）

| 项 | 结果 |
| --- | --- |
| 页面组合 | 27 个二级 × 3 个宽度（1440 / 1180 / 860）= 81，全部可达 |
| 控制台 | 0 error，0 个 4xx |
| 横向溢出 | 0（修复 1 处：860px 下导出预览 `pre` 撑出 5px；另修 1 处复选框被全局 `input{width:100%}` 拉满导致文字竖排） |
| 单测 | 8/8 通过 |
| 空页 | 0 |

### 已知未做

- 指南出处层（refs.json）与随访节奏层（cadence.json）：需先过 G3。
- 文档解析 / 资料库 / MinerU：属 M5。
- 指标卡翻面看区间：装机版能力，原型只做静态卡。

## v0.1.0 · 2026-10-22（阶段 0 / M1–M4）

阶段：M0 骨架 + M1 调研 + M2 原型 + M3 schema（冻结待签）+ M4 临床库。**G1/G2/G3 均未签认，未开发生产业务，未装机。**

### 新增

- 项目骨架：`xyb-workbench-starter` dsh-wb-cli 1.4.3 init（`business-first`），`npm run check` 基线通过。
- 文档体系：`docs/SPEC.md`、`SCENARIOS.md`（S1–S12）、`PATIENT-FLOW.md`（三条流程）、`DIFF-MATRIX.md`（13 项差异）、`HCC-DOMAIN.md`、`SCHEMA-SPEC.md`、`DEV-REQUIREMENTS-2026-10-22.md`、`CLINICAL-DATA-2026.md`、`DEV-PLAN.md`。
- 任务认领：组织 `.github` issue #10（[认领] 肝细胞癌）。
- 数据模型：`schema/0001_initial.sql`（24 表，双轨实体 + 四契约 + 版本链触发器）+ `schema/freeze-contract.md`（sha256 `2000104d…`）。
- 演示数据：`demo/build-demo-data.mjs`（唯一来源）→ `demo/demo-data.sqlite` + `prototypes/v0.1/demo-data.js`，2 个合成档案、2026-04 至 2026-10 窗口。
- 原型：`prototypes/v0.1/{index.html,style.css,app.js,demo-data.js}`，7 个一级页、双轨一图秀、6 张可翻转指标卡、Agent 面板（25%–45%）。
- 临床库：`research/hcc-cancer/{manifest.json,trials-2026.jsonl,hcc_trials_2026.sqlite,README.md}`，34 条，逐来源终态入库。
- 脚本：`scripts/fetch-hcc-trials-2026.mjs`（支持 `--dry-run` / `--from-raw`）。
- 测试：`test/basic.test.mjs`（schema 建库、演示库一致性、临床库一致性、文案红线）。

### 实测数字（2026-10-22）

| 项 | 结果 |
| --- | --- |
| 一级页 | 7，全部可切，`aria-current` 与内容一一对应 |
| 控制台 | 0 error，0 个 4xx |
| 1440px 溢出 | `body.scrollWidth 1440 === innerWidth 1440` |
| 820px 溢出 | 修复后 `820 === 820`（修复前 1209） |
| 指标卡翻转 | 点击后 `flipped` 为 true |
| Agent 面板 | 打开 504px（35%），主区 700px |
| 演示库 | 2 档案，各表已写入 |
| 临床库 | 34 条，3 个 SUCCESS 通道 |

### 已知缺口

- ICTRP 通道本轮 FAILED；CTV 本地索引仅 1434 条；ChiCTR 只取首屏；CDE 只取 1 页。
- HCC 无专属离线语料（现有语料均为胰腺癌）。
- `dsh/index.js` 与 `lib/client.js` 仍是占位；未接入 DSH，未装机。
- 未建 Git 仓库（等用户授权 push）。

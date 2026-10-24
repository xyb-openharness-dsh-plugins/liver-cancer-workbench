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

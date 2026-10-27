# 疾病概要 · 肝细胞癌

> 本项目实例文件，由 `xyb-workbench-starter` 的 `templates/DISEASE-PRIMER.md` 复制而来。
> 规范：`docs/36-DISEASE-PRIMER.md`。四段固定，未整理也写「本台尚未整理」，**不许删段**。

- 项目 / 品牌：小甘宝 HepPal
- 病种：肝细胞癌（Hepatocellular Carcinoma，HCC）
- 最后更新：2026-10-27（v0.3.7 · 36 号 v2 补齐）
- 数据文件：`prototypes/v0.1/primer-data.js`（`window.DISEASE_PRIMER`）
- 模式层：`prototypes/v0.1/primer.js` / `primer.css` = starter **1.8.1**（§2.5 链接渲染 + 表格 `{text,url}`）
- README 对应段：`## 疾病概要`
- 状态卡：看板首卡 `stageCard()`（`prototypes/v0.1/app.js`，§2.6）

## 0 原件与链接核对（2026-10-27 逐条实测）

§2.5 硬约束：**原件列不允许只写文字**。下表是逐条 `curl` 实测结果，「最终口径」一列与 `primer-data.js` 中的 `LINK` 表一一对应。

| 文件 | 实测 | 最终口径 | 链接 |
|---|---|---|---|
| 《原发性肝癌诊疗指南（2024 年版）》 | `200 application/pdf`，143 页 | **原件已取得**（官方 PDF） | `https://www.nhc.gov.cn/wjw/c100378/202404/910cce13164044b895101236f12093e9/files/1732871166035_91949.pdf` |
| 《原发性肝癌诊疗指南（2022 年版）》 | `200 application/pdf`，124 页 | **原件已取得**（官方 PDF） | `https://www.nhc.gov.cn/yzygj/c100068/202201/1f420b4185444904afe7315594b2e362/files/1732871378900_48829.pdf` |
| BCLC 2022 update（J Hepatol 2022;76(3):681-693） | `200`（PMC 全文） | 未取得期刊原件 · 据 PMC 全文 | `https://pmc.ncbi.nlm.nih.gov/articles/PMC8866082/` |
| AJCC 第 8 版总述（CA Cancer J Clin 2017;67:93-99） | `203`（浏览器可达） | 未取得原书 · 据 PubMed 记录 | `https://pubmed.ncbi.nlm.nih.gov/28094848/` |
| BCLC 官网 | `200` | 官网（非 PDF 原件） | `https://www.bclc.cat/` |
| NCCN · Hepatobiliary Cancers | `200` | 未取得原件（需订阅） | `https://www.nccn.org/guidelines/guidelines-detail?category=1&id=1438` |
| CSCO 原发性肝癌诊疗指南 2024（ISBN 978-7-117-36792-9） | `200` | 未取得原件 · 据人卫社书目页 | `https://www.pmphmall.com/gdsdetail/653497-332094` |
| WHO 消化系统肿瘤分类第 5 版（2019） | `200` | 未取得原件 · 据 IARC 出版页 | `https://publications.iarc.who.int/Book-And-Report-Series/Who-Classification-Of-Tumours/Digestive-System-Tumours-2019` |

**页码不再写「页码待核」的地方**（按本地这两份 PDF 的页脚编号，非估算）：

| 内容 | 2024 版 | 2022 版 |
|---|---|---|
| 三、分期（CNLC Ⅰa–Ⅳ） | P32（图 4） | P22（图 3） |
| （一）外科治疗 | P36 | — |
| （二）消融治疗 | P54 | — |
| （三）经动脉介入治疗 | P61 | — |
| （四）放射治疗 | P72 | — |
| （五）系统治疗 | P78 | — |

`nolink: true` 只用于两处**没有对外 URL**的内部说明行：本文件与 `docs/HCC-DOMAIN.md`，`note` 里写明原因，不是"图省事不写链接"。

## 1 定义（`definition`）

肝细胞癌是起源于肝细胞的恶性肿瘤，属于原发性肝癌的一种。这个病有三条各自独立的线：**肝功能储备、肿瘤负荷、门脉高压**，并列记录，不相加、不互相换算。

- 肝功能储备（A 轨）：白蛋白、总胆红素、INR、腹水、肝性脑病构成 Child-Pugh 的五个成分；ALBI 用白蛋白与胆红素派生。Child-Pugh 评分与分级只存医生记录，本台不重算、不按化验值反推。
- 肿瘤负荷（B 轨）：结节数目、最大径、段位（Couinaud S1–S8）、血管侵犯（Vp0–Vp4）、肝外扩散，以及 AFP / PIVKA-II。血管侵犯记的是癌栓位置，不是肿瘤大小，两者不能互相推算。
- 门脉高压（C 线）：血小板、脾大、食管胃底静脉曲张、腹水各自记录；它不是前两条线的合计项，也不能由肿瘤大小推出来。
- 分期体系至少三套并存：BCLC（0 / A / B / C / D）、CNLC（Ⅰa / Ⅰb / Ⅱa / Ⅱb / Ⅲa / Ⅲb / Ⅳ）、AJCC/UICC TNM（只有切除后才完整）。三套不换算。

- 不写「预后差 / 恶性程度高 / 发展快」这类判读；不写「你的分期属于早期」。
- 亚型与病因（HBV / HCV / 酒精 / MASLD）作为背景维度记录，不当分期变量用。

**来源**：国家卫生健康委 · 原发性肝癌诊疗指南（2024 年版）·「三、肝癌的分期」（CNLC Ⅰa–Ⅳ，图 4）· 2024 年版（国卫办医政函〔2024〕97 号）· [原件已取得 ↗](https://www.nhc.gov.cn/wjw/c100378/202404/910cce13164044b895101236f12093e9/files/1732871166035_91949.pdf) · 页码 P32 ｜ 国家卫生健康委 · 原发性肝癌诊疗指南（2022 年版）·「三、分期」· 2022 年版（国卫办医函〔2022〕12 号）· [原件已取得 ↗](https://www.nhc.gov.cn/yzygj/c100068/202201/1f420b4185444904afe7315594b2e362/files/1732871378900_48829.pdf) · 页码 P22 ｜ BCLC · BCLC 2022 update（Reig 等，J Hepatol 2022;76(3):681-693）· 2022 · [未取得原件，据 PMC 全文 ↗](https://pmc.ncbi.nlm.nih.gov/articles/PMC8866082/) · 页码待核 ｜ AJCC / UICC · AJCC Cancer Staging Manual, 8th ed.（肝细胞癌章节）· 第 8 版（2017）· [未取得原件，据 PubMed 记录 ↗](https://pubmed.ncbi.nlm.nih.gov/28094848/) · 页码待核

## 2 医学资料规范和指南情况（`evidence`）


| 机构 | 文件 | 版本 / 年份 | 原件 | 本台的用途 |
|---|---|---|---|---|
| 国家卫生健康委 | 原发性肝癌诊疗指南（2024 年版） | 2024 年版（国卫办医政函〔2024〕97 号，2024-03-21） | [已取得（官方 PDF，143 页）↗](https://www.nhc.gov.cn/wjw/c100378/202404/910cce13164044b895101236f12093e9/files/1732871166035_91949.pdf) | 国内分期（CNLC）与治疗各论的出处；页码按这份 PDF 的页脚编号 |
| 国家卫生健康委 | 原发性肝癌诊疗指南（2022 年版） | 2022 年版（国卫办医函〔2022〕12 号，2022-01-10） | [已取得（官方 PDF，124 页）↗](https://www.nhc.gov.cn/yzygj/c100068/202201/1f420b4185444904afe7315594b2e362/files/1732871378900_48829.pdf) | CNLC 2022 分期的原始出处；「三、分期」在 P22，分期图是「图 3」 |
| BCLC | BCLC 2022 update（Reig 等，J Hepatol 2022;76(3):681-693） | 2022 | [未取得原件，据 PMC 全文 ↗](https://pmc.ncbi.nlm.nih.gov/articles/PMC8866082/) | 记录医生写的 BCLC 期别（0 / A / B / C / D），不换算 |
| BCLC（官网） | BCLC 分期体系与治疗策略图 | 以打开当日页面为准 | [官网（非 PDF 原件）↗](https://www.bclc.cat/) | 仅用于确认分期体系的分级名称，不引用其推荐条文 |
| AJCC / UICC | AJCC Cancer Staging Manual, 8th ed.（肝细胞癌章节） | 第 8 版（2017） | [未取得原件，据 PubMed 记录 ↗](https://pubmed.ncbi.nlm.nih.gov/28094848/) | 记录 pTNM 原文；只有切除后才完整 |
| NCCN | NCCN Guidelines · Hepatobiliary Cancers | 版本以打开当日页面为准（2026-10-27 核对） | [未取得原件（需订阅），据指南页 ↗](https://www.nccn.org/guidelines/guidelines-detail?category=1&id=1438) | 仅作外部对照，不作为本台的分期或路径依据 |
| CSCO | CSCO 原发性肝癌诊疗指南 2024 | 2024（ISBN 978-7-117-36792-9，2024-09-10） | [未取得原件，据人卫社书目页 ↗](https://www.pmphmall.com/gdsdetail/653497-332094) | 仅作外部对照；本台未采用其分级口径 |
| WHO / IARC | WHO Classification of Tumours · Digestive System Tumours, 5th ed. | 第 5 版（2019） | [未取得原件，据 IARC 出版页 ↗](https://publications.iarc.who.int/Book-And-Report-Series/Who-Classification-Of-Tumours/Digestive-System-Tumours-2019) | 病理分类名称的出处；本台不记录组织学分级判断 |

- 一台一表，不合并。
- **未取得原件的，表里逐行标出**，只写「存在、大致讲什么」，不引用具体条文。
- BCLC 与 CNLC 两套分期并存时两行都列，**本表内不做换算**；AJCC/UICC TNM 同样不换算。
- 原件列按 §2.5 一律可点：取得原件的给官方 PDF，没取得的给二次来源；缺失时模式层会红字标「违反 36 号 §2.5」。

**来源**：见上表逐行 ｜ 本项目 · `docs/DISEASE-PRIMER.md`（原件状态与待核项台账，2026-10-27）· `nolink`（本仓内部文件，无对外 URL）

## 3 目前治疗全景概要（`landscape`）

按**可切除性 / 线序**分组，每组只列「指南列举过的手段类别」，不排序、不比优劣。

### 3.1 局限期（可切除时）

- 手术切除：记录术式、切缘、病理（分化、MVI）与残肝比例；切缘按报告原文记 R0 / R1 / R2，本台不改写、不解读。
- 消融（RFA / MWA）：记录次数与部位。
- 移植评估：只记录评估结论与评估日期，不做移植后管理。

### 3.2 不可切除 / 局部晚期

- TACE / HAIC：记录次数、起止日期与栓塞后事件（发热、腹痛、恶心）。
- 钇-90（TARE）与放疗：按方案原文记录，不把不同照射方式合并成一行。
- 系统治疗：靶向、免疫、联合方案各自记录方案名、周期、疗效原文与肝毒性；本台不判断换药或停药。

### 3.3 贯穿全程

- 转化治疗：intent 记为 conversion，每次可切除性评估新增一行，前后两次并列保存，不合并成「已转化」。
- 抗病毒与再激活监测：HBV 背景者记录抗病毒药名与开始日期、DNA 由阴转阳的日期，与免疫/激素/化疗时间对齐。
- 肝功能与门脉高压随访：各指标各自成线；食管胃底静脉曲张与腹水单独记录，不并入肿瘤负荷。

**这一段末尾的固定出口（原话照抄，没有改写）：**

> 以上是文献与指南里列出的手段，按病期与线序排列，不代表任何一项适合你。选哪一个，这一句需要问你的医生。

**来源**：国家卫生健康委 · 原发性肝癌诊疗指南（2024 年版）· 治疗各论（一）外科治疗 / （二）消融治疗 / （三）经动脉介入治疗 / （四）放射治疗 / （五）系统治疗 · 2024 年版 · [原件已取得 ↗](https://www.nhc.gov.cn/wjw/c100378/202404/910cce13164044b895101236f12093e9/files/1732871166035_91949.pdf) · 页码 P36 / P54 / P61 / P72 / P78 起 ｜ BCLC · BCLC 2022 update · 2022 · [未取得原件，据 PMC 全文 ↗](https://pmc.ncbi.nlm.nih.gov/articles/PMC8866082/) · 页码待核（仅对照分组名称，未引用条文）

## 4 发展趋势（`trend`）

只写**已发生的事实**，每条都带日期或版本号。这一段是全条最容易越界的地方，白名单外的一个形容都不写。

1. **指南版本更替（国内）** —— 2017-06 原国家卫生计生委医政医管局颁布《原发性肝癌诊疗规范（2017 年版）》；2019-12、2021-12 两次更新，形成 2019 年版与《原发性肝癌诊疗指南（2022 年版）》；2024-03-21 国卫办医政函〔2024〕97 号印发 **2024 年版**（现行版本，本台已取得官方 PDF，143 页）。沿革见 2024 年版指南 P1–P2。
2. **指南版本更替（国际）** —— 2022 年 BCLC 发表 2022 版更新（Reig 等，J Hepatol 2022;76(3):681-693），为 BCLC 分期体系的现行版本记录。
3. **分类体系更新** —— 2019 年 WHO 消化系统肿瘤分类第 5 版出版（IARC），取代第 4 版（2010）。
4. **专著出版** —— 2024-09-10 CSCO《原发性肝癌诊疗指南 2024》出版（ISBN 978-7-117-36792-9）。
5. **在研登记规模与阶段分布** —— 本台尚未完成临床试验登记平台检索采集，暂无登记数量与阶段分布可报；补齐前不写任何数字。
6. **监管批件 / 指南结构变化** —— 本台尚未整理：没有逐条核对原件章节变化，不写。

**来源**：国家卫生健康委 · 原发性肝癌诊疗指南（2024 年版）· 一、概述（版本沿革）· 2024 年版 · [原件已取得 ↗](https://www.nhc.gov.cn/wjw/c100378/202404/910cce13164044b895101236f12093e9/files/1732871166035_91949.pdf) · 页码 P1–P2 ｜ 国家卫生健康委 · 原发性肝癌诊疗指南（2022 年版）·「三、分期」· 2022 年版 · [原件已取得 ↗](https://www.nhc.gov.cn/yzygj/c100068/202201/1f420b4185444904afe7315594b2e362/files/1732871378900_48829.pdf) · 页码 P22 ｜ BCLC · BCLC 2022 update · 2022 · [未取得原件，据 PMC 全文 ↗](https://pmc.ncbi.nlm.nih.gov/articles/PMC8866082/) · 页码待核 ｜ WHO / IARC · Digestive System Tumours, 5th ed. · 第 5 版（2019）· [未取得原件，据 IARC 出版页 ↗](https://publications.iarc.who.int/Book-And-Report-Series/Who-Classification-Of-Tumours/Digestive-System-Tumours-2019) ｜ CSCO · CSCO 原发性肝癌诊疗指南 2024 · 2024 · [未取得原件，据人卫社书目页 ↗](https://www.pmphmall.com/gdsdetail/653497-332094) ｜ 本项目 · `docs/HCC-DOMAIN.md`（2026-10-22）· `nolink`（本仓内部文件，无对外 URL）

## 5 落地清单

- [x] `prototypes/v0.1/primer.css`（starter **1.8.1** 原样复制，含 `.dp-link` / `.dp-miss`）
- [x] `prototypes/v0.1/primer.js`（starter **1.8.1** 原样复制，含 §2.5 链接渲染）
- [x] `prototypes/v0.1/primer-data.js`（本文件四段转成 `window.DISEASE_PRIMER`，新版 schema：`url` / `secondaryUrl` / `nolink` / `note` / 表格 `{text,url}`）
- [x] `index.html` 三处引用：`<link rel="stylesheet" href="primer.css">` / `<script src="primer-data.js">` / `<script src="primer.js">`
- [x] 顶栏出现「?」（模块自动插进 `.top-actions`，未手写按钮）
- [x] 看板首卡状态卡四件（`stageCard()`，锚点派生不手填，空态指向三步初始化）+ 副按钮 `疾病概要：肝细胞癌是什么？`
- [x] README 的 `## 疾病概要` 四段正文写好，小标题与数据文件一致
- [x] `NODE_OPTIONS= node scripts/probe-disease-primer.mjs --port 8143 --url http://127.0.0.1:8143/prototypes/v0.1/index.html` 10/10 全绿

## 6 验收（P1–P9 + E0）

实测命令（端口 8143，串行）：

```
cd liver-cancer-workbench && NODE_OPTIONS= node scripts/probe-disease-primer.mjs \
  --port 8143 --url http://127.0.0.1:8143/prototypes/v0.1/index.html
```

| 编号 | 判据 | 结果 |
|---|---|---|
| P1 | 顶栏有可点「?」，aria-label 说明四段 | PASS（text="?"，label 含「定义」「趋势」） |
| P2 | 整页面板，四段齐全且顺序为 定义 → 指南 → 治疗全景 → 趋势 | PASS（definition › evidence › landscape › trend） |
| P3 | 面板宽高 ≥ 视口 90% | PASS（1249×829 / 视口 1280×860） |
| P4 | 打开压一条 history，`history.back()` 收起 | PASS（history.length=3，返回后 open=false） |
| P5 | 「返回」「关闭」两个独立可见入口 | PASS（back=true close=true same=false） |
| P6 | 关闭后焦点回触发按钮、滚动位置不变 | PASS（focusOnTrigger=true，scrollY 260→260） |
| P7 | Esc 只退一层 | PASS（open=false，URL 仍在本页） |
| P8 | 四段齐全、每段有来源、趋势段无禁止词 | PASS |
| P9 | 排版对齐：正文/列表/表格/来源行同左基线，右边界极差 ≤2px | PASS（1440 / 900 / 390 三档均对齐） |
| E0 | 页面无 JS 报错、无 console error | PASS |

合计 **10/10 PASS**。同一命令加 `--self-test` 后实测 **7/10（P3 / P5 / P8 报红）**，闸门确实会报红，不是只报绿。

面板另做一次 DOM 实测（截图 + `querySelectorAll`）：**20 个可点 `dp-link`、0 个 `dp-miss` 红标**，四段顺序 `definition › evidence › landscape › trend` 与数据文件一致。

## 7 本项目教训

1. **「两条轴不加总」不只是文案，是字段设计**：写定义时差点写成「综合评估肝功能与肿瘤负荷」，这一句等于把两条轴合成一个分数，正是本项目 `docs/HCC-DOMAIN.md` 明令禁止的。改成「三条线并列，各自记录」才落回解释层。
2. **BCLC 与 CNLC 差点被写成可换算**：初稿写过「BCLC B 约相当于 CNLC IIb」，这句在原文里找不到，且会造出一个医生没给过的期别。最终两行并列、各自标出处、不换算。
3. **版本号一个都查不到 → 现在查到了，而且必须写页码**：v0.3.6 时代只有 `CNLC 2022` 有年份，BCLC / AJCC / NCCN 全无版本记录，所以写「版本未核实」。v0.3.7 把卫健委两份官方 PDF 抓下来后，页码改成**页脚实测值**（分期 P32 / P22，治疗各论 P36–P78），不再写「页码待核」。
4. **`200` 不等于「可达」，PMID 也可能张冠李戴**：AJCC 那条原写作 `PMID 28294283`，实测打开是《Orthostatic Hypotension and Falls》（J Am Geriatr Soc 2017），与 AJCC 无关；DOI `10.1007/978-3-319-40618-3` 会 200 重定向到 Springer 的 `deleted` 页。链接必须**点开看内容**，不能只看状态码。
5. **「原件已取得」与「据二次来源」要分开计**：本台拿到两份卫健委 PDF，就说「已取得」；BCLC / AJCC / NCCN / CSCO / WHO 没拿到，逐行写「据 PMC 全文 / PubMed 记录 / 书目页」。把整台都写成「未取得原件」，等于把真拿到的那两份也一并否认掉。
6. **状态卡的两条纪律要写进代码，不是只写进文档**：锚点从档案日期派生（否则天数会变成手填的装饰数字）、「下次」只取用户自己记下的未完成安排（否则等于拿指南周期替用户排期）。现状行与大字天数必须同源，否则会出现「天数按 A 算、阶段按 B 写」。
7. **`grep` 的 `\|` 在 macOS 上是静默失败**：本轮两次被它骗过——一次以为样式没写进 `style.css`（其实写了），一次以为 `stage-card` 零命中。要或匹配就用 `grep -E`。


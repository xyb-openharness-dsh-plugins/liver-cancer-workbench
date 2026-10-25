# 疾病概要 · 肝细胞癌

> 本项目实例文件，由 `xyb-workbench-starter` 的 `templates/DISEASE-PRIMER.md` 复制而来。
> 规范：`docs/36-DISEASE-PRIMER.md`。四段固定，未整理也写「本台尚未整理」，**不许删段**。

- 项目 / 品牌：小甘宝 HepPal
- 病种：肝细胞癌（Hepatocellular Carcinoma，HCC）
- 最后更新：2026-10-25
- 数据文件：`prototypes/v0.1/primer-data.js`（`window.DISEASE_PRIMER`）
- README 对应段：`## 疾病概要`

## 1 定义（`definition`）

肝细胞癌是起源于肝细胞的恶性肿瘤，属于原发性肝癌的一种。这个病有三条各自独立的线：**肝功能储备、肿瘤负荷、门脉高压**，并列记录，不相加、不互相换算。

- 肝功能储备（A 轨）：白蛋白、总胆红素、INR、腹水、肝性脑病构成 Child-Pugh 的五个成分；ALBI 用白蛋白与胆红素派生。Child-Pugh 评分与分级只存医生记录，本台不重算、不按化验值反推。
- 肿瘤负荷（B 轨）：结节数目、最大径、段位（Couinaud S1–S8）、血管侵犯（Vp0–Vp4）、肝外扩散，以及 AFP / PIVKA-II。血管侵犯记的是癌栓位置，不是肿瘤大小，两者不能互相推算。
- 门脉高压（C 线）：血小板、脾大、食管胃底静脉曲张、腹水各自记录；它不是前两条线的合计项，也不能由肿瘤大小推出来。
- 分期体系至少三套并存：BCLC（0 / A / B / C / D）、CNLC 2022（Ia / Ib / IIa / IIb / IIIa / IIIb / IV）、AJCC/UICC TNM（只有切除后才完整）。三套不换算。

- 不写「预后差 / 恶性程度高 / 发展快」这类判读；不写「你的分期属于早期」。
- 亚型与病因（HBV / HCV / 酒精 / MASLD）作为背景维度记录，不当分期变量用。

**来源**：BCLC · Barcelona Clinic Liver Cancer 分期体系 · 版本未核实 · 未取得原件，据二次来源 · 页码待核 ｜ CNLC · 中国肝癌分期 CNLC 2022 · 2022 · 未取得原件，据二次来源 · 页码待核 ｜ AJCC / UICC · TNM 分期（肝细胞癌章节）· 版本未核实 · 未取得原件，据二次来源 · 页码待核

## 2 医学资料规范和指南情况（`evidence`）

| 机构 | 文件 | 版本 / 年份 | 原件 | 本台的用途 |
|---|---|---|---|---|
| BCLC | Barcelona Clinic Liver Cancer 分期体系 | 版本未核实 | 未取得原件 | 记录医生写的 BCLC 期别（0 / A / B / C / D），不换算 |
| CNLC | 中国肝癌分期 CNLC 2022 | 2022 | 未取得原件 | 记录医生写的国内分期（Ia–IV），与 BCLC 两行并列 |
| AJCC / UICC | TNM 分期（肝细胞癌章节） | 版本未核实 | 未取得原件 | 记录 pTNM 原文；只有切除后才完整 |
| NCCN | NCCN Guidelines · Hepatocellular Carcinoma | 版本未核实（本项目未采用其分期口径） | 未取得原件 | 仅作外部对照，不作为本台的分期或路径依据 |

- 一台一表，不合并。
- **未取得原件的，表里逐行标出**，只写「存在、大致讲什么」，不引用具体条文。
- BCLC 与 CNLC 两套分期并存时两行都列，**本表内不做换算**；AJCC/UICC TNM 同样不换算。

**来源**：见上表逐行。

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

**来源**：CNLC · 中国肝癌分期 CNLC 2022（2022）· 未取得原件，据二次来源 · 页码待核 ｜ BCLC · Barcelona Clinic Liver Cancer 分期体系（版本未核实）· 未取得原件，据二次来源 · 页码待核

## 4 发展趋势（`trend`）

只写**已发生的事实**，每条都带日期或版本号。

1. **指南版本更替** —— 本台尚未整理。本项目未取得 NCCN / CSCO 肝癌指南原件，在本项目 docs 与原型源码里也没有查到版本号与生效日期，因此不列条目。
2. **监管批件** —— 本台尚未整理：没有可核对的批件号与批准日期，不写。
3. **在研登记规模与阶段分布** —— 本台尚未整理：登记平台检索尚未采集，补齐前不写任何数字。
4. **分类体系更新** —— 2022 年：本项目记录的分期口径为 CNLC 2022（Ia / Ib / IIa / IIb / IIIa / IIIb / IV），依据 `docs/HCC-DOMAIN.md`。
5. **指南结构变化** —— 本台尚未整理：没有原件，章节变化无从核对。

**来源**：CNLC · 中国肝癌分期 CNLC 2022（2022）· 未取得原件，据二次来源 · 页码待核 ｜ 本项目 · `docs/HCC-DOMAIN.md`（2026-10-22）· 一手项目记录

## 5 落地清单

- [x] `prototypes/v0.1/primer.css`（从 `assets/patterns/disease-primer.css` 复制，未改结构，颜色走项目令牌 + 兜底）
- [x] `prototypes/v0.1/primer.js`（从 `assets/patterns/disease-primer.js` 复制，未改逻辑）
- [x] `prototypes/v0.1/primer-data.js`（本文件四段转成 `window.DISEASE_PRIMER`）
- [x] `index.html` 三处引用：`<link rel="stylesheet" href="primer.css">` / `<script src="primer-data.js">` / `<script src="primer.js">`
- [x] 顶栏出现「?」（模块自动插进 `.top-actions`，未手写按钮）
- [x] README 的 `## 疾病概要` 四段正文写好，小标题与数据文件一致
- [x] `node scripts/probe-disease-primer.mjs --url <原型地址>` 全绿

## 6 验收（P1–P8）

实测命令（端口 8134，串行）：

```
cd liver-cancer-workbench && NODE_OPTIONS= node scripts/probe-disease-primer.mjs \
  --port 8134 --url http://127.0.0.1:8134/prototypes/v0.1/index.html
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
| E0 | 页面无 JS 报错、无 console error | PASS |

合计 **9/9 PASS**。同一命令加 `--self-test` 后实测 **6/9（P3 / P5 / P8 报红）**，闸门确实会报红，不是只报绿。

## 7 本项目教训

1. **「两条轴不加总」不只是文案，是字段设计**：写定义时差点写成「综合评估肝功能与肿瘤负荷」，这一句等于把两条轴合成一个分数，正是本项目 `docs/HCC-DOMAIN.md` 明令禁止的。改成「三条线并列，各自记录」才落回解释层。
2. **BCLC 与 CNLC 差点被写成可换算**：初稿写过「BCLC B 约相当于 CNLC IIb」，这句在原文里找不到，且会造出一个医生没给过的期别。最终两行并列、各自标出处、不换算。
3. **版本号一个都查不到**：本项目 docs 与原型源码里只有 `CNLC 2022` 有年份，BCLC / AJCC / NCCN 全无版本记录。按规范写「版本未核实」而不是去外部补一个看似合理的数字——元数据表里那两个「版本未核实」是查证结果，不是偷懒。

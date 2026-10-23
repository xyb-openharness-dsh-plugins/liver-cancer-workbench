# 导入链路 · 设计取舍与已知局限

- 版本：v0.3.2（2026-10-24）
- 代码：`import/`（4 个模块）+ `scripts/import-doc.mjs`（命令行）+ `dsh/api.js` 两条只读路由
- 单测：`test/import.test.mjs`（25 条）、`test/store.test.mjs`（13 条）
- **已回流脚手架**：`xyb-workbench-starter/docs/29-DOCUMENT-IMPORT-PIPELINE.md`（五段流水线、三级闸门、IM01–IM14 验收）。
  本文件是小甘宝的具体实现与踩坑记录；脚手架那份是换病种可照做的通用规则，改通用部分请改脚手架。

## 1. 这条链路解决什么

用户手上是一堆 PDF 和照片：外院化验单、影像报告、穿刺病理。要进工作台，必须变成 `metric_reading`。

但「读出来」和「读对」是两件事。一次真实试跑（2026-10-24，`docs/IMPORT-TEST-2026-10-24.md`）里，
一份扫描件抽出来是**胰腺**穿刺病理。如果按「病理报告」直接解析，它会带着整套腺鳞 IHC panel
落进肝的 A 轨和 B 轨——**数据一旦写进去，后面每个视图都在错的基线上算，而且看不出错**。

所以这条链路的第一原则不是"读得多"，是**先判断该不该读**。

## 2. 五段流水线

```
buffer ──► ① sniff ──► ② 取行 ──► ③ 闸门 ──► ④ 抽候选 ──► ⑤ 落库
          类型/指纹     文本层切分   部位+指标组合   PATTERNS     document/candidate
          有无文本层    /喂 OCR 结果  accept|reject  candidate    （不含 metric_reading）
```

| 段 | 文件 | 只做一件事 | 不做 |
| --- | --- | --- | --- |
| ① sniff | `import/sniff.mjs` | 类型、字节、sha256、有没有文本层 | 不 OCR、不解析 |
| ② 取行 | `import/pipeline.mjs` | 纯文本切行 / 接收外部 OCR 行 | 不自己跑 OCR |
| ③ 闸门 | `import/guard.mjs` | 判病种，给出 accept / reject / needs_review | 不抽任何数值 |
| ④ 抽候选 | `import/extract.mjs` | 产 `candidate`（带置信度与原文） | 不写库、不给结论 |
| ⑤ 落库 | `import/store.mjs` | 写 document + candidate；确认后才写 reading | 不自动确认 |

## 3. 三个关键判断，以及为什么这么定

### 3.1 扫描件必须走 OCR，而"文本层"判据要保守

`pypdf` 对扫描件返回 **0 字符且不报错**。这意味着"抽取成功、内容为空"会被当成"这份报告没东西"。
`pdfHasTextLayer()` 因此要求**同时**出现字体资源（`/Font`）与文字绘制算子（`Tj` / `TJ` / `Tf`），
两者缺一即判"无文本层"，交给 OCR。宁可多跑一次 OCR，不能静默丢内容。

本机没有 JS 版 OCR 引擎，所以 `decide()` 在扫描件且未提供行时返回 `needs_lines`，
`document.status = pending_parse`，理由写明"扫描件需要先做 OCR"。**不假装解析成功。**

### 3.2 闸门有两条证据线，且原发灶优先于词频

| 顺序 | 证据 | 判定 |
| --- | --- | --- |
| ① | 原发灶措辞（`胰腺癌` / `胃癌` / `结直肠癌`…） | 直接 `reject_out_of_domain` |
| ② | 部位词（`肝右叶` / `胰腺`…）计分 | 肝占优 → accept；他器官占优 → reject；打平或过少 → 看 ③ |
| ③ | 指标组合（白蛋白/胆红素/INR/血小板/ALT/AST/AFP/PIVKA-II，≥2 项） | 够 → accept（`via: 'panel'`）；不够 → needs_review |

两条线各自解决一个真问题：

- **为什么需要 ③**：外院化验单通常一个器官名都没有，只写"检验报告"。
  实测一份正常肝功能 + AFP 的化验单，按 ② 判是"没有部位线索"，会被整份挡掉——用户第一次用就卡死。
- **为什么原发灶优先**：`胰腺癌肝转移` 按词频算，肝出现 2 次、胰腺 1 次，会判成肝癌。
  但这明明是胰腺原发，属于"别家病种"。所以先认 `X癌` 这种原发措辞，命中非肝器官直接拒收，
  理由里明写"文中提到肝，应为转移灶，不按肝癌处理"。

`probeFields()` 是 ③ 的实现：它只回答"出现了哪些指标名"，**数值、原文、置信度全部丢弃**。
这不是"先解析再审查"——accept 之后才正式跑 `extractCandidates()`。

### 3.3 候选不是指标，确认是人的动作

`candidate` 与 `metric_reading` 分表，中间隔着一次显式确认（`acceptCandidate`）。

| 规则 | 原因 |
| --- | --- |
| 只有 `NUMERIC_FIELDS` 里的字段能确认 | 部位、诊断是文本，写进趋势表就没有单位也没有可比性 |
| 没有测量日期不许确认 | 不拿 `uploaded_at` 顶替。拿上传时间当测量时间，趋势图会多出假时点，且看不出来 |
| 同一天同指标已有记录则拒绝 | 两次导入同一份化验单会撞车；宁可报错让人选，不静默覆盖医生的旧记录 |
| 确认时必须写 `source_doc_id` | 每个趋势点都要能点回原件。这是这套工作台"不信结论、只给依据"的底线 |
| 全部候选处理完 `document.status` 才转 `parsed` | `parsed` 的含义是"人已经看过了"，不是"机器解析成功" |

## 4. 状态机（`document.status`）

| 闸门结论 | status | 含义 | 用户该做什么 |
| --- | --- | --- | --- |
| `accept` | `pending_review` | 已抽候选，等人逐条确认 | 去「导入」里确认或退回 |
| `reject_out_of_domain` | `parse_failed` | 别的病种，一行候选都没写 | 不用管，或传对病种的材料 |
| `needs_review` | `pending_parse` | 判不了，文件本身是好的 | 自己看原文判断 |
| `needs_lines` | `pending_parse` | 没有文字层，等 OCR | 换清晰照片 / 补文字识别 |

`needs_review` 从 `pending_review` 改成 `pending_parse` 是这一轮的修正：
一个候选都没有却显示"待确认"，用户点进去是空列表，会以为功能坏了。

## 5. 用法

```bash
# 扫描件：先给 OCR 结果（本机 macOS Vision 脚本产出 json，或 conf\ty\ttext 的 tsv）
node scripts/import-doc.mjs 报告.pdf --profile p1 --db <库路径> \
  --ocr 报告.ocr.json --kind pathology --date 2023-01-09

# 纯文本 / 电子化验单
node scripts/import-doc.mjs 化验单.txt --profile p1 --db <库路径> --kind lab --date 2026-10-20

# 只看判定不写库
node scripts/import-doc.mjs 报告.pdf --profile p1 --db <库路径> --ocr 报告.ocr.json --dry-run
```

退出码：`0` 已导入待确认 · `3` 部位不符已拒收 · `4` 需要先做文字识别 · `2` 参数错 · `1` 其他异常。

只读路由（界面用）：

- `GET /api/liver-cancer-workbench/documents?profile=p1` — 导入队列（文件 + 状态 + 候选计数，不含候选内容）
- `GET /api/liver-cancer-workbench/candidates?doc=12` — 某文件的候选清单

## 6. 已知局限（不要当成已解决）

1. **没有 HTTP 上传通道**。API 是只读读模型（`dsh/guard.js` 只放行 GET），写入走本机脚本。
   装机后要不要开上传，取决于桌面壳提供什么通道，现在不预设。
2. **OCR 不在 Node 里**。macOS 侧用 Vision 脚本，换平台要另接引擎。链路本身与引擎解耦（只吃行数组）。
3. **原发灶识别是关键词，不是语义**。`排除胰腺癌` 这类否定句也会命中。方向是保守的（拒收），
   理由会写进 `parse_note`，用户能看到并绕过；但不等于判对了。
4. **`cm` 不换算成 `mm`**。`直径 0.1cm` 不会产生 `max_diameter` 候选。宁可少一条，不替用户做单位换算。
5. **`前白蛋白` / `直接胆红素` 用后行断言排除**，但同类指标还有别的写法（如英文缩写 PALB、DBIL）尚未覆盖。
6. **没有「导入」视图**。路由与落库已就绪，界面还没接——这是下一轮的事。
7. **候选的原文行没有落库**。`extractCandidates()` 每条都带 `sourceLine`，但 `candidate` 表没有对应列，
   目前只在命令行输出里看得到。真要做逐条确认，需要 `0004` 加一列 `source_line`——
   否则"确认这条"时用户只能看到一个数字，没有原文可核对，这就违背了"只给依据"的底线。

## 7. 下一轮

- `0004_candidate_source.sql`：给 `candidate` 加 `source_line`，让确认界面能显示原文
- 前端加第 10 个视图「导入」：队列 + 候选逐条确认/退回，把上面两条路由用起来
- `scripts/` 补 `check-schema` / `check-wording` / `check-version`，补齐阶段 2 六步的第 5 步

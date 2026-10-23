# 导入链路测试 · 扫描件病理报告（2026-10-24）

> 目的：在写 `0003_import.sql` 之前，先拿一份真实扫描件跑一遍，确认「能不能读出来 / 读出来往哪放 / 不该放的怎么拒」。
> 样本不入户：PDF 与原始 OCR 留在 `input/import-tests/`（已 gitignore），仓库里只有脱敏后的证据
> `research/import-tests/bingli1.ocr.json`。

## 1. 样本特征

| 项 | 实测 |
| --- | --- |
| 文件 | 1 页 PDF，286 KB，Producer = macOS Quartz PDFContext |
| **pypdf 抽取** | **0 字符**（纯扫描图像，没有任何文本层） |
| 页面尺寸 | 1024 × 1137（放大约 2400 px 后 OCR） |
| 内容类型 | 病理报告（肉眼所见 / 病理诊断 / 再发报告 / 免疫组化） |
| 隐私情况 | 姓名、病案号已涂黑；病理号处有红色印章；含取材与诊断医生姓名、医院电话与地址 |

**结论一：扫描件不能靠"文本抽取"那条路。** `pypdf` 返回 0 字符，任何"读 PDF 文本 → 正则取数"的实现
在这类文件上都是静默失败（不报错、拿到空串）。导入必须先判「有文本层吗」，没有就走 OCR，
并把 `document.status` 置为 `pending_parse` 而不是 `parsed`。

## 2. 用的是什么 OCR

macOS 自带 Vision（`VNRecognizeTextRequest`，`accurate`，`zh-Hans + en-US`），**本地离线、不上传**。
31 行文本，平均置信度 0.62，其中 4 行 < 0.50。

> 这是**验证手段**，不是产品方案。产品侧仍按脚手架 `docs/18-MINERU-PARSING.md` 接 MinerU；
> 本次用本地 OCR 是为了在拿不到 Token 时也能把"字段怎么落"这件事先想清楚。

## 3. 抽出来的关键信息与落点判定

| OCR 得到的信息 | 落到哪 | 判定 |
| --- | --- | --- |
| 病变部位：**胰腺** | —— | **拒收**。HCC 工作台的 A/B 轨固定是肝，schema 也没有 `site` 字段 |
| 样本类型：穿刺 | `document.kind = 'pathology'` | 可落（kind 枚举里就有 pathology） |
| 病理诊断：查见肿瘤 → 再发「浸润性癌，大部分呈鳞状分化，灶区伴腺样分化」 | `document` 原文 + `candidate(field='pathology_diagnosis')` | 只能进事实层，**不能直接写进 `tumor_assessment`** |
| 免疫组化 9 项（CK-Pan / CK7 / CK19 / CD56 / CgA / Ki-67 40% / Syn / MUC-1 / p40） | `candidate` 逐项 | HCC 的 panel 是 GPC3 / Arginase-1 / HSP70 / GS，这套是腺鳞 panel——**又一次印证域外** |
| 三个日期：医嘱执行 2023-01-11、取材 2023-01-09、报告 2023-01-10 11:46 | `document.doc_date` 只能放一个 | 需在 candidate 里区分 `event_date` 与 `issued_at`，**不能都塞 `measured_on`** |
| 病理号（红章处） | 无字段 | 用 `document.title` 带出、或 `candidate(field='accession_no')`；**不必加表** |
| 医院名 / 电话 / 地址 / 邮编 | **不入库** | 隐私；展示层最多写"来源单位：三甲医院" |

**结论二：schema 不用为这次改动。** `document.kind` 已有 `pathology`、`status` 已有 `parse_failed`、
`candidate` 已有 `confidence` 与 `status(pending/accepted/rejected)`——够用。
真正缺的是**代码层的导入闸门**：先判部位与病种，再谈解析。加表解决不了"把胰腺报告塞进肝的 A 轨"这种错。

## 4. OCR 的可信度必须当闸门用

两处只有真跑才会暴露：

1. **低置信行是噪声，不是数据**：`报餅可。`（0.30）来自红色印章与打印字重叠，属垃圾串。
   低于阈值的行只能作为"待人工确认的原文片段"展示，**不得自动写入记录表**。
2. **同一句读两遍才对上**：初次目视速读把「大部分呈腺样分化」读成腺样/黏液，OCR 报的是
   **「鳞状分化 + 灶区腺样分化」**；放大到 2400 px 重跑结果一致，且被 `p40(部分+)` 交叉印证——
   **目视速读不能当字段来源，OCR 之间的一致性 + 免疫组化互证才算。**
   这类"看起来通顺所以像对的"错误，正是产品最该防的。

## 5. 下一步（写进 0003 之前的清单）

1. `import/` 三个函数：`sniff(file)` 判有无文本层与文件类型 → `ocr()` → `extract()` 产 candidate。
2. **导入闸门**：`site/domain` 不匹配 → `document.status = 'parse_failed'` + 理由「部位=胰腺，不属于肝细胞癌工作台」，
   候选一行不写。宁可空手，不要污染。
3. 阈值：`confidence < 0.5` 的候选强制 `status='pending'` 且界面单独列出"这几行没把握"。
4. 日期三义（事件 / 报告 / 录入）必须在 candidate 层分开，落库前由人确认。
5. 病理号与医院信息默认不展示、不导出。

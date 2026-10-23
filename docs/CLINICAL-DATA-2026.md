# CLINICAL-DATA-2026 · 肝细胞癌临床试验库

日期：2026-10-22。数据截止：2026-10-22（在线检索时刻）。
采集入口：`unified-trial-mcp` v0.3.1（`~/Downloads/unified_search_trials`），脚本 `scripts/fetch-hcc-trials-2026.mjs`。

## 1. 检索口径

```json
{ "condition": "肝细胞癌",
  "keywords": ["hepatocellular carcinoma", "HCC", "liver cancer"],
  "maxResults": 200 }
```

相关性判定：标题含「肝细胞癌/肝癌/HCC/hepatocellular/hepatoma」→ `direct`；仅适应症列表提及 → `indication_only`；两者都无 → 丢弃。

## 2. 逐来源终态（落库 `source_status`）

| 来源 | 终态 | 返回 | 说明 |
| --- | --- | --- | --- |
| `chinadrugtrials`（CDE） | SUCCESS | 20 | 受控归档；上游报告 16 页约 308 条，**本次只取第 1 页**，已截断 |
| `chictr_online`（ChiCTR 在线） | SUCCESS | 10 | 在线首屏结果，受 WAF 与限流约束，不等同全量 |
| `xyb_chinadrugtrials_archive`（小胰宝归档） | SUCCESS | 5 | **胰腺癌语料**，对 HCC 属部分覆盖；数据截止 2026-09-29 |
| `chictr_pancreatic_archive` | NEEDS_SETUP | — | 路径未配置；且是胰腺癌语料，对 HCC **无覆盖** |
| `ctv`（CTV / ClinicalTrials.gov 本地索引） | NO_RESULTS | 0 | 本地索引仅 1434 条，0 命中**不代表** CT.gov 无相关试验 |
| `ictrp`（WHO ICTRP） | FAILED | — | 上游返回错误（`UPSTREAM_UNKNOWN_ERROR`），**不能写成「无结果」** |

本轮修好的两件事：① 为 ChiCTR 在线补装了 chromium-headless-shell；② 为 CDE 归档配置了 `chinadrugtrialsArchive` 目录并做了 10 页受控同步。

## 3. 数据

| 项 | 值 |
| --- | --- |
| 返回记录 | 34（去重后逐条保留来源行） |
| 入库 | 34 |
| `direct` | 28 |
| `indication_only` | 6（含 2 条生物等效性研究、3 条实体瘤篮子研究） |
| 跨来源同登记号 | 1 组（`multi_source=1`） |
| 文件 | `trials-2026.jsonl`、`hcc_trials_2026.sqlite`、`manifest.json` |

一致性断言：manifest 记录数 = jsonl 行数 = sqlite 行数 = 34；两个 sha256 与实算一致（见 `manifest.json`）。

## 4. 已知缺口（诚实边界）

1. **全球广度不足**：ICTRP 本次失败，全球注册试验基本没进来。
2. **ClinicalTrials.gov 深度不足**：CTV 本地索引只有 1434 条，需 `sync_ctv_index` 扩容后再采。
3. **ChiCTR 只取首屏**：需要做分页或离线语料才能覆盖国内登记全量。
4. **CDE 只取 1 页（20 条）**：上游约 308 条；受控来源不鼓励大规模抓取，若需完整数据按受控节奏分片。
5. **HCC 无专属离线语料**：现有两个离线语料都是胰腺癌。要补齐需按 `docs/corpus-lifecycle.md` 自建语料并单独发 Release，不塞进本仓库。
6. **状态未核实**：所有 `recruitment_status` 均为登记原文，未与研究者或中心核对。

## 5. 用法与红线

- 工作台只显示：来源、登记号、期别、状态（标注「登记状态，未核实」）、中心。
- **不做**：匹配、排序、疗效预测、药物推荐、入组建议。
- 期别/状态字段缺失时显示「未记录」，不推断。
- 每次重跑同口径，条数应可复现；若通道状态变化，以新的 `source_status` 为准记录。

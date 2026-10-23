# 肝细胞癌 2026 临床试验数据（只读快照）

- 数据截止：**2026-10-22**（在线检索时刻）
- 采集服务：`unified-trial-mcp` v0.3.1
- 采集脚本：`scripts/fetch-hcc-trials-2026.mjs`（`--dry-run` 看口径，`--from-raw` 可复现）
- 记录数：**34**（`direct` 28 / `indication_only` 6）

## 文件

| 文件 | 说明 |
| --- | --- |
| `manifest.json` | 口径、逐来源终态、计数、sha256、边界声明 |
| `trials-2026.jsonl` | 每行一条记录 |
| `hcc_trials_2026.sqlite` | 表 `trial` / `source_status` / `meta` |

## 快速查询

```bash
sqlite3 hcc_trials_2026.sqlite "select source_id, count(*) from trial group by 1;"
sqlite3 hcc_trials_2026.sqlite "select registry_no, title, recruitment_status from trial where relevance='direct' limit 10;"
sqlite3 hcc_trials_2026.sqlite "select source_id, state, reason_code from source_status;"
```

## 通道终态（详见 `docs/CLINICAL-DATA-2026.md`）

SUCCESS：`chinadrugtrials`(20) / `chictr_online`(10) / `xyb_chinadrugtrials_archive`(5)
NEEDS_SETUP：`chictr_pancreatic_archive`（胰腺癌语料，HCC 无覆盖）
NO_RESULTS：`ctv`（本地索引 1434 条，0 命中不代表 CT.gov 没有）
FAILED：`ictrp`（上游报错，不能写成「无结果」）

## 红线

登记 ≠ 有效 ≠ 安全 ≠ 可入组。所有状态均为登记原文，未与研究者或中心核实。
工作台不做匹配、排序、疗效预测与药物推荐。

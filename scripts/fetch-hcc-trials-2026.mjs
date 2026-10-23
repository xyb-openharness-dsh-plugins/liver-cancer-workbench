#!/usr/bin/env node
// 2026 年肝细胞癌（HCC）临床试验采集脚本
// 口径：unified-trial-mcp 六通道中，仅在线/受控通道可用；HCC 无专属离线语料。
// 用法：
//   node scripts/fetch-hcc-trials-2026.mjs --dry-run
//   node scripts/fetch-hcc-trials-2026.mjs --from-raw .hcc-search-raw.json
//   node scripts/fetch-hcc-trials-2026.mjs            （现场调用 MCP，需先 build）
// 产出：research/hcc-cancer/{manifest.json,trials-2026.jsonl,hcc_trials_2026.sqlite,README.md}
// 原则：登记 ≠ 有效 ≠ 安全 ≠ 可入组；逐来源终态落库；0 条结果必须带来源自己的覆盖声明。

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'research/hcc-cancer');
const YEAR = 2026;
const MCP_DIR = process.env.UNIFIED_TRIAL_DIR || '/Users/qinxiaoqiang/Downloads/unified_search_trials';

const argv = process.argv.slice(2);
const DRY = argv.includes('--dry-run');
const rawIdx = argv.indexOf('--from-raw');
const fromRaw = rawIdx >= 0 ? argv[rawIdx + 1] : null;

const QUERY = {
  condition: '肝细胞癌',
  keywords: ['hepatocellular carcinoma', 'HCC', 'liver cancer'],
  maxResults: 200
};

// 相关性判定：标题直接写 HCC/肝癌 → direct；仅适应症列表提到 → indication_only；都没有 → 丢弃
const LIVER = /肝细胞癌|肝癌|HCC|hepatocellular|hepatoma/i;
function relevance(rec) {
  const title = rec.title || '';
  const conds = (rec.conditionOrDisease || []).join('；');
  if (LIVER.test(title)) return 'direct';
  if (LIVER.test(conds)) return 'indication_only';
  return null;
}

async function searchViaMcp() {
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
  const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');
  const t = new StdioClientTransport({
    command: process.execPath,
    args: [join(MCP_DIR, 'dist/src/cli/main.js'), 'serve'],
    env: { ...process.env, NODE_OPTIONS: '' }
  });
  const c = new Client({ name: 'heppal-hcc-collector', version: '1.0.0' }, { capabilities: {} });
  await c.connect(t);
  const res = await c.callTool({ name: 'search_trials', arguments: QUERY }, undefined, { timeout: 540000 });
  const text = res.content.map((x) => x.text || '').join('\n');
  await c.close();
  return JSON.parse(text);
}

function sha256(buf) { return createHash('sha256').update(buf).digest('hex'); }

function statusRow(s) {
  return {
    sourceId: s.sourceId,
    state: s.state,
    reasonCode: s.reasonCode || null,
    explanation: s.explanation || '',
    resultCount: s.resultCount ?? null,
    truncated: s.truncated ? 1 : 0,
    coverageScope: s.coverage?.scope || '',
    zeroResultMeaning: s.coverage?.zeroResultMeaning || '',
    indexOrArchiveOnly: s.coverage?.indexOrArchiveOnly ? 1 : 0,
    isLowerBound: s.completeness?.isLowerBound ? 1 : 0,
    warnings: JSON.stringify(s.completeness?.warnings || []),
    freshness: JSON.stringify(s.freshness || {}),
    elapsedMs: s.elapsedMs ?? null
  };
}

if (DRY) {
  console.log(JSON.stringify({ dryRun: true, query: QUERY, out: OUT, channels: ['ictrp', 'ctv', 'chictr_online', 'chinadrugtrials'] }, null, 2));
  process.exit(0);
}

const raw = fromRaw ? JSON.parse(readFileSync(join(ROOT, fromRaw), 'utf8')) : await searchViaMcp();
mkdirSync(OUT, { recursive: true });

const fetchedAt = new Date().toISOString();
const kept = [];
let dropped = 0;
for (const r of raw.records || []) {
  const rel = relevance(r);
  if (!rel) { dropped += 1; continue; }
  const reg = (r.registryNumbers || []).find((x) => x.primary) || (r.registryNumbers || [])[0] || {};
  kept.push({
    record_id: r.recordId,
    source_id: r.source.id,
    source_label: r.source.label,
    registry_no: reg.value || null,
    registry: reg.registry || null,
    title: r.title || '',
    public_title: r.publicTitle || null,
    conditions: (r.conditionOrDisease || []).join('；'),
    interventions: (r.interventions || []).join('；'),
    study_type: r.studyType || null,
    recruitment_status: r.recruitmentStatus || null,
    sponsor: Array.isArray(r.sponsorOrInstitution) ? r.sponsorOrInstitution.join('；') : (r.sponsorOrInstitution || null),
    registered_on: r.dates?.registered || null,
    updated_on: r.dates?.updated || null,
    source_url: r.sourceUrl || null,
    relevance: rel,
    match_basis: rel === 'direct' ? '标题含 HCC/肝癌' : '仅适应症列表提及 HCC',
    fetched_at: fetchedAt
  });
}

// 同一登记号跨来源合并只做标记，不删除任何来源行
const byReg = new Map();
for (const r of kept) if (r.registry_no) byReg.set(r.registry_no, (byReg.get(r.registry_no) || 0) + 1);
for (const r of kept) r.multi_source = r.registry_no && byReg.get(r.registry_no) > 1 ? 1 : 0;

const jsonl = kept.map((r) => JSON.stringify(r)).join('\n') + '\n';
writeFileSync(join(OUT, `trials-${YEAR}.jsonl`), jsonl);

// --- sqlite ---
const { DatabaseSync } = await import('node:sqlite');
const dbPath = join(OUT, `hcc_trials_${YEAR}.sqlite`);
if (existsSync(dbPath)) rmSync(dbPath);
const db = new DatabaseSync(dbPath);
db.exec(`
PRAGMA journal_mode = DELETE;
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE trial (
  record_id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  source_label TEXT NOT NULL,
  registry_no TEXT,
  registry TEXT,
  title TEXT NOT NULL,
  public_title TEXT,
  conditions TEXT,
  interventions TEXT,
  study_type TEXT,
  recruitment_status TEXT,
  sponsor TEXT,
  registered_on TEXT,
  updated_on TEXT,
  source_url TEXT,
  relevance TEXT NOT NULL CHECK (relevance IN ('direct','indication_only')),
  match_basis TEXT,
  multi_source INTEGER NOT NULL DEFAULT 0,
  fetched_at TEXT NOT NULL
);
CREATE TABLE source_status (
  source_id TEXT PRIMARY KEY,
  state TEXT NOT NULL,
  reason_code TEXT,
  explanation TEXT,
  result_count INTEGER,
  truncated INTEGER NOT NULL DEFAULT 0,
  coverage_scope TEXT,
  zero_result_meaning TEXT,
  index_or_archive_only INTEGER NOT NULL DEFAULT 0,
  is_lower_bound INTEGER NOT NULL DEFAULT 0,
  warnings TEXT,
  freshness TEXT,
  elapsed_ms INTEGER
);
CREATE INDEX ix_trial_source ON trial(source_id);
CREATE INDEX ix_trial_reg ON trial(registry_no);
`);

const insTrial = db.prepare(`INSERT INTO trial (record_id,source_id,source_label,registry_no,registry,title,public_title,conditions,interventions,study_type,recruitment_status,sponsor,registered_on,updated_on,source_url,relevance,match_basis,multi_source,fetched_at)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
const insStatus = db.prepare(`INSERT INTO source_status (source_id,state,reason_code,explanation,result_count,truncated,coverage_scope,zero_result_meaning,index_or_archive_only,is_lower_bound,warnings,freshness,elapsed_ms)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);

db.exec('BEGIN');
try {
  for (const r of kept) {
    insTrial.run(r.record_id, r.source_id, r.source_label, r.registry_no, r.registry, r.title, r.public_title,
      r.conditions, r.interventions, r.study_type, r.recruitment_status, r.sponsor, r.registered_on, r.updated_on,
      r.source_url, r.relevance, r.match_basis, r.multi_source, r.fetched_at);
  }
  for (const s of raw.statuses || []) {
    const x = statusRow(s);
    insStatus.run(x.sourceId, x.state, x.reasonCode, x.explanation, x.resultCount, x.truncated, x.coverageScope,
      x.zeroResultMeaning, x.indexOrArchiveOnly, x.isLowerBound, x.warnings, x.freshness, x.elapsedMs);
  }
  const meta = {
    dataset: 'hcc-clinical-trials-2026',
    generated_at: fetchedAt,
    query: JSON.stringify(QUERY),
    data_cutoff: fetchedAt.slice(0, 10),
    total_records_returned: String((raw.records || []).length),
    records_kept: String(kept.length),
    records_dropped_irrelevant: String(dropped),
    channels_success: (raw.statuses || []).filter((s) => s.state === 'SUCCESS').map((s) => s.sourceId).join(','),
    channels_unavailable: (raw.statuses || []).filter((s) => s.state !== 'SUCCESS').map((s) => `${s.sourceId}:${s.state}`).join(','),
    disclaimer: raw.disclaimer || ''
  };
  const insMeta = db.prepare('INSERT INTO meta (key,value) VALUES (?,?)');
  for (const [k, v] of Object.entries(meta)) insMeta.run(k, String(v));
  db.exec('COMMIT');
} catch (e) {
  db.exec('ROLLBACK');
  throw e;
}
db.close();

// --- manifest ---
const jsonlBuf = readFileSync(join(OUT, `trials-${YEAR}.jsonl`));
const dbBuf = readFileSync(dbPath);
const manifest = {
  dataset: 'hcc-clinical-trials-2026',
  year: YEAR,
  generatedAt: fetchedAt,
  dataCutoff: fetchedAt.slice(0, 10),
  query: QUERY,
  mcp: { service: 'unified-trial-mcp', version: '0.3.1', dir: MCP_DIR, entry: 'dist/src/cli/main.js' },
  channels: (raw.statuses || []).map((s) => ({
    sourceId: s.sourceId,
    state: s.state,
    reasonCode: s.reasonCode || null,
    resultCount: s.resultCount ?? null,
    warnings: s.completeness?.warnings || []
  })),
  counts: {
    recordsReturned: (raw.records || []).length,
    recordsKept: kept.length,
    recordsDroppedIrrelevant: dropped,
    bySource: kept.reduce((acc, r) => { acc[r.source_id] = (acc[r.source_id] || 0) + 1; return acc; }, {}),
    direct: kept.filter((r) => r.relevance === 'direct').length,
    indicationOnly: kept.filter((r) => r.relevance === 'indication_only').length
  },
  files: {
    jsonl: { path: `trials-${YEAR}.jsonl`, bytes: jsonlBuf.length, sha256: sha256(jsonlBuf), lines: kept.length },
    sqlite: { path: `hcc_trials_${YEAR}.sqlite`, bytes: dbBuf.length, sha256: sha256(dbBuf), rows: kept.length }
  },
  consistency: {
    manifestRows: kept.length,
    jsonlLines: jsonlBuf.toString('utf8').trim().split('\n').length,
    sqliteRows: kept.length
  },
  boundaries: [
    'HCC 无专属离线语料：chictr_pancreatic_archive 与 xyb_chinadrugtrials_archive 均为胰腺癌语料，对 HCC 属未配置/部分覆盖',
    'ChiCTR 在线仅取首屏结果，不等同全量',
    'CTV 为本地索引子集（1434 条），0 命中不代表 ClinicalTrials.gov 无相关试验',
    'ICTRP 本次上游报错，终态为 FAILED，不能写成“无结果”',
    '登记状态未核实；登记 ≠ 有效 ≠ 安全 ≠ 可入组'
  ]
};
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

console.log(JSON.stringify({ ok: true, kept: kept.length, dropped, sources: manifest.counts.bySource, db: dbPath }, null, 2));

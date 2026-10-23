import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const { DatabaseSync } = await import('node:sqlite');

test('schema 0001 可执行，表数 24，外键无错', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(join(ROOT, 'schema/0001_initial.sql'), 'utf8'));
  const n = db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table'").get().n;
  assert.equal(n, 24);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  db.close();
});

test('schema 0001 幂等执行两次不报错（迁移基线）', () => {
  const db = new DatabaseSync(':memory:');
  const sql = readFileSync(join(ROOT, 'schema/0001_initial.sql'), 'utf8');
  db.exec(sql.replace(/INSERT INTO metric_def[\s\S]*$/, ''));
  db.close();
});

test('版本链：历史分期不可修改，看法不可标为结论', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(join(ROOT, 'schema/0001_initial.sql'), 'utf8'));
  const now = '2026-10-22T00:00:00+08:00';
  db.prepare('INSERT INTO profile (id,name,initial,created_at) VALUES (?,?,?,?)').run('p1', '测试', '测', now);
  db.prepare('INSERT INTO stage_assertion (profile_id,system,stage,is_current,created_at) VALUES (?,?,?,?,?)').run('p1', 'BCLC', 'B', 0, now);
  const id = db.prepare('SELECT id FROM stage_assertion WHERE profile_id=?').all('p1')[0].id;
  assert.throws(() => db.prepare('UPDATE stage_assertion SET stage=? WHERE id=?').run('C', id), /历史版本不可修改/);
  db.prepare('INSERT INTO viewpoint (profile_id,recorded_on,topic,body,created_at) VALUES (?,?,?,?,?)').run('p1', '2026-10-22', '担心', '怕复发', now);
  assert.throws(() => db.prepare('UPDATE viewpoint SET is_conclusion=1 WHERE profile_id=?').run('p1'), /看法不得标记为结论/);
  db.close();
});

test('演示库：2 个档案，双轨数据都有', () => {
  const db = new DatabaseSync(join(ROOT, 'demo/demo-data.sqlite'), { readOnly: true });
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM profile').get().n, 2);
  const reserve = db.prepare('SELECT COUNT(*) AS n FROM liver_reserve').get().n;
  const tumor = db.prepare('SELECT COUNT(*) AS n FROM tumor_assessment').get().n;
  assert.ok(reserve >= 8, `肝储备记录 ${reserve}`);
  assert.ok(tumor >= 8, `肿瘤评估记录 ${tumor}`);
  assert.ok(db.prepare('SELECT COUNT(*) AS n FROM resectability_assertion').get().n >= 3);
  assert.ok(db.prepare('SELECT COUNT(*) AS n FROM hbv_record').get().n >= 3);
  db.close();
});

test('临床库：manifest / jsonl / sqlite 三处计数一致', () => {
  const dir = join(ROOT, 'research/hcc-cancer');
  const m = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
  const lines = readFileSync(join(dir, 'trials-2026.jsonl'), 'utf8').trim().split('\n').length;
  const db = new DatabaseSync(join(dir, 'hcc_trials_2026.sqlite'), { readOnly: true });
  const rows = db.prepare('SELECT COUNT(*) AS n FROM trial').get().n;
  db.close();
  assert.equal(m.counts.recordsKept, lines);
  assert.equal(m.counts.recordsKept, rows);
  assert.equal(m.files.sqlite.rows, rows);
});

test('临床库：逐来源终态已记录，缺结果通道不是 SUCCESS', () => {
  const db = new DatabaseSync(join(ROOT, 'research/hcc-cancer/hcc_trials_2026.sqlite'), { readOnly: true });
  const states = Object.fromEntries(db.prepare('SELECT source_id, state FROM source_status').all().map((r) => [r.source_id, r.state]));
  assert.equal(states.ictrp, 'FAILED');
  assert.equal(states.ctv, 'NO_RESULTS');
  assert.equal(states.chictr_pancreatic_archive, 'NEEDS_SETUP');
  assert.equal(states.chinadrugtrials, 'SUCCESS');
  db.close();
});

test('文案红线：原型与文档不出现禁词', () => {
  const ban = ['建议治疗', '可能复发', '可以停药', '无需就医', '推荐方案', '治愈率', '生存率', '复发概率'];
  const files = ['prototypes/v0.1/app.js', 'prototypes/v0.1/index.html', 'docs/SPEC.md', 'docs/SCENARIOS.md', 'docs/HCC-DOMAIN.md'];
  for (const f of files) {
    const s = readFileSync(join(ROOT, f), 'utf8');
    for (const w of ban) {
      // 允许出现在「禁止/不做」的否定语境里（本文件与红线清单除外）
      const idx = s.indexOf(w);
      if (idx >= 0) {
        const ctx = s.slice(Math.max(0, idx - 60), idx + 10);
        assert.ok(/(不(做|给|提供|写|判断|算|是|要)|禁|没有|不写|无|避免|不替)/.test(ctx), `${f} 出现禁词「${w}」且不在否定语境：${ctx.replace(/\s+/g, ' ')}`);
      }
    }
  }
});

test('页面只引用同目录相对路径（HTTP 预览不 404）', () => {
  const html = readFileSync(join(ROOT, 'prototypes/v0.1/index.html'), 'utf8');
  const refs = Array.from(html.matchAll(/(?:src|href)="([^"]+)"/g)).map((m) => m[1]);
  for (const r of refs) {
    if (/^(https?:|data:|#)/.test(r)) continue;
    assert.ok(!r.includes('..'), `不应引用上级目录：${r}`);
  }
});

test('迁移 0002：指标扩项可执行，0001 sha256 不变', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(join(ROOT, 'schema/0001_initial.sql'), 'utf8'));
  db.exec(readFileSync(join(ROOT, 'schema/0002_metrics_cbc.sql'), 'utf8'));
  const n = db.prepare('SELECT COUNT(*) AS n FROM metric_def').get().n;
  assert.equal(n, 18, '0001 的 13 项 + 0002 的 5 项');
  assert.ok(db.prepare("SELECT 1 AS ok FROM metric_def WHERE id='anc' AND track='safety'").get());
  assert.ok(db.prepare("SELECT 1 AS ok FROM metric_def WHERE id='grip' AND track='nutrition'").get());
  // visibility 只在 viewpoint 上，默认 shared，且只接受两个值
  const cols = db.prepare('PRAGMA table_info(viewpoint)').all().map((c) => c.name);
  assert.ok(cols.includes('visibility'));
  db.prepare("INSERT INTO profile (id,name,initial,age,sex,tag,is_demo,created_at) VALUES ('t','t','t',1,'F','t',1,'x')").run();
  db.prepare("INSERT INTO viewpoint (profile_id,recorded_on,topic,body,created_at) VALUES ('t','2026-01-01','a','b','x')").run();
  assert.equal(db.prepare("SELECT visibility FROM viewpoint WHERE profile_id='t'").get().visibility, 'shared');
  assert.throws(() => db.prepare("INSERT INTO viewpoint (profile_id,recorded_on,topic,body,visibility,created_at) VALUES ('t','2026-01-02','a','b','secret','x')").run());
  db.close();
});

test('演示库：血常规与心理记录已写入，私密与共享分得开', () => {
  const db = new DatabaseSync(join(ROOT, 'demo/demo-data.sqlite'), { readOnly: true });
  const cbc = db.prepare("SELECT COUNT(*) AS n FROM metric_reading WHERE metric_id IN ('wbc','anc','hgb')").get().n;
  assert.ok(cbc > 0, '血常规应写入 metric_reading');
  const privateN = db.prepare("SELECT COUNT(*) AS n FROM viewpoint WHERE visibility='private'").get().n;
  const sharedN = db.prepare("SELECT COUNT(*) AS n FROM viewpoint WHERE visibility='shared'").get().n;
  assert.ok(privateN > 0 && sharedN > 0, '两类看法都要有，才能验证导出过滤');
  const caregiver = db.prepare("SELECT COUNT(*) AS n FROM viewpoint WHERE source='caregiver'").get().n;
  assert.ok(caregiver > 0, '照护者的记录要能单独取');
  db.close();
});

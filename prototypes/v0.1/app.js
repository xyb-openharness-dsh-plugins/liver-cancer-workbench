/* 小甘宝 HepPal · 交互原型 v0.2.1
   数据唯一来源：demo/build-demo-data.mjs → demo-data.js / demo-data.sqlite
   本文件不写业务结论，只做呈现与记录。 */
(function () {
  'use strict';

  const D = window.DEMO_DATA;
  // flipped 存"已翻面的指标 code"，不是 DOM class：render 会整块重建 innerHTML，
  // 状态挂在 DOM 上会一刷新就丢。换档案时清空，避免把 p1 的翻面带到 p2。
  const state = { pid: D.profiles[0].id, view: 'dash', sub: null, large: false, agentOpen: false, agentWidth: 35, agentState: 'idle', flipped: new Set() };
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  // 一级 9 项 / 二级 27 项。切法见 docs/FEATURE-GAP-BREAST.md：
  // 双轨主脊（我的肝 / 我的瘤）保持并列不加总，门脉高压单独成页当第三条线；
  // 指标分析、营养与体重、心理与家庭、报告与导出是本次补齐的四条功能线。
  const NAV = [
    { id: 'dash', label: '看板', icon: 'grid' },
    { id: 'liver', label: '我的肝', icon: 'shield', note: '背景·储备·门脉', subs: ['肝病背景', '肝功能储备', '门脉高压'] },
    { id: 'tumor', label: '我的瘤', icon: 'target', note: '负荷·标志物·分期', subs: ['肿瘤负荷', '标志物', '分期与可切除性'] },
    { id: 'tx', label: '治疗与转化', icon: 'flow', note: '路径与评估', subs: ['治疗历程', '转化评估', '方案与出处'] },
    { id: 'metrics', label: '指标分析', icon: 'chart', note: '分组·分级·趋势', subs: ['指标卡片', '趋势对照', '分级说明'] },
    { id: 'safety', label: '安全线', icon: 'alert', note: '症状·出血·肝毒性', subs: ['不适与症状', '安全事件', '出血与脑病'] },
    { id: 'nutrition', label: '营养与体重', icon: 'food', note: '肌少症·限盐', subs: ['当下困扰', '进食与体重', '肌少症线索'] },
    { id: 'mind', label: '心理与家庭', icon: 'heart', note: '私密·家属·早筛', subs: ['当下感受', '我的记录', '支持资源', '家里的事与早筛'] },
    { id: 'follow', label: '复诊与回顾', icon: 'calendar', note: '节奏·问题·导出', subs: ['复诊记录', '待办与问题', '试验线索', '报告与导出'] }
  ];
  const SUBS = Object.fromEntries(NAV.filter((n) => n.subs).map((n) => [n.id, n.subs]));
  const SUBTITLES = {
    liver: '肝的底子和肿瘤是两件事，这里只放前一件：背景、储备、门脉压力。',
    tumor: '负荷、标志物、医生写下的分期——三样并列，不相加、不换算。',
    tx: '做过什么、为什么改、有没有可能切，按时间摆开。',
    metrics: '把散在化验单上的数字放进同一个格子里；分级是对照，不是诊断。',
    safety: '有些反应指标上看不出来，只能靠你记的；两边的记录并排放，不写因果。',
    nutrition: 'HCC 的营养问题是肌少症与腹水限盐，不是"吃不下"一条。',
    mind: '这里可以放下感受，不需要整理好情绪再开始。家属也有一格属于自己的位置。',
    follow: '上次说了什么、下次什么时候、要问什么、带走什么。'
  };

  const ICONS = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.4 8.3-8 9-4.6-.7-8-4-8-9V6l8-3z"/><path d="M9 12l2 2 4-4"/>',
    target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
    flow: '<path d="M4 6h6a4 4 0 014 4v4a4 4 0 004 4h2"/><path d="M17 15l3 3-3 3"/><circle cx="4" cy="6" r="2"/>',
    alert: '<path d="M12 3l9 17H3L12 3z"/><path d="M12 9v5M12 17h.01"/>',
    home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 11h18"/>',
    chart: '<path d="M4 3v17h17"/><path d="M7 15l4-5 4 3 5-7"/>',
    food: '<path d="M7 3v8M4 3v5a3 3 0 006 0V3M7 11v10"/><path d="M19 3c-4 3-4 9 0 10V3zM19 13v8"/>',
    heart: '<path d="M20 5c-3-3-6-1-8 1-2-2-5-4-8-1-5 5 8 15 8 15s13-10 8-15z"/>'
  };

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const profile = () => D.profiles.find((p) => p.id === state.pid);
  const last = (arr) => (arr && arr.length ? arr[arr.length - 1] : null);
  const mm = (d) => (d ? d.slice(5).replace('-', '/') : '—');
  const dt = (d) => (d ? d.replace(/-/g, '.') : '—');
  // 状态卡的天数一律算出来，不手填（36 号 §2.6）。用本地日历日相减，
  // 不走 UTC，否则晚上 8 点后「今天」会跳成明天，天数就差一天。
  const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const dayGap = (from, to) => Math.round((Date.parse(`${to}T00:00:00`) - Date.parse(`${from}T00:00:00`)) / 86400000);

  // ALBI = 0.66 × log10(胆红素 μmol/L) − 0.085 × 白蛋白 g/L；缺任一项不给分（NULL ≠ 0）
  function albi(r) {
    if (!r || r.albumin == null || r.bilirubin == null || r.bilirubin <= 0) return null;
    return 0.66 * Math.log10(r.bilirubin) - 0.085 * r.albumin;
  }
  function albiGrade(v) {
    if (v == null) return '—';
    if (v <= -2.6) return '1 级';
    if (v <= -1.39) return '2 级';
    return '3 级';
  }
  const gradeBadge = (g) => (g === 'A' || g === '1 级' || g === 'none' || g === 'LR-1' || g === 'LR-2' || g === 'Vp0' ? 'ok' : g === 'B' || g === '2 级' || g === 'mild' || g === 'LR-4' || g === 'Vp1' || g === 'Vp2' ? 'warn' : g === 'C' || g === '3 级' || g === 'LR-5' || g === 'Vp3' || g === 'Vp4' || g === 'severe' ? 'bad' : 'grey');

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('show'), 2200);
  }

  // ---------- chart primitives ----------
  function monotone(points) {
    // 单调三次插值（Fritsch–Carlson），保证不出假峰
    const n = points.length;
    if (n < 2) return '';
    if (n === 2) return `M${points[0][0]},${points[0][1]} L${points[1][0]},${points[1][1]}`;
    const dx = [], dy = [], m = [];
    for (let i = 0; i < n - 1; i++) { dx[i] = points[i + 1][0] - points[i][0]; dy[i] = points[i + 1][1] - points[i][1]; m[i] = dy[i] / dx[i]; }
    const t = [m[0]];
    for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
    t[n - 1] = m[n - 2];
    for (let i = 0; i < n - 1; i++) {
      if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
      const a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b;
      if (s > 9) { const tau = 3 / Math.sqrt(s); t[i] = tau * a * m[i]; t[i + 1] = tau * b * m[i]; }
    }
    let d = `M${points[0][0]},${points[0][1]}`;
    for (let i = 0; i < n - 1; i++) {
      const h = dx[i] / 3;
      d += ` C${points[i][0] + h},${points[i][1] + t[i] * h} ${points[i + 1][0] - h},${points[i + 1][1] - t[i + 1] * h} ${points[i + 1][0]},${points[i + 1][1]}`;
    }
    return d;
  }

  function sparkline(values, w, h, color) {
    const vals = values.filter((v) => v != null);
    if (vals.length < 2) return `<span style="font-size:10.5px;color:var(--muted)">只有 1 次记录，暂不连线</span>`;
    const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
    const pts = vals.map((v, i) => [8 + (i * (w - 16)) / (vals.length - 1), h - 8 - ((v - min) / span) * (h - 16)]);
    return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><path d="${monotone(pts)}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round"/><circle cx="${pts[pts.length - 1][0]}" cy="${pts[pts.length - 1][1]}" r="3" fill="${color}"/></svg>`;
  }

  // 双轨一图秀：上带白蛋白（肝储备），下带 AFP 对数（肿瘤负荷），底部为分类节点行
  function dualChart(p) {
    const W = 720, H = 348, L = 46, R = 18;
    const res = p.reserve, tum = p.tumor;
    const allDates = Array.from(new Set([...res.map((r) => r.on), ...tum.map((t) => t.on)])).sort();
    const x = (d) => L + allDates.indexOf(d) * ((W - L - R) / Math.max(1, allDates.length - 1));
    const yA = (v) => 132 - ((v - 28) / 20) * 96; // 白蛋白 28–48 g/L
    const afpVals = tum.map((t) => t.afp).filter((v) => v != null && v > 0);
    const lg = (v) => Math.log10(v);
    const lo = afpVals.length ? Math.floor(Math.min(...afpVals.map(lg))) - 0.2 : 0;
    const hi = afpVals.length ? Math.ceil(Math.max(...afpVals.map(lg))) + 0.2 : 3;
    const yF = (v) => 292 - ((lg(v) - lo) / (hi - lo || 1)) * 92;

    const aPts = res.filter((r) => r.albumin != null).map((r) => [x(r.on), yA(r.albumin)]);
    const fPts = tum.filter((t) => t.afp != null && t.afp > 0).map((t) => [x(t.on), yF(t.afp)]);
    const gridA = [30, 35, 40, 45].map((v) => `<g><line x1="${L}" y1="${yA(v)}" x2="${W - R}" y2="${yA(v)}" stroke="#eee5df" stroke-width="1"/><text x="${L - 8}" y="${yA(v) + 3}" text-anchor="end" font-size="9.5" fill="#83766f">${v}</text></g>`).join('');
    const ticksF = [0, 1, 2, 3, 4].filter((n) => n >= lo && n <= hi).map((n) => `<g><line x1="${L}" y1="${yF(10 ** n)}" x2="${W - R}" y2="${yF(10 ** n)}" stroke="#f3ece7" stroke-width="1" stroke-dasharray="3 4"/><text x="${L - 8}" y="${yF(10 ** n) + 3}" text-anchor="end" font-size="9.5" fill="#83766f">${n === 0 ? '1' : '1e' + n}</text></g>`).join('');
    const xLabels = allDates.map((d) => `<text x="${x(d)}" y="${H - 8}" text-anchor="middle" font-size="9.5" fill="#83766f">${mm(d)}</text>`).join('');

    const dotsA = aPts.map(([cx, cy], i) => `<circle cx="${cx}" cy="${cy}" r="3.4" fill="#fff" stroke="#2f6f66" stroke-width="2"><title>白蛋白 ${res.filter((r) => r.albumin != null)[i].albumin} g/L · ${dt(res.filter((r) => r.albumin != null)[i].on)}</title></circle>`).join('');
    const dotsF = fPts.map(([cx, cy], i) => `<circle cx="${cx}" cy="${cy}" r="3.4" fill="#fff" stroke="#c2703d" stroke-width="2"><title>AFP ${tum.filter((t) => t.afp != null && t.afp > 0)[i].afp} ng/mL · ${dt(tum.filter((t) => t.afp != null && t.afp > 0)[i].on)}</title></circle>`).join('');
    const lastA = aPts[aPts.length - 1], lastF = fPts[fPts.length - 1];

    // 分类节点行：Child-Pugh 分级（不连线）
    const catY = 318;
    const cats = res.map((r) => `<g><circle cx="${x(r.on)}" cy="${catY}" r="7" fill="${r.childClass === 'A' ? '#eef6f4' : '#fdf6e8'}" stroke="${r.childClass === 'A' ? '#2f6f66' : '#8a5a0c'}" stroke-width="1.6"/><text x="${x(r.on)}" y="${catY + 3.2}" text-anchor="middle" font-size="8.5" font-weight="600" fill="${r.childClass === 'A' ? '#245a53' : '#8a5a0c'}">${esc(r.childClass)}</text></g>`).join('');

    return `<div class="chart-wrap"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="双轨趋势：上轨白蛋白，下轨 AFP 对数，底部 Child-Pugh 分类节点">
      <text x="${L}" y="14" font-size="10" fill="#245a53" font-weight="600">A 轨 · 肝储备（白蛋白 g/L）</text>
      <text x="${L}" y="170" font-size="10" fill="#8a4c25" font-weight="600">B 轨 · 肿瘤负荷（AFP ng/mL，对数）</text>
      ${gridA}${ticksF}
      <path d="${monotone(aPts)}" fill="none" stroke="#2f6f66" stroke-width="2.2" stroke-linecap="round"/>
      <path d="${monotone(fPts)}" fill="none" stroke="#c2703d" stroke-width="2.2" stroke-linecap="round" stroke-dasharray="${fPts.length < 3 ? '5 4' : '0'}"/>
      ${dotsA}${dotsF}
      <text x="${lastA[0]}" y="${lastA[1] - 11}" text-anchor="end" font-size="10.5" font-weight="600" fill="#245a53">${res.filter((r) => r.albumin != null).slice(-1)[0].albumin} g/L</text>
      <text x="${lastF[0]}" y="${lastF[1] - 11}" text-anchor="end" font-size="10.5" font-weight="600" fill="#8a4c25">${tum.filter((t) => t.afp != null && t.afp > 0).slice(-1)[0].afp}</text>
      <line x1="${L}" y1="300" x2="${W - R}" y2="300" stroke="#ece4df"/>
      <text x="${L}" y="${catY + 3}" font-size="9" fill="#83766f">Child-Pugh</text>
      ${cats}${xLabels}
    </svg></div>
    <div class="chart-legend"><span><i style="background:#2f6f66"></i>白蛋白（越高越好，但工作台不判定）</span><span><i style="background:#c2703d"></i>AFP（对数轴，单点不连线）</span><span>分类节点只画点，不连线</span></div>`;
  }

  // ---------- shared bits ----------
  function head(title, desc, chips) {
    return `<div class="page-head"><div><span class="eyebrow">${esc(profile().name)} · ${esc(profile().tag.split('·')[0].trim())}</span><h1>${esc(title)}</h1><p>${desc}</p>${chips ? `<div class="head-chips">${chips}</div>` : ''}</div></div>`;
  }

  function currentStage(p, sys) {
    return p.stage.find((s) => s.system === sys && s.current) || null;
  }
  function currentResect(p) {
    return p.resectability.find((r) => r.current) || null;
  }
  const RESECT_ZH = { resectable: '可切除', borderline: '临界可切除', unresectable: '不可切除', unknown: '未说明' };
  const MOD_ZH = { resection: '手术切除', ablation: '消融', tace: 'TACE', haic: 'HAIC', tare: '钇-90', rt: '放疗', systemic: '系统治疗', transplant: '移植评估', supportive: '支持治疗', other: '其他' };
  const SAFETY_ZH = { post_embolization: '栓塞后综合征', liver_toxicity: '肝毒性', irae: '免疫相关不良反应', variceal_bleed: '静脉曲张出血', encephalopathy: '肝性脑病', ascites: '腹水', sbp: '自发性腹膜炎', hbv_reactivation: 'HBV 再激活', other: '其他' };
  const VARICES_ZH = { none: '无', small: '轻度', medium: '中度', large: '重度', unknown: '未记录' };
  const ASCITES_ZH = { none: '无', mild: '少量', moderate: '中量', severe: '大量', unknown: '未记录' };
  const ENCEPH_ZH = { none: '无', '1': '1 级', '2': '2 级', '3': '3 级', '4': '4 级', unknown: '未记录' };
  const INTENT_ZH = { curative: '根治意图', palliative: '姑息', conversion: '转化意图', adjuvant: '辅助', neoadjuvant: '新辅助', unknown: '未说明' };

  // ---------- 看板状态卡（36 号 §2.6）----------
  // 四件：卡头 D+N / 大字第 N 天 / 现状行 / 出口按钮排。
  // 锚点与天数只从档案里已有的日期派生，一个都不手填：
  //   ① 有未结束的治疗 → 这次治疗的开始日（当前阶段就是这次治疗）
  //   ② 否则有手术记录 → 手术日（术后随访从手术日算起）
  //   ③ 否则有初诊日 → 初诊日
  //   都没有 → 整卡「待初始化」，指向三步初始化的第一步，不编一个日期出来。
  function anchorOf(p) {
    const open = p.treatments.filter((x) => !x.endedOn && x.startedOn).sort((a, b) => b.startedOn.localeCompare(a.startedOn))[0];
    if (open) return { date: open.startedOn, label: `${MOD_ZH[open.modality] || open.modality}开始日`, note: open.regimen, kind: 'tx-open', x: open };
    const op = p.treatments.filter((x) => x.modality === 'resection' && x.startedOn).sort((a, b) => b.startedOn.localeCompare(a.startedOn))[0];
    if (op) return { date: op.startedOn, label: '手术日', note: op.regimen, kind: 'tx-op', x: op };
    if (p.baseline) return { date: p.baseline, label: '初诊日', note: '', kind: 'baseline', x: null };
    return null;
  }

  // 现状行与大字天数同源：都从锚点那一次事件里取，避免「天数按 A 算、阶段按 B 写」。
  function phaseFromAnchor(a) {
    if (a.kind === 'tx-open' || a.kind === 'tx-op') {
      const x = a.x;
      const done = !!x.endedOn;
      const tail = a.kind === 'tx-op' && done ? ' · 术后随访' : '';
      return {
        name: `${MOD_ZH[x.modality] || x.modality} · ${x.regimen}`,
        state: `${done ? '已结束' : '进行中'} · ${dt(x.startedOn)}${done ? ' → ' + dt(x.endedOn) : ' 起'} · 第 ${x.cyclesDone}/${x.cyclesPlanned} 周期 · ${INTENT_ZH[x.intent] || x.intent}${tail}`
      };
    }
    return { name: '初诊 · 尚无治疗记录', state: `初诊日 ${dt(a.date)} · 来源：档案初诊日期` };
  }

  // 主按钮指向「档案里最近一次决策性事件」所在的页面：治疗开始 / 可切除性评估。
  // 不按指南间隔推算下一步，只按已经记下来的事实往回指。
  function latestPhase(p) {
    const ev = [];
    p.treatments.forEach((x) => { if (x.startedOn) ev.push({ on: x.startedOn, view: 'tx', sub: '治疗历程', cta: '看治疗历程（按次）→', kind: 'tx', x }); });
    p.resectability.forEach((x) => { if (x.statedOn) ev.push({ on: x.statedOn, view: 'tx', sub: '转化评估', cta: '看可切除性版本链 →', kind: 'resect', x }); });
    if (!ev.length) return null;
    return ev.sort((a, b) => b.on.localeCompare(a.on))[0];
  }

  // 「下次」只取用户自己记下的未完成安排。没记就不写，不拿指南周期填。
  function nextPlan(p) {
    const undone = p.tasks.filter((x) => !x.doneOn && x.dueOn).sort((a, b) => a.dueOn.localeCompare(b.dueOn));
    const today = todayISO();
    const future = undone.find((x) => x.dueOn >= today);
    if (future) return { date: future.dueOn, title: future.title, overdue: false };
    if (undone.length) return { date: undone[0].dueOn, title: undone[0].title, overdue: true };
    return null;
  }

  function primerButton() {
    // aria-label 里必须出现「定义」与「趋势」：探针 P1 逐字断言这两个词。
    return '<button type="button" data-primer-open aria-label="疾病概要：肝细胞癌是什么？定义、医学资料与指南情况、治疗全景、发展趋势">疾病概要：肝细胞癌是什么？</button>';
  }

  function stageCard(p) {
    const a = anchorOf(p);
    const nx = nextPlan(p);
    const ph = latestPhase(p);

    if (!a) {
      // 空态：三步初始化。原型不写盘，第一步只做提示，不假装已经选好目录。
      return `<section class="card stage-card is-empty" aria-labelledby="stage-card-h">
        <span class="eyebrow" id="stage-card-h">D+N 状态卡 · 待初始化</span>
        <div class="stage-main">
          <div class="stage-day"><b>待初始化</b><span>档案里还没有可用于起算的日期</span></div>
          <div class="stage-now">
            <b>当前阶段：未记录</b>
            <span>三步初始化：① 选资料目录 → ② 导入病历 / 化验单 → ③ 逐项核对日期</span>
            <span class="stage-next">下次：还没有记下安排</span>
          </div>
        </div>
        <div class="stage-actions">
          <button class="stage-cta" data-action="open-store">第一步：选资料目录 →</button>
          ${primerButton()}
        </div>
        <div class="card-foot">天数由档案里的日期算出，不是病程判断；一个日期都没有时，这里不写数字。</div>
      </section>`;
    }

    const gap = dayGap(a.date, todayISO());
    const eyebrow = gap < 0
      ? `状态卡 · 锚点 ${dt(a.date)} 起算 · 尚未到该日期`
      : `D+${gap} 状态卡 · ${nx ? (nx.overdue ? '距原定安排：日期已过' : (dayGap(todayISO(), nx.date) === 0 ? '下次安排：今天' : `距下次安排 ${dayGap(todayISO(), nx.date)} 天`)) : '距下次安排：待记录'}`;

    const bigDay = gap < 0 ? '尚未开始' : `第 ${gap} 天`;

    const now = phaseFromAnchor(a);
    const name = now.name;
    const state = now.state;

    // 分期单独一行，两套并列不换算；都取「医生说是哪一套」的原文。
    const bc = currentStage(p, 'BCLC');
    const cn = currentStage(p, 'CNLC');
    const stageBits = [];
    if (bc) stageBits.push(`BCLC ${bc.stage}（${dt(bc.statedOn)}）`);
    if (cn) stageBits.push(`CNLC ${cn.stage}（${dt(cn.statedOn)}）`);
    const stageLine = stageBits.length
      ? `分期：${stageBits.join(' · ')} · 医生记录，两套不换算`
      : '分期：档案里还没有医生写下的分期';

    const nextLine = nx
      ? (nx.overdue
        ? `原定 ${dt(nx.date)}（${esc(nx.title)}）· 档案里还没有完成记录`
        : `下次：${dt(nx.date)}（${esc(nx.title)}）`)
      : '下次：还没有记下安排';

    const cta = ph
      ? `<button class="stage-cta" data-action="go" data-view="${ph.view}" data-sub="${esc(ph.sub)}">${ph.cta}</button>`
      : `<button class="stage-cta" data-action="go" data-view="follow" data-sub="待办与问题">看待办与问题 →</button>`;

    return `<section class="card stage-card" aria-labelledby="stage-card-h">
      <span class="eyebrow" id="stage-card-h">${esc(eyebrow)}</span>
      <div class="stage-main">
        <div class="stage-day">
          <b>${esc(bigDay)}</b>
          <span>锚点 ${dt(a.date)}（${esc(a.label)}${a.note ? ' · ' + esc(a.note) : ''} = Day 0）· 由档案日期算出，不手填</span>
        </div>
        <div class="stage-now">
          <b>${esc(name)}</b>
          <span>${esc(state)}</span>
          <span>${esc(stageLine)}</span>
          <span class="stage-next">${nextLine}</span>
        </div>
      </div>
      <div class="stage-actions">
        ${cta}
        ${primerButton()}
      </div>
      <div class="card-foot">A 轨肝功能储备与 B 轨肿瘤负荷照旧并列，本卡不合成一个分数。天数只由档案日期相减得到，不代表病情轻重。</div>
    </section>`;
  }

  function card(title, body, opts) {
    opts = opts || {};
    return `<section class="card ${opts.cls || ''}"><div class="card-head"><div>${opts.eyebrow ? `<span class="eyebrow">${esc(opts.eyebrow)}</span>` : ''}<h2>${esc(title)}</h2></div>${opts.aside || ''}</div>${body}${opts.foot ? `<div class="card-foot">${opts.foot}</div>` : ''}</section>`;
  }

  // ---------- dashboard ----------
  function viewDash() {
    const p = profile();
    const r = last(p.reserve), t = last(p.tumor), resect = currentResect(p);
    const a = albi(r);
    // 看板这 6 张卡与「指标分析」共用同一个翻面组件（metricCardHTML）：
    // 同一个 data-code、同一个 .mcard-inner、同一套 CSS，否则会出现"指标分析能翻、看板点了没反应"，
    // 而后者正是用户看到"卡是静态的"的那个入口。
    const all = metricCards(p);
    const pick = (code) => all.find((x) => x.code === code);
    const albiPts = p.reserve.map((x) => ({ d: x.on, v: albi(x) })).filter((q) => q.v != null);
    const childPts = p.reserve.filter((x) => x.childScore != null).map((x) => ({ d: x.on, v: x.childScore }));
    const dashCards = [
      { code: 'albi', group: 'A 轨 · 肝功能储备', name: 'ALBI 评分', unit: albiGrade(a), deltaUnit: '', dec: 2, value: a == null ? null : a.toFixed(2), date: r.on, points: albiPts, color: '#2f6f66', note: '分级只作记录，不是预后判断。', src: '由本次白蛋白与胆红素计算' },
      { code: 'childpugh', group: 'A 轨 · 肝功能储备', name: 'Child-Pugh', unit: `评分 ${r.childScore}`, deltaUnit: '分', dec: 0, value: r.childClass, date: r.on, points: childPts, color: '#2f6f66', note: '评分由医生记录，工作台不重算；背面折线画的是评分。', src: '病历转录' },
      pick('afp'), pick('max_diameter'), pick('plt'), pick('weight')
    ].filter(Boolean);

    const safety = p.safety.slice(-2).reverse().map((s) => `<div class="row"><div class="when">${mm(s.onsetOn)}</div><div class="what"><b>${esc(SAFETY_ZH[s.kind] || s.kind)} <span class="badge ${/2 级|3 级/.test(s.grade) ? 'warn' : 'grey'}">${esc(s.grade)}</span></b><span>${esc(s.description)}</span></div></div>`).join('');

    const next = p.tasks.filter((x) => !x.doneOn).slice(0, 3).map((x) => `<div class="row"><div class="when">${mm(x.dueOn)}</div><div class="what"><b>${esc(x.title)}</b><span>${x.kind === 'test' ? '检查' : '待办'} · 未完成</span></div></div>`).join('');

    return head('看板', '两条线同时看：肝的储备够不够，瘤负荷到哪一步。<strong>工作台不加总、不评分、不判断能否治疗。</strong>',
      `<span class="chip clay">BCLC <b>${esc(currentStage(p, 'BCLC') ? currentStage(p, 'BCLC').stage : '—')}</b></span>
       <span class="chip clay">CNLC <b>${esc(currentStage(p, 'CNLC') ? currentStage(p, 'CNLC').stage : '—')}</b></span>
       <span class="chip ${resect && resect.conclusion === 'resectable' ? 'teal' : 'warn'}">可切除性 <b>${esc(RESECT_ZH[resect ? resect.conclusion : 'unknown'])}</b> · 医生 ${dt(resect && resect.statedOn)}</span>
       <span class="chip">${esc(p.etiology === 'hbv' ? 'HBV 背景' : p.etiology)} · ${p.cirrhosis === 'yes' ? '临床肝硬化' : '无临床肝硬化'}</span>`)
      + stageCard(p)
      + `<div class="track-strip">
          <div class="track-cell"><span class="dot" style="background:#2f6f66"></span><div><b>A 轨 · 肝功能储备</b><span>白蛋白 ${r.albumin} g/L · 胆红素 ${r.bilirubin} μmol/L · INR ${r.inr} · Child-Pugh ${r.childClass}</span></div></div>
          <div class="track-cell"><span class="dot" style="background:#c2703d"></span><div><b>B 轨 · 肿瘤负荷</b><span>${t.count} 个结节 · 最大 ${t.maxMm == null ? '—' : t.maxMm + ' mm'} · ${esc(t.liRads || 'LI-RADS 未记录')} · ${esc(t.vp || 'Vp 未记录')}</span></div></div>
        </div>`
      + card('双轨一图秀', dualChart(p), {
          eyebrow: '2026-04 → 2026-10',
          aside: `<span class="badge grey">${p.reserve.length} 次化验 · ${p.tumor.length} 次影像</span>`,
          foot: '两条轨道各自独立缩放，量纲不同不叠在同一坐标轴上。分类变量只画节点不连线；只有一次记录不画线。'
        })
      + `<div class="metric-group-head"><h3>本次在册的指标</h3><span>点卡片翻到背面看这条记录的变化</span></div><div class="metric-grid">${dashCards.map(metricCardHTML).join('')}</div>`
      + `<div class="grid g2">
          ${card('最近的安全事件', safety || '<div class="empty">没有记录</div>', { eyebrow: '安全线', aside: '<button class="text-button" data-action="go" data-view="safety" style="min-height:auto;border:0;background:none;font-size:11.5px;color:var(--clay-deep)">全部 →</button>', foot: '症状与分级按病历原文记录；出现新症状请联系治疗团队，工作台不分诊。' })}
          ${card('接下来要做的事', next || '<div class="empty">没有待办</div>', { eyebrow: '复诊与试验', foot: '日期来自患者登记或出院小结，不是医院排期。' })}
        </div>`;
  }

  // ---------- 二级导航 ----------
  // 二级导航的唯一渲染点在侧栏（#subnav-dock），这里保留空函数是为了让各视图的
  // head(...) + subnav(id) + body 结构读起来一致；不要在内容区再渲染一份，
  // 两份同时存在时窄屏会出现两个可点的同名标签，键盘 Tab 会重复停靠。
  function subnav() { return ''; }
  const curSub = (id) => (state.sub && SUBS[id] && SUBS[id].includes(state.sub) ? state.sub : (SUBS[id] || [''])[0]);

  // ---------- CTCAE v5.0 分级 ----------
  // 只做「对照」：把记录值放进标准里的客观区间，不给处置。阈值抄自 CTCAE v5.0 Quick Reference。
  // 血液学四项是绝对数值，可直接对照；ALT/AST/总胆红素是「×正常上限」，必须用这张化验单
  // 自带的参考上限，没有就返回 needsUln，绝不用成人通用值去凑倍数。
  const CTCAE_LOW = {
    wbc: { term: '白细胞减少', llfn: 3.5, g2: 3.0, g3: 2.0, g4: 1.0 },
    anc: { term: '中性粒细胞减少', llfn: 2.0, g2: 1.5, g3: 1.0, g4: 0.5 },
    hgb: { term: '贫血', llfn: 120, g2: 100, g3: 80, g4: null },
    plt: { term: '血小板减少', llfn: 125, g2: 75, g3: 50, g4: 25 }
  };
  function gradeLow(code, v) {
    const t = CTCAE_LOW[code];
    if (v == null || !t) return null;
    if (v >= t.llfn) return 0;
    if (t.g4 != null && v < t.g4) return 4;
    if (v < t.g3) return 3;
    if (v < t.g2) return 2;
    return 1;
  }
  // 分级区间文案：必须写成"≥lower 且 <upper"的可判读形式。
  // 早先写成 `<125–≥75`，方向相反、还自相矛盾——用户看一眼就会怀疑整张卡的数。
  function bandText(code, grade) {
    const t = CTCAE_LOW[code];
    if (!t) return '';
    if (grade === 4) return t.g4 != null ? `<${t.g4}` : '';
    if (grade === 3) return t.g4 != null ? `≥${t.g3} 且 <${t.g4}` : `<${t.g3}`;
    if (grade === 2) return `≥${t.g2} 且 <${t.g3}`;
    if (grade === 1) return `≥${t.g2} 且 <${t.llfn}`;
    return '';
  }
  // 返回 { grade, x } 或 { needsUln: true } 或 null（没值）
  function gradeUln(code, v, high) {
    if (v == null) return null;
    if (high == null || high <= 0) return { needsUln: true };
    const x = v / high;
    if (x <= 1) return { grade: 0, x };
    const cut = code === 'bilirubin' ? [1.5, 3.0, 10.0] : [3.0, 5.0, 20.0];
    return { grade: x <= cut[0] ? 1 : x <= cut[1] ? 2 : x <= cut[2] ? 3 : 4, x };
  }
  const GCLS = (g) => (g >= 3 ? 'bad' : g === 2 ? 'warn' : g === 1 ? 'grey' : 'ok');
  function gBadge(g, extra) {
    // 0 级 = 未落在任何不良事件区间，等同于"这次没有可对照的事件"。
    // 给 0 级也挂徽章会让正常值的卡面被"CTCAE 0 级"刷满，反而看不出哪一项真的异常。
    if (g == null || g === 0) return '';
    return `<span class="badge ${GCLS(g)}" title="CTCAE v5.0 对照，不是诊断">CTCAE ${g} 级${extra ? ` · ${esc(extra)}` : ''}</span>`;
  }

  // 指标卡数据：一份定义表，页面上所有分组、趋势、分级都从这里取，避免两处各排各的。
  // 指标卡数据。每项给 points（真实采样日 + 值）而不是光秃秃的数值数组，
  // 因为背面横轴要求按真实日期比例（starter docs/24 §5：不能按点序号等距）。
  // 缺测的点直接不进数组 —— NULL 不等于 0，也不补上一次的值。
  function metricCards(p) {
    const ref = p.labRef || {};
    const r = last(p.reserve) || {};
    const t = last(p.tumor) || {};
    const c = last(p.cbc) || {};
    const n = last(p.nutrition) || {};
    const pts = (arr, k) => arr.filter((x) => x[k] != null).map((x) => ({ d: x.on, v: x[k] }));
    return [
      { code: 'albumin', group: 'A 轨 · 肝功能储备', name: '白蛋白', unit: 'g/L', dec: 1, value: r.albumin, date: r.on, points: pts(p.reserve, 'albumin'), color: '#2f6f66', note: '越高越好，但工作台不判定好坏；ALBI 由它和胆红素派生。', src: '病历转录的化验值' },
      { code: 'bilirubin', group: 'A 轨 · 肝功能储备', name: '总胆红素', unit: 'μmol/L', dec: 0, value: r.bilirubin, date: r.on, points: pts(p.reserve, 'bilirubin'), color: '#8a5a0c', uln: gradeUln('bilirubin', r.bilirubin, ref.bilirubinHigh), note: '×ULN 型：只在这张化验单带参考上限时给级。', src: '病历转录的化验值' },
      { code: 'inr', group: 'A 轨 · 肝功能储备', name: 'INR', unit: '', dec: 2, value: r.inr, date: r.on, points: pts(p.reserve, 'inr'), color: '#5e3324', note: '凝血指标，Child-Pugh 的成分之一；不是出血风险评分。', src: '病历转录的化验值' },
      { code: 'alt', group: 'A 轨 · 肝功能储备', name: 'ALT', unit: 'U/L', dec: 0, value: r.alt, date: r.on, points: pts(p.reserve, 'alt'), color: '#a3241b', uln: gradeUln('alt', r.alt, ref.altHigh), note: '肝硬化背景上同样的 ALT 意义不同，分级不等于肝损伤程度。', src: '病历转录的化验值' },
      { code: 'ast', group: 'A 轨 · 肝功能储备', name: 'AST', unit: 'U/L', dec: 0, value: r.ast, date: r.on, points: pts(p.reserve, 'ast'), color: '#a3241b', uln: gradeUln('ast', r.ast, ref.astHigh), note: '与 ALT 并列看，不做 AST/ALT 比值推断。', src: '病历转录的化验值' },
      { code: 'wbc', group: '安全线 · 血常规', name: '白细胞', unit: '10⁹/L', dec: 1, value: c.wbc, date: c.on, points: pts(p.cbc || [], 'wbc'), color: '#2f6f66', grade: gradeLow('wbc', c.wbc), note: 'CTCAE 血液学四项之一，绝对阈值可直接对照。', src: '血常规' },
      { code: 'anc', group: '安全线 · 血常规', name: '中性粒细胞绝对值', unit: '10⁹/L', dec: 1, value: c.anc, date: c.on, points: pts(p.cbc || [], 'anc'), color: '#2f6f66', grade: gradeLow('anc', c.anc), note: '发热时这一项比白细胞总数更常被医生看。', src: '血常规' },
      { code: 'hgb', group: '安全线 · 血常规', name: '血红蛋白', unit: 'g/L', dec: 0, value: c.hgb, date: c.on, points: pts(p.cbc || [], 'hgb'), color: '#a3241b', grade: gradeLow('hgb', c.hgb), note: 'CTCAE 的 G4 只有定义没有数值界限，本地只给到 3 级。', src: '血常规' },
      { code: 'plt', group: '安全线 · 血常规', name: '血小板', unit: '10⁹/L', dec: 0, value: r.platelets, date: r.on, points: pts(p.reserve, 'platelets'), color: '#8a5a0c', grade: gradeLow('plt', r.platelets), note: '在 HCC 里它同时是门脉高压的线索，两件事分开读。', src: '血常规' },
      { code: 'afp', group: 'B 轨 · 肿瘤标志物', name: 'AFP', unit: 'ng/mL', dec: 1, value: t.afp, date: t.on, points: pts(p.tumor, 'afp'), color: '#c2703d', note: '标志物不是不良事件，不做 CTCAE 分级；单次数值不说明趋势方向。', src: '化验单' },
      { code: 'pivka2', group: 'B 轨 · 肿瘤标志物', name: 'PIVKA-II', unit: 'mAU/mL', dec: 0, value: t.pivka2, date: t.on, points: pts(p.tumor, 'pivka2'), color: '#c2703d', note: '与 AFP 并列，不合成评分、不互相换算。', src: '化验单' },
      { code: 'max_diameter', group: 'B 轨 · 影像测量', name: '最大结节径', unit: 'mm', dec: 0, value: t.maxMm, date: t.on, points: pts(p.tumor, 'maxMm'), color: '#c2703d', note: '影像测量受扫描层厚与判读影响，跨中心比较要谨慎。', src: '影像报告转录' },
      { code: 'weight', group: '营养与肌少症', name: '体重', unit: 'kg', dec: 1, value: n.weight, date: n.on, points: pts(p.nutrition, 'weight'), color: '#9c5a3c', note: '单看体重会漏掉水肿与腹水，需与小腿围、握力并列。', src: '本人记录' },
      { code: 'calf', group: '营养与肌少症', name: '小腿围', unit: 'cm', dec: 1, value: n.calf, date: n.on, points: pts(p.nutrition, 'calf'), color: '#9c5a3c', note: '肌少症的体表线索，缺测记 NULL，不补 0。', src: '本人记录' },
      { code: 'grip', group: '营养与肌少症', name: '握力', unit: 'kg', dec: 0, value: n.grip, date: n.on, points: pts(p.nutrition, 'grip'), color: '#9c5a3c', note: '握力受测量手与姿势影响，前后比较要在同一条件下。', src: '本人记录' }
    ];
  }

  // 背面迷你趋势：横轴按真实采样日期比例（首末日跨度铺满），不按点序号等距。
  // 单点只画点不连线；两点起用单调三次插值，经过原始点，不外推。
  // dec 用来格式化末点标签——不传就会把 -2.131022623371133 原样写上去。
  function trendSVG(points, color, w = 380, h = 96, dec = 0) {
    if (!points || points.length === 0) return '';
    const P = 10, W = w - P * 2, H = h - 26;
    const ts = points.map((p) => new Date(p.d).getTime());
    const vs = points.map((p) => p.v);
    const t0 = Math.min(...ts), t1 = Math.max(...ts);
    const v0 = Math.min(...vs), v1 = Math.max(...vs);
    const spanT = t1 - t0 || 1;
    const spanV = v1 - v0 || Math.abs(v1) || 1;
    // 上下各留 12% 余量：最高/最低点不贴边，圆点描边不会被裁掉一半。
    const padV = spanV * 0.12;
    const x = (t) => P + (t1 === t0 ? W / 2 : ((t - t0) / spanT) * W);
    const y = (v) => P + H - ((v - (v0 - padV)) / (spanV + padV * 2)) * H;
    const pts = points.map((p) => [x(new Date(p.d).getTime()), y(p.v)]);
    const line = pts.length > 1 ? `<path d="${monotone(pts)}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>` : '';
    const dots = pts.map((q) => `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="2.6" fill="#fff" stroke="${color}" stroke-width="1.8"/>`).join('');
    const lastP = pts[pts.length - 1];
    return `<svg class="trend-svg" viewBox="0 0 ${w} ${h}" width="100%" height="${h}" role="img" aria-label="该指标按日期排列的 ${points.length} 个记录点">
      <line x1="${P}" y1="${P + H}" x2="${P + W}" y2="${P + H}" stroke="#ece4df"/>
      ${line}${dots}
      <text x="${P}" y="${h - 3}" font-size="9" fill="#a3968e">${points[0].d.slice(5).replace('-', '/')}</text>
      <text x="${P + W}" y="${h - 3}" font-size="9" fill="#a3968e" text-anchor="end">${points[points.length - 1].d.slice(5).replace('-', '/')}</text>
      <text x="${lastP[0].toFixed(1)}" y="${(lastP[1] - 7).toFixed(1)}" font-size="10" font-weight="600" fill="${color}" text-anchor="end">${Number(points[points.length - 1].v).toFixed(dec)}</text>
    </svg>`;
  }

  // 正面：类别眉题 → 指标名 → 最近值 → 与前次比较 → 次数与日期 → 来源（starter docs/24 §3）
  // 背面：指标名 + 独立趋势 + 分级区间/来源与可比性（§4）
  // 整卡是 button，用 aria-pressed 表达翻面；两面都绝对定位、双面 backface-visibility:hidden，
  // 背面预转 180°。隐藏面加 aria-hidden + inert，避免读屏与 Tab 停到看不见的一面。
  function metricCardHTML(m) {
    const flipped = state.flipped.has(m.code);
    const pts = m.points || [];
    const latest = pts.length ? pts[pts.length - 1] : null;
    const prev = pts.length > 1 ? pts[pts.length - 2] : null;
    const delta = latest && prev ? latest.v - prev.v : null;
    const head = m.grade != null ? gBadge(m.grade) : (m.uln && m.uln.grade != null ? gBadge(m.uln.grade, `${m.uln.x.toFixed(1)}×ULN`) : (m.uln && m.uln.needsUln ? '<span class="grade-chip need" title="这条记录里没有化验单参考上限">需参考上限</span>' : ''));
    const valTxt = m.value == null ? '还没有记录' : `${m.value}`;
    // deltaUnit 与 unit 分开：ALBI 正面单位位放的是分级、Child-Pugh 放的是评分，
    // 但"较前次 ↑1"说的是分数变化，不该跟着写"评分 7"。
    const du = m.deltaUnit != null ? m.deltaUnit : (m.unit || '');
    const deltaTxt = !latest ? '' : (prev
      ? `较前次 ${delta > 0 ? '↑' : delta < 0 ? '↓' : '→'} <em>${Math.abs(delta).toFixed(m.dec)}${du ? ' ' + esc(du) : ''}</em>`
      : '暂无可比较的前次记录');

    // 背面分级区间：给的是"这一级对应什么数值"，不是处置建议
    let backGrade = '';
    if (m.grade != null && m.grade > 0) {
      const t2 = CTCAE_LOW[m.code];
      backGrade = `<span class="mface-line">对照 CTCAE v5.0 ${esc(t2.term)}：本值落 ${m.grade} 级；该级区间 ${bandText(m.code, m.grade)} ${esc(m.unit || '')}</span>`;
    } else if (m.uln && m.uln.grade > 0) {
      backGrade = `<span class="mface-line">对照 CTCAE v5.0：${m.uln.x.toFixed(2)} × ULN，落 ${m.uln.grade} 级（参考上限按那张化验单）</span>`;
    } else if (m.uln && m.uln.needsUln) {
      backGrade = '<span class="mface-line">这条记录没有化验单参考上限，因此只显示数值、不给级。</span>';
    }

    const back = pts.length === 0
      ? `<span class="mface-cat"><i style="background:${m.color}"></i>${esc(m.group)}</span>
         <span class="mface-name">${esc(m.name)}</span>
         <span class="mface-na">没有可回顾的记录。<br>导入化验单或手工补录后会出现在这里。</span>`
      : pts.length === 1
        ? `<span class="mface-cat"><i style="background:${m.color}"></i>${esc(m.group)}</span>
           <span class="mface-name">${esc(m.name)} · 只有 1 次记录</span>
           <span class="mface-na">只有 1 次记录，暂不连线。<br>再记录一次后显示趋势。</span>
           ${backGrade}`
        : `<span class="mface-cat"><i style="background:${m.color}"></i>${esc(m.group)}</span>
           <span class="mface-name">${esc(m.name)} · 最近 ${pts.length} 次</span>
           <span class="mface-spark">${trendSVG(pts.slice(-8), m.color, 380, 96, m.dec || 0)}</span>
           ${backGrade}
           <span class="mface-foot">仅回顾已记录的值 · 点击返回</span>`;

    return `<button class="mcard" data-action="flip" data-code="${esc(m.code)}" aria-pressed="${flipped}"
        role="group" aria-roledescription="可翻面指标卡"
        aria-label="${esc(m.name)}${m.value == null ? '，还没有记录' : `，最近值 ${m.value} ${esc(m.unit || '')}`}。按回车翻转查看趋势">
      <span class="mcard-inner">
        <span class="mface front" ${flipped ? 'aria-hidden="true" inert' : ''}>
          <span class="mface-flip" aria-hidden="true">↻</span>
          <span class="mface-cat"><i style="background:${m.color}"></i>${esc(m.group)}</span>
          <span class="mface-name">${esc(m.name)}</span>
          <span class="mface-val">${esc(valTxt)}${m.value == null ? '' : `<small>${esc(m.unit || '')}</small>`}</span>
          <span class="mface-delta">${deltaTxt || '&nbsp;'}</span>
          ${m.note ? `<span class="mface-note">${esc(m.note)}</span>` : ''}
          <span class="mface-meta"><span>${pts.length} 次记录</span><span>${m.date ? dt(m.date) : '日期待核'}</span></span>
          <span class="mface-src">${esc(m.src)} · 点开看趋势</span>
          ${head}
        </span>
        <span class="mface back" ${flipped ? '' : 'aria-hidden="true" inert'}>
          ${back}
        </span>
      </span>
    </button>`;
  }

  // ---------- liver ----------
  function viewLiver() {
    const p = profile();
    const sub = curSub('liver');
    const r = last(p.reserve), a = albi(r);
    const body = {
      肝病背景: () => {
        const hbvRows = p.hbv.slice().reverse().map((x) => `<tr><td>${dt(x.on)}</td><td>${x.hbsag === 'positive' ? '阳性' : esc(x.hbsag)}</td><td class="num">${x.dnaState === 'undetected' ? '未检出' : x.dna}</td><td>${esc(x.antiviral)}</td><td>${esc(x.prophylaxis)}</td><td>${dt(x.screeningBefore)}</td></tr>`).join('');
        return `<div class="grid g2">
          ${card('病因与硬化状态', `<div class="rows">
            <div class="row"><div class="what"><b>病因</b><span>${p.etiology === 'hbv' ? '乙型肝炎病毒（HBV）' : esc(p.etiology)}</span></div></div>
            <div class="row"><div class="what"><b>临床肝硬化</b><span>${p.cirrhosis === 'yes' ? '有' : '无'}${p.cirrhosis === 'yes' ? ' · 影响可切除性与安全线判断' : ''}</span></div></div>
            <div class="row"><div class="what"><b>建档基线</b><span>${dt(p.baseline)}</span></div></div>
          </div>`, { eyebrow: '底子', foot: '病因与硬化状态是医生写下的诊断，工作台不重新判断。' })}
          ${card('HBV 治疗与再激活防护', `<div class="table-wrap"><table><thead><tr><th>日期</th><th>HBsAg</th><th>HBV DNA IU/mL</th><th>抗病毒</th><th>预防用药</th><th>治疗前筛查</th></tr></thead><tbody>${hbvRows}</tbody></table></div>`, { eyebrow: '与靶免/介入并行', foot: '免疫治疗与 TACE 都可能触发再激活；是否停药由治疗团队决定，工作台不提示停药。' })}
        </div>`;
      },
      肝功能储备: () => {
        const reserveRows = p.reserve.slice().reverse().map((x) => `<tr><td>${dt(x.on)}</td><td class="num">${x.albumin ?? '—'}</td><td class="num">${x.bilirubin ?? '—'}</td><td class="num">${x.inr ?? '—'}</td><td class="num">${x.platelets ?? '—'}</td><td class="num">${x.alt ?? '—'}/${x.ast ?? '—'}</td><td>${x.childClass} <span class="muted">(${x.childScore})</span></td><td>${albi(x) == null ? '缺测' : albi(x).toFixed(2)}</td><td>${esc(ASCITES_ZH[x.ascites] || x.ascites)}</td></tr>`).join('');
        return `<div class="notice">这一页是 A 轨。它和「我的瘤」并列，<b>不相加、不换算成一个总分</b>——肝功能差的人肿瘤小，也可能不能切。</div>
        <div class="grid g3">
          ${card('ALBI（派生，不落库）', `<div class="big-num">${a == null ? '—' : a.toFixed(2)}<small>${a == null ? '缺项不出分' : albiGrade(a)}</small></div><p class="muted" style="font-size:11px;margin-top:6px">0.66×log10(胆红素) − 0.085×白蛋白。任一项缺测就不出分，NULL 不等于 0。</p>`, { eyebrow: '由本次化验计算' })}
          ${card('Child-Pugh（医生评分）', `<div class="big-num">${r.childClass}<small>${r.childScore} 分</small></div><p class="muted" style="font-size:11px;margin-top:6px">评分与分级为病历原文，工作台不重算、不按化验值反推。</p>`, { eyebrow: '不重算' })}
          ${card('腹水与脑病', `<div class="rows"><div class="row"><div class="what"><b>腹水</b><span>${esc(ASCITES_ZH[r.ascites] || r.ascites)}</span></div></div><div class="row"><div class="what"><b>肝性脑病</b><span>${esc(ENCEPH_ZH[r.enceph] || r.enceph)}</span></div></div></div>`, { eyebrow: '评分成分' })}
        </div>
        ${card('储备指标逐次记录', `<div class="table-wrap"><table><thead><tr><th>日期</th><th>白蛋白 g/L</th><th>总胆红素 μmol/L</th><th>INR</th><th>血小板 10⁹/L</th><th>ALT/AST</th><th>Child-Pugh</th><th>ALBI</th><th>腹水</th></tr></thead><tbody>${reserveRows}</tbody></table></div>`, { eyebrow: '按时间倒序', foot: '缺测写「—」，不写 0；单点不连线，方法变化时线断开。' })}`;
      },
      门脉高压: () => {
        const rows = p.portal.slice().reverse().map((x) => `<div class="row"><div class="when">${mm(x.on)}</div><div class="what"><b>静脉曲张 ${esc(VARICES_ZH[x.varices] || x.varices)} · 出血史 ${x.bleed === 'yes' ? '有' : '无'}</b><span>${esc(x.banding)} · ${esc(x.betaBlocker)}</span><span class="muted">脾 ${x.spleenMm} mm · 门静脉 ${x.portalVeinMm} mm</span></div></div>`).join('');
        return `<div class="notice warn">门脉高压是 <b>第三条独立风险线</b>：它既不属肝功能储备，也不属肿瘤负荷。放在这里而不是「安全线」，是为了不让它被读成"治疗的副作用"。</div>
        <div class="grid g2">
          ${card('曲张、出血与降门压', `<div class="rows">${rows}</div>`, { eyebrow: '胃镜与用药', foot: '套扎与降门压药为病历原文；是否调整由消化/介入团队决定。' })}
          ${card('从化验侧看到的线索', `<div class="rows">
            <div class="row"><div class="what"><b>血小板 ${r.platelets} 10⁹/L</b><span>${r.platelets < 100 ? '偏低，可与脾大、门脉高压并存' : '在记录范围内'}</span><span class="muted">这不是诊断，只是并列事实</span></div></div>
            <div class="row"><div class="what"><b>脾厚 ${p.portal[0].spleenMm} mm</b><span>${p.portal[0].spleenMm > 120 ? '偏大' : '在记录范围内'}</span></div></div>
          </div>`, { eyebrow: '并列，不推断', foot: '工作台不把「血小板低 + 脾大」合成为"门脉高压"结论，那需要影像与胃镜。' })}
        </div>
        <div class="callout danger"><b>需要立即联系治疗团队的情况（病历里医生交代过的原话）：</b>黑便或呕血、头晕心慌伴面色苍白、意识模糊或嗜睡。这不是分诊规则，是就诊提示。</div>`;
      }
    };
    const chips = {
      肝病背景: `<span class="chip clay">${p.etiology === 'hbv' ? 'HBV' : esc(p.etiology)}</span><span class="chip">肝硬化 <b>${p.cirrhosis === 'yes' ? '有' : '无'}</b></span>`,
      肝功能储备: `<span class="chip teal">Child-Pugh <b>${r.childClass}</b></span><span class="chip clay">ALBI <b>${a == null ? '缺测' : a.toFixed(2)}</b></span>`,
      门脉高压: `<span class="chip ${p.safety.some((s) => s.kind === 'variceal_bleed') ? 'warn' : ''}">出血史 <b>${p.safety.some((s) => s.kind === 'variceal_bleed') ? '有' : '无'}</b></span>`
    };
    return head('我的肝 · ' + sub, SUBTITLES.liver, chips[sub]) + subnav('liver') + body[sub]();
  }

  // ---------- tumor ----------
  function viewTumor() {
    const p = profile();
    const sub = curSub('tumor');
    const t = last(p.tumor), r = last(p.reserve);
    const body = {
      肿瘤负荷: () => {
        const rows = p.tumor.slice().reverse().map((x) => `<tr><td>${dt(x.on)}</td><td>${x.modality === 'pathology' ? '病理' : x.modality.toUpperCase()}</td><td class="num">${x.count}</td><td class="num">${x.maxMm ?? '—'}</td><td>${x.liRads === 'unknown' ? '未适用' : esc(x.liRads)}</td><td>${esc(x.vp)}</td><td>${x.extrahepatic === 'yes' ? '有' : '无'}</td></tr>`).join('');
        const lesions = (t.lesions || []).map((l) => `<div class="row"><div class="what"><b>${esc(l.segment)} · ${l.size} mm</b><span>第 ${l.seq} 灶</span></div></div>`).join('');
        return `<div class="grid g3">
          ${card('结节数', `<div class="big-num">${t.count}<small>个</small></div><p class="muted" style="font-size:11px;margin-top:6px">${t.modality === 'pathology' ? '本次为病理记录' : `${t.modality.toUpperCase()} · ${dt(t.on)}`}</p>`, { eyebrow: '影像计数' })}
          ${card('最大结节径', `<div class="big-num">${t.maxMm == null ? '—' : t.maxMm}<small>mm</small></div><p class="muted" style="font-size:11px;margin-top:6px">受扫描层厚与判读影响，跨中心比较要谨慎。</p>`, { eyebrow: '最长径' })}
          ${card('血管侵犯', `<div class="big-num">${esc(t.vp)}<small>LI-RADS ${t.liRads === 'unknown' ? '未适用' : esc(t.liRads)}</small></div><p class="muted" style="font-size:11px;margin-top:6px">Vp 分级是癌栓位置，不是肿瘤大小；两者不能互相推算。</p>`, { eyebrow: 'Vp 分级' })}
        </div>
        ${card('逐次影像记录', `<div class="table-wrap"><table><thead><tr><th>日期</th><th>检查</th><th>结节数</th><th>最大径 mm</th><th>LI-RADS</th><th>Vp</th><th>肝外转移</th></tr></thead><tbody>${rows}</tbody></table></div>`, { eyebrow: '按时间倒序', foot: 'LI-RADS 只对未治疗病灶适用；治疗后判定用 mRECIST，两者不混用。' })}
        ${lesions ? card('最近一次描写的病灶', `<div class="rows">${lesions}</div>`, { eyebrow: '分段 + 大小' }) : ''}`;
      },
      标志物: () => {
        const afpPts = p.tumor.map((x) => x.afp);
        const pivPts = p.tumor.map((x) => x.pivka2);
        const rows = p.tumor.slice().reverse().map((x) => `<tr><td>${dt(x.on)}</td><td class="num">${x.afp == null ? '未测' : x.afp}</td><td class="num">${x.pivka2 == null ? '未测' : x.pivka2}</td><td>${x.afp == null ? '<span class="muted">这一项没有记录</span>' : ''}</td></tr>`).join('');
        return `<div class="notice">AFP 与 PIVKA-II 是<b>标志物</b>，不是不良事件，因此<b>不做 CTCAE 分级</b>，也没有"正常/异常"的自动判定——参考范围以化验单为准。</div>
        <div class="grid g2">
          ${card('AFP ng/mL', `<div class="big-num">${t.afp == null ? '未测' : t.afp}</div>${sparkline(afpPts, 420, 90, '#c2703d')}`, { eyebrow: '线性轴，单点不连线' })}
          ${card('PIVKA-II mAU/mL', `<div class="big-num">${t.pivka2 == null ? '未测' : t.pivka2}</div>${sparkline(pivPts, 420, 90, '#8a4c25')}`, { eyebrow: '与 AFP 并列' })}
        </div>
        ${card('逐次数值', `<div class="table-wrap"><table><thead><tr><th>日期</th><th>AFP</th><th>PIVKA-II</th><th>备注</th></tr></thead><tbody>${rows}</tbody></table></div>`, { eyebrow: '缺测写「未测」', foot: '约 30% 的 HCC 不分泌 AFP，AFP 不高不能说明没有肿瘤。两个标志物不互相换算。' })}`;
      },
      分期与可切除性: () => {
        const st = p.stage.map((s) => `<div class="row"><div class="when">${mm(s.statedOn)}</div><div class="what"><b>${esc(s.system)} ${esc(s.stage)}${s.current ? ' <span class="badge ok">现行</span>' : ''}</b><span>${esc(s.basis)}</span><span class="muted">${esc(s.statedBy)} · ${dt(s.statedOn)}</span></div></div>`).join('');
        const re = p.resectability.slice().reverse().map((x) => `<div class="row"><div class="when">${mm(x.statedOn)}</div><div class="what"><b>${esc(RESECT_ZH[x.conclusion] || x.conclusion)}${x.current ? ' <span class="badge ok">现行</span>' : ' <span class="badge grey">历史版本</span>'}</b><span>${esc(x.basis)}</span><span class="muted">${esc(x.statedBy)} · 未来残肝 ${esc(x.futureRemnant || '未记录')} · ${x.context === 'initial' ? '初诊' : x.context === 'post_treatment' ? '治疗后' : esc(x.context)}</span></div></div>`).join('');
        return `<div class="notice">BCLC 与 CNLC 2022 <b>并存、不换算</b>。哪个系统的结论更适用，由治疗团队判断；工作台只保留原话与出处。</div>
        <div class="grid g2">
          ${card('分期（医生写下的话）', `<div class="rows">${st}</div>`, { eyebrow: '两套系统并列' })}
          ${card('可切除性评估（可新增版本）', `<div class="rows">${re}</div>`, { eyebrow: '历史版本不可改，只能新增', foot: '「转化」不是工作台算出来的，是 MDT 写下的结论变化。' })}
        </div>`;
      }
    };
    return head('我的瘤 · ' + sub, SUBTITLES.tumor,
      `<span class="chip clay">结节 <b>${t.count}</b></span><span class="chip">最大径 <b>${t.maxMm == null ? '—' : t.maxMm + ' mm'}</b></span><span class="chip">${esc(t.vp)}</span>`)
      + subnav('tumor') + body[sub]();
  }

  // ---------- treatment ----------
  function viewTx() {
    const p = profile();
    const sub = curSub('tx');
    const body = {
      治疗历程: () => {
        const rows = p.treatments.slice().reverse().map((x) => `<div class="row"><div class="when">${mm(x.startedOn)}</div><div class="what"><b>${esc(MOD_ZH[x.modality] || x.modality)} · ${esc(INTENT_ZH[x.intent] || x.intent)} · 第 ${x.line} 线</b><span>${esc(x.regimen)}</span><span class="muted">${dt(x.startedOn)}${x.endedOn ? ' → ' + dt(x.endedOn) : ' → 进行中'} · ${x.cyclesDone}/${x.cyclesPlanned} 周期 · ${esc(x.institution)}</span><span class="muted">疗效记录：${esc(x.response || '未记录')}${x.stopReason ? ' · 停止原因：' + esc(x.stopReason) : ''}</span></div></div>`).join('');
        return `<div class="grid g2">
          ${card('治疗事件', `<div class="rows">${rows}</div>`, { eyebrow: '按开始时间倒序', foot: '疗效描述为医生原文（mRECIST 等）；工作台不自行判疗效。' })}
          ${card('怎么读这一页', `<p>一条治疗记录包含四件事：<b>做了什么</b>（方式+方案）、<b>为什么做</b>（意图）、<b>做了多少</b>（周期）、<b>结果怎么记</b>（医生原话）。</p><p class="muted" style="margin-top:8px;font-size:11.5px">停用原因单独记，不并进疗效，因为"因为副作用停"和"因为进展停"是两件不同的事。</p>`, { eyebrow: '记录结构' })}
        </div>`;
      },
      转化评估: () => {
        const re = p.resectability.slice().reverse().map((x) => `<div class="row"><div class="when">${mm(x.statedOn)}</div><div class="what"><b>${esc(RESECT_ZH[x.conclusion] || x.conclusion)}</b><span>${esc(x.basis)}</span><span class="muted">${dt(x.statedOn)} · 未来残肝 ${esc(x.futureRemnant || '未记录')}</span></div></div>`).join('');
        const sys = p.treatments.filter((x) => x.intent === 'conversion');
        return `<div class="notice">「转化」是 HCC 独有的决策节点：先不可切除 → 系统/局部治疗后重新评估。这一页只把<b>前后两次 MDT 的话</b>并排放，中间不画箭头——不能因为"治疗后缩小"就推断"可以切"。</div>
        <div class="grid g2">
          ${card('可切除性结论的版本链', `<div class="rows">${re}</div>`, { eyebrow: '只新增，不覆盖' })}
          ${card('为转化做的治疗', sys.length ? `<div class="rows">${sys.map((x) => `<div class="row"><div class="when">${mm(x.startedOn)}</div><div class="what"><b>${esc(x.regimen)}</b><span>${x.cyclesDone}/${x.cyclesPlanned} 周期</span><span class="muted">${esc(x.response || '未记录疗效')}</span></div></div>`).join('')}</div>` : '<div class="empty">没有标记为转化意图的治疗记录</div>', { eyebrow: '意图 = conversion', foot: '转化成功与否由 MDT 判定，工作台不算转化率。' })}
        </div>`;
      },
      方案与出处: () => {
        return `<div class="grid g2">
          ${card('这一页记什么、不记什么', `<div class="rows">
            <div class="row"><div class="what"><b>记：方案名与出处</b><span>方案、周期、机构、医生原话的来源（出院小结/门诊病历）。</span></div></div>
            <div class="row"><div class="what"><b>不记：剂量调整建议</b><span>减量、停药、换药一律由治疗团队决定。</span></div></div>
            <div class="row"><div class="what"><b>不记：疗效概率</b><span>没有 ORR、没有中位生存、没有"还能活多久"。</span></div></div>
          </div>`, { eyebrow: '边界' })}
          ${card('当前方案原文', `<div class="rows">${p.treatments.slice().reverse().map((x) => `<div class="row"><div class="when">${mm(x.startedOn)}</div><div class="what"><b>${esc(x.regimen)}</b><span>${esc(x.institution)}</span></div></div>`).join('')}</div>`, { eyebrow: '逐字保留' })}
        </div>`;
      }
    };
    return head('治疗与转化 · ' + sub, SUBTITLES.tx,
      `<span class="chip clay">治疗 <b>${p.treatments.length}</b> 条</span><span class="chip teal">现行 <b>${esc(RESECT_ZH[(currentResect(p) || {}).conclusion] || '未记录')}</b></span>`)
      + subnav('tx') + body[sub]();
  }

  // ---------- metrics ----------
  function viewMetrics() {
    const p = profile();
    const sub = curSub('metrics');
    const cards = metricCards(p);
    const body = {
      指标卡片: () => {
        const groups = [];
        for (const c of cards) {
          if (!groups.includes(c.group)) groups.push(c.group);
        }
        const graded = cards.filter((c) => c.grade > 0 || (c.uln && c.uln.grade > 0)).length;
        return `<div class="notice">趋势只呈现记录，<b>不代表疗效、复发或诊断判断</b>；不同单位与方法需分开核对，方法变化时线断开、不拼接。</div>
        <div class="grid g4" style="margin-bottom:14px">
          <div class="stat"><b>${cards.length}</b><span>项指标在册</span></div>
          <div class="stat"><b>${graded}</b><span>项有 CTCAE 对照</span></div>
          <div class="stat"><b>${cards.filter((c) => c.value == null).length}</b><span>项本次无值</span></div>
          <div class="stat"><b>${cards.filter((c) => c.uln && c.uln.needsUln).length}</b><span>项缺参考上限</span></div>
        </div>
        ${groups.map((g) => `<div class="metric-group"><div class="metric-group-head"><h3>${esc(g)}</h3><span>${cards.filter((c) => c.group === g).length} 项</span></div>
          <div class="metric-grid">${cards.filter((c) => c.group === g).map(metricCardHTML).join('')}</div></div>`).join('')}
        <div class="help-box">点任意卡片翻到背面：正面是最近值与较前次变化，背面是这条指标按真实采样日期排的趋势。键盘用 Tab 选中、回车翻转；再点一次翻回正面。</div>`;
      },
      趋势对照: () => {
        const r = last(p.reserve), t = last(p.tumor);
        return `<div class="notice">上下两带各自成轴：<b>上带是肝功能（A 轨）</b>，<b>下带是肿瘤负荷（B 轨）</b>。两条线永远不共用一根纵轴，也<b>不加总成一个分数</b>。</div>
        ${card('双轨对照', dualChart(p), { eyebrow: 'A 轨 / B 轨 并列', foot: '分类节点（Child-Pugh）只画点不连线；对数轴只用于 AFP。' })}
        <div class="grid g2">
          ${card('什么时候线会断', `<div class="rows">
            <div class="row"><div class="what"><b>只有 1 个点</b><span>不连线，只标点，并写"只有 1 次记录，暂不连线"。</span></div></div>
            <div class="row"><div class="what"><b>检查方法变了</b><span>CT ↔ MRI ↔ 病理之间不拼线，避免把方法差异读成病情变化。</span></div></div>
            <div class="row"><div class="what"><b>缺测</b><span>该点缺失就是缺失，不断到 0，也不用上一次的值补齐。</span></div></div>
          </div>`, { eyebrow: '断线规则' })}
          ${card('本次两端的最新值', `<div class="rows">
            <div class="row"><div class="what"><b>白蛋白 ${r.albumin} g/L</b><span>${dt(r.on)}</span></div></div>
            <div class="row"><div class="what"><b>AFP ${t.afp == null ? '未测' : t.afp} ng/mL</b><span>${dt(t.on)}</span></div></div>
          </div>`, { eyebrow: '并列，不比较方向', foot: '白蛋白降、AFP 降同时发生是可能的，工作台不解释成"治疗有效但肝变差"。' })}
        </div>`;
      },
      分级说明: () => {
        const covered = cards.filter((c) => c.grade > 0);
        const uln = cards.filter((c) => c.uln);
        const needUln = cards.filter((c) => c.uln && c.uln.needsUln);
        return `<div class="notice plain"><b>分级对照用的是 CTCAE v5.0</b>（U.S. NCI/CTEP，2017-11-27 出版）——国际通用的不良事件术语标准，把化验值放进客观区间。<b>对照不是诊断</b>，也不是疗效判断；是否处理由治疗团队决定。</div>
        <div class="grid g2">
          ${card('能对照的项', `<p>白细胞、中性粒细胞绝对值、血红蛋白、血小板的界限是<b>绝对数值</b>，可以直接对照。ALT / AST / 总胆红素的界限写成「×正常上限」，所以<b>只在这张化验单带参考上限时</b>才给级。</p>
            ${covered.length ? `<p class="small-note" style="margin-top:8px">当前有 ${covered.length} 项落在对照区间内：${covered.map((c) => `${c.name}（${c.grade} 级）`).join('、')}。</p>` : '<p class="small-note" style="margin-top:8px">当前没有指标落到对照区间内。</p>'}
            ${needUln.length ? `<p class="small-note" style="margin-top:6px">${needUln.length} 项缺参考上限，只显示数值不给级：${needUln.map((c) => c.name).join('、')}。补录时填上化验单上限，级别就会出现——工作台不拿通用上限替你除。</p>` : ''}`, { eyebrow: '覆盖范围' })}
          ${card('刻意不做分级的三类', `<div class="rows">
            <div class="row"><div class="what"><b>AFP / PIVKA-II</b><span>标志物不是不良事件，没有 CTCAE 条目。</span></div></div>
            <div class="row"><div class="what"><b>最大结节径</b><span>影像测量，疗效判定用 mRECIST，属医生判断。</span></div></div>
            <div class="row"><div class="what"><b>体重 / 小腿围 / 握力</b><span>营养与肌少症线索，没有国际统一的不良事件分级阈值。</span></div></div>
          </div>`, { eyebrow: '不是遗漏' })}
        </div>
        ${uln.length ? card('本次 ×ULN 实测倍数', `<div class="rows">${uln.map((c) => `<div class="row"><div class="what"><b>${esc(c.name)}</b><span>${c.value} ${esc(c.unit)} = ${c.uln.needsUln ? '缺参考上限，未计算' : c.uln.x.toFixed(2) + ' × ULN'}</span><span class="muted">${c.uln.grade != null ? `CTCAE ${c.uln.grade} 级` : '未分级'}</span></div></div>`).join('')}</div>`, { eyebrow: '以你那张化验单为准' }) : ''}`;
      }
    };
    return head('指标分析 · ' + sub, SUBTITLES.metrics, `<span class="chip clay">指标 <b>${cards.length}</b> 项</span><span class="chip">CTCAE v5.0</span>`)
      + subnav('metrics') + body[sub]();
  }

  // ---------- safety ----------
  function viewSafety() {
    const p = profile();
    const sub = curSub('safety');
    const group = p.safety.slice().sort((a, b) => b.onsetOn.localeCompare(a.onsetOn));
    const rows = group.map((s) => `<div class="row"><div class="when">${mm(s.onsetOn)}</div><div class="what"><b>${esc(SAFETY_ZH[s.kind] || s.kind)} <span class="badge ${/2 级|3 级/.test(s.grade) ? 'warn' : 'grey'}">${esc(s.grade)}</span></b><span>${esc(s.description)}</span><span class="muted">医生已处理：${esc(s.action || '未记录')}${s.resolvedOn ? ' · 缓解 ' + dt(s.resolvedOn) : ' · 未记录缓解日期'}</span></div></div>`).join('');
    const altSeries = p.reserve.map((x) => x.alt), bilSeries = p.reserve.map((x) => x.bilirubin);
    const body = {
      不适与症状: () => {
        const sym = p.symptoms.slice().reverse().map((s) => `<div class="row"><div class="when">${mm(s.on)}</div><div class="what"><b>${esc(s.symptom)} · ${s.severity}/10</b><span>${esc(s.note || '')}</span></div></div>`).join('');
        const low = (p.cbc || []).slice().reverse().map((x) => {
          const gw = gradeLow('wbc', x.wbc), ga = gradeLow('anc', x.anc), gh = gradeLow('hgb', x.hgb);
          return `<tr><td>${dt(x.on)}</td><td class="num">${x.wbc ?? '—'}</td><td class="num">${x.anc ?? '—'}</td><td class="num">${x.hgb ?? '—'}</td><td>${[gw, ga, gh].filter((g) => g).length ? `WBC ${gw ?? '—'} / ANC ${ga ?? '—'} / Hgb ${gh ?? '—'}` : '均未达 1 级'}</td></tr>`;
        }).join('');
        return `<div class="notice">表达上是「乏力」「头晕」，指标上是白细胞、中性粒细胞、血红蛋白——<b>两侧并排放，不写因果</b>，也不说"因为血象低所以你头晕"。</div>
        <div class="grid g2">
          ${card('你记录的感受', `<div class="rows">${sym || '<div class="empty">没有记录</div>'}</div>`, { eyebrow: '0–10 自评', foot: '自评分只用于回顾，不与化验值换算，不做加权。' })}
          ${card('记录里的血液学指标', `<div class="table-wrap"><table><thead><tr><th>日期</th><th>WBC</th><th>ANC</th><th>Hgb</th><th>CTCAE 对照</th></tr></thead><tbody>${low || '<tr><td colspan="5">没有血常规记录</td></tr>'}</tbody></table></div>`, { eyebrow: '绝对阈值可直接对照', foot: '分级只把值放进标准区间；是否调整治疗由医生决定。' })}
        </div>`;
      },
      安全事件: () => {
        return card('安全事件记录', `<div class="rows">${rows || '<div class="empty">没有记录</div>'}</div>`, { eyebrow: '按时间倒序', foot: '分级与处理均为病历原文；工作台不提供处理建议。' })
          + `<div class="grid g3" style="margin-top:14px">
            <div class="stat"><b>${p.safety.length}</b><span>安全事件总数</span></div>
            <div class="stat"><b>${p.safety.filter((s) => s.kind === 'liver_toxicity').length}</b><span>肝毒性事件</span></div>
            <div class="stat"><b>${p.safety.filter((s) => s.kind === 'variceal_bleed').length}</b><span>出血事件</span></div>
          </div>`;
      },
      出血与脑病: () => {
        return `<div class="grid g2">
          ${card('肝酶与胆红素的变化', `<div style="display:flex;gap:20px;flex-wrap:wrap;align-items:flex-end">
              <div><small style="display:block;margin-bottom:4px">ALT U/L</small>${sparkline(altSeries, 300, 92, '#a3241b')}</div>
              <div><small style="display:block;margin-bottom:4px">总胆红素 μmol/L</small>${sparkline(bilSeries, 300, 92, '#8a5a0c')}</div>
            </div>`, { eyebrow: '与基础肝病叠加', foot: '同样的 ALT 在肝硬化背景上意义不同。是否停药、减量由治疗团队决定。' })}
          ${card('门脉高压与脑病', `<div class="rows">
            ${p.portal.slice().reverse().map((x) => `<div class="row"><div class="when">${mm(x.on)}</div><div class="what"><b>静脉曲张 ${esc(VARICES_ZH[x.varices] || x.varices)} · 出血 ${x.bleed === 'yes' ? '有' : '无'}</b><span>${esc(x.banding)} · ${esc(x.betaBlocker)}</span></div></div>`).join('')}
            <div class="row"><div class="when">最近</div><div class="what"><b>肝性脑病 ${esc(ENCEPH_ZH[last(p.reserve).enceph] || last(p.reserve).enceph)}</b><span>诱因（感染/出血/便秘/电解质）由医生判断，工作台不推断。</span></div></div>
          </div>`, { eyebrow: '第三条线', foot: '出现黑便、呕血、意识改变或发热，请直接联系治疗团队或急诊，不要等工作台记录。' })}
        </div>
        <div class="callout danger"><b>需要立即联系治疗团队的情况（病历里医生交代过的原话）：</b>黑便或呕血、发热 ≥38.3℃ 一次或 ≥38.0℃ 持续 1 小时、意识模糊或嗜睡、腹胀突然加重、尿量明显减少。这不是分诊规则，是就诊提示。</div>`;
      }
    };
    return head('安全线 · ' + sub, SUBTITLES.safety,
      `<span class="chip ${p.safety.some((s) => s.kind === 'variceal_bleed') ? 'warn' : 'teal'}">出血史 <b>${p.safety.some((s) => s.kind === 'variceal_bleed') ? '有' : '无'}</b></span><span class="chip">安全事件 <b>${p.safety.length}</b></span>`)
      + subnav('safety') + body[sub]();
  }

  // ---------- nutrition ----------
  function viewNutrition() {
    const p = profile();
    const sub = curSub('nutrition');
    const n = last(p.nutrition);
    const first = p.nutrition[0];
    const wDelta = n.weight - first.weight;
    const body = {
      当下困扰: () => `<div class="grid g2">
        <section class="card"><span class="eyebrow">从眼前的感受开始</span><h2 style="margin-top:8px">最近吃东西，有什么不一样？</h2>
          <p>不必先计算摄入。可以记下食欲、吃不下或吃两口就饱的原因，以及肚子胀、口味变淡这类事。</p>
          <div class="rows" style="margin-top:14px">
            <div class="row"><div class="what"><b>食欲</b><span>${n.appetite === 'good' ? '好' : n.appetite === 'fair' ? '一般' : '差'}</span></div></div>
            <div class="row"><div class="what"><b>医生交代的限盐</b><span>${esc(n.salt || '没有记录')}</span></div></div>
            <div class="row"><div class="what"><b>限水</b><span>${esc(n.fluid || '没有记录')}</span></div></div>
          </div>
          <div class="actions" style="margin-top:14px"><button class="primary" data-action="go" data-view="nutrition" data-sub="进食与体重">记录进食变化</button></div>
        </section>
        <section class="card"><h2>已有建议，值得留好</h2><p>正式建议应保留日期与来源；工作台不会把任何模拟内容当成营养处方。</p>
          <div class="empty" style="margin-top:14px"><p>尚未保存营养相关的专业建议。</p></div>
          <div class="divider"></div><h3 style="font-size:12.5px">HCC 的营养问题和别的癌种不一样</h3>
          <p class="muted" style="font-size:11.5px;margin-top:6px">这里最常被忽略的两件是：<b>肌少症</b>（体重还行但肌肉掉了）与<b>腹水限盐</b>。不是"吃不下"一条，也不是泛泛的"多补蛋白"。</p>
        </section></div>`,
      进食与体重: () => {
        const rows = p.nutrition.slice().reverse().map((x) => `<tr><td>${dt(x.on)}</td><td class="num">${x.weight}</td><td class="num">${x.calf}</td><td class="num">${x.grip}</td><td>${x.appetite === 'good' ? '好' : x.appetite === 'fair' ? '一般' : '差'}</td><td>${esc(x.salt || '—')}</td></tr>`).join('');
        return `<div class="grid g2">
          ${card('体重趋势', `<div class="big-num">${n.weight}<small>kg</small></div><p class="muted" style="font-size:11.5px;margin-top:4px">建档以来 ${wDelta >= 0 ? '+' : ''}${wDelta.toFixed(1)} kg（${p.nutrition.length} 次记录）</p>${sparkline(p.nutrition.map((x) => x.weight), 420, 100, '#9c5a3c')}`, { eyebrow: '单点不连线', foot: '体重受腹水与水肿影响，短期波动不等于肌肉变化。' })}
          ${card('限盐与限水（医生原话）', `<div class="rows">
            <div class="row"><div class="what"><b>盐</b><span>${esc(n.salt || '没有记录')}</span></div></div>
            <div class="row"><div class="what"><b>水</b><span>${esc(n.fluid || '没有记录')}</span></div></div>
          </div>`, { eyebrow: '抄原话，不给建议', foot: '限盐限水是腹水管理的一部分，具体量以医生交代为准；工作台不按体重替你算。' })}
        </div>
        ${card('逐次记录', `<div class="table-wrap"><table><thead><tr><th>日期</th><th>体重 kg</th><th>小腿围 cm</th><th>握力 kg</th><th>食欲</th><th>限盐</th></tr></thead><tbody>${rows}</tbody></table></div>`, { eyebrow: '三件并列，缺测写「—」' })}`;
      },
      肌少症线索: () => {
        const cFirst = p.nutrition[0], cLast = n;
        const d = (k) => (cLast[k] == null || cFirst[k] == null ? null : cLast[k] - cFirst[k]);
        const dw = d('weight'), dc = d('calf'), dg = d('grip');
        return `<div class="notice warn">肌少症的体表线索是<b>体重 + 小腿围 + 握力三件并列</b>。工作台<b>不合成评分、不算 SARC-F、不给诊断</b>——三项都下降只是"值得跟营养科说一句"的线索。</div>
        <div class="grid g3">
          ${card('体重', `<div class="big-num">${cLast.weight}<small>kg</small></div><p class="muted" style="font-size:11.5px;margin-top:4px">${dw == null ? '缺测，不计算变化' : `较建档 ${dw >= 0 ? '+' : ''}${dw.toFixed(1)} kg`}</p>`, { eyebrow: '含腹水与水肿' })}
          ${card('小腿围', `<div class="big-num">${cLast.calf}<small>cm</small></div><p class="muted" style="font-size:11.5px;margin-top:4px">${dc == null ? '缺测，不计算变化' : `较建档 ${dc >= 0 ? '+' : ''}${dc.toFixed(1)} cm`}</p>`, { eyebrow: '肌肉量的体表线索' })}
          ${card('握力', `<div class="big-num">${cLast.grip}<small>kg</small></div><p class="muted" style="font-size:11.5px;margin-top:4px">${dg == null ? '缺测，不计算变化' : `较建档 ${dg >= 0 ? '+' : ''}${dg} kg`}</p>`, { eyebrow: '测量条件需一致' })}
        </div>
        ${card('三项的逐次变化', `<div class="table-wrap"><table><thead><tr><th>日期</th><th>体重 kg</th><th>小腿围 cm</th><th>握力 kg</th><th>缺项</th></tr></thead><tbody>${p.nutrition.slice().reverse().map((x) => {
          const miss = ['weight', 'calf', 'grip'].filter((k) => x[k] == null).map((k) => ({ weight: '体重', calf: '小腿围', grip: '握力' }[k]));
          return `<tr><td>${dt(x.on)}</td><td class="num">${x.weight ?? '—'}</td><td class="num">${x.calf ?? '—'}</td><td class="num">${x.grip ?? '—'}</td><td>${miss.length ? miss.join('、') + ' 缺测' : '无'}</td></tr>`;
        }).join('')}</tbody></table></div>`, { eyebrow: '缺测显式标注', foot: '缺一项就是缺一项，不补 0、不用上次的值顶替，也不因为缺项就不显示另外两项。' })}`;
      }
    };
    return head('营养与体重 · ' + sub, SUBTITLES.nutrition,
      `<span class="chip clay">体重 <b>${n.weight} kg</b></span><span class="chip">小腿围 <b>${n.calf} cm</b></span><span class="chip">握力 <b>${n.grip} kg</b></span>`)
      + subnav('nutrition') + body[sub]();
  }

  // ---------- mind ----------
  // 早筛提醒：只给客观间隔，不给结论。参考间隔来自指南，实际由医生按个人情况定。
  const SCREEN_INTERVAL_MONTHS = 6;
  function monthsSince(dateStr, asOf) {
    if (!dateStr) return null;
    const a = new Date(dateStr), b = new Date(asOf);
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
    return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  }
  function viewMind() {
    const p = profile();
    const sub = curSub('mind');
    const asOf = last(p.reserve).on;
    const mine = (p.mind || []).slice().reverse();
    const body = {
      当下感受: () => `<div class="notice pink">私密空间 · 这里的内容<b>默认不进入一图秀、就诊摘要、导出或 Agent 预览</b>。</div>
        <div class="grid g2">
          <section class="card"><span class="eyebrow">不必马上找到答案</span><h2 style="margin-top:8px">今天，你想给自己留些什么？</h2>
            <div class="form-grid" style="margin-top:14px">
              <label class="wide"><span class="form-label">这条记录属于谁</span>
                <select id="mind-owner"><option value="patient">患者本人</option><option value="caregiver">照护者自己</option></select></label>
              <label class="wide"><span class="form-label">感受、睡眠，或者一个小小的困扰</span>
                <textarea id="mind-body" rows="4" placeholder="可以只写一句，也可以暂时不说。"></textarea></label>
            </div>
            <div class="actions" style="margin-top:12px"><button data-action="go" data-view="dash">现在先不写</button><button class="primary" data-action="demo-save">私密保存</button></div>
          </section>
          <section class="card"><h2>可以慢慢来</h2><p>记录没有打卡要求，也不评价你是否"足够积极"。</p>
            <div class="private" style="margin-top:14px"><h3>照护者，也值得被照顾</h3><p style="font-size:11.5px;margin-top:4px">家属自己的感受单独保留，<b>不写成患者的症状</b>，也不进患者的一图秀。</p></div>
            <div class="divider"></div><p class="muted" style="font-size:11.5px">出现伤害自己的想法时，请直接联系当地急救或治疗团队——工作台不做危机分级，也不假装能替代人。</p>
          </section>
        </div>`,
      我的记录: () => {
        const pv = p.viewpoints.slice().reverse();
        return `<div class="grid g2">
          ${card('心理记录（私密）', mine.length ? mine.map((m) => `<div class="saved-item private"><b>${esc(m.topic)} <span class="badge grey">${m.owner === 'caregiver' ? '照护者' : '患者'}</span></b><p>${esc(m.body)}</p><small>${dt(m.on)} · 未进入分享或导出</small></div>`).join('') : '<div class="empty"><h3>这里还没有记录</h3><p>不记录也可以使用其他帮助。</p></div>', { eyebrow: '默认不出这个门' })}
          ${card('我想说的（看法，≠ 结论）', pv.length ? pv.map((v) => `<div class="saved-item"><b>${esc(v.topic)}</b><p>"${esc(v.body)}"</p><small>${dt(v.on)} · 患者自己的话</small></div>`).join('') : '<div class="empty">还没有记录</div>', { eyebrow: '可带进就诊', foot: '看法可以进就诊准备（由你勾选），但不进趋势、不进摘要事实区。' })}
        </div>`;
      },
      支持资源: () => `<div class="grid g2">
        <section class="card"><h2>如何向别人表达我需要帮助</h2><p>先从自己的话开始：眼前最困扰的是什么，希望别人帮哪一件事。</p>
          <div class="rows" style="margin-top:12px">
            <div class="row"><div class="what"><b>例：这一周最困扰的是睡不着</b><span>不是"我不舒服"，而是具体到一件小事，别人才帮得上。</span></div></div>
            <div class="row"><div class="what"><b>例：希望有人陪我去复查</b><span>把"希望谁做什么"说出来。</span></div></div>
          </div></section>
        <section class="card"><h2>支持资源的位置</h2><p>真实版本需要核实地区、服务范围、开放时间与更新日期。这一版<b>未接入转介、真人咨询或危机服务</b>，也不做危机分级判断。</p>
          <div class="notice plain" style="margin-top:12px"><b>这里刻意没有的东西：</b>没有"心理量表评分"，没有"你属于中度焦虑"这类判定。量表需要专业施测与解释，工作台不替代。</div></section>
      </div>`,
      家里的事与早筛: () => {
        const fam = p.family.map((f) => `<div class="row"><div class="when">${f.checkedOn ? mm(f.checkedOn) : '未查'}</div><div class="what"><b>${esc(f.relation)}</b><span>HBsAg ${f.hbsag === 'positive' ? '阳性' : f.hbsag === 'negative' ? '阴性' : f.hbsag === 'not_tested' ? '未检测' : '未知'} · 疫苗 ${f.vaccinated === 'yes' ? '已完成' : f.vaccinated === 'no' ? '未接种' : f.vaccinated === 'partial' ? '部分完成' : '未知'}</span>${f.note ? `<span class="muted">${esc(f.note)}</span>` : ''}</div></div>`).join('');
        const screen = p.family.map((f) => {
          const highRisk = f.hbsag === 'positive' || f.hbsag === 'not_tested';
          const m = monthsSince(f.checkedOn, asOf);
          const due = m == null ? '没有检查日期' : `距上次检查 ${m} 个月`;
          const flag = !highRisk ? 'not_needed' : m == null ? 'unknown' : m >= SCREEN_INTERVAL_MONTHS ? 'due' : 'within';
          const label = { not_needed: '无需提示', unknown: '缺检查日期', due: '已超参考间隔', within: '间隔内' }[flag];
          const cls = flag === 'due' ? 'warn' : flag === 'within' ? 'ok' : 'grey';
          return `<div class="row"><div class="what"><b>${esc(f.relation)} <span class="badge ${cls}">${label}</span></b>
            <span>${due}${highRisk ? ` · 参考间隔 ${SCREEN_INTERVAL_MONTHS} 个月` : ''}</span>
            <span class="muted">${highRisk ? 'HBsAg 阳性或未检测，属需要随访的对象' : 'HBsAg 阴性且已接种，未列为本条提示对象'}</span></div></div>`;
        }).join('');
        return `<div class="notice plain"><b>家属线有两件不同的事，不要混：</b>
          <div style="margin-top:6px">① <b>家庭内 HBV 防护</b>——查 HBsAg、补疫苗；家庭内传播主要发生在围产期与血液暴露，不是日常接触。</div>
          <div style="margin-top:4px">② <b>HCC 高危随访</b>——HBsAg 阳性或肝硬化者，参考<b>每 ${SCREEN_INTERVAL_MONTHS} 个月一次 AFP + 腹部超声</b>（《原发性肝癌诊疗指南（2024 年版）》高危人群监测建议）。</div>
        </div>
        <div class="grid g2">
          ${card('家里每个人的状态', `<div class="rows">${fam || '<div class="empty">还没有记录家庭成员</div>'}</div>`, { eyebrow: 'HBsAg / 疫苗 / 检查日期', foot: '"未检测"与"阴性"是两种状态，不合并成一个灰点；工作台不判断是否需要接种。' })}
          ${card('随访间隔（只给客观间隔）', `<div class="rows">${screen}</div>`, { eyebrow: '参考值，不是处方', foot: `工作台只算"距上次检查几个月"，<b>不写"你该去查了"，也不出风险高低</b>。是否检查、间隔多久，由医生按个人情况定。` })}
        </div>
        <div class="callout info"><b>这一页不做的三件事：</b>不做家系图与遗传咨询；不给"得癌概率"；不把家属的检查结果写进患者本人的病程记录——两条线分表存放，不互相推算。</div>`;
      }
    };
    return head('心理与家庭 · ' + sub, SUBTITLES.mind,
      `<span class="chip">心理记录 <b>${(p.mind || []).length}</b> 条</span><span class="chip">家庭成员 <b>${p.family.length}</b></span><span class="chip ${p.family.some((f) => f.hbsag === 'not_tested') ? 'warn' : ''}">未筛查 <b>${p.family.filter((f) => f.hbsag === 'not_tested').length}</b></span>`)
      + subnav('mind') + body[sub]();
  }

  // ---------- follow ----------
  function viewFollow() {
    const p = profile();
    const sub = curSub('follow');
    const visits = p.visits.slice().reverse().map((v) => `<div class="tl-item"><h3>${esc(v.dept)} · ${esc(v.purpose)}<span class="t-date">${dt(v.on)}</span></h3><p>${esc(v.summary)}</p>${v.nextOn ? `<p class="muted">下次：${dt(v.nextOn)}</p>` : ''}</div>`).join('');
    const tasks = p.tasks.map((t) => `<div class="row"><div class="when">${mm(t.dueOn)}</div><div class="what"><b>${esc(t.title)}</b><span>${t.doneOn ? '已完成 ' + dt(t.doneOn) : '未完成'}</span></div><div class="side">${t.doneOn ? '<span class="badge ok">完成</span>' : '<span class="badge grey">待办</span>'}</div></div>`).join('');
    const qs = p.questions.map((q) => `<div class="row"><div class="when">${mm(q.on)}</div><div class="what"><b>${esc(q.body)}</b><span>${q.answered ? esc(q.answered) : '<span class="muted">未记录回答</span>'}</span></div></div>`).join('');
    const trials = p.trials.length ? p.trials.map((t) => `<div class="row"><div class="when">${esc(t.phase || '—')}</div><div class="what"><b>${esc(t.title)}</b><span>${esc(t.source)} · ${esc(t.sourceId)} · ${esc(t.site || '中心待核实')}</span><span class="muted">${esc(t.status)}</span></div></div>`).join('') : '<div class="empty">这个档案还没有登记试验线索</div>';
    const body = {
      复诊记录: () => `<div class="grid g2">
        ${card('复诊记录', `<div class="timeline">${visits || '<div class="empty">没有记录</div>'}</div>`, { eyebrow: '医生说过的话', foot: '摘要只写医生明确说过的内容；"下次复查时间"以预约单为准。' })}
        ${card('下次之前要做的', `<div class="rows">${tasks || '<div class="empty">没有待办</div>'}</div>`, { eyebrow: '日期来自登记，不是医院排期', foot: '工作台不预测复诊时间，也不在你的日程里建提醒。' })}
      </div>`,
      待办与问题: () => `<div class="grid g2">
        ${card('待办', `<div class="rows">${tasks || '<div class="empty">没有待办</div>'}</div>`, { eyebrow: '按到期日' })}
        ${card('要问的问题', `<div class="rows">${qs || '<div class="empty">还没有记录</div>'}</div>`, { eyebrow: '带去门诊', foot: '问题按原话保留，回答空缺时不要替医生补。' })}
      </div>`,
      试验线索: () => card('临床试验线索', `<div class="rows">${trials}</div>`, {
        eyebrow: '2026 数据 · 只读线索',
        aside: '<span class="badge grey">登记状态，未核实</span>',
        foot: '登记 ≠ 有效 ≠ 安全 ≠ 可入组。是否适合、能否入组，必须由研究团队按方案评估。工作台不做排序与匹配。'
      }) + `<div class="callout info"><b>数据从哪来：</b>ClinicalTrials.gov / ICTRP / ChiCTR / 药物临床试验登记与信息公示平台四个通道，2026-10-22 采集。ICTRP 当次采集失败，已在覆盖声明里写明。</div>`,
      报告与导出: () => {
        const exportable = p.questions.map((q, i) => `<label class="check-line"><input type="checkbox" ${i < 2 ? 'checked' : ''} data-export-q="${i}"><span>${esc(q.body)}</span></label>`).join('');
        const md = `# 就诊准备 · ${p.name}\n\n## 一、当前情况（记录，不是结论）\n- 分期：${p.stage.filter((s) => s.current).map((s) => `${s.system} ${s.stage}`).join(' / ')}\n- 可切除性：${esc(RESECT_ZH[(currentResect(p) || {}).conclusion] || '未记录')}\n- 最近一次肝功能：白蛋白 ${last(p.reserve).albumin} g/L，总胆红素 ${last(p.reserve).bilirubin} μmol/L，Child-Pugh ${last(p.reserve).childClass}\n- 最近一次肿瘤负荷：${last(p.tumor).count} 个结节，最大 ${last(p.tumor).maxMm ?? '—'} mm，${last(p.tumor).vp}\n\n## 二、想问的问题\n${p.questions.map((q) => `- ${q.body}`).join('\n')}\n\n## 三、不带走的内容\n- 心理与私密记录（默认不导出）\n- 家属的检查结果（属另一条线）\n\n---\n本文件由工作台按你的记录生成，不是病历、不是诊断。`;
        return `<div class="grid g2">
          ${card('选择带进门诊的内容', `<div class="rows">${exportable || '<p class="muted">还没有问题</p>'}</div>
            <div class="divider"></div><p class="muted" style="font-size:11.5px">私密记录（心理）与家属检查结果<b>不在可选范围</b>，不是忘了勾。</p>
            <div class="actions" style="margin-top:12px"><button class="primary" data-action="demo-save">生成 Markdown</button></div>`, { eyebrow: '只导出你勾选的' })}
          ${card('预览', `<pre class="export-preview">${esc(md)}</pre>`, { eyebrow: 'Markdown', foot: '一期只做 Markdown；PDF/DOCX 需逐格式验收，未实现。' })}
        </div>`;
      }
    };
    return head('复诊与回顾 · ' + sub, SUBTITLES.follow,
      `<span class="chip clay">复诊 <b>${p.visits.length}</b> 次</span><span class="chip">待办 <b>${p.tasks.filter((t) => !t.doneOn).length}</b></span><span class="chip">试验线索 <b>${p.trials.length}</b></span>`)
      + subnav('follow') + body[sub]();
  }

  // ---------- render ----------
  const VIEWS = { dash: viewDash, liver: viewLiver, tumor: viewTumor, tx: viewTx, metrics: viewMetrics, safety: viewSafety, nutrition: viewNutrition, mind: viewMind, follow: viewFollow };

  function renderNav() {
    $('#nav').innerHTML = NAV.map((n) => `<button class="nav-button" data-action="go" data-view="${n.id}" ${state.view === n.id ? 'aria-current="page"' : ''}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n.icon]}</svg>
      <span>${esc(n.label)}</span>
    </button>`).join('');
    // 二级导航放在侧栏（宽屏）与内容区顶部（窄屏）各渲染一次，由 CSS 决定谁可见，
    // 避免用 JS 判断断点造成首屏抖动。
    const dock = $('#subnav-dock');
    if (dock) {
      const items = SUBS[state.view];
      dock.innerHTML = items
        ? `<div class="subnav-block">${items.map((s) => `<button class="sub-button" data-action="sub" data-sub="${esc(s)}" ${curSub(state.view) === s ? 'aria-current="page"' : ''}>${esc(s)}</button>`).join('')}</div>`
        : '';
    }
  }

  function render() {
    const p = profile();
    $('#profile-avatar').textContent = p.initial;
    $('#profile-name').textContent = p.name + '的资料';
    $('#profile-meta').textContent = `${p.age} 岁 · ${p.etiology === 'hbv' ? 'HBV' : p.etiology} · ${currentStage(p, 'BCLC') ? 'BCLC ' + currentStage(p, 'BCLC').stage : ''}`;
    const nav = NAV.find((n) => n.id === state.view) || NAV[0];
    $('#breadcrumb').textContent = SUBS[state.view] ? `${nav.label} / ${curSub(state.view)}` : nav.label;
    renderNav();
    $('#main').innerHTML = VIEWS[state.view]();
    document.body.classList.toggle('large', state.large);
    $('#font-toggle').setAttribute('aria-pressed', state.large ? 'true' : 'false');
    $('#workspace').classList.toggle('with-agent', state.agentOpen);
    $('#agent-pane').hidden = !state.agentOpen;
    $('#workspace').style.setProperty('--agent-w', state.agentWidth + '%');
    $('#main').scrollTop = 0;
  }

  // ---------- dialogs ----------
  const dialog = $('#dialog');
  function openDialog(title, eyebrow, body, foot) {
    $('#dialog-title').textContent = title;
    $('#dialog-eyebrow').textContent = eyebrow;
    $('#dialog-body').innerHTML = body;
    $('#dialog-foot').innerHTML = foot || '<button data-action="close">知道了</button>';
    dialog.showModal();
  }

  function settingsBody() {
    return `<h3>工作区</h3><ul><li>资料目录：<b>未选择</b>（原型不写盘）</li><li>演示档案：2 个，切换后默认指标同构（白蛋白 + AFP + Child-Pugh 分类）</li></ul>
      <h3>文档解析（MinerU）</h3><ul><li>Token 优先级：<b>显式传入 &gt; 密钥文件 &gt; 环境变量</b></li><li>设置页可手工填写、可清除；状态显示掩码 + 文件路径 + 来源</li><li>解析结果永远是候选，逐项确认后才进事实层</li></ul>
      <h3>临床数据库</h3><ul><li>2026 年 HCC 试验线索：在线四通道（ICTRP / CTV / ChiCTR / 中国药物临床试验登记）</li><li>逐来源终态与覆盖率写入库，离线语料对 HCC <b>未配置</b></li></ul>
      <h3>已知边界</h3><ul><li>不提供诊断、治疗建议、预后判断</li><li>登记状态不等于可入组；工作台不排序、不匹配</li></ul>`;
  }

  function profilesBody() {
    return D.profiles.map((p) => `<div class="row"><div class="when">${esc(p.age)} 岁</div><div class="what"><b>${esc(p.name)} · ${esc(p.tag)}</b><span>${esc(p.summary)}</span></div><div class="side">${p.id === state.pid ? '<span class="badge ok">当前</span>' : `<button data-action="switch" data-pid="${p.id}" style="min-height:32px;padding:4px 10px;font-size:11.5px">切换</button>`}</div></div>`).join('');
  }

  function helpBody() {
    return `<h3>怎么点</h3><ul><li>左侧 9 个一级导航：看板 / 我的肝 / 我的瘤 / 治疗与转化 / 指标分析 / 安全线 / 营养与体重 / 心理与家庭 / 复诊与回顾</li><li>看板与「指标分析」的指标卡都能翻：<b>点一下翻到背面看趋势，再点一下翻回正面</b>；Tab 选中后按回车也行</li><li>顶部“大字 Aa”切换 15 / 17 px 字号</li><li>右侧对话面板：点顶部“对话”打开，可拖左边缘调宽、可收起</li></ul>
      <h3>这不是什么</h3><ul><li>不是诊断工具，不判断严重程度，不给治疗建议</li><li>不是医院系统，不改预约、不传资料</li><li>所有数字都是合成演示数据，不对应任何真实患者</li></ul>`;
  }

  // ---------- events ----------
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const act = btn.dataset.action;
    if (act === 'go') { state.view = btn.dataset.view; state.sub = btn.dataset.sub || null; render(); return; }
    // 二级切换：state.sub 只存"二级页名"，一级变了就回落，避免上一个一级的 sub 泄漏过来。
    if (act === 'sub') { state.sub = btn.dataset.sub; render(); return; }
    if (act === 'demo-save') { toast('原型不写盘：保存后由本机 SQLite 承接，这里只做交互演示'); return; }
    // 整卡翻面：只改 aria-pressed 与隐藏面的 inert，不重绘整页——重绘会打断 480ms 过渡。
    if (act === 'flip') {
      const code = btn.dataset.code || btn.dataset.card;
      if (!code) return;
      const on = !state.flipped.has(code);
      if (on) state.flipped.add(code); else state.flipped.delete(code);
      btn.setAttribute('aria-pressed', String(on));
      const inner = btn.querySelector('.mcard-inner, .metric-inner');
      const front = btn.querySelector('.mface.front, .metric-face:not(.metric-back)');
      const back = btn.querySelector('.mface.back, .metric-back');
      [front, back].forEach((f, i) => {
        const visible = (i === 0) === !on;
        if (!f) return;
        f.toggleAttribute('inert', !visible);
        f.setAttribute('aria-hidden', String(!visible));
      });
      if (inner) inner.style.transform = on ? 'rotateY(180deg)' : '';
      return;
    }
    if (act === 'profiles') { openDialog('切换演示档案', '演示数据', profilesBody()); return; }
    if (act === 'switch') { state.pid = btn.dataset.pid; state.flipped.clear(); dialog.close(); render(); toast('已切换档案'); return; }
    if (act === 'settings') { openDialog('设置', '本机优先', settingsBody()); return; }
    if (act === 'about') { openDialog('关于小甘宝', 'HepPal', `<p><b>小甘宝 HepPal v0.2.1</b> · 构建 2026-10-23</p><p>原型阶段：G2 未签认，未接入 DSH，未装机。</p><p>数据：2 个合成档案 + demo-data.sqlite；临床库为 2026 年在线检索快照。</p>`); return; }
    if (act === 'help') { openDialog('原型操作说明', '小甘宝', helpBody()); return; }
    if (act === 'close') { dialog.close(); return; }
    if (act === 'open-store') { toast('原型不写盘：接入后由您选择资料目录'); return; }
    if (act === 'start-session') { toggleAgent(true); return; }
    if (act === 'agent-close') { toggleAgent(false); return; }
    if (act === 'agent-wider') { state.agentWidth = state.agentWidth >= 42 ? 28 : state.agentWidth + 7; $('#workspace').style.setProperty('--agent-w', state.agentWidth + '%'); return; }
  });

  function toggleAgent(open) {
    state.agentOpen = open;
    $('#workspace').classList.toggle('with-agent', open);
    $('#agent-pane').hidden = !open;
    $('#ready-session').innerHTML = open ? '<i></i><span>对话</span><b>已打开</b>' : '<i class="grey"></i><span>对话</span><b>未进入激活</b>';
    if (open) setTimeout(() => $('#agent-text').focus(), 60);
  }

  $('#agent-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const val = $('#agent-text').value.trim();
    if (!val) return;
    $('#agent-msg-user').hidden = false;
    $('#agent-msg-user').textContent = val;
    $('#agent-msg-bot').hidden = false;
    $('#agent-msg-bot').textContent = '原型里我不会真的回答。接入 Desktop 后，这句话会交给宿主原生会话；它能看到当前档案的两条轨道记录，但不会替医生判断。';
    $('#agent-text').value = '';
  });

  // 拖动调宽（25%–45%）
  (function splitter() {
    const sp = $('#agent-splitter');
    let dragging = false;
    sp.addEventListener('mousedown', (e) => { dragging = true; e.preventDefault(); document.body.style.cursor = 'col-resize'; });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const pct = ((window.innerWidth - e.clientX) / window.innerWidth) * 100;
      state.agentWidth = Math.min(45, Math.max(25, Math.round(pct)));
      $('#workspace').style.setProperty('--agent-w', state.agentWidth + '%');
    });
    window.addEventListener('mouseup', () => { dragging = false; document.body.style.cursor = ''; });
  })();

  $('#font-toggle').addEventListener('click', () => { state.large = !state.large; render(); });

  // 键盘：数字键切换一级导航（方便走查）
  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input,textarea')) return;
    const n = Number(e.key);
    if (n >= 1 && n <= NAV.length) { state.view = NAV[n - 1].id; render(); }
  });

  render();
})();

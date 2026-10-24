window.__ModuleLoader__.load({
  id: "@xyb-community/liver-cancer-workbench",
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const API = '/api/liver-cancer-workbench'
    const metadata = {"title":"肝细胞癌患者工作台 · 小甘宝 HepPal","description":"面向肝细胞癌（HCC）患者与照护者的本机优先工作台：肝功能储备与肿瘤负荷双轨记录、转化治疗评估、门脉高压与肝相关安全性、HBV 家庭防护"}
    /* —— AI 会话区（customFrame 合同） ——
       macOS 收起侧栏时窗口按钮占左上角：根节点首个子元素必须是语义 <header>，
       并用 --dsh-frame-leading-clearance 避让。
       原生会话节点始终挂载（只用 display 控制显隐），卸载会丢输入框与草稿。 */
    const AGENT_DEFAULT = 0.35
    const AGENT_MIN = 0.25
    const AGENT_MAX = 0.45
    const AGENT_STEP = 0.02
    const NARROW_BELOW = 760
    const DRAWER_MAX = 420
    const WIDTH_KEY = 'ganbao.liver.agent-pane.v1'

    const clampWidth = (value) => {
      const n = Number(value)
      if (!Number.isFinite(n)) return AGENT_DEFAULT
      return Math.min(AGENT_MAX, Math.max(AGENT_MIN, n))
    }
    /** 对齐到 1% 网格：鼠标拖与键盘调落在同一组取值上，不会出现 33.7% 这种数。
        不能按 0.02 网格取整——默认 35% 本身就在 2% 网格的半格上，取整会被顶到 38%。 */
    const snapWidth = (value) => clampWidth(Math.round(clampWidth(value) * 100) / 100)
    const round4 = (n) => Math.round(n * 10000) / 10000

    function loadPane() {
      try {
        const saved = JSON.parse(localStorage.getItem(WIDTH_KEY) || 'null')
        return { width: clampWidth(saved?.width), open: saved?.open !== false }
      } catch { return { width: AGENT_DEFAULT, open: true } }
    }
    function savePane(width, open) {
      try { localStorage.setItem(WIDTH_KEY, JSON.stringify({ width: round4(width), open })) } catch { /* 隐私模式忽略 */ }
    }

    // 会话归属只问 currentSession + ownsSession：customFrame 下 conversation prop
    // 在本工作台 active 时恒非空（宿主传的是 display:none 容器），不能当"已有会话"的判据。
    let bridge = null
    function currentSession() {
      const service = bridge?.desktopWorkbenches
      if (typeof service?.currentSession === 'function') return service.currentSession() || null
      const snapshot = bridge?.sessions?.list?.getSnapshot?.()
      return snapshot?.current || Object.keys(snapshot?.byId || {}).find((id) =>
        (snapshot.byId[id]?.retainedBy?.mainView ?? 0) > 0) || null
    }
    function ownedSession() {
      const id = currentSession()
      const service = bridge?.desktopWorkbenches
      if (!id || typeof service?.ownsSession !== 'function') return null
      return service.ownsSession(id) ? id : null
    }

    /** 只往原生草稿里填字，绝不自动发送。 */
    function fillDraft(sessionId, prompt) {
      if (!sessionId || ownedSession() !== sessionId) throw new Error('会话已切换，请回到本工作台再操作')
      const actx = bridge.sessions.scope?.(sessionId)
      const conversation = actx?.get?.('conversation')
      if (!conversation) throw new Error('对话输入不可用')
      const input = conversation.input.for(actx)
      const snapshot = input.state.getSnapshot()
      if (snapshot.occurrences?.length || (snapshot.phase && snapshot.phase !== 'plain')) {
        throw new Error('当前草稿含引用或特殊输入，请先在原生会话里处理，再交给小甘宝')
      }
      const current = snapshot.draft || ''
      input.setDraft(current.trim() ? `${current}\n\n${prompt}` : prompt)
    }

    const DRAFT_QUEUE_KEY = 'ganbao.liver.initial-drafts.v1'
    let pendingDraft = null
    try {
      const saved = JSON.parse(localStorage.getItem(DRAFT_QUEUE_KEY) || 'null')
      if (saved?.sessionId && saved?.prompt) pendingDraft = saved
    } catch { /* 隐私模式忽略 */ }
    function rememberDraft(entry) {
      pendingDraft = entry
      try {
        if (entry) localStorage.setItem(DRAFT_QUEUE_KEY, JSON.stringify(entry))
        else localStorage.removeItem(DRAFT_QUEUE_KEY)
      } catch { /* 隐私模式忽略 */ }
    }
    function flushDraft() {
      if (!pendingDraft) return false
      try {
        fillDraft(pendingDraft.sessionId, pendingDraft.prompt)
        rememberDraft(null)
        return true
      } catch { return false } // composer 未就绪就留给下一轮
    }

    function onboardingPrompt(dir) {
      return [
        '你正在协助我使用「小甘宝 HepPal 肝细胞癌工作台」。它只做本机资料整理，不提供诊疗建议。',
        `资料目录：${dir || '（首次打开时在面板里选择）'}`,
        '里面是我的化验单、影像与病理报告、治疗历程、以及对症记录。',
        '请把「肝的储备」和「瘤的负荷」分开看，两件事不要加总成一个分数；门脉高压是第三条线。',
        'BCLC 与 CNLC 分期并存时不换算；分期与可切除性是医生写的结论，按原话记录，不替他改。',
        '我标记的"看法"是我自己的担心或判断，不是医生结论。',
      ].join('\n')
    }

    const theme = `/* Scope to business content; never style host navigation globally. */
.wb-liver-cancer-workbench {
  --wb-paper:#fbf8f6; --wb-surface:#ffffff; --wb-ink:#3b3430; --wb-ink2:#5f544e;
  --wb-muted:#8d7f77; --wb-line:#ece2db; --wb-clay:#9c5a3c; --wb-clay-deep:#7d4327;
  --wb-track-a:#2f6f66; --wb-track-b:#c2703d; --wb-track-c:#8a5a0c;
  --wb-radius:18px; --wb-card-h:276px;
  color: var(--wb-ink); background: var(--wb-paper);
  font: 15px/1.62 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;
  font-variant-numeric: tabular-nums; min-width: 0; min-height: 0; container-type: inline-size;
}
.wb-liver-cancer-workbench[data-font=large]{ font-size:17px; }
.wb-liver-cancer-workbench *{ box-sizing:border-box; }
.wb-liver-cancer-workbench button{ font:inherit; color:inherit; cursor:pointer; }
.wb-liver-cancer-workbench :focus-visible{ outline:2px solid var(--wb-clay); outline-offset:3px; }
.wb-liver-cancer-workbench .wb-body{ flex:1; display:flex; flex-direction:column; gap:16px; padding:20px 24px 32px; overflow:auto; }
/* —— 面板骨架（customFrame）：顶栏 + 业务区（侧栏 + 主区）+ 原生会话区 ——
   布局对齐小粉宝：宽屏左侧 236px 竖栏，窄屏折叠为「品牌行 + 一级横排」。
   会话区宽度由 splitter 拖动控制（25%–45%），收起只切 display，不卸载会话。 */
.wb-liver-cancer-workbench{ display:flex; flex-direction:column; flex:1; min-height:0; min-width:0; }
.wb-liver-cancer-workbench .wb-frame-head{ display:flex; align-items:center; gap:10px; flex:0 0 auto; flex-wrap:wrap;
  padding:6px 12px; padding-inline-start:var(--dsh-frame-leading-clearance, 12px);
  border-bottom:1px solid var(--wb-line); background:var(--wb-surface); font-size:12px; }
.wb-liver-cancer-workbench .wb-frame-brand{ display:flex; align-items:center; gap:7px; font-weight:700;
  color:var(--wb-clay-deep); white-space:nowrap; font-size:12.5px; }
.wb-liver-cancer-workbench .wb-frame-ver{ font-weight:500; font-size:11px; color:var(--wb-muted);
  background:var(--wb-paper); border:1px solid var(--wb-line); border-radius:999px; padding:1px 8px; white-space:nowrap; }
.wb-liver-cancer-workbench .wb-frame-hint{ flex:1; min-width:180px; color:var(--wb-muted); font-size:11.5px; }
.wb-liver-cancer-workbench .wb-frame-actions{ display:flex; align-items:center; gap:6px; flex:0 0 auto; margin-inline-start:auto; }
.wb-liver-cancer-workbench .wb-frame-body{ position:relative; display:flex; flex:1; min-height:0; min-width:0; overflow:hidden; }
.wb-liver-cancer-workbench .wb-business{ display:grid; grid-template-columns:236px minmax(0,1fr);
  flex:1; min-width:0; min-height:0; background:var(--wb-paper); }
.wb-liver-cancer-workbench .wb-side{ display:flex; flex-direction:column; gap:6px; min-width:0;
  padding:16px 14px 14px; background:var(--wb-surface); border-inline-end:1px solid var(--wb-line); }
.wb-liver-cancer-workbench .wb-brand{ display:flex; gap:10px; align-items:center; padding:0 4px 12px; min-width:0; }
.wb-liver-cancer-workbench .wb-brand-mark{ display:grid; place-items:center; width:44px; height:44px; flex:0 0 auto;
  border-radius:14px; background:#f6e9e1; border:1px solid var(--wb-line); color:var(--wb-clay-deep);
  font-weight:600; font-size:17px; }
.wb-liver-cancer-workbench .wb-brand b{ display:block; font-size:17px; letter-spacing:.6px; line-height:1.25; }
.wb-liver-cancer-workbench .wb-brand span{ display:block; font-size:10.5px; color:var(--wb-muted); letter-spacing:.2px; }
.wb-liver-cancer-workbench .wb-side-profile{ display:flex; gap:9px; align-items:center; min-width:0;
  padding:8px 10px; margin-bottom:8px; background:#fdf6f1; border:1px solid #f0dccf; border-radius:12px; }
.wb-liver-cancer-workbench .wb-side-profile .av{ display:grid; place-items:center; width:29px; height:29px; flex:0 0 auto;
  border-radius:50%; background:var(--wb-surface); border:1px solid #f0dccf; font-size:12.5px; font-weight:600; color:var(--wb-clay-deep); }
.wb-liver-cancer-workbench .wb-side-profile b{ display:block; font-size:12px; line-height:1.35; }
.wb-liver-cancer-workbench .wb-side-profile span{ display:block; font-size:10.5px; color:var(--wb-muted); }
.wb-liver-cancer-workbench .wb-nav{ display:flex; flex-direction:column; gap:3px; min-width:0; }
.wb-liver-cancer-workbench .wb-nav button{ display:flex; align-items:center; gap:9px; width:100%; text-align:start;
  border:1px solid transparent; background:none; border-radius:10px; padding:8px 11px; min-height:38px;
  color:var(--wb-ink2); font-size:13px; white-space:nowrap; }
.wb-liver-cancer-workbench .wb-nav button:hover{ background:var(--wb-paper); }
.wb-liver-cancer-workbench .wb-nav button[aria-current=true]{ background:#fdf6f1; border-color:#f0dccf;
  color:var(--wb-clay-deep); font-weight:600; }
.wb-liver-cancer-workbench .wb-nav .dot{ width:6px; height:6px; border-radius:50%; flex:0 0 auto; background:#d9c8bd; }
.wb-liver-cancer-workbench .wb-nav button[aria-current=true] .dot{ background:var(--wb-clay); }
.wb-liver-cancer-workbench .wb-side-bottom{ margin-top:auto; padding:14px 4px 0; border-top:1px solid var(--wb-line); }
.wb-liver-cancer-workbench .wb-side-bottom b{ display:block; font-size:9.5px; letter-spacing:1.2px;
  text-transform:uppercase; color:var(--wb-muted); font-weight:600; }
.wb-liver-cancer-workbench .wb-side-bottom p{ margin:6px 0 0; font-size:11.5px; line-height:1.7; color:var(--wb-muted); }
.wb-liver-cancer-workbench .wb-main{ display:flex; flex-direction:column; min-width:0; min-height:0; }
.wb-liver-cancer-workbench .wb-topbar{ display:flex; align-items:center; gap:12px; flex-wrap:wrap; flex:0 0 auto;
  padding:9px 20px; background:var(--wb-surface); border-bottom:1px solid var(--wb-line); }
.wb-liver-cancer-workbench .wb-crumb{ font-size:11.5px; color:var(--wb-muted); white-space:nowrap; }
.wb-liver-cancer-workbench .wb-crumb b{ color:var(--wb-ink); font-weight:600; }
.wb-liver-cancer-workbench .wb-topbar .wb-top-actions{ display:flex; align-items:center; gap:6px; margin-inline-start:auto; }
@container (max-width: 900px){
  .wb-liver-cancer-workbench .wb-business{ grid-template-columns:minmax(0,1fr); }
  .wb-liver-cancer-workbench .wb-side{ border-inline-end:0; border-bottom:1px solid var(--wb-line);
    padding:10px 14px; flex-direction:column; gap:8px; }
  .wb-liver-cancer-workbench .wb-brand{ padding:0; }
  .wb-liver-cancer-workbench .wb-brand-mark{ width:34px; height:34px; border-radius:11px; font-size:14px; }
  .wb-liver-cancer-workbench .wb-brand b{ font-size:15px; }
  .wb-liver-cancer-workbench .wb-side-profile,
  .wb-liver-cancer-workbench .wb-side-bottom{ display:none; }
  .wb-liver-cancer-workbench .wb-nav{ flex-direction:row; flex-wrap:nowrap; overflow-x:auto; gap:4px; padding-bottom:1px; }
  .wb-liver-cancer-workbench .wb-nav button{ width:auto; min-height:34px; padding:6px 11px; font-size:12.5px; }
  .wb-liver-cancer-workbench .wb-nav .dot{ display:none; }
  .wb-liver-cancer-workbench .wb-body{ padding:14px 16px 26px; }
  .wb-liver-cancer-workbench .wb-topbar{ padding:8px 16px; }
}
/* —— 原生会话区：可拖宽（25%–45%）、可收起，收起时不卸载 —— */
.wb-liver-cancer-workbench .wb-agent{ display:flex; flex-direction:column; flex:0 0 auto; min-width:0; min-height:0;
  border-inline-start:1px solid var(--wb-line); background:var(--wb-surface); overflow:hidden; }
.wb-liver-cancer-workbench .wb-agent-drawer{ position:absolute; top:0; right:0; bottom:0; z-index:3;
  box-shadow:-8px 0 24px rgba(59,52,48,.14); }
.wb-liver-cancer-workbench .wb-scrim{ position:absolute; inset:0; z-index:2; border:0; padding:0;
  background:rgba(59,52,48,.26); cursor:pointer; }
.wb-liver-cancer-workbench .wb-splitter{ flex:0 0 auto; width:6px; cursor:col-resize; touch-action:none;
  background:var(--wb-paper); border-inline-start:1px solid var(--wb-line); border-inline-end:1px solid var(--wb-line); }
.wb-liver-cancer-workbench .wb-splitter:hover,
.wb-liver-cancer-workbench .wb-splitter:focus-visible{ background:#eeded2; }
.wb-liver-cancer-workbench .wb-agent-empty{ display:flex; flex-direction:column; gap:8px; justify-content:center;
  padding:22px 20px; color:var(--wb-ink2); font-size:12.5px; line-height:1.75; }
/* 会话是宿主给的 DOM 节点，不是 React 元素：只能挂在容器上，不能当子节点渲染 */
.wb-liver-cancer-workbench .wb-agent-host{ display:flex; flex-direction:column; flex:1 1 auto; min-height:0; min-width:0; }
.wb-liver-cancer-workbench .wb-agent-host > *{ flex:1 1 auto; min-height:0; min-width:0; }
.wb-liver-cancer-workbench .wb-btn-agent{ border:0; border-radius:999px; padding:5px 14px; white-space:nowrap;
  background:var(--wb-clay); color:#fff; font:inherit; font-weight:600; font-size:12px; cursor:pointer; }
.wb-liver-cancer-workbench .wb-btn-agent:disabled{ opacity:.5; cursor:not-allowed; }
.wb-liver-cancer-workbench .wb-btn-ghost{ border:1px solid var(--wb-line); border-radius:999px; background:transparent;
  color:var(--wb-ink2); padding:4px 10px; font:inherit; font-size:12px; cursor:pointer; }
.wb-liver-cancer-workbench .wb-agent-note{ font-size:11px; color:var(--wb-clay-deep); font-weight:600; }
.wb-liver-cancer-workbench .wb-head{ display:flex; gap:12px; flex-wrap:wrap; align-items:center;
  padding-inline-start: var(--dsh-frame-leading-clearance, 0px); }
.wb-liver-cancer-workbench .wb-nav{ display:flex; gap:6px; flex-wrap:wrap; }
.wb-liver-cancer-workbench .wb-nav button{ border:1px solid transparent; background:none; border-radius:999px; padding:6px 14px; min-height:36px; color:var(--wb-ink2); }
.wb-liver-cancer-workbench .wb-nav button[aria-current=true]{ background:var(--wb-surface); border-color:var(--wb-line); color:var(--wb-clay-deep); font-weight:600; }
.wb-liver-cancer-workbench h1{ font-size:26px; margin:0; letter-spacing:-.4px; }
.wb-liver-cancer-workbench .wb-lead{ margin:4px 0 0; color:var(--wb-ink2); max-width:64ch; }
.wb-liver-cancer-workbench .wb-chips{ display:flex; gap:8px; flex-wrap:wrap; }
.wb-liver-cancer-workbench .wb-chip{ font-size:11.5px; padding:3px 10px; border-radius:999px; background:var(--wb-surface); border:1px solid var(--wb-line); color:var(--wb-ink2); }
.wb-liver-cancer-workbench .wb-chip b{ color:var(--wb-ink); }
.wb-liver-cancer-workbench .wb-tracks{ display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:0; background:var(--wb-surface);
  border:1px solid var(--wb-line); border-radius:14px; overflow:hidden; }
.wb-liver-cancer-workbench .wb-track{ padding:12px 16px; display:flex; gap:10px; min-width:0; }
.wb-liver-cancer-workbench .wb-track + .wb-track{ border-inline-start:1px solid var(--wb-line); }
.wb-liver-cancer-workbench .wb-track i{ width:8px; height:8px; border-radius:50%; margin-top:9px; flex:0 0 auto; }
.wb-liver-cancer-workbench .wb-track b{ display:block; font-size:12.5px; }
.wb-liver-cancer-workbench .wb-track span{ display:block; font-size:11.5px; color:var(--wb-muted); line-height:1.5; }
.wb-liver-cancer-workbench .wb-notice{ background:#fdf6f1; border:1px solid #f0dccf; border-radius:12px;
  padding:10px 14px; font-size:12.5px; color:var(--wb-ink2); }
.wb-liver-cancer-workbench .wb-group-head{ display:flex; align-items:baseline; gap:10px;
  margin-bottom:10px; padding-bottom:7px; border-bottom:1px solid var(--wb-line); }
.wb-liver-cancer-workbench .wb-group-head h3{ font-size:13.5px; margin:0; }
.wb-liver-cancer-workbench .wb-group-head span{ font-size:11.5px; color:var(--wb-muted); }
.wb-liver-cancer-workbench .wb-grid{ display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px; }
@container (max-width: 960px){ .wb-liver-cancer-workbench .wb-grid{ grid-template-columns:1fr; } }
@container (max-width: 900px){
  .wb-liver-cancer-workbench .wb-nav{ flex-direction:row; flex-wrap:nowrap; }
}
@container (max-width: 720px){ .wb-liver-cancer-workbench .wb-tracks{ grid-template-columns:1fr; }
  .wb-liver-cancer-workbench .wb-track + .wb-track{ border-inline-start:0; border-block-start:1px solid var(--wb-line); } }
/* —— 3D 翻面卡：外卡透视、内层 preserve-3d、两面 inset:0 且背面预转 180° —— */
.wb-liver-cancer-workbench .wb-card{ display:block; width:100%; height:var(--wb-card-h); padding:0; border:0;
  background:none; text-align:start; border-radius:18px; perspective:1100px; min-width:0; font:inherit; }
.wb-liver-cancer-workbench .wb-card-inner{ position:relative; display:block; height:100%;
  transform-style:preserve-3d; transition:transform 480ms cubic-bezier(.2,.7,.2,1); will-change:transform; }
.wb-liver-cancer-workbench .wb-card[aria-pressed=true] .wb-card-inner{ transform:rotateY(180deg); }
.wb-liver-cancer-workbench .wb-face{ position:absolute; inset:0; display:flex; flex-direction:column; padding:20px;
  border:1px solid var(--wb-line); border-radius:18px; background:var(--wb-surface); overflow:hidden;
  backface-visibility:hidden; -webkit-backface-visibility:hidden;
  transition:border-color .16s, box-shadow .16s; }
.wb-liver-cancer-workbench .wb-card:hover .wb-face{ border-color:#e6c9b8; box-shadow:0 6px 18px rgba(94,51,36,.07); }
.wb-liver-cancer-workbench .wb-face.back{ transform:rotateY(180deg); background:linear-gradient(165deg,#fdf7f2,#fbfaf7); }
.wb-liver-cancer-workbench .wb-flip{ position:absolute; top:16px; right:16px; font-size:13px; color:#c9b8ad;
  transition:color .16s, transform .32s cubic-bezier(.2,.7,.2,1); pointer-events:none; }
.wb-liver-cancer-workbench .wb-card:hover .wb-flip{ color:var(--wb-clay-deep); transform:rotate(180deg); }
.wb-liver-cancer-workbench .wb-cat{ font-size:10.5px; letter-spacing:.4px; color:#a2949b; display:flex; align-items:center; gap:6px; padding-inline-end:20px; }
.wb-liver-cancer-workbench .wb-cat i{ width:7px; height:7px; border-radius:50%; flex:0 0 auto; }
.wb-liver-cancer-workbench .wb-name{ display:block; font-size:15px; color:var(--wb-ink2); margin-top:9px; line-height:1.3; }
.wb-liver-cancer-workbench .wb-val{ display:block; font-size:33px; font-weight:600; letter-spacing:-.9px; line-height:1.15; margin-top:4px; }
.wb-liver-cancer-workbench .wb-val small{ font-size:12px; font-weight:500; color:var(--wb-muted); margin-inline-start:5px; letter-spacing:0; }
.wb-liver-cancer-workbench .wb-delta{ display:block; font-size:11.5px; color:var(--wb-ink2); margin-top:5px; }
.wb-liver-cancer-workbench .wb-delta em{ font-style:normal; font-weight:600; color:var(--wb-ink); }
.wb-liver-cancer-workbench .wb-note{ display:block; font-size:11px; line-height:1.55; color:#9b8d86; margin-top:10px; max-width:94%; }
.wb-liver-cancer-workbench .wb-meta{ display:flex; justify-content:space-between; gap:8px; font-size:10.5px; color:var(--wb-muted); margin-top:auto; padding-top:8px; }
.wb-liver-cancer-workbench .wb-src{ display:block; font-size:10px; color:#b0a29a; margin-top:3px; }
.wb-liver-cancer-workbench .wb-badge{ align-self:flex-start; margin-top:8px; font-size:9.5px; font-weight:600;
  padding:1px 7px; border-radius:20px; border:1px solid #e8ddd6; background:#fbf7f4; color:#7d6a60; }
.wb-liver-cancer-workbench .wb-badge.warn{ background:#fdf0e8; border-color:#efcdb8; color:#8a3d1c; }
.wb-liver-cancer-workbench .wb-spark{ display:block; flex:1 1 auto; min-height:0; margin:8px 0 2px; }
.wb-liver-cancer-workbench .wb-spark svg{ display:block; width:100%; height:auto; max-height:110px; }
.wb-liver-cancer-workbench .wb-line{ display:block; font-size:10.5px; line-height:1.5; color:var(--wb-ink2); margin-top:4px; }
.wb-liver-cancer-workbench .wb-na{ display:block; font-size:11.5px; color:var(--wb-muted); margin-top:10px; line-height:1.65; }
.wb-liver-cancer-workbench .wb-foot{ display:block; margin-top:auto; padding-top:6px; font-size:9.5px; color:#a3949b; }
.wb-liver-cancer-workbench[data-font=large] .wb-val{ font-size:36px; }
/* —— 专项视图：面板 / 表 / 时间线。全部用语义变量，暗色下不会白底白字 —— */
.wb-liver-cancer-workbench .wb-sec{ display:block; }
.wb-liver-cancer-workbench .wb-sec h2{ font-size:16px; margin:0 0 3px; letter-spacing:-.2px; }
.wb-liver-cancer-workbench .wb-sec p.wb-lead{ margin:0 0 2px; font-size:12.5px; }
.wb-liver-cancer-workbench .wb-stack{ display:flex; flex-direction:column; gap:16px; }
.wb-liver-cancer-workbench .wb-two{ display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px; align-items:start; }
.wb-liver-cancer-workbench .wb-panel{ background:var(--wb-surface); border:1px solid var(--wb-line); border-radius:14px; overflow:hidden; }
.wb-liver-cancer-workbench .wb-panel-h{ padding:10px 14px; border-bottom:1px solid var(--wb-line); display:flex; gap:10px; align-items:baseline; flex-wrap:wrap; }
.wb-liver-cancer-workbench .wb-panel-h b{ font-size:13px; }
.wb-liver-cancer-workbench .wb-panel-h span{ font-size:11px; color:var(--wb-muted); }
.wb-liver-cancer-workbench .wb-scroll{ overflow-x:auto; }
.wb-liver-cancer-workbench .wb-tbl{ width:100%; border-collapse:collapse; font-size:12px; }
.wb-liver-cancer-workbench .wb-tbl th{ text-align:start; font-weight:600; font-size:11px; color:var(--wb-muted);
  padding:8px 12px; border-bottom:1px solid var(--wb-line); background:var(--wb-paper); white-space:nowrap; }
.wb-liver-cancer-workbench .wb-tbl td{ padding:9px 12px; border-bottom:1px solid var(--wb-line); color:var(--wb-ink2); vertical-align:top; }
.wb-liver-cancer-workbench .wb-tbl tr:last-child td{ border-bottom:0; }
.wb-liver-cancer-workbench .wb-tbl td b{ color:var(--wb-ink); font-weight:600; }
.wb-liver-cancer-workbench .wb-tbl td.n{ font-variant-numeric:tabular-nums; white-space:nowrap; }
.wb-liver-cancer-workbench .wb-item{ padding:11px 14px; border-bottom:1px solid var(--wb-line); display:flex; gap:12px; }
.wb-liver-cancer-workbench .wb-item:last-child{ border-bottom:0; }
.wb-liver-cancer-workbench .wb-item .d{ flex:0 0 76px; font-size:11px; color:var(--wb-muted); font-variant-numeric:tabular-nums; padding-top:2px; }
.wb-liver-cancer-workbench .wb-item .c{ flex:1; min-width:0; font-size:12.5px; line-height:1.62; }
.wb-liver-cancer-workbench .wb-item .c b{ display:block; font-size:13px; color:var(--wb-ink); margin-bottom:1px; }
.wb-liver-cancer-workbench .wb-item .c span{ display:block; }
.wb-liver-cancer-workbench .wb-tag{ display:inline-block; font-size:10px; padding:0 7px; border-radius:20px;
  border:1px solid var(--wb-line); color:var(--wb-muted); margin-inline-start:6px; font-weight:400; vertical-align:1px; }
.wb-liver-cancer-workbench .wb-tag.now{ border-color:#e6c9b8; }
.wb-liver-cancer-workbench .wb-tag.now{ color:var(--wb-clay-deep); }
.wb-liver-cancer-workbench .wb-empty{ padding:16px; font-size:12px; color:var(--wb-muted); line-height:1.7; }
.wb-liver-cancer-workbench .wb-private{ font-size:11px; color:var(--wb-muted); background:var(--wb-paper);
  border:1px dashed var(--wb-line); border-radius:10px; padding:8px 12px; }
/* —— 导入队列与候选：队列行是按钮，候选行带原文行与两个动作 —— */
.wb-liver-cancer-workbench .wb-qrow{ display:flex; gap:10px; width:100%; align-items:flex-start; text-align:start;
  background:none; border:0; border-bottom:1px solid var(--wb-line); padding:11px 14px; min-height:44px; }
.wb-liver-cancer-workbench .wb-qrow:last-child{ border-bottom:0; }
.wb-liver-cancer-workbench .wb-qrow:hover{ background:var(--wb-paper); }
.wb-liver-cancer-workbench .wb-qrow[aria-current=true]{ background:#fdf6f1; }
.wb-liver-cancer-workbench .wb-qrow .qmain{ flex:1; min-width:0; }
.wb-liver-cancer-workbench .wb-qrow b{ display:block; font-size:13px; color:var(--wb-ink); }
.wb-liver-cancer-workbench .wb-qrow span{ display:block; font-size:11.5px; color:var(--wb-muted); line-height:1.55; }
.wb-liver-cancer-workbench .wb-st{ flex:0 0 auto; font-size:10.5px; padding:1px 8px; border-radius:20px; margin-top:2px;
  border:1px solid var(--wb-line); color:var(--wb-muted); background:var(--wb-paper); white-space:nowrap; }
.wb-liver-cancer-workbench .wb-st.ok{ color:#2f6f66; border-color:#bcdcd4; background:#eef7f4; }
.wb-liver-cancer-workbench .wb-st.bad{ color:#8a3d1c; border-color:#efcdb8; background:#fdf0e8; }
.wb-liver-cancer-workbench .wb-st.wait{ color:#7d5a12; border-color:#ecdcb6; background:#fdf7e8; }
.wb-liver-cancer-workbench .wb-cand{ display:flex; gap:12px; align-items:flex-start;
  padding:12px 14px; border-bottom:1px solid var(--wb-line); }
.wb-liver-cancer-workbench .wb-cand:last-child{ border-bottom:0; }
.wb-liver-cancer-workbench .wb-cand .cmain{ flex:1; min-width:0; font-size:12.5px; }
.wb-liver-cancer-workbench .wb-cand .cfield{ font-weight:600; color:var(--wb-ink); }
.wb-liver-cancer-workbench .wb-cand .cval{ font-variant-numeric:tabular-nums; color:var(--wb-ink); }
.wb-liver-cancer-workbench .wb-cand .csrc{ display:block; margin-top:5px; padding:3px 7px; font-size:10.5px;
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace; color:var(--wb-ink2);
  background:var(--wb-paper); border:1px solid var(--wb-line); border-radius:6px;
  white-space:pre-wrap; word-break:break-all; }
.wb-liver-cancer-workbench .wb-cand .cacts{ display:flex; gap:6px; flex:0 0 auto; }
.wb-liver-cancer-workbench .wb-btn{ font-size:11.5px; padding:5px 12px; min-height:32px; border-radius:8px;
  border:1px solid var(--wb-line); background:var(--wb-surface); color:var(--wb-ink2); }
.wb-liver-cancer-workbench .wb-btn:hover:not(:disabled){ border-color:#e6c9b8; color:var(--wb-clay-deep); }
.wb-liver-cancer-workbench .wb-btn.primary{ border-color:var(--wb-clay); color:var(--wb-clay-deep); font-weight:600; }
.wb-liver-cancer-workbench .wb-btn:disabled{ opacity:.45; cursor:not-allowed; }
.wb-liver-cancer-workbench .wb-cf{ display:block; font-size:10.5px; color:var(--wb-muted); margin-top:4px; }
@container (max-width: 720px){ .wb-liver-cancer-workbench .wb-cand{ flex-direction:column; }
  .wb-liver-cancer-workbench .wb-cand .cacts{ width:100%; } }
@container (max-width: 960px){ .wb-liver-cancer-workbench .wb-two{ grid-template-columns:1fr; } }
@container (max-width: 720px){ .wb-liver-cancer-workbench .wb-item{ flex-direction:column; gap:2px; }
  .wb-liver-cancer-workbench .wb-item .d{ flex:none; } }
@media (prefers-reduced-motion: reduce){
  .wb-liver-cancer-workbench .wb-card-inner{ transition:none; }
  .wb-liver-cancer-workbench .wb-flip{ transition:none; }
}
@media (prefers-color-scheme: dark){
  .wb-liver-cancer-workbench{ --wb-paper:#1e1a18; --wb-surface:#2a2522; --wb-ink:#f2eae5; --wb-ink2:#d6c9c1;
    --wb-muted:#a89a91; --wb-line:#463b35; --wb-clay:#e29a76; --wb-clay-deep:#f0b795; }
  .wb-liver-cancer-workbench .wb-face{ background:#2a2522; }
  .wb-liver-cancer-workbench .wb-face.back{ background:linear-gradient(165deg,#302722,#2a2522); }
  .wb-liver-cancer-workbench .wb-notice{ background:#332a25; border-color:#4b3c33; }
  .wb-liver-cancer-workbench .wb-qrow:hover{ background:#2f2824; }
  .wb-liver-cancer-workbench .wb-qrow[aria-current=true]{ background:#332a25; }
  .wb-liver-cancer-workbench .wb-st{ background:#2f2824; }
  .wb-liver-cancer-workbench .wb-st.ok{ color:#8fd3c5; border-color:#3d6a60; background:#26332f; }
  .wb-liver-cancer-workbench .wb-st.bad{ color:#efb195; border-color:#6d4633; background:#332a24; }
  .wb-liver-cancer-workbench .wb-st.wait{ color:#e3c184; border-color:#6a5730; background:#332d21; }
  .wb-liver-cancer-workbench .wb-brand-mark{ background:#3a2f29; }
  .wb-liver-cancer-workbench .wb-side-profile{ background:#332a25; border-color:#4b3c33; }
  .wb-liver-cancer-workbench .wb-nav button[aria-current=true]{ background:#332a25; border-color:#4b3c33; }
  .wb-liver-cancer-workbench .wb-splitter:hover{ background:#4b3c33; }
  .wb-liver-cancer-workbench .wb-btn-agent{ color:#241c17; }
}`

    // 样式表挂在 document.head，而不是渲染进组件树：customFrame 要求根节点首个子元素是
    // 语义 <header>，任何 <style>/包裹层挡在前面都会被宿主判成结构不合规。
    const STYLE_ID = 'ganbao-heppal-theme'
    function ensureStyle() {
      if (typeof document === 'undefined' || !document.head) return
      if (document.getElementById(STYLE_ID)) return
      const el = document.createElement('style')
      el.id = STYLE_ID
      el.textContent = theme
      document.head.appendChild(el)
    }

    const TRACK = { liver: 'A 轨 · 肝功能储备', tumor: 'B 轨 · 肿瘤负荷', safety: '安全线', nutrition: '营养与肌少症', other: '其他' }
    const CBC_IDS = ['wbc', 'anc', 'hgb']
    const GROUPS = [
      { track: 'liver', name: 'A 轨 · 肝功能储备' },
      { track: 'safety', name: '安全线 · 血常规', ids: CBC_IDS.concat('platelets') },
      { track: 'tumor', name: 'B 轨 · 肿瘤标志物与影像' },
      { track: 'nutrition', name: '营养与肌少症' }
    ]
    const NOTES = {
      albumin: '越高越好，但工作台不判定好坏；ALBI 由它和胆红素派生。',
      bilirubin: '×ULN 型：只在这张化验单带参考上限时给级。',
      inr: '凝血指标，Child-Pugh 的成分之一；不是出血风险评分。',
      alt: '肝硬化背景上同样的 ALT 意义不同，分级不等于肝损伤程度。',
      ast: '与 ALT 并列看，不做 AST/ALT 比值推断。',
      platelets: '在 HCC 里它同时是门脉高压的线索，两件事分开读。',
      wbc: 'CTCAE 血液学四项之一，绝对阈值可直接对照。',
      anc: '发热时这一项比白细胞总数更常被医生看。',
      hgb: 'CTCAE 的 G4 只有定义没有数值界限，本地只给到 3 级。',
      afp: '标志物不是不良事件，不做 CTCAE 分级；单次数值不说明趋势方向。',
      pivka2: '与 AFP 并列，不合成评分、不互相换算。',
      max_diameter: '影像测量受扫描层厚与判读影响，跨中心比较要谨慎。',
      weight: '单看体重会漏掉水肿与腹水，需与小腿围、握力并列。',
      calf: '肌少症的体表线索，缺测记空值，不补 0。',
      grip: '握力受测量手与姿势影响，前后比较要在同一条件下。'
    }
    const fmt = (m) => {
      if (m.kind === 'grade') return m.latestText || '还没有记录'
      if (m.latest == null) return '还没有记录'
      return Number(m.latest.v).toFixed(m.decimals)
    }
    const dayText = (d) => (d ? String(d).replace(/-/g, '.') : '日期待核')

    // 单调三次插值（Fritsch–Carlson）：经过原始点、不过冲；两点时退化成直线。
    function monotonePath(pts) {
      const n = pts.length
      if (n < 2) return ''
      if (n === 2) return `M${pts[0][0]},${pts[0][1]} L${pts[1][0]},${pts[1][1]}`
      const dx = [], dy = [], slope = []
      for (let i = 0; i < n - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0]; dy[i] = pts[i + 1][1] - pts[i][1]; slope[i] = dx[i] === 0 ? 0 : dy[i] / dx[i] }
      const m = [slope[0]]
      for (let i = 1; i < n - 1; i++) {
        if (slope[i - 1] * slope[i] <= 0) m[i] = 0
        else m[i] = (slope[i - 1] + slope[i]) / 2
      }
      m[n - 1] = slope[n - 2]
      let d = `M${pts[0][0]},${pts[0][1]}`
      for (let i = 0; i < n - 1; i++) {
        const x0 = pts[i][0], y0 = pts[i][1], x1 = pts[i + 1][0], y1 = pts[i + 1][1]
        const cx1 = x0 + dx[i] / 3, cy1 = y0 + (m[i] * dx[i]) / 3
        const cx2 = x1 - dx[i] / 3, cy2 = y1 - (m[i + 1] * dx[i]) / 3
        d += ` C${cx1},${cy1} ${cx2},${cy2} ${x1},${y1}`
      }
      return d
    }

    // 横轴按真实采样日期的比例，不按点序号等距；单点只画点；缺值不补 0。
    function Trend({ m }) {
      if (m.kind === 'grade') {
        return h('span', { className: 'wb-na' }, '分级是医生写下的类别，不做数值趋势。',
          m.history && m.history.length > 1
            ? h('span', { style: { display: 'block', marginTop: 6 } },
              m.history.slice(-6).map((p) => `${dayText(p.d).slice(5)} ${p.text}`).join(' · '))
            : null)
      }
      if (!m.points.length) {
        return h('span', { className: 'wb-na' }, '没有可回顾的记录。', h('br'), '导入化验单或手工补录后会出现在这里。')
      }
      if (m.points.length === 1) {
        return h('span', { className: 'wb-na' }, '只有 1 次记录，暂不连线。', h('br'), '再记录一次后显示趋势。')
      }
      const pts = m.points.slice(-8)
      const W = 380, H = 96, P = 10, iw = W - P * 2, ih = H - 26
      const ts = pts.map((p) => new Date(p.d).getTime())
      const vs = pts.map((p) => p.v)
      const t0 = Math.min(...ts), t1 = Math.max(...ts)
      const v0 = Math.min(...vs), v1 = Math.max(...vs)
      const spanT = t1 - t0 || 1
      const spanV = v1 - v0 || Math.abs(v1) || 1
      const padV = spanV * 0.12
      const x = (t) => P + (t1 === t0 ? iw / 2 : ((t - t0) / spanT) * iw)
      const y = (v) => P + ih - ((v - (v0 - padV)) / (spanV + padV * 2)) * ih
      const xy = pts.map((p) => [Number(x(new Date(p.d).getTime()).toFixed(1)), Number(y(p.v).toFixed(1))])
      const color = m.track === 'tumor' ? 'var(--wb-track-b)' : m.track === 'nutrition' ? 'var(--wb-clay)' : m.track === 'safety' ? 'var(--wb-track-c)' : 'var(--wb-track-a)'
      const last = pts[pts.length - 1]
      return h('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', height: H, role: 'img',
        'aria-label': `${m.label}，${pts.length} 个记录点，最近 ${fmt(m)} ${m.unit || ''}` },
        h('line', { x1: P, y1: P + ih, x2: P + iw, y2: P + ih, stroke: '#ece4df' }),
        h('path', { d: monotonePath(xy), fill: 'none', stroke: color, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }),
        xy.map((q, i) => h('circle', { key: i, cx: q[0], cy: q[1], r: 2.6, fill: '#fff', stroke: color, strokeWidth: 1.8 })),
        h('text', { x: P, y: H - 3, fontSize: 9, fill: '#a3968e' }, dayText(pts[0].d).slice(5)),
        h('text', { x: P + iw, y: H - 3, fontSize: 9, fill: '#a3968e', textAnchor: 'end' }, dayText(last.d).slice(5)),
        h('text', { x: xy[xy.length - 1][0], y: xy[xy.length - 1][1] - 7, fontSize: 10, fontWeight: 600,
          fill: color, textAnchor: 'end' }, Number(last.v).toFixed(m.decimals)))
    }

    function Card({ m, flipped, onFlip, groupName }) {
      const color = m.track === 'tumor' ? 'var(--wb-track-b)' : m.track === 'nutrition' ? 'var(--wb-clay)' : m.track === 'safety' ? 'var(--wb-track-c)' : 'var(--wb-track-a)'
      const deltaTxt = m.delta == null
        ? (m.kind === 'grade' ? '' : (m.points.length > 1 ? '暂无可比较的前次记录' : ''))
        : ['较前次 ', m.delta > 0 ? '↑ ' : m.delta < 0 ? '↓ ' : '→ ',
          h('em', { key: 'd' }, `${Math.abs(m.delta).toFixed(m.decimals)}${m.unit ? ' ' + m.unit : ''}`)]
      const front = h('span', { className: 'wb-face front', 'aria-hidden': flipped ? 'true' : 'false', inert: flipped ? '' : undefined },
        h('span', { className: 'wb-flip', 'aria-hidden': 'true' }, '↻'),
        h('span', { className: 'wb-cat' }, h('i', { style: { background: color } }), groupName || TRACK[m.track] || ''),
        h('span', { className: 'wb-name' }, m.label),
        h('span', { className: 'wb-val' }, fmt(m), m.unit && m.kind !== 'grade' ? h('small', null, m.unit) : null),
        h('span', { className: 'wb-delta' }, deltaTxt || '\u00a0'),
        NOTES[m.id] ? h('span', { className: 'wb-note' }, NOTES[m.id]) : null,
        h('span', { className: 'wb-meta' }, h('span', null, `${m.count} 次记录`), h('span', null, m.latest ? dayText(m.latest.d) : '日期待核')),
        h('span', { className: 'wb-src' }, '本机记录 · 点开看趋势'))
      const back = h('span', { className: 'wb-face back', 'aria-hidden': flipped ? 'false' : 'true', inert: flipped ? undefined : '' },
        h('span', { className: 'wb-cat' }, h('i', { style: { background: color } }), groupName || TRACK[m.track] || ''),
        h('span', { className: 'wb-name', style: { fontWeight: 600, color: 'var(--wb-ink)' } }, `${m.label} · 最近 ${m.count} 次`),
        h('span', { className: 'wb-spark' }, h(Trend, { m })),
        m.kind !== 'grade' && m.latest
          ? h('span', { className: 'wb-line' }, `最近一次 ${fmt(m)} ${m.unit || ''}（${dayText(m.latest.d)}）；只回顾已记录的值，不补空值、不外推。`)
          : null,
        h('span', { className: 'wb-foot' }, '仅回顾已记录的值 · 点击返回'))
      return h('button', {
        className: 'wb-card', type: 'button', 'aria-pressed': flipped ? 'true' : 'false',
        'aria-label': `${m.label}，${fmt(m)}${m.unit && m.kind !== 'grade' ? ' ' + m.unit : ''}。按回车翻转查看趋势`,
        onClick: () => onFlip(m.id),
      }, h('span', { className: 'wb-card-inner' }, front, back))
    }

    function Chip({ label, value }) { return h('span', { className: 'wb-chip' }, label, ' ', h('b', null, value)) }

    // —— 专项视图用的枚举字典：数据库存英文 код，界面一律说人话 ——
    const LBL = {
      modality: { resection: '手术切除', ablation: '消融', tace: 'TACE 介入', haic: 'HAIC', tare: 'TARE 放射栓塞', rt: '放疗', systemic: '系统治疗', transplant: '肝移植', supportive: '支持治疗', other: '其他' },
      intent: { curative: '根治意图', palliative: '姑息意图', conversion: '转化意图', adjuvant: '辅助', neoadjuvant: '新辅助', unknown: '意图未记录' },
      conclusion: { resectable: '可切除', borderline: '临界可切除', unresectable: '不可切除', unknown: '未记录' },
      rsContext: { initial: '初诊时', post_treatment: '治疗后', preop: '术前', other: '其他时点' },
      etiology: { hbv: 'HBV 相关', hcv: 'HCV 相关', alcohol: '酒精相关', nash: '代谢相关', other: '其他', none: '未记录' },
      hbsag: { positive: '阳性', negative: '阴性', not_tested: '未检测' },
      dna: { detected: '可检出', undetected: '未检出' },
      vacc: { yes: '已接种', no: '未接种', unknown: '不详' },
      appetite: { good: '好', fair: '一般', poor: '差' },
      seKind: { post_embolization: '栓塞后综合征', liver_toxicity: '肝毒性', variceal_bleed: '静脉曲张出血', other: '其他' },
      taskKind: { test: '检查', visit: '就诊', other: '其他' },
      imageModality: { ct: 'CT', mri: 'MRI', us: '超声', ceus: '超声造影', pet: 'PET-CT', other: '其他' },
      resultState: { reported: '已回报', pending: '待回报', draft: '草稿' },
    }
    const lbl = (group, v) => (v == null || v === '' ? '—' : LBL[group][v] || String(v))
    const dt = (v) => (v ? String(v).replace(/-/g, '.') : '—')
    const nn = (v, unit) => (v == null ? '—' : `${v}${unit ? ' ' + unit : ''}`)

    function Block({ title, hint, children }) {
      return h('div', { className: 'wb-panel' },
        h('div', { className: 'wb-panel-h' }, h('b', null, title), hint ? h('span', null, hint) : null),
        children)
    }
    function Rows({ cols, rows, empty }) {
      if (!rows.length) return h('div', { className: 'wb-empty' }, empty || '还没有记录。')
      return h('div', { className: 'wb-scroll' }, h('table', { className: 'wb-tbl' },
        h('thead', null, h('tr', null, cols.map((c, i) => h('th', { key: i }, c)))),
        h('tbody', null, rows.map((r, i) => h('tr', { key: i }, r.map((c, j) => h('td', { key: j, className: typeof c === 'number' ? 'n' : undefined }, c)))))))
    }
    function Timeline({ items, empty }) {
      if (!items.length) return h('div', { className: 'wb-empty' }, empty || '还没有记录。')
      return h('div', null, items.map((it, i) => h('div', { className: 'wb-item', key: i },
        h('div', { className: 'd' }, it.d),
        h('div', { className: 'c' }, it.title ? h('b', null, it.title) : null,
          (it.lines || []).map((ln, j) => h('span', { key: j }, ln))))))
    }

    const VIEWS = [
      ['dash', '看板'], ['metrics', '指标分析'], ['liver', '我的肝'], ['tumor', '我的瘤'],
      ['tx', '治疗与转化'], ['safety', '安全线'], ['nutrition', '营养与体重'],
      ['mind', '心理与家庭'], ['followup', '复诊与回顾'], ['import', '导入与候选'],
    ]

    // —— 我的肝：A 轨的原始记录。合成 / 排泄 / 凝血 / 门脉压力线索各看各的 ——
    function ViewLiver({ S }) {
      const L = S.liver
      const bg = L.background[0]
      return h('div', { className: 'wb-stack' },
        h('div', null,
          h('h1', null, '我的肝'),
          h('p', { className: 'wb-lead' }, '白蛋白看合成、胆红素看排泄、INR 看凝血，血小板在 HCC 里还兼着门脉压力的线索。',
            h('strong', null, '四项并列摆着，不折成一个分数。'))),
        h('div', { className: 'wb-two' },
          h(Block, { title: '肝的背景', hint: '病历原文，不改写' },
            bg ? h(Rows, {
              cols: ['项目', '记录'],
              rows: [
                ['病因', lbl('etiology', bg.etiology)],
                ['肝硬化', bg.cirrhosis === 'yes' ? '有' : bg.cirrhosis === 'no' ? '无' : '—'],
                ['HBsAg', lbl('hbsag', bg.hbsag)],
                ['HCV 抗体', bg.hcvAb == null ? '—' : bg.hcvAb],
                ['诊断时 Child-Pugh', bg.childPughAtDx || '—'],
                ['饮酒', bg.alcoholUnits == null ? '—' : String(bg.alcoholUnits)],
                ['糖尿病', bg.diabetes == null ? '—' : (bg.diabetes ? '有' : '无')],
                ['家族史', bg.familyHistory || '—'],
                ['备注', bg.note || '—'],
                ['记录日期', dt(bg.on)],
              ],
            }) : null),
          h(Block, { title: '本次与最近一次', hint: '同一张化验单上的值' },
            L.reserve.length ? h(Rows, {
              cols: ['项目', '最近一次', '日期'],
              rows: [
                ['白蛋白', nn(L.reserve[0].albumin, 'g/L'), dt(L.reserve[0].on)],
                ['总胆红素', nn(L.reserve[0].bilirubin, 'μmol/L'), dt(L.reserve[0].on)],
                ['INR', nn(L.reserve[0].inr), dt(L.reserve[0].on)],
                ['血小板', nn(L.reserve[0].platelets, '10⁹/L'), dt(L.reserve[0].on)],
                ['Child-Pugh', `${L.reserve[0].childPughClass || '—'}${L.reserve[0].childPughScore == null ? '' : '（' + L.reserve[0].childPughScore + ' 分）'}`, dt(L.reserve[0].on)],
                ['ALBI', L.reserve[0].albi ? `${L.reserve[0].albi.score}（${L.reserve[0].albi.grade} 级）` : '缺测，不出分', dt(L.reserve[0].on)],
              ],
            }) : h('div', { className: 'wb-empty' }, '还没有化验记录。')),
        ),
        h('div', { className: 'wb-notice' },
          'ALBI 用同一张单的白蛋白与胆红素派生，任一项缺测就返回空值——不拿上次数值顶。Child-Pugh 是医生写的分级，工作台不重算、不改写。'),
        h(Block, { title: '肝功能储备 · 全部记录', hint: `${L.reserve.length} 次，按日期倒序` },
          h(Rows, {
            cols: ['日期', '白蛋白', '胆红素', 'INR', '血小板', 'ALT', 'AST', 'Child-Pugh', 'ALBI'],
            rows: L.reserve.map((r) => [
              dt(r.on), nn(r.albumin), nn(r.bilirubin), nn(r.inr), nn(r.platelets), nn(r.alt), nn(r.ast),
              r.childPughClass || '—',
              r.albi ? `${r.albi.score} / ${r.albi.grade} 级` : '缺测',
            ]),
            empty: '还没有化验记录。导入化验单或手工补录后会出现在这里。',
          })))
    }

    // —— 我的瘤：B 轨 + 两条"别人写的结论"（分期、可切除性） ——
    function ViewTumor({ S }) {
      const T = S.tumor
      return h('div', { className: 'wb-stack' },
        h('div', null,
          h('h1', null, '我的瘤'),
          h('p', { className: 'wb-lead' }, '结节数、最大径、LI-RADS、癌栓、肝外扩散，以及 AFP / PIVKA-II 并列。',
            h('strong', null, '影像与标志物不互相换算。'))),
        h(Block, { title: '影像评估', hint: `${T.assessments.length} 次，按日期倒序` },
          h(Rows, {
            cols: ['日期', '方式', '结节数', '最大径', 'LI-RADS', '癌栓', '肝外扩散', 'AFP', 'PIVKA-II'],
            rows: T.assessments.map((a) => [
              dt(a.on), lbl('imageModality', a.modality), nn(a.lesionCount), nn(a.maxDiameter, 'mm'),
              a.liRads || '—', a.vp || '—', a.extrahepatic == null ? '—' : (a.extrahepatic ? '有' : '无'),
              nn(a.afp, 'ng/mL'), nn(a.pivka2, 'mAU/mL'),
            ]),
            empty: '还没有影像记录。',
          })),
        h('div', { className: 'wb-notice' },
          '最大径是测量值，受扫描层厚与判读影响；跨中心、跨设备比较要留一份原文。LI-RADS 与癌栓是分类，不做数值趋势。'),
        h('div', { className: 'wb-two' },
          h(Block, { title: '分期 · 医生写下的版本', hint: 'BCLC 与 CNLC 并列，不换算' },
            h(Rows, {
              cols: ['体系', '分期', '依据', '记录日期'],
              rows: T.stages.map((s) => [
                h('span', null, s.system, s.isCurrent ? h('span', { className: 'wb-tag now' }, '当前') : h('span', { className: 'wb-tag' }, '历史')),
                h('b', null, s.stage), s.basis || '—', dt(s.statedOn),
              ]),
              empty: '还没有分期记录。',
            })),
          h(Block, { title: '可切除性 · 逐次结论', hint: '转化治疗看的就是这一列' },
            h(Rows, {
              cols: ['日期', '结论', '时点', '残肝', '依据'],
              rows: T.resectability.map((r) => [
                dt(r.statedOn),
                h('span', null, h('b', null, lbl('conclusion', r.conclusion)), r.isCurrent ? h('span', { className: 'wb-tag now' }, '当前') : null),
                h('span', { style: { whiteSpace: 'nowrap' } }, lbl('rsContext', r.context)), r.futureRemnant || '—', r.basis || '—',
              ]),
              empty: '还没有可切除性记录。',
            }))))
    }

    // —— 治疗与转化：事件按时间排，转化路径靠"可切除性"这一列自己显形 ——
    function ViewTx({ S }) {
      const T = { ...S.treatment, resectability: S.tumor.resectability }
      return h('div', { className: 'wb-stack' },
        h('div', null,
          h('h1', null, '治疗与转化'),
          h('p', { className: 'wb-lead' }, '局部、系统、手术各记各的，意图（根治 / 姑息 / 转化）按医生原话记。',
            h('strong', null, '工作台不评价方案，也不把"转化"当结果。'))),
        h(Block, { title: '治疗事件', hint: `${T.events.length} 条，按开始日期倒序` },
          h(Timeline, {
            items: T.events.map((e) => ({
              d: dt(e.startedOn),
              title: `${lbl('modality', e.modality)} · ${lbl('intent', e.intent)}${e.lineNo ? ' · 第 ' + e.lineNo + ' 线' : ''}`,
              lines: [
                e.regimen || '方案未记录',
                e.endedOn ? `起 ${dt(e.startedOn)} — 止 ${dt(e.endedOn)}` : `起 ${dt(e.startedOn)}（未记录结束）`,
                e.cyclesPlanned != null || e.cyclesDone != null ? `周期：计划 ${nn(e.cyclesPlanned)} / 已完成 ${nn(e.cyclesDone)}` : null,
                e.response ? h('span', null, h('b', { style: { display: 'inline', fontSize: 12.5 } }, '疗效原文：'), e.response) : null,
                e.stopReason ? `停止原因：${e.stopReason}` : null,
                e.institution ? `机构：${e.institution}` : null,
              ].filter(Boolean),
            })),
            empty: '还没有治疗记录。',
          })),
        h('div', { className: 'wb-notice' },
          '疗效一栏是病历原文（如"部分缓解（mRECIST）"），不是工作台算出来的。转化是否成功，看的是可切除性那几行结论有没有变。'),
        h(Block, { title: '可切除性结论的变化', hint: '按时间从早到晚，最后一行是当前' },
          h(Timeline, {
            items: T.resectability.slice().reverse().map((r) => ({
              d: dt(r.statedOn),
              title: `${lbl('conclusion', r.conclusion)} · ${lbl('rsContext', r.context)}${r.isCurrent ? ' · 当前结论' : ''}`,
              lines: [r.basis || '依据未记录', r.futureRemnant ? `残肝：${r.futureRemnant}` : '残肝体积未记录', r.statedBy ? `记录者：${r.statedBy}` : null].filter(Boolean),
            })),
            empty: '还没有可切除性记录。',
          })),
        h(Block, { title: '临床试验登记', hint: '登记状态 ≠ 可入组' },
          h(Rows, {
            cols: ['来源', '编号', '标题', '期别', '状态', '地点'],
            rows: T.trials.map((t) => [t.source, t.trialId || t.sourceId, t.title, t.phase || '—', t.statusText || '未核实', t.siteText || '—']),
            empty: '还没有登记试验。',
          })))
    }

    // —— 安全线：不良事件 + 症状 + 血常规 + HBV 再激活预防 ——
    function ViewSafety({ S, metrics, flipped, onFlip }) {
      const P = S.safety
      const cbc = ['wbc', 'anc', 'hgb'].map((id) => metrics.find((m) => m.id === id)).filter(Boolean)
      return h('div', { className: 'wb-stack' },
        h('div', null,
          h('h1', null, '安全线'),
          h('p', { className: 'wb-lead' }, '治疗期最容易被漏记的不是疗效，是"那几天不舒服"。分级照医生写的抄，自评程度不冒充分级。')),
        h('div', { className: 'wb-grid' }, cbc.map((m) => h(Card, { key: m.id, m, groupName: '安全线 · 血常规', flipped: flipped.includes(m.id), onFlip: onFlip }))),
        h(Block, { title: '不良事件', hint: `${P.events.length} 条` },
          h(Rows, {
            cols: ['开始', '事件', '分级（原文）', '处理记录', '缓解'],
            rows: P.events.map((e) => [dt(e.onsetOn), h('b', null, lbl('seKind', e.kind)), e.grade || '未分级', e.actionRecorded || '—', e.resolvedOn ? dt(e.resolvedOn) : '未记录缓解']),
            empty: '还没有不良事件记录。',
          })),
        h('div', { className: 'wb-two' },
          h(Block, { title: '症状自评', hint: '自评程度 0–10，不是 CTCAE 分级' },
            h(Rows, {
              cols: ['日期', '症状', '自评', '备注'],
              rows: P.symptoms.map((s) => [dt(s.on), s.symptom, s.severity == null ? '—' : String(s.severity), s.note || '—']),
              empty: '还没有症状记录。',
            })),
          h(Block, { title: 'HBV 与再激活预防', hint: '抗病毒与筛查日期照原文' },
            h(Rows, {
              cols: ['日期', 'HBsAg', 'HBV DNA', '抗病毒', '预防用药', '下次筛查'],
              rows: P.hbv.map((r) => [dt(r.on), lbl('hbsag', r.hbsag), `${lbl('dna', r.dnaState)}${r.dna == null ? '' : '（' + r.dna + '）'}`, r.antiviral || '—', r.prophylaxis === 'yes' ? '有记录' : (r.prophylaxis || '—'), dt(r.screeningBefore)]),
              empty: '还没有 HBV 记录。',
            }))))
    }

    // —— 营养与体重：体重 + 小腿围 + 握力三件并列，缺一项不合计 ——
    function ViewNutrition({ S, metrics, flipped, onFlip }) {
      const N = S.nutrition
      const cards = ['weight', 'calf', 'grip'].map((id) => metrics.find((m) => m.id === id)).filter(Boolean)
      const latest = N.records[0]
      return h('div', { className: 'wb-stack' },
        h('div', null,
          h('h1', null, '营养与体重'),
          h('p', { className: 'wb-lead' }, '体重单看会漏掉水肿与腹水，所以小腿围与握力并排放。',
            h('strong', null, '三项不合成"营养评分"。'))),
        h('div', { className: 'wb-grid' }, cards.map((m) => h(Card, { key: m.id, m, groupName: '营养与肌少症', flipped: flipped.includes(m.id), onFlip: onFlip }))),
        latest ? h('div', { className: 'wb-chips' },
          h(Chip, { label: 'BMI', value: latest.bmi == null ? '缺身高，不计算' : String(latest.bmi) }),
          h(Chip, { label: '食欲', value: lbl('appetite', latest.appetite) }),
          h(Chip, { label: '限盐', value: latest.salt || '未记录' }),
          h(Chip, { label: '限水', value: latest.fluid || '未记录' })) : null,
        h('div', { className: 'wb-notice' },
          'BMI 由同一行的体重与身高算出；缺身高就不给值，不拿上一次身高顶。限盐限水是医生交代的原文，工作台不替你加减。'),
        h(Block, { title: '营养记录', hint: `${N.records.length} 次，按日期倒序` },
          h(Rows, {
            cols: ['日期', '体重', 'BMI', '小腿围', '握力', '食欲', '备注'],
            rows: N.records.map((r) => [dt(r.on), nn(r.weight, 'kg'), nn(r.bmi), nn(r.calf, 'cm'), nn(r.grip, 'kg'), lbl('appetite', r.appetite), r.note || '—']),
            empty: '还没有营养记录。',
          })))
    }

    // —— 心理与家庭：私密内容默认不返回，要看必须自己点开 ——
    function ViewMind({ S, vp, vpPrivate, onTogglePrivate }) {
      const M = S.mind
      const untested = M.family.filter((f) => f.hbsag === 'not_tested' || f.vaccinated !== 'yes')
      return h('div', { className: 'wb-stack' },
        h('div', null,
          h('h1', null, '心理与家庭'),
          h('p', { className: 'wb-lead' }, '你说过的话记在这里，标为"看法"。',
            h('strong', null, '看法不是结论，也不进摘要和导出。'))),
        h('div', { className: 'wb-private' },
          h('span', null, vpPrivate ? '正在显示私密记录（只在这台机器上、只在你点了这个开关之后）。' : '私密记录默认不显示，也不会出现在导出与 Agent 摘要里。'),
          h('button', {
            type: 'button', className: 'wb-chip', style: { marginInlineStart: 8 }, 'aria-pressed': vpPrivate,
            onClick: onTogglePrivate,
          }, vpPrivate ? '隐藏私密记录' : '显示私密记录')),
        h(Block, { title: '我记下的看法', hint: `${vp.length} 条${vpPrivate ? '（含私密）' : '（仅共享）'}` },
          h(Timeline, {
            items: vp.map((v) => ({
              d: dt(v.on),
              title: v.topic,
              lines: [v.body, h('span', { style: { fontSize: 11, color: 'var(--wb-muted)' } },
                `${v.source === 'self' ? '我自己写的' : v.source || '来源未记录'} · ${v.visibility === 'private' ? '私密' : '可共享'}`)],
            })),
            empty: '还没有记录。想说的话写在这里，不会被当成结论。',
          })),
        h('div', { className: 'wb-two' },
          h(Block, { title: '想问医生的问题', hint: `${M.questions.length} 条` },
            h(Timeline, {
              items: M.questions.map((q) => ({
                d: dt(q.createdOn), title: q.body,
                lines: [q.answered ? `医生答复：${q.answered}` : '还没有记录答复'],
              })),
              empty: '还没有记下问题。',
            })),
          h(Block, { title: '家属筛查清单', hint: '这是你自己列的，不是医嘱' },
            h(Rows, {
              cols: ['关系', 'HBsAg', '疫苗', '检查日期'],
              rows: M.family.map((f) => [f.relation, lbl('hbsag', f.hbsag), lbl('vacc', f.vaccinated), dt(f.checkedOn)]),
              empty: '还没有家属记录。',
            }))),
        untested.length
          ? h('div', { className: 'wb-notice' }, `清单里有 ${untested.length} 位家属的筛查或接种还没闭环。要不要提醒、怎么提醒，由你和医生决定；工作台只把没闭环的那几行摆出来。`)
          : null)
    }

    // —— 复诊与回顾：医生说的话 + 待办 ——
    function ViewFollowup({ S }) {
      const F = S.followup
      const open = F.tasks.filter((t) => !t.doneOn)
      const done = F.tasks.filter((t) => t.doneOn)
      return h('div', { className: 'wb-stack' },
        h('div', null,
          h('h1', null, '复诊与回顾'),
          h('p', { className: 'wb-lead' }, '每次 MDT 的结论、下次复诊时间、还没做完的事，一条条摆着。')),
        h(Block, { title: '就诊记录', hint: `${F.visits.length} 次` },
          h(Timeline, {
            items: F.visits.map((v) => ({
              d: dt(v.on), title: `${v.department || '科室未记录'} · ${v.purpose || ''}`,
              lines: [v.summary || '结论未记录', v.nextOn ? `下次：${dt(v.nextOn)}` : '下次时间未记录'],
            })),
            empty: '还没有就诊记录。',
          })),
        h('div', { className: 'wb-two' },
          h(Block, { title: '还没做完', hint: `${open.length} 项` },
            h(Rows, { cols: ['事项', '类型', '截止'], rows: open.map((t) => [t.title, lbl('taskKind', t.kind), dt(t.dueOn)]), empty: '没有待办。' })),
          h(Block, { title: '已做完', hint: `${done.length} 项` },
            h(Rows, { cols: ['事项', '完成日期'], rows: done.map((t) => [t.title, dt(t.doneOn)]), empty: '还没有已完成的事项。' }))),
        h('div', { className: 'wb-notice' },
          '结论摘要是病历原文的搬运，工作台不改写、不替你判断下一步。复诊时间以医院通知为准。'))
    }

    // —— 导入与候选：文件先判该不该读，抽出来的每一条都要人点头才进趋势 ——
    const DOC_STATUS = {
      pending_review: { text: '待确认', cls: 'wait' },
      pending_parse: { text: '线索不足', cls: '' },
      parsed: { text: '已处理完', cls: 'ok' },
      parse_failed: { text: '未接收', cls: 'bad' },
    }
    const CAND_STATUS = { pending: '待确认', accepted: '已确认', rejected: '已退回' }
    const FIELD_NAME = {
      albumin: '白蛋白', bilirubin: '总胆红素', inr: 'INR', platelets: '血小板', alt: 'ALT', ast: 'AST',
      afp: 'AFP', pivka2: 'PIVKA-II', max_diameter: '最大径', weight: '体重', calf: '小腿围', grip: '握力',
      wbc: '白细胞', anc: '中性粒细胞绝对值', hgb: '血红蛋白', site: '病变部位', specimen_type: '样本类型',
      pathology_diagnosis: '病理诊断', ihc_panel: '免疫组化', report_date: '报告日期', collection_date: '取材日期',
    }

    function ViewImport({ docs, cands, activeId, busy, err, onOpen, onAccept, onReject }) {
      const active = docs.find((x) => x.id === activeId)
      return h('div', { className: 'wb-stack' },
        h('div', null,
          h('h1', null, '导入与候选'),
          h('p', { className: 'wb-lead' }, '一份材料先进队列，判完是不是肝的报告，再从里面抽候选。',
            h('strong', null, '机器抽出来的都只是候选，点了确认才进趋势。'))),
        h('div', { className: 'wb-notice' },
          '顺序是固定的：嗅探 → 取行 → 判病种 → 抽候选 → 落库。判病种必须在抽候选之前——料不对，读得再准也没用。'),
        err ? h('p', { role: 'status', className: 'wb-empty' }, err) : null,
        h('div', { className: 'wb-two' },
          h(Block, { title: '导入队列', hint: `${docs.length} 份` },
            docs.length
              ? h('div', null, docs.map((doc) => {
                const st = DOC_STATUS[doc.status] || { text: doc.status, cls: '' }
                return h('button', {
                  key: doc.id, type: 'button', className: 'wb-qrow', 'aria-current': doc.id === activeId,
                  onClick: () => onOpen(doc.id),
                },
                  h('span', { className: 'qmain' },
                    h('b', null, doc.title),
                    h('span', null, `${dt(doc.docDate)} · ${doc.candidates.total} 条候选${doc.candidates.pending ? ` · ${doc.candidates.pending} 条待确认` : ''}`),
                    doc.parseNote ? h('span', { className: 'csrc' }, doc.parseNote) : null),
                  h('span', { className: `wb-st ${st.cls}` }, st.text))
              }))
              : h('div', { className: 'wb-empty' }, '队列是空的。用导入命令放进一份材料后，这里会出现它。')),
          h(Block, {
            title: active ? `候选 · ${active.title}` : '候选',
            hint: active ? `${cands.length} 条 · 确认才写入` : '先选左边文件',
          },
            active
              ? (cands.length
                ? h('div', null, cands.map((c) => h('div', { className: 'wb-cand', key: c.id },
                  h('div', { className: 'cmain' },
                    h('span', { className: 'cfield' }, FIELD_NAME[c.field] || c.field), ' ',
                    h('span', { className: 'cval' }, c.valueNum == null
                      ? (c.valueText || '—')
                      : `${c.valueNum}${c.unit ? ' ' + c.unit : ''}`),
                    h('span', { className: 'wb-tag' }, CAND_STATUS[c.status] || c.status),
                    c.importable ? null : h('span', { className: 'wb-tag' }, '文本字段 · 不进趋势'),
                    c.sourceLine ? h('span', { className: 'csrc' }, c.sourceLine) : null,
                    c.confidence != null
                      ? h('span', { className: 'wb-cf' }, `抽取值置信 ${(c.confidence * 100).toFixed(0)}%——只说明匹配的把握，不说明数值对不对`)
                      : null),
                  h('div', { className: 'cacts' },
                    h('button', {
                      type: 'button', className: 'wb-btn primary',
                      disabled: c.status !== 'pending' || !c.importable || busy === c.id,
                      onClick: () => onAccept(c.id),
                    }, busy === c.id ? '写入中…' : '确认'),
                    h('button', {
                      type: 'button', className: 'wb-btn',
                      disabled: c.status !== 'pending' || busy === c.id,
                      onClick: () => onReject(c.id),
                    }, '退回')))))
                : h('div', { className: 'wb-empty' },
                  '这份文件没有候选。域外材料、扫描件、线索不足都会落到这里，理由记在左边那行灰字里。'))
              : h('div', { className: 'wb-empty' }, '从左边队列里挑一份文件。'))),
        h('div', { className: 'wb-notice' },
          '确认写入用的是报告日期，不是上传日期。没有日期的报告会被要求先补日期——否则趋势图上会多出一个假时点。'),
        h('div', { className: 'wb-notice' },
          '「未接收」不等于文件坏了：别的癌种的材料也会落到这个状态，理由写在 [gate] 开头那行里，看得出来是哪一步拦下的。'))
    }

    function Panel({ conversation }) {
      const [state, setState] = React.useState({ loading: true, error: '', profiles: [], pid: '', dash: null, metrics: [], sections: null, vp: [], vpPrivate: false, view: 'dash', flipped: [], large: false, version: '', docs: [], activeDoc: 0, cands: [], busy: 0, importErr: '' })
      // 会话面板：宽度与开合同一个键，重开工作台还能回到上次的样子
      const [agentWidth, setAgentWidth] = React.useState(() => loadPane().width)
      const [paneOpen, setPaneOpen] = React.useState(() => loadPane().open)
      const [connecting, setConnecting] = React.useState(false)
      const [narrow, setNarrow] = React.useState(false)
      const [dragging, setDragging] = React.useState(false)
      const [agentNote, setAgentNote] = React.useState('')
      const shellRef = React.useRef(null)
      const dragHostRef = React.useRef(null)
      const convHostRef = React.useRef(null)
      const patch = (next) => setState((prev) => ({ ...prev, ...next }))

      React.useEffect(() => { ensureStyle() }, [])

      const load = async (pid, signal) => {
        const [d, m, sc] = await Promise.all([
          fetch(`${API}/dashboard?profile=${encodeURIComponent(pid)}`, { credentials: 'same-origin', signal }).then((r) => r.json()),
          fetch(`${API}/metrics?profile=${encodeURIComponent(pid)}`, { credentials: 'same-origin', signal }).then((r) => r.json()),
          fetch(`${API}/sections?profile=${encodeURIComponent(pid)}`, { credentials: 'same-origin', signal }).then((r) => r.json()),
        ])
        patch({ dash: d.dashboard || null, metrics: m.metrics || [], sections: sc.sections || null,
          loading: false, error: d.error || m.error || sc.error || '', flipped: [] })
      }

      // 私密看法要单独取：默认只拿 shared，点了开关才带 private=1
      const loadVp = async (pid, includePrivate) => {
        try {
          const r = await fetch(`${API}/viewpoints?profile=${encodeURIComponent(pid)}${includePrivate ? '&private=1' : ''}`, { credentials: 'same-origin' }).then((x) => x.json())
          patch({ vp: r.viewpoints || [], vpPrivate: includePrivate })
        } catch (error) {
          patch({ vp: [], vpPrivate: includePrivate })
        }
      }

      React.useEffect(() => {
        const controller = new AbortController()
        ;(async () => {
          try {
            const health = await fetch(`${API}/health`, { credentials: 'same-origin', signal: controller.signal }).then((r) => r.json())
            const { profiles } = await fetch(`${API}/profiles`, { credentials: 'same-origin', signal: controller.signal }).then((r) => r.json())
            if (controller.signal.aborted) return
            const pid = profiles[0] ? profiles[0].id : ''
            patch({ profiles, pid, version: health.version || '', loading: !!pid })
            if (pid) await load(pid, controller.signal)
          } catch (error) {
            if (!controller.signal.aborted) patch({ loading: false, error: `本机服务连接失败：${error.message}` })
          }
        })()
        return () => controller.abort()
      }, [])

      React.useEffect(() => {
        if (state.view === 'mind' && state.pid && !state.vp.length) loadVp(state.pid, false)
      }, [state.view, state.pid])

      // —— 导入视图：队列 → 候选 → 确认/退回。写操作后要同时刷新队列与指标视图 ——
      const loadDocs = async (pid) => {
        try {
          const r = await fetch(`${API}/documents?profile=${encodeURIComponent(pid)}`, { credentials: 'same-origin' }).then((x) => x.json())
          if (r.error) throw new Error(r.error)
          patch({ docs: r.documents || [], importErr: '' })
        } catch (error) {
          patch({ docs: [], importErr: `读取导入队列失败：${error.message}` })
        }
      }
      const openDoc = async (id) => {
        try {
          const r = await fetch(`${API}/candidates?doc=${encodeURIComponent(id)}`, { credentials: 'same-origin' }).then((x) => x.json())
          if (r.error) throw new Error(r.error)
          patch({ activeDoc: id, cands: r.candidates || [], importErr: '' })
        } catch (error) {
          patch({ activeDoc: id, cands: [], importErr: `读取候选失败：${error.message}` })
        }
      }
      const settleCand = async (id, verb) => {
        const label = verb === 'accept' ? '确认' : '退回'
        patch({ busy: id, importErr: '' })
        try {
          const res = await fetch(`${API}/candidates/${verb}`, {
            method: 'POST', credentials: 'same-origin',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ id }),
          })
          const json = await res.json().catch(() => ({}))
          if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
          patch({ busy: 0 })
          await Promise.all([openDoc(state.activeDoc), loadDocs(state.pid)])
          // 确认会写 metric_reading：指标视图必须重新取，否则趋势上还是旧值
          if (verb === 'accept') await load(state.pid)
        } catch (error) {
          patch({ busy: 0, importErr: `${label}失败：${error.message}` })
        }
      }

      React.useEffect(() => {
        if (state.view === 'import' && state.pid) loadDocs(state.pid)
      }, [state.view, state.pid])

      const onFlip = (id) => setState((prev) => ({
        ...prev,
        flipped: prev.flipped.includes(id) ? prev.flipped.filter((x) => x !== id) : [...prev.flipped, id],
      }))

      /* ---------------- AI 会话：调起 / 收起 / 拖宽 ---------------- */

      const [sessionId, setSessionId] = React.useState(() => ownedSession())
      const hasConversation = Boolean(sessionId)
      const canOpenSession = typeof bridge?.desktopWorkbenches?.ensureSession === 'function'

      // 宿主传进来的 conversation 是 DOM 节点（display 由宿主自己控），不能作为 React 子节点渲染，
      // 只能 appendChild 到容器里。挂上去之后不再动它——重挂会丢输入框与草稿。
      React.useEffect(() => {
        const host = convHostRef.current
        if (!host) return
        if (!conversation || conversation.nodeType !== 1) return
        if (conversation.parentNode !== host) host.appendChild(conversation)
      }, [conversation, hasConversation])

      React.useEffect(() => {
        // 一轮里做两件事：消化未送达的开场白（composer 就绪后自动填入）、同步会话归属。
        // 归属必须问 ownsSession：customFrame 下 conversation prop 恒非空，不能当判据。
        const tick = () => {
          if (flushDraft()) setAgentNote('草稿已填入会话，按回车发送')
          setSessionId(ownedSession())
        }
        tick()
        const timer = setInterval(tick, 600)
        const unsubscribe = bridge?.desktopWorkbenches?.subscribe?.(() => setSessionId(ownedSession()))
        return () => { clearInterval(timer); unsubscribe?.() }
      }, [])

      // 窄屏判定用容器宽度而不是窗口宽度：宿主主区宽度不等于窗口宽度
      React.useEffect(() => {
        const host = shellRef.current
        if (!host || typeof ResizeObserver !== 'function') return undefined
        const observer = new ResizeObserver((entries) => {
          const w = entries[0]?.contentRect?.width ?? 0
          setNarrow(w > 0 && w < NARROW_BELOW)
        })
        observer.observe(host)
        return () => observer.disconnect()
      }, [])

      const applyWidth = React.useCallback((next, open) => {
        const snapped = round4(snapWidth(next))
        setAgentWidth(snapped)
        savePane(snapped, open === undefined ? paneOpen : open)
      }, [paneOpen])

      const stopDrag = React.useCallback(() => { dragHostRef.current = null; setDragging(false) }, [])
      React.useEffect(() => {
        if (!dragging) return undefined
        const onMove = (event) => {
          const host = dragHostRef.current
          if (!host) return
          const rect = host.getBoundingClientRect()
          if (!rect.width) return
          applyWidth((rect.right - event.clientX) / rect.width) // 会话在右：越靠左越宽
        }
        document.addEventListener('pointermove', onMove)
        document.addEventListener('pointerup', stopDrag)
        document.addEventListener('pointercancel', stopDrag)
        return () => {
          document.removeEventListener('pointermove', onMove)
          document.removeEventListener('pointerup', stopDrag)
          document.removeEventListener('pointercancel', stopDrag)
        }
      }, [dragging, applyWidth, stopDrag])

      const onSplitterKeyDown = (event) => {
        const delta = { ArrowLeft: AGENT_STEP, ArrowRight: -AGENT_STEP }[event.key]
        if (delta !== undefined) { event.preventDefault(); applyWidth(agentWidth + delta); return }
        if (event.key === 'Home') { event.preventDefault(); applyWidth(AGENT_MAX); return }
        if (event.key === 'End') { event.preventDefault(); applyWidth(AGENT_MIN) }
      }

      async function openAgent(prompt = null) {
        setAgentNote('')
        if (!canOpenSession) {
          setAgentNote('当前 Desktop 版本不支持从面板调起会话；请从左侧会话列表新建会话')
          return
        }
        setConnecting(true)
        try {
          let dir = null
          try {
            const res = await fetch(`${API}/health`)
            dir = (await res.json())?.dir || null
          } catch { /* 拿不到目录也照样调起 */ }
          const id = await bridge.desktopWorkbenches.ensureSession({ folder: dir })
          setSessionId(id)
          rememberDraft({ sessionId: id, prompt: prompt || onboardingPrompt(dir) })
          flushDraft()
          setPaneOpen(true)
          savePane(agentWidth, true)
          setAgentNote('会话已就绪：草稿已填入右侧输入框，按回车发送')
        } catch (error) {
          setAgentNote(`没能调起会话：${error?.message ?? error}`)
        } finally {
          setConnecting(false)
        }
      }

      // 收起只是隐藏，不结束、不删除会话：再点「打开 AI 对话」回到同一个会话。
      function onAgentClick() {
        if (!hasConversation) { void openAgent(); return }
        const next = !paneOpen
        setPaneOpen(next)
        savePane(agentWidth, next)
        setAgentNote('')
      }

      const agentLabel = !canOpenSession ? 'AI 对话暂不可用'
        : connecting ? '正在连接…'
          : !hasConversation ? 'AI 对话'
            : paneOpen ? '收起 AI 对话' : '打开 AI 对话'
      const paneVisible = paneOpen && (hasConversation || connecting)
      const percent = Math.round(agentWidth * 100)

      /* ---------------- 业务骨架：侧栏 + 主区（参考小粉宝的位置） ---------------- */

      const navBlock = h('div', { className: 'wb-nav', role: 'tablist', 'aria-label': '工作台分区' },
        VIEWS.map(([id, name]) => h('button', {
          key: id, type: 'button', role: 'tab', 'aria-current': state.view === id,
          onClick: () => patch({ view: id, flipped: [] }),
        }, h('span', { className: 'dot', 'aria-hidden': 'true' }), name)))

      const currentName = (VIEWS.find(([id]) => id === state.view) || ['', '看板'])[1]

      const shell = (children) => h('div', {
        className: 'wb-liver-cancer-workbench', 'data-font': state.large ? 'large' : 'standard',
        style: { flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 },
      },
        // 首个子元素必须是语义 <header>：macOS 窗口按钮占了左上角，用 clearance 变量避让
        h('header', { className: 'wb-frame-head' },
          h('span', { className: 'wb-frame-brand' }, '🫀 小甘宝 HepPal'),
          h('span', { className: 'wb-frame-ver' }, state.version ? `v${state.version}` : ''),
          h('span', { className: 'wb-frame-hint' },
            hasConversation
              ? '右侧是 DSH 原生会话：拖中间分隔条可调宽度（25%–45%），收起不会结束会话。'
              : '还没有会话。点右侧「AI 对话」调起原生会话；开场白只填进草稿，不自动发送。'),
          h('div', { className: 'wb-frame-actions' },
            h('button', {
              type: 'button', className: 'wb-btn-agent', onClick: onAgentClick,
              disabled: connecting || !canOpenSession, 'aria-label': `AI 对话：${agentLabel}`,
            }, agentLabel),
            hasConversation && paneOpen && h('button', {
              type: 'button', className: 'wb-btn-ghost', onClick: () => { setPaneOpen(false); savePane(agentWidth, false) },
              'aria-label': '收起 AI 对话面板',
            }, '×'),
            agentNote && h('span', { className: 'wb-agent-note' }, agentNote))),
        h('div', { ref: shellRef, className: 'wb-frame-body' },
          h('div', { className: 'wb-business' },
            h('aside', { className: 'wb-side', 'aria-label': '小甘宝业务导航' },
              h('div', { className: 'wb-brand' },
                h('div', { className: 'wb-brand-mark', 'aria-hidden': 'true' }, '肝'),
                h('div', null,
                  h('b', null, '小甘宝'),
                  h('span', null, 'HepPal · 肝与瘤，两条线'))),
              state.dash && h('div', { className: 'wb-side-profile' },
                h('div', { className: 'av', 'aria-hidden': 'true' }, (state.dash.profile.initial || '我')),
                h('div', { style: { minWidth: 0 } },
                  h('b', null, state.dash.profile.name),
                  h('span', null, [
                    state.dash.profile.age ? `${state.dash.profile.age} 岁` : '',
                    state.dash.profile.tag || '',
                  ].filter(Boolean).join(' · ') || '本机档案'))),
              navBlock,
              h('div', { className: 'wb-side-bottom' },
                h('b', null, '小 X 宝家族'),
                h('p', null, '肝够不够，瘤到哪步，', h('br'), '两条线都要看清。'))),
            h('main', { className: 'wb-main' },
              h('div', { className: 'wb-topbar' },
                h('span', { className: 'wb-crumb' }, '小甘宝工作台 / ', h('b', null, currentName)),
                h('div', { className: 'wb-top-actions' },
                  h('button', {
                    type: 'button', className: 'wb-chip', onClick: () => patch({ large: !state.large }),
                    'aria-pressed': state.large,
                  }, state.large ? '标准字' : '大字 Aa'))),
              h('div', { className: 'wb-body' }, children))),
          // 分隔条放在会话区左侧（业务区与会话区之间）：放到后面会跑到整帧最右缘，拖起来方向是反的。
          narrow && paneVisible && h('div', {
            className: 'wb-scrim', 'aria-hidden': 'true',
            onClick: () => { setPaneOpen(false); savePane(agentWidth, false) },
          }),
          !narrow && paneVisible && h('div', {
            role: 'separator', 'aria-orientation': 'vertical', 'aria-label': '调整 AI 对话面板宽度',
            'aria-valuemin': Math.round(AGENT_MIN * 100), 'aria-valuemax': Math.round(AGENT_MAX * 100),
            'aria-valuenow': percent, tabIndex: 0, className: 'wb-splitter',
            onPointerDown: (event) => { event.preventDefault(); dragHostRef.current = shellRef.current; setDragging(true) },
            onKeyDown: onSplitterKeyDown,
          }),
          // 原生会话始终挂载：卸载会丢输入框与草稿状态（宿主明确要求不重挂输入树）
          h('aside', {
            className: 'wb-agent' + (narrow ? ' wb-agent-drawer' : ''),
            style: {
              width: narrow ? `min(92%, ${DRAWER_MAX}px)` : `${percent}%`,
              display: paneVisible ? 'flex' : 'none',
            },
            'aria-label': 'AI 对话',
            'aria-hidden': paneVisible ? undefined : 'true',
          }, hasConversation
            ? h('div', { ref: convHostRef, className: 'wb-agent-host' })
            : h('div', { className: 'wb-agent-empty' },
              h('b', null, 'AI 对话还没开始'),
              h('span', null, '点顶栏「AI 对话」调起 DSH 原生会话后，它会固定在右侧这一栏。'),
              h('span', null, '没有会话也不影响记录：左侧的资料整理、指标与趋势照常可用。'))),
))

      if (state.error) {
        return shell(h(React.Fragment, null,
          h('p', { role: 'status' }, state.error),
          h('p', { style: { color: 'var(--wb-muted)' } }, '演示库路径：demo/demo-data.sqlite。正式使用需在设置里选择资料目录。')))
      }
      const d = state.dash
      if (!d) return shell(h('p', { role: 'status' }, state.loading ? '正在读取本机资料…' : '还没有档案。'))

      const liver = d.tracks.liver, tumor = d.tracks.tumor, portal = d.tracks.portal
      const trackStrip = h('section', { className: 'wb-tracks', 'aria-label': '三条线并列，不相加' },
        h('div', { className: 'wb-track' }, h('i', { style: { background: 'var(--wb-track-a)' } }),
          h('div', null, h('b', null, 'A 轨 · 肝功能储备'),
            h('span', null, liver ? `白蛋白 ${liver.albumin ?? '—'} g/L · 胆红素 ${liver.bilirubin ?? '—'} μmol/L · INR ${liver.inr ?? '—'} · Child-Pugh ${liver.childPughClass ?? '—'}` : '还没有化验记录'))),
        h('div', { className: 'wb-track' }, h('i', { style: { background: 'var(--wb-track-b)' } }),
          h('div', null, h('b', null, 'B 轨 · 肿瘤负荷'),
            h('span', null, tumor ? `${tumor.lesionCount ?? '—'} 个结节 · 最大 ${tumor.maxDiameter ?? '—'} mm · ${tumor.liRads || 'LI-RADS 未记录'} · ${tumor.portalVeinThrombus || 'Vp 未记录'}` : '还没有影像记录'))),
        h('div', { className: 'wb-track' }, h('i', { style: { background: 'var(--wb-track-c)' } }),
          h('div', null, h('b', null, 'C 轨 · 门脉高压'),
            h('span', null, portal ? `静脉曲张 ${portal.varices || '未记录'} · 脾 ${portal.spleenMm ?? '—'} mm · 出血史 ${portal.bleedHistory || '未记录'}` : '还没有评估记录'))))

      const groups = GROUPS.map((g) => ({
        ...g,
        items: state.metrics.filter((m) => (g.ids ? g.ids.includes(m.id) : m.track === g.track && !['wbc', 'anc', 'hgb', 'platelets'].includes(m.id)))
      })).filter((g) => g.items.length)

      const dashBody = state.view === 'dash'
        ? h(React.Fragment, null,
          h('div', null,
            h('h1', null, '看板'),
            h('p', { className: 'wb-lead' }, '两条主轨同时看：肝的储备够不够、瘤负荷到哪一步。门脉高压单独一条线。',
              h('strong', null, '工作台不加总、不评分、不判断能否治疗。')),
            h('div', { className: 'wb-chips', style: { marginTop: 10 } },
              h(Chip, { label: 'BCLC', value: d.stage.BCLC ? d.stage.BCLC.stage : '—' }),
              h(Chip, { label: 'CNLC', value: d.stage.CNLC ? d.stage.CNLC.stage : '—' }),
              h(Chip, { label: '可切除性', value: d.resectability ? ({ resectable: '可切除', borderline: '临界', unresectable: '不可切除', unknown: '未记录' })[d.resectability.conclusion] : '未记录' }),
              h(Chip, { label: 'ALBI', value: d.albi ? `${d.albi.score}（${d.albi.grade} 级）` : '缺测' }))),
          trackStrip,
          h('div', { className: 'wb-notice' }, '分期与可切除性都是医生写下的结论，工作台只记录、不重算。ALBI 由本次白蛋白与胆红素派生，缺一项就不出分。'),
          h('div', null,
            h('div', { className: 'wb-group-head' }, h('h3', null, '本次在册的指标'), h('span', null, '点卡片翻到背面看这条记录的变化')),
            h('div', { className: 'wb-grid' },
              [['albumin', 'A 轨 · 肝功能储备'], ['bilirubin', 'A 轨 · 肝功能储备'],
               ['afp', 'B 轨 · 肿瘤负荷'], ['max_diameter', 'B 轨 · 肿瘤负荷'],
               ['platelets', '安全线 · 血常规'], ['weight', '营养与肌少症']].map(([id, groupName]) => {
                const m = state.metrics.find((x) => x.id === id)
                return m ? h(Card, { key: id, m, groupName, flipped: state.flipped.includes(id), onFlip }) : null
              }))))
        : null

      const metricsBody = h(React.Fragment, null,
          h('div', null,
            h('h1', null, '指标分析'),
            h('p', { className: 'wb-lead' }, '趋势只呈现记录，不代表疗效、复发或诊断判断。不同单位与方法需分开核对。')),
          h('div', { className: 'wb-notice' }, '点任意卡片翻到背面：正面是最近值与较前次变化，背面是这条指标按真实采样日期排的趋势。Tab 选中后回车也可以。'),
          groups.map((g) => h('section', { key: g.name },
            h('div', { className: 'wb-group-head' }, h('h3', null, g.name), h('span', null, `${g.items.length} 项`)),
            h('div', { className: 'wb-grid' },
              g.items.map((m) => h(Card, { key: m.id, m, groupName: g.name, flipped: state.flipped.includes(m.id), onFlip }))))))

      // 专项视图共用一份 sections；没取到就退回看板，不留白屏。
      // 导入视图不吃 sections（队列与候选是另一条读路径），所以放在 S 判空之前。
      const S = state.sections
      const pass = { S, metrics: state.metrics, flipped: state.flipped, onFlip }
      const importNode = h(ViewImport, {
        docs: state.docs, cands: state.cands, activeId: state.activeDoc,
        busy: state.busy, err: state.importErr,
        onOpen: openDoc, onAccept: (id) => settleCand(id, 'accept'), onReject: (id) => settleCand(id, 'reject'),
      })
      const other = () => {
        if (state.view === 'import') return importNode
        if (!S) return h('div', { className: 'wb-empty' }, '这个视图的数据还没读出来。')
        const build = ({
          liver: () => h(ViewLiver, { S }),
          tumor: () => h(ViewTumor, { S }),
          tx: () => h(ViewTx, { S }),
          safety: () => h(ViewSafety, pass),
          nutrition: () => h(ViewNutrition, pass),
          mind: () => h(ViewMind, { S, vp: state.vp, vpPrivate: state.vpPrivate,
            onTogglePrivate: () => loadVp(state.pid, !state.vpPrivate) }),
          followup: () => h(ViewFollowup, { S }),
        })[state.view]
        return build ? build() : null
      }

      const body = state.view === 'dash' ? dashBody : state.view === 'metrics' ? metricsBody : other()

      return shell(h(React.Fragment, null,
        h('p', { style: { margin: 0, fontSize: 12, color: 'var(--wb-muted)' } },
          `${d.profile.name}${d.profile.age ? ' · ' + d.profile.age + ' 岁' : ''}${d.profile.tag ? ' · ' + d.profile.tag : ''}`),
        body))
    }

    function apply(ctx) {
      bridge = ctx
      ctx.effect(() => ctx.desktopWorkbenches.register({"title":"肝细胞癌患者工作台 · 小甘宝 HepPal","repository":"https://github.com/xyb-openharness-dsh-plugins/liver-cancer-workbench","description":"面向肝细胞癌（HCC）患者与照护者的本机优先工作台：肝功能储备与肿瘤负荷双轨记录、转化治疗评估、门脉高压与肝相关安全性、HBV 家庭防护","customFrame":true,"layout":{"businessSide":"left","businessWidth":1 - AGENT_DEFAULT}}, Panel))
    }
    // sessions 只用来往原生草稿里填开场白（不发送）；桌面壳若没提供该服务，
    // 会话区照常可用，只是"开场白自动填入"这一步降级为提示。
    return { apply, inject: ['desktopWorkbenches'] }
  }
})

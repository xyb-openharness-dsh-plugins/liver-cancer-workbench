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

    /* —— AI 面板分隔线：1px 视觉细线 + 11px 透明热区 + 拖动遮罩 ——
       线绝对定位在业务区与会话区的边界上（right: percent%），不占布局宽度；
       拖动命中面积由子元素的 11px 热区提供。品牌色从 --wb-clay 派生，不写死蓝色。 */
    const SPLITTER_BRAND = '#9c5a3c'
    const splitterRgba = (hex, alpha) => {
      const n = parseInt(String(hex).replace('#', ''), 16)
      if (!Number.isFinite(n)) return `rgba(156,90,60,${alpha})`
      return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
    }
    const splitterStyle = {
      position: 'absolute', top: 0, bottom: 0, width: 1, marginRight: -0.5,
      zIndex: 2, background: '#ece2db', cursor: 'col-resize', touchAction: 'none',
      transition: 'background .15s ease, box-shadow .15s ease',
    }
    const splitterHoverStyle = {
      ...splitterStyle, background: SPLITTER_BRAND,
      boxShadow: `0 0 6px ${splitterRgba(SPLITTER_BRAND, 0.55)}`,
    }
    const splitterDragStyle = {
      ...splitterHoverStyle,
      boxShadow: `0 0 10px ${splitterRgba(SPLITTER_BRAND, 0.8)}`,
    }
    const splitterHitStyle = {
      position: 'absolute', top: 0, bottom: 0, left: -5, width: 11,
      background: 'transparent', cursor: 'col-resize',
    }
    const splitterGripStyle = {
      position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
      width: 14, height: 22, borderRadius: 4, background: SPLITTER_BRAND,
      color: '#fff', fontSize: 11, lineHeight: '22px', letterSpacing: '-1px', textAlign: 'center',
      opacity: 0.95, pointerEvents: 'none', userSelect: 'none',
      boxShadow: '0 1px 4px rgba(0, 0, 0, 0.18)',
    }
    /* 拖动期间铺在 body 上的透明遮罩：指针掠过业务 iframe 时事件归子文档，
       document 上的 pointermove 收不到，没有遮罩拖动会断。 */
    const dragShieldStyle = {
      position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 4, cursor: 'col-resize',
    }

    /* —— 三档字号（家族口径）——
       1 / 1.15 / 1.32 乘到 --tz 上，CSS 里每一处字号都是 calc(NNpx * var(--tz))。
       档位存 localStorage：换个视图、重开工作台都保持；设置页与顶栏 chip 改的是同一个值。 */
    const TZ_KEY = 'ganbao.liver.font-scale.v1'
    const TZ_TIERS = [
      { id: 'sm', label: '标准', note: '1.00 倍' },
      { id: 'md', label: '大字', note: '1.15 倍' },
      { id: 'lg', label: '特大', note: '1.32 倍' },
    ]
    const TZ_IDS = TZ_TIERS.map((t) => t.id)
    function loadTz() {
      try {
        const saved = localStorage.getItem(TZ_KEY)
        return TZ_IDS.includes(saved) ? saved : 'sm'
      } catch { return 'sm' }
    }
    function saveTz(id) {
      try { localStorage.setItem(TZ_KEY, id) } catch { /* 隐私模式忽略 */ }
    }
    const nextTz = (id) => TZ_IDS[(TZ_IDS.indexOf(id) + 1) % TZ_IDS.length]
    const tzLabel = (id) => (TZ_TIERS.find((t) => t.id === id) || TZ_TIERS[0]).label

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
      
      async function createOwnedSession() {
        let workspaceId
        try { workspaceId = service?.defaultWorkspace?.()?.workspaceId } catch { workspaceId = undefined }
        return service.newSession(workspaceId)
      }
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

    /* Token 失效时给 Agent 的那段话：只给步骤，不给原理；明说这是工具问题，不许借机谈治疗。 */
    const TOKEN_HELP_PROMPT = [
      '我的扫描件解析失败了，是解析服务的 Token 过期或被重置，不是病情有变化。',
      '请用步骤告诉我怎么更新，不要讲原理：',
      '1）打开 https://mineru.net/apiManage/token 申请或重置；2）复制新 Token；',
      '3）在小甘宝的「设置 → 扫描件解析」里粘贴并保存；4）回到「导入与候选」重新点解析。',
      '另外提醒我：Token 是账号凭据，不要发到对话里、也不要发到病友群。',
      '这件事与治疗无关，请不要给任何治疗或用药建议。',
    ].join('\n')

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
  --tz: 1;
  font-family: -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;
  font-size: calc(15px * var(--tz));
  line-height: 1.62;
  font-variant-numeric: tabular-nums; min-width: 0; min-height: 0; container-type: inline-size;
}
/* 三档字号只有这一个开关：--tz 乘到每一处字号上（家族口径 1 / 1.15 / 1.32）。
   任何地方再写死 px 就等于这一处不跟着放大，所以全文件只有 calc(NNpx * var(--tz)) 一种写法。 */
.wb-liver-cancer-workbench[data-tz=md]{ --tz:1.15; }
.wb-liver-cancer-workbench[data-tz=lg]{ --tz:1.32; }
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
  border-bottom:1px solid var(--wb-line); background:var(--wb-surface); font-size:calc(12px * var(--tz)); }
.wb-liver-cancer-workbench .wb-frame-brand{ display:flex; align-items:center; gap:7px; font-weight:700;
  color:var(--wb-clay-deep); white-space:nowrap; font-size:calc(12.5px * var(--tz)); }
.wb-liver-cancer-workbench .wb-frame-ver{ font-weight:500; font-size:calc(11px * var(--tz)); color:var(--wb-muted);
  background:var(--wb-paper); border:1px solid var(--wb-line); border-radius:999px; padding:1px 8px; white-space:nowrap; }
.wb-liver-cancer-workbench .wb-frame-hint{ flex:1; min-width:180px; color:var(--wb-muted); font-size:calc(11.5px * var(--tz)); }
.wb-liver-cancer-workbench .wb-frame-actions{ display:flex; align-items:center; gap:6px; flex:0 0 auto; margin-inline-start:auto; }
.wb-liver-cancer-workbench .wb-frame-body{ position:relative; display:flex; flex:1; min-height:0; min-width:0; overflow:hidden; }
.wb-liver-cancer-workbench .wb-business{ display:grid; grid-template-columns:236px minmax(0,1fr);
  flex:1; min-width:0; min-height:0; background:var(--wb-paper); }
.wb-liver-cancer-workbench .wb-side{ display:flex; flex-direction:column; gap:6px; min-width:0;
  padding:16px 14px 14px; background:var(--wb-surface); border-inline-end:1px solid var(--wb-line); }
.wb-liver-cancer-workbench .wb-brand{ display:flex; gap:10px; align-items:center; padding:0 4px 12px; min-width:0; }
.wb-liver-cancer-workbench .wb-brand-mark{ display:grid; place-items:center; width:44px; height:44px; flex:0 0 auto;
  border-radius:14px; background:#f6e9e1; border:1px solid var(--wb-line); color:var(--wb-clay-deep);
  font-weight:600; font-size:calc(17px * var(--tz)); }
.wb-liver-cancer-workbench .wb-brand b{ display:block; font-size:calc(17px * var(--tz)); letter-spacing:.6px; line-height:1.25; }
.wb-liver-cancer-workbench .wb-brand span{ display:block; font-size:calc(10.5px * var(--tz)); color:var(--wb-muted); letter-spacing:.2px; }
.wb-liver-cancer-workbench .wb-side-profile{ display:flex; gap:9px; align-items:center; min-width:0;
  padding:8px 10px; margin-bottom:8px; background:#fdf6f1; border:1px solid #f0dccf; border-radius:12px; }
.wb-liver-cancer-workbench .wb-side-profile .av{ display:grid; place-items:center; width:29px; height:29px; flex:0 0 auto;
  border-radius:50%; background:var(--wb-surface); border:1px solid #f0dccf; font-size:calc(12.5px * var(--tz)); font-weight:600; color:var(--wb-clay-deep); }
.wb-liver-cancer-workbench .wb-side-profile b{ display:block; font-size:calc(12px * var(--tz)); line-height:1.35; }
.wb-liver-cancer-workbench .wb-side-profile span{ display:block; font-size:calc(10.5px * var(--tz)); color:var(--wb-muted); }
.wb-liver-cancer-workbench .wb-nav{ display:flex; flex-direction:column; gap:3px; min-width:0; }
.wb-liver-cancer-workbench .wb-nav button{ display:flex; align-items:center; gap:9px; width:100%; text-align:start;
  border:1px solid transparent; background:none; border-radius:10px; padding:8px 11px; min-height:38px;
  color:var(--wb-ink2); font-size:calc(13px * var(--tz)); white-space:nowrap; }
.wb-liver-cancer-workbench .wb-nav button:hover{ background:var(--wb-paper); }
.wb-liver-cancer-workbench .wb-nav button[aria-current=true]{ background:#fdf6f1; border-color:#f0dccf;
  color:var(--wb-clay-deep); font-weight:600; }
.wb-liver-cancer-workbench .wb-nav .dot{ width:6px; height:6px; border-radius:50%; flex:0 0 auto; background:#d9c8bd; }
.wb-liver-cancer-workbench .wb-nav button[aria-current=true] .dot{ background:var(--wb-clay); }
.wb-liver-cancer-workbench .wb-side-bottom{ margin-top:auto; padding:14px 4px 0; border-top:1px solid var(--wb-line); }
.wb-liver-cancer-workbench .wb-side-bottom b{ display:block; font-size:calc(9.5px * var(--tz)); letter-spacing:1.2px;
  text-transform:uppercase; color:var(--wb-muted); font-weight:600; }
.wb-liver-cancer-workbench .wb-side-bottom p{ margin:6px 0 0; font-size:calc(11.5px * var(--tz)); line-height:1.7; color:var(--wb-muted); }
/* 主区自己也是容器：会话区展开后主区变窄，卡片/两栏要按主区实际宽度折叠，
   而不是按整帧宽度判断（否则一开面板，队列列被压到 190px）。 */
.wb-liver-cancer-workbench .wb-main{ display:flex; flex-direction:column; min-width:0; min-height:0; container-type:inline-size; }
.wb-liver-cancer-workbench .wb-topbar{ display:flex; align-items:center; gap:12px; flex-wrap:wrap; flex:0 0 auto;
  padding:9px 20px; background:var(--wb-surface); border-bottom:1px solid var(--wb-line); }
.wb-liver-cancer-workbench .wb-crumb{ font-size:calc(11.5px * var(--tz)); color:var(--wb-muted); white-space:nowrap; }
.wb-liver-cancer-workbench .wb-crumb b{ color:var(--wb-ink); font-weight:600; }
.wb-liver-cancer-workbench .wb-topbar .wb-top-actions{ display:flex; align-items:center; gap:6px; margin-inline-start:auto; }
@container (max-width: 900px){
  .wb-liver-cancer-workbench .wb-business{ grid-template-columns:minmax(0,1fr); }
  .wb-liver-cancer-workbench .wb-side{ border-inline-end:0; border-bottom:1px solid var(--wb-line);
    padding:10px 14px; flex-direction:column; gap:8px; }
  .wb-liver-cancer-workbench .wb-brand{ padding:0; }
  .wb-liver-cancer-workbench .wb-brand-mark{ width:34px; height:34px; border-radius:11px; font-size:calc(14px * var(--tz)); }
  .wb-liver-cancer-workbench .wb-brand b{ font-size:calc(15px * var(--tz)); }
  .wb-liver-cancer-workbench .wb-side-profile,
  .wb-liver-cancer-workbench .wb-side-bottom{ display:none; }
  .wb-liver-cancer-workbench .wb-nav{ flex-direction:row; flex-wrap:nowrap; overflow-x:auto; gap:4px; padding-bottom:1px; }
  .wb-liver-cancer-workbench .wb-nav button{ width:auto; min-height:34px; padding:6px 11px; font-size:calc(12.5px * var(--tz)); }
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
/* 分隔线是绝对定位的 1px 细线（不占布局宽度），样式由 splitterStyle 内联给出；
   这里只保留键盘焦点环。 */
.wb-liver-cancer-workbench .wb-splitter:focus-visible{ outline:2px solid var(--wb-clay); outline-offset:4px; border-radius:2px; }
.wb-liver-cancer-workbench .wb-agent-empty{ display:flex; flex-direction:column; gap:8px; justify-content:center;
  padding:22px 20px; color:var(--wb-ink2); font-size:calc(12.5px * var(--tz)); line-height:1.75; }
/* 会话是宿主给的 React 元素，里面用 portal 把原生会话挂到宿主容器上；
   有会话时宿主给这个元素 display:contents，所以真正占位的是它的子节点。 */
.wb-liver-cancer-workbench .wb-agent > *{ flex:1 1 auto; min-height:0; min-width:0; }
.wb-liver-cancer-workbench .wb-agent > * > *{ flex:1 1 auto; min-height:0; min-width:0; }
.wb-liver-cancer-workbench .wb-btn-agent{ border:0; border-radius:999px; padding:5px 14px; white-space:nowrap;
  background:var(--wb-clay); color:#fff; font:inherit; font-weight:600; font-size:calc(12px * var(--tz)); cursor:pointer; }
.wb-liver-cancer-workbench .wb-btn-agent:disabled{ opacity:.5; cursor:not-allowed; }
.wb-liver-cancer-workbench .wb-btn-ghost{ border:1px solid var(--wb-line); border-radius:999px; background:transparent;
  color:var(--wb-ink2); padding:4px 10px; font:inherit; font-size:calc(12px * var(--tz)); cursor:pointer; }
.wb-liver-cancer-workbench .wb-agent-note{ font-size:calc(11px * var(--tz)); color:var(--wb-clay-deep); font-weight:600; }
/* 调起会话失败必须看得见：小字会被当成"点了没反应"，所以错误走通栏提示 */
.wb-liver-cancer-workbench .wb-agent-note[data-tone=error]{ flex-basis:100%; order:9; margin:4px 0 0;
  padding:5px 10px; background:#fdeee7; border:1px solid #f2cbb8; border-radius:9px;
  color:#8f3b1c; font-size:calc(12px * var(--tz)); line-height:1.55; white-space:normal; }
.wb-liver-cancer-workbench .wb-head{ display:flex; gap:12px; flex-wrap:wrap; align-items:center;
  padding-inline-start: var(--dsh-frame-leading-clearance, 0px); }
.wb-liver-cancer-workbench .wb-nav{ display:flex; gap:6px; flex-wrap:wrap; }
.wb-liver-cancer-workbench .wb-nav button{ border:1px solid transparent; background:none; border-radius:999px; padding:6px 14px; min-height:36px; color:var(--wb-ink2); }
.wb-liver-cancer-workbench .wb-nav button[aria-current=true]{ background:var(--wb-surface); border-color:var(--wb-line); color:var(--wb-clay-deep); font-weight:600; }
.wb-liver-cancer-workbench h1{ font-size:calc(26px * var(--tz)); margin:0; letter-spacing:-.4px; }
.wb-liver-cancer-workbench .wb-lead{ margin:4px 0 0; color:var(--wb-ink2); max-width:64ch; }
.wb-liver-cancer-workbench .wb-chips{ display:flex; gap:8px; flex-wrap:wrap; }
.wb-liver-cancer-workbench .wb-chip{ font-size:calc(11.5px * var(--tz)); padding:3px 10px; border-radius:999px; background:var(--wb-surface); border:1px solid var(--wb-line); color:var(--wb-ink2); }
.wb-liver-cancer-workbench .wb-chip b{ color:var(--wb-ink); }
.wb-liver-cancer-workbench .wb-tracks{ display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:0; background:var(--wb-surface);
  border:1px solid var(--wb-line); border-radius:14px; overflow:hidden; }
.wb-liver-cancer-workbench .wb-track{ padding:12px 16px; display:flex; gap:10px; min-width:0; }
.wb-liver-cancer-workbench .wb-track + .wb-track{ border-inline-start:1px solid var(--wb-line); }
.wb-liver-cancer-workbench .wb-track i{ width:8px; height:8px; border-radius:50%; margin-top:9px; flex:0 0 auto; }
.wb-liver-cancer-workbench .wb-track b{ display:block; font-size:calc(12.5px * var(--tz)); }
.wb-liver-cancer-workbench .wb-track span{ display:block; font-size:calc(11.5px * var(--tz)); color:var(--wb-muted); line-height:1.5; }
.wb-liver-cancer-workbench .wb-notice{ background:#fdf6f1; border:1px solid #f0dccf; border-radius:12px;
  padding:10px 14px; font-size:calc(12.5px * var(--tz)); color:var(--wb-ink2); }
.wb-liver-cancer-workbench .wb-group-head{ display:flex; align-items:baseline; gap:10px;
  margin-bottom:10px; padding-bottom:7px; border-bottom:1px solid var(--wb-line); }
.wb-liver-cancer-workbench .wb-group-head h3{ font-size:calc(13.5px * var(--tz)); margin:0; }
.wb-liver-cancer-workbench .wb-group-head span{ font-size:calc(11.5px * var(--tz)); color:var(--wb-muted); }
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
.wb-liver-cancer-workbench .wb-flip{ position:absolute; top:16px; right:16px; font-size:calc(13px * var(--tz)); color:#c9b8ad;
  transition:color .16s, transform .32s cubic-bezier(.2,.7,.2,1); pointer-events:none; }
.wb-liver-cancer-workbench .wb-card:hover .wb-flip{ color:var(--wb-clay-deep); transform:rotate(180deg); }
.wb-liver-cancer-workbench .wb-cat{ font-size:calc(10.5px * var(--tz)); letter-spacing:.4px; color:#a2949b; display:flex; align-items:center; gap:6px; padding-inline-end:20px; }
.wb-liver-cancer-workbench .wb-cat i{ width:7px; height:7px; border-radius:50%; flex:0 0 auto; }
.wb-liver-cancer-workbench .wb-name{ display:block; font-size:calc(15px * var(--tz)); color:var(--wb-ink2); margin-top:9px; line-height:1.3; }
.wb-liver-cancer-workbench .wb-val{ display:block; font-size:calc(33px * var(--tz)); font-weight:600; letter-spacing:-.9px; line-height:1.15; margin-top:4px; }
.wb-liver-cancer-workbench .wb-val small{ font-size:calc(12px * var(--tz)); font-weight:500; color:var(--wb-muted); margin-inline-start:5px; letter-spacing:0; }
.wb-liver-cancer-workbench .wb-delta{ display:block; font-size:calc(11.5px * var(--tz)); color:var(--wb-ink2); margin-top:5px; }
.wb-liver-cancer-workbench .wb-delta em{ font-style:normal; font-weight:600; color:var(--wb-ink); }
.wb-liver-cancer-workbench .wb-note{ display:block; font-size:calc(11px * var(--tz)); line-height:1.55; color:#9b8d86; margin-top:10px; max-width:94%; }
.wb-liver-cancer-workbench .wb-meta{ display:flex; justify-content:space-between; gap:8px; font-size:calc(10.5px * var(--tz)); color:var(--wb-muted); margin-top:auto; padding-top:8px; }
.wb-liver-cancer-workbench .wb-src{ display:block; font-size:calc(10px * var(--tz)); color:#b0a29a; margin-top:3px; }
.wb-liver-cancer-workbench .wb-badge{ align-self:flex-start; margin-top:8px; font-size:calc(9.5px * var(--tz)); font-weight:600;
  padding:1px 7px; border-radius:20px; border:1px solid #e8ddd6; background:#fbf7f4; color:#7d6a60; }
.wb-liver-cancer-workbench .wb-badge.warn{ background:#fdf0e8; border-color:#efcdb8; color:#8a3d1c; }
.wb-liver-cancer-workbench .wb-spark{ display:block; flex:1 1 auto; min-height:0; margin:8px 0 2px; }
.wb-liver-cancer-workbench .wb-spark svg{ display:block; width:100%; height:auto; max-height:110px; }
.wb-liver-cancer-workbench .wb-line{ display:block; font-size:calc(10.5px * var(--tz)); line-height:1.5; color:var(--wb-ink2); margin-top:4px; }
.wb-liver-cancer-workbench .wb-na{ display:block; font-size:calc(11.5px * var(--tz)); color:var(--wb-muted); margin-top:10px; line-height:1.65; }
.wb-liver-cancer-workbench .wb-foot{ display:block; margin-top:auto; padding-top:6px; font-size:calc(9.5px * var(--tz)); color:#a3949b; }

/* —— 专项视图：面板 / 表 / 时间线。全部用语义变量，暗色下不会白底白字 —— */
.wb-liver-cancer-workbench .wb-sec{ display:block; }
.wb-liver-cancer-workbench .wb-sec h2{ font-size:calc(16px * var(--tz)); margin:0 0 3px; letter-spacing:-.2px; }
.wb-liver-cancer-workbench .wb-sec p.wb-lead{ margin:0 0 2px; font-size:calc(12.5px * var(--tz)); }
.wb-liver-cancer-workbench .wb-stack{ display:flex; flex-direction:column; gap:16px; }
.wb-liver-cancer-workbench .wb-two{ display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px; align-items:start; }
.wb-liver-cancer-workbench .wb-panel{ background:var(--wb-surface); border:1px solid var(--wb-line); border-radius:14px; overflow:hidden; }
.wb-liver-cancer-workbench .wb-panel-h{ padding:10px 14px; border-bottom:1px solid var(--wb-line); display:flex; gap:10px; align-items:baseline; flex-wrap:wrap; }
.wb-liver-cancer-workbench .wb-panel-h b{ font-size:calc(13px * var(--tz)); }
.wb-liver-cancer-workbench .wb-panel-h span{ font-size:calc(11px * var(--tz)); color:var(--wb-muted); }
.wb-liver-cancer-workbench .wb-scroll{ overflow-x:auto; }
.wb-liver-cancer-workbench .wb-tbl{ width:100%; border-collapse:collapse; font-size:calc(12px * var(--tz)); }
.wb-liver-cancer-workbench .wb-tbl th{ text-align:start; font-weight:600; font-size:calc(11px * var(--tz)); color:var(--wb-muted);
  padding:8px 12px; border-bottom:1px solid var(--wb-line); background:var(--wb-paper); white-space:nowrap; }
.wb-liver-cancer-workbench .wb-tbl td{ padding:9px 12px; border-bottom:1px solid var(--wb-line); color:var(--wb-ink2); vertical-align:top; }
.wb-liver-cancer-workbench .wb-tbl tr:last-child td{ border-bottom:0; }
.wb-liver-cancer-workbench .wb-tbl td b{ color:var(--wb-ink); font-weight:600; }
.wb-liver-cancer-workbench .wb-tbl td.n{ font-variant-numeric:tabular-nums; white-space:nowrap; }
.wb-liver-cancer-workbench .wb-item{ padding:11px 14px; border-bottom:1px solid var(--wb-line); display:flex; gap:12px; }
.wb-liver-cancer-workbench .wb-item:last-child{ border-bottom:0; }
.wb-liver-cancer-workbench .wb-item .d{ flex:0 0 76px; font-size:calc(11px * var(--tz)); color:var(--wb-muted); font-variant-numeric:tabular-nums; padding-top:2px; }
.wb-liver-cancer-workbench .wb-item .c{ flex:1; min-width:0; font-size:calc(12.5px * var(--tz)); line-height:1.62; }
.wb-liver-cancer-workbench .wb-item .c b{ display:block; font-size:calc(13px * var(--tz)); color:var(--wb-ink); margin-bottom:1px; }
.wb-liver-cancer-workbench .wb-item .c span{ display:block; }
.wb-liver-cancer-workbench .wb-tag{ display:inline-block; font-size:calc(10px * var(--tz)); padding:0 7px; border-radius:20px;
  border:1px solid var(--wb-line); color:var(--wb-muted); margin-inline-start:6px; font-weight:400; vertical-align:1px; }
.wb-liver-cancer-workbench .wb-tag.now{ border-color:#e6c9b8; }
.wb-liver-cancer-workbench .wb-tag.now{ color:var(--wb-clay-deep); }
.wb-liver-cancer-workbench .wb-empty{ padding:16px; font-size:calc(12px * var(--tz)); color:var(--wb-muted); line-height:1.7; }
.wb-liver-cancer-workbench .wb-private{ font-size:calc(11px * var(--tz)); color:var(--wb-muted); background:var(--wb-paper);
  border:1px dashed var(--wb-line); border-radius:10px; padding:8px 12px; }
/* —— 导入队列与候选：队列行是按钮，候选行带原文行与两个动作 —— */
.wb-liver-cancer-workbench .wb-qrow{ display:flex; gap:10px; width:100%; align-items:flex-start; text-align:start;
  background:none; border:0; border-bottom:1px solid var(--wb-line); padding:11px 14px; min-height:44px; }
.wb-liver-cancer-workbench .wb-qrow:last-child{ border-bottom:0; }
.wb-liver-cancer-workbench .wb-qrow:hover{ background:var(--wb-paper); }
.wb-liver-cancer-workbench .wb-qrow[aria-current=true]{ background:#fdf6f1; }
.wb-liver-cancer-workbench .wb-qrow .qmain{ flex:1; min-width:0; }
.wb-liver-cancer-workbench .wb-qrow b{ display:block; font-size:calc(13px * var(--tz)); color:var(--wb-ink); }
.wb-liver-cancer-workbench .wb-qrow span{ display:block; font-size:calc(11.5px * var(--tz)); color:var(--wb-muted); line-height:1.55; }
.wb-liver-cancer-workbench .wb-st{ flex:0 0 auto; font-size:calc(10.5px * var(--tz)); padding:1px 8px; border-radius:20px; margin-top:2px;
  border:1px solid var(--wb-line); color:var(--wb-muted); background:var(--wb-paper); white-space:nowrap; }
.wb-liver-cancer-workbench .wb-st.ok{ color:#2f6f66; border-color:#bcdcd4; background:#eef7f4; }
.wb-liver-cancer-workbench .wb-st.bad{ color:#8a3d1c; border-color:#efcdb8; background:#fdf0e8; }
.wb-liver-cancer-workbench .wb-st.wait{ color:#7d5a12; border-color:#ecdcb6; background:#fdf7e8; }
.wb-liver-cancer-workbench .wb-cand{ display:flex; gap:12px; align-items:flex-start;
  padding:12px 14px; border-bottom:1px solid var(--wb-line); }
.wb-liver-cancer-workbench .wb-cand:last-child{ border-bottom:0; }
.wb-liver-cancer-workbench .wb-cand .cmain{ flex:1; min-width:0; font-size:calc(12.5px * var(--tz)); }
.wb-liver-cancer-workbench .wb-cand .cfield{ font-weight:600; color:var(--wb-ink); }
.wb-liver-cancer-workbench .wb-cand .cval{ font-variant-numeric:tabular-nums; color:var(--wb-ink); }
.wb-liver-cancer-workbench .wb-cand .csrc{ display:block; margin-top:5px; padding:3px 7px; font-size:calc(10.5px * var(--tz));
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace; color:var(--wb-ink2);
  background:var(--wb-paper); border:1px solid var(--wb-line); border-radius:6px;
  white-space:pre-wrap; word-break:break-all; }
.wb-liver-cancer-workbench .wb-cand .cacts{ display:flex; gap:6px; flex:0 0 auto; }
.wb-liver-cancer-workbench .wb-btn{ font-size:calc(11.5px * var(--tz)); padding:5px 12px; min-height:32px; border-radius:8px;
  border:1px solid var(--wb-line); background:var(--wb-surface); color:var(--wb-ink2); }
.wb-liver-cancer-workbench .wb-btn:hover:not(:disabled){ border-color:#e6c9b8; color:var(--wb-clay-deep); }
.wb-liver-cancer-workbench .wb-btn.primary{ border-color:var(--wb-clay); color:var(--wb-clay-deep); font-weight:600; }
.wb-liver-cancer-workbench .wb-btn:disabled{ opacity:.45; cursor:not-allowed; }
.wb-liver-cancer-workbench .wb-cf{ display:block; font-size:calc(10.5px * var(--tz)); color:var(--wb-muted); margin-top:4px; }
@container (max-width: 720px){ .wb-liver-cancer-workbench .wb-cand{ flex-direction:column; }
  .wb-liver-cancer-workbench .wb-cand .cacts{ width:100%; } }
@container (max-width: 960px){ .wb-liver-cancer-workbench .wb-two{ grid-template-columns:1fr; } }
@container (max-width: 720px){ .wb-liver-cancer-workbench .wb-item{ flex-direction:column; gap:2px; }
  .wb-liver-cancer-workbench .wb-item .d{ flex:none; } }
@media (prefers-reduced-motion: reduce){
  .wb-liver-cancer-workbench .wb-card-inner{ transition:none; }
  .wb-liver-cancer-workbench .wb-flip{ transition:none; }
}
/* —— 病情一图秀：左栏勾指标，右侧统一画布。同轴看"位置与拐点"，不跨条比绝对值 —— */
.wb-liver-cancer-workbench .wb-onepage{ display:grid; grid-template-columns:248px minmax(0,1fr); gap:16px; align-items:start; }
.wb-liver-cancer-workbench .wb-op-rail{ display:flex; flex-direction:column; gap:9px; padding:12px;
  background:var(--wb-surface); border:1px solid var(--wb-line); border-radius:14px; }
.wb-liver-cancer-workbench .wb-op-sect{ font-size:calc(9.5px * var(--tz)); letter-spacing:1.2px; text-transform:uppercase;
  color:var(--wb-muted); font-weight:600; }
.wb-liver-cancer-workbench .wb-op-chips{ display:flex; flex-wrap:wrap; gap:5px; }
.wb-liver-cancer-workbench .wb-op-chips button{ border:1px solid var(--wb-line); background:var(--wb-paper); border-radius:999px;
  padding:3px 10px; min-height:26px; font-size:calc(11.5px * var(--tz)); color:var(--wb-ink2); }
.wb-liver-cancer-workbench .wb-op-chips button[aria-pressed=true]{ border-color:var(--wb-clay); background:#fdf6f1;
  color:var(--wb-clay-deep); font-weight:600; }
.wb-liver-cancer-workbench .wb-op-slider{ display:flex; align-items:center; gap:8px; font-size:calc(11.5px * var(--tz)); color:var(--wb-muted); }
.wb-liver-cancer-workbench .wb-op-slider input{ flex:1; min-width:0; accent-color:var(--wb-clay); }
.wb-liver-cancer-workbench .wb-op-toggle{ display:flex; align-items:center; gap:6px; font-size:calc(12px * var(--tz)); color:var(--wb-ink2); min-height:24px; }
.wb-liver-cancer-workbench .wb-op-toggle input{ accent-color:var(--wb-clay); }
.wb-liver-cancer-workbench .wb-op-group{ display:flex; flex-direction:column; gap:2px; min-width:0; }
.wb-liver-cancer-workbench .wb-op-groups{ display:flex; flex-direction:column; gap:2px; min-width:0; }
.wb-liver-cancer-workbench .wb-op-group > b{ font-size:calc(10.5px * var(--tz)); font-weight:600; color:var(--wb-muted); margin:6px 0 2px; }
.wb-liver-cancer-workbench .wb-op-item{ display:flex; align-items:center; gap:7px; width:100%; text-align:start;
  border:1px solid transparent; background:none; border-radius:8px; padding:5px 7px; min-height:30px;
  font-size:calc(12px * var(--tz)); color:var(--wb-ink2); }
.wb-liver-cancer-workbench .wb-op-item:hover{ background:var(--wb-paper); }
.wb-liver-cancer-workbench .wb-op-item i{ flex:0 0 auto; width:9px; height:9px; border-radius:3px; }
.wb-liver-cancer-workbench .wb-op-item[aria-checked=false]{ color:var(--wb-muted); }
.wb-liver-cancer-workbench .wb-op-item[aria-checked=false] i{ background:transparent !important; border:1px solid #d9c8bd; }
.wb-liver-cancer-workbench .wb-op-item span{ flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.wb-liver-cancer-workbench .wb-op-item em{ font-style:normal; font-size:calc(10.5px * var(--tz)); color:var(--wb-muted); font-variant-numeric:tabular-nums; }
.wb-liver-cancer-workbench .wb-op-stage{ display:flex; flex-direction:column; gap:10px; min-width:0; }
.wb-liver-cancer-workbench .wb-op-canvas{ padding:10px 12px 4px; background:var(--wb-surface);
  border:1px solid var(--wb-line); border-radius:14px; min-width:0; }
.wb-liver-cancer-workbench .wb-op-canvas svg{ display:block; width:100%; height:auto; }
.wb-liver-cancer-workbench .wb-op-legend{ display:flex; flex-wrap:wrap; gap:4px 14px; padding:2px 4px; }
.wb-liver-cancer-workbench .wb-op-legend span{ display:inline-flex; align-items:center; gap:6px; font-size:calc(11.5px * var(--tz)); color:var(--wb-ink2); }
.wb-liver-cancer-workbench .wb-op-legend i{ width:14px; height:3px; border-radius:2px; }
.wb-liver-cancer-workbench .wb-op-detail{ display:flex; gap:6px 16px; flex-wrap:wrap; align-items:baseline;
  padding:10px 14px; background:#fdf6f1; border:1px solid #f0dccf; border-radius:12px;
  font-size:calc(12.5px * var(--tz)); color:var(--wb-ink2); }
.wb-liver-cancer-workbench .wb-op-detail b{ font-size:calc(14px * var(--tz)); color:var(--wb-ink); font-variant-numeric:tabular-nums; }
.wb-liver-cancer-workbench .wb-op-hit{ cursor:pointer; }
/* 主区被会话区挤窄时：先看图，再选指标；指标排两列，别让左栏变成一长条 */
@container (max-width: 900px){
  .wb-liver-cancer-workbench .wb-onepage{ grid-template-columns:1fr; }
  .wb-liver-cancer-workbench .wb-op-stage{ order:1; }
  .wb-liver-cancer-workbench .wb-op-rail{ order:2; }
  .wb-liver-cancer-workbench .wb-op-groups{ display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:0 12px; }
}
/* —— 设置页 ——
   设置只放三类配置，每块都要说清"当前生效的是哪一个"；没有的能力如实写"还没做"。 */
.wb-liver-cancer-workbench .wb-set-row{ display:flex; align-items:flex-start; gap:12px; padding:10px 0 0; }
.wb-liver-cancer-workbench .wb-set-main{ display:flex; flex-direction:column; gap:3px; min-width:0; flex:1; }
.wb-liver-cancer-workbench .wb-set-main b{ font-size:calc(13.5px * var(--tz)); font-weight:600; overflow-wrap:anywhere; }
.wb-liver-cancer-workbench .wb-set-main span{ font-size:calc(11.5px * var(--tz)); color:var(--wb-muted); overflow-wrap:anywhere; }
.wb-liver-cancer-workbench .wb-set-main b[data-tone=ok]{ color:var(--wb-track-a); }
.wb-liver-cancer-workbench .wb-set-main b[data-tone=warn]{ color:var(--wb-track-c); }
.wb-liver-cancer-workbench .wb-set-main b[data-tone=error]{ color:#a83a2a; }
.wb-liver-cancer-workbench .wb-set-form{ display:flex; gap:8px; align-items:center; margin-top:10px; flex-wrap:wrap; }
.wb-liver-cancer-workbench .wb-input{ flex:1 1 240px; min-width:0; padding:7px 10px; border-radius:10px;
  border:1px solid var(--wb-line); background:var(--wb-paper); color:var(--wb-ink);
  font:inherit; font-size:calc(12.5px * var(--tz)); }
.wb-liver-cancer-workbench .wb-input:focus-visible{ outline:2px solid var(--wb-clay); outline-offset:2px; }
.wb-liver-cancer-workbench .wb-set-note{ margin:8px 0 0; font-size:calc(11.5px * var(--tz)); color:var(--wb-ink2); }
.wb-liver-cancer-workbench .wb-set-note[data-tone=error]{ color:#a83a2a; font-weight:600; }
.wb-liver-cancer-workbench .wb-hint{ margin:8px 0 0; font-size:calc(11px * var(--tz)); color:var(--wb-muted); line-height:1.6; }
.wb-liver-cancer-workbench .wb-hint a{ color:var(--wb-clay-deep); }
.wb-liver-cancer-workbench .wb-link{ border:0; background:none; padding:0; color:var(--wb-clay-deep);
  text-decoration:underline; font:inherit; font-size:inherit; cursor:pointer; }
.wb-liver-cancer-workbench .wb-set-tiers{ display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; margin-top:10px; }
.wb-liver-cancer-workbench .wb-tier{ display:flex; flex-direction:column; gap:2px; align-items:flex-start;
  padding:9px 11px; border-radius:12px; border:1px solid var(--wb-line); background:var(--wb-surface); }
.wb-liver-cancer-workbench .wb-tier b{ font-size:calc(12.5px * var(--tz)); }
.wb-liver-cancer-workbench .wb-tier span{ font-size:calc(10.5px * var(--tz)); color:var(--wb-muted); }
.wb-liver-cancer-workbench .wb-tier[aria-checked=true]{ border-color:var(--wb-clay); background:var(--wb-paper);
  box-shadow:inset 0 0 0 1px var(--wb-clay); }
/* 队列行 +「解析」：外层用 div 包住，按钮不能嵌套按钮 */
.wb-liver-cancer-workbench .wb-qrow-wrap{ display:flex; align-items:stretch; gap:6px; }
.wb-liver-cancer-workbench .wb-qrow-wrap .wb-qrow{ flex:1; min-width:0; }
.wb-liver-cancer-workbench .wb-qparse{ flex:0 0 auto; align-self:center; white-space:nowrap; }
.wb-liver-cancer-workbench .wb-token-actions{ display:flex; gap:14px; flex-wrap:wrap; align-items:center; margin-top:8px; }
.wb-liver-cancer-workbench .wb-token-actions a{ color:var(--wb-clay-deep); font-size:calc(11.5px * var(--tz)); }
.wb-liver-cancer-workbench .wb-notice[data-tone=info]{ display:flex; flex-direction:column; gap:4px; }
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
  .wb-liver-cancer-workbench .wb-op-detail{ background:#332a25; border-color:#4b3c33; }
  .wb-liver-cancer-workbench .wb-op-chips button[aria-pressed=true]{ background:#332a25; border-color:#4b3c33; }
  .wb-liver-cancer-workbench .wb-op-item[aria-checked=false] i{ border-color:#5a4b42; }
  .wb-liver-cancer-workbench .wb-agent-note[data-tone=error]{ background:#3b2a22; border-color:#6d4633; color:#f0b795; }
  .wb-liver-cancer-workbench .wb-input{ background:#241f1c; }
  .wb-liver-cancer-workbench .wb-tier[aria-checked=true]{ background:#332a25; }
  .wb-liver-cancer-workbench .wb-set-main b[data-tone=error]{ color:#f0b795; }
  .wb-liver-cancer-workbench .wb-set-note[data-tone=error]{ color:#f0b795; }
}`

    /* 36 号 v2 · 疾病概要数据（小甘宝 · 肝细胞癌）
       来源：prototypes/v0.1/primer-data.js（构建期人工内联，宿主不提供静态资源路由）。
       四段顺序固定 definition / evidence / landscape / trend，与 36 号 §2 一致。 */
    const PRIMER_DATA = {
  "brand": "小甘宝 HepPal",
  "name": "肝细胞癌",
  "en": "Hepatocellular Carcinoma（HCC）",
  "updated": "2026-10-27",
  "sections": [
    {
      "id": "definition",
      "title": "定义",
      "intro": "肝细胞癌是起源于肝细胞的恶性肿瘤，属于原发性肝癌的一种。这个病有三条各自独立的线：肝功能储备、肿瘤负荷、门脉高压。这三条线并列记录，不相加、不互相换算——本台不把它们压成一个分数。",
      "points": [
        "肝功能储备是第一条线：白蛋白、总胆红素、INR、腹水、肝性脑病构成 Child-Pugh 的五个成分，ALBI 用白蛋白与胆红素派生。Child-Pugh 评分与分级只存医生记录，本台不重算、不按化验值反推。",
        "肿瘤负荷是第二条线：结节数目、最大径、段位、血管侵犯（Vp0–Vp4）、肝外扩散，以及 AFP / PIVKA-II。血管侵犯记的是癌栓位置，不是肿瘤大小，两者不能互相推算。",
        "门脉高压是第三条独立风险线：血小板、脾大、食管胃底静脉曲张、腹水各自记录；它不是前两条线的合计项，也不能由肿瘤大小推出来。",
        "分期体系至少三套并存：BCLC（0 / A / B / C / D）、CNLC（Ⅰa / Ⅰb / Ⅱa / Ⅱb / Ⅲa / Ⅲb / Ⅳ）、AJCC/UICC TNM（只有切除后才完整）。三套不换算，本台只记录「医生说的是哪一套」，并列展示。",
        "病因是背景维度，不是分期变量：HBV、HCV、酒精、MASLD 各自记录抗病毒药、饮酒量、代谢情况，与肿瘤分期分开保存。"
      ],
      "sources": [
        {
          "org": "国家卫生健康委",
          "doc": "原发性肝癌诊疗指南（2024 年版）·「三、肝癌的分期」（CNLC Ⅰa–Ⅳ，图 4）",
          "version": "2024 年版（国卫办医政函〔2024〕97 号）",
          "original": true,
          "url": "https://wsjkw.hebei.gov.cn/zcfg2/402819.jhtml",
          "page": "P32",
          "note": "河北省卫健委转发页（原文通知与 PDF 附件）；NHC 官网自动化复验遇 412 限频"
        },
        {
          "org": "国家卫生健康委",
          "doc": "原发性肝癌诊疗指南（2022 年版）·「三、分期」（CNLC Ⅱa–Ⅳ 与分期图）",
          "version": "2022 年版（国卫办医函〔2022〕12 号）",
          "original": true,
          "url": "https://wsjkw.hebei.gov.cn/zcfg2/385518.jhtml",
          "page": "P22",
          "note": "河北省卫健委转发页（原文通知与 PDF 附件）；NHC 官网自动化复验遇 412 限频"
        },
        {
          "org": "BCLC",
          "doc": "BCLC 2022 update（Reig 等，J Hepatol 2022;76(3):681-693）",
          "version": "2022",
          "original": false,
          "secondaryUrl": "https://www.bclc.cat/default.php?q=professional-area%2Fmanagement-of-hcc.html&locale=en",
          "page": "页码待核",
          "note": "未取得期刊原件；期刊页与 PMC 均被反爬拦截，二次来源取 BCLC 官网（PMID 34801630、PMCID PMC8866082）"
        },
        {
          "org": "AJCC / UICC",
          "doc": "AJCC Cancer Staging Manual, 8th ed.（肝细胞癌章节）",
          "version": "第 8 版（2017）",
          "original": false,
          "secondaryUrl": "https://www.facs.org/quality-programs/cancer-programs/american-joint-committee-on-cancer/cancer-staging-systems/cancer-staging-system-products/",
          "page": "页码待核",
          "note": "未取得原书；二次来源为 ACS/AJCC 官方分期手册产品页（含第 8 版勘误；总述文章 CA Cancer J Clin 2017;67:93-99）"
        }
      ]
    },
    {
      "id": "evidence",
      "title": "医学资料规范和指南情况",
      "intro": "这台工作台里出现的每一条「该查什么、该怎么分期」，都应能追到下面某一份文件。哪一份拿到了原件、哪一份只是看到了二次来源，表格里逐行写清楚——没看到原件的不假装看过。",
      "table": {
        "head": [
          "机构",
          "文件",
          "版本 / 年份",
          "原件",
          "本台的用途"
        ],
        "rows": [
          [
            "国家卫生健康委",
            "原发性肝癌诊疗指南（2024 年版）",
            "2024 年版（国卫办医政函〔2024〕97 号，2024-03-21）",
            {
              "text": "已取得（官方 PDF，143 页；见转发页附件）",
              "url": "https://wsjkw.hebei.gov.cn/zcfg2/402819.jhtml"
            },
            "国内分期（CNLC）与治疗各论的出处；本台页码均按这份 PDF 的页脚编号"
          ],
          [
            "国家卫生健康委",
            "原发性肝癌诊疗指南（2022 年版）",
            "2022 年版（国卫办医函〔2022〕12 号，2022-01-10）",
            {
              "text": "已取得（官方 PDF，124 页；见转发页附件）",
              "url": "https://wsjkw.hebei.gov.cn/zcfg2/385518.jhtml"
            },
            "CNLC 2022 分期的原始出处；「三、分期」在 P22，分期图在 2022 版里是「图 3」"
          ],
          [
            "BCLC",
            "BCLC 2022 update（Reig 等，J Hepatol 2022;76(3):681-693）",
            "2022",
            {
              "text": "未取得原件，据 BCLC 官网",
              "url": "https://www.bclc.cat/default.php?q=professional-area%2Fmanagement-of-hcc.html&locale=en"
            },
            "记录医生写的 BCLC 期别（0 / A / B / C / D），不换算"
          ],
          [
            "AJCC / UICC",
            "AJCC Cancer Staging Manual, 8th ed.（肝细胞癌章节）",
            "第 8 版（2017）",
            {
              "text": "未取得原件，据 ACS/AJCC 官方页",
              "url": "https://www.facs.org/quality-programs/cancer-programs/american-joint-committee-on-cancer/cancer-staging-systems/cancer-staging-system-products/"
            },
            "记录 pTNM 原文；只有切除后才完整"
          ],
          [
            "NCCN",
            "NCCN Guidelines · Hepatobiliary Cancers",
            "版本以打开当日页面为准（2026-10-27 核对）",
            {
              "text": "未取得原件（需订阅），据指南页",
              "url": "https://www.nccn.org/guidelines/guidelines-detail?category=1&id=1438"
            },
            "仅作外部对照，不作为本台的分期或路径依据"
          ],
          [
            "CSCO",
            "CSCO 原发性肝癌诊疗指南 2024",
            "2024（ISBN 978-7-117-36792-9，2024-09-10）",
            {
              "text": "未取得原件，据人卫社书目页",
              "url": "https://www.pmphmall.com/gdsdetail/653497-332094"
            },
            "仅作外部对照；本台未采用其分级口径"
          ],
          [
            "WHO / IARC",
            "WHO Classification of Tumours · Digestive System Tumours, 5th ed.",
            "第 5 版（2019）",
            {
              "text": "未取得原件，据 IARC 出版页",
              "url": "https://publications.iarc.who.int/Book-And-Report-Series/Who-Classification-Of-Tumours/Digestive-System-Tumours-2019"
            },
            "病理分类名称的出处；本台不记录组织学分级判断"
          ]
        ]
      },
      "points": [
        "指南给的是「通常怎么做」，不是「你该怎么做」。版本号必须写清：同一份指南隔一年，条目会变。",
        "2024 年版指南的页码按本地这份 PDF 的页脚编号记（如「三、肝癌的分期」在 P32、「（五）系统治疗」在 P78），换版本后页码会变，届时重核。",
        "BCLC 与 CNLC 并存时不换算：两行并列，各自标出处，各自保留医生原话。任何「换算成另一套」的写法都会造出一个原文里没有的期别。",
        "国内分期与 TNM 也不换算。TNM 只有切除后的病理才完整，术前拿临床资料套 TNM 属于越界。"
      ],
      "sources": [
        {
          "org": "国家卫生健康委",
          "doc": "原发性肝癌诊疗指南（2024 年版）",
          "version": "2024 年版",
          "original": true,
          "url": "https://wsjkw.hebei.gov.cn/zcfg2/402819.jhtml",
          "page": "P1–P2（版本沿革）、P32（分期）",
          "note": "河北省卫健委转发页（原文通知与 PDF 附件）；NHC 官网自动化复验遇 412 限频"
        },
        {
          "org": "本项目",
          "doc": "docs/DISEASE-PRIMER.md（原件状态与待核项台账）",
          "version": "2026-10-27",
          "original": true,
          "nolink": true,
          "note": "本仓内部文件，无对外 URL；查核记录在仓内 git 历史"
        }
      ]
    },
    {
      "id": "landscape",
      "title": "目前治疗全景概要",
      "intro": "下面按可切除性与线序列出指南里出现过的手段类别。这是「世界上大致有哪些办法」的地图，不是给你排的先后顺序，也不含任何剂量、疗程与适用条件——那些必须由医生按你的肝功能与影像决定。",
      "groups": [
        {
          "label": "局限期（可切除时）",
          "points": [
            "手术切除：记录术式、切缘、病理（分化、MVI）与残肝比例；切缘按病理报告原文记 R0 / R1 / R2，本台不改写、不解读。",
            "消融（RFA / MWA）：记录次数与部位；适用于哪一类病灶由医生按影像判断。",
            "移植评估：本台只记录评估结论与评估日期，不做移植后管理，也不判断是否进入等待名单。"
          ]
        },
        {
          "label": "不可切除 / 局部晚期",
          "points": [
            "TACE / HAIC：记录次数、起止日期与栓塞后事件（发热、腹痛、恶心）。",
            "钇-90（TARE）与放疗：按方案原文记录，不把不同照射方式合并成一行。",
            "系统治疗：靶向、免疫、联合方案各自记录方案名、周期、疗效原文与肝毒性；本台不判断换药或停药。"
          ]
        },
        {
          "label": "贯穿全程的三件事",
          "points": [
            "转化治疗：intent 记为 conversion，每次可切除性评估新增一行，前后两次评估并列保存，不合并成「已转化」。",
            "抗病毒与再激活监测：HBV 背景者记录抗病毒药名与开始日期、DNA 由阴转阳的日期，与免疫/激素/化疗时间对齐。",
            "肝功能与门脉高压随访：白蛋白、胆红素、INR、血小板各自成线；食管胃底静脉曲张与腹水单独记录，不并入肿瘤负荷。"
          ]
        }
      ],
      "points": [
        "以上是文献与指南里列出的手段，按病期与线序排列，不代表任何一项适合你。选哪一个，这一句需要问你的医生。"
      ],
      "sources": [
        {
          "org": "国家卫生健康委",
          "doc": "原发性肝癌诊疗指南（2024 年版）· 治疗各论（一）外科治疗 / （二）消融治疗 / （三）经动脉介入治疗 / （四）放射治疗 / （五）系统治疗",
          "version": "2024 年版",
          "original": true,
          "url": "https://wsjkw.hebei.gov.cn/zcfg2/402819.jhtml",
          "page": "P36 / P54 / P61 / P72 / P78 起",
          "note": "河北省卫健委转发页（原文通知与 PDF 附件）；NHC 官网自动化复验遇 412 限频"
        },
        {
          "org": "BCLC",
          "doc": "BCLC 2022 update",
          "version": "2022",
          "original": false,
          "secondaryUrl": "https://www.bclc.cat/default.php?q=professional-area%2Fmanagement-of-hcc.html&locale=en",
          "page": "页码待核",
          "note": "仅用于对照分期与治疗策略的分组名称，未引用其条文"
        }
      ]
    },
    {
      "id": "trend",
      "title": "发展趋势",
      "intro": "这一段只写已经发生的事：哪份文件换了版本、哪一天发布、本项目核对到哪一步。不写预测，不做评价，也不给任何倾向。",
      "points": [
        "2017 年 6 月：原国家卫生和计划生育委员会医政医管局颁布《原发性肝癌诊疗规范（2017 年版）》；此后于 2019 年 12 月、2021 年 12 月两次更新，形成《原发性肝癌诊疗规范（2019 年版）》与《原发性肝癌诊疗指南（2022 年版）》（版本沿革见 2024 年版指南 P1–P2）。",
        "2022 年 1 月 10 日：国卫办医函〔2022〕12 号印发《原发性肝癌诊疗指南（2022 年版）》。",
        "2024 年 3 月 21 日：国卫办医政函〔2024〕97 号印发《原发性肝癌诊疗指南（2024 年版）》，为现行版本；本台已取得官方 PDF，共 143 页。",
        "2022 年：BCLC 发表 2022 版更新（Reig 等，J Hepatol 2022;76(3):681-693），为 BCLC 分期体系的现行版本记录。",
        "2019 年：WHO 消化系统肿瘤分类第 5 版出版（IARC），取代第 4 版（2010）。",
        "2024 年 9 月 10 日：CSCO《原发性肝癌诊疗指南 2024》出版（ISBN 978-7-117-36792-9）。",
        "本项目尚未完成临床试验登记平台的检索采集，暂无登记数量与阶段分布可报；补齐前不写任何数字。"
      ],
      "sources": [
        {
          "org": "国家卫生健康委",
          "doc": "原发性肝癌诊疗指南（2024 年版）· 一、概述（版本沿革）",
          "version": "2024 年版",
          "original": true,
          "url": "https://wsjkw.hebei.gov.cn/zcfg2/402819.jhtml",
          "page": "P1–P2",
          "note": "河北省卫健委转发页（原文通知与 PDF 附件）；NHC 官网自动化复验遇 412 限频"
        },
        {
          "org": "国家卫生健康委",
          "doc": "原发性肝癌诊疗指南（2022 年版）·「三、分期」（CNLC Ⅰa–Ⅳ，图 3）",
          "version": "2022 年版（国卫办医函〔2022〕12 号）",
          "original": true,
          "url": "https://wsjkw.hebei.gov.cn/zcfg2/385518.jhtml",
          "page": "P22",
          "note": "河北省卫健委转发页（原文通知与 PDF 附件）；NHC 官网自动化复验遇 412 限频"
        },
        {
          "org": "BCLC",
          "doc": "BCLC 2022 update",
          "version": "2022",
          "original": false,
          "secondaryUrl": "https://www.bclc.cat/default.php?q=professional-area%2Fmanagement-of-hcc.html&locale=en",
          "page": "页码待核"
        },
        {
          "org": "WHO / IARC",
          "doc": "WHO Classification of Tumours · Digestive System Tumours, 5th ed.",
          "version": "第 5 版（2019）",
          "original": false,
          "secondaryUrl": "https://publications.iarc.who.int/Book-And-Report-Series/Who-Classification-Of-Tumours/Digestive-System-Tumours-2019",
          "page": "出版页（年份以出版页为准）"
        },
        {
          "org": "CSCO",
          "doc": "CSCO 原发性肝癌诊疗指南 2024",
          "version": "2024（ISBN 978-7-117-36792-9）",
          "original": false,
          "secondaryUrl": "https://www.pmphmall.com/gdsdetail/653497-332094",
          "page": "书目页（出版日期 2024-09-10）"
        },
        {
          "org": "本项目",
          "doc": "docs/HCC-DOMAIN.md（分期体系与字段口径）",
          "version": "2026-10-22",
          "original": true,
          "nolink": true,
          "note": "本仓内部文件，无对外 URL"
        }
      ]
    }
  ]
}

    /* 36 号参考样式：starter assets/patterns/disease-primer.css 原版 + 本项目色板覆盖。
       颜色只走 --dp-* 令牌，不覆盖结构定义；字号一律 calc(NNpx * var(--tz))。 */
    const PRIMER_CSS = `
/* 36 号 · 疾病概要（「?」入口）参考样式
 * 只定义结构与密度；颜色一律走项目令牌，取不到就兜底（各项目命名不同：--violet / --brand / --accent）。
 * 字号一律 calc(NNpx * var(--tz, 1))，缺 --tz 时按 1 处理。
 */

:root{
  --dp-accent: var(--brand, var(--violet, var(--accent, #7B4C9A)));
  --dp-accent-deep: var(--brand-deep, var(--violet-deep, var(--accent-deep, #4A2D5C)));
  --dp-accent-soft: var(--brand-soft, var(--violet-soft, var(--accent-soft, #F3EEF8)));
  --dp-surface: var(--surface, #FFFFFF);
  --dp-page: var(--paper, var(--page-bg, #FAF9FB));
  --dp-ink: var(--ink, #2B2430);
  --dp-ink2: var(--ink-2, #4F4557);
  --dp-muted: var(--muted, #7C7286);
  --dp-line: var(--line, #E6E0EC);
  --dp-tz: var(--tz, 1);
  --dp-radius: 14px;
}

/* ---------- 触发按钮 ---------- */
.dp-trigger{
  min-width: 34px; min-height: 34px;
  padding: 0 9px;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: calc(14px * var(--dp-tz)); font-weight: 700; line-height: 1;
  color: var(--dp-accent-deep);
  background: var(--dp-accent-soft);
  border: 1px solid color-mix(in srgb, var(--dp-accent) 34%, transparent);
  border-radius: 999px;
  cursor: pointer;
}
.dp-trigger:hover{ background: color-mix(in srgb, var(--dp-accent) 16%, var(--dp-surface)); }
.dp-trigger:focus-visible{ outline: 3px solid var(--dp-accent-deep); outline-offset: 2px; }
.dp-trigger-float{ position: fixed; top: 12px; right: 12px; z-index: 55; }

/* ---------- 整页浮层 ---------- */
html.dp-lock, html.dp-lock body{ overflow: hidden; }

.dp-overlay{
  position: fixed; inset: 0; z-index: 60;
  display: flex;
  background: rgba(28, 20, 36, .34);
  background: var(--scrim, rgba(28, 20, 36, .34));
  -webkit-backdrop-filter: blur(2px); backdrop-filter: blur(2px);
  animation: dp-fade .18s ease-out both;
}
.dp-overlay[hidden]{ display: none !important; }

.dp-panel{
  position: absolute;
  inset: clamp(8px, 1.2vw, 16px);
  display: flex; flex-direction: column;
  min-width: 0; min-height: 0;
  background: var(--dp-page);
  border: 1px solid var(--dp-line);
  border-radius: var(--dp-radius);
  box-shadow: 0 18px 48px rgba(30, 20, 40, .22);
  overflow: hidden;
  animation: dp-rise .2s cubic-bezier(.22,.7,.24,1) both;
}
.dp-panel:focus{ outline: none; }

/* ---------- 顶栏 ---------- */
.dp-head{
  position: sticky; top: 0; z-index: 2;
  display: flex; align-items: center; gap: 10px;
  flex-shrink: 0; min-height: 56px;
  padding: 0 12px 0 8px;
  background: var(--dp-surface);
  border-bottom: 1px solid var(--dp-line);
}
.dp-head-title{ flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.dp-crumb{
  font-size: calc(11px * var(--dp-tz)); color: var(--dp-muted);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.dp-title{
  margin: 0; font-size: calc(15px * var(--dp-tz)); font-weight: 700; color: var(--dp-ink);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.dp-en{ font-weight: 500; font-size: calc(11.5px * var(--dp-tz)); color: var(--dp-muted); }

.dp-btn{
  display: inline-flex; align-items: center; gap: 4px;
  min-height: 36px; padding: 0 12px;
  font-size: calc(12.5px * var(--dp-tz));
  color: var(--dp-ink); background: var(--dp-surface);
  border: 1px solid var(--dp-line); border-radius: 9px;
  cursor: pointer; flex-shrink: 0;
}
.dp-btn:hover{ background: var(--dp-accent-soft); border-color: color-mix(in srgb, var(--dp-accent) 34%, transparent); }
.dp-btn:focus-visible{ outline: 3px solid var(--dp-accent-deep); outline-offset: 2px; }
.dp-close{ min-width: 36px; justify-content: center; padding: 0; }

/* ---------- 内容 ---------- */
.dp-body{
  flex: 1; min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding: 20px clamp(14px, 1.6vw, 28px) 56px;
}
.dp-inner{ max-width: 980px; margin: 0 auto; }

.dp-note{
  margin: 0 0 18px;
  padding: 11px 14px;
  font-size: calc(12.5px * var(--dp-tz)); line-height: 1.7;
  color: var(--dp-ink2);
  background: var(--dp-accent-soft);
  border-left: 3px solid var(--dp-accent);
  border-radius: 0 9px 9px 0;
}

.dp-section{
  padding: 16px 0 4px;
  border-top: 1px dashed var(--dp-line);
}
.dp-section:first-of-type{ border-top: 0; }
.dp-section h3{
  margin: 0 0 10px;
  font-size: calc(15.5px * var(--dp-tz)); font-weight: 700; color: var(--dp-ink);
  display: flex; align-items: baseline; gap: 8px;
}
.dp-section h3::before{
  content: ""; width: 4px; height: 15px; border-radius: 2px;
  background: var(--dp-accent); flex-shrink: 0;
}

.dp-lead{
  margin: 0 0 10px;
  font-size: calc(13px * var(--dp-tz)); line-height: 1.78; color: var(--dp-ink2);
  /* 36 号 §4.3：正文块不设 max-width——右边界与表格/小标题一致，段落换行点才一致。
     曾用 68ch（≈557px），表格却吃满容器，视觉上"左边对齐、右边参差"（P9 断言）。 */
}
.dp-empty{ color: var(--dp-muted); font-style: normal; }

.dp-group{ margin: 0 0 12px; }
.dp-group h4{
  margin: 0 0 5px;
  font-size: calc(12.5px * var(--dp-tz)); font-weight: 700; color: var(--dp-accent-deep);
}
/* 36 号 §4.3：分组内列表同为块级零内边距，只留 li 的符号缩进 */
.dp-group .dp-points{ margin-bottom: 6px; }

/* 36 号 §4.3：列表块左内边距归零，符号缩进放 li——ul 盒右边界与正文/表格一致 */
.dp-points{ margin: 0 0 10px; padding-left: 0; list-style: none; }
.dp-points li{ position: relative; padding-left: 18px; }
.dp-points li::before{
  content: ""; position: absolute; left: 6px; top: .72em;
  width: 5px; height: 5px; border-radius: 50%; background: var(--dp-muted, #7A7186);
}
.dp-points li{
  font-size: calc(12.8px * var(--dp-tz)); line-height: 1.75; color: var(--dp-ink2);
  margin-bottom: 5px;
  /* 同上：列表项与正文同宽 */
}

.dp-table-wrap{ overflow-x: auto; margin: 0 0 12px; }
/* 36 号 §4.3：窄容器下表格横向滚动，不压缩列宽导致逐字换行 */
.dp-table{ min-width: 640px; }
.dp-table{
  border-collapse: collapse; width: 100%;
  font-size: calc(12.2px * var(--dp-tz));
  background: var(--dp-surface);
  border: 1px solid var(--dp-line); border-radius: 9px;
}
.dp-table th, .dp-table td{
  padding: 7px 10px; text-align: left;
  border-bottom: 1px solid var(--dp-line);
  vertical-align: top; line-height: 1.6;
}
.dp-table th{
  background: var(--dp-accent-soft); color: var(--dp-accent-deep);
  font-weight: 700; white-space: nowrap;
}
.dp-table tr:last-child td{ border-bottom: 0; }

.dp-src{
  margin: 10px 0 0;
  font-size: calc(11px * var(--dp-tz)); line-height: 1.65;
  color: var(--dp-muted);
}
.dp-src b{ color: var(--dp-ink2); margin-right: 6px; }
.dp-src-missing{ color: var(--danger, #A3241B); }

.dp-foot{
  margin: 22px 0 0; padding-top: 14px;
  border-top: 1px solid var(--dp-line);
  font-size: calc(11.5px * var(--dp-tz)); line-height: 1.7; color: var(--dp-muted);
}

@keyframes dp-fade{ from{ opacity: 0 } to{ opacity: 1 } }
@keyframes dp-rise{ from{ opacity: 0; transform: translateY(6px) scale(.995) } to{ opacity: 1; transform: none } }

/* ---------- 窄屏 ---------- */
@media (max-width: 760px){
  .dp-panel{ inset: 0; border-radius: 0; border: 0; }
  .dp-head{ min-height: 52px; }
  .dp-back span{ display: none; }
  .dp-body{ padding: 16px 14px 44px; }
}

@media (prefers-reduced-motion: reduce){
  .dp-overlay, .dp-panel{ animation: none; }
}

/* 36 号 §2.5：指南原件/二次来源链接（可点开或下载） */
.dp-link { color: inherit; font-weight: 600; text-decoration: underline; text-underline-offset: 3px; }
.dp-link:hover { text-decoration-thickness: 2px; }
.dp-miss { color: #b3372e; font-weight: 600; }
/* ---------- 36 号 v2 色板：primer.css 的 --dp-* 令牌映射到本项目陶土色系 ---------- */
.wb-liver-cancer-workbench{
  --dp-accent: var(--wb-clay, #9c5a3c);
  --dp-accent-deep: var(--wb-clay-deep, #6e4a0e);
  --dp-accent-soft: var(--wb-paper, #faf8f3);
  --dp-surface: var(--wb-surface, #fff);
  --dp-page: var(--wb-paper, #faf8f3);
  --dp-ink: var(--wb-ink, #2b2118);
  --dp-ink2: var(--wb-ink, #3f3227);
  --dp-muted: var(--wb-muted, #8a7768);
  --dp-line: var(--wb-line, #e6ddd2);
}
/* 骨架里标题与英文名之间靠 HTML 空格分隔；React 版没有那个空格，这里补间距。 */
.wb-liver-cancer-workbench .dp-title .dp-en{ margin-left:8px; }
/* 顶栏「?」：与相邻按钮同高，圆形，只靠笔画粗细区分 */
.wb-liver-cancer-workbench .wb-primer-trigger{
  min-width:30px; padding:5px 0; display:inline-flex; align-items:center; justify-content:center;
  font-weight:700; font-size:calc(13px * var(--tz)); line-height:1;
}

/* ---------- 看板首卡（36 号 §2.6）：卡头 / 大字天数 / 现状行 / 出口按钮排 ----------
   flex:0 0 auto 是必须的：.wb-body 是 flex column，本卡带 overflow:hidden，
   flex 子项 min-height:auto 在 overflow 非 visible 时不生效，不加这一行会被压成一行高。 */
.wb-liver-cancer-workbench .sc-card{
  position:relative; display:grid; grid-template-columns:minmax(150px, auto) minmax(0, 1fr);
  flex:0 0 auto; gap:14px 26px; align-items:start; padding:20px 22px;
  background:var(--wb-surface, #fff); border:1px solid var(--wb-line, #e6ddd2);
  border-radius:var(--wb-radius, 14px); box-shadow:0 8px 24px #6e4a0e12; overflow:hidden;
}
.wb-liver-cancer-workbench .sc-card::before{
  content:""; position:absolute; inset:0 auto 0 0; width:4px;
  background:linear-gradient(180deg, var(--wb-clay, #9c5a3c), var(--wb-paper, #faf8f3));
}
.wb-liver-cancer-workbench .sc-head{ grid-column:1 / -1; display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.wb-liver-cancer-workbench .sc-eyebrow{
  font-size:calc(11px * var(--tz)); font-weight:700; letter-spacing:.06em;
  color:var(--wb-clay-deep, #6e4a0e); background:var(--wb-paper, #faf8f3);
  border-radius:999px; padding:3px 10px;
}
.wb-liver-cancer-workbench .sc-anchor{ font-size:calc(11.5px * var(--tz)); color:var(--wb-muted, #8a7768); }
.wb-liver-cancer-workbench .sc-day{ display:flex; flex-direction:column; gap:2px; min-width:0; }
.wb-liver-cancer-workbench .sc-day b{
  font-size:calc(28px * var(--tz)); line-height:1.15; font-weight:700;
  color:var(--wb-clay-deep, #6e4a0e); font-variant-numeric:tabular-nums;
}
.wb-liver-cancer-workbench .sc-day .sc-muted{ font-size:calc(11.5px * var(--tz)); color:var(--wb-muted, #8a7768); }
.wb-liver-cancer-workbench .sc-now{ display:grid; gap:5px; min-width:0; justify-items:start; align-content:start; }
.wb-liver-cancer-workbench .sc-stage{ display:flex; align-items:baseline; gap:8px; flex-wrap:wrap; }
.wb-liver-cancer-workbench .sc-stage b{ font-size:calc(15px * var(--tz)); font-weight:650; color:var(--wb-ink, #2b2118); }
.wb-liver-cancer-workbench .sc-next{ font-size:calc(12.5px * var(--tz)); line-height:1.6; color:var(--wb-ink, #3f3227); overflow-wrap:anywhere; }
.wb-liver-cancer-workbench .sc-next b{ font-variant-numeric:tabular-nums; }
.wb-liver-cancer-workbench .sc-actions{
  grid-column:1 / -1; display:flex; gap:10px; flex-wrap:wrap; align-items:center;
  padding-top:10px; border-top:1px dashed var(--wb-line, #e6ddd2);
}
.wb-liver-cancer-workbench .sc-actions .sc-hint{ font-size:calc(11px * var(--tz)); color:var(--wb-muted, #8a7768); margin-left:auto; }
.wb-liver-cancer-workbench .sc-card.sc-empty .sc-day b{ font-size:calc(18px * var(--tz)); color:var(--wb-muted, #8a7768); }
.wb-liver-cancer-workbench .sc-card.sc-empty::before{ background:var(--wb-line, #e6ddd2); }

@container (max-width: 720px){
  .wb-liver-cancer-workbench .sc-card{ grid-template-columns:minmax(0, 1fr); padding:16px; }
  .wb-liver-cancer-workbench .sc-actions .sc-hint{ margin-left:0; }
}

`

    // 样式表挂在 document.head，而不是渲染进组件树：customFrame 要求根节点首个子元素是
    // 语义 <header>，任何 <style>/包裹层挡在前面都会被宿主判成结构不合规。
    const STYLE_ID = 'ganbao-heppal-theme'
    function ensureStyle() {
      if (typeof document === 'undefined' || !document.head) return
      if (document.getElementById(STYLE_ID)) return
      const el = document.createElement('style')
      el.id = STYLE_ID
      el.textContent = theme + PRIMER_CSS
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

    /* ---------------- 病情一图秀 ----------------
       家族统一画布（与结肠 v0.2 / 卵巢同一组常量、同一套单调插值），跨病种看起来是一张图。
       口径三条：①每条线按自身全期 min–max 归一化，纵向位置不能跨条比绝对值；
                ②缺测不补 0、不插空值，只连真实采样点；
                ③治疗条画在数据区下方，事件不是数据点。 */
    // CX1 留出右侧 82px 的标签栏：末点数值写在数据区外面，不压在折线上
    const OP_W = 980, OP_H = 420, OP_X0 = 62, OP_X1 = 898, OP_Y0 = 66, OP_Y1 = 366
    const OP_COLORS = ['#2f6f66', '#c2703d', '#7d4327', '#8a5a0c']
    const OP_RANGES = [['3', '近 3 月'], ['6', '近 6 月'], ['12', '近 12 月'], ['all', '全期']]
    const opDay = (s) => { const p = String(s).split('-').map(Number); return Date.UTC(p[0], (p[1] || 1) - 1, p[2] || 1) }
    const opMonth = (ms) => `${new Date(ms).getUTCMonth() + 1} 月`

    /** 指标属于哪一组：与「指标分析」用同一套分组，切视图不会两边说法不一致 */
    function groupOf(m) {
      return GROUPS.find((g) => (g.ids
        ? g.ids.includes(m.id)
        : m.track === g.track && !CBC_IDS.concat('platelets').includes(m.id))) || null
    }

    function ViewOnePage({ metrics, events }) {
      const numeric = metrics.filter((m) => m.kind !== 'grade' && m.points.length)
      const [pick, setPick] = React.useState(() => {
        const fav = ['albumin', 'bilirubin', 'afp', 'max_diameter'].filter((id) => numeric.some((m) => m.id === id))
        return (fav.length ? fav : numeric.slice(0, 4).map((m) => m.id)).slice(0, 4)
      })
      const [range, setRange] = React.useState('all')
      const [zoom, setZoom] = React.useState(100)
      const [showTx, setShowTx] = React.useState(true)
      const [showEnd, setShowEnd] = React.useState(true)
      const [pin, setPin] = React.useState(null)

      // 至少留一条：全部取消会让画布变空白，用户会以为坏了
      const toggle = (id) => {
        setPin(null)
        setPick((prev) => {
          if (prev.includes(id)) return prev.length > 1 ? prev.filter((x) => x !== id) : prev
          return prev.length >= 4 ? prev : [...prev, id]
        })
      }

      const cats = GROUPS
        .map((g) => ({ name: g.name, items: numeric.filter((m) => groupOf(m) === g) }))
        .filter((c) => c.items.length)
      const sel = pick.map((id) => numeric.find((m) => m.id === id)).filter(Boolean)
      const series = sel.map((m, i) => ({
        m, color: OP_COLORS[i % OP_COLORS.length],
        pts: m.points.map((p) => ({ d: p.d, v: p.v, t: opDay(p.d) })),
      }))
      const allPts = series.flatMap((s) => s.pts)
      const hasLine = allPts.length > 0

      let tFirst = 0, tLast = 0, t0 = 0
      if (hasLine) {
        tLast = Math.max(...allPts.map((p) => p.t))
        tFirst = Math.min(...allPts.map((p) => p.t))
        if (range !== 'all') {
          const d = new Date(tLast)
          d.setUTCMonth(d.getUTCMonth() - Number(range))
          tFirst = Math.max(tFirst, d.getTime())
        }
        // 右端锚定最新记录：缩放是把左边界往里推，最近的日期永远在右边
        const span = Math.max(tLast - tFirst, 86400000 * 10)
        t0 = tLast - span * (zoom / 100)
      }
      const xOf = (t) => (tLast === t0 ? OP_X0 : OP_X0 + ((t - t0) / (tLast - t0)) * (OP_X1 - OP_X0))
      const yOf = (s, v) => {
        const vs = s.pts.map((p) => p.v)
        const lo = Math.min(...vs), hi = Math.max(...vs)
        if (hi === lo) return (OP_Y0 + OP_Y1) / 2
        return OP_Y1 - ((v - lo) / (hi - lo)) * (OP_Y1 - OP_Y0)
      }

      const grid = [0, 1, 2, 3, 4].map((i) => {
        const y = OP_Y0 + ((OP_Y1 - OP_Y0) / 4) * i
        return h('line', {
          key: `g${i}`, x1: OP_X0, y1: y, x2: OP_X1, y2: y,
          stroke: 'var(--wb-line)', strokeWidth: 1, opacity: i === 4 ? 1 : 0.5,
        })
      })

      const ticks = []
      if (hasLine) {
        const start = new Date(t0)
        const months = []
        let cur = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1)
        while (cur <= tLast) {
          months.push(cur)
          const d = new Date(cur)
          cur = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)
        }
        const step = Math.max(1, Math.ceil(months.length / 9))
        months.forEach((t, i) => { if (i % step === 0 && t >= t0) ticks.push({ t, x: xOf(t) }) })
      }

      const bands = []
      if (hasLine && showTx) {
        (events || []).forEach((ev) => {
          if (!ev.startedOn) return
          const s = opDay(ev.startedOn)
          // 没写结束日不等于当天结束：按 3 周一个周期示意，并在文案里说明是示意
          const e = ev.endedOn ? opDay(ev.endedOn) : Math.min(tLast, s + 86400000 * 21)
          if (e < t0 || s > tLast) return
          const x1 = xOf(Math.max(s, t0))
          const x2 = Math.max(xOf(Math.min(e, tLast)), x1 + 3)
          bands.push({ key: ev.id, x1, x2, label: ev.regimen || LBL.modality[ev.modality] || '治疗' })
        })
      }

      const drawn = series.map((s) => {
        const win = s.pts.filter((p) => p.t >= t0)
        const xy = win.map((p) => [Number(xOf(p.t).toFixed(1)), Number(yOf(s, p.v).toFixed(1))])
        return { s, win, xy }
      })

      // 末点标签：按 y 排，从下往上让位（最小间距 13px），整列上移保证不出画布顶边
      const ends = drawn.filter((d) => d.xy.length)
        .map((d) => ({
          s: d.s, x: d.xy[d.xy.length - 1][0], y: d.xy[d.xy.length - 1][1],
          v: d.win[d.win.length - 1].v,
        }))
        .sort((a, b) => a.y - b.y)
      let prevLabelY = Infinity
      for (let i = ends.length - 1; i >= 0; i--) {
        ends[i].ly = Math.min(ends[i].y, prevLabelY - 13)
        prevLabelY = ends[i].ly
      }
      if (ends.length) {
        const lift = OP_Y0 - ends[0].ly
        if (lift > 0) ends.forEach((e) => { e.ly += lift })
      }

      const chart = hasLine ? h('svg', {
        viewBox: `0 0 ${OP_W} ${OP_H}`, role: 'img',
        'aria-label': `一图秀：${sel.map((m) => m.label).join('、')}，共 ${allPts.length} 个记录点`,
      },
        grid,
        ticks.map((t, i) => h('g', { key: `t${i}` },
          h('line', { x1: t.x, y1: OP_Y0, x2: t.x, y2: OP_Y1, stroke: 'var(--wb-line)', strokeWidth: 1, opacity: 0.4 }),
          h('text', { x: t.x, y: OP_Y1 + 12, fontSize: 9, fill: 'var(--wb-muted)', textAnchor: 'middle' }, opMonth(t.t)))),
        bands.length ? h('g', null, bands.map((b) => {
          // 太窄的条不写字：宁可只剩一条色带，也不要挤成"TA"这种看不懂的残句
          const maxChars = Math.floor((b.x2 - b.x1) / 13)
          return h('g', { key: `b${b.key}` },
            h('line', { x1: b.x1, y1: OP_Y0, x2: b.x1, y2: OP_Y1 + 18, stroke: '#e6cbb9', strokeWidth: 1, strokeDasharray: '3 3' }),
            h('rect', { x: b.x1, y: OP_Y1 + 18, width: b.x2 - b.x1, height: 26, rx: 6, fill: '#f3e3d8', stroke: '#e6cbb9' }),
            maxChars >= 3
              ? h('text', {
                x: (b.x1 + b.x2) / 2, y: OP_Y1 + 35, fontSize: 9.5, fill: 'var(--wb-clay-deep)',
                textAnchor: 'middle',
              }, b.label.slice(0, maxChars))
              : null)
        })) : null,
        drawn.map((d) => (d.xy.length > 1 ? h('path', {
          key: `p${d.s.m.id}`, d: monotonePath(d.xy), fill: 'none', stroke: d.s.color,
          strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round',
        }) : null)),
        drawn.map((d) => d.xy.map((q, i) => h('g', {
          key: `c${d.s.m.id}${i}`, className: 'wb-op-hit',
          onClick: () => setPin({ id: d.s.m.id, d: d.win[i].d, v: d.win[i].v }),
        },
          h('circle', { cx: q[0], cy: q[1], r: 9, fill: 'transparent' }),
          h('circle', { cx: q[0], cy: q[1], r: 3.2, fill: '#fff', stroke: d.s.color, strokeWidth: 1.8 })))),
        showEnd ? ends.map((e) => h('g', { key: `e${e.s.m.id}` },
          h('line', { x1: e.x, y1: e.y, x2: OP_X1 + 3, y2: e.ly, stroke: e.s.color, strokeWidth: 1, opacity: 0.4 }),
          h('text', {
            x: OP_X1 + 8, y: e.ly + 3.5, fontSize: 10.5, fontWeight: 600, fill: e.s.color,
          }, e.v.toFixed(e.s.m.decimals)))) : null,
        h('text', { x: OP_X0, y: OP_Y0 - 10, fontSize: 9.5, fill: 'var(--wb-muted)' },
          '纵向：每条按自身全期最小–最大归一化，不跨条比高低')) : h('div', { className: 'wb-empty' },
        '选中的指标还没有记录点。换几条试试，或先导入化验单。')

      const pinMetric = pin ? numeric.find((m) => m.id === pin.id) : null
      const pinIndex = pinMetric ? pinMetric.points.findIndex((p) => p.d === pin.d) : -1
      const pinPrev = pinIndex > 0 ? pinMetric.points[pinIndex - 1] : null
      const unitOf = (m) => (m.unit ? ' ' + m.unit : '')

      const rail = h('aside', { className: 'wb-op-rail', 'aria-label': '一图秀的选择' },
        h('div', { className: 'wb-op-sect' }, '时间范围'),
        h('div', { className: 'wb-op-chips' }, OP_RANGES.map(([k, label]) => h('button', {
          key: k, type: 'button', 'aria-pressed': range === k, onClick: () => setRange(k),
        }, label))),
        h('label', { className: 'wb-op-slider' }, '缩放',
          h('input', {
            type: 'range', min: 25, max: 100, step: 5, value: zoom, 'aria-label': '时间窗缩放',
            onChange: (e) => setZoom(Number(e.target.value)),
          }), `${zoom}%`),
        h('label', { className: 'wb-op-toggle' },
          h('input', { type: 'checkbox', checked: showTx, onChange: (e) => setShowTx(e.target.checked) }), '显示治疗节点'),
        h('label', { className: 'wb-op-toggle' },
          h('input', { type: 'checkbox', checked: showEnd, onChange: (e) => setShowEnd(e.target.checked) }), '显示末点数值'),
        h('div', { className: 'wb-op-sect' }, `选指标（最多 4 条，已选 ${pick.length}）`),
        h('div', { className: 'wb-op-groups' }, cats.map((c) => h('div', { key: c.name, className: 'wb-op-group' },
          h('b', null, c.name),
          c.items.map((m) => {
            const on = pick.includes(m.id)
            return h('button', {
              key: m.id, type: 'button', role: 'checkbox', 'aria-checked': on, className: 'wb-op-item',
              onClick: () => toggle(m.id), title: `${m.label} · ${m.count} 次记录`,
            },
              h('i', {
                'aria-hidden': 'true',
                style: { background: on ? OP_COLORS[pick.indexOf(m.id) % OP_COLORS.length] : 'transparent' },
              }),
              h('span', null, m.label),
              h('em', null, fmt(m)))
          })))))

      return h('div', { className: 'wb-onepage' }, rail,
        h('div', { className: 'wb-op-stage' },
          h('div', null,
            h('h1', null, '病情一图秀'),
            h('p', { className: 'wb-lead' }, '把几条关键线放在同一根时间轴上，先看拐点与先后顺序，再回各自的卡片核数值。',
              h('strong', null, '纵向高度只对同一条线有意义。'))),
          h('div', { className: 'wb-op-canvas' }, chart),
          h('div', { className: 'wb-op-legend' }, sel.map((m, i) => h('span', { key: m.id },
            h('i', { style: { background: OP_COLORS[i % OP_COLORS.length] } }),
            `${m.label}${m.unit ? '（' + m.unit + '）' : ''}`))),
          pin && pinMetric
            ? h('div', { className: 'wb-op-detail', role: 'status' },
              h('span', null, pinMetric.label,
                h('b', null, `${pin.v.toFixed(pinMetric.decimals)}${unitOf(pinMetric)}`)),
              h('span', null, dayText(pin.d)),
              h('span', null, pinPrev
                ? `前一次 ${pinPrev.v.toFixed(pinMetric.decimals)}${unitOf(pinMetric)}（${dayText(pinPrev.d)}）`
                : '这是这条指标最早的一次记录'),
              NOTES[pinMetric.id] ? h('span', null, NOTES[pinMetric.id]) : null,
              h('button', { type: 'button', className: 'wb-chip', onClick: () => setPin(null) }, '取消固定'))
            : h('div', { className: 'wb-notice' }, '点任意一个记录点，可以把那一次的日期与数值固定在下面。'),
          h('div', { className: 'wb-notice' },
            '治疗条只标出记录过的治疗与时间（没写结束日的按 3 周示意），不代表疗效；缺测不补 0、不插空值；一图秀回答"什么时候变了"，不回答"该不该换治疗"。')))
    }

    const VIEWS = [
      ['dash', '看板'], ['onepage', '一图秀'], ['metrics', '指标分析'], ['liver', '我的肝'], ['tumor', '我的瘤'],
      ['tx', '治疗与转化'], ['safety', '安全线'], ['nutrition', '营养与体重'],
      ['mind', '心理与家庭'], ['followup', '复诊与回顾'], ['import', '导入与候选'],
      ['settings', '设置'],
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

    function ViewImport({ docs, cands, activeId, busy, err, onOpen, onAccept, onReject,
      onParse, parsing, parseNote, canParse, onGoSettings, onAskAgent }) {
      const active = docs.find((x) => x.id === activeId)
      return h('div', { className: 'wb-stack' },
        h('div', null,
          h('h1', null, '导入与候选'),
          h('p', { className: 'wb-lead' }, '一份材料先进队列，判完是不是肝的报告，再从里面抽候选。',
            h('strong', null, '机器抽出来的都只是候选，点了确认才进趋势。'))),
        h('div', { className: 'wb-notice' },
          '顺序是固定的：嗅探 → 取行 → 判病种 → 抽候选 → 落库。判病种必须在抽候选之前——料不对，读得再准也没用。'),
        err ? h('p', { role: 'status', className: 'wb-empty' }, err) : null,
        parseNote ? h('div', { className: 'wb-notice', role: 'status', 'data-tone': 'info' },
          h('b', null, parseNote),
          // Token 故障要三个动作，不是一句报错：这里是"改哪里"的入口
          parseNote.includes('mineru.net/apiManage/token')
            ? h('div', { className: 'wb-token-actions' },
              h('a', { href: 'https://mineru.net/apiManage/token', target: '_blank', rel: 'noreferrer' }, '① 申请 / 重置 Token'),
              h('button', { type: 'button', className: 'wb-link', onClick: onGoSettings }, '② 去设置里填新 Token'),
              h('button', { type: 'button', className: 'wb-link', onClick: onAskAgent }, '③ 让 Agent 提醒我怎么更新'))
            : null,
          h('span', { className: 'wb-hint' },
            '原件完好保存在本机，已确认的指标不受影响；这只是解析这一条路走不通，不是病情有变化。')) : null,
        h('div', { className: 'wb-two' },
          h(Block, { title: '导入队列', hint: `${docs.length} 份` },
            docs.length
              ? h('div', null, docs.map((doc) => {
                const st = DOC_STATUS[doc.status] || { text: doc.status, cls: '' }
                // 待解析 / 解析失败才有「解析」：已经出过候选的再点会把待确认的候选清空，不能给这个入口
                const resolvable = doc.status === 'pending_parse' || doc.status === 'parse_failed'
                return h('div', { key: doc.id, className: 'wb-qrow-wrap' },
                  h('button', {
                    type: 'button', className: 'wb-qrow', 'aria-current': doc.id === activeId,
                    onClick: () => onOpen(doc.id),
                  },
                    h('span', { className: 'qmain' },
                      h('b', null, doc.title),
                      h('span', null, `${dt(doc.docDate)} · ${doc.candidates.total} 条候选${doc.candidates.pending ? ` · ${doc.candidates.pending} 条待确认` : ''}`),
                      doc.parseNote ? h('span', { className: 'csrc' }, doc.parseNote) : null),
                    h('span', { className: `wb-st ${st.cls}` }, st.text)),
                  resolvable && canParse && h('button', {
                    type: 'button', className: 'wb-btn wb-qparse',
                    disabled: parsing === doc.id,
                    onClick: () => onParse(doc.id),
                    title: '原件会上传到 mineru.net；不点就不会上传',
                  }, parsing === doc.id ? '解析中…' : doc.status === 'parse_failed' ? '重试解析' : '解析'))
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

    /* ---------------- 设置：目录 / 解析 Token / 字号 ----------------
       设置页只做三件事，且每件都如实回显"当前生效的是哪一个"：
         1. 资料目录（只读展示，不在面板里改——换目录会影响会话 folder，属宿主侧动作）；
         2. MinerU Token（GET 状态 / POST 存 / POST 清，原文永不回显，只给掩码与文件路径）；
         3. 字号三档（与顶栏 chip 同一个值）。
       没做的能力如实写成"未做"，不摆一个点了没反应的入口。 */
    function ViewSettings({ health, mineru, tz, busy, err, note, tokenDraft, onToken, onTz, onSave, onClear, onGoImport }) {
      const src = mineru && mineru.source
      const tone = mineru?.error ? 'error' : src === 'file' ? 'ok' : src === 'env' ? 'warn' : 'idle'
      return h('div', { className: 'wb-stack' },
        h('div', null,
          h('h1', null, '设置'),
          h('p', { className: 'wb-lead' }, '这里只放三类配置：资料在哪、解析服务用哪把钥匙、字多大。',
            h('strong', null, '它们都不影响已经记录的指标。'))),

        // —— 资料目录 ——
        h(Block, { title: '资料目录', hint: '本机路径' },
          h('div', { className: 'wb-set-row' },
            h('div', { className: 'wb-set-main' },
              h('b', null, health?.dir || '（服务没有下发目录）'),
              h('span', null, health?.dir
                ? '这个目录同时用于：调起 AI 会话时的业务文件夹、导入时读取原件。'
                : '没有目录时，AI 对话按钮会直接说清缺什么，不会静默失败。')),
            h('span', { className: 'wb-st ' + (health?.dir ? 'ok' : 'wait') }, health?.dir ? '就绪' : '未就绪')),
          h('p', { className: 'wb-hint' },
            '换目录要连同宿主会话一起换，所以这里只显示不修改；换目录请从 Desktop 的工作台设置里做。')),

        // —— 解析 Token ——
        h(Block, { title: '扫描件解析（MinerU）', hint: mineru ? (src === 'none' ? '未配置' : '已配置') : '读取中…' },
          h('div', { className: 'wb-set-row' },
            h('div', { className: 'wb-set-main' },
              h('b', { 'data-tone': tone }, mineru?.sourceLabel || '正在读取状态…'),
              mineru?.file ? h('span', null, `密钥文件：${mineru.file}${mineru.permissions ? ` · 权限 ${mineru.permissions}` : ''}${mineru.fileExists ? '' : '（文件还不存在）'}`) : null,
              mineru?.error ? h('span', { role: 'alert' }, mineru.error) : null,
              mineru?.envPresent && src !== 'env'
                ? h('span', null, '环境变量里还有一把 Token：文件里这把优先，但清除后它会接管。')
                : null)),
          h('div', { className: 'wb-set-form' },
            h('input', {
              type: 'password', autoComplete: 'new-password', spellCheck: false,
              className: 'wb-input', placeholder: '粘贴 sk- 开头的 Token（不会显示明文）',
              value: tokenDraft, onChange: (e) => onToken(e.target.value),
              'aria-label': 'MinerU Token',
            }),
            h('button', {
              type: 'button', className: 'wb-btn primary', disabled: busy || !tokenDraft.trim(),
              onClick: onSave,
            }, busy ? '保存中…' : '保存'),
            h('button', {
              type: 'button', className: 'wb-btn', disabled: busy || !mineru?.fileExists,
              onClick: onClear,
            }, '清除')),
          note ? h('p', { role: 'status', className: 'wb-set-note' }, note) : null,
          err ? h('p', { role: 'alert', className: 'wb-set-note', 'data-tone': 'error' }, err) : null,
          h('p', { className: 'wb-hint' },
            '申请或重置 Token：',
            h('a', { href: mineru?.tokenUrl || 'https://mineru.net/apiManage/token', target: '_blank', rel: 'noreferrer' }, mineru?.tokenUrl || 'https://mineru.net/apiManage/token'),
            '。Token 只保存在本机这个文件里（权限 600），不会进日志、不会回给界面。'),
          h('div', { className: 'wb-notice' },
            '用云端解析意味着：原件会上传到 mineru.net，且必须由你点「解析」才发，工作台不自动上传；离线时这条路不可用。',
            h('br'),
            'TXT / MD / CSV 不走云端，在本机直接读；HTML 不在白名单里（接口明确拒收），请导出成 PDF 再传。')),

        // —— 字号 ——
        h(Block, { title: '字号', hint: `当前 ${tzLabel(tz)}` },
          h('div', { className: 'wb-set-tiers', role: 'radiogroup', 'aria-label': '字号档位' },
            TZ_TIERS.map((t) => h('button', {
              key: t.id, type: 'button', role: 'radio', 'aria-checked': tz === t.id,
              className: 'wb-tier', onClick: () => onTz(t.id),
            }, h('b', null, t.label), h('span', null, t.note)))),
          h('p', { className: 'wb-hint' },
            '三档乘在同一个变量上（1 / 1.15 / 1.32），所以每一处文字都跟着变；顶栏那个 chip 点一下也是换这一档。')),

        // —— 边界 ——
        h(Block, { title: '还没做的', hint: '如实写在这里' },
          h('div', { className: 'wb-set-row' },
            h('div', { className: 'wb-set-main' },
              h('b', null, '多档案切换、报告导出、参考数据包管理'),
              h('span', null, '这些还没有实现，所以设置里也没有入口——不摆一个点了没反应的开关。'))),
          h('p', { className: 'wb-hint' },
            '导入材料与查看候选在 ',
            h('button', { type: 'button', className: 'wb-link', onClick: onGoImport }, '导入与候选'),
            ' 里。')))
    }

    /* 36 号 v2 · 疾病概要（整页视图）。
       三层信息边界：本段只做「解释」——定义、文件、指南列举过的手段、已发生的事实；
       任何与你有关的判断固定出口为「这一句需要问你的医生」。 */
    const primerSections = Array.isArray(PRIMER_DATA?.sections) ? PRIMER_DATA.sections : []
    const primerHref = (value) => {
      const text = typeof value === 'string' ? value.trim() : ''
      return /^https:\/\//i.test(text) ? text : ''
    }
    const primerLink = (url, label, extra) => h('a', { className: 'dp-link', href: url, target: '_blank', rel: 'noopener noreferrer', ...extra }, label)
    /* §2.5：原件列必须可点；没链接就红标指出违规，不编 URL。 */
    const primerSourceLine = (source, key) => {
      if (!source) return null
      const head = [source.org, source.doc].filter(Boolean).join(' · ')
      const tail = []
      if (source.version) tail.push(source.version)
      const url = primerHref(source.url)
      const secondary = primerHref(source.secondaryUrl)
      if (!source.nolink) {
        if (source.original) {
          tail.push(url
            ? primerLink(url, '原件已取得 · 打开/下载 ↗')
            : h('span', { className: 'dp-miss' }, '原件已取得（缺链接，违反 36 号 §2.5）'))
        } else {
          tail.push(secondary
            ? primerLink(secondary, '未取得原件，据二次来源 ↗')
            : h('span', { className: 'dp-miss' }, '未取得原件，据二次来源（缺二次链接，违反 36 号 §2.5）'))
        }
      }
      if (source.page) tail.push('页码 ' + source.page)
      if (source.note) tail.push(source.note)
      return h('span', { key, className: 'dp-src-item' }, head,
        tail.length ? '（' : '',
        ...tail.flatMap((piece, index) => (index ? [' · ', piece] : [piece])),
        tail.length ? '）' : '')
    }
    const primerPoints = (list, key) => (Array.isArray(list) && list.length
      ? h('ul', { className: 'dp-points', key }, list.map((text, index) => h('li', { key: index }, text)))
      : null)
    const primerCell = (cell, key) => {
      if (cell && typeof cell === 'object' && !Array.isArray(cell)) {
        const url = primerHref(cell.url)
        const text = cell.text == null ? '' : String(cell.text)
        if (url) return h('td', { key }, primerLink(url, text + ' ↗'))
        return h('td', { key }, text, cell.url ? h('span', { className: 'dp-miss' }, '（缺 https 链接，违反 36 号 §2.5）') : null)
      }
      return h('td', { key }, cell == null ? '' : String(cell))
    }
    const primerTable = (table) => {
      if (!table || !Array.isArray(table.rows) || !table.rows.length) return null
      return h('div', { className: 'dp-table-wrap', key: 'table' },
        h('table', { className: 'dp-table' },
          h('thead', null, h('tr', null, (table.head || []).map((cell, index) => h('th', { key: index }, cell)))),
          h('tbody', null, table.rows.map((row, rowIndex) => h('tr', { key: rowIndex }, row.map((cell, cellIndex) => primerCell(cell, cellIndex)))))))
    }
    const primerSection = (section, index) => {
      if (!section) return null
      const body = []
      if (section.intro) body.push(h('p', { className: 'dp-lead', key: 'lead' }, section.intro))
      if (Array.isArray(section.groups) && section.groups.length) {
        body.push(h('div', { key: 'groups' }, section.groups.map((group, groupIndex) => h('div', { className: 'dp-group', key: groupIndex },
          h('h4', null, group.label), primerPoints(group.points, 'g' + groupIndex)))))
      }
      const points = primerPoints(section.points, 'points')
      if (points) body.push(points)
      const table = primerTable(section.table)
      if (table) body.push(table)
      if (!body.length) body.push(h('p', { className: 'dp-lead dp-empty', key: 'empty' }, '本台尚未整理这一段。'))
      const sources = Array.isArray(section.sources) && section.sources.length
        ? h('p', { className: 'dp-src' }, h('b', null, '来源'), section.sources.map((source, sourceIndex) => primerSourceLine(source, 'src' + sourceIndex)))
        : h('p', { className: 'dp-src dp-src-missing' }, h('b', null, '来源'), '未标注 —— 这一段还不能用。')
      return h('section', { className: 'dp-section', key: section.id || index, 'data-dp-section': section.id, 'aria-labelledby': 'dp-h-' + index },
        h('h3', { id: 'dp-h-' + index }, section.title || ''), body, sources)
    }
    /* 整页视图（32 号）：返回与关闭是两个入口，各自只退一层；内容超 1.5 屏，所以不用弹窗。 */
    const primerOverlay = (props) => h('div', {
      className: 'dp-overlay', id: 'disease-primer',
      onClick: (event) => { if (event.target === event.currentTarget) props.onClose() },
    },
      h('div', { className: 'dp-panel', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'dp-title', tabIndex: -1, ref: props.panelRef },
        h('div', { className: 'dp-head' },
          h('button', { className: 'dp-btn dp-back', type: 'button', onClick: props.onClose, 'aria-label': '返回工作台（关闭疾病概要）' }, '← ', h('span', null, '返回')),
          h('div', { className: 'dp-head-title' },
            h('span', { className: 'dp-crumb' }, (PRIMER_DATA?.brand || '小甘宝') + ' › 疾病概要'),
            h('h2', { className: 'dp-title', id: 'dp-title' }, PRIMER_DATA?.name || '疾病概要',
              PRIMER_DATA?.en ? h('span', { className: 'dp-en' }, PRIMER_DATA.en) : null)),
          h('button', { className: 'dp-btn dp-close', type: 'button', onClick: props.onClose, 'aria-label': '关闭疾病概要' }, '✕')),
        h('div', { className: 'dp-body', tabIndex: 0 },
          h('div', { className: 'dp-inner' },
            h('p', { className: 'dp-note' }, '这是公开信息的整理，属于', h('b', null, '解释'),
              '：说明这个病是什么、依据哪些文件、指南里列了哪些手段、这些年发生了什么变化。它不是对你个人情况的判断，也不构成任何建议。'),
            primerSections.map(primerSection),
            h('p', { className: 'dp-foot' }, '最后更新 ' + (PRIMER_DATA?.updated || '未标注') +
              ' · 内容只做事实与原文整理 · 任何与你有关的判断，这一句需要问你的医生。')))))

    function Panel({ conversation }) {
      const [state, setState] = React.useState({ loading: true, error: '', profiles: [], pid: '', dash: null, metrics: [], sections: null, vp: [], vpPrivate: false, view: 'dash', flipped: [], tz: loadTz(), version: '', dir: '',
        capabilities: [], docs: [], activeDoc: 0, cands: [], busy: 0, importErr: '',
        mineru: null, tokenDraft: '', settingsBusy: false, settingsNote: '', settingsErr: '',
        parsing: 0, parseNote: '' })
      // 会话面板：宽度与开合同一个键，重开工作台还能回到上次的样子
      const [agentWidth, setAgentWidth] = React.useState(() => loadPane().width)
      const [paneOpen, setPaneOpen] = React.useState(() => loadPane().open)
      const [connecting, setConnecting] = React.useState(false)
      const [narrow, setNarrow] = React.useState(false)
      const [dragging, setDragging] = React.useState(false)
      const [splitterHover, setSplitterHover] = React.useState(false)
      /* 36 号整页视图：open 压一条历史，关闭与「返回」都只退这一层；Esc 与浏览器返回键各只退一层。
         滚动容器是小甘宝的 .wb-body（不是 .wb-main），关闭后回到原来的滚动位置。 */
      const [showPrimer, setShowPrimer] = React.useState(false)
      const primerTriggerRef = React.useRef(null)
      const primerPanelRef = React.useRef(null)
      const primerScrollRef = React.useRef(0)
      const primerOpenedRef = React.useRef(false)
      const openPrimer = () => {
        if (showPrimer) return
        const body = document.querySelector('.wb-body')
        primerScrollRef.current = body ? body.scrollTop : 0
        setShowPrimer(true)
        try { history.pushState({ ...(history.state || {}), wbPrimerOpen: 1 }, '') } catch (_) { /* 宿主禁改历史时退化为纯状态开关 */ }
      }
      const closePrimer = () => {
        if (!showPrimer) return
        let mine = false
        try { mine = !!(history.state && history.state.wbPrimerOpen) } catch (_) { mine = false }
        if (mine) { try { history.back(); return } catch (_) { /* 落到下一行 */ } }
        setShowPrimer(false)
      }
      React.useEffect(() => {
        if (!showPrimer) return
        const onPop = () => setShowPrimer(false)
        const onKey = (event) => { if (event.key === 'Escape') { event.preventDefault(); closePrimer() } }
        window.addEventListener('popstate', onPop)
        window.addEventListener('keydown', onKey)
        return () => { window.removeEventListener('popstate', onPop); window.removeEventListener('keydown', onKey) }
      }, [showPrimer])
      React.useEffect(() => {
        if (showPrimer) {
          primerOpenedRef.current = true
          const panel = primerPanelRef.current
          if (panel) panel.focus({ preventScroll: true })
          return
        }
        if (!primerOpenedRef.current) return
        const trigger = primerTriggerRef.current
        if (trigger) { try { trigger.focus({ preventScroll: true }) } catch (_) { /* 旧浏览器忽略 preventScroll */ } }
        const body = document.querySelector('.wb-body')
        if (body && primerScrollRef.current) body.scrollTop = primerScrollRef.current
      }, [showPrimer])
      const [agentNote, setAgentNote] = React.useState('')
      // 出错要显眼：顶栏那行 11px 小字用户会直接当成"点了没反应"，所以错误另走一条
      // 通栏提示（data-tone=error），成功/中性提示仍走小字。
      const [agentTone, setAgentTone] = React.useState('info')
      const shellRef = React.useRef(null)
      const dragHostRef = React.useRef(null)
      const patch = (next) => setState((prev) => ({ ...prev, ...next }))
      // 字号档位落 localStorage：设置页与顶栏 chip 改的都是这一个值，不各存一份
      const patchTz = (id) => { saveTz(id); patch({ tz: id }) }

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
            patch({
              profiles, pid, version: health.version || '', loading: !!pid,
              dir: typeof health.dir === 'string' ? health.dir : '',
              capabilities: Array.isArray(health.capabilities) ? health.capabilities : [],
            })
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

      // —— 设置：解析 Token 的状态 / 存 / 清。Token 原文只在输入框里存在，存完就清空 ——
      const loadSettings = async () => {
        try {
          const r = await fetch(`${API}/settings/mineru`, { credentials: 'same-origin' }).then((x) => x.json())
          if (r.error) throw new Error(r.error)
          patch({ mineru: r.mineru || null, settingsErr: '' })
        } catch (error) {
          patch({ mineru: null, settingsErr: `读取解析服务状态失败：${error.message}` })
        }
      }
      const postSettings = async (payload) => {
        patch({ settingsBusy: true, settingsErr: '', settingsNote: '' })
        try {
          const res = await fetch(`${API}/settings/mineru`, {
            method: 'POST', credentials: 'same-origin',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          })
          const json = await res.json().catch(() => ({}))
          if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
          // 成功才清空输入框、才换状态：清早了会和掩码同时出现，用户以为还没保存
          patch({
            mineru: json.mineru || null, tokenDraft: '',
            settingsNote: payload.action === 'clear'
              ? '已清除本机文件里的 Token。'
              : '已保存；上面那串掩码就是刚存进去的那把 Key。',
          })
        } catch (error) {
          patch({ settingsErr: `${payload.action === 'clear' ? '清除' : '保存'}失败：${error.message}` })
        } finally {
          patch({ settingsBusy: false })
        }
      }

      // —— 发起解析：失败也要说清楚"下一步做什么"，一句 401 等于没写 ——
      const parseDoc = async (id) => {
        patch({ parsing: id, parseNote: '', importErr: '' })
        try {
          const res = await fetch(`${API}/documents/parse`, {
            method: 'POST', credentials: 'same-origin',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ id }),
          })
          const json = await res.json().catch(() => ({}))
          if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
          if (json.error) {
            // 失败句子里带申请地址 = Token 问题（约定标记，前后端同一处定义）
            patch({ parseNote: json.error.message })
          } else {
            patch({
              parseNote: `解析完成（${json.engine === 'mineru' ? '云端' : '本机'}）：${json.candidateCount} 条候选，材料状态 ${(DOC_STATUS[json.status] || { text: json.status }).text}`,
            })
          }
          await loadDocs(state.pid)
          if (state.activeDoc) await openDoc(state.activeDoc)
        } catch (error) {
          patch({ importErr: `解析失败：${error.message}` })
        } finally {
          patch({ parsing: 0 })
        }
      }

      React.useEffect(() => {
        if (state.view === 'settings') loadSettings()
      }, [state.view])

      const onFlip = (id) => setState((prev) => ({
        ...prev,
        flipped: prev.flipped.includes(id) ? prev.flipped.filter((x) => x !== id) : [...prev.flipped, id],
      }))

      /* ---------------- AI 会话：调起 / 收起 / 拖宽 ---------------- */

      const [sessionId, setSessionId] = React.useState(() => ownedSession())
      const hasConversation = Boolean(sessionId)
      const canOpenSession = typeof bridge?.desktopWorkbenches?.newSession === 'function'

      /* `conversation` 到底是什么，只有真实宿主说了算。2026-10-24 从 DSH Desktop 的
         app.asar 里读出渲染器原文：
           h(item.Component, { service, entry, active, conversation:
              id === item.id ? h('div', { style: { display: hasCurrentSession ? 'contents' : 'none' } },
                                 h(ConversationMount, { container: conversationContainer })) : null })
         也就是说它是**一个 React 元素**，里面用 createPortal 把原生会话挂到宿主自己的容器上，
         显隐由宿主按 hasCurrentSession 写成 contents / none。
         所以必须**当 React 子节点渲染**：位置固定、只渲染一次，React 按同位置同类型复用，
         输入树不会重挂。
         0.3.4 曾把它当 DOM 节点 appendChild（那条判断来自假宿主），结果真机上永远挂不上——
         面板打开了、里面是空的，用户看到的就是"点 AI 对话没反应"。 */

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

      const sayInfo = (text) => { setAgentTone('info'); setAgentNote(text) }
      const sayError = (text) => { setAgentTone('error'); setAgentNote(text) }

      /** 业务目录：宿主 createSession 的 folder 必填，空字符串会被直接 reject。 */
      async function readDir() {
        try {
          const res = await fetch(`${API}/health`, { credentials: 'same-origin' })
          if (!res.ok) return { dir: null, reason: `health 返回 HTTP ${res.status}` }
          const payload = await res.json()
          const raw = typeof payload?.dir === 'string' ? payload.dir.trim() : ''
          return { dir: raw || null, reason: raw ? '' : 'health 里没有 dir 字段' }
        } catch (error) {
          return { dir: null, reason: `health 请求失败：${error?.message ?? error}` }
        }
      }

      async function openAgent(prompt = null) {
        setAgentNote('')
        if (!canOpenSession) {
          sayError('当前 Desktop 版本不支持从面板调起会话；请从左侧会话列表新建会话')
          return
        }
        setConnecting(true)
        try {
          const { dir, reason } = await readDir()
          if (!dir) {
            // 宿主对空 folder 只会抛「创建会话需要业务项目文件夹。」，那句话看不出根因。
            // 这里先自己拦住，说清"是服务端没给目录"，并给出可执行动作。
            sayError(`没能调起会话：服务没有给出资料目录（${reason}）。请重启 DSH Desktop 后重试；若仍如此，说明装的服务端版本没有下发 dir。`)
            return
          }
          const id = await createOwnedSession()
          if (!id) {
            setNote('已取消资料目录选择，没有创建会话。可以再次点击「AI 对话」重试。')
            return
          }
          if (!id) throw new Error('宿主没有返回会话 ID')
          setSessionId(id)
          rememberDraft({ sessionId: id, prompt: prompt || onboardingPrompt(dir) })
          const filled = flushDraft()
          setPaneOpen(true)
          savePane(agentWidth, true)
          sayInfo(filled
            ? '会话已就绪：草稿已填入右侧输入框，按回车发送'
            : '会话已就绪；输入框稍后可用，草稿会自动填入')
        } catch (error) {
          sayError(`没能调起会话：${error?.message ?? error}`)
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
        className: 'wb-liver-cancer-workbench', 'data-tz': state.tz,
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
              // 不再因为"宿主没提供 ensureSession"而 disabled：禁用按钮在用户眼里就是
              // "点了没反应"。让它可点，点下去在通栏里说清楚缺什么。
              disabled: connecting, 'aria-label': `AI 对话：${agentLabel}`,
            }, agentLabel),
            hasConversation && paneOpen && h('button', {
              type: 'button', className: 'wb-btn-ghost', onClick: () => { setPaneOpen(false); savePane(agentWidth, false) },
              'aria-label': '收起 AI 对话面板',
            }, '×'),
            agentNote && h('span', {
              className: 'wb-agent-note', 'data-tone': agentTone, role: agentTone === 'error' ? 'alert' : 'status',
            }, agentNote))),
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
                  /* 36 号第 3 条落地清单：顶栏出现「?」，打开疾病概要整页视图 */
                  h('button', {
                    type: 'button', className: 'wb-btn-agent wb-primer-trigger', ref: primerTriggerRef, onClick: openPrimer,
                    'aria-label': '疾病概要：肝细胞癌是什么？定义、医学资料与指南情况、治疗全景、发展趋势',
                    'aria-haspopup': 'dialog', 'aria-controls': 'disease-primer',
                    title: '疾病概要：肝细胞癌是什么？',
                  }, '?'),
                  h('div', { className: 'wb-tz-group', role: 'group', 'aria-label': '字号' },
                    h('button', {
                      type: 'button', className: 'wb-chip wb-tz-cycle',
                      onClick: () => patchTz(nextTz(state.tz)),
                      title: '点一下换下一档：标准 → 大字 → 特大',
                    }, `字号 ${tzLabel(state.tz)}`)))),
              h('div', { className: 'wb-body' }, children))),
          // 分隔条放在会话区左侧（业务区与会话区之间）：放到后面会跑到整帧最右缘，拖起来方向是反的。
          // 拖动开始时 setPointerCapture，失败时由 document 监听兜住；拖动期间铺遮罩防止 iframe 吞事件。
          dragging && h('div', { style: dragShieldStyle, 'aria-hidden': 'true' }),
          narrow && paneVisible && h('div', {
            className: 'wb-scrim', 'aria-hidden': 'true',
            onClick: () => { setPaneOpen(false); savePane(agentWidth, false) },
          }),
          !narrow && paneVisible && h('div', {
            role: 'separator', 'aria-orientation': 'vertical', 'aria-label': '调整 AI 对话面板宽度',
            'aria-valuemin': Math.round(AGENT_MIN * 100), 'aria-valuemax': Math.round(AGENT_MAX * 100),
            'aria-valuenow': percent, tabIndex: 0, className: 'wb-splitter',
            style: {
              ...(dragging ? splitterDragStyle : splitterHover ? splitterHoverStyle : splitterStyle),
              right: `${percent}%`,
            },
            onPointerDown: (event) => {
              event.preventDefault()
              dragHostRef.current = shellRef.current
              setDragging(true)
              try { event.currentTarget.setPointerCapture?.(event.pointerId) } catch (_) { /* 老宿主降级到 document 监听 */ }
            },
            onPointerEnter: () => setSplitterHover(true),
            onPointerLeave: () => setSplitterHover(false),
            onKeyDown: onSplitterKeyDown,
          },
            h('span', { style: splitterHitStyle, 'aria-hidden': 'true' }),
            (splitterHover || dragging) ? h('span', { style: splitterGripStyle, 'aria-hidden': 'true' }, '⠿') : null),
          // 原生会话始终挂载：卸载会丢输入框与草稿状态（宿主明确要求不重挂输入树）。
          // conversation 是宿主给的 React 元素，直接当子节点渲染——位置固定、类型固定，
          // React 会原地复用，不会重建 ConversationMount。
          h('aside', {
            className: 'wb-agent' + (narrow ? ' wb-agent-drawer' : ''),
            style: {
              width: narrow ? `min(92%, ${DRAWER_MAX}px)` : `${percent}%`,
              display: paneVisible ? 'flex' : 'none',
            },
            'aria-label': 'AI 对话',
            'aria-hidden': paneVisible ? undefined : 'true',
          }, conversation || h('div', { className: 'wb-agent-empty' },
            h('b', null, 'AI 对话还没开始'),
            h('span', null, '点顶栏「AI 对话」调起 DSH 原生会话后，它会固定在右侧这一栏。'),
            h('span', null, '没有会话也不影响记录：左侧的资料整理、指标与趋势照常可用。'))),
        /* 36 号 v2：疾病概要整页视图挂在根节点的最后一个子元素，不动首个子元素 <header> 的结构。 */
        showPrimer ? primerOverlay({ onClose: closePrimer, panelRef: primerPanelRef }) : null,
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

      /* 36 号 §2.6 · 看板首卡：卡头 / 大字天数 / 现状行 / 出口按钮排。
         天数一律由档案里已有的日期派生（锚点＝未结束治疗的开始日 → 手术日 → 最早一次治疗 → 背景记录日），
         不手填；没有锚点时整卡显示「待初始化」并指向录入入口，不编占位数字。
         「下次」只取你自己记下的未完成安排，不按指南间隔推算。 */
      const primerStatusCard = () => {
        const events = ((state.sections && state.sections.treatment && state.sections.treatment.events) || [])
          .filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(String(e.startedOn || '')))
        const byDesc = (a, b) => String(b.startedOn).localeCompare(String(a.startedOn))
        const openEvent = events.filter((e) => !e.endedOn).sort(byDesc)[0] || null
        const resection = events.filter((e) => e.modality === 'resection').sort(byDesc)[0] || null
        const earliest = [...events].sort((a, b) => String(a.startedOn).localeCompare(String(b.startedOn)))[0] || null
        const bgOn = (d && d.background && d.background.recorderdOn) || ''
        const bgDate = /^\d{4}-\d{2}-\d{2}$/.test(bgOn) ? bgOn : ''
        const anchorDate = (openEvent && openEvent.startedOn) || (resection && resection.startedOn)
          || (earliest && earliest.startedOn) || bgDate
        const anchorLabel = openEvent ? `${lbl('modality', openEvent.modality)}开始日`
          : resection ? '手术日'
            : earliest ? `${lbl('modality', earliest.modality)}开始日` : '背景记录日'
        const nowDate = new Date()
        const todayISO = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, '0')}-${String(nowDate.getDate()).padStart(2, '0')}`
        const dayGap = (from) => Math.round((Date.parse(todayISO + 'T00:00:00') - Date.parse(String(from).slice(0, 10) + 'T00:00:00')) / 86400000)
        const tasks = ((d && d.openTasks) || [])
          .filter((t) => /^\d{4}-\d{2}-\d{2}$/.test(String(t.dueOn || '')))
          .sort((a, b) => String(a.dueOn).localeCompare(String(b.dueOn)))
        const upcoming = tasks.filter((t) => String(t.dueOn) >= todayISO)[0] || null
        const overdue = !upcoming && tasks[0] ? tasks[0] : null
        const stageText = [d && d.stage && d.stage.BCLC ? `BCLC ${d.stage.BCLC.stage}` : '',
          d && d.stage && d.stage.CNLC ? `CNLC ${d.stage.CNLC.stage}` : ''].filter(Boolean).join(' · ')
        const primerButton = h('button', {
          type: 'button', className: 'wb-btn wb-primer-open', onClick: openPrimer,
          'aria-label': '疾病概要：肝细胞癌是什么？定义、医学资料与指南情况、治疗全景、发展趋势',
          'aria-haspopup': 'dialog', 'aria-controls': 'disease-primer',
        }, '疾病概要：肝细胞癌是什么？')
        const hint = h('span', { className: 'sc-hint' }, '天数由你记的日期算出，工作台不推断病程')

        if (!anchorDate) {
          return h('section', { className: 'sc-card sc-empty', 'aria-label': '病程状态卡' },
            h('div', { className: 'sc-head' }, h('span', { className: 'sc-eyebrow' }, 'D+N 状态卡 · 待初始化')),
            h('div', { className: 'sc-day' }, h('b', null, '待初始化'),
              h('span', { className: 'sc-muted' }, '还没有可用的治疗或背景记录日期，天数无法派生')),
            h('div', { className: 'sc-now' },
              h('div', { className: 'sc-stage' }, h('b', null, state.dash ? '资料还没有开始记' : '正在读取本机资料'),
                h('span', { className: 'wb-tag' }, '待初始化')),
              h('div', { className: 'sc-next' }, '记下一条治疗或背景记录后，这张卡会显示「第 N 天」与距下次安排的间隔。当前不推算，也不填占位数字。')),
            h('div', { className: 'sc-actions' },
              h('button', { type: 'button', className: 'wb-btn primary', onClick: () => patch({ view: 'import' }) }, '去导入资料 →'),
              primerButton, hint))
        }

        const day = dayGap(anchorDate)
        const nextGap = upcoming ? Math.round((Date.parse(String(upcoming.dueOn) + 'T00:00:00') - Date.parse(todayISO + 'T00:00:00')) / 86400000) : null
        const gapText = upcoming ? `距下次安排 ${nextGap} 天`
          : overdue ? `原定安排已过 ${Math.abs(Math.round((Date.parse(String(overdue.dueOn) + 'T00:00:00') - Date.parse(todayISO + 'T00:00:00')) / 86400000))} 天，待更新`
            : '距下一阶段：待记录'
        const nowLine = openEvent
          ? `${lbl('modality', openEvent.modality)}${openEvent.regimen ? ' · ' + openEvent.regimen : ''} · 进行中 · ${dt(openEvent.startedOn)} 起`
          : resection ? `手术切除 · ${dt(resection.startedOn)} · 已记录` : '当前没有在治记录'
        const core = openEvent || resection ? ['tx', '看治疗与转化 →'] : ['liver', '看我的肝 →']

        return h('section', { className: 'sc-card', 'aria-label': '病程状态卡' },
          h('div', { className: 'sc-head' },
            h('span', { className: 'sc-eyebrow' }, `D+${day} 状态卡 · ${gapText}`),
            h('span', { className: 'sc-anchor' }, `锚点 ${dt(anchorDate)}（${anchorLabel}）· 由档案日期算出，不手填`)),
          h('div', { className: 'sc-day' }, h('b', null, `第 ${day} 天`), h('span', { className: 'sc-muted' }, `自 ${dt(anchorDate)} 起算`)),
          h('div', { className: 'sc-now' },
            h('div', { className: 'sc-stage' }, h('b', null, nowLine),
              h('span', { className: 'wb-tag' }, stageText || '分期未记录')),
            h('div', { className: 'sc-next' }, upcoming
              ? ['下次：', h('b', { key: 'd' }, dt(upcoming.dueOn)), `（${upcoming.title}）`]
              : overdue
                ? ['原定 ', h('b', { key: 'd2' }, dt(overdue.dueOn)), `（${overdue.title}）还没有完成记录`]
                : '下次：还没有记下安排')),
          h('div', { className: 'sc-actions' },
            h('button', { type: 'button', className: 'wb-btn primary', onClick: () => patch({ view: core[0] }) }, core[1]),
            primerButton, hint))
      }

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
          /* 36 号 §2.6：看板首卡是病程状态卡。原来的问候横幅已撤掉——它和状态卡各说一套「下一步」。 */
          primerStatusCard(),
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
        onParse: parseDoc, parsing: state.parsing, parseNote: state.parseNote,
        // 旧宿主没有 parse 能力时不出按钮：点了没反应比没有按钮更糟
        canParse: state.capabilities.includes('parse'),
        onGoSettings: () => patch({ view: 'settings' }),
        onAskAgent: () => openAgent(TOKEN_HELP_PROMPT),
      })
      const settingsNode = h(ViewSettings, {
        health: { dir: state.dir },
        mineru: state.mineru, tz: state.tz,
        busy: state.settingsBusy, err: state.settingsErr, note: state.settingsNote,
        tokenDraft: state.tokenDraft,
        onToken: (v) => patch({ tokenDraft: v }),
        onTz: patchTz,
        onSave: () => postSettings({ token: state.tokenDraft }),
        onClear: () => postSettings({ action: 'clear' }),
        onGoImport: () => patch({ view: 'import' }),
      })
      const other = () => {
        if (state.view === 'import') return importNode
        if (state.view === 'settings') return settingsNode
        if (!S) return h('div', { className: 'wb-empty' }, '这个视图的数据还没读出来。')
        const build = ({
          liver: () => h(ViewLiver, { S }),
          tumor: () => h(ViewTumor, { S }),
          tx: () => h(ViewTx, { S }),
          onepage: () => h(ViewOnePage, { metrics: state.metrics, events: (S.treatment && S.treatment.events) || [] }),
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
    // sessions 用来往原生草稿里填开场白（不发送）；desktopWorkbenches 负责会话归属与调起。
    // 两个都在依赖里：少 inject 一个，宿主就不保证把服务挂到 ctx 上（0.3.4 漏了 sessions）。
    return { apply, inject: ['desktopWorkbenches', 'sessions'] }
  }
})

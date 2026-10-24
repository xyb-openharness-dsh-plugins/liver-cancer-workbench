// 路由表：纯函数，不依赖宿主、不碰 res。
// 每个 handler 接收 (URL, body) 返回 { status, body }，这样单测不需要假 res，也不会把 HTTP 细节混进业务。
//
// 读路由多数；写路由只有两条，都在导入链路里（确认 / 退回候选）。写路由必须显式声明 methods。
import { listProfiles, getDashboard, listMetrics, listViewpoints, getSections } from './read-model.js'
import { listDocuments, listCandidates, acceptCandidate, rejectCandidate } from '../import/store.mjs'
import { describeDatabase } from './db.js'

export const API_PREFIX = '/api/liver-cancer-workbench'

const bad = (message) => ({ status: 400, body: { error: message } })

/** 业务错误码 → HTTP 状态。没列出来的一律往上抛，由 guard 兜成 500。 */
function mapped(fn) {
  try {
    return fn()
  } catch (error) {
    const table = { not_found: 404, conflict: 409, missing_date: 400, not_importable: 400, bad_request: 400 }
    const status = table[error.code]
    if (!status) throw error
    return { status, body: { error: error.message } }
  }
}

function intParam(value) {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : null
}

export function createHandlers({ getDb, version }) {
  return [
    {
      path: `${API_PREFIX}/health`,
      run: () => ({
        status: 200,
        body: {
          ok: true,
          version,
          apiVersion: 'v1',
          capabilities: ['health', 'profiles', 'dashboard', 'metrics', 'viewpoints', 'sections',
            'documents', 'candidates', 'accept', 'reject'],
          database: describeDatabase(getDb()),
        },
      }),
    },
    {
      path: `${API_PREFIX}/profiles`,
      run: () => ({ status: 200, body: { profiles: listProfiles(getDb()) } }),
    },
    {
      path: `${API_PREFIX}/dashboard`,
      run: (url) => {
        const profileId = url.searchParams.get('profile')
        if (!profileId) return bad('缺少 profile 参数')
        return { status: 200, body: { dashboard: getDashboard(getDb(), profileId) } }
      },
    },
    {
      path: `${API_PREFIX}/metrics`,
      run: (url) => {
        const profileId = url.searchParams.get('profile')
        if (!profileId) return bad('缺少 profile 参数')
        return { status: 200, body: { metrics: listMetrics(getDb(), profileId) } }
      },
    },
    {
      path: `${API_PREFIX}/sections`,
      run: (url) => {
        const profileId = url.searchParams.get('profile')
        if (!profileId) return bad('缺少 profile 参数')
        // 专项视图一次性取回：肝功能、肿瘤、治疗、安全线、营养、心理与家庭、复诊。
        // 心理记录不在其中（见 /viewpoints 的私密开关）。
        return { status: 200, body: { sections: getSections(getDb(), profileId) } }
      },
    },
    {
      path: `${API_PREFIX}/viewpoints`,
      run: (url) => {
        const profileId = url.searchParams.get('profile')
        if (!profileId) return bad('缺少 profile 参数')
        // 私密内容必须显式 private=1；默认不返回，避免顺手把心理记录带进摘要
        const includePrivate = url.searchParams.get('private') === '1'
        return { status: 200, body: { viewpoints: listViewpoints(getDb(), profileId, { includePrivate }) } }
      },
    },
    {
      path: `${API_PREFIX}/documents`,
      run: (url) => {
        const profileId = url.searchParams.get('profile')
        if (!profileId) return bad('缺少 profile 参数')
        // 只读导入队列：文件状态与候选计数。写入口只有下面两条 accept/reject。
        return { status: 200, body: { documents: listDocuments(getDb(), profileId) } }
      },
    },
    {
      path: `${API_PREFIX}/candidates`,
      run: (url) => {
        const docId = intParam(url.searchParams.get('doc'))
        if (!docId) return bad('缺少 doc 参数')
        return { status: 200, body: { candidates: listCandidates(getDb(), docId) } }
      },
    },
    {
      path: `${API_PREFIX}/candidates/accept`,
      methods: ['POST'],
      run: (url, body) => {
        const id = intParam(body?.id)
        if (!id) return bad('缺少候选 id')
        const measuredOn = typeof body?.measuredOn === 'string' && body.measuredOn ? body.measuredOn : null
        return mapped(() => {
          const out = acceptCandidate(getDb(), id, { measuredOn })
          return { status: 200, body: { ok: true, ...out } }
        })
      },
    },
    {
      path: `${API_PREFIX}/candidates/reject`,
      methods: ['POST'],
      run: (url, body) => {
        const id = intParam(body?.id)
        if (!id) return bad('缺少候选 id')
        return mapped(() => {
          rejectCandidate(getDb(), id)
          return { status: 200, body: { ok: true } }
        })
      },
    },
  ]
}

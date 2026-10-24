// 路由表：纯函数，不依赖宿主、不碰 res。
// 每个 handler 接收 (URL, body) 返回 { status, body }，这样单测不需要假 res，也不会把 HTTP 细节混进业务。
//
// 读路由多数；写路由四条：确认 / 退回候选、存/清解析 Token、发起解析。写路由必须显式声明 methods。
import { listProfiles, getDashboard, listMetrics, listViewpoints, getSections } from './read-model.js'
import { listDocuments, listCandidates, acceptCandidate, rejectCandidate } from '../import/store.mjs'
import { describeDatabase } from './db.js'
import { mineruSettingsStatus, saveMineruToken, clearMineruToken, secretFile } from './settings.js'
import { parseDocument, listParseJobs } from './parse.js'

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

export function createHandlers({ getDb, version, dir = null, root = dir || process.cwd(), env = process.env }) {
  // Token 的读写只有一份实现（dsh/settings.js）：路由不自己拼路径、不自己解析 JSON。
  const secretPath = secretFile({ root, env })
  const currentStatus = () => mineruSettingsStatus({ file: secretPath, root, env })
  // 清 Token 后立刻回读状态：清除后可能还剩一把环境变量里的 Key，界面要能看出这一点
  const clearAndStatus = () => { clearMineruToken({ file: secretPath, root, env }); return currentStatus() }
  return [
    {
      path: `${API_PREFIX}/health`,
      run: () => ({
        status: 200,
        body: {
          ok: true,
          version,
          // 业务目录：客户端调起原生会话时要把 folder 传过去（空 folder 会被宿主拒绝）
          dir,
          apiVersion: 'v1',
          capabilities: ['health', 'profiles', 'dashboard', 'metrics', 'viewpoints', 'sections',
            'documents', 'candidates', 'accept', 'reject',
            // 前端据此决定是否显示 Token 输入框与「解析」按钮：旧宿主 + 新前端时不会出现点了没反应的按钮
            'mineru-settings', 'parse'],
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
      path: `${API_PREFIX}/settings/mineru`,
      // GET 给状态、POST 存/清：只读状态是半成品，用户换 Key 还得去改文件
      methods: ['GET', 'POST'],
      run: (url, body) => {
        // 没有命令就当查询：GET 的 body 是 null，某些调用方会给 {}——两种都不能当成"存空 Token"
        if (!body || (body.action === undefined && body.token === undefined)) {
          return { status: 200, body: { mineru: currentStatus() } }
        }
        const action = body.action
        try {
          if (action === 'clear') return { status: 200, body: { mineru: clearAndStatus() } }
          if (action !== undefined && action !== null && action !== 'save') {
            return bad('不认识的设置动作')
          }
          saveMineruToken({ token: body.token, file: secretPath, root, env })
          return { status: 200, body: { mineru: currentStatus() } }
        } catch (error) {
          // 400 与 500 必须分开：把环境问题报成"格式不对"，用户会反复粘贴同一个正确的 Token
          if (error.code === 'invalid_token') return { status: 400, body: { error: error.message, field: 'token' } }
          if (error.code === 'settings_write_failed') return { status: 500, body: { error: error.message } }
          throw error
        }
      },
    },
    {
      path: `${API_PREFIX}/documents/parse`,
      methods: ['POST'],
      run: async (url, body) => {
        const id = intParam(body?.id)
        if (!id) return bad('缺少材料 id')
        const out = await parseDocument(getDb(), id, { root, env })
        return { status: 200, body: out }
      },
    },
    {
      path: `${API_PREFIX}/documents/jobs`,
      run: (url) => {
        const id = intParam(url.searchParams.get('doc'))
        if (!id) return bad('缺少 doc 参数')
        return { status: 200, body: { jobs: listParseJobs(getDb(), id) } }
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

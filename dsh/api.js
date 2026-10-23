// 路由表：纯函数，不依赖宿主、不碰 res。
// 每个 handler 接收 URL 返回 { status, body }，这样单测不需要假 res，也不会把 HTTP 细节混进业务。
import { listProfiles, getDashboard, listMetrics, listViewpoints, getSections } from './read-model.js'
import { describeDatabase } from './db.js'

export const API_PREFIX = '/api/liver-cancer-workbench'

const bad = (message) => ({ status: 400, body: { error: message } })

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
          capabilities: ['health', 'profiles', 'dashboard', 'metrics', 'viewpoints', 'sections'],
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
  ]
}

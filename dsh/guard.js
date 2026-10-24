// 鉴权与错误包装：单独成文件，便于不依赖宿主地测。
// 规则：鉴权先于一切读取；**方法不在该路由的 methods 里给 405**；找不到给 404；
//      其余异常 500 且**不回显堆栈**。
//
// 2026-10-24 起路由可声明 methods（默认 ['GET']）。写路由（导入候选确认/退回）必须显式声明——
// 它是这套工作台里唯一会改数据的 HTTP 入口，不能靠"忘记加检查"来拦住。
export function sendJson(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(JSON.stringify(body))
}

const MAX_BODY = 64 * 1024

/** 读 JSON 请求体。超过 64KB 直接拒——确认一条候选不该带来几兆数据。 */
export async function readJsonBody(req) {
  if (!req || typeof req[Symbol.asyncIterator] !== 'function') return {}
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY) throw Object.assign(new Error('请求体过大'), { code: 'too_large' })
    chunks.push(chunk)
  }
  if (!size) return {}
  const text = Buffer.concat(chunks).toString('utf8').trim()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    throw Object.assign(new Error('请求体不是合法 JSON'), { code: 'bad_json' })
  }
}

/**
 * @param {{ connection: object, logger?: object, readBody?: (req) => Promise<object> }} deps
 * @returns {(route: {path: string, methods?: string[], run: Function}) => Function}
 */
export function makeGuard({ connection, logger, readBody = readJsonBody } = {}) {
  return (route) => async (req, res) => {
    if (typeof connection?.requestRejection !== 'function') {
      return sendJson(res, 503, { error: 'connection authentication capability unavailable' })
    }
    const rejection = connection.requestRejection(req)
    if (rejection !== undefined) return sendJson(res, rejection, { error: 'Authentication required' })

    const methods = route.methods || ['GET']
    if (!methods.includes(req.method)) {
      if (typeof res.setHeader === 'function') res.setHeader('allow', methods.join(', '))
      return sendJson(res, 405, { error: 'Method not allowed' })
    }

    let body = null
    try {
      body = req.method === 'GET' ? null : await readBody(req)
    } catch (error) {
      return sendJson(res, error.code === 'too_large' ? 413 : 400, { error: error.message })
    }

    try {
      const out = await route.run(new URL(req.url, 'http://localhost'), body)
      return sendJson(res, out.status, out.body)
    } catch (error) {
      if (error.code === 'not_found') return sendJson(res, 404, { error: error.message })
      logger?.warn?.('[liver-cancer-workbench] request failed', error)
      return sendJson(res, 500, { error: '读取失败', detail: String(error.message || error) })
    }
  }
}

// 鉴权与错误包装：单独成文件，便于不依赖宿主地测。
// 规则：鉴权先于一切读取；方法不对给 405；找不到给 404；其余异常 500 且**不回显堆栈**。
export function sendJson(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(JSON.stringify(body))
}

export function makeGuard({ connection, logger } = {}) {
  return (run) => (req, res) => {
    if (typeof connection?.requestRejection !== 'function') {
      return sendJson(res, 503, { error: 'connection authentication capability unavailable' })
    }
    const rejection = connection.requestRejection(req)
    if (rejection !== undefined) return sendJson(res, rejection, { error: 'Authentication required' })
    if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' })
    try {
      const { status, body } = run(new URL(req.url, 'http://localhost'))
      return sendJson(res, status, body)
    } catch (error) {
      if (error.code === 'not_found') return sendJson(res, 404, { error: error.message })
      logger?.warn?.('[liver-cancer-workbench] read failed', error)
      return sendJson(res, 500, { error: '读取失败', detail: String(error.message || error) })
    }
  }
}

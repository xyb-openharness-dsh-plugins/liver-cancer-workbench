// MinerU 云端解析客户端（API v4，唯一通路）。
//
// 口径沿用 docs/18-MINERU-PARSING.md v2：
//   - 只走 HTTP，不包装本机 CLI（GUI 进程 PATH 里没有那个二进制，报 ENOENT 用户无从排查）；
//   - 默认模型 pipeline，接口**明确拒收模型参数**才回退 vlm（文件本身失败换模型只是多烧一次额度）；
//   - 失败分类，不静默降级：解析失败不产候选，也不"本地正则凑一份"。
//
// 错误消息里的申请地址是前后端的**约定标记**：前端只判 failure.includes(MINERU_TOKEN_URL)，
// 不各自猜状态码。改这里要同时改 lib/client.js 的同名字面量。
import { MINERU_TOKEN_URL } from './settings.js'
import { readZipEntry } from './zip.js'

export const MINERU_BASE = 'https://mineru.net'
export const MINERU_MODEL_DEFAULT = 'pipeline'
export const MINERU_MODEL_FALLBACK = 'vlm'
/** 单文件上限（官方：200MB / 600 页）。超限按失败处理，保留原件。 */
export const MINERU_MAX_BYTES = 200 * 1024 * 1024

const fail = (code, message, extra = {}) => Object.assign(new Error(message), { code, ...extra })

/** 只有"接口不接受这个模型参数"才值得换模型。文件类型不支持不在其列。 */
export function modelFallbackWorthy(code, message = '') {
  const text = String(message || '')
  if (/html|file type|文件类型|unsupported file/i.test(text)) return false
  return /model_version|model version|模型/i.test(text) && /(invalid|not support|unsupported|不支持)/i.test(text)
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}`, 'content-type': 'application/json' }
}

async function readJson(res) {
  const text = await res.text()
  try { return text ? JSON.parse(text) : {} } catch { return { raw: text } }
}

/**
 * 四步走：申请上传地址 → 上传原件 → 轮询 → 下载 zip 取 full.md。
 * fetch/时间函数都可注入，单测不联网。
 */
export async function parsePdf({
  buffer, fileName, token, model = MINERU_MODEL_DEFAULT,
  fetchImpl = globalThis.fetch, base = MINERU_BASE,
  pollIntervalMs = 2500, timeoutMs = 180000, sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  onProgress = () => {},
} = {}) {
  if (!token) {
    throw fail('NO_TOKEN', `没有可用的解析 Token。扫描件与照片的自动识别用不了，TXT / MD / CSV 仍在本机解析。申请或重置：${MINERU_TOKEN_URL}`)
  }
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw fail('BAD_FILE', '原件是空的，无法解析')
  if (buffer.length > MINERU_MAX_BYTES) {
    throw fail('BAD_FILE', `文件 ${(buffer.length / 1024 / 1024).toFixed(1)}MB 超过单文件 200MB 上限，未上传`)
  }
  const started = Date.now()
  const usedModel = model

  // ① 申请上传地址
  let created
  try {
    const res = await fetchImpl(`${base}/api/v4/file-urls/batch`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({
        enable_formula: false,
        language: 'ch',
        model_version: usedModel,
        files: [{ name: fileName, data_id: 'heppal' }],
      }),
    })
    created = await readJson(res)
    if (res.status === 401 || res.status === 403) {
      throw fail('UNAUTHORIZED', `解析服务拒绝了这个 Token（HTTP ${res.status}）。可能已过期或被重置，请更新：${MINERU_TOKEN_URL}`)
    }
    if (res.ok === false && !created.code) throw fail('NETWORK', `申请上传地址失败：HTTP ${res.status}`)
  } catch (error) {
    if (error.code) throw error
    throw fail('NETWORK', networkHint(error))
  }
  if (Number(created?.code) !== 0) {
    const message = String(created?.msg || created?.message || '未知原因')
    if (/token|auth|401|403/i.test(message)) {
      throw fail('UNAUTHORIZED', `解析服务拒绝了这个 Token（${message}）。请更新：${MINERU_TOKEN_URL}`)
    }
    if (modelFallbackWorthy(created?.code, message)) {
      throw fail('MODEL_REJECTED', `接口不接受模型 ${usedModel}：${message}`, { model: usedModel })
    }
    if (/html|file type|文件类型/i.test(message)) throw fail('BAD_FILE', `这个文件类型云端不受理：${message}`)
    throw fail('TASK_FAILED', `申请上传地址失败：${message}`)
  }
  const batchId = created?.data?.batch_id
  const uploadUrl = created?.data?.file_urls?.[0]
  if (!batchId || !uploadUrl) throw fail('TASK_FAILED', '解析服务没有返回批次号或上传地址')
  onProgress('uploading')

  // ② 上传原件：这里**不能设 Content-Type**，设了会被拒
  try {
    const put = await fetchImpl(uploadUrl, { method: 'PUT', body: buffer })
    if (!put.ok) throw fail('NETWORK', `上传原件失败：HTTP ${put.status}`)
  } catch (error) {
    if (error.code) throw error
    throw fail('NETWORK', networkHint(error))
  }
  onProgress('parsing')

  // ③ 轮询
  const deadline = Date.now() + timeoutMs
  let result = null
  for (;;) {
    if (Date.now() > deadline) {
      throw fail('TIMEOUT', `解析超过 ${Math.round(timeoutMs / 1000)} 秒还没有结果。原件已保留，可以稍后重试`)
    }
    await sleep(pollIntervalMs)
    let body
    try {
      const res = await fetchImpl(`${base}/api/v4/extract-results/batch/${batchId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 401 || res.status === 403) {
        throw fail('UNAUTHORIZED', `解析服务拒绝了这个 Token（HTTP ${res.status}）。请更新：${MINERU_TOKEN_URL}`)
      }
      body = await readJson(res)
    } catch (error) {
      if (error.code) throw error
      // 轮询偶尔断一次不该直接判失败：继续等，超时才算失败
      continue
    }
    if (Number(body?.code) !== 0) {
      throw fail('TASK_FAILED', `查询解析结果失败：${body?.msg || body?.code}`)
    }
    result = (body?.data?.extract_result || [])[0] || null
    if (!result) continue
    const state = String(result.state || '')
    if (state === 'done') break
    if (state === 'failed') {
      throw fail('TASK_FAILED', `云端解析失败：${result.err_msg || '未给出原因'}`)
    }
    // pending / running / converting 都继续等；不把"跑完了"当"解析对了"
  }

  // ④ 下载 zip，只取 full.md（缺它就算失败，不返回半份结果）
  const zipUrl = result.full_zip_url
  if (!zipUrl) throw fail('NO_MARKDOWN', '解析完成但没有给出结果包地址')
  let zipBuf
  try {
    const res = await fetchImpl(zipUrl)
    if (!res.ok) throw fail('NETWORK', `下载解析结果失败：HTTP ${res.status}`)
    zipBuf = Buffer.from(await res.arrayBuffer())
  } catch (error) {
    if (error.code) throw error
    throw fail('NETWORK', networkHint(error))
  }
  const md = readZipEntry(zipBuf, 'full.md')
  if (!md || !md.length) throw fail('NO_MARKDOWN', '结果包里没有 full.md，按失败处理（不返回半份结果）')
  let pages = null
  const listBuf = readZipEntry(zipBuf, '_content_list.json') || readZipEntry(zipBuf, 'content_list.json')
  if (listBuf) {
    try {
      const items = JSON.parse(listBuf.toString('utf8'))
      if (Array.isArray(items)) {
        // done 之后批次接口不返回页数，只能从 page_idx 上限推
        const max = items.reduce((acc, it) => Math.max(acc, Number(it?.page_idx ?? 0)), 0)
        pages = items.length ? max + 1 : null
      }
    } catch { pages = null }
  }
  onProgress('done')
  return {
    markdown: md.toString('utf8'),
    pages,
    model: usedModel,
    batchId,
    elapsedMs: Date.now() - started,
  }
}

/** 代理是已知缺口：Node 内置 fetch 不认 HTTP_PROXY，用户会先去查网络和 Token，都不是原因。 */
function networkHint(error) {
  const proxied = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.https_proxy || process.env.http_proxy
  const tail = proxied ? '（当前版本的内置请求不走系统代理，检测到代理变量但它不会生效）' : ''
  return `网络请求失败：${error?.message ?? error}${tail}`
}

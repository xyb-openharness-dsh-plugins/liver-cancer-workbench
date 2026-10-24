// 设置层：MinerU Token 的唯一实现（读、校验、写、清、状态）。
//
// 为什么单独一层：Token 有三个使用者——解析客户端要读、设置接口要给状态、设置页要写。
// 三处各写一遍 JSON 读写，就会出现「界面说已保存、解析却读不到」这种极难查的分叉
// （docs/18-MINERU-PARSING.md §5.3 记录过这个真事故）。
//
// 三条硬规则：
//   1. 原文永不回给界面、不进日志、不进错误消息——状态里只有掩码与来源；
//   2. 优先级是 显式 > 密钥文件 > 环境变量（文件排 env 前面，写反过，代价是"换了 Key 仍 401"）；
//   3. 坏文件抛错，不当"没配"——静默重建空文件会销毁排查现场。
import { readFileSync, writeFileSync, renameSync, unlinkSync, mkdirSync, existsSync, chmodSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

export const MINERU_TOKEN_URL = 'https://mineru.net/apiManage/token'
export const MINERU_ENV_TOKEN = 'MINERU_TOKEN'
export const MINERU_ENV_FILE = 'HEPPAL_MINERU_SECRET'

const TOKEN_RE = /^[A-Za-z0-9._-]+$/

/** 主目录缩成 ~，界面/日志里不出现完整用户路径。 */
export function tildePath(p) {
  const home = homedir()
  return p && home && p.startsWith(home) ? `~${p.slice(home.length)}` : p
}

/**
 * 当前生效的密钥文件。
 * 顺序：显式指定文件（env）> 已存在的包内 .secrets/mineru.json > 用户目录。
 * 装机后包目录会随插件升级整份替换，写在包里的 Token 会静默消失，所以默认落用户目录。
 */
export function secretFile({ root = process.cwd(), env = process.env } = {}) {
  const explicit = env[MINERU_ENV_FILE]
  if (explicit && String(explicit).trim()) return String(explicit).trim()
  const inRepo = join(root, '.secrets', 'mineru.json')
  if (existsSync(inRepo)) return inRepo
  return join(homedir(), '.heppal', 'secrets', 'mineru.json')
}

/** 读文件里的 token。ENOENT → 空串；不是合法 JSON → 抛错（不是"没配"）。 */
export function readMineruToken(file) {
  if (!existsSync(file)) return ''
  const text = readFileSync(file, 'utf8')
  if (!text.trim()) return ''
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    throw Object.assign(new Error(`密钥文件不是合法 JSON（应为 {"token": "sk-..."}）：${tildePath(file)}`), {
      code: 'settings_broken_file',
    })
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw Object.assign(new Error(`密钥文件内容不是对象：${tildePath(file)}`), { code: 'settings_broken_file' })
  }
  const token = typeof parsed.token === 'string' ? parsed.token.trim() : ''
  return token
}

/** 校验：只判"能不能用"，不猜上游规则。 */
export function validateMineruToken(token) {
  const value = typeof token === 'string' ? token.trim() : ''
  if (!value) return { ok: false, reason: '请填入 Token' }
  if (value.length < 8) return { ok: false, reason: 'Token 太短（至少 8 个字符）' }
  if (value.length > 1024) return { ok: false, reason: 'Token 太长（最多 1024 个字符）' }
  if (/\s/.test(value)) return { ok: false, reason: 'Token 里不能有空格或换行（粘贴时可能带进了换行）' }
  if (!TOKEN_RE.test(value)) return { ok: false, reason: 'Token 只能包含字母、数字与 . _ - 这几个符号' }
  return { ok: true, token: value }
}

export function maskToken(token) {
  if (!token) return ''
  if (token.length <= 8) return `${token.slice(0, 2)}****`
  return `${token.slice(0, 4)}****${token.slice(-2)}`
}

/**
 * 解析出这次请求该用哪把 Key。
 * 显式传参 > 密钥文件 > 环境变量。返回 source 是为了让界面能看出"文件里那把没生效"。
 */
export function resolveToken({ explicit = '', file, env = process.env, root } = {}) {
  if (explicit && String(explicit).trim()) return { token: String(explicit).trim(), source: 'explicit' }
  const target = file || secretFile({ root, env })
  const fromFile = readMineruToken(target) // 坏文件在这里抛：宁可报错，也不要假装没配
  if (fromFile) return { token: fromFile, source: 'file' }
  const fromEnv = env[MINERU_ENV_TOKEN]
  if (fromEnv && String(fromEnv).trim()) return { token: String(fromEnv).trim(), source: 'env' }
  return { token: '', source: 'none' }
}

/** 原子写：同目录 tmp → chmod 600 → rename。保留文件里的其它键。 */
function writeSecret(file, next) {
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 })
  try { chmodSync(dirname(file), 0o700) } catch { /* 目录权限改不动不阻塞写入 */ }
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`
  writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 })
  chmodSync(tmp, 0o600)
  renameSync(tmp, file)
}

/** 保存。校验失败不落盘（否则磁盘上会留一个"已配置但无效"的半成品）。 */
export function saveMineruToken({ token, file, root, env = process.env } = {}) {
  const check = validateMineruToken(token)
  if (!check.ok) throw Object.assign(new Error(check.reason), { code: 'invalid_token' })
  const target = file || secretFile({ root, env })
  let previous = {}
  if (existsSync(target)) {
    const text = readFileSync(target, 'utf8').trim()
    if (text) {
      try { previous = JSON.parse(text) } catch {
        // 坏文件不覆盖：里面可能是用户手改错的内容，直接盖掉等于销毁现场
        throw Object.assign(new Error(`密钥文件不是合法 JSON，请先修正或删除：${tildePath(target)}`), {
          code: 'settings_write_failed',
        })
      }
      if (previous === null || typeof previous !== 'object' || Array.isArray(previous)) previous = {}
    }
  }
  writeSecret(target, { ...previous, token: check.token })
  return { file: target, saved: true }
}

/** 清除：只删 token 键；文件因此变空才删文件；本来没有也算成功（幂等）。 */
export function clearMineruToken({ file, root, env = process.env } = {}) {
  const target = file || secretFile({ root, env })
  if (!existsSync(target)) return { file: target, cleared: true }
  let parsed = {}
  try { parsed = JSON.parse(readFileSync(target, 'utf8') || '{}') } catch {
    throw Object.assign(new Error(`密钥文件不是合法 JSON，请直接删除该文件：${tildePath(target)}`), {
      code: 'settings_write_failed',
    })
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) parsed = {}
  delete parsed.token
  if (Object.keys(parsed).length === 0) unlinkSync(target)
  else writeSecret(target, parsed)
  return { file: target, cleared: true }
}

/**
 * 状态：给界面看的全部信息，**不含原文**。
 * 三个态可区分：未配置 / 文件生效 / 环境变量生效（清除后仍可能剩 env 这把）。
 */
export function mineruSettingsStatus({ file, root, env = process.env, engine = 'mineru' } = {}) {
  const target = file || secretFile({ root, env })
  const exists = existsSync(target)
  const base = {
    engine,
    configured: false,
    source: 'none',
    sourceLabel: '尚未配置 Token',
    masked: '',
    file: tildePath(target),
    fileExists: exists,
    permissions: null,
    tokenUrl: MINERU_TOKEN_URL,
    envPresent: Boolean(env[MINERU_ENV_TOKEN] && String(env[MINERU_ENV_TOKEN]).trim()),
  }
  let fileToken = ''
  try {
    fileToken = readMineruToken(target)
  } catch (error) {
    return { ...base, error: error.message }
  }
  if (exists) {
    try { base.permissions = String((statSync(target).mode & 0o777).toString(8)).padStart(3, '0') } catch { /* 读不到权限不阻塞 */ }
  }
  const envToken = env[MINERU_ENV_TOKEN] && String(env[MINERU_ENV_TOKEN]).trim()
  if (fileToken) {
    return {
      ...base,
      configured: true,
      source: 'file',
      sourceLabel: `当前生效：${maskToken(fileToken)} · 已保存于 ${tildePath(target)}`,
      masked: maskToken(fileToken),
    }
  }
  if (envToken) {
    // 文件清了但环境里还有一把：界面上必须看得出来，否则又会变成"我明明清了还在用"
    return {
      ...base,
      configured: true,
      source: 'env',
      sourceLabel: `当前生效：${maskToken(envToken)} · 临时使用环境变量 ${MINERU_ENV_TOKEN}（未写入文件）`,
      masked: maskToken(envToken),
    }
  }
  return { ...base, sourceLabel: '尚未配置 Token：扫描件与照片的自动识别会用不了；TXT / MD / CSV 仍在本机解析。' }
}

// 解析编排：原件 → 行 → 闸门 → 候选 → 落库（同一事务）。
//
// 失败语义（docs/18-MINERU-PARSING.md §9）：
//   成功：候选写入 + document 状态推进 + parse_job=succeeded，同一事务；
//   失败：事务回滚 → 候选 0 条、原件保留、parse_job=failed（错误码与原文留在任务记录里）。
//
// 「可重试」与「文件本身不行」要分开：
//   NO_TOKEN / UNAUTHORIZED / NETWORK / TIMEOUT 是环境问题，文件可能一点毛病没有，
//   所以文档状态**留在待解析**，用户配好或网络恢复后直接重试，不必重传；
//   TASK_FAILED / NO_MARKDOWN / BAD_FILE 是这份文件过不去，落成解析失败。
import { readFileSync, existsSync } from 'node:fs'
import { basename, isAbsolute, join } from 'node:path'
import { decide } from '../import/pipeline.mjs'
import { markdownToLines } from './hccparse.js'
import { parsePdf, MINERU_MODEL_DEFAULT } from './mineru.js'
import { resolveToken } from './settings.js'

/** 需要上云的：PDF 与图片（扫描件）。 */
export const ROUTE_CLOUD = /\.(pdf|png|jpe?g|tiff?|bmp|webp)$/i
/** 本机就能读的纯文本。`.html` 刻意不在白名单：v4 批量接口拒收 html（-10002），
    留着一个一定失败的入口等于骗用户。 */
export const ROUTE_LOCAL = /\.(txt|md|csv|tsv)$/i

const RETRYABLE = new Set(['NO_TOKEN', 'UNAUTHORIZED', 'NETWORK', 'TIMEOUT'])
const nowIso = () => new Date().toISOString()

export function isResolvable(fileName = '') {
  return ROUTE_CLOUD.test(fileName) || ROUTE_LOCAL.test(fileName)
}

/** 该文件能不能走解析；不能就给一句人话，别让用户猜。 */
export function routeOf(fileName = '') {
  if (ROUTE_LOCAL.test(fileName)) return 'local'
  if (ROUTE_CLOUD.test(fileName)) return 'cloud'
  if (/\.html?$/i.test(fileName)) return 'unsupported-html'
  return 'unsupported'
}

function insertJob(db, job) {
  db.prepare(
    `INSERT INTO parse_job
       (document_id, engine, model, status, error_code, error_message, pages, candidate_count, elapsed_ms, started_at, finished_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    job.documentId, job.engine, job.model ?? null, job.status,
    job.errorCode ?? null, job.errorMessage ?? null, job.pages ?? null,
    job.candidateCount ?? 0, job.elapsedMs ?? null, job.startedAt, job.finishedAt ?? nowIso(),
  )
}

/**
 * 解析一份已登记的原件。
 * @returns {Promise<{documentId:number,status:string,candidateCount:number,engine:string,error?:{code:string,message:string}}>}
 */
export async function parseDocument(db, documentId, {
  root = process.cwd(), env = process.env, fetchImpl, sleep, pollIntervalMs, timeoutMs, onProgress,
} = {}) {
  const doc = db.prepare('SELECT * FROM document WHERE id = ?').get(documentId)
  if (!doc) throw Object.assign(new Error('没有这份材料'), { code: 'not_found' })
  if (doc.status === 'pending_review' || doc.status === 'parsed') {
    throw Object.assign(new Error('这份材料已经解析过了；要重来请先退回候选'), { code: 'conflict' })
  }
  if (!doc.file_path) {
    throw Object.assign(new Error('这份材料没有原件路径，无法解析'), { code: 'not_found' })
  }
  // 原件路径两种形态：用户选的绝对路径（正常导入），和演示库里的仓库相对路径。
  // 相对路径按 root 解析——不按 cwd，因为服务进程的 cwd 是装机 profile 目录，
  // 按 cwd 解析的后果是演示库点什么都报"原件不在这个位置了"。
  const filePath = isAbsolute(doc.file_path) ? doc.file_path : join(root, doc.file_path)
  if (!existsSync(filePath)) {
    // 原件缺失是 404：不是"解析失败"，用户该做的是把文件放回去
    throw Object.assign(new Error(`原件不在这个位置了：${filePath}`), { code: 'not_found' })
  }

  const fileName = basename(filePath)
  const route = routeOf(fileName)
  if (route === 'unsupported-html') {
    throw Object.assign(new Error('HTML 不在解析白名单里（云端接口明确拒收），请导出成 PDF 再传'), { code: 'not_importable' })
  }
  if (route === 'unsupported') {
    throw Object.assign(new Error('这个文件类型既不能本机读，也不能上云解析'), { code: 'not_importable' })
  }

  const buf = readFileSync(filePath)
  const startedAt = nowIso()
  let engine = route === 'local' ? 'local' : 'mineru'
  let model = route === 'local' ? null : MINERU_MODEL_DEFAULT
  let pages = null
  let elapsedMs = null
  let lines = null

  if (route === 'cloud') {
    try {
      const { token, source } = resolveToken({ root, env })
      const out = await parsePdf({
        buffer: buf, fileName, token, model: MINERU_MODEL_DEFAULT,
        fetchImpl, sleep, pollIntervalMs, timeoutMs, onProgress,
      })
      lines = markdownToLines(out.markdown)
      model = out.model
      pages = out.pages
      elapsedMs = out.elapsedMs
      // 来源只进任务记录的 message 前缀？不：Token 只是"用了哪一把"，不进库也不进日志原文
      void source
    } catch (error) {
      const code = error?.code || 'TASK_FAILED'
      const retryable = RETRYABLE.has(code)
      db.exec('BEGIN')
      try {
        db.prepare('UPDATE document SET parse_note = ? WHERE id = ?')
          .run(`[${code}] ${error.message}`, doc.id)
        if (!retryable) {
          db.prepare("UPDATE document SET status = 'parse_failed' WHERE id = ?").run(doc.id)
        }
        insertJob(db, {
          documentId: doc.id, engine, model, status: 'failed',
          errorCode: code, errorMessage: error.message, startedAt, elapsedMs,
        })
        db.exec('COMMIT')
      } catch (inner) {
        db.exec('ROLLBACK')
        throw inner
      }
      return {
        documentId: Number(doc.id),
        status: retryable ? doc.status : 'parse_failed',
        candidateCount: 0,
        engine,
        retryable,
        error: { code, message: error.message },
      }
    }
  }

  // 本机文本：lines 留空，交给 decide 自己切（同一份逻辑，不另写一套）
  const decision = decide({ buf, name: fileName, lines: lines || undefined })

  const accepted = decision.documentStatus === 'pending_review'
  const candidates = accepted ? decision.candidates : []

  db.exec('BEGIN')
  try {
    // 重解析：只清掉上一次还没人处理的 pending 候选；已确认/已退回的是历史，不动
    if (accepted) db.prepare("DELETE FROM candidate WHERE document_id = ? AND status = 'pending'").run(doc.id)
    const insert = db.prepare(
      `INSERT INTO candidate
         (document_id, field, value_text, value_num, unit, page_no, confidence, source_line, note, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
    )
    const stamp = nowIso()
    for (const c of candidates) {
      insert.run(
        doc.id, c.field, c.valueText ?? null,
        c.valueNum === null || c.valueNum === undefined ? null : c.valueNum,
        c.unit || null, null, c.confidence ?? null, c.sourceLine ?? null, c.note ?? null, stamp,
      )
    }
    db.prepare('UPDATE document SET status = ?, parse_note = ? WHERE id = ?')
      .run(decision.documentStatus, `[${decision.stage}] ${decision.reason}`, doc.id)
    insertJob(db, {
      documentId: doc.id, engine, model,
      // 「跑到最后一步」不等于「解析对了」：被闸门拦下也算解析成功，但状态仍是失败/待核对
      status: 'succeeded',
      pages, candidateCount: candidates.length, elapsedMs, startedAt,
    })
    db.exec('COMMIT')
    return {
      documentId: Number(doc.id),
      status: decision.documentStatus,
      verdict: decision.verdict,
      candidateCount: candidates.length,
      engine,
      model,
      pages,
    }
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

/** 某份材料的解析历史（界面"试过几次、每次为什么失败"用）。 */
export function listParseJobs(db, documentId) {
  return db.prepare(
    `SELECT id, engine, model, status, error_code, error_message, pages, candidate_count, elapsed_ms, started_at, finished_at
       FROM parse_job WHERE document_id = ? ORDER BY id DESC`,
  ).all(documentId).map((r) => ({
    id: Number(r.id),
    engine: r.engine,
    model: r.model,
    status: r.status,
    errorCode: r.error_code,
    errorMessage: r.error_message,
    pages: r.pages === null ? null : Number(r.pages),
    candidateCount: Number(r.candidate_count),
    elapsedMs: r.elapsed_ms === null ? null : Number(r.elapsed_ms),
    startedAt: r.started_at,
    finishedAt: r.finished_at,
  }))
}

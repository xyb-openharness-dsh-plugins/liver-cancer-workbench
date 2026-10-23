// 文件嗅探：只回答三个问题——是什么、有没有文本层、指纹是多少。
// 不做 OCR、不解析内容、不写库。上层据此决定走"文本抽取"还是"OCR"，以及要不要置 parse_failed。
import { createHash } from 'node:crypto'

const MAGIC = [
  { kind: 'pdf', test: (b) => b.subarray(0, 5).toString('latin1') === '%PDF-' },
  { kind: 'png', test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { kind: 'jpeg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { kind: 'heic', test: (b) => b.subarray(4, 8).toString('latin1') === 'ftyp' },
]

/**
 * PDF 里有没有可抽的文本层。
 *
 * 判据故意保守：既要出现文字绘制算子（Tj / TJ / ' / "），又要出现字体资源（/Font）。
 * 扫描件（例如 macOS Quartz 生成的病历照片 PDF）两者都没有——这种文件用文本抽取会
 * **静默返回空串**，不报错。宁可判成"没有"，让人走 OCR。
 */
export function pdfHasTextLayer(buf) {
  const s = buf.toString('latin1')
  const hasFont = /\/Font\b/.test(s)
  const hasShow = /\bTj\b|\bTJ\b|\/F\d+\s+[\d.]+\s+Tf/.test(s)
  return hasFont && hasShow
}

export function sniffBuffer(buf, name = '') {
  const hit = MAGIC.find((m) => m.test(buf))
  const kind = hit ? hit.kind : /\.(txt|md|csv)$/i.test(name) ? 'text' : 'unknown'
  const bytes = buf.length
  const sha256 = createHash('sha256').update(buf).digest('hex')

  if (kind === 'pdf') {
    const hasTextLayer = pdfHasTextLayer(buf)
    return {
      kind, bytes, sha256, hasTextLayer,
      // 有文本层走 extract；没有就走 ocr；从来没有"直接放弃"
      route: hasTextLayer ? 'extract' : 'ocr',
      reason: hasTextLayer ? 'PDF 含字体资源与文字绘制算子' : 'PDF 无字体资源或文字算子，判定为扫描件',
    }
  }
  if (kind === 'png' || kind === 'jpeg' || kind === 'heic') {
    return { kind, bytes, sha256, hasTextLayer: false, route: 'ocr', reason: '图片，没有文本层' }
  }
  if (kind === 'text') {
    return { kind, bytes, sha256, hasTextLayer: true, route: 'extract', reason: '纯文本' }
  }
  return { kind, bytes, sha256, hasTextLayer: false, route: 'unsupported', reason: '未识别的文件类型' }
}

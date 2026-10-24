// 零依赖 ZIP 读取：只做「按文件名取一个条目」这一件事。
//
// 为什么手写而不是装包：装机环境是 Desktop 的 harness profile，多一个依赖就多一次装不上的理由；
// 而我们要的只是从 MinerU 的 full zip 里取 full.md 与 content_list.json。
//
// 边界写死在这里，不猜结构：
//   - 只认中央目录（EOCD → CEN → LOCAL），不支持 ZIP64；
//   - 只解 deflate（method 8）与 store（method 0），其余方法直接报错；
//   - 找不到文件就抛 not_found，**不返回半份结果**。
import { inflateRawSync } from 'node:zlib'

const EOCD_SIG = 0x06054b50
const CEN_SIG = 0x02014b50
const LOC_SIG = 0x04034b50
const ZIP64_LOCATOR_SIG = 0x07064b50

/** 从尾部往前找 EOCD：注释最长 65535 字节，所以最多回退这么多。 */
function findEocd(buf) {
  const min = Math.max(0, buf.length - 0xffff - 22)
  for (let i = buf.length - 22; i >= min; i -= 1) {
    if (buf.readUInt32LE(i) === EOCD_SIG) return i
  }
  return -1
}

/** @returns {{name:string,size:number,method:number,offset:number,compressed:number}[]} */
export function listZipEntries(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 22) {
    throw Object.assign(new Error('不是 ZIP：文件太短'), { code: 'bad_zip' })
  }
  const eocd = findEocd(buf)
  if (eocd < 0) throw Object.assign(new Error('不是 ZIP：找不到中央目录结尾'), { code: 'bad_zip' })
  if (eocd >= 20 && buf.readUInt32LE(eocd - 20) === ZIP64_LOCATOR_SIG) {
    throw Object.assign(new Error('不支持 ZIP64（文件超过 4GB 或条目数超限）'), { code: 'zip64_unsupported' })
  }
  const count = buf.readUInt16LE(eocd + 10)
  let p = buf.readUInt32LE(eocd + 16)
  const out = []
  for (let i = 0; i < count; i += 1) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== CEN_SIG) {
      throw Object.assign(new Error('ZIP 中央目录损坏'), { code: 'bad_zip' })
    }
    const method = buf.readUInt16LE(p + 10)
    const compressed = buf.readUInt32LE(p + 20)
    const size = buf.readUInt32LE(p + 24)
    const nameLen = buf.readUInt16LE(p + 28)
    const extraLen = buf.readUInt16LE(p + 30)
    const commentLen = buf.readUInt16LE(p + 32)
    const offset = buf.readUInt32LE(p + 42)
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen)
    out.push({ name, size, method, offset, compressed })
    p += 46 + nameLen + extraLen + commentLen
  }
  return out
}

/** 读一个条目的原始字节。找不到返回 null——调用方负责说清楚缺什么。 */
export function readZipEntry(buf, wanted) {
  const entry = listZipEntries(buf).find((e) => e.name === wanted || e.name.endsWith(`/${wanted}`))
  if (!entry) return null
  const p = entry.offset
  if (p + 30 > buf.length || buf.readUInt32LE(p) !== LOC_SIG) {
    throw Object.assign(new Error(`ZIP 条目头损坏：${entry.name}`), { code: 'bad_zip' })
  }
  const nameLen = buf.readUInt16LE(p + 26)
  const extraLen = buf.readUInt16LE(p + 28)
  const start = p + 30 + nameLen + extraLen
  const raw = buf.subarray(start, start + entry.compressed)
  if (entry.method === 0) return Buffer.from(raw)
  if (entry.method === 8) {
    try {
      return inflateRawSync(raw)
    } catch (error) {
      throw Object.assign(new Error(`ZIP 解压失败：${entry.name}（${error.message}）`), { code: 'bad_zip' })
    }
  }
  throw Object.assign(new Error(`ZIP 压缩方式不支持（${entry.method}）：${entry.name}`), { code: 'bad_zip' })
}

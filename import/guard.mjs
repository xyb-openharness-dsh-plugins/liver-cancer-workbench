// 导入闸门：先判"这份东西是不是本工作台的病"，再谈解析。
//
// 起因：2026-10-24 用一份真实扫描件试跑，抽出来是**胰腺**穿刺病理。
// 如果直接按"病理报告"解析，它会带着一整套腺鳞 panel 落进肝的 A/B 轨——
// 数据一旦写进去，后面每个视图都在错的基线上算。所以闸门必须挡在 extract 之前。

// 词表按"器官名词"组织，长的先匹配（避免「肝细胞癌」被「肝」重复计一次）。
const SITE_LEXICON = {
  liver: ['肝细胞癌', '肝细胞', '肝右叶', '肝左叶', '肝占位', '肝内', '肝脏', '肝硬化', '肝癌', 'HCC', '肝'],
  pancreas: ['胰腺', '胰头', '胰体', '胰尾', '胰'],
  lung: ['肺腺癌', '肺鳞癌', '肺部', '肺'],
  stomach: ['胃窦', '胃体', '胃角', '贲门', '胃癌', '胃'],
  colorectal: ['结直肠', '直肠', '结肠', '肛管'],
  esophagus: ['食管'],
  cervix: ['宫颈'],
  lymphoma: ['淋巴瘤'],
}

const DOMAIN_ZH = {
  liver: '肝细胞癌', pancreas: '胰腺', lung: '肺', stomach: '胃',
  colorectal: '结直肠', esophagus: '食管', cervix: '宫颈', lymphoma: '淋巴瘤', unknown: '无法判定',
}

// 指标组合证据：只列"出现在肝病/肝癌随访里才有意义"的字段名，与 extract.mjs 的 field 同名。
// 注意不含 max_diameter —— 任何部位都在量病灶，它说明不了是哪个器官。
const HEPATIC_PANEL = new Set(['albumin', 'bilirubin', 'inr', 'platelets', 'alt', 'ast', 'afp', 'pivka2'])

// 原发灶信号：词频分不清"原发"和"转移"。
// 「胰腺癌肝转移」按次数算，肝出现 2 次、胰腺 1 次，会被误判成肝癌；
// 但这明明是胰腺原发。所以先认「X癌」这种原发措辞，命中非肝器官直接拒收。
const PRIMARY_RE = /(胰腺|肺|胃|结直肠|结肠|直肠|食管|宫颈|乳腺|淋巴|胆管|前列腺|卵巢)癌/

/** 在文本里数器官词：命中一次记一分，命中过的片段抹掉，避免同一处被长短词各算一次。 */
export function scoreSites(lines) {
  const text = lines.join('\n')
  const scores = {}
  const hits = {}
  for (const [domain, terms] of Object.entries(SITE_LEXICON)) {
    let rest = text
    let n = 0
    const found = []
    for (const term of [...terms].sort((a, b) => b.length - a.length)) {
      const re = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
      const m = rest.match(re)
      if (m) { n += m.length; found.push(term); rest = rest.replace(re, '　') }
    }
    if (n) { scores[domain] = n; hits[domain] = found }
  }
  return { scores, hits }
}

/**
 * 判定这份文件属于哪个病种、能不能进本工作台。
 *
 * 两类证据，优先级不同：
 *   ① 部位词（正文里写了"肝右叶""胰腺"）——强证据，直接定病种；
 *   ② 指标组合（panelFields）——弱证据，只在**没有部位词**时兜底。
 *
 * 为什么需要 ②：外院化验单通常只写"检验报告"和一堆指标，一个器官名都没有。
 * 若只认部位词，"白蛋白 38 / 总胆红素 21.5 / 血小板 118 / AFP 12.4"这种典型肝病随访
 * 会被判成"部位线索不足"全部挡在门外，用户第一次用就卡住。
 *
 * accept               —— 肝相关词占优，或部位缺失但指标组合明确是肝病随访
 * reject_out_of_domain —— 别的器官词占优，候选一行都不写，document.status 置 parse_failed
 * needs_review         —— 证据不足或打平，交给人判断，同样不自动写候选
 */
export function assessDomain(lines, { minScore = 2, panelFields = [] } = {}) {
  const { scores, hits } = scoreSites(lines)
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1])
  const hepaticPanel = panelFields.filter((f) => HEPATIC_PANEL.has(f))
  const text = lines.join('\n')

  // ① 原发灶优先于一切词频：写了"XX癌"且不是肝，就是别的病种，哪怕后面跟了"肝转移"
  const primary = text.match(PRIMARY_RE)
  if (primary) {
    const organ = primary[1]
    const domain = Object.entries(SITE_LEXICON)
      .find(([, terms]) => terms.some((t) => organ.includes(t) || t.includes(organ)))?.[0] ?? 'unknown'
    return {
      domain, verdict: 'reject_out_of_domain', scores, hits, via: 'primary',
      reason: `原发部位是${organ}癌${/肝/.test(text) ? '（文中提到肝，应为转移灶，不按肝癌处理）' : ''}，不属于肝细胞癌工作台`,
    }
  }

  if (!ranked.length) {
    // 一个部位词都没有：交给指标组合判断
    if (hepaticPanel.length >= 2) {
      return {
        domain: 'liver', verdict: 'accept', scores, hits, via: 'panel',
        reason: `未提及部位，但含 ${hepaticPanel.length} 项肝功能/肝癌相关指标（${hepaticPanel.join('、')}）`,
      }
    }
    return {
      domain: 'unknown', verdict: 'needs_review', scores, hits, via: 'none',
      reason: '没有找到器官部位线索',
    }
  }
  const [topDomain, topScore] = ranked[0]
  const second = ranked[1]
  const tied = second && second[1] === topScore

  if (tied) {
    // 同时提到两个器官（如"胰腺癌肝转移"）不猜：这种恰恰是必须人看的情况
    return {
      domain: 'unknown', verdict: 'needs_review', scores, hits, via: 'site',
      reason: `部位线索打平（${ranked.slice(0, 2).map(([d, s]) => `${DOMAIN_ZH[d]} ${s}`).join(' / ')}），无法判定`,
    }
  }
  if (topScore < minScore) {
    // 部位词太少（可能只是标题里带了个字），指标组合够就放行
    if (hepaticPanel.length >= 2 && topDomain === 'liver') {
      return {
        domain: 'liver', verdict: 'accept', scores, hits, via: 'panel',
        reason: `部位线索少（肝 ${topScore} 分），但含 ${hepaticPanel.length} 项肝功能/肝癌相关指标（${hepaticPanel.join('、')}）`,
      }
    }
    return {
      domain: topDomain, verdict: 'needs_review', scores, hits, via: 'site',
      reason: `线索过少（${DOMAIN_ZH[topDomain]} 仅 ${topScore} 分），不足以判定`,
    }
  }
  if (topDomain === 'liver') {
    return {
      domain: 'liver', verdict: 'accept', scores, hits, via: 'site',
      reason: `肝相关线索占优（${topScore} 分：${hits.liver.join('、')}）`,
    }
  }
  return {
    domain: topDomain, verdict: 'reject_out_of_domain', scores, hits, via: 'site',
    reason: `部位是${DOMAIN_ZH[topDomain]}（${topScore} 分：${hits[topDomain].join('、')}），不属于肝细胞癌工作台`,
  }
}

/** 闸门到 document.status 的映射：写库时只认这几个值。 */
export function statusForVerdict(verdict) {
  if (verdict === 'accept') return 'pending_review'
  if (verdict === 'reject_out_of_domain') return 'parse_failed'
  // 线索不足不是"解析失败"——文件是好的，只是没法自动判断。留在"待解析"等人处理。
  return 'pending_parse'
}

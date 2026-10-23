// 小甘宝 HepPal · 演示数据唯一来源
// 规则：本文件被 import 时只导出纯数据，不碰磁盘；直接执行时才写 demo/*.sqlite 与 prototypes/v0.1/demo-data.js。
// 全部为合成数据，不含任何真实患者信息。日期窗口：2026-04 至 2026-10。

const DAY = 86400000;

export function buildDemoProfiles() {
  return [
    {
      id: 'p1',
      name: '陈建国',
      initial: '陈',
      age: 58,
      sex: 'M',
      tag: 'HBV · 初诊不可切除 → 转化评估',
      summary: '乙肝背景、肝硬化，初诊 BCLC B / CNLC IIb，门静脉分支癌栓；已做 2 次 TACE 后转系统治疗，转化评估由不可切除改为临界可切除。',
      baseline: '2026-04-08',
      etiology: 'hbv',
      cirrhosis: 'yes',
      // 化验单自带的参考范围（单位：与 reserve 一致）。指标分析页做 ×ULN 分级时必须用它，
      // 不拿成人通用上限凑倍数——各实验室 ALT 上限 40–55 U/L，一除就能把 2 级说成 1 级。
      labRef: { altHigh: 40, astHigh: 40, bilirubinHigh: 21, albuminLow: 40, inrHigh: 1.2, pltLow: 125 },
      stage: [
        { system: 'BCLC', stage: 'B', statedBy: 'XX 医院肝胆外科门诊', statedOn: '2026-04-15', basis: '多发结节、Child-Pugh A、无肝外转移', current: true },
        { system: 'CNLC', stage: 'IIb', statedBy: 'XX 医院 MDT', statedOn: '2026-04-15', basis: '肿瘤数目 3 个、最大径 62 mm、Vp2', current: true }
      ],
      resectability: [
        { conclusion: 'unresectable', statedBy: 'XX 医院 MDT', statedOn: '2026-04-15', basis: '残肝体积不足、Vp2 癌栓', futureRemnant: '未来残肝 31%', context: 'initial', current: false },
        { conclusion: 'borderline', statedBy: 'XX 医院 MDT', statedOn: '2026-07-15', basis: '癌栓退至 Vp1、最大径 41 mm，需再次评估残肝', futureRemnant: '未来残肝 38%', context: 'post_treatment', current: false },
        { conclusion: 'resectable', statedBy: 'XX 医院 MDT', statedOn: '2026-09-20', basis: '癌栓消失、单灶 24 mm、残肝 46%', futureRemnant: '未来残肝 46%', context: 'post_treatment', current: true }
      ],
      // A 轨：肝功能储备。四点位思路的 HCC 版本：任一评分成分缺测则不给评分，NULL 不等于 0。
      reserve: [
        { on: '2026-04-08', albumin: 36, bilirubin: 28, inr: 1.25, platelets: 92, alt: 54, ast: 61, childScore: 6, childClass: 'A', ascites: 'none', enceph: 'none', state: 'reported' },
        { on: '2026-04-29', albumin: 35, bilirubin: 32, inr: 1.28, platelets: 84, alt: 48, ast: 55, childScore: 6, childClass: 'A', ascites: 'none', enceph: 'none', state: 'reported' },
        { on: '2026-05-27', albumin: 34, bilirubin: 26, inr: 1.24, platelets: 78, alt: 44, ast: 52, childScore: 6, childClass: 'A', ascites: 'none', enceph: 'none', state: 'reported' },
        { on: '2026-06-10', albumin: 33, bilirubin: 24, inr: 1.22, platelets: 72, alt: 41, ast: 49, childScore: 6, childClass: 'A', ascites: 'none', enceph: 'none', state: 'reported' },
        { on: '2026-07-15', albumin: 32, bilirubin: 34, inr: 1.31, platelets: 66, alt: 96, ast: 88, childScore: 7, childClass: 'B', ascites: 'mild', enceph: 'none', state: 'reported' },
        { on: '2026-08-19', albumin: 34, bilirubin: 22, inr: 1.18, platelets: 70, alt: 58, ast: 54, childScore: 6, childClass: 'A', ascites: 'none', enceph: 'none', state: 'reported' },
        { on: '2026-09-22', albumin: 35, bilirubin: 20, inr: 1.14, platelets: 76, alt: 42, ast: 40, childScore: 5, childClass: 'A', ascites: 'none', enceph: 'none', state: 'reported' },
        { on: '2026-10-14', albumin: 35, bilirubin: 19, inr: 1.12, platelets: 80, alt: 38, ast: 36, childScore: 5, childClass: 'A', ascites: 'none', enceph: 'none', state: 'reported' }
      ],
      // B 轨：肿瘤负荷
      tumor: [
        { on: '2026-04-08', modality: 'mri', count: 3, maxMm: 62, liRads: 'LR-5', vp: 'Vp2', extrahepatic: 'no', afp: 1280, pivka2: 4200, lesions: [{ seq: 1, segment: 'S8', size: 62 }, { seq: 2, segment: 'S4', size: 28 }, { seq: 3, segment: 'S6', size: 19 }] },
        { on: '2026-04-29', modality: 'ct', count: 3, maxMm: 58, liRads: 'LR-5', vp: 'Vp2', extrahepatic: 'no', afp: 960, pivka2: 3100, lesions: [] },
        { on: '2026-05-27', modality: 'mri', count: 3, maxMm: 52, liRads: 'LR-5', vp: 'Vp2', extrahepatic: 'no', afp: 420, pivka2: 1800, lesions: [] },
        { on: '2026-06-10', modality: 'ct', count: 3, maxMm: 48, liRads: 'LR-5', vp: 'Vp1', extrahepatic: 'no', afp: 260, pivka2: 1100, lesions: [] },
        { on: '2026-07-15', modality: 'mri', count: 2, maxMm: 41, liRads: 'LR-4', vp: 'Vp1', extrahepatic: 'no', afp: 210, pivka2: 640, lesions: [{ seq: 1, segment: 'S8', size: 41 }, { seq: 2, segment: 'S4', size: 14 }] },
        { on: '2026-08-19', modality: 'mri', count: 2, maxMm: 36, liRads: 'LR-4', vp: 'Vp0', extrahepatic: 'no', afp: 120, pivka2: 320, lesions: [] },
        { on: '2026-09-22', modality: 'mri', count: 1, maxMm: 24, liRads: 'LR-4', vp: 'Vp0', extrahepatic: 'no', afp: 38, pivka2: 96, lesions: [{ seq: 1, segment: 'S8', size: 24 }] },
        { on: '2026-10-14', modality: 'ct', count: 1, maxMm: 22, liRads: 'LR-4', vp: 'Vp0', extrahepatic: 'no', afp: 26, pivka2: 74, lesions: [] }
      ],
      treatments: [
        { modality: 'tace', intent: 'palliative', line: 1, regimen: 'TACE（表柔比星 + 碘油）', startedOn: '2026-04-22', endedOn: '2026-04-24', cyclesPlanned: 2, cyclesDone: 2, response: '术后 1 个月 AFP 下降，存活肿瘤缩小', stopReason: '', institution: 'XX 医院介入科' },
        { modality: 'tace', intent: 'palliative', line: 2, regimen: 'TACE（表柔比星 + 碘油）', startedOn: '2026-05-27', endedOn: '2026-05-29', cyclesPlanned: 2, cyclesDone: 2, response: '部分缓解（mRECIST，医生记录）', stopReason: '转系统治疗评估', institution: 'XX 医院介入科' },
        { modality: 'systemic', intent: 'conversion', line: 1, regimen: '仑伐替尼 + 信迪利单抗', startedOn: '2026-06-10', endedOn: '', cyclesPlanned: 6, cyclesDone: 4, response: '持续缩小，转化评估中（医生记录）', stopReason: '', institution: 'XX 医院肿瘤内科' }
      ],
      safety: [
        { kind: 'post_embolization', onsetOn: '2026-04-24', resolvedOn: '2026-04-28', grade: '2 级（医生记录）', description: '发热 38.5℃、右上腹疼痛、恶心', action: '按介入科交代处理，已缓解' },
        { kind: 'liver_toxicity', onsetOn: '2026-07-12', resolvedOn: '2026-08-05', grade: '2 级（CTCAE 医生记录）', description: 'ALT 96、AST 88、总胆红素 34', action: '医生调整靶免剂量，2 周后复查' },
        { kind: 'variceal_bleed', onsetOn: '2026-04-18', resolvedOn: '2026-04-21', grade: '未分级（病历原文）', description: '黑便 1 次，胃镜见食管静脉中度曲张', action: '套扎 1 次，加用降门压药' }
      ],
      portal: [
        { on: '2026-04-18', varices: 'medium', bleed: 'yes', banding: '2026-04-19 套扎 1 次', betaBlocker: '普萘洛尔（医生处方）', spleenMm: 142, portalVeinMm: 14 },
        { on: '2026-08-19', varices: 'small', bleed: 'no', banding: '无新增', betaBlocker: '普萘洛尔（医生处方）', spleenMm: 136, portalVeinMm: 13 }
      ],
      hbv: [
        { on: '2026-04-08', hbsag: 'positive', dna: 2100, dnaState: 'detected', antiviral: '恩替卡韦', antiviralStart: '2026-04-09', prophylaxis: 'yes', screeningBefore: '2026-06-08' },
        { on: '2026-07-15', hbsag: 'positive', dna: 0, dnaState: 'undetected', antiviral: '恩替卡韦', antiviralStart: '2026-04-09', prophylaxis: 'yes', screeningBefore: '2026-06-08' },
        { on: '2026-10-14', hbsag: 'positive', dna: 0, dnaState: 'undetected', antiviral: '恩替卡韦', antiviralStart: '2026-04-09', prophylaxis: 'yes', screeningBefore: '2026-06-08' }
      ],
      family: [
        { relation: '配偶', hbsag: 'negative', vaccinated: 'yes', checkedOn: '2026-04-20', note: '已完成三针' },
        { relation: '儿子（29 岁）', hbsag: 'not_tested', vaccinated: 'unknown', checkedOn: '', note: '尚未筛查' }
      ],
      nutrition: [
        { on: '2026-04-08', weight: 68.0, height: 172, calf: 34.0, grip: 29, appetite: 'fair', salt: '每日食盐 5 g 以下（医生交代）', fluid: '' },
        { on: '2026-06-10', weight: 66.2, height: 172, calf: 33.2, grip: 27, appetite: 'fair', salt: '每日食盐 5 g 以下（医生交代）', fluid: '' },
        { on: '2026-08-19', weight: 64.8, height: 172, calf: 32.6, grip: 26, appetite: 'poor', salt: '每日食盐 5 g 以下（医生交代）', fluid: '' },
        { on: '2026-10-14', weight: 65.4, height: 172, calf: 33.0, grip: 27, appetite: 'fair', salt: '每日食盐 5 g 以下（医生交代）', fluid: '' }
      ],
      symptoms: [
        { on: '2026-05-02', symptom: '乏力', severity: 5, note: '午后明显' },
        { on: '2026-07-18', symptom: '乏力', severity: 6, note: '靶免开始后加重' },
        { on: '2026-08-20', symptom: '腹泻', severity: 3, note: '每日 2 次' },
        { on: '2026-10-10', symptom: '乏力', severity: 4, note: '' }
      ],
      viewpoints: [
        { on: '2026-07-16', topic: '对“转化”的理解', body: '医生说从不能切变成临界，我理解为还有机会，但也担心开了刀肝不够用。', source: 'self' },
        { on: '2026-09-21', topic: '关于手术', body: '这次说可以切了，我反而更紧张，怕切完复发。', source: 'self' }
      ],
      visits: [
        { on: '2026-04-15', dept: '肝胆外科 MDT', purpose: '初诊分期与可切除性', summary: 'BCLC B / CNLC IIb，不可切除，先介入', nextOn: '2026-04-22' },
        { on: '2026-07-15', dept: '肝胆外科 MDT', purpose: '转化评估', summary: '临界可切除，继续系统治疗 2 周期后复查', nextOn: '2026-09-20' },
        { on: '2026-09-20', dept: '肝胆外科 MDT', purpose: '术前评估', summary: '可切除，建议择期手术', nextOn: '2026-10-20' }
      ],
      questions: [
        { on: '2026-07-15', body: '癌栓退到 Vp1 意味着什么？', answered: '医生：说明治疗有效，但仍需看残肝体积' },
        { on: '2026-09-20', body: '手术要切多少肝？剩下的够用吗？', answered: '' },
        { on: '2026-09-20', body: '术前要不要停靶免？停多久？', answered: '' }
      ],
      tasks: [
        { title: '术前增强 CT 与残肝体积评估', dueOn: '2026-10-24', doneOn: '', kind: 'test' },
        { title: '把 7 月与 9 月的 MDT 结论拍照归档', dueOn: '2026-10-25', doneOn: '', kind: 'other' }
      ],
      // 血常规：靶免与介入期间的真实关注点。CTCAE v5.0 血液学四项有绝对阈值，可直接对照。
      // 2026-08-19 那次是治疗后骨髓抑制的低点（WBC 3.6 / ANC 1.9 / Hgb 108 / PLT 70），
      // 只给出数值与级，不写"要不要停药"。
      cbc: [
        { on: '2026-04-08', wbc: 5.8, anc: 3.4, hgb: 141, plt: 92 },
        { on: '2026-04-29', wbc: 5.1, anc: 2.9, hgb: 133, plt: 84 },
        { on: '2026-05-27', wbc: 4.6, anc: 2.5, hgb: 129, plt: 78 },
        { on: '2026-07-15', wbc: 4.2, anc: 2.2, hgb: 122, plt: 66 },
        { on: '2026-08-19', wbc: 3.6, anc: 1.9, hgb: 108, plt: 70 },
        { on: '2026-09-22', wbc: 4.4, anc: 2.4, hgb: 118, plt: 76 },
        { on: '2026-10-14', wbc: 5.0, anc: 2.8, hgb: 125, plt: 80 }
      ],
      // 心理与家庭：私密区。owner='caregiver' 的条目属于照护者自己，不写成患者症状。
      mind: [
        { on: '2026-07-16', owner: 'patient', topic: '害怕开刀', body: '一说可以切了，我反倒整夜睡不着，怕切完肝不够用。', private: true },
        { on: '2026-08-20', owner: 'patient', topic: '腹泻那阵子', body: '一天跑两三次厕所，不敢出门，也没跟医生说。', private: true },
        { on: '2026-09-18', owner: 'caregiver', topic: '家属自己的累', body: '陪了五个月，最近上班老走神，但不想让他看出来。', private: true }
      ],
      trials: [
        { source: 'ClinicalTrials.gov', sourceId: 'NCT00000001', title: '示例：不可切除 HCC 转化治疗后手术的前瞻研究', phase: 'II', status: '登记状态，未核实', site: '上海（待核实）' }
      ]
    },
    {
      id: 'p2',
      name: '李慧',
      initial: '李',
      age: 46,
      sex: 'F',
      tag: 'HBV · 早期切除术后随访',
      summary: '乙肝背景、无临床肝硬化，单发 32 mm 结节，2026-05 行肝段切除，病理 MVI 阴性、切缘阴性；目前术后随访，无复发证据。',
      baseline: '2026-04-20',
      etiology: 'hbv',
      cirrhosis: 'no',
      labRef: { altHigh: 40, astHigh: 40, bilirubinHigh: 21, albuminLow: 40, inrHigh: 1.2, pltLow: 125 },
      stage: [
        { system: 'BCLC', stage: '0/A', statedBy: 'XX 医院肝胆外科', statedOn: '2026-04-26', basis: '单发 32 mm、Child-Pugh A、无血管侵犯', current: true },
        { system: 'CNLC', stage: 'Ia', statedBy: 'XX 医院肝胆外科', statedOn: '2026-04-26', basis: '单发、无血管侵犯、无肝外转移', current: true }
      ],
      resectability: [
        { conclusion: 'resectable', statedBy: 'XX 医院肝胆外科', statedOn: '2026-04-26', basis: '单发 S6、残肝充足', futureRemnant: '未来残肝 68%', context: 'initial', current: true }
      ],
      reserve: [
        { on: '2026-04-20', albumin: 42, bilirubin: 14, inr: 1.02, platelets: 188, alt: 32, ast: 36, childScore: 5, childClass: 'A', ascites: 'none', enceph: 'none', state: 'reported' },
        { on: '2026-05-06', albumin: 39, bilirubin: 19, inr: 1.12, platelets: 164, alt: 68, ast: 74, childScore: 5, childClass: 'A', ascites: 'none', enceph: 'none', state: 'reported' },
        { on: '2026-07-10', albumin: 43, bilirubin: 12, inr: 1.0, platelets: 196, alt: 26, ast: 28, childScore: 5, childClass: 'A', ascites: 'none', enceph: 'none', state: 'reported' },
        { on: '2026-10-12', albumin: 43, bilirubin: 11, inr: 0.98, platelets: 202, alt: 22, ast: 24, childScore: 5, childClass: 'A', ascites: 'none', enceph: 'none', state: 'reported' }
      ],
      tumor: [
        { on: '2026-04-20', modality: 'mri', count: 1, maxMm: 32, liRads: 'LR-5', vp: 'Vp0', extrahepatic: 'no', afp: 46, pivka2: 88, lesions: [{ seq: 1, segment: 'S6', size: 32 }] },
        { on: '2026-05-06', modality: 'pathology', count: 1, maxMm: 32, liRads: 'unknown', vp: 'Vp0', extrahepatic: 'no', afp: null, pivka2: null, lesions: [{ seq: 1, segment: 'S6', size: 32 }] },
        { on: '2026-07-10', modality: 'ct', count: 0, maxMm: null, liRads: 'LR-NC', vp: 'Vp0', extrahepatic: 'no', afp: 8.4, pivka2: 31, lesions: [] },
        { on: '2026-10-12', modality: 'mri', count: 0, maxMm: null, liRads: 'LR-1', vp: 'Vp0', extrahepatic: 'no', afp: 5.1, pivka2: 24, lesions: [] }
      ],
      treatments: [
        { modality: 'resection', intent: 'curative', line: 1, regimen: '腹腔镜肝 S6 段切除', startedOn: '2026-05-06', endedOn: '2026-05-13', cyclesPlanned: 1, cyclesDone: 1, response: '病理：中分化 HCC，32 mm，MVI(-)，切缘阴性', stopReason: '', institution: 'XX 医院肝胆外科' }
      ],
      safety: [
        { kind: 'other', onsetOn: '2026-05-14', resolvedOn: '2026-05-25', grade: '1 级（医生记录）', description: '切口周围麻木与牵拉感', action: '观察，逐步恢复' }
      ],
      portal: [
        { on: '2026-04-20', varices: 'none', bleed: 'no', banding: '无', betaBlocker: '无', spleenMm: 108, portalVeinMm: 11 }
      ],
      hbv: [
        { on: '2026-04-20', hbsag: 'positive', dna: 0, dnaState: 'undetected', antiviral: '富马酸丙酚替诺福韦（TAF）', antiviralStart: '2025-03-01', prophylaxis: 'yes', screeningBefore: '2026-04-20' },
        { on: '2026-10-12', hbsag: 'positive', dna: 0, dnaState: 'undetected', antiviral: '富马酸丙酚替诺福韦（TAF）', antiviralStart: '2025-03-01', prophylaxis: 'yes', screeningBefore: '2026-04-20' }
      ],
      family: [
        { relation: '母亲', hbsag: 'positive', vaccinated: 'unknown', checkedOn: '2026-05-01', note: '可能的家庭内传播来源，已建议随访（医生记录）' },
        { relation: '女儿（16 岁）', hbsag: 'negative', vaccinated: 'yes', checkedOn: '2026-05-01', note: '出生时完成全程接种' }
      ],
      nutrition: [
        { on: '2026-04-20', weight: 56.0, height: 160, calf: 33.0, grip: 22, appetite: 'good', salt: '', fluid: '' },
        { on: '2026-07-10', weight: 55.2, height: 160, calf: 32.8, grip: 23, appetite: 'good', salt: '', fluid: '' },
        { on: '2026-10-12', weight: 56.4, height: 160, calf: 33.2, grip: 24, appetite: 'good', salt: '', fluid: '' }
      ],
      symptoms: [
        { on: '2026-06-02', symptom: '易疲劳', severity: 3, note: '下午明显' },
        { on: '2026-09-15', symptom: '易疲劳', severity: 1, note: '' }
      ],
      viewpoints: [
        { on: '2026-06-10', topic: '术后担心', body: '每次复查前一周都睡不好，怕 AFP 涨。', source: 'self' }
      ],
      visits: [
        { on: '2026-04-26', dept: '肝胆外科', purpose: '术前评估', summary: '可切除，拟腹腔镜 S6 切除', nextOn: '2026-05-06' },
        { on: '2026-07-10', dept: '肝胆外科', purpose: '术后 2 个月复查', summary: '恢复好，影像无复发', nextOn: '2026-10-12' },
        { on: '2026-10-12', dept: '肝胆外科', purpose: '术后 5 个月复查', summary: '无复发证据，继续随访', nextOn: '2027-01-10' }
      ],
      questions: [
        { on: '2026-10-12', body: '下次复查是 3 个月还是 6 个月？', answered: '医生：3 个月' }
      ],
      cbc: [
        { on: '2026-04-20', wbc: 6.2, anc: 3.8, hgb: 128, plt: 188 },
        { on: '2026-05-06', wbc: 7.4, anc: 5.1, hgb: 119, plt: 164 },
        { on: '2026-07-10', wbc: 5.6, anc: 3.3, hgb: 126, plt: 196 },
        { on: '2026-10-12', wbc: 5.9, anc: 3.5, hgb: 131, plt: 202 }
      ],
      mind: [
        { on: '2026-06-10', owner: 'patient', topic: '复查前一周', body: '每次复查前一周都睡不好，怕 AFP 涨。', private: true },
        { on: '2026-09-15', owner: 'patient', topic: '回到工作', body: '想回去上班，又怕同事问起，还没想好怎么说。', private: true }
      ],
      tasks: [
        { title: '2027-01 复查 AFP + 增强 MRI', dueOn: '2027-01-10', doneOn: '', kind: 'test' }
      ],
      trials: []
    }
  ];
}

// ---- CLI：只在直接执行时写文件 ----
if (import.meta.url === `file://${process.argv[1]}`) {
  const { writeFileSync, mkdirSync, readFileSync } = await import('node:fs');
  const { dirname, join } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const { DatabaseSync } = await import('node:sqlite');

  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const profiles = buildDemoProfiles();
  mkdirSync(join(root, 'prototypes/v0.1'), { recursive: true });
  mkdirSync(join(root, 'demo'), { recursive: true });

  // 1) 原型数据（file:// 可直接加载，无构建）
  writeFileSync(
    join(root, 'prototypes/v0.1/demo-data.js'),
    `// 生成物，勿手改。来源：demo/build-demo-data.mjs\nwindow.DEMO_DATA = ${JSON.stringify({ generatedAt: '2026-10-22', profiles }, null, 1)};\n`
  );

  // 2) 演示库
  // 迁移必须按目录顺序全跑，不能硬编码文件名：新增 0003 之后如果只 exec 0001/0002，
  // 演示库会缺列，而 openDatabase 的"老库引导"看到 profile 表存在会把这些迁移登记成
  // "已应用"却不执行——结构悄悄落后一个版本，直到某个 SELECT 报 no such column 才暴露。
  const dbPath = join(root, 'demo/demo-data.sqlite');
  try { (await import('node:fs')).unlinkSync(dbPath); } catch {}
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(`CREATE TABLE IF NOT EXISTS _migration (
    name TEXT PRIMARY KEY, sha256 TEXT NOT NULL, applied_at TEXT NOT NULL)`);
  const { readdirSync } = await import('node:fs');
  const { createHash } = await import('node:crypto');
  const migrationFiles = readdirSync(join(root, 'schema')).filter((f) => /^\d{4}_.+\.sql$/.test(f)).sort();
  for (const name of migrationFiles) {
    const sql = readFileSync(join(root, 'schema', name));
    db.exec(sql.toString('utf8'));
    db.prepare('INSERT INTO _migration (name, sha256, applied_at) VALUES (?, ?, ?)')
      .run(name, createHash('sha256').update(sql).digest('hex'), '2026-10-22T00:00:00+08:00');
  }

  const now = '2026-10-22T00:00:00+08:00';
  db.prepare('INSERT INTO workspace (id, root_path, created_at, updated_at) VALUES (1, NULL, ?, ?)').run(now, now);

  const insProfile = db.prepare('INSERT INTO profile (id,name,initial,age,sex,tag,is_demo,created_at) VALUES (?,?,?,?,?,?,1,?)');
  const insBg = db.prepare('INSERT INTO liver_background (profile_id,etiology,cirrhosis,recorded_on,created_at) VALUES (?,?,?,?,?)');
  const insStage = db.prepare('INSERT INTO stage_assertion (profile_id,system,stage,stated_by,stated_on,basis,is_current,created_at) VALUES (?,?,?,?,?,?,?,?)');
  const insResect = db.prepare('INSERT INTO resectability_assertion (profile_id,conclusion,stated_by,stated_on,basis,future_remnant,context,is_current,created_at) VALUES (?,?,?,?,?,?,?,?,?)');
  const insReserve = db.prepare(`INSERT INTO liver_reserve (profile_id,measured_on,albumin_g_l,bilirubin_umol_l,inr,platelets_1e9_l,alt_u_l,ast_u_l,child_pugh_score,child_pugh_class,ascites_grade,encephalopathy_grade,result_state,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insTumor = db.prepare(`INSERT INTO tumor_assessment (profile_id,assessed_on,modality,lesion_count,max_diameter_mm,li_rads,portal_vein_thrombus,extrahepatic,afp_ng_ml,pivka2_mau_ml,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  const insLesion = db.prepare('INSERT INTO tumor_lesion (assessment_id,seq,segment,size_mm) VALUES (?,?,?,?)');
  const insTx = db.prepare(`INSERT INTO treatment_event (profile_id,modality,intent,line_no,regimen,started_on,ended_on,cycles_planned,cycles_done,response,stop_reason,institution,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insSafety = db.prepare(`INSERT INTO safety_event (profile_id,kind,onset_on,resolved_on,grade,description,action_recorded,created_at)
    VALUES (?,?,?,?,?,?,?,?)`);
  const insPortal = db.prepare(`INSERT INTO portal_hypertension (profile_id,assessed_on,varices_grade,bleed_history,banding,beta_blocker,spleen_mm,portal_vein_mm,created_at)
    VALUES (?,?,?,?,?,?,?,?,?)`);
  const insHbv = db.prepare(`INSERT INTO hbv_record (profile_id,measured_on,hbsag,hbv_dna_iu_ml,hbv_dna_state,antiviral,antiviral_start,prophylaxis,screening_before,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)`);
  const insFamily = db.prepare('INSERT INTO family_screening (profile_id,relation,hbsag,vaccinated,checked_on,note,created_at) VALUES (?,?,?,?,?,?,?)');
  const insNutri = db.prepare('INSERT INTO nutrition_record (profile_id,measured_on,weight_kg,height_cm,calf_cm,grip_kg,appetite,salt_restriction,fluid_limit,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)');
  const insSymptom = db.prepare('INSERT INTO symptom_record (profile_id,recorded_on,symptom,severity,note,created_at) VALUES (?,?,?,?,?,?)');
  const insView = db.prepare('INSERT INTO viewpoint (profile_id,recorded_on,topic,body,source,visibility,created_at) VALUES (?,?,?,?,?,?,?)');
  const insVisit = db.prepare('INSERT INTO visit (profile_id,visited_on,department,purpose,summary,next_on,created_at) VALUES (?,?,?,?,?,?,?)');
  const insQ = db.prepare('INSERT INTO question (profile_id,created_on,body,answered,created_at) VALUES (?,?,?,?,?)');
  const insTask = db.prepare('INSERT INTO task (profile_id,title,due_on,done_on,kind,created_at) VALUES (?,?,?,?,?,?)');
  const insTrial = db.prepare('INSERT INTO trial_ref (profile_id,source,source_id,title,phase,status_text,site_text,added_on) VALUES (?,?,?,?,?,?,?,?)');
  // 血常规与肌少症：走 metric_reading，与 reserve/tumor 业务表分开——同一份值允许两处出现，
  // 但事实层的唯一来源是这里；业务表只存"这次就诊的记录形态"。
  const insReading = db.prepare('INSERT INTO metric_reading (profile_id,metric_id,measured_on,value_num,unit,created_at) VALUES (?,?,?,?,?,?)');
  const CBC_UNIT = { wbc: '10⁹/L', anc: '10⁹/L', hgb: 'g/L' };

  db.exec('BEGIN');
  try {
    for (const p of profiles) {
      insProfile.run(p.id, p.name, p.initial, p.age, p.sex, p.tag, now);
      insBg.run(p.id, p.etiology, p.cirrhosis, p.baseline, now);
      for (const s of p.stage) insStage.run(p.id, s.system, s.stage, s.statedBy, s.statedOn, s.basis, s.current ? 1 : 0, now);
      for (const r of p.resectability) insResect.run(p.id, r.conclusion, r.statedBy, r.statedOn, r.basis, r.futureRemnant, r.context, r.current ? 1 : 0, now);
      for (const r of p.reserve) insReserve.run(p.id, r.on, r.albumin, r.bilirubin, r.inr, r.platelets, r.alt, r.ast, r.childScore, r.childClass, r.ascites, r.enceph, r.state, now);
      for (const t of p.tumor) {
        const res = insTumor.run(p.id, t.on, t.modality, t.count, t.maxMm, t.liRads === 'unknown' ? null : t.liRads, t.vp, t.extrahepatic, t.afp, t.pivka2, now);
        for (const l of t.lesions) insLesion.run(Number(res.lastInsertRowid), l.seq, l.segment, l.size);
      }
      for (const t of p.treatments) insTx.run(p.id, t.modality, t.intent, t.line, t.regimen, t.startedOn, t.endedOn || null, t.cyclesPlanned, t.cyclesDone, t.response, t.stopReason || null, t.institution, now);
      for (const s of p.safety) insSafety.run(p.id, s.kind, s.onsetOn, s.resolvedOn || null, s.grade, s.description, s.action, now);
      for (const x of p.portal) insPortal.run(p.id, x.on, x.varices, x.bleed, x.banding, x.betaBlocker, x.spleenMm, x.portalVeinMm, now);
      for (const x of p.hbv) insHbv.run(p.id, x.on, x.hbsag, x.dna, x.dnaState, x.antiviral, x.antiviralStart, x.prophylaxis, x.screeningBefore, now);
      for (const x of p.family) insFamily.run(p.id, x.relation, x.hbsag, x.vaccinated, x.checkedOn || null, x.note, now);
      for (const x of p.nutrition) insNutri.run(p.id, x.on, x.weight, x.height, x.calf, x.grip, x.appetite, x.salt, x.fluid, now);
      for (const x of p.symptoms) insSymptom.run(p.id, x.on, x.symptom, x.severity, x.note, now);
      for (const x of p.viewpoints) insView.run(p.id, x.on, x.topic, x.body, x.source, 'shared', now);
      for (const x of p.visits) insVisit.run(p.id, x.on, x.dept, x.purpose, x.summary, x.nextOn, now);
      for (const x of p.questions) insQ.run(p.id, x.on, x.body, x.answered, now);
      for (const x of p.tasks) insTask.run(p.id, x.title, x.dueOn, x.doneOn || null, x.kind, now);
      for (const x of p.trials) insTrial.run(p.id, x.source, x.sourceId, x.title, x.phase, x.status, x.site, now);
      for (const x of p.cbc || []) {
        for (const k of ['wbc', 'anc', 'hgb']) {
          if (x[k] == null) continue;
          insReading.run(p.id, k, x.on, x[k], CBC_UNIT[k], now);
        }
      }
      for (const x of p.nutrition) {
        insReading.run(p.id, 'calf', x.on, x.calf, 'cm', now);
        insReading.run(p.id, 'grip', x.on, x.grip, 'kg', now);
      }
      // 心理记录与「我想说的」同表不同 source：caregiver 的条目属于照护者自己，
      // 读模型必须能分开取，不能把家属的感受算成患者的症状。
      for (const x of p.mind || []) insView.run(p.id, x.on, x.topic, x.body, x.owner === 'caregiver' ? 'caregiver' : 'self', 'private', now);
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  const count = db.prepare('SELECT COUNT(*) AS n FROM profile').get().n;
  db.close();
  console.log(JSON.stringify({ profiles: count, sqlite: dbPath, proto: 'prototypes/v0.1/demo-data.js' }));
}

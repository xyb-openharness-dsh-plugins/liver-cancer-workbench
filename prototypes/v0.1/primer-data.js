/* 小甘宝 HepPal · 疾病概要数据（36 号）
 * 口径：docs/DISEASE-PRIMER.md；规范：starter docs/36-DISEASE-PRIMER.md。
 * 全部内容属第 ② 层（解释）：只写定义、文件、指南列举过的手段、已发生的变化。
 * 任何「你该怎么办」的判断都不在这里，固定出口是「这一句需要问你的医生」。
 *
 * 原件状态照实写：本项目未取得 BCLC / CNLC / AJCC / NCCN 的指南原件，
 * 版本号凡本项目 docs 与原型源码里查不到的，一律写「版本未核实」，页码一律「页码待核」。
 */
window.DISEASE_PRIMER = {
  brand: '小甘宝 HepPal',
  name: '肝细胞癌',
  en: 'Hepatocellular Carcinoma（HCC）',
  updated: '2026-10-25',
  sections: [
    {
      id: 'definition',
      title: '定义',
      intro: '肝细胞癌是起源于肝细胞的恶性肿瘤，属于原发性肝癌的一种。这个病有三条各自独立的线：肝功能储备、肿瘤负荷、门脉高压。'
        + '这三条线并列记录，不相加、不互相换算——本台不把它们压成一个分数。',
      points: [
        '肝功能储备是第一条线：白蛋白、总胆红素、INR、腹水、肝性脑病构成 Child-Pugh 的五个成分，ALBI 用白蛋白与胆红素派生。Child-Pugh 评分与分级只存医生记录，本台不重算、不按化验值反推。',
        '肿瘤负荷是第二条线：结节数目、最大径、段位、血管侵犯（Vp0–Vp4）、肝外扩散，以及 AFP / PIVKA-II。血管侵犯记的是癌栓位置，不是肿瘤大小，两者不能互相推算。',
        '门脉高压是第三条独立风险线：血小板、脾大、食管胃底静脉曲张、腹水各自记录；它不是前两条线的合计项，也不能由肿瘤大小推出来。',
        '分期体系至少三套并存：BCLC（0 / A / B / C / D）、CNLC 2022（Ia / Ib / IIa / IIb / IIIa / IIIb / IV）、AJCC/UICC TNM（只有切除后才完整）。三套不换算，本台只记录「医生说的是哪一套」，并列展示。',
        '病因是背景维度，不是分期变量：HBV、HCV、酒精、MASLD 各自记录抗病毒药、饮酒量、代谢情况，与肿瘤分期分开保存。'
      ],
      sources: [
        { org: 'BCLC', doc: 'Barcelona Clinic Liver Cancer 分期体系（0/A/B/C/D）', version: '版本未核实', original: false, page: '页码待核' },
        { org: 'CNLC', doc: '中国肝癌分期 CNLC 2022（Ia–IV）', version: '2022', original: false, page: '页码待核' },
        { org: 'AJCC / UICC', doc: 'TNM 分期（肝细胞癌章节）', version: '版本未核实', original: false, page: '页码待核' }
      ]
    },
    {
      id: 'evidence',
      title: '医学资料规范和指南情况',
      intro: '这台工作台里出现的每一条「该查什么、该怎么分期」，都应能追到下面某一份文件。'
        + '本项目对下列文件都没有取得原件——表格里照实写，不假装看过。',
      table: {
        head: ['机构', '文件', '版本 / 年份', '原件', '本台的用途'],
        rows: [
          ['BCLC', 'Barcelona Clinic Liver Cancer 分期体系', '版本未核实', '未取得原件', '记录医生写的 BCLC 期别（0 / A / B / C / D），不换算'],
          ['CNLC', '中国肝癌分期 CNLC 2022', '2022', '未取得原件', '记录医生写的国内分期（Ia–IV），与 BCLC 两行并列'],
          ['AJCC / UICC', 'TNM 分期（肝细胞癌章节）', '版本未核实', '未取得原件', '记录 pTNM 原文；只有切除后才完整'],
          ['NCCN', 'NCCN Guidelines · Hepatocellular Carcinoma', '版本未核实（本项目未采用其分期口径）', '未取得原件', '仅作外部对照，不作为本台的分期或路径依据']
        ]
      },
      points: [
        '指南给的是「通常怎么做」，不是「你该怎么做」。版本号必须写清：同一份指南隔一年，条目会变。',
        '本项目 docs/HCC-DOMAIN.md 只记录了 BCLC、CNLC 2022、AJCC/UICC TNM 三套分期的存在与字段，没有记录任何一份指南的版本号与生效日期；查不到的就不写数字。',
        'BCLC 与 CNLC 并存时不换算：两行并列，各自标出处，各自保留医生原话。任何「换算成另一套」的写法都会造出一个原文里没有的期别。',
        '国内分期与 TNM 也不换算。TNM 只有切除后的病理才完整，术前拿临床资料套 TNM 属于越界。'
      ],
      sources: [
        { org: 'BCLC', doc: 'Barcelona Clinic Liver Cancer 分期体系', version: '版本未核实', original: false, page: '页码待核' },
        { org: 'CNLC', doc: '中国肝癌分期 CNLC 2022', version: '2022', original: false, page: '页码待核' },
        { org: 'AJCC / UICC', doc: 'TNM 分期（肝细胞癌章节）', version: '版本未核实', original: false, page: '页码待核' }
      ]
    },
    {
      id: 'landscape',
      title: '目前治疗全景概要',
      intro: '下面按可切除性与线序列出指南里出现过的手段类别。这是「世界上大致有哪些办法」的地图，不是给你排的先后顺序，'
        + '也不含任何剂量、疗程与适用条件——那些必须由医生按你的肝功能与影像决定。',
      groups: [
        {
          label: '局限期（可切除时）',
          points: [
            '手术切除：记录术式、切缘、病理（分化、MVI）与残肝比例；切缘按病理报告原文记 R0 / R1 / R2，本台不改写、不解读。',
            '消融（RFA / MWA）：记录次数与部位；适用于哪一类病灶由医生按影像判断。',
            '移植评估：本台只记录评估结论与评估日期，不做移植后管理，也不判断是否进入等待名单。'
          ]
        },
        {
          label: '不可切除 / 局部晚期',
          points: [
            'TACE / HAIC：记录次数、起止日期与栓塞后事件（发热、腹痛、恶心）。',
            '钇-90（TARE）与放疗：按方案原文记录，不把不同照射方式合并成一行。',
            '系统治疗：靶向、免疫、联合方案各自记录方案名、周期、疗效原文与肝毒性；本台不判断换药或停药。'
          ]
        },
        {
          label: '贯穿全程的三件事',
          points: [
            '转化治疗：intent 记为 conversion，每次可切除性评估新增一行，前后两次评估并列保存，不合并成「已转化」。',
            '抗病毒与再激活监测：HBV 背景者记录抗病毒药名与开始日期、DNA 由阴转阳的日期，与免疫/激素/化疗时间对齐。',
            '肝功能与门脉高压随访：白蛋白、胆红素、INR、血小板各自成线；食管胃底静脉曲张与腹水单独记录，不并入肿瘤负荷。'
          ]
        }
      ],
      points: [
        '以上是文献与指南里列出的手段，按病期与线序排列，不代表任何一项适合你。选哪一个，这一句需要问你的医生。'
      ],
      sources: [
        { org: 'CNLC', doc: '中国肝癌分期 CNLC 2022', version: '2022', original: false, page: '页码待核' },
        { org: 'BCLC', doc: 'Barcelona Clinic Liver Cancer 分期体系', version: '版本未核实', original: false, page: '页码待核' }
      ]
    },
    {
      id: 'trend',
      title: '发展趋势',
      intro: '这一段只写已经发生的事：哪份文件换了版本、哪一天发布、本项目核对到哪一步。不写预测，不做评价，也不给任何倾向。',
      points: [
        '2022 年：本项目记录的分期体系为 CNLC 2022（Ia / Ib / IIa / IIb / IIIa / IIIb / IV），依据为本项目 docs/HCC-DOMAIN.md。',
        '本项目尚未取得 NCCN 与 CSCO 肝癌指南的原件，在本项目 docs 与原型源码里也没有查到版本号与生效日期，因此这一段不列版本更替条目；待核项已记入 docs/DISEASE-PRIMER.md。',
        '本项目尚未完成临床试验登记平台的检索采集，暂无登记数量与阶段分布可报；补齐前不写任何数字。'
      ],
      sources: [
        { org: 'CNLC', doc: '中国肝癌分期 CNLC 2022', version: '2022', original: false, page: '页码待核' },
        { org: '本项目', doc: 'docs/HCC-DOMAIN.md（分期体系与字段口径）', version: '2026-10-22', original: true, note: '一手项目记录' }
      ]
    }
  ]
}

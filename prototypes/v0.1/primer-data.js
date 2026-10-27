/* 小甘宝 HepPal · 疾病概要数据（36 号 v2）
 * 口径：docs/DISEASE-PRIMER.md；规范：starter docs/36-DISEASE-PRIMER.md。
 * 全部内容属第 ② 层（解释）：只写定义、文件、指南列举过的手段、已发生的变化。
 * 任何「你该怎么办」的判断都不在这里，固定出口是「这一句需要问你的医生」。
 *
 * 原件状态照实写（§2.4）：
 *  - 已取得原件的，给 url（https）、写清页码——页码取自本地这份 PDF 的页脚编号，不是估算；
 *  - 未取得原件的，给 secondaryUrl（二次来源）并写明是哪一类来源；
 *  - 没有可点文件的（本仓 docs、说明行），标 nolink: true 并在 note 里说明为什么。
 *  §2.5：原件列不允许只写文字，缺链接模式层会红字标「违反 36 号 §2.5」。
 */
window.DISEASE_PRIMER = {
  brand: '小甘宝 HepPal',
  name: '肝细胞癌',
  en: 'Hepatocellular Carcinoma（HCC）',
  updated: '2026-10-27',
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
        '分期体系至少三套并存：BCLC（0 / A / B / C / D）、CNLC（Ⅰa / Ⅰb / Ⅱa / Ⅱb / Ⅲa / Ⅲb / Ⅳ）、AJCC/UICC TNM（只有切除后才完整）。三套不换算，本台只记录「医生说的是哪一套」，并列展示。',
        '病因是背景维度，不是分期变量：HBV、HCV、酒精、MASLD 各自记录抗病毒药、饮酒量、代谢情况，与肿瘤分期分开保存。'
      ],
      sources: [
        {
          org: '国家卫生健康委', doc: '原发性肝癌诊疗指南（2024 年版）·「三、肝癌的分期」（CNLC Ⅰa–Ⅳ，图 4）',
          version: '2024 年版（国卫办医政函〔2024〕97 号）', original: true,
          url: 'https://www.nhc.gov.cn/wjw/c100378/202404/910cce13164044b895101236f12093e9/files/1732871166035_91949.pdf',
          page: 'P32'
        },
        {
          org: '国家卫生健康委', doc: '原发性肝癌诊疗指南（2022 年版）·「三、分期」（CNLC Ⅱa–Ⅳ 与分期图）',
          version: '2022 年版（国卫办医函〔2022〕12 号）', original: true,
          url: 'https://www.nhc.gov.cn/yzygj/c100068/202201/1f420b4185444904afe7315594b2e362/files/1732871378900_48829.pdf',
          page: 'P22'
        },
        {
          org: 'BCLC', doc: 'BCLC 2022 update（Reig 等，J Hepatol 2022;76(3):681-693）',
          version: '2022', original: false, secondaryUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8866082/',
          page: '页码待核', note: '未取得期刊原件；二次来源为 PMC 全文（PMID 34801630、PMCID PMC8866082）'
        },
        {
          org: 'AJCC / UICC', doc: 'AJCC Cancer Staging Manual, 8th ed.（肝细胞癌章节）',
          version: '第 8 版（2017）', original: false, secondaryUrl: 'https://pubmed.ncbi.nlm.nih.gov/28094848/',
          page: '页码待核', note: '未取得原书；二次来源为第 8 版总述文章的 PubMed 记录（CA Cancer J Clin 2017;67:93-99，PMID 28094848）'
        }
      ]
    },
    {
      id: 'evidence',
      title: '医学资料规范和指南情况',
      intro: '这台工作台里出现的每一条「该查什么、该怎么分期」，都应能追到下面某一份文件。'
        + '哪一份拿到了原件、哪一份只是看到了二次来源，表格里逐行写清楚——没看到原件的不假装看过。',
      table: {
        head: ['机构', '文件', '版本 / 年份', '原件', '本台的用途'],
        rows: [
          ['国家卫生健康委', '原发性肝癌诊疗指南（2024 年版）', '2024 年版（国卫办医政函〔2024〕97 号，2024-03-21）',
            { text: '已取得（官方 PDF，143 页；见通知页附件）', url: 'https://www.nhc.gov.cn/wjw/c100378/202404/910cce13164044b895101236f12093e9/files/1732871166035_91949.pdf' },
            '国内分期（CNLC）与治疗各论的出处；本台页码均按这份 PDF 的页脚编号'],
          ['国家卫生健康委', '原发性肝癌诊疗指南（2022 年版）', '2022 年版（国卫办医函〔2022〕12 号，2022-01-10）',
            { text: '已取得（官方 PDF，124 页）', url: 'https://www.nhc.gov.cn/yzygj/c100068/202201/1f420b4185444904afe7315594b2e362/files/1732871378900_48829.pdf' },
            'CNLC 2022 分期的原始出处；「三、分期」在 P22，分期图在 2022 版里是「图 3」'],
          ['BCLC', 'BCLC 2022 update（Reig 等，J Hepatol 2022;76(3):681-693）', '2022',
            { text: '未取得原件，据 PMC 全文', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8866082/' },
            '记录医生写的 BCLC 期别（0 / A / B / C / D），不换算'],
          ['BCLC（官网）', 'BCLC 分期体系与治疗策略图', '以打开当日页面为准',
            { text: '官网（非 PDF 原件）', url: 'https://www.bclc.cat/' },
            '仅用于确认分期体系的分级名称，不引用其推荐条文'],
          ['AJCC / UICC', 'AJCC Cancer Staging Manual, 8th ed.（肝细胞癌章节）', '第 8 版（2017）',
            { text: '未取得原件，据 PubMed 记录', url: 'https://pubmed.ncbi.nlm.nih.gov/28094848/' },
            '记录 pTNM 原文；只有切除后才完整'],
          ['NCCN', 'NCCN Guidelines · Hepatobiliary Cancers', '版本以打开当日页面为准（2026-10-27 核对）',
            { text: '未取得原件（需订阅），据指南页', url: 'https://www.nccn.org/guidelines/guidelines-detail?category=1&id=1438' },
            '仅作外部对照，不作为本台的分期或路径依据'],
          ['CSCO', 'CSCO 原发性肝癌诊疗指南 2024', '2024（ISBN 978-7-117-36792-9，2024-09-10）',
            { text: '未取得原件，据人卫社书目页', url: 'https://www.pmphmall.com/gdsdetail/653497-332094' },
            '仅作外部对照；本台未采用其分级口径'],
          ['WHO / IARC', 'WHO Classification of Tumours · Digestive System Tumours, 5th ed.', '第 5 版（2019）',
            { text: '未取得原件，据 IARC 出版页', url: 'https://publications.iarc.who.int/Book-And-Report-Series/Who-Classification-Of-Tumours/Digestive-System-Tumours-2019' },
            '病理分类名称的出处；本台不记录组织学分级判断']
        ]
      },
      points: [
        '指南给的是「通常怎么做」，不是「你该怎么做」。版本号必须写清：同一份指南隔一年，条目会变。',
        '2024 年版指南的页码按本地这份 PDF 的页脚编号记（如「三、肝癌的分期」在 P32、「（五）系统治疗」在 P78），换版本后页码会变，届时重核。',
        'BCLC 与 CNLC 并存时不换算：两行并列，各自标出处，各自保留医生原话。任何「换算成另一套」的写法都会造出一个原文里没有的期别。',
        '国内分期与 TNM 也不换算。TNM 只有切除后的病理才完整，术前拿临床资料套 TNM 属于越界。'
      ],
      sources: [
        {
          org: '国家卫生健康委', doc: '原发性肝癌诊疗指南（2024 年版）',
          version: '2024 年版', original: true,
          url: 'https://www.nhc.gov.cn/wjw/c100378/202404/910cce13164044b895101236f12093e9/files/1732871166035_91949.pdf',
          page: 'P1–P2（版本沿革）、P32（分期）'
        },
        {
          org: '本项目', doc: 'docs/DISEASE-PRIMER.md（原件状态与待核项台账）',
          version: '2026-10-27', original: true, nolink: true,
          note: '本仓内部文件，无对外 URL；查核记录在仓内 git 历史'
        }
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
        {
          org: '国家卫生健康委', doc: '原发性肝癌诊疗指南（2024 年版）· 治疗各论（一）外科治疗 / （二）消融治疗 / （三）经动脉介入治疗 / （四）放射治疗 / （五）系统治疗',
          version: '2024 年版', original: true,
          url: 'https://www.nhc.gov.cn/wjw/c100378/202404/910cce13164044b895101236f12093e9/files/1732871166035_91949.pdf',
          page: 'P36 / P54 / P61 / P72 / P78 起'
        },
        {
          org: 'BCLC', doc: 'BCLC 2022 update',
          version: '2022', original: false, secondaryUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8866082/',
          page: '页码待核', note: '仅用于对照分期与治疗策略的分组名称，未引用其条文'
        }
      ]
    },
    {
      id: 'trend',
      title: '发展趋势',
      intro: '这一段只写已经发生的事：哪份文件换了版本、哪一天发布、本项目核对到哪一步。不写预测，不做评价，也不给任何倾向。',
      points: [
        '2017 年 6 月：原国家卫生和计划生育委员会医政医管局颁布《原发性肝癌诊疗规范（2017 年版）》；此后于 2019 年 12 月、2021 年 12 月两次更新，形成《原发性肝癌诊疗规范（2019 年版）》与《原发性肝癌诊疗指南（2022 年版）》（版本沿革见 2024 年版指南 P1–P2）。',
        '2022 年 1 月 10 日：国卫办医函〔2022〕12 号印发《原发性肝癌诊疗指南（2022 年版）》。',
        '2024 年 3 月 21 日：国卫办医政函〔2024〕97 号印发《原发性肝癌诊疗指南（2024 年版）》，为现行版本；本台已取得官方 PDF，共 143 页。',
        '2022 年：BCLC 发表 2022 版更新（Reig 等，J Hepatol 2022;76(3):681-693），为 BCLC 分期体系的现行版本记录。',
        '2019 年：WHO 消化系统肿瘤分类第 5 版出版（IARC），取代第 4 版（2010）。',
        '2024 年 9 月 10 日：CSCO《原发性肝癌诊疗指南 2024》出版（ISBN 978-7-117-36792-9）。',
        '本项目尚未完成临床试验登记平台的检索采集，暂无登记数量与阶段分布可报；补齐前不写任何数字。'
      ],
      sources: [
        {
          org: '国家卫生健康委', doc: '原发性肝癌诊疗指南（2024 年版）· 一、概述（版本沿革）',
          version: '2024 年版', original: true,
          url: 'https://www.nhc.gov.cn/wjw/c100378/202404/910cce13164044b895101236f12093e9/files/1732871166035_91949.pdf',
          page: 'P1–P2'
        },
        {
          org: '国家卫生健康委', doc: '原发性肝癌诊疗指南（2022 年版）·「三、分期」（CNLC Ⅰa–Ⅳ，图 3）',
          version: '2022 年版（国卫办医函〔2022〕12 号）', original: true,
          url: 'https://www.nhc.gov.cn/yzygj/c100068/202201/1f420b4185444904afe7315594b2e362/files/1732871378900_48829.pdf',
          page: 'P22'
        },
        {
          org: 'BCLC', doc: 'BCLC 2022 update',
          version: '2022', original: false, secondaryUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8866082/',
          page: '页码待核'
        },
        {
          org: 'WHO / IARC', doc: 'WHO Classification of Tumours · Digestive System Tumours, 5th ed.',
          version: '第 5 版（2019）', original: false,
          secondaryUrl: 'https://publications.iarc.who.int/Book-And-Report-Series/Who-Classification-Of-Tumours/Digestive-System-Tumours-2019',
          page: '出版页（年份以出版页为准）'
        },
        {
          org: 'CSCO', doc: 'CSCO 原发性肝癌诊疗指南 2024',
          version: '2024（ISBN 978-7-117-36792-9）', original: false,
          secondaryUrl: 'https://www.pmphmall.com/gdsdetail/653497-332094',
          page: '书目页（出版日期 2024-09-10）'
        },
        {
          org: '本项目', doc: 'docs/HCC-DOMAIN.md（分期体系与字段口径）',
          version: '2026-10-22', original: true, nolink: true,
          note: '本仓内部文件，无对外 URL'
        }
      ]
    }
  ]
}

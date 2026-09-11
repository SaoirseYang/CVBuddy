// 通用字段词典：canonical 路径 -> 同义词列表
// 匹配顺序：优先命中"最长词"，减少"紧急联系人姓名"误配到"姓名"这类问题
(function () {
  if (window.WS && window.WS.DICT) return;
  window.WS = window.WS || {};

  const FIELD_DICT = {
    // ---- 基本信息 ----
    "basic.name": ["姓名", "名字", "真实姓名", "name", "fullname", "full name"],
    "basic.gender": ["性别"],
    "basic.birth": ["出生日期", "出生年月", "生日", "出生", "date of birth", "birthday"],
    "basic.phone": ["手机", "手机号", "手机号码", "电话", "联系电话", "联系方式", "phone", "mobile", "tel"],
    "basic.email": ["邮箱", "电子邮件", "电子邮箱", "email", "e-mail", "mail"],
    "basic.idType": ["证件类型", "证件种类"],
    "basic.idCard": ["身份证", "身份证号", "身份证号码", "证件号码", "证件号"],
    "basic.country": ["国家/地区", "国家地区", "国家", "地区"],
    "basic.workYears": ["工作年限", "工作年资", "参加工作时间"],
    "basic.specialty": ["特长", "个人特长", "特长爱好"],
    "basic.mailingAddress": ["通信地址", "邮寄地址", "通讯地址", "联系地址"],
    "basic.expectOnboard": ["预计入职时间", "入职时间", "可入职时间", "到岗时间"],
    "basic.wwid": ["工号", "wwid"],
    "basic.political": ["政治面貌", "政治状态"],
    "basic.nation": ["民族"],
    "basic.nativePlace": ["籍贯", "生源地", "原籍"],
    "basic.hukou": ["户口所在地", "户籍所在地", "户口", "户籍"],
    "basic.height": ["身高"],
    "basic.weight": ["体重"],
    "basic.health": ["健康状况"],
    "basic.marital": ["婚姻状况", "婚否", "婚姻"],
    "basic.qq": ["qq", "qq号", "扣扣"],
    "basic.wechat": ["微信", "微信号", "wechat"],
    "basic.hometown": ["家庭住址", "家庭地址", "家庭通讯地址"],
    "basic.address": ["现居住地", "现居地", "居住地址", "常住地址", "现居地址", "居住城市", "所在地"],
    "basic.expectCity": ["期望工作地", "期望工作城市", "意向城市", "期望城市", "意向工作地", "工作地点意向"],
    "basic.expectSalary": ["期望薪资", "期望月薪", "期望年薪", "薪资期望", "薪酬期望", "期望待遇"],
    "basic.curSalary": ["当前薪资", "目前薪资", "现薪", "现在薪资", "月薪范围"],
    "basic.lastCompany": ["最近公司", "最近工作单位", "上一家公司", "最近雇主"],
    "basic.englishScore": ["英语等级成绩", "英语成绩", "四六级成绩", "英语水平成绩"],
    "basic.certName": ["证书名称", "技能证书"],
    "basic.language": ["语言类型", "语言水平", "掌握语种"],
    "basic.expectPosition": ["期望职位", "应聘岗位", "意向岗位", "应聘职位", "求职意向", "申请职位", "应聘方向", "应聘部门"],
    "basic.expectIndustry": ["期望行业", "意向行业"],
    "basic.source": ["招聘信息来源", "信息来源", "获取招聘信息渠道", "得知渠道"],
    "basic.emergencyContact": ["紧急联系人", "紧急联络人", "紧急联系人姓名"],
    "basic.emergencyPhone": ["紧急联系人电话", "紧急联系电话", "紧急联系人手机"],
    "basic.hobby": ["兴趣爱好", "爱好", "特长", "兴趣特长"],
    "basic.selfEval": ["自我评价", "自我介绍", "个人评价", "个人介绍", "自我描述", "个人优势"],

    // ---- 教育经历（段内字段，前缀 edu.）----
    "edu.school": ["学校", "学校名称", "院校", "毕业院校", "毕业学校", "就读学校", "院校名称"],
    "edu.major": ["专业", "所学专业", "专业名称"],
    "edu.level": ["学历", "学历层次", "教育程度", "最高学历"],
    "edu.degree": ["学位", "学位层次", "获得学位"],
    "edu.start": ["入学时间", "入学日期", "就读开始", "在校开始时间", "开始时间", "起始时间"],
    "edu.end": ["毕业时间", "毕业日期", "毕业年月", "在校结束时间", "结束时间"],
    "edu.college": ["学院", "院系", "学院（院系）"],
    "edu.courses": ["专业课程", "主修课程", "核心课程", "主要课程"],
    "edu.direction": ["研究方向"],
    "edu.thesis": ["毕业论文", "毕业设计", "论文题目"],
    "edu.overseas": ["海外教育经历", "是否海外", "海外经历"],
    "edu.minor": ["辅修", "双学位专业", "辅修/双学位专业", "辅修专业"],
    "edu.eduForm": ["学习形式", "教育形式", "培养方式", "全日制或非全日制"],
    "edu.isFulltime": ["是否全日制", "是否统招", "是否统招全日制"],
    "edu.gpa": ["gpa", "绩点", "平均绩点", "成绩（gpa）", "成绩gpa"],
    "edu.rank": ["排名", "年级排名", "专业排名"],
    "edu.class": ["班级", "所在班级"],
    "edu.tutor": ["导师", "导师姓名"],
    "edu.awardInSchool": ["在校获奖情况", "校内获奖", "校园获奖情况"],

    // ---- 实习/工作经历（前缀 work.）----
    "work.company": ["公司", "公司名称", "单位", "单位名称", "实习单位", "工作单位", "企业名称", "雇主"],
    "work.position": ["职位", "职位名称", "岗位", "岗位名称", "职务", "实习岗位", "担任职位", "担任岗位"],
    "work.dept": ["部门", "所在部门", "实习部门", "工作部门"],
    "work.start": ["开始时间", "起始时间", "入职时间", "实习开始时间"],
    "work.end": ["结束时间", "离职时间", "实习结束时间"],
    "work.workType": ["工作类型", "经历类型", "实习或正式工作"],
    "work.salary": ["薪资", "工资", "实习薪资", "月薪"],
    "work.desc": ["工作内容", "工作描述", "实习内容", "实习描述", "职责描述", "工作职责", "主要工作", "工作经历描述", "业绩描述"],
    "work.achievements": ["工作成果", "工作业绩", "主要成果", "实习成果"],
    "work.location": ["工作地点", "实习地点", "工作城市"],
    "work.referrer": ["证明人姓名", "证明人"],
    "work.referrerPosition": ["证明人职位", "证明人职务"],
    "work.referrerContact": ["证明人联系方式", "证明人电话", "证明人及电话"],
    "work.leaveReason": ["离职原因", "离职原因说明"],
    "work.subordinates": ["下属人数", "管理人数", "团队人数"],

    // ---- 项目经历（前缀 prj.）----
    "prj.name": ["项目名称", "课题名称", "项目"],
    "prj.position": ["职位", "担任职位", "项目中职位"],
    "prj.role": ["项目角色", "担任角色", "承担角色", "项目中职责", "职责"],
    "prj.start": ["项目开始时间", "项目起始时间", "开始时间", "起始时间"],
    "prj.end": ["项目结束时间", "结束时间"],
    "prj.desc": ["项目内容", "项目描述", "项目简介", "项目介绍"],
    "prj.duty": ["本人职责", "个人职责", "我的职责"],
    "prj.result": ["项目成果", "项目成绩", "项目产出"],
    "prj.link": ["项目链接", "项目地址"],

    // ---- 在校经历（前缀 cmp.：社团组织/社会实践等）----
    "cmp.type": ["经历类型"],
    "cmp.org": ["组织名称", "社团名称", "组织", "单位名称"],
    "cmp.position": ["职位", "职务", "担任职位"],
    "cmp.start": ["开始时间", "起始时间"],
    "cmp.end": ["结束时间"],
    "cmp.desc": ["工作内容", "内容描述", "职责描述"],

    // ---- 外语能力（前缀 lng.）----
    "lng.lang": ["外语语种", "语种", "语言类型", "外语类型"],
    "lng.certName": ["证书名称"],
    "lng.level": ["英语水平", "外语水平", "语言水平", "考试类型", "等级考试"],
    "lng.score": ["成绩", "分数", "总分"],
    "lng.mastery": ["掌握程度", "熟练程度"],
    "lng.listening": ["听说能力", "听说"],
    "lng.reading": ["读写能力", "读写"],

    // ---- 计算机技能（前缀 skl.）----
    "skl.name": ["技能类型", "技能名称", "技能"],
    "skl.mastery": ["掌握程度", "熟练程度"],
    "skl.score": ["成绩", "分数"],

    // ---- 资格证书（前缀 crt.）----
    "crt.date": ["获得时间", "获得日期", "取得时间"],
    "crt.name": ["证书名称", "证书"],
    "crt.no": ["证书编号", "编号"],
    "crt.desc": ["证书说明", "证书描述", "备注"],

    // ---- 家庭情况（前缀 fam.）----
    "fam.name": ["姓名", "成员姓名"],
    "fam.relation": ["关系", "与本人关系", "称谓"],
    "fam.phone": ["电话", "联系电话", "手机"],
    "fam.company": ["公司", "工作单位", "单位"],
    "fam.position": ["职位", "职务"],
    "fam.political": ["政治面貌"],

    // ---- 论文期刊（前缀 pap.）----
    "pap.date": ["发表时间", "发表日期"],
    "pap.journal": ["刊物名称", "期刊名称", "期刊", "会议名称"],
    "pap.tier": ["刊物层级", "期刊层级", "收录情况"],
    "pap.title": ["论文名称", "论文题目", "论文标题"],
    "pap.desc": ["论文描述", "论文简介", "摘要"],
    "pap.author": ["论文作者", "作者排序", "作者身份"],
    "pap.impact": ["期刊影响因子", "影响因子"],
    "pap.link": ["论文链接", "论文地址"],

    // ---- 专利（前缀 pat.）----
    "pat.date": ["发表时间", "获得时间", "申请时间"],
    "pat.name": ["专利名称", "专利"],
    "pat.no": ["专利编号", "专利号"],
    "pat.type": ["专利类型"],
    "pat.result": ["专利成果", "成果说明"],

    // ---- 作品集（前缀 wks.）----
    "wks.name": ["作品名称", "作品"],
    "wks.link": ["作品链接", "链接地址", "链接"],
    "wks.desc": ["描述", "作品描述", "说明"],

    // ---- 竞赛（前缀 cpt.）----
    "cpt.name": ["竞赛名称", "比赛名称", "竞赛"],
    "cpt.date": ["参与时间", "参赛时间", "竞赛时间"],
    "cpt.desc": ["详情内容", "竞赛描述", "详情", "竞赛内容"],

    // ---- 获奖情况（前缀 awd.）----
    "awd.name": ["奖项名称", "获奖名称", "奖项", "奖励名称", "荣誉名称", "获奖情况"],
    "awd.level": ["奖励等级", "获奖级别", "奖项等级", "奖励级别", "获奖等级", "奖项级别"],
    "awd.date": ["获奖时间", "获得时间", "获奖日期", "颁发时间"],
    "awd.org": ["颁奖机构", "颁奖单位", "颁发单位", "授奖单位"],
    "awd.desc": ["奖励描述", "获奖描述", "备注"]
  };

  // 区块标题关键词：用于定位"教育经历/实习经历"等分区及其"添加/保存"按钮
  const SECTION_HINTS = {
    education: ["教育经历", "教育背景", "教育信息", "学习经历", "教育培训经历", "学历信息", "教育情况"],
    internship: ["实习经历", "实习经验", "实习实践经历", "实践经历", "工作经历", "工作实习经历", "实习及工作经历", "社会实习", "实习情况"],
    project: ["项目经历", "项目经验", "科研经历", "课题经历", "实践项目"],
    award: ["获奖情况", "荣誉奖项", "获奖经历", "奖项荣誉", "获奖记录", "所获奖励", "获奖荣誉"],
    campus: ["在校经历", "校园经历", "学生工作经历", "社团经历", "学生工作", "社团组织", "社会实践"],
    language: ["外语能力", "外语水平", "语言能力", "语言水平"],
    skill: ["计算机技能", "计算机能力", "计算机水平", "IT技能", "技能特长"],
    certificate: ["资格证书", "技能证书", "证书情况"],
    family: ["家庭情况", "家庭成员", "家庭信息", "亲属情况"],
    paper: ["论文期刊", "论文发表", "发表论文", "学术论文", "论文情况"],
    patent: ["专利", "专利情况", "专利信息"],
    portfolio: ["作品集", "个人作品", "作品经历"],
    competition: ["竞赛", "竞赛经历", "比赛经历", "学科竞赛"]
  };

  const ADD_WORDS = ["添加", "新增", "＋", "+", "增加", "继续添加", "新增一条", "添加一条"];
  const SAVE_WORDS = ["保存", "确定", "确认", "完成", "保存该段", "保存此段"];
  const NEXT_WORDS = ["下一步", "保存并继续", "保存，下一步", "下一页", "继续"];

  // 学历层级：用于时序排序与"是否包含高中"过滤
  const LEVEL_ORDER = ["博士", "硕士", "本科", "专科", "高中"];
  const LEVEL_WORDS = {
    "博士": ["博士"],
    "硕士": ["硕士", "研究生"],
    "本科": ["本科", "大学本科", "学士"],
    "专科": ["专科", "大专"],
    "高中": ["高中", "中专", "中技", "中转"]
  };

  // 区块 kind -> 词典前缀（fillSegment 优先在本区块的词典里匹配，避免"职位"串区块）
  const KIND_PREFIX = {
    education: "edu", internship: "work", project: "prj", award: "awd",
    campus: "cmp", language: "lng", skill: "skl", certificate: "crt",
    family: "fam", paper: "pap", patent: "pat", portfolio: "wks", competition: "cpt"
  };

  // 路径 -> 中文名（资料库「字段词典」页、扫描预览、映射面板共用）
  const PATH_GROUPS = [
    {
      prefix: "basic", title: "基本信息",
      items: [
        ["basic.name", "姓名"], ["basic.gender", "性别"], ["basic.birth", "出生日期"], ["basic.phone", "手机号"],
        ["basic.email", "邮箱"], ["basic.idType", "证件类型"], ["basic.idCard", "身份证号"],
        ["basic.political", "政治面貌"], ["basic.nation", "民族"], ["basic.nativePlace", "籍贯/生源地"],
        ["basic.hukou", "户籍所在地"], ["basic.country", "国家/地区"], ["basic.height", "身高"],
        ["basic.weight", "体重"], ["basic.health", "健康状况"], ["basic.marital", "婚姻状况"],
        ["basic.wechat", "微信号"], ["basic.qq", "QQ号"], ["basic.workYears", "工作年限"],
        ["basic.specialty", "特长"], ["basic.address", "现居住地"], ["basic.mailingAddress", "通信地址"],
        ["basic.hometown", "家庭住址"], ["basic.wwid", "工号(WWID)"],
        ["basic.emergencyContact", "紧急联系人姓名"], ["basic.emergencyPhone", "紧急联系电话"],
        ["basic.expectOnboard", "预计入职时间"], ["basic.expectPosition", "期望职位/岗位"],
        ["basic.expectCity", "期望城市"], ["basic.expectSalary", "期望薪资"], ["basic.expectIndustry", "期望行业"],
        ["basic.curSalary", "当前薪资"], ["basic.lastCompany", "最近公司"],
        ["basic.englishScore", "英语等级成绩"], ["basic.certName", "常用证书名称"],
        ["basic.language", "语言类型"], ["basic.source", "招聘信息来源"],
        ["basic.hobby", "兴趣爱好"], ["basic.selfEval", "自我评价"]
      ]
    },
    {
      prefix: "edu", title: "教育经历",
      items: [
        ["edu.school", "学校"], ["edu.level", "学历"], ["edu.degree", "学位"], ["edu.major", "专业"],
        ["edu.college", "学院/院系"], ["edu.start", "开始时间"], ["edu.end", "结束时间"],
        ["edu.eduForm", "学习形式"], ["edu.isFulltime", "是否全日制/统招"], ["edu.courses", "专业课程"],
        ["edu.direction", "研究方向"], ["edu.thesis", "毕业论文"], ["edu.gpa", "GPA"],
        ["edu.rank", "专业排名"], ["edu.class", "班级"], ["edu.tutor", "导师"],
        ["edu.overseas", "海外经历"], ["edu.minor", "辅修/双学位"], ["edu.awardInSchool", "在校获奖情况"]
      ]
    },
    {
      prefix: "work", title: "实习/工作经历",
      items: [
        ["work.company", "公司/单位"], ["work.position", "职位"], ["work.dept", "部门"],
        ["work.workType", "工作类型"], ["work.salary", "薪资"], ["work.start", "开始时间"],
        ["work.end", "结束时间"], ["work.desc", "工作内容"], ["work.achievements", "工作成果"],
        ["work.location", "工作地点"], ["work.referrer", "证明人姓名"], ["work.referrerPosition", "证明人职位"],
        ["work.referrerContact", "证明人联系方式"], ["work.leaveReason", "离职原因"], ["work.subordinates", "下属人数"]
      ]
    },
    {
      prefix: "prj", title: "项目经历",
      items: [
        ["prj.name", "项目名称"], ["prj.position", "项目职位"], ["prj.role", "担任角色"],
        ["prj.start", "开始时间"], ["prj.end", "结束时间"], ["prj.desc", "项目内容"],
        ["prj.duty", "本人职责"], ["prj.result", "项目成果"], ["prj.link", "项目链接"]
      ]
    },
    {
      prefix: "cmp", title: "在校经历",
      items: [
        ["cmp.type", "经历类型"], ["cmp.org", "组织名称"], ["cmp.position", "职位"],
        ["cmp.start", "开始时间"], ["cmp.end", "结束时间"], ["cmp.desc", "工作内容"]
      ]
    },
    {
      prefix: "awd", title: "获奖情况",
      items: [
        ["awd.name", "奖项名称"], ["awd.level", "奖励等级"], ["awd.date", "获奖时间"],
        ["awd.org", "颁奖机构"], ["awd.desc", "奖励描述"]
      ]
    },
    {
      prefix: "lng", title: "外语能力",
      items: [
        ["lng.lang", "语种"], ["lng.certName", "证书名称"], ["lng.level", "英语水平"],
        ["lng.score", "成绩"], ["lng.mastery", "掌握程度"], ["lng.listening", "听说能力"], ["lng.reading", "读写能力"]
      ]
    },
    {
      prefix: "skl", title: "计算机技能",
      items: [["skl.name", "技能类型"], ["skl.mastery", "掌握程度"], ["skl.score", "成绩"]]
    },
    {
      prefix: "crt", title: "资格证书",
      items: [["crt.date", "获得时间"], ["crt.name", "证书名称"], ["crt.no", "证书编号"], ["crt.desc", "证书说明"]]
    },
    {
      prefix: "fam", title: "家庭情况",
      items: [
        ["fam.name", "姓名"], ["fam.relation", "关系"], ["fam.phone", "电话"],
        ["fam.company", "公司"], ["fam.position", "职位"], ["fam.political", "政治面貌"]
      ]
    },
    {
      prefix: "pap", title: "论文期刊",
      items: [
        ["pap.date", "发表时间"], ["pap.title", "论文名称"], ["pap.journal", "刊物名称"],
        ["pap.tier", "刊物层级"], ["pap.author", "论文作者"], ["pap.impact", "影响因子"],
        ["pap.desc", "论文描述"], ["pap.link", "论文链接"]
      ]
    },
    {
      prefix: "pat", title: "专利",
      items: [
        ["pat.date", "发表/申请时间"], ["pat.name", "专利名称"], ["pat.no", "专利编号"],
        ["pat.type", "专利类型"], ["pat.result", "专利成果"]
      ]
    },
    {
      prefix: "wks", title: "作品集",
      items: [["wks.name", "作品名称"], ["wks.link", "作品链接"], ["wks.desc", "描述"]]
    },
    {
      prefix: "cpt", title: "竞赛",
      items: [["cpt.name", "竞赛名称"], ["cpt.date", "参与时间"], ["cpt.desc", "详情内容"]]
    }
  ];
  const PATH_LABELS = {};
  PATH_GROUPS.forEach((g) => g.items.forEach(([p, l]) => (PATH_LABELS[p] = l)));

  window.WS.DICT = {
    FIELD_DICT, SECTION_HINTS, ADD_WORDS, SAVE_WORDS, NEXT_WORDS,
    LEVEL_ORDER, LEVEL_WORDS, KIND_PREFIX, PATH_GROUPS, PATH_LABELS
  };
})();

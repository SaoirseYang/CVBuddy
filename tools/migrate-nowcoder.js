// 从牛客网申助手的页面快照提取资料 → 生成插件可导入的 profile JSON
// 用法: node migrate-nowcoder.js <snapshot.html> [out.json]
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");

const file = process.argv[2];
const out = process.argv[3] || "../import-nowcoder-profile.json";
const $ = cheerio.load(fs.readFileSync(file, "utf8"));

// ---- 区块 -> 目标 ----
const SECTION_TARGET = {
  "基本信息": { type: "basic" },
  "求职意向": { type: "basic" },
  "教育经历": { type: "list", key: "educations", start: "开始时间" },
  "工作经历": { type: "list", key: "internships", start: "开始时间" },
  "项目经历": { type: "list", key: "projects", start: "开始时间" },
  "在校经历": { type: "list", key: "campuses", start: "开始时间" },
  "获奖情况": { type: "list", key: "awards", start: "获奖时间" },
  "外语能力": { type: "list", key: "languages", start: "外语语种" },
  "计算机技能": { type: "list", key: "skills", start: "技能类型" },
  "资格证书": { type: "list", key: "certificates", start: "获得时间" },
  "家庭情况": { type: "list", key: "family", start: "姓名" },
  "论文期刊": { type: "list", key: "papers", start: "发表时间" },
  "专利": { type: "list", key: "patents", start: "发表时间" },
  "作品集": { type: "list", key: "works", start: "作品名称" },
  "竞赛": { type: "list", key: "competitions", start: "竞赛名称" },
  "自我评价": { type: "basicField", key: "selfEval" },
  "兴趣爱好": { type: "basicField", key: "hobby" }
};

// label -> 各列表项的字段 key
const FIELD_MAP = {
  educations: {
    "开始时间": "start", "结束时间": "end", "学历": "level", "学校": "school",
    "学院（院系）": "college", "学院": "college", "院系": "college", "专业": "major",
    "学位": "degree", "学习形式": "eduForm", "专业课程": "courses", "研究方向": "direction",
    "毕业论文": "thesis", "成绩（GPA）": "gpa", "GPA": "gpa", "专业排名": "rank",
    "是否为海外教育经历": "overseas", "辅修/双学位专业": "minor", "导师姓名": "tutor"
  },
  internships: {
    "开始时间": "start", "结束时间": "end", "工作类型": "workType", "公司": "company",
    "部门": "dept", "薪资（单位：元）": "salary", "薪资": "salary", "工资": "salary",
    "职位": "position", "工作内容": "desc", "工作成果": "achievements",
    "证明人姓名": "referrer", "证明人职位": "referrerPosition", "证明人联系方式": "referrerContact",
    "离职原因": "leaveReason", "下属人数": "subordinates"
  },
  projects: {
    "开始时间": "start", "结束时间": "end", "职位": "position", "项目名称": "name",
    "项目内容": "desc", "本人职责": "duty", "项目成果": "result", "项目链接": "link"
  },
  campuses: {
    "开始时间": "start", "结束时间": "end", "经历类型": "type", "组织名称": "org",
    "职位": "position", "工作内容": "desc"
  },
  awards: {
    "获奖时间": "date", "奖励名称": "name", "颁奖机构": "org", "奖励等级": "level", "奖励描述": "desc"
  },
  languages: {
    "外语语种": "lang", "证书名称": "certName", "英语水平": "level", "成绩": "score",
    "掌握程度": "mastery", "听说能力": "listening", "读写能力": "reading"
  },
  skills: { "技能类型": "name", "掌握程度": "mastery", "成绩": "score" },
  certificates: { "获得时间": "date", "证书名称": "name", "证书编号": "no", "证书说明": "desc" },
  family: {
    "姓名": "name", "关系": "relation", "电话": "phone", "公司": "company",
    "职位": "position", "政治面貌": "political"
  },
  papers: {
    "发表时间": "date", "刊物名称": "journal", "刊物层级": "tier", "论文名称": "title",
    "论文描述": "desc", "论文作者": "author", "期刊影响因子": "impact", "论文链接": "link"
  },
  patents: { "发表时间": "date", "专利名称": "name", "专利编号": "no", "专利类型": "type", "专利成果": "result" },
  works: { "作品名称": "name", "作品链接": "link", "描述": "desc" },
  competitions: { "竞赛名称": "name", "参与时间": "date", "详情内容": "desc" }
};

const BASIC_MAP = {
  "姓名": "name", "民族": "nation", "电话": "phone", "手机号": "phone", "邮箱": "email",
  "证件类型": "idType", "证件号码": "idCard", "出生日期": "birth", "性别": "gender",
  "微信号": "wechat", "微信": "wechat", "QQ": "qq", "政治面貌": "political",
  "婚姻状况": "marital", "户籍": "hukou", "身高": "height", "单位是cm": "height",
  "体重": "weight", "单位是kg": "weight",
  "健康状况": "health", "特长": "specialty", "工作年限": "workYears",
  "紧急联系人姓名": "emergencyContact", "紧急联系人电话": "emergencyPhone",
  "国家/地区": "country", "现居住地": "address", "通信地址": "mailingAddress",
  "期望职位": "expectPosition", "期望城市": "expectCity", "期望行业": "expectIndustry",
  "期望薪资": "expectSalary", "期望月薪（单位：元）": "expectSalary", "预计入职时间": "expectOnboard"
};

function normLabel(ph) {
  return String(ph || "").replace(/^请(输入|选择)/, "").trim();
}

// ---- 收集所有区块标题（文档顺序）----
const all = $("*").toArray();
const idxOf = new Map(all.map((el, i) => [el, i]));
const headers = [];
$(".section-header__title").each((i, el) => {
  const t = $(el).text().trim();
  if (SECTION_TARGET[t]) headers.push({ idx: idxOf.get(el), name: t });
});
headers.sort((a, b) => a.idx - b.idx);

// ---- 收集控件并归属区块 ----
const sectionFields = {}; // name -> [{ label, value, tag }]
for (const h of headers) sectionFields[h.name] = [];

$("input, textarea").each((i, el) => {
  const $el = $(el);
  const type = ($el.attr("type") || "").toLowerCase();
  if (["hidden", "submit", "button", "file", "checkbox", "radio"].includes(type)) return;
  if ($el.hasClass("el-upload__input")) return;
  const idx = idxOf.get(el);
  if (idx === undefined) return;
  let sec = null;
  for (const h of headers) if (h.idx < idx) sec = h;
  if (!sec) return;
  const ph = $el.attr("placeholder") || "";
  const label = normLabel(ph);
  const value =
    el.tagName === "textarea"
      ? ($el.attr("value") || $el.text() || "").trim()
      : ($el.attr("value") || "").trim();
  sectionFields[sec.name].push({ label, value, tag: el.tagName, idx });
});

// ---- 组装 profile ----
const profile = {
  basic: {},
  educations: [], internships: [], projects: [], awards: [], campuses: [],
  languages: [], skills: [], certificates: [], family: [], papers: [],
  patents: [], works: [], competitions: []
};

for (const h of headers) {
  const tgt = SECTION_TARGET[h.name];
  const items = sectionFields[h.name] || [];
  if (tgt.type === "basicField") {
    const v = items.map((x) => x.value).filter(Boolean).join("\n");
    if (v) profile.basic[tgt.key] = v;
    continue;
  }
  if (tgt.type !== "list") {
    // basic：基本信息 + 求职意向 两个区块都进 basic
    for (const it of items) {
      const key = BASIC_MAP[it.label];
      if (key && it.value && !profile.basic[key]) profile.basic[key] = it.value;
    }
    continue;
  }
  const fmap = FIELD_MAP[tgt.key] || {};
  let cur = null;
  for (const it of items) {
    const key = fmap[it.label];
    if (!key) continue;
    if (it.label === tgt.start) {
      if (cur && Object.values(cur).some((v) => v !== "" && v != null)) profile[tgt.key].push(cur);
      cur = {};
    }
    if (!cur) cur = {};
    if (it.value && cur[key] === undefined) cur[key] = it.value;
  }
  if (cur && Object.values(cur).some((v) => v !== "" && v != null)) profile[tgt.key].push(cur);
}

// 汇总输出
const stats = {};
for (const k of Object.keys(profile)) stats[k] = Array.isArray(profile[k]) ? profile[k].length : Object.keys(profile.basic).length && k === "basic" ? Object.keys(profile.basic).length : "-";
const data = {
  ws_profile: profile,
  _note: "由牛客网申助手快照迁移生成（tools/migrate-nowcoder.js）。在插件 资料库 → 设置与备份 → 导入备份 中选择本文件即可。"
};
fs.writeFileSync(path.join(__dirname, out), JSON.stringify(data, null, 2), "utf8");
console.log("迁移完成 →", out);
console.log("basic 字段数:", Object.keys(profile.basic).length);
for (const k of Object.keys(profile)) {
  if (Array.isArray(profile[k])) console.log(k + ":", profile[k].length, "段");
}

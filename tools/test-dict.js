// 词典覆盖率测试：把快照分析出的 label/placeholder 喂给词典匹配逻辑
const fs = require("fs");
const path = require("path");

global.window = global;
require("../src/shared/dictionary.js");
const D = window.WS.DICT;

function lookupDict(...texts) {
  let best = null;
  for (const [pathKey, words] of Object.entries(D.FIELD_DICT)) {
    for (const w of words) {
      for (const t of texts) {
        if (!t) continue;
        const ok = w.length <= 2 ? t === w : t.includes(w);
        if (!ok) continue;
        if (!best || w.length > best.w) best = { path: pathKey, w };
      }
    }
  }
  return best ? best.path : null;
}

const CASES = [
  // Moka（label 来自容器/提示文本，placeholder 是主要识别来源）
  ["姓名", "姓名"], ["手机号码", "手机号码"], ["邮箱", "邮箱"], ["性别", "请选择"],
  ["出生日期 (年龄)", "出生日期 (年龄)"], ["当前薪资", "当前薪资"], ["期望薪资", "期望薪资"],
  ["期望城市", "期望城市"], ["身份证", "证件号码"], ["所在地", "所在地"], ["最近公司", "最近公司"],
  ["公司名称", "公司名称"], ["职位名称", "职位名称"], ["工作职责", "内容"],
  ["学校名称", "请输入就读学校"], ["专业名称", "请输入专业名称"], ["学历", "请选择"],
  ["项目名称", "项目名称"], ["职责", "职责"], ["项目描述", "内容"], ["项目中职责", "项目中职责"],
  ["奖项名称", "奖项名称"], ["自我描述", "简介"], ["语言类型", "语言类型"]
];

let hit = 0;
const miss = [];
for (const [label, ph] of CASES) {
  const p = lookupDict(label, "", ph);
  if (p) hit++;
  else miss.push(label);
}
console.log("Moka 覆盖: " + hit + "/" + CASES.length);
if (miss.length) console.log("  未命中: " + miss.join(", "));

// chinahr / intel 关键 label
const CASES2 = [
  ["与身份证件上的姓名一致", "请输入"], ["身份证"], ["出生日期", "请选择日期"], ["汉族"],
  ["紧急联系人姓名", "请输入"], ["微信号"], ["证书名称"], ["英语等级成绩"], ["教育经历"], ["实习经验"]
];
let hit2 = 0;
const miss2 = [];
for (const c of CASES2) {
  const p = lookupDict(c[0], "", c[1] || "");
  if (p) hit2++;
  else miss2.push(c[0]);
}
console.log("chinahr/intel 覆盖: " + hit2 + "/" + CASES2.length);
if (miss2.length) console.log("  未命中(部分属站点规则/AI/教学职责范围): " + miss2.join(", "));

// 策略推断测试
const txt = "教育经历 请从最近的经历填起 工作经历 请从最近的经历填起";
console.log("策略推断(请从最近的经历填起):", /从(最高|最新|最近)(学历|一段|的经历)?[^。；]{0,8}(开始填|填起|开始|填写)/.test(txt) ? "latest-first ✓" : "✗");

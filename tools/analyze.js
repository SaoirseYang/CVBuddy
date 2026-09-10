// 离线分析快照：提取表单控件及其 label 候选、按钮文案、区块标题
// 用法: node analyze.js <snapshot.html>
const fs = require("fs");
const cheerio = require("cheerio");

const file = process.argv[2];
if (!file) {
  console.error("usage: node analyze.js <snapshot.html>");
  process.exit(1);
}
const html = fs.readFileSync(file, "utf8");
const $ = cheerio.load(html);

const clean = (t) =>
  String(t || "").replace(/[*＊:：\s\u3000]+/g, " ").replace(/\s+/g, " ").trim();

function labelCandidates(el) {
  const out = {};
  const id = el.attr("id");
  if (id) {
    const l = $('label[for="' + (id.replace(/"/g, '\\"')) + '"]').first();
    if (l.length) out.forLabel = clean(l.text());
  }
  const wrap = el.closest("label");
  if (wrap.length) out.wrapLabel = clean(wrap.text());
  const tr = el.closest("tr");
  if (tr.length) {
    const cells = tr.children("td,th").toArray().filter((c) => $(c).find("input,select,textarea").length === 0);
    if (cells.length) out.trCell = clean($(cells[0]).text());
  }
  // 父链容器文本（只取不含其他控件的最近容器）
  let node = el.parent();
  for (let i = 0; i < 6 && node.length; i++) {
    if (node.find("input,select,textarea").length <= 1) {
      const t = clean(node.clone().children("input,select,textarea").remove().end().text());
      if (t && t.length <= 30) {
        out.container = t;
        break;
      }
    }
    node = node.parent();
  }
  // class 里的常见 label 类名
  const labelCls = ["label", "form-label", "item-label", "field-label", "ant-form-item", "form-item", "el-form-item"];
  for (const cls of labelCls) {
    const anc = el.closest('[class*="' + cls + '"]');
    if (anc.length) {
      const t = clean(anc.clone().children("input,select,textarea").remove().end().text());
      if (t) {
        out.clsLabel = t.slice(0, 40);
        break;
      }
    }
  }
  if (el.attr("aria-label")) out.aria = clean(el.attr("aria-label"));
  return out;
}

const trunc = (s, n) => (s || "").replace(/\s+/g, " ").slice(0, n || 40);

console.log("=========== 控件 ===========");
$("input, textarea, select").each((_, el) => {
  const $el = $(el);
  const tag = (el.tagName || "").toLowerCase();
  const type = $el.attr("type") || "";
  if (["hidden", "submit", "button", "image", "file"].includes(type)) return;
  if (type === "radio" || type === "checkbox") {
    // 汇总同组
    const name = $el.attr("name");
    if (name && $(('input[type="' + type + '"][name="' + name + '"]')).first()[0] !== el) return;
    const opts = $(('input[type="' + type + '"][name="' + name + '"]'))
      .toArray()
      .map((r) => {
        const lb = $(r).closest("label").text() || $(r).parent().text() || $(r).attr("value");
        return clean(lb) + ($(r).attr("checked") !== undefined ? "[已选]" : "");
      })
      .join("/");
    console.log(
      `[${tag}:${type}] name=${name} 组内选项: ${trunc(opts, 80)}\n   labels: ` +
        JSON.stringify(labelCandidates($el))
    );
    return;
  }
  const val = $el.attr("value") || ($el.attr("checked") !== undefined ? "[checked]" : "");
  let extra = "";
  if (tag === "select") {
    const opts = $el
      .find("option")
      .toArray()
      .map((o) => clean($(o).text()) + ($(o).attr("selected") !== undefined ? "*" : ""))
      .filter(Boolean)
      .slice(0, 15);
    extra = " 选项: " + trunc(opts.join("|"), 100);
  }
  console.log(
    `[${tag}${type ? ":" + type : ""}] name=${$el.attr("name") || ""} id=${$el.attr("id") || ""} ph=${$el.attr("placeholder") || ""} value=${trunc(val, 30)}${extra}\n   labels: ` +
      JSON.stringify(labelCandidates($el))
  );
});

console.log("\n=========== 可点击元素（含关键词文案）===========");
const KW = ["添加", "新增", "＋", "+", "保存", "确定", "完成", "下一步", "继续", "提交", "上一步", "删除", "编辑", "上一页"];
$("button, a, [role=button], input[type=button], input[type=submit], span, div").each((_, el) => {
  const $el = $(el);
  if ($el.children("button,a,input").length) return;
  const t = clean($el.text() || $el.attr("value") || "");
  if (!t || t.length > 12) return;
  if (!KW.some((k) => t.includes(k))) return;
  const cls = trunc($el.attr("class"), 50);
  console.log(`"${t}" <${el.tagName} class="${cls}">`);
});

console.log("\n=========== 区块标题（教育/实习/项目/获奖相关）===========");
$("h1,h2,h3,h4,h5,h6,legend,strong,b,th,[class*=title],[class*=head],[class*=section]").each((_, el) => {
  const t = clean($(el).text());
  if (!t || t.length > 25) return;
  if (!/教育|实习|工作|项目|获奖|荣誉|经历|经验|学历|学习/.test(t)) return;
  console.log(`"${t}" <${el.tagName} class="${trunc($(el).attr("class"), 50)}">`);
});

console.log("\n=========== 文件上传控件 ===========");
$('input[type=file], [class*=upload]').each((_, el) => {
  console.log(`<${el.tagName} class="${trunc($(el).attr("class"), 60)}"> text="${trunc($(el).text(), 30)}"`);
});

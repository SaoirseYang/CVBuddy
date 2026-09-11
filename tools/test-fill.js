// 离线诊断：用 jsdom 把真实快照当作页面，跑插件同款扫描/匹配逻辑，
// 输出"每个控件认出了什么、准备填什么、为什么没填"——不依赖浏览器，便于快速定位问题。
//
// 用法：node test-fill.js "../site-cases/xxx.html"
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const FILE = process.argv[2];
if (!FILE) {
  console.error("用法：node test-fill.js <快照.html>");
  process.exit(1);
}
const html = fs.readFileSync(FILE, "utf8");
const dom = new JSDOM(html, {
  url: "https://" + path.basename(FILE).replace(/^snapshot-/, "").replace(/-\d{4}-\d{2}-\d{2}.*$/, ""),
  pretendToBeVisual: true,
  runScripts: "outside-only"
});
const { window } = dom;

// ---- 浏览器环境补齐 ----
window.Element.prototype.getBoundingClientRect = function () {
  return { width: 220, height: 32, top: 0, left: 0, right: 220, bottom: 32, x: 0, y: 0 };
};
if (!window.CSS) window.CSS = {};
if (!window.CSS.escape) window.CSS.escape = (s) => String(s).replace(/[^a-zA-Z0-9_-]/g, (c) => "\\" + c);

const store = { ws_profile: JSON.parse(fs.readFileSync(path.join(__dirname, "test-profile.json"), "utf8")) };
window.chrome = {
  storage: {
    local: {
      get: (keys, cb) => {
        const out = {};
        (Array.isArray(keys) ? keys : [keys]).forEach((k) => {
          if (k in store) out[k] = store[k];
        });
        if (cb) cb(out);
        return Promise.resolve(out);
      },
      set: (o, cb) => {
        Object.assign(store, o);
        if (cb) cb();
        return Promise.resolve();
      }
    },
    onChanged: { addListener: () => {} }
  },
  runtime: {
    sendMessage: () => {},
    onMessage: { addListener: () => {} },
    lastError: null
  }
};

for (const rel of [
  "../src/shared/dictionary.js",
  "../src/shared/storage.js",
  "../src/shared/builtin-rules.js",
  "../src/content/scanner.js",
  "../src/content/filler.js",
  "../src/content/strategy.js",
  "../src/content/controller.js"
]) {
  window.eval(fs.readFileSync(path.join(__dirname, rel), "utf8"));
}

(async () => {
  const diag = await window.WS.Ctrl.buildDiag({});
  console.log("页面：" + diag.url);
  console.log("域名：" + diag.domain + "（" + window.WS.BUILTIN.forDomain(diag.domain) ? "有内置规则" : "无内置规则" + "）");
  console.log(
    "控件 " + diag.counts.total + " · 可填 " + diag.counts.fillable +
    " · 资料为空 " + diag.counts.emptyData + " · 未识别 " + diag.counts.unmatched
  );
  console.log("策略：" + JSON.stringify(diag.strategy));
  console.log("区块：" + (diag.sections.map((s) => s.hint + "(" + s.kind + ")").join(", ") || "无"));

  const show = (title, list) => {
    console.log("\n== " + title + "（" + list.length + "）==");
    list.slice(0, 60).forEach((f) => {
      console.log(
        "  [" + (f.kind || "-") + "]" + (f.type ? "(" + f.type + ")" : "") + " " +
        JSON.stringify(f.label).slice(0, 46) +
        (f.alt && f.alt.length ? " /备:" + JSON.stringify(f.alt.slice(0, 2)).slice(1, 60) : "") +
        "  → " + (f.path || "✗") + " = " + (f.value === null ? "(空)" : JSON.stringify(f.value))
      );
    });
  };
  show("可填", diag.fields.filter((f) => f.reason === "可填"));
  show("未识别", diag.fields.filter((f) => f.reason === "未识别"));
  show("资料为空", diag.fields.filter((f) => f.reason === "资料为空"));
})().catch((e) => {
  console.error("运行失败：", e);
  process.exit(1);
});

#!/usr/bin/env node
/*
 * 本地桥接服务 —— 让 WorkBuddy 直接读取你浏览器里的实时页面（不必再来回手动导出快照）
 *
 * 启动：node tools/bridge-server.js [端口]        （默认 8765）
 * 配合：插件弹窗里勾选「实时同步给 WorkBuddy」
 *
 * 端点：
 *   GET  /ping               探活
 *   GET  /cmd                插件取指令（指令由 /enqueue 下发）
 *   POST /enqueue  {op,...}  下发指令（op: sync|dump|diag|plan|fill|stop|highlight|ping）
 *   POST /ingest   {payload} 插件上报数据 → 落盘 tools/live/
 *   POST /result   {payload} 插件回传指令执行结果 → tools/live/results.jsonl
 *   GET  /state              状态摘要
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.argv[2] || 8765);
const LIVE = path.join(__dirname, "live");
fs.mkdirSync(LIVE, { recursive: true });

let seq = 0;
const queue = [];
const state = {
  startedAt: new Date().toISOString(),
  lastPollAt: null,
  lastIngestAt: null,
  lastIngestMeta: null,
  ingestCount: 0,
  resultCount: 0
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Access-Control-Request-Private-Network",
  "Access-Control-Allow-Private-Network": "true",
  "Cache-Control": "no-store"
};

function send(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, Object.assign({ "Content-Type": "application/json; charset=utf-8" }, CORS));
  res.end(body);
}

function readBody(req, limit = 64 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error("请求体过大"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

const stamp = () => new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const safe = (s) => String(s || "unknown").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60);

function saveIngest(p) {
  const base = stamp() + "-" + safe(p.domain);
  const meta = {
    ts: p.ts || Date.now(),
    kind: p.kind || "sync",
    url: p.url,
    domain: p.domain,
    title: p.title,
    strategy: p.diag && p.diag.strategy,
    counts: p.diag && p.diag.counts,
    sections: p.diag && p.diag.sections,
    fields: p.diag && p.diag.fields,
    plan: p.plan
  };
  fs.writeFileSync(path.join(LIVE, base + ".json"), JSON.stringify(meta, null, 2), "utf8");
  fs.writeFileSync(path.join(LIVE, "latest.json"), JSON.stringify(meta, null, 2), "utf8");
  if (p.html) {
    fs.writeFileSync(path.join(LIVE, base + ".html"), p.html, "utf8");
    fs.writeFileSync(path.join(LIVE, "latest.html"), p.html, "utf8");
  }
  state.ingestCount++;
  state.lastIngestAt = new Date().toISOString();
  state.lastIngestMeta = {
    file: base + ".json",
    url: p.url,
    domain: p.domain,
    kind: p.kind,
    counts: meta.counts,
    hasHtml: !!p.html
  };
  console.log(
    "[ingest] " + meta.kind + " " + (p.domain || "") +
    (meta.counts ? " 控件" + p.diag.counts.total + " 可填" + p.diag.counts.fillable + " 未识别" + p.diag.counts.unmatched : "") +
    (p.html ? " (+html " + Math.round(p.html.length / 1024) + "KB)" : "")
  );
  return base;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  const p = url.pathname;

  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS);
    res.end();
    return;
  }

  try {
    if (p === "/ping") {
      return send(res, 200, { ok: true, port: PORT, uptimeSec: Math.round(process.uptime()), queue: queue.length });
    }

    if (p === "/cmd" && req.method === "GET") {
      state.lastPollAt = new Date().toISOString();
      const cmd = queue.shift() || null;
      return send(res, 200, { ok: true, cmd });
    }

    if (p === "/enqueue" && req.method === "POST") {
      const body = JSON.parse((await readBody(req)) || "{}");
      const cmd = Object.assign({}, body, { id: ++seq });
      queue.push(cmd);
      console.log("[enqueue] #" + cmd.id + " " + cmd.op + (cmd.selector ? " " + cmd.selector : ""));
      return send(res, 200, { ok: true, id: cmd.id, queued: queue.length });
    }

    if (p === "/ingest" && req.method === "POST") {
      const body = JSON.parse((await readBody(req)) || "{}");
      const payload = body.payload || body;
      const base = saveIngest(payload);
      return send(res, 200, { ok: true, file: base + ".json" });
    }

    if (p === "/result" && req.method === "POST") {
      const body = JSON.parse((await readBody(req)) || "{}");
      const payload = body.payload || body;
      fs.appendFileSync(path.join(LIVE, "results.jsonl"), JSON.stringify(payload) + "\n", "utf8");
      fs.writeFileSync(path.join(LIVE, "latest-result.json"), JSON.stringify(payload, null, 2), "utf8");
      state.resultCount++;
      console.log("[result] #" + (payload.id || "?") + " " + (payload.op || "") + " → " + JSON.stringify(payload.result || {}).slice(0, 200));
      return send(res, 200, { ok: true });
    }

    if (p === "/state") {
      return send(res, 200, Object.assign({ ok: true, queue: queue.length }, state));
    }

    return send(res, 404, { ok: false, error: "未知路径 " + p });
  } catch (e) {
    console.error("[error]", e && e.message);
    return send(res, 500, { ok: false, error: (e && e.message) || String(e) });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("网申助手 · 本地桥接服务已启动");
  console.log("  地址：http://127.0.0.1:" + PORT);
  console.log("  数据落盘：" + LIVE);
  console.log("  下一步：浏览器插件弹窗里勾选「实时同步给 WorkBuddy」");
  console.log("  停止：Ctrl+C");
});

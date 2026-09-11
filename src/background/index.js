// 后台：DeepSeek AI 兜底 + 本地桥接代理（页面环境有 CORS/私网限制，统一在这里请求）
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "WS_AI_MAP") {
    handleAiMap(msg)
      .then(sendResponse)
      .catch((e) => sendResponse({ error: String(e && e.message ? e.message : e) }));
    return true; // 异步响应
  }
  if (msg.type === "WS_BRIDGE_POLL") {
    bridgeFetch("/cmd")
      .then((r) => sendResponse({ ok: true, cmd: r.cmd || null }))
      .catch((e) => sendResponse({ ok: false, error: errText(e) }));
    return true;
  }
  if (msg.type === "WS_BRIDGE_PUSH") {
    bridgePost("/ingest", msg.payload)
      .then(() => sendResponse({ ok: true }))
      .catch((e) => sendResponse({ ok: false, error: errText(e) }));
    return true;
  }
  if (msg.type === "WS_BRIDGE_RESULT") {
    bridgePost("/result", msg.payload)
      .then(() => sendResponse({ ok: true }))
      .catch((e) => sendResponse({ ok: false, error: errText(e) }));
    return true;
  }
  if (msg.type === "WS_BRIDGE_STATUS") {
    bridgeFetch("/ping")
      .then((r) => sendResponse({ ok: true, info: r }))
      .catch((e) => sendResponse({ ok: false, error: errText(e) }));
    return true;
  }
});

const errText = (e) => String((e && e.message) || e);

async function bridgeBase() {
  const { ws_settings } = await chrome.storage.local.get("ws_settings");
  const port = (ws_settings && ws_settings.bridgePort) || 8765;
  return "http://127.0.0.1:" + port;
}

async function bridgeFetch(pathAndQuery) {
  const base = await bridgeBase();
  const res = await fetch(base + pathAndQuery, { cache: "no-store" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}

async function bridgePost(pathname, payload) {
  const base = await bridgeBase();
  const res = await fetch(base + pathname, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {})
  });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}

async function handleAiMap({ labels, paths }) {
  const { ws_settings } = await chrome.storage.local.get("ws_settings");
  const s = ws_settings || {};
  if (!s.deepseekKey) return { error: "未配置 DeepSeek API Key（在扩展选项页设置）" };
  if (!s.aiEnabled) return { error: "AI 兜底未开启" };

  const prompt = [
    "你是网页表单字段映射助手。下面给出表单字段列表和可用的资料字段路径。",
    "请把每个表单字段映射到最合适的资料路径；无法确定的字段直接跳过，不要编造。",
    "只输出一个 JSON 对象，格式：{\"表单字段\":\"资料路径\"}，不要输出其他内容。",
    "",
    "可用资料路径：",
    paths.join(", "),
    "",
    "表单字段列表：",
    labels.join(" | ")
  ].join("\n");

  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + s.deepseekKey
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      response_format: { type: "json_object" }
    })
  });
  if (!res.ok) return { error: "DeepSeek 接口返回 HTTP " + res.status };
  const data = await res.json();
  try {
    const map = JSON.parse(data.choices[0].message.content);
    // 只保留合法路径
    const clean = {};
    for (const [k, v] of Object.entries(map)) {
      if (paths.includes(v)) clean[k] = v;
    }
    return { map: clean };
  } catch (e) {
    return { error: "AI 返回内容解析失败" };
  }
}

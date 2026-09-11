// 本地桥接：把当前页面（诊断/方案/快照）实时推送给 WorkBuddy，并执行其下发的指令
// 目的：不必再手动"导出快照 → 拷进文件夹"，直接在对话里就能看到浏览器里的实时页面
(function () {
  if (window.WS && window.WS.Bridge) return;
  window.WS = window.WS || {};
  if (window.top !== window) return; // 只在顶层框架运行，避免多份轮询
  const ST = window.WS.ST;

  let enabled = false;
  let timer = null;
  let online = false;
  let busy = false;
  const statusSubs = [];

  const send = (type, payload) =>
    new Promise((res) => {
      try {
        chrome.runtime.sendMessage({ type, payload }, (r) => {
          if (chrome.runtime.lastError) res({ ok: false, error: chrome.runtime.lastError.message });
          else res(r || { ok: false });
        });
      } catch (e) {
        res({ ok: false, error: String(e) });
      }
    });

  function notify() {
    const st = status();
    statusSubs.forEach((fn) => {
      try {
        fn(st);
      } catch (e) {
        /* 忽略 */
      }
    });
  }
  const status = () => ({ enabled, online, busy });
  const onStatus = (fn) => {
    statusSubs.push(fn);
    fn(status());
    return () => {
      const i = statusSubs.indexOf(fn);
      if (i >= 0) statusSubs.splice(i, 1);
    };
  };

  async function buildPayload(kind) {
    const ctrl = window.WS.Ctrl;
    let diag = null;
    let plan = null;
    try {
      if (ctrl) diag = await ctrl.buildDiag({});
    } catch (e) {
      /* 忽略 */
    }
    try {
      if (ctrl && kind !== "dump") plan = await ctrl.buildPlan({});
    } catch (e) {
      /* 忽略 */
    }
    const payload = {
      kind: kind || "sync",
      ts: Date.now(),
      url: location.href,
      domain: location.hostname,
      title: document.title,
      diag,
      plan
    };
    if (kind === "dump" || kind === "full") {
      payload.html = ctrl ? ctrl.takeSnapshot() : "<!DOCTYPE html>\n" + document.documentElement.outerHTML;
    }
    return payload;
  }

  // 主动同步一次（不依赖轮询）——页面面板/弹窗上的"同步"按钮调用
  async function pushNow(kind) {
    if (busy) return { ok: false, error: "正在同步中" };
    busy = true;
    notify();
    try {
      const payload = await buildPayload(kind || "sync");
      const r = await send("WS_BRIDGE_PUSH", payload);
      online = !!r.ok;
      return r.ok ? { ok: true } : { ok: false, error: r.error || "本地桥接服务未启动" };
    } finally {
      busy = false;
      notify();
    }
  }

  async function execCmd(cmd) {
    const ctrl = window.WS.Ctrl;
    switch (cmd.op) {
      case "ping":
        return { ok: true, url: location.href, domain: location.hostname };
      case "dump":
      case "sync": {
        await pushNow(cmd.op === "dump" ? "dump" : "sync");
        return { ok: true, synced: true };
      }
      case "diag": {
        const d = ctrl ? await ctrl.buildDiag(cmd.opts || {}) : null;
        await send("WS_BRIDGE_PUSH", await buildPayload("diag"));
        return { ok: true, counts: d && d.counts };
      }
      case "plan": {
        const p = ctrl ? await ctrl.buildPlan(cmd.opts || {}) : null;
        return { ok: true, plan: p };
      }
      case "fill": {
        if (!ctrl) return { ok: false, error: "控制器未就绪" };
        if (cmd.opts && cmd.opts.reloadDict) {
          /* 词典由 storage 变更事件自动刷新 */
        }
        ctrl.run(cmd.opts || {});
        return { ok: true, started: true };
      }
      case "stop": {
        if (ctrl) ctrl.stop();
        return { ok: true, stopped: true };
      }
      // 远程推送用户站点规则（WorkBuddy → 资料库），与已有用户规则合并
      case "rules": {
        const rule = cmd.rule;
        if (!rule || !Array.isArray(rule.fieldRules)) return { ok: false, error: "缺少 rule.fieldRules" };
        const old = (await ST.getRule(location.hostname)) || { fieldRules: [] };
        const merged = Object.assign({}, old, rule);
        merged.fieldRules = (old.fieldRules || []).concat(rule.fieldRules || []);
        await ST.saveRule(location.hostname, merged);
        return { ok: true, total: merged.fieldRules.length };
      }
      // 远程补充自定义词典（WorkBuddy → 资料库「字段词典」），与已有词条合并
      case "dict": {
        const words = cmd.words;
        if (!words || typeof words !== "object") return { ok: false, error: "缺少 words" };
        const old = (await ST.getCustomDict()) || {};
        for (const [p, ws] of Object.entries(words)) {
          old[p] = Array.from(new Set((old[p] || []).concat(ws || [])));
        }
        await ST.saveCustomDict(old);
        return { ok: true, paths: Object.keys(old).length };
      }
      case "highlight": {
        const sel = cmd.selector;
        if (!sel) return { ok: false, error: "缺少 selector" };
        const el = document.querySelector(sel);
        if (!el) return { ok: false, error: "未找到元素" };
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        const old = el.style.outline;
        el.style.outline = "3px solid #2f6fed";
        setTimeout(() => (el.style.outline = old), 2500);
        return { ok: true, text: (el.textContent || el.value || "").slice(0, 200) };
      }
      default:
        return { ok: false, error: "未知指令：" + cmd.op };
    }
  }

  async function tick() {
    if (!enabled) return;
    const r = await send("WS_BRIDGE_POLL");
    const was = online;
    online = !!r.ok;
    if (was !== online) notify();
    if (!r.ok || !r.cmd) return;
    let result;
    try {
      result = await execCmd(r.cmd);
    } catch (e) {
      result = { ok: false, error: (e && e.message) || String(e) };
    }
    await send("WS_BRIDGE_RESULT", {
      id: r.cmd.id,
      op: r.cmd.op,
      result,
      url: location.href,
      domain: location.hostname,
      ts: Date.now()
    });
  }

  function setEnabled(on) {
    enabled = !!on;
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    if (enabled) {
      tick();
      timer = setInterval(tick, 2000);
      pushNow("sync");
    } else {
      online = false;
    }
    notify();
  }

  (async () => {
    try {
      const s = await ST.getSettings();
      setEnabled(!!s.bridgeEnabled);
    } catch (e) {
      /* 忽略 */
    }
  })();

  try {
    chrome.storage.onChanged.addListener((chg) => {
      if (chg && chg.ws_settings) {
        const nv = chg.ws_settings.newValue || {};
        if (!!nv.bridgeEnabled !== enabled) setEnabled(!!nv.bridgeEnabled);
      }
    });
  } catch (e) {
    /* 忽略 */
  }

  window.WS.Bridge = { pushNow, onStatus, status, setEnabled };

  try {
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg.type === "WS_SYNC_NOW") {
        pushNow("dump").then(sendResponse);
        return true;
      }
    });
  } catch (e) {
    /* 忽略 */
  }
})();

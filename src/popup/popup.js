// 弹窗：填写控制台
(function () {
  const $ = (s) => document.querySelector(s);
  let tabId = null;
  let domain = "";

  function log(msg, type) {
    const box = $("#log");
    const line = document.createElement("div");
    line.className = type || "info";
    line.textContent = msg;
    box.appendChild(line);
    box.scrollTop = box.scrollHeight;
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "WS_PROGRESS") log(msg.msg, msg.logType);
  });

  function buildStrategyOverride() {
    const order = $("#order").value || null;
    const hs = $("#hs").value;
    const D = window.WS.DICT;
    const nohs = D.LEVEL_ORDER.filter((l) => l !== "高中");
    return {
      order,
      includeLevels: hs === "nohs" ? nohs : hs === "all" ? "__ALL__" : null
    };
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    tabId = tab.id;

    // 探测 content script
    let injected = true;
    try {
      const resp = await chrome.tabs.sendMessage(tabId, { type: "WS_PING" });
      domain = resp.domain || "";
    } catch (e) {
      injected = false;
    }
    $("#domain").textContent = domain || (tab.url || "").replace(/^https?:\/\//, "").split("/")[0] || "未知页面";
    if (!injected) {
      log("此页面未注入脚本（浏览器自带页/刷新页面后重试）", "err");
      $("#fill").disabled = true;
      $("#teach").disabled = true;
    }

    // 规则状态
    const rules = await window.WS.ST.getRules();
    const rule = domain && rules[domain];
    const tag = $("#ruleStatus");
    if (rule && (rule.fieldRules || []).length) {
      tag.textContent = "规则 " + rule.fieldRules.length + " 条";
      tag.className = "tag ok";
    } else {
      tag.textContent = "无站点规则";
      tag.className = "tag none";
    }

    // 回显站点沉淀的策略
    if (rule && rule.strategy) {
      if (rule.strategy.order) $("#order").value = rule.strategy.order;
      if (rule.strategy.includeLevels) $("#hs").value = "nohs";
    }

    const settings = await window.WS.ST.getSettings();
    $("#autoNext").checked = !!settings.autoNext;

    $("#fill").addEventListener("click", async () => {
      $("#log").innerHTML = "";
      const autoNext = $("#autoNext").checked;
      const s = await window.WS.ST.getSettings();
      if (s.autoNext !== autoNext) {
        s.autoNext = autoNext;
        await window.WS.ST.saveSettings(s);
      }
      try {
        await chrome.tabs.sendMessage(tabId, {
          type: "WS_FILL",
          opts: { strategy: buildStrategyOverride(), autoNext }
        });
      } catch (e) {
        log("发送失败：" + e.message, "err");
      }
    });

    $("#stop").addEventListener("click", () => {
      chrome.tabs.sendMessage(tabId, { type: "WS_STOP" }).catch(() => {});
      log("已请求停止");
    });

    $("#teach").addEventListener("change", (e) => {
      chrome.tabs.sendMessage(tabId, { type: "WS_TEACH", on: e.target.checked }).catch(() => {});
    });

    $("#snapshot").addEventListener("click", async () => {
      try {
        const r = await chrome.tabs.sendMessage(tabId, { type: "WS_SNAPSHOT" });
        log(r && r.ok ? "快照已下载，请把它放到项目的 site-cases/ 文件夹" : "导出失败：" + (r && r.error));
      } catch (e) {
        log("导出失败：" + e.message, "err");
      }
    });

    $("#openOptions").addEventListener("click", (e) => {
      e.preventDefault();
      chrome.runtime.openOptionsPage();
    });
  });
})();

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
    $("#bridge").checked = !!settings.bridgeEnabled;
    refreshBridgeStatus();

    async function refreshBridgeStatus() {
      const tag = $("#bridgeStatus");
      if (!$("#bridge").checked) {
        tag.textContent = "未开启";
        tag.className = "tag none";
        return;
      }
      const r = await chrome.runtime.sendMessage({ type: "WS_BRIDGE_STATUS" }).catch((e) => ({ ok: false, error: e.message }));
      tag.textContent = r && r.ok ? "已连接" : "等待本机服务";
      tag.className = "tag " + (r && r.ok ? "ok" : "none");
    }

    $("#bridge").addEventListener("change", async (e) => {
      const s = await window.WS.ST.getSettings();
      s.bridgeEnabled = e.target.checked;
      await window.WS.ST.saveSettings(s);
      refreshBridgeStatus();
      log(e.target.checked ? "已开启实时同步：WorkBuddy 可直接读取本页（需本机桥接服务在运行）" : "已关闭实时同步");
    });

    $("#hud").addEventListener("click", async () => {
      try {
        await chrome.tabs.sendMessage(tabId, { type: "WS_HUD_TOGGLE", on: true });
        log("页面面板已展开（页面右下角“网申”按钮可随时收起/展开）");
      } catch (e) {
        log("此页面不支持页面面板：" + e.message, "err");
      }
    });

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

    $("#scan").addEventListener("click", async () => {
      const box = $("#plan");
      box.style.display = "block";
      box.innerHTML = '<div class="plan-info">正在扫描页面...</div>';
      try {
        const r = await chrome.tabs.sendMessage(tabId, { type: "WS_PLAN", opts: { strategy: buildStrategyOverride() } });
        if (!r || !r.ok) {
          box.innerHTML = '<div class="plan-info">扫描失败：' + ((r && r.error) || "未知错误") + "</div>";
          return;
        }
        renderPlan(r.plan);
      } catch (e) {
        box.innerHTML = '<div class="plan-info">扫描失败：' + e.message + "</div>";
      }
    });

    function renderPlan(p) {
      const box = $("#plan");
      box.innerHTML = "";
      const h = document.createElement("div");
      h.className = "plan-head";
      h.textContent =
        "填写方案：" +
        (p.order === "latest-first" ? "最新优先" : "最早优先") +
        (p.includeLevels ? "，范围：" + p.includeLevels.join("/") : "");
      box.appendChild(h);

      const sec = (title) => {
        const d = document.createElement("div");
        d.className = "plan-sec";
        d.textContent = title;
        box.appendChild(d);
        return d;
      };
      const item = (text, cls) => {
        const d = document.createElement("div");
        d.className = "plan-item " + (cls || "");
        d.textContent = text;
        box.appendChild(d);
      };

      sec("基本信息 " + p.basics.length + " 项");
      p.basics.forEach((b) => {
        const warn = b.select === "native" && b.optionsOk === false;
        item(b.label + " ← " + b.value + (warn ? "  ⚠ 下拉无此选项" : b.select === "custom" ? "  （自定义下拉）" : ""), warn ? "warn" : "");
      });
      if (!p.basics.length) item("（本页没有可匹配的基础字段）", "muted");

      (p.sections || []).forEach((s) => {
        sec(s.title + "：" + s.segs + " 段资料，本页可见字段 " + s.items.length + " 项");
        s.items.forEach((b) => {
          const warn = b.select === "native" && b.optionsOk === false;
          item(b.label + " ← " + b.value + (warn ? "  ⚠ 下拉无此选项" : b.select === "custom" ? "  （自定义下拉）" : ""), warn ? "warn" : "");
        });
      });

      if (p.unmatchedLabels && p.unmatchedLabels.length) {
        sec("未识别 " + p.unmatchedLabels.length + " 项（可用教学模式手动映射沉淀为规则）");
        p.unmatchedLabels.forEach((l) => item(l, "muted"));
      }
    }

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

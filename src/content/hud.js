// 页面内面板：填写进度、扫描方案、未识别字段（可当场映射/填固定值）
// 存在意义：点插件图标后弹窗会关闭，日志就看不到了；这个面板常驻页面，边填边看
(function () {
  if (window.WS && window.WS.Hud) return;
  window.WS = window.WS || {};
  if (window.top !== window) return; // 只在顶层框架显示

  const D = window.WS.DICT;
  const ST = window.WS.ST;
  const host = document.createElement("div");
  host.id = "ws-hud-host";
  host.style.cssText = "all:initial;position:fixed;z-index:2147483600;right:20px;bottom:20px";
  const root = host.attachShadow({ mode: "open" });

  root.innerHTML = `
    <style>
      * { box-sizing: border-box; }
      .fab {
        width: 52px; height: 52px; border-radius: 50%; border: none; cursor: pointer;
        background: linear-gradient(135deg,#2f6fed,#5b8def); color: #fff;
        font: 600 13px/1 -apple-system,"Segoe UI","Microsoft YaHei",sans-serif;
        box-shadow: 0 6px 20px rgba(47,111,237,.35); display: flex; align-items: center; justify-content: center;
      }
      .fab:hover { transform: translateY(-1px); }
      .panel {
        position: absolute; right: 0; bottom: 64px; width: 380px; max-height: 74vh; overflow: auto;
        background: #fff; color: #1f2329; border: 1px solid #e3e8ef; border-radius: 14px;
        box-shadow: 0 16px 44px rgba(15,23,42,.16);
        font: 13px/1.6 -apple-system,"Segoe UI","Microsoft YaHei",sans-serif; padding: 14px;
      }
      .panel.hide { display: none; }
      .hd { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
      .hd b { font-size: 13px; }
      .dot { width: 8px; height: 8px; border-radius: 50%; background: #c9ced6; }
      .dot.on { background: #16a34a; }
      .dot.off { background: #dc2626; }
      .sp { flex: 1; }
      .x { border: none; background: none; cursor: pointer; color: #8a94a6; font-size: 15px; }
      .row { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
      button.b {
        border: 1px solid #d8dee8; background: #f8fafc; border-radius: 8px; padding: 5px 10px;
        font: inherit; font-size: 12px; cursor: pointer; color: #1f2329;
      }
      button.b:hover { background: #eef3fb; border-color: #b9cdf0; }
      button.b.pri { background: #2f6fed; border-color: #2f6fed; color: #fff; }
      button.b.dgr { color: #b42318; }
      button.b:disabled { opacity: .5; cursor: not-allowed; }
      .stat { background: #f6f8fb; border: 1px solid #e8edf5; border-radius: 10px; padding: 8px 10px; margin-bottom: 10px; font-size: 12px; color: #475467; }
      .stat b { color: #1f2329; }
      .sec { font-size: 12px; font-weight: 600; color: #475467; margin: 10px 0 6px; }
      .item { display: flex; gap: 6px; align-items: baseline; padding: 3px 0; font-size: 12px; border-bottom: 1px dashed #eef1f6; }
      .item .lb { color: #667085; flex: 0 0 44%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .item .vl { color: #1f2329; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .item .vl.muted { color: #98a2b3; }
      .um { padding: 6px 0; border-bottom: 1px dashed #eef1f6; }
      .um .t { display: flex; gap: 6px; align-items: center; font-size: 12px; }
      .um .t span { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #475467; }
      .map { margin-top: 6px; display: none; gap: 6px; align-items: center; }
      .map.show { display: flex; }
      select, input {
        font: inherit; font-size: 12px; padding: 4px 6px; border: 1px solid #d8dee8; border-radius: 7px;
        background: #fff; color: #1f2329; min-width: 0;
      }
      select { flex: 1; }
      input.fx { flex: 1; }
      .log { margin-top: 10px; max-height: 150px; overflow: auto; font-size: 11.5px; background: #fbfcfe; border: 1px solid #eef1f6; border-radius: 8px; padding: 6px 8px; }
      .log div { padding: 1px 0; color: #475467; }
      .log div.err { color: #b42318; }
      .log div.warn { color: #b54708; }
      .log div.ok { color: #067647; }
      .tip { font-size: 11px; color: #98a2b3; margin-top: 8px; }
    </style>
    <button class="fab" id="fab">网申</button>
    <div class="panel hide" id="panel">
      <div class="hd">
        <b>网申助手</b>
        <span class="dot" id="dot" title="本地桥接状态"></span>
        <span class="sp"></span>
        <button class="x" id="close" title="收起">✕</button>
      </div>
      <div class="row">
        <button class="b pri" id="fill">开始填写</button>
        <button class="b" id="scan">扫描预览</button>
        <button class="b" id="stop">停止</button>
        <button class="b" id="sync">同步给 WorkBuddy</button>
      </div>
      <div class="stat" id="stat">尚未扫描。点「扫描预览」先看看它认出了哪些字段。</div>
      <div id="planBox"></div>
      <div id="umBox"></div>
      <div class="sec">日志</div>
      <div class="log" id="log"></div>
      <div class="tip">面板只在本页使用；数据不出本机。填写前请先核对扫描结果。</div>
    </div>`;

  const $ = (s) => root.querySelector(s);
  const logBox = $("#log");
  const addLog = (msg, type) => {
    const d = document.createElement("div");
    d.className = type || "";
    d.textContent = msg;
    logBox.appendChild(d);
    while (logBox.children.length > 80) logBox.removeChild(logBox.firstChild);
    logBox.scrollTop = logBox.scrollHeight;
  };

  $("#fab").addEventListener("click", () => $("#panel").classList.toggle("hide"));
  $("#close").addEventListener("click", () => $("#panel").classList.add("hide"));

  // 桥接状态
  if (window.WS.Bridge) {
    window.WS.Bridge.onStatus((st) => {
      const dot = $("#dot");
      dot.className = "dot" + (st.enabled ? (st.online ? " on" : " off") : "");
      dot.title = !st.enabled ? "未开启实时同步（在插件弹窗里开启）" : st.online ? "已连接 WorkBuddy" : "未连接到本机桥接服务";
    });
  }

  // 进度日志
  window.WS.Ctrl.subscribe((msg, type) => addLog(msg, type));

  function pathSelect() {
    const sel = document.createElement("select");
    const opt0 = document.createElement("option");
    opt0.value = "__value__";
    opt0.textContent = "→ 填固定值";
    sel.appendChild(opt0);
    (D.PATH_GROUPS || []).forEach((g) => {
      const og = document.createElement("optgroup");
      og.label = g.title;
      g.items.forEach(([p, l]) => {
        const o = document.createElement("option");
        o.value = p;
        o.textContent = l;
        og.appendChild(o);
      });
      sel.appendChild(og);
    });
    return sel;
  }

  async function saveMapping(label, sel, fx) {
    const v = sel.value;
    const entry = v === "__value__" ? { match: { label }, value: (fx.value || "").trim() } : { match: { label }, from: v };
    if (v === "__value__" && !entry.value) return { ok: false, error: "请填写固定值" };
    const dom = location.hostname;
    const rule = (await ST.getRule(dom)) || { fieldRules: [] };
    rule.fieldRules = (rule.fieldRules || []).filter((r) => !(r.match && r.match.label === label));
    rule.fieldRules.push(entry);
    await ST.saveRule(dom, rule);
    return { ok: true };
  }

  function renderUnmatched(list) {
    const box = $("#umBox");
    box.innerHTML = "";
    if (!list.length) return;
    const sec = document.createElement("div");
    sec.className = "sec";
    sec.textContent = "未识别 " + list.length + " 项（点「映射」当场记住，下次自动填）";
    box.appendChild(sec);
    list.slice(0, 40).forEach((label) => {
      const wrap = document.createElement("div");
      wrap.className = "um";
      const t = document.createElement("div");
      t.className = "t";
      const s = document.createElement("span");
      s.textContent = label;
      s.title = label;
      const btn = document.createElement("button");
      btn.className = "b";
      btn.textContent = "映射";
      t.appendChild(s);
      t.appendChild(btn);

      const map = document.createElement("div");
      map.className = "map";
      const sel = pathSelect();
      const fx = document.createElement("input");
      fx.className = "fx";
      fx.placeholder = "固定值，如 无";
      fx.style.display = "none";
      const ok = document.createElement("button");
      ok.className = "b pri";
      ok.textContent = "保存";
      sel.addEventListener("change", () => {
        fx.style.display = sel.value === "__value__" ? "" : "none";
      });
      ok.addEventListener("click", async () => {
        const r = await saveMapping(label, sel, fx);
        if (r.ok) {
          addLog("已记录映射：" + label + " → " + (sel.value === "__value__" ? "固定值 " + fx.value : sel.value), "ok");
          map.classList.remove("show");
          btn.disabled = true;
          btn.textContent = "已记住";
        } else {
          addLog("映射失败：" + r.error, "err");
        }
      });
      map.appendChild(sel);
      map.appendChild(fx);
      map.appendChild(ok);
      btn.addEventListener("click", () => map.classList.toggle("show"));
      wrap.appendChild(t);
      wrap.appendChild(map);
      box.appendChild(wrap);
    });
  }

  function renderPlan(plan) {
    const box = $("#planBox");
    box.innerHTML = "";
    if (!plan) return;
    const sec = (t) => {
      const d = document.createElement("div");
      d.className = "sec";
      d.textContent = t;
      box.appendChild(d);
    };
    const item = (lb, vl, muted) => {
      const d = document.createElement("div");
      d.className = "item";
      const a = document.createElement("div");
      a.className = "lb";
      a.textContent = lb;
      a.title = lb;
      const b = document.createElement("div");
      b.className = "vl" + (muted ? " muted" : "");
      b.textContent = vl;
      b.title = vl;
      d.appendChild(a);
      d.appendChild(b);
      box.appendChild(d);
    };
    sec("基本信息 " + (plan.basics || []).length + " 项");
    (plan.basics || []).slice(0, 30).forEach((b) => item(b.label, b.value + (b.optionsOk === false ? " ⚠下拉无此项" : ""), b.optionsOk === false));
    (plan.sections || []).forEach((s) => {
      sec(s.title + "：" + s.segs + " 段资料 / 本页字段 " + (s.items || []).length + " 项");
      (s.items || []).slice(0, 20).forEach((b) => item(b.label, b.value, false));
    });
  }

  async function refreshDiag() {
    const ctrl = window.WS.Ctrl;
    const diag = await ctrl.buildDiag({});
    $("#stat").innerHTML =
      "本页控件 <b>" + diag.counts.total + "</b> 个 · 可填 <b>" + diag.counts.fillable +
      "</b> · 资料为空 <b>" + diag.counts.emptyData + "</b> · 未识别 <b>" + diag.counts.unmatched + "</b>" +
      "（顺序：" + (diag.strategy.order === "latest-first" ? "最新优先" : "最早优先") + "）";
    renderUnmatched(diag.fields.filter((f) => f.reason === "未识别").map((f) => f.label).filter(Boolean));
    return diag;
  }

  $("#scan").addEventListener("click", async () => {
    const btn = $("#scan");
    btn.disabled = true;
    try {
      const ctrl = window.WS.Ctrl;
      const plan = await ctrl.buildPlan({});
      renderPlan(plan);
      await refreshDiag();
      addLog("扫描完成：方案已生成（未写任何数据）", "ok");
      $("#panel").classList.remove("hide");
    } catch (e) {
      addLog("扫描失败：" + ((e && e.message) || e), "err");
    } finally {
      btn.disabled = false;
    }
  });

  $("#fill").addEventListener("click", async () => {
    addLog("开始填写…");
    window.WS.Ctrl.run({});
    setTimeout(() => refreshDiag().catch(() => {}), 1200);
  });

  $("#stop").addEventListener("click", () => {
    window.WS.Ctrl.stop();
    addLog("已请求停止", "warn");
  });

  $("#sync").addEventListener("click", async () => {
    if (!window.WS.Bridge) return;
    const r = await window.WS.Bridge.pushNow("sync");
    addLog(r.ok ? "已同步给 WorkBuddy" : "同步失败：" + r.error + "（需先在本机启动桥接服务）", r.ok ? "ok" : "err");
  });

  window.WS.Hud = { refreshDiag, addLog };
  document.documentElement.appendChild(host);

  try {
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg.type === "WS_HUD_TOGGLE") {
        $("#panel").classList.toggle("hide", !msg.on);
        sendResponse({ ok: true });
        return;
      }
    });
  } catch (e) {
    /* 忽略 */
  }
})();

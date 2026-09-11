// 教学模式：用户手动点击输入框，选择对应的资料项，映射写入站点规则
(function () {
  if (window.WS && window.WS.Teach) return;
  window.WS = window.WS || {};

  let on = false;
  let panel = null;
  let currentEl = null;

  function setMode(v) {
    on = !!v;
    if (on) {
      document.addEventListener("focusin", onFocus, true);
      toast("教学模式已开启：点击任意输入框进行映射");
    } else {
      document.removeEventListener("focusin", onFocus, true);
      hide();
    }
  }

  function toast(text) {
    const t = document.createElement("div");
    t.dataset.wsUi = "teach";
    t.style.cssText =
      "position:fixed;top:16px;right:16px;z-index:2147483647;background:#185fa5;color:#fff;padding:8px 14px;border-radius:8px;font:13px/1.5 sans-serif;box-shadow:0 4px 12px rgba(0,0,0,.2)";
    t.textContent = text;
    document.documentElement.appendChild(t);
    setTimeout(() => t.remove(), 2500);
  }

  function onFocus(e) {
    const el = e.target;
    if (!/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
    if (["hidden", "submit", "button", "image", "file"].includes(el.type)) return;
    currentEl = el;
    show(el);
  }

  function show(el) {
    hide();
    const label = window.WS.Scanner.clean(window.WS.Scanner.ownText(el)) || el.name || "(未识别到label)";
    panel = document.createElement("div");
    panel.dataset.wsUi = "teach";
    panel.style.cssText =
      "position:fixed;right:16px;bottom:16px;z-index:2147483647;background:#fff;border:1px solid #ccc;border-radius:10px;padding:12px;width:300px;font:13px/1.5 sans-serif;color:#222;box-shadow:0 4px 16px rgba(0,0,0,.18)";
    const title = document.createElement("div");
    title.textContent = "教学模式 · 字段映射";
    title.style.cssText = "font-weight:600;margin-bottom:6px";
    const info = document.createElement("div");
    info.textContent = "字段：" + label;
    info.style.cssText = "color:#666;margin-bottom:8px;word-break:break-all";
    const sel = document.createElement("select");
    sel.style.cssText = "width:100%;margin-bottom:8px;padding:4px";
    sel.innerHTML =
      '<option value="">-- 选择对应的资料项 --</option>' +
      Object.keys(window.WS.DICT.FIELD_DICT)
        .map((p) => '<option value="' + p + '">' + p + "</option>")
        .join("");
    const row = document.createElement("div");
    row.style.cssText = "display:flex;gap:8px";
    const btn = document.createElement("button");
    btn.textContent = "保存映射";
    btn.style.cssText =
      "flex:1;padding:6px;background:#185fa5;color:#fff;border:0;border-radius:6px;cursor:pointer";
    const close = document.createElement("button");
    close.textContent = "关闭";
    close.style.cssText = "padding:6px 12px;background:#eee;border:0;border-radius:6px;cursor:pointer";
    close.onclick = hide;
    btn.onclick = async () => {
      if (!sel.value) return;
      const rule = (await window.WS.ST.getRule(location.hostname)) || { fieldRules: [] };
      rule.fieldRules = rule.fieldRules || [];
      rule.fieldRules = rule.fieldRules.filter((r) => !(r.match && r.match.label && r.match.label === label));
      const m = {};
      if (label && label !== "(未识别到label)") m.label = label;
      if (el.name) m.name = el.name;
      rule.fieldRules.push({ match: m, from: sel.value });
      await window.WS.ST.saveRule(location.hostname, rule);
      btn.textContent = "已保存，下次生效";
      setTimeout(hide, 800);
    };
    row.appendChild(btn);
    row.appendChild(close);
    panel.appendChild(title);
    panel.appendChild(info);
    panel.appendChild(sel);
    panel.appendChild(row);
    document.documentElement.appendChild(panel);
  }

  function hide() {
    if (panel) {
      panel.remove();
      panel = null;
    }
  }

  window.WS.Teach = { setMode };
})();

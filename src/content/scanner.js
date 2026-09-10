// 字段扫描：找出页面上可见的可填控件，并尽力推断其 label
(function () {
  if (window.WS && window.WS.Scanner) return;
  window.WS = window.WS || {};

  const SELECTOR = 'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="image"]), textarea, select';

  function clean(t) {
    return String(t || "").replace(/[*＊:：\s\u3000]+/g, " ").trim();
  }

  function visible(el) {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    const st = getComputedStyle(el);
    return st.visibility !== "hidden" && st.display !== "none";
  }

  // 推断某控件对应的 label 文本
  function ownText(el) {
    return ownTextCandidates(el)[0] || "";
  }

  // 收集所有可能的 label 文本（主候选 + 备选），提高词典命中率
  function ownTextCandidates(el) {
    const cands = [];
    const push = (t) => {
      const s = clean(t);
      if (s && s.length <= 30 && !cands.includes(s)) cands.push(s);
    };
    if (el.id) {
      const l = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
      if (l) push(l.textContent);
    }
    const wrap = el.closest("label");
    if (wrap) push(wrap.textContent);
    const tr = el.closest("tr");
    if (tr) {
      const cells = Array.from(tr.children).filter(
        (c) => !c.contains(el) && !c.querySelector("input,select,textarea")
      );
      if (cells.length) push(cells[0].textContent);
    }
    let node = el.parentElement;
    for (let i = 0; i < 5 && node; i++) {
      if (node.querySelectorAll("input,select,textarea").length <= 1) {
        const clone = node.cloneNode(true);
        clone.querySelectorAll("input,select,textarea").forEach((x) => x.remove());
        push(clone.textContent);
      }
      node = node.parentElement;
    }
    let s = el.previousElementSibling;
    for (let i = 0; i < 3 && s; i++) {
      push(s.textContent);
      s = s.previousElementSibling;
    }
    if (el.getAttribute("aria-label")) push(el.getAttribute("aria-label"));
    return cands;
  }

  // radio 分组：有 name 按 name；无 name（如 Intel）按最近的共同容器
  function radioSiblings(el) {
    if (el.name) {
      const form = el.form || document;
      return Array.from(form.querySelectorAll('input[type="radio"]')).filter((r) => r.name === el.name && visible(r));
    }
    let node = el.parentElement;
    for (let i = 0; i < 6 && node; i++) {
      const radios = Array.from(node.querySelectorAll('input[type="radio"]')).filter(visible);
      if (radios.length > 1 && radios.includes(el)) return radios;
      node = node.parentElement;
    }
    return [el];
  }

  function mk(el) {
    const cands = ownTextCandidates(el);
    return {
      el,
      tag: el.tagName.toLowerCase(),
      type: el.type || "",
      name: el.name || el.id || "",
      label: cands[0] || "",
      altLabels: cands.slice(1),
      placeholder: el.placeholder || ""
    };
  }

  function scanFields(root) {
    const scope = root || document;
    const out = [];
    scope.querySelectorAll(SELECTOR).forEach((el) => {
      if (!visible(el) || el.disabled) return;
      if (el.type === "radio") {
        const group = radioSiblings(el);
        if (group[0] !== el) return; // 单选组只保留第一个
        const fd = mk(el);
        if (!fd.label) {
          let container = el.parentElement;
          for (let i = 0; i < 5 && container; i++) {
            if (group.every((r) => container.contains(r))) {
              fd.label = clean(container.textContent).slice(0, 20);
              break;
            }
            container = container.parentElement;
          }
        }
        out.push(fd);
        return;
      }
      out.push(mk(el));
    });
    return out;
  }

  // 收集页面标题与正文片段，供策略推断
  function scanSectionTexts() {
    const heads = [];
    document.querySelectorAll('h1,h2,h3,h4,h5,legend,th,[class*="title"],[class*="head"]').forEach((h) => {
      const t = clean(h.textContent);
      if (t && t.length <= 20) heads.push(t);
    });
    return { heads, pageText: clean(document.body.innerText).slice(0, 5000) };
  }

  // 按"教育经历/实习经历"等标题定位区块容器
  // extraHints 为数组时**替换**内置关键词（站点规则可精确圈定区块，如排除 Moka 的"工作经历"）
  function findSectionRoot(kind, extraHints) {
    const hints = Array.isArray(extraHints) && extraHints.length
      ? extraHints.slice()
      : (window.WS.DICT.SECTION_HINTS[kind] || []).slice();
    const nodes = document.querySelectorAll(
      'h1,h2,h3,h4,h5,legend,th,strong,b,span,div,[class*="title"],[class*="head"],[class*="caption"]'
    );
    for (const h of nodes) {
      const t = clean(h.textContent);
      if (!t || t.length > 20) continue;
      if (!hints.some((k) => t.includes(k))) continue;
      let c = h.parentElement;
      for (let i = 0; i < 4 && c; i++) {
        if (c.querySelector("input,select,textarea")) return c;
        c = c.parentElement;
      }
    }
    return null;
  }

  window.WS.Scanner = { clean, visible, ownText, ownTextCandidates, radioSiblings, scanFields, scanSectionTexts, findSectionRoot };
})();

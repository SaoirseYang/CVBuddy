// 字段扫描：找出页面上可见的可填控件，并尽力推断其 label
(function () {
  if (window.WS && window.WS.Scanner) return;
  window.WS = window.WS || {};

  const SELECTOR =
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="image"]):not([type="file"]), textarea, select';

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

  // 明显不是字段名的噪声文本
  const NOISE = /^(必填字段不能为空|此字段必填|该字段必填|请选择|请输入|上传|选择文件|浏览|暂无数据|删除|关闭|保存|确定|取消|编辑|提交|返回)$/;

  // 收集所有可能的 label 文本（主候选 + 备选），提高词典命中率
  // 关键点：① 向上找足够深（Intel 的题干在 5~6 层外的 .field-value 里）
  //        ② 题干常带提示语（"邮箱 请填写常用邮箱"、"工号(如果…请填无)"），拆出真正的字段名放前面
  function ownTextCandidates(el) {
    const cands = [];
    const add = (x) => {
      const s = clean(x);
      if (!s || s.length > 60 || NOISE.test(s) || cands.includes(s)) return;
      cands.push(s);
    };
    const push = (t) => {
      const s = clean(t);
      if (!s || NOISE.test(s)) return;
      // 括号/冒号/逗号之后多为补充说明，先切掉
      const head = s.split(/[（(【\[:：,，。;；]/)[0].trim();
      const toks = head.split(/\s+/).filter(Boolean);
      if (toks.length > 1) add(toks[0]); // "邮箱 请填写常用邮箱" → "邮箱"
      if (head.length <= 30) add(head); // "工号(如果…请填无)" → "工号"
      toks.forEach((tk) => {
        if (tk.length <= 24) add(tk);
      });
      if (s.length <= 60) add(s);
    };

    if (el.id) {
      try {
        const l = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
        if (l) push(l.textContent);
      } catch (e) {
        /* CSS.escape 不可用时忽略 */
      }
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
    // 逐层向上：容器内控件越少（≤2，兼容"输入框 + 级联/隐藏控件"这种同组两控件），文本越可能就是这一格的题干
    let node = el.parentElement;
    for (let i = 0; i < 10 && node; i++) {
      if (node.querySelectorAll("input,select,textarea").length <= 2) {
        const clone = node.cloneNode(true);
        clone.querySelectorAll("input,select,textarea").forEach((x) => x.remove());
        push(clone.textContent);
      }
      node = node.parentElement;
    }
    // 同层前置兄弟（部分自研表单 label 在左侧兄弟节点，优先级低于上方题干）
    let s = el.previousElementSibling;
    for (let i = 0; i < 3 && s; i++) {
      if (!s.querySelector("input,select,textarea")) push(s.textContent);
      s = s.previousElementSibling;
    }
    if (el.getAttribute("aria-label")) push(el.getAttribute("aria-label"));
    if (el.getAttribute("placeholder")) push(el.getAttribute("placeholder"));
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

  // 单选/多选组的"题干"反推（Intel 等：题干在组上方/同组的 field-label 里，选项只有 是/否、男/女 等）：
  // 逐层向上找完整包含整组的容器，把容器文本里的选项文字按 token 逐一剔除，剩下的即题干；
  // 残留为空就继续向上爬（Ant Design 的 form-item 只含选项，题干在外层 field-group 里）
  function groupQuestionLabel(el, group) {
    const optTexts = [];
    for (const r of group) {
      const l = r.closest("label");
      for (const t of [l ? clean(l.textContent) : "", clean(r.value || "")]) {
        if (t && t.length <= 20 && !optTexts.includes(t)) optTexts.push(t);
      }
    }
    let node = el.parentElement;
    for (let i = 0; i < 12 && node; i++) {
      if (group.every((r) => node.contains(r))) {
        let t = clean(node.textContent);
        for (const o of optTexts) t = t.split(o).join(" ");
        // 去掉校验提示残留（"性别 必填字段不能为空" → "性别"）
        t = clean(t.replace(/必填字段不能为空|此字段必填|该字段必填|请选择选填/g, " "));
        // 校验提示之类的噪声不算题干，继续向上找
        if (t && t.length <= 40 && !NOISE.test(t)) return t;
      }
      node = node.parentElement;
    }
    return "";
  }

  // 通用占位 name/id（Intel 等把 name 与 id 一律写成 "value"），当成没有名字
  const GENERIC_NAME = /^(value|input|text|textarea|undefined|null|on|yes|no)$/i;

  function mk(el) {
    const cands = ownTextCandidates(el);
    const nm = el.name && !GENERIC_NAME.test(el.name) ? el.name : "";
    const id = el.id && !GENERIC_NAME.test(el.id) ? el.id : "";
    return {
      el,
      tag: el.tagName.toLowerCase(),
      type: el.type || "",
      name: nm || id || "",
      label: cands[0] || "",
      altLabels: cands.slice(1),
      placeholder: el.placeholder || ""
    };
  }

  // 附件上传组件里的辅助输入框（如 tempAttachmentId / fileName）：不是资料字段，跳过
  function inUploadWidget(el) {
    let n = el;
    for (let i = 0; i < 5 && n; i++) {
      const t = clean(n.textContent);
      if (t.length < 2000 && /上传|附件|选择文件/.test(t)) return true;
      n = n.parentElement;
    }
    return false;
  }
  const hasCJK = (s) => /[\u4e00-\u9fa5]/.test(String(s || ""));

  // 不要填的控件：手机区号/国家代码选择器（"中国大陆(Chinese Mainland, China) + 86"）
  const SKIP_LABEL = /^(中国大陆|中国港澳台|港澳台)|区号/;

  function scanFields(root) {
    const scope = root || document;
    const out = [];
    scope.querySelectorAll(SELECTOR).forEach((el) => {
      if (!visible(el) || el.disabled) return;
      if (el.closest("[data-ws-ui]")) return; // 跳过插件自己注入的面板
      if (el.type === "radio") {
        const group = radioSiblings(el);
        if (group[0] !== el) return; // 单选组只保留第一个
        const fd = mk(el);
        // 题干反推：选项只有"是/否、男/女"，真正的题目在组上方的文字里，把它作为主 label
        const q = groupQuestionLabel(el, group);
        if (q) {
          const opts = group
            .map((r) => clean((r.closest("label") ? r.closest("label").textContent : "") || ""))
            .filter(Boolean);
          const keep = fd.label && !opts.includes(fd.label) && fd.label.length <= 24 ? fd.label : "";
          if (keep && keep !== q) fd.altLabels.unshift(keep);
          fd.label = q.slice(0, 40);
        }
        out.push(fd);
        return;
      }
      const fd = mk(el);
      // 上传组件内部的辅助框（label 是 fileName 这类英文字段名、没有中文提示）直接跳过
      if (inUploadWidget(el) && !hasCJK(fd.label) && !hasCJK(fd.placeholder)) return;
      if (SKIP_LABEL.test(fd.label || "")) return; // 手机区号选择器之类
      out.push(fd);
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

  // 导航/标签/筛选类容器里的文字不是"区块标题"（Intel 顶部有"教育经历｜实习经历…"跳转标签，
  // 误判会把它上层的整个表单圈成一个区块，导致基础字段全被跳过——这是"点了填写没反应"的常见原因）
  const NAVLIKE = /(^|[\s_-])(nav|navbar|tabs?|tabbar|menu|breadcrumb|crumb|steps?|stepbar|pagination|tags?|filter|toolbar|sidebar|aside|switch)([\s_-]|$)/i;
  function isNavLike(h) {
    const tag = h.tagName.toLowerCase();
    if (tag === "a" || tag === "li" || tag === "button") return true;
    if (h.closest("a,button,nav,aside")) return true;
    let n = h;
    for (let i = 0; i < 4 && n; i++) {
      const cls = n.getAttribute ? n.getAttribute("class") : "";
      if (cls && NAVLIKE.test(" " + cls + " ")) return true;
      n = n.parentElement;
    }
    return false;
  }

  function inputCount(node) {
    return node.querySelectorAll("input,select,textarea").length;
  }

  const TITLE_SEL =
    'h1,h2,h3,h4,h5,h6,legend,th,strong,b,dt,' +
    '[class*="title"],[class*="Title"],[class*="head"],[class*="Head"],[class*="caption"],[class*="section"],[class*="block"]';

  const allSectionHints = () => {
    const out = [];
    const m = window.WS.DICT.SECTION_HINTS || {};
    for (const k of Object.keys(m)) out.push.apply(out, m[k]);
    return out;
  };

  // 容器里出现了几个"区块标题"——≥2 说明已经爬到把这些区块都装在一起的上层容器了
  // 注意去重：section-title-wrapper 里面还有 span.section-title，同一个标题只能算一次
  function sectionTitleCount(node) {
    const hintsAll = allSectionHints();
    const hits = [];
    node.querySelectorAll(TITLE_SEL).forEach((e) => {
      const t = clean(e.textContent);
      if (!t || t.length > 24) return;
      if (!hintsAll.some((k) => t.includes(k))) return;
      if (hits.some((h) => h.contains(e))) return; // 已被上层同名标题包含
      hits.push(e);
    });
    return hits.length;
  }

  // 容器里是否有"添加 XX"按钮（空区块：还没添加过任何一段）
  function hasAddButton(node, hints) {
    const words = window.WS.DICT.ADD_WORDS || [];
    for (const b of node.querySelectorAll("button,a,[role='button'],span,div")) {
      const t = clean(b.textContent);
      if (!t || t.length > 16) continue;
      if (!words.some((w) => t.includes(w))) continue;
      if (hints.some((h) => t.includes(h))) return true;
    }
    return false;
  }

  // 按"教育经历/实习经历"等标题定位区块容器
  // extraHints 为数组时**替换**内置关键词（站点规则可精确圈定区块，如排除 Moka 的"工作经历"）
  function findSectionRoot(kind, extraHints) {
    const hints = Array.isArray(extraHints) && extraHints.length
      ? extraHints.slice()
      : (window.WS.DICT.SECTION_HINTS[kind] || []).slice();
    const total = inputCount(document);
    for (const h of document.querySelectorAll(TITLE_SEL)) {
      const t = clean(h.textContent);
      if (!t || t.length > 24) continue;
      if (!hints.some((k) => t.includes(k))) continue;
      if (isNavLike(h)) continue;
      let c = h.parentElement;
      for (let i = 0; i < 4 && c; i++) {
        // 已爬到把这些区块都装在一起的上层容器 → 这个标题不算区块
        if (sectionTitleCount(c) >= 2) break;
        const n = inputCount(c);
        // 有输入框：这就是区块本体（除非它几乎等于整页表单）
        if (n > 0) {
          if (n <= 40 && !(n >= total && total > 20)) return c;
          break;
        }
        // 没有输入框但带"添加 XX"按钮：空区块，点添加后才会出现表单
        if (hasAddButton(c, hints)) return c;
        c = c.parentElement;
      }
    }
    return null;
  }

  window.WS.Scanner = {
    clean, visible, ownText, ownTextCandidates, radioSiblings, scanFields, scanSectionTexts,
    findSectionRoot, inputCount, sectionTitleCount, isNavLike
  };
})();

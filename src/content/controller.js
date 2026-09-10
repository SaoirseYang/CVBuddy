// 流程控制器：扫描 -> 匹配 -> 填写 -> 分段循环（保存/加号）-> 单页多段兜底 -> AI 兜底 -> 策略沉淀
(function () {
  if (window.WS && window.WS.Ctrl) return;
  window.WS = window.WS || {};
  const D = window.WS.DICT;
  const Scanner = window.WS.Scanner;
  const Filler = window.WS.Filler;
  const Strategy = window.WS.Strategy;
  const ST = window.WS.ST;
  const BUILTIN = window.WS.BUILTIN;

  let running = false;
  let stopped = false;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const log = (msg, logType) => {
    try {
      chrome.runtime.sendMessage({ type: "WS_PROGRESS", msg, logType: logType || "info" });
    } catch (e) {
      /* popup 已关闭，忽略 */
    }
  };
  const domain = () => location.hostname;
  const getPath = (obj, path) => String(path).split(".").reduce((o, k) => (o == null ? o : o[k]), obj);

  // 内置规则 + 用户规则合并（用户优先）
  async function getEffectiveRule(dom) {
    const user = await ST.getRule(dom);
    const builtin = BUILTIN ? BUILTIN.forDomain(dom) : null;
    if (!user) return builtin;
    if (!builtin) return user;
    return Object.assign({}, builtin, user, {
      fieldRules: [].concat(builtin.fieldRules || [], user.fieldRules || []),
      strategy: Object.assign({}, builtin.strategy, user.strategy)
    });
  }

  // 站点规则可自定义按钮文案与区块关键词（rule.ui.addWords / saveWords / sectionHints）
  const uiWords = (rule, key, fallback) =>
    rule && rule.ui && rule.ui[key] && rule.ui[key].length ? rule.ui[key] : fallback;
  // 返回数组 = 替换内置词典（站点可排除干扰区块，如 Moka 的"工作经历"）；返回 null = 用词典默认
  const uiHints = (rule, kind) => {
    const ui = rule && rule.ui && rule.ui.sectionHints;
    return ui && ui[kind] && ui[kind].length ? ui[kind].slice() : null;
  };

  // 定位区块容器；区块折叠无输入框时，通过"添加 XX"按钮反查
  function sectionRoot(kind, rule) {
    const root = Scanner.findSectionRoot(kind, uiHints(rule, kind));
    if (root) return root;
    const hints = uiHints(rule, kind) || D.SECTION_HINTS[kind] || [];
    const addWords = uiWords(rule, "addWords", D.ADD_WORDS);
    const btns = document.querySelectorAll("button, a, [role='button'], span, div");
    for (const b of btns) {
      const t = Scanner.clean(b.textContent || "");
      if (!t || t.length > 12) continue;
      if (!addWords.some((w) => t.includes(w))) continue;
      if (!hints.some((h) => t.includes(h))) continue;
      if (!Scanner.visible(b)) continue;
      let c = b.parentElement;
      for (let i = 0; i < 4 && c; i++) {
        if (c.querySelector("input,select,textarea")) return c;
        c = c.parentElement;
      }
      return b.parentElement;
    }
    return null;
  }

  // 可见的弹层/抽屉（Intel 点"添加"后弹出表单）
  function findModal() {
    const cands = document.querySelectorAll(
      '[class*="modal"],[class*="dialog"],[class*="drawer"],[class*="popup"],[role="dialog"]'
    );
    let best = null;
    for (const c of cands) {
      if (!Scanner.visible(c)) continue;
      if (!c.querySelector("input,select,textarea")) continue;
      if (!best || c.textContent.length < best.textContent.length) best = c;
    }
    return best;
  }

  function hasBlankForm(root) {
    if (!root) return false;
    return Array.from(root.querySelectorAll("input,textarea")).some(
      (el) =>
        Scanner.visible(el) &&
        !el.disabled &&
        !el.value &&
        !el.dataset.wsFilled &&
        !["radio", "checkbox", "hidden", "submit", "button", "file"].includes(el.type)
    );
  }

  // ---- 字段->资料路径 匹配 ----

  // 词典匹配：优先命中最长词
  function lookupDict(...texts) {
    let best = null;
    for (const [path, words] of Object.entries(D.FIELD_DICT)) {
      for (const w of words) {
        for (const t of texts) {
          if (!t) continue;
          const ok = w.length <= 2 ? t === w : t.includes(w);
          if (!ok) continue;
          if (!best || w.length > best.w) best = { path, w };
        }
      }
    }
    return best ? best.path : null;
  }

  // 站点规则匹配
  function matchRuleField(fd, rule) {
    if (!rule || !rule.fieldRules) return null;
    for (const fr of rule.fieldRules) {
      if (fr.match.label && fd.label && fd.label.includes(fr.match.label)) return fr.from;
      if (fr.match.name && fd.name && (fd.name === fr.match.name || fd.name.includes(fr.match.name))) return fr.from;
    }
    return null;
  }

  // 性别单选组特判：两个选项是 男/女
  function isGenderGroup(fd) {
    if (fd.type !== "radio") return false;
    const group = Scanner.radioSiblings(fd.el);
    if (group.length !== 2) return false;
    const texts = group.map((r) => {
      const label = r.closest("label");
      return Scanner.clean((label ? label.textContent : "") + " " + (r.value || ""));
    });
    return texts.includes("男") && texts.includes("女");
  }

  function markFilled(el) {
    el.dataset.wsFilled = "1";
  }

  // ---- 基础信息填写 ----
  async function fillBasics(ctx) {
    const fields = Scanner.scanFields();
    let filled = 0;
    const unmatched = [];
    const pend = []; // 自定义下拉等待异步处理
    for (const fd of fields) {
      if (fd.el.dataset.wsFilled) continue;
      let v;
      let path = matchRuleField(fd, ctx.rule);
      if (path) v = getPath(ctx.profile, path);
      if ((v === undefined || v === null || v === "") && isGenderGroup(fd)) v = ctx.profile.basic.gender;
      if (v === undefined || v === null || v === "") {
        path = lookupDict.apply(null, [fd.label, fd.name, fd.placeholder].concat(fd.altLabels || []));
        if (path && path.startsWith("basic.")) v = getPath(ctx.profile, path);
      }
      if (v !== undefined && v !== null && v !== "" && Filler.fillField(fd, v)) {
        filled++;
        markFilled(fd.el);
      } else if (v !== undefined && v !== null && v !== "") {
        pend.push({ fd, v });
      } else {
        unmatched.push(fd);
      }
    }
    for (const { fd, v } of pend) {
      if (await fillDropdown(fd, v)) {
        filled++;
        markFilled(fd.el);
      } else {
        unmatched.push(fd);
      }
    }
    log("本页基础字段：填写 " + filled + " 个，未匹配 " + unmatched.length + " 个");
    return { unmatched };
  }

  // ---- 分段区块填写（含"添加/保存"循环）----
  function findClickButton(root, words) {
    const cands = (root || document).querySelectorAll(
      'button, a, [role="button"], input[type="button"], span, div, i, em, b'
    );
    const hit = (c, exact) => {
      const t = Scanner.clean(c.textContent || c.value || "");
      if (!t || t.length > 12) return false;
      if (!Scanner.visible(c)) return false;
      return words.some((w) => (exact ? t === w : t === w || (w.length > 1 && t.includes(w))));
    };
    for (const c of cands) if (hit(c, true)) return c; // 先精确匹配（避免点到"确定 取消"外层容器）
    for (const c of cands) if (hit(c, false)) return c;
    return null;
  }

  // ---- 自定义下拉浮层（Moka 的"请选择"等）：点击输入框 → 在新出现的浮层里点选项 ----
  function visibleLeaves() {
    return Array.from(document.querySelectorAll("li, span, div, p, a")).filter(
      (n) =>
        Scanner.visible(n) &&
        n.textContent &&
        n.textContent.length <= 20 &&
        n.querySelectorAll("li,span,div,p,a").length === 0
    );
  }

  async function fillDropdown(fd, v) {
    const el = fd.el;
    if (fd.tag !== "input" || !Filler.isCustomDropdown(el)) return false;
    const value = String(v);
    const before = new Set(visibleLeaves());
    el.scrollIntoView({ block: "center" });
    await sleep(120);
    el.click();
    await sleep(500);
    const fresh = visibleLeaves().filter((n) => !before.has(n));
    let cands = fresh.filter((n) => Scanner.clean(n.textContent) === value);
    if (!cands.length) {
      cands = fresh.filter((n) => {
        const t = Scanner.clean(n.textContent);
        return t && t.length > 1 && (t.includes(value) || value.includes(t));
      });
    }
    if (!cands.length) {
      document.body.click(); // 收起浮层
      return false;
    }
    cands.sort((a, b) => a.textContent.length - b.textContent.length);
    cands[0].click();
    await sleep(200);
    return true;
  }

  // ---- 年/月 拆分的日期输入（Moka 等）+ "至今"勾选 ----
  function fillDatePairs(scope, seg, keys) {
    const inputs = Array.from(scope.querySelectorAll("input")).filter(
      (el) =>
        !el.dataset.wsFilled &&
        Scanner.visible(el) &&
        !el.disabled &&
        ["text", ""].includes(el.type || "text") &&
        (el.placeholder === "年" || el.placeholder === "月")
    );
    const pairs = [];
    for (let i = 0; i + 1 < inputs.length; i += 2) {
      if (inputs[i].placeholder === "年" && inputs[i + 1].placeholder === "月") pairs.push([inputs[i], inputs[i + 1]]);
    }
    let filled = 0;
    pairs.forEach(([y, m], idx) => {
      const v = seg[keys[idx]];
      if (!v) return;
      const parts = String(v).split("-");
      Filler.setNativeValue(y, parts[0] || "");
      Filler.setNativeValue(m, String(parseInt(parts[1] || "0", 10) || parts[1] || ""));
      y.dataset.wsFilled = "1";
      m.dataset.wsFilled = "1";
      filled += 2;
    });
    // 结束时间为空 → 勾选"至今"
    const zhijin = Array.from(scope.querySelectorAll('input[type="checkbox"]')).filter(
      (el) => !el.dataset.wsFilled && !el.checked && Scanner.visible(el) && /至今/.test(el.parentElement ? el.parentElement.textContent : "")
    );
    if (zhijin.length && (!seg[keys[1]] || /至今/.test(String(seg[keys[1]])))) {
      zhijin[0].click();
      zhijin[0].dataset.wsFilled = "1";
      filled++;
    }
    return filled;
  }

  function fillSegment(scope, seg, ctx) {
    return (async () => {
      let filled = 0;
      const pend = [];
      for (const fd of Scanner.scanFields(scope)) {
        if (fd.el.dataset.wsFilled) continue;
        let path = matchRuleField(fd, ctx.rule);
        if (!path) path = lookupDict.apply(null, [fd.label, fd.name, fd.placeholder].concat(fd.altLabels || []));
        if (!path || path.startsWith("basic.")) continue;
        const key = path.split(".").slice(1).join(".");
        const v = seg[key];
        if (v !== undefined && v !== null && v !== "" && Filler.fillField(fd, v)) {
          filled++;
          markFilled(fd.el);
        } else if (v !== undefined && v !== null && v !== "") {
          pend.push({ fd, v });
        }
      }
      filled += fillDatePairs(scope, seg, ["start", "end"]);
      for (const { fd, v } of pend) {
        if (await fillDropdown(fd, v)) {
          filled++;
          markFilled(fd.el);
        }
      }
      return filled;
    })();
  }

  function profileListOf(profile, kind) {
    return {
      education: profile.educations,
      internship: profile.internships,
      project: profile.projects,
      award: profile.awards
    }[kind] || [];
  }

  async function handleSection(kind, ctx, strategy) {
    const segs = Strategy.apply(profileListOf(ctx.profile, kind), strategy);
    const hint = (D.SECTION_HINTS[kind] || [kind])[0];
    if (!segs.length) {
      log(hint + "：资料中没有需要填写的段落" + (strategy.includeLevels ? "（已按范围过滤）" : ""));
      return;
    }
    const addWords = uiWords(ctx.rule, "addWords", D.ADD_WORDS);
    const saveWords = uiWords(ctx.rule, "saveWords", D.SAVE_WORDS);
    log(
      hint + "：共 " + segs.length + " 段，顺序=" + (strategy.order === "latest-first" ? "最新优先" : "最早优先")
    );

    for (let i = 0; i < segs.length; i++) {
      if (stopped) return;
      const seg = segs[i];
      let root = sectionRoot(kind, ctx.rule);

      // 没有现成空表单 → 点"添加"（弹层或内联展开），确定填写范围
      let scope = root || document;
      if (!hasBlankForm(root)) {
        const addBtn =
          (root && findClickButton(root, addWords)) || findClickButton(document, addWords);
        if (!addBtn) {
          log("未找到“添加/＋”按钮，剩余 " + (segs.length - i) + " 段请手动处理", "warn");
          return;
        }
        addBtn.click();
        log("已点击“添加”，开始第 " + (i + 1) + " 段");
        await sleep(800);
        const modal = findModal();
        scope = modal || sectionRoot(kind, ctx.rule) || document;
      }

      const filled = await fillSegment(scope, seg, ctx);
      log(
        "第 " + (i + 1) + " 段「" + (seg.school || seg.company || seg.name || "") + "」填写 " + filled + " 格",
        filled ? "ok" : "warn"
      );

      // 保存/确定：优先弹层内，其次区块内（不做全页搜索，避免误点页面级提交）
      let saveBtn = null;
      if (scope !== document) saveBtn = findClickButton(scope, saveWords);
      if (!saveBtn) {
        const r = sectionRoot(kind, ctx.rule);
        if (r) saveBtn = findClickButton(r, saveWords);
      }
      if (saveBtn) {
        saveBtn.click();
        log("已点击“保存/确定”");
        await sleep(800);
      }
    }
  }

  // ---- 单页多段兜底：无区块标题的问卷式页面，按 DOM 顺序逐段投放 ----
  function fillStaticSegments(ctx, strategy) {
    const lists = {
      edu: Strategy.apply(ctx.profile.educations, strategy),
      work: Strategy.apply(ctx.profile.internships, { order: strategy.order }),
      prj: Strategy.apply(ctx.profile.projects, { order: strategy.order }),
      awd: Strategy.apply(ctx.profile.awards, { order: strategy.order })
    };
    const fields = Scanner.scanFields();
    const groups = {};
    for (const fd of fields) {
      if (fd.el.dataset.wsFilled) continue;
      const path = lookupDict.apply(null, [fd.label, fd.name, fd.placeholder].concat(fd.altLabels || []));
      if (!path || path.startsWith("basic.")) continue;
      const key = (fd.label || fd.name || path) + "|" + path;
      (groups[key] = groups[key] || []).push(fd);
    }
    let filled = 0;
    for (const arr of Object.values(groups)) {
      arr.sort(
        (a, b) => a.el.getBoundingClientRect().top - b.el.getBoundingClientRect().top
      );
      const prefix = (lookupDict(arr[0].label, arr[0].name, "") || "").split(".")[0];
      const segs = lists[prefix];
      if (!segs || !segs.length) continue;
      arr.forEach((fd, idx) => {
        const seg = segs[idx];
        if (!seg) return;
        const path = lookupDict.apply(null, [fd.label, fd.name, fd.placeholder].concat(fd.altLabels || []));
        const v = seg[path.split(".").slice(1).join(".")];
        if (v !== undefined && v !== "" && Filler.fillField(fd, v)) {
          filled++;
          markFilled(fd.el);
        }
      });
    }
    if (filled) log("单页多段模式：按 DOM 顺序填写 " + filled + " 格");
    return filled;
  }

  // ---- AI 兜底（DeepSeek）----
  async function aiFallback(ctx) {
    const fields = Scanner.scanFields();
    const pend = fields.filter((f) => !f.el.dataset.wsFilled && (f.label || f.name));
    const labels = Array.from(new Set(pend.map((f) => f.label || f.name)));
    if (!labels.length) return;
    log("AI 兜底：尝试识别 " + labels.length + " 个未匹配字段...");
    let resp;
    try {
      resp = await chrome.runtime.sendMessage({
        type: "WS_AI_MAP",
        labels,
        paths: Object.keys(D.FIELD_DICT)
      });
    } catch (e) {
      return;
    }
    if (!resp || resp.error) {
      log("AI 兜底失败：" + ((resp && resp.error) || "未知错误"), "warn");
      return;
    }
    let hits = 0;
    for (const fd of pend) {
      const path = resp.map[fd.label || fd.name];
      if (!path) continue;
      let v;
      if (path.startsWith("basic.")) {
        v = getPath(ctx.profile, path);
      } else {
        const prefix = path.split(".")[0];
        const list = {
          edu: ctx.profile.educations,
          work: ctx.profile.internships,
          prj: ctx.profile.projects,
          awd: ctx.profile.awards
        }[prefix] || [];
        const seg = list[0];
        v = seg ? seg[path.split(".").slice(1).join(".")] : undefined;
      }
      if (v !== undefined && v !== "" && Filler.fillField(fd, v)) {
        hits++;
        markFilled(fd.el);
      }
    }
    log("AI 兜底：填写 " + hits + " 个字段", hits ? "ok" : "warn");
    if (hits) {
      const rule = (await ST.getRule(domain())) || { fieldRules: [] };
      rule.fieldRules = rule.fieldRules || [];
      for (const [label, path] of Object.entries(resp.map)) {
        if (!rule.fieldRules.some((r) => r.match && r.match.label === label)) {
          rule.fieldRules.push({ match: { label }, from: path });
        }
      }
      await ST.saveRule(domain(), rule);
      log("AI 识别结果已写入站点规则，下次直接命中");
    }
  }

  // ---- 填一页 ----
  async function fillPage(opts) {
    const profile = await ST.getProfile();
    const rule = await getEffectiveRule(domain());
    const { pageText } = Scanner.scanSectionTexts();
    const strategy = Strategy.resolve(rule, pageText, opts.strategy || null);
    const ctx = { profile, rule };

    log(
      "填写顺序：" +
        (strategy.order === "latest-first" ? "最新优先（最高学历起）" : "最早优先（高中起）") +
        (strategy.includeLevels ? "，范围过滤：" + strategy.includeLevels.join("/") : "") +
        (strategy.note.length ? "（" + strategy.note.join("；") + "）" : "")
    );

    await fillBasics(ctx);

    let anyRoot = false;
    for (const kind of ["education", "internship", "project", "award"]) {
      if (stopped) break;
      if (sectionRoot(kind, rule)) {
        anyRoot = true;
        await handleSection(kind, ctx, strategy);
      }
    }
    if (!anyRoot && !stopped) fillStaticSegments(ctx, strategy);

    if (opts.ai !== false) {
      const settings = await ST.getSettings();
      if (settings.aiEnabled && settings.deepseekKey) await aiFallback(ctx);
    }

    // 策略沉淀：把本轮生效的策略写进站点规则，下次自动套用
    if (!stopped) {
      try {
        const r = (await ST.getRule(domain())) || { fieldRules: [] };
        r.strategy = Object.assign({}, r.strategy, {
          order: strategy.order,
          includeLevels: strategy.includeLevels || null
        });
        await ST.saveRule(domain(), r);
      } catch (e) {
        /* 忽略 */
      }
    }
    return strategy;
  }

  // ---- 主入口 ----
  async function run(opts = {}) {
    if (running) {
      log("已有填写任务在进行中", "warn");
      return;
    }
    running = true;
    stopped = false;
    try {
      log("开始填写：" + domain());
      await fillPage(opts);

      // 自动翻页：填完当前页后点击"下一步"继续（默认关闭，需在弹窗勾选）
      if (opts.autoNext) {
        for (let p = 0; p < 10 && !stopped; p++) {
          const nextBtn = findClickButton(document, D.NEXT_WORDS);
          if (!nextBtn) break;
          nextBtn.click();
          log("已点击“下一步”，等待页面加载...");
          await sleep(1500);
          if (stopped) break;
          await fillPage(opts);
        }
      }
      if (!stopped) log("本轮填写完成。请人工核对后再提交（插件不会自动点提交）", "ok");
    } catch (e) {
      log("出错：" + ((e && e.message) || e), "err");
    }
    running = false;
  }

  // ---- 页面快照：把当前 DOM（含已填的值）导出为 HTML，供离线分析生成站点规则 ----
  function takeSnapshot() {
    const clone = document.documentElement.cloneNode(true);
    const live = document.querySelectorAll("input, textarea, select");
    const cloned = clone.querySelectorAll("input, textarea, select");
    live.forEach((el, i) => {
      const c = cloned[i];
      if (!c) return;
      if (el.tagName === "SELECT") {
        Array.from(el.options).forEach((o, j) => {
          if (!c.options[j]) return;
          if (o.selected) c.options[j].setAttribute("selected", "selected");
          else c.options[j].removeAttribute("selected");
        });
      } else if (el.type === "checkbox" || el.type === "radio") {
        if (el.checked) c.setAttribute("checked", "checked");
        else c.removeAttribute("checked");
      } else {
        c.setAttribute("value", el.value);
      }
    });
    // 去掉本插件注入的痕迹
    clone.querySelectorAll("[data-ws-filled]").forEach((el) => el.removeAttribute("data-ws-filled"));
    return "<!DOCTYPE html>\n" + clone.outerHTML;
  }

  function downloadSnapshot() {
    const html = takeSnapshot();
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download =
      "snapshot-" + domain() + "-" + new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19) + ".html";
    document.documentElement.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  // ---- 消息入口 ----
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "WS_PING") {
      sendResponse({ ok: true, domain: domain() });
      return;
    }
    if (msg.type === "WS_FILL") {
      run(msg.opts || {});
      sendResponse({ ok: true });
      return true;
    }
    if (msg.type === "WS_STOP") {
      stopped = true;
      log("收到停止指令", "warn");
      sendResponse({ ok: true });
      return;
    }
    if (msg.type === "WS_SCAN") {
      const fields = Scanner.scanFields();
      const unmatched = fields
        .filter((f) => !f.el.dataset.wsFilled)
        .map((f) => ({ label: f.label || f.name || "(未识别)", tag: f.tag, type: f.type }));
      sendResponse({ total: fields.length, unmatched });
      return true;
    }
    if (msg.type === "WS_TEACH") {
      window.WS.Teach.setMode(!!msg.on);
      sendResponse({ ok: true });
      return;
    }
    if (msg.type === "WS_SNAPSHOT") {
      try {
        downloadSnapshot();
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: (e && e.message) || String(e) });
      }
      return true;
    }
  });

  window.WS.Ctrl = { run };
})();

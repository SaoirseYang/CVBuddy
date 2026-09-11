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
  let lastResult = null;
  const subs = []; // 进度订阅（页面内面板用）
  const subscribe = (fn) => {
    subs.push(fn);
    return () => {
      const i = subs.indexOf(fn);
      if (i >= 0) subs.splice(i, 1);
    };
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const log = (msg, logType) => {
    const type = logType || "info";
    subs.forEach((fn) => {
      try {
        fn(msg, type);
      } catch (e) {
        /* 忽略 */
      }
    });
    try {
      chrome.runtime.sendMessage({ type: "WS_PROGRESS", msg, logType: type });
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
      let found = null;
      for (let i = 0; i < 4 && c; i++) {
        if (c.querySelector("input,select,textarea")) {
          found = c;
          break;
        }
        // 已经把别的区块也圈进来了，说明爬过头了
        if (Scanner.sectionTitleCount(c) >= 2) break;
        c = c.parentElement;
      }
      if (found && Scanner.inputCount(found) <= 40 && Scanner.sectionTitleCount(found) < 2) return found;
      // 空区块（只有"添加"按钮，还没添加过任何一段）：返回按钮附近的容器，点添加后表单才出现
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

  // 用户自定义词典（资料库「字段词典」页维护），与内置词典合并；自定义词优先（先扫一遍）
  let customDict = {};
  let mergedCache = null;
  const mergedDict = () => {
    if (mergedCache) return mergedCache;
    const out = {};
    for (const [p, ws] of Object.entries(D.FIELD_DICT)) out[p] = ws.slice();
    for (const [p, ws] of Object.entries(customDict || {})) {
      out[p] = (ws || []).slice().concat(out[p] || []);
    }
    mergedCache = out;
    return out;
  };
  async function loadCustomDict() {
    try {
      customDict = await ST.getCustomDict();
    } catch (e) {
      customDict = {};
    }
    mergedCache = null;
  }
  try {
    chrome.storage.onChanged.addListener((chg) => {
      if (chg && chg.ws_dict) {
        customDict = chg.ws_dict.newValue || {};
        mergedCache = null;
      }
    });
  } catch (e) {
    /* 忽略 */
  }

  // 词典匹配。策略：
  // ① 按 texts 的先后顺序优先——主 label 命中就不再理会备选（避免容器长文本造成误配）；
  // ② 单条文本内取"最长词"；同长度时取位置更靠后的（"最高学历毕业时间" → 毕业时间 而非 最高学历）；
  // ③ preferPrefix 传入区块前缀（如 "prj"）时先只在本区块词典里找，避免"职位"串区块。
  function lookupDict(preferPrefix, ...texts) {
    const dict = mergedDict();
    const scanOne = (t, prefixFilter) => {
      let best = null;
      for (const [path, words] of Object.entries(dict)) {
        if (prefixFilter && !path.startsWith(prefixFilter + ".")) continue;
        for (const w of words) {
          if (!w) continue;
          const ok = w.length <= 2 ? t === w : t.includes(w);
          if (!ok) continue;
          const idx = t.indexOf(w);
          if (!best || w.length > best.len || (w.length === best.len && idx > best.idx)) {
            best = { path, len: w.length, idx };
          }
        }
      }
      return best ? best.path : null;
    };
    for (const t of texts) {
      if (!t) continue;
      if (preferPrefix) {
        const p = scanOne(t, preferPrefix);
        if (p) return p;
      }
      const p2 = scanOne(t, null);
      if (p2) return p2;
    }
    return null;
  }

  // 站点规则匹配：返回 { from: 资料路径 } 或 { value: 固定值 }
  function matchRuleEntry(fd, rule) {
    if (!rule || !rule.fieldRules) return null;
    for (const fr of rule.fieldRules) {
      if (!fr || !fr.match) continue;
      const hit =
        (fr.match.label && fd.label && fd.label.includes(fr.match.label)) ||
        (fr.match.name && fd.name && (fd.name === fr.match.name || fd.name.includes(fr.match.name)));
      if (!hit) continue;
      if (fr.value !== undefined && fr.value !== null) return { value: String(fr.value) };
      if (fr.from) return { from: fr.from };
    }
    return null;
  }
  function matchRuleField(fd, rule) {
    const e = matchRuleEntry(fd, rule);
    return e && e.from ? e.from : null;
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
  // 区块外出现的列表类字段（如 Intel 主页的"最高学历/最高学历毕业时间"）：
  // 用对应资料列表按策略排序后的第一条投放
  async function fillBasics(ctx, strategy) {
    const fields = Scanner.scanFields();
    // 区块内（教育/实习/证书等）的字段交给 handleSection 处理，避免 basic 字段误抢
    const secRoots = Object.keys(D.KIND_PREFIX)
      .map((k) => sectionRoot(k, ctx.rule))
      .filter(Boolean);
    const segCache = {};
    const segOf = (prefix) => {
      if (!(prefix in segCache)) {
        const kind = Object.keys(D.KIND_PREFIX).find((k) => D.KIND_PREFIX[k] === prefix);
        const list = kind ? profileListOf(ctx.profile, kind) : [];
        segCache[prefix] = Strategy.apply(list, { order: strategy ? strategy.order : null })[0] || null;
      }
      return segCache[prefix];
    };
    let filled = 0;
    const unmatched = [];
    const pend = []; // 自定义下拉等待异步处理
    for (const fd of fields) {
      if (fd.el.dataset.wsFilled) continue;
      if (secRoots.some((r) => r.contains(fd.el))) continue;
      let v;
      let path = null;
      const rentry = matchRuleEntry(fd, ctx.rule);
      if (rentry && rentry.value !== undefined) {
        v = rentry.value; // 站点规则里的固定值（如 Intel 工号填"无"）
      } else {
        if (rentry) path = rentry.from;
        if (path) v = getPath(ctx.profile, path);
        if ((v === undefined || v === null || v === "") && isGenderGroup(fd)) {
          path = "basic.gender";
          v = ctx.profile.basic.gender;
        }
        if (v === undefined || v === null || v === "") {
          path = lookupDict(null, fd.label, fd.name, fd.placeholder, ...(fd.altLabels || []));
          if (path && path.startsWith("basic.")) {
            v = getPath(ctx.profile, path);
          } else if (path) {
            // 非 basic 路径且不在任何区块内：用列表第一条
            const seg = segOf(path.split(".")[0]);
            v = seg ? seg[path.split(".").slice(1).join(".")] : undefined;
          } else {
            path = null;
          }
        }
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

  function fillSegment(scope, seg, ctx, kind) {
    return (async () => {
      const pref = D.KIND_PREFIX[kind] || null;
      let filled = 0;
      const pend = [];
      for (const fd of Scanner.scanFields(scope)) {
        if (fd.el.dataset.wsFilled) continue;
        const rentry = matchRuleEntry(fd, ctx.rule);
        if (rentry && rentry.value !== undefined) {
          if (Filler.fillField(fd, rentry.value)) {
            filled++;
            markFilled(fd.el);
          }
          continue;
        }
        let path = rentry ? rentry.from : null;
        if (!path || !path.startsWith((pref || "") + ".")) {
          path = lookupDict(pref, fd.label, fd.name, fd.placeholder, ...(fd.altLabels || []));
        }
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
      award: profile.awards,
      campus: profile.campuses,
      language: profile.languages,
      skill: profile.skills,
      certificate: profile.certificates,
      family: profile.family,
      paper: profile.papers,
      patent: profile.patents,
      portfolio: profile.works,
      competition: profile.competitions
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

      const filled = await fillSegment(scope, seg, ctx, kind);
      log(
        "第 " + (i + 1) + " 段「" + (seg.school || seg.company || seg.name || seg.title || seg.org || "") + "」填写 " + filled + " 格",
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
      awd: Strategy.apply(ctx.profile.awards, { order: strategy.order }),
      cmp: Strategy.apply(ctx.profile.campuses || [], { order: strategy.order }),
      lng: Strategy.apply(ctx.profile.languages || [], { order: strategy.order }),
      skl: Strategy.apply(ctx.profile.skills || [], { order: strategy.order }),
      crt: Strategy.apply(ctx.profile.certificates || [], { order: strategy.order }),
      fam: Strategy.apply(ctx.profile.family || [], { order: strategy.order }),
      pap: Strategy.apply(ctx.profile.papers || [], { order: strategy.order }),
      pat: Strategy.apply(ctx.profile.patents || [], { order: strategy.order }),
      wks: Strategy.apply(ctx.profile.works || [], { order: strategy.order }),
      cpt: Strategy.apply(ctx.profile.competitions || [], { order: strategy.order })
    };
    const fields = Scanner.scanFields();
    const groups = {};
    for (const fd of fields) {
      if (fd.el.dataset.wsFilled) continue;
      const path = lookupDict(null, fd.label, fd.name, fd.placeholder, ...(fd.altLabels || []));
      if (!path || path.startsWith("basic.")) continue;
      const key = (fd.label || fd.name || path) + "|" + path;
      (groups[key] = groups[key] || []).push(fd);
    }
    let filled = 0;
    for (const arr of Object.values(groups)) {
      arr.sort(
        (a, b) => a.el.getBoundingClientRect().top - b.el.getBoundingClientRect().top
      );
      const prefix = (lookupDict(null, arr[0].label, arr[0].name, "") || "").split(".")[0];
      const segs = lists[prefix];
      if (!segs || !segs.length) continue;
      arr.forEach((fd, idx) => {
        const seg = segs[idx];
        if (!seg) return;
        const path = lookupDict(null, fd.label, fd.name, fd.placeholder, ...(fd.altLabels || []));
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
        const listMap = {
          edu: ctx.profile.educations,
          work: ctx.profile.internships,
          prj: ctx.profile.projects,
          awd: ctx.profile.awards,
          cmp: ctx.profile.campuses, lng: ctx.profile.languages, skl: ctx.profile.skills,
          crt: ctx.profile.certificates, fam: ctx.profile.family, pap: ctx.profile.papers,
          pat: ctx.profile.patents, wks: ctx.profile.works, cpt: ctx.profile.competitions
        };
        const list = listMap[prefix] || [];
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

  // ---- 填写方案预览：先扫描整页，生成"字段 -> 资料项 -> 写入值"清单（与填写引擎同一套匹配逻辑，所见即所填）----
  async function buildPlan(opts = {}) {
    const profile = await ST.getProfile();
    await loadCustomDict();
    const rule = await getEffectiveRule(domain());
    const { pageText } = Scanner.scanSectionTexts();
    const strategy = Strategy.resolve(rule, pageText, opts.strategy || null);

    const trunc = (v) => {
      const s = String(v).replace(/\s+/g, " ");
      return s.length > 42 ? s.slice(0, 42) + "…" : s;
    };
    const entryOf = (fd, path, value) => {
      const e = {
        label: fd.label || fd.name || fd.placeholder || "(未识别)",
        path,
        value: trunc(value),
        select: null,
        optionsOk: null
      };
      if (fd.tag === "select") {
        e.select = "native";
        const v = String(value);
        const opts = Array.from(fd.el.options).map((o) => Scanner.clean(o.textContent));
        e.optionsOk = opts.some((o) => o === v || o.includes(v) || v.includes(o));
      } else if (fd.tag === "input" && Filler.isCustomDropdown(fd.el)) {
        e.select = "custom"; // 自定义下拉：选项在点击展开后枚举比对
      }
      return e;
    };

    // 定位所有区块，区块内字段单独归组
    const secRoots = {};
    for (const kind of Object.keys(D.KIND_PREFIX)) {
      const r = sectionRoot(kind, rule);
      if (r) secRoots[kind] = r;
    }
    const inSection = (el) => Object.values(secRoots).some((r) => r.contains(el));

    const basics = [];
    const unmatched = [];
    const segCache = {};
    const segOf = (prefix) => {
      if (!(prefix in segCache)) {
        const kind = Object.keys(D.KIND_PREFIX).find((k) => D.KIND_PREFIX[k] === prefix);
        const list = kind ? profileListOf(profile, kind) : [];
        segCache[prefix] = Strategy.apply(list, { order: strategy.order })[0] || null;
      }
      return segCache[prefix];
    };
    for (const fd of Scanner.scanFields()) {
      if (fd.el.dataset.wsFilled || inSection(fd.el)) continue;
      let path = null;
      let v;
      const rentry = matchRuleEntry(fd, rule);
      if (rentry && rentry.value !== undefined) {
        path = "(固定值)";
        v = rentry.value;
      } else {
        if (rentry) path = rentry.from;
        if (path) v = getPath(profile, path);
        if ((v === undefined || v === null || v === "") && isGenderGroup(fd)) {
          path = "basic.gender";
          v = profile.basic.gender;
        }
        if (v === undefined || v === null || v === "") {
          path = lookupDict(null, fd.label, fd.name, fd.placeholder, ...(fd.altLabels || []));
          if (path && path.startsWith("basic.")) {
            v = getPath(profile, path);
          } else if (path) {
            const seg = segOf(path.split(".")[0]);
            v = seg ? seg[path.split(".").slice(1).join(".")] : undefined;
          } else {
            path = null;
          }
        }
      }
      if (path && v !== undefined && v !== null && v !== "") basics.push(entryOf(fd, path, v));
      else unmatched.push({ label: fd.label || fd.name || fd.placeholder || "(未识别)" });
    }

    const sections = [];
    for (const [kind, root] of Object.entries(secRoots)) {
      const segs = Strategy.apply(profileListOf(profile, kind), strategy);
      const pref = D.KIND_PREFIX[kind];
      const items = [];
      for (const fd of Scanner.scanFields(root)) {
        if (fd.el.dataset.wsFilled) continue;
        const rentry = matchRuleEntry(fd, rule);
        if (rentry && rentry.value !== undefined) {
          items.push(entryOf(fd, "(固定值)", rentry.value));
          continue;
        }
        let path = rentry ? rentry.from : null;
        if (!path || !path.startsWith(pref + ".")) {
          path = lookupDict(pref, fd.label, fd.name, fd.placeholder, ...(fd.altLabels || []));
        }
        if (!path || path.startsWith("basic.")) {
          unmatched.push({ label: fd.label || fd.name || fd.placeholder || "(未识别)" });
          continue;
        }
        const v = segs.length ? segs[0][path.split(".").slice(1).join(".")] : undefined;
        if (v !== undefined && v !== null && v !== "") items.push(entryOf(fd, path, v));
      }
      sections.push({
        kind,
        title: (D.SECTION_HINTS[kind] || [kind])[0],
        segs: segs.length,
        items
      });
    }

    return {
      order: strategy.order,
      includeLevels: strategy.includeLevels,
      note: strategy.note || [],
      basics,
      sections,
      unmatchedLabels: Array.from(new Set(unmatched.map((u) => u.label))).filter(Boolean).slice(0, 20)
    };
  }

  // ---- 填一页 ----
  async function fillPage(opts) {
    const profile = await ST.getProfile();
    await loadCustomDict();
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

    await fillBasics(ctx, strategy);

    let anyRoot = false;
    for (const kind of Object.keys(D.KIND_PREFIX)) {
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

  // ---- 逐字段诊断：说明每个格子"认出了什么、准备填什么、为什么没填"（页面面板 / 本地桥接 / 离线排查都用它）----
  async function buildDiag(opts = {}) {
    const profile = await ST.getProfile();
    await loadCustomDict();
    const rule = await getEffectiveRule(domain());
    const { pageText } = Scanner.scanSectionTexts();
    const strategy = Strategy.resolve(rule, pageText, opts.strategy || null);

    const secRoots = {};
    for (const kind of Object.keys(D.KIND_PREFIX)) {
      const r = sectionRoot(kind, rule);
      if (r) secRoots[kind] = r;
    }
    const kindOfEl = (el) => Object.keys(secRoots).find((k) => secRoots[k].contains(el)) || null;

    const fields = Scanner.scanFields().map((fd) => {
      const kind = kindOfEl(fd.el);
      const pref = kind ? D.KIND_PREFIX[kind] : null;
      const entry = matchRuleEntry(fd, rule);
      let path = entry && entry.from ? entry.from : null;
      let value;
      let source = null;
      if (entry && entry.value !== undefined) {
        path = "(固定值)";
        value = entry.value;
        source = "站点固定值";
      } else {
        if (!path && isGenderGroup(fd)) {
          path = "basic.gender";
          value = profile.basic.gender;
          source = "性别选项组 → 资料库";
        }
        if (value === undefined && (!path || (pref && !path.startsWith(pref + ".")))) {
          path = lookupDict(pref, fd.label, fd.name, fd.placeholder, ...(fd.altLabels || []));
        }
        if (value === undefined && path && path.startsWith("basic.")) {
          value = getPath(profile, path);
          source = "词典/站点规则 → 资料库";
        } else if (value === undefined && path) {
          const k2 = Object.keys(D.KIND_PREFIX).find((k) => D.KIND_PREFIX[k] === path.split(".")[0]);
          const segs = Strategy.apply(k2 ? profileListOf(profile, k2) : [], strategy);
          const seg = segs[0] || null;
          value = seg ? seg[path.split(".").slice(1).join(".")] : undefined;
          source = "词典/站点规则 → 资料库(第1段)";
        }
      }
      const empty = value === undefined || value === null || value === "";
      const filled = !!fd.el.dataset.wsFilled;
      return {
        label: fd.label || fd.name || fd.placeholder || "",
        alt: (fd.altLabels || []).slice(0, 3),
        name: fd.name || "",
        placeholder: fd.placeholder || "",
        tag: fd.tag,
        type: fd.type,
        kind,
        path: path || null,
        value: empty ? null : String(value).slice(0, 60),
        source,
        filled,
        reason: filled ? "已填" : path ? (empty ? "资料为空" : "可填") : "未识别"
      };
    });

    return {
      url: location.href,
      domain: domain(),
      title: document.title,
      strategy: { order: strategy.order, includeLevels: strategy.includeLevels, note: strategy.note },
      counts: {
        total: fields.length,
        fillable: fields.filter((f) => f.reason === "可填").length,
        filled: fields.filter((f) => f.filled).length,
        emptyData: fields.filter((f) => f.reason === "资料为空").length,
        unmatched: fields.filter((f) => f.reason === "未识别").length
      },
      sections: Object.keys(secRoots).map((k) => ({ kind: k, hint: (D.SECTION_HINTS[k] || [k])[0] })),
      fields
    };
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
    if (msg.type === "WS_PLAN") {
      buildPlan(msg.opts || {})
        .then((plan) => sendResponse({ ok: true, plan }))
        .catch((e) => sendResponse({ ok: false, error: (e && e.message) || String(e) }));
      return true;
    }
    if (msg.type === "WS_DIAG") {
      buildDiag(msg.opts || {})
        .then((diag) => sendResponse({ ok: true, diag }))
        .catch((e) => sendResponse({ ok: false, error: (e && e.message) || String(e) }));
      return true;
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

  window.WS.Ctrl = {
    run,
    buildPlan,
    buildDiag,
    takeSnapshot,
    subscribe,
    isRunning: () => running,
    stop: () => {
      stopped = true;
    }
  };
})();

// 策略自适应层：填写顺序（最新/最早优先）+ 段落范围（是否含高中）
// 优先级：弹窗手动覆盖 > 站点规则沉淀 > 页面文本自动推断 > 默认（最新优先、全量）
(function () {
  if (window.WS && window.WS.Strategy) return;
  window.WS = window.WS || {};
  const D = window.WS.DICT;

  function levelOf(edu) {
    const lv = String(edu.level || "");
    for (const key of D.LEVEL_ORDER) {
      if (lv.includes(key)) return key;
      if ((D.LEVEL_WORDS[key] || []).some((w) => lv.includes(w))) return key;
    }
    return "本科";
  }

  // 从页面提示文本推断填写要求
  function infer(pageText) {
    const s = { order: "latest-first", includeLevels: null, note: [] };
    if (/从(最高|最新|最近)(学历|一段|的经历)?[^。；]{0,8}(开始填|填起|开始|填写)/.test(pageText)) {
      s.note.push("页面要求：从最高/最新学历开始填");
    } else if (/从(最低|最早)[^。；]{0,8}(开始填|填起)|由高中[^。；]{0,6}(开始|填起)|从高中[^。；]{0,6}(开始|填起)|请从(最早|最低)/.test(pageText)) {
      s.order = "earliest-first";
      s.note.push("页面要求：从最早/高中填起");
    }
    if (/(不需要|无需|不用|不填)[^。；]{0,6}高中/.test(pageText)) {
      s.includeLevels = D.LEVEL_ORDER.filter((l) => l !== "高中");
      s.note.push("页面提示：无需填高中");
    } else if (/包括高中|含高中|从高中|高中起/.test(pageText)) {
      s.note.push("页面提示：需包含高中");
    }
    return s;
  }

  // override：{ order, includeLevels }，includeLevels 用 "__ALL__" 表示强制全量
  function resolve(rule, pageText, override) {
    const base = infer(pageText || "");
    const rs = (rule && rule.strategy) || {};
    const o = override || {};
    let includeLevels;
    if (o.includeLevels === "__ALL__") includeLevels = null;
    else if (o.includeLevels && o.includeLevels.length) includeLevels = o.includeLevels;
    else if (rs.includeLevels && rs.includeLevels.length) includeLevels = rs.includeLevels;
    else includeLevels = base.includeLevels;
    return {
      order: o.order || rs.order || base.order,
      includeLevels,
      note: base.note
    };
  }

  // 过滤 + 排序：返回实际要投放的段落序列
  function apply(list, strategy) {
    let items = (list || []).slice();
    if (strategy.includeLevels) items = items.filter((e) => strategy.includeLevels.includes(levelOf(e)));
    items.sort((a, b) => {
      const r = String(b.start || "").localeCompare(String(a.start || ""));
      return strategy.order === "latest-first" ? r : -r;
    });
    return items;
  }

  window.WS.Strategy = { levelOf, infer, resolve, apply };
})();

// 资料库：基本资料 / 各板块列表 / 字段词典 / 站点规则 / 设置与备份
(function () {
  const $ = (s) => document.querySelector(s);
  const D = window.WS.DICT;
  const ST = window.WS.ST;
  const BUILTIN = window.WS.BUILTIN;
  let profile = null;
  let activeTab = "basic";

  const BASIC_FIELDS = [
    ["name", "姓名"], ["gender", "性别"], ["birth", "出生日期（如2002-05-27）"],
    ["phone", "手机号"], ["email", "邮箱"], ["idType", "证件类型"], ["idCard", "身份证号"],
    ["political", "政治面貌"], ["nation", "民族"], ["nativePlace", "籍贯/生源地"],
    ["hukou", "户籍所在地"], ["country", "国家/地区"], ["height", "身高(cm)"],
    ["weight", "体重(kg)"], ["health", "健康状况"], ["marital", "婚姻状况"],
    ["wechat", "微信号"], ["qq", "QQ号"], ["workYears", "工作年限"], ["specialty", "特长"],
    ["address", "现居住地"], ["mailingAddress", "通信地址"], ["hometown", "家庭住址"],
    ["wwid", "工号(WWID)"],
    ["emergencyContact", "紧急联系人姓名"], ["emergencyPhone", "紧急联系电话"],
    ["expectOnboard", "预计入职时间"], ["expectPosition", "期望职位/岗位"], ["expectCity", "期望城市"],
    ["expectSalary", "期望薪资"], ["expectIndustry", "期望行业"],
    ["curSalary", "当前薪资"], ["lastCompany", "最近公司"],
    ["englishScore", "英语等级成绩"], ["certName", "常用证书名称"], ["language", "语言类型"],
    ["source", "招聘信息来源"], ["hobby", "兴趣爱好"], ["selfEval", "自我评价", "textarea"]
  ];

  const LIST_DEFS = {
    educations: {
      title: "教育经历",
      nameKey: "school",
      cols: [
        ["school", "学校*"], ["level", "学历", "select", ["", "博士", "硕士", "本科", "专科", "高中"]],
        ["degree", "学位"], ["major", "专业"], ["college", "学院/院系"],
        ["start", "开始（2021-09）"], ["end", "结束（2025-06）"], ["eduForm", "学习形式"],
        ["courses", "专业课程", "textarea"], ["direction", "研究方向"],
        ["thesis", "毕业论文"], ["gpa", "GPA"], ["rank", "专业排名"],
        ["overseas", "海外经历(是/否)"], ["minor", "辅修/双学位专业"], ["tutor", "导师"]
      ]
    },
    internships: {
      title: "实习/工作经历",
      nameKey: "company",
      cols: [
        ["company", "公司/单位*"], ["position", "职位"], ["dept", "部门"],
        ["workType", "工作类型(实习/正式工作)"], ["salary", "薪资"],
        ["start", "开始"], ["end", "结束"],
        ["desc", "工作内容", "textarea"], ["achievements", "工作成果", "textarea"],
        ["referrer", "证明人姓名"], ["referrerPosition", "证明人职位"], ["referrerContact", "证明人联系方式"],
        ["leaveReason", "离职原因"], ["subordinates", "下属人数"], ["location", "工作地点"]
      ]
    },
    projects: {
      title: "项目经历",
      nameKey: "name",
      cols: [
        ["name", "项目名称*"], ["position", "职位"], ["role", "担任角色"],
        ["start", "开始"], ["end", "结束"],
        ["desc", "项目内容", "textarea"], ["duty", "本人职责", "textarea"],
        ["result", "项目成果", "textarea"], ["link", "项目链接"]
      ]
    },
    campuses: {
      title: "在校经历",
      nameKey: "org",
      cols: [
        ["type", "经历类型(社团组织/社会实践)"], ["org", "组织名称*"], ["position", "职位"],
        ["start", "开始"], ["end", "结束"], ["desc", "工作内容", "textarea"]
      ]
    },
    awards: {
      title: "获奖情况",
      nameKey: "name",
      cols: [
        ["name", "奖项名称*"], ["level", "奖励等级"], ["date", "获奖时间"],
        ["org", "颁奖机构"], ["desc", "奖励描述", "textarea"]
      ]
    },
    languages: {
      title: "外语能力",
      nameKey: "lang",
      cols: [
        ["lang", "外语语种*"], ["certName", "证书名称"], ["level", "英语水平(如CET-6)"],
        ["score", "成绩"], ["mastery", "掌握程度"], ["listening", "听说能力"], ["reading", "读写能力"]
      ]
    },
    skills: {
      title: "计算机技能",
      nameKey: "name",
      cols: [["name", "技能类型*"], ["mastery", "掌握程度"], ["score", "成绩"]]
    },
    certificates: {
      title: "资格证书",
      nameKey: "name",
      cols: [["date", "获得时间"], ["name", "证书名称*"], ["no", "证书编号"], ["desc", "证书说明", "textarea"]]
    },
    papers: {
      title: "论文期刊",
      nameKey: "title",
      cols: [
        ["date", "发表时间"], ["title", "论文名称*"], ["journal", "刊物名称"],
        ["tier", "刊物层级"], ["author", "论文作者"], ["impact", "影响因子"],
        ["desc", "论文描述", "textarea"], ["link", "论文链接"]
      ]
    },
    patents: {
      title: "专利",
      nameKey: "name",
      cols: [["date", "发表/申请时间"], ["name", "专利名称*"], ["no", "专利编号"], ["type", "专利类型"], ["result", "专利成果", "textarea"]]
    },
    competitions: {
      title: "竞赛",
      nameKey: "name",
      cols: [["name", "竞赛名称*"], ["date", "参与时间"], ["desc", "详情内容", "textarea"]]
    },
    works: {
      title: "作品集",
      nameKey: "name",
      cols: [["name", "作品名称*"], ["link", "作品链接"], ["desc", "描述", "textarea"]]
    },
    family: {
      title: "家庭情况",
      nameKey: "name",
      cols: [
        ["name", "姓名*"], ["relation", "关系(父亲/母亲…)"], ["phone", "电话"],
        ["company", "公司"], ["position", "职位"], ["political", "政治面貌"]
      ]
    }
  };

  const LIST_DESC = {
    educations: "按填写页要求自动决定顺序（最新优先 / 高中起）与是否包含高中。",
    internships: "同时作为「实习经历」与「工作经历」的来源；分段表单会逐段填写并自动点保存/添加。",
    projects: "项目经历，含本人职责与项目成果两栏长文本。",
    campuses: "社团组织、学生工作、社会实践等在校经历。",
    awards: "获奖情况：奖项名称、等级、时间、颁奖机构。",
    languages: "外语能力：语种、证书、等级、成绩、掌握程度。",
    skills: "计算机技能：技能类型、掌握程度、成绩。",
    certificates: "资格证书：获得时间、证书名称、编号、说明。",
    papers: "论文期刊：论文名称、刊物、层级、作者、影响因子。",
    patents: "专利：名称、编号、类型、成果。",
    competitions: "学科竞赛：名称、参与时间、详情。",
    works: "作品集：作品名称、链接、描述。",
    family: "家庭情况：成员姓名、关系、工作单位等。"
  };

  const TABS = [{
    id: "basic", group: "资料", title: "基本信息",
    desc: "姓名、证件、联系方式、求职意向等通用字段；填表时按最长词优先匹配。",
    render: renderBasic
  }];
  Object.keys(LIST_DEFS).forEach((k) => {
    TABS.push({
      id: k, group: "资料", title: LIST_DEFS[k].title,
      desc: LIST_DESC[k] || "可自由增删条目，顺序即填写顺序。",
      render: () => renderList(k)
    });
  });
  TABS.push(
    {
      id: "dict", group: "配置", title: "字段词典",
      desc: "页面上的字段名认不出来？把「页面上的字」和「资料项」在这里对应起来，所有网站长期生效。",
      render: renderDict
    },
    {
      id: "rules", group: "配置", title: "站点规则",
      desc: "为某个网站固定字段映射与固定值（例如工号统一填「无」），并记住该站的填写顺序策略。",
      render: renderRules
    },
    {
      id: "settings", group: "配置", title: "设置与备份",
      desc: "本地桥接（让 WorkBuddy 直连浏览器）、DeepSeek 兜底、数据导入导出。",
      render: renderSettings
    }
  );

  // ---------- 小工具 ----------
  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function btn(text, cls, onClick) {
    const b = el("button", "btn" + (cls ? " " + cls : ""), text);
    b.addEventListener("click", onClick);
    return b;
  }
  function input(value, placeholder) {
    const i = el("input", "inp");
    i.value = value === undefined || value === null ? "" : value;
    if (placeholder) i.placeholder = placeholder;
    return i;
  }
  function fieldWrap(labelText, ctrl, wide) {
    const f = el("div", "field" + (wide ? " wide" : ""));
    f.appendChild(el("label", null, labelText));
    f.appendChild(ctrl);
    return f;
  }
  function checkbox(checked, labelText) {
    const cb = el("input");
    cb.type = "checkbox";
    cb.checked = !!checked;
    const lab = el("label", "check");
    lab.appendChild(cb);
    lab.appendChild(el("span", null, labelText));
    return { cb, lab };
  }
  function setMsg(text, isErr) {
    const m = $("#saveMsg");
    m.textContent = text || "";
    m.className = "msg" + (isErr ? " err" : "");
    if (text) setTimeout(() => { if (m.textContent === text) m.textContent = ""; }, 2600);
  }
  function pathSelect(value) {
    const sel = el("select", "inp");
    (D.PATH_GROUPS || []).forEach((g) => {
      const og = el("optgroup");
      og.label = g.title;
      g.items.forEach(([p, l]) => {
        const o = el("option", null, l);
        o.value = p;
        og.appendChild(o);
      });
      sel.appendChild(og);
    });
    if (value) sel.value = value;
    return sel;
  }

  // ---------- 导航 ----------
  function buildNav(filter) {
    const nav = $("#nav");
    nav.innerHTML = "";
    let lastGroup = null;
    const kw = (filter || "").toLowerCase();
    TABS.forEach((t) => {
      if (kw && !(t.title + " " + (t.desc || "")).toLowerCase().includes(kw)) return;
      if (t.group !== lastGroup) {
        nav.appendChild(el("div", "grouplabel", t.group));
        lastGroup = t.group;
      }
      const a = el("a", t.id === activeTab ? "active" : "");
      a.appendChild(el("span", null, t.title));
      if (LIST_DEFS[t.id] && profile && Array.isArray(profile[t.id]) && profile[t.id].length) {
        a.appendChild(el("span", "cnt", String(profile[t.id].length)));
      }
      a.addEventListener("click", () => setTab(t.id));
      nav.appendChild(a);
    });
  }

  function setTab(id) {
    activeTab = id;
    const t = TABS.find((x) => x.id === id) || TABS[0];
    $("#pageTitle").textContent = t.title;
    $("#pageDesc").textContent = t.desc || "";
    buildNav($("#navSearch").value.trim());
    const box = $("#content");
    box.innerHTML = "";
    (t.render || renderBasic)(box);
  }

  // ---------- 基本信息 ----------
  function renderBasic(box) {
    const card = el("div", "card");
    card.appendChild(el("h3", null, "基本信息"));
    card.appendChild(el("p", "hint", "只填会用到的即可；空字段填表时会被跳过，并在扫描结果里记为「资料为空」。"));
    const grid = el("div", "grid");
    BASIC_FIELDS.forEach(([key, label, type]) => {
      const ctrl = type === "textarea" ? el("textarea") : input(profile.basic[key]);
      ctrl.value = profile.basic[key] || "";
      ctrl.dataset.k = key;
      ctrl.addEventListener("input", () => (profile.basic[key] = ctrl.value));
      grid.appendChild(fieldWrap(label, ctrl, type === "textarea"));
    });
    card.appendChild(grid);
    box.appendChild(card);
  }

  // ---------- 列表板块 ----------
  function renderList(kind) {
    const def = LIST_DEFS[kind];
    const box = $("#content");
    if (!Array.isArray(profile[kind])) profile[kind] = [];
    const list = profile[kind];

    const bar = el("div", "row");
    bar.appendChild(btn("＋ 添加一段", "primary", () => {
      list.push({});
      setTab(kind);
    }));
    bar.appendChild(btn("复制最后一段", null, () => {
      if (!list.length) return;
      list.push(JSON.parse(JSON.stringify(list[list.length - 1])));
      setTab(kind);
    }));
    bar.appendChild(el("span", "muted", "共 " + list.length + " 段；顺序即填写顺序（策略为最新优先时会自动倒序）"));
    box.appendChild(bar);

    if (!list.length) {
      const c = el("div", "card");
      c.appendChild(el("div", "empty", "还没有内容。点上面的「＋ 添加一段」开始录入。"));
      box.appendChild(c);
      return;
    }

    list.forEach((item, i) => {
      const card = el("div", "card entry");
      const head = el("div", "row entryhead");
      const nm = item[def.nameKey] || item.name || item.org || item.title || "第 " + (i + 1) + " 段";
      head.appendChild(el("b", null, "#" + (i + 1) + " · " + String(nm).slice(0, 40)));
      const sp = el("span");
      sp.style.flex = "1";
      head.appendChild(sp);
      head.appendChild(btn("上移", "sm", () => {
        if (i > 0) {
          const t = list[i - 1];
          list[i - 1] = list[i];
          list[i] = t;
          setTab(kind);
        }
      }));
      head.appendChild(btn("下移", "sm", () => {
        if (i < list.length - 1) {
          const t = list[i + 1];
          list[i + 1] = list[i];
          list[i] = t;
          setTab(kind);
        }
      }));
      head.appendChild(btn("复制", "sm", () => {
        list.splice(i + 1, 0, JSON.parse(JSON.stringify(item)));
        setTab(kind);
      }));
      head.appendChild(btn("删除", "sm danger", () => {
        list.splice(i, 1);
        setTab(kind);
      }));
      card.appendChild(head);

      const grid = el("div", "grid");
      def.cols.forEach(([k, lab, type, opts]) => {
        let ctrl;
        if (type === "select") {
          ctrl = el("select");
          opts.forEach((o) => {
            const op = el("option", null, o || "（未选）");
            op.value = o;
            ctrl.appendChild(op);
          });
          ctrl.value = item[k] || "";
        } else if (type === "textarea") {
          ctrl = el("textarea");
          ctrl.value = item[k] || "";
        } else {
          ctrl = input(item[k]);
        }
        const onChange = () => (item[k] = ctrl.value);
        ctrl.addEventListener("input", onChange);
        ctrl.addEventListener("change", onChange);
        grid.appendChild(fieldWrap(lab, ctrl, type === "textarea"));
      });
      card.appendChild(grid);
      box.appendChild(card);
    });
  }

  // ---------- 字段词典 ----------
  async function renderDict(box) {
    const custom = await ST.getCustomDict();

    const notice = el("div", "notice");
    notice.innerHTML =
      "词典是最优先的本地识别：网页上出现你添加的词，插件就把它填成对应资料项。" +
      "例如把「在读院校」加到「教育经历 → 学校」，以后所有网站都能认出这一栏。";
    box.appendChild(notice);

    const card = el("div", "card");
    card.appendChild(el("h3", null, "添加新词"));
    const row = el("div", "row");

    const filter = input("", "输入关键字筛选资料项，如：学校");
    filter.style.maxWidth = "300px";
    const sel = pathSelect();
    sel.style.maxWidth = "300px";
    function fillSelect(kw) {
      const keep = sel.value;
      sel.innerHTML = "";
      (D.PATH_GROUPS || []).forEach((g) => {
        const items = g.items.filter(([p, l]) => !kw || l.includes(kw) || p.includes(kw) || g.title.includes(kw));
        if (!items.length) return;
        const og = el("optgroup");
        og.label = g.title;
        items.forEach(([p, l]) => {
          const o = el("option", null, l);
          o.value = p;
          og.appendChild(o);
        });
        sel.appendChild(og);
      });
      if (keep && Array.from(sel.options).some((o) => o.value === keep)) sel.value = keep;
    }
    fillSelect("");
    filter.addEventListener("input", () => fillSelect(filter.value.trim()));

    const words = input("", "关键词，多个用逗号分隔，如：在读院校, 就读院校");
    words.style.minWidth = "260px";
    words.style.flex = "1";

    row.appendChild(fieldWrap("筛选", filter));
    row.appendChild(fieldWrap("资料项", sel));
    row.appendChild(fieldWrap("关键词", words));
    row.appendChild(btn("添加", "primary", async () => {
      const path = sel.value;
      const ws = words.value.split(/[,，、;；\s]+/).filter(Boolean);
      if (!path) return setMsg("请先选择资料项", true);
      if (!ws.length) return setMsg("请输入关键词", true);
      await ST.addDictWords(path, ws);
      setMsg("已添加：" + ws.join("、") + " → " + (D.PATH_LABELS[path] || path));
      renderDict(box);
    }));
    row.appendChild(el("span", "muted", "提示：二字词需与页面文字完全一致才算命中；三字以上按包含匹配。"));
    card.appendChild(row);
    box.appendChild(card);

    const mine = el("div", "card");
    mine.appendChild(el("h3", null, "我添加的词（" + Object.keys(custom).length + " 个资料项）"));
    if (!Object.keys(custom).length) {
      mine.appendChild(el("p", "hint", "还没有自定义词。"));
    } else {
      Object.keys(custom).forEach((path) => {
        const g = el("div", "dictgroup");
        g.appendChild(el("h4", null, D.PATH_LABELS[path] || path));
        g.appendChild(el("div", "path", path));
        const chips = el("div", "chips");
        (custom[path] || []).forEach((w) => {
          const c = el("span", "chip", w);
          const x = el("button", null, "×");
          x.title = "删除这个词";
          x.addEventListener("click", async () => {
            await ST.removeDictWord(path, w);
            renderDict(box);
          });
          c.appendChild(x);
          chips.appendChild(c);
        });
        g.appendChild(chips);
        mine.appendChild(g);
      });
    }
    box.appendChild(mine);

    const builtin = el("div", "card");
    const det = el("details");
    det.appendChild(el("summary", null, "查看内置词典（" + Object.keys(D.FIELD_DICT).length + " 个资料项，只读）"));
    (D.PATH_GROUPS || []).forEach((g) => {
      const wrap = el("div", "dictgroup");
      wrap.appendChild(el("h4", null, g.title));
      g.items.forEach(([p, l]) => {
        const ws = (D.FIELD_DICT[p] || []).slice();
        const extra = (custom[p] || []).slice();
        const line = el("div");
        line.style.marginBottom = "8px";
        line.appendChild(el("div", "path", l + "（" + p + "）"));
        const chips = el("div", "chips");
        ws.forEach((w) => chips.appendChild(el("span", "chip builtin", w)));
        extra.forEach((w) => chips.appendChild(el("span", "chip", w + " · 自定义")));
        if (!ws.length && !extra.length) chips.appendChild(el("span", "muted", "（无）"));
        line.appendChild(chips);
        wrap.appendChild(line);
      });
      det.appendChild(wrap);
    });
    builtin.appendChild(det);
    box.appendChild(builtin);
  }

  // ---------- 站点规则 ----------
  let ruleDomain = null;

  async function renderRules(box) {
    const userRules = await ST.getRules();
    const builtins = BUILTIN ? BUILTIN.all() : {};
    const domains = Array.from(new Set(Object.keys(builtins).concat(Object.keys(userRules))));
    if (!ruleDomain || (domains.indexOf(ruleDomain) < 0 && !userRules[ruleDomain])) {
      ruleDomain = domains[0] || "";
    }

    const notice = el("div", "notice");
    notice.innerHTML =
      "两种取值方式：从资料库取值（如「身份证」→ basic.idCard），或固定值（如英特尔工号，页面写「未在英特尔工作过请填无」，就固定填「无」）。" +
      "规则按域名匹配，你保存的规则覆盖内置规则。";
    box.appendChild(notice);

    const tabs = el("div", "rulelist");
    domains.forEach((d) => {
      const t = el("button", "ruletab" + (d === ruleDomain ? " active" : "") + (builtins[d] && !userRules[d] ? " builtin" : ""), d);
      t.addEventListener("click", () => {
        ruleDomain = d;
        setTab("rules");
      });
      tabs.appendChild(t);
    });
    const nd = input("", "输入域名，如 career.icbc.com.cn");
    nd.style.maxWidth = "230px";
    tabs.appendChild(nd);
    tabs.appendChild(btn("新建 / 编辑该域名", null, () => {
      const d = nd.value.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      if (!d) return setMsg("请输入域名", true);
      ruleDomain = d;
      setTab("rules");
    }));
    box.appendChild(tabs);

    if (!ruleDomain) {
      const c = el("div", "card");
      c.appendChild(el("div", "empty", "尚未选择域名。打开任一网申页面并跑一次填写，或在上方输入域名新建。"));
      box.appendChild(c);
      return;
    }

    const builtin = builtins[ruleDomain] || null;
    const user = userRules[ruleDomain] || null;
    const effUi = Object.assign({}, (builtin && builtin.ui) || {}, (user && user.ui) || {});
    const effStrategy = Object.assign({}, (builtin && builtin.strategy) || {}, (user && user.strategy) || {});
    const effRules = [].concat((builtin && builtin.fieldRules) || [], (user && user.fieldRules) || []);

    const card = el("div", "card");
    const hd = el("div", "row");
    hd.appendChild(el("h3", null, ruleDomain));
    hd.appendChild(el("span", "pill" + (builtin ? " ok" : ""), builtin ? "内置规则" : "自定义"));
    hd.appendChild(el("span", "pill" + (user ? " ok" : " warn"), user ? "已保存用户规则" : "未保存用户规则"));
    const sp = el("span");
    sp.style.flex = "1";
    hd.appendChild(sp);
    if (user) {
      hd.appendChild(btn("删除本站用户规则", "sm danger", async () => {
        if (!confirm("删除 " + ruleDomain + " 的用户规则？（内置规则会重新生效）")) return;
        await ST.deleteRule(ruleDomain);
        setMsg("已删除");
        setTab("rules");
      }));
    }
    card.appendChild(hd);

    card.appendChild(el("h3", "sec", "填写策略"));
    const srow = el("div", "row");
    const order = el("select", "inp");
    [["", "自动（读页面提示）"], ["latest-first", "最新优先（从最高学历填起）"], ["earliest-first", "最早优先（从高中填起）"]]
      .forEach(([v, t]) => {
        const o = el("option", null, t);
        o.value = v;
        order.appendChild(o);
      });
    order.value = effStrategy.order || "";
    order.style.maxWidth = "300px";
    srow.appendChild(fieldWrap("顺序", order));
    const nohs = checkbox(effStrategy.includeLevels && effStrategy.includeLevels.indexOf("高中") < 0, "不填高中经历");
    srow.appendChild(fieldWrap("范围", nohs.lab));
    card.appendChild(srow);

    card.appendChild(el("h3", "sec", "字段映射"));
    const mapRows = effRules.map((r) => JSON.parse(JSON.stringify(r)));
    const wrap = el("div", "tablewrap");
    const table = el("table");
    table.innerHTML =
      "<thead><tr><th style='width:36%'>页面上的文字（匹配）</th><th style='width:16%'>取值方式</th><th>值</th><th style='width:64px'>操作</th></tr></thead>";
    const tbody = el("tbody");
    table.appendChild(tbody);
    wrap.appendChild(table);
    card.appendChild(wrap);

    function drawMap() {
      tbody.innerHTML = "";
      if (!mapRows.length) {
        const tr = el("tr");
        const td = el("td", "empty", "暂无映射。点下面的「＋ 添加一条映射」");
        td.colSpan = 4;
        tr.appendChild(td);
        tbody.appendChild(tr);
      }
      mapRows.forEach((r, i) => {
        const tr = el("tr");

        const td1 = el("td");
        const mi = input((r.match && (r.match.label || r.match.name)) || "", "页面上的文字，如：工号");
        mi.addEventListener("input", () => {
          r.match = r.match || {};
          r.match.label = mi.value;
          delete r.match.name;
        });
        td1.appendChild(mi);
        tr.appendChild(td1);

        const td2 = el("td");
        const kindSel = el("select");
        [["from", "资料项"], ["value", "固定值"]].forEach(([v, t]) => {
          const o = el("option", null, t);
          o.value = v;
          kindSel.appendChild(o);
        });
        kindSel.value = r.value !== undefined && r.from === undefined ? "value" : "from";
        td2.appendChild(kindSel);
        tr.appendChild(td2);

        const td3 = el("td");
        const pathSel = pathSelect(r.from || null);
        const fx = input(r.value || "", "固定值，如：无");
        const sync = () => {
          const isFixed = kindSel.value === "value";
          pathSel.style.display = isFixed ? "none" : "";
          fx.style.display = isFixed ? "" : "none";
        };
        pathSel.addEventListener("change", () => {
          r.from = pathSel.value;
          delete r.value;
        });
        fx.addEventListener("input", () => {
          r.value = fx.value;
          delete r.from;
        });
        kindSel.addEventListener("change", () => {
          if (kindSel.value === "value") {
            r.value = fx.value || "";
            delete r.from;
          } else {
            r.from = pathSel.value;
            delete r.value;
          }
          sync();
        });
        td3.appendChild(pathSel);
        td3.appendChild(fx);
        tr.appendChild(td3);

        const td4 = el("td", "op");
        td4.appendChild(btn("删", "sm danger", () => {
          mapRows.splice(i, 1);
          drawMap();
        }));
        tr.appendChild(td4);

        tbody.appendChild(tr);
        sync();
      });
    }
    drawMap();
    const addRow = el("div", "row");
    addRow.style.marginTop = "10px";
    addRow.appendChild(btn("＋ 添加一条映射", null, () => {
      mapRows.push({ match: { label: "" }, from: "basic.name" });
      drawMap();
    }));
    card.appendChild(addRow);

    card.appendChild(el("h3", "sec", "按钮文案"));
    const brow = el("div", "row");
    const addWords = input((effUi.addWords || []).join(", "), "添加, 新增, ＋");
    const saveWords = input((effUi.saveWords || []).join(", "), "保存, 确定");
    brow.appendChild(fieldWrap("「添加 / 新增」按钮上的字", addWords));
    brow.appendChild(fieldWrap("「保存」按钮上的字", saveWords));
    card.appendChild(brow);

    const det = el("details");
    const hintsTa = el("textarea");
    hintsTa.style.cssText = "width:100%;min-height:130px;font:12px/1.6 Consolas,monospace;border:1px solid #e6eaf2;border-radius:10px;padding:10px";
    hintsTa.value = JSON.stringify(effUi.sectionHints || {}, null, 2);
    det.appendChild(el("summary", null, "区块标题关键词（高级：用于定位「教育经历 / 实习经历」等分区）"));
    det.appendChild(hintsTa);
    card.appendChild(det);

    const actions = el("div", "row");
    actions.style.marginTop = "14px";
    actions.appendChild(btn("保存本域名规则", "primary", async () => {
      let sectionHints = {};
      if (hintsTa.value.trim()) {
        try {
          sectionHints = JSON.parse(hintsTa.value);
        } catch (e) {
          return setMsg("区块关键词 JSON 格式错误：" + e.message, true);
        }
      }
      const cleanRules = mapRows
        .filter((r) => r.match && (r.match.label || r.match.name))
        .map((r) => {
          const o = { match: { label: r.match.label || r.match.name } };
          if (r.value !== undefined) o.value = r.value;
          else o.from = r.from;
          return o;
        });
      const rule = {
        domain: ruleDomain,
        fieldRules: cleanRules,
        ui: {
          addWords: addWords.value.split(/[,，、\s]+/).filter(Boolean),
          saveWords: saveWords.value.split(/[,，、\s]+/).filter(Boolean),
          sectionHints
        },
        strategy: {}
      };
      if (order.value) rule.strategy.order = order.value;
      if (nohs.cb.checked) rule.strategy.includeLevels = ["博士", "硕士", "本科", "专科"];
      await ST.saveRule(ruleDomain, rule);
      setMsg("已保存 " + ruleDomain + "（刷新目标页面后生效）");
      setTab("rules");
    }));
    actions.appendChild(btn("另存到其他域名…", null, () => {
      const d = prompt("保存到哪个域名？", ruleDomain);
      if (!d) return;
      ruleDomain = d.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      setTab("rules");
      setMsg("已切换到 " + ruleDomain + "，点「保存本域名规则」写入");
    }));
    card.appendChild(actions);
    box.appendChild(card);

    const rawCard = el("div", "card jsonbox");
    const det2 = el("details");
    det2.appendChild(el("summary", null, "原始 JSON（高级：直接查看 / 编辑这条规则）"));
    const ta = el("textarea");
    ta.value = JSON.stringify(user || builtin || {}, null, 2);
    det2.appendChild(ta);
    det2.appendChild(btn("保存这段 JSON", null, async () => {
      try {
        await ST.saveRule(ruleDomain, JSON.parse(ta.value));
        setMsg("JSON 已保存");
        setTab("rules");
      } catch (e) {
        setMsg("JSON 格式错误：" + e.message, true);
      }
    }));
    rawCard.appendChild(det2);
    box.appendChild(rawCard);
  }

  // ---------- 设置与备份 ----------
  async function renderSettings(box) {
    const s = await ST.getSettings();

    const br = el("div", "card");
    br.appendChild(el("h3", null, "本地桥接：让 WorkBuddy 直连你的浏览器"));
    br.appendChild(el("p", "hint",
      "开启后，当前页面的字段诊断与扫描方案会实时推送给 WorkBuddy（只走本机 127.0.0.1，不出网），" +
      "这样就可以在对话里直接看到你的页面，不用再手动导出快照。"));
    const brow = el("div", "row");
    const be = checkbox(s.bridgeEnabled, "开启实时同步");
    brow.appendChild(be.lab);
    const port = input(s.bridgePort || 8765);
    port.style.maxWidth = "110px";
    brow.appendChild(fieldWrap("端口", port));
    const status = el("span", "pill", "未检测");
    brow.appendChild(status);
    brow.appendChild(btn("连接检测", null, async () => {
      const r = await chrome.runtime.sendMessage({ type: "WS_BRIDGE_STATUS" }).catch((e) => ({ ok: false, error: e.message }));
      status.textContent = r && r.ok ? "已连接（端口 " + ((r.info && r.info.port) || port.value) + "）" : "未连接";
      status.className = "pill " + (r && r.ok ? "ok" : "warn");
    }));
    brow.appendChild(btn("同步当前标签页", null, async () => {
      const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true }).catch(() => []);
      const t = tabs && tabs[0];
      if (!t) return setMsg("找不到活动标签页", true);
      try {
        const r = await chrome.tabs.sendMessage(t.id, { type: "WS_SYNC_NOW" });
        setMsg(r && r.ok ? "已同步当前页面" : "同步失败：" + ((r && r.error) || "未知错误"), !(r && r.ok));
      } catch (e) {
        setMsg("该页面未注入脚本，请刷新页面后重试", true);
      }
    }));
    br.appendChild(brow);
    const cmd = el("div", "notice");
    cmd.innerHTML =
      "启动桥接服务（在放置本插件的项目目录下执行一次，保持窗口开着）：<br>" +
      "<code style='font-size:12px'>node wangshen-assistant/tools/bridge-server.js</code>";
    br.appendChild(cmd);
    be.cb.addEventListener("change", async () => {
      s.bridgeEnabled = be.cb.checked;
      await ST.saveSettings(s);
      setMsg("已保存");
    });
    port.addEventListener("change", async () => {
      s.bridgePort = Number(port.value) || 8765;
      await ST.saveSettings(s);
      setMsg("已保存");
    });
    box.appendChild(br);

    const ai = el("div", "card");
    ai.appendChild(el("h3", null, "DeepSeek AI 兜底（可选）"));
    ai.appendChild(el("p", "hint", "本地词典与站点规则优先；只有都没命中的字段才会问 DeepSeek，识别结果会写回站点规则。不填 Key 也完全不影响使用。"));
    const arow = el("div", "row");
    const key = input(s.deepseekKey);
    key.type = "password";
    key.style.minWidth = "320px";
    arow.appendChild(fieldWrap("API Key（仅存本机）", key));
    const ae = checkbox(s.aiEnabled, "开启 AI 兜底");
    arow.appendChild(fieldWrap("开关", ae.lab));
    ai.appendChild(arow);
    key.addEventListener("change", async () => {
      s.deepseekKey = key.value.trim();
      await ST.saveSettings(s);
      setMsg("已保存");
    });
    ae.cb.addEventListener("change", async () => {
      s.aiEnabled = ae.cb.checked;
      await ST.saveSettings(s);
      setMsg("已保存");
    });
    box.appendChild(ai);

    const bk = el("div", "card");
    bk.appendChild(el("h3", null, "数据与备份"));
    bk.appendChild(el("p", "hint", "资料、词典、站点规则全部存在浏览器本地，不上传任何服务器。换电脑或重装前导出一次即可完整迁移。"));
    const brow2 = el("div", "row");
    brow2.appendChild(btn("导出全部数据（JSON）", "primary", exportAll));
    brow2.appendChild(btn("导入备份…", null, importAll));
    brow2.appendChild(btn("清空全部站点规则", "danger", async () => {
      if (!confirm("清空所有站点规则（含教学与 AI 沉淀的）？资料与词典不受影响。")) return;
      await chrome.storage.local.set({ ws_rules: {} });
      setMsg("站点规则已清空");
    }));
    bk.appendChild(brow2);
    box.appendChild(bk);
  }

  async function exportAll() {
    const data = await ST.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "wangshen-backup-" + new Date().toISOString().slice(0, 10) + ".json";
    a.click();
  }

  function importAll() {
    const fi = document.createElement("input");
    fi.type = "file";
    fi.accept = ".json";
    fi.onchange = async () => {
      const file = fi.files[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        if (!confirm("导入会覆盖当前资料、词典与规则，确定？")) return;
        await ST.importAll(data);
        location.reload();
      } catch (e) {
        alert("导入失败：" + e.message);
      }
    };
    fi.click();
  }

  // ---------- 启动 ----------
  $("#navSearch").addEventListener("input", (e) => buildNav(e.target.value.trim()));
  $("#saveAll").addEventListener("click", async () => {
    await ST.saveProfile(profile);
    setMsg("已保存");
    buildNav($("#navSearch").value.trim());
  });
  $("#reload").addEventListener("click", async () => {
    profile = await ST.getProfile();
    setTab(activeTab);
    setMsg("已重新载入");
  });
  $("#exportQuick").addEventListener("click", exportAll);

  document.addEventListener("DOMContentLoaded", async () => {
    profile = await ST.getProfile();
    setTab("basic");
  });
})();

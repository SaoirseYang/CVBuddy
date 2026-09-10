// 资料库管理页
(function () {
  const $ = (s) => document.querySelector(s);
  let profile = null;

  const BASIC_FIELDS = [
    ["name", "姓名"], ["gender", "性别"], ["birth", "出生年月（如1999-06）"],
    ["phone", "手机号"], ["email", "邮箱"], ["idCard", "身份证号"],
    ["political", "政治面貌"], ["nation", "民族"], ["nativePlace", "籍贯"],
    ["hukou", "户籍所在地"], ["height", "身高"], ["weight", "体重"],
    ["marital", "婚姻状况"], ["address", "现居住地"], ["hometown", "家庭住址"],
    ["expectPosition", "期望职位/岗位"], ["expectCity", "期望城市"], ["expectSalary", "期望薪资"],
    ["expectIndustry", "期望行业"], ["curSalary", "当前薪资"], ["lastCompany", "最近公司"],
    ["englishScore", "英语等级成绩"], ["certName", "证书名称"], ["language", "语言类型"], ["source", "招聘信息来源"], ["emergencyContact", "紧急联系人"],
    ["emergencyPhone", "紧急联系电话"], ["hobby", "兴趣爱好"], ["selfEval", "自我评价", "textarea"]
  ];

  const LIST_DEFS = {
    educations: {
      title: "教育经历（按填写页要求自动排序投放）",
      cols: [
        ["school", "学校*"], ["level", "学历", "select", ["", "博士", "硕士", "本科", "专科", "高中"]],
        ["major", "专业"], ["degree", "学位"],
        ["start", "开始（2021-09）"], ["end", "结束（2025-06）"],
        ["eduForm", "学习形式"], ["gpa", "GPA"]
      ]
    },
    internships: {
      title: "实习/工作经历",
      cols: [
        ["company", "公司/单位*"], ["position", "职位"], ["dept", "部门"],
        ["start", "开始"], ["end", "结束"], ["desc", "工作内容", "textarea"]
      ]
    },
    projects: {
      title: "项目经历",
      cols: [
        ["name", "项目名称*"], ["role", "担任角色"], ["start", "开始"], ["end", "结束"],
        ["desc", "项目描述", "textarea"]
      ]
    },
    awards: {
      title: "获奖情况",
      cols: [["name", "奖项名称*"], ["level", "级别"], ["date", "获奖时间"], ["org", "颁发单位"]]
    }
  };

  // ---------- 渲染 ----------
  function renderBasic() {
    const box = $("#tab-basic");
    box.innerHTML = "<h3>基本信息</h3>";
    const grid = document.createElement("div");
    grid.className = "grid";
    for (const [key, label, type] of BASIC_FIELDS) {
      const f = document.createElement("div");
      f.className = "field";
      const lab = document.createElement("label");
      lab.textContent = label;
      const input = document.createElement(type === "textarea" ? "textarea" : "input");
      input.dataset.k = key;
      input.value = profile.basic[key] || "";
      f.appendChild(lab);
      f.appendChild(input);
      grid.appendChild(f);
    }
    box.appendChild(grid);
  }

  function renderList(kind) {
    const def = LIST_DEFS[kind];
    const box = $("#tab-" + kind);
    box.innerHTML = "";
    const h = document.createElement("h3");
    h.textContent = def.title;
    box.appendChild(h);
    const table = document.createElement("table");
    table.innerHTML =
      "<thead><tr>" +
      def.cols.map(([, lab]) => "<th>" + lab + "</th>").join("") +
      "<th style='width:44px'>操作</th></tr></thead>";
    const tbody = document.createElement("tbody");
    table.appendChild(tbody);
    box.appendChild(table);
    const add = document.createElement("button");
    add.textContent = "＋ 添加一段";
    add.addEventListener("click", () => {
      profile[kind].push({});
      renderList(kind);
    });
    box.appendChild(add);

    function draw() {
      tbody.innerHTML = "";
      profile[kind].forEach((item, i) => {
        const tr = document.createElement("tr");
        def.cols.forEach(([k, , type, opts]) => {
          const td = document.createElement("td");
          let input;
          if (type === "select") {
            input = document.createElement("select");
            input.innerHTML = opts.map((o) => '<option value="' + o + '">' + o + "</option>").join("");
            input.value = item[k] || "";
          } else if (type === "textarea") {
            input = document.createElement("textarea");
            input.value = item[k] || "";
          } else {
            input = document.createElement("input");
            input.value = item[k] || "";
          }
          input.addEventListener("change", () => (item[k] = input.value));
          input.addEventListener("input", () => (item[k] = input.value));
          td.appendChild(input);
          tr.appendChild(td);
        });
        const op = document.createElement("td");
        const del = document.createElement("button");
        del.textContent = "删";
        del.className = "danger";
        del.addEventListener("click", () => {
          profile[kind].splice(i, 1);
          draw();
        });
        op.appendChild(del);
        tr.appendChild(op);
        tbody.appendChild(tr);
      });
    }
    draw();
  }

  function renderRules() {
    const box = $("#tab-rules");
    box.innerHTML =
      "<h3>站点规则（教学/AI/策略自动沉淀，也可手工编辑）</h3>" +
      '<p class="muted">每个站点一个 JSON：fieldRules 为字段映射；strategy.order 填写顺序（latest-first / earliest-first）；strategy.includeLevels 为要填的学历层级（去掉"高中"即表示不填高中）。</p>';
    window.WS.ST.getRules().then((rules) => {
      const domains = Object.keys(rules);
      if (!domains.length) {
        box.innerHTML += '<p class="muted">暂无站点规则。去目标网站开启"教学模式"或跑一次填写即可生成。</p>';
      }
      domains.forEach((d) => {
        const card = document.createElement("div");
        card.className = "rulecard";
        const head = document.createElement("div");
        head.className = "rulehead";
        const b = document.createElement("b");
        b.textContent = d;
        const del = document.createElement("button");
        del.textContent = "删除";
        del.className = "danger";
        del.style.marginLeft = "auto";
        del.addEventListener("click", async () => {
          if (!confirm("确定删除站点 " + d + " 的全部规则？")) return;
          await window.WS.ST.deleteRule(d);
          renderRules();
        });
        head.appendChild(b);
        head.appendChild(del);
        const ta = document.createElement("textarea");
        ta.value = JSON.stringify(rules[d], null, 2);
        const save = document.createElement("button");
        save.textContent = "保存该站点规则";
        save.addEventListener("click", async () => {
          try {
            await window.WS.ST.saveRule(d, JSON.parse(ta.value));
            save.textContent = "已保存";
            setTimeout(() => (save.textContent = "保存该站点规则"), 1200);
          } catch (e) {
            alert("JSON 格式错误：" + e.message);
          }
        });
        card.appendChild(head);
        card.appendChild(ta);
        card.appendChild(save);
        box.appendChild(card);
      });
      // 新建
      const row = document.createElement("div");
      row.className = "row";
      const input = document.createElement("input");
      input.placeholder = "输入域名新建规则，如 career.icbc.com.cn";
      input.style.cssText = "flex:1;padding:6px 8px;border:1px solid #ccd3da;border-radius:6px";
      const create = document.createElement("button");
      create.textContent = "新建规则";
      create.addEventListener("click", async () => {
        const d = input.value.trim();
        if (!d) return;
        await window.WS.ST.saveRule(d, { domain: d, fieldRules: [] });
        renderRules();
      });
      row.appendChild(input);
      row.appendChild(create);
      box.appendChild(row);
    });
  }

  function renderSettings() {
    const box = $("#tab-settings");
    box.innerHTML = "<h3>DeepSeek AI 兜底（可选）</h3>";
    const grid = document.createElement("div");
    grid.className = "grid";
    const keyField = document.createElement("div");
    keyField.className = "field";
    keyField.innerHTML = '<label>API Key（仅存本地，不会上传）</label>';
    const keyInput = document.createElement("input");
    keyInput.type = "password";
    keyField.appendChild(keyInput);
    const aiField = document.createElement("div");
    aiField.className = "field";
    aiField.innerHTML = '<label>开启 AI 兜底</label>';
    const aiChk = document.createElement("input");
    aiChk.type = "checkbox";
    aiField.appendChild(aiChk);
    grid.appendChild(keyField);
    grid.appendChild(aiField);
    box.appendChild(grid);
    const tip = document.createElement("p");
    tip.className = "muted";
    tip.textContent = "说明：本地词典优先，只有词典和站点规则都未命中的字段才会询问 DeepSeek，且识别结果会写回站点规则缓存。";
    box.appendChild(tip);

    const h2 = document.createElement("h3");
    h2.textContent = "备份";
    box.appendChild(h2);
    const row = document.createElement("div");
    row.className = "row";
    const exp = document.createElement("button");
    exp.textContent = "导出全部数据（JSON）";
    exp.addEventListener("click", async () => {
      const data = await window.WS.ST.exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "wangshen-backup-" + new Date().toISOString().slice(0, 10) + ".json";
      a.click();
    });
    const imp = document.createElement("button");
    imp.textContent = "导入备份";
    imp.addEventListener("click", () => {
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = ".json";
      fileInput.onchange = async () => {
        const file = fileInput.files[0];
        if (!file) return;
        try {
          const data = JSON.parse(await file.text());
          if (!confirm("导入会覆盖当前资料与规则，确定？")) return;
          await window.WS.ST.importAll(data);
          location.reload();
        } catch (e) {
          alert("导入失败：" + e.message);
        }
      };
      fileInput.click();
    });
    row.appendChild(exp);
    row.appendChild(imp);
    box.appendChild(row);

    window.WS.ST.getSettings().then((s) => {
      keyInput.value = s.deepseekKey || "";
      aiChk.checked = !!s.aiEnabled;
    });
    // 设置即时保存
    keyInput.addEventListener("change", persist);
    aiChk.addEventListener("change", persist);
    async function persist() {
      const s = await window.WS.ST.getSettings();
      s.deepseekKey = keyInput.value.trim();
      s.aiEnabled = aiChk.checked;
      await window.WS.ST.saveSettings(s);
      $("#saveMsg").textContent = "设置已保存";
      setTimeout(() => ($("#saveMsg").textContent = ""), 1500);
    }
  }

  // ---------- Tab 切换 ----------
  const renderers = {
    basic: renderBasic,
    educations: () => renderList("educations"),
    internships: () => renderList("internships"),
    projects: () => renderList("projects"),
    awards: () => renderList("awards"),
    rules: renderRules,
    settings: renderSettings
  };

  document.querySelectorAll(".nav a").forEach((a) => {
    a.addEventListener("click", () => {
      document.querySelectorAll(".nav a").forEach((x) => x.classList.remove("active"));
      document.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
      a.classList.add("active");
      const tab = a.dataset.tab;
      $("#tab-" + tab).classList.add("active");
      if (tab !== "rules" && tab !== "settings") renderers[tab]();
    });
  });

  $("#saveAll").addEventListener("click", async () => {
    // 从 DOM 收集 basic
    document.querySelectorAll("#tab-basic input, #tab-basic textarea").forEach((el) => {
      if (el.dataset.k) profile.basic[el.dataset.k] = el.value.trim();
    });
    await window.WS.ST.saveProfile(profile);
    $("#saveMsg").textContent = "已保存";
    setTimeout(() => ($("#saveMsg").textContent = ""), 1500);
  });

  document.addEventListener("DOMContentLoaded", async () => {
    profile = await window.WS.ST.getProfile();
    renderBasic();
    for (const k of Object.keys(LIST_DEFS)) renderList(k);
  });
})();

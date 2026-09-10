// 内置站点规则：随插件分发，用户规则优先级更高（合并时 user 覆盖 builtin）
// 来源：site-cases/ 快照的离线 DOM 分析，可持续补充
(function () {
  if (window.WS && window.WS.BUILTIN) return;
  window.WS = window.WS || {};

  const RULES = {
    // ---- Moka 招聘系统（app.mokahr.com，如 openloong 校招）----
    // 特征：控件无 name/id，靠 placeholder 识别；"请选择"为自定义下拉浮层；
    //       日期是 年/月 两个输入框 + "至今"勾选；区块标题在 span.title；添加按钮在 blockTitle 内；
    //       无段内保存，仅页底"保存"。
    "app.mokahr.com": {
      domain: "app.mokahr.com",
      note: "Moka 招聘系统（React SPA）",
      fieldRules: [
        { match: { label: "身份证" }, from: "basic.idCard" },
        { match: { label: "自我描述" }, from: "basic.selfEval" }
      ],
      ui: {
        addWords: ["添加", "继续添加", "+", "＋"],
        saveWords: ["保存", "确定", "完成"],
        // 用精确清单替换词典默认：排除"工作经历"区块，避免与"实习经历"重复投放
        sectionHints: {
          education: ["教育背景"],
          internship: ["实习经历"],
          project: ["项目经验"],
          award: ["获奖经历"]
        }
      },
      strategy: { order: "latest-first" }
    },

    // ---- 英特尔校园招聘（chinacampus.jobs.intel.cn）----
    // 特征：控件统一 name="value"、无 placeholder，靠容器文本识别；radio 无 name（按共同容器分组）；
    //       点"添加 XX"弹出表单（modal），段内"确定"保存；页面自带"请从最近的经历填起"提示（策略自动推断最新优先）。
    "chinacampus.jobs.intel.cn": {
      domain: "chinacampus.jobs.intel.cn",
      note: "英特尔中国校园招聘",
      fieldRules: [],
      ui: {
        addWords: ["添加"],
        saveWords: ["确定", "保存"],
        sectionHints: {
          education: ["教育经历"],
          internship: ["实习经验"],
          project: ["项目经历"],
          award: ["获奖情况"]
        }
      },
      strategy: { order: "latest-first" }
    },

    // ---- 中华英才网（applyjob.chinahr.com）----
    // 特征：分组表单，每组"编辑/删除"折叠 + 组内"保存"；基础信息控件靠容器文本；
    //       出生日期为"请选择日期"控件（直接写值）；折叠组暂不支持自动展开，需先手动点"编辑"。
    "applyjob.chinahr.com": {
      domain: "applyjob.chinahr.com",
      note: "中华英才网投递表单",
      fieldRules: [
        { match: { label: "与身份证件上的姓名一致" }, from: "basic.name" },
        { match: { label: "紧急联系人姓名" }, from: "basic.emergencyContact" }
      ],
      ui: {
        addWords: ["添加", "新增", "＋"],
        saveWords: ["保存", "确定"],
        sectionHints: {
          education: ["教育经历"],
          internship: ["实习经历", "实习经验"],
          project: ["项目经历"],
          award: ["获奖情况"]
        }
      },
      strategy: {}
    }
  };

  window.WS.BUILTIN = {
    forDomain(d) {
      if (!d) return null;
      for (const key of Object.keys(RULES)) {
        if (d === key || d.endsWith("." + key)) {
          return JSON.parse(JSON.stringify(RULES[key]));
        }
      }
      return null;
    },
    all() {
      return JSON.parse(JSON.stringify(RULES));
    }
  };
})();

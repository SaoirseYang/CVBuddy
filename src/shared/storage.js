// 存储封装：content / popup / options 共用（chrome.storage.local）
(function () {
  if (window.WS && window.WS.ST) return;
  window.WS = window.WS || {};

  const DEFAULT_PROFILE = {
    basic: {
      name: "", gender: "", birth: "", phone: "", email: "", idType: "身份证", idCard: "",
      political: "", nation: "", nativePlace: "", hukou: "", height: "", weight: "",
      health: "", marital: "", qq: "", wechat: "", hometown: "", address: "",
      country: "", mailingAddress: "", workYears: "", specialty: "", expectOnboard: "",
      wwid: "",
      expectPosition: "", expectCity: "", expectSalary: "", expectIndustry: "",
      curSalary: "", lastCompany: "", englishScore: "", certName: "", language: "",
      source: "", emergencyContact: "", emergencyPhone: "", hobby: "", selfEval: ""
    },
    educations: [],   // { school, level, degree, major, college, start, end, eduForm, courses, direction, thesis, gpa, rank, overseas, minor, tutor }
    internships: [],  // { company, position, dept, workType, salary, start, end, desc, achievements, referrer, referrerPosition, referrerContact, leaveReason, subordinates, location }
    projects: [],     // { name, role, position, start, end, desc, duty, result, link }
    awards: [],       // { name, level, date, org, desc }
    campuses: [],     // { type, org, position, start, end, desc }
    languages: [],    // { lang, certName, level, score, mastery, listening, reading }
    skills: [],       // { name, mastery, score }
    certificates: [], // { date, name, no, desc }
    family: [],       // { name, relation, phone, company, position, political }
    papers: [],       // { date, journal, tier, title, desc, author, impact, link }
    patents: [],      // { date, name, no, type, result }
    works: [],        // { name, link, desc }
    competitions: []  // { name, date, desc }
  };

  const get = (keys) => new Promise((res) => chrome.storage.local.get(keys, res));
  const set = (obj) => new Promise((res) => chrome.storage.local.set(obj, res));

  // 旧版资料合并默认结构：保证 basic 字段与所有列表数组存在（向后兼容）
  function mergeProfile(p) {
    const out = Object.assign(JSON.parse(JSON.stringify(DEFAULT_PROFILE)), p || {});
    out.basic = Object.assign({}, DEFAULT_PROFILE.basic, (p && p.basic) || {});
    for (const k of Object.keys(DEFAULT_PROFILE)) {
      if (Array.isArray(DEFAULT_PROFILE[k]) && !Array.isArray(out[k])) out[k] = [];
    }
    return out;
  }

  async function getProfile() {
    const { ws_profile } = await get("ws_profile");
    return mergeProfile(ws_profile);
  }
  const saveProfile = (p) => set({ ws_profile: p });

  async function getRules() {
    const { ws_rules } = await get("ws_rules");
    return ws_rules || {};
  }
  async function getRule(domain) {
    const rules = await getRules();
    return rules[domain] || null;
  }
  async function saveRule(domain, rule) {
    const rules = await getRules();
    rules[domain] = rule;
    return set({ ws_rules: rules });
  }
  async function deleteRule(domain) {
    const rules = await getRules();
    delete rules[domain];
    return set({ ws_rules: rules });
  }

  async function getSettings() {
    const { ws_settings } = await get("ws_settings");
    return Object.assign({ aiEnabled: false, deepseekKey: "", bridgeEnabled: false, bridgePort: 8765 }, ws_settings || {});
  }
  const saveSettings = (s) => set({ ws_settings: s });

  // ---- 自定义词典：{"basic.name": ["我叫"], ...} 与内置词典合并，自定义词优先参与匹配 ----
  async function getCustomDict() {
    const { ws_dict } = await get("ws_dict");
    return ws_dict || {};
  }
  const saveCustomDict = (d) => set({ ws_dict: d });
  async function addDictWords(path, words) {
    const d = await getCustomDict();
    const cur = d[path] || [];
    for (const w of words) {
      const t = String(w).trim();
      if (t && !cur.includes(t)) cur.push(t);
    }
    d[path] = cur;
    await saveCustomDict(d);
    return d;
  }
  async function removeDictWord(path, word) {
    const d = await getCustomDict();
    if (d[path]) {
      d[path] = d[path].filter((w) => w !== word);
      if (!d[path].length) delete d[path];
      await saveCustomDict(d);
    }
    return d;
  }

  const exportAll = () => get(["ws_profile", "ws_rules", "ws_settings", "ws_dict"]);
  const importAll = (data) => set(data);

  window.WS.ST = {
    DEFAULT_PROFILE, getProfile, saveProfile, getRules, getRule, saveRule, deleteRule,
    getSettings, saveSettings, getCustomDict, saveCustomDict, addDictWords, removeDictWord,
    exportAll, importAll
  };
})();

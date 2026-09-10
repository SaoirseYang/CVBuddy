// 存储封装：content / popup / options 共用（chrome.storage.local）
(function () {
  if (window.WS && window.WS.ST) return;
  window.WS = window.WS || {};

  const DEFAULT_PROFILE = {
    basic: {
      name: "", gender: "", birth: "", phone: "", email: "", idCard: "",
      political: "", nation: "", nativePlace: "", hukou: "", height: "", weight: "",
      health: "", marital: "", qq: "", wechat: "", hometown: "", address: "",
      expectPosition: "", expectCity: "", expectSalary: "", expectIndustry: "",
      curSalary: "", lastCompany: "", englishScore: "", certName: "", language: "",
      source: "", emergencyContact: "", emergencyPhone: "", hobby: "", selfEval: ""
    },
    educations: [],   // { school, level, major, degree, start:"2021-09", end:"2025-06", eduForm, gpa, rank, class, tutor }
    internships: [],  // { company, position, dept, start, end, desc, location }
    projects: [],     // { name, role, start, end, desc }
    awards: []        // { name, level, date, org }
  };

  const get = (keys) => new Promise((res) => chrome.storage.local.get(keys, res));
  const set = (obj) => new Promise((res) => chrome.storage.local.set(obj, res));

  async function getProfile() {
    const { ws_profile } = await get("ws_profile");
    return ws_profile ? ws_profile : JSON.parse(JSON.stringify(DEFAULT_PROFILE));
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
    return ws_settings || { aiEnabled: false, deepseekKey: "" };
  }
  const saveSettings = (s) => set({ ws_settings: s });

  const exportAll = () => get(["ws_profile", "ws_rules", "ws_settings"]);
  const importAll = (data) => set(data);

  window.WS.ST = { DEFAULT_PROFILE, getProfile, saveProfile, getRules, getRule, saveRule, deleteRule, getSettings, saveSettings, exportAll, importAll };
})();

// 填写引擎：按控件类型分发的值适配器
(function () {
  if (window.WS && window.WS.Filler) return;
  window.WS = window.WS || {};

  function fire(el, type) {
    el.dispatchEvent(new Event(type, { bubbles: true }));
  }

  // 兼容 React/Vue 受控组件的原生赋值
  function setNativeValue(el, value) {
    const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, "value");
    if (desc && desc.set) desc.set.call(el, value);
    else el.value = value;
    fire(el, "input");
    fire(el, "change");
    fire(el, "blur");
  }

  // 日期格式适配：资料统一存 "YYYY-MM" / "YYYY-MM-DD"，按控件要求变形
  function fmtDate(v, el) {
    if (!v) return "";
    if (el && el.type === "date") return v.length >= 10 ? v.slice(0, 10) : v + "-01";
    if (el && el.type === "month") return v.slice(0, 7);
    const ph = (el && el.placeholder) || "";
    const sep = ph.includes("/") ? "/" : ph.includes(".") ? "." : "-";
    const body = v.slice(0, 7).replace("-", sep);
    if (v.length >= 10) {
      const day = v.slice(8, 10);
      return body + sep + day;
    }
    return body;
  }

  function fillSelect(el, value) {
    const v = String(value);
    const opts = Array.from(el.options);
    const opt =
      opts.find((o) => o.value === v) ||
      opts.find((o) => o.textContent.trim() === v) ||
      opts.find((o) => {
        const t = o.textContent.trim();
        return t && (t.includes(v) || v.includes(t)) && t.length > 1;
      });
    if (opt) {
      el.value = opt.value;
      fire(el, "input");
      fire(el, "change");
      return true;
    }
    return false;
  }

  function fillRadioGroup(el, value) {
    const radios = window.WS.Scanner.radioSiblings(el);
    const v = String(value);
    for (const r of radios) {
      const label = r.closest("label");
      const text = window.WS.Scanner.clean((label ? label.textContent : "") + " " + (r.value || ""));
      if (text === v || text.includes(v) || r.value === v) {
        r.checked = true;
        fire(r, "input");
        fire(r, "change");
        return true;
      }
    }
    return false;
  }

  function isCustomDropdown(el) {
    return (
      el.tagName === "INPUT" &&
      (el.readOnly || el.hasAttribute("readonly") || (el.placeholder || "").includes("请选择")) &&
      !(el.placeholder || "").includes("日期")
    );
  }

  function fillField(fd, value) {
    const el = fd.el;
    if (value === undefined || value === null || value === "") return false;
    const v = String(value);
    if (fd.tag === "select") return fillSelect(el, v);
    if (fd.type === "radio") return fillRadioGroup(el, v);
    if (fd.type === "checkbox") {
      const want = !/^(否|无|false|0|n)/i.test(v);
      if (el.checked !== want) {
        el.checked = want;
        fire(el, "input");
        fire(el, "change");
      }
      return true;
    }
    if (el.tagName === "TEXTAREA" || ["", "text", "tel", "email", "number", "date", "month"].includes(fd.type)) {
      // 日期选择框（placeholder 含"日期"）：直接写值
      if (el.tagName === "INPUT" && (el.placeholder || "").includes("日期")) {
        setNativeValue(el, fmtDate(v, el));
        return true;
      }
      // 自定义下拉（Moka 等"请选择"输入框 / readonly）→ 交给控制器的浮层点击逻辑
      if (isCustomDropdown(el)) return false;
      const looksDate = fd.type === "date" || fd.type === "month" || /时间|日期|年月/.test(fd.label);
      const val = looksDate ? fmtDate(v, el) : v;
      setNativeValue(el, val);
      return true;
    }
    return false;
  }

  window.WS.Filler = { fillField, setNativeValue, fmtDate, isCustomDropdown };
})();

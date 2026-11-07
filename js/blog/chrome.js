/* What every blog page shares with the home page: the 中/EN and light/dark toggles (same saved choices), a toast. */
import { t, apply, lang } from "./i18n.js";

const save = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
const listeners = [];
export const onLang = (fn) => listeners.push(fn);

export function initChrome() {
  const d = document.documentElement;
  const lt = document.getElementById("lang-toggle");
  const paint = () => { lt.textContent = lang() === "en" ? "中" : "EN"; apply(); listeners.forEach((f) => f()); };
  lt.addEventListener("click", () => {
    const next = lang() === "en" ? "zh" : "en";
    d.setAttribute("lang", next === "en" ? "en" : "zh-TW"); save("lang", next); paint();
  });
  document.getElementById("theme-toggle").addEventListener("click", () => {
    const next = d.getAttribute("data-theme") === "dark" ? "light" : "dark";
    d.setAttribute("data-theme", next); save("theme", next);
  });
  lt.textContent = lang() === "en" ? "中" : "EN"; apply();
}

let toastT = 0;
export function toast(msg) {
  let el = document.querySelector(".toast");
  if (!el) { el = document.createElement("div"); el.className = "toast"; el.setAttribute("role", "status"); document.body.append(el); }
  el.textContent = msg; el.classList.add("show");
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove("show"), 2400);
}

// a small element builder; children are text unless they're nodes
export function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (k === "text") e.textContent = v;
    else if (k === "html") e.innerHTML = v; // only ever md.render() output, which escapes everything
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids.flat(Infinity)) if (k != null && k !== false) e.append(k);
  return e;
}

export function demoBanner() {
  const b = h("div", { class: "demo-note label" }, t("demo"));
  document.querySelector(".wrap").prepend(b);
  onLang(() => { b.textContent = t("demo"); });
}

// a yes / no question in a small sheet; resolves true or false
export function confirmBox(msg, ok = t("confirm")) {
  return new Promise((res) => {
    const close = (v) => { dlg.close(); dlg.remove(); res(v); };
    const dlg = h("dialog", { class: "sheet" }, h("p", {}, msg),
      h("div", { class: "row end" }, h("button", { class: "btn", type: "button", onclick: () => close(false) }, t("cancel")),
        h("button", { class: "btn primary", type: "button", onclick: () => close(true) }, ok)));
    dlg.addEventListener("cancel", () => close(false));
    document.body.append(dlg); dlg.showModal();
  });
}
export const tagUrl = (tag) => "/blog/" + (tag ? "?tag=" + encodeURIComponent(tag) : "");
export const postUrl = (slug) => "/blog/" + slug + "/";
export const galleryUrl = (tag) => "/gallery/" + (tag ? "?tag=" + encodeURIComponent(tag) : "");
export const photoUrl = (slug) => "/gallery/" + slug + "/";
// replaceChildren, leaving out the nulls and falses of optional parts
export const fill = (el, ...kids) => el.replaceChildren(...kids.flat(Infinity).filter((k) => k != null && k !== false));

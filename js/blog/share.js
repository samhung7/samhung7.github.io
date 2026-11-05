/* The share row under a post: copy the link, LINE, Facebook, X, Threads, and the device's own share sheet where there is one.
   Each shares the address with ?ref=<where> so the statistics can tell who came back through a share (js/blog/analytics.js
   counts it and takes it off the address again), and each button carries data-share, which analytics.js counts on click. */
import { t } from "./i18n.js";
import { h, toast } from "./chrome.js";

const I = {
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  line: '<path d="M12 4C7 4 3 7.2 3 11.1c0 3.5 3.1 6.4 7.4 7l-.5 2.4c-.1.4.3.7.6.5L14 18c4.2-.6 7-3.5 7-6.9C21 7.2 17 4 12 4z"/>',
  fb: '<path d="M15.5 3.5H13a3.5 3.5 0 0 0-3.5 3.5v13.5M6.5 10.5h8"/>',
  x: '<path d="M4.5 4h4l11 16h-4z"/><path d="M19 4l-6.1 7M11.1 13 5 20"/>',
  threads: '<path d="M16.5 11.2c-.2-2.3-1.6-3.7-3.9-3.7-1.5 0-2.7.6-3.4 1.8"/><path d="M12.6 21c-4.6 0-7.6-3.3-7.6-9s3-9 7.6-9c3.4 0 5.7 1.8 6.6 4.8"/><path d="M19.2 14.5c-.4 3.2-2.8 5-6 5-2.4 0-4-1.3-4-3.1 0-2 1.8-3.2 4.6-3.2 2 0 3.6.4 4.9 1.1"/>',
  more: '<path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>',
};
const svg = (k) => { const s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("aria-hidden", "true"); s.innerHTML = I[k]; return s; };

async function copy(url) {
  try { await navigator.clipboard.writeText(url); return true; }
  catch (e) {
    const ta = h("textarea", { readonly: true, style: "position:fixed;opacity:0" }); ta.value = url; document.body.append(ta); ta.select();
    let ok = false; try { ok = document.execCommand("copy"); } catch (e2) {} ta.remove(); return ok;
  }
}

export const tagged = (url, where) => url + (url.includes("?") ? "&" : "?") + "ref=" + where;

export function shareRow({ url, title }) {
  const u = (k) => encodeURIComponent(tagged(url, k)), txt = encodeURIComponent(title);
  const targets = [
    ["line", "LINE", `https://social-plugins.line.me/lineit/share?url=${u("line")}`],
    ["fb", "Facebook", `https://www.facebook.com/sharer/sharer.php?u=${u("fb")}`],
    ["x", "X", `https://x.com/intent/post?text=${txt}&url=${u("x")}`],
    ["threads", "Threads", `https://www.threads.net/intent/post?text=${encodeURIComponent(title + " " + tagged(url, "threads"))}`],
  ];
  const btn = (k, label, attrs) => h(attrs.href ? "a" : "button", { class: "share-btn", "aria-label": label, title: label, "data-share": k, ...(attrs.href ? {} : { type: "button" }), ...attrs }, svg(k));
  const row = h("div", { class: "share" },
    h("span", { class: "label" }, t("share")),
    h("div", { class: "share-btns" },
      btn("link", t("copyLink"), { "data-share": "copy", onclick: async () => toast(t((await copy(tagged(url, "copy"))) ? "copied" : "copyFail")) }),
      targets.map(([k, label, href]) => btn(k, label, { href, target: "_blank", rel: "noopener" })),
      navigator.share ? btn("more", t("more"), { "data-share": "native", onclick: () => navigator.share({ title, url: tagged(url, "native") }).catch(() => {}) }) : null));
  return row;
}

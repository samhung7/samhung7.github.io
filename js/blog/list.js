/* /blog/: every published post, newest first, with a row of tags to narrow it down (?tag=…). */
import { backend, off, demo } from "./backend.js";
import { excerpt, readMinutes, cover } from "./md.js";
import { t, fmtDate } from "./i18n.js";
import { fill, initChrome, onLang, h, demoBanner, tagUrl, postUrl } from "./chrome.js";

initChrome();
if (demo) demoBanner();
const list = document.getElementById("posts"), bar = document.getElementById("tags");
let posts = null, failed = false;
const current = () => new URLSearchParams(location.search).get("tag") || "";

// cards (the default) or list, remembered on this device
const VIEW_KEY = "blogView";
let view = (() => { try { return localStorage.getItem(VIEW_KEY) === "list" ? "list" : "cards"; } catch (e) { return "cards"; } })();
const switcher = document.getElementById("view");
function paintView() {
  list.classList.toggle("cards", view === "cards");
  switcher.querySelectorAll("[data-view]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === view)));
}
switcher.addEventListener("click", (e) => {
  const b = e.target.closest("[data-view]");
  if (!b || b.dataset.view === view) return;
  view = b.dataset.view;
  try { localStorage.setItem(VIEW_KEY, view); } catch (e) {}
  paintView(); draw();
});
paintView();

export function postItem(p, onTag) {
  return h("article", { class: "post-item" },
    h("time", { class: "num", datetime: p.publishAt.toISOString() }, fmtDate(p.publishAt)),
    h("div", {},
      h("h3", {}, h("a", { href: postUrl(p.slug) }, p.title)),
      h("p", { class: "desc" }, excerpt(p.body, 110)),
      h("p", { class: "tag label" },
        p.tags.map((x) => [h("a", { href: tagUrl(x), onclick: onTag && ((e) => { e.preventDefault(); onTag(x); }) }, "#" + x), " "]),
        h("span", { class: "dot" }, t("minRead", { n: readMinutes(p.body) })))),
    h("a", { class: "arrow", href: postUrl(p.slug), "aria-hidden": "true", tabindex: "-1" }, "→"));
}

// a card: the post's first picture (or a quiet monogram panel), then date, title, excerpt and tags
export function postCard(p, onTag) {
  const img = cover(p.body);
  return h("article", { class: "post-card" },
    h("a", { class: "card-cover" + (img ? "" : " none"), href: postUrl(p.slug), "aria-hidden": "true", tabindex: "-1" },
      img ? h("img", { src: img, alt: "", loading: "lazy", decoding: "async" }) : h("span", { class: "card-mono" }, "SS")),
    h("div", { class: "card-body" },
      h("p", { class: "label" }, h("time", { datetime: p.publishAt.toISOString() }, fmtDate(p.publishAt)),
        h("span", { class: "dot" }, t("minRead", { n: readMinutes(p.body) }))),
      h("h3", {}, h("a", { href: postUrl(p.slug) }, p.title)),
      h("p", { class: "desc" }, excerpt(p.body, 70)),
      p.tags.length ? h("p", { class: "card-tags" },
        p.tags.map((x) => h("a", { class: "chip", href: tagUrl(x), onclick: onTag && ((e) => { e.preventDefault(); onTag(x); }) }, "#" + x))) : null));
}

function go(tag) {
  history.pushState(null, "", tagUrl(tag));
  draw(); window.scrollTo({ top: bar.getBoundingClientRect().top + scrollY - 24, behavior: "smooth" });
}

function draw() {
  if (off) return fill(list, h("p", { class: "empty" }, t("notSetUp")));
  if (failed) return fill(list, h("p", { class: "empty" }, t("loadFail")));
  if (!posts) return;
  const tag = current(), count = new Map();
  posts.forEach((p) => p.tags.forEach((x) => count.set(x, (count.get(x) || 0) + 1)));
  const tags = [...count].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const chip = (x, label, n) => h("a", { class: "chip" + (x === tag ? " on" : ""), href: tagUrl(x), "aria-current": x === tag ? "page" : null,
    onclick: (e) => { e.preventDefault(); go(x); } }, label, n != null ? h("sup", {}, String(n)) : null);
  fill(bar, ...(tags.length ? [chip("", t("all")), ...tags.map(([x, n]) => chip(x, "#" + x, n))] : [h("span", { class: "label" }, t("posts"))]));
  const shown = tag ? posts.filter((p) => p.tags.includes(tag)) : posts;
  document.title = (tag ? "#" + tag + " · " : "") + t("blogTitle");
  fill(list, ...(shown.length ? shown.map((p) => (view === "cards" ? postCard : postItem)(p, go)) : [h("p", { class: "empty" }, t(tag ? "noTagPosts" : "noPosts"))]));
}

onLang(draw);
addEventListener("popstate", draw);
if (off) draw();
else backend().then((b) => b.listPublished()).then((p) => { posts = p; draw(); }, (e) => { console.warn(e); failed = true; draw(); });

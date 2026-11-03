/* /blog/: every published post, newest first, with a row of tags to narrow it down (?tag=…). */
import { backend, off, demo } from "./backend.js";
import { excerpt, readMinutes } from "./md.js";
import { t, fmtDate } from "./i18n.js";
import { fill, initChrome, onLang, h, demoBanner, tagUrl, postUrl } from "./chrome.js";

initChrome();
if (demo) demoBanner();
const list = document.getElementById("posts"), bar = document.getElementById("tags");
let posts = null, failed = false;
const current = () => new URLSearchParams(location.search).get("tag") || "";

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
  fill(list, ...(shown.length ? shown.map((p) => postItem(p, go)) : [h("p", { class: "empty" }, t(tag ? "noTagPosts" : "noPosts"))]));
}

onLang(draw);
addEventListener("popstate", draw);
if (off) draw();
else backend().then((b) => b.listPublished()).then((p) => { posts = p; draw(); }, (e) => { console.warn(e); failed = true; draw(); });

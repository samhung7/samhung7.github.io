/* One post, at /blog/<slug>/ (served by 404.html, or by the page tools/build-blog.mjs made for it). Anything else that
   lands on 404.html is told the page isn't there. The owner, signed in, can also open a draft or a scheduled post here. */
import { backend, off, demo, isLive, editedAt } from "./backend.js";
import { render, excerpt, readMinutes } from "./md.js";
import { t, fmtDate, lang } from "./i18n.js";
import { fill, initChrome, pinNav, onLang, h, demoBanner, tagUrl } from "./chrome.js";
import { shareRow } from "./share.js";
import { CONFIG } from "./config.js";

initChrome();
pinNav();
if (demo) demoBanner();
const box = document.getElementById("post");
const slug = (location.pathname.match(/^\/blog\/([a-z0-9][a-z0-9-]{0,79})\/?$/) || [])[1];
let post, state = slug ? "loading" : "404";
const pre = box.querySelector(".post-body") ? box.innerHTML : null; // what the build put here, kept if the database can't be reached

function setMeta(p) {
  document.title = p.title + " · Samhung Studio";
  document.querySelector('meta[name="description"]').setAttribute("content", excerpt(p.body, 150));
}

// tell the statistics (js/blog/analytics.js) once that this address has nothing to show
let told = false;
const notFound = () => { if (!told) { told = true; (window.ssq = window.ssq || []).push(["notfound"]); } };

function draw() {
  if (state === "404") {
    notFound();
    document.title = "404 · Samhung Studio";
    return fill(box, h("div", { class: "nothing" }, h("p", { class: "num big" }, "404"),
      h("p", {}, lang() === "en" ? "There's nothing at this address." : "這個網址沒有東西。"),
      h("p", {}, h("a", { class: "label back", href: "/" }, lang() === "en" ? "← Home" : "← 回首頁"))));
  }
  if (state === "loading") return pre ? null : fill(box, h("p", { class: "empty label" }, t("loading")));
  if (state === "missing" || state === "off") {
    if (pre) return;
    if (state === "missing") notFound();
    return fill(box, h("div", { class: "nothing" }, h("p", {}, t(state === "off" ? "notSetUp" : "notFound")), h("p", {}, h("a", { class: "label back", href: "/blog/" }, t("back")))));
  }
  const p = post, url = CONFIG.site + "/blog/" + p.slug + "/";
  setMeta(p);
  const live = isLive(p);
  fill(box, 
    h("a", { class: "label back", href: "/blog/" }, t("back")),
    !live ? h("p", { class: "owner-note label" }, p.status === "draft" ? t("drafts") : t("publishesAt", { d: fmtDate(p.publishAt, true) })) : null,
    h("header", { class: "post-head" },
      h("h1", {}, p.title),
      h("p", { class: "post-meta label" },
        h("time", { datetime: (p.publishAt || p.updatedAt).toISOString() }, fmtDate(p.publishAt || p.updatedAt)),
        h("span", { class: "dot" }, t("minRead", { n: readMinutes(p.body) })),
        p.tags.map((x) => h("a", { class: "dot", href: tagUrl(x) }, "#" + x))),
      live && editedAt(p) ? h("p", { class: "post-updated label" },
        h("time", { datetime: editedAt(p).toISOString() }, t("lastUpdated", { d: fmtDate(editedAt(p), true) }))) : null),
    h("div", { class: "post-body", html: render(p.body) }),
    shareRow({ url, title: p.title }));
}

onLang(draw);
draw();
if (slug) {
  if (off) { state = "off"; draw(); }
  else backend().then((b) => b.get(slug)).then((p) => {
    // a draft or a post before its time only shows to the owner, whom the database lets read it
    post = p; state = p ? "ok" : "missing"; draw();
  }, (e) => { console.warn(e); state = "missing"; draw(); });
}

/* The home page's Journal: the three newest posts, shown only once there are any. */
import { backend, off } from "./backend.js";
import { excerpt } from "./md.js";
import { fmtDate } from "./i18n.js";
import { h, fill, postUrl } from "./chrome.js";

const sec = document.getElementById("journal"), box = document.getElementById("latest");
let posts = [];
const draw = () => fill(box, posts.map((p) => h("a", { class: "project post-mini", href: postUrl(p.slug) },
  h("time", { class: "num", datetime: p.publishAt.toISOString() }, fmtDate(p.publishAt)),
  h("div", {}, h("h3", {}, p.title), h("p", { class: "desc" }, excerpt(p.body, 90))),
  h("span", { class: "arrow" }, "→"))));
document.addEventListener("langchange", draw);
if (!off) backend().then((b) => b.listPublished()).then((p) => {
  posts = p.slice(0, 3);
  if (posts.length) { draw(); sec.hidden = false; }
}, (e) => console.warn(e));

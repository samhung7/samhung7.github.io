/* The home page's Journal: the three newest posts, shown only once there are any. */
import { backend, off } from "./backend.js";
import { excerpt, cover } from "./md.js";
import { fmtDate } from "./i18n.js";
import { h, fill, postUrl } from "./chrome.js";

const sec = document.getElementById("journal"), box = document.getElementById("latest");
let posts = [];
// each post carries its first picture (or a quiet SS panel), seen only when the home page shows cards
const pic = (p) => { const u = cover(p.body);
  return h("span", { class: "cover" + (u ? "" : " none") }, u ? h("img", { src: u, alt: "", loading: "lazy", decoding: "async" }) : h("span", { class: "card-mono" }, "SS")); };
const draw = () => fill(box, posts.map((p) => h("a", { class: "project post-mini", href: postUrl(p.slug) }, pic(p),
  h("time", { class: "num", datetime: p.publishAt.toISOString() }, fmtDate(p.publishAt)),
  h("div", {}, h("h3", {}, p.title), h("p", { class: "desc" }, excerpt(p.body, 90))),
  h("span", { class: "arrow" }, "→"))));
document.addEventListener("langchange", draw);
if (!off) backend().then((b) => b.listPublished()).then((p) => {
  posts = p.slice(0, 3);
  if (posts.length) { draw(); sec.hidden = false; }
}, (e) => console.warn(e));

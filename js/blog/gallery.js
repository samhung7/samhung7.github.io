/* /gallery/: every published photo as a thumbnail, in the gallery's order, with a row of tags to narrow it down (?tag=…).
   The rows are justified by CSS alone (css/blog.css .photo-grid): each thumbnail grows in proportion to its width / height,
   so every photo in a row ends up the same height and nothing is cropped. */
import { photos } from "./photos.js";
import { demo } from "./backend.js";
import { t } from "./i18n.js";
import { fill, initChrome, onLang, h, demoBanner, galleryUrl, photoUrl } from "./chrome.js";

initChrome();
if (demo) demoBanner();
const grid = document.getElementById("photos"), bar = document.getElementById("tags");
let all = null, failed = false;
const current = () => new URLSearchParams(location.search).get("tag") || "";

const thumb = (p) => h("a", { class: "photo-thumb", href: photoUrl(p.slug), style: `--r:${(p.width / p.height).toFixed(4)}` },
  h("img", { src: p.thumb, alt: p.title, loading: "lazy", decoding: "async" }));

function go(tag) {
  history.pushState(null, "", galleryUrl(tag));
  draw(); window.scrollTo({ top: bar.getBoundingClientRect().top + scrollY - 24, behavior: "smooth" });
}

function draw() {
  if (failed) return fill(grid, h("p", { class: "empty" }, t("loadFail")));
  if (!all) return;
  const tag = current(), count = new Map();
  all.forEach((p) => p.tags.forEach((x) => count.set(x, (count.get(x) || 0) + 1)));
  const tags = [...count].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const chip = (x, label, n) => h("a", { class: "chip" + (x === tag ? " on" : ""), href: galleryUrl(x), "aria-current": x === tag ? "page" : null,
    onclick: (e) => { e.preventDefault(); go(x); } }, label, n != null ? h("sup", {}, String(n)) : null);
  fill(bar, ...(tags.length ? [chip("", t("all")), ...tags.map(([x, n]) => chip(x, "#" + x, n))] : []));
  const shown = tag ? all.filter((p) => p.tags.includes(tag)) : all;
  document.title = (tag ? "#" + tag + " · " : "") + t("galleryTitle");
  fill(grid, ...(shown.length ? shown.map(thumb) : [h("p", { class: "empty" }, t(tag ? "noTagPhotos" : "noPhotos"))]));
}

onLang(draw);
addEventListener("popstate", draw);
photos().then((b) => b.listPublished()).then((p) => { all = p; draw(); }, (e) => { console.warn(e); failed = true; draw(); });

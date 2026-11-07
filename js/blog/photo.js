/* One photo, at /gallery/<slug>/ (served by 404.html, or by the page tools/build-blog.mjs made for it): the photo, its
   title, description, date, camera and settings, tags, the photos before and after it in the gallery (also ← / →), and
   a click on the photo shows it full screen. The owner, signed in, can also open a draft or a scheduled photo here. */
import { photos, isLive } from "./photos.js";
import { demo } from "./backend.js";
import { t, fmtDate } from "./i18n.js";
import { fill, initChrome, onLang, h, demoBanner, galleryUrl, photoUrl, steps } from "./chrome.js";
import { shareRow } from "./share.js";
import { CONFIG } from "./config.js";

initChrome();
if (demo) demoBanner();
const box = document.getElementById("post");
box.className = "photo-page";
const slug = (location.pathname.match(/^\/gallery\/([a-z0-9][a-z0-9-]{0,79})\/?$/) || [])[1];
const pre = box.querySelector(".photo-hero") ? box.innerHTML : null; // what the build put here, kept if the database can't be reached
let photo = null, prev = null, next = null, state = slug ? "loading" : "missing";

const settings = (x) => [x.focal, x.aperture, x.shutter, x.iso].filter(Boolean).join(" · ");
const row = (label, value) => (value ? [h("dt", { class: "label" }, label), h("dd", {}, value)] : null);

const lightbox = h("dialog", { class: "lightbox", onclick: () => lightbox.close() });
document.body.append(lightbox);
function enlarge() { fill(lightbox, h("img", { src: photo.image, alt: photo.title })); lightbox.showModal(); }

function draw() {
  if (state === "loading") return pre ? null : fill(box, h("p", { class: "empty label" }, t("loading")));
  if (state === "missing") {
    if (pre) return;
    (window.ssq = window.ssq || []).push(["notfound"]);
    return fill(box, h("div", { class: "nothing" }, h("p", {}, t("photoNotFound")), h("p", {}, h("a", { class: "label back", href: "/gallery/" }, t("backGallery")))));
  }
  const p = photo, x = p.exif;
  document.title = (p.title || t("untitled")) + " · Samhung Studio";
  fill(box,
    h("a", { class: "label back", href: "/gallery/" }, t("backGallery")),
    !isLive(p) ? h("p", { class: "owner-note label" }, p.status === "draft" ? t("drafts") : t("publishesAt", { d: fmtDate(p.publishAt, true) })) : null,
    h("figure", { class: "photo-hero" },
      h("button", { class: "photo-zoom", type: "button", "aria-label": t("enlarge"), onclick: enlarge },
        h("img", { src: p.image, alt: p.title, width: p.width, height: p.height }))),
    h("div", { class: "photo-info" },
      h("div", { class: "photo-text" }, h("h1", {}, p.title), p.description ? h("p", { class: "photo-desc" }, p.description) : null),
      h("dl", { class: "photo-meta" },
        row(t("taken"), p.takenAt ? h("time", { datetime: p.takenAt.toISOString() }, fmtDate(p.takenAt)) : null),
        row(t("camera"), x.camera), row(t("lens"), x.lens), row(t("settings"), settings(x)),
        p.tags.length ? row(t("tags"), p.tags.map((tag) => h("a", { class: "chip", href: galleryUrl(tag) }, "#" + tag))) : null)),
    steps(prev, next, t("prevPhoto"), t("nextPhoto"), photoUrl),
    shareRow({ url: CONFIG.site + photoUrl(p.slug), title: p.title }));
}

// ← and → step through the gallery, unless something else has the keys
addEventListener("keydown", (e) => {
  if (lightbox.open || e.metaKey || e.ctrlKey || e.altKey || /INPUT|TEXTAREA/.test(document.activeElement?.tagName)) return;
  const to = e.key === "ArrowLeft" ? prev : e.key === "ArrowRight" ? next : null;
  if (to) location.href = photoUrl(to.slug);
});

onLang(draw);
draw();
if (slug) photos().then(async (b) => {
  photo = await b.get(slug);
  if (!photo) { state = "missing"; return draw(); }
  if (isLive(photo)) { // before and after it in the gallery's order
    const all = await b.listPublished(), i = all.findIndex((q) => q.slug === slug);
    prev = all[i - 1] || null; next = all[i + 1] || null;
  }
  state = "ok"; draw();
}).catch((e) => { console.warn(e); state = "missing"; draw(); });

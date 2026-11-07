/* /gallery/editor/: where Sam adds photos. Same sign-in as the blog's editor (only the owner gets in, and only the owner
   can write: firestore.rules). Several photos go up at once: each is read for its EXIF, shrunk on this device to a ~2400px
   picture and a ~800px thumbnail (the original never leaves it, and neither does its GPS position), and becomes a draft
   to fill in. The list is in the gallery's order, and a thumbnail can be dragged to another place.
   Routes: #/ the list, #/edit/<slug> one photo. */
import { backend, off, demo } from "./backend.js";
import { photos, isLive, EXIF } from "./photos.js";
import { readExif } from "./exif.js";
import { loadImage, encode, hashName } from "./images.js";
import { t, fmtDate } from "./i18n.js";
import { fill, initChrome, onLang, h, toast, demoBanner, photoUrl, confirmBox } from "./chrome.js";

initChrome();
if (demo) demoBanner();
const app = document.getElementById("app");
let B, P, me, all = [], view = () => {}, dirty = false;

const statusOf = (p) => (p.status === "draft" ? "drafts" : isLive(p) ? "published" : "scheduled");
const slugOk = (s) => /^[a-z0-9][a-z0-9-]{0,79}$/.test(s) && s !== "editor";
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
const newSlug = (d) => `${ymd(d || new Date())}-${Math.random().toString(36).slice(2, 6)}`;
const toLocalInput = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16); // datetime-local
const toDateInput = (d) => (d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : "");

/* ---------- signing in ---------- */
async function start() {
  if (off) return fill(app, h("div", { class: "nothing" }, h("p", {}, t("notSetUp"))));
  try { B = await backend(); P = await photos(); me = await B.whoami(); } catch (e) { console.warn(e); return fill(app, h("p", { class: "empty" }, t("loadFail"))); }
  route();
}
function gate() {
  if (!me) {
    fill(app, h("div", { class: "nothing" }, h("h1", { class: "ed-h" }, t("gallery")),
      h("button", { class: "btn primary", type: "button", onclick: async () => { try { me = await B.signIn(); route(); } catch (e) { toast(t("saveFail", { e: e.code || e.message })); } } }, t("signIn"))));
    return false;
  }
  try { if (me.owner) localStorage.setItem("ss-no-track", "1"); } catch (e) {} // as in the blog's editor
  if (!me.owner) {
    fill(app, h("div", { class: "nothing" }, h("p", {}, t("notOwner")),
      h("p", {}, h("button", { class: "btn", type: "button", onclick: async () => { await B.signOut(); me = null; route(); } }, t("signOut")))));
    return false;
  }
  return true;
}

/* ---------- routes ---------- */
async function route() {
  if (!gate()) return;
  const m = location.hash.match(/^#\/edit\/([a-z0-9-]+)$/);
  if (!m) return list();
  if (!all.length) all = await P.listAll().catch(() => []); // for the tag suggestions
  const p = await P.get(m[1]).catch(() => null);
  if (!p) { toast(t("photoNotFound")); location.hash = "#/"; return; }
  editor(p);
}
addEventListener("hashchange", () => { if (B) route(); });
addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });
onLang(() => view());

/* ---------- uploading ---------- */
const picker = h("input", { type: "file", accept: "image/jpeg,image/*", multiple: true, hidden: true });
document.body.append(picker);
picker.addEventListener("change", () => { const f = [...picker.files]; picker.value = ""; upload(f); });
let progress = "";

async function upload(files) {
  files = files.filter((f) => f.type.startsWith("image/"));
  const now = Date.now();
  for (const [i, f] of files.entries()) {
    progress = t("uploadingN", { i: i + 1, n: files.length }); view();
    try {
      const { takenAt = null, ...exif } = await readExif(f), img = await loadImage(f);
      const image = await encode(img, demo ? 1200 : 2400, demo ? 200e3 : 2.5e6), small = await encode(img, demo ? 400 : 800, demo ? 60e3 : 300e3);
      const put = async (x) => B.putImage(x.bytes, await hashName(x.bytes));
      await P.create(newSlug(takenAt), {
        title: "", description: "", tags: [], takenAt, exif: Object.fromEntries(EXIF.map((k) => [k, exif[k] || ""])),
        image: await put(image), thumb: await put(small), width: image.width, height: image.height,
        status: "draft", publishAt: null, order: now + (files.length - i), // the first one picked comes first
      });
    } catch (e) { console.warn(e); toast(t("uploadFail") + "：" + f.name); }
  }
  progress = "";
  all = await P.listAll().catch(() => all);
  view();
}

/* ---------- the list, in the gallery's order; drag a thumbnail to move it ---------- */
async function list() {
  dirty = false;
  let tab = sessionStorage.getItem("gallery-tab") || "all", dragging = null;
  try { all = await P.listAll(); } catch (e) { console.warn(e); return fill(app, h("p", { class: "empty" }, t("loadFail"))); }

  // the moved photo takes an order between its new neighbours'
  async function move(slug, before) {
    const rest = all.filter((p) => p.slug !== slug), i = before ? rest.findIndex((p) => p.slug === before) : rest.length;
    const above = rest[i - 1], below = rest[i], p = all.find((x) => x.slug === slug);
    const order = !above ? below.order + 1000 : !below ? above.order - 1000 : (above.order + below.order) / 2;
    p.order = order; rest.splice(i, 0, p); all = rest; view();
    try { await P.update(slug, { order }); toast(t("orderSaved")); }
    catch (e) { toast(t("saveFail", { e: e.code || e.message })); all = await P.listAll().catch(() => all); view(); }
  }

  function tile(p) {
    const s = statusOf(p), drag = tab === "all";
    const el = h("a", { class: "ed-photo", href: "#/edit/" + p.slug, draggable: drag ? "true" : "false" },
      h("span", { class: "ed-photo-pic" }, h("img", { src: p.thumb, alt: "", loading: "lazy", draggable: "false" })),
      h("span", { class: "status " + s }, t(s)),
      h("span", { class: "ed-photo-title" }, p.title || t("untitled")));
    if (!drag) return el;
    // dropped on the left half: goes before this one; on the right half: after it
    const side = (e) => (e.offsetX < el.offsetWidth / 2 ? "before" : "after");
    el.addEventListener("dragstart", (e) => { dragging = p.slug; e.dataTransfer.effectAllowed = "move"; el.classList.add("dragging"); });
    el.addEventListener("dragend", () => { dragging = null; el.classList.remove("dragging"); });
    el.addEventListener("dragover", (e) => { if (!dragging || dragging === p.slug) return; e.preventDefault(); el.dataset.drop = side(e); });
    el.addEventListener("dragleave", () => { delete el.dataset.drop; });
    el.addEventListener("drop", (e) => {
      e.preventDefault(); delete el.dataset.drop;
      if (!dragging || dragging === p.slug) return;
      const i = all.findIndex((x) => x.slug === p.slug), before = side(e) === "before" ? p.slug : all[i + 1]?.slug;
      if (before !== dragging) move(dragging, before === undefined ? null : before);
    });
    return el;
  }

  view = () => {
    const n = (k) => all.filter((p) => k === "all" || statusOf(p) === k).length;
    const shown = all.filter((p) => tab === "all" || statusOf(p) === tab);
    const tabBtn = (k) => h("button", { type: "button", class: "chip" + (tab === k ? " on" : ""), onclick: () => { tab = k; sessionStorage.setItem("gallery-tab", k); view(); } },
      t(k === "drafts" ? "drafts" : k), h("sup", {}, String(n(k))));
    fill(app,
      h("div", { class: "ed-top" }, h("h1", { class: "ed-h" }, t("gallery")),
        h("div", { class: "row" }, h("span", { class: "label" }, me.name || ""),
          h("a", { class: "btn small", href: "/blog/editor/" + (demo ? "?demo" : "") }, "Blog"),
          progress ? h("span", { class: "label ed-progress" }, progress)
            : h("button", { class: "btn primary", type: "button", onclick: () => picker.click() }, "＋ " + t("uploadPhotos")))),
      h("div", { class: "section-head tag-bar" }, ["all", "drafts", "scheduled", "published"].map(tabBtn)),
      tab === "all" && shown.length > 1 ? h("p", { class: "hint ed-hint" }, t("dragHint")) : null,
      shown.length ? h("div", { class: "ed-photos" }, shown.map(tile)) : h("p", { class: "empty" }, t("noPhotos")));
  };
  view();
}

/* ---------- one photo ---------- */
function editor(p) {
  dirty = false;
  const s = { tags: [...p.tags] };
  let when = p.status === "published" && !isLive(p) ? "later" : "now", sending = false;
  let at = p.publishAt && !isLive(p) ? p.publishAt : new Date(Date.now() + 864e5);
  const locked = p.status === "published"; // the address of something out there stays put
  const changed = () => { dirty = true; };
  const input = (attrs, value) => { const e = h("input", { class: "field", ...attrs }); e.value = value ?? ""; e.addEventListener("input", changed); return e; };

  const title = input({ class: "ed-title-in", maxlength: 120, placeholder: t("titlePh"), "aria-label": t("titlePh") }, p.title);
  const desc = h("textarea", { class: "field ed-desc", maxlength: 5000, placeholder: t("descPh"), "aria-label": t("descPh"), oninput: changed });
  desc.value = p.description;
  const taken = input({ type: "date", "aria-label": t("taken") }, toDateInput(p.takenAt));
  const exif = Object.fromEntries(EXIF.map((k) => [k, input({ maxlength: 120, "aria-label": t(k) }, p.exif[k])]));
  const slugIn = input({ class: "field mono", maxlength: 80, disabled: locked, spellcheck: "false", "aria-label": t("slug") }, p.slug);
  slugIn.addEventListener("input", () => { slugIn.value = slugIn.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"); });
  const atIn = input({ type: "datetime-local", "aria-label": t("scheduleAt") }, toLocalInput(at));
  atIn.addEventListener("change", () => { at = new Date(atIn.value); });

  // tags, as in the blog's editor
  const tagIn = h("input", { class: "field tag-in", placeholder: t("tagsPh"), list: "tag-list", "aria-label": t("tags") });
  const tagBox = h("div", { class: "tag-box" });
  const known = [...new Set(all.flatMap((x) => x.tags))];
  const drawTags = () => fill(tagBox, ...s.tags.map((x) => h("span", { class: "chip on" }, "#" + x,
    h("button", { type: "button", class: "x", "aria-label": "×", onclick: () => { s.tags = s.tags.filter((y) => y !== x); drawTags(); changed(); } }, "×"))), tagIn);
  function addTag(v) {
    v = v.replace(/^#/, "").trim().replace(/\s+/g, " ").slice(0, 30);
    if (v && !s.tags.includes(v) && s.tags.length < 10) { s.tags.push(v); drawTags(); changed(); }
    tagIn.value = ""; tagIn.focus();
  }
  tagIn.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === "," || e.key === "，") && !e.isComposing) { e.preventDefault(); addTag(tagIn.value); }
    else if (e.key === "Backspace" && !tagIn.value && s.tags.length) { s.tags.pop(); drawTags(); changed(); }
  });
  tagIn.addEventListener("change", () => { if (known.includes(tagIn.value)) addTag(tagIn.value); });
  tagIn.addEventListener("blur", () => { if (tagIn.value.trim()) addTag(tagIn.value); });

  const radio = (v, label) => h("label", { class: "radio" }, h("input", { type: "radio", name: "when", value: v, checked: when === v, onchange: () => { when = v; drawActions(); } }), label);
  const whenBox = h("div", { class: "when" }), actions = h("div", { class: "ed-actions" });
  function drawActions() {
    const live = isLive(p);
    fill(whenBox, ...(live ? [h("p", { class: "label" }, t("publishedAt", { d: fmtDate(p.publishAt, true) }))]
      : [radio("now", t("publishNow")), radio("later", t("schedule")), when === "later" ? atIn : null]));
    fill(actions,
      h("button", { class: "btn", type: "button", onclick: () => save("draft") }, t(p.status === "published" ? "unpublish" : "saveDraft")),
      h("button", { class: "btn primary", type: "button", onclick: () => save("publish") }, live ? t("update") : when === "later" ? t("schedule") : t("publishNow")));
  }
  const group = (label, ...kids) => h("div", { class: "field-group" }, h("label", { class: "label" }, label), ...kids);

  view = () => {}; // what's typed stays as it is when the language switches
  fill(app,
    h("div", { class: "ed-top" },
      h("a", { class: "label back", href: "#/", onclick: async (e) => {
        e.preventDefault();
        if (dirty && !(await confirmBox(t("unsaved")))) return;
        dirty = false; location.hash = "#/";
      } }, "← " + t("photos")),
      h("div", { class: "row" }, h("span", { class: "status " + statusOf(p) }, t(statusOf(p))),
        p.status === "published" ? h("a", { class: "btn small", href: photoUrl(p.slug), target: "_blank" }, t("view")) : null)),
    h("div", { class: "ed-grid" },
      h("div", { class: "ed-main" },
        h("div", { class: "ed-photo-big" }, h("img", { src: p.image, alt: "", width: p.width, height: p.height })),
        title, desc),
      h("aside", { class: "ed-side" },
        group(t("taken"), taken),
        h("div", { class: "field-group ed-exif" }, EXIF.map((k) => h("label", { class: "ed-exif-row" }, h("span", { class: "label" }, t(k)), exif[k])),
          h("p", { class: "hint" }, t("exifNote"))),
        group(t("tags"), tagBox, h("datalist", { id: "tag-list" }, known.map((x) => h("option", { value: x })))),
        group(t("slug"), h("div", { class: "slug-row" }, h("span", { class: "label" }, "/gallery/"), slugIn), h("p", { class: "hint" }, t("slugHint"))),
        h("div", { class: "field-group" }, whenBox),
        actions,
        h("button", { class: "linkish label danger", type: "button", onclick: del }, t("del")))));
  drawTags(); drawActions();

  async function del() {
    if (!(await confirmBox(t("photoDelAsk", { t: p.title || t("untitled") }), t("del")))) return;
    try { await P.remove(p.slug); dirty = false; toast(t("deleted")); location.hash = "#/"; }
    catch (e) { toast(t("saveFail", { e: e.code || e.message })); }
  }

  async function save(kind) {
    if (sending) return;
    const T = title.value.trim(), slug = slugIn.value.replace(/^-+|-+$/g, "");
    if (kind === "publish" && !T) { title.focus(); return toast(t("needPhotoTitle")); }
    if (!slugOk(slug)) { slugIn.focus(); return toast(t("badSlug")); }
    let status = "draft", publishAt = p.publishAt, order = p.order;
    if (kind === "publish") {
      status = "published";
      if (when === "later" && !isLive(p)) {
        if (!(at instanceof Date) || isNaN(at) || at.getTime() <= Date.now() + 30e3) { atIn.focus(); return toast(t("pastTime")); }
        publishAt = at; order = at.getTime(); // comes in at the top of the gallery when its time comes
      } else if (!(p.publishAt && p.publishAt.getTime() <= Date.now())) publishAt = new Date(); // keeps its first-published time if it has one
    } else if (when === "later" && at instanceof Date && !isNaN(at)) publishAt = at; // a draft remembers the time it was meant for
    const data = { title: T, description: desc.value.trim(), tags: s.tags, takenAt: taken.value ? new Date(taken.value + "T12:00") : null,
      exif: Object.fromEntries(EXIF.map((k) => [k, exif[k].value.trim()])),
      image: p.image, thumb: p.thumb, width: p.width, height: p.height, status, publishAt, order };
    sending = true; document.body.classList.add("busy");
    try {
      if (slug !== p.slug) { await P.create(slug, data); await P.remove(p.slug); } // a draft's new address
      else await P.update(slug, data);
      dirty = false;
      if (status === "published" || p.status === "published") B.rebuild(); // its link preview, up to date
      toast(status === "draft" ? t("saved") : isLive(p) ? t("updatedOk") : publishAt > Date.now() ? t("scheduledOk", { d: fmtDate(publishAt, true) }) : t("publishedOk"));
      all = await P.listAll().catch(() => all);
      if (location.hash !== "#/edit/" + slug) history.replaceState(null, "", "#/edit/" + slug);
      editor(await P.get(slug));
    } catch (e) {
      console.warn(e);
      toast(e?.code === "taken" ? t("slugTaken") : t("saveFail", { e: e.code || e.message }));
    } finally { sending = false; document.body.classList.remove("busy"); }
  }
}

start();

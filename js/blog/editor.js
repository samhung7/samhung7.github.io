/* /blog/editor/: where Sam writes. Only the owner gets past sign-in (and only the owner can write: firestore.rules).
   Like StoaTalk's long posts: a page of its own, a Markdown toolbar, Write / Preview, and what's typed kept on this
   device 800 ms after each change until it's saved. On top: drafts, publishing now or at a set time, tags, the address.
   Routes: #/ the list, #/new a new post, #/edit/<slug> an existing one. */
import { backend, off, demo, isLive } from "./backend.js";
import { render, readMinutes } from "./md.js";
import { t, fmtDate } from "./i18n.js";
import { fill, initChrome, onLang, h, toast, demoBanner, postUrl } from "./chrome.js";
import { CONFIG } from "./config.js";
import { uploadImage } from "./images.js";

initChrome();
if (demo) demoBanner();
const app = document.getElementById("app");
let B, me, all = [], view = () => {}, dirty = false;
const LOCAL = (slug) => "blog-local-" + (slug || "new");
const store = {
  get: (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
  set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
};

const statusOf = (p) => (p.status === "draft" ? "drafts" : isLive(p) ? "published" : "scheduled");
const slugOk = (s) => /^[a-z0-9][a-z0-9-]{0,79}$/.test(s);
function slugify(title) {
  const s = title.toLowerCase().normalize("NFKD").replace(/[^\x00-\x7f]/g, " ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/, "");
  if (s.length >= 3 && /[a-z]/.test(s)) return s;
  const d = new Date(), pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${Math.random().toString(36).slice(2, 6)}`;
}
// <input type="datetime-local"> speaks local time without a zone
const toLocalInput = (d) => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 6e4); return z.toISOString().slice(0, 16); };

function confirmBox(msg, ok = t("confirm")) {
  return new Promise((res) => {
    const close = (v) => { dlg.close(); dlg.remove(); res(v); };
    const dlg = h("dialog", { class: "sheet" }, h("p", {}, msg),
      h("div", { class: "row end" }, h("button", { class: "btn", type: "button", onclick: () => close(false) }, t("cancel")),
        h("button", { class: "btn primary", type: "button", onclick: () => close(true) }, ok)));
    dlg.addEventListener("cancel", () => close(false));
    document.body.append(dlg); dlg.showModal();
  });
}
function promptBox(label, value = "") {
  return new Promise((res) => {
    const inp = h("input", { class: "field", type: "url", placeholder: "https://", value });
    const close = (v) => { dlg.close(); dlg.remove(); res(v); };
    const dlg = h("dialog", { class: "sheet" }, h("form", { method: "dialog", onsubmit: (e) => { e.preventDefault(); close(inp.value.trim()); } },
      h("label", { class: "label" }, label), inp,
      h("div", { class: "row end" }, h("button", { class: "btn", type: "button", onclick: () => close(null) }, t("cancel")), h("button", { class: "btn primary" }, t("confirm")))));
    dlg.addEventListener("cancel", () => close(null));
    document.body.append(dlg); dlg.showModal(); inp.focus();
  });
}

/* ---------- signing in ---------- */
async function start() {
  if (off) return fill(app, h("div", { class: "nothing" }, h("p", {}, t("notSetUp")), h("p", { class: "label" }, "js/blog/config.js → firebase")));
  try { B = await backend(); me = await B.whoami(); } catch (e) { console.warn(e); return fill(app, h("p", { class: "empty" }, t("loadFail"))); }
  route();
}
function gate() {
  if (!me) {
    fill(app, h("div", { class: "nothing" }, h("h1", { class: "ed-h" }, t("editor")),
      h("button", { class: "btn primary", type: "button", onclick: async () => { try { me = await B.signIn(); route(); } catch (e) { toast(t("saveFail", { e: e.code || e.message })); } } }, t("signIn"))));
    return false;
  }
  if (!me.owner) {
    fill(app, h("div", { class: "nothing" }, h("p", {}, t("notOwner")), h("p", { class: "label" }, t("yourUid")), h("code", { class: "uid" }, me.uid),
      h("p", {}, h("button", { class: "btn", type: "button", onclick: async () => { await B.signOut(); me = null; route(); } }, t("signOut")))));
    return false;
  }
  return true;
}

/* ---------- routes ---------- */
async function route() {
  if (!gate()) return;
  const m = location.hash.match(/^#\/(new|edit\/([a-z0-9-]+))$/);
  if (!m) return dashboard();
  if (!all.length) all = await B.listAll().catch(() => []); // for the tag suggestions
  if (m[1] === "new") return editor(null);
  const p = await B.get(m[2]).catch(() => null);
  if (!p) { toast(t("notFound")); location.hash = "#/"; return; }
  editor(p);
}
addEventListener("hashchange", () => { if (B) route(); });
addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });
onLang(() => view());

/* ---------- the list ---------- */
async function dashboard() {
  dirty = false;
  let tab = sessionStorage.getItem("blog-tab") || "all";
  try { all = await B.listAll(); } catch (e) { console.warn(e); return fill(app, h("p", { class: "empty" }, t("loadFail"))); }
  view = () => {
    const n = (k) => all.filter((p) => k === "all" || statusOf(p) === k).length;
    const shown = all.filter((p) => tab === "all" || statusOf(p) === tab);
    const tabBtn = (k, label) => h("button", { type: "button", class: "chip" + (tab === k ? " on" : ""), onclick: () => { tab = k; sessionStorage.setItem("blog-tab", k); view(); } }, label, h("sup", {}, String(n(k))));
    fill(app, 
      h("div", { class: "ed-top" }, h("h1", { class: "ed-h" }, t("editor")),
        h("div", { class: "row" }, h("span", { class: "label" }, me.name || ""), demo ? null : h("button", { class: "btn small", type: "button", onclick: async () => { await B.signOut(); me = null; route(); } }, t("signOut")),
          h("a", { class: "btn primary", href: "#/new" }, "＋ " + t("newPost")))),
      h("div", { class: "section-head tag-bar" }, tabBtn("all", t("all")), tabBtn("drafts", t("drafts")), tabBtn("scheduled", t("scheduled")), tabBtn("published", t("published"))),
      shown.length ? h("div", { class: "ed-list" }, shown.map((p) => {
        const s = statusOf(p);
        return h("a", { class: "ed-row", href: "#/edit/" + p.slug },
          h("span", { class: "status " + s }, t(s === "drafts" ? "drafts" : s)),
          h("span", { class: "ed-title" }, p.title || t("untitled")),
          h("span", { class: "label ed-when" }, s === "drafts" ? t("updated", { d: fmtDate(p.updatedAt || new Date()) })
            : s === "scheduled" ? t("publishesAt", { d: fmtDate(p.publishAt, true) }) : t("publishedAt", { d: fmtDate(p.publishAt) })),
          h("span", { class: "label ed-tags" }, p.tags.map((x) => "#" + x).join(" ")));
      })) : h("p", { class: "empty" }, t("noPosts")));
  };
  view();
}

/* ---------- writing ---------- */
function editor(p) {
  const isNew = !p;
  const orig = p || { slug: "", title: "", body: "", tags: [], status: "draft", publishAt: null };
  const local = store.get(LOCAL(p?.slug));
  const restored = local && (local.title || local.body) && (!p || local.from === (p.updatedAt?.getTime() || 0));
  const s = { ...orig, tags: [...orig.tags], ...(restored ? { title: local.title, body: local.body, tags: local.tags || orig.tags, slug: local.slug ?? orig.slug } : {}) };
  let slugTouched = !isNew || !!(restored && local.slugTouched), previewing = false, sending = false;
  let when = p && p.status === "published" && !isLive(p) ? "later" : "now";
  let at = p?.publishAt && !isLive(p) ? p.publishAt : new Date(Date.now() + 864e5);
  const locked = p && p.status === "published"; // the address of something out there stays put

  const title = h("input", { class: "ed-title-in", maxlength: 120, placeholder: t("titlePh"), "aria-label": t("titlePh") });
  title.value = s.title;
  const ta = h("textarea", { class: "field ed-body", placeholder: t("bodyPh"), "aria-label": t("bodyPh") });
  ta.value = s.body;
  const pv = h("div", { class: "post-body ed-preview", hidden: true });
  const count = h("span", { class: "label" }), note = h("span", { class: "label note" });
  const slugIn = h("input", { class: "field mono", maxlength: 80, value: s.slug, disabled: locked, spellcheck: "false", "aria-label": t("slug") });
  const tagIn = h("input", { class: "field tag-in", placeholder: t("tagsPh"), list: "tag-list", "aria-label": t("tags") });
  const tagBox = h("div", { class: "tag-box" });
  const known = [...new Set(all.flatMap((x) => x.tags))];
  const atIn = h("input", { class: "field", type: "datetime-local", value: toLocalInput(at), "aria-label": t("scheduleAt") });

  const autoGrow = () => { ta.style.height = "auto"; ta.style.height = Math.max(360, ta.scrollHeight + 2) + "px"; };
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

  // the marks go around what's selected, or at the start of each line it touches (as in StoaTalk)
  function wrap(a, z, ph) {
    const st = ta.selectionStart, en = ta.selectionEnd, sel = ta.value.slice(st, en) || ph;
    ta.setRangeText(a + sel + z, st, en, "end"); ta.selectionStart = st + a.length; ta.selectionEnd = st + a.length + sel.length;
    ta.focus(); changed();
  }
  function prefix(pf) {
    const st = ta.value.lastIndexOf("\n", ta.selectionStart - 1) + 1, e0 = ta.value.indexOf("\n", ta.selectionEnd), en = e0 < 0 ? ta.value.length : e0;
    const lines = ta.value.slice(st, en).split("\n").map((l) => (l.startsWith(pf) ? l.slice(pf.length) : pf + l.replace(/^(#{1,3}|>|[-*]|\d{1,3}[.)])\s+/, "")));
    ta.setRangeText(lines.join("\n"), st, en, "end"); ta.focus(); changed();
  }
  async function link(img) {
    const st = ta.selectionStart, en = ta.selectionEnd, sel = ta.value.slice(st, en);
    const url = await promptBox(t(img ? "imageUrl" : "linkUrl"));
    if (!url) return ta.focus();
    const md = img ? `${st && ta.value[st - 1] !== "\n" ? "\n" : ""}![${sel || t("image")}](${url})\n` : `[${sel || t("link")}](${url})`;
    ta.setRangeText(md, st, en, "end"); ta.focus(); changed();
  }
  // pictures: from the toolbar, pasted, or dropped on the text. Each gets a line saying it's on its way, swapped for
  // the real one when the upload is done (or taken out if it fails)
  const file = h("input", { type: "file", accept: "image/*", multiple: true, hidden: true });
  let upN = 0;
  async function addImages(files) {
    files = [...files].filter((f) => f.type.startsWith("image/"));
    for (const f of files) {
      const mark = `![${t("uploading")}](#up${++upN})`, st = ta.selectionEnd, before = ta.value.slice(0, st);
      ta.setRangeText(`${before && !before.endsWith("\n") ? "\n" : ""}${mark}\n`, st, st, "end"); changed();
      try {
        const url = await uploadImage(f);
        ta.value = ta.value.replace(mark, `![](${url})`); // what goes between [ ] shows as its caption
      } catch (e) {
        console.warn(e); toast(t("uploadFail"));
        ta.value = ta.value.replace(mark + "\n", "").replace(mark, "");
      }
      changed();
    }
  }
  file.addEventListener("change", () => { const f = [...file.files]; file.value = ""; addImages(f); });
  ta.addEventListener("paste", (e) => { const f = [...(e.clipboardData?.files || [])]; if (f.some((x) => x.type.startsWith("image/"))) { e.preventDefault(); addImages(f); } });
  ta.addEventListener("dragover", (e) => { if ([...(e.dataTransfer?.items || [])].some((i) => i.kind === "file")) { e.preventDefault(); ta.classList.add("drop"); } });
  ta.addEventListener("dragleave", () => ta.classList.remove("drop"));
  ta.addEventListener("drop", (e) => { ta.classList.remove("drop"); const f = [...(e.dataTransfer?.files || [])]; if (f.length) { e.preventDefault(); addImages(f); } });
  const ico = (d) => { const e = document.createElementNS("http://www.w3.org/2000/svg", "svg"); e.setAttribute("viewBox", "0 0 24 24"); e.innerHTML = d; return e; };
  const tool = (label, txt, fn, cls = "") => h("button", { type: "button", class: "tool " + cls, "aria-label": t(label), title: t(label), "data-tool": "1", onclick: fn }, txt);
  const prevBtn = h("button", { type: "button", class: "btn small", onclick: togglePreview }, t("preview"));
  const toolbar = h("div", { class: "ed-tools" },
    tool("bold", "B", () => wrap("**", "**", t("bold")), "b"), tool("italic", "I", () => wrap("*", "*", t("italic")), "i"),
    tool("heading", "H", () => prefix("## ")), tool("list", "•", () => prefix("- ")), tool("numList", "1.", () => prefix("1. ")),
    tool("quote", "❝", () => prefix("> ")), tool("code", "</>", () => wrap("`", "`", "code")), tool("link", ico('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'), () => link(false)),
    tool("image", ico('<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m4 18 5.5-5 4 3.5 2.5-2 4 3.5"/>'), () => file.click()),
    h("span", { class: "grow" }), prevBtn);
  function togglePreview() {
    previewing = !previewing;
    prevBtn.textContent = t(previewing ? "write" : "preview");
    pv.hidden = !previewing; ta.hidden = previewing;
    toolbar.querySelectorAll("[data-tool]").forEach((x) => { x.disabled = previewing; });
    if (previewing) pv.innerHTML = render(ta.value); // render() escapes everything
  }

  // kept on this device as it's typed, until it's saved
  let saveT = 0;
  const keep = () => {
    if (!dirty) return;
    store.set(LOCAL(p?.slug), { title: title.value, body: ta.value, tags: s.tags, slug: slugIn.value, slugTouched, from: p?.updatedAt?.getTime() || 0, at: Date.now() });
  };
  function changed() {
    dirty = true;
    if (!slugTouched && !locked) slugIn.value = title.value.trim() ? slugify(title.value) : "";
    count.textContent = t("count", { n: ta.value.length.toLocaleString() }) + " · " + t("minRead", { n: readMinutes(ta.value) });
    autoGrow();
    clearTimeout(saveT); saveT = setTimeout(() => { keep(); note.textContent = t("localKept"); }, 800);
  }
  title.addEventListener("input", changed);
  ta.addEventListener("input", changed);
  slugIn.addEventListener("input", () => { slugTouched = true; slugIn.value = slugIn.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"); changed(); });
  atIn.addEventListener("change", () => { at = new Date(atIn.value); });
  // ⌘/Ctrl+S saves (a draft, or the update of a published post); ⌘/Ctrl+B and I mark
  ta.addEventListener("keydown", (e) => {
    if (!(e.metaKey || e.ctrlKey)) return;
    if (e.key === "b") { e.preventDefault(); wrap("**", "**", t("bold")); }
    if (e.key === "i") { e.preventDefault(); wrap("*", "*", t("italic")); }
  });
  const onKey = (e) => { if ((e.metaKey || e.ctrlKey) && e.key === "s" && app.contains(title)) { e.preventDefault(); save(p?.status === "published" ? "publish" : "draft"); } };
  document.addEventListener("keydown", onKey);

  const radio = (v, label) => h("label", { class: "radio" }, h("input", { type: "radio", name: "when", value: v, checked: when === v, onchange: () => { when = v; drawActions(); } }), label);
  const whenBox = h("div", { class: "when" });
  const actions = h("div", { class: "ed-actions" });
  function drawActions() {
    const live = p && isLive(p);
    fill(whenBox, ...(live ? [h("p", { class: "label" }, t("publishedAt", { d: fmtDate(p.publishAt, true) }))]
      : [radio("now", t("publishNow")), radio("later", t("schedule")), when === "later" ? atIn : null]));
    fill(actions, 
      p && p.status === "published" ? h("button", { class: "btn", type: "button", onclick: () => save("draft") }, t("unpublish"))
        : h("button", { class: "btn", type: "button", onclick: () => save("draft") }, t("saveDraft")),
      h("button", { class: "btn primary", type: "button", onclick: () => save("publish") },
        live ? t("update") : when === "later" ? t("schedule") : t("publishNow")));
  }

  const back = h("a", { class: "label back", href: "#/", onclick: async (e) => {
    e.preventDefault();
    if (dirty) { keep(); toast(t("localKept")); }
    dirty = false; document.removeEventListener("keydown", onKey); location.hash = "#/";
  } }, "← " + t("posts"));

  view = () => {}; // the editor's words are set once; switching language mid-sentence shouldn't redraw what's typed
  fill(app, 
    h("div", { class: "ed-top" }, back,
      h("div", { class: "row" }, p ? h("span", { class: "status " + statusOf(p) }, t(statusOf(p))) : null,
        p && p.status === "published" ? h("a", { class: "btn small", href: postUrl(p.slug), target: "_blank" }, t("view")) : null)),
    h("div", { class: "ed-grid" },
      h("div", { class: "ed-main" }, title, toolbar, ta, pv, file, h("div", { class: "ed-foot" }, count, note,
        restored ? h("button", { class: "linkish label", type: "button", onclick: async (e) => {
          store.set(LOCAL(p?.slug), null); e.target.remove(); title.value = orig.title; ta.value = orig.body; s.tags = [...orig.tags]; slugIn.value = orig.slug; drawTags(); changed(); dirty = false; note.textContent = "";
        } }, t("localDrop")) : null)),
      h("aside", { class: "ed-side" },
        h("div", { class: "field-group" }, h("label", { class: "label" }, t("tags")), tagBox, h("datalist", { id: "tag-list" }, known.map((x) => h("option", { value: x })))),
        h("div", { class: "field-group" }, h("label", { class: "label" }, t("slug")), h("div", { class: "slug-row" }, h("span", { class: "label" }, "/blog/"), slugIn), h("p", { class: "hint" }, t("slugHint"))),
        h("div", { class: "field-group" }, whenBox),
        actions,
        p ? h("button", { class: "linkish label danger", type: "button", onclick: del }, t("del")) : null)));
  drawTags(); drawActions(); changed(); dirty = !!restored; clearTimeout(saveT);
  if (restored) { note.textContent = t("localBack"); toast(t("localBack")); }
  setTimeout(() => (isNew ? title : ta).focus(), 50);

  async function del() {
    if (!(await confirmBox(t("delAsk", { t: p.title || t("untitled") }), t("del")))) return;
    try { await B.remove(p.slug); store.set(LOCAL(p.slug), null); dirty = false; toast(t("deleted")); location.hash = "#/"; }
    catch (e) { toast(t("saveFail", { e: e.code || e.message })); }
  }

  async function save(kind) {
    if (sending) return;
    const T = title.value.trim(), body = ta.value.replace(/\s+$/, ""), slug = slugIn.value.replace(/^-+|-+$/g, "");
    if (!T) { title.focus(); return toast(t("needTitle")); }
    if (kind === "publish" && !body.trim()) { ta.focus(); return toast(t("needBody")); }
    if (!slugOk(slug)) { slugIn.focus(); return toast(t("badSlug")); }
    let status = "draft", publishAt = p?.publishAt || null;
    if (kind === "publish") {
      status = "published";
      if (p && isLive(p)) publishAt = p.publishAt; // an update keeps its date
      else if (when === "later") {
        if (!(at instanceof Date) || isNaN(at) || at.getTime() <= Date.now() + 30e3) { atIn.focus(); return toast(t("pastTime")); }
        publishAt = at;
      } else publishAt = new Date();
    } else if (when === "later" && at instanceof Date && !isNaN(at)) publishAt = at; // a draft remembers the time it was meant for
    const data = { title: T, body, tags: s.tags, status, publishAt };
    sending = true; document.body.classList.add("busy");
    try {
      if (isNew) await B.create(slug, data);
      else if (slug !== p.slug) { await B.create(slug, { ...data, createdAt: p.createdAt }); await B.remove(p.slug); } // a draft's new address
      else await B.update(slug, data);
      store.set(LOCAL(p?.slug), null); dirty = false;
      if (status === "published" || p?.status === "published") B.rebuild(); // its link preview, up to date
      toast(status === "draft" ? t("saved") : p && isLive(p) ? t("updatedOk") : when === "later" ? t("scheduledOk", { d: fmtDate(publishAt, true) }) : t("publishedOk"));
      document.removeEventListener("keydown", onKey);
      const fresh = await B.get(slug);
      all = await B.listAll().catch(() => all);
      if (location.hash !== "#/edit/" + slug) history.replaceState(null, "", "#/edit/" + slug);
      editor(fresh);
    } catch (e) {
      console.warn(e); keep();
      toast(e?.code === "taken" ? t("slugTaken") : t("saveFail", { e: e.code || e.message }));
    } finally { sending = false; document.body.classList.remove("busy"); }
  }
}

start();

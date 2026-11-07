/* Where the gallery's photos live: Firestore photos/{slug}, next to the blog's posts and under the same sign-in; with
   ?demo, this browser's localStorage (like the blog's demo). A photo:
   { title, description, tags [], takenAt Date | null, exif { camera, lens, focal, aperture, shutter, iso } (text as shown),
     image, thumb (addresses: ~2400px and ~800px on the long side), width, height (of image),
     status "draft" | "published", publishAt Date, order (bigger = earlier in the gallery), createdAt, updatedAt }
   A new photo's order is the time it was uploaded, so the newest comes first; dragging in the editor sets it in between
   its new neighbours; scheduling sets it to the publish time, so the photo comes in at the top when its time comes.
   Scheduled works as for posts: firestore.rules keeps it unreadable to everyone but the owner until then. */
import { firebase, demo, toDate, isLive } from "./backend.js";

export { isLive };
export const EXIF = ["camera", "lens", "focal", "aperture", "shutter", "iso"];
const norm = (slug, d) => d && ({ slug, title: d.title || "", description: d.description || "", tags: Array.isArray(d.tags) ? d.tags : [],
  takenAt: toDate(d.takenAt), exif: Object.fromEntries(EXIF.map((k) => [k, d.exif?.[k] || ""])),
  image: d.image || "", thumb: d.thumb || d.image || "", width: d.width || 3, height: d.height || 2,
  status: d.status === "published" ? "published" : "draft", publishAt: toDate(d.publishAt), order: d.order || 0,
  createdAt: toDate(d.createdAt), updatedAt: toDate(d.updatedAt) });
const byOrder = (a, b) => b.order - a.order;
const DATES = ["publishAt", "takenAt"]; // what goes in as a Date

/* ---------- Firestore ---------- */
async function firebasePhotos() {
  const { F, db } = await firebase();
  const col = F.collection(db, "photos");
  const ts = (d) => (d ? F.Timestamp.fromDate(d) : null);
  const out = (d) => { const o = { ...d, updatedAt: F.serverTimestamp() }; for (const k of DATES) if (k in d) o[k] = ts(d[k]); return o; };
  return {
    async listPublished() {
      // as for posts: the rules let only a query through that can't return a photo before its time
      const q = (ms) => F.getDocs(F.query(col, F.where("status", "==", "published"), F.where("publishAt", "<=", F.Timestamp.fromMillis(ms)), F.orderBy("publishAt", "desc")));
      let snap;
      try { snap = await q(Date.now() - 60e3); } catch (e) { if (e?.code !== "permission-denied") throw e; snap = await q(Date.now() - 36e5); }
      return snap.docs.map((s) => norm(s.id, s.data())).sort(byOrder);
    },
    async get(slug) {
      try { const s = await F.getDoc(F.doc(col, slug)); return s.exists() ? norm(s.id, s.data()) : null; }
      catch (e) { if (e?.code === "permission-denied") return null; throw e; }
    },
    async listAll() { return (await F.getDocs(col)).docs.map((s) => norm(s.id, s.data())).sort(byOrder); },
    async create(slug, d) {
      await F.runTransaction(db, async (tx) => {
        const ref = F.doc(col, slug);
        if ((await tx.get(ref)).exists()) throw Object.assign(new Error("taken"), { code: "taken" });
        tx.set(ref, { ...out(d), createdAt: F.serverTimestamp() });
      });
    },
    async update(slug, d) { await F.updateDoc(F.doc(col, slug), out(d)); },
    async remove(slug) { await F.deleteDoc(F.doc(col, slug)); },
  };
}

/* ---------- demo: this browser only ---------- */
const KEY = "blog-demo-photos";
function demoPhotos() {
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || seed(); } catch (e) { return seed(); } };
  const save = (all) => { try { localStorage.setItem(KEY, JSON.stringify(all)); } catch (e) {} };
  const all = () => Object.entries(load()).map(([k, v]) => norm(k, v));
  const store = (fn) => { const a = load(); fn(a); save(a); };
  const iso = (d) => (d ? d.toISOString() : null);
  const ser = (d) => { const o = { ...d, updatedAt: new Date().toISOString() }; for (const k of DATES) if (k in d) o[k] = iso(d[k]); return o; };
  return {
    async listPublished() { return all().filter((p) => isLive(p)).sort(byOrder); },
    async get(slug) { return all().find((p) => p.slug === slug) || null; },
    async listAll() { return all().sort(byOrder); },
    async create(slug, d) {
      if (load()[slug]) throw Object.assign(new Error("taken"), { code: "taken" });
      store((a) => { a[slug] = { ...ser(d), createdAt: new Date().toISOString() }; });
    },
    async update(slug, d) { store((a) => { a[slug] = { ...a[slug], ...ser(d) }; }); },
    async remove(slug) { store((a) => { delete a[slug]; }); },
  };
}
// a few soft gradients standing in for photos
function seed() {
  const day = 864e5, now = Date.now(), iso = (ms) => new Date(ms).toISOString();
  const pic = (w, h, a, b) => "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`);
  const p = (title, tags, ago, [w, h, a, b], exif, status = "published") => ({ title, description: "", tags, exif, status, width: w, height: h,
    image: pic(w, h, a, b), thumb: pic(w, h, a, b), takenAt: iso(now - ago - 30 * day), publishAt: iso(now - ago), order: now - ago, createdAt: iso(now - ago), updatedAt: iso(now - ago) });
  const fuji = { camera: "FUJIFILM X100V", focal: "23mm", aperture: "f/2", shutter: "1/250s", iso: "ISO 200" };
  const s = {
    "harbour-dusk": p("港邊黃昏", ["街拍", "台北"], 1 * day, [3000, 2000, "#E9C3A0", "#5B4B49"], fuji),
    "morning-fog": p("Morning fog", ["風景"], 3 * day, [2000, 3000, "#C9D3DA", "#4A5560"], { camera: "SONY ILCE-7M3", lens: "FE 35mm F1.8", focal: "35mm", aperture: "f/1.8", shutter: "1/1000s", iso: "ISO 100" }),
    "alley": p("巷弄", ["街拍"], 6 * day, [2400, 2400, "#D8D2C4", "#6E6A5F"], fuji),
    "coast": p("Coast", ["風景", "旅行"], 9 * day, [3200, 1800, "#9FB4C2", "#3C4E58"], {}),
    "night-market": p("夜市", ["街拍", "台北"], 14 * day, [2000, 3000, "#2B3046", "#C98B6B"], {}),
    "next-photo": p("下週要發的照片", ["旅行"], -3 * day, [3000, 2000, "#E0D9C8", "#8A7F6A"], {}),
    "draft-photo": p("", [], 0, [3000, 2250, "#B9C2B0", "#59604F"], {}, "draft"),
  };
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
  return s;
}

let ready = null;
export const photos = () => (ready ||= demo ? Promise.resolve(demoPhotos()) : firebasePhotos());

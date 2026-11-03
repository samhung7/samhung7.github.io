/* Where posts live. Firestore (posts/{slug}) when config.js has a Firebase config; with ?demo (or no config, on the
   editor) a stand-in kept in this browser's localStorage, so the pages and the editor can be tried before Firebase is set up.
   A post: { title, body (Markdown), tags [], status "draft" | "published", publishAt Date, createdAt, updatedAt }.
   Published with publishAt in the future means scheduled: firestore.rules keeps it unreadable to everyone but the owner
   until then, so nothing has to run at publish time. */
import { CONFIG } from "./config.js";

const FB = "https://www.gstatic.com/firebasejs/10.12.2/";
// ?demo turns demo mode on for this tab (kept while moving between blog pages), ?demo=0 turns it off
const qd = new URLSearchParams(location.search).get("demo");
try { if (qd != null) sessionStorage.setItem("blog-demo", qd === "0" ? "" : "1"); } catch (e) {}
const ss = (() => { try { return sessionStorage.getItem("blog-demo"); } catch (e) { return null; } })();
export const demo = qd != null ? qd !== "0" : ss === "1";
export const configured = !!CONFIG.firebase;
export const off = !configured && !demo; // no Firebase yet, and not trying the demo: the blog says it opens soon

const toDate = (v) => (v == null ? null : v instanceof Date ? v : typeof v.toDate === "function" ? v.toDate() : new Date(v));
const norm = (slug, d) => d && ({ slug, title: d.title || "", body: d.body || "", tags: Array.isArray(d.tags) ? d.tags : [],
  status: d.status === "published" ? "published" : "draft", publishAt: toDate(d.publishAt), createdAt: toDate(d.createdAt), updatedAt: toDate(d.updatedAt) });
export const isLive = (p, now = Date.now()) => p.status === "published" && p.publishAt && p.publishAt.getTime() <= now;

/* ---------- Firestore ---------- */
async function firebaseBackend() {
  const [{ initializeApp }, A, F] = await Promise.all([import(FB + "firebase-app.js"), import(FB + "firebase-auth.js"), import(FB + "firebase-firestore.js")]);
  const app = initializeApp(CONFIG.firebase);
  const auth = A.getAuth(app), db = F.getFirestore(app);
  const col = F.collection(db, "posts");
  let user = null;
  const authReady = new Promise((res) => A.onAuthStateChanged(auth, (u) => { user = u; res(); }));
  const out = (d) => ({ ...d, publishAt: d.publishAt ? F.Timestamp.fromDate(d.publishAt) : null, updatedAt: F.serverTimestamp() });
  return {
    async listPublished() {
      // the rules only let a query through that can't return a post before its time, so ask for "published before now"
      const q = (ms) => F.getDocs(F.query(col, F.where("status", "==", "published"), F.where("publishAt", "<=", F.Timestamp.fromMillis(ms)), F.orderBy("publishAt", "desc")));
      let snap;
      try { snap = await q(Date.now() - 60e3); } catch (e) { if (e?.code !== "permission-denied") throw e; snap = await q(Date.now() - 36e5); } // a clock running fast
      return snap.docs.map((s) => norm(s.id, s.data()));
    },
    async get(slug) {
      try { const s = await F.getDoc(F.doc(col, slug)); return s.exists() ? norm(s.id, s.data()) : null; }
      catch (e) { if (e?.code === "permission-denied") return null; throw e; }
    },
    async listAll() { const s = await F.getDocs(F.query(col, F.orderBy("updatedAt", "desc"))); return s.docs.map((x) => norm(x.id, x.data())); },
    async create(slug, d) {
      await F.runTransaction(db, async (tx) => {
        const ref = F.doc(col, slug);
        if ((await tx.get(ref)).exists()) throw Object.assign(new Error("taken"), { code: "taken" });
        tx.set(ref, { ...out(d), createdAt: F.serverTimestamp() });
      });
    },
    async update(slug, d) { await F.updateDoc(F.doc(col, slug), out(d)); },
    async remove(slug) { await F.deleteDoc(F.doc(col, slug)); },
    async whoami() { await authReady; return user && { uid: user.uid, name: user.displayName, email: user.email, owner: user.uid === CONFIG.ownerUid }; },
    async signIn() { await A.signInWithPopup(auth, new A.GoogleAuthProvider()); return this.whoami(); },
    async signOut() { await A.signOut(auth); },
    // the static page for link previews (tools/build-blog.mjs), built now instead of at the next scheduled run; best effort
    async rebuild() {
      try { await fetch(`${CONFIG.images.api}/rebuild`, { method: "POST", headers: { Authorization: "Bearer " + (await auth.currentUser.getIdToken()) } }); } catch (e) {}
    },
    async putImage(bytes, name) {
      const res = await fetch(`${CONFIG.images.api}/img/${name}`, { method: "PUT", body: bytes,
        headers: { Authorization: "Bearer " + (await auth.currentUser.getIdToken()), "Content-Type": "image/jpeg" } });
      if (!res.ok) throw new Error("upload " + res.status);
      return `${CONFIG.images.host}/img/${name}`;
    },
  };
}

/* ---------- demo: this browser only ---------- */
const KEY = "blog-demo-posts";
function demoBackend() {
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || seed(); } catch (e) { return seed(); } };
  const save = (all) => { try { localStorage.setItem(KEY, JSON.stringify(all)); } catch (e) {} };
  const all = () => Object.entries(load()).map(([k, v]) => norm(k, v));
  const store = (fn) => { const a = load(); fn(a); save(a); };
  const ser = (d) => ({ ...d, publishAt: d.publishAt ? d.publishAt.toISOString() : null, updatedAt: new Date().toISOString() });
  return {
    async listPublished() { return all().filter((p) => isLive(p)).sort((a, b) => b.publishAt - a.publishAt); },
    async get(slug) { return all().find((p) => p.slug === slug) || null; },
    async listAll() { return all().sort((a, b) => b.updatedAt - a.updatedAt); },
    async create(slug, d) {
      if (load()[slug]) throw Object.assign(new Error("taken"), { code: "taken" });
      store((a) => { a[slug] = { ...ser(d), createdAt: new Date().toISOString() }; });
    },
    async update(slug, d) { store((a) => { a[slug] = { ...a[slug], ...ser(d) }; }); },
    async remove(slug) { store((a) => { delete a[slug]; }); },
    async whoami() { return { uid: "demo", name: "Sam", owner: true }; },
    async signIn() { return this.whoami(); },
    async signOut() {},
    demo: true,
    async rebuild() {},
    async putImage(bytes) { // kept inside the post itself; fine for trying things out, not for real posts
      let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return "data:image/jpeg;base64," + btoa(s);
    },
  };
}
function seed() {
  const day = 864e5, now = Date.now(), iso = (ms) => new Date(ms).toISOString();
  const p = (title, tags, ago, body, status = "published") => ({ title, tags, body, status, publishAt: iso(now - ago), createdAt: iso(now - ago - day), updatedAt: iso(now - ago) });
  const s = {
    "hello-studio": p("Samhung Studio 開張了", ["隨筆", "Studio"], 2 * day,
      "這裡會放一些做專案時的筆記、踩過的坑，還有偶爾的生活碎念。\n\n## 為什麼開始寫\n\n做 **StoaTalk** 的這一年，很多決定當下覺得理所當然，過幾個月回頭看卻想不起原因。寫下來，是給未來的自己一份*備忘錄*。\n\n> 寫作是把思考攤開來晾乾。\n\n接下來會寫的主題：\n\n- 端對端加密在瀏覽器裡怎麼做\n- 一個人維護多個小專案的節奏\n- 設計上的取捨\n\n有想看的題目，歡迎寫信到 [hello@samhungstudio.com](mailto:hello@samhungstudio.com)。"),
    "realtime-db-rules": p("用 Firebase 規則守住一個匿名聊天室", ["StoaTalk", "Firebase", "技術筆記"], 9 * day,
      "StoaTalk 沒有自己的伺服器，誰能讀寫什麼，全靠資料庫規則。\n\n## 規則就是後端\n\n每一則訊息寫入時，規則會檢查：\n\n1. 寫的人是不是房間成員\n2. 距離上一則是否超過 800 毫秒\n3. 欄位有沒有多出來\n\n```\n\".write\": \"auth != null && root.child('rooms/' + $room + '/members/' + auth.uid).exists()\"\n```\n\n---\n\n下一篇會寫怎麼替這些規則寫測試。"),
    "small-tools": p("Small tools, made with care", ["Studio", "Design"], 20 * day,
      "Most of what I build fits in a browser tab and does one thing.\n\n## Why small\n\nA scoreboard for a pickup game. A snake battle for two people on one keyboard. Small tools get *finished*, and finished things get used.\n\n- No sign-up\n- Works offline when it can\n- Speaks your language"),
    "next-post": p("下週要發的文章", ["隨筆"], -3 * day, "這篇是預約發佈的示範。"),
    "draft-notes": p("草稿：Game Scoreboard 的音效設計", ["Game Scoreboard"], 1 * day, "還在寫……", "draft"),
  };
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
  return s;
}

let ready = null;
export const backend = () => (ready ||= off ? Promise.reject(new Error("off")) : demo ? Promise.resolve(demoBackend()) : firebaseBackend());

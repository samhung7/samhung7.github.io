/* /blog/dashboard/: the site's statistics, for the owner only. The numbers come from the picture service's GET /stats
   (worker/src/stats.js), which checks the same Google sign-in as the editor; post titles and publish dates from the
   blog itself. With ?demo it draws made-up numbers, to try the page without either. docs/analytics.md has the rest. */
import { backend, off, demo } from "./backend.js";
import { lang } from "./i18n.js";
import { fill, initChrome, onLang, h, toast } from "./chrome.js";
import { CONFIG } from "./config.js";

initChrome();
const app = document.getElementById("app");

const W = {
  zh: {
    title: "Dashboard", signIn: "以 Google 登入", notOwner: "這個帳號沒有權限。", loading: "載入中…", signOut: "登出", editor: "編輯器",
    r1: "24 小時", r7: "7 天", r30: "30 天", r90: "90 天", updated: "更新於 {t}", refresh: "重新整理",
    views: "瀏覽", visitors: "訪客", readRate: "讀完率", avgTime: "平均停留", shares: "分享", vsPrev: "比前一段", noPrev: "無前期資料",
    trend: "每日瀏覽", trendNote: "點代表文章發布日", posts: "文章表現", post: "文章", sevenDays: "發布後 7 天", depth: "讀到哪裡",
    pages: "熱門頁面", page: "頁面", sources: "來源", sourceGroups: "來源類型", topSources: "前幾名來源", shareClicks: "分享按鈕",
    outbound: "點出去的網站", readers: "讀者", country: "國家地區", device: "裝置", browser: "瀏覽器", os: "系統", lang: "介面語言",
    blang: "瀏覽器語言", theme: "主題", health: "網站健康", vitals: "載入體驗（75 百分位）", problems: "錯誤與找不到的頁面",
    none: "還沒有資料。", good: "良好", ni: "待改善", poor: "不佳", samples: "{n} 次瀏覽的量測",
    notConfigured: "Dashboard 還沒接上資料：請在 GitHub repo secrets 加上 CF_ANALYTICS_TOKEN，Worker 重新部署後就會出現數字。",
    loadFail: "讀取統計失敗：{e}", demo: "示範模式：以下都是假資料。", visitorsNote: "訪客數是每天不重複人數的加總",
    g_direct: "直接進入", g_search: "搜尋", g_social: "社群", g_share: "分享連結", g_referral: "其他網站", g_campaign: "活動連結", g_internal: "站內",
    d_mobile: "手機", d_tablet: "平板", d_desktop: "電腦", t_light: "淺色", t_dark: "深色", direct: "直接進入", internal: "站內",
    s_copy: "複製連結", s_native: "原生分享", s_line: "LINE", s_fb: "Facebook", s_x: "X", s_threads: "Threads",
    error: "錯誤", notfound: "找不到", home: "首頁", blogHome: "部落格列表", privacy: "隱私權", sec: "{n} 秒", min: "{m} 分 {s} 秒",
  },
  en: {
    title: "Dashboard", signIn: "Sign in with Google", notOwner: "This account can't see the dashboard.", loading: "Loading…", signOut: "Sign out", editor: "Editor",
    r1: "24 hours", r7: "7 days", r30: "30 days", r90: "90 days", updated: "Updated {t}", refresh: "Refresh",
    views: "Views", visitors: "Visitors", readRate: "Read-through", avgTime: "Avg. time", shares: "Shares", vsPrev: "vs. previous", noPrev: "No earlier data",
    trend: "Views per day", trendNote: "Dots mark publish days", posts: "Posts", post: "Post", sevenDays: "First 7 days", depth: "How far readers got",
    pages: "Top pages", page: "Page", sources: "Sources", sourceGroups: "Source types", topSources: "Top sources", shareClicks: "Share buttons",
    outbound: "Sites clicked through to", readers: "Readers", country: "Country", device: "Device", browser: "Browser", os: "System", lang: "Site language",
    blang: "Browser language", theme: "Theme", health: "Site health", vitals: "Loading experience (75th percentile)", problems: "Errors and missing pages",
    none: "No data yet.", good: "Good", ni: "Needs work", poor: "Poor", samples: "measured on {n} views",
    notConfigured: "The dashboard isn't connected yet: add CF_ANALYTICS_TOKEN to the GitHub repo secrets, and the numbers appear once the Worker redeploys.",
    loadFail: "Couldn't load the statistics: {e}", demo: "Demo mode: all numbers below are made up.", visitorsNote: "Visitors add up each day's unique readers",
    g_direct: "Direct", g_search: "Search", g_social: "Social", g_share: "Shared links", g_referral: "Other sites", g_campaign: "Campaigns", g_internal: "Internal",
    d_mobile: "Phone", d_tablet: "Tablet", d_desktop: "Computer", t_light: "Light", t_dark: "Dark", direct: "Direct", internal: "Internal",
    s_copy: "Copy link", s_native: "Share sheet", s_line: "LINE", s_fb: "Facebook", s_x: "X", s_threads: "Threads",
    error: "Error", notfound: "Not found", home: "Home", blogHome: "Blog list", privacy: "Privacy", sec: "{n}s", min: "{m}m {s}s",
  },
};
const w = (k, v = {}) => (W[lang()][k] ?? W.zh[k] ?? k).replace(/\{(\w+)\}/g, (_, x) => v[x] ?? "");
const nf = () => new Intl.NumberFormat(lang() === "en" ? "en-US" : "zh-TW");
const fmt = (n) => nf().format(Math.round(n || 0));
const pct = (a, b) => (b ? Math.round((a / b) * 100) + "%" : "–");
const dur = (s) => { s = Math.round(s || 0); return s < 60 ? w("sec", { n: s }) : w("min", { m: Math.floor(s / 60), s: s % 60 }); };
const day = (iso) => { const [, m, d] = iso.split("-"); return lang() === "en" ? `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][+m - 1]} ${+d}` : `${+m}/${+d}`; };
const taipei = (d) => new Date(d.getTime() + 8 * 3600e3).toISOString().slice(0, 10);
const svgEl = (tag, attrs = {}) => { const e = document.createElementNS("http://www.w3.org/2000/svg", tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };

let B, me, data, posts = [], range = +(sessionStorage.getItem("dash-range") || 7), sortKey = "views", openSlug = null, state = "loading", why = "";

async function start() {
  if (off) { state = "off"; return draw(); }
  try { B = await backend(); me = await B.whoami(); } catch (e) { state = "fail"; why = e.message; return draw(); }
  if (!me || !me.owner) { state = "gate"; return draw(); }
  B.listPublished().then((p) => { posts = p; if (data) draw(); }, () => {});
  load();
}

async function load() {
  state = "loading"; draw();
  try {
    if (demo || B.demo) data = fake(range);
    else {
      const res = await fetch(`${CONFIG.images.api}/stats?days=${range}`, { headers: { Authorization: "Bearer " + (await B.idToken()) } });
      const body = await res.json().catch(() => ({}));
      if (res.status === 503 && body.error === "not-configured") { state = "setup"; return draw(); }
      if (!res.ok) throw new Error(body.detail || "HTTP " + res.status);
      data = body;
    }
    state = "ok";
  } catch (e) { state = "fail"; why = e.message; }
  draw();
}

function gate() {
  return h("div", { class: "nothing" }, h("h1", { class: "ed-h" }, w("title")),
    me ? h("p", {}, w("notOwner")) : null,
    h("button", { class: "btn primary", type: "button", onclick: async () => {
      try { if (me) await B.signOut(); me = await B.signIn(); if (me && me.owner) { try { localStorage.setItem("ss-no-track", "1"); } catch (e) {} start(); } else draw(); }
      catch (e) { toast(e.code || e.message); } } }, w("signIn")));
}

function draw() {
  document.title = w("title") + " · Samhung Studio";
  if (state === "off") return fill(app, h("p", { class: "empty" }, "js/blog/config.js → firebase"));
  if (state === "gate") return fill(app, gate());
  const head = h("div", { class: "ed-top" }, h("h1", { class: "ed-h" }, w("title")),
    h("div", { class: "row" },
      h("a", { class: "btn small", href: "/blog/editor/" + (demo ? "?demo" : "") }, w("editor")),
      h("button", { class: "btn small", type: "button", onclick: load }, w("refresh"))));
  const ranges = h("div", { class: "section-head tag-bar dash-ranges" },
    [1, 7, 30, 90].map((d) => h("button", { type: "button", class: "chip" + (range === d ? " on" : ""), onclick: () => { range = d; sessionStorage.setItem("dash-range", d); load(); } }, w("r" + d))),
    data && state === "ok" ? h("span", { class: "label dash-when" }, w("updated", { t: new Intl.DateTimeFormat(lang() === "en" ? "en-US" : "zh-TW", { hour: "2-digit", minute: "2-digit" }).format(new Date(data.generated)) })) : null);
  const banner = demo ? h("div", { class: "demo-note label" }, w("demo")) : null;
  if (state === "loading") return fill(app, banner, head, ranges, h("p", { class: "empty label" }, w("loading")));
  if (state === "setup") return fill(app, head, h("p", { class: "empty" }, w("notConfigured")));
  if (state === "fail") return fill(app, banner, head, ranges, h("p", { class: "empty" }, w("loadFail", { e: why })));
  fill(app, banner, head, ranges, kpis(), trend(), postTable(), pageList(), sourcesBlock(), readersBlock(), healthBlock());
}

/* ---------- the parts ---------- */
const section = (title, note, ...kids) => h("section", { class: "dash-sec" }, h("div", { class: "dash-sec-head" }, h("h2", {}, title), note ? h("span", { class: "label" }, note) : null), ...kids);

function postViews(list) { return list.filter((p) => p.slug).reduce((a, p) => a + p.views, 0); }

function kpis() {
  const t = data.totals, p = data.previous, postV = postViews(data.pages);
  const item = (label, value, cur, prev, note) => {
    let delta = null;
    if (prev != null && cur != null) {
      if (!prev) delta = h("span", { class: "label dash-delta" }, w("noPrev"));
      else { const c = Math.round(((cur - prev) / prev) * 100); delta = h("span", { class: "label dash-delta" }, (c > 0 ? "▲ " : c < 0 ? "▼ " : "") + Math.abs(c) + "% " + w("vsPrev")); }
    }
    return h("div", { class: "dash-kpi", title: note || "" }, h("span", { class: "label" }, label), h("span", { class: "dash-num" }, value), delta);
  };
  return h("div", { class: "dash-kpis" },
    item(w("views"), fmt(t.views), t.views, p && p.views),
    item(w("visitors"), fmt(t.visitors), t.visitors, p && p.visitors, w("visitorsNote")),
    item(w("readRate"), pct(t.reads, postV), null, null),
    item(w("avgTime"), dur(t.views ? t.secs / t.views : 0), t.views ? t.secs / t.views : 0, p && p.views ? p.secs / p.views : p ? 0 : null),
    item(w("shares"), fmt(t.shares), t.shares, p && p.shares));
}

function trend() {
  const s = data.series;
  if (!s.length || !s.some((d) => d.views)) return section(w("trend"), null, h("p", { class: "empty label" }, w("none")));
  const box = h("div", { class: "dash-chart" }), tip = h("div", { class: "dash-tip", role: "status" });
  box.append(tip);
  const pubs = new Map();
  for (const p of posts) if (p.publishAt) { const k = taipei(p.publishAt); (pubs.get(k) || pubs.set(k, []).get(k)).push(p.title); }
  const render = () => {
    box.querySelector("svg")?.remove();
    const Wd = Math.max(280, box.clientWidth || 640), H = 220, L = 44, R = 12, T = 12, Bm = 28;
    const max = Math.max(1, ...s.map((d) => d.views)), step = niceStep(max / 3), top = Math.ceil(max / step) * step;
    const X = (i) => L + (s.length === 1 ? (Wd - L - R) / 2 : (i / (s.length - 1)) * (Wd - L - R)), Y = (v) => T + (1 - v / top) * (H - T - Bm);
    const g = svgEl("svg", { viewBox: `0 0 ${Wd} ${H}`, width: Wd, height: H, role: "img", "aria-label": w("trend") });
    for (let v = 0; v <= top; v += step) {
      g.append(svgEl("line", { x1: L, x2: Wd - R, y1: Y(v), y2: Y(v), class: "dash-grid" }));
      const tx = svgEl("text", { x: L - 8, y: Y(v) + 4, "text-anchor": "end", class: "dash-axis" }); tx.textContent = fmt(v); g.append(tx);
    }
    const every = Math.max(1, Math.ceil(s.length / Math.floor((Wd - L - R) / 64)));
    s.forEach((d, i) => { if (i % every === 0 || i === s.length - 1) { if (i !== s.length - 1 && s.length - 1 - i < every / 2) return; const tx = svgEl("text", { x: X(i), y: H - 8, "text-anchor": "middle", class: "dash-axis" }); tx.textContent = day(d.day); g.append(tx); } });
    g.append(svgEl("path", { d: s.map((d, i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(d.views).toFixed(1)).join(""), class: "dash-line" }));
    s.forEach((d, i) => { if (pubs.has(d.day)) g.append(svgEl("circle", { cx: X(i), cy: H - Bm, r: 4, class: "dash-pub" })); });
    const cross = svgEl("line", { y1: T, y2: H - Bm, class: "dash-cross" }), dot = svgEl("circle", { r: 4, class: "dash-dot" });
    cross.style.display = dot.style.display = "none"; g.append(cross, dot);
    const hit = svgEl("rect", { x: L, y: 0, width: Wd - L - R, height: H, fill: "transparent" });
    const show = (ev) => {
      const r = g.getBoundingClientRect(), x = (ev.clientX - r.left) * (Wd / r.width);
      const i = Math.max(0, Math.min(s.length - 1, Math.round(((x - L) / (Wd - L - R)) * (s.length - 1)))), d = s[i];
      cross.setAttribute("x1", X(i)); cross.setAttribute("x2", X(i)); dot.setAttribute("cx", X(i)); dot.setAttribute("cy", Y(d.views));
      cross.style.display = dot.style.display = "";
      fill(tip, h("strong", {}, day(d.day)), h("span", {}, `${w("views")} ${fmt(d.views)}`), h("span", {}, `${w("visitors")} ${fmt(d.visitors)}`),
        d.shares ? h("span", {}, `${w("shares")} ${fmt(d.shares)}`) : null, (pubs.get(d.day) || []).map((tt) => h("em", {}, "● " + tt)));
      tip.style.display = "flex";
      const px = (X(i) / Wd) * r.width; tip.style.left = Math.min(Math.max(px - tip.offsetWidth / 2, 0), r.width - tip.offsetWidth) + "px";
    };
    hit.addEventListener("pointermove", show); hit.addEventListener("pointerdown", show);
    hit.addEventListener("pointerleave", () => { cross.style.display = dot.style.display = tip.style.display = "none"; });
    g.append(hit); box.prepend(g);
  };
  requestAnimationFrame(render);
  new ResizeObserver(() => render()).observe(box);
  return section(w("trend"), posts.length ? w("trendNote") : null, box);
}
function niceStep(x) { const p = 10 ** Math.floor(Math.log10(Math.max(x, 1))), m = x / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; }

function firstWeek(p, pub) {
  if (!pub) return null;
  const a = taipei(pub), b = taipei(new Date(pub.getTime() + 6 * 864e5));
  return p.daily.filter(([d]) => d >= a && d <= b).reduce((s, [, n]) => s + n, 0);
}

function postTable() {
  const meta = new Map(posts.map((p) => [p.slug, p]));
  const rows = data.pages.filter((p) => p.slug).map((p) => ({ ...p, title: meta.get(p.slug)?.title || p.slug, week: firstWeek(p, meta.get(p.slug)?.publishAt),
    rate: p.views ? p.reads / p.views : 0, avg: p.views ? p.secs / p.views : 0 }));
  if (!rows.length) return section(w("posts"), null, h("p", { class: "empty label" }, w("none")));
  rows.sort((a, b) => (b[sortKey] ?? -1) - (a[sortKey] ?? -1));
  const cols = [["views", w("views")], ["visitors", w("visitors")], ["rate", w("readRate")], ["avg", w("avgTime")], ["shares", w("shares")], ["week", w("sevenDays")]];
  const th = ([k, label]) => h("th", { scope: "col", class: "n" }, h("button", { type: "button", class: "linkish label" + (sortKey === k ? " on" : ""), onclick: () => { sortKey = k; draw(); } }, label + (sortKey === k ? " ↓" : "")));
  const cell = (k, r) => k === "rate" ? pct(r.reads, r.views) : k === "avg" ? dur(r.avg) : r[k] == null ? "–" : fmt(r[k]);
  const body = [];
  for (const r of rows) {
    body.push(h("tr", { class: "dash-row" + (openSlug === r.slug ? " open" : ""), onclick: () => { openSlug = openSlug === r.slug ? null : r.slug; draw(); } },
      h("th", { scope: "row" }, h("span", { class: "dash-post" }, r.title)), cols.map(([k]) => h("td", { class: "n", "data-label": cols.find((c) => c[0] === k)[1] }, cell(k, r)))));
    if (openSlug === r.slug) body.push(h("tr", { class: "dash-detail" }, h("td", { colspan: cols.length + 1 }, depthBars(r), h("p", {}, h("a", { class: "label", href: "/blog/" + r.slug + "/" }, "/blog/" + r.slug + "/ ↗")))));
  }
  return section(w("posts"), null, h("div", { class: "dash-table-wrap" }, h("table", { class: "dash-table" },
    h("thead", {}, h("tr", {}, h("th", { scope: "col" }, h("span", { class: "label" }, w("post"))), cols.map(th))), h("tbody", {}, body))));
}

function depthBars(r) {
  const f = r.depth;
  if (!f || !f[0]) return h("p", { class: "label" }, w("none"));
  return h("div", { class: "dash-depth" }, h("p", { class: "label" }, w("depth")),
    [["25%", f[1]], ["50%", f[2]], ["75%", f[3]], ["100%", f[4]]].map(([k, n]) => bar(k, n, f[0], pct(n, f[0]))));
}

function bar(name, n, max, shown) {
  return h("div", { class: "dash-bar", title: `${name}: ${fmt(n)}` }, h("span", { class: "dash-bar-name" }, name), h("span", { class: "dash-bar-val" }, shown ?? fmt(n)),
    h("span", { class: "dash-bar-track" }, h("span", { class: "dash-bar-fill", style: `width:${max ? Math.max(1.5, (n / max) * 100) : 0}%` })));
}
const bars = (list, label = (x) => x) => {
  if (!list || !list.length) return h("p", { class: "empty label" }, w("none"));
  const max = Math.max(...list.map((x) => x.n)), total = list.reduce((a, x) => a + x.n, 0);
  return h("div", { class: "dash-bars" }, list.map((x) => bar(label(x.name), x.n, max, `${fmt(x.n)} · ${pct(x.n, total)}`)));
};
const card = (title, ...kids) => h("div", { class: "dash-card" }, h("h3", { class: "label" }, title), ...kids);

function pageName(path) {
  if (path === "/") return w("home");
  if (path === "/blog/") return w("blogHome");
  if (path === "/privacy/") return w("privacy");
  return path;
}
function pageList() {
  const list = data.pages.filter((p) => !p.slug).map((p) => ({ name: p.path, n: p.views }));
  return section(w("pages"), null, bars(list.slice(0, 10), pageName));
}

function sourcesBlock() {
  const srcName = (x) => (x === "direct" || x === "internal" ? w(x) : x);
  return section(w("sources"), null, h("div", { class: "dash-grid" },
    card(w("sourceGroups"), bars(data.groups, (g) => w("g_" + g))),
    card(w("topSources"), bars(data.sources.map((s) => ({ name: s.name, n: s.n })), srcName)),
    card(w("shareClicks"), bars(data.shares, (s) => w("s_" + s))),
    card(w("outbound"), bars(data.outbound))));
}

function readersBlock() {
  const R = data.readers;
  const country = (c) => { try { return new Intl.DisplayNames([lang() === "en" ? "en" : "zh-TW"], { type: "region" }).of(c) || c; } catch (e) { return c; } };
  const langName = (c) => { try { return new Intl.DisplayNames([lang() === "en" ? "en" : "zh-TW"], { type: "language" }).of(c) || c; } catch (e) { return c; } };
  const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
  return section(w("readers"), null, h("div", { class: "dash-grid" },
    card(w("country"), bars(R.country, (c) => (c === "?" || !c ? "?" : country(c)))),
    card(w("device"), bars(R.device, (d) => w("d_" + d))),
    card(w("browser"), bars(R.browser, cap)),
    card(w("os"), bars(R.os, (o) => ({ ios: "iOS", macos: "macOS", android: "Android", windows: "Windows", linux: "Linux", chromeos: "ChromeOS" }[o] || o))),
    card(w("lang"), bars(R.lang, (l) => (l === "en" ? "English" : "中文"))),
    card(w("blang"), bars(R.blang, (l) => (l && l !== "?" ? langName(l) : "?"))),
    card(w("theme"), bars(R.theme, (t) => w("t_" + t)))));
}

function healthBlock() {
  const v = data.vitals;
  const grade = (x, good, poor) => (x <= good ? "good" : x <= poor ? "ni" : "poor");
  const vital = (name, value, shown, good, poor) => {
    const g = grade(value, good, poor);
    return h("div", { class: "dash-vital" }, h("span", { class: "label" }, name), h("span", { class: "dash-num small" }, shown),
      h("span", { class: "dash-grade " + g }, h("span", { class: "dash-grade-icon", "aria-hidden": "true" }, g === "good" ? "●" : g === "ni" ? "◐" : "○"), w(g)));
  };
  const vit = v ? h("div", {}, h("div", { class: "dash-vitals" },
    vital("LCP", v.lcp, (v.lcp / 1000).toFixed(1) + " s", 2500, 4000),
    vital("INP", v.inp, Math.round(v.inp) + " ms", 200, 500),
    vital("CLS", v.cls, (+v.cls).toFixed(2), 0.1, 0.25)), h("p", { class: "label dash-foot" }, w("samples", { n: fmt(v.n) })))
    : h("p", { class: "empty label" }, w("none"));
  const probs = data.problems.length ? h("div", { class: "dash-bars" }, data.problems.map((p) =>
    h("div", { class: "dash-prob" }, h("span", { class: "dash-tag " + p.type }, w(p.type)), h("span", { class: "dash-prob-text" }, p.type === "notfound" ? p.path : `${p.x}  ·  ${p.path}`), h("span", { class: "dash-bar-val" }, fmt(p.n)))))
    : h("p", { class: "empty label" }, w("none"));
  return section(w("health"), null, h("div", { class: "dash-grid two" }, card(w("vitals"), vit), card(w("problems"), probs)));
}

/* ---------- demo numbers ---------- */
function fake(days) {
  let seed = days * 7919; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const now = Date.now(), span = days === 1 ? 2 : Math.min(days * 2, 90), series = [];
  for (let i = span - 1; i >= 0; i--) {
    const base = 120 + 60 * Math.sin(i / 3) + rnd() * 80 + (i % 9 === 2 ? 260 : 0), views = Math.round(base);
    series.push({ day: taipei(new Date(now - i * 864e5)), views, visitors: Math.round(views * 0.62), reads: Math.round(views * 0.18), shares: Math.round(views * 0.03), secs: views * 74, leaves: views });
  }
  const half = days === 1 ? 1 : days, cur = series.slice(-half), prev = series.slice(0, series.length - half);
  const sum = (l) => l.reduce((a, d) => ({ views: a.views + d.views, visitors: a.visitors + d.visitors, reads: a.reads + d.reads, shares: a.shares + d.shares, secs: a.secs + d.secs }), { views: 0, visitors: 0, reads: 0, shares: 0, secs: 0 });
  const totals = sum(cur), slugs = posts.length ? posts.map((p) => p.slug) : ["hello-studio", "realtime-db-rules", "small-tools"];
  const pages = slugs.map((slug, i) => {
    const views = Math.round(totals.views * 0.5 / (i + 1.4)), n = Math.round(views * 0.9);
    return { path: `/blog/${slug}/`, slug, views, visitors: Math.round(views * 0.7), reads: Math.round(views * (0.38 - i * 0.07)), shares: Math.round(views * 0.04), secs: views * (110 - i * 20),
      depth: [n, Math.round(n * 0.86), Math.round(n * 0.64), Math.round(n * (0.5 - i * 0.06)), Math.round(n * (0.4 - i * 0.07))], daily: series.map((d) => [d.day, Math.round(d.views / (i + 2))]) };
  }).concat([["/", 0.22], ["/blog/", 0.14], ["/privacy/", 0.01]].map(([path, f]) => ({ path, slug: "", views: Math.round(totals.views * f), visitors: Math.round(totals.views * f * 0.8), reads: 0, shares: 0, secs: 0, depth: null, daily: [] })));
  const v = (k) => Math.round(totals.views * k);
  return {
    days, generated: new Date().toISOString(), totals, previous: days === 90 ? null : sum(prev), series: days === 1 ? cur : series.slice(-days), pages,
    groups: [["social", 0.34], ["search", 0.24], ["direct", 0.2], ["share", 0.12], ["referral", 0.06], ["internal", 0.04]].map(([name, k]) => ({ name, n: v(k) })),
    sources: [["Facebook", 0.18], ["Google", 0.22], ["direct", 0.2], ["LINE", 0.09], ["Threads", 0.08], ["github.com", 0.03]].map(([name, k]) => ({ name, n: v(k) })),
    shares: [["line", 0.012], ["copy", 0.009], ["fb", 0.006], ["threads", 0.004], ["native", 0.003]].map(([name, k]) => ({ name, n: v(k) })),
    outbound: [["github.com", 0.02], ["stoatalk.app", 0.012], ["mailto", 0.004]].map(([name, k]) => ({ name, n: v(k) })), langSwitch: [],
    readers: {
      country: [["TW", 0.71], ["HK", 0.08], ["US", 0.07], ["JP", 0.05], ["MY", 0.03]].map(([name, k]) => ({ name, n: v(k) })),
      device: [["mobile", 0.68], ["desktop", 0.28], ["tablet", 0.04]].map(([name, k]) => ({ name, n: v(k) })),
      browser: [["safari", 0.38], ["chrome", 0.33], ["line", 0.14], ["facebook", 0.09], ["edge", 0.04]].map(([name, k]) => ({ name, n: v(k) })),
      os: [["ios", 0.52], ["android", 0.2], ["macos", 0.15], ["windows", 0.13]].map(([name, k]) => ({ name, n: v(k) })),
      lang: [["zh", 0.86], ["en", 0.14]].map(([name, k]) => ({ name, n: v(k) })),
      blang: [["zh", 0.82], ["en", 0.15], ["ja", 0.03]].map(([name, k]) => ({ name, n: v(k) })),
      theme: [["light", 0.61], ["dark", 0.39]].map(([name, k]) => ({ name, n: v(k) })),
    },
    vitals: { lcp: 1840, inp: 120, cls: 0.04, n: v(0.7) },
    problems: [{ type: "notfound", x: "", path: "/blog/old-post/", n: 6 }, { type: "error", x: "Cannot read properties of null @post.js:41", path: "/blog/hello-studio/", n: 2 }],
  };
}

onLang(() => draw());
start();

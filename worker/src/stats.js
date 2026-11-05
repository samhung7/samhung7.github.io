/* GET /stats?days=1|7|30|90: the numbers behind /blog/dashboard/, for the owner only (the caller checks the token).
   They are read from Workers Analytics Engine with its SQL API (CF_ACCOUNT_ID + CF_ANALYTICS_TOKEN, a token with
   "Account Analytics: Read"); the data point layout is in src/analytics.js. Analytics Engine keeps about three months,
   which is why 90 days is the longest range. Counts are weighted by _sample_interval, so they stay right if Cloudflare
   ever samples. "Visitors" over more than one day is the sum of each day's visitors: the visitor hash changes daily
   on purpose, so the same reader on two days can't be told apart from two readers. */
import { DATASET } from "./analytics.js";

export const RANGES = [1, 7, 30, 90];
const TZ = "Asia/Taipei";

// the SQL API; rows come back as objects, numbers sometimes as strings
export async function sql(env, query, fetcher = (...a) => fetch(...a)) {
  const res = await fetcher(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/analytics_engine/sql`, {
    method: "POST", headers: { Authorization: "Bearer " + env.CF_ANALYTICS_TOKEN }, body: query });
  if (!res.ok) throw new Error(`analytics sql ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return ((await res.json()).data || []).map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) =>
    [k, typeof v === "string" && v !== "" && /^-?\d+(\.\d+)?(e-?\d+)?$/i.test(v) ? Number(v) : v])));
}

// where a page view came from, in the dashboard's words: a share button, a tagged link, a known site, or the site itself
export function sourceOf(ref, src, med, host) {
  if (src) {
    const share = { line: "LINE", fb: "Facebook", x: "X", threads: "Threads", copy: "copy", native: "native" }[src];
    return share ? { group: "share", name: share } : { group: "campaign", name: src + (med ? " / " + med : "") };
  }
  const r = (ref || "").replace(/^www\./, "");
  if (!r) return { group: "direct", name: "direct" };
  if (r === host || r === "samhungstudio.com" || r === "samhung7.github.io") return { group: "internal", name: "internal" };
  const known = [[/(^|\.)google\./, "search", "Google"], [/(^|\.)bing\.com$/, "search", "Bing"], [/duckduckgo\.com$/, "search", "DuckDuckGo"],
    [/(^|\.)yahoo\./, "search", "Yahoo"], [/(^|\.)facebook\.com$|^fb\.me$/, "social", "Facebook"], [/(^|\.)line\.me$|^line\./, "social", "LINE"],
    [/threads\.(net|com)$/, "social", "Threads"], [/^t\.co$|(^|\.)x\.com$|twitter\.com$/, "social", "X"], [/instagram\.com$/, "social", "Instagram"],
    [/linkedin\.com$|lnkd\.in$/, "social", "LinkedIn"], [/reddit\.com$/, "social", "Reddit"], [/ptt\.cc$/, "social", "PTT"], [/dcard\.tw$/, "social", "Dcard"],
    [/github\.com$/, "referral", "GitHub"]];
  for (const [re, group, name] of known) if (re.test(r)) return { group, name };
  return { group: "referral", name: r };
}

const add = (map, key, n) => map.set(key, (map.get(key) || 0) + n);
const top = (map, k = 12) => [...map].sort((a, b) => b[1] - a[1]).slice(0, k).map(([name, n]) => ({ name, n }));

export async function stats(env, days, now = Date.now(), run = (q) => sql(env, q)) {
  const D = DATASET, cur = `timestamp > NOW() - INTERVAL '${days}' DAY`, two = `timestamp > NOW() - INTERVAL '${Math.min(days * 2, 90)}' DAY`;
  const day = `formatDateTime(timestamp, '%Y-%m-%d', '${TZ}')`;
  const [daily, events, pages, depth, refs, clicks, dims, vitals, problems, postDays] = await Promise.all([
    run(`SELECT ${day} AS day, SUM(_sample_interval) AS views, count(DISTINCT blob6) AS visitors FROM ${D} WHERE blob1 = 'pageview' AND ${two} GROUP BY day ORDER BY day`),
    run(`SELECT ${day} AS day, blob1 AS type, SUM(_sample_interval) AS n, SUM(_sample_interval * double2) AS secs FROM ${D} WHERE blob1 IN ('read', 'share', 'leave') AND ${two} GROUP BY day, type`),
    run(`SELECT blob3 AS path, blob4 AS slug, blob1 AS type, SUM(_sample_interval) AS n, count(DISTINCT blob6) AS v, SUM(_sample_interval * double2) AS secs FROM ${D} WHERE blob1 IN ('pageview', 'read', 'share', 'leave') AND ${cur} GROUP BY path, slug, type`),
    run(`SELECT blob4 AS slug, blob5 AS pv, max(double1) AS d FROM ${D} WHERE blob1 = 'leave' AND blob4 != '' AND ${cur} GROUP BY slug, pv LIMIT 100000`),
    run(`SELECT blob2 AS host, blob7 AS ref, blob8 AS src, blob9 AS med, SUM(_sample_interval) AS n FROM ${D} WHERE blob1 = 'pageview' AND ${cur} GROUP BY host, ref, src, med ORDER BY n DESC LIMIT 2000`),
    run(`SELECT blob1 AS type, blob18 AS x, SUM(_sample_interval) AS n FROM ${D} WHERE blob1 IN ('share', 'out', 'lang') AND ${cur} GROUP BY type, x ORDER BY n DESC LIMIT 500`),
    run(`SELECT blob11 AS country, blob12 AS device, blob13 AS browser, blob14 AS os, blob15 AS lang, blob16 AS blang, blob17 AS theme, SUM(_sample_interval) AS n FROM ${D} WHERE blob1 = 'pageview' AND ${cur} GROUP BY country, device, browser, os, lang, blang, theme LIMIT 10000`),
    run(`SELECT quantileExactWeighted(0.75)(double3, _sample_interval) AS lcp, quantileExactWeighted(0.75)(double4, _sample_interval) AS inp, quantileExactWeighted(0.75)(double5, _sample_interval) AS cls, SUM(_sample_interval) AS n FROM ${D} WHERE blob1 = 'leave' AND double3 > 0 AND ${cur}`),
    run(`SELECT blob1 AS type, blob18 AS x, blob3 AS path, SUM(_sample_interval) AS n FROM ${D} WHERE blob1 IN ('error', 'notfound') AND ${cur} GROUP BY type, x, path ORDER BY n DESC LIMIT 30`),
    run(`SELECT blob4 AS slug, ${day} AS day, SUM(_sample_interval) AS n FROM ${D} WHERE blob1 = 'pageview' AND blob4 != '' AND timestamp > NOW() - INTERVAL '90' DAY GROUP BY slug, day`),
  ]);

  // days: every day of the current and the previous range, oldest first, the zeros filled in
  const dayKey = (ms) => new Date(ms + 8 * 3600e3).toISOString().slice(0, 10);
  const span = days === 1 ? 2 : Math.min(days * 2, 90), series = [];
  for (let i = span - 1; i >= 0; i--) series.push({ day: dayKey(now - i * 864e5), views: 0, visitors: 0, reads: 0, shares: 0, secs: 0, leaves: 0 });
  const byDay = new Map(series.map((d) => [d.day, d]));
  for (const r of daily) { const d = byDay.get(r.day); if (d) { d.views = r.views; d.visitors = r.visitors; } }
  for (const r of events) {
    const d = byDay.get(r.day); if (!d) continue;
    if (r.type === "read") d.reads = r.n; else if (r.type === "share") d.shares = r.n; else { d.secs = r.secs; d.leaves = r.n; }
  }
  const half = days === 1 ? 1 : Math.min(days, series.length);
  const sum = (list) => list.reduce((a, d) => ({ views: a.views + d.views, visitors: a.visitors + d.visitors, reads: a.reads + d.reads,
    shares: a.shares + d.shares, secs: a.secs + d.secs }), { views: 0, visitors: 0, reads: 0, shares: 0, secs: 0 });
  const nowPart = series.slice(-half), before = series.slice(0, series.length - half);
  // a one-day range is the last 24 hours, so its totals come from the per-page query rather than calendar days
  const totals = sum(nowPart);
  if (days === 1) {
    const t = { views: 0, visitors: 0, reads: 0, shares: 0, secs: 0 };
    for (const r of pages) { if (r.type === "pageview") { t.views += r.n; t.visitors += r.v; } else if (r.type === "read") t.reads += r.n; else if (r.type === "share") t.shares += r.n; else t.secs += r.secs; }
    Object.assign(totals, t);
  }

  // per page
  const P = new Map();
  for (const r of pages) {
    const p = P.get(r.path) || P.set(r.path, { path: r.path, slug: r.slug, views: 0, visitors: 0, reads: 0, shares: 0, secs: 0 }).get(r.path);
    if (r.type === "pageview") { p.views += r.n; p.visitors += r.v; } else if (r.type === "read") p.reads += r.n;
    else if (r.type === "share") p.shares += r.n; else p.secs += r.secs;
  }
  const funnel = new Map();
  for (const r of depth) {
    const f = funnel.get(r.slug) || funnel.set(r.slug, [0, 0, 0, 0, 0]).get(r.slug);
    f[0]++; if (r.d >= 25) f[1]++; if (r.d >= 50) f[2]++; if (r.d >= 75) f[3]++; if (r.d >= 100) f[4]++;
  }
  const after = new Map(); // views per post per day, to count the first 7 days after publishing on the page
  for (const r of postDays) (after.get(r.slug) || after.set(r.slug, []).get(r.slug)).push([r.day, r.n]);

  const sources = new Map(), groups = new Map();
  for (const r of refs) { const s = sourceOf(r.ref, r.src, r.med, r.host); add(sources, s.group + "|" + s.name, r.n); add(groups, s.group, r.n); }
  const shares = new Map(), outs = new Map(), langs = new Map();
  for (const r of clicks) add(r.type === "share" ? shares : r.type === "out" ? outs : langs, r.x || "?", r.n);
  const dim = { country: new Map(), device: new Map(), browser: new Map(), os: new Map(), lang: new Map(), blang: new Map(), theme: new Map() };
  for (const r of dims) for (const k of Object.keys(dim)) add(dim[k], r[k] || "?", r.n);

  return {
    days, generated: new Date(now).toISOString(),
    totals, previous: days === 90 ? null : sum(before),
    series: days === 1 ? nowPart : series.slice(-Math.min(days, 90)),
    pages: [...P.values()].sort((a, b) => b.views - a.views).slice(0, 100)
      .map((p) => ({ ...p, depth: funnel.get(p.slug) || null, daily: after.get(p.slug) || [] })),
    sources: top(sources, 20).map(({ name, n }) => ({ group: name.split("|")[0], name: name.split("|")[1], n })),
    groups: top(groups, 10),
    shares: top(shares), outbound: top(outs), langSwitch: top(langs),
    readers: Object.fromEntries(Object.entries(dim).map(([k, m]) => [k, top(m, 10)])),
    vitals: vitals[0] && vitals[0].n ? vitals[0] : null,
    problems,
  };
}

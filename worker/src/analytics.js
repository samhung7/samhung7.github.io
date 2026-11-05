/* POST /e: the site's visitor statistics (js/blog/analytics.js sends them; docs/analytics.md has the whole picture).
   Each event becomes one data point in Workers Analytics Engine (binding EVENTS), which keeps it about three months.
   Nothing that names a person is kept: no IP address, no full browser string, no cookie. The one way to tell two page
   views apart from two people is `visitor`, a hash of the day (Taiwan time), a secret, the IP address, the browser
   string and the site: the same reader on the same day gives the same hash, the next day a different one, and without
   the secret it can't be worked back to an address. Crawlers, other sites and anything malformed are dropped quietly;
   the answer is always 204, so a page never learns more than "sent".

   Data point layout (the dashboard's queries read it by position):
     index1   the post's slug, or the path for any other page
     blob1 type        pageview | read | leave | share | out | lang | error | notfound
     blob2 host        samhungstudio.com | samhung7.github.io
     blob3 path        blob4 slug        blob5 pv (one page view)      blob6 visitor (see above)
     blob7 referrer    the referring site's name only
     blob8 source      utm_source or ?ref= (line, fb, x, threads, copy, native for the share buttons)
     blob9 medium      blob10 campaign
     blob11 country    two letters, from Cloudflare
     blob12 device     mobile | tablet | desktop        blob13 browser   blob14 os
     blob15 ui language (zh | en)   blob16 browser language   blob17 theme (light | dark)
     blob18 detail     share: the button; out: the other site; lang: the language switched to; error: the message
     double1 depth (%)   double2 seconds in front   double3 LCP (ms)   double4 INP (ms)   double5 CLS */

export const DATASET = "samhung_site_events"; // as in wrangler.toml
const TYPES = new Set(["pageview", "read", "leave", "share", "out", "lang", "error", "notfound"]);
const BOT = /bot|crawl|spider|slurp|scrape|headless|phantom|lighthouse|pagespeed|preview|facebookexternalhit|embedly|curl|wget|python|httpclient|okhttp|go-http|java\/|axios|node-fetch|monitor|uptime/i;
const MAX_BODY = 8 * 1024, MAX_EVENTS = 10;

// a short, printable string: control characters out, cut to n
const str = (v, n) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, n) : "");
const word = (v, n = 24) => str(v, n).toLowerCase().replace(/[^a-z0-9._-]/g, "");
const num = (v, max) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.min(v, max) : 0);
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

export const taiwanDay = (ms = Date.now()) => new Date(ms + 8 * 3600e3).toISOString().slice(0, 10);

export async function visitorId({ secret, day, ip, ua, host }) {
  const data = new TextEncoder().encode([secret, day, ip, ua, host].join("|"));
  return hex(await crypto.subtle.digest("SHA-256", data)).slice(0, 16);
}

// the data points for one request, or [] to drop it
export async function points(req, env, now = Date.now()) {
  const origin = req.headers.get("Origin") || "";
  const allowed = (env.ORIGINS || "").split(",").map((o) => o.trim()).filter(Boolean);
  if (!allowed.includes(origin)) return [];
  const ua = req.headers.get("User-Agent") || "";
  if (!ua || BOT.test(ua)) return [];
  if (+req.headers.get("Content-Length") > MAX_BODY) return [];
  const text = await req.text();
  if (!text || text.length > MAX_BODY) return [];
  let b;
  try { b = JSON.parse(text); } catch (e) { return []; }
  if (!b || typeof b !== "object" || !Array.isArray(b.e)) return [];
  const path = str(b.p, 200);
  if (!path.startsWith("/")) return [];
  const host = new URL(origin).hostname;
  const slug = /^[a-z0-9][a-z0-9-]{0,79}$/.test(b.s) ? b.s : "";
  const visitor = await visitorId({ secret: env.ANALYTICS_SECRET || env.DISPATCH_TOKEN || "", day: taiwanDay(now),
    ip: req.headers.get("CF-Connecting-IP") || "", ua, host });
  const country = word(req.cf && req.cf.country, 2).toUpperCase();
  const common = [host, path, slug, word(b.pv, 16), visitor, word(b.r, 100), str(b.us, 60).toLowerCase(), str(b.um, 60).toLowerCase(),
    str(b.uc, 100), country, word(b.dv, 10), word(b.br, 16), word(b.os, 16), word(b.lang, 5), word(b.bl, 5), word(b.th, 8)];
  const out = [];
  for (const e of b.e.slice(0, MAX_EVENTS)) {
    if (!e || !TYPES.has(e.t)) continue;
    out.push({
      indexes: [(slug || path).slice(0, 96)],
      blobs: [e.t, ...common, str(e.x, 120)],
      doubles: [num(e.dp, 100), num(e.sec, 4 * 3600), num(e.lcp, 60e3), num(e.inp, 60e3), num(e.cls, 10)],
    });
  }
  return out;
}

export async function collect(req, env, cors = {}) {
  try {
    if (env.EVENTS) for (const p of await points(req, env)) env.EVENTS.writeDataPoint(p);
  } catch (e) { console.error("analytics: " + (e && e.message)); }
  return new Response(null, { status: 204, headers: cors });
}

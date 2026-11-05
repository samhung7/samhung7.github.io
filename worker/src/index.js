/* The blog's picture service: a Cloudflare Worker at blog-api.samhungstudio.com in front of the R2 bucket
   samhung-blog, which is public at img.samhungstudio.com. Only the owner (OWNER_UID, the same id as in firestore.rules)
   may upload. A picture is a JPEG the editor has already shrunk, named by its own SHA-256 (the first 22 base64url
   characters), so the same picture is stored once and a name never changes what it points to.
   PUT /img/<hash>.jpg   body: the JPEG, Authorization: Bearer <Firebase ID token>   → 201 (or 200 when it was there)
   POST /rebuild         the editor, right after publishing: asks GitHub to run .github/workflows/blog.yml now, so the
                         post's static page (link previews) is up within a minute or two instead of waiting for a schedule.
   The cron does the same every 15 minutes, which also brings scheduled posts' pages up soon after their time
   (GitHub's own schedule runs late or not at all). Both need the DISPATCH_TOKEN secret.
   POST /e               the site's visitor statistics, from any page (src/analytics.js); always 204.
   GET /stats?days=7     those statistics added up for /blog/dashboard/ (src/stats.js); owner only, like PUT /img. */
import { verifier } from "./token.js";
import { collect } from "./analytics.js";
import { stats, RANGES } from "./stats.js";

const MAX = 3 * 1024 * 1024;
const NAME = /^([A-Za-z0-9_-]{22})\.jpg$/;
const CACHE = "public, max-age=31536000, immutable";
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

// ask GitHub to run the blog's page build now; false without the token or when GitHub says no
export async function dispatch(env, fetcher = (...a) => fetch(...a)) {
  if (!env.DISPATCH_TOKEN || !env.GITHUB_REPO) return false;
  const res = await fetcher(`https://api.github.com/repos/${env.GITHUB_REPO}/actions/workflows/blog.yml/dispatches`, { method: "POST",
    headers: { Authorization: "Bearer " + env.DISPATCH_TOKEN, Accept: "application/vnd.github+json", "Content-Type": "application/json", "User-Agent": "samhung-blog-images" },
    body: JSON.stringify({ ref: "main" }) });
  if (!res.ok) console.error("blog dispatch: " + res.status);
  return res.ok;
}

export function makeHandler({ verify, fetcher = (...a) => fetch(...a), getStats = stats }) {
  return async (req, env) => {
    const origin = req.headers.get("Origin");
    const ok = !!origin && (env.ORIGINS || "").split(",").map((o) => o.trim()).includes(origin);
    const cors = ok ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {};
    const out = (status) => new Response(null, { status, headers: cors });
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...cors,
      "Access-Control-Allow-Methods": "GET, PUT, POST", "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Max-Age": "86400" } });
    const parts = new URL(req.url).pathname.split("/").filter(Boolean);
    if (req.method === "POST" && parts.length === 1 && parts[0] === "e") return collect(req, env, cors);
    if (req.method === "GET" && parts.length === 1 && parts[0] === "stats") {
      const uid = await verify((req.headers.get("Authorization") || "").replace(/^Bearer /, ""), env);
      if (!uid) return out(401);
      if (!env.OWNER_UID || uid !== env.OWNER_UID) return out(403);
      const json = (status, body) => new Response(JSON.stringify(body), { status,
        headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "private, no-store" } });
      if (!env.CF_ACCOUNT_ID || !env.CF_ANALYTICS_TOKEN) return json(503, { error: "not-configured" });
      const days = +new URL(req.url).searchParams.get("days") || 7;
      if (!RANGES.includes(days)) return out(400);
      try { return json(200, await getStats(env, days)); }
      catch (e) { console.error(e); return json(502, { error: "query", detail: String(e.message || e).slice(0, 300) }); }
    }
    if (req.method === "POST" && parts.length === 1 && parts[0] === "rebuild") {
      const uid = await verify((req.headers.get("Authorization") || "").replace(/^Bearer /, ""), env);
      if (!uid) return out(401);
      if (!env.OWNER_UID || uid !== env.OWNER_UID) return out(403);
      return out((await dispatch(env, fetcher)) ? 202 : 503);
    }
    if (req.method !== "PUT" || parts.length !== 2 || parts[0] !== "img") return out(404);
    const m = NAME.exec(parts[1]);
    if (!m) return out(400);
    const uid = await verify((req.headers.get("Authorization") || "").replace(/^Bearer /, ""), env);
    if (!uid) return out(401);
    if (!env.OWNER_UID || uid !== env.OWNER_UID) return out(403);
    if (+req.headers.get("Content-Length") > MAX) return out(413);
    const body = new Uint8Array(await req.arrayBuffer());
    if (!body.length || body.length > MAX) return out(413);
    if (!(body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff)) return out(415); // only a JPEG is served as one
    if (b64u(await crypto.subtle.digest("SHA-256", body)).slice(0, 22) !== m[1]) return out(400);
    const key = "img/" + parts[1];
    if (await env.IMAGES.head(key)) return out(200);
    await env.IMAGES.put(key, body, { httpMetadata: { contentType: "image/jpeg", cacheControl: CACHE } });
    return out(201);
  };
}

export default { fetch: makeHandler({ verify: verifier() }), scheduled: (event, env) => dispatch(env) };

/* The site's own visitor statistics (docs/analytics.md, privacy/). A plain script, not a module, loaded with `defer`
   on every public page. No cookies and nothing that names a person: it sends what was read and how, never who.
   Everything goes to the Worker's POST /e (worker/src/analytics.js), which keeps it in Cloudflare Analytics Engine.
     pageview  on load: where the reader came from (the referring site's name only, utm_* and ?ref=), the page's
               language, theme, device class, browser and system family
     read      once, when the end of a post's text has been on screen and the page has been in front for at least
               half the post's reading time
     leave     each time the page goes to the background: the furthest point scrolled to (%), the seconds the page was
               in front since the last one, and once, Core Web Vitals (LCP, INP, CLS)
     share     a share button (data-share), out: a link to another site, lang: the 中/EN toggle, error: a script error
     notfound  pages say so through window.ssq.push(["notfound"]) (404.html via post.js)
   Off with Do Not Track or Global Privacy Control, on any address but the site's own, and in a browser where the owner
   signed in to the editor (localStorage "ss-no-track"; ?notrack sets it on any page, ?notrack=0 clears it). */
(function () {
  var END = "https://blog-api.samhungstudio.com/e";
  var HOSTS = ["samhungstudio.com", "www.samhungstudio.com", "samhung7.github.io"];
  var w = window, d = document, n = navigator, loc = location, de = d.documentElement;
  var q = (w.ssq = w.ssq || []);
  function store(k, v) {
    try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {}
    return null;
  }
  var qs = new URLSearchParams(loc.search);
  if (qs.has("notrack")) store("ss-no-track", qs.get("notrack") === "0" ? null : "1");
  var off = HOSTS.indexOf(loc.hostname) < 0 || n.doNotTrack === "1" || w.doNotTrack === "1" || n.globalPrivacyControl === true ||
    n.webdriver || store("ss-no-track") === "1";

  // what came with the address: counted once, then taken off it, so a link copied from the address bar starts clean
  var ref = "", src = qs.get("utm_source") || qs.get("ref") || "", med = qs.get("utm_medium") || "", camp = qs.get("utm_campaign") || "";
  try { if (d.referrer) ref = new URL(d.referrer).hostname; } catch (e) {}
  var drop = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "ref", "notrack"].filter(function (k) { return qs.has(k); });
  if (drop.length && history.replaceState) {
    drop.forEach(function (k) { qs.delete(k); });
    var rest = qs.toString();
    try { history.replaceState(history.state, "", loc.pathname + (rest ? "?" + rest : "") + loc.hash); } catch (e) {}
  }
  if (off) { w.ssq = { push: function () {} }; return; }

  var ua = n.userAgent || "";
  var pick = function (list) { for (var i = 0; i < list.length; i += 2) if (list[i].test(ua)) return list[i + 1]; return "other"; };
  var browser = pick([/\bLine\//, "line", /FBAN|FBAV|FB_IAB/, "facebook", /Instagram/, "instagram", /Barcelona/, "threads",
    /Edg(A|iOS)?\//, "edge", /SamsungBrowser/, "samsung", /OPR\/|Opera/, "opera", /Firefox|FxiOS/, "firefox",
    /CriOS|Chrome\//, "chrome", /Safari\//, "safari"]);
  var os = pick([/iPhone|iPad|iPod/, "ios", /Android/, "android", /Mac OS X|Macintosh/, "macos", /Windows/, "windows", /CrOS/, "chromeos", /Linux/, "linux"]);
  var sw = Math.min(screen.width || 0, screen.height || 0) || w.innerWidth;
  var touch = w.matchMedia && matchMedia("(pointer: coarse)").matches;
  var device = sw < 600 ? "mobile" : touch && sw < 1100 ? "tablet" : "desktop";
  if (os === "macos" && touch && n.maxTouchPoints > 1) { os = "ios"; device = "tablet"; } // an iPad that says it is a Mac
  var uiLang = function () { return de.getAttribute("lang") === "en" ? "en" : "zh"; };

  var path = loc.pathname, slug = (/^\/blog\/([a-z0-9][a-z0-9-]{0,79})\/?$/.exec(path) || [])[1] || "";
  if (slug === "editor") return;
  var pv = Math.random().toString(36).slice(2, 12); // ties this page view's events together; a new one every load

  function send(events) {
    var body = JSON.stringify({ pv: pv, p: path, s: slug, r: ref, us: src, um: med, uc: camp, lang: uiLang(),
      bl: (n.language || "").slice(0, 2).toLowerCase(), th: de.getAttribute("data-theme") || "", dv: device, br: browser, os: os, e: events });
    try { if (n.sendBeacon && n.sendBeacon(END, new Blob([body], { type: "text/plain" }))) return; } catch (e) {}
    try { fetch(END, { method: "POST", body: body, keepalive: true, mode: "no-cors", headers: { "Content-Type": "text/plain" } }).catch(function () {}); } catch (e) {}
  }
  function track(t, x) { var ev = { t: t }; if (x != null) ev.x = String(x).slice(0, 120); send([ev]); }

  // seconds in front: counted only while the tab is visible
  var shown = d.visibilityState === "visible" ? Date.now() : 0, front = 0, sentFront = 0;
  var seconds = function () { return front + (shown ? Date.now() - shown : 0); };

  // how far down: the post's text on a post, the whole page elsewhere
  var depth = 0, read = false;
  function words(el) {
    var s = el.textContent || "", cjk = (s.match(/[㐀-鿿豈-﫿]/g) || []).length;
    var latin = (s.replace(/[㐀-鿿豈-﫿]/g, " ").match(/[A-Za-z0-9]+/g) || []).length;
    return cjk / 400 + latin / 220; // minutes, the same pace a reader of each script keeps
  }
  function measure() {
    var body = slug && d.querySelector(".post-body"), vh = w.innerHeight, pct;
    if (body) {
      var r = body.getBoundingClientRect();
      pct = r.height > 0 ? ((vh - r.top) / r.height) * 100 : 0;
    } else {
      var h = Math.max(de.scrollHeight, d.body ? d.body.scrollHeight : 0);
      pct = h > 0 ? ((w.scrollY + vh) / h) * 100 : 100;
    }
    pct = Math.max(0, Math.min(100, Math.round(pct)));
    if (pct > depth) depth = pct;
    if (body && !read && depth >= 100 && seconds() >= Math.max(10, words(body) * 60 * 0.5) * 1000) { read = true; track("read"); }
  }
  var ticking = false;
  var onScroll = function () { if (!ticking) { ticking = true; requestAnimationFrame(function () { ticking = false; measure(); }); } };
  w.addEventListener("scroll", onScroll, { passive: true });
  w.addEventListener("resize", onScroll, { passive: true });
  var poll = setInterval(measure, 5000); // a short post can be read without scrolling at all
  setTimeout(function () { clearInterval(poll); }, 30 * 60e3);

  // Core Web Vitals, measured here instead of with a library: LCP, the slowest interaction (≈ INP), CLS by session window
  var lcp = 0, inp = 0, cls = 0, sv = 0, sf = 0, sl = 0, vitalsSent = false;
  function observe(type, fn, opt) {
    try { new PerformanceObserver(function (l) { l.getEntries().forEach(fn); }).observe(Object.assign({ type: type, buffered: true }, opt || {})); } catch (e) {}
  }
  observe("largest-contentful-paint", function (e) { lcp = e.startTime; });
  observe("event", function (e) { if (e.interactionId && e.duration > inp) inp = e.duration; }, { durationThreshold: 40 });
  observe("layout-shift", function (e) {
    if (e.hadRecentInput) return;
    if (sv && e.startTime - sl < 1000 && e.startTime - sf < 5000) { sv += e.value; sl = e.startTime; } else { sv = e.value; sf = sl = e.startTime; }
    if (sv > cls) cls = sv;
  });

  function leave() {
    measure();
    var now = seconds(), ev = { t: "leave", dp: depth, sec: Math.round((now - sentFront) / 1000) };
    sentFront = now;
    if (!vitalsSent) { vitalsSent = true; ev.lcp = Math.round(lcp); ev.inp = Math.round(inp); ev.cls = Math.round(cls * 1000) / 1000; }
    send([ev]);
  }
  d.addEventListener("visibilitychange", function () {
    if (d.visibilityState === "hidden") { if (shown) { front += Date.now() - shown; shown = 0; } leave(); }
    else if (!shown) shown = Date.now();
  });

  // clicks: share buttons, links to other sites, the language toggle
  d.addEventListener("click", function (e) {
    var el = e.target && e.target.closest ? e.target.closest("[data-share], a[href], #lang-toggle") : null;
    if (!el) return;
    if (el.hasAttribute("data-share")) return track("share", el.getAttribute("data-share"));
    if (el.id === "lang-toggle") return setTimeout(function () { track("lang", uiLang()); }, 0);
    var a;
    try { a = new URL(el.getAttribute("href"), loc.href); } catch (x) { return; }
    if (a.protocol === "mailto:") return track("out", "mailto");
    if (/^https?:$/.test(a.protocol) && HOSTS.indexOf(a.hostname) < 0) track("out", a.hostname);
  }, true);

  var errors = 0;
  w.addEventListener("error", function (e) {
    if (errors++ >= 3 || !e.message) return;
    track("error", e.message.slice(0, 90) + (e.filename ? " @" + e.filename.split("/").pop().split("?")[0] + ":" + e.lineno : ""));
  });
  w.addEventListener("unhandledrejection", function (e) {
    if (errors++ >= 3) return;
    var r = e.reason; track("error", "promise: " + String((r && r.message) || r).slice(0, 90));
  });

  w.ssTrack = track;
  w.ssq = { push: function (a) { if (a && a[0] === "notfound") track("notfound"); } };
  q.forEach(function (a) { w.ssq.push(a); });
  send([{ t: "pageview" }]);
  measure();
})();

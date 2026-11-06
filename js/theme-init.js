// Apply saved theme/language before first paint to avoid a flash
(function () {
  var d = document.documentElement, t = null, l = null, v = null;
  try { t = localStorage.getItem('theme'); l = localStorage.getItem('lang'); v = localStorage.getItem('homeView'); } catch (e) {}
  if (!t) t = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  if (!l) l = /^zh/i.test(navigator.language || '') ? 'zh' : 'en';
  d.setAttribute('data-theme', t);
  d.setAttribute('lang', l === 'en' ? 'en' : 'zh-TW');
  d.setAttribute('data-home-view', v === 'list' ? 'list' : 'cards'); // home page's Works and Journal (js/main.js)
})();

// The header is sticky on every page but the post editor's writing view (css/style.css). Once the page scrolls, mark it .stuck so it slims down
// with a hairline under it; the gap between the two thresholds keeps it from flickering at the edge.
document.addEventListener('DOMContentLoaded', function () {
  var nav = document.querySelector('.wrap > nav'), on = false;
  if (!nav) return;
  function check() {
    var y = window.scrollY;
    if (!on && y > 24) on = true; else if (on && y < 4) on = false; else return;
    nav.classList.toggle('stuck', on);
  }
  window.addEventListener('scroll', check, { passive: true });
  check();

  // A click on the nav's own empty space (between the logo and Blog), not on a link or button, glides back to the top.
  nav.addEventListener('click', function (e) {
    if (e.target === nav) window.scrollTo({ top: 0, behavior: 'smooth' });
  });
});

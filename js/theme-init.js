// Apply saved theme/language before first paint to avoid a flash
(function () {
  var d = document.documentElement, t = null, l = null;
  try { t = localStorage.getItem('theme'); l = localStorage.getItem('lang'); } catch (e) {}
  if (!t) t = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  if (!l) l = /^zh/i.test(navigator.language || '') ? 'zh' : 'en';
  d.setAttribute('data-theme', t);
  d.setAttribute('lang', l === 'en' ? 'en' : 'zh-TW');
})();

// The header is sticky on every page but the editor and dashboard (css/style.css). Once the page scrolls, mark it .stuck so it slims down
// with a hairline under it; the gap between the two thresholds keeps it from flickering at the edge.
document.addEventListener('DOMContentLoaded', function () {
  var nav = document.querySelector('.wrap > nav'), on = false;
  if (!nav || document.body.classList.contains('editor-page')) return;
  function check() {
    var y = window.scrollY;
    if (!on && y > 24) on = true; else if (on && y < 4) on = false; else return;
    nav.classList.toggle('stuck', on);
  }
  window.addEventListener('scroll', check, { passive: true });
  check();
});

// Apply saved theme/language before first paint to avoid a flash
(function () {
  var d = document.documentElement, t = null, l = null;
  try { t = localStorage.getItem('theme'); l = localStorage.getItem('lang'); } catch (e) {}
  if (!t) t = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  if (!l) l = /^zh/i.test(navigator.language || '') ? 'zh' : 'en';
  d.setAttribute('data-theme', t);
  d.setAttribute('lang', l === 'en' ? 'en' : 'zh-TW');
})();

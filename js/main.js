(function () {
  var d = document.documentElement;

  // The tagline is one of these quotes: a new one each day, the same for everyone on that date, in turn.
  var quotes = [
    { zh: '少，但更好。', en: 'Less, but better.',
      zhBy: 'Dieter Rams，《Less but Better》，1995', enBy: 'Dieter Rams, Less but Better, 1995' },
    { zh: '設計不只是外觀與感受，而是它如何運作。', en: 'Design is not just what it looks like and feels like. Design is how it works.',
      zhBy: 'Steve Jobs，《紐約時報雜誌》訪談，2003', enBy: 'Steve Jobs, The New York Times Magazine, 2003' },
    { zh: '細節不只是細節，細節成就設計。', en: 'The details are not the details. They make the design.',
      zhBy: 'Charles Eames', enBy: 'Charles Eames' },
    { zh: '少即是多。', en: 'Less is more.',
      zhBy: 'Ludwig Mies van der Rohe', enBy: 'Ludwig Mies van der Rohe' },
    { zh: '真正的創作者會把作品交出去。', en: 'Real artists ship.',
      zhBy: 'Steve Jobs，1983', enBy: 'Steve Jobs, 1983' }
  ];
  var now = new Date();
  var day = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000);
  var quote = quotes[day % quotes.length];

  var strings = {
    zh: {
      title: 'Samhung Studio',
      description: 'Samhung Studio：Sam Hung 的個人工作室，收錄各項專案作品。',
      tagline: quote.zh,
      quoteBy: '— ' + quote.zhBy,
      projects: 'Selected Works',
      snake: '雙人貪食蛇對戰遊戲，支援 1P vs 2P、1P vs AI、AI vs AI。支援五種語言，可加入主畫面。',
      scoreboard: '比賽記分板：籃球、羽球、排球、網球、匹克球、桌球。計時、發球權、換場自動處理，內建 DJ 音效與 Spotify，支援五種語言。',
      stoa: '免註冊匿名討論，用代碼或連結加入。公開議廊與端對端加密的私人沙龍，內建競答、投票、便利貼，支援九種語言。',
      blog: 'Blog',
      journal: 'Journal',
      allPosts: '所有文章 →',
      privacy: '隱私權',
      langBtn: 'EN',
      viewList: '列表顯示',
      viewCards: '卡片顯示'
    },
    en: {
      title: 'Samhung Studio',
      description: 'Samhung Studio: the personal studio of Sam Hung, a collection of projects.',
      tagline: quote.en,
      quoteBy: '— ' + quote.enBy,
      projects: 'Selected Works',
      snake: 'A two-player snake battle game: 1P vs 2P, 1P vs AI, or AI vs AI. Available in five languages and installable to your home screen.',
      scoreboard: 'A scoreboard for basketball, badminton, volleyball, tennis, pickleball and table tennis. Handles timing, serve and side changes automatically, with built-in DJ sounds and Spotify. Available in five languages.',
      stoa: 'Anonymous discussion with no sign-up: join with a code or link. Public halls and end-to-end encrypted private salons, with quizzes, polls and sticky notes. Available in nine languages.',
      blog: 'Blog',
      journal: 'Journal',
      allPosts: 'All posts →',
      privacy: 'Privacy',
      langBtn: '中',
      viewList: 'List view',
      viewCards: 'Card view'
    }
  };

  function save(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  function setLang(lang) {
    var t = strings[lang];
    d.setAttribute('lang', lang === 'en' ? 'en' : 'zh-TW');
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t[el.getAttribute('data-i18n')];
    });
    document.querySelectorAll('[data-i18n-label]').forEach(function (el) {
      el.setAttribute('aria-label', t[el.getAttribute('data-i18n-label')]);
      el.title = t[el.getAttribute('data-i18n-label')];
    });
    document.querySelector('meta[name="description"]').setAttribute('content', t.description);
    document.getElementById('lang-toggle').textContent = t.langBtn;
    document.dispatchEvent(new CustomEvent('langchange'));
  }

  var lang = d.getAttribute('lang') === 'en' ? 'en' : 'zh';
  setLang(lang);

  document.getElementById('lang-toggle').addEventListener('click', function () {
    lang = lang === 'en' ? 'zh' : 'en';
    setLang(lang);
    save('lang', lang);
  });

  // Works and Journal: cards (the default) or list, one choice for both, remembered on this device.
  // theme-init.js puts it on <html> before the first paint.
  function paintView() {
    var v = d.getAttribute('data-home-view') === 'list' ? 'list' : 'cards';
    document.querySelectorAll('.view-btn').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-view') === v));
    });
  }
  document.querySelectorAll('.view-switch').forEach(function (sw) {
    sw.addEventListener('click', function (e) {
      var b = e.target.closest('[data-view]');
      if (!b) return;
      d.setAttribute('data-home-view', b.getAttribute('data-view'));
      save('homeView', b.getAttribute('data-view'));
      paintView();
    });
  });
  paintView();

  document.getElementById('theme-toggle').addEventListener('click', function () {
    var next = d.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    d.setAttribute('data-theme', next);
    save('theme', next);
  });
})();

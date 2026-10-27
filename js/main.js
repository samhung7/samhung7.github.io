(function () {
  var d = document.documentElement;
  var strings = {
    zh: {
      title: 'Samhung Studio',
      description: 'Samhung Studio：Sam Hung 的個人工作室，收錄各項專案作品。',
      tagline: '小而好用的工具與遊戲，從瀏覽器開始。',
      projects: 'Selected Works',
      snake: '雙人貪食蛇對戰遊戲，支援 1P vs 2P、1P vs AI、AI vs AI。支援五種語言，可加入主畫面。',
      scoreboard: '比賽記分板：籃球、羽球、排球、網球、匹克球、桌球。計時、發球權、換場自動處理，內建 DJ 音效與 Spotify，支援五種語言。',
      stoa: '免註冊匿名討論，用代碼或連結加入。公開議廊與端對端加密的私人沙龍，內建競答、投票、便利貼，支援九種語言。',
      langBtn: 'EN'
    },
    en: {
      title: 'Samhung Studio',
      description: 'Samhung Studio: the personal studio of Sam Hung, a collection of projects.',
      tagline: 'Small, useful tools and games, right in your browser.',
      projects: 'Selected Works',
      snake: 'A two-player snake battle game: 1P vs 2P, 1P vs AI, or AI vs AI. Available in five languages and installable to your home screen.',
      scoreboard: 'A scoreboard for basketball, badminton, volleyball, tennis, pickleball and table tennis. Handles timing, serve and side changes automatically, with built-in DJ sounds and Spotify. Available in five languages.',
      stoa: 'Anonymous discussion with no sign-up: join with a code or link. Public halls and end-to-end encrypted private salons, with quizzes, polls and sticky notes. Available in nine languages.',
      langBtn: '中'
    }
  };

  function save(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  function setLang(lang) {
    var t = strings[lang];
    d.setAttribute('lang', lang === 'en' ? 'en' : 'zh-TW');
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t[el.getAttribute('data-i18n')];
    });
    document.querySelector('meta[name="description"]').setAttribute('content', t.description);
    document.getElementById('lang-toggle').textContent = t.langBtn;
  }

  var lang = d.getAttribute('lang') === 'en' ? 'en' : 'zh';
  setLang(lang);

  document.getElementById('lang-toggle').addEventListener('click', function () {
    lang = lang === 'en' ? 'zh' : 'en';
    setLang(lang);
    save('lang', lang);
  });

  document.getElementById('theme-toggle').addEventListener('click', function () {
    var next = d.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    d.setAttribute('data-theme', next);
    save('theme', next);
  });
})();

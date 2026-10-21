'use strict';

// The launch card (splash.css): drawn before anything else loads, in the theme and language the
// app was left in (applyTheme / setLang keep a copy in localStorage, since the notes arrive later).
// "365" rolls in digit by digit like a clock, "Articles" comes out of a blur letter by letter, a
// hairline draws under it and a greeting appears. When the app has booted (and the card has
// played), everything melts through a blur where it stands and the library is there underneath.
const Splash = (() => {
  const html = document.documentElement;
  const read = (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  };
  const theme = read('a365.theme');
  html.dataset.theme = theme === 'dark' || theme === 'light' ? theme : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

  const inFrame = window !== window.top;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MIN = still ? 300 : 3000; // the whole card plays once, even when the app is ready sooner
  const t0 = performance.now();
  let el = null;
  let done = false;

  const GREET = {
    uz: ['Xayrli tun', 'Xayrli tong', 'Xayrli kun', 'Xayrli kech'],
    en: ['Good night', 'Good morning', 'Good afternoon', 'Good evening'],
    ru: ['Доброй ночи', 'Доброе утро', 'Добрый день', 'Добрый вечер'],
  };
  const SUB = { uz: "Bugun ham bir maqola", en: 'One article a day', ru: 'Сегодня тоже одна статья' };
  function greeting(lang) {
    const h = new Date().getHours();
    const g = GREET[lang] || GREET.uz;
    return `${g[h < 5 ? 0 : h < 12 ? 1 : h < 17 ? 2 : h < 22 ? 3 : 0]} · ${SUB[lang] || SUB.uz}`;
  }

  // a digit's column: it travels up through the numbers before it and stops on its own
  const column = (d, from) => {
    const seq = [];
    for (let n = from; n !== d; n = (n + 1) % 10) seq.push(n);
    seq.push(d);
    return `<span class="sp-d" style="--n:${seq.length - 1}"><span>${seq.map((n) => `<i>${n}</i>`).join('')}</span></span>`;
  };

  function mount() {
    if (inFrame) return;
    const lang = read('a365.lang') || 'uz';
    el = document.createElement('div');
    el.id = 'splash';
    el.setAttribute('aria-hidden', 'true');
    el.className = still ? 'still' : '';
    el.innerHTML = `<div class="sp-mark">
        <div class="sp-num">${column(3, 7)}${column(6, 9)}${column(5, 8)}</div>
        <div class="sp-word">${[...'Articles'].map((c, i) => `<span style="--i:${i}">${c}</span>`).join('')}</div>
        <i class="sp-line"></i>
        <div class="sp-sub">${greeting(lang)}</div>
      </div>`;
    document.body.prepend(el);
  }

  // the app has booted: leave once the card has played
  function ready() {
    if (done || !el) return;
    done = true;
    const wait = Math.max(0, MIN - (performance.now() - t0));
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 900);
    }, wait);
  }

  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount, { once: true });
  // never in the way for long, whatever happens to the boot
  setTimeout(ready, 7000);
  return { ready };
})();

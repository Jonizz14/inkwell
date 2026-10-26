'use strict';

// The launch card (splash.css): drawn before anything else loads, in the theme and language the
// app was left in (applyTheme / setLang keep a copy in localStorage, since the notes arrive later).
// The mark grows into the name, where the name will stand: the round dot of the "i" appears, its
// stem rises under it (the app's icon), then "nkwell" comes out of a blur letter by letter beside
// it; with a name set in Settings a greeting follows underneath. Nothing slides across.
// When the app has booted it melts away through a blur where it stands.
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

  const name = (read('a365.name') || '').trim();
  const inFrame = window !== window.top;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MIN = still ? 300 : 5200; // the name comes in, Inky ticks off its board (inky.js) and the three jobs below are ticked, even when the app is ready sooner
  const t0 = performance.now();
  const GREET = {
    uz: ['Xayrli tun', 'Xayrli tong', 'Xayrli kun', 'Xayrli kech'],
    en: ['Good night', 'Good morning', 'Good afternoon', 'Good evening'],
    ru: ['Доброй ночи', 'Доброе утро', 'Добрый день', 'Добрый вечер'],
  };
  const greeting = () => {
    const h = new Date().getHours();
    const g = GREET[read('a365.lang')] || GREET.uz;
    return `${g[h < 5 ? 0 : h < 12 ? 1 : h < 17 ? 2 : h < 22 ? 3 : 0]}, ${name}`;
  };
  // what the app gets ready underneath (app.js warm): one line each, ticked when it has come in
  const JOBS = [['a', { uz: 'Maqolalar', en: 'Articles', ru: 'Статьи' }[read('a365.lang')] || 'Maqolalar'], ['l', 'Listening'], ['g', 'The Guardian']];
  let el = null;
  let done = false;

  function mount() {
    if (inFrame) return;
    el = document.createElement('div');
    el.id = 'splash';
    el.setAttribute('aria-hidden', 'true');
    if (still) el.className = 'still';
    el.innerHTML = `<div class="sp-mark">
        <div class="sp-word"><span class="sp-i"><b class="sp-stem">ı</b><i class="sp-dot"></i></span>${[...'nkwell'].map((c, i) => `<span class="sp-l" style="--i:${i}">${c}</span>`).join('')}</div>
        ${name ? `<div class="sp-hi"></div>` : ''}
        <div class="sp-jobs">${JOBS.map(([k, l], i) => `<span class="sp-j" data-k="${k}" style="--i:${i}"><svg viewBox="0 0 12 12"><circle class="sp-ring" cx="6" cy="6" r="4.5"/><path class="sp-tick" d="M3.4 6.2l1.8 1.8 3.4-3.7"/></svg>${l}</span>`).join('')}</div>
      </div>`;
    if (name) el.querySelector('.sp-hi').textContent = greeting();
    document.body.prepend(el);
    feel();
  }

  // the trackpad plays the drawing (times follow splash.css), one tap per part: the dot, the
  // stem, then each letter of "nkwell". Settings → Vibration off (a copy in localStorage) keeps it silent.
  function feel() {
    const api = window.api;
    if (!api || !api.haptic || read('a365.haptic') === 'off') return;
    const at = (ms, k) => setTimeout(() => api.haptic(k), ms);
    at(260, 1); // the dot
    if (still) return;
    at(560, 1); // the stem
    for (let i = 0; i < 6; i++) at(1120 + i * 70, 0); // n k w e l l
  }

  // a job has come in: its ring closes into a tick, one after another and never before the line is
  // in (splash.css), and a tap on the trackpad for each
  function job(k, p) {
    if (!el) return;
    const i = JOBS.findIndex((j) => j[0] === k);
    const at = 3300 + i * 420;
    Promise.all([Promise.resolve(p).catch(() => {}), new Promise((ok) => setTimeout(ok, Math.max(0, t0 + at - performance.now())))]).then(() => {
      const j = el && el.querySelector(`.sp-j[data-k="${k}"]`);
      if (!j || j.classList.contains('ok')) return;
      j.classList.add('ok');
      if (window.api && window.api.haptic && read('a365.haptic') !== 'off') window.api.haptic(0);
    });
  }

  // the app has booted: leave once the drawing is done and what loads in the background (app.js
  // warm, passed in as a promise) has come in — but never later than MAX after the start
  const MAX = still ? 1500 : 8000;
  function ready(loads) {
    if (done || !el) return;
    done = true;
    const left = (ms) => new Promise((ok) => setTimeout(ok, Math.max(0, t0 + ms - performance.now())));
    Promise.all([left(MIN), Promise.race([Promise.resolve(loads).catch(() => {}), left(MAX)])]).then(() => {
      // anything still out (slow network) is ticked as the card goes; the app carries on loading it
      const late = el.querySelectorAll('.sp-j:not(.ok)');
      late.forEach((j) => j.classList.add('ok'));
      setTimeout(() => {
        el.classList.add('out');
        setTimeout(() => el.remove(), 900);
      }, late.length ? 420 : 0);
    });
  }

  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount, { once: true });
  // never in the way for long, whatever happens to the boot
  setTimeout(ready, 10000);
  return { ready, job, t0 };
})();

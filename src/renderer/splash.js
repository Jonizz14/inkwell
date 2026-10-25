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
  const MIN = still ? 300 : name ? 3100 : 3000; // the name comes in fully, even when the app is ready sooner
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

  // the app has booted: leave once the drawing is done
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
  setTimeout(ready, 8000);
  return { ready, t0 };
})();

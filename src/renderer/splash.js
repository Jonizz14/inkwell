'use strict';

// The launch card (splash.css): drawn before anything else loads, in the theme and language the
// app was left in (applyTheme / setLang keep a copy in localStorage, since the notes arrive later).
// Just the name: its letters come out of a blur one after another and a hairline fills under it;
// with a name set in Settings, a greeting for it comes in underneath.
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
  const MIN = still ? 300 : name ? 2900 : 2200; // the name comes in fully, even when the app is ready sooner
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
        <div class="sp-word">${[...'Inkwell'].map((c, i) => `<span style="--i:${i}">${c === ' ' ? '&nbsp;' : c}</span>`).join('')}</div>
        <i class="sp-line"></i>
        ${name ? `<div class="sp-hi"></div>` : ''}
      </div>`;
    if (name) el.querySelector('.sp-hi').textContent = greeting();
    document.body.prepend(el);
    feel();
  }

  // the trackpad plays the name (times follow splash.css): one tap per letter as it lands.
  // Settings → Vibration off (a copy in localStorage) keeps it silent.
  function feel() {
    const api = window.api;
    if (!api || !api.haptic || read('a365.haptic') === 'off' || still) return;
    for (let i = 0; i < 7; i++) setTimeout(() => api.haptic(i === 0 ? 1 : 0), 330 + i * 40); // I n k w e l l
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
  return { ready };
})();

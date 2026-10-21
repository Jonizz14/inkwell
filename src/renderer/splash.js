'use strict';

// The launch card (splash.css): drawn before anything else loads, in the theme and language the
// app was left in (applyTheme / setLang keep a copy in localStorage, since the notes arrive later).
// Just the name: its letters come out of a blur one after another and a hairline fills under it.
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

  const inFrame = window !== window.top;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MIN = still ? 300 : 2200; // the name comes in fully, even when the app is ready sooner
  const t0 = performance.now();
  let el = null;
  let done = false;

  function mount() {
    if (inFrame) return;
    el = document.createElement('div');
    el.id = 'splash';
    el.setAttribute('aria-hidden', 'true');
    if (still) el.className = 'still';
    el.innerHTML = `<div class="sp-mark">
        <div class="sp-word">${[...'365 Articles'].map((c, i) => `<span style="--i:${i}">${c === ' ' ? '&nbsp;' : c}</span>`).join('')}</div>
        <i class="sp-line"></i>
      </div>`;
    document.body.prepend(el);
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

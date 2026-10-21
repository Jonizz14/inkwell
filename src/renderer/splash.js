'use strict';

// The launch card (splash.css): drawn before anything else loads, in the theme and language the
// app was left in (applyTheme / setLang keep a copy in localStorage, since the notes arrive later).
// A pen draws an open book in one line, writes a few lines on its pages, marks one of them,
// drops a bookmark in; then the name comes out of a blur and gets underlined by hand.
// When the app has booted (and the drawing is done) it all melts away through a blur.
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
  const MIN = still ? 300 : 4700; // the drawing plays to the end, even when the app is ready sooner
  const t0 = performance.now();
  let el = null;
  let done = false;

  const GREET = {
    uz: ['Xayrli tun', 'Xayrli tong', 'Xayrli kun', 'Xayrli kech'],
    en: ['Good night', 'Good morning', 'Good afternoon', 'Good evening'],
    ru: ['Доброй ночи', 'Доброе утро', 'Добрый день', 'Добрый вечер'],
  };
  const SUB = { uz: 'Bugun ham bir maqola', en: 'One article a day', ru: 'Сегодня тоже одна статья' };
  function greeting(lang) {
    const h = new Date().getHours();
    const g = GREET[lang] || GREET.uz;
    return `${g[h < 5 ? 0 : h < 12 ? 1 : h < 17 ? 2 : h < 22 ? 3 : 0]} · ${SUB[lang] || SUB.uz}`;
  }

  // the strokes, in the order the pen makes them: [path, start ms, length ms, pen visible]
  const BOOK = 'M120 46 C121 74 119 104 120 130 C96 118 62 116 30 122 C28 96 27 66 26 38 C58 31 94 33 120 46 C146 33 182 31 214 38 C213 66 212 96 210 122 C178 116 144 118 120 130';
  const line = (x1, x2, y, bend) => `M${x1} ${y} C${x1 + (x2 - x1) / 3} ${y - bend} ${x1 + ((x2 - x1) * 2) / 3} ${y + bend} ${x2} ${y}`;
  const STROKES = [
    [BOOK, 250, 1500, true],
    [line(42, 104, 58, 1.2), 1700, 230, true],
    [line(42, 98, 70, -1), 1950, 210, true],
    [line(42, 106, 82, 1), 2180, 230, true],
    [line(42, 82, 94, -0.8), 2430, 160, true],
    [line(136, 198, 58, -1), 2610, 230, true],
    [line(136, 192, 70, 1.2), 2860, 210, true],
    [line(136, 200, 82, -1), 3090, 230, true],
    [line(136, 176, 94, 1), 3340, 160, true],
  ];
  for (const st of STROKES) (st[1] *= 0.85), (st[2] *= 0.85); // the whole drawing a touch quicker
  const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);

  function mount() {
    if (inFrame) return;
    const lang = read('a365.lang') || 'uz';
    el = document.createElement('div');
    el.id = 'splash';
    el.setAttribute('aria-hidden', 'true');
    if (still) el.className = 'still';
    el.innerHTML = `<div class="sp-mark">
        <svg class="sp-art" viewBox="0 0 240 160" fill="none">
          <path class="sp-hl" d="M134 70.5 L194 69.5" pathLength="1" />
          <path class="sp-ribbon" d="M206 33 L206 53 L201 48.5 L196 53 L196 34" />
          ${STROKES.map(([d], i) => `<path class="sp-ink${i ? '' : ' sp-book'}" d="${d}" pathLength="1"${still ? '' : ' style="opacity:0"'} />`).join('')}
          <circle class="sp-pen" r="2.6" cx="120" cy="46" />
        </svg>
        <div class="sp-word">${[...'365 Articles'].map((c, i) => `<span style="--i:${i}">${c === ' ' ? '&nbsp;' : c}</span>`).join('')}</div>
        <svg class="sp-under" viewBox="0 0 200 14" fill="none"><path d="M8 9 C52 4 110 3 192 7 C150 7 104 9 70 12" pathLength="1" /></svg>
        <div class="sp-sub">${greeting(lang)}</div>
      </div>`;
    document.body.prepend(el);
    if (!still) requestAnimationFrame(draw);
  }

  // the pen: each frame the stroke being drawn grows and the nib sits at its tip
  function draw() {
    const paths = el.querySelectorAll('.sp-ink');
    const pen = el.querySelector('.sp-pen');
    const lens = [...paths].map((p) => p.getTotalLength());
    const tick = (now) => {
      if (!el.isConnected) return;
      const t = now - t0;
      let tip = null;
      STROKES.forEach(([, start, len, nib], i) => {
        const k = Math.min(1, Math.max(0, (t - start) / len));
        paths[i].style.strokeDashoffset = 1 - ease(k);
        paths[i].style.opacity = k > 0 ? '' : 0; // a round cap would leave a dot where a stroke will start
        if (k > 0 && k < 1 && nib) tip = paths[i].getPointAtLength(ease(k) * lens[i]);
      });
      if (tip) pen.setAttribute('transform', `translate(${tip.x - 120} ${tip.y - 46})`);
      pen.classList.toggle('on', !!tip || (t > 210 && t < 2980));
      if (t < 3100) requestAnimationFrame(tick);
      else pen.classList.remove('on');
    };
    requestAnimationFrame(tick);
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

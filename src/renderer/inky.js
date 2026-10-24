'use strict';
// Inky, the app's pixel mascot: a little inkwell with a quill, eyes and stubby legs (18×14 pixels),
// standing in the bottom corner of every page. It moves like a sprite — whole pixels, a few frames
// a second, never a transition: its eyes follow the pointer, it blinks, looks around, wiggles its
// quill, hops, paces; it walks along when you go to another page, reads with you (eyes running
// along the lines), cheers when a word is saved or the day's plan is done, and falls asleep when
// nothing is touched for a while. One timer, a handful of tiny writes a second, nothing at all
// while the window is hidden. Needs app.js (state, showView, reduceMotion).
const Inky = (() => {
  /* ---------- the sprite: one path per colour (body = ink, eyes = page, book pages = grey) ---------- */
  const run = (r, a, b) => (b < a ? '' : `M${a} ${r}h${b - a + 1}v1h-${b - a + 1}z`);
  // a row of the body from a to b with holes cut out (holes = [[from, to], …])
  const row = (r, a, b, holes = []) => {
    let out = '';
    let at = a;
    for (const [h0, h1] of holes) (out += run(r, at, h0 - 1)), (at = h1 + 1);
    return out + run(r, at, b);
  };
  const QUILL = ['M10 0h1v1h-1zM9 1h2v1h-2zM8 2h2v1h-2zM7 3h2v1h-2z', 'M8 0h1v1h-1zM8 1h2v1h-2zM8 2h2v1h-2zM7 3h2v1h-2z'];
  const CAP = 'M5 4h6v1h-6zM5 5h6v1h-6zM3 6h10v1h-10zM2 7h12v1h-12z';
  const LOW = 'M2 10h12v1h-12zM2 11h12v1h-12zM3 12h10v1h-10z';
  const LEGS = ['M3 13h1v1h-1zM5 13h1v1h-1zM10 13h1v1h-1zM12 13h1v1h-1z', 'M2 13h1v1h-1zM4 13h1v1h-1zM11 13h1v1h-1zM13 13h1v1h-1z'];
  const ZZZ = 'M13 1h3v1h-3zM14 2h1v1h-1zM13 3h3v1h-3z';
  // the face: eyes 2×2 at columns 4–5 and 10–11, moved by dx; shut = only the lower row shows (lids)
  function face(dx = 0, shut = false, arms = 0) {
    const L = [4 + dx, 5 + dx];
    const R = [10 + dx, 11 + dx];
    const r8 = arms ? row(8, 1, 14, shut ? [] : [L, R]) : row(8, 2, 13, shut ? [] : [L, R]);
    const r9 = arms ? row(9, 2, 13, [L, R]) : row(9, 1, 14, [L, R]);
    const eyes = (shut ? '' : run(8, ...L) + run(8, ...R)) + run(9, ...L) + run(9, ...R);
    return [r8 + r9, eyes];
  }
  const sprite = ({ dx = 0, shut = false, quill = 0, legs = 0, arms = 0, z = false } = {}) => {
    const [mid, eyes] = face(dx, shut, arms);
    return [QUILL[quill] + CAP + mid + LOW + LEGS[legs] + (z ? ZZZ : ''), eyes];
  };
  const F = {
    idle: sprite(),
    lookL: sprite({ dx: -1 }),
    lookR: sprite({ dx: 1 }),
    blink: sprite({ shut: true }),
    quill: sprite({ quill: 1 }),
    step: sprite({ legs: 1, arms: 1 }),
    sleep: sprite({ shut: true, z: true }),
    doze: sprite({ shut: true }),
    // ^ ^ eyes and an open smile
    happy: [QUILL[0] + CAP + 'M2 8h2v1h-2zM5 8h6v1h-6zM12 8h2v1h-2zM1 9h2v1h-2zM4 9h1v1h-1zM6 9h4v1h-4zM11 9h1v1h-1zM13 9h2v1h-2zM2 10h4v1h-4zM7 10h2v1h-2zM10 10h4v1h-4zM2 11h5v1h-5zM9 11h5v1h-5zM3 12h10v1h-10z' + LEGS[0], 'M4 8h1v1h-1zM11 8h1v1h-1zM3 9h1v1h-1zM5 9h1v1h-1zM10 9h1v1h-1zM12 9h1v1h-1zM6 10h1v1h-1zM9 10h1v1h-1zM7 11h2v1h-2z'],
  };
  // reading: an open book in front, lowered eyes running along a line (dx −1, 0, 1)
  const BOOK = 'M1 10h6v1h-6zM9 10h6v1h-6zM1 11h6v1h-6zM9 11h6v1h-6zM1 12h6v1h-6zM9 12h6v1h-6z';
  for (const [k, dx] of [['read', 0], ['readL', -1], ['readR', 1]]) {
    const [mid, eyes] = face(dx, true);
    F[k] = [QUILL[0] + CAP + mid + LEGS[0] + 'M7 10h2v1h-2zM7 11h2v1h-2zM7 12h2v1h-2z', eyes, BOOK];
  }

  const paths = (f) => {
    const [body, eyes, page] = F[f];
    return `<path d="${body}" fill="currentColor"/><path d="${eyes}" fill="var(--bg)"/>${page ? `<path d="${page}" fill="#9a9a94"/>` : ''}`;
  };
  function html(f = 'idle', px = 6) {
    return `<span class="inky" style="--px:${px}px" aria-hidden="true"><svg viewBox="0 0 18 14" width="${18 * px}" height="${14 * px}" shape-rendering="crispEdges">${paths(F[f] ? f : 'idle')}</svg></span>`;
  }
  if (window !== window.top) return { html, setMood() {}, cheer() {} }; // the Settings demo has none

  /* ---------- on the launch card: once the name is drawn, Inky walks up beside it, looks at
     it and cheers; the card then melts with it, and the corner one walks in from the edge ---------- */
  const word = document.querySelector('#splash:not(.still) .sp-word');
  if (word && typeof Splash !== 'undefined' && Splash.t0 != null) {
    const SP = 3;
    const slot = document.createElement('span');
    slot.className = 'sp-pal';
    slot.innerHTML = html('idle', SP);
    const ink = slot.firstChild;
    const pic = ink.firstChild;
    word.append(slot);
    let sx = 54; // starts a little to the right, invisible, and steps in
    let n = 0;
    const put = (f, y = 0) => {
      pic.innerHTML = paths(f);
      ink.style.transform = `translate(${sx}px, ${y * SP}px)`;
    };
    const at = (ms, fn) => setTimeout(fn, Math.max(0, Splash.t0 + ms - performance.now()));
    put('idle');
    at(900, () => {
      const go = () => {
        if (sx <= 0) return put('idle');
        sx -= 2 * SP;
        ink.style.opacity = sx > 42 ? 0.5 : 1;
        put(n++ % 2 ? 'idle' : 'step', n % 2 ? 0 : -1);
        setTimeout(go, 85);
      };
      go();
    });
    at(1720, () => put('lookL'));
    at(2000, () => put('blink'));
    at(2110, () => put('lookL'));
    const hop = [['happy', 0], ['happy', -2], ['happy', 0], ['happy', -2], ['happy', 0]];
    hop.forEach(([f, y], i) => at(2280 + i * 120, () => put(f, y)));
  }

  /* ---------- the companion ---------- */
  const PX = 3;
  const pal = document.createElement('div');
  pal.id = 'inky-pal';
  pal.innerHTML = html('idle', PX);
  const me = pal.firstChild;
  const svg = me.firstChild;
  me.removeAttribute('aria-hidden');
  me.setAttribute('role', 'img');
  me.setAttribute('aria-label', 'Inky');
  document.body.append(pal);

  let shown = 'idle';
  let dy = 0;
  const draw = (f, y = 0) => {
    if (shown !== f) (svg.innerHTML = paths(f)), (shown = f);
    if (dy !== y) (dy = y), (me.style.transform = y ? `translateY(${y * PX}px)` : '');
  };

  const MOOD = { reader: 'read', watch: 'read', stats: 'happy' };
  const SLEEP_AFTER = 120000;
  let lastInput = Date.now();
  let sleeping = false;
  let busy = false; // a scripted move (walk, hop, fidget) is playing
  let seqT = 0;
  let look = 'idle'; // where the pointer is: lookL / idle / lookR
  let tick = 0;
  const base = () => (sleeping ? 'sleep' : MOOD[state.view] || 'idle');

  // a short scripted move: [[frame, dy, ms], …], then back to the plain pose
  function play(seq, then) {
    clearTimeout(seqT);
    busy = true;
    let i = 0;
    const next = () => {
      if (i >= seq.length) {
        busy = false;
        draw(rest(), 0);
        return then && then();
      }
      const [f, y, ms] = seq[i++];
      draw(f, y);
      seqT = setTimeout(next, ms);
    };
    next();
  }
  const rest = () => {
    const b = base();
    return b === 'idle' ? look : b === 'read' ? 'read' : b;
  };

  // little things it does on its own, now and then
  const FIDGETS = [
    () => play([['blink', 0, 110], ['idle', 0, 140], ['blink', 0, 110]]),
    () => play([['lookL', 0, 700], ['idle', 0, 200], ['lookR', 0, 700]]),
    () => play([['quill', 0, 160], ['idle', 0, 160], ['quill', 0, 160], ['idle', 0, 120]]),
    () => play([['idle', -1, 90], ['idle', -2, 140], ['idle', -1, 90]]),
    () => pace(),
  ];

  /* walking: whole-pixel steps along the bottom edge, legs swapping each step */
  let x = 0;
  function walkTo(to, then) {
    clearTimeout(seqT);
    if (reduceMotion.matches) return (x = to), (pal.style.transform = `translateX(${x}px)`), draw(rest(), 0);
    busy = true;
    let n = 0;
    const go = () => {
      if (Math.abs(to - x) < 1) {
        busy = false;
        draw(rest(), 0);
        return then && then();
      }
      x += Math.sign(to - x) * Math.min(2 * PX, Math.abs(to - x));
      pal.style.transform = `translateX(${x}px)`;
      draw(n++ % 2 ? 'idle' : 'step', n % 2 ? 0 : -1);
      seqT = setTimeout(go, 85);
    };
    go();
  }
  const home = (view) => (view === 'library' ? 0 : (view === 'reader' || view === 'watch') && state.backTo === 'plan' ? -2 : -1) * 44;
  // a few steps one way and back, just to stretch its legs
  const pace = () => {
    const h = home(state.view);
    const d = (Math.random() < 0.5 ? -1 : 1) * 18;
    walkTo(h + d, () => setTimeout(() => !busy && walkTo(h), 500));
  };

  // the one timer: the resting pose's own motion plus a fidget now and then
  setInterval(() => {
    if (document.hidden || reduceMotion.matches || busy) return;
    tick++;
    if (!sleeping && Date.now() - lastInput > SLEEP_AFTER) sleeping = true;
    const b = base();
    if (b === 'sleep') return draw(tick % 2 ? 'doze' : 'sleep', 0);
    if (b === 'happy') return draw('happy', tick % 2 ? -1 : 0);
    if (b === 'read') return draw(['readL', 'read', 'readR', 'read'][tick % 4], 0); // eyes along the line
    draw(look, tick % 5 === 0 ? -1 : 0); // a small breath
    if (Math.random() < 0.12) FIDGETS[(Math.random() * FIDGETS.length) | 0]();
  }, 600);

  // its eyes follow the pointer (only a change of side is drawn)
  addEventListener(
    'pointermove',
    (e) => {
      const r = me.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      look = e.clientX < cx - 160 ? 'lookL' : e.clientX > cx + 160 ? 'lookR' : 'idle';
      if (!busy && base() === 'idle' && shown !== look && (shown === 'idle' || shown === 'lookL' || shown === 'lookR')) draw(look, dy);
    },
    { passive: true }
  );
  // any touch wakes it — with a start
  const wake = () => {
    lastInput = Date.now();
    if (!sleeping) return;
    sleeping = false;
    play([['idle', -2, 120], ['blink', -1, 90], ['idle', 0, 300]]);
  };
  for (const ev of ['pointerdown', 'keydown', 'wheel']) addEventListener(ev, wake, { passive: true, capture: true });

  function cheer() {
    if (reduceMotion.matches) return;
    play([['happy', 0, 70], ['happy', -2, 150], ['happy', 0, 110], ['happy', -2, 150], ['happy', 0, 500]]);
  }
  me.addEventListener('click', cheer); // a poke

  function setMood(view, pose) {
    if (MOOD[view] === pose) return;
    const was = MOOD[view];
    MOOD[view] = pose;
    if (state.view !== view || busy) return;
    if (pose === 'happy' && was) cheer(); // the plan just got done, the article just got finished
    else draw(rest(), 0);
  }

  // it walks along while the pages slide
  const show = showView;
  showView = function (name) {
    show(name);
    walkTo(home(name));
  };

  // it walks in from the edge once the launch card has gone
  x = 26 * PX;
  pal.style.transform = `translateX(${x}px)`;
  setTimeout(() => walkTo(home(state.view)), 2700);

  return { html, setMood, cheer };
})();

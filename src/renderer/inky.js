'use strict';
// Inky, the app's pixel mascot: a little inkwell with a quill, eyes and stubby legs (18×14 pixels).
// Inky.html(pose, px) gives the markup of a live one; every live one on screen moves on ONE shared
// timer, a step every 600 ms like a pixel sprite (hop, walk, blink, the sleeping z) — a few tiny
// writes twice a second and nothing between, and no work at all for ones that can't be seen.
// Poses: idle, read, happy, walk, sleep. Needs app.js ($$, t, reduceMotion).
const Inky = (() => {
  Object.assign(I18N.uz, { 'inky.end': 'Maqola tugadi' });
  Object.assign(I18N.en, { 'inky.end': 'The end' });
  Object.assign(I18N.ru, { 'inky.end': 'Конец статьи' });

  // body (ink colour), eyes (page colour), book pages (grey); one path per colour, a pixel per run
  const TOP = 'M10 0h1v1h-1zM9 1h2v1h-2zM8 2h2v1h-2zM7 3h2v1h-2zM5 4h6v1h-6zM5 5h6v1h-6zM3 6h10v1h-10zM2 7h12v1h-12z';
  const LOW = 'M2 10h12v1h-12zM2 11h12v1h-12zM3 12h10v1h-10z';
  const LEGS = 'M3 13h1v1h-1zM5 13h1v1h-1zM10 13h1v1h-1zM12 13h1v1h-1z';
  const OPEN = 'M2 8h2v1h-2zM6 8h4v1h-4zM12 8h2v1h-2zM1 9h3v1h-3zM6 9h4v1h-4zM12 9h3v1h-3z';
  const SHUT = 'M2 8h12v1h-12zM1 9h3v1h-3zM6 9h4v1h-4zM12 9h3v1h-3z';
  const EYES = 'M4 8h2v1h-2zM10 8h2v1h-2zM4 9h2v1h-2zM10 9h2v1h-2z';
  const LIDS = 'M4 9h2v1h-2zM10 9h2v1h-2z';
  const ZZZ = 'M13 1h3v1h-3zM14 2h1v1h-1zM13 3h3v1h-3z';
  const F = {
    idle: [TOP + OPEN + LOW + LEGS, EYES],
    blink: [TOP + SHUT + LOW + LEGS, LIDS],
    read: [TOP + SHUT + LEGS + 'M7 10h2v1h-2zM7 11h2v1h-2zM7 12h2v1h-2z', LIDS, 'M1 10h6v1h-6zM9 10h6v1h-6zM1 11h6v1h-6zM9 11h6v1h-6zM1 12h6v1h-6zM9 12h6v1h-6z'],
    happy: [TOP + 'M2 8h2v1h-2zM5 8h6v1h-6zM12 8h2v1h-2zM1 9h2v1h-2zM4 9h1v1h-1zM6 9h4v1h-4zM11 9h1v1h-1zM13 9h2v1h-2zM2 10h4v1h-4zM7 10h2v1h-2zM10 10h4v1h-4zM2 11h5v1h-5zM9 11h5v1h-5zM3 12h10v1h-10z' + LEGS, 'M4 8h1v1h-1zM11 8h1v1h-1zM3 9h1v1h-1zM5 9h1v1h-1zM10 9h1v1h-1zM12 9h1v1h-1zM6 10h1v1h-1zM9 10h1v1h-1zM7 11h2v1h-2z'],
    step: [TOP + 'M1 8h3v1h-3zM6 8h4v1h-4zM12 8h3v1h-3zM2 9h2v1h-2zM6 9h4v1h-4zM12 9h2v1h-2z' + LOW + 'M2 13h1v1h-1zM4 13h1v1h-1zM11 13h1v1h-1zM13 13h1v1h-1z', EYES],
    sleep: [TOP + SHUT + LOW + LEGS + ZZZ, LIDS],
    doze: [TOP + SHUT + LOW + LEGS, LIDS],
  };
  // what each pose shows on alternate steps, and whether it hops
  const MOVE = { idle: ['idle', 'idle', true], read: ['read', 'read', true], happy: ['happy', 'happy', true], walk: ['step', 'idle', false], sleep: ['sleep', 'doze', false] };

  const paths = (f) => {
    const [body, eyes, page] = F[f];
    return `<path d="${body}" fill="currentColor"/><path d="${eyes}" fill="var(--bg)"/>${page ? `<path d="${page}" fill="#9a9a94"/>` : ''}`;
  };
  function html(pose = 'idle', px = 6) {
    const m = MOVE[pose] ? pose : 'idle';
    return `<span class="inky" data-pose="${m}" style="--px:${px}px" aria-hidden="true"><svg viewBox="0 0 18 14" width="${18 * px}" height="${14 * px}" shape-rendering="crispEdges">${paths(MOVE[m][0])}</svg></span>`;
  }

  // one step for every Inky in view; off-screen pages (.view not active) and hidden windows cost nothing
  let tick = 0;
  function step() {
    if (document.hidden || reduceMotion.matches) return;
    tick++;
    const vh = innerHeight;
    for (const el of document.getElementsByClassName('inky')) {
      const view = el.closest('.view');
      if (view && !view.classList.contains('is-active')) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || r.bottom < 0 || r.top > vh) continue;
      const [a, b, hops] = MOVE[el.dataset.pose];
      const svg = el.firstChild;
      // a blink now and then (not in step with the others: each has its own phase)
      const ph = (el._ph ??= (Math.random() * 9) | 0);
      const blink = el.dataset.pose === 'idle' && (tick + ph) % 9 === 0;
      const f = blink ? 'blink' : tick % 2 ? b : a;
      if (svg._f !== f) (svg.innerHTML = paths(f)), (svg._f = f);
      if (hops) el.classList.toggle('up', tick % 2 === 1);
    }
  }
  setInterval(step, 600);

  // static places in the page (the empty library) ask for one with data-inky="pose"
  for (const el of document.querySelectorAll('[data-inky]')) el.innerHTML = html(el.dataset.inky, +el.dataset.px || 6);

  return { html };
})();

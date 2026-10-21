'use strict';
// Focus mode: the header and rail step away, the text grows, and one paragraph at a time stays
// sharp in the middle of the window while the rest of the article blurs out around it.
// Starts at the first paragraph; ↓/Space/Enter go on (a long paragraph is paged through first),
// ↑ goes back, scrolling or clicking a paragraph moves the focus there, Esc or F leaves (the reading position is kept).
// The vocabulary drawer opens beside it (V or the HUD button) without leaving focus.
// Needs app.js (state, $, $$, hidePop, hideTip, drawerOpen, openDrawer, closeDrawer, setScope,
// reduceMotion) and test.js.
const Focus = (() => {
  Object.assign(I18N.uz, {
    'focus.vocab': "Lug'at (V)",
    'focus.btn': 'Fokus',
    'focus.title': 'Fokus rejimi (F)',
    'focus.hint': '↑ ↓ — abzaslar · Esc — chiqish',
    'focus.exit': 'Chiqish',
    'focus.note': 'Xulosa yozish (N)', 'focus.noteBtn': 'Xulosa',
  });
  Object.assign(I18N.en, {
    'focus.vocab': 'Vocabulary (V)',
    'focus.btn': 'Focus',
    'focus.title': 'Focus mode (F)',
    'focus.hint': '↑ ↓ — paragraphs · Esc — exit',
    'focus.exit': 'Exit',
    'focus.note': 'Write a note (N)', 'focus.noteBtn': 'Note',
  });
  Object.assign(I18N.ru, {
    'focus.vocab': 'Словарь (V)',
    'focus.btn': 'Фокус',
    'focus.title': 'Режим фокуса (F)',
    'focus.hint': '↑ ↓ — абзацы · Esc — выход',
    'focus.exit': 'Выйти',
    'focus.note': 'Написать вывод (N)', 'focus.noteBtn': 'Вывод',
  });

  const body = document.body;
  const sc = $('#scroller');
  const hud = $('#focus-hud');
  let idx = 0;
  let auto = false; // a scroll we started ourselves: don't let it move the focus
  let autoT = 0;
  let hudT = 0;
  let ptrY = Infinity; // the pointer near the top keeps the controls up

  const isOn = () => body.classList.contains('focus');
  const moved = []; // read-along follows the focus: fn(index, byUser)
  const notify = (byUser) => moved.forEach((fn) => fn(idx, byUser));
  const paras = () => $$('#doc .para[data-p]');

  function go(i, smooth = true, byUser = true) {
    const list = paras();
    if (!list.length) return;
    idx = Math.max(0, Math.min(list.length - 1, i));
    list.forEach((el, j) => {
      el.classList.toggle('f-on', j === idx);
      el.classList.toggle('f-near', Math.abs(j - idx) === 1);
    });
    center(list[idx], smooth);
    $('#focus-pos').textContent = `${idx + 1} / ${list.length}`;
    showHud();
    notify(byUser);
  }

  // The focused text lives between the top fade/controls and the bottom fade, never under them:
  // a paragraph that fits sits in the middle of that band, a taller one starts at its top.
  const TOP = 76;
  const BOT = 88;
  const room = () => sc.clientHeight - TOP - BOT;
  const centerOff = (el) => {
    const h = el.getBoundingClientRect().height;
    return h > room() ? TOP : TOP + (room() - h) / 2;
  };
  const topOf = (el) => el.getBoundingClientRect().top - sc.getBoundingClientRect().top;

  function glide(top, smooth) {
    auto = true;
    clearTimeout(autoT);
    autoT = setTimeout(() => (auto = false), smooth ? 900 : 60);
    sc.scrollTo({ top: Math.max(0, top), behavior: smooth && !reduceMotion.matches ? 'smooth' : 'auto' });
  }
  const center = (el, smooth) => glide(sc.scrollTop + topOf(el) - centerOff(el), smooth);

  // a paragraph taller than the band is read a page at a time before the focus moves on;
  // returns false when there's nothing more of it to show in that direction
  function page(dir) {
    const el = paras()[idx];
    if (!el) return false;
    const top = topOf(el);
    const bottom = top + el.getBoundingClientRect().height;
    const line = parseFloat(getComputedStyle(el).lineHeight) || 32;
    const step = Math.max(line, room() - line * 1.5);
    if (dir > 0 && bottom > TOP + room() + 4) {
      glide(sc.scrollTop + Math.min(step, bottom - (TOP + room())), true);
      return true;
    }
    if (dir < 0 && top < TOP - 4) {
      glide(sc.scrollTop - Math.min(step, TOP - top), true);
      return true;
    }
    return false;
  }

  // read-along: keep the word being read inside the band
  function reveal(r) {
    if (!isOn() || !r || !r.height || raf) return;
    const box = sc.getBoundingClientRect();
    const y = r.top - box.top;
    if (y + r.height > TOP + room()) glide(sc.scrollTop + y - TOP - r.height, true);
    else if (y < TOP) glide(sc.scrollTop + y - TOP, true);
  }

  // manual scrolling: the paragraph nearest the middle takes the focus
  let scrollT = 0;
  sc.addEventListener('scroll', () => {
    if (!isOn() || auto) return;
    clearTimeout(scrollT);
    scrollT = setTimeout(() => {
      const mid = sc.getBoundingClientRect().top + sc.clientHeight / 2;
      let best = idx;
      let dist = Infinity;
      paras().forEach((el, j) => {
        const r = el.getBoundingClientRect();
        const d = mid < r.top ? r.top - mid : mid > r.bottom ? mid - r.bottom : 0;
        if (d < dist) (dist = d), (best = j);
      });
      if (best === idx) return;
      idx = best;
      paras().forEach((el, j) => {
        el.classList.toggle('f-on', j === idx);
        el.classList.toggle('f-near', Math.abs(j - idx) === 1);
      });
      $('#focus-pos').textContent = `${idx + 1} / ${paras().length}`;
      notify(true);
    }, 90);
  }, { passive: true });
  sc.addEventListener('scrollend', () => (auto = false));

  // A note opening, closing or growing under the focused paragraph: the two stay in the band
  // as one block. Each frame eases the scroll a part of the way to where the block belongs,
  // so the paragraph drifts up as the note unfolds instead of jumping.
  let followRaf = 0;
  function follow(el, ms = 520) {
    if (!isOn() || !el) return;
    cancelAnimationFrame(followRaf);
    const end = performance.now() + ms;
    auto = true;
    clearTimeout(autoT);
    const step = (now) => {
      const h = el.getBoundingClientRect().height;
      const want = h <= room() ? TOP + (room() - h) / 2 : TOP + room() - h;
      const d = topOf(el) - want;
      sc.scrollTop += reduceMotion.matches ? d : d * 0.22;
      if (now < end || Math.abs(d) > 0.5) followRaf = requestAnimationFrame(step);
      else (followRaf = 0), (autoT = setTimeout(() => (auto = false), 80));
    };
    followRaf = requestAnimationFrame(step);
  }
  // N or the pen in the controls: a note on the paragraph being read
  function note() {
    const el = paras()[idx];
    if (!el || el.tagName === 'H2') return;
    toggleNote(+el.dataset.p);
  }

  // Entering and leaving is one continuous move: the text grows (or shrinks) while the
  // paragraph glides from where it was to the middle (or stays put), frame by frame, so
  // nothing ever jumps. --fk on #doc goes 0 → 1 and drives the size and width in CSS.
  const doc = $('#doc');
  let raf = 0;
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
  function morph(to, el, target, done, top0 = topOf(el)) {
    cancelAnimationFrame(raf);
    const from = +doc.style.getPropertyValue('--fk') || 0;
    sc.scrollTop += topOf(el) - top0; // undo any reflow from the class switch before it paints
    const dur = reduceMotion.matches ? 0 : 640 + Math.min(500, Math.abs(top0 - target(el)) / 8);
    const t0 = performance.now();
    auto = true;
    clearTimeout(autoT);
    body.classList.add('f-anim');
    const step = (now) => {
      const t = dur ? Math.min(1, (now - t0) / dur) : 1;
      const e = ease(t);
      doc.style.setProperty('--fk', (from + (to - from) * e).toFixed(4));
      sc.scrollTop += topOf(el) - (top0 + (target(el) - top0) * e);
      if (t < 1) return (raf = requestAnimationFrame(step));
      raf = 0;
      body.classList.remove('f-anim');
      autoT = setTimeout(() => (auto = false), 80);
      done && done();
    };
    raf = requestAnimationFrame(step);
  }

  function enter() {
    if (isOn() || state.view !== 'reader' || !state.current || !paras().length) return;
    if (state.pop) hidePop();
    hideTip();
    if (Test.isOpen()) Test.close();
    getSelection().removeAllRanges();
    body.classList.add('focus');
    const list = paras();
    idx = 0;
    list.forEach((el, j) => {
      el.classList.toggle('f-on', j === 0);
      el.classList.toggle('f-near', j === 1);
    });
    $('#focus-pos').textContent = `1 / ${list.length}`;
    morph(1, list[0], centerOff, showHud);
  }

  function exit() {
    if (!isOn()) return;
    if (typeof ReadAlong !== 'undefined') ReadAlong.stop();
    const el = paras()[idx];
    const keep = el && topOf(el);
    body.classList.add('f-anim'); // keeps the wide column until the text has shrunk back
    body.classList.remove('focus');
    $$('#doc .f-on, #doc .f-near').forEach((x) => x.classList.remove('f-on', 'f-near'));
    hud.classList.remove('show');
    // the paragraph being read stays where the eye is while the text settles back
    if (el) morph(0, el, () => keep, null, keep);
    else doc.style.setProperty('--fk', 0);
  }

  // leaving the reader: no animation, nothing to keep in place
  function off() {
    if (typeof ReadAlong !== 'undefined') ReadAlong.stop();
    if (!isOn()) return;
    cancelAnimationFrame(raf);
    body.classList.remove('focus', 'f-anim');
    doc.style.setProperty('--fk', 0);
    $$('#doc .f-on, #doc .f-near').forEach((x) => x.classList.remove('f-on', 'f-near'));
    hud.classList.remove('show');
    auto = false;
  }

  const toggle = () => (isOn() ? exit() : enter());

  function showHud() {
    hud.classList.add('show');
    clearTimeout(hudT);
    hudT = setTimeout(() => hud.matches(':hover') || ptrY < 140 || body.classList.contains('ra-on') || hud.classList.remove('show'), 2200);
  }

  $('#btn-focus').addEventListener('click', enter);
  $('#focus-exit').addEventListener('click', exit);
  hud.addEventListener('mouseleave', showHud);

  // the header stays away in focus; the controls come up while the pointer is near the top
  // (the top strip itself is a window drag area, see .focus-drag)
  window.addEventListener('mousemove', (e) => {
    ptrY = e.clientY;
    if (!isOn()) return;
    if (ptrY < 140) showHud();
  }, { passive: true });

  // a blurred paragraph takes the focus on click, before any selection starts in it
  $('#doc').addEventListener('mousedown', (e) => {
    if (!isOn() || e.button !== 0) return;
    const p = e.target.closest('.para[data-p]');
    if (!p || p.classList.contains('f-on')) return;
    e.preventDefault();
    e.stopPropagation();
    go(paras().indexOf(p));
  }, true);

  window.addEventListener('keydown', (e) => {
    if (state.view !== 'reader' || !state.current) return;
    const typing = e.target.closest && e.target.closest('input, textarea, [contenteditable="true"]');
    if (typing || e.metaKey || e.ctrlKey || e.altKey || $('.modal.show, .fs-veil.show')) return;
    const k = e.key;
    if (k.toLowerCase() === 'f' && !state.pop) return (e.preventDefault(), e.stopImmediatePropagation(), toggle());
    if (!isOn()) return;
    if (k === 'Escape' && drawerOpen() && !state.pop) return (e.stopImmediatePropagation(), closeDrawer());
    if (k === 'Escape' && !state.pop && !$('.menu.show, .tools.show') && !$('.mp.big')) return (e.stopImmediatePropagation(), exit());
    const next = k === 'ArrowDown' || k === 'ArrowRight' || k === 'Enter' || k === 'j' || (k === ' ' && !e.shiftKey);
    const prev = k === 'ArrowUp' || k === 'ArrowLeft' || k === 'k' || (k === ' ' && e.shiftKey);
    if (next || prev) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (state.pop) hidePop();
      if (!page(next ? 1 : -1)) go(idx + (next ? 1 : -1));
      showHud();
      return;
    }
    if (k.toLowerCase() === 'n' && !state.pop) return (e.preventDefault(), e.stopImmediatePropagation(), note());
    // the test pane needs the room: leave focus first, then let it open
    if (k.toLowerCase() === 't') exit();
  }, true);

  $('#focus-note').addEventListener('click', () => (note(), showHud()));
  // the vocabulary sits beside the focused text; the test pane ends focus
  $('#focus-vocab').addEventListener('click', () => {
    if (drawerOpen()) closeDrawer();
    else (setScope('article'), openDrawer());
    showHud();
  });
  let drawerWas = drawerOpen();
  new MutationObserver(() => {
    if (isOn() && body.classList.contains('test-open')) exit();
    const d = drawerOpen();
    if (d === drawerWas) return;
    drawerWas = d;
    $('#focus-vocab').classList.toggle('on', d);
    // the column rewraps to its new width; glide() (app.js) brings the paragraph back to the middle
  }).observe(body, { attributes: true, attributeFilter: ['class'] });

  window.addEventListener('resize', () => isOn() && paras()[idx] && center(paras()[idx], false));

  applyI18n();
  return {
    enter, exit, off, toggle, isOn, showHud, follow,
    refresh: () => isOn() && go(idx, false, false),
    at: () => idx,
    paras,
    go: (i) => go(i, true, false),
    reveal,
    // where a paragraph should sit in the scroller; the caller is about to scroll there itself
    settle: (el) => {
      auto = true;
      clearTimeout(autoT);
      autoT = setTimeout(() => (auto = false), 120);
      return sc.getBoundingClientRect().top + centerOff(el);
    },
    onMove: (fn) => moved.push(fn),
  };
})();

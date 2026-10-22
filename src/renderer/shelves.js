'use strict';
// The library's shelves. The titles at the top of the library are the switch: "Articles" shows
// the PDFs, "Listening" (listen.js) its own shelf; an add-on can put a shelf of its own between
// them (Shelves.register). Every shelf but Articles opens a row of chips under the titles; the
// list changes by a crossfade in place. The library's filters live in the same chips row.
// Needs app.js (state, $, $$, esc, save, t, lang, renderLibrary, libHeader, reduceMotion).
const Shelves = (() => {
  const lib = $('#library');
  const row = $('#chips');
  const pill = $('.chip-pill', row);
  const search = $('#search');
  const addBtn = $('#btn-add');
  const S = () => state.notes.settings;

  // add-on shelves: { id, title, chipsHtml(), chip(button), render(), feedShown(), addLabel(),
  // searchPh(), add(event), searchKey(event), stats(), feedClass() }
  const extra = [];
  const ext = () => extra.find((x) => x.id === state.shelf);
  const ls = () => state.shelf === 'listen';
  const shelves = () => ['365', ...extra.map((x) => x.id), 'listen'];

  /* ---------------- the chips row ----------------
     Under the titles on every shelf but Articles. It opens while the list is blurred away (so
     nothing visibly jumps), and the chips come out of a blur one after another; a pill slides to
     the chosen one. The reading filters stay where they are on every shelf. */

  let rowLang = '';
  let rowShelf = '';
  const chipsHtml = () => (ls() ? Listen.chipsHtml() : ext() ? ext().chipsHtml() : '');
  const feedClass = () => !!(ext() && ext().feedClass && ext().feedClass());

  function fill(enter) {
    $$('button', row).forEach((b) => b.remove());
    row.insertAdjacentHTML('beforeend', chipsHtml());
    if (enter) {
      row.classList.add('in');
      void row.offsetWidth;
      row.classList.remove('in');
    }
    lib.classList.toggle('gd-feed', feedClass());
    rowLang = lang;
    rowShelf = state.shelf;
  }
  function placePill(snap) {
    const b = $('button.on', row);
    if (!b) return pill.classList.add('off');
    pill.classList.remove('off');
    if (snap) pill.classList.add('snap');
    pill.style.width = b.offsetWidth + 'px';
    // the pill lives inside the scrolling row, so it scrolls with the chips by itself
    pill.style.transform = `translateX(${b.offsetLeft}px)`;
    if (snap) {
      void pill.offsetWidth;
      pill.classList.remove('snap');
    }
  }
  const searchPh = () => (ls() ? t('ls.search') : ext() ? ext().searchPh() : t('lib.search'));
  const addText = () => (ls() ? t('ls.add') : ext() ? ext().addLabel() : t('lib.add'));
  function chips() {
    fill(false);
    placePill(true);
    // applyI18n() (a language change) writes the Articles texts back into these
    search.placeholder = searchPh();
    addBtn.textContent = addText();
    $$('#filter button[data-f]:not([data-f="all"])').forEach((b) => (b.textContent = filterLabel(b.dataset.f)));
    addWidth();
  }

  row.addEventListener('click', (e) => {
    const x = e.target.closest('.ls-x');
    if (x && ls()) return (e.stopPropagation(), Listen.removeShow(x.dataset.x), chips(), swapList());
    const b = e.target.closest('button');
    if (!b || b.classList.contains('on')) return;
    $$('button', row).forEach((y) => y.classList.toggle('on', y === b));
    placePill(false);
    if (ls()) Listen.pick(b.dataset.s);
    else if (ext()) ext().chip(b);
    lib.classList.toggle('gd-feed', feedClass());
    swapList();
  });

  /* ---------------- switching shelves ----------------
     Nothing goes blank in between: the rows in sight are copied over the list and blur away while
     the new rows come out of a blur underneath, at the same moment, in the same place. The copy
     lives inside the list, so when the chips row opens above it, old and new move down
     together. Only opacity and filter animate on the rows. */
  const FADE = 300;
  function crossfade(draw) {
    const list = $('#list');
    const box = list.getBoundingClientRect();
    const view = lib.getBoundingClientRect();
    const ghost = document.createElement('div');
    ghost.className = 'list-ghost';
    for (const li of list.children) {
      const r = li.getBoundingClientRect();
      if (r.bottom < view.top) continue;
      if (r.top > view.bottom) break;
      const c = li.cloneNode(true);
      c.style.cssText = `position:absolute;left:0;right:0;top:${r.top - box.top}px;animation:none`;
      ghost.appendChild(c);
    }
    draw();
    list.prepend(ghost);
    list.classList.add('fresh');
    void list.offsetWidth;
    list.classList.remove('fresh');
    ghost.classList.add('out');
    setTimeout(() => ghost.remove(), FADE + 60);
  }
  const swapList = (after) => crossfade(() => (after && after(), renderLibrary(true)));

  function swapText(el, text) {
    if (!el || el.textContent === text) return;
    el.classList.add('swap');
    setTimeout(() => {
      el.textContent = text;
      el.classList.remove('swap');
    }, 150);
  }
  // the button keeps the width of its longest label, so the buttons beside it never shift
  function addWidth() {
    const cur = addBtn.textContent;
    addBtn.style.minWidth = '';
    let w = 0;
    for (const l of [t('lib.add'), t('ls.add'), ...extra.map((x) => x.addLabel())]) {
      addBtn.textContent = l;
      w = Math.max(w, addBtn.offsetWidth);
    }
    addBtn.textContent = cur;
    addBtn.style.minWidth = w + 'px';
  }
  // the reading filters read as listening ones on the Listening shelf
  const filterLabel = (f) => t((ls() ? 'ls.f.' : 'f.') + f);
  function addLabel() {
    swapText(addBtn, addText());
    $$('#filter button[data-f]:not([data-f="all"])').forEach((b) => swapText(b, filterLabel(b.dataset.f)));
    search.placeholder = searchPh();
  }

  function setShelf(s) {
    const to = shelves().includes(s) ? s : '365';
    if (to === state.shelf) return;
    $$('#shelf button').forEach((b) => b.classList.toggle('on', b.dataset.s === to));
    const scrolled = lib.scrollTop > 0;
    // the search row and the list glide to where the chips row puts them (FLIP: measured
    // before and after, then moved back by transform only, so nothing is laid out per frame)
    const movers = [$('.lib-tools'), $('#import-bar'), $('#ls-stage'), $('#list')].filter((el) => el && !el.hidden);
    if (state.shelf === 'listen') Listen.leave();
    const before = movers.map((el) => el.getBoundingClientRect().top);
    state.shelf = to;
    if (to === '365') delete S().shelf;
    else S().shelf = to;
    save();
    // what both shelves have stays where it is and only its words change, through a blur; the
    // chips row is simply added (or taken away), its chips coming out of a blur
    if (to !== '365') {
      fill(true);
      lib.classList.add('gd');
      lib.classList.toggle('ls', to === 'listen');
      placePill(true);
    } else {
      lib.classList.remove('gd', 'gd-feed', 'ls');
      fill(false);
      placePill(true);
    }
    const st = $('#lib-stats');
    const old = st.textContent;
    st.classList.add('swap');
    swapList();
    st.textContent = old; // renderLibrary() wrote the new counts: they come in after the blur
    setTimeout(() => (libHeader(), st.classList.remove('swap')), 150);
    addLabel();
    if (!reduceMotion.matches) {
      movers.forEach((el, i) => {
        const d = before[i] - el.getBoundingClientRect().top;
        if (Math.abs(d) > 0.5) el.animate([{ transform: `translateY(${d}px)` }, { transform: 'none' }], { duration: 460, easing: 'cubic-bezier(0.32, 0.72, 0, 1)' });
      });
    }
    // one move at a time: back to the top only after the change has settled
    if (scrolled) setTimeout(() => lib.scrollTo({ top: 0, behavior: reduceMotion.matches ? 'auto' : 'smooth' }), FADE + 80);
  }
  $('#shelf').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) setShelf(b.dataset.s);
  });

  // called first by renderLibrary(): true when the shelf drew the list itself
  function render() {
    if (rowLang !== lang || rowShelf !== state.shelf) chips(); // the language changed under it
    if (ls()) return Listen.render();
    if (ext()) return ext().render();
    return false;
  }

  // "+ Add" and the search field belong to the shelf being shown
  search.addEventListener('keydown', (e) => ext() && ext().searchKey && ext().searchKey(e));
  addBtn.addEventListener('click', (e) => {
    if (ls()) return (e.stopImmediatePropagation(), Listen.addFromButton());
    if (!ext() || !ext().add) return;
    e.stopImmediatePropagation();
    ext().add(e);
  }, true);

  addEventListener('resize', () => placePill(true));

  // an add-on's shelf: its title goes after "Articles"
  function register(def) {
    extra.push(def);
    const b = document.createElement('button');
    b.dataset.s = def.id;
    b.textContent = def.title;
    $('#shelf button[data-s="365"]').after(b);
  }

  // the shelf the library was left on comes back: before the list is drawn (prepare), then
  // the chips once the articles are known (restore)
  function prepare() {
    state.shelf = shelves().includes(S().shelf) ? S().shelf : '365';
    $$('#shelf button').forEach((b) => b.classList.toggle('on', b.dataset.s === state.shelf));
    lib.classList.toggle('gd', state.shelf !== '365');
    lib.classList.toggle('ls', ls());
  }
  const restore = chips;
  // the counts line under the titles, for a shelf that has its own
  const stats = (...a) => (ls() ? Listen.header() : ext() && ext().stats ? ext().stats(...a) : null);

  return { render, prepare, restore, register, stats, feedShown: () => feedClass() || ls(), swapList, crossfade, chips };
})();

'use strict';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const WORD = /[\p{L}\p{N}'’-]/u;

const state = {
  list: [],
  notes: { articles: {}, settings: {} },
  view: 'library',
  filter: 'all',
  query: '',
  current: null, // { id, meta, data }
  vocabScope: 'article',
  pop: null, // { mode, sel?, hlId? }
  shelf: '365', // '365' (the PDFs), 'listen', or an add-on's shelf (shelves.js)
};
// the articles on the shelf being shown; everything else (vocabulary, cards, stats) uses them all.
// An article saved by an add-on carries its shelf as kind; Listening draws its own list.
const onShelf = (m) => (m.kind || '365') === (state.shelf === 'listen' ? '365' : state.shelf);

if (api.platform === 'darwin') document.documentElement.classList.add('mac');

/* ---------------- persistence ---------------- */

let saveTimer;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => api.saveNotes(state.notes), 350);
}
window.addEventListener('beforeunload', () => api.saveNotes(state.notes));

function rec(id) {
  const a = (state.notes.articles[id] ||= {});
  a.hl ||= [];
  a.vocab ||= [];
  a.notes ||= {};
  return a;
}

/* ---------------- small UI helpers ---------------- */

let toastTimer;
function toast(msg, ms = 1800) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

// restarted through Web Animations: no forced layout of the page (offsetWidth) just to replay it
function bump(el) {
  el.classList.remove('bump');
  if (el._bump) el._bump.cancel();
  el._bump = el.animate([{ transform: 'none' }, { transform: 'scale(1.35)', offset: 0.3 }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
}

function autosize(ta) {
  ta.style.height = 'auto';
  ta.style.height = ta.scrollHeight + 'px';
}

let pushTimer;
// two frames: the new content is laid out and painted before a slide starts, so the
// first frames of the push aren't spent on layout (that's what made it stutter)
const settled = () => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
// The vocabulary drawer and the test pane take room from the reading column. Animating that
// padding re-laid out the whole article on every frame (the stutter); instead the padding
// switches at once and the column glides over from where it was, a transform only. The
// paragraph at the top of the window keeps its place while the text rewraps.
function glide(change) {
  const view = $('.view.is-active');
  const sc = view && $('.scroller', view);
  const els = !view ? [] : view.id === 'library' ? $$('#library > :not(.lib-top):not(.pblur), .lib-top > :not(.pblur)') : $$('.doc', view);
  const top = sc && sc.getBoundingClientRect().top;
  const anchor = sc && ($('.para.f-on', view) || $$('.para[data-p]', view).find((p) => p.getBoundingClientRect().bottom > top + 56));
  const at = anchor && anchor.getBoundingClientRect().top;
  const before = els.map((el) => el.getBoundingClientRect().left);
  change();
  // in focus the rewrapped paragraph also has to come back to the middle: jump the scroll
  // there now and let the same transform carry it, so it's one move instead of a slide and
  // then a smooth scroll fighting it
  const focused = anchor && typeof Focus !== 'undefined' && Focus.isOn();
  if (anchor) sc.scrollTop += anchor.getBoundingClientRect().top - (focused ? Focus.settle(anchor) : at);
  if (reduceMotion.matches) return;
  const dy = anchor ? at - anchor.getBoundingClientRect().top : 0;
  els.forEach((el, i) => {
    const dx = before[i] - el.getBoundingClientRect().left;
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
  });
}

function showView(name) {
  state.view = name;
  $$('.view').forEach((v) => v.classList.toggle('is-active', v.id === name));
  document.body.classList.toggle('in-reader', name !== 'library');
  document.body.classList.add('pushing');
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => document.body.classList.remove('pushing'), 560);
  hidePop();
  closeMenu();
}

const natural = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
const titleOf = (m) => (state.notes.articles[m.id] && state.notes.articles[m.id].title) || m.title || m.file;

/* ---------------- library ---------------- */

async function loadLibrary() {
  state.list = (await api.list()).sort((a, b) => natural.compare(a.file, b.file));
  renderLibrary();
}

function statusOf(id) {
  const p = (state.notes.articles[id] && state.notes.articles[id].progress) || 0;
  return p >= 0.95 ? 'done' : p > 0.02 ? 'reading' : 'new';
}

function ring(p) {
  const r = 7;
  const c = 2 * Math.PI * r;
  return `<svg class="ring" viewBox="0 0 18 18"><circle class="bg" cx="9" cy="9" r="${r}"/><circle class="fg" cx="9" cy="9" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - p)}"/></svg>`;
}

// a saved web article's picture, from the library folder (shown offline too)
// (a Guardian picture is shown from the Guardian's servers: m.img is its address)
const libImg = (m) => (!m.img ? null : /^https:\/\//.test(m.img) ? m.img : state.libDir ? encodeURI('file://' + state.libDir + '/' + m.img) : null);

// a row's picture: its small copy when main.js has made one (the big one cost frames to decode)
const rowImg = (m) => (m.thumb && state.libDir ? encodeURI('file://' + state.libDir + '/' + m.thumb) : libImg(m));

function itemHtml(m, i, num) {
  const a = state.notes.articles[m.id] || {};
  const img = rowImg(m);
  const p = a.progress || 0;
  const v = (a.vocab && a.vocab.length) || 0;
  const n = Object.values(a.notes || {}).filter((t) => t.trim()).length;
  // rows past the first screens come in still: nobody sees them rise, and 170 rows blurring at once
  // cost a whole style pass every frame
  return `<li class="item ${statusOf(m.id)}${img ? ' has-img' : ''}${i >= 24 ? ' still' : ''}" data-id="${m.id}" data-sig="${esc(itemSig(m))}" style="animation-delay:${Math.min(i, 14) * 22}ms">
        <div class="item-num">${String(num).padStart(3, '0')}</div>
        <div><h3 class="item-title">${esc(titleOf(m))}</h3><p class="item-ex">${esc(m.excerpt)}</p></div>${img ? `<img class="item-img" src="${esc(img)}" alt="" loading="lazy" decoding="async" />` : ''}
        <div class="item-meta">${ring(p)}<span>${t('lib.min', Math.max(1, Math.round(m.words / 220)))}</span>${v ? `<span>${t('lib.words', v)}</span>` : ''}${n ? `<span>${t('lib.notes', n)}</span>` : ''}</div>
      </li>`;
}

// everything a row shows; a row is redrawn only when this changes
function itemSig(m) {
  const a = state.notes.articles[m.id] || {};
  const n = Object.values(a.notes || {}).filter((t) => t.trim()).length;
  return [statusOf(m.id), (a.progress || 0).toFixed(4), (a.vocab && a.vocab.length) || 0, n, titleOf(m), m.thumb || m.img || ''].join('|');
}

function libHeader() {
  const totalWords = Object.values(state.notes.articles).reduce((n, a) => n + ((a.vocab && a.vocab.length) || 0), 0);
  const shelf = state.list.filter(onShelf);
  const done = shelf.filter((m) => statusOf(m.id) === 'done').length;
  const own = typeof Shelves !== 'undefined' && Shelves.stats(shelf.length, done, totalWords);
  $('#lib-stats').textContent = own || t('lib.stats', shelf.length, done, totalWords);
  $('#vocab-total').textContent = totalWords;
  if (typeof Cards !== 'undefined') Cards.badge();
}

// what the list was last drawn from: coming back from an article only that row can differ
let libKey = '';
const libKeyNow = () => `${lang}|${state.shelf}|${state.filter}|${state.query}|${state.list.length}`;

// quiet: refresh in place without replaying the list's entrance animation
function renderLibrary(quiet) {
  $('#list').classList.toggle('quiet', !!quiet);
  // a shelf with a list of its own (Listening, an add-on's feed) draws it itself
  if (typeof Shelves !== 'undefined' && Shelves.render(quiet)) return (libKey = libKeyNow());
  const q = state.query.trim().toLowerCase();
  const shelf = state.list.filter(onShelf);
  const items = shelf.filter((m) => {
    if (state.filter !== 'all' && statusOf(m.id) !== state.filter) return false;
    if (!q) return true;
    return (titleOf(m) + ' ' + m.excerpt + ' ' + m.file).toLowerCase().includes(q);
  });
  libHeader();
  $('#empty').hidden = shelf.length > 0 || state.shelf !== '365';
  const nums = new Map(shelf.map((m, k) => [m.id, k + 1]));
  $('#list').innerHTML = items.map((m, i) => itemHtml(m, i, nums.get(m.id))).join('');
  libKey = libKeyNow();
}

// back from an article: only rows whose content changed are redrawn (usually just the one
// that was read), so the other 170-odd keep their layout; a filter or search that could add
// or drop rows still redraws the whole list
function refreshItem() {
  if (state.filter !== 'all' || state.query.trim() || libKey !== libKeyNow() || (typeof Shelves !== 'undefined' && Shelves.feedShown())) return renderLibrary(true);
  const rows = $('#list').children;
  const shelf = state.list.filter(onShelf);
  if (rows.length !== shelf.length) return renderLibrary(true);
  $('#list').classList.add('quiet');
  libHeader();
  for (let k = 0; k < shelf.length; k++) {
    const m = shelf[k];
    const li = rows[k];
    if (li.dataset.id !== m.id) return renderLibrary(true);
    if (li.dataset.sig !== itemSig(m)) li.outerHTML = itemHtml(m, k, k + 1);
  }
}

$('#list').addEventListener('click', (e) => {
  const li = e.target.closest('.item');
  if (li && li.dataset.id) openArticle(li.dataset.id); // a feed row not saved yet is its shelf's own
});
$('#search').addEventListener('input', (e) => {
  state.query = e.target.value;
  renderLibrary();
});
$('#filter').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  state.filter = b.dataset.f;
  $$('#filter button').forEach((x) => x.classList.toggle('on', x === b));
  renderLibrary();
});
$('#btn-add').addEventListener('click', async () => {
  const r = await api.pick();
  if (r) afterImport(r);
});
$('#btn-inbox').addEventListener('click', () => (closeMenu(), api.openInbox()));
$('#btn-vocab-all').addEventListener('click', () => {
  setScope('all');
  openDrawer();
});

function afterImport(r) {
  loadLibrary();
  if (r.added) toast(t('import.added', r.added));
  else if (r.failed) toast(t('import.failed', r.failed));
}

let importHideTimer;
api.onImportProgress((p) => {
  const bar = $('#import-bar');
  clearTimeout(importHideTimer);
  bar.hidden = false;
  $('.import-fill', bar).style.width = (p.total ? (p.done / p.total) * 100 : 0) + '%';
  $('.import-text', bar).textContent =
    p.done >= p.total
      ? t('import.done')
      : `${p.done + 1} / ${p.total} · ${p.name || ''}${p.ocr ? ` · ${t('import.ocr')}: ${p.ocr}` : ''}`;
  if (p.added) loadLibrary();
  if (p.done >= p.total) importHideTimer = setTimeout(() => (bar.hidden = true), 1600);
});

/* drag & drop import */
let dragDepth = 0;
window.addEventListener('dragenter', (e) => {
  if (![...e.dataTransfer.types].includes('Files') || Test.importOpen()) return;
  dragDepth++;
  $('#drop').classList.add('show');
});
window.addEventListener('dragleave', () => {
  if (--dragDepth <= 0) ((dragDepth = 0), $('#drop').classList.remove('show'));
});
window.addEventListener('dragover', (e) => {
  e.preventDefault();
  // Windows shows a "no" cursor and drops nothing unless the drop says it copies
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
});
window.addEventListener('drop', async (e) => {
  e.preventDefault();
  dragDepth = 0;
  $('#drop').classList.remove('show');
  if (!e.dataTransfer.files.length) return;
  // a drag of a .pdf (or a folder of them) from anywhere: Explorer, Finder, the desktop
  afterImport(await api.importFiles(e.dataTransfer.files));
});

/* ---------------- reader ---------------- */

async function openArticle(id) {
  const meta = state.list.find((m) => m.id === id);
  const data = await api.article(id);
  // a Guardian article whose day-old text couldn't be fetched again (no key, no internet)
  if (data && data.err) return toast(typeof Guardian !== 'undefined' ? Guardian.why(data.err) : t('reader.openFail'));
  if (!meta || !data) return toast(t('reader.openFail'));
  state.current = { id, meta, data };
  // styled and laid out while the page still waits off screen (.warm, as Statistics does), so
  // the slide's first frame only has to paint it
  $('#reader').classList.add('warm');
  const r = rec(id);
  // its text was edited since it was last fetched: highlights and notes find their places again
  if (data.moved != null && typeof migrateRecord === 'function') {
    migrateRecord(r, Array.from({ length: data.moved }, () => ({ text: '' })), data.blocks);
    delete data.moved;
  }
  applyEdits(data, r);
  r.opened = Date.now();
  save();
  renderDoc();
  updateVocabCount();
  Test.onArticle();
  if (state.vocabScope === 'article' || $('body').classList.contains('drawer-open')) renderVocab();
  const sc = $('#scroller');
  sc.scrollTop = (r.pos ?? r.progress ?? 0) * (sc.scrollHeight - sc.clientHeight);
  onScroll();
  // let the new article lay out and paint first, so the slide starts on a clean frame
  // the article's picture is decoded before the slide, not during it (a 1500 px photo cost a frame)
  const hero = $('.doc-hero img');
  if (hero && !(hero.complete && hero.naturalWidth)) await Promise.race([hero.decode().catch(() => {}), new Promise((ok) => setTimeout(ok, 200))]);
  await settled();
  showView('reader');
  $('#reader').classList.remove('warm');
}

// an article saved from the web: minutes · words · author · date · where it is from
function docMetaWeb(meta, mins) {
  const date = meta.date ? dateFmt({ day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(meta.date)) : '';
  return [t('doc.metaWeb', mins, meta.words), meta.by, date, meta.file].filter(Boolean).map(esc).join(' · ');
}

function renderDoc() {
  const { id, meta, data } = state.current;
  const r = rec(id);
  const title = titleOf(meta);
  $('#bar-title').textContent = title;
  const mins = Math.max(1, Math.round(meta.words / 220));
  let html = `<h1 id="doc-title" title="${esc(t('doc.renameTitle'))}">${esc(title)}</h1>
    <div class="doc-meta">${meta.url ? docMetaWeb(meta, mins) : `${t('doc.meta', mins, meta.words, meta.pages)} · ${esc(meta.file)}`}</div>`;
  // an article from the web has its page where a PDF would be
  $('#pdf-label').textContent = meta.url ? `${meta.file} ↗` : 'PDF';
  const hero = libImg(meta);
  if (hero) html += `<figure class="doc-hero"><img src="${esc(hero)}" alt="" decoding="async" />${meta.caption ? `<figcaption>${esc(meta.caption)}</figcaption>` : ''}</figure>`;
  const marked = [];
  data.blocks.forEach((b, p) => {
    if (b.type === 'h' && b.text === meta.title && p < 6) return; // already shown as the title
    if (b.type === 'h') {
      html += `<h2 class="para" data-p="${p}"><span class="ptext">${(marked[p] = paraHtml(b.text, r.hl, p))}</span></h2>`;
      return;
    }
    const note = r.notes[p];
    html += `<div class="para${note != null ? ' has-note' : ''}" data-p="${p}">
      <button class="ptool" title="${esc(t('note.tool'))}">✎</button>
      <span class="pnum">${p + 1}</span>
      <p class="ptext">${(marked[p] = paraHtml(b.text, r.hl, p))}</p>
      ${noteHtml(p, note)}
    </div>`;
  });
  $('#doc').innerHTML = html;
  $$('#doc .para[data-p] .ptext').forEach((el) => (el._h = marked[el.parentNode.dataset.p]));
  $$('#doc .note textarea').forEach(autosize);
  renderRail();
}

/* paragraph rail: a line per paragraph on the left; hover opens the outline, click jumps there */
const snippet = (t) => {
  const w = t.split(/\s+/);
  return w.slice(0, 9).join(' ') + (w.length > 9 ? '…' : '');
};
let railActive = null;
function renderRail() {
  const items = $$('#doc .para[data-p]');
  const rail = $('#rail');
  rail.hidden = items.length < 2;
  if (rail.hidden) return;
  // long articles get thinner rows so the lines stay within ~60% of the window
  rail.style.setProperty('--rh', Math.max(3, Math.min(8, Math.floor((innerHeight * 0.6) / items.length))) + 'px');
  $('#rail-lines').innerHTML = items.map((el) => `<i class="${el.tagName === 'H2' ? 'h' : ''}" data-p="${el.dataset.p}"></i>`).join('');
  $('#rail-panel').innerHTML = items
    .map((el, i) => {
      const text = state.current.data.blocks[+el.dataset.p].text;
      const isH = el.tagName === 'H2';
      return `<button class="ri${isH ? ' h' : ''}" data-p="${el.dataset.p}" style="--d:${Math.min(i, 20) * 14}ms">${esc(isH ? text : snippet(text))}</button>`;
    })
    .join('');
  railActive = null;
  updateRail();
}
function updateRail() {
  if ($('#rail').hidden) return;
  const line = $('#scroller').getBoundingClientRect().top + 100; // just below where a jump lands (84px)
  let cur = null;
  for (const el of $$('#doc .para[data-p]')) {
    if (cur !== null && el.getBoundingClientRect().top > line) break;
    cur = el.dataset.p;
  }
  if (cur === railActive) return;
  railActive = cur;
  $$('#rail .on').forEach((x) => x.classList.remove('on'));
  $$(`#rail [data-p="${cur}"]`).forEach((x) => x.classList.add('on'));
}
$('#rail').addEventListener('mouseenter', () => {
  // open the outline with the current paragraph in view
  const panel = $('#rail-panel');
  const on = $('.ri.on', panel);
  if (on) panel.scrollTop = on.offsetTop - panel.clientHeight / 2 + on.offsetHeight / 2;
});
$('#rail').addEventListener('click', (e) => {
  const b = e.target.closest('[data-p]');
  const el = b && $(`#doc .para[data-p="${b.dataset.p}"]`);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  // paragraphs off screen are only estimated in size, so settle once the scroll lands
  setTimeout(() => {
    const off = el.getBoundingClientRect().top - $('#scroller').getBoundingClientRect().top - 84;
    if (Math.abs(off) > 12) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 650);
  el.classList.remove('jump');
  void el.offsetWidth;
  el.classList.add('jump');
});
window.addEventListener('resize', () => state.view === 'reader' && state.current && renderRail());

function noteHtml(p, text) {
  if (text == null) return '';
  return `<div class="note open"><div><div class="note-box">
    <div class="note-label"><span>${t('note.label')} · ¶${p + 1}</span><button data-act="note-del">${t('del')}</button></div>
    <textarea rows="1" placeholder="${esc(t('note.ph'))}">${esc(text)}</textarea>
  </div></div></div>`;
}

// Splits paragraph text at highlight boundaries; overlapping marks nest as classes.
// Every other occurrence of a vocabulary word in the article gets marked too ("echo"):
// it carries the original's id, so hover/click behave the same as on the original mark.
// a quote or a dash next to a word only continues it when a letter follows (don’t, data-driven);
// "sensitive data’ to China" ends at the closing quote
const LETTER = /[\p{L}\p{N}]/u;
const JOIN = /['’-]/;
const joinsBefore = (text, i) => i > 0 && (LETTER.test(text[i - 1]) || (JOIN.test(text[i - 1]) && i > 1 && LETTER.test(text[i - 2])));
const joinsAfter = (text, e) => e < text.length && (LETTER.test(text[e]) || (JOIN.test(text[e]) && e + 1 < text.length && LETTER.test(text[e + 1])));

function echoMarks(text, hls, p) {
  const words = hls.filter((h) => h.t === 'word' && h.e > h.s);
  if (!words.length) return [];
  const own = words.filter((h) => h.p === p);
  const low = text.toLowerCase();
  const out = [];
  const seen = new Set();
  for (const h of words) {
    const w = h.text.trim().toLowerCase();
    if (!w || seen.has(w)) continue;
    seen.add(w);
    for (let i = low.indexOf(w); i !== -1; i = low.indexOf(w, i + 1)) {
      const e = i + w.length;
      if (joinsBefore(text, i) || joinsAfter(text, e)) continue;
      if (own.some((x) => x.s < e && x.e > i) || out.some((x) => x.s < e && x.e > i)) continue;
      out.push({ id: h.id, p, s: i, e, t: 'word', echo: true });
    }
  }
  return out;
}

// Words saved in other articles are marked here too ("far" echoes): a word met again in another
// text is the one worth learning. Each carries its vocabulary entry's id, so hovering shows the
// translation written there, and clicking offers to save it for this article as well.
let farIdx = null;
const TOKEN = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;
function farWords() {
  const cur = state.current && state.current.id;
  let n = 0;
  for (const a of Object.values(state.notes.articles)) n += a.vocab ? a.vocab.length : 0;
  const sig = cur + ':' + n;
  if (farIdx && farIdx.sig === sig) return farIdx;
  // first word → the entries starting with it, longest first (a phrase wins over its first word)
  const byFirst = new Map();
  const byId = new Map();
  const byWord = new Map();
  for (const [id, a] of Object.entries(state.notes.articles)) {
    if (id === cur || !a.vocab) continue;
    for (const v of a.vocab) {
      const w = (v.word || '').trim().toLowerCase();
      const first = w.match(TOKEN);
      if (!first || !w.startsWith(first[0])) continue;
      byId.set(v.hlId, v);
      // the same word saved in several articles: the one with a translation speaks for all
      const had = byWord.get(w);
      if (had && (had.tr.trim() || !v.tr.trim())) continue;
      byWord.set(w, v);
    }
  }
  for (const [w, v] of byWord) {
    const k = w.match(TOKEN)[0];
    if (!byFirst.has(k)) byFirst.set(k, []);
    byFirst.get(k).push({ w, v });
  }
  for (const list of byFirst.values()) list.sort((a, b) => b.w.length - a.w.length);
  return (farIdx = { sig, byFirst, byId, byWord });
}

function farMarks(text, p, taken) {
  const { byFirst } = farWords();
  if (!byFirst.size) return [];
  const low = text.toLowerCase();
  const out = [];
  for (const m of low.matchAll(TOKEN)) {
    const list = byFirst.get(m[0].match(TOKEN)[0]);
    if (!list) continue;
    const i = m.index;
    for (const { w, v } of list) {
      const e = i + w.length;
      if (!low.startsWith(w, i) || joinsAfter(text, e)) continue;
      if (taken.some((x) => x.s < e && x.e > i) || out.some((x) => x.s < e && x.e > i)) continue;
      out.push({ id: v.hlId, p, s: i, e, t: 'word', echo: true, far: true });
      break;
    }
  }
  return out;
}

function paraHtml(text, hls, p) {
  const own = hls.filter((h) => h.p === p && h.e > h.s).concat(echoMarks(text, hls, p));
  const mine = own.concat(farMarks(text, p, own.filter((h) => h.t === 'word')));
  if (!mine.length) return esc(text);
  const cuts = new Set([0, text.length]);
  for (const h of mine) cuts.add(Math.max(0, h.s)), cuts.add(Math.min(text.length, h.e));
  const pts = [...cuts].sort((a, b) => a - b);
  let out = '';
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const seg = esc(text.slice(a, b));
    const on = mine.filter((h) => h.s <= a && h.e >= b);
    if (!on.length) {
      out += seg;
      continue;
    }
    const cls = [...new Set(on.map((h) => h.t))].join(' ');
    // topmost = the shortest (most specific) mark covering this segment
    // (on a tie the vocabulary word wins, so its popover/tooltip/animations target it)
    const top = on.reduce((x, y) => (y.e - y.s < x.e - x.s || (y.e - y.s === x.e - x.s && y.t === 'word') ? y : x));
    const far = top.far ? ` far" data-s="${top.s}" data-e="${top.e}` : '';
    out += `<mark class="${cls}${top.echo ? ' echo' : ''}${far}" data-h="${top.id}">${seg}</mark>`;
  }
  return out;
}

// each paragraph remembers the markup it was given (_h), so a rerender that changes nothing
// leaves it alone: its text keeps its layout and the next measurement doesn't relayout the article
function rerenderPara(p, onlyIfChanged) {
  const el = $(`#doc .para[data-p="${p}"] .ptext`);
  if (!el) return;
  const html = paraHtml(state.current.data.blocks[p].text, rec(state.current.id).hl, p);
  if (onlyIfChanged && el._h === html) return;
  el.innerHTML = el._h = html;
}
// vocabulary changes ripple through the whole article (echo marks), but only the paragraphs
// where the word actually occurs change
function rerenderAllParas() {
  $$('#doc .para').forEach((el) => rerenderPara(+el.dataset.p, true));
}

/* scroll progress */
let progTimer;
let rafPending = false;
function onScroll() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    const sc = $('#scroller');
    const max = sc.scrollHeight - sc.clientHeight;
    const ratio = max > 0 ? Math.min(1, sc.scrollTop / max) : 1;
    $('#progress').style.transform = `scaleX(${ratio})`;
    $('#bar-title').classList.toggle('show', sc.scrollTop > 140);
    if (typeof Inky !== 'undefined' && state.current) Inky.read(ratio, state.current.id); // starry-eyed at the end
    updateRail();
    if (state.pop) hidePop();
    hideTip();
    if (!state.current) return;
    clearTimeout(progTimer);
    progTimer = setTimeout(() => {
      const r = rec(state.current.id);
      r.pos = ratio;
      Stats.progress(state.current.meta.words, r.progress || 0, ratio);
      r.progress = Math.max(r.progress || 0, ratio);
      if (r.progress >= 0.95 && !r.doneAt) r.doneAt = Date.now(); // the plan counts the day it was finished
      save();
    }, 400);
  });
}
$('#scroller').addEventListener('scroll', onScroll, { passive: true });
// the top blur band only shows once something has scrolled under it
for (const [sc, view] of [[$('#library'), $('#library')], [$('#scroller'), $('#reader')]]) {
  sc.addEventListener('scroll', () => view.classList.toggle('scrolled', sc.scrollTop > 4), { passive: true });
}
// the pinned library header condenses to one slim row once the list is under way;
// the gap between the two thresholds keeps it from flickering as its height changes
// The change is one continuous move (FLIP): every part of the header is measured, the compact
// layout is put in at once, and each part glides from where it was to where it now is by
// transform only — the title scales down as it goes, the buttons move up beside it, the chips,
// the search row and the list follow. Nothing is laid out frame by frame.
const FLIP_PARTS = ['.lib-head h1', '.lib-actions', '.lib-chips', '.lib-tools', '#import-bar', '#list', '.lib-top .pblur-top'];
// the header's own background is a layer of its own, so it can shrink with the rest (by scale)
const libBg = Object.assign(document.createElement('i'), { className: 'lib-bg' });
$('.lib-top').prepend(libBg);
function setCompact(lib, on) {
  if (lib.classList.contains('compact') === on) return;
  Haptic.level();
  if (reduceMotion.matches) return void lib.classList.toggle('compact', on);
  const els = FLIP_PARTS.map((s) => $(s, lib)).filter((el) => el && !el.hidden);
  for (const el of els) el.getAnimations().forEach((a) => a.finish());
  const top = $('.lib-top', lib);
  const before = els.map((el) => el.getBoundingClientRect());
  const hA = top.offsetHeight;
  lib.classList.add('flip');
  lib.classList.toggle('compact', on);
  const after = els.map((el) => el.getBoundingClientRect());
  const hB = top.offsetHeight;
  lib.classList.remove('flip');
  libBg.getAnimations().forEach((a) => a.finish());
  if (hB && Math.abs(hA - hB) > 0.5) libBg.animate([{ transform: `scaleY(${hA / hB})` }, { transform: 'none' }], { duration: 460, easing: 'cubic-bezier(0.32, 0.72, 0, 1)' });
  els.forEach((el, i) => {
    const a = before[i];
    const b = after[i];
    const dx = a.left - b.left;
    const dy = a.top - b.top;
    const s = el.matches('h1') && b.height ? a.height / b.height : 1;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(s - 1) < 0.005) return;
    el.animate([{ transformOrigin: '0 0', transform: `translate(${dx}px, ${dy}px) scale(${s})` }, { transformOrigin: '0 0', transform: 'none' }], { duration: 460, easing: 'cubic-bezier(0.32, 0.72, 0, 1)' });
  });
}
// The shelf titles and the buttons share one row. When the row is narrower than both, the titles'
// type shrinks to fit (down to 18px) rather than the buttons wrapping under them.
(function fitHead() {
  const head = $('.lib-head');
  const shelf = $('#shelf');
  const acts = $('.lib-actions');
  if (!head || !shelf || !acts) return;
  const BASE = 28;
  const TIGHT = 20; // below this the "+ Add" button gives up its words first
  const add = $('#btn-add');
  let actsFull = 0; // the buttons' width with "+ Add"'s words and their usual spacing
  const fit = () => {
    if ($('#library').classList.contains('compact') || !head.clientWidth) return;
    const cs = getComputedStyle(shelf);
    const cur = parseFloat(cs.fontSize) || BASE;
    const btns = [...shelf.children];
    const gaps = (parseFloat(cs.columnGap) || 0) * (btns.length - 1);
    const text = btns.reduce((n, b) => n + b.getBoundingClientRect().width, 0);
    const tight = head.classList.contains('tight');
    // a phone (web.css): the buttons have a row of their own under the titles, which take it all
    const own = getComputedStyle(head).flexWrap === 'wrap';
    if (own && tight) return head.classList.remove('tight');
    const actsW = own ? 0 : acts.getBoundingClientRect().width;
    if (!tight) actsFull = actsW;
    const room = head.clientWidth - actsW - (own ? 0 : parseFloat(getComputedStyle(head).columnGap) || 0) - gaps - 2;
    const size = (r) => Math.floor(((cur * r) / text) * 4) / 4;
    // with its words back, would the names still be at least TIGHT + 1?
    const full = tight ? size(room - (actsFull - actsW)) : size(room);
    if (add && !own) {
      if (!tight && full < TIGHT) return (add.title = add.textContent), head.classList.add('tight');
      if (tight && full >= TIGHT + 1) return head.classList.remove('tight');
    }
    const want = Math.max(14, Math.min(BASE, size(room)));
    if (Math.abs(want - cur) >= 0.25) head.style.setProperty('--shelf-size', want + 'px');
  };
  const ro = new ResizeObserver(() => requestAnimationFrame(fit));
  ro.observe(head);
  ro.observe(acts);
  document.fonts.ready.then(fit);
})();
$('#library').addEventListener('scroll', (e) => {
  const lib = e.currentTarget;
  if (lib.scrollTop > 60) setCompact(lib, true);
  else if (lib.scrollTop < 8) setCompact(lib, false);
}, { passive: true });

$('#btn-back').addEventListener('click', backToLibrary);
async function backToLibrary() {
  if (state.view === 'library') return;
  if (typeof Focus !== 'undefined') Focus.off();
  setEditMode(false);
  Test.close();
  if (state.vocabScope === 'article') closeDrawer();
  refreshItem();
  await settled();
  // an article or an episode opened from the plan page goes back there (plan.js)
  const to = state.backTo;
  state.backTo = null;
  if (to === 'plan' && state.view !== 'plan' && typeof Plan !== 'undefined') return Plan.back();
  showView('library');
}
// two-finger swipe right on the trackpad goes back, like the iOS edge swipe
let swipeX = 0, swipeT;
for (const v of [$('#reader'), $('#stats'), $('#cards'), $('#settings'), $('#watch'), $('#plan')]) v.addEventListener('wheel', (e) => {
  if (state.view === 'library' || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
  swipeX = e.deltaX < 0 ? swipeX - e.deltaX : 0;
  clearTimeout(swipeT);
  swipeT = setTimeout(() => (swipeX = 0), 200);
  if (swipeX > 140) { swipeX = 0; backToLibrary(); }
}, { passive: true });
$('#btn-pdf').addEventListener('click', () => state.current && api.openPdf(state.current.id));

/* interface language */
function setLang(l) {
  lang = LANGS.includes(l) ? l : 'uz';
  try {
    localStorage.setItem('a365.lang', lang);
  } catch {}
  applyI18n();
  $$('#lang-menu button').forEach((b) => b.classList.toggle('on', b.dataset.lang === lang));
  $('#inbox-path').textContent = state.inboxPath || ''; // empty-state text was just re-rendered
  if (typeof Test !== 'undefined' && Test.isOpen()) Test.render();
  if (state.view === 'cards') Cards.render();
  if (typeof Player !== 'undefined') Player.render();
  if (typeof Plan !== 'undefined') state.view === 'plan' ? Plan.render() : Plan.badge();
}
// stats, folder, theme and language live in the ⋯ menu to keep the header calm
$('#btn-more').addEventListener('click', () => $('#more-menu').classList.toggle('show'));
$('#lang-menu').addEventListener('click', (e) => {
  const b = e.target.closest('[data-lang]');
  if (!b || b.dataset.lang === lang) return;
  state.notes.settings.lang = b.dataset.lang;
  save();
  setLang(b.dataset.lang);
  renderLibrary(true);
  if (state.current) renderDoc();
  if (drawerOpen()) renderVocab();
  if (state.view === 'stats') Stats.render();
});

/* theme: saved choice, else follows macOS */
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  try {
    localStorage.setItem('a365.theme', t); // the launch card (splash.js) opens in it next time
  } catch {}
  $$('.theme-btn:not(:has(.theme-ico)), .theme-ico').forEach((b) => (b.textContent = t === 'dark' ? '☀' : '☾'));
}
// the new theme grows as a circle out of the toggle button (D key: the visible one)
function toggleTheme(from) {
  const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  state.notes.settings.theme = t;
  save();
  const btn = from || $('.view.is-active .theme-btn') || $('.view.is-active #btn-more');
  if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) return applyTheme(t);
  const r = btn ? btn.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0 };
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  const end = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  $$('.theme-btn').forEach((b) => (b.classList.remove('spin'), void b.offsetWidth, b.classList.add('spin')));
  const vt = document.startViewTransition(() => applyTheme(t));
  vt.ready.then(() => {
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${end}px at ${x}px ${y}px)`] },
      { duration: 650, easing: 'cubic-bezier(0.32, 0.72, 0, 1)', pseudoElement: '::view-transition-new(root)' }
    );
  });
}
$$('.theme-btn').forEach((b) => b.addEventListener('click', () => toggleTheme(b)));
$('#btn-theme-menu').addEventListener('click', () => (closeMenu(), toggleTheme($('#btn-more'))));
const darkMq = matchMedia('(prefers-color-scheme: dark)');
darkMq.addEventListener('change', (e) => !state.notes.settings.theme && applyTheme(e.matches ? 'dark' : 'light'));

/* statistics page */
$('#btn-stats').addEventListener('click', () => {
  closeMenu();
  closeDrawer();
  Stats.render($('#stats-body'));
  // ~9,000 elements: styled and laid out while the page still waits off screen (.warm), so the
  // slide's first frame doesn't do it all at once (it dropped a frame every time)
  $('#stats').classList.add('warm');
  settled().then(() => (showView('stats'), $('#stats').classList.remove('warm')));
});
$('#stats-back').addEventListener('click', backToLibrary);

/* font size: stored in px, shown as a percentage of the 20px default */
const FONT_BASE = 20;
const PCT_MIN = 50;
const PCT_MAX = 200;
let fontAnim = null;
function applyFont(animate) {
  const s = state.notes.settings.fontSize || FONT_BASE;
  const root = document.documentElement;
  const prev = parseFloat(root.style.getPropertyValue('--read-size')) || s;
  // The text grows in place instead of jumping: the new size is laid out at once, the
  // paragraph being read is kept where it was, and a scale on the compositor carries the
  // column from how it looked to how it is now. A step that comes mid-way starts from
  // whatever the eye sees at that moment.
  const doc = $('#doc');
  const sc = $('#scroller');
  const live = animate && prev !== s && state.view === 'reader' && $('#reader').classList.contains('is-active') && !reduceMotion.matches;
  const focused = live && typeof Focus !== 'undefined' && Focus.isOn();
  let anchor = null;
  let at = 0;
  let k = 1;
  if (live) {
    const top = sc.getBoundingClientRect().top;
    anchor = $('.para.f-on', doc) || $$('.para[data-p]', doc).find((p) => p.getBoundingClientRect().bottom > top + 56);
    at = anchor && anchor.getBoundingClientRect().top;
    k = new DOMMatrix(getComputedStyle(doc).transform).a || 1;
  }
  if (fontAnim) fontAnim.cancel(), (fontAnim = null);
  root.style.setProperty('--read-size', s + 'px');
  $('#font-pct').value = Math.round((s / FONT_BASE) * 100) + '%';
  if (!anchor) return typeof Focus !== 'undefined' && Focus.refresh();
  const to = focused ? Focus.settle(anchor) : at;
  sc.scrollTop += anchor.getBoundingClientRect().top - to;
  const now = anchor.getBoundingClientRect().top;
  const oy = now - doc.getBoundingClientRect().top;
  fontAnim = doc.animate(
    [
      { transformOrigin: `50% ${oy}px`, transform: `translateY(${at - now}px) scale(${(prev * k) / s})` },
      { transformOrigin: `50% ${oy}px`, transform: 'none' },
    ],
    { duration: 320, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
  );
  fontAnim.onfinish = () => (fontAnim = null);
}
function setFontPct(pct) {
  pct = Math.min(PCT_MAX, Math.max(PCT_MIN, pct));
  state.notes.settings.fontSize = (FONT_BASE * pct) / 100;
  applyFont(true);
  save();
}
// A−/A+ and ⌘−/⌘+ step by 5%
function changeFont(d) {
  const pct = Math.round(((state.notes.settings.fontSize || FONT_BASE) / FONT_BASE) * 100);
  setFontPct(Math.round(pct / 5) * 5 + d * 5);
}
$('#font-dec').addEventListener('click', () => changeFont(-1));
$('#font-inc').addEventListener('click', () => changeFont(1));
$('#font-pct').addEventListener('focus', (e) => e.target.select());
$('#font-pct').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') e.target.blur();
  else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') (e.preventDefault(), changeFont(e.key === 'ArrowUp' ? 1 : -1), e.target.select());
});
$('#font-pct').addEventListener('change', (e) => {
  const n = parseFloat(e.target.value.replace(',', '.'));
  if (Number.isFinite(n)) setFontPct(n);
  else applyFont(); // not a number: put the current value back
});

/* rename */
$('#doc').addEventListener('dblclick', (e) => {
  const h = e.target.closest('#doc-title');
  if (!h) return;
  h.contentEditable = 'true';
  h.focus();
  document.getSelection().selectAllChildren(h);
  const done = () => {
    h.contentEditable = 'false';
    const t = h.textContent.replace(/\s+/g, ' ').trim();
    rec(state.current.id).title = t && t !== state.current.meta.title ? t : undefined;
    save();
    $('#bar-title').textContent = titleOf(state.current.meta);
    h.removeEventListener('blur', done);
  };
  h.addEventListener('blur', done);
  h.addEventListener('keydown', (k) => {
    if (k.key === 'Enter') (k.preventDefault(), h.blur());
  });
});

/* ---------------- selection → highlight / vocab ---------------- */

function textOffset(root, node, offset) {
  const r = document.createRange();
  r.setStart(root, 0);
  r.setEnd(node, offset);
  return r.toString().length;
}

// Converts the DOM selection into per-paragraph [s, e) ranges, snapped to whole words.
function readSelection() {
  const sel = document.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
  const range = sel.getRangeAt(0);
  const paras = $$('#doc .para').filter((el) => range.intersectsNode($('.ptext', el)));
  if (!paras.length) return null;
  const parts = [];
  for (const el of paras) {
    const pt = $('.ptext', el);
    const p = +el.dataset.p;
    const text = state.current.data.blocks[p].text;
    let s = pt.contains(range.startContainer) ? textOffset(pt, range.startContainer, range.startOffset) : 0;
    let e = pt.contains(range.endContainer) ? textOffset(pt, range.endContainer, range.endOffset) : text.length;
    while (s > 0 && WORD.test(text[s - 1]) && WORD.test(text[s])) s--;
    while (e < text.length && WORD.test(text[e]) && WORD.test(text[e - 1])) e++;
    while (s < e && /[\s"“”‘'(),.;:!?—–-]/.test(text[s])) s++;
    while (e > s && /[\s"“”’'(),.;:!?—–-]/.test(text[e - 1])) e--;
    if (e > s) parts.push({ p, s, e, text: text.slice(s, e) });
  }
  return parts.length ? { parts, rect: range.getBoundingClientRect() } : null;
}

function sentenceAround(text, s, e) {
  let a = s;
  while (a > 0 && !/[.!?]/.test(text[a - 1])) a--;
  let b = e;
  while (b < text.length && !/[.!?]/.test(text[b])) b++;
  return text.slice(a, Math.min(text.length, b + 1)).trim();
}

function placePop(rect) {
  const pop = $('#pop');
  pop.style.left = '0px';
  pop.style.top = '0px';
  pop.classList.add('show');
  const w = pop.offsetWidth;
  const h = pop.offsetHeight;
  let x = rect.left + rect.width / 2 - w / 2;
  x = Math.max(12, Math.min(window.innerWidth - w - 12, x));
  let y = rect.top - h - 12;
  // on a touch screen the phone's own Copy/Look Up menu sits above the selection: go under it
  const below = y < 64 || (touchy && state.pop && rect.bottom + h + 24 < window.innerHeight);
  if (below) y = rect.bottom + 12;
  pop.dataset.side = below ? 'below' : 'above';
  pop.style.setProperty('--ax', Math.max(16, Math.min(w - 16, rect.left + rect.width / 2 - x)) + 'px');
  pop.style.left = x + 'px';
  pop.style.top = y + 'px';
}

function showPopForSelection() {
  if (state.view !== 'reader') return;
  const sel = readSelection();
  if (!sel) return hidePop();
  state.pop = { mode: 'select', sel };
  $('#pop').dataset.mode = 'select';
  placePop(sel.rect);
}

function showPopForMark(mark, y) {
  // a word saved in another article: offered like a selection, to save it here too
  if (mark.classList.contains('far')) {
    const p = +mark.closest('.para').dataset.p;
    const s = +mark.dataset.s;
    const e = +mark.dataset.e;
    state.pop = { mode: 'select', sel: { parts: [{ p, s, e, text: state.current.data.blocks[p].text.slice(s, e) }] } };
    $('#pop').dataset.mode = 'select';
    return placePop(lineRect(mark, y));
  }
  const h = rec(state.current.id).hl.find((x) => x.id === mark.dataset.h);
  if (!h) return;
  state.pop = { mode: 'mark', hlId: h.id };
  $('#pop').dataset.mode = h.t === 'word' ? 'mark-word' : 'mark-hl';
  // a mark wrapped onto two lines: point at the line that was clicked, not the box around both
  placePop(lineRect(mark, y));
}

function hidePop() {
  $('#pop').classList.remove('show');
  state.pop = null;
}

/* The native selection paints the whole line box, which looks blocky next to the marks.
   In the article text it is hidden and redrawn here with the exact shape of a vocabulary
   mark (glyph height + 0.05em, same colour), blended so the text stays on top. */
let selfxRaf = 0;
function drawSelection() {
  selfxRaf = 0;
  const fx = $('#selfx');
  const sel = document.getSelection();
  const range = sel && !sel.isCollapsed && sel.rangeCount && sel.getRangeAt(0);
  const anc = range && range.commonAncestorContainer;
  if (!range || state.view !== 'reader' || !$('#doc').contains(anc) || (anc.nodeType === 1 ? anc : anc.parentElement).closest('.editing')) {
    fx.classList.remove('on');
    return;
  }
  const sc = $('#scroller');
  const box = sc.getBoundingClientRect();
  const html = [];
  for (const pt of $$('#doc .ptext')) {
    if (!range.intersectsNode(pt)) continue;
    const pad = parseFloat(getComputedStyle(pt).fontSize) * 0.05;
    const walker = document.createTreeWalker(pt, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!range.intersectsNode(n)) continue;
      const r = document.createRange();
      r.selectNodeContents(n);
      if (n === range.startContainer) r.setStart(n, range.startOffset);
      if (n === range.endContainer) r.setEnd(n, range.endOffset);
      for (const q of r.getClientRects()) {
        if (q.width < 1) continue;
        const top = q.top - box.top + sc.scrollTop - pad;
        html.push(`<i style="left:${q.left - box.left + sc.scrollLeft}px;top:${top}px;width:${q.width}px;height:${q.height + pad * 2}px"></i>`);
      }
    }
  }
  fx.innerHTML = html.join('');
  fx.classList.toggle('on', html.length > 0);
}
const queueSelection = () => selfxRaf || (selfxRaf = requestAnimationFrame(drawSelection));
document.addEventListener('selectionchange', queueSelection);

/* Touch: a selection is made by a long press and its handles, with no mouseup at the end, so
   the menu follows the selection itself, once it has stopped changing for a moment. */
let touchy = false;
addEventListener('pointerdown', (e) => (touchy = e.pointerType !== 'mouse'), true);
let touchSelT = 0;
document.addEventListener('selectionchange', () => {
  if (!touchy || state.view !== 'reader' || editMode()) return;
  clearTimeout(touchSelT);
  touchSelT = setTimeout(() => {
    const sel = document.getSelection();
    const anc = sel && sel.rangeCount && sel.getRangeAt(0).commonAncestorContainer;
    const el = anc && (anc.nodeType === 1 ? anc : anc.parentElement);
    if (sel && !sel.isCollapsed && el && $('#doc').contains(el) && !el.closest('.note, .ptool, .para.editing')) showPopForSelection();
    else if (state.pop && state.pop.mode === 'select') hidePop();
  }, 250);
});
window.addEventListener('resize', queueSelection);

/* hovering a vocabulary word shows the translation I wrote for it */
// a word wrapped onto two lines has a box per line: use the line nearest the pointer
// (the first one when there is no pointer), not the box around both lines
function lineRect(mark, y) {
  const rs = [...mark.getClientRects()];
  if (!rs.length) return mark.getBoundingClientRect();
  const mid = (r) => (r.top + r.bottom) / 2;
  const at = y == null ? rs[0] : rs.reduce((a, b) => (Math.abs(mid(b) - y) < Math.abs(mid(a) - y) ? b : a));
  const line = rs.filter((r) => Math.abs(r.top - at.top) < 2);
  const left = Math.min(...line.map((r) => r.left));
  const right = Math.max(...line.map((r) => r.right));
  return { left, right, width: right - left, top: at.top, bottom: at.bottom };
}

let tipAt = null; // the line the tip points at
function showTip(mark, y) {
  const r = rec(state.current.id);
  let v = r.vocab.find((x) => x.hlId === mark.dataset.h);
  if (!v && mark.classList.contains('far')) v = farWords().byId.get(mark.dataset.h);
  if (!v || !v.tr.trim()) return hideTip();
  const tip = $('#tip');
  tip.innerHTML = `<span class="tip-w">${esc(v.word)}</span><span class="tip-tr">${esc(v.tr.trim())}</span>`;
  const m = (tipAt = lineRect(mark, y));
  const w = tip.offsetWidth;
  const h = tip.offsetHeight;
  const x = Math.max(12, Math.min(window.innerWidth - w - 12, m.left + m.width / 2 - w / 2));
  const below = m.top - h - 12 < 64;
  tip.dataset.side = below ? 'below' : 'above';
  // the little arrow keeps pointing at the word even when the card is pushed off-centre
  tip.style.setProperty('--ax', Math.max(14, Math.min(w - 14, m.left + m.width / 2 - x)) + 'px');
  tip.style.left = x + 'px';
  tip.style.top = (below ? m.bottom + 12 : m.top - h - 12) + 'px';
  tip.classList.add('show');
}
function hideTip() {
  $('#tip').classList.remove('show');
}
$('#doc').addEventListener('mouseover', (e) => {
  const mark = e.target.closest('mark.word');
  if (mark && !state.pop && !editMode()) showTip(mark, e.clientY);
});
// moving to the other line of a wrapped word moves the tip with it
$('#doc').addEventListener('mousemove', (e) => {
  const mark = e.target.closest('mark.word');
  if (!mark || state.pop || !$('#tip').classList.contains('show')) return;
  if (!tipAt || lineRect(mark, e.clientY).top !== tipAt.top) showTip(mark, e.clientY);
});
$('#doc').addEventListener('mouseout', (e) => {
  if (e.target.closest('mark.word') && !(e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('mark.word'))) hideTip();
});

$('#doc').addEventListener('mouseup', (e) => {
  if (editMode() || e.target.closest('.note, .ptool, .para.editing')) return;
  setTimeout(() => {
    const sel = document.getSelection();
    if (sel && !sel.isCollapsed) return showPopForSelection();
    const mark = e.target.closest('mark');
    if (!mark) return hidePop();
    showPopForMark(mark, e.clientY);
    // no hover on a touch screen: a tapped word shows its translation above, the menu below
    if (touchy && mark.classList.contains('word')) showTip(mark, e.clientY);
  }, 0);
});
document.addEventListener('mousedown', (e) => {
  hideTip();
  if (!e.target.closest('#pop') && !e.target.closest('mark')) hidePop();
  if (!e.target.closest('.menu-wrap')) closeMenu();
});

$('#pop').addEventListener('mousedown', (e) => e.preventDefault());
// a tap would clear the selection before the click arrives: the button acts on the touch itself
$('#pop').addEventListener('touchstart', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  e.preventDefault();
  b.classList.add('press');
}, { passive: false });
$('#pop').addEventListener('touchend', (e) => {
  const b = e.target.closest('button');
  $$('#pop button.press').forEach((x) => x.classList.remove('press'));
  if (!b) return;
  e.preventDefault();
  popAction(b.dataset.act);
}, { passive: false });
$('#pop').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b) popAction(b.dataset.act);
});

function popAction(act) {
  const pop = state.pop;
  if (!pop || !state.current) return;
  if (pop.mode === 'select' && (act === 'hl' || act === 'word')) addMarks(pop.sel.parts, act, true);
  else if (pop.mode === 'mark' && act === 'del') removeMark(pop.hlId);
  else if (pop.mode === 'mark' && (act === 'hl' || act === 'word')) {
    const h = rec(state.current.id).hl.find((x) => x.id === pop.hlId);
    if (h) addMarks([{ p: h.p, s: h.s, e: h.e, text: h.text }], act);
  }
  document.getSelection().removeAllRanges();
  hidePop();
}

// fromSel: the selection overlay already paints the background, so it is not swept in again
function addMarks(parts, type, fromSel) {
  const r = rec(state.current.id);
  const created = [];
  // a vocabulary entry is one word/phrase, so only the first paragraph counts
  for (const part of type === 'word' ? parts.slice(0, 1) : parts) {
    const dupe = r.hl.find((h) => h.p === part.p && h.s === part.s && h.e === part.e && h.t === type);
    if (dupe) continue;
    if (type === 'word') {
      // the same word is already in the list: just point at it instead of adding it twice
      const known = r.vocab.find((x) => x.word.trim().toLowerCase() === part.text.trim().toLowerCase());
      if (known) {
        if (!drawerOpen()) (setScope('article'), openDrawer());
        flushVocab();
        const el = $(`#vocab-body .vrow[data-v="${known.id}"]`);
        if (el) (el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), markNewRow(el, 0));
        continue;
      }
    }
    const h = { id: uid(), p: part.p, s: part.s, e: part.e, t: type, text: part.text, at: Date.now() };
    r.hl.push(h);
    created.push(h);
    if (type === 'word') {
      const text = state.current.data.blocks[part.p].text;
      // met before in another article: its translation comes along
      const far = farWords().byWord.get(part.text.trim().toLowerCase());
      r.vocab.push({ id: uid(), hlId: h.id, word: part.text, ctx: sentenceAround(text, part.s, part.e), tr: far ? far.tr : '', p: part.p, at: Date.now() });
    }
  }
  if (!created.length) return;
  save();
  if (type === 'word') rerenderAllParas();
  else for (const p of new Set(created.map((h) => h.p))) rerenderPara(p);
  // a word that was already highlighted (or selected) keeps its background, only the underline draws in;
  // a highlight made from a selection just stays as the selection looked
  for (const h of created)
    $$(`#doc mark[data-h="${h.id}"]`).forEach((m) => {
      const own = !m.classList.contains('echo');
      if (h.t === 'word') m.classList.add(m.classList.contains('hl') || (fromSel && own) ? 'fresh-line' : 'fresh');
      else if (!fromSel) m.classList.add('fresh');
    });
  if (type === 'word') {
    updateVocabCount(true);
    if (typeof Inky !== 'undefined') Inky.cheer(created[0].text.trim()); // a new word: Inky is pleased and says it
    // drawer already open: the new word just slides in on top, the rest of the list stays put
    // the drawer follows a frame later: the marks redraw in one frame, the list fills in the next
    if (drawerOpen()) requestAnimationFrame(() => prependVocab(created[0].id));
    else requestAnimationFrame(() => (setScope('article'), openDrawer(created[0].id)));
  }
}

function removeMark(hlId) {
  const r = rec(state.current.id);
  const h = r.hl.find((x) => x.id === hlId);
  if (!h) return;
  r.hl = r.hl.filter((x) => x.id !== hlId);
  if (h.t === 'word') {
    const v = r.vocab.find((x) => x.hlId === hlId);
    if (v && v.tr.trim() && !confirm(t('vocab.confirmDel', v.word))) {
      r.hl.push(h);
      return;
    }
    r.vocab = r.vocab.filter((x) => x.hlId !== hlId);
    if (typeof Inky !== 'undefined') Inky.unword(h.text.trim(), !!(v && v.tr.trim())); // a word let go
    updateVocabCount();
    if (v) removeVocabRow(v.id);
  }
  save();
  fadeOutMarks(h, () => (h.t === 'word' ? rerenderAllParas() : rerenderPara(h.p)));
}

// Let a removed mark's background/underline wipe away before the paragraph is redrawn without it.
function fadeOutMarks(h, then) {
  const marks = $$(`#doc mark[data-h="${h.id}"]`);
  if (!marks.length || reduceMotion.matches) return then();
  marks.forEach((m) => m.classList.add('leaving-' + h.t));
  setTimeout(then, 470);
}

/* ---------------- fixing the article text ---------------- */
// Edit mode (the bar button or E): marks and popovers rest, clicking a paragraph or heading
// opens its text for fixing with the caret where I clicked.
const editMode = () => document.body.classList.contains('edit-mode');
function setEditMode(on) {
  if (!on && document.activeElement && document.activeElement.closest('.para.editing')) document.activeElement.blur();
  document.body.classList.toggle('edit-mode', on);
  $('#btn-edit').setAttribute('aria-pressed', String(on));
  hidePop();
  hideTip();
}
$('#btn-edit').addEventListener('click', () => setEditMode(!editMode()));
$('#doc').addEventListener('mousedown', (e) => {
  if (!editMode() || e.button !== 0) return;
  const para = e.target.closest('.para[data-p]');
  if (!para || para.classList.contains('editing') || !e.target.closest('.ptext')) return;
  e.preventDefault();
  startEdit(+para.dataset.p, e.clientX, e.clientY);
});
// Fixes are kept with my notes (r.edits[p] = new text), the imported article stays as it was.
// block.orig remembers the imported text, so editing it back drops the fix.
function applyEdits(data, r) {
  for (const [p, text] of Object.entries(r.edits || {})) {
    const b = data.blocks[p];
    if (b) (b.orig ??= b.text), (b.text = text);
  }
}

// Character alignment old → new (LCS on what lies between the common prefix and suffix).
// For every old boundary i: lo[i] = new position before anything inserted there, hi[i] = after it.
function alignText(a, b) {
  let pre = 0;
  while (pre < a.length && pre < b.length && a[pre] === b[pre]) pre++;
  let suf = 0;
  while (suf < a.length - pre && suf < b.length - pre && a[a.length - 1 - suf] === b[b.length - 1 - suf]) suf++;
  const x = a.slice(pre, a.length - suf);
  const y = b.slice(pre, b.length - suf);
  const n = x.length;
  const m = y.length;
  const ops = [];
  if (n * m <= 4e6) {
    const w = m + 1;
    const dp = new Uint16Array((n + 1) * w);
    for (let i = n - 1; i >= 0; i--)
      for (let j = m - 1; j >= 0; j--) dp[i * w + j] = x[i] === y[j] ? dp[(i + 1) * w + j + 1] + 1 : Math.max(dp[(i + 1) * w + j], dp[i * w + j + 1]);
    let i = 0;
    let j = 0;
    while (i < n || j < m) {
      if (i < n && j < m && x[i] === y[j]) ops.push('k'), i++, j++;
      else if (j < m && (i === n || dp[i * w + j + 1] >= dp[(i + 1) * w + j])) ops.push('i'), j++;
      else ops.push('d'), i++;
    }
  } else ops.push(...'d'.repeat(n), ...'i'.repeat(m));
  const lo = new Array(a.length + 1);
  const hi = new Array(a.length + 1);
  for (let k = 0; k <= pre; k++) lo[k] = hi[k] = k;
  let i = pre;
  let j = pre;
  for (const op of ops) {
    if (op === 'i') (j++, (hi[i] = j));
    else (i++, j += op === 'k' ? 1 : 0, (lo[i] = hi[i] = j));
  }
  for (let k = 1; k <= suf; k++) lo[i + k] = hi[i + k] = j + k;
  return { lo, hi };
}

function startEdit(p, x, y) {
  const para = $(`#doc .para[data-p="${p}"]`);
  if (!para || para.classList.contains('editing')) return;
  hidePop();
  hideTip();
  const pt = $('.ptext', para);
  const block = state.current.data.blocks[p];
  // marks step aside while the plain text is edited, they come back where they belong
  pt.textContent = block.text;
  pt._h = null;
  para.classList.add('editing');
  // 'true' (not plaintext-only) so every shortcut handler already treats it as typing; pastes go in as plain text
  pt.contentEditable = 'true';
  pt.spellcheck = true;
  pt.focus({ preventScroll: true });
  const sel = document.getSelection();
  // the plain text lays out exactly like the marked one, so the click point still finds the right letter
  const at = x != null && document.caretRangeFromPoint(x, y);
  if (at && pt.contains(at.startContainer)) sel.setBaseAndExtent(at.startContainer, at.startOffset, at.startContainer, at.startOffset);
  else (sel.selectAllChildren(pt), sel.collapseToEnd());
  let done = false;
  const finish = (keep) => {
    if (done) return;
    done = true;
    pt.removeEventListener('blur', onBlur);
    pt.removeEventListener('keydown', onKey);
    pt.removeEventListener('paste', onPaste);
    pt.contentEditable = 'false';
    pt.removeAttribute('spellcheck');
    para.classList.remove('editing');
    const text = pt.textContent.replace(/\s+/g, ' ').trim();
    if (keep && text && text !== block.text) commitEdit(p, text);
    else rerenderPara(p);
  };
  const onBlur = () => finish(true);
  const onKey = (k) => {
    // Enter saves (a paragraph is one line of text), Esc puts it back as it was
    if (k.key === 'Enter') (k.preventDefault(), finish(true));
    else if (k.key === 'Escape') (k.preventDefault(), k.stopPropagation(), finish(false));
  };
  pt.addEventListener('blur', onBlur);
  const onPaste = (c) => {
    c.preventDefault();
    document.execCommand('insertText', false, c.clipboardData.getData('text/plain').replace(/\s+/g, ' '));
  };
  pt.addEventListener('keydown', onKey);
  pt.addEventListener('paste', onPaste);
}

function commitEdit(p, text) {
  const r = rec(state.current.id);
  const block = state.current.data.blocks[p];
  const { lo, hi } = alignText(block.text, text);
  for (const h of r.hl) {
    if (h.p !== p) continue;
    // text typed right at a mark's edge stays outside it; a mark whose text is gone collapses (and is hidden)
    h.s = hi[h.s];
    h.e = Math.max(h.s, lo[h.e]);
    h.text = text.slice(h.s, h.e);
    if (h.t !== 'word' || !h.text) continue;
    const v = r.vocab.find((x) => x.hlId === h.id);
    if (v) (v.word = h.text), (v.ctx = sentenceAround(text, h.s, h.e));
  }
  block.orig ??= block.text;
  block.text = text;
  r.edits ||= {};
  if (text === block.orig) delete r.edits[p];
  else r.edits[p] = text;
  save();
  rerenderAllParas();
  renderRail();
  if (drawerOpen()) renderVocab();
}

/* ---------------- paragraph conclusions ---------------- */

$('#doc').addEventListener('click', (e) => {
  const tool = e.target.closest('.ptool');
  if (tool) return toggleNote(+tool.closest('.para').dataset.p);
  const del = e.target.closest('[data-act="note-del"]');
  if (del) deleteNote(+del.closest('.para').dataset.p);
});

function toggleNote(p) {
  const r = rec(state.current.id);
  const para = $(`#doc .para[data-p="${p}"]`);
  let note = $('.note', para);
  const inFocus = typeof Focus !== 'undefined' && Focus.isOn();
  if (note) {
    $('textarea', note).focus({ preventScroll: true });
    return inFocus ? Focus.follow(para) : glideToNote(para, note);
  }
  r.notes[p] = '';
  para.classList.add('has-note');
  para.insertAdjacentHTML('beforeend', noteHtml(p, '').replace('note open', 'note'));
  note = $('.note', para);
  requestAnimationFrame(() => {
    note.classList.add('open');
    $('textarea', note).focus({ preventScroll: true });
    if (inFocus) Focus.follow(para);
    else glideToNote(para, note);
  });
}

// Smoothly bring the paragraph and its note box to the middle of the window, as one block.
// The target is measured once from the note's final (fully open) size, and the scroll
// runs on the same duration and curve as the note opening, so both move as one.
let glideId = 0;
const easeOut = (k) => 1 - Math.pow(1 - k, 4);
function glideToNote(para, note) {
  const sc = $('#scroller');
  const id = ++glideId;
  const from = sc.scrollTop;
  const box = $('.note-box', note);
  const top = sc.getBoundingClientRect().top;
  const openMargin = parseFloat(getComputedStyle(para).fontSize) * 0.7;
  const nr = note.getBoundingClientRect();
  const paraTop = para.getBoundingClientRect().top - top + from;
  // a note that is already open is measured as it is; a new one by the size it opens to
  const noteBottom = (nr.height > box.offsetHeight / 2 ? nr.bottom : nr.top + openMargin + box.offsetHeight) - top + from;
  const room = sc.scrollHeight + openMargin + box.offsetHeight - sc.clientHeight;
  const HEAD = 84; // the bar and its fade
  const FOOT = 40;
  const band = sc.clientHeight - HEAD - FOOT;
  const h = noteBottom - paraTop;
  // fits: centred in the band; too tall: the note box (where I type) stays in view
  const want = h <= band ? paraTop - HEAD - (band - h) / 2 : noteBottom - sc.clientHeight + FOOT + 60;
  const to = Math.max(0, Math.min(room, want));
  if (Math.abs(to - from) < 2) return;
  const dur = 480;
  const t0 = performance.now();
  const step = (now) => {
    if (id !== glideId) return;
    const k = Math.min(1, (now - t0) / dur);
    sc.scrollTop = from + (to - from) * easeOut(k);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  // the user grabbing the wheel/trackpad cancels the glide
  sc.addEventListener('wheel', () => { if (id === glideId) glideId++; }, { once: true, passive: true });
}

function deleteNote(p) {
  const r = rec(state.current.id);
  const para = $(`#doc .para[data-p="${p}"]`);
  const note = $('.note', para);
  delete r.notes[p];
  save();
  para.classList.remove('has-note');
  note.classList.remove('open');
  if (typeof Focus !== 'undefined') Focus.follow(para);
  setTimeout(() => note.remove(), 420);
}

$('#doc').addEventListener('input', (e) => {
  const ta = e.target.closest('.note textarea');
  if (!ta) return;
  autosize(ta);
  if (typeof Focus !== 'undefined') Focus.follow(ta.closest('.para'), 160); // a new line keeps the note in view
  rec(state.current.id).notes[+ta.closest('.para').dataset.p] = ta.value;
  save();
});
$('#doc').addEventListener(
  'blur',
  (e) => {
    const ta = e.target.closest && e.target.closest('.note textarea');
    if (ta && !ta.value.trim()) deleteNote(+ta.closest('.para').dataset.p);
  },
  true,
);

/* ---------------- vocabulary drawer ---------------- */

function updateVocabCount(animate) {
  const n = state.current ? rec(state.current.id).vocab.length : 0;
  const c = $('#vocab-count');
  c.textContent = n;
  if (animate) bump(c);
  const f = $('#focus-vcount');
  if (f) (f.textContent = n || ''), animate && bump(f);
}

function openDrawer(focusHlId) {
  Test.close();
  renderVocab(focusHlId, true); // filled before it moves, so the slide has nothing to lay out
  glide(() => document.body.classList.add('drawer-open'));
  $('#drawer').setAttribute('aria-hidden', 'false');
}
function closeDrawer() {
  if (!drawerOpen()) return;
  glide(() => document.body.classList.remove('drawer-open'));
  $('#drawer').setAttribute('aria-hidden', 'true');
}
const drawerOpen = () => document.body.classList.contains('drawer-open');

function setScope(s) {
  if (s === 'article' && !state.current) s = 'all';
  state.vocabScope = s;
  $$('#vocab-scope button').forEach((b) => b.classList.toggle('on', b.dataset.s === s));
}

$('#btn-vocab').addEventListener('click', () => {
  if (drawerOpen() && state.vocabScope === 'article') return closeDrawer();
  setScope('article');
  openDrawer();
});
$('#drawer-close').addEventListener('click', closeDrawer);
$('#scrim').addEventListener('click', closeDrawer);
$('#vocab-scope').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  setScope(b.dataset.s);
  renderVocab(null, true);
});

function vocabRows() {
  const out = [];
  const ids = state.vocabScope === 'article' && state.current ? [state.current.id] : Object.keys(state.notes.articles);
  for (const id of ids) {
    const a = state.notes.articles[id];
    if (!a || !a.vocab) continue;
    const meta = state.list.find((m) => m.id === id);
    for (const v of a.vocab) out.push({ v, id, meta });
  }
  return out.sort((x, y) => y.v.at - x.v.at);
}


function vrowHtml({ v, id }, i) {
  return `<div class="vrow" data-id="${id}" data-v="${v.id}" style="animation-delay:${Math.min(i, 24) * 18}ms">
      <div>
        <div class="vword" title="${esc(t('vocab.show'))}">${esc(v.word)}</div>
      </div>
      <textarea class="vtr" rows="1" placeholder="${esc(t('vocab.trPh'))}" spellcheck="false">${esc(v.tr)}</textarea>
      <button class="vdel" title="${esc(t('del'))}">✕</button>
    </div>`;
}

// enter: replay the staggered entrance (drawer opening, scope switch); otherwise refresh quietly
// When the drawer opens, only the rows that can be on screen are built before it slides in;
// the rest (below the fold, where nothing animates) are added once the slide is done.
// Anything that looks a row up calls flushVocab() first, so it always finds it.
let vocabRest = null;
function flushVocab() {
  if (!vocabRest) return;
  const { html, t } = vocabRest;
  vocabRest = null;
  clearTimeout(t);
  const body = $('#vocab-body');
  const at = body.children.length;
  body.insertAdjacentHTML('beforeend', html);
  const added = [...body.children].slice(at);
  added.forEach((el) => el.classList.add('below'));
  const tas = added.map((el) => $('.vtr', el)).filter(Boolean);
  tas.forEach((ta) => (ta.style.height = 'auto'));
  tas.map((ta) => ta.scrollHeight).forEach((h, i) => (tas[i].style.height = h + 'px'));
}
function renderVocab(focusHlId, enter) {
  if (vocabRest) (clearTimeout(vocabRest.t), (vocabRest = null));
  const rows = vocabRows();
  const body = $('#vocab-body');
  $('#drawer').classList.toggle('has-rows', rows.length > 0);
  body.classList.toggle('enter', !!enter);
  const html = rows.map(vrowHtml);
  const first = enter && !focusHlId ? Math.ceil(innerHeight / 48) + 8 : html.length;
  body.innerHTML = html.slice(0, first).join('');
  if (html.length > first) vocabRest = { html: html.slice(first).join(''), t: setTimeout(flushVocab, 600) };
  // all writes, then all reads, then all writes: one layout for the whole list, not one per row
  const tas = $$('#vocab-body .vtr');
  tas.forEach((ta) => (ta.style.height = 'auto'));
  tas.map((ta) => ta.scrollHeight).forEach((h, i) => (tas[i].style.height = h + 'px'));
  if (enter) {
    const fold = body.getBoundingClientRect().top + body.clientHeight;
    // every row is measured before any is marked: one layout, not one per row
    const below = [...body.children].filter((el) => el.getBoundingClientRect().top > fold);
    below.forEach((el) => el.classList.add('below'));
  }
  if (focusHlId) {
    const row = rows.find((r) => r.v.hlId === focusHlId);
    const el = row && $(`.vrow[data-v="${row.v.id}"]`);
    if (el) markNewRow(el, 260);
  }
}

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

// A freshly added word drops in at the top of the open list: the row grows from zero
// height (pushing the others down) while it fades in from a light blur.
function prependVocab(hlId) {
  flushVocab();
  const rows = vocabRows();
  const row = rows.find((r) => r.v.hlId === hlId);
  if (!row) return renderVocab();
  const body = $('#vocab-body');
  $('#drawer').classList.add('has-rows');
  body.classList.remove('enter');
  body.insertAdjacentHTML('afterbegin', vrowHtml(row, 0));
  const el = body.firstElementChild;
  autosize($('.vtr', el));
  if (body.scrollTop > 0) body.scrollTo({ top: 0, behavior: 'smooth' });
  if (!reduceMotion.matches) {
    const cs = getComputedStyle(el);
    el.animate(
      [
        { height: '0px', paddingTop: '0px', paddingBottom: '0px', opacity: 0, transform: 'translateY(-10px)', filter: 'blur(6px)', overflow: 'hidden' },
        { height: el.offsetHeight + 'px', paddingTop: cs.paddingTop, paddingBottom: cs.paddingBottom, opacity: 1, transform: 'none', filter: 'blur(0)', overflow: 'hidden' },
      ],
      { duration: 460, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
    );
  }
  markNewRow(el, 320);
}

// soft highlight on the new row, then focus its translation field
function markNewRow(el, delay) {
  el.classList.add('fresh');
  el.addEventListener('animationend', (e) => e.animationName === 'row-glow' && el.classList.remove('fresh'));
  setTimeout(() => $('.vtr', el).focus({ preventScroll: true }), delay);
}

// collapse a row smoothly and drop it from the list
function removeVocabRow(vId) {
  flushVocab();
  const el = $(`#vocab-body .vrow[data-v="${vId}"]`);
  if (!el) return;
  const done = () => {
    el.remove();
    $('#drawer').classList.toggle('has-rows', !!$('#vocab-body .vrow'));
  };
  if (reduceMotion.matches) return done();
  const cs = getComputedStyle(el);
  el.animate(
    [
      { height: el.offsetHeight + 'px', paddingTop: cs.paddingTop, paddingBottom: cs.paddingBottom, opacity: 1, transform: 'none', filter: 'blur(0)', overflow: 'hidden' },
      { height: '0px', paddingTop: '0px', paddingBottom: '0px', opacity: 0, transform: 'translateX(14px)', filter: 'blur(4px)', overflow: 'hidden' },
    ],
    { duration: 280, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' },
  ).finished.then(done, done);
}

function findVocab(row) {
  const a = rec(row.dataset.id);
  return { a, v: a.vocab.find((x) => x.id === row.dataset.v) };
}

$('#vocab-body').addEventListener('input', (e) => {
  const ta = e.target.closest('.vtr');
  if (!ta) return;
  autosize(ta);
  const { v } = findVocab(ta.closest('.vrow'));
  if (v) ((v.tr = ta.value), save());
});
$('#vocab-body').addEventListener('keydown', (e) => {
  if (e.target.closest('.vtr') && e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    e.target.blur();
  }
});
$('#vocab-body').addEventListener('click', async (e) => {
  const row = e.target.closest('.vrow');
  if (!row) return;
  const { a, v } = findVocab(row);
  if (!v) return;
  if (e.target.closest('.vdel')) {
    a.vocab = a.vocab.filter((x) => x.id !== v.id);
    a.hl = a.hl.filter((x) => x.id !== v.hlId);
    save();
    updateVocabCount();
    // a word from another article may be marked here too
    if (state.current) fadeOutMarks({ id: v.hlId, t: 'word' }, rerenderAllParas);
    removeVocabRow(v.id);
    renderLibraryIfVisible();
    return;
  }
  if (e.target.closest('.vword')) {
    if (!state.current || state.current.id !== row.dataset.id) await openArticle(row.dataset.id);
    const mark = $(`#doc mark[data-h="${v.hlId}"]:not(.echo)`) || $(`#doc mark[data-h="${v.hlId}"]`);
    if (mark) {
      mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
      mark.classList.remove('flash');
      void mark.offsetWidth;
      mark.classList.add('flash');
    }
  }
});
function renderLibraryIfVisible() {
  if (state.view === 'library') renderLibrary();
}

$('#vocab-copy').addEventListener('click', () => {
  const rows = vocabRows();
  if (!rows.length) return toast(t('vocab.empty'));
  api.copy(rows.map(({ v }) => `${v.word}\t${v.tr || '—'}\t${v.ctx}`).join('\n'));
  toast(t('vocab.copied', rows.length));
});

/* ---------------- reader bar: Menu with the rarely used tools ---------------- */
// font size, theme, edit, PDF and AI live in the Menu (⌘K); the panel blurs in place, its
// rows follow one after another
function showTools(on) {
  if (!on) $('#ai-menu').classList.remove('show');
  $('#tools').classList.toggle('show', on);
  $('#btn-tools').setAttribute('aria-expanded', on);
}
$$('#tools > *').forEach((el, i) => el.style.setProperty('--i', i));
$('#btn-tools').addEventListener('click', () => showTools(!$('#tools').classList.contains('show')));
// a tool picked from it closes it (the size buttons and AI's own menu keep it open)
$('#tools').addEventListener('click', (e) => {
  if (e.target.closest('.font-ctl, #btn-ai, #ai-menu') || !e.target.closest('button')) return;
  setTimeout(closeMenu, 0);
}, true);

/* ---------------- AI export ---------------- */

function closeMenu() {
  $$('.menu.show, .tools.show').forEach((m) => m.classList.remove('show'));
  $('#btn-tools').setAttribute('aria-expanded', 'false');
}
$('#btn-ai').addEventListener('click', () => $('#ai-menu').classList.toggle('show'));
$('#ai-menu').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.test) return (closeMenu(), Test.menu(b.dataset.test));
  copyExport(b.dataset.copy);
});
function copyExport(kind) {
  const text = buildExport(kind);
  closeMenu();
  if (!text) return toast(t('ai.nothing'));
  api.copy(text);
  toast(t('ai.copied'));
}

function buildExport(kind) {
  const { id, meta, data } = state.current;
  const r = rec(id);
  const title = titleOf(meta);
  const noted = Object.keys(r.notes)
    .map(Number)
    .filter((p) => (r.notes[p] || '').trim())
    .sort((a, b) => a - b);
  const vocab = r.vocab;
  const wantNotes = kind !== 'vocab';
  const wantVocab = kind !== 'notes';
  if ((!wantNotes || !noted.length) && (!wantVocab || !vocab.length)) return '';

  const L = [];
  L.push(`I am preparing for an English reading exam (IELTS/SAT-style reading). I read the article "${title}".`);
  if (wantNotes && noted.length) L.push('Below are paragraphs from it, each followed by MY OWN summary of what I understood.');
  if (wantVocab && vocab.length) L.push('I also list unfamiliar words with the translations I guessed (Uzbek).');
  L.push('');
  L.push('Please:');
  let n = 1;
  if (wantNotes && noted.length) {
    L.push(`${n++}. For each paragraph, rate my understanding from 0 to 10 and say exactly what I got right, what I missed and what I misread.`);
    L.push(`${n++}. Point out any detail, tone or author's opinion I overlooked, the way reading-test questions would test it.`);
  }
  if (wantVocab && vocab.length) {
    L.push(`${n++}. Check each translation in this context; correct the wrong ones and give a short English definition and one more example sentence.`);
  }
  L.push(`${n++}. Finish with 3 concrete tips to improve my reading comprehension, based on my mistakes.`);
  L.push('Explain in Uzbek, keep English quotes in English.');
  L.push('');

  if (wantNotes && noted.length) {
    L.push(`=== ARTICLE: ${title} ===`);
    for (const p of noted) {
      L.push('');
      L.push(`[Paragraph ${p + 1}]`);
      L.push(data.blocks[p].text);
      L.push(`>> My understanding: ${r.notes[p].trim()}`);
    }
    L.push('');
  }
  if (wantVocab && vocab.length) {
    L.push('=== MY VOCABULARY ===');
    vocab.forEach((v, i) => {
      L.push(`${i + 1}. ${v.word} — my translation: ${v.tr.trim() || '(not translated yet)'}`);
      L.push(`   context: "${v.ctx}"`);
    });
  }
  return L.join('\n');
}

/* ---------------- keyboard ---------------- */

document.addEventListener('keydown', (e) => {
  const typing = e.target.closest && e.target.closest('input, textarea, [contenteditable="true"]');
  const mod = e.metaKey || e.ctrlKey;
  if (mod && (e.key === '=' || e.key === '+')) return (e.preventDefault(), changeFont(1));
  if (mod && e.key === '-') return (e.preventDefault(), changeFont(-1));
  if (mod && !e.shiftKey && e.code === 'Digit0') return (e.preventDefault(), setFontPct(100));
  // the Menu's tools, by key position so any keyboard layout works:
  // ⌘K the Menu, ⇧⌘O the original (PDF / web page), ⇧⌘A the AI menu, ⇧⌘C everything copied for AI
  if (mod && !e.altKey && state.view === 'reader' && state.current && !$('.modal.show, .fs-veil.show')) {
    const act = {
      KeyK: () => showTools(!$('#tools').classList.contains('show')),
      '⇧KeyO': () => (closeMenu(), $('#btn-pdf').click()),
      '⇧KeyA': () => (showTools(true), $('#ai-menu').classList.add('show')),
      '⇧KeyC': () => copyExport('all'),
    }[(e.shiftKey ? '⇧' : '') + e.code];
    if (act) return (e.preventDefault(), act());
  }
  if (mod && e.key.toLowerCase() === 'f' && state.view === 'library') return (e.preventDefault(), $('#search').focus());
  if (e.key === 'Escape') {
    if (typing) return e.target.blur();
    if (state.pop) return hidePop();
    if ($('.menu.show, .tools.show')) return closeMenu();
    if (editMode()) return setEditMode(false);
    if (drawerOpen()) return closeDrawer();
    if (state.view !== 'library') return backToLibrary();
    return;
  }
  if (typing || mod) return;
  const k = e.key.toLowerCase();
  if (state.pop && state.pop.mode === 'select' && (k === 'h' || k === 'w')) return (e.preventDefault(), popAction(k === 'h' ? 'hl' : 'word'));
  if (state.pop && state.pop.mode === 'mark' && (e.key === 'Backspace' || e.key === 'Delete')) return (e.preventDefault(), popAction('del'));
  if (k === 'd') return toggleTheme();
  if (k === 'e' && state.view === 'reader') return setEditMode(!editMode());
  if (k === 'v') {
    if (drawerOpen()) closeDrawer();
    else (setScope(state.view === 'reader' ? 'article' : 'all'), openDrawer());
  }
});

// pictures (row thumbnails and the article's picture) come out of a blur once loaded
document.addEventListener('load', (e) => e.target.matches && e.target.matches('.item-img, .doc-hero img') && e.target.classList.add('ok'), true);
document.addEventListener('error', (e) => e.target.matches && e.target.matches('.item-img, .doc-hero img') && e.target.classList.add('gone'), true);

/* ---------------- boot ---------------- */

(async function boot() {
  state.notes = await api.loadNotes();
  // the notes can arrive while the later scripts (session.js, shelves.js…) are still loading:
  // everything below expects them all to be there
  if (document.readyState === 'loading') await new Promise((ok) => document.addEventListener('DOMContentLoaded', ok, { once: true }));
  state.libDir = api.libDir ? await api.libDir() : null;
  state.notes.articles ||= {};
  state.notes.settings ||= {};
  applyFont();
  if (typeof Settings !== 'undefined') Settings.apply();
  applyTheme(state.notes.settings.theme || (darkMq.matches ? 'dark' : 'light'));
  state.inboxPath = await api.inboxPath();
  setLang(state.notes.settings.lang || 'uz');
  try {
    const nm = state.notes.settings.name; // the launch card greets by it (splash.js)
    nm ? localStorage.setItem('a365.name', nm) : localStorage.removeItem('a365.name');
  } catch {}
  if (typeof Session !== 'undefined') Session.clear();
  Stats.init({ notes: () => state.notes, list: () => state.list, reading: () => state.view === 'reader' && document.hasFocus(), save });
  await loadAddons();
  // the Guardian shelf, unless an add-on brought its own
  if (typeof Guardian !== 'undefined' && typeof Shelves !== 'undefined' && !Shelves.has('guardian')) Guardian.setup();
  if (typeof Shelves !== 'undefined') Shelves.prepare();
  await loadLibrary();
  if (typeof Shelves !== 'undefined') Shelves.restore();
  if (typeof Plan !== 'undefined') Plan.stamp(), Plan.badge();
  Stats.seed();
  // a reminder notification was clicked: go where it pointed
  api.onRemindOpen(openTarget);
  openTarget(await api.remindTarget());
  // the launch card goes once the app is up; a broken card must never keep the app from starting
  // the launch card stays while the background loads come in (warm), within its own limit
  let loads = null;
  try {
    loads = warm();
  } catch {}
  try {
    Splash.ready(loads);
  } catch {}
  // the bell of the notification centre (inbox.js)
  if (typeof Inbox !== 'undefined') Inbox.setup();
})();

// While the launch card is still up, what the first minutes will ask the network for: the
// Listening show's episodes and their pictures, today's planned episode, the last article's
// picture, the Guardian section. All of it is network and decoding off the main thread (IPC, an
// <img> decoding asynchronously), started when the card's drawing leaves the main thread idle, so
// the card and Inky never miss a frame. The pictures are held a minute, then the cache has them.
function warm() {
  if (window !== window.top) return null; // not in the Settings demo
  const held = [];
  const jobs = [];
  const pic = (src) => {
    if (!src) return;
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
    held.push(img);
    jobs.push(img.decode().catch(() => {}));
  };
  const idle = () => new Promise((ok) => (window.requestIdleCallback ? requestIdleCallback(ok, { timeout: 1200 }) : setTimeout(ok, 300)));
  setTimeout(() => (held.length = 0), 60000);
  return idle().then(() => {
    const n = state.notes;
    // the article opened last: its picture (a Guardian one comes from their servers)
    const last = Object.entries(n.articles).filter(([id, a]) => a.opened && state.list.some((m) => m.id === id)).sort((x, y) => y[1].opened - x[1].opened)[0];
    if (last) pic(libImg(state.list.find((m) => m.id === last[0])));
    // today's planned episode: the plan card's picture (and the player's, before the video loads)
    const today = n.plan && n.plan.days && n.plan.days[new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)];
    if (today && today.e && today.e.v) pic(`https://i.ytimg.com/vi/${encodeURIComponent(today.e.v)}/hqdefault.jpg`);
    // the show on the Listening shelf: its episodes, and the pictures of the first rows
    if (typeof Listen !== 'undefined' && api.listenFeed)
      jobs.push(Listen.episodes(Listen.showNow())
        .then((f) => f.items.slice(0, 8).forEach((it) => pic(`https://i.ytimg.com/vi/${encodeURIComponent(it.v)}/mqdefault.jpg`)))
        .catch(() => {}));
    if (typeof Guardian !== 'undefined' && Guardian.prefetch) jobs.push(Promise.resolve(Guardian.prefetch()).catch(() => {}));
    // pictures may be added while the episodes come in, so wait until no new job appears
    const settle = (k) => Promise.all(jobs).then(() => (jobs.length > k ? settle(jobs.length) : null));
    return settle(jobs.length);
  });
}

// Add-ons kept beside the app and out of the repository (src/renderer/private/<name>.js and .css,
// listed by main.js): each one loads before the library is drawn, so it can add a shelf.
async function loadAddons() {
  const names = api.addons ? await api.addons().catch(() => []) : [];
  for (const n of names) {
    const css = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: `private/${n}.css` });
    document.head.appendChild(css);
    await new Promise((ok) => {
      const s = Object.assign(document.createElement('script'), { src: `private/${n}.js` });
      s.onload = s.onerror = ok;
      document.body.appendChild(s);
    });
  }
}

function openTarget(t) {
  if (!t) return;
  if (t.view === 'cards') return Cards.open();
  if (t.view === 'focus' && typeof Session !== 'undefined') return Session.fromWidget();
  if (t.view === 'article' && state.list.some((m) => m.id === t.id) && !(state.view === 'reader' && state.current && state.current.id === t.id)) openArticle(t.id);
}

'use strict';
// Read-along: the student reads the focused paragraph out loud and the text follows them.
// Words light up as they are heard, the next word is marked, unclear words get a wavy amber
// underline and skipped ones a dotted red one. At the end of a paragraph the focus moves on.
//
// main.js runs bin/read-along (Apple speech recognition, on-device) and forwards its events:
//   text {seg, text}: running transcript of the current segment, revised as it goes
//   level {v} · ready · error {code, msg} · end
// Each transcript is aligned again from the point the segment started, so revisions are fine.
// Words are painted with the CSS Custom Highlight API: the paragraph's markup is never touched.
// Needs app.js (state, $, toast, rec), i18n.js and focus.js.
const ReadAlong = (() => {
  Object.assign(I18N.uz, {
    'ra.btn': "Ovoz bilan o'qish",
    'ra.on': 'Tinglayapman',
    'ra.title': "Ovoz chiqarib o'qing — matn sizni kuzatib boradi (R)",
    'ra.starting': 'Mikrofon ulanmoqda…',
    'ra.errMic': "Mikrofonga ruxsat yo'q: System Settings → Privacy & Security → Microphone → 365 Articles",
    'ra.errDenied': "Nutqni tanishga ruxsat yo'q: System Settings → Privacy & Security → Speech Recognition → 365 Articles",
    'ra.errNoMic': 'Mikrofon topilmadi',
    'ra.errPlatform': 'Bu funksiya faqat macOS uchun',
    'ra.errRestart': "Ilovani ⌘Q bilan to'liq yopib, qayta oching",
    'ra.err': (m) => `Ovozni tanish ishlamadi: ${m}`,
    'ra.done': "Maqola tugadi — barakalla!",
  });
  Object.assign(I18N.en, {
    'ra.btn': 'Read aloud',
    'ra.on': 'Listening',
    'ra.title': 'Read out loud — the text follows you (R)',
    'ra.starting': 'Connecting the microphone…',
    'ra.errMic': 'No microphone access: System Settings → Privacy & Security → Microphone → 365 Articles',
    'ra.errDenied': 'No speech recognition access: System Settings → Privacy & Security → Speech Recognition → 365 Articles',
    'ra.errNoMic': 'No microphone found',
    'ra.errPlatform': 'This works on macOS only',
    'ra.errRestart': 'Quit the app fully (⌘Q) and open it again',
    'ra.err': (m) => `Speech recognition failed: ${m}`,
    'ra.done': 'End of the article — well done!',
  });
  Object.assign(I18N.ru, {
    'ra.btn': 'Читать вслух',
    'ra.on': 'Слушаю',
    'ra.title': 'Читайте вслух — текст следует за вами (R)',
    'ra.starting': 'Подключаю микрофон…',
    'ra.errMic': 'Нет доступа к микрофону: Системные настройки → Конфиденциальность → Микрофон → 365 Articles',
    'ra.errDenied': 'Нет доступа к распознаванию речи: Системные настройки → Конфиденциальность → Распознавание речи → 365 Articles',
    'ra.errNoMic': 'Микрофон не найден',
    'ra.errPlatform': 'Работает только на macOS',
    'ra.errRestart': 'Полностью закройте приложение (⌘Q) и откройте снова',
    'ra.err': (m) => `Распознавание речи не сработало: ${m}`,
    'ra.done': 'Статья закончилась — отлично!',
  });

  const READ = 1, NEAR = 2, MISS = 3;
  const WORD_RE = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;
  const NUM_WORDS = new Set('zero oh one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty thirty forty fifty sixty seventy eighty ninety hundred thousand million billion first second third fourth fifth sixth seventh eighth ninth tenth percent per cent and point'.split(' '));
  // little words the recogniser often swallows in fluent speech: never shown as skipped
  const SMALL = new Set('a an the of to in on at by for and or but nor so as is are was were be been it its this that these those with from into than then there their they he she we you i his her our your my me us them not no do does did has have had will would can could may might shall should'.split(' '));
  const norm = (w) => w.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/['’]/g, '').toLowerCase();
  const hasDigit = (w) => /\d/.test(w);
  // British and American spellings sound the same: practise/practice, colour/color, organise/organize
  const canon = (w) => w.replace(/our/g, 'or').replace(/z/g, 's').replace(/c(?=[ei])/g, 's').replace(/tre$/, 'ter');

  const body = document.body;
  const btn = $('#ra-btn');
  const heard = $('#ra-heard');
  let on = false;
  let starting = false;
  let cur = null; // { p: paragraph index in Focus.paras(), seg, base, off, fixed: [], st: [], j, tokens }
  const done = new Map(); // paragraph index → statuses, kept until read-along stops
  let idleT = 0;
  let nextT = 0;

  /* ---------------- words of a paragraph ---------------- */

  // the words of a paragraph with live DOM ranges (marks split text nodes, so walk them all)
  function wordsOf(el) {
    const box = el && el.querySelector('.ptext');
    if (!box) return [];
    const nodes = [];
    let text = '';
    const walk = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
    for (let n; (n = walk.nextNode()); ) nodes.push([n, text.length]), (text += n.data);
    const at = (i) => {
      let k = nodes.length - 1;
      while (k > 0 && nodes[k][1] > i) k--;
      return [nodes[k][0], i - nodes[k][1]];
    };
    const out = [];
    for (const m of text.matchAll(WORD_RE)) {
      const r = new Range();
      r.setStart(...at(m.index));
      r.setEnd(...at(m.index + m[0].length - 1));
      r.setEnd(r.endContainer, r.endOffset + 1);
      out.push({ n: norm(m[0]), num: hasDigit(m[0]), range: r });
    }
    return out;
  }

  function lev(a, b) {
    if (Math.abs(a.length - b.length) > 2) return 3;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const row = [i];
      for (let j = 1; j <= b.length; j++) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = row;
    }
    return prev[b.length];
  }

  // does heard word h fit text word k? → { q: READ|NEAR, take: words consumed } or null.
  // The last heard word may still be half a word ("hypno…"), so it only counts when exact.
  function fit(h, W, k, last) {
    const w = W[k].n;
    if (h === w || canon(h) === canon(w)) return { q: READ, take: 1 };
    if (W[k].num && (hasDigit(h) || NUM_WORDS.has(h))) return { q: READ, take: 1 };
    if (hasDigit(h) && NUM_WORDS.has(w.replace(/s$/, ''))) return { q: READ, take: 1 }; // "1000s" for "thousands"
    if (W[k + 1] && h === w + W[k + 1].n) return { q: READ, take: 2 }; // "autopilot" for "auto-pilot"
    if (last) return null;
    if (w.length >= 4 && lev(h, w) <= (w.length >= 6 ? 2 : 1)) return { q: NEAR, take: 1 };
    return null;
  }

  // greedy walk through the heard words; words jumped over count as skipped.
  // A jump over two or more words needs proof, so one misheard word can't race ahead and paint
  // a run of words red: the word is long and heard exactly, or the next heard word fits too.
  function align(H, W, base) {
    const st = [];
    let j = base;
    let used = -1; // last heard word that matched
    H.forEach((h, i) => {
      const last = i === H.length - 1;
      const reach = h.length <= 3 ? 2 : 7;
      for (let k = j; k < Math.min(W.length, j + reach); k++) {
        const m = fit(h, W, k, last);
        if (!m) continue;
        if (k - j > 1 && !(m.q === READ && h.length >= 5) && !(H[i + 1] && W[k + m.take] && fit(H[i + 1], W, k + m.take, i + 1 === H.length - 1))) continue;
        for (let g = j; g < k; g++) st[g] = W[g].num || SMALL.has(W[g].n) ? READ : MISS;
        for (let g = k; g < k + m.take; g++) st[g] = m.q;
        j = k + m.take;
        used = i;
        break;
      }
    });
    return { j, st, used };
  }

  /* ---------------- painting ---------------- */

  const NAMES = ['ra-todo', 'ra-next', 'ra-near', 'ra-miss'];
  function paint() {
    const sets = { 'ra-todo': [], 'ra-next': [], 'ra-near': [], 'ra-miss': [] };
    const list = Focus.paras();
    const all = new Map(done);
    if (cur) all.set(cur.p, cur.st);
    for (const [p, st] of all) {
      const W = wordsOf(list[p]);
      W.forEach((w, i) => {
        if (st[i] === NEAR) sets['ra-near'].push(w.range);
        else if (st[i] === MISS) sets['ra-miss'].push(w.range);
        else if (cur && p === cur.p && i >= cur.j) sets[i === cur.j ? 'ra-next' : 'ra-todo'].push(w.range);
      });
    }
    NAMES.forEach((name, i) => {
      const h = new Highlight(...sets[name]);
      h.priority = i;
      CSS.highlights.set(name, h);
    });
  }
  const clearPaint = () => NAMES.forEach((n) => CSS.highlights.delete(n));

  /* ---------------- following the speaker ---------------- */

  function startPara(p, off) {
    if (cur && cur.st.length) done.set(cur.p, cur.st);
    const W = wordsOf(Focus.paras()[p]);
    cur = { p, seg: cur ? cur.seg : 0, base: 0, off, fixed: [], st: [], j: 0, W, tokens: cur ? cur.tokens : [] };
    done.delete(p);
    paint();
  }

  function onText(seg, text) {
    if (!cur) return;
    const tokens = (text.match(WORD_RE) || []).map(norm);
    if (seg !== cur.seg) {
      // a new segment starts empty: carry on from where the last one got to
      cur.seg = seg;
      cur.fixed = cur.st.slice();
      cur.base = cur.j;
      cur.off = 0;
    }
    cur.tokens = tokens;
    heard.textContent = tokens.slice(-4).join(' ');
    const W = (cur.W = wordsOf(Focus.paras()[cur.p])); // the paragraph may have been re-rendered
    // the recogniser keeps revising what it already said, so the count of words that belonged to
    // the last paragraph can shift: look a couple of words back rather than lose the first ones
    const from = cur.off > 2 ? cur.off - 2 : 0;
    const H = tokens.slice(from);
    const res = align(H, W, cur.base);
    cur.st = cur.fixed.slice(0, cur.base);
    res.st.forEach((s, i) => s && (cur.st[i] = s));
    cur.j = res.j;
    paint();
    if (W[cur.j]) Focus.reveal(W[cur.j].range.getBoundingClientRect());
    clearTimeout(idleT);
    if (cur.j >= W.length) return finishPara(from + res.used + 1);
    // a pause near the end (a number or name the recogniser missed): move on anyway
    if (W.length && cur.j >= W.length * 0.8) idleT = setTimeout(() => finishPara(cur.tokens.length), 1200);
  }

  function finishPara(off) {
    clearTimeout(idleT);
    if (!cur || cur.finished) return; // already moving on; later partials must not hold it back
    cur.finished = true;
    for (let i = cur.j; i < cur.W.length; i++) cur.st[i] = cur.W[i].num || SMALL.has(cur.W[i].n) ? READ : MISS;
    cur.j = cur.W.length;
    paint();
    const next = cur.p + 1;
    if (next >= Focus.paras().length) {
      toast(t('ra.done'));
      return stop();
    }
    // a beat to see the finished paragraph, then glide on; words already spoken carry over
    nextT = setTimeout(() => {
      if (!cur) return;
      startPara(next, off);
      Focus.go(next);
    }, 260);
  }

  /* ---------------- start / stop ---------------- */

  // the article's longer words help the recogniser with names and terms
  function contextWords() {
    const count = new Map();
    for (const b of state.current.data.blocks) for (const w of b.text.match(WORD_RE) || []) if (w.length >= 6) count.set(w, (count.get(w) || 0) + 1);
    return [...count].sort((a, b) => b[1] - a[1]).slice(0, 100).map(([w]) => w);
  }

  async function start() {
    if (on || starting || state.view !== 'reader' || !state.current) return;
    if (!Focus.isOn()) Focus.enter();
    starting = true;
    body.classList.add('ra-wait');
    $('#ra-label').textContent = t('ra.starting');
    Focus.showHud();
    let res;
    try {
      res = await api.readStart({ locale: 'en-US', words: contextWords() });
    } catch {
      res = { ok: false, code: 'restart' }; // the main process predates this feature: needs a full restart
    }
    starting = false;
    body.classList.remove('ra-wait');
    if (!res.ok) return (label(), toast(t({ mic: 'ra.errMic', restart: 'ra.errRestart' }[res.code] || 'ra.errPlatform')));
    on = true;
    done.clear();
    cur = null;
    startPara(Focus.at(), 0);
    body.classList.add('ra-on');
    label();
    Focus.showHud();
  }

  function stop() {
    clearTimeout(idleT);
    clearTimeout(nextT);
    if (starting || on) api.readStop();
    on = starting = false;
    cur = null;
    done.clear();
    clearPaint();
    body.classList.remove('ra-on', 'ra-wait');
    heard.textContent = '';
    btn.style.removeProperty('--lv');
    label();
  }

  const label = () => ($('#ra-label').textContent = t(on ? 'ra.on' : 'ra.btn'));
  const toggle = () => (on || starting ? stop() : start());

  api.onRead((m) => {
    if (!on && m.t !== 'error') return;
    if (m.t === 'text') onText(m.seg, m.text);
    else if (m.t === 'level') btn.style.setProperty('--lv', m.v.toFixed(2));
    else if (m.t === 'error') {
      const key = { denied: 'ra.errDenied', restricted: 'ra.errDenied', mic: 'ra.errMic', nomic: 'ra.errNoMic' }[m.code];
      toast(key ? t(key) : t('ra.err', m.msg || m.code));
      stop();
    } else if (m.t === 'end') stop();
  });

  // the student moved the focus by hand: follow there, ignore what was said before
  Focus.onMove((p, byUser) => {
    if (!on || !byUser || (cur && cur.p === p)) return;
    clearTimeout(idleT);
    clearTimeout(nextT);
    startPara(p, cur ? cur.tokens.length : 0);
  });

  btn.addEventListener('click', toggle);
  window.addEventListener('keydown', (e) => {
    const typing = e.target.closest && e.target.closest('input, textarea, [contenteditable="true"]');
    if (typing || e.metaKey || e.ctrlKey || e.altKey || state.view !== 'reader' || $('.modal.show, .fs-veil.show') || state.pop) return;
    if (e.key.toLowerCase() === 'r') (e.preventDefault(), e.stopImmediatePropagation(), toggle());
  }, true);

  applyI18n();
  // _replay: test hook, feeds recorded transcripts without the microphone
  const _replay = (seg, text) => {
    if (!on) (on = true), done.clear(), (cur = null), startPara(Focus.at(), 0), body.classList.add('ra-on'), label();
    onText(seg, text);
  };
  return { start, stop, toggle, isOn: () => on, _replay };
})();

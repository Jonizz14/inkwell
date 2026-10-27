'use strict';
// Inky, the app's pixel mascot: a little inkwell with a quill, standing in the corner of every
// page. It moves like a sprite — whole pixels, a few frames a second, never a transition — and it
// is alive: its eyes follow the pointer; it blinks, looks around, winks, thinks; it walks along
// when you change page and does that page's job (reads with you, listens to the podcast in
// headphones, shows a growing chart in the statistics, ticks off the plan, flips flashcards,
// tightens a bolt in the settings); it has feelings (love, joy, laughter, starry eyes, shyness,
// surprise, sadness, tears, anger, dizziness, cool sunglasses, a song, a yawn, sleep) and it
// talks in a small bubble now and then. One timer, a handful of tiny writes a second, nothing
// while the window is hidden. Needs app.js (state, showView, toggleTheme, reduceMotion, t, lang).
const Inky = (() => {
  const SAY = {
    uz: {
      lib: ["Bugun nima o'qiymiz?", "Bitta maqola o'qib olamizmi?", 'Qaysi birini tanlaymiz?'],
      reader: ["Qani, o'qidik!", "Men ham o'qiyman", "Notanish so'zni belgilang — eslab qolaman"],
      end: 'Barakalla! Maqola tugadi',
      word: (w) => `Yangi so'z: ${w}`,
      unword: (w) => `Xayr, ${w}…`,
      watch: ['Quloq solamiz…', 'Naushniklar tayyor'],
      stats: ['Mana natijalar!', "Grafiklar o'syapti"],
      plan: ['Bugun: 1 podkast + 1 maqola', "Yarim yo'ldamiz!", 'Bugungi reja bajarildi!'],
      cards: ['Takrorlash vaqti!', 'Qani, eslaymizmi?'],
      settings: ['Nimani sozlaymiz?'],
      poke: ['Hey!', "Qitiq bo'ldi!", 'Men Inky!', 'Nima gap?'],
      love: "Men ham sizni yaxshi ko'raman!",
      angry: "Bas qiling!",
      dizzy: 'Boshim aylandi…',
      wake: 'Ha? Uxlab qolibman!',
      dark: "Qorong'i — zo'r!",
      light: "Yorug' ham chiroyli",
      music: "Qo'shiq aytaman!",
      tips: ["Bir maqola o'qib olamizmi?", "Lug'atni takrorlab olaylik", "Bugungi rejaga qarab ko'raylik", 'Suv ichib oling!'],
    },
    en: {
      lib: ['What shall we read today?', 'One article?', 'Which one shall we pick?'],
      reader: ["Let's read!", "I'm reading too", "Mark a new word — I'll remember it"],
      end: 'Well done! The end',
      word: (w) => `New word: ${w}`,
      unword: (w) => `Bye, ${w}…`,
      watch: ['Listening…', 'Headphones on'],
      stats: ['Here are your numbers!', 'The charts are growing'],
      plan: ['Today: 1 podcast + 1 article', 'Halfway there!', "Today's plan is done!"],
      cards: ['Review time!', "Let's remember"],
      settings: ['What shall we change?'],
      poke: ['Hey!', 'That tickles!', "I'm Inky!", "What's up?"],
      love: 'Love you too!',
      angry: 'Stop it!',
      dizzy: "I'm dizzy…",
      wake: 'Huh? I dozed off!',
      dark: 'Dark — nice!',
      light: 'Light is lovely too',
      music: "I'll sing along!",
      tips: ['Shall we read one article?', "Let's review the vocabulary", "Let's look at today's plan", 'Have some water!'],
    },
    ru: {
      lib: ['Что почитаем сегодня?', 'Одну статью?', 'Какую выберем?'],
      reader: ['Читаем!', 'Я тоже читаю', 'Отметь новое слово — я запомню'],
      end: 'Молодец! Статья прочитана',
      word: (w) => `Новое слово: ${w}`,
      unword: (w) => `Пока, ${w}…`,
      watch: ['Слушаем…', 'Наушники на месте'],
      stats: ['Вот твои результаты!', 'Графики растут'],
      plan: ['Сегодня: 1 подкаст + 1 статья', 'Половина пути!', 'План на сегодня выполнен!'],
      cards: ['Время повторять!', 'Вспомним?'],
      settings: ['Что настроим?'],
      poke: ['Эй!', 'Щекотно!', 'Я Инки!', 'Как дела?'],
      love: 'Я тебя тоже люблю!',
      angry: 'Хватит!',
      dizzy: 'Голова кружится…',
      wake: 'А? Я задремал!',
      dark: 'Тёмная — класс!',
      light: 'Светлая тоже красивая',
      music: 'Подпою!',
      tips: ['Почитаем одну статью?', 'Повторим словарь', 'Заглянем в план на сегодня', 'Выпей воды!'],
    },
  };
  const words = () => SAY[typeof lang !== 'undefined' && SAY[lang] ? lang : 'uz'];
  const pick = (list) => list[(Math.random() * list.length) | 0];

  /* ---------- the frames ---------- */
  // Inky's frames: the original 18×14 inkwell placed in a 26×16 canvas (2 rows of room above for
  // headphones and signs, 4 columns each side for what it holds). Letters: X ink (body), W page
  // colour (eyes, mouth), g grey, R red, P pink, B blue, Y gold, . nothing.
  const SPRITE = (() => {
    const OX = 4;
    const OY = 2;
    const BODY = [
      '..........X.......',
      '.........XX.......',
      '........XX........',
      '.......XX.........',
      '.....XXXXXX.......',
      '.....XXXXXX.......',
      '...XXXXXXXXXX.....',
      '..XXXXXXXXXXXX....',
      '..XXXXXXXXXXXX....',
      '.XXXXXXXXXXXXXX...',
      '..XXXXXXXXXXXX....',
      '..XXXXXXXXXXXX....',
      '...XXXXXXXXXX.....',
      '...X.X....X.X.....',
    ];
    // coordinates below are in the 18×14 sprite's own grid (row, col); put() shifts them
    const put = (g, r, c, ch) => {
      const R = r + OY;
      const C = c + OX;
      if (R >= 0 && R < 16 && C >= 0 && C < 26) g[R][C] = ch;
    };
    const dots = (g, list, ch) => list.forEach(([r, c]) => put(g, r, c, ch));
    const rect = (g, r0, c0, r1, c1, ch) => { for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) put(g, r, c, ch); };
    // eyes: 2×2 at cols 4–5 and 10–11, rows 8–9
    const E = {
      open: (g, dx = 0, dy = 0) => { rect(g, 8 + dy, 4 + dx, 9 + dy, 5 + dx, 'W'); rect(g, 8 + dy, 10 + dx, 9 + dy, 11 + dx, 'W'); },
      lids: (g) => { rect(g, 9, 4, 9, 5, 'W'); rect(g, 9, 10, 9, 11, 'W'); },
      happy: (g) => dots(g, [[8, 4], [9, 3], [9, 5], [8, 11], [9, 10], [9, 12]], 'W'),
      squint: (g) => dots(g, [[8, 3], [9, 4], [8, 5], [8, 10], [9, 11], [8, 12]], 'W'), // > <
      small: (g) => dots(g, [[9, 5], [9, 10]], 'W'),
      angry: (g) => { E.open(g); put(g, 8, 5, 'X'); put(g, 8, 10, 'X'); },
      sad: (g) => { E.open(g, 0, 0); put(g, 8, 4, 'X'); put(g, 8, 11, 'X'); },
      heart: (g) => { for (const c of [3, 10]) dots(g, [[7, c], [7, c + 2], [8, c], [8, c + 1], [8, c + 2], [9, c + 1]], 'R'); },
      star: (g) => { for (const c of [3, 10]) dots(g, [[7, c + 1], [8, c], [8, c + 1], [8, c + 2], [9, c + 1]], 'Y'); },
      cross: (g) => { for (const c of [3, 10]) dots(g, [[7, c], [7, c + 2], [8, c + 1], [9, c], [9, c + 2]], 'W'); },
      wink: (g) => { rect(g, 8, 4, 9, 5, 'W'); dots(g, [[8, 11], [9, 10], [9, 12]], 'W'); },
      glasses: (g) => { rect(g, 8, 3, 9, 6, 'g'); rect(g, 8, 9, 9, 12, 'g'); rect(g, 8, 7, 8, 8, 'g'); put(g, 8, 3, 'W'); put(g, 8, 9, 'W'); },
      odd: (g) => { rect(g, 7, 4, 8, 5, 'W'); rect(g, 9, 10, 9, 11, 'W'); },
    };
    // mouths (rows 10–11, the middle columns)
    const M = {
      smile: (g) => dots(g, [[10, 6], [10, 9], [11, 7], [11, 8]], 'W'),
      grin: (g) => dots(g, [[10, 6], [10, 7], [10, 8], [10, 9], [11, 7], [11, 8]], 'W'),
      o: (g) => rect(g, 10, 7, 11, 8, 'W'),
      big: (g) => { rect(g, 10, 6, 11, 9, 'W'); },
      frown: (g) => dots(g, [[11, 6], [10, 7], [10, 8], [11, 9]], 'W'),
      flat: (g) => rect(g, 11, 6, 11, 9, 'W'),
      dot: (g) => rect(g, 11, 7, 11, 8, 'W'),
      wavy: (g) => dots(g, [[11, 5], [10, 6], [11, 7], [10, 8], [11, 9], [10, 10]], 'W'),
      smirk: (g) => dots(g, [[11, 6], [11, 7], [11, 8], [10, 9]], 'W'),
    };
    // things around it: above the head (top left, rows −2…3) and in its hands (right, cols 14–21)
    const A = {
      heart: (g, y = 0) => dots(g, [[-1 + y, 1], [-1 + y, 3], [0 + y, 0], [0 + y, 1], [0 + y, 2], [0 + y, 3], [0 + y, 4], [1 + y, 1], [1 + y, 2], [1 + y, 3], [2 + y, 2]], 'R'),
      bang: (g) => dots(g, [[-1, 2], [0, 2], [1, 2], [3, 2]], 'X'),
      ask: (g) => dots(g, [[-1, 1], [-1, 2], [-1, 3], [0, 4], [1, 3], [2, 2], [4, 2]], 'X'),
      think: (g, n = 3) => dots(g, [[3, 0], [3, 2], [3, 4]].slice(0, n), 'X'),
      vein: (g) => dots(g, [[0, 1], [0, 3], [1, 2], [2, 1], [2, 3]], 'R'),
      note: (g, y = 0) => dots(g, [[-1 + y, 3], [0 + y, 3], [1 + y, 3], [2 + y, 3], [-1 + y, 4], [0 + y, 5], [2 + y, 1], [2 + y, 2], [3 + y, 1], [3 + y, 2]], 'X'),
      zzz: (g, y = 0) => dots(g, [[-1 + y, 13], [-1 + y, 14], [-1 + y, 15], [-1 + y, 16], [0 + y, 15], [1 + y, 14], [2 + y, 13], [2 + y, 14], [2 + y, 15], [2 + y, 16]], 'X'),
      stars: (g, f = 0) => dots(g, f ? [[5, 1], [3, 15], [-1, 6]] : [[3, 0], [5, 16], [0, 12]], 'Y'),
      sparkle: (g, f = 0) => dots(g, f ? [[0, 2], [-1, 2], [1, 2], [0, 1], [0, 3]] : [[0, 2]], 'Y'),
      blush: (g) => dots(g, [[10, 3], [10, 12]], 'P'),
      tears: (g, f = 0) => dots(g, f ? [[10, 4], [12, 4], [10, 11], [12, 11]] : [[11, 4], [13, 4], [11, 11], [13, 11]], 'B'),
      tear: (g) => dots(g, [[10, 12], [11, 12]], 'B'),
      sweat: (g) => dots(g, [[5, 13], [6, 13], [6, 14]], 'B'),
      // the book it reads (in front, pages grey)
      book: (g) => { rect(g, 10, 1, 12, 6, 'g'); rect(g, 10, 9, 12, 14, 'g'); rect(g, 10, 7, 12, 8, 'X'); rect(g, 13, 0, 13, 17, '.'); dots(g, [[13, 3], [13, 5], [13, 10], [13, 12]], 'X'); },
      // headphones: a band over the head, a cup on each side
      phones: (g) => { dots(g, [[6, 1], [5, 1], [4, 2], [3, 3], [2, 4], [1, 5], [1, 6], [1, 7], [1, 8], [1, 9], [1, 10], [2, 11], [3, 12], [4, 13], [5, 14], [6, 14]], 'g'); rect(g, 7, 0, 9, 1, 'g'); rect(g, 7, 14, 9, 15, 'g'); },
      // a little board in its hand (right side): chart bars, a checklist, a card
      board: (g) => { rect(g, 4, 15, 11, 21, 'g'); dots(g, [[9, 14], [9, 15]], 'X'); },
      bars: (g, f = 0) => { const h = f === 0 ? [2, 3, 5] : f === 1 ? [3, 5, 4] : [4, 4, 6]; h.forEach((n, i) => rect(g, 11 - n, 16 + i * 2, 10, 16 + i * 2, 'X')); },
      checks: (g, n = 1) => { for (let i = 0; i < 3; i++) { rect(g, 5 + i * 2, 19, 5 + i * 2, 20, 'X'); if (i < n) dots(g, [[5 + i * 2, 16], [6 + i * 2, 17], [5 + i * 2, 18]], 'W'); else put(g, 5 + i * 2, 17, 'X'); } },
      card: (g, f = 0) => { rect(g, 4, 15, 11, 21, 'g'); dots(g, [[9, 14], [9, 15]], 'X'); dots(g, f ? [[5, 18], [6, 17], [6, 19], [7, 17], [7, 18], [7, 19], [8, 17], [8, 19], [9, 17], [9, 19]] : [[5, 17], [5, 18], [5, 19], [6, 19], [7, 18], [9, 18]], f ? 'X' : 'W'); },
      wrench: (g, f = 0) => dots(g, f ? [[4, 18], [4, 20], [5, 18], [5, 19], [5, 20], [6, 19], [7, 18], [8, 17], [9, 16], [9, 15], [9, 14]] : [[5, 16], [5, 18], [6, 16], [6, 17], [6, 18], [7, 17], [8, 17], [9, 16], [9, 15], [9, 14]], 'g'),
      wave: (g, f = 0) => { put(g, 9, 14, '.'); dots(g, f ? [[8, 14], [7, 15], [6, 15]] : [[8, 14], [7, 15], [6, 16]], 'X'); },
      arms: (g) => { put(g, 9, 1, '.'); put(g, 9, 14, '.'); dots(g, [[8, 1], [7, 0], [8, 14], [7, 15]], 'X'); },
      step: (g) => { rect(g, 13, 0, 13, 17, '.'); dots(g, [[13, 2], [13, 4], [13, 11], [13, 13]], 'X'); put(g, 9, 1, '.'); put(g, 9, 14, '.'); dots(g, [[8, 1], [8, 14]], 'X'); },
    };
    const make = (...steps) => {
      const g = Array.from({ length: 16 }, () => Array(26).fill('.'));
      BODY.forEach((line, r) => [...line].forEach((ch, c) => ch !== '.' && put(g, r, c, ch)));
      for (const s of steps) s(g);
      return g.map((r) => r.join(''));
    };
    const e = (k, ...a) => (g) => E[k](g, ...a);
    const m = (k) => (g) => M[k](g);
    const a = (k, ...v) => (g) => A[k](g, ...v);
    return {
      idle: make(e('open')),
      lookL: make(e('open', -1)),
      lookR: make(e('open', 1)),
      lookU: make(e('open', 0, -1)),
      blink: make(e('lids')),
      step: make(e('open'), a('step')),
      wave: make(e('happy'), m('smile'), a('wave', 0)),
      wave2: make(e('happy'), m('smile'), a('wave', 1)),
      read: make(e('lids'), a('book')),
      readL: make(e('open', -1, 0), a('book')),
      readR: make(e('open', 1, 0), a('book')),
      happy: make(e('happy'), m('smile')),
      happy2: make(e('happy'), m('grin'), a('arms')),
      sleep: make(e('lids'), a('zzz')),
      sleep2: make(e('lids'), a('zzz', 1)),
      love: make(e('heart'), m('smile'), a('heart')),
      love2: make(e('heart'), m('grin'), a('heart', -1)),
      surprised: make(e('open'), m('o'), a('bang')),
      sad: make(e('sad', 0, 0), m('frown'), a('tear')),
      cry: make(e('lids'), m('frown'), a('tears', 0)),
      cry2: make(e('lids'), m('frown'), a('tears', 1)),
      angry: make(e('angry'), m('flat'), a('vein')),
      angry2: make(e('angry'), m('frown'), a('vein')),
      wink: make(e('wink'), m('smirk'), a('sparkle', 1)),
      cool: make(e('glasses'), m('smirk')),
      thinking: make(e('open', -1, -1), m('dot'), a('think', 3)),
      thinking2: make(e('open', -1, -1), m('dot'), a('think', 2)),
      laugh: make(e('squint'), m('big'), a('tears', 1)),
      laugh2: make(e('squint'), m('big'), a('arms')),
      shy: make(e('open', 0, 0), m('dot'), a('blush')),
      confused: make(e('odd'), m('wavy'), a('ask')),
      dizzy: make(e('cross'), m('wavy'), a('stars', 0)),
      dizzy2: make(e('cross'), m('wavy'), a('stars', 1)),
      starry: make(e('star'), m('grin'), a('sparkle', 1)),
      starry2: make(e('star'), m('grin'), a('sparkle', 0)),
      sing: make(e('happy'), m('o'), a('note', 0)),
      sing2: make(e('happy'), m('dot'), a('note', 1)),
      yawn: make(e('lids'), m('big'), a('tear')),
      proud: make(e('happy'), m('smirk'), a('arms')),
      scared: make(e('small'), m('wavy'), a('sweat')),
      // the pages' jobs
      listen: make(e('happy'), m('smile'), a('phones')),
      listen2: make(e('lids'), m('dot'), a('phones'), a('note', 0)),
      chart: make(e('open', 1), m('smile'), a('board'), a('bars', 0)),
      chart2: make(e('open', 1), m('smile'), a('board'), a('bars', 1)),
      chart3: make(e('happy'), m('grin'), a('board'), a('bars', 2)),
      plan0: make(e('open', 1), m('dot'), a('board'), a('checks', 0)),
      plan: make(e('open', 1), m('smile'), a('board'), a('checks', 1)),
      plan2: make(e('open', 1), m('smile'), a('board'), a('checks', 2)),
      plan3: make(e('happy'), m('grin'), a('board'), a('checks', 3)),
      card: make(e('open', 1), m('dot'), a('card', 0)),
      card2: make(e('happy'), m('smile'), a('card', 1)),
      fix: make(e('open', 1), m('flat'), a('wrench', 0)),
      fix2: make(e('lids'), m('flat'), a('wrench', 1)),
    };
  })();

  // a frame as SVG: one path per colour, a rectangle per run of pixels in a row
  const FILL = { X: 'currentColor', W: 'var(--bg)', g: '#9a9a94', R: '#e5484d', P: '#f4a7b9', B: '#5eb1ef', Y: '#f5c542' };
  const cache = {};
  function paths(f) {
    if (cache[f]) return cache[f];
    const by = {};
    (SPRITE[f] || SPRITE.idle).forEach((line, r) => {
      for (let c = 0; c < line.length; ) {
        const ch = line[c];
        let e = c;
        while (e < line.length && line[e] === ch) e++;
        if (ch !== '.') by[ch] = (by[ch] || '') + `M${c} ${r}h${e - c}v1h-${e - c}z`;
        c = e;
      }
    });
    return (cache[f] = Object.keys(FILL).filter((k) => by[k]).map((k) => `<path d="${by[k]}" fill="${FILL[k]}"/>`).join(''));
  }
  function html(f = 'idle', px = 3) {
    return `<span class="inky" style="--px:${px}px" aria-hidden="true"><svg viewBox="0 0 26 16" width="${26 * px}" height="${16 * px}" shape-rendering="crispEdges">${paths(f)}</svg></span>`;
  }
  const noop = { html, cheer() {}, feel() {}, read() {}, plan() {}, unword() {} };
  if (window !== window.top) return noop; // the Settings demo has none

  // a speech bubble that comes out of a blur where it stands and goes back into one
  function bubble(host) {
    const b = document.createElement('div');
    b.className = 'inky-say';
    b.setAttribute('role', 'status');
    host.append(b);
    let hideT = 0;
    return (text, ms = 3200) => {
      clearTimeout(hideT);
      b.textContent = text;
      b.classList.add('on');
      hideT = setTimeout(() => b.classList.remove('on'), ms);
    };
  }

  /* ---------- on the launch card: as the name is drawn Inky drops in from above, lands beside it
     and blinks once — nothing more; the card then melts with it, and the corner
     one walks in from the edge ---------- */
  const word = document.querySelector('#splash:not(.still) .sp-word');
  let splashOn = false;
  if (word && typeof Splash !== 'undefined' && Splash.t0 != null) {
    splashOn = true;
    const SP = 3;
    const slot = document.createElement('span');
    slot.className = 'sp-pal';
    slot.innerHTML = html('idle', SP);
    const ink = slot.firstChild;
    const pic = ink.firstChild;
    word.append(slot);
    const put = (f, y = 0) => {
      pic.innerHTML = paths(f);
      ink.style.transform = `translateY(${y * SP}px)`;
    };
    const at = (ms, fn) => setTimeout(fn, Math.max(0, Splash.t0 + ms - performance.now()));
    put('idle', -12);
    // it just drops in beside the name, lands and blinks once
    [[-12, 'idle'], [-6, 'idle'], [0, 'idle']].forEach(([y, f], i) => at(1000 + i * 60, () => ((ink.style.opacity = 1), put(f, y))));
    at(1700, () => put('blink'));
    at(1820, () => put('idle'));
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
  const say0 = bubble(pal);
  document.body.append(pal);

  let shown = '';
  let dy = 0;
  // each frame's paths are parsed once and kept as a node; a step only swaps nodes (walking swaps
  // every 85 ms, and re-parsing the markup each time cost ~5 ms in the middle of a page slide)
  const nodes = {};
  const frame = (f) => {
    if (nodes[f]) return nodes[f];
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.innerHTML = paths(f);
    return (nodes[f] = g);
  };
  const draw = (f, y = 0) => {
    if (shown !== f) svg.replaceChildren(frame(f)), (shown = f);
    if (dy !== y) (dy = y), (me.style.transform = y ? `translateY(${y * PX}px)` : '');
  };

  // it speaks at most every few seconds; events (a word, the end of an article) always get through
  let lastSay = 0;
  function say(text, force = false, ms) {
    const now = Date.now();
    if (!text || (!force && now - lastSay < 7000)) return;
    lastSay = now;
    say0(text, ms);
  }

  // each feeling or job: its frames (played in turn, a step every 600 ms) and whether it hops
  const LOOP = {
    read: [['readL', 'read', 'readR', 'read'], false], listen: [['listen', 'listen2'], true],
    chart: [['chart', 'chart2', 'chart3', 'chart2'], false], plan: [['plan', 'plan2', 'plan3', 'plan2'], false],
    card: [['card', 'card', 'card2', 'card2'], false], fix: [['fix', 'fix2'], false],
    happy: [['happy', 'happy2'], true], sleep: [['sleep', 'sleep2'], false], love: [['love', 'love2'], true],
    surprised: [['surprised'], false], sad: [['sad'], false], angry: [['angry', 'angry2'], true], wink: [['wink'], false],
    cool: [['cool'], false], thinking: [['thinking', 'thinking2'], false], laugh: [['laugh', 'laugh2'], true],
    shy: [['shy'], false], confused: [['confused', 'lookL', 'confused', 'lookR'], false], dizzy: [['dizzy', 'dizzy2'], false],
    cry: [['cry', 'cry2'], false], starry: [['starry', 'starry2'], true], sing: [['sing', 'sing2'], true],
    yawn: [['yawn'], false], proud: [['proud'], false], scared: [['scared'], false], wave: [['wave', 'wave2'], false],
  };
  // each page's job
  const JOB = { reader: 'read', watch: 'listen', stats: 'chart', plan: 'plan', cards: 'card', settings: 'fix' };
  const SLEEP_AFTER = 120000;
  let lastInput = Date.now();
  let sleeping = false;
  let yawned = false;
  let busy = false; // a scripted move (walk, hop, fidget) is playing
  let feeling = null; // a passing feeling, over the page's job until `until`
  let until = 0;
  let hover = false;
  let typing = false;
  let look = 'idle';
  let tick = 0;
  let seqT = 0;
  let readDone = false;
  let planN = 0;
  let sang = false;
  const music = () => !!document.querySelector('.mp.playing');
  function base() {
    if (sleeping) return 'sleep';
    if (feeling && Date.now() < until) return feeling;
    feeling = null;
    if (hover) return 'shy';
    if (typing) return 'thinking';
    if (state.view === 'reader' && readDone) return 'starry';
    if (state.view === 'plan' && planN === 2) return 'starry';
    const j = JOB[state.view];
    if (j) return j;
    return music() ? 'sing' : 'idle';
  }
  const rest = () => {
    const b = base();
    return b === 'idle' ? look : LOOP[b][0][0];
  };

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
  // a feeling for a while (its frames play on the timer), maybe starting with a jump
  function feel(name, ms = 2400, hop = false) {
    if (!LOOP[name]) return;
    feeling = name;
    until = Date.now() + ms;
    sleeping = false;
    if (hop && !reduceMotion.matches) play([[LOOP[name][0][0], -2, 140], [LOOP[name][0][0], 0, 100]]);
    else if (!busy) draw(LOOP[name][0][0], 0);
  }

  // little things it does on its own, now and then
  const FIDGETS = [
    () => play([['blink', 0, 110], ['idle', 0, 140], ['blink', 0, 110]]),
    () => play([['lookL', 0, 700], ['idle', 0, 200], ['lookR', 0, 700]]),
    () => play([['lookU', 0, 900], ['idle', 0, 100]]),
    () => play([['wink', 0, 700]]),
    () => play([['thinking', 0, 600], ['thinking2', 0, 600], ['thinking', 0, 600]]),
    () => play([['idle', -1, 90], ['happy', -2, 140], ['idle', -1, 90]]),
    () => play([['wave', 0, 160], ['wave2', 0, 160], ['wave', 0, 160], ['wave2', 0, 160]]),
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
  const pace = () => {
    const h = home(state.view);
    walkTo(h + (Math.random() < 0.5 ? -1 : 1) * 18, () => setTimeout(() => !busy && walkTo(h), 500));
  };

  // the one timer: the feeling's or job's frames, a fidget now and then, a word now and then
  let quietSince = Date.now();
  setInterval(() => {
    if (document.hidden || reduceMotion.matches || busy || splashOn) return;
    tick++;
    const idleFor = Date.now() - lastInput;
    if (!sleeping && !yawned && idleFor > SLEEP_AFTER - 12000) return (yawned = true), play([['yawn', 0, 1400], ['blink', 0, 300]]);
    if (!sleeping && idleFor > SLEEP_AFTER) sleeping = true;
    const m = music();
    if (m && !sang && state.view === 'library') say(words().music);
    sang = m;
    const b = base();
    if (b === 'idle') {
      draw(look, tick % 5 === 0 ? -1 : 0); // a small breath
      if (Math.random() < 0.12) FIDGETS[(Math.random() * FIDGETS.length) | 0]();
      if (Date.now() - quietSince > 300000 && Date.now() - lastSay > 300000) (quietSince = Date.now()), say(pick(words().tips));
      return;
    }
    const [frames, hops] = LOOP[b];
    draw(frames[tick % frames.length], hops && tick % 2 ? -1 : 0);
  }, 600);

  // its eyes follow the pointer (only a change of side is drawn)
  addEventListener(
    'pointermove',
    (e) => {
      const r = me.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      look = e.clientX < cx - 160 ? 'lookL' : e.clientX > cx + 160 ? 'lookR' : e.clientY < r.top - 220 ? 'lookU' : 'idle';
      if (!busy && base() === 'idle' && shown !== look && /^(idle|look[LRU])$/.test(shown)) draw(look, dy);
    },
    { passive: true }
  );
  // any touch wakes it — with a start
  const wake = () => {
    lastInput = Date.now();
    yawned = false;
    if (!sleeping) return;
    sleeping = false;
    feel('surprised', 1200, true);
    say(words().wake, true);
  };
  for (const ev of ['pointerdown', 'keydown', 'wheel']) addEventListener(ev, wake, { passive: true, capture: true });
  // scrolled hard: dizzy
  let spin = 0;
  let spinT = 0;
  addEventListener(
    'wheel',
    (e) => {
      spin += Math.abs(e.deltaY);
      clearTimeout(spinT);
      spinT = setTimeout(() => (spin = 0), 350);
      if (spin > 6000) (spin = 0), feel('dizzy', 1800), say(words().dizzy);
    },
    { passive: true }
  );
  // writing somewhere (a translation, a note, the search): it thinks along
  addEventListener('focusin', (e) => (typing = !!(e.target.closest && e.target.closest('input, textarea, [contenteditable="true"]'))));
  addEventListener('focusout', () => (typing = false));
  me.addEventListener('pointerenter', () => ((hover = true), !busy && draw(rest(), dy)));
  me.addEventListener('pointerleave', () => ((hover = false), !busy && draw(rest(), dy)));

  // pokes: one cheers, a double click is love, too many make it cross
  let pokes = [];
  me.addEventListener('click', () => {
    const now = Date.now();
    pokes = pokes.filter((t0) => now - t0 < 2500).concat(now);
    if (pokes.length >= 6) return (pokes = []), feel('angry', 2600, true), say(words().angry, true);
    if (pokes.length === 2) return feel('love', 2600, true), say(words().love, true);
    if (pokes.length === 1) cheer(), say(pick(words().poke), true, 1800);
  });

  let cheers = 0;
  function cheer(w) {
    if (w) say(words().word(w), true);
    if (reduceMotion.matches) return;
    const f = cheers++ % 2 ? 'laugh' : 'happy';
    feel(f, 1500);
    play([[f, 0, 70], [f + '2', -2, 150], [f, 0, 110], [f + '2', -2, 150], [f, 0, 300]]);
  }
  // a word thrown away: tears if it had a translation
  function unword(w, hadTr) {
    feel(hadTr ? 'cry' : 'sad', 2400);
    say(words().unword(w), true);
  }
  // the article's progress (app.js onScroll): starry eyes at the end
  function read(ratio, id) {
    const done = ratio >= 0.95;
    if (done && !readDone && state.view === 'reader') (readDone = true), feel('starry', 2600, true), say(words().end, true);
    if (!done) readDone = false;
    if (id !== read.id) (read.id = id), (readDone = done);
  }
  // the plan's count (plan.js render)
  function plan(n) {
    if (n === 2 && planN !== 2 && state.view === 'plan') feel('starry', 2600, true), say(words().plan[2], true);
    planN = n;
  }

  // it walks along while the pages slide, and says something about where you are
  const seen = {};
  const show = showView;
  showView = function (name) {
    const from = state.view;
    show(name);
    if (name === from) return;
    walkTo(home(name));
    const now = Date.now();
    if (now - (seen[name] || 0) < 120000) return;
    seen[name] = now;
    const w = words();
    const line = name === 'library' ? pick(w.lib) : name === 'plan' ? w.plan[planN] : w[name] && pick(w[name]);
    if (line) setTimeout(() => say(line), 700);
  };
  // the dark: sunglasses on
  if (typeof toggleTheme === 'function') {
    const theme = toggleTheme;
    toggleTheme = function (...a) {
      const r = theme.apply(this, a);
      setTimeout(() => {
        const dark = document.documentElement.dataset.theme === 'dark';
        feel(dark ? 'cool' : 'wink', 2600);
        say(dark ? words().dark : words().light, true);
      }, 400);
      return r;
    };
  }

  // it walks in from the edge once the launch card has gone
  x = 30 * PX;
  pal.style.transform = `translateX(${x}px)`;
  const enter = () => {
    const sp = document.getElementById('splash');
    if (sp && !sp.classList.contains('out')) return setTimeout(enter, 150);
    splashOn = false;
    setTimeout(() => walkTo(home(state.view), () => setTimeout(() => say(state.view === 'library' ? pick(words().lib) : ''), 300)), 250);
  };
  setTimeout(enter, 600);

  return { html, cheer, feel, read, plan, unword };
})();

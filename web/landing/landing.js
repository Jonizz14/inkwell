'use strict';
// The presentation page (web/landing/index.html). The language is the one the reader was left in
// (a365.lang, shared with the app on this site), else the browser's; picking one here sets it for
// the reader too. Someone who has read here before is greeted by name; the installed app (a home-
// screen icon) goes straight to the reader. Motion: transform, opacity and blur only.
(() => {
  const T = {
    uz: {
      title: 'Inkwell — ingliz tilida o‘qing, har bir so‘z siz bilan qoladi',
      navFeatures: 'Imkoniyatlar', navDownload: 'Yuklab olish', navRead: 'O‘qish', navBack: 'Davom etish',
      eyebrow: 'Inkwell', hi: (n) => `Qaytganingiz bilan, ${n}.`,
      h1: 'Ingliz tilida o‘qing.<br><span class="soft">Har bir so‘z siz bilan qoladi.</span>',
      sub: 'Maqolalar, podkastlar va o‘zingizning lug‘atingiz — bitta tinch, qora-oq oynada.',
      ctaRead: 'Brauzerda o‘qish', ctaBack: 'O‘qishni davom ettirish', ctaDl: 'Mac yoki Windows uchun yuklab olish',
      zCap: 'MacBook’da, Windows’da va brauzerda — <b>bir xil Inkwell.</b>',
      hlT: 'Asosiylari.',
      g1: 'Kutubxona. <span>Sizning PDF’laringiz, The Guardian va podkastlar — bitta qatorda.</span>',
      g2: 'O‘qish. <span>Notanish so‘zni bosing — tarjimasi bilan lug‘atga tushadi.</span>',
      g3: 'Lug‘at. <span>Har bir so‘z gapi va tarjimasi bilan. PDF qilib chiqaring.</span>',
      g4: 'Tinglash. <span>YouTube podkastlari, subtitrlar va tezlik — o‘qishning yonida.</span>',
      g5: 'Statistika. <span>Seriya, rekordlar va jami natijalar — har kuni qaytib qaraysiz.</span>',
      wT: 'So‘zlar sizni<br>kuzatib boradi.',
      wSub: 'Bir maqolada saqlagan so‘zingiz <b>boshqa har bir maqolada</b> ham belgilanadi. Tarjimasi bir bosishda.',
      wCount: 'Lug‘atda', tr: { evolved: 'rivojlangan', gradually: 'asta-sekin', lens: 'linza, ko‘z gavhari', membrane: 'parda' },
      bT: 'Bir ilova.<br>O‘rganish uchun hamma narsa.',
      t1h: 'Lug‘at va kartochkalar', t1p: 'Saqlagan so‘zlaringiz kartochkalarga aylanadi va kerakli kuni takrorga qaytadi.',
      t2h: 'Seriya', t2p: 'Har kuni ozgina — olov o‘chmaydi.', t2s: 'kun ketma-ket',
      t3h: 'Statistika', t3p: 'Bugungi maqsad, hafta, rekordlar va jami natijalar.',
      t4h: 'Tinglash', t4p: 'Podkastni eshitib, yonida yozib boring.',
      t5h: 'Fokus', t5p: 'Faqat siz o‘qiyotgan abzats.',
      t6h: 'Inky bilan tanishing', t6p: 'Har sahifada siz bilan yuradigan kichkina hamroh.',
      t7h: 'Reja', t7p: 'Har kuni bitta maqola va bitta podkast.',
      t8h: 'The Guardian', t8p: 'Har kuni yangi maqolalar, bo‘limlar bo‘yicha.',
      t9h: 'Kunduzi va tunda', t9p: 'Yorug‘ va qorong‘i mavzu, tizimga moslashadi.',
      nT: 'Bepul. Ochiq. Tinch.', n1: 'reklama', n2: 'til: o‘zbek, ingliz, rus', n3: 'platforma: Mac, Windows, veb', n4: 'ochiq kod',
      dT: 'Inkwell’ni oling.', dMac: 'Apple Silicon. O‘zi yangilanadi.', dWin: 'Windows 10 va 11. O‘zi yangilanadi.', dWebH: 'Brauzerda', dWeb: 'Telefonda ham. O‘rnatish shart emas.',
      dBtn: 'Yuklab olish', dOpen: 'Ochish', ver: (v, d) => `Oxirgi versiya ${v} · ${d}`,
      fRel: 'Yangilanishlar', fLic: 'AGPL-3.0 · ochiq kod',
    },
    en: {
      title: 'Inkwell — read in English, keep every word',
      navFeatures: 'Features', navDownload: 'Download', navRead: 'Read', navBack: 'Continue',
      eyebrow: 'Inkwell', hi: (n) => `Welcome back, ${n}.`,
      h1: 'Read in English.<br><span class="soft">Keep every word.</span>',
      sub: 'Articles, podcasts and a vocabulary of your own — in one calm, black-and-white window.',
      ctaRead: 'Read in your browser', ctaBack: 'Continue reading', ctaDl: 'Download for Mac or Windows',
      zCap: 'On a Mac, on Windows, in your browser — <b>the same Inkwell.</b>',
      hlT: 'Get the highlights.',
      g1: 'Library. <span>Your PDFs, The Guardian and podcasts — side by side.</span>',
      g2: 'Reading. <span>Tap a word you don’t know — it goes to your vocabulary with its translation.</span>',
      g3: 'Vocabulary. <span>Every word with its sentence and translation. Export it as a PDF.</span>',
      g4: 'Listening. <span>YouTube podcasts, subtitles and speed — right next to your reading.</span>',
      g5: 'Statistics. <span>Streaks, records and all-time totals — worth checking every day.</span>',
      wT: 'Your words<br>follow you.',
      wSub: 'A word you save in one article is marked <b>in every other article</b> too. Its translation is one tap away.',
      wCount: 'In your vocabulary', tr: { evolved: 'developed over time', gradually: 'slowly, step by step', lens: 'the eye’s focusing part', membrane: 'a thin layer' },
      bT: 'One app.<br>Everything to learn with.',
      t1h: 'Vocabulary and flashcards', t1p: 'The words you save become cards that come back on the day you need them.',
      t2h: 'Streak', t2p: 'A little every day keeps the fire going.', t2s: 'days in a row',
      t3h: 'Statistics', t3p: 'Today’s goal, the week, records and all-time totals.',
      t4h: 'Listening', t4p: 'Hear a podcast and write beside it.',
      t5h: 'Focus', t5p: 'Only the paragraph you are reading.',
      t6h: 'Meet Inky', t6p: 'A tiny companion that walks every page with you.',
      t7h: 'Plan', t7p: 'One article and one podcast a day.',
      t8h: 'The Guardian', t8p: 'Fresh articles every day, by section.',
      t9h: 'Day and night', t9p: 'Light and dark, following your system.',
      nT: 'Free. Open. Calm.', n1: 'ads', n2: 'languages: Uzbek, English, Russian', n3: 'platforms: Mac, Windows, web', n4: 'open source',
      dT: 'Get Inkwell.', dMac: 'Apple Silicon. Updates itself.', dWin: 'Windows 10 and 11. Updates itself.', dWebH: 'In the browser', dWeb: 'On your phone too. Nothing to install.',
      dBtn: 'Download', dOpen: 'Open', ver: (v, d) => `Latest version ${v} · ${d}`,
      fRel: 'Releases', fLic: 'AGPL-3.0 · open source',
    },
    ru: {
      title: 'Inkwell — читайте по-английски, каждое слово остаётся с вами',
      navFeatures: 'Возможности', navDownload: 'Загрузить', navRead: 'Читать', navBack: 'Продолжить',
      eyebrow: 'Inkwell', hi: (n) => `С возвращением, ${n}.`,
      h1: 'Читайте по-английски.<br><span class="soft">Каждое слово остаётся.</span>',
      sub: 'Статьи, подкасты и ваш собственный словарь — в одном спокойном чёрно-белом окне.',
      ctaRead: 'Читать в браузере', ctaBack: 'Продолжить чтение', ctaDl: 'Загрузить для Mac или Windows',
      zCap: 'На Mac, на Windows и в браузере — <b>тот же Inkwell.</b>',
      hlT: 'Главное.',
      g1: 'Библиотека. <span>Ваши PDF, The Guardian и подкасты — рядом.</span>',
      g2: 'Чтение. <span>Нажмите на незнакомое слово — оно попадёт в словарь с переводом.</span>',
      g3: 'Словарь. <span>Каждое слово с предложением и переводом. Можно выгрузить в PDF.</span>',
      g4: 'Аудирование. <span>Подкасты с YouTube, субтитры и скорость — рядом с чтением.</span>',
      g5: 'Статистика. <span>Серии, рекорды и итоги за всё время — хочется заглядывать каждый день.</span>',
      wT: 'Слова идут<br>за вами.',
      wSub: 'Слово, сохранённое в одной статье, отмечается <b>во всех остальных</b>. Перевод — в одно нажатие.',
      wCount: 'В словаре', tr: { evolved: 'развились', gradually: 'постепенно', lens: 'хрусталик', membrane: 'оболочка' },
      bT: 'Одно приложение.<br>Всё, чтобы учиться.',
      t1h: 'Словарь и карточки', t1p: 'Сохранённые слова становятся карточками и возвращаются в нужный день.',
      t2h: 'Серия', t2p: 'Понемногу каждый день — огонь не гаснет.', t2s: 'дней подряд',
      t3h: 'Статистика', t3p: 'Цель на сегодня, неделя, рекорды и итоги.',
      t4h: 'Аудирование', t4p: 'Слушайте подкаст и пишите рядом.',
      t5h: 'Фокус', t5p: 'Только абзац, который вы читаете.',
      t6h: 'Знакомьтесь, Инки', t6p: 'Маленький спутник, который ходит с вами по страницам.',
      t7h: 'План', t7p: 'Одна статья и один подкаст в день.',
      t8h: 'The Guardian', t8p: 'Свежие статьи каждый день, по разделам.',
      t9h: 'Днём и ночью', t9p: 'Светлая и тёмная тема, как в системе.',
      nT: 'Бесплатно. Открыто. Спокойно.', n1: 'рекламы', n2: 'языка: узбекский, английский, русский', n3: 'платформы: Mac, Windows, веб', n4: 'открытый код',
      dT: 'Скачайте Inkwell.', dMac: 'Apple Silicon. Обновляется сам.', dWin: 'Windows 10 и 11. Обновляется сам.', dWebH: 'В браузере', dWeb: 'И на телефоне. Ничего не нужно ставить.',
      dBtn: 'Загрузить', dOpen: 'Открыть', ver: (v, d) => `Последняя версия ${v} · ${d}`,
      fRel: 'Обновления', fLic: 'AGPL-3.0 · открытый код',
    },
  };

  const store = {
    get: (k) => {
      try {
        return localStorage.getItem(k);
      } catch {
        return null;
      }
    },
    set: (k, v) => {
      try {
        localStorage.setItem(k, v);
      } catch {}
    },
  };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const name = (store.get('a365.name') || '').trim();
  const back = !!(name || store.get('a365.lang') || store.get('a365.theme'));
  const pick = () => {
    const l = store.get('a365.lang');
    if (T[l]) return l;
    const n = (navigator.language || '').slice(0, 2);
    return n === 'ru' ? 'ru' : n === 'en' ? 'en' : 'uz';
  };
  let lang = pick();

  function apply() {
    const t = T[lang];
    document.documentElement.lang = lang;
    document.title = t.title;
    for (const el of $$('[data-k]')) {
      const v = t[el.dataset.k];
      if (typeof v === 'string') el.innerHTML = v;
    }
    // someone who has read here before: by name, and the buttons say "continue"
    if (back) {
      $('.nav .pill').textContent = t.navBack;
      $('.ctas .pill').textContent = t.ctaBack;
    }
    const hi = $('#hi');
    hi.hidden = !name;
    if (name) hi.textContent = t.hi(name);
    $$('#langs button').forEach((b) => b.classList.toggle('on', b.dataset.l === lang));
    demo.build();
    if (rel) showVer();
  }

  $('#langs').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || b.dataset.l === lang) return;
    lang = b.dataset.l;
    store.set('a365.lang', lang); // the reader opens in it too
    apply();
  });

  /* ---------- in through a blur, as each part comes into view ---------- */
  const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && (e.target.classList.add('in'), io.unobserve(e.target))), { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
  $$('.rv').forEach((el) => io.observe(el));

  /* ---------- the bar gets its line once the page moves; the laptop draws back ---------- */
  const nav = $('#nav');
  const zoom = $('#zoom');
  const mac = $('#mac');
  const lid = $('#lid');
  const scr = $('#scr');
  const sview = $('#sview');
  const sbody = $('#sbody');
  const zcap = $('#zcap');
  const clamp = (v) => Math.min(1, Math.max(0, v));
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  const END = 0.418; // where that heading is, as a part of img/screen-body.jpg's height
  // Over the section's 300vh: first the screen fills the window and the article scrolls in it,
  // then the whole laptop draws back to its own size (from the screen's centre, which starts at
  // the window's centre), and last the line under it comes in through a blur. Sizes are read
  // without the transform (offset*), so nothing here makes the page lay out again.
  function zoomFrame() {
    if (reduce) return;
    const span = zoom.offsetHeight - innerHeight;
    const p = clamp(-zoom.getBoundingClientRect().top / span);
    const sw = scr.offsetWidth;
    const sh = scr.offsetHeight;
    const cover = Math.max(innerWidth / sw, innerHeight / sh) * 1.02;
    const s0 = Math.min(cover, innerWidth < 735 ? 2.4 : 4);
    const e = ease(clamp((p - 0.1) / 0.65));
    const s = s0 + (1 - s0) * e;
    const oy = lid.offsetTop + scr.offsetTop + sh / 2; // the screen's centre, inside the laptop
    const ty = (innerHeight / 2 - (mac.offsetTop + oy)) * (1 - e);
    mac.style.transformOrigin = `50% ${oy}px`;
    mac.style.transform = `translateY(${ty.toFixed(1)}px) scale(${s.toFixed(4)})`;
    // the article scrolls until its second heading sits just under the app's bar, so the screen
    // never ends on a line cut in half
    sbody.style.transform = `translateY(${(-sbody.offsetHeight * END * ease(clamp(p / 0.85))).toFixed(1)}px)`;
    const q = clamp((p - 0.74) / 0.16);
    zcap.style.opacity = q;
    zcap.style.filter = q < 1 ? `blur(${((1 - q) * 10).toFixed(1)}px)` : 'none';
    zcap.style.transform = `translateY(${((1 - q) * 14).toFixed(1)}px)`;
  }

  let ticking = false;
  function onScroll() {
    ticking = false;
    nav.classList.toggle('lined', scrollY > 8);
    zoomFrame();
  }
  addEventListener('scroll', () => ticking || ((ticking = true), requestAnimationFrame(onScroll)), { passive: true });
  addEventListener('resize', () => requestAnimationFrame(onScroll));
  sbody.addEventListener('load', onScroll);

  /* ---------- the highlights: a dot per card, the one in the middle is long ---------- */
  const gal = $('#gal');
  const cards = $$('.card', gal);
  const dots = $('#gdots');
  dots.innerHTML = cards.map((_, i) => `<button aria-label="${i + 1}"></button>`).join('');
  const dotEls = $$('button', dots);
  const centerOf = (c) => c.offsetLeft + c.offsetWidth / 2 - gal.clientWidth / 2;
  dots.addEventListener('click', (e) => {
    const i = dotEls.indexOf(e.target.closest('button'));
    if (i >= 0) gal.scrollTo({ left: centerOf(cards[i]), behavior: reduce ? 'auto' : 'smooth' });
  });
  function nearest() {
    const mid = gal.scrollLeft;
    let best = 0;
    cards.forEach((c, i) => Math.abs(centerOf(c) - mid) < Math.abs(centerOf(cards[best]) - mid) && (best = i));
    dotEls.forEach((d, i) => d.classList.toggle('on', i === best));
  }
  gal.addEventListener('scroll', () => requestAnimationFrame(nearest), { passive: true });
  nearest();

  /* ---------- the reading demo: four words are saved one after another ---------- */
  const SENT = 'Scientists have shown that eyes have {evolved} very {gradually} from a simple light-dark sensor. The eye works like a camera, with a {lens} for focusing and a light-sensitive {membrane}.';
  const demo = (() => {
    const box = $('#demo');
    const cnt = $('#cnt');
    let timer = 0;
    let started = false;
    function build() {
      const tr = T[lang].tr;
      box.innerHTML = SENT.replace(/\{(\w+)\}/g, (_, w) => `<span class="w" data-w="${w}">${w}<span class="tip">${tr[w]}</span></span>`);
      cnt.textContent = '0';
      if (started) run();
    }
    function run() {
      clearTimeout(timer);
      const ws = $$('.w', box);
      ws.forEach((w) => w.classList.remove('on', 'tipon'));
      cnt.textContent = '0';
      let i = 0;
      const step = () => {
        if (i > 0) ws[i - 1].classList.remove('tipon');
        if (i === ws.length) return void (timer = setTimeout(run, 2600)); // and again
        ws[i].classList.add('on', 'tipon');
        cnt.textContent = String(++i);
        timer = setTimeout(step, 1500);
      };
      timer = setTimeout(step, 600);
    }
    new IntersectionObserver((es) => {
      const on = es[0].isIntersecting;
      if (on && !started) (started = true), run();
      if (!on && started) (started = false), clearTimeout(timer);
    }, { threshold: 0.4 }).observe(box);
    return { build };
  })();

  /* ---------- the streak tile: the week fills in, the number counts up ---------- */
  new IntersectionObserver((es, o) => {
    if (!es[0].isIntersecting) return;
    o.disconnect();
    const bars = $$('#flame i');
    const n = $('#streak');
    bars.forEach((b, i) => setTimeout(() => {
      b.classList.add('on');
      b.animate([{ transform: 'scaleY(0.2)', filter: 'blur(4px)' }, { transform: 'none', filter: 'none' }], { duration: 500, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
      n.textContent = String(i + 1);
    }, reduce ? 0 : 250 + i * 160));
  }, { threshold: 0.5 }).observe($('#flame'));

  /* ---------- Inky, as in the app: the same pixels; it blinks now and then ---------- */
  const INK = 'M14 2h1v1h-1zM13 3h2v1h-2zM12 4h2v1h-2zM11 5h2v1h-2zM9 6h6v1h-6zM9 7h6v1h-6zM7 8h10v1h-10zM6 9h12v1h-12zM6 10h2v1h-2zM10 10h4v1h-4zM16 10h2v1h-2zM5 11h3v1h-3zM10 11h4v1h-4zM16 11h3v1h-3zM6 12h12v1h-12zM6 13h12v1h-12zM7 14h10v1h-10zM7 15h1v1h-1zM9 15h1v1h-1zM14 15h1v1h-1zM16 15h1v1h-1z';
  $('#inky').innerHTML = `<svg viewBox="0 0 26 16" width="156" height="96" shape-rendering="crispEdges" aria-hidden="true">
      <path d="${INK}" fill="currentColor"/><path class="lid" d="M8 10h2v1h-2zM14 10h2v1h-2z" fill="currentColor"/></svg>`;
  const inkyLid = $('#inky .lid');
  (function blink() {
    setTimeout(() => {
      inkyLid.style.opacity = 1;
      setTimeout(() => ((inkyLid.style.opacity = 0), blink()), 140);
    }, 2200 + Math.random() * 2600);
  })();

  /* ---------- downloads: the newest release's files, straight from GitHub ---------- */
  let rel = null;
  function showVer() {
    const d = new Date(rel.published_at);
    const fmt = new Intl.DateTimeFormat(lang === 'uz' ? 'ru' : lang, { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
    $('#ver').textContent = T[lang].ver(rel.tag_name.replace(/^v/, ''), fmt);
  }
  fetch('https://api.github.com/repos/Jonizz14/inkwell/releases/latest')
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .then((r) => {
      rel = r;
      const a = (re) => (r.assets || []).find((x) => re.test(x.name));
      const mac = a(/\.dmg$/);
      const win = a(/Setup.*\.exe$/);
      if (mac) $('#dl-mac').href = mac.browser_download_url;
      if (win) $('#dl-win').href = win.browser_download_url;
      showVer();
    })
    .catch(() => {});

  apply();
  onScroll();
})();

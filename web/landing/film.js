'use strict';
// Inkwell's film (film.html): one minute, cut to "Digital Lemonade" (Kevin MacLeod, CC BY 4.0) at
// 120 bpm — a beat every 0.5 s from 0.025 s, a bar every 2 s, the drop at 32 s. Nothing here runs
// on timers: render(t) works every scene out from the music's clock, so the picture always sits
// on the beat, seeking just works, and any frame can be drawn on its own (__seek).
(() => {
  const T = {
    uz: {
      poster: 'Filmni ko‘rish · 1 daqiqa', again: 'Yana ko‘rish',
      a: ['Ingliz', 'tilida', 'o‘qing.'], b: ['Har bir', 'so‘z', 'qoladi.'],
      tap: 'Notanish so‘zni bosing — tarjimasi bilan saqlanadi.', inVocab: 'Lug‘atda',
      tr: ['gipnoz', 'qo‘shimcha', 'trans holatiga o‘xshash', 'ishonch', 'shifobaxsh xususiyatlar'],
      cardTop: 'Har bir so‘z o‘z kunida qaytadi.', front: 'belief', back: 'ishonch', grades: ['Unutdim', 'Qiyin', 'Bilardim'],
      dayTitle: 'Har kuni ozgina.', days: 'kun ketma-ket',
      totTitle: 'Hammasi hisobda.', tot: [['Jami vaqt', '6 s 32 daq'], ['O‘qilgan so‘zlar', 11482], ['Lug‘atda', 322]],
      mac: ['macOS.', 'Windows.', 'Veb.'],
      lis: ['Tinglang.', 'Podkastlar va subtitrlar — o‘qishning yonida.'],
      foc: ['Fokus.', 'Faqat siz o‘qiyotgan abzats.'],
      inky: ['Inky bilan tanishing.', 'Har sahifada siz bilan.'],
      free: ['Bepul.', 'Ochiq.', 'Tinch.'],
      end: 'Bepul — macOS, Windows va brauzerda',
    },
    en: {
      poster: 'Watch the film · 1 minute', again: 'Watch again',
      a: ['Read', 'in', 'English.'], b: ['Keep', 'every', 'word.'],
      tap: 'Tap a word you don’t know — it’s saved with its translation.', inVocab: 'In your vocabulary',
      tr: ['a sleep-like state', 'used alongside', 'dream-like', 'something held true', 'able to heal'],
      cardTop: 'Every word comes back on its day.', front: 'belief', back: 'something held true', grades: ['Forgot', 'Hard', 'Knew it'],
      dayTitle: 'A little every day.', days: 'days in a row',
      totTitle: 'It all adds up.', tot: [['Total time', '6 h 32 min'], ['Words read', 11482], ['In vocabulary', 322]],
      mac: ['macOS.', 'Windows.', 'Web.'],
      lis: ['Listen.', 'Podcasts and subtitles — right beside your reading.'],
      foc: ['Focus.', 'Only the paragraph you are reading.'],
      inky: ['Meet Inky.', 'On every page, with you.'],
      free: ['Free.', 'Open.', 'Calm.'],
      end: 'Free — on macOS, Windows and the web',
    },
    ru: {
      poster: 'Смотреть фильм · 1 минута', again: 'Смотреть снова',
      a: ['Читайте', 'по-', 'английски.'], b: ['Каждое', 'слово', 'остаётся.'],
      tap: 'Нажмите на незнакомое слово — оно сохранится с переводом.', inVocab: 'В словаре',
      tr: ['гипноз', 'дополнительный', 'трансоподобный', 'убеждение', 'целебные свойства'],
      cardTop: 'Каждое слово возвращается в свой день.', front: 'belief', back: 'убеждение', grades: ['Забыл', 'Трудно', 'Знал'],
      dayTitle: 'Понемногу каждый день.', days: 'дней подряд',
      totTitle: 'Всё на счету.', tot: [['Всего', '6 ч 32 мин'], ['Прочитано слов', 11482], ['В словаре', 322]],
      mac: ['macOS.', 'Windows.', 'Веб.'],
      lis: ['Слушайте.', 'Подкасты и субтитры — рядом с чтением.'],
      foc: ['Фокус.', 'Только абзац, который вы читаете.'],
      inky: ['Знакомьтесь, Инки.', 'На каждой странице, с вами.'],
      free: ['Бесплатно.', 'Открыто.', 'Спокойно.'],
      end: 'Бесплатно — на macOS, Windows и в браузере',
    },
  };
  let lang = 'uz';
  try {
    const l = localStorage.getItem('a365.lang');
    if (T[l]) lang = l;
    else if (/^en/.test(navigator.language)) lang = 'en';
    else if (/^ru/.test(navigator.language)) lang = 'ru';
  } catch {}
  const t_ = T[lang];
  document.documentElement.lang = lang;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const stage = $('#stage');
  const music = $('#music');
  const END = 64.5;
  const nf = new Intl.NumberFormat(lang === 'uz' ? 'ru' : lang);

  /* ---------------- the scenes ---------------- */
  const words = (list, cls = '') => list.map((w) => `<span class="w ${cls}">${esc(w)}</span>`).join(' ');
  const INK = 'M14 2h1v1h-1zM13 3h2v1h-2zM12 4h2v1h-2zM11 5h2v1h-2zM9 6h6v1h-6zM9 7h6v1h-6zM7 8h10v1h-10zM6 9h12v1h-12zM6 10h2v1h-2zM10 10h4v1h-4zM16 10h2v1h-2zM5 11h3v1h-3zM10 11h4v1h-4zM16 11h3v1h-3zM6 12h12v1h-12zM6 13h12v1h-12zM7 14h10v1h-10zM7 15h1v1h-1zM9 15h1v1h-1zM14 15h1v1h-1zM16 15h1v1h-1z';
  const PARA = 'The use of {hypnosis} as a {complementary} therapy might seem quite modern, but it has a long history. Forms of {trance-like} states have been practised for thousands of years, in the {belief} that they have {healing properties}.';
  let k = 0;
  const para = PARA.replace(/\{([^}]+)\}/g, (_, w) => `<span class="m">${esc(w)}<span class="tip"><small>${esc(w)}</small>${esc(t_.tr[k++])}</span></span>`);
  const shot = (src, w) => `<div class="shot" style="width:${w}px"><img src="${src}" alt="" /></div>`;
  const word = `<div class="word"><span class="i"><span class="stem">ı</span><span class="dot"></span></span>${[...'nkwell'].map((c) => `<span class="l">${c}</span>`).join('')}</div>`;

  stage.innerHTML = `
    <div class="sc" id="s-name">${word}</div>
    <div class="sc" id="s-a"><p class="big">${words(t_.a)}</p></div>
    <div class="sc" id="s-b"><p class="big">${words(t_.b.slice(0, 2))} ${words(t_.b.slice(2), 'soft')}</p></div>
    <div class="sc" id="s-read"><p class="sub" style="margin:0 0 70px">${esc(t_.tap)}</p><p class="para">${para}</p><div class="count">${esc(t_.inVocab)} <b id="cnt">0</b></div></div>
    <div class="sc" id="s-card"><p class="sub" style="margin:0 0 60px">${esc(t_.cardTop)}</p>
      <div class="cardwrap"><div class="card" id="card">
        <div class="face"><div class="fw">${esc(t_.front)}</div><div class="fs">…in the <b>belief</b> that they have healing properties.</div></div>
        <div class="face back"><div class="fw" style="font-size:64px;color:var(--mute)">${esc(t_.front)}</div><div class="ft">${esc(t_.back)}</div><div class="fs">…in the <b>belief</b> that they have healing properties.</div></div>
      </div></div>
      <div class="grades">${t_.grades.map((g) => `<span class="w">${esc(g)}</span>`).join('')}</div></div>
    <div class="sc" id="s-day"><p class="mid" style="margin-bottom:80px">${esc(t_.dayTitle)}</p>
      <div class="streak"><div><div class="n" id="days">1</div><p class="sub" style="text-align:left;margin-top:18px">${esc(t_.days)}</p></div>
      <div class="bars">${Array.from({ length: 7 }, (_, i) => `<i style="height:${[70, 45, 90, 60, 100, 75, 85][i]}%"><b></b></i>`).join('')}</div></div></div>
    <div class="sc" id="s-tot"><p class="mid" style="margin-bottom:80px">${esc(t_.totTitle)}</p>
      <div class="tiles">${t_.tot.map(([kk, v]) => `<div class="tile w"><small>${esc(kk)}</small><b data-v="${typeof v === 'number' ? v : ''}">${typeof v === 'number' ? '0' : esc(v)}</b></div>`).join('')}</div></div>
    <div class="sc" id="s-mac">
      <div class="mac" id="mac"><div class="lid" id="lid"><i class="notch"></i>
        <div class="screen" id="scr"><img class="sbar" src="img/screen-bar.jpg" alt="" /><div class="sview" id="sview"><img class="sbody" id="sbody" src="img/screen-body.jpg" alt="" /></div></div></div>
        <div class="base"><i></i></div></div>
      <p class="mid maccap">${words(t_.mac)}</p></div>
    <div class="sc" id="s-lis"><div class="split"><div class="txt"><p class="mid">${esc(t_.lis[0])}</p><p class="sub">${esc(t_.lis[1])}</p></div>${shot('img/listening.jpg', 1040)}</div></div>
    <div class="sc" id="s-foc"><div class="split">${shot('img/focus.jpg', 1040)}<div class="txt"><p class="mid">${esc(t_.foc[0])}</p><p class="sub">${esc(t_.foc[1])}</p></div></div></div>
    <div class="sc" id="s-inky"><div class="inky" id="inky"><svg viewBox="0 0 26 16" shape-rendering="crispEdges"><path d="${INK}" fill="currentColor"/><path id="lid2" d="M8 10h2v1h-2zM14 10h2v1h-2z" fill="currentColor" opacity="0"/></svg></div>
      <p class="mid" style="margin-top:70px">${esc(t_.inky[0])}</p><p class="sub">${esc(t_.inky[1])}</p></div>
    <div class="sc" id="s-mont"><div class="mont">${['library', 'reader', 'cards', 'records', 'plan', 'light'].map((n) => `<div class="shot w"><img src="img/${n}.jpg" alt="" /></div>`).join('')}</div></div>
    <div class="sc" id="s-free"><p class="big">${words(t_.free)}</p></div>
    <div class="sc end" id="s-end">${word}<p class="url">${esc(location.host || 'inkwell')}</p><p class="sub" style="margin-top:14px">${esc(t_.end)}</p>
      <p class="credit">Music: “Digital Lemonade” — Kevin MacLeod (incompetech.com) · CC BY 4.0</p></div>`;

  /* ---------------- motion ---------------- */
  const cl = (v) => Math.min(1, Math.max(0, v));
  const seg = (t, a, b) => cl((t - a) / (b - a));
  const out = (t) => 1 - Math.pow(1 - t, 3);
  const inn = (t) => t * t * t;
  const inout = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const spring = (t) => (t >= 1 ? 1 : 1 - Math.cos(t * Math.PI * 2.4) * Math.exp(-6 * t)); // a little overshoot
  const B = (n) => 0.025 + n * 0.5; // the n-th beat

  function style(el, op, blur, tf) {
    el.style.opacity = op.toFixed(3);
    el.style.visibility = op > 0.002 ? 'visible' : 'hidden';
    el.style.filter = blur > 0.2 ? `blur(${blur.toFixed(1)}px)` : 'none';
    el.style.transform = tf || '';
  }
  // a scene from a to b: in through a blur, out through a blur (outScale > 1 rushes at the camera)
  function scene(el, t, a, b, o = {}) {
    const i = out(seg(t, a, a + (o.fi ?? 0.45)));
    const x = inn(seg(t, b - (o.fo ?? 0.4), b));
    const s = (o.s0 ?? 1) + (1 - (o.s0 ?? 1)) * i;
    style(el, i * (1 - x), (1 - i) * (o.blur ?? 18) + x * (o.blur ?? 18), `scale(${(s * (1 + x * ((o.outScale ?? 1) - 1))).toFixed(4)})`);
    return t >= a && t < b;
  }
  // a word or a part landing on its beat
  function pop(el, t, at, d = 0.32, dy = 46) {
    const p = out(seg(t, at, at + d));
    style(el, p, (1 - p) * 14, `translateY(${((1 - p) * dy).toFixed(1)}px) scale(${(0.96 + 0.04 * p).toFixed(4)})`);
  }

  const S = Object.fromEntries($$('.sc', stage).map((e) => [e.id.slice(2), e]));
  const nameParts = (root) => ({ dot: $('.dot', root), stem: $('.stem', root), ls: $$('.l', root) });
  const N1 = nameParts(S.name);
  const N2 = nameParts(S.end);
  const marks = $$('.m', S.read);
  const tips = $$('.tip', S.read);
  const cnt = $('#cnt');
  const card = $('#card');
  const grades = $$('.grades .w', S.card);
  const days = $('#days');
  const bars = $$('.bars b', S.day);
  const tiles = $$('.tile', S.tot);
  const mac = $('#mac');
  const lid = $('#lid');
  const scr = $('#scr');
  const sbody = $('#sbody');
  const macWords = $$('.maccap .w', S.mac);
  const lid2 = $('#lid2');
  const inky = $('#inky');
  const mont = $$('.mont .shot', S.mont);

  function drawName(N, t, at) {
    const d = spring(seg(t, at, at + 0.6));
    style(N.dot, cl(seg(t, at, at + 0.15)), 0, `scale(${d.toFixed(3)})`);
    const s = out(seg(t, at + 0.5, at + 1.0));
    N.stem.style.clipPath = `inset(${((1 - s) * 100).toFixed(1)}% 0 0 0)`;
    N.ls.forEach((l, i) => pop(l, t, at + 1.0 + i * 0.125, 0.4, 0));
  }

  function render(t) {
    // 0–4 the name
    if (scene(S.name, t, 0, 4, { fi: 0.01, outScale: 1.06 })) drawName(N1, t, B(1));
    // 4–8, 8–12 the two lines, a word on each beat
    if (scene(S.a, t, 3.9, 8, { fi: 0.01 })) $$('.w', S.a).forEach((w, i) => pop(w, t, B(8 + i)));
    if (scene(S.b, t, 7.9, 12, { fi: 0.01, outScale: 0.94 })) $$('.w', S.b).forEach((w, i) => pop(w, t, B(16 + i)));
    // 12–20 reading: five words saved, one a bar
    if (scene(S.read, t, 12, 20, { s0: 1.04 })) {
      let n = 0;
      marks.forEach((m, i) => {
        const at = B(26 + i * 2);
        m.classList.toggle('on', t >= at);
        if (t >= at) n++;
        const p = out(seg(t, at, at + 0.3)) * (1 - inn(seg(t, at + 0.7, at + 0.95))); // gone before the next one comes
        style(tips[i], p, (1 - p) * 8, `translate(-50%, ${((1 - p) * 14).toFixed(1)}px)`);
      });
      cnt.textContent = String(n);
    }
    // 20–24 a card turns over, then the grades
    if (scene(S.card, t, 20, 24, { s0: 0.92 })) {
      card.style.transform = `rotateY(${(180 * inout(seg(t, B(43), B(44) + 0.1))).toFixed(1)}deg)`;
      grades.forEach((g, i) => pop(g, t, B(45) + i * 0.125, 0.3, 30));
      const ok = t >= B(46);
      grades[2].style.background = ok ? '#f5f5f7' : '';
      grades[2].style.color = ok ? '#000' : '';
    }
    // 24–28 the streak counts up on the beats
    if (scene(S.day, t, 24, 28)) {
      let n = 1;
      bars.forEach((b, i) => {
        const at = B(49 + i);
        if (t >= at) n = i + 1;
        b.style.transform = `scaleY(${out(seg(t, at, at + 0.35)).toFixed(3)})`;
      });
      days.textContent = String(n);
    }
    // 28–32 totals roll up, then everything rushes at the camera into the drop
    if (scene(S.tot, t, 28, 32, { fo: 0.9, outScale: 1.5 })) {
      tiles.forEach((tl, i) => {
        pop(tl, t, B(56 + i), 0.35, 60);
        const b = $('b', tl);
        if (b.dataset.v) b.textContent = nf.format(Math.round(+b.dataset.v * out(seg(t, B(57), B(61)))));
      });
    }
    // 32–40 the drop: the app fills the frame and draws back into the MacBook
    if (scene(S.mac, t, 32, 40, { fi: 0.01, fo: 0.45 })) {
      const sw = scr.offsetWidth;
      const sh = scr.offsetHeight;
      const s0 = Math.max(1920 / sw, 1080 / sh) * 1.02;
      const e = inout(seg(t, 32.6, 37));
      const s = s0 + (1 - s0) * e;
      const oy = lid.offsetTop + scr.offsetTop + sh / 2;
      const ty = (540 - (mac.offsetTop + oy)) * (1 - e) - 60 * e;
      mac.style.transformOrigin = `50% ${oy}px`;
      mac.style.transform = `translateY(${ty.toFixed(1)}px) scale(${s.toFixed(4)})`;
      sbody.style.transform = `translateY(${(-sbody.offsetHeight * 0.418 * out(seg(t, 32, 37.5))).toFixed(1)}px)`;
      macWords.forEach((w, i) => pop(w, t, B(74 + i)));
    }
    // 40–44 listening, 44–48 focus: the screen slides in beside its line
    if (scene(S.lis, t, 40, 44)) {
      const p = out(seg(t, 40, 41.2));
      $('.shot', S.lis).style.transform = `translateX(${((1 - p) * 220).toFixed(1)}px) scale(${(1.06 - 0.06 * seg(t, 40, 44)).toFixed(4)})`;
    }
    if (scene(S.foc, t, 44, 48)) {
      const p = out(seg(t, 44, 45.2));
      const im = $('.shot', S.foc);
      im.style.transform = `translateX(${((p - 1) * 220).toFixed(1)}px)`;
      im.style.filter = `blur(${((1 - out(seg(t, B(89), B(91)))) * 10).toFixed(1)}px)`;
    }
    // 48–52 Inky hops on the beat and blinks
    if (scene(S.inky, t, 48, 52)) {
      const beat = (t - 0.025) % 1;
      inky.style.transform = `translateY(${(-Math.sin(Math.PI * cl(beat / 0.35)) * 40 * (beat < 0.35 ? 1 : 0)).toFixed(1)}px)`;
      lid2.setAttribute('opacity', (t > B(100) && t < B(100) + 0.14) || (t > B(103) && t < B(103) + 0.14) ? 1 : 0);
    }
    // 52–56 a screen on every beat
    if (scene(S.mont, t, 52, 56, { fi: 0.01 })) mont.forEach((m, i) => pop(m, t, B(104 + i), 0.3, 40));
    // 56–60 the three words
    if (scene(S.free, t, 56, 60, { fi: 0.01 })) $$('.w', S.free).forEach((w, i) => pop(w, t, B(113 + i * 2)));
    // 60– the name again, the address, the credit
    if (scene(S.end, t, 60, END + 1, { fi: 0.01 })) {
      drawName(N2, t, B(120));
      pop($('.url', S.end), t, B(124), 0.5, 20);
      pop($('.sub', S.end), t, B(125), 0.5, 20);
      pop($('.credit', S.end), t, B(126), 0.6, 0);
    }
  }

  /* ---------------- the stage fits the window, the music is the clock ---------------- */
  function fit() {
    const s = Math.min(innerWidth / 1920, innerHeight / 1080);
    stage.style.position = 'absolute';
    stage.style.left = '50%';
    stage.style.top = '50%';
    stage.style.transform = `translate(-50%, -50%) scale(${s})`;
  }
  addEventListener('resize', fit);
  fit();

  const poster = $('#poster');
  const bar = $('#bar i');
  $('#ptext').textContent = t_.poster;
  let raf = 0;
  function loop() {
    const t = music.currentTime;
    render(t);
    bar.style.transform = `scaleX(${(t / END).toFixed(4)})`;
    raf = music.paused ? 0 : requestAnimationFrame(loop);
  }
  function play() {
    if (music.ended || music.currentTime >= END - 0.05) music.currentTime = 0;
    poster.classList.add('gone');
    music.play().then(() => (raf ||= requestAnimationFrame(loop))).catch(() => poster.classList.remove('gone'));
  }
  poster.addEventListener('click', play);
  music.addEventListener('ended', () => {
    $('#ptext').textContent = t_.again;
    poster.classList.remove('gone');
  });
  addEventListener('keydown', (e) => {
    if (e.key === ' ') {
      e.preventDefault();
      if (music.paused) play();
      else music.pause();
    }
    if (e.key === 'f' || e.key === 'F') document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => {});
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      music.currentTime = Math.max(0, Math.min(END, music.currentTime + (e.key === 'ArrowRight' ? 5 : -5)));
      render(music.currentTime);
    }
  });
  // the bar and the way back show while the pointer moves
  let idle = 0;
  addEventListener('pointermove', () => {
    document.body.classList.add('awake');
    clearTimeout(idle);
    idle = setTimeout(() => document.body.classList.remove('awake'), 1800);
  });

  render(0);
  // draw any frame on its own (for checking a frame, or making a video of it)
  window.__seek = (t) => render(t);
})();

'use strict';
// Inkwell's film (film.html): one minute, cut to "Digital Lemonade" (Kevin MacLeod, CC BY 4.0) at
// 120 bpm — a beat every 0.5 s from 0.025 s, a bar every 2 s, the drop at 32 s. Nothing here runs
// on timers: render(t) works every frame out from the music's clock, so the picture sits on the
// beat, seeking just works, and any frame can be drawn on its own (__seek) to make the video.
// The scenes live in one 3D space (#cam): the camera pushes in, pulls back, whips across, orbits
// and shakes on the hits; words punch in, saved words fly into the vocabulary, the screens tilt
// in with a sheen of light, and a white flash carries the cut into the drop.
(() => {
  const T = {
    uz: {
      poster: 'Filmni ko‘rish · 1 daqiqa', again: 'Yana ko‘rish',
      a: ['Ingliz', 'tilida', 'o‘qing.'], b: ['Har bir', 'so‘z', 'qoladi.'],
      tap: 'Notanish so‘zni bosing — tarjimasi bilan saqlanadi.', inVocab: 'Lug‘atda',
      tr: ['gipnoz', 'qo‘shimcha', 'trans holatiga o‘xshash', 'ishonch', 'shifobaxsh xususiyatlar'],
      cardTop: 'Har bir so‘z o‘z kunida qaytadi.', back: 'ishonch', grades: ['Unutdim', 'Qiyin', 'Bilardim'],
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
      cardTop: 'Every word comes back on its day.', back: 'something held true', grades: ['Forgot', 'Hard', 'Knew it'],
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
      cardTop: 'Каждое слово возвращается в свой день.', back: 'убеждение', grades: ['Забыл', 'Трудно', 'Знал'],
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
    const l = new URLSearchParams(location.search).get('lang') || localStorage.getItem('a365.lang');
    if (T[l]) lang = l;
    else if (/^en/.test(navigator.language)) lang = 'en';
    else if (/^ru/.test(navigator.language)) lang = 'ru';
  } catch {}
  const t_ = T[lang];
  document.documentElement.lang = lang;
  // the site's own address (a copy served from this computer shows the real one)
  const SITE = /^(localhost|127\.|$)/.test(location.hostname) ? 'web-snowy-five-64.vercel.app' : location.host;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const stage = $('#stage');
  const cam = $('#cam');
  const flashEl = $('#flash');
  const glow = $('#glow');
  const music = $('#music');
  const END = 64.5;
  const nf = new Intl.NumberFormat(lang === 'uz' ? 'ru' : lang);

  /* ---------------- the scenes ---------------- */
  const words = (list, cls = '') => list.map((w) => `<span class="w ${cls}">${esc(w)}</span>`).join(' ');
  const INK = 'M14 2h1v1h-1zM13 3h2v1h-2zM12 4h2v1h-2zM11 5h2v1h-2zM9 6h6v1h-6zM9 7h6v1h-6zM7 8h10v1h-10zM6 9h12v1h-12zM6 10h2v1h-2zM10 10h4v1h-4zM16 10h2v1h-2zM5 11h3v1h-3zM10 11h4v1h-4zM16 11h3v1h-3zM6 12h12v1h-12zM6 13h12v1h-12zM7 14h10v1h-10zM7 15h1v1h-1zM9 15h1v1h-1zM14 15h1v1h-1zM16 15h1v1h-1z';
  const PARA = 'The use of {hypnosis} as a {complementary} therapy might seem quite modern, but it has a long history. Forms of {trance-like} states have been practised for thousands of years, in the {belief} that they have {healing properties}.';
  const saved = [];
  let k = 0;
  const para = PARA.replace(/\{([^}]+)\}/g, (_, w) => (saved.push(w), `<span class="m">${esc(w)}<span class="tip"><small>${esc(w)}</small>${esc(t_.tr[k++])}</span></span>`));
  const shot = (src, w) => `<div class="shot" style="width:${w}px"><img src="${src}" alt="" /></div>`;
  const word = `<div class="word"><span class="i"><span class="stem">ı</span><span class="dot"></span></span>${[...'nkwell'].map((c) => `<span class="l">${c}</span>`).join('')}</div>`;
  const SENT = '…in the <b>belief</b> that they have healing properties.';
  const WALL = ['library', 'reader', 'cards', 'records', 'plan', 'light', 'listening', 'statistics', 'vocabulary', 'focus', 'library', 'cards'];

  cam.innerHTML = `
    <div class="sc" id="s-name">${word}</div>
    <div class="sc" id="s-a"><p class="big">${words(t_.a)}</p></div>
    <div class="sc" id="s-b"><p class="big">${words(t_.b.slice(0, 2))} ${words(t_.b.slice(2), 'soft')}</p></div>
    <div class="sc" id="s-read"><p class="sub" style="margin:0 0 70px">${esc(t_.tap)}</p><p class="para">${para}</p><div class="count" id="count">${esc(t_.inVocab)} <b id="cnt">0</b></div>
      ${saved.map((w) => `<span class="chip">${esc(w)}</span>`).join('')}</div>
    <div class="sc" id="s-card"><p class="sub" style="margin:0 0 60px">${esc(t_.cardTop)}</p>
      <div class="cardwrap"><div class="card" id="card">
        <div class="face"><div class="fw">belief</div><div class="fs">${SENT}</div></div>
        <div class="face back"><div class="fw" style="font-size:64px;color:var(--mute)">belief</div><div class="ft">${esc(t_.back)}</div><div class="fs">${SENT}</div></div>
      </div></div>
      <div class="grades">${t_.grades.map((g) => `<span class="w">${esc(g)}</span>`).join('')}</div></div>
    <div class="sc" id="s-day"><p class="mid" style="margin-bottom:80px">${esc(t_.dayTitle)}</p>
      <div class="streak"><div><div class="n" id="days">1</div><p class="sub" style="text-align:left;margin-top:18px">${esc(t_.days)}</p></div>
      <div class="bars">${Array.from({ length: 7 }, (_, i) => `<i style="height:${[70, 45, 90, 60, 100, 75, 85][i]}%"><b></b></i>`).join('')}</div></div></div>
    <div class="sc" id="s-tot"><p class="mid" style="margin-bottom:80px">${esc(t_.totTitle)}</p>
      <div class="tiles">${t_.tot.map(([kk, v]) => `<div class="tile"><small>${esc(kk)}</small><b data-v="${typeof v === 'number' ? v : ''}">${typeof v === 'number' ? '0' : esc(v)}</b></div>`).join('')}</div></div>
    <div class="sc" id="s-mac">
      <div class="mac" id="mac"><div class="lid" id="lid"><i class="notch"></i>
        <div class="screen" id="scr"><img class="sbar" src="img/screen-bar.jpg" alt="" /><div class="sview"><img class="sbody" id="sbody" src="img/screen-body.jpg" alt="" /></div></div></div>
        <div class="base"><i></i></div></div>
      <p class="mid maccap">${words(t_.mac)}</p></div>
    <div class="sc" id="s-lis"><div class="split"><div class="txt"><p class="mid w">${esc(t_.lis[0])}</p><p class="sub w">${esc(t_.lis[1])}</p></div>${shot('img/listening.jpg', 1040)}</div></div>
    <div class="sc" id="s-foc"><div class="split">${shot('img/focus.jpg', 1040)}<div class="txt"><p class="mid w">${esc(t_.foc[0])}</p><p class="sub w">${esc(t_.foc[1])}</p></div></div></div>
    <div class="sc" id="s-inky"><div class="inky" id="inky"><svg viewBox="0 0 26 16" shape-rendering="crispEdges"><path d="${INK}" fill="currentColor"/><path id="lid2" d="M8 10h2v1h-2zM14 10h2v1h-2z" fill="currentColor" opacity="0"/></svg></div>
      <p class="mid w" style="margin-top:70px">${esc(t_.inky[0])}</p><p class="sub w">${esc(t_.inky[1])}</p>
      ${Array.from({ length: 36 }, () => '<i class="px"></i>').join('')}</div>
    <div class="sc" id="s-wall"><div class="wall" id="wall">${WALL.map((n) => shot(`img/${n}.jpg`, 620)).join('')}</div></div>
    <div class="sc" id="s-free"><p class="big">${words(t_.free)}</p></div>
    <div class="sc end" id="s-end">${word}<p class="url">${esc(SITE)}</p><p class="sub" style="margin-top:14px">${esc(t_.end)}</p>
      <p class="credit">Music: “Digital Lemonade” — Kevin MacLeod (incompetech.com) · CC BY 4.0</p></div>`;

  /* ---------------- motion ---------------- */
  const cl = (v) => Math.min(1, Math.max(0, v));
  const seg = (t, a, b) => cl((t - a) / (b - a));
  const out = (t) => 1 - Math.pow(1 - t, 3);
  const out5 = (t) => 1 - Math.pow(1 - t, 5);
  const inn = (t) => t * t * t;
  const inout = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const back = (t) => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2); // overshoots a little
  const spring = (t) => (t >= 1 ? 1 : 1 - Math.cos(t * Math.PI * 2.4) * Math.exp(-6 * t));
  const lerp = (a, b, p) => a + (b - a) * p;
  const B = (n) => 0.025 + n * 0.5; // the n-th beat
  const f1 = (v) => v.toFixed(1);

  function style(el, op, blur, tf) {
    el.style.opacity = op.toFixed(3);
    el.style.visibility = op > 0.002 ? 'visible' : 'hidden';
    el.style.filter = blur > 0.3 ? `blur(${f1(blur)}px)` : 'none';
    el.style.transform = tf || '';
  }
  // A scene's own camera move between a and b, with its way in and out:
  //  'cut' (none), 'fade' (through a blur), 'whipL'/'whipR' (a fast pan with motion blur),
  //  'zoom' (rushes through the lens), 'fly' (falls back into the depth).
  function scene(el, t, a, b, o = {}) {
    // off its time a scene is taken out entirely: its words set their own visibility, which a
    // hidden parent would not override
    if (t < a - 0.01 || t > b + 0.01) return void (el.style.display = 'none'), false;
    el.style.display = '';
    const fi = o.fi ?? 0.35, fo = o.fo ?? 0.35;
    const i = seg(t, a, a + fi);
    const x = seg(t, b - fo, b);
    let op = 1, blur = 0, tf = o.cam ? o.cam(seg(t, a, b)) : '';
    const inT = o.in ?? 'fade', outT = o.out ?? 'fade';
    const pre = (p, kind, dir) => {
      // p: 0 = fully away, 1 = in place
      const q = 1 - p;
      if (kind === 'fade') return [p, q * 18, ''];
      if (kind === 'whipL' || kind === 'whipR') {
        const s = (kind === 'whipL' ? -1 : 1) * dir;
        return [Math.min(1, p * 3), q * 40, `translateX(${f1(s * q * 1500)}px) scaleX(${(1 + q * 0.35).toFixed(3)})`];
      }
      if (kind === 'zoom') return [p, q * 30, `scale(${(1 + q * (dir > 0 ? 3 : -0.6)).toFixed(3)})`];
      if (kind === 'fly') return [p, q * 20, `translateZ(${f1(-q * 1400)}px) rotateX(${f1(q * 25)}deg)`];
      return [1, 0, ''];
    };
    if (i < 1 && inT !== 'cut') {
      const [o1, b1, t1] = pre(out(i), inT, -1);
      op *= o1; blur += b1; tf = `${t1} ${tf}`;
    }
    if (x > 0 && outT !== 'cut') {
      const [o2, b2, t2] = pre(1 - inn(x), outT, 1);
      op *= o2; blur += b2; tf = `${t2} ${tf}`;
    }
    style(el, op, blur, tf);
    return true;
  }
  // a word slamming in on its beat: from big and blurred to its place
  function punch(el, t, at, d = 0.3, from = 2.4) {
    const p = seg(t, at, at + d);
    const s = 1 + (from - 1) * (1 - out5(p));
    style(el, cl(p * 2.2), (1 - out(p)) * 26, `scale(${s.toFixed(3)})`);
  }
  function pop(el, t, at, d = 0.32, dy = 46) {
    const p = out(seg(t, at, at + d));
    style(el, p, (1 - p) * 14, `translateY(${f1((1 - p) * dy)}px) scale(${(0.96 + 0.04 * p).toFixed(4)})`);
  }
  // light passing over a screen
  const sheen = (el, t, a, d = 1.1) => el.style.setProperty('--sx', `${f1(lerp(-120, 160, inout(seg(t, a, a + d))))}%`);

  // hits: a white flash and a camera shake, each dying away
  const FLASH = [[23.025, 0.22], [31.98, 1], [56.525, 0.3], [57.525, 0.3], [58.525, 0.3], [59.98, 0.75]];
  const SHAKE = [[B(8), 7], [B(9), 7], [B(10), 9], [B(16), 7], [B(17), 7], [B(18), 9], [23.025, 10], [32, 26], [B(66), 12], [B(68), 9], [B(70), 7],
    ...Array.from({ length: 7 }, (_, i) => [B(49 + i), 4]), [B(113), 14], [B(115), 14], [B(117), 16]];
  function hits(t) {
    let f = t > 31.4 && t < 31.98 ? Math.pow(seg(t, 31.4, 31.98), 3) * 0.85 : 0;
    for (const [a, v] of FLASH) if (t >= a) f += v * Math.exp(-(t - a) * 7);
    flashEl.style.opacity = cl(f).toFixed(3);
    let sx = 0, sy = 0;
    for (const [a, v] of SHAKE) if (t >= a && t < a + 0.8) {
      const d = v * Math.exp(-(t - a) * 8);
      sx += Math.sin((t - a) * 73) * d;
      sy += Math.cos((t - a) * 59) * d * 0.7;
    }
    // the camera breathes with the kick in the loud parts
    const kick = Math.exp(-(((t - 0.025) % 0.5 + 0.5) % 0.5) * 9);
    const loud = (t > 32 && t < 40) || (t > 52 && t < 60) ? 1 : 0;
    cam.style.transform = `translate(${f1(sx)}px, ${f1(sy)}px) scale(${(1 + 0.012 * kick * loud).toFixed(4)})`;
    glow.style.opacity = (0.35 + 0.55 * kick * loud + (t < 4 ? 0.3 * seg(t, 0.5, 2.5) : 0)).toFixed(3);
    glow.style.transform = `scale(${(1 + 0.08 * kick * loud).toFixed(3)})`;
  }

  const S = Object.fromEntries($$('.sc', cam).map((e) => [e.id.slice(2), e]));
  const nameParts = (root) => ({ dot: $('.dot', root), stem: $('.stem', root), ls: $$('.l', root) });
  const N1 = nameParts(S.name);
  const N2 = nameParts(S.end);
  const marks = $$('.m', S.read);
  const tips = $$('.tip', S.read);
  const chips = $$('.chip', S.read);
  const count = $('#count');
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
  const pxs = $$('.px', S.inky);
  const wall = $('#wall');
  const wallShots = $$('.shot', wall);

  // where things are inside their scene, measured once with the scene at rest
  let M = null;
  function measure() {
    const k = stage.getBoundingClientRect().width / 1920;
    const at = (sc, els) => {
      const keep = [sc.style.transform, sc.style.display];
      sc.style.transform = 'none';
      sc.style.display = '';
      const r0 = sc.getBoundingClientRect();
      const res = els.map((e) => {
        const r = e.getBoundingClientRect();
        return { x: (r.left - r0.left + r.width / 2) / k, y: (r.top - r0.top + r.height / 2) / k };
      });
      [sc.style.transform, sc.style.display] = keep;
      return res;
    };
    M = { marks: at(S.read, marks), count: at(S.read, [count])[0], tile: at(S.tot, [tiles[1]])[0], inky: at(S.inky, [inky])[0] };
  }

  function drawName(N, t, at) {
    const d = spring(seg(t, at, at + 0.6));
    style(N.dot, cl(seg(t, at, at + 0.15)), 0, `scale(${d.toFixed(3)})`);
    const s = out(seg(t, at + 0.5, at + 1.0));
    N.stem.style.clipPath = `inset(${f1((1 - s) * 100)}% 0 0 0)`;
    N.ls.forEach((l, i) => pop(l, t, at + 1.0 + i * 0.125, 0.4, 0));
  }

  function render(t) {
    if (!M) measure();
    hits(t);

    // 0–4 the name, the camera pulling back from very close
    scene(S.name, t, 0, 4, { in: 'cut', out: 'zoom', fo: 0.45, cam: (p) => `scale(${(1 + 1.6 * (1 - out(seg(p * 4, 0, 2.4)))).toFixed(3)})` });
    if (t < 4.1) {
      drawName(N1, t, B(1));
      S.name.style.filter = t < 1 ? `blur(${f1((1 - seg(t, 0, 1)) * 16)}px)` : S.name.style.filter;
    }

    // 4–8, 8–12 the two lines: each word slams in on its beat; whip across between them
    if (scene(S.a, t, 3.9, 8, { in: 'zoom', fi: 0.25, out: 'whipL', fo: 0.3, cam: (p) => `rotateZ(${f1(-3 + 3 * p)}deg) scale(${(1 + 0.06 * p).toFixed(3)})` }))
      $$('.w', S.a).forEach((w, i) => punch(w, t, B(8 + i)));
    if (scene(S.b, t, 7.95, 12, { in: 'whipR', fi: 0.3, out: 'zoom', fo: 0.4, cam: (p) => `rotateZ(${f1(2 - 2 * p)}deg) scale(${(1 + 0.06 * p).toFixed(3)})` }))
      $$('.w', S.b).forEach((w, i) => punch(w, t, B(16 + i)));

    // 12–20 reading: the camera leans in and follows each word as it is saved; the word flies
    // into the vocabulary and the count jumps
    if (scene(S.read, t, 11.95, 20, { in: 'fly', fi: 0.9, out: 'whipL', fo: 0.35 })) {
      const ats = marks.map((_, i) => B(26 + i * 2));
      // where the camera looks: the next word to be saved
      let px = 960, py = 540, z = 0;
      const zin = inout(seg(t, 12.4, 13.0)), zout = inout(seg(t, 17.9, 18.7));
      z = zin * (1 - zout);
      let fx = M.marks[0].x, fy = M.marks[0].y;
      for (let i = 1; i < ats.length; i++) {
        const p = inout(seg(t, ats[i] - 0.45, ats[i] - 0.05));
        fx = lerp(fx, M.marks[i].x, p);
        fy = lerp(fy, M.marks[i].y, p);
      }
      px = lerp(960, fx, z);
      py = lerp(540, fy, z);
      const zs = 1 + 0.55 * z;
      const camTf = `translate(${f1(960 - px)}px, ${f1(540 - py)}px) scale(${zs.toFixed(3)})`;
      S.read.style.transformOrigin = `${f1(px)}px ${f1(py)}px`;
      S.read.style.transform = `${S.read.style.transform} ${camTf}`;
      let n = 0;
      marks.forEach((m, i) => {
        const at = ats[i];
        m.classList.toggle('on', t >= at);
        const p = out(seg(t, at, at + 0.3)) * (1 - inn(seg(t, at + 0.7, at + 0.95)));
        style(tips[i], p, (1 - p) * 8, `translate(-50%, ${f1((1 - p) * 14)}px)`);
        // the chip: from the word to the count, along an arc
        const q = seg(t, at + 0.2, at + 0.85);
        const a = M.marks[i], c = M.count;
        const x = lerp(a.x, c.x, inout(q)), y = lerp(a.y, c.y, inout(q)) - Math.sin(Math.PI * q) * 160;
        const vis = q > 0 && q < 1 ? 1 : 0;
        style(chips[i], vis * (q < 0.15 ? q / 0.15 : 1), q * 3, `translate(-50%, -50%) translate(${f1(x)}px, ${f1(y)}px) scale(${(1 - 0.35 * q).toFixed(3)})`);
        if (t >= at + 0.85) n++;
      });
      cnt.textContent = String(n);
      const last = ats.map((a) => a + 0.85).filter((a) => t >= a).pop();
      count.style.transform = `scale(${(1 + (last ? 0.22 * Math.exp(-(t - last) * 9) : 0)).toFixed(3)})`;
    }

    // 20–24 a card flies in from the depth and turns over; the camera orbits it
    if (scene(S.card, t, 19.95, 24, { in: 'whipR', fi: 0.3, out: 'zoom', fo: 0.35, cam: (p) => `rotateY(${f1(10 - 18 * p)}deg) rotateX(${f1(4 - 6 * p)}deg)` })) {
      const e = out(seg(t, 20.0, 21.0));
      const flip = 180 * inout(seg(t, B(43), B(44) + 0.1));
      card.style.transform = `translateZ(${f1(-1600 * (1 - e))}px) rotateY(${f1(-55 * (1 - e) + flip)}deg) rotateX(${f1(25 * (1 - e))}deg)`;
      grades.forEach((g, i) => punch(g, t, B(45) + i * 0.125, 0.28, 1.6));
      const ok = t >= B(46);
      grades[2].style.background = ok ? '#f5f5f7' : '';
      grades[2].style.color = ok ? '#000' : '';
    }

    // 24–28 the streak slams up on every beat
    if (scene(S.day, t, 23.95, 28, { in: 'zoom', fi: 0.3, out: 'whipL', fo: 0.3, cam: (p) => `scale(${(1 + 0.12 * p).toFixed(3)}) rotateZ(${f1(-1.5 * p)}deg)` })) {
      let n = 1, last = 0;
      bars.forEach((b, i) => {
        const at = B(49 + i);
        if (t >= at) (n = i + 1), (last = at);
        b.style.transform = `scaleY(${out(seg(t, at, at + 0.3)).toFixed(3)})`;
      });
      days.textContent = String(n);
      days.style.transform = `scale(${(1 + (last ? 0.35 * Math.exp(-(t - last) * 10) : 0)).toFixed(3)})`;
      days.style.transformOrigin = '50% 80%';
    }

    // 28–32 the totals fly in from all sides and roll up; then the camera dives into the middle
    // one and everything goes white into the drop
    if (scene(S.tot, t, 27.95, 32, { in: 'whipR', fi: 0.3, out: 'cut', cam: (p) => `rotateY(${f1(12 - 18 * p)}deg)` })) {
      const FROM = [[-900, -300, 40, 30], [0, 500, 0, -40], [900, -300, -40, 30]];
      tiles.forEach((tl, i) => {
        const p = back(seg(t, B(56 + i), B(56 + i) + 0.55));
        const [dx, dy, ry, rx] = FROM[i];
        style(tl, cl(seg(t, B(56 + i), B(56 + i) + 0.2)), (1 - cl(p)) * 16, `translate3d(${f1(dx * (1 - p))}px, ${f1(dy * (1 - p))}px, ${f1(-1200 * (1 - p))}px) rotateY(${f1(ry * (1 - p))}deg) rotateX(${f1(rx * (1 - p))}deg)`);
        const b = $('b', tl);
        if (b.dataset.v) b.textContent = nf.format(Math.round(+b.dataset.v * out(seg(t, B(57), B(61)))));
      });
      const dive = inn(seg(t, 31.0, 32.0));
      if (dive > 0) {
        S.tot.style.transformOrigin = `${f1(M.tile.x)}px ${f1(M.tile.y)}px`;
        S.tot.style.transform = `${S.tot.style.transform} scale(${(1 + 7 * dive).toFixed(3)})`;
        S.tot.style.filter = `blur(${f1(dive * 12)}px)`;
      }
    }

    // 32–40 the drop: the app fills the frame, the camera pulls back and swings round the
    // MacBook (a three-quarter view on the way) and settles in front of it
    if (scene(S.mac, t, 32, 40, { in: 'cut', out: 'zoom', fo: 0.4 })) {
      const sw = scr.offsetWidth;
      const sh = scr.offsetHeight;
      const s0 = Math.max(1920 / sw, 1080 / sh) * 1.02;
      const e = inout(seg(t, 32.5, 37.2));
      const s = s0 + (1 - s0) * e;
      const oy = lid.offsetTop + scr.offsetTop + sh / 2;
      const ty = (540 - (mac.offsetTop + oy)) * (1 - e) - 60 * e;
      const arc = Math.sin(Math.PI * e);
      mac.style.transformOrigin = `50% ${oy}px`;
      mac.style.transform = `translateY(${f1(ty)}px) scale(${s.toFixed(4)}) rotateY(${f1(-26 * arc)}deg) rotateX(${f1(14 * arc)}deg) rotateZ(${f1(-2 * arc)}deg)`;
      sbody.style.transform = `translateY(${f1(-sbody.offsetHeight * 0.418 * out(seg(t, 32, 37.5)))}px)`;
      macWords.forEach((w, i) => punch(w, t, B(74 + i), 0.3, 2));
    }

    // 40–44 listening, 44–48 focus: the screen swings in out of the depth with light across it
    if (scene(S.lis, t, 39.95, 44, { in: 'zoom', fi: 0.35, out: 'whipL', fo: 0.3, cam: (p) => `translateX(${f1(40 - 80 * p)}px)` })) {
      const p = out(seg(t, 40.0, 41.3));
      $('.shot', S.lis).style.transform = `translate3d(${f1(400 * (1 - p))}px, 0, ${f1(-500 * (1 - p))}px) rotateY(${f1(-48 * (1 - p) - 10)}deg)`;
      sheen($('.shot', S.lis), t, 41.2);
      $$('.txt .w', S.lis).forEach((w, i) => pop(w, t, 40.3 + i * 0.35, 0.4, 60));
    }
    if (scene(S.foc, t, 43.95, 48, { in: 'whipR', fi: 0.3, out: 'zoom', fo: 0.35, cam: (p) => `translateX(${f1(-40 + 80 * p)}px)` })) {
      const p = out(seg(t, 44.0, 45.3));
      const im = $('.shot', S.foc);
      im.style.transform = `translate3d(${f1(-400 * (1 - p))}px, 0, ${f1(-500 * (1 - p))}px) rotateY(${f1(48 * (1 - p) + 10)}deg)`;
      im.style.filter = `blur(${f1((1 - out(seg(t, B(89), B(91)))) * 10)}px)`;
      sheen(im, t, 45.6);
      $$('.txt .w', S.foc).forEach((w, i) => pop(w, t, 44.3 + i * 0.35, 0.4, 60));
    }

    // 48–52 Inky hops on every beat, squashes as he lands, and throws pixels
    if (scene(S.inky, t, 47.95, 52, { in: 'zoom', fi: 0.35, out: 'zoom', fo: 0.35, cam: (p) => `scale(${(1 + 0.15 * p).toFixed(3)})` })) {
      const ph = (((t - 0.025) % 1) + 1) % 1; // a hop a bar-half
      const air = ph < 0.4 ? Math.sin((Math.PI * ph) / 0.4) : 0;
      const land = ph >= 0.4 && ph < 0.6 ? Math.sin((Math.PI * (ph - 0.4)) / 0.2) : 0;
      inky.style.transformOrigin = '50% 100%';
      inky.style.transform = `translateY(${f1(-90 * air)}px) scale(${(1 + 0.12 * land).toFixed(3)}, ${(1 - 0.16 * land + 0.06 * air).toFixed(3)})`;
      lid2.setAttribute('opacity', (t > B(100) && t < B(100) + 0.14) || (t > B(103) && t < B(103) + 0.14) ? 1 : 0);
      // a burst of 12 pixels on three landings
      [48.425, 49.425, 50.425].forEach((a, bi) => {
        for (let j = 0; j < 12; j++) {
          const el = pxs[bi * 12 + j];
          const q = seg(t, a, a + 0.8);
          if (q <= 0 || q >= 1) { el.style.opacity = 0; continue; }
          const ang = (j / 12) * Math.PI * 2 + bi;
          const v = 520 + (j % 3) * 140;
          const x = M.inky.x + Math.cos(ang) * v * q;
          const y = M.inky.y + 120 + Math.sin(ang) * v * q * 0.6 + 900 * q * q;
          style(el, 1 - q, 0, `translate(${f1(x)}px, ${f1(y)}px) rotate(${f1(q * 360)}deg) scale(${(1 - 0.5 * q).toFixed(3)})`);
        }
      });
      $$(':scope > .w', S.inky).forEach((w, i) => pop(w, t, 48.6 + i * 0.35, 0.4, 50));
    }

    // 52–56 a wall of screens: the camera flies low across it, a screen lights up on every beat
    if (scene(S.wall, t, 51.95, 56, { in: 'zoom', fi: 0.3, out: 'whipL', fo: 0.3 })) {
      const p = seg(t, 52, 56);
      wall.style.transform = `translate3d(${f1(lerp(700, -700, inout(p)))}px, ${f1(lerp(200, -150, p))}px, ${f1(lerp(-200, 100, p))}px) rotateX(${f1(52 - 10 * p)}deg) rotateZ(${f1(-26 + 8 * p)}deg)`;
      wallShots.forEach((w, i) => {
        const a = B(104 + (i % 8));
        const lift = Math.exp(-Math.max(0, t - a) * 3) * (t >= a ? 1 : 0);
        w.style.transform = `translateZ(${f1(lift * 80)}px)`;
        sheen(w, t, a - 0.1, 0.8);
      });
    }

    // 56–60 the three words, each with a flash and a hit
    if (scene(S.free, t, 55.95, 60, { in: 'whipR', fi: 0.25, out: 'zoom', fo: 0.3, cam: (p) => `scale(${(1 + 0.08 * p).toFixed(3)})` }))
      $$('.w', S.free).forEach((w, i) => punch(w, t, B(113 + i * 2), 0.3, 3));

    // 60– the name again, the address, the credit; the camera settles back
    if (scene(S.end, t, 59.98, END + 1, { in: 'cut', cam: (p) => `scale(${(1 + 0.25 * (1 - out(seg(p * (END + 1 - 60), 0, 2.5)))).toFixed(3)})` })) {
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
    M = null;
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
  let idle = 0;
  addEventListener('pointermove', () => {
    document.body.classList.add('awake');
    clearTimeout(idle);
    idle = setTimeout(() => document.body.classList.remove('awake'), 1800);
  });

  document.fonts && document.fonts.ready.then(() => ((M = null), render(music.currentTime)));
  render(0);
  // draw any frame on its own (for checking a frame, or making a video of it)
  window.__seek = (t) => render(t);
})();

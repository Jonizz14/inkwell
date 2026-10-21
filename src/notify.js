'use strict';
// Daily reminders, with no server. A launchd agent (~/Library/LaunchAgents) starts the app
// with --remind at the planned times, also when the app is not running. That run reads
// notes.json, decides whether there is anything worth saying, shows one notification and
// stays in the background (no Dock icon) so a click can open the app at the right place.
// When the app is already open, the --remind run hands over to it and quits.
//
// What it says follows the reading streak in notes.stats.days (same rules as stats.js):
//   - read today            -> nothing
//   - main slot             -> streak / word quiz / unfinished article / milestone tease
//   - 22:30, streak at risk -> the streak saver, with the time left until midnight
//   - missed days           -> lost streak, then a nudge, then one "we'll stop" and silence;
//                              after that only a single comeback on day 7, 14 and 30.
const { app, Notification, nativeImage } = require('electron');
const fs = require('node:fs');
const { execFile } = require('node:child_process');
const path = require('node:path');
const os = require('node:os');
const fsp = require('node:fs/promises');

const LABEL = 'uz.javohir.articles365.remind';
const PLIST = () => path.join(os.homedir(), 'Library', 'LaunchAgents', LABEL + '.plist');
const STATE = () => path.join(app.getPath('userData'), 'remind.json');
const SAVE_AT = [22, 30];
const LATE_MS = 90 * 60000; // a slot missed by more than this (Mac asleep) is skipped
// tools/remind.swift, in the app's Contents/MacOS (scripts/build-remind.sh)
const HELPER = () => path.join(path.dirname(process.execPath), 'Reminder');
// where the last banner points; a click only brings the app up, so it picks this up then
const OPEN = () => path.join(app.getPath('userData'), 'remind-open.json');
const OPEN_FOR = 30 * 60000;
const MILESTONES = [3, 7, 14, 30, 50, 100, 150, 200, 250, 300, 365];

/* ---------------- texts ---------------- */
// each entry: (v) => [title, body]; v = { n, w, tr, due, title, pct, left, best, days }
const T = {
  uz: {
    streak: [
      (v) => [`🔥 ${v.n} kun ketma-ket`, "Bugun ham bitta maqola — va olov o'chmaydi."],
      (v) => [`${v.n} kun. Bugun ${v.n + 1}-kun bo'ladimi?`, '5 daqiqa yetadi. Qolganini ertaga qilasiz.'],
      (v) => ['Seriyangiz sizni kutyapti 🔥', `${v.n} kun yig'dingiz. Bugun uni boy bermang.`],
    ],
    word: [
      (v) => [`«${v.w}» — nima degani edi? 🤔`, `Eslaysizmi? Bosing va tekshiring.${v.due > 1 ? ` Yana ${v.due - 1} ta so'z navbatda.` : ''}`],
      (v) => [`«${v.w}» sizni sog'indi 🥺`, `Takrorlash vaqti keldi. Bugun ${v.due} ta so'z, 2 daqiqalik ish.`],
    ],
    article: [
      (v) => [`«${v.title}»`, `${v.pct}% da to'xtagansiz. Oxiri qanday tugashini bilmoqchimisiz?`],
      (v) => ['Maqolangiz yarim yo\'lda qoldi 📖', `«${v.title}» — ${v.pct}%. Davom ettiramizmi?`],
    ],
    fresh: [
      (v) => ['Bugungi maqola tayyor 📰', `«${v.title}». O'qish uchun kuniga 5 daqiqa kifoya.`],
      (v) => ['Yangi so\'zlar shu yerda yashiringan 👀', `«${v.title}» — ochib ko'ring, kamida bitta yangi so'z topasiz.`],
    ],
    tease: [
      (v) => [`Bugun — ${v.n + 1} kun! 🏆`, `Yana bitta maqola va ${v.n + 1} kunlik seriya sizniki.`],
    ],
    save: [
      (v) => ['Olov o\'chay deyapti 🔥', `${v.n} kunlik seriyaga ${v.left} qoldi. Bitta abzas ham hisob.`],
      (v) => [`${v.left} qoldi ⏳`, `Yarim tunda ${v.n} kunlik seriya nolga tushadi. Hozir 2 daqiqa o'qing — saqlab qolamiz.`],
      (v) => ['Hali kech emas 🌙', `Uxlashdan oldin bitta abzas — va ${v.n} kunlik seriya omon qoladi.`],
    ],
    lost: [
      (v) => [`${v.best} kunlik seriya... ketdi 💔`, "Hechqisi yo'q, eng yaxshilari ham qaytadan boshlaydi. Bugun — 1-kun."],
    ],
    nudge: [
      (v) => ['Maqolalaringiz chang bosib yotibdi 📚', `${v.days} kun bo'ldi. Bitta maqoladan qaytamizmi?`],
      (v) => v.w ? [`«${v.w}» o'zini yolg'iz his qilyapti`, `Siz yo'qligingizga ${v.days} kun bo'ldi. Kelib bir ko'rib keting.`] : ['Bir-ikki daqiqangiz bormi? 👋', `${v.days} kun bo'ldi. Bugun qisqa maqoladan boshlaymiz.`],
    ],
    stop: [
      () => ['Bu eslatmalar ishlamayapti shekilli 😶', "Hozircha jim turamiz. Qaytsangiz — biz shu yerdamiz."],
    ],
    back: [
      (v) => [`${v.days} kun bo'ldi 👀`, v.title ? `«${v.title}» sizni kutib turibdi. 5 daqiqa — vassalom.` : '5 daqiqa — vassalom. Qaytamizmi?'],
    ],
    more: [
      (v) => [v.n ? `🔥 ${v.n} kun — bugungisi saqlandi` : 'Bugun yaxshi boshladingiz 👏', 'Yana bitta maqola? Miyangiz rahmat aytadi.'],
      () => ['Kayfiyat zo\'rmi? 😎', "Bugungi norma bajarildi. Bonus sifatida 5 daqiqa o'qiymizmi?"],
    ],
    test: () => ['Eslatmalar yoqildi ✅', 'Shunday ko\'rinishda keladi. Kuniga ko\'pi bilan ikki marta.'],
    left: (h, m) => (h ? `${h} soat ${m} daqiqa` : `${m} daqiqa`),
  },
  en: {
    streak: [
      (v) => [`🔥 ${v.n}-day streak`, 'One article today and the fire stays lit.'],
      (v) => [`${v.n} days. Make it ${v.n + 1}?`, 'Five minutes is enough. The rest can wait for tomorrow.'],
      (v) => ['Your streak is waiting 🔥', `You built ${v.n} days. Don't let today be the one that breaks it.`],
    ],
    word: [
      (v) => [`“${v.w}” — what did it mean? 🤔`, `Remember? Tap to check.${v.due > 1 ? ` ${v.due - 1} more words are waiting.` : ''}`],
      (v) => [`“${v.w}” misses you 🥺`, `Time to review. ${v.due} words today, two minutes of work.`],
    ],
    article: [
      (v) => [`“${v.title}”`, `You stopped at ${v.pct}%. Want to know how it ends?`],
      (v) => ['An article left halfway 📖', `“${v.title}” — ${v.pct}%. Shall we carry on?`],
    ],
    fresh: [
      (v) => ["Today's article is ready 📰", `“${v.title}”. Five minutes a day is all it takes.`],
      (v) => ['New words are hiding in here 👀', `“${v.title}” — open it, you'll find at least one.`],
    ],
    tease: [
      (v) => [`Today makes ${v.n + 1} days! 🏆`, `One more article and the ${v.n + 1}-day streak is yours.`],
    ],
    save: [
      (v) => ['Your fire is about to go out 🔥', `${v.left} left for your ${v.n}-day streak. One paragraph counts.`],
      (v) => [`${v.left} left ⏳`, `At midnight your ${v.n}-day streak resets. Read for two minutes and it's safe.`],
      (v) => ["It's not too late 🌙", `One paragraph before bed keeps your ${v.n}-day streak alive.`],
    ],
    lost: [
      (v) => [`Your ${v.best}-day streak... is gone 💔`, 'It happens to the best. Today is day one.'],
    ],
    nudge: [
      (v) => ['Your articles are gathering dust 📚', `It's been ${v.days} days. Come back for just one?`],
      (v) => v.w ? [`“${v.w}” feels lonely`, `You've been gone ${v.days} days. Drop by for a minute.`] : ['Got a minute? 👋', `It's been ${v.days} days. Let's start with a short one.`],
    ],
    stop: [
      () => ["These reminders don't seem to be working 😶", "So we'll be quiet for now. We're here when you're back."],
    ],
    back: [
      (v) => [`It's been ${v.days} days 👀`, v.title ? `“${v.title}” is waiting for you. Five minutes, that's all.` : 'Five minutes, that\'s all. Coming back?'],
    ],
    more: [
      (v) => [v.n ? `🔥 ${v.n} days — today is safe` : 'Great start today 👏', 'One more article? Your brain will thank you.'],
      () => ['Feeling good? 😎', "Today's goal is done. Five bonus minutes?"],
    ],
    test: () => ['Reminders are on ✅', 'This is what they look like. Two a day at most.'],
    left: (h, m) => (h ? `${h} h ${m} min` : `${m} min`),
  },
  ru: {
    streak: [
      (v) => [`🔥 ${v.n} ${plural(v.n, 'день', 'дня', 'дней')} подряд`, 'Одна статья сегодня — и огонь не погаснет.'],
      (v) => [`${v.n} ${plural(v.n, 'день', 'дня', 'дней')}. Сделаем ${v.n + 1}?`, 'Хватит пяти минут. Остальное подождёт до завтра.'],
      (v) => ['Твоя серия ждёт 🔥', `Уже ${v.n} ${plural(v.n, 'день', 'дня', 'дней')} позади. Не дай сегодняшнему дню её оборвать.`],
    ],
    word: [
      (v) => [`«${v.w}» — что это значило? 🤔`, `Помнишь? Нажми и проверь.${v.due > 1 ? ` Ещё ${v.due - 1} ${plural(v.due - 1, 'слово', 'слова', 'слов')} ждут.` : ''}`],
      (v) => [`«${v.w}» скучает по тебе 🥺`, `Пора повторить. ${v.due} ${plural(v.due, 'слово', 'слова', 'слов')} на сегодня, работы на две минуты.`],
    ],
    article: [
      (v) => [`«${v.title}»`, `Прочитано ${v.pct}%. Не интересно, чем всё закончится?`],
      (v) => ['Статья осталась на полпути 📖', `«${v.title}» — ${v.pct}%. Продолжим?`],
    ],
    fresh: [
      (v) => ['Статья на сегодня готова 📰', `«${v.title}». Пяти минут в день достаточно.`],
      (v) => ['Тут прячутся новые слова 👀', `«${v.title}» — открой, хотя бы одно найдёшь.`],
    ],
    tease: [
      (v) => [`Сегодня будет ${v.n + 1} ${plural(v.n + 1, 'день', 'дня', 'дней')}! 🏆`, `Ещё одна статья — и серия в ${v.n + 1} ${plural(v.n + 1, 'день', 'дня', 'дней')} твоя.`],
    ],
    save: [
      (v) => ['Огонь вот-вот погаснет 🔥', `До конца серии в ${v.n} ${plural(v.n, 'день', 'дня', 'дней')} осталось ${v.left}. Даже один абзац считается.`],
      (v) => [`Осталось ${v.left} ⏳`, `В полночь серия в ${v.n} ${plural(v.n, 'день', 'дня', 'дней')} сгорит. Две минуты чтения — и она спасена.`],
      (v) => ['Ещё не поздно 🌙', `Один абзац перед сном — и серия в ${v.n} ${plural(v.n, 'день', 'дня', 'дней')} жива.`],
    ],
    lost: [
      (v) => [`Серия в ${v.best} ${plural(v.best, 'день', 'дня', 'дней')}... всё 💔`, 'Бывает и с лучшими. Сегодня — день первый.'],
    ],
    nudge: [
      (v) => ['Статьи покрываются пылью 📚', `Прошло ${v.days} ${plural(v.days, 'день', 'дня', 'дней')}. Вернёмся хотя бы на одну?`],
      (v) => v.w ? [`«${v.w}» чувствует себя одиноко`, `Тебя нет уже ${v.days} ${plural(v.days, 'день', 'дня', 'дней')}. Заглянь на минутку.`] : ['Есть минутка? 👋', `Прошло ${v.days} ${plural(v.days, 'день', 'дня', 'дней')}. Начнём с короткой.`],
    ],
    stop: [
      () => ['Кажется, эти напоминания не работают 😶', 'Поэтому пока помолчим. Вернёшься — мы здесь.'],
    ],
    back: [
      (v) => [`Прошло ${v.days} ${plural(v.days, 'день', 'дня', 'дней')} 👀`, v.title ? `«${v.title}» ждёт тебя. Пять минут — и всё.` : 'Пять минут — и всё. Вернёшься?'],
    ],
    more: [
      (v) => [v.n ? `🔥 ${v.n} ${plural(v.n, 'день', 'дня', 'дней')} — сегодня уже засчитано` : 'Отличное начало дня 👏', 'Ещё одну статью? Мозг скажет спасибо.'],
      () => ['Настроение огонь? 😎', 'Норма на сегодня выполнена. Пять бонусных минут?'],
    ],
    test: () => ['Напоминания включены ✅', 'Вот так они выглядят. Не больше двух в день.'],
    left: (h, m) => (h ? `${h} ч ${m} мин` : `${m} мин`),
  },
};
function plural(n, one, few, many) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b === 1) return one;
  if (b >= 2 && b <= 4) return few;
  return many;
}

/* ---------------- data ---------------- */

const pad = (n) => String(n).padStart(2, '0');
const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fsp.readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function conf(notes) {
  const r = (notes.settings && notes.settings.remind) || {};
  return { on: r.on !== false, at: /^\d\d:\d\d$/.test(r.at || '') ? r.at : null, every: !!r.every };
}
// "every hour": until something is read that day, on the hour from 9:00 to 22:00
const HOURLY = [9, 22];

// the hour the user usually reads at (stats.hours = seconds read per hour of day)
function usualHour(notes) {
  const h = (notes.stats && notes.stats.hours) || [];
  let best = -1;
  let total = 0;
  for (let i = 0; i < 24; i++) {
    total += h[i] || 0;
    if ((h[i] || 0) > (h[best] || 0)) best = i;
  }
  if (total < 20 * 60 || best < 0) return null; // not enough to go by yet
  return Math.min(21, Math.max(8, best));
}

function slots(notes) {
  const c = conf(notes);
  if (!c.on) return [];
  if (c.every) {
    const out = [];
    for (let h = HOURLY[0]; h <= HOURLY[1]; h++) out.push({ id: 'h' + h, h, m: 0 });
    return [...out, { id: 'save', h: SAVE_AT[0], m: SAVE_AT[1] }];
  }
  const [h, m] =c.at ? c.at.split(':').map(Number) : [usualHour(notes) ?? 20, 0];
  const out = [{ id: 'main', h, m }];
  if (h * 60 + m < SAVE_AT[0] * 60 + SAVE_AT[1] - 45) out.push({ id: 'save', h: SAVE_AT[0], m: SAVE_AT[1] });
  return out;
}

function facts(notes, list) {
  const days = (notes.stats && notes.stats.days) || {};
  const active = (k) => !!days[k] && (days[k].sec >= 60 || days[k].words >= 20);
  const today = new Date();
  const doneToday = active(key(today));
  let n = 0;
  for (let d = doneToday ? today : addDays(today, -1); active(key(d)); d = addDays(d, -1)) n++;

  const used = Object.keys(days).filter(active).sort();
  const last = used[used.length - 1];
  let days_ = Infinity;
  if (last) {
    const [y, mo, da] = last.split('-').map(Number);
    days_ = Math.round((new Date(today.getFullYear(), today.getMonth(), today.getDate()) - new Date(y, mo - 1, da)) / 86400000);
  }
  // the run that ended with the last active day (for "your N-day streak is gone")
  let best = 0;
  if (last) {
    const [y, mo, da] = last.split('-').map(Number);
    for (let d = new Date(y, mo - 1, da); active(key(d)); d = addDays(d, -1)) best++;
  }

  const arts = notes.articles || {};
  const titleOf = (m) => (arts[m.id] && arts[m.id].title) || m.title || m.file;
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).getTime();
  const due = [];
  for (const [id, a] of Object.entries(arts))
    for (const v of (a && a.vocab) || []) if (v.tr && v.tr.trim() && v.srs && v.srs.due < end) due.push({ id, v });
  // the word to quiz on: the one that has been waiting longest
  due.sort((x, y) => x.v.srs.due - y.v.srs.due);
  const word = due[0] && due[0].v;

  const reading = list
    .map((m) => ({ m, a: arts[m.id] }))
    .filter(({ a }) => a && a.progress > 0.03 && a.progress < 0.95)
    .sort((x, y) => (y.a.opened || 0) - (x.a.opened || 0))[0];
  const natural = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
  const fresh = list.filter((m) => m.kind !== 'guardian' && (!arts[m.id] || !arts[m.id].progress)).sort((a, b) => natural.compare(a.file, b.file))[0];

  return {
    doneToday,
    n,
    best,
    days: days_,
    last,
    due: due.length,
    w: word && word.word,
    tr: word && word.tr,
    words: due.slice(0, 6).map(({ v }) => ({ w: v.word, tr: v.tr })),
    vocab: Object.values(arts).reduce((n, a) => n + ((a && a.vocab) || []).length, 0),
    reading: reading && { id: reading.m.id, title: titleOf(reading.m), pct: Math.round(reading.a.progress * 100) },
    fresh: fresh && { id: fresh.id, title: titleOf(fresh) },
  };
}

// decides what to say for a slot; null = stay quiet
// first: nothing went out yet today (with hourly reminders, the missed-days texts come once a day)
function compose(slot, f, st, first = true) {
  // the last hours of the day count down to midnight like the streak saver
  if (/^h\d+$/.test(slot) && +slot.slice(1) >= 21 && f.n) slot = 'save';
  const L = st.lang;
  const v = { n: f.n, w: f.w, tr: f.tr, due: f.due, best: f.best, days: f.days };
  const art = f.reading || f.fresh;
  if (art) Object.assign(v, { title: art.title, pct: f.reading ? f.reading.pct : 0 });
  const go = (kind, open, image) => ({ kind, open, image, v });

  // already read today: quiet, unless the user asked for every hour anyway; then keep it light
  if (f.doneToday) {
    if (!st.every || slot === 'save') return null;
    const opts = [['more', art ? { view: 'article', id: art.id } : null, f.n ? { flame: f.n } : null]];
    if (f.w) opts.push(['word', { view: 'cards' }, { word: f.w }]);
    if (f.reading) opts.push(['article', { view: 'article', id: f.reading.id }, null]);
    const fresh = opts.filter((o) => o[0] !== st.lastKind);
    const [kind, open, image] = pick(fresh.length ? fresh : opts);
    return go(kind, open, image);
  }
  if (slot === 'save') {
    if (!f.n) return null;
    const now = new Date();
    const mins = Math.max(1, Math.round((addDays(now, 1).setHours(0, 0, 0, 0) - now) / 60000));
    v.left = T[L].left(Math.floor(mins / 60), mins % 60);
    return go('save', art ? { view: 'article', id: art.id } : null, { flame: f.n });
  }

  // missed days: lost streak, nudges, then one goodbye and quiet
  if (f.days !== Infinity && f.days >= 2) {
    if (!first) return null;
    if (st.stoppedAt === f.last) {
      if (![7, 14, 30].includes(f.days)) return null;
      return go('back', art ? { view: 'article', id: art.id } : null);
    }
    if (f.days >= 4) {
      st.stoppedAt = f.last;
      return go('stop', null, null);
    }
    if (f.days === 2 && f.best >= 3) return go('lost', null, { flame: 0 });
    return go('nudge', f.w ? { view: 'cards' } : art ? { view: 'article', id: art.id } : null, f.w ? { word: f.w } : null);
  }

  if (f.n && MILESTONES.includes(f.n + 1)) return go('tease', art ? { view: 'article', id: art.id } : null, { flame: f.n + 1 });
  // otherwise vary: streak, a word to recall, or the article left halfway
  const options = [];
  if (f.n) options.push(['streak', art ? { view: 'article', id: art.id } : null, { flame: f.n }]);
  if (f.w) options.push(['word', { view: 'cards' }, { word: f.w }]);
  if (f.reading) options.push(['article', { view: 'article', id: f.reading.id }, null]);
  if (!options.length && f.fresh) options.push(['fresh', { view: 'article', id: f.fresh.id }, null]);
  if (!options.length) return null;
  const fresh = options.filter((o) => o[0] !== st.lastKind);
  const [kind, open, image] = pick(fresh.length ? fresh : options);
  return go(kind, open, image);
}

/* ---------------- the picture on the right of the notification ---------------- */

function image(spec) {
  if (!spec) return undefined;
  try {
    const { createCanvas } = require('@napi-rs/canvas');
    const S = 256;
    const c = createCanvas(S, S);
    const g = c.getContext('2d');
    const round = (x, y, w, h, r) => {
      g.beginPath();
      g.moveTo(x + r, y);
      g.arcTo(x + w, y, x + w, y + h, r);
      g.arcTo(x + w, y + h, x, y + h, r);
      g.arcTo(x, y + h, x, y, r);
      g.arcTo(x, y, x + w, y, r);
      g.closePath();
    };
    if (spec.flame != null) {
      const lit = spec.flame > 0;
      // black and white, the app's own ink and paper
      round(0, 0, S, S, 56);
      g.fillStyle = lit ? '#111111' : '#3a3a3c';
      g.fill();
      // flame
      g.save();
      g.translate(S / 2, 150);
      g.beginPath();
      g.moveTo(0, -112);
      g.bezierCurveTo(30, -70, 82, -40, 76, 18);
      g.bezierCurveTo(72, 70, 36, 92, 0, 92);
      g.bezierCurveTo(-36, 92, -74, 70, -76, 22);
      g.bezierCurveTo(-78, -14, -54, -36, -40, -50);
      g.bezierCurveTo(-40, -22, -28, -6, -14, 0);
      g.bezierCurveTo(-22, -46, -10, -82, 0, -112);
      g.closePath();
      g.fillStyle = 'rgba(255,255,255,0.95)';
      g.fill();
      g.restore();
      const txt = lit ? String(spec.flame) : '0';
      g.fillStyle = lit ? '#111111' : '#3a3a3c';
      g.font = `800 ${txt.length > 2 ? 64 : 84}px "SF Pro Rounded", "SF Pro Display", "Helvetica Neue", sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(txt, S / 2, 182);
    } else if (spec.word) {
      // a black card with the word in white serif, a hairline and a quiet question mark
      round(0, 0, S, S, 56);
      g.fillStyle = '#111111';
      g.fill();
      g.fillStyle = '#ffffff';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      let size = 58;
      const fam = '"New York", "Iowan Old Style", Georgia, serif';
      do g.font = `600 ${size}px ${fam}`;
      while (g.measureText(spec.word).width > S - 60 && (size -= 4) > 22);
      g.fillText(spec.word, S / 2, S / 2 - 18);
      g.fillStyle = 'rgba(255,255,255,0.18)';
      g.fillRect(S / 2 - 36, S / 2 + 24, 72, 2);
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.font = `500 34px "SF Pro Rounded", "Helvetica Neue", sans-serif`;
      g.fillText('?', S / 2, S / 2 + 66);
    }
    return c.toBuffer('image/png');
  } catch (e) {
    console.error('remind image', e);
    return undefined;
  }
}

/* ---------------- showing ---------------- */

let held = []; // a notification that gets garbage-collected loses its click handler
const hasHelper = () => process.platform === 'darwin' && fs.existsSync(HELPER());

// -> { ok, err?, code? }; code 1 = notifications are turned off for the app
async function show(title, body, img, open, onOpen) {
  const png = image(img);
  if (open) await fsp.writeFile(OPEN(), JSON.stringify({ open, at: Date.now() })).catch(() => {});
  else await fsp.rm(OPEN(), { force: true });
  if (hasHelper()) {
    const file = png && path.join(os.tmpdir(), `365-remind-${process.pid}-${Date.now()}.png`);
    if (file) await fsp.writeFile(file, png);
    const args = ['--title', title, '--body', body, ...(file ? ['--image', file] : [])];
    const r = await new Promise((res) =>
      execFile(HELPER(), args, { timeout: 130000 }, (err, out) => {
        try {
          res(JSON.parse(String(out).trim().split('\n').pop()));
        } catch {
          res({ ok: false, err: String((err && err.message) || out) });
        }
      }),
    );
    if (file) fsp.rm(file, { force: true }).catch(() => {});
    if (!r.ok) console.error('remind: helper', r);
    return r;
  }
  if (!Notification.isSupported()) return { ok: false, err: 'unsupported' };
  const n = new Notification({ title, body, contentImage: png ? nativeImage.createFromBuffer(png) : undefined, silent: false });
  n.on('click', () => onOpen(open));
  n.on('close', () => (held = held.filter((x) => x !== n)));
  n.on('failed', (_e, err) => console.error('remind: notification failed', err));
  held.push(n);
  n.show();
  return { ok: true };
}

// the place the last banner talked about, once, if it went out a short while ago
async function takeOpen() {
  const o = await readJson(OPEN(), null);
  if (!o) return null;
  await fsp.rm(OPEN(), { force: true });
  return Date.now() - o.at < OPEN_FOR ? o.open : null;
}

// called by the --remind run (or handed to the open app); onOpen(target) opens the window
async function fire(onOpen, { force } = {}) {
  const notes = await readJson(path.join(app.getPath('userData'), 'notes.json'), { articles: {}, settings: {} });
  const list = await readJson(path.join(app.getPath('userData'), 'index.json'), []);
  const st = await readJson(STATE(), {});
  if (!conf(notes).on && !force) return null;
  st.lang = T[notes.settings && notes.settings.lang] ? notes.settings.lang : 'uz';
  st.every = conf(notes).every;
  st.sent ||= {};

  const now = new Date();
  const today = key(now);
  const due = slots(notes).filter((s) => {
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), s.h, s.m).getTime();
    return at <= now.getTime() + 60000 && now.getTime() - at < LATE_MS && !(st.sent[today] || []).includes(s.id);
  });
  const slot = force ? 'main' : due.length ? due[due.length - 1].id : null;
  if (!slot) return null;

  const f = facts(notes, list);
  const msg = compose(slot, f, st, st.shownOn !== today);
  st.sent = { [today]: [...(st.sent[today] || []), ...due.map((s) => s.id)] };
  let r = null;
  if (msg) {
    const [title, body] = pick(T[st.lang][msg.kind])(msg.v);
    st.lastKind = msg.kind;
    st.shownOn = today;
    await fsp.writeFile(STATE(), JSON.stringify(st));
    r = await show(title, body, msg.image, msg.open, onOpen);
  } else await fsp.writeFile(STATE(), JSON.stringify(st));
  return r;
}

// a sample from the settings page, in what the user would actually get
async function test(onOpen) {
  const notes = await readJson(path.join(app.getPath('userData'), 'notes.json'), { articles: {}, settings: {} });
  const list = await readJson(path.join(app.getPath('userData'), 'index.json'), []);
  const L = T[notes.settings && notes.settings.lang] ? notes.settings.lang : 'uz';
  const f = facts(notes, list);
  const msg = compose('main', { ...f, doneToday: false, days: Math.min(f.days, 1) }, { lang: L });
  if (!msg) {
    const [title, body] = T[L].test();
    return show(title, body, { flame: f.n || 1 }, null, onOpen);
  }
  const [title, body] = pick(T[L][msg.kind])(msg.v);
  return show(title, body, msg.image, msg.open, onOpen);
}

/* ---------------- the launchd agent ---------------- */

const xml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const launchctl = (...args) => new Promise((res) => execFile('/bin/launchctl', args, () => res()));

// rewrites the agent when the planned times change; returns them as "HH:MM"
async function schedule(notesArg) {
  if (process.platform !== 'darwin' && process.platform !== 'win32') return [];
  const notes = notesArg || (await readJson(path.join(app.getPath('userData'), 'notes.json'), { settings: {} }));
  const s = slots(notes);
  const times = s.map((x) => `${pad(x.h)}:${pad(x.m)}`);
  if (process.platform === 'win32') return scheduleWin(times);
  const target = `gui/${process.getuid()}`;
  if (!s.length) {
    await launchctl('bootout', `${target}/${LABEL}`);
    await fsp.rm(PLIST(), { force: true });
    return times;
  }
  const args = [process.execPath, ...(app.isPackaged ? [] : [app.getAppPath()]), '--remind'];
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>${args.map((a) => `<string>${xml(a)}</string>`).join('')}</array>
  <key>StartCalendarInterval</key>
  <array>${s.map((x) => `<dict><key>Hour</key><integer>${x.h}</integer><key>Minute</key><integer>${x.m}</integer></dict>`).join('')}</array>
  <key>ProcessType</key><string>Interactive</string>
</dict>
</plist>
`;
  const old = await fsp.readFile(PLIST(), 'utf8').catch(() => '');
  if (old === plist) return times;
  await fsp.mkdir(path.dirname(PLIST()), { recursive: true });
  await fsp.writeFile(PLIST(), plist);
  await launchctl('bootout', `${target}/${LABEL}`);
  await launchctl('bootstrap', target, PLIST());
  return times;
}

// Windows: one daily task per time in the Task Scheduler (folder "365 Articles"). The times
// last written are kept beside the notes, so nothing is touched while they stay the same.
const schtasks = (...args) => new Promise((res) => execFile('schtasks', args, { windowsHide: true }, (err) => res(!err)));
async function scheduleWin(times) {
  const file = path.join(app.getPath('userData'), 'remind-tasks.json');
  const old = await readJson(file, []);
  if (old.join() === times.join()) return times;
  for (let i = 0; i < old.length; i++) await schtasks('/Delete', '/F', '/TN', `365 Articles\\Reminder ${i + 1}`);
  const run = [process.execPath, ...(app.isPackaged ? [] : [app.getAppPath()])].map((a) => `"${a}"`).join(' ') + ' --remind';
  for (let i = 0; i < times.length; i++) await schtasks('/Create', '/F', '/SC', 'DAILY', '/ST', times[i], '/TN', `365 Articles\\Reminder ${i + 1}`, '/TR', run);
  await fsp.writeFile(file, JSON.stringify(times));
  return times;
}

/* ---------------- the widget (tools/widget.swift) ---------------- */
// the widget is sandboxed: it can only read its own container, so the file goes there
const WIDGET = () => path.join(os.homedir(), 'Library', 'Containers', 'uz.javohir.articles365.widget', 'Data', 'widget.json');
let lastWidget = '';
let lastCore = '';
let reloadedAt = 0;
let reloadT = 0;
let wk; // tools/widgetkit.swift as a Node addon (src/bin/widgetkit.node)
// The redraw has to be asked for by the app's own process: WidgetKit refuses the Reminder
// helper (ChronoCoreErrorDomain 10), so the helper is only a fallback when the addon is missing.
function reloadWidgets() {
  reloadedAt = Date.now();
  if (wk === undefined) {
    try {
      wk = require(path.join(__dirname, 'bin', 'widgetkit.node'));
    } catch (e) {
      wk = null;
      console.error('widgetkit', e.message);
    }
  }
  if (wk) {
    try {
      return wk.reload();
    } catch (e) {
      console.error('widgetkit', e.message);
    }
  }
  if (hasHelper()) execFile(HELPER(), ['--reload'], { timeout: 10000 }, () => {});
}
async function widget(notesArg) {
  if (process.platform !== 'darwin' || !fs.existsSync(path.dirname(WIDGET()))) return;
  const notes = notesArg || (await readJson(path.join(app.getPath('userData'), 'notes.json'), { articles: {}, settings: {} }));
  const list = await readJson(path.join(app.getPath('userData'), 'index.json'), []);
  const f = facts(notes, list);
  const days = (notes.stats && notes.stats.days) || {};
  const active = (k) => !!days[k] && (days[k].sec >= 60 || days[k].words >= 20);
  const now = new Date();
  const week = [];
  for (let i = 6; i >= 0; i--) week.push(active(key(addDays(now, -i))));
  const art = f.reading || f.fresh;
  const min = (k) => Math.round(((days[k] && days[k].sec) || 0) / 60);
  const fo = (notes.stats && notes.stats.focus) || {};
  const fd = (k) => (fo.days && fo.days[k]) || { sec: 0, sessions: 0, away: 0 };
  const run = fo.run && fo.run.ends > Date.now() ? fo.run : null;
  const meta = art && list.find((m) => m.id === art.id);
  const left = meta && meta.words ? Math.max(1, Math.round((meta.words * (1 - ((f.reading && f.reading.pct) || 0) / 100)) / 220)) : null;
  const info = {
    lang: T[notes.settings && notes.settings.lang] ? notes.settings.lang : 'uz',
    streak: f.n,
    best: f.best,
    doneToday: f.doneToday,
    todayMin: Math.round(((days[key(now)] && days[key(now)].sec) || 0) / 60),
    due: f.due,
    word: f.w || null,
    tr: f.tr || null,
    words: f.words,
    vocab: f.vocab,
    id: art ? art.id : null,
    title: art ? art.title : null,
    pct: f.reading ? f.reading.pct : null,
    left,
    goal: (notes.settings && notes.settings.goalMin) || 15,
    week,
    mins: [6, 5, 4, 3, 2, 1, 0].map((i) => min(key(addDays(now, -i)))),
    heat: Array.from({ length: 28 }, (_, i) => min(key(addDays(now, i - 27)))),
    focus: {
      min: Math.round(fd(key(now)).sec / 60),
      sessions: fd(key(now)).sessions,
      away: fd(key(now)).away,
      start: run ? run.start : null,
      ends: run ? run.ends : null,
      title: run ? run.title || null : null,
      week: [6, 5, 4, 3, 2, 1, 0].map((i) => Math.round(fd(key(addDays(now, -i))).sec / 60)),
    },
    day: key(now),
  };
  const json = JSON.stringify(info);
  if (json === lastWidget) return;
  lastWidget = json;
  await fsp.writeFile(WIDGET(), json);
  // what the widgets say changed (streak, words, article, a session starting or ending): redraw
  // now; only the minute counters ticking on: at most once a minute
  const core = JSON.stringify({ ...info, todayMin: 0, mins: 0, heat: 0, focus: { ...info.focus, min: 0, week: 0 } });
  clearTimeout(reloadT);
  if (core !== lastCore || Date.now() - reloadedAt > 60000) {
    lastCore = core;
    return reloadWidgets();
  }
  reloadT = setTimeout(reloadWidgets, 60000 - (Date.now() - reloadedAt));
}

module.exports = { fire, test, schedule, usualHour, takeOpen, hasHelper, widget };

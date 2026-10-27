'use strict';
// Settings page (⋯ menu → Settings, or ⌘,). Everything is saved in notes.settings and
// applied as CSS variables on <html>, so a change shows at once, also behind the page.
// Theme, language and font size reuse app.js's own switches; the player gets its volume,
// the volume while reading in focus, and its home position from here.
// Needs app.js (state, $, $$, save, showView, backToLibrary, settled, closeMenu, closeDrawer,
// applyTheme, toggleTheme, darkMq, setFontPct, FONT_BASE) and player.js.
const Settings = (() => {
  Object.assign(I18N.uz, {
    'set.kg.read': "O'qish", 'set.k.note': 'Abzasga xulosa (fokusda)', 'set.kg.menu': 'Menyu', 'set.kg.app': 'Ilova',
    'set.k.menu': 'Menyuni ochish', 'set.k.size0': "Asl o'lcham (100%)", 'set.k.edit': 'Tahrir rejimi',
    'set.k.pdf': 'Asl PDF', 'set.k.ai': 'AI menyusi', 'set.k.aicopy': 'Hammasini AI uchun nusxalash',
    'set.name': 'Ismingiz', 'set.name.d': 'Ilova ochilganda sizni shu ism bilan kutib oladi', 'set.name.ph': 'Ism',
    'set.k.hint': "Tugma ustiga olib boring — yuqoridagi ilova o'sha tugmani o'zi bosadi", 'set.k.noteText': 'Asosiy fikr: muallif buni misol bilan tushuntiryapti.',
    'set.kd.focus': "Bitta abzas aniq, qolgani xira", 'set.kd.session': "Taymerli chuqur fokus", 'set.kd.vocab': "Saqlangan so'zlar paneli", 'set.kd.note': "Fokusdagi abzas ostiga yozish", 'set.kd.music': "Fon pleyeri", 'set.kd.ra': "Abzasni ovoz bilan o'qiydi", 'set.kd.test': "Maqola bo'yicha savollar", 'set.kd.edit': "Matnni joyida tuzatish", 'set.kd.menu': "Kam ishlatiladigan asboblar", 'set.kd.size': "Kattaroq / kichikroq matn", 'set.kd.size0': "⌘+ / ⌘− ni bekor qiladi", 'set.kd.theme': "Yorug' / qorong'i", 'set.kd.pdf': "Maqolaning asl nusxasi", 'set.kd.ai': "Maqolani AI'da ochish", 'set.kd.aicopy': "Matn va savollar buferga", 'set.kd.search': "Kutubxonadan maqola topish", 'set.kd.set': "Shu sahifa", 'set.kd.back': "Oldingi ekranga",
    'set.title': 'Sozlamalar',
    'set.menu': 'Sozlamalar',
    'set.look': "Ko'rinish",
    'set.theme': 'Mavzu',
    'set.theme.d': "Tizim — macOS bilan birga almashadi",
    'set.light': "Yorug'",
    'set.dark': "Qorong'i",
    'set.system': 'Tizim',
    'set.lang': 'Interfeys tili',
    'set.read': "O'qish",
    'set.size': 'Matn o\'lchami',
    'set.font': 'Shrift',
    'set.lh': 'Qatorlar oralig\'i',
    'set.col': 'Matn kengligi',
    'set.marks': "Lug'atdagi so'zlar",
    'set.marks.d': "Matnda qanday ajralib turadi",
    'set.m.both': 'Fon + chiziq',
    'set.m.line': 'Chiziq',
    'set.m.fill': 'Fon',
    'set.m.none': "Ko'rinmas",
    'set.preview': "Reading every day keeps the mind focused: you begin to notice words and ideas you would once have consciously skipped.",
    'set.focus': 'Fokus rejimi',
    'set.grow': 'Matn kattalashishi',
    'set.blur': 'Atrofdagi abzaslar',
    'set.b.off': 'Aniq',
    'set.b.soft': 'Yengil',
    'set.b.mid': "O'rtacha",
    'set.b.strong': 'Kuchli',
    'set.music': 'Musiqa',
    'set.vol': 'Ovoz balandligi',
    'set.duck': 'Fokusda ovoz',
    'set.duck.d': "O'qiyotganda musiqa shuncha pasayadi",
    'set.pos': 'Pleyer joyi',
    'set.pos.d': 'Pleyerni sichqoncha bilan surib qo\'yish mumkin',
    'set.pos.reset': 'Joyiga qaytarish',
    'set.keys': 'Tugmalar',
    'set.remind': 'Eslatmalar',
    'set.r.when': 'Eslatish',
    'set.r.off': "O'chiq",
    'set.r.auto': 'Avto',
    'set.r.fixed': 'Vaqtida',
    'set.r.autoD': (h) => `Odatda soat ${h} atrofida o'qiysiz — shu payt eslatamiz`,
    'set.r.autoNew': "Odatdagi vaqtingizni o'rganguncha — soat 20:00 da",
    'set.r.at': 'Vaqt',
    'set.r.save': "Seriya xavf ostida bo'lsa, 22:30 da yana bir marta",
    'set.r.test': "Sinab ko'rish",
    'set.r.testD': 'Hozir bitta eslatma yuboradi',
    'set.r.pvT': (n) => `🔥 ${n} kun ketma-ket`,
    'set.r.pvB': "Bugun ham bitta maqola — va olov o'chmaydi.",
    'set.r.now': 'hozir',
    'set.r.hourly': 'Har soat',
    'set.r.hourlyD': "9:00 dan 22:00 gacha har soatda; o'qib bo'lsangiz ham, yengilroq ohangda",
    'set.r.sent': "Yuborildi — ekranning yuqori o'ng burchagiga qarang",
    'set.r.denied': "macOS bildirishnomalarni o'chirib qo'ygan — Sozlamalarda yoqing",
    'set.reset': 'Hammasini asliga qaytarish',
    'set.k.focus': 'Fokus rejimi',
    'set.k.vocab': "Lug'at",
    'set.k.test': 'Test',
    'set.k.ra': 'Ovoz bilan o\'qish (fokusda)',
    'set.k.music': 'Musiqa: chalish / pauza',
    'set.k.theme': 'Mavzu',
    'set.k.size': 'Matn o\'lchami',
    'set.k.search': 'Qidirish',
    'set.k.set': 'Sozlamalar',
    'set.k.back': 'Orqaga',
    'set.pv.normal': 'Oddiy',
    'set.pv.focus': 'Fokusda',
  });
  Object.assign(I18N.en, {
    'set.kg.read': 'Reading', 'set.k.note': 'Note on the paragraph (in focus)', 'set.kg.menu': 'Menu', 'set.kg.app': 'App',
    'set.k.menu': 'Open the Menu', 'set.k.size0': 'Actual size (100%)', 'set.k.edit': 'Edit mode',
    'set.k.pdf': 'Original PDF', 'set.k.ai': 'AI menu', 'set.k.aicopy': 'Copy everything for AI',
    'set.name': 'Your name', 'set.name.d': 'The app greets you by it when it opens', 'set.name.ph': 'Name',
    'set.k.hint': 'Hover a shortcut — the app above presses it for real', 'set.k.noteText': 'Main idea: the author shows it with an example.',
    'set.kd.focus': "One paragraph sharp, the rest dimmed", 'set.kd.session': "Timed deep focus", 'set.kd.vocab': "Saved words panel", 'set.kd.note': "Write under the focused paragraph", 'set.kd.music': "Background player", 'set.kd.ra': "Reads the paragraph out loud", 'set.kd.test': "Questions on the article", 'set.kd.edit': "Fix the text in place", 'set.kd.menu': "Less-used tools", 'set.kd.size': "Bigger / smaller text", 'set.kd.size0': "Undoes ⌘+ / ⌘−", 'set.kd.theme': "Light / dark", 'set.kd.pdf': "The original article", 'set.kd.ai': "Open the article in an AI", 'set.kd.aicopy': "Text and questions to clipboard", 'set.kd.search': "Find an article in the library", 'set.kd.set': "This page", 'set.kd.back': "Previous screen",
    'set.title': 'Settings',
    'set.menu': 'Settings',
    'set.look': 'Appearance',
    'set.theme': 'Theme',
    'set.theme.d': 'System follows macOS',
    'set.light': 'Light',
    'set.dark': 'Dark',
    'set.system': 'System',
    'set.lang': 'Interface language',
    'set.read': 'Reading',
    'set.size': 'Text size',
    'set.font': 'Typeface',
    'set.lh': 'Line spacing',
    'set.col': 'Text width',
    'set.marks': 'Vocabulary words',
    'set.marks.d': 'How they stand out in the text',
    'set.m.both': 'Fill + line',
    'set.m.line': 'Line',
    'set.m.fill': 'Fill',
    'set.m.none': 'Hidden',
    'set.preview': 'Reading every day keeps the mind focused: you begin to notice words and ideas you would once have consciously skipped.',
    'set.focus': 'Focus mode',
    'set.grow': 'Text grows by',
    'set.blur': 'Other paragraphs',
    'set.b.off': 'Sharp',
    'set.b.soft': 'Soft',
    'set.b.mid': 'Medium',
    'set.b.strong': 'Strong',
    'set.music': 'Music',
    'set.vol': 'Volume',
    'set.duck': 'Volume in focus',
    'set.duck.d': 'Music steps back this far while you read',
    'set.pos': 'Player position',
    'set.pos.d': 'Drag the player to move it',
    'set.pos.reset': 'Put it back',
    'set.keys': 'Shortcuts',
    'set.remind': 'Reminders',
    'set.r.when': 'Remind me',
    'set.r.off': 'Off',
    'set.r.auto': 'Auto',
    'set.r.fixed': 'At a time',
    'set.r.autoD': (h) => `You usually read around ${h} — that's when we'll remind you`,
    'set.r.autoNew': 'At 20:00 until we learn when you usually read',
    'set.r.at': 'Time',
    'set.r.save': 'Once more at 22:30 if your streak is at risk',
    'set.r.test': 'Try it',
    'set.r.testD': 'Sends one reminder now',
    'set.r.pvT': (n) => `🔥 ${n}-day streak`,
    'set.r.pvB': 'One article today and the fire stays lit.',
    'set.r.now': 'now',
    'set.r.hourly': 'Every hour',
    'set.r.hourlyD': 'Every hour from 9:00 to 22:00; after you have read, in a lighter tone',
    'set.r.sent': 'Sent — look at the top right of the screen',
    'set.r.denied': 'macOS has notifications turned off — turn them on in System Settings',
    'set.reset': 'Reset everything',
    'set.k.focus': 'Focus mode',
    'set.k.vocab': 'Vocabulary',
    'set.k.test': 'Test',
    'set.k.ra': 'Read aloud (in focus)',
    'set.k.music': 'Music: play / pause',
    'set.k.theme': 'Theme',
    'set.k.size': 'Text size',
    'set.k.search': 'Search',
    'set.k.set': 'Settings',
    'set.k.back': 'Back',
    'set.pv.normal': 'Normal',
    'set.pv.focus': 'In focus',
  });
  Object.assign(I18N.ru, {
    'set.kg.read': 'Чтение', 'set.k.note': 'Вывод к абзацу (в фокусе)', 'set.kg.menu': 'Меню', 'set.kg.app': 'Приложение',
    'set.k.menu': 'Открыть меню', 'set.k.size0': 'Исходный размер (100%)', 'set.k.edit': 'Режим правки',
    'set.k.pdf': 'Исходный PDF', 'set.k.ai': 'Меню AI', 'set.k.aicopy': 'Скопировать всё для AI',
    'set.name': 'Ваше имя', 'set.name.d': 'Приложение поприветствует вас по имени при запуске', 'set.name.ph': 'Имя',
    'set.k.hint': 'Наведите на клавишу — приложение выше нажмёт её по-настоящему', 'set.k.noteText': 'Главная мысль: автор объясняет это на примере.',
    'set.kd.focus': "Один абзац чёткий, остальное приглушено", 'set.kd.session': "Глубокий фокус с таймером", 'set.kd.vocab': "Панель сохранённых слов", 'set.kd.note': "Заметка под абзацем в фокусе", 'set.kd.music': "Фоновый плеер", 'set.kd.ra': "Читает абзац вслух", 'set.kd.test': "Вопросы по статье", 'set.kd.edit': "Править текст на месте", 'set.kd.menu': "Редко нужные инструменты", 'set.kd.size': "Крупнее / мельче", 'set.kd.size0': "Отменяет ⌘+ / ⌘−", 'set.kd.theme': "Светлая / тёмная", 'set.kd.pdf': "Оригинал статьи", 'set.kd.ai': "Открыть статью в AI", 'set.kd.aicopy': "Текст и вопросы в буфер", 'set.kd.search': "Найти статью в библиотеке", 'set.kd.set': "Эта страница", 'set.kd.back': "Предыдущий экран",
    'set.title': 'Настройки',
    'set.menu': 'Настройки',
    'set.look': 'Оформление',
    'set.theme': 'Тема',
    'set.theme.d': 'Системная — как в macOS',
    'set.light': 'Светлая',
    'set.dark': 'Тёмная',
    'set.system': 'Системная',
    'set.lang': 'Язык интерфейса',
    'set.read': 'Чтение',
    'set.size': 'Размер текста',
    'set.font': 'Шрифт',
    'set.lh': 'Межстрочный интервал',
    'set.col': 'Ширина текста',
    'set.marks': 'Слова из словаря',
    'set.marks.d': 'Как они выделены в тексте',
    'set.m.both': 'Фон + линия',
    'set.m.line': 'Линия',
    'set.m.fill': 'Фон',
    'set.m.none': 'Скрыты',
    'set.preview': 'Reading every day keeps the mind focused: you begin to notice words and ideas you would once have consciously skipped.',
    'set.focus': 'Режим фокуса',
    'set.grow': 'Увеличение текста',
    'set.blur': 'Остальные абзацы',
    'set.b.off': 'Чёткие',
    'set.b.soft': 'Слегка',
    'set.b.mid': 'Средне',
    'set.b.strong': 'Сильно',
    'set.music': 'Музыка',
    'set.vol': 'Громкость',
    'set.duck': 'Громкость в фокусе',
    'set.duck.d': 'Насколько музыка тише, пока вы читаете',
    'set.pos': 'Положение плеера',
    'set.pos.d': 'Плеер можно перетащить мышкой',
    'set.pos.reset': 'Вернуть на место',
    'set.keys': 'Клавиши',
    'set.remind': 'Напоминания',
    'set.r.when': 'Напоминать',
    'set.r.off': 'Выкл',
    'set.r.auto': 'Авто',
    'set.r.fixed': 'В своё время',
    'set.r.autoD': (h) => `Обычно ты читаешь около ${h} — тогда и напомним`,
    'set.r.autoNew': 'В 20:00, пока не узнаем, когда ты обычно читаешь',
    'set.r.at': 'Время',
    'set.r.save': 'Ещё раз в 22:30, если серия под угрозой',
    'set.r.test': 'Проверить',
    'set.r.testD': 'Пришлёт одно напоминание сейчас',
    'set.r.pvT': (n) => `🔥 ${n} дн. подряд`,
    'set.r.pvB': 'Одна статья сегодня — и огонь не погаснет.',
    'set.r.now': 'сейчас',
    'set.r.hourly': 'Каждый час',
    'set.r.hourlyD': 'Каждый час с 9:00 до 22:00; после чтения — помягче',
    'set.r.sent': 'Отправлено — смотри в правый верхний угол экрана',
    'set.r.denied': 'В macOS уведомления выключены — включи их в Настройках',
    'set.reset': 'Сбросить всё',
    'set.k.focus': 'Режим фокуса',
    'set.k.vocab': 'Словарь',
    'set.k.test': 'Тест',
    'set.k.ra': 'Чтение вслух (в фокусе)',
    'set.k.music': 'Музыка: играть / пауза',
    'set.k.theme': 'Тема',
    'set.k.size': 'Размер текста',
    'set.k.search': 'Поиск',
    'set.k.set': 'Настройки',
    'set.k.back': 'Назад',
    'set.pv.normal': 'Обычно',
    'set.pv.focus': 'В фокусе',
  });

  const FONTS = [
    ['iowan', 'Iowan', '"Iowan Old Style", "Charter", Georgia, serif'],
    ['charter', 'Charter', '"Charter", "Iowan Old Style", Georgia, serif'],
    ['georgia', 'Georgia', 'Georgia, "Times New Roman", serif'],
    ['palatino', 'Palatino', '"Palatino", "Palatino Linotype", Georgia, serif'],
    ['sans', 'SF Pro', '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif'],
  ];
  // [opacity of far paragraphs, blur of far paragraphs]
  const BLUR = { off: [0.5, 0], soft: [0.3, 2], mid: [0.16, 4], strong: [0.08, 7] };
  const DEF = { readFont: 'iowan', lineH: 1.72, col: 680, marks: 'both', fGrow: 22, fBlur: 'mid', duck: 50, goalMin: 15, fGuard: 'on', fFull: 'off', haptic: 'on' };

  const S = () => state.notes.settings;
  const get = (k) => (S()[k] ?? DEF[k]);
  const set = (k, v) => {
    if (v === DEF[k]) delete S()[k];
    else S()[k] = v;
    apply();
    saveSoon();
  };
  let saveT = 0;
  const saveSoon = () => (clearTimeout(saveT), (saveT = setTimeout(save, 250)));

  function apply() {
    const r = document.documentElement;
    const f = FONTS.find((x) => x[0] === get('readFont')) || FONTS[0];
    r.style.setProperty('--read-font', f[2]);
    r.style.setProperty('--read-lh', get('lineH'));
    r.style.setProperty('--col', get('col') + 'px');
    r.style.setProperty('--f-grow', get('fGrow') / 100);
    const [dim, blur] = BLUR[get('fBlur')] || BLUR.mid;
    r.style.setProperty('--f-dim', dim);
    r.style.setProperty('--f-blur', blur + 'px');
    r.dataset.marks = get('marks');
    if (typeof Focus !== 'undefined') Focus.refresh();
  }

  const root = $('#settings-body');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const seg = (key, opts, cur) =>
    `<div class="seg set-seg" data-k="${key}">${opts.map(([v, l]) => `<button data-v="${v}"${String(v) === String(cur) ? ' class="on"' : ''}>${esc(l)}</button>`).join('')}</div>`;
  const range = (key, min, max, step, val, fmt) =>
    `<div class="set-range"><input type="range" data-k="${key}" min="${min}" max="${max}" step="${step}" value="${val}" /><output>${fmt(val)}</output></div>`;
  const row = (label, ctl, desc = '') =>
    `<div class="set-row"><div class="set-l"><div>${esc(label)}</div>${desc ? `<small>${esc(desc)}</small>` : ''}</div><div class="set-c">${ctl}</div></div>`;
  // groups an add-on puts in (Settings.add): { html({ group, row, esc }), click(e, root), input(e, root), after(root) },
  // each handler returning true when the event was its own
  const extras = [];
  const group = (title, rows, i) => `<section class="set-group" style="--i:${i}"><h3>${esc(title)}</h3><div class="set-card">${rows.join('')}</div></section>`;

  const FMT = {
    size: (v) => v + '%',
    lineH: (v) => (+v).toFixed(2),
    col: (v) => v + ' px',
    fGrow: (v) => '+' + v + '%',
    vol: (v) => v + '%',
    duck: (v) => v + '%',
    goalMin: (v) => v + ' ' + t('fs.min'),
  };
  const sizePct = () => Math.round(((S().fontSize || FONT_BASE) / FONT_BASE) * 100);
  const themeNow = () => S().theme || 'system';
  const music = () => S().music || {};

  /* ---------- previews: every group shows what its settings do, live ---------- */
  // the reader's bar in small: Music, Focus, Session, Menu and the vocab
  const pvBar = () => `<div class="pv-bar"><span data-t="back">${t('reader.back')}</span><span class="pv-acts">${[['music', 'bar.music'], ['focus', 'focus.btn'], ['menu', 'bar.tools']]
    .map(([d, k]) => `<span data-t="${d}">${esc(t(k))}</span>`).join('')}<span class="pv-solid" data-t="vocab">${esc(t('lib.vocab'))} <i>26</i></span></span></div>`;
  const SAMPLE = 'Reading every day keeps the mind focused: you begin to notice words and ideas you would once have consciously skipped.';
  // a small window of the app itself, in the theme and language being used right now
  const lookPv = () => `<div class="set-preview pv-look"><div class="pv-win">
      ${pvBar()}
      <div class="pv-doc"><b>Why Reading Every Day Matters</b><p>${esc(SAMPLE)}</p></div>
    </div></div>`;
  // the theme choice drawn as three little windows
  const themeCards = (cur) => `<div class="pv-themes" data-k="theme">${[['light', t('set.light')], ['dark', t('set.dark')], ['system', t('set.system')]]
    .map(([v, l]) => `<button data-v="${v}" class="pv-theme${v === cur ? ' on' : ''}"><span class="pv-thumb th-${v}"><i></i><i></i><i></i></span><small>${esc(l)}</small></button>`).join('')}</div>`;
  // three paragraphs as focus shows them: the middle one grown and sharp, the others dimmed
  const focusPv = () => `<div class="set-preview pv-focus">
      <p>A few pages a day add up to dozens of articles a year.</p>
      <p class="on">${esc(SAMPLE)}</p>
      <p>Over time, the hard words turn into familiar ones.</p>
    </div>`;
  // where the player sits in the window, and how loud it is normally and while reading
  const musicPv = () => `<div class="set-preview pv-music">
      <div class="pv-screen"><span class="pv-pill"><i></i><b></b></span></div>
      <div class="pv-meters">
        <div class="pv-meter"><span>${esc(t('set.pv.normal'))}</span><div class="pv-track"><i data-m="vol"></i></div></div>
        <div class="pv-meter"><span>${esc(t('set.pv.focus'))}</span><div class="pv-track"><i data-m="duck"></i></div></div>
      </div>
    </div>`;
  const PV_SCREEN = 240; // .pv-screen width in settings.css
  function paintPreviews() {
    const vol = music().vol ?? 70;
    const m = (k) => $(`.pv-track [data-m="${k}"]`, root);
    if (m('vol')) m('vol').style.transform = `scaleX(${vol / 100})`;
    if (m('duck')) m('duck').style.transform = `scaleX(${(vol / 100) * (get('duck') / 100)})`;
    const scr = $('.pv-screen', root);
    if (!scr) return;
    const k = PV_SCREEN / innerWidth; // its width, as settings.css sets it (reading it forced a layout)
    const p = music().pos || { x: 0, y: 0 };
    const pill = $('.pv-pill', scr);
    pill.style.width = Math.max(44, 264 * k) + 'px';
    pill.style.height = Math.max(10, 54 * k) + 'px';
    pill.style.transform = `translate(${(16 + p.x) * k}px, ${-(16 - p.y) * k}px)`;
  }

  /* ---------- reminders: notes.settings.remind = { on, at } (at null = the usual hour) ---------- */
  const R = () => S().remind || {};
  const rMode = () => (R().on === false ? 'off' : R().every ? 'hourly' : R().at ? 'fixed' : 'auto');
  let usual = null; // the hour the main process found, from api.remindSync
  function syncRemind() {
    if (!api.remindSync) return;
    api.remindSync(JSON.parse(JSON.stringify(state.notes))).then((r) => {
      usual = r && r.usual;
      const d = $('[data-r="autoD"]', root);
      if (d) d.textContent = autoD();
    }).catch(() => {});
  }
  const autoD = () => (usual != null ? t('set.r.autoD', String(usual).padStart(2, '0') + ':00') : t('set.r.autoNew'));
  const streakNow = () => (typeof Stats !== 'undefined' && Stats.summary ? Stats.summary().streak : 0) || 1;
  // a macOS banner, drawn the way the real one will arrive
  const remindPv = () => `<div class="set-preview pv-notif"><div class="pv-banner">
      <img class="pv-ic" src="icon.png" onerror="this.style.visibility='hidden'" alt="" />
      <div class="pv-txt"><div class="pv-top"><b>Inkwell</b><span>${esc(t('set.r.now'))}</span></div>
        <div class="pv-t">${esc(t('set.r.pvT', streakNow()))}</div><div class="pv-b">${esc(t('set.r.pvB'))}</div></div>
      <span class="pv-flame"><svg viewBox="0 0 64 64"><path d="M32 6c3 9 16 15 15 31-1 12-7 19-15 19s-15-7-15-18c0-8 5-13 8-16 0 6 3 10 6 11-2-11 0-20 1-27z" fill="#fff"/></svg><i>${streakNow()}</i></span>
    </div></div>`;
  const remindRows = () => {
    const m = rMode();
    return [
      remindPv(),
      row(t('set.r.when'), seg('rmode', [['off', t('set.r.off')], ['auto', t('set.r.auto')], ['fixed', t('set.r.fixed')], ['hourly', t('set.r.hourly')]], m), m === 'off' ? '' : m === 'hourly' ? t('set.r.hourlyD') : t('set.r.save')),
      m === 'auto' ? `<div class="set-row"><div class="set-l"><div>${esc(t('set.r.at'))}</div><small data-r="autoD">${esc(autoD())}</small></div><div class="set-c"></div></div>` : '',
      m === 'fixed' ? row(t('set.r.at'), `<input class="set-time" type="time" data-k="rat" value="${esc(R().at || '20:00')}" />`) : '',
      m === 'off' ? '' : row(t('set.r.test'), `<button class="btn outline set-btn" data-act="rtest">${esc(t('set.r.test'))}</button>`, t('set.r.testD')),
    ].filter(Boolean);
  };
  function setRemind(patch) {
    const r = { ...R(), ...patch };
    if (r.on !== false) delete r.on;
    if (!r.at) delete r.at;
    if (!r.every) delete r.every;
    if (Object.keys(r).length) S().remind = r;
    else delete S().remind;
    save();
    syncRemind();
  }
  function rerenderRemind() {
    const card = $('.set-group[data-g="remind"] .set-card', root);
    if (card) card.innerHTML = remindRows().join('');
  }

  /* ---------- shortcuts: grouped tiles — what to press on the right, what it does under the name ---------- */
  // [keys, id]: label is set.k.<id>, the line under it set.kd.<id>
  const KEYS = [
    ['set.kg.read', [[['F'], 'focus'], [['V'], 'vocab'], [['N'], 'note'], [['M'], 'music'], ...(IS_MAC ? [[['R'], 'ra']] : [])]],
    ['set.kg.menu', [[['⌘', 'K'], 'menu'], [['⌘', '+', '−'], 'size'], [['⌘', '0'], 'size0'], [['D'], 'theme'], [['⇧', '⌘', 'O'], 'pdf'], [['⇧', '⌘', 'A'], 'ai'], [['⇧', '⌘', 'C'], 'aicopy']]],
    ['set.kg.app', [[['⌘', 'F'], 'search'], [['⌘', ','], 'set'], [['Esc'], 'back']]],
  ];
  const CAP = IS_MAC ? {} : { '⌘': 'Ctrl', '⇧': 'Shift', '⌥': 'Alt' };
  const caps = (ks) => ks.map((k) => `<kbd>${esc(CAP[k] || k)}</kbd>`).join('');
  // the app itself, small, above the list, playing the shortcuts one after another for real
  const PV_W = 1180;
  const keysRows = () => [].concat(KEYS.map(([g, rows]) => `<div class="kv-group">${esc(t(g))}</div><div class="kv-grid">`
    + rows.map(([ks, id]) => `<div class="kv-tile" data-d="${id}"><div class="kv-txt"><b>${esc(t('set.k.' + id))}</b><small>${esc(t('set.kd.' + id))}</small></div><div class="kv-caps">${caps(ks)}</div></div>`).join('')
    + '</div>'));

  // [what to press, how long to show it, how to put it back]; a step is keys or a function
  // run inside the preview (it gets the preview's window)
  const DEMO = {
    focus: [['F'], ['Escape']],
    session: [['S'], ['Escape']],
    vocab: [['V'], ['V']],
    note: [['F', 700, 'N', 500, (w) => typeIn(w)], [(w) => w.pv.dropNote(), 500, 'Escape']],
    music: [['M'], ['M', 300, (w) => w.pv.hideMusic()]], // paused, then put away: it must not linger in the next demos
    ra: [['R'], ['R', 300, 'Escape']],
    menu: [['⌘K'], ['Escape']],
    size: [['⌘=', 380, '⌘=', 380, '⌘-'], [(w) => w.pv.setPct(pct0)]],
    size0: [['⌘=', 380, '⌘=', 700, '⌘0'], [(w) => w.pv.setPct(pct0)]],
    theme: [['D'], ['D']],
    pdf: [['⇧⌘O', (w) => w.pv.toast(t('set.k.pdf') + ' ↗')], []],
    ai: [['⇧⌘A'], ['Escape']],
    aicopy: [['⇧⌘C'], []],
    search: [['Escape', 700, '⌘F', 300, (w) => typeIn(w, '#search', 'the')], [(w) => { const q = w.document.getElementById('search'); q.blur(); q.value = ''; q.dispatchEvent(new w.Event('input', { bubbles: true })); }, 300, reopen]],
    set: [['⌘,'], ['⌘,', 500, reopen]],
    back: [['Escape'], [reopen]],
  };
  let pct0 = 100;
  // the preview's app has started (preview-api.js hands its globals over as window.pv)
  const up = (w) => { try { return !!(w && w.pv && w.pv.up()); } catch { return false; } };
  let home = null; // the article the preview sits on
  function reopen(w) {
    if (home) w.pv.open(home);
  }
  // letters go in one by one, as if typed, through the same input events typing makes
  function typeIn(w, sel, text = t('set.k.noteText')) {
    const el = sel ? w.document.querySelector(sel) : w.document.activeElement;
    if (!el || !('value' in el)) return;
    el.value = '';
    [...text].forEach((ch, i) => setTimeout(() => {
      el.value += ch;
      el.dispatchEvent(new w.Event('input', { bubbles: true }));
    }, i * 55));
  }
  const CODE = { ',': 'Comma', '=': 'Equal', '-': 'Minus', '0': 'Digit0', Escape: 'Escape' };
  function press(w, combo) {
    const shift = combo.includes('⇧');
    const meta = combo.includes('⌘');
    const key = combo.replace(/[⇧⌘]/g, '');
    const code = CODE[key] || 'Key' + key.toUpperCase();
    const k = key.length === 1 ? (shift ? key.toUpperCase() : key.toLowerCase()) : key;
    const target = w.document.activeElement || w.document.body;
    target.dispatchEvent(new w.KeyboardEvent('keydown', { key: k, code, metaKey: meta, shiftKey: shift, bubbles: true, cancelable: true }));
  }

  let run = 0;
  let shown = null;
  // steps run in order; numbers are pauses
  function steps(list, id) {
    const f = $('.kv-live iframe', root);
    const w = f && f.contentWindow;
    if (!up(w)) return;
    let at = 0;
    for (const s of list) {
      if (typeof s === 'number') { at += s; continue; }
      setTimeout(() => {
        if (id !== run) return;
        if (typeof s === 'function') s(w);
        else press(w, s);
      }, at);
    }
    return at;
  }
  // the tile's keys go down while the preview does it
  function capsDown(tile, on) {
    if (tile) $$('kbd', tile).forEach((k, i) => setTimeout(() => k.classList.toggle('down', on), on ? i * 60 : 0));
  }
  function show(d, tile) {
    if (shown === d) return;
    const id = ++run;
    const back = putBack();
    shown = d;
    $$('.kv-tile.on', root).forEach((x) => x !== tile && x.classList.remove('on'));
    tile.classList.add('on');
    // the last one settles first, so two things never move at once; and every demo starts
    // from the article (a slip back to the library is put right before the keys go down)
    const f0 = $('.kv-live iframe', root);
    const lost = up(f0 && f0.contentWindow) && home && f0.contentWindow.pv.state.view !== 'reader';
    if (lost) setTimeout(() => id === run && reopen(f0.contentWindow), back ? back + 300 : 0);
    setTimeout(() => {
      if (id !== run) return;
      const f = $('.kv-live iframe', root);
      if (f && up(f.contentWindow)) pct0 = f.contentWindow.pv.pct();
      const pr = $('.kv-press', root);
      if (pr) {
        $('.kv-pk', pr).innerHTML = caps(KEYS.flatMap((g) => g[1]).find((x) => x[1] === d)[0]);
        $('.kv-pl', pr).textContent = t('set.k.' + d);
        pr.classList.add('on');
      }
      capsDown(tile, true);
      const len = steps(DEMO[d][0], id) || 0;
      setTimeout(() => capsDown(tile, false), len + 260);
      if (looping) setTimeout(() => id === run && looping && advance(), len + 2600);
    }, (back ? back + 460 : 0) + (lost ? 900 : 0));
  }
  function putBack() {
    if (!shown) return 0;
    const d = shown;
    shown = null;
    $$('.kv-tile.on', root).forEach((x) => x.classList.remove('on'));
    const pr = $('.kv-press', root);
    if (pr) pr.classList.remove('on');
    const f = $('.kv-live iframe', root);
    const w = f && f.contentWindow;
    if (w && w.document.activeElement && w.document.activeElement !== w.document.body) w.document.activeElement.blur();
    return (steps(DEMO[d][1], run) || 0) + 1;
  }
  root.addEventListener('mouseover', (e) => {
    const tile = e.target.closest('.kv-tile[data-d]');
    if (!tile) return;
    looping = false;
    clearTimeout(resumeT);
    show(tile.dataset.d, tile);
  });
  root.addEventListener('mouseout', (e) => {
    const g = e.target.closest('.set-group[data-g="keys"] .kv-grid');
    if (!g || (e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('.kv-grid'))) return;
    run++;
    const back = putBack();
    clearTimeout(resumeT);
    resumeT = setTimeout(startLoop, back + 1500);
  });

  // the loop: each shortcut in turn, done, held a moment, put back, then the next
  let looping = false;
  let loopI = -1;
  let resumeT = 0;
  let seen = false;
  const ORDER = KEYS.flatMap((g) => g[1].map((x) => x[1]));
  function advance() {
    if (!looping || state.view !== 'settings' || !$('.kv-live iframe', root)) return (looping = false);
    if (!seen) return setTimeout(advance, 600);
    loopI = (loopI + 1) % ORDER.length;
    const d = ORDER[loopI];
    show(d, $(`.kv-tile[data-d="${d}"]`, root));
  }
  function startLoop() {
    if (looping || reduceMotion.matches) return;
    if (shown) {
      // the hovered one was the last: carry on after it
      loopI = ORDER.indexOf(shown);
    }
    looping = true;
    advance();
  }

  // the preview asks the real app for the library and the notes (a copy: it can't write)
  window.addEventListener('message', async (e) => {
    const f = $('.kv-live iframe', root);
    const m = e.data;
    if (!f || e.source !== f.contentWindow || !m || m.pv !== 'req') return;
    const value = await ({
      list: () => api.list(),
      article: (id) => api.article(id),
      loadNotes: () => JSON.parse(JSON.stringify(state.notes)),
      libDir: () => (api.libDir ? api.libDir() : null),
      inboxPath: () => api.inboxPath(),
    }[m.method] || (() => null))(...m.args);
    f.contentWindow.postMessage({ pv: 'res', id: m.id, value }, '*');
  });
  // once it's up, open the article read last and fit it to the card. Settings is drawn afresh on
  // every visit, so the observers are made once and pointed at the new card (an observer left
  // watching the old one would keep the old page, and its copy of the app, alive)
  let seenIO, nearIO, fitRO;
  function bootPreview() {
    const f = $('.kv-live iframe', root);
    if (!f) return;
    shown = null;
    looping = false;
    loopI = -1;
    seenIO ||= new IntersectionObserver(([en]) => (seen = en.isIntersecting));
    seenIO.disconnect();
    seenIO.observe(f.parentElement);
    // the demo is a whole second copy of the app: it starts once the page is scrolled near it,
    // not while Settings is sliding in at the top
    nearIO?.disconnect();
    nearIO = new IntersectionObserver(([en]) => {
      if (!en.isIntersecting) return;
      nearIO.disconnect();
      f.src = f.dataset.src;
    }, { root: f.closest('.scroller'), rootMargin: '900px 0px' });
    nearIO.observe(f.parentElement);
    // the card's width comes from the observer, after layout: reading clientWidth here forced a
    // layout of the half-built page, and setting --s right after made the next frame lay it out again
    fitRO?.disconnect();
    fitRO = new ResizeObserver(([en]) => f.style.setProperty('--s', (en.contentRect.width / PV_W).toFixed(4)));
    fitRO.observe(f.parentElement);
    f.addEventListener('load', () => {
      const w = f.contentWindow;
      const ready = setInterval(() => {
        if (!$('.kv-live iframe', root)) return clearInterval(ready);
        if (!up(w) || !w.pv.state.list.length) return;
        clearInterval(ready);
        const recs = state.notes.articles || {};
        const byOpen = w.pv.state.list.slice().sort((a, b) => ((recs[b.id] || {}).opened || 0) - ((recs[a.id] || {}).opened || 0));
        home = (state.current && state.current.id) || byOpen[0].id;
        w.pv.open(home).then(() => {
          w.document.getElementById('scroller').scrollTop = 0;
          setTimeout(startLoop, 900);
        });
      }, 100);
    }, { once: true });
  }

  function render() {
    root.innerHTML = `<h2 class="set-h">${esc(t('set.title'))}</h2>`
      + group(t('set.look'), [
        lookPv(),
        row(t('set.theme'), themeCards(themeNow()), t('set.theme.d')),
        row(t('set.lang'), seg('lang', [['uz', "O'zbek"], ['en', 'English'], ['ru', 'Русский']], lang)),
        ...(api.haptic && api.platform === 'darwin' ? [row(t('set.haptic'), seg('haptic', [['on', t('set.on')], ['off', t('set.off')]], get('haptic')), t('set.haptic.d'))] : []),
        row(t('set.name'), `<input class="set-text" data-k="name" maxlength="40" spellcheck="false" autocomplete="off" placeholder="${esc(t('set.name.ph'))}" value="${esc(S().name || '')}" />`, t('set.name.d')),
      ], 0)
      + group(t('set.read'), [
        `<div class="set-preview"><p>${esc(t('set.preview')).replace('focused', '<mark class="word">focused</mark>').replace('consciously', '<mark class="hl">consciously</mark>')}</p></div>`,
        row(t('set.size'), range('size', 50, 200, 5, sizePct(), FMT.size)),
        row(t('set.font'), seg('readFont', FONTS.map((f) => [f[0], f[1]]), get('readFont'))),
        row(t('set.lh'), range('lineH', 1.4, 2.2, 0.02, get('lineH'), FMT.lineH)),
        row(t('set.col'), range('col', 540, 900, 20, get('col'), FMT.col)),
        row(t('set.marks'), seg('marks', [['both', t('set.m.both')], ['line', t('set.m.line')], ['fill', t('set.m.fill')], ['none', t('set.m.none')]], get('marks')), t('set.marks.d')),
      ], 1)
      + group(t('set.focus'), [
        focusPv(),
        row(t('set.grow'), range('fGrow', 0, 40, 2, get('fGrow'), FMT.fGrow)),
        row(t('set.blur'), seg('fBlur', [['off', t('set.b.off')], ['soft', t('set.b.soft')], ['mid', t('set.b.mid')], ['strong', t('set.b.strong')]], get('fBlur'))),
        row(t('set.goal'), range('goalMin', 5, 60, 5, get('goalMin'), FMT.goalMin), t('set.goal.d')),
        row(t('set.fguard'), seg('fGuard', [['on', t('set.on')], ['off', t('set.off')]], get('fGuard')), t('set.fguard.d')),
        row(t('set.ffull'), seg('fFull', [['on', t('set.on')], ['off', t('set.off')]], get('fFull'))),
      ], 2)
      + group(t('set.music'), [
        musicPv(),
        row(t('set.vol'), range('vol', 0, 100, 5, music().vol ?? 70, FMT.vol)),
        row(t('set.duck'), range('duck', 0, 100, 5, get('duck'), FMT.duck), t('set.duck.d')),
        row(t('set.pos'), `<button class="btn outline set-btn" data-act="pos">${esc(t('set.pos.reset'))}</button>`, t('set.pos.d')),
      ], 3)
      + (api.remindSync ? group(t('set.remind'), remindRows(), 4).replace('<section class="set-group"', '<section class="set-group" data-g="remind"') : '')
      + extras.map((x) => x.html({ group, row, esc })).join('')
      + group(t('set.keys'), keysRows(), 5).replace('<section class="set-group"', '<section class="set-group" data-g="keys"')
      + `<div class="set-foot" style="--i:6"><button class="btn ghost set-btn" data-act="reset">${esc(t('set.reset'))}</button></div>`;

    extras.forEach((x) => x.after && x.after(root));
    bootPreview();
  }

  root.addEventListener('click', (e) => {
    if (extras.some((x) => x.click && x.click(e, root))) return;
    const th = e.target.closest('.pv-theme');
    if (th) {
      $$('.pv-theme', root).forEach((x) => x.classList.toggle('on', x === th));
      return setTheme(th.dataset.v, th);
    }
    const b = e.target.closest('.set-seg button');
    if (b) {
      const k = b.parentElement.dataset.k;
      const v = b.dataset.v;
      $$('button', b.parentElement).forEach((x) => x.classList.toggle('on', x === b));
      if (k === 'theme') return setTheme(v, b);
      if (k === 'rmode') {
        setRemind(
          v === 'off' ? { on: false, at: null, every: null }
            : v === 'auto' ? { on: true, at: null, every: null }
            : v === 'hourly' ? { on: true, at: null, every: true }
            : { on: true, at: R().at || '20:00', every: null },
        );
        return rerenderRemind();
      }
      if (k === 'lang') {
        const l = $(`#lang-menu [data-lang="${v}"]`);
        if (l) l.click();
        render();
        $$('input[type="range"]', root).forEach(fill);
        return paintPreviews();
      }
      set(k, v);
      if (k === 'haptic') {
        try {
          localStorage.setItem('a365.haptic', v); // the launch card plays before the notes load
        } catch {}
        if (v === 'on') Haptic.level(); // so you feel what you turned on
      }
      return;
    }
    const a = e.target.closest('[data-act]');
    if (!a) return;
    if (a.dataset.act === 'rtest') {
      return api.remindTest().then((r) => {
        if (r && r.ok) return toast(t('set.r.sent'));
        toast(t('set.r.denied'));
        if (api.remindSettings) api.remindSettings(); // macOS said no: show where to turn them on
      });
    }
    if (a.dataset.act === 'pos') Player.resetPos(), setTimeout(paintPreviews, 20);
    if (a.dataset.act === 'reset') {
      for (const k of Object.keys(DEF)) delete S()[k];
      delete S().fontSize;
      apply();
      setFontPct(100);
      Player.resetPos();
      render();
      paintPreviews();
    }
  });

  root.addEventListener('change', (e) => {
    const tm = e.target.closest('input[data-k="rat"]');
    if (tm && /^\d\d:\d\d$/.test(tm.value)) setRemind({ at: tm.value });
  });

  root.addEventListener('input', (e) => {
    if (extras.some((x) => x.input && x.input(e, root))) return;
    // the name the launch card greets with (splash.js reads the copy in localStorage)
    if (e.target.matches('input[data-k="name"]')) {
      const v = e.target.value.trim();
      if (v) S().name = v;
      else delete S().name;
      save();
      try {
        v ? localStorage.setItem('a365.name', v) : localStorage.removeItem('a365.name');
      } catch {}
      return;
    }
    const inp = e.target.closest('input[type="range"]');
    if (!inp) return;
    const k = inp.dataset.k;
    const v = +inp.value;
    v === +inp.min || v === +inp.max ? Haptic.level() : Haptic.align();
    inp.nextElementSibling.textContent = FMT[k](v);
    fill(inp);
    if (k === 'size') return setFontPct(v);
    if (k === 'vol') return Player.setVolume(v), paintPreviews();
    set(k, k === 'lineH' ? Math.round(v * 100) / 100 : v);
    paintPreviews();
  });
  // the track left of the thumb is filled in
  const fill = (inp) => inp.style.setProperty('--p', ((inp.value - inp.min) / (inp.max - inp.min)) * 100 + '%');

  function setTheme(v, btn) {
    const cur = document.documentElement.dataset.theme;
    if (v === 'system') {
      delete S().theme;
      save();
      const want = darkMq.matches ? 'dark' : 'light';
      if (want !== cur) toggleTheme(btn), delete S().theme, save();
      return;
    }
    if (v !== cur) toggleTheme(btn);
    else (S().theme = v), save();
  }

  async function open() {
    closeMenu();
    closeDrawer();
    if (typeof Focus !== 'undefined') Focus.off();
    render();
    $$('input[type="range"]', root).forEach(fill);
    paintPreviews();
    await settled();
    showView('settings');
  }

  $('#btn-settings').addEventListener('click', open);
  $('#settings-back').addEventListener('click', backToLibrary);
  // the live demo is a whole second copy of the app: once Settings has slid away, it's let go
  // (open() builds a fresh one), instead of running unseen behind the library
  let dropT = 0;
  new MutationObserver(() => {
    clearTimeout(dropT);
    if ($('#settings').classList.contains('is-active')) return;
    dropT = setTimeout(() => {
      if (state.view === 'settings') return;
      looping = false;
      clearTimeout(resumeT);
      const f = $('.kv-live iframe', root);
      if (f) f.remove();
      // the next visit starts at the top; done here, out of sight, since on the way in it forced a
      // layout of the half-built page before the one it gets anyway as it slides in
      $('#settings .scroller').scrollTop = 0;
    }, 700);
  }).observe($('#settings'), { attributes: true, attributeFilter: ['class'] });
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === ',') {
      e.preventDefault();
      if (state.view === 'settings') backToLibrary();
      else open();
    }
  });

  applyI18n();
  syncRemind();
  return { open, apply, render, add: (x) => extras.push(x) };
})();

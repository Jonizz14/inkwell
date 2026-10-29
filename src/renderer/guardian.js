'use strict';
// The Guardian shelf, beside "Articles" and "Listening": a row of sections, "Saved" being the
// Guardian articles already in the library (an ordinary list: search, filters, progress rings);
// any other section lists its newest articles, and a click saves one and opens it. A Guardian link
// pasted into the search field (or on the clipboard, with "+ Link") is saved and opened the same
// way. It runs on the reader's own free Content API key (Settings ▸ The Guardian); without one
// the shelf says where to get it. The texts come through api.guardian (main.js / web/api.js,
// both using src/guardian.js), which keep a text for a day at most, as the Guardian asks.
// app.js calls Guardian.setup() once the add-ons are in, unless one of them brought this shelf.
const Guardian = (() => {
  Object.assign(I18N.uz, {
    'gd.stats': (n, d, w) => `${n} ta maqola saqlangan · ${d} tasi o'qilgan · ${w} ta so'z lug'atda`,
    'gd.meta': (m, w) => `${m} daqiqa · ${w} so'z`,
    'gd.add': '+ Havola',
    'gd.search': "Qidirish yoki Guardian havolasini qo'ying…",
    'gd.paste': "Guardian maqolasi havolasini qidiruv maydoniga qo'ying va Enter bosing",
    'gd.saved': 'Saqlangan',
    'gd.loading': 'Yangi maqolalar yuklanmoqda…',
    'gd.err': "Guardian'ga ulanib bo'lmadi. Internetni tekshiring.",
    'gd.retry': 'Qayta urinish',
    'gd.none': "Hali saqlangan maqola yo'q. Bo'limni tanlang yoki havola qo'ying.",
    'gd.empty': "Bu bo'limda hozircha maqola yo'q.",
    'gd.save': 'Saqlash va ochish',
    'gd.opening': 'Yuklanmoqda…',
    'gd.failed': "Maqolani olib bo'lmadi",
    'gd.notGuardian': "Bu Guardian havolasi emas",
    'gd.paid': "Bu reklama materiali, matni yo'q",
    'gd.s.longread': 'Long Read',
    'gd.s.science': 'Fan',
    'gd.s.environment': 'Atrof-muhit',
    'gd.s.technology': 'Texnologiya',
    'gd.s.culture': 'Madaniyat',
    'gd.s.world': 'Dunyo',
    'gd.s.books': 'Kitoblar',
    'gd.s.lifeandstyle': 'Hayot tarzi',
  });
  Object.assign(I18N.en, {
    'gd.stats': (n, d, w) => `${n} articles saved · ${d} read · ${w} words in vocabulary`,
    'gd.meta': (m, w) => `${m} min · ${w} words`,
    'gd.add': '+ Link',
    'gd.search': 'Search, or paste a Guardian link…',
    'gd.paste': 'Paste a Guardian article link into the search field and press Enter',
    'gd.saved': 'Saved',
    'gd.loading': 'Loading the newest articles…',
    'gd.err': "Couldn't reach the Guardian. Check the connection.",
    'gd.retry': 'Try again',
    'gd.none': 'No saved articles yet. Pick a section or paste a link.',
    'gd.empty': 'Nothing in this section right now.',
    'gd.save': 'Save and open',
    'gd.opening': 'Loading…',
    'gd.failed': "Couldn't get the article",
    'gd.notGuardian': "That isn't a Guardian link",
    'gd.paid': 'That is sponsored content, with no article text',
    'gd.s.longread': 'Long Read',
    'gd.s.science': 'Science',
    'gd.s.environment': 'Environment',
    'gd.s.technology': 'Technology',
    'gd.s.culture': 'Culture',
    'gd.s.world': 'World',
    'gd.s.books': 'Books',
    'gd.s.lifeandstyle': 'Life & style',
  });
  Object.assign(I18N.ru, {
    'gd.stats': (n, d, w) => `Сохранено статей: ${n} · прочитано: ${d} · слов в словаре: ${w}`,
    'gd.meta': (m, w) => `${m} мин · ${w} слов`,
    'gd.add': '+ Ссылка',
    'gd.search': 'Поиск или ссылка на Guardian…',
    'gd.paste': 'Вставьте ссылку на статью Guardian в поле поиска и нажмите Enter',
    'gd.saved': 'Сохранённые',
    'gd.loading': 'Загружаю новые статьи…',
    'gd.err': 'Не удалось связаться с Guardian. Проверьте интернет.',
    'gd.retry': 'Повторить',
    'gd.none': 'Сохранённых статей пока нет. Выберите раздел или вставьте ссылку.',
    'gd.empty': 'В этом разделе сейчас пусто.',
    'gd.save': 'Сохранить и открыть',
    'gd.opening': 'Загружаю…',
    'gd.failed': 'Не удалось получить статью',
    'gd.notGuardian': 'Это не ссылка на Guardian',
    'gd.paid': 'Это рекламный материал, текста статьи нет',
    'gd.s.longread': 'Long Read',
    'gd.s.science': 'Наука',
    'gd.s.environment': 'Природа',
    'gd.s.technology': 'Технологии',
    'gd.s.culture': 'Культура',
    'gd.s.world': 'Мир',
    'gd.s.books': 'Книги',
    'gd.s.lifeandstyle': 'Стиль жизни',
  });

  Object.assign(I18N.uz, {
    'set.gd': 'The Guardian',
    'set.gd.key': 'API kaliti',
    'set.gd.ph': 'Kalitni shu yerga qo\'ying',
    'set.gd.d': "Bepul shaxsiy kalit (notijorat foydalanish uchun). Guardian shartiga ko'ra maqola matni 24 soatdan ortiq saqlanmaydi: belgilaringiz va lug'atingiz qoladi, matn esa ochganingizda qaytadan yuklanadi.",
    'set.gd.get': 'Kalit olish ↗',
    'set.gd.getD': "open-platform.theguardian.com → Developer key → pochtangizga keladi",
    'set.gd.test': 'Tekshirish',
    'set.gd.ok': "Ulandi ✓ — endi API'dan",
    'set.gd.bad': "Kalit noto'g'ri",
    'set.gd.limit': 'Bugungi limit tugadi — ertaga yana ishlaydi',
    'set.gd.fail': "Ulanib bo'lmadi — internetni tekshiring",
    'set.gd.none': 'Avval kalitni kiriting',
  });
  Object.assign(I18N.en, {
    'set.gd': 'The Guardian',
    'set.gd.key': 'API key',
    'set.gd.ph': 'Paste your key here',
    'set.gd.d': 'A free personal key (for non-commercial use). The Guardian asks that article text is kept no longer than 24 hours: your highlights and words stay, the text is fetched again when you open it.',
    'set.gd.get': 'Get a key ↗',
    'set.gd.getD': 'open-platform.theguardian.com → Developer key → it arrives by email',
    'set.gd.test': 'Check',
    'set.gd.ok': 'Connected ✓ — using the API now',
    'set.gd.bad': 'This key is not valid',
    'set.gd.limit': "Today's limit is used up — it works again tomorrow",
    'set.gd.fail': "Couldn't connect — check the internet",
    'set.gd.none': 'Paste a key first',
  });
  Object.assign(I18N.ru, {
    'set.gd': 'The Guardian',
    'set.gd.key': 'API-ключ',
    'set.gd.ph': 'Вставьте ключ сюда',
    'set.gd.d': 'Бесплатный личный ключ (для некоммерческого использования). Guardian просит не хранить текст статьи дольше 24 часов: ваши выделения и слова остаются, текст загружается заново при открытии.',
    'set.gd.get': 'Получить ключ ↗',
    'set.gd.getD': 'open-platform.theguardian.com → Developer key → придёт на почту',
    'set.gd.test': 'Проверить',
    'set.gd.ok': 'Подключено ✓ — теперь через API',
    'set.gd.bad': 'Ключ не подходит',
    'set.gd.limit': 'Дневной лимит исчерпан — завтра заработает снова',
    'set.gd.fail': 'Не удалось подключиться — проверьте интернет',
    'set.gd.none': 'Сначала вставьте ключ',
  });
  Object.assign(I18N.uz, {
    'gd.needKey': "The Guardian'ni o'qish uchun bepul API kaliti kerak. Bir daqiqada olinadi va pochtangizga keladi.",
    'gd.getKey': 'Kalit olish ↗',
    'gd.toSettings': 'Kalitni qo\'yish',
    'gd.badKey': "Guardian kaliti noto'g'ri — Sozlamalarda tekshiring",
    'gd.limit': 'Guardian kunlik limiti tugadi — ertaga yana ishlaydi',
    'gd.gone': "Bu maqola Guardian'da endi yo'q",
    'gd.offline': "Matn 24 soatdan keyin qaytadan yuklanadi — internet kerak",
  });
  Object.assign(I18N.en, {
    'gd.needKey': 'Reading The Guardian takes a free API key. It takes a minute and arrives by email.',
    'gd.getKey': 'Get a key ↗',
    'gd.toSettings': 'Add the key',
    'gd.badKey': 'The Guardian key is not valid — check it in Settings',
    'gd.limit': "The Guardian's daily limit is used up — it works again tomorrow",
    'gd.gone': 'This article is no longer on the Guardian',
    'gd.offline': 'The text is fetched again after 24 hours — that needs the internet',
  });
  Object.assign(I18N.ru, {
    'gd.needKey': 'Для The Guardian нужен бесплатный API-ключ. Получить его — минута, он придёт на почту.',
    'gd.getKey': 'Получить ключ ↗',
    'gd.toSettings': 'Вставить ключ',
    'gd.badKey': 'Ключ Guardian не подходит — проверьте в настройках',
    'gd.limit': 'Дневной лимит Guardian исчерпан — завтра заработает снова',
    'gd.gone': 'Этой статьи больше нет на Guardian',
    'gd.offline': 'Текст загружается заново через 24 часа — нужен интернет',
  });
  const SECS = ['saved', 'ielts', 'longread', 'science', 'environment', 'technology', 'culture', 'world', 'books', 'lifeandstyle'];
  const FRESH = 10 * 60000; // a section's list is fetched again after this
  const search = $('#search');
  const addBtn = $('#btn-add');
  const cache = new Map(); // section -> { at, items, err }
  const loading = new Set();
  const call = (ch, ...a) => api.guardian(ch, ...a);
  const KEY_URL = 'https://open-platform.theguardian.com/access/';
  const hasKey = () => !!(S().guardianKey || '').trim();

  const S = () => state.notes.settings;
  const saved = () => state.list.filter((m) => m.kind === 'guardian');
  const sec = () => (SECS.includes(S().gdSec) ? S().gdSec : saved().length ? 'saved' : 'longread');
  const fmtDay = (ms) => (ms ? dateFmt({ day: 'numeric', month: 'short' }).format(new Date(ms)) : '');

  /* ---------------- a section's list ---------------- */

  async function load(k, force) {
    const c = cache.get(k);
    if (loading.has(k) || (!force && c && Date.now() - c.at < FRESH && !c.err)) return;
    loading.add(k);
    const r = await call('feed', k).catch((e) => ({ ok: false, err: e.message }));
    loading.delete(k);
    cache.set(k, r.ok ? { at: Date.now(), items: r.items } : { at: Date.now(), items: (c && c.items) || [], err: r.err });
    // (the list may have been asked for on the way back to the library, before it is shown)
    if (state.shelf === 'guardian' && sec() === k) state.view === 'library' ? Shelves.crossfade(() => renderLibrary(true)) : renderLibrary(true);
  }

  const known = (url) => saved().find((m) => m.url === url);

  // rows look like the library's own: the date where the number is (or IELTS's P1–P3), a download
  // mark where the progress ring is; one already saved is the real library row. `tags` is a line
  // under the excerpt (IELTS: topic, words, level)
  function feedRow(it, i, num, tags = '') {
    const m = known(it.url);
    const n = esc(num || fmtDay(it.date));
    if (m) return itemHtml(m.img || !it.img ? m : { ...m }, i, 0).replace('<div class="item-num">000</div>', `<div class="item-num">${n}</div>`).replace('</p></div>', () => `</p>${tags}</div>`);
    return `<li class="item new gd-row${it.img ? ' has-img' : ''}" data-url="${esc(it.url)}" style="animation-delay:${Math.min(i, 14) * 22}ms">
        <div class="item-num">${n}</div>
        <div><h3 class="item-title">${esc(it.title)}</h3><p class="item-ex">${esc(it.excerpt)}</p>${tags}</div>${it.img ? `<img class="item-img" src="${esc(it.img)}" alt="" loading="lazy" decoding="async" />` : ''}
        <div class="item-meta"><span class="gd-dl" title="${esc(t('gd.save'))}"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.5v8M4.5 7.5 8 11l3.5-3.5M3 13.5h10"/></svg></span></div>
        <i class="gd-load"></i>
      </li>`;
  }

  // called first by renderLibrary(): true when it drew the list itself
  function render() {
    const k = sec();
    libHeader();
    $('#empty').hidden = true;
    if (k === 'saved') {
      if (!saved().length) {
        $('#list').innerHTML = `<li class="gd-msg">${esc(t('gd.none'))}</li>`;
        return true;
      }
      return false; // the ordinary list, of the Guardian articles only
    }
    if (!hasKey()) {
      $('#list').innerHTML = `<li class="gd-msg gd-key">${esc(t('gd.needKey'))}<span><button class="btn solid gd-get">${esc(t('gd.getKey'))}</button><button class="btn ghost gd-set">${esc(t('gd.toSettings'))}</button></span></li>`;
      return true;
    }
    const c = cache.get(k);
    if (!c || (loading.has(k) && !c.items.length)) {
      load(k);
      $('#list').innerHTML = `<li class="gd-msg gd-wait">${esc(t('gd.loading'))}</li>` + Array.from({ length: 6 }, (_, i) => `<li class="gd-skel" style="--i:${i}"><i></i><i></i><i></i></li>`).join('');
      return true;
    }
    load(k); // refreshes quietly when it's old
    if (c.err && !c.items.length) {
      $('#list').innerHTML = `<li class="gd-msg">${esc(why(c.err, 'gd.err'))} <button class="btn ghost gd-retry">${esc(t('gd.retry'))}</button></li>`;
      return true;
    }
    const q = state.query.trim().toLowerCase();
    // the reading filter works here too: an article not saved yet counts as unread
    const status = (it) => (known(it.url) ? statusOf(known(it.url).id) : 'new');
    if (k === 'ielts' && typeof Ielts !== 'undefined') {
      $('#list').innerHTML = Ielts.render(c.items, feedRow, status, q);
      return true;
    }
    const items = c.items.filter((it) => (state.filter === 'all' || status(it) === state.filter) && (!q || (it.title + ' ' + it.excerpt).toLowerCase().includes(q)));
    $('#list').innerHTML = items.length ? items.map((it, i) => feedRow(it, i)).join('') : `<li class="gd-msg">${esc(t('gd.empty'))}</li>`;
    return true;
  }

  /* ---------------- saving ---------------- */

  async function add(url, row) {
    if (row) row.classList.add('loading');
    const r = await call('add', url).catch((e) => ({ ok: false, err: e.message }));
    if (row) row.classList.remove('loading');
    if (!r.ok) {
      toast(why(r.err, 'gd.failed'));
      return false;
    }
    state.list = (await api.list()).sort((a, b) => natural.compare(a.file, b.file));
    await openArticle(r.id);
    return true;
  }

  // what went wrong, in words (also for app.js, when a day-old text couldn't come again)
  function why(err, fallback = 'reader.openFail') {
    const k = { 'not-guardian': 'gd.notGuardian', paid: 'gd.paid', 'no-key': 'gd.needKey', 'bad-key': 'gd.badKey', limit: 'gd.limit', gone: 'gd.gone' }[err];
    if (k) return t(k);
    return navigator.onLine === false || /fetch|network|timeout|abort/i.test(String(err)) ? t('gd.offline') : t(fallback);
  }

  let on = false; // set up (an add-on may have brought its own shelf instead)
  $('#list').addEventListener('click', (e) => {
    if (!on || state.shelf !== 'guardian') return;
    if (e.target.closest('.gd-get')) return void window.open(KEY_URL);
    if (e.target.closest('.gd-set')) return void Settings.open();
    if (e.target.closest('.gd-retry')) {
      const k = sec();
      cache.delete(k);
      return renderLibrary(true), load(k, true);
    }
    const row = e.target.closest('.gd-row');
    if (row && !row.classList.contains('loading')) add(row.dataset.url, row);
  });

  const isLink = (v) => /^https?:\/\/(www\.)?theguardian\.com\/\S+/.test(v);

  function setup() {
    on = true;
    Shelves.register({
      id: 'guardian',
      title: 'The Guardian',
      chipsHtml: () => SECS.map((k, i) => `<button data-sec="${k}" style="--k:${i}" class="${k === sec() ? 'on' : ''}">${esc(k === 'saved' ? t('gd.saved') : t('gd.s.' + k))}${k === 'saved' && saved().length ? ` <span class="count">${saved().length}</span>` : ''}</button>`).join(''),
      chip: (b) => ((S().gdSec = b.dataset.sec), save()),
      feedClass: () => sec() !== 'saved',
      render,
      stats: (n, d, w) => t('gd.stats', n, d, w),
      addLabel: () => t('gd.add'),
      searchPh: () => t('gd.search'),
      // the search field also takes a link: Enter saves and opens it
      async searchKey(e) {
        if (e.key !== 'Enter') return;
        const url = search.value.trim();
        if (!/^https?:\/\//.test(url)) return;
        e.preventDefault();
        if (!isLink(url)) return toast(t('gd.notGuardian'));
        search.classList.add('busy');
        const ok = await add(url);
        search.classList.remove('busy');
        if (ok) {
          search.value = '';
          state.query = '';
        }
      },
      // "+ Link": a Guardian link on the clipboard is saved and opened at once; otherwise the
      // search field waits for one
      async add() {
        const clip = String((await api.readClipboard().catch(() => '')) || '').trim();
        if (isLink(clip)) {
          addBtn.classList.add('busy');
          await add(clip);
          return addBtn.classList.remove('busy');
        }
        search.focus();
        toast(t('gd.paste'));
      },
    });

    /* ---------------- Settings: the reader's own Content API key ---------------- */
    if (typeof Settings !== 'undefined' && Settings.add) Settings.add({
      html: ({ group, row, esc }) => group(t('set.gd'), [
        row(t('set.gd.key'), `<div class="set-gkey"><input class="set-text" data-k="gkey" spellcheck="false" autocomplete="off" placeholder="${esc(t('set.gd.ph'))}" value="${esc(S().guardianKey || '')}" /><button class="btn outline set-btn" data-act="gtest">${esc(t('set.gd.test'))}</button></div><div class="set-gstat" aria-live="polite"></div>`, t('set.gd.d')),
        row(t('set.gd.get'), `<button class="btn ghost set-btn" data-act="gget">${esc(t('set.gd.get'))}</button>`, t('set.gd.getD')),
      ], 4),
      click(e, root) {
        const a = e.target.closest('[data-act="gget"], [data-act="gtest"]');
        if (!a) return false;
        if (a.dataset.act === 'gget') return window.open(KEY_URL), true;
        const k = ($('input[data-k="gkey"]', root).value || '').trim();
        const out = $('.set-gstat', root);
        if (!k) return (out.textContent = t('set.gd.none')), true;
        a.disabled = true;
        call('test', k).then((r) => {
          a.disabled = false;
          out.textContent = t(r && r.ok ? 'set.gd.ok' : r && r.err === 'bad-key' ? 'set.gd.bad' : r && r.err === 'limit' ? 'set.gd.limit' : 'set.gd.fail');
          out.classList.toggle('ok', !!(r && r.ok));
          if (r && r.ok) Haptic.level();
        });
        return true;
      },
      input(e, root) {
        if (!e.target.matches('input[data-k="gkey"]')) return false;
        const v = e.target.value.trim();
        if (v) S().guardianKey = v;
        else delete S().guardianKey;
        save();
        cache.clear();
        $('.set-gstat', root).textContent = '';
        return true;
      },
    });
  }

  // the section's list, fetched while the launch card is still up (app.js warm)
  const prefetch = () => on && hasKey() && sec() !== 'saved' && load(sec());

  return { setup, why, prefetch };
})();

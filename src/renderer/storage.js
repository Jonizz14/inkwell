// Settings → Storage: how much room Inkwell takes on this computer, by part (the app, your
// articles, your notes, caches, a downloaded update), and how that sits on the whole disk.
// The sizes come from main.js (storage:usage); the bars grow in once they are known.
// Each part has its action: show the folder, clear the cache, remove a downloaded update that
// isn't waiting to be installed (storage:show / storage:clear); notes and articles are never touched.
// Smart storage (src/tidy.js) does the same on its own: it can be turned off here, run now, and
// says when it last ran and what it freed.
const Storage = (() => {
  const TX = {
    uz: {
      title: 'Xotira', total: 'Inkwell egallagan joy', wait: 'Hisoblanmoqda…', fail: 'Hisoblab bo‘lmadi',
      ofDisk: (pct, free) => `Diskning ${pct} qismi · ${free} bo‘sh`,
      parts: {
        app: ['Ilovaning o‘zi', 'Inkwell dasturi'],
        library: ['Maqolalar', (n) => `${n} ta maqola: matn va rasmlar`],
        notes: ['Qaydlar va so‘zlar', 'Belgilar, lug‘at, sozlamalar va 7 kunlik zaxira'],
        cache: ['Kesh', 'Sahifalar tez ochilishi uchun vaqtinchalik fayllar'],
        update: ['Yangilanish', 'Yuklab olingan yangi versiya'],
      },
      disk: ['Inkwell', 'Boshqa fayllar', 'Bo‘sh'], units: ['bayt', 'KB', 'MB', 'GB', 'TB'],
      clear: 'Tozalash', clearD: 'Hech bir amal qaydlar, maqolalar va sozlamalarni o‘chirmaydi', clearing: 'Tozalanmoqda…', cleared: (n) => `Kesh tozalandi · ${n} bo‘shadi`,
      show: 'Ko‘rsatish', folder: 'Papkani ochish', remove: 'O‘chirish', removed: (n) => `Yangilanish fayllari o‘chirildi · ${n} bo‘shadi`, waiting: 'O‘rnatishni kutmoqda',
      smart: 'Aqlli xotira', smartD: 'O‘zi tartib saqlaydi: takror PDF nusxalari, ortiqcha kesh va eski yangilanish fayllarini olib tashlaydi. Qaydlar va maqolalarga tegmaydi',
      last: (ago, n) => `Oxirgi marta ${ago} · ${n} bo‘shatildi`, now: 'Hozir tozalash', tidied: (n) => `Tartibga keltirildi · ${n} bo‘shadi`,
      ago: (m) => (m < 1 ? 'hozirgina' : m < 60 ? `${m} daqiqa oldin` : m < 1440 ? `${Math.round(m / 60)} soat oldin` : `${Math.round(m / 1440)} kun oldin`),
    },
    en: {
      title: 'Storage', total: 'Space Inkwell takes', wait: 'Counting…', fail: 'Couldn’t count it',
      ofDisk: (pct, free) => `${pct} of the disk · ${free} free`,
      parts: {
        app: ['The app itself', 'Inkwell’s program'],
        library: ['Articles', (n) => `${n} ${n === 1 ? 'article' : 'articles'}: text and pictures`],
        notes: ['Notes and words', 'Highlights, vocabulary, settings and 7 days of backups'],
        cache: ['Cache', 'Temporary files that make pages open fast'],
        update: ['Update', 'A new version, downloaded'],
      },
      disk: ['Inkwell', 'Other files', 'Free'], units: ['bytes', 'KB', 'MB', 'GB', 'TB'],
      clear: 'Clear', clearD: 'None of these touch your notes, articles or settings', clearing: 'Clearing…', cleared: (n) => `Cache cleared · ${n} freed`,
      show: 'Show', folder: 'Open folder', remove: 'Remove', removed: (n) => `Update files removed · ${n} freed`, waiting: 'Waiting to install',
      smart: 'Smart storage', smartD: 'Keeps things tidy on its own: duplicate PDF copies, extra cache and old update files go. Notes and articles are never touched',
      last: (ago, n) => `Last run ${ago} · ${n} freed`, now: 'Tidy now', tidied: (n) => `Tidied up · ${n} freed`,
      ago: (m) => (m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`),
    },
    ru: {
      title: 'Хранилище', total: 'Сколько места занимает Inkwell', wait: 'Считаю…', fail: 'Не удалось посчитать',
      ofDisk: (pct, free) => `${pct} диска · свободно ${free}`,
      parts: {
        app: ['Само приложение', 'Программа Inkwell'],
        library: ['Статьи', (n) => `Статей: ${n} — текст и картинки`],
        notes: ['Заметки и слова', 'Выделения, словарь, настройки и копии за 7 дней'],
        cache: ['Кэш', 'Временные файлы, чтобы страницы открывались быстро'],
        update: ['Обновление', 'Скачанная новая версия'],
      },
      disk: ['Inkwell', 'Другие файлы', 'Свободно'], units: ['байт', 'КБ', 'МБ', 'ГБ', 'ТБ'],
      clear: 'Очистить', clearD: 'Ни одно действие не трогает заметки, статьи и настройки', clearing: 'Очищаю…', cleared: (n) => `Кэш очищен · освободилось ${n}`,
      show: 'Показать', folder: 'Открыть папку', remove: 'Удалить', removed: (n) => `Файлы обновления удалены · освободилось ${n}`, waiting: 'Ждёт установки',
      smart: 'Умное хранилище', smartD: 'Само поддерживает порядок: убирает копии PDF-дубликатов, лишний кэш и старые файлы обновлений. Заметки и статьи не трогает',
      last: (ago, n) => `Последний раз ${ago} · освободилось ${n}`, now: 'Навести порядок', tidied: (n) => `Порядок наведён · освободилось ${n}`,
      ago: (m) => (m < 1 ? 'только что' : m < 60 ? `${m} мин назад` : m < 1440 ? `${Math.round(m / 60)} ч назад` : `${Math.round(m / 1440)} дн назад`),
    },
  };
  const tx = () => TX[document.documentElement.lang] || TX.uz;
  const ORDER = ['app', 'library', 'notes', 'cache', 'update'];

  // Electron's ICU has no Uzbek, so its numbers come out in English: Uzbek writes 5,5 like Russian
  const number = (n, digits) => {
    const l = document.documentElement.lang || 'uz';
    return new Intl.NumberFormat(l === 'uz' ? 'ru' : l, { maximumFractionDigits: digits }).format(n);
  };
  function bytes(n) {
    const u = tx().units;
    let i = 0;
    while (n >= 1000 && i < u.length - 1) (n /= 1000), i++;
    return `${number(n, n < 10 && i > 1 ? 1 : 0)} ${u[i]}`;
  }
  const pct = (part, whole) => {
    const p = whole ? (part / whole) * 100 : 0;
    return p > 0 && p < 0.01 ? `<${number(0.01, 2)}%` : `${number(p, p < 1 ? 2 : 1)}%`;
  };

  let last = null; // the latest answer, so a re-render (a language switch) draws at once

  const html = ({ group, esc }) => {
    const t = tx();
    return group(t.title, [`<div class="st-use" aria-live="polite"><div class="st-wait">${esc(t.wait)}</div></div>`], 5);
  };

  function draw(root, v) {
    const box = root.querySelector('.st-use');
    if (!box) return;
    const t = tx();
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
    if (!v) return void (box.innerHTML = `<div class="st-wait">${esc(t.fail)}</div>`);
    const parts = ORDER.filter((k) => v.parts[k] > 0).map((k) => [k, v.parts[k]]);
    const total = parts.reduce((a, [, n]) => a + n, 0);
    const articles = (state.list || []).length;
    const desc = (k) => (typeof t.parts[k][1] === 'function' ? t.parts[k][1](articles) : t.parts[k][1]);
    const d = v.disk;
    // what each part offers: the articles' folder, a cleared cache, a removed update (not while
    // one waits to be installed); the app itself is left alone
    const btn = (act, label, part) => `<button class="btn ghost set-btn st-act" data-act="${act}" data-part="${part}">${esc(label)}</button>`;
    const action = (k) =>
      k === 'library' ? btn('stshow', t.show, 'library')
      : k === 'notes' ? btn('stshow', t.show, 'data')
      : k === 'cache' && api.storageClear ? btn('stclear', t.clear, 'cache')
      : k === 'update' && api.storageClear ? (v.pending ? `<span class="st-wait-tag">${esc(t.waiting)}</span>` : btn('stclear', t.remove, 'update'))
      : '<span></span>';
    box.innerHTML = `
      <div class="st-top">
        <div><small>${esc(t.total)}</small><b>${esc(bytes(total))}</b></div>
        ${d ? `<span>${esc(t.ofDisk(pct(total, d.total), bytes(d.free)))}</span>` : ''}
      </div>
      <div class="st-bar" role="img" aria-label="${esc(parts.map(([k, n]) => `${t.parts[k][0]} ${bytes(n)}`).join(', '))}">
        ${parts.map(([k, n], i) => `<i class="st-${k}" style="flex-grow:${Math.max(n / total, 0.012)};--j:${i}"></i>`).join('')}
      </div>
      <ul class="st-list">
        ${parts.map(([k, n], i) => `<li style="--j:${i}"><span class="st-dot st-${k}"></span><div><b>${esc(t.parts[k][0])}</b><small>${esc(desc(k))}</small></div><span class="st-n">${esc(bytes(n))}<small>${esc(pct(n, total))}</small></span>${action(k)}</li>`).join('')}
      </ul>
      ${smart(v, t, esc)}
      ${d ? `<div class="st-disk">
        <div class="st-dbar"><i class="st-me" style="width:${Math.max((total / d.total) * 100, 0.6)}%"></i><i class="st-other" style="width:${Math.max(0, ((d.total - d.free - total) / d.total) * 100)}%"></i></div>
        <div class="st-dkey"><span><i class="st-me"></i>${esc(t.disk[0])}</span><span><i class="st-other"></i>${esc(t.disk[1])} · ${esc(bytes(Math.max(0, d.total - d.free - total)))}</span><span><i></i>${esc(t.disk[2])} · ${esc(bytes(d.free))}</span></div>
      </div>` : ''}
      <div class="st-clear"><small>${esc(t.clearD)}</small>${api.storageShow ? `<button class="btn outline set-btn" data-act="stshow" data-part="data">${esc(t.folder)}</button>` : ''}</div>`;
    requestAnimationFrame(() => requestAnimationFrame(() => box.classList.add('in')));
  }

  function smart(v, t, esc) {
    if (!api.storageTidy) return '';
    const on = ((state.notes.settings || {}).smartStorage || 'on') !== 'off';
    const l = v.tidy;
    const sub = l ? t.last(t.ago(Math.round((Date.now() - l.at) / 60000)), bytes(l.freed)) : t.smartD;
    return `<div class="st-smart">
        <div><b>${esc(t.smart)}</b><small title="${esc(t.smartD)}">${esc(sub)}</small></div>
        <button class="btn ghost set-btn st-act" data-act="sttidy">${esc(t.now)}</button>
        <div class="seg set-seg" data-k="smartStorage"><button data-v="on"${on ? ' class="on"' : ''}>${esc(window.t('set.on'))}</button><button data-v="off"${on ? '' : ' class="on"'}>${esc(window.t('set.off'))}</button></div>
      </div>`;
  }

  function fill(root) {
    if (last) draw(root, last);
    api.storageUsage().then((v) => ((last = v), draw(root, v))).catch(() => draw(root, null));
  }

  // the buttons live in Settings' own click handler chain (Settings.add → click)
  function click(e, root) {
    const b = e.target.closest('[data-act="stclear"], [data-act="stshow"], [data-act="sttidy"]');
    if (!b) return false;
    if (b.dataset.act === 'sttidy') {
      b.disabled = true;
      b.textContent = tx().clearing;
      api.storageTidy()
        .then(() => api.storageUsage())
        .then((v) => {
          last = v;
          draw(root, v);
          toast(tx().tidied(bytes((v.tidy && v.tidy.freed) || 0)));
          if (typeof Haptic !== 'undefined') Haptic.level();
        })
        .catch(() => draw(root, last));
      return true;
    }
    const part = b.dataset.part;
    if (b.dataset.act === 'stshow') return api.storageShow(part), true;
    const before = last ? last.parts[part] : 0;
    b.disabled = true;
    b.textContent = tx().clearing;
    api.storageClear(part)
      .then(() => api.storageUsage())
      .then((v) => {
        last = v;
        draw(root, v);
        const freed = bytes(Math.max(0, before - (v.parts[part] || 0)));
        toast(part === 'update' ? tx().removed(freed) : tx().cleared(freed));
        if (typeof Haptic !== 'undefined') Haptic.level();
      })
      .catch(() => draw(root, last));
    return true;
  }

  return { html, fill, click };
})();

if (typeof api !== 'undefined' && api.storageUsage && typeof Settings !== 'undefined' && Settings.add) {
  Settings.add({ html: Storage.html, after: Storage.fill, click: Storage.click });
}

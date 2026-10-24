'use strict';
// The vocabulary as a PDF: the "PDF" button in the drawer. White paper, black ink, "inkwell" on
// top. Only words that have a translation; grouped by article, then by paragraph: each word with
// its translation and the sentence it was taken from (the word in bold). What the drawer shows is what goes in (this article, or all of them).
// main.js prints it (vocab:pdf) into Downloads and opens it.
// Needs app.js (state, $, esc, t, toast, vocabRows, titleOf).
const VocabPdf = (() => {
  Object.assign(I18N.uz, {
    'vp.title': "Lug'at",
    'vp.all': 'Barcha maqolalar',
    'vp.count': (n) => `${n} ta so'z`,
    'vp.none': "Tarjimasi bor so'z yo'q",
    'vp.busy': 'PDF tayyorlanmoqda…',
    'vp.saved': 'PDF Downloads papkasiga saqlandi',
    'vp.fail': "PDF yaratib bo'lmadi",
    'vp.tip': "Lug'atni PDF qilish",
  });
  Object.assign(I18N.en, {
    'vp.title': 'Vocabulary',
    'vp.all': 'All articles',
    'vp.count': (n) => `${n} ${n === 1 ? 'word' : 'words'}`,
    'vp.none': 'No words with a translation yet',
    'vp.busy': 'Making the PDF…',
    'vp.saved': 'PDF saved to Downloads',
    'vp.fail': "Couldn't make the PDF",
    'vp.tip': 'Vocabulary as a PDF',
  });
  Object.assign(I18N.ru, {
    'vp.title': 'Словарь',
    'vp.all': 'Все статьи',
    'vp.count': (n) => `Слов: ${n}`,
    'vp.none': 'Нет слов с переводом',
    'vp.busy': 'Готовлю PDF…',
    'vp.saved': 'PDF сохранён в «Загрузки»',
    'vp.fail': 'Не удалось сделать PDF',
    'vp.tip': 'Словарь в PDF',
  });

  const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // the sentence with its saved words in bold (the plain text is escaped first; longer phrases
  // first, so "sensitive data" wins over "data")
  function sentence(ctx, words) {
    const ws = [...new Set(words.map((w) => esc(w.trim())).filter(Boolean))].sort((a, b) => b.length - a.length);
    const html = esc(ctx || '');
    if (!ws.length) return html;
    return html.replace(new RegExp(`(^|[^\\p{L}\\p{N}])(${ws.map(reEsc).join('|')})(?=[^\\p{L}\\p{N}]|$)`, 'giu'), '$1<b>$2</b>');
  }

  const CSS = `
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { background: #fff; color: #111; font: 11pt/1.5 "Iowan Old Style", "Charter", Georgia, serif; padding: 0 18mm; }
    .ui { font-family: -apple-system, "SF Pro Text", "Helvetica Neue", sans-serif; }
    header { padding: 6mm 0 9mm; border-bottom: 1px solid #111; margin-bottom: 8mm; }
    .brand { font: 400 30pt/1 "Iowan Old Style", Georgia, serif; letter-spacing: -0.01em; }
    h1 { font: 400 20pt/1.2 "Iowan Old Style", Georgia, serif; margin-top: 7mm; }
    .meta { margin-top: 2mm; font-size: 9pt; color: #6b6b67; letter-spacing: 0.02em; }
    section { margin-bottom: 9mm; }
    h2 { font: 600 13.5pt/1.3 "Iowan Old Style", Georgia, serif; margin-bottom: 1mm; break-after: avoid; }
    .by { font-size: 8.5pt; color: #6b6b67; letter-spacing: 0.04em; text-transform: uppercase; margin-bottom: 4mm; break-after: avoid; }
    .para { padding: 3.5mm 0 4mm; border-top: 1px solid #e4e4e0; break-inside: avoid; }
    .w { display: grid; grid-template-columns: 34% 1fr; gap: 0 5mm; margin-bottom: 1mm; }
    .word { font-weight: 600; font-size: 12pt; }
    .tr { font-size: 11pt; color: #222; }
    .ctx { margin: 1mm 0 2.4mm; font-style: italic; color: #444; font-size: 10pt; }
    .ctx:last-child { margin-bottom: 0; }
    .ctx b { font-style: normal; font-weight: 600; color: #111; border-bottom: 1px solid #111; }
  `;

  function build() {
    const rows = vocabRows().filter(({ v }) => (v.tr || '').trim());
    if (!rows.length) return null;
    // articles in the order their newest word was saved; inside one, paragraphs in reading order
    const arts = new Map();
    for (const r of rows) {
      if (!arts.has(r.id)) arts.set(r.id, { meta: r.meta, paras: new Map() });
      const ps = arts.get(r.id).paras;
      const k = r.v.p ?? -1;
      if (!ps.has(k)) ps.set(k, []);
      ps.get(k).push(r.v);
    }
    const one = state.vocabScope === 'article' && state.current;
    const scope = one ? titleOf(state.current.meta) : t('vp.all');
    const day = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
    let body = '';
    for (const [id, a] of arts) {
      const paras = [...a.paras.entries()].sort((x, y) => x[0] - y[0]);
      body += `<section>${one ? '' : `<h2>${esc(a.meta ? titleOf(a.meta) : id)}</h2>${a.meta && a.meta.by ? `<div class="by ui">${esc(a.meta.by)}</div>` : ''}`}`;
      for (const [p, vs] of paras) {
        vs.sort((x, y) => x.at - y.at);
        // words taken from the same sentence share it: the words, then the sentence once
        const groups = [];
        for (const v of vs) {
          const g = groups.find((x) => x.ctx === (v.ctx || ''));
          g ? g.vs.push(v) : groups.push({ ctx: v.ctx || '', vs: [v] });
        }
        body += `<div class="para">${groups
          .map((g) => g.vs.map((v) => `<div class="w"><span class="word">${esc(v.word)}</span><span class="tr">${esc(v.tr.trim())}</span></div>`).join('') + (g.ctx ? `<div class="ctx">${sentence(g.ctx, g.vs.map((v) => v.word))}</div>` : ''))
          .join('')}</div>`;
      }
      body += '</section>';
    }
    const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>Inkwell</title><style>${CSS}</style></head><body>
      <header><div class="brand">inkwell</div><h1>${esc(t('vp.title'))} · ${esc(scope)}</h1><div class="meta ui">${esc(day)} · ${esc(t('vp.count', rows.length))}</div></header>
      ${body}</body></html>`;
    return { html, name: `Inkwell ${t('vp.title')} - ${scope} - ${new Date().toISOString().slice(0, 10)}` };
  }

  const btn = $('#vocab-pdf');
  const label = () => (btn.title = t('vp.tip'));
  label();
  let busy = false;
  btn.addEventListener('click', async () => {
    if (busy) return;
    const doc = build();
    if (!doc) return toast(t('vp.none'));
    busy = true;
    btn.classList.add('busy');
    toast(t('vp.busy'));
    const r = await api.vocabPdf(doc.html, doc.name).catch((e) => ({ ok: false, err: e.message }));
    busy = false;
    btn.classList.remove('busy');
    if (!r.sheet) toast(r.ok ? t('vp.saved') : t('vp.fail')); // the web shows the print sheet instead
  });

  return { build, label };
})();

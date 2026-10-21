'use strict';
// IELTS Reading "Passage 1" practice for the open article.
//  1. The AI menu copies a prompt (works in any chat AI, nothing Claude-specific) asking for a
//     13-question test in the plain-text format below.
//  2. The student pastes the AI's reply (or drops the .txt) into "Paste test".
//  3. The test opens in a side pane next to the passage, is checked locally, and is stored with
//     the article notes (rec(id).test = { raw, answers, started, used, checked, score }).
//
// Format: one field per line as KEY: value; a line without a key continues the previous field.
//   #IELTS-TEST v1 · TITLE · TIME · #SECTION · TYPE · INSTRUCTIONS · HEADING · OPTIONS · #END
//   per question n: Qn question · On MCQ options "A) … | B) …" · An answer · En evidence · Xn why
// Needs app.js (state, rec, save, toast, $, $$, esc, api, titleOf, closeDrawer) and i18n.js.
const Test = (() => {
  const LANG_NAME = { uz: 'Uzbek', en: 'English', ru: 'Russian' };
  const TF = { T: 'TRUE', TRUE: 'TRUE', F: 'FALSE', FALSE: 'FALSE', NG: 'NOT GIVEN', NOTGIVEN: 'NOT GIVEN' };
  const YN = { Y: 'YES', YES: 'YES', N: 'NO', NO: 'NO', NG: 'NOT GIVEN', NOTGIVEN: 'NOT GIVEN' };
  const GAP_RE = /_{3,}|…{2,}|\.{4,}|\[gap\]/i;
  // academic reading: raw score out of 40 → band
  const BANDS = [[39, 9], [37, 8.5], [35, 8], [33, 7.5], [30, 7], [27, 6.5], [23, 6], [19, 5.5], [15, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5], [0, 2]];

  Object.assign(I18N.uz, {
    'ai.test': 'IELTS test prompti',
    'ai.testSub': "Passage 1 · 13 savol — istalgan AI'ga",
    'ai.testPaste': 'Testni joylash',
    'ai.testPasteSub': "AI qaytargan TXT'ni qo'shish",
    'ai.testCopied': "Prompt nusxalandi: AI'ga joylang, javobini «Testni joylash»ga qo'ying",
    'test.btn': 'Test',
    'test.btnTitle': 'IELTS test (T)',
    'test.importTitle': 'Testni joylash',
    'test.importHint': "AI qaytargan matnni (#IELTS-TEST bilan boshlanadi) shu yerga joylang yoki .txt faylni tashlang.",
    'test.file': '.txt fayl',
    'test.cancel': 'Bekor',
    'test.add': "Qo'shish",
    'test.replace': "Bu maqolada test bor. Yangisi bilan almashtirilsinmi? Eski javoblar o'chadi.",
    'test.added': (n) => `Test qo'shildi: ${n} savol`,
    'test.errEmpty': "Matn bo'sh",
    'test.errFormat': "Format tanilmadi: AI javobidagi #IELTS-TEST blokini to'liq joylang",
    'test.errNone': 'Savollar topilmadi',
    'test.errAnswer': (n) => `${n}-savolning javobi (A${n}) yo'q`,
    'test.errOpts': (n) => `${n}-savolning variantlari (O${n}) yo'q`,
    'test.check': 'Javoblarni tekshirish',
    'test.retry': 'Qayta yechish',
    'test.delete': "Testni o'chirish",
    'test.confirmDel': "Test va javoblaringiz o'chirilsinmi?",
    'test.unanswered': (n) => `${n} ta savol javobsiz. Baribir tekshirilsinmi?`,
    'test.band': 'taxminiy band',
    'test.bandNote': '40 savolli imtihonga proporsional',
    'test.used': (m) => `${m} daqiqa`,
    'test.answer': "To'g'ri javob",
    'test.yours': 'Sizniki',
    'test.none': "javob yo'q",
    'test.skipped': 'Siz javob bermadingiz',
    'test.tally': (ok, bad, skip) => `✓ ${ok} to'g'ri · ✕ ${bad} xato · — ${skip} javobsiz`,
    'test.show': "Matnda ko'rsatish",
    'test.notFound': 'Iqtibos matndan topilmadi',
    'test.close': 'Yopish',
    'test.resize': "Sudrab kengligini o'zgartiring · 2 marta bosing — asl holat",
  });
  Object.assign(I18N.en, {
    'ai.test': 'IELTS test prompt',
    'ai.testSub': 'Passage 1 · 13 questions — for any AI',
    'ai.testPaste': 'Paste test',
    'ai.testPasteSub': "Add the TXT the AI returned",
    'ai.testCopied': 'Prompt copied: paste it into an AI, then put its reply into "Paste test"',
    'test.btn': 'Test',
    'test.btnTitle': 'IELTS test (T)',
    'test.importTitle': 'Paste test',
    'test.importHint': 'Paste the AI reply (it starts with #IELTS-TEST) here, or drop the .txt file.',
    'test.file': '.txt file',
    'test.cancel': 'Cancel',
    'test.add': 'Add',
    'test.replace': 'This article already has a test. Replace it? Your old answers will be lost.',
    'test.added': (n) => `Test added: ${n} questions`,
    'test.errEmpty': 'The text is empty',
    'test.errFormat': 'Format not recognised: paste the whole #IELTS-TEST block from the AI reply',
    'test.errNone': 'No questions found',
    'test.errAnswer': (n) => `Question ${n} has no answer (A${n})`,
    'test.errOpts': (n) => `Question ${n} has no options (O${n})`,
    'test.check': 'Check answers',
    'test.retry': 'Try again',
    'test.delete': 'Delete test',
    'test.confirmDel': 'Delete the test and your answers?',
    'test.unanswered': (n) => `${n} questions are unanswered. Check anyway?`,
    'test.band': 'estimated band',
    'test.bandNote': 'scaled to a 40-question exam',
    'test.used': (m) => `${m} min`,
    'test.answer': 'Correct answer',
    'test.yours': 'Yours',
    'test.none': 'no answer',
    'test.skipped': 'You did not answer',
    'test.tally': (ok, bad, skip) => `✓ ${ok} correct · ✕ ${bad} wrong · — ${skip} unanswered`,
    'test.show': 'Show in text',
    'test.notFound': 'Quote not found in the text',
    'test.close': 'Close',
    'test.resize': 'Drag to resize · double-click to reset',
  });
  Object.assign(I18N.ru, {
    'ai.test': 'Промпт IELTS-теста',
    'ai.testSub': 'Passage 1 · 13 вопросов — для любого ИИ',
    'ai.testPaste': 'Вставить тест',
    'ai.testPasteSub': 'Добавить TXT от ИИ',
    'ai.testCopied': 'Промпт скопирован: вставьте в ИИ, ответ — в «Вставить тест»',
    'test.btn': 'Тест',
    'test.btnTitle': 'IELTS-тест (T)',
    'test.importTitle': 'Вставить тест',
    'test.importHint': 'Вставьте ответ ИИ (начинается с #IELTS-TEST) или перетащите .txt файл.',
    'test.file': '.txt файл',
    'test.cancel': 'Отмена',
    'test.add': 'Добавить',
    'test.replace': 'У статьи уже есть тест. Заменить? Старые ответы удалятся.',
    'test.added': (n) => `Тест добавлен: ${n} вопросов`,
    'test.errEmpty': 'Текст пустой',
    'test.errFormat': 'Формат не распознан: вставьте весь блок #IELTS-TEST из ответа ИИ',
    'test.errNone': 'Вопросы не найдены',
    'test.errAnswer': (n) => `У вопроса ${n} нет ответа (A${n})`,
    'test.errOpts': (n) => `У вопроса ${n} нет вариантов (O${n})`,
    'test.check': 'Проверить ответы',
    'test.retry': 'Решить заново',
    'test.delete': 'Удалить тест',
    'test.confirmDel': 'Удалить тест и ваши ответы?',
    'test.unanswered': (n) => `Без ответа: ${n}. Всё равно проверить?`,
    'test.band': 'примерный band',
    'test.bandNote': 'пропорционально экзамену из 40 вопросов',
    'test.used': (m) => `${m} мин`,
    'test.answer': 'Правильный ответ',
    'test.yours': 'Ваш',
    'test.none': 'нет ответа',
    'test.skipped': 'Вы не ответили',
    'test.tally': (ok, bad, skip) => `✓ ${ok} верно · ✕ ${bad} неверно · — ${skip} без ответа`,
    'test.show': 'Показать в тексте',
    'test.notFound': 'Цитата не найдена в тексте',
    'test.close': 'Закрыть',
    'test.resize': 'Потяните, чтобы изменить ширину · двойной клик — сброс',
  });

  /* ---------------- prompt ---------------- */

  function buildPrompt() {
    const { meta, data } = state.current;
    const title = titleOf(meta);
    const passage = [];
    data.blocks.forEach((b, p) => {
      if (b.type === 'h' && b.text === meta.title && p < 6) return;
      passage.push(b.type === 'h' ? `## ${b.text}` : b.text, '');
    });
    const L = LANG_NAME[lang] || 'Uzbek';
    return `You are an experienced IELTS Academic Reading item writer.

TASK
Write ONE IELTS Academic Reading test in the style of "Reading Passage 1" (13 questions) for the passage below. Do NOT rewrite or shorten the passage: the student reads it in their own app. Write only the questions.

RULES (real IELTS style)
- Exactly 13 questions, numbered 1–13, split into 2 or 3 sections of DIFFERENT task types, for example: 1–6 TFNG, 7–13 GAP; or 1–5 GAP, 6–9 TFNG, 10–13 MCQ.
- Inside a section, questions follow the order of the information in the passage (MATCH may not).
- Paraphrase like IELTS does (synonyms, different structure). Do not copy whole sentences into the questions.
- TFNG / YNNG: use at least one of each answer. NOT GIVEN must really be absent from the passage, not just unclear.
- GAP / SHORT: the answer must be word(s) copied EXACTLY from the passage and must respect the word limit you state in INSTRUCTIONS (e.g. "ONE WORD ONLY", "NO MORE THAN TWO WORDS AND/OR A NUMBER"). If more than one form is acceptable, separate them with " / ".
- MCQ: four options A–D, exactly one correct; wrong options should be plausible (mentioned in the passage, but not the answer).
- Difficulty: Passage 1 level (band 5.5–7).
- For every question also give:
  E = EVIDENCE: the exact words from the passage that prove the answer, copied character for character, 5–30 words, no "..." (for NOT GIVEN, the closest related sentence).
  X = EXPLANATION in ${L}: 1–2 short sentences on why the answer is right (and, for FALSE / NOT GIVEN, what the trap is).

OUTPUT FORMAT (VERY IMPORTANT, a program reads it)
- Reply with ONLY the test, in exactly the plain-text format below, inside ONE code block. Nothing before or after it.
- One field per line, written as KEY: value. No markdown, no bold, no bullet points, no tables.
- Start with the line "#IELTS-TEST v1", begin each section with "#SECTION", finish with "#END".
- Allowed TYPE values:
  TFNG  = TRUE / FALSE / NOT GIVEN (answer: TRUE, FALSE or NOT GIVEN)
  YNNG  = YES / NO / NOT GIVEN, for the writer's views (answer: YES, NO or NOT GIVEN)
  MCQ   = multiple choice: options on the O line as "A) … | B) … | C) … | D) …", answer is one letter
  GAP   = sentence / note / summary / table completion: write the gap as ______ (6 underscores), one gap per question
  SHORT = short-answer question, answer in words from the passage
  MATCH = matching statements to a list: put the list ONCE on an OPTIONS line "A) … | B) … | …", answer is one letter
- HEADING is optional (a title for notes / a summary in GAP sections).

TEMPLATE
#IELTS-TEST v1
TITLE: ${title}
TIME: 20

#SECTION
TYPE: TFNG
INSTRUCTIONS: Do the following statements agree with the information given in Reading Passage 1? Write TRUE if the statement agrees with the information, FALSE if the statement contradicts the information, NOT GIVEN if there is no information on this.
Q1: <statement>
A1: TRUE
E1: <exact words from the passage>
X1: <explanation in ${L}>

#SECTION
TYPE: GAP
INSTRUCTIONS: Complete the notes below. Choose NO MORE THAN TWO WORDS from the passage for each answer.
HEADING: <title of the notes>
Q7: <sentence with one ______ gap>
A7: <answer> / <other accepted form>
E7: <exact words from the passage>
X7: <explanation in ${L}>

#SECTION
TYPE: MCQ
INSTRUCTIONS: Choose the correct letter, A, B, C or D.
Q11: <question>
O11: A) <option> | B) <option> | C) <option> | D) <option>
A11: B
E11: <exact words from the passage>
X11: <explanation in ${L}>

#END

PASSAGE
# ${title}

${passage.join('\n').trim()}
`;
  }

  /* ---------------- parser ---------------- */

  const KEY = /^(TITLE|TIME|TYPE|INSTRUCTIONS?|HEADING|OPTIONS|Q|O|A|E|X)\s*(\d{1,3})?\s*[:：]\s?(.*)$/i;
  const OPT = /^\(?([A-L])[).:\]]\s*(.+)$/;

  function splitOpts(v) {
    return v
      .split('|')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s, i) => {
        const m = OPT.exec(s);
        return m ? { k: m[1].toUpperCase(), text: m[2].trim() } : { k: String.fromCharCode(65 + i), text: s };
      });
  }

  function typeOf(sec) {
    const t0 = sec.type;
    if (/TFNG|TRUE/.test(t0)) return 'TFNG';
    if (/YNNG|YES/.test(t0)) return 'YNNG';
    if (/MCQ|MULTIPLE|CHOICE/.test(t0)) return 'MCQ';
    if (/MATCH/.test(t0)) return 'MATCH';
    if (/SHORT/.test(t0)) return 'SHORT';
    if (/GAP|COMPLET|NOTE|SENTENCE|SUMMARY|TABLE|FLOW|DIAGRAM/.test(t0)) return 'GAP';
    // no (known) TYPE: guess from the content
    const q = sec.qs[0];
    if (sec.options.length) return 'MATCH';
    if (q && q.opts.length) return 'MCQ';
    if (q && TF[q.a.toUpperCase().replace(/\s/g, '')] && /TRUE|FALSE/i.test(sec.qs.map((x) => x.a).join(' '))) return 'TFNG';
    if (q && YN[q.a.toUpperCase().replace(/\s/g, '')]) return 'YNNG';
    if (q && GAP_RE.test(q.q)) return 'GAP';
    return 'SHORT';
  }

  function parse(raw) {
    const text = String(raw || '').replace(/\r/g, '');
    if (!text.trim()) throw new Error(t('test.errEmpty'));
    const lines = text.split('\n');
    const start = lines.findIndex((l) => /#\s*IELTS[-\s]?TEST/i.test(l));
    if (start < 0) throw new Error(t('test.errFormat'));
    const test = { title: '', time: 20, sections: [] };
    const newSec = () => {
      const s = { type: '', instructions: '', heading: '', options: [], qs: [] };
      test.sections.push(s);
      return s;
    };
    const byN = new Map();
    let sec = null;
    let last = null; // field that a key-less line continues
    let optList = null; // option list that a bare "C) …" line extends
    let curN = 0;
    for (let line of lines.slice(start + 1)) {
      line = line.replace(/\*\*/g, '').trim();
      if (!line || /^```/.test(line)) continue;
      if (/^#\s*END\b/i.test(line)) break;
      if (/^#\s*SECTION\b/i.test(line)) {
        sec = newSec();
        last = optList = null;
        continue;
      }
      const m = KEY.exec(line);
      if (!m) {
        const o = optList && OPT.exec(line);
        if (o) optList.push({ k: o[1].toUpperCase(), text: o[2].trim() });
        else if (last) last.obj[last.k] += (last.obj[last.k] ? '\n' : '') + line;
        continue;
      }
      let k = m[1].toUpperCase();
      if (k === 'INSTRUCTIONS') k = 'INSTRUCTION';
      const v = m[3].trim();
      optList = null;
      if (k === 'TITLE' && !sec) {
        test.title = v;
        last = { obj: test, k: 'title' };
        continue;
      }
      if (k === 'TIME' && !sec) {
        test.time = parseInt(v, 10) || 20;
        last = null;
        continue;
      }
      if (!sec) sec = newSec();
      if (k === 'TYPE') {
        sec.type = v.toUpperCase().replace(/[^A-Z]/g, '');
        last = null;
        continue;
      }
      if (k === 'INSTRUCTION' || k === 'HEADING') {
        const f = k === 'HEADING' ? 'heading' : 'instructions';
        sec[f] = v;
        last = { obj: sec, k: f };
        continue;
      }
      if (k === 'OPTIONS') {
        sec.options = splitOpts(v);
        optList = sec.options;
        last = null;
        continue;
      }
      // question fields; a missing number means "the current question" (or the next one for Q)
      let n = m[2] ? +m[2] : k === 'Q' ? curN + 1 : curN;
      if (!n) n = 1;
      curN = n;
      let q = byN.get(n);
      if (!q) {
        q = { n, q: '', opts: [], a: '', e: '', x: '' };
        byN.set(n, q);
        sec.qs.push(q);
      }
      if (k === 'O') {
        q.opts = splitOpts(v);
        optList = q.opts;
        last = null;
      } else {
        const f = k.toLowerCase();
        q[f] = v;
        last = { obj: q, k: f };
      }
    }
    test.sections = test.sections.filter((s) => s.qs.length);
    if (!test.sections.length) throw new Error(t('test.errNone'));
    for (const s of test.sections) {
      s.qs.sort((a, b) => a.n - b.n);
      s.type = typeOf(s);
      for (const q of s.qs) {
        q.e = q.e.replace(/^["“'‘]+|["”'’]+$/g, '').trim();
        if (!q.a.trim()) throw new Error(t('test.errAnswer', q.n));
        if (s.type === 'MCQ' && !q.opts.length && !s.options.length) throw new Error(t('test.errOpts', q.n));
        if (s.type === 'MATCH' && !s.options.length && q.opts.length) s.options = q.opts;
        q.key = answerKey(s.type, q.a);
      }
    }
    test.count = test.sections.reduce((n, s) => n + s.qs.length, 0);
    return test;
  }

  // the accepted answers, normalised for comparison
  function answerKey(type, a) {
    const up = a.toUpperCase().replace(/[^A-Z]/g, '');
    if (type === 'TFNG') return [TF[up] || (up.startsWith('NOT') ? 'NOT GIVEN' : up)];
    if (type === 'YNNG') return [YN[up] || (up.startsWith('NOT') ? 'NOT GIVEN' : up)];
    if (type === 'MCQ' || type === 'MATCH') {
      const m = /\b([A-L])\b/.exec(a.toUpperCase());
      return [m ? m[1] : up.slice(0, 1)];
    }
    const out = new Set();
    for (const alt of a.split(/\s+\/\s+|\s*;\s*|\s+OR\s+/)) {
      // "(steam) engine" accepts both "steam engine" and "engine"
      out.add(normGap(alt.replace(/[()]/g, '')));
      out.add(normGap(alt.replace(/\([^)]*\)/g, '')));
    }
    out.delete('');
    return [...out];
  }

  function normGap(s) {
    return String(s)
      .toLowerCase()
      .replace(/[‘’ʼ`]/g, "'")
      .replace(/["“”]/g, '')
      .replace(/[–—]/g, '-')
      .replace(/\s+/g, ' ')
      .replace(/^[\s.,;:!?]+|[\s.,;:!?]+$/g, '')
      .replace(/^(the|a|an) /, '');
  }

  function isRight(sec, q, ans) {
    if (ans == null || ans === '') return false;
    if (sec.type === 'GAP' || sec.type === 'SHORT') return q.key.includes(normGap(ans));
    return q.key.includes(String(ans).toUpperCase());
  }

  function tally(test, st) {
    let ok = 0, skip = 0;
    for (const s of test.sections) for (const q of s.qs) {
      const a = st.answers[q.n];
      if (!String(a ?? '').trim()) skip++;
      else if (isRight(s, q, a)) ok++;
    }
    return t('test.tally', ok, test.count - ok - skip, skip);
  }

  function band(ok, total) {
    const raw = Math.round((ok / total) * 40);
    return BANDS.find(([min]) => raw >= min)[1];
  }

  /* ---------------- state ---------------- */

  let cache = { raw: null, test: null };
  function current() {
    if (!state.current) return null;
    const r = rec(state.current.id);
    if (!r.test) return null;
    if (cache.raw !== r.test.raw) {
      try {
        cache = { raw: r.test.raw, test: parse(r.test.raw) };
      } catch {
        cache = { raw: r.test.raw, test: null };
      }
    }
    return cache.test && { r, st: r.test, test: cache.test };
  }

  const isOpen = () => document.body.classList.contains('test-open');

  function open() {
    if (!current()) return;
    applyWidth();
    if (drawerOpen()) closeDrawer();
    render(); // filled before it moves, so the slide has nothing to lay out
    glide(() => document.body.classList.add('test-open'));
    $('#testpane').setAttribute('aria-hidden', 'false');
  }
  function close() {
    if (isOpen()) glide(() => document.body.classList.remove('test-open'));
    $('#testpane').setAttribute('aria-hidden', 'true');
    stopTimer();
    clearEvidence();
  }

  // header button + pane follow whichever article is open
  function onArticle() {
    const c = current();
    const btn = $('#btn-test');
    btn.hidden = !c;
    if (c) $('#test-count').textContent = c.st.checked ? `${c.st.score}/${c.test.count}` : c.test.count;
    if (!c) close();
    else if (isOpen()) render();
  }

  /* ---------------- rendering ---------------- */

  const rangeOf = (s) => (s.qs.length > 1 ? `${s.qs[0].n}–${s.qs[s.qs.length - 1].n}` : `${s.qs[0].n}`);

  function choicesHtml(q, list, ans, checked, sec) {
    return list
      .map((c) => {
        const val = c.k ?? c;
        const on = ans === val;
        const right = checked && q.key.includes(val);
        const cls = ['tp-choice', on && 'on', checked && on && !right && 'wrong', right && 'right'].filter(Boolean).join(' ');
        const label = c.k ? `<i>${esc(c.k)}</i><span>${esc(c.text)}</span>` : esc(c);
        return `<button class="${cls}" data-n="${q.n}" data-pick="${esc(val)}"${checked ? ' disabled' : ''}>${sec.type === 'MATCH' ? esc(val) : label}</button>`;
      })
      .join('');
  }

  function gapInput(q, ans, checked, wide) {
    const ok = checked && isRight(cache.test.sections.find((s) => s.qs.includes(q)), q, ans);
    const cls = ['tp-gap', wide && 'tp-short', checked && (ok ? 'ok' : 'bad')].filter(Boolean).join(' ');
    const w = Math.max(6, Math.min(18, (ans || '').length + 2));
    return `<input class="${cls}" data-n="${q.n}" value="${esc(ans || '')}" spellcheck="false" autocomplete="off"${wide ? '' : ` style="width:${w}ch"`}${checked ? ' disabled' : ''} />`;
  }

  function questionHtml(sec, q, st) {
    const ans = st.answers[q.n];
    const checked = st.checked;
    const ok = checked && isRight(sec, q, ans);
    const skip = checked && !String(ans ?? '').trim();
    let body;
    if (sec.type === 'GAP') {
      const parts = q.q.split(GAP_RE);
      body = `<div class="tp-text">${esc(parts[0])}${gapInput(q, ans, checked)}${esc(parts.slice(1).join(' '))}</div>`;
    } else if (sec.type === 'SHORT') {
      body = `<div class="tp-text">${esc(q.q)}</div>${gapInput(q, ans, checked, true)}`;
    } else if (sec.type === 'MCQ') {
      body = `<div class="tp-text">${esc(q.q)}</div><div class="tp-mcq">${choicesHtml(q, q.opts.length ? q.opts : sec.options, ans, checked, sec)}</div>`;
    } else {
      const list = sec.type === 'MATCH' ? sec.options.map((o) => o.k) : sec.type === 'YNNG' ? ['YES', 'NO', 'NOT GIVEN'] : ['TRUE', 'FALSE', 'NOT GIVEN'];
      body = `<div class="tp-text">${esc(q.q)}</div><div class="tp-choices">${choicesHtml(q, list, ans, checked, sec)}</div>`;
    }
    let fb = '';
    if (checked) {
      const shown = sec.type === 'GAP' || sec.type === 'SHORT' ? q.a : q.key[0];
      fb = `<div class="tp-fb-wrap"><div class="tp-fb"><div class="tp-fb-in">
        ${ok ? '' : `<div><b>${esc(t('test.answer'))}:</b> ${esc(shown)} <span class="muted">· ${skip ? esc(t('test.skipped')) : `${esc(t('test.yours'))}: ${esc(ans)}`}</span></div>`}
        ${q.x ? `<div class="tp-x">${esc(q.x)}</div>` : ''}
        ${q.e ? `<span class="tp-ev">“${esc(q.e)}”</span><button class="tp-link" data-ev="${q.n}">${esc(t('test.show'))} →</button>` : ''}
      </div></div></div>`;
    }
    // --i staggers the reveal after "Check" (see .tp-reveal in styles.css)
    return `<div class="tp-q${checked ? (ok ? ' ok' : skip ? ' skip' : ' bad') : ''}" id="tq-${q.n}" style="--i:${qIndex++}"><span class="tp-n">${q.n}</span><div class="tp-main">${body}</div>${fb}</div>`;
  }

  let qIndex = 0;
  function render() {
    const c = current();
    if (!c) return close();
    qIndex = 0;
    const { st, test } = c;
    st.answers ||= {};
    $('#tp-title').textContent = test.title || titleOf(state.current.meta);
    let html = '';
    if (st.checked) {
      const b = band(st.score, test.count);
      html += `<div class="tp-score">
        <div class="tp-big"><span class="tp-num">${st.score}</span><span>/${test.count}</span></div>
        <div><div class="tp-band">${esc(t('test.band'))} <b>${b.toFixed(1)}</b></div>
        <div class="tp-tally">${esc(tally(test, st))}</div>
        <small>${esc(t('test.bandNote'))}${st.used ? ` · ${esc(t('test.used', Math.max(1, Math.round(st.used / 60000))))}` : ''}</small></div>
      </div>`;
    }
    for (const sec of test.sections) {
      html += `<section class="tp-sec">
        <h3 class="tp-qs-title">Questions ${rangeOf(sec)}</h3>
        ${sec.instructions ? `<p class="tp-inst">${esc(sec.instructions)}</p>` : ''}
        ${sec.type === 'MATCH' && sec.options.length ? `<div class="tp-opts-box">${sec.options.map((o) => `<div><b>${esc(o.k)}</b>&nbsp; ${esc(o.text)}</div>`).join('')}</div>` : ''}
        ${sec.heading ? `<div class="tp-heading">${esc(sec.heading)}</div>` : ''}
        ${sec.qs.map((q) => questionHtml(sec, q, st)).join('')}
      </section>`;
    }
    html += `<div class="tp-foot">
      ${st.checked ? `<button class="btn solid" id="tp-retry">${esc(t('test.retry'))}</button>` : `<button class="btn solid tp-check" id="tp-check"><span class="tp-spin"></span><span>${esc(t('test.check'))}</span></button>`}
      <span class="grow"></span>
      <button class="btn ghost tp-del" id="tp-del">${esc(t('test.delete'))}</button>
    </div>`;
    $('#tp-body').innerHTML = html;
    onArticleBadge(c);
    tick();
    if (!st.checked && st.started) startTimer();
    else stopTimer();
  }

  function onArticleBadge(c) {
    $('#test-count').textContent = c.st.checked ? `${c.st.score}/${c.test.count}` : c.test.count;
  }

  /* ---------------- timer (counts down from TIME, starts with the first answer) ---------------- */

  let timerId = 0;

  function tick() {
    const c = current();
    const el = $('#tp-timer');
    if (!c) return (el.textContent = '');
    const limit = (c.test.time || 20) * 60000;
    const used = c.st.checked ? c.st.used || 0 : c.st.started ? Date.now() - c.st.started : 0;
    const left = limit - used;
    const s = Math.round(Math.abs(left) / 1000);
    el.textContent = `${left < 0 ? '+' : ''}${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    el.classList.toggle('over', left < 0 && !c.st.checked);
    el.classList.toggle('idle', !c.st.started && !c.st.checked);
  }
  function startTimer() {
    if (!timerId) timerId = setInterval(tick, 1000);
  }
  function stopTimer() {
    clearInterval(timerId);
    timerId = 0;
  }

  /* ---------------- answering + checking ---------------- */

  function answer(n, val) {
    const c = current();
    if (!c || c.st.checked) return;
    c.st.answers[n] = val;
    if (!c.st.started) (c.st.started = Date.now()), startTimer();
    save();
  }

  function check() {
    const c = current();
    if (!c) return;
    const { st, test } = c;
    const qs = test.sections.flatMap((s) => s.qs.map((q) => [s, q]));
    const empty = qs.filter(([, q]) => !String(st.answers[q.n] ?? '').trim()).length;
    if (empty && !confirm(t('test.unanswered', empty))) return;
    st.score = qs.filter(([s, q]) => isRight(s, q, st.answers[q.n])).length;
    st.used = st.started ? Date.now() - st.started : 0;
    st.checked = true;
    st.at = Date.now();
    save();
    stopTimer();
    // a short "checking" beat, then the results come in question by question
    const body = $('#tp-body');
    $('#tp-check').classList.add('busy');
    body.classList.add('tp-checking');
    setTimeout(() => {
      body.classList.remove('tp-checking');
      body.classList.add('tp-reveal');
      render();
      body.scrollTo({ top: 0, behavior: 'smooth' });
      countUp($('.tp-num', body), st.score);
      const n = test.count;
      setTimeout(() => body.classList.remove('tp-reveal'), n * 70 + 900);
    }, reduceMotion.matches ? 0 : 650);
  }

  function countUp(el, to) {
    if (!el || reduceMotion.matches || !to) return;
    const t0 = performance.now();
    const dur = 700;
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(step);
    };
    el.textContent = '0';
    requestAnimationFrame(step);
  }

  function retry() {
    const c = current();
    if (!c) return;
    Object.assign(c.st, { answers: {}, checked: false, score: 0, started: 0, used: 0 });
    save();
    clearEvidence();
    // fade out, swap to a clean sheet, fade back in
    const body = $('#tp-body');
    body.classList.add('tp-fade');
    setTimeout(() => {
      render();
      body.scrollTop = 0;
      body.classList.remove('tp-fade');
    }, reduceMotion.matches ? 0 : 220);
  }

  function remove() {
    if (!state.current || !confirm(t('test.confirmDel'))) return;
    delete rec(state.current.id).test;
    save();
    close();
    onArticle();
  }

  /* ---------------- evidence: find the quote in the passage and light it up ---------------- */

  // lower-cased text with unified quotes/dashes/spaces, plus a map back to the original offsets
  function normMap(s) {
    let out = '';
    const map = [];
    for (let i = 0; i < s.length; i++) {
      let ch = s[i];
      if (/\s/.test(ch)) {
        if (!out || out.endsWith(' ')) continue;
        ch = ' ';
      }
      ch = ch.replace(/[‘’ʼ`]/, "'").replace(/[“”]/, '"').replace(/[–—]/, '-').toLowerCase();
      out += ch;
      map.push(i);
    }
    return { out, map };
  }

  function locate(quote) {
    const blocks = state.current.data.blocks;
    const tries = [quote, ...quote.split(/\.{3}|…/).sort((a, b) => b.length - a.length), quote.split(/\s+/).slice(0, 7).join(' ')];
    for (const raw of tries) {
      const needle = normMap(raw.trim().replace(/^["“']|["”']$/g, '')).out.trim();
      if (needle.length < 8) continue;
      for (let p = 0; p < blocks.length; p++) {
        const { out, map } = normMap(blocks[p].text);
        const i = out.indexOf(needle);
        if (i >= 0) return { p, s: map[i], e: map[i + needle.length - 1] + 1 };
      }
    }
    return null;
  }

  function domRange(el, s, e) {
    const r = document.createRange();
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let pos = 0;
    let started = false;
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const len = n.textContent.length;
      if (!started && s <= pos + len) (r.setStart(n, s - pos), (started = true));
      if (started && e <= pos + len) {
        r.setEnd(n, e - pos);
        return r;
      }
      pos += len;
    }
    return null;
  }

  let evTimer;
  function clearEvidence() {
    clearTimeout(evTimer);
    if (window.CSS && CSS.highlights) CSS.highlights.delete('evidence');
  }
  function showEvidence(n) {
    const c = current();
    const q = c && c.test.sections.flatMap((s) => s.qs).find((x) => x.n === n);
    const hit = q && q.e && locate(q.e);
    const para = hit && $(`#doc .para[data-p="${hit.p}"]`);
    if (!para) return toast(t('test.notFound'));
    const range = domRange($('.ptext', para), hit.s, hit.e);
    clearEvidence();
    if (range && window.CSS && CSS.highlights) CSS.highlights.set('evidence', new Highlight(range));
    para.scrollIntoView({ behavior: 'smooth', block: 'center' });
    para.classList.remove('jump');
    void para.offsetWidth;
    para.classList.add('jump');
    evTimer = setTimeout(clearEvidence, 6000);
  }

  /* ---------------- import ---------------- */

  function openImport() {
    if (!state.current) return;
    const m = $('#test-import');
    $('#ti-err').textContent = '';
    $('#ti-text').value = '';
    m.classList.add('show');
    m.setAttribute('aria-hidden', 'false');
    setTimeout(() => $('#ti-text').focus(), 60);
  }
  function closeImport() {
    const m = $('#test-import');
    m.classList.remove('show');
    m.setAttribute('aria-hidden', 'true');
  }
  const importOpen = () => $('#test-import').classList.contains('show');

  // returns true when the test was added
  function importText(raw) {
    let test;
    try {
      test = parse(raw);
    } catch (err) {
      $('#ti-err').textContent = err.message;
      return false;
    }
    const r = rec(state.current.id);
    if (r.test && r.test.raw !== raw && !confirm(t('test.replace'))) return false;
    r.test = { raw: String(raw).trim(), answers: {}, started: 0, used: 0, checked: false, score: 0, added: Date.now() };
    save();
    closeImport();
    onArticle();
    open();
    $('#tp-body').scrollTop = 0;
    toast(t('test.added', test.count));
    return true;
  }

  async function readFile(file) {
    if (!file) return;
    const text = await file.text();
    $('#ti-text').value = text;
    importText(text);
  }

  /* ---------------- wiring ---------------- */

  const looksLikeTest = (s) => /#\s*IELTS[-\s]?TEST/i.test(s || '');

  async function menu(kind) {
    if (!state.current) return;
    if (kind === 'prompt') {
      api.copy(buildPrompt());
      toast(t('ai.testCopied'));
      return;
    }
    // the AI reply is usually still on the clipboard: add it straight away
    const clip = api.readClipboard ? await api.readClipboard().catch(() => '') : '';
    if (!looksLikeTest(clip)) return openImport();
    try {
      parse(clip);
    } catch (err) {
      // a broken reply: show it with the reason so it can be fixed by hand
      openImport();
      $('#ti-text').value = clip;
      $('#ti-err').textContent = err.message;
      return;
    }
    importText(clip);
  }

  $('#btn-test').addEventListener('click', () => (isOpen() ? close() : open()));
  $('#tp-close').addEventListener('click', close);

  const body = $('#tp-body');
  body.addEventListener('click', (e) => {
    const pick = e.target.closest('[data-pick]');
    if (pick) {
      answer(+pick.dataset.n, pick.dataset.pick);
      $$(`[data-n="${pick.dataset.n}"][data-pick]`, body).forEach((b) => b.classList.toggle('on', b === pick));
      return;
    }
    const ev = e.target.closest('[data-ev]');
    if (ev) return showEvidence(+ev.dataset.ev);
    if (e.target.closest('#tp-check')) return check();
    if (e.target.closest('#tp-retry')) return retry();
    if (e.target.closest('#tp-del')) return remove();
  });
  body.addEventListener('input', (e) => {
    const inp = e.target.closest('input[data-n]');
    if (!inp) return;
    if (!inp.classList.contains('tp-short')) inp.style.width = Math.max(6, Math.min(18, inp.value.length + 2)) + 'ch';
    answer(+inp.dataset.n, inp.value);
  });
  // Enter jumps to the next gap
  body.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || !e.target.matches('input[data-n]')) return;
    e.preventDefault();
    const all = $$('input[data-n]:not([disabled])', body);
    const next = all[all.indexOf(e.target) + 1];
    if (next) (next.focus(), next.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
    else e.target.blur();
  });

  $('#ti-cancel').addEventListener('click', closeImport);
  $('#ti-ok').addEventListener('click', () => importText($('#ti-text').value));
  $('#ti-file').addEventListener('click', () => $('#ti-input').click());
  $('#ti-input').addEventListener('change', (e) => (readFile(e.target.files[0]), (e.target.value = '')));
  $('#test-import').addEventListener('mousedown', (e) => e.target.id === 'test-import' && closeImport());
  const ta = $('#ti-text');
  ta.addEventListener('input', () => ($('#ti-err').textContent = ''));
  // pasting into the dialog adds the test at once, no button needed
  ta.addEventListener('paste', () => setTimeout(() => looksLikeTest(ta.value) && importText(ta.value), 0));
  // a .txt dropped on the dialog is read here and never reaches the PDF importer
  const modal = $('#test-import');
  for (const ev of ['dragenter', 'dragover']) modal.addEventListener(ev, (e) => (e.preventDefault(), e.stopPropagation(), ta.classList.add('drag')));
  modal.addEventListener('dragleave', (e) => (e.stopPropagation(), e.target === ta && ta.classList.remove('drag')));
  modal.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    ta.classList.remove('drag');
    readFile(e.dataTransfer.files[0]);
  });

  // ⌘V of a test straight into the reader also works
  document.addEventListener('paste', (e) => {
    if (state.view !== 'reader' || !state.current || importOpen()) return;
    if (e.target.closest && e.target.closest('input, textarea, [contenteditable="true"]')) return;
    const text = e.clipboardData.getData('text/plain');
    if (!/#\s*IELTS[-\s]?TEST/i.test(text)) return;
    e.preventDefault();
    try {
      parse(text);
    } catch (err) {
      // show what went wrong next to the pasted text
      openImport();
      $('#ti-text').value = text;
      $('#ti-err').textContent = err.message;
      return;
    }
    importText(text);
  });

  // runs before app.js's shortcuts (capture phase)
  window.addEventListener(
    'keydown',
    (e) => {
      if (importOpen()) {
        if (e.key === 'Escape') (e.preventDefault(), e.stopImmediatePropagation(), closeImport());
        else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) (e.preventDefault(), importText(ta.value));
        return;
      }
      const typing = e.target.closest && e.target.closest('input, textarea, [contenteditable="true"]');
      if (typing || e.metaKey || e.ctrlKey || state.view !== 'reader') return;
      if (e.key === 'Escape' && isOpen() && !state.pop && !$('.menu.show')) return (e.stopImmediatePropagation(), close());
      if (e.key.toLowerCase() === 't' && current() && !state.pop) (e.stopImmediatePropagation(), isOpen() ? close() : open());
    },
    true,
  );

  /* ---------------- resizable divider ---------------- */

  const MIN_W = 340;
  const MIN_DOC = 380;
  function applyWidth() {
    const w = state.notes.settings.testW;
    const root = document.documentElement.style;
    if (!w || window.innerWidth <= 900) return root.removeProperty('--test-w');
    root.setProperty('--test-w', Math.round(Math.max(MIN_W, Math.min(window.innerWidth - MIN_DOC, w))) + 'px');
  }
  const grip = $('#tp-resize');
  grip.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || window.innerWidth <= 900) return;
    e.preventDefault();
    grip.setPointerCapture(e.pointerId);
    document.body.classList.add('tp-resizing');
    const move = (ev) => {
      state.notes.settings.testW = window.innerWidth - ev.clientX;
      applyWidth();
    };
    const up = () => {
      grip.removeEventListener('pointermove', move);
      document.body.classList.remove('tp-resizing');
      save();
    };
    grip.addEventListener('pointermove', move);
    grip.addEventListener('pointerup', up, { once: true });
    grip.addEventListener('pointercancel', up, { once: true });
  });
  grip.addEventListener('dblclick', () => {
    delete state.notes.settings.testW;
    save();
    applyWidth();
  });
  window.addEventListener('resize', applyWidth);

  // app.js may already have translated the page before these strings existed
  applyI18n();

  return { menu, open, close, onArticle, isOpen, importOpen, parse, buildPrompt, render };
})();

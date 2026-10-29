'use strict';
// "IELTS Reading" on the Guardian shelf: out of the newest articles of the sections IELTS passages
// come from (science, nature, education, society, technology, the Long Read…) it keeps the ones
// that read like a passage — an academic topic, 600–2000 words, no reviews, opinion, sport or
// live news — and ranks them. On top sits today's set: three passages from easier to harder, the
// way the test orders them (about 60 minutes in all); it stays the same for the whole day
// (notes.ielts = { day, urls }) and the header counts how many of them are read.
// Used by renderer/guardian.js and by the private add-on, which both fetch the 'ielts' feed.
const Ielts = (() => {
  Object.assign(I18N.uz, {
    'gd.s.ielts': 'IELTS Reading',
    'ie.today': "Bugungi to'plam",
    'ie.sub': (m, d) => `3 ta matn, osondan qiyinga${m ? ` · ≈ ${m} daqiqa o'qish` : ''}${d ? ` · ${d}/3 o'qildi` : ''}`,
    'ie.done': "Bugungi to'plam tugadi ✓ Ertaga yangisi",
    'ie.more': 'Yana mos matnlar',
    'ie.l1': 'Oson', 'ie.l2': "O'rta", 'ie.l3': 'Qiyin',
    'ie.words': (w) => `${w} so'z`,
    'ie.none': "Hozircha IELTS'ga mos maqola topilmadi. Birozdan keyin qayta urinib ko'ring.",
    'ie.t.nature': 'Tabiat', 'ie.t.climate': 'Iqlim va energiya', 'ie.t.science': 'Fan', 'ie.t.health': "Sog'liq va miya",
    'ie.t.history': 'Tarix', 'ie.t.society': 'Jamiyat', 'ie.t.education': "Ta'lim va til", 'ie.t.tech': 'Texnologiya', 'ie.t.culture': 'Madaniyat',
  });
  Object.assign(I18N.en, {
    'gd.s.ielts': 'IELTS Reading',
    'ie.today': "Today's set",
    'ie.sub': (m, d) => `3 passages, easier to harder${m ? ` · ≈ ${m} min of reading` : ''}${d ? ` · ${d}/3 read` : ''}`,
    'ie.done': "Today's set is done ✓ A new one tomorrow",
    'ie.more': 'More passages that fit',
    'ie.l1': 'Easier', 'ie.l2': 'Medium', 'ie.l3': 'Harder',
    'ie.words': (w) => `${w} words`,
    'ie.none': 'No articles that fit IELTS right now. Try again a little later.',
    'ie.t.nature': 'Nature', 'ie.t.climate': 'Climate & energy', 'ie.t.science': 'Science', 'ie.t.health': 'Health & mind',
    'ie.t.history': 'History', 'ie.t.society': 'Society', 'ie.t.education': 'Education & language', 'ie.t.tech': 'Technology', 'ie.t.culture': 'Culture',
  });
  Object.assign(I18N.ru, {
    'gd.s.ielts': 'IELTS Reading',
    'ie.today': 'Набор на сегодня',
    'ie.sub': (m, d) => `3 текста, от простого к сложному${m ? ` · ≈ ${m} мин чтения` : ''}${d ? ` · прочитано ${d}/3` : ''}`,
    'ie.done': 'Набор на сегодня пройден ✓ Завтра новый',
    'ie.more': 'Ещё подходящие тексты',
    'ie.l1': 'Проще', 'ie.l2': 'Средний', 'ie.l3': 'Сложнее',
    'ie.words': (w) => `${w} слов`,
    'ie.none': 'Подходящих для IELTS статей пока нет. Попробуйте чуть позже.',
    'ie.t.nature': 'Природа', 'ie.t.climate': 'Климат и энергия', 'ie.t.science': 'Наука', 'ie.t.health': 'Здоровье и мозг',
    'ie.t.history': 'История', 'ie.t.society': 'Общество', 'ie.t.education': 'Образование и язык', 'ie.t.tech': 'Технологии', 'ie.t.culture': 'Культура',
  });

  // the topics IELTS passages are about, by the words that give them away (word starts)
  const TOPICS = {
    nature: /\b(species|animal|wildlife|bird|whale|dolphin|shark|insect|bee|butterfl|forest|tree|plant|fung|ocean|coral|reef|fish|extinct|biodivers|ecosystem|habitat|predator|mammal|rewild)/i,
    climate: /\b(climate|carbon|emission|fossil fuel|solar|wind power|wind farm|renewable|energy|heatwave|drought|flood|glacier|sea level|pollution|plastic|recycl|deforest|wildfire)/i,
    science: /\b(scientist|research|study|studies|physic|chemist|space|planet|nasa|telescope|mars|moon|universe|galax|quantum|experiment|laborator|discover|astronom|asteroid|volcan|earthquake)/i,
    health: /\b(brain|sleep|memory|health|disease|virus|vaccin|cancer|diet|nutrition|obesity|mental|psycholog|ageing|aging|gene|genetic|dna|bacteri|microb|antibiotic|exercise|neuro)/i,
    history: /\b(ancient|archaeolog|historian|history|centur|roman|medieval|fossil|dinosaur|prehistoric|bronze age|stone age|pharaoh|viking|empire|excavat|tomb)/i,
    education: /\b(school|pupil|student|teacher|education|universit|language|literacy|reading|learning|children|child)/i,
    society: /\b(cities|city|urban|housing|population|migration|workers|workplace|work|transport|traffic|tourism|farming|agricultur|food|water|poverty|economy)/i,
    tech: /\b(ai\b|artificial intelligence|robot|algorithm|internet|digital|computer|smartphone|data|software|chatbot|automat)/i,
    culture: /\b(museum|art\b|artist|architect|music|novel|writer|film|photograph)/i,
  };
  const SECTION_FIT = { science: 3, environment: 3, education: 2.5, 'global-development': 2, society: 1.5, technology: 2, longread: 2.5, books: 1, culture: 0.5, world: 0.5 };
  const SECTION_TOPIC = { science: 'science', environment: 'climate', education: 'education', society: 'society', technology: 'tech', books: 'culture', culture: 'culture' };
  // not passage material: opinion, reviews, sport, live pages, lists, quizzes, letters, politics
  const NO_URL = /\/(commentisfree|sport|football|politics|us-news|film|music|tv-and-radio|stage|games|fashion|food|money|media|crosswords|obituaries)\//;
  const NO_TITLE = /(\breview\b|★|\blive\b|\bquiz\b|\bletters?\b|\bobituary\b|\brecipe|\bpodcast\b|\bhoroscope|what's on|\bthe week in\b|\bpictures?\b|\bphotos?\b|\bas it happened\b|\bmorning mail\b|\bfirst edition\b|\bcountry diary\b|\brankings?\b|\bnewsletter\b|\bbriefing\b|\btrump\b|\bstarmer\b|\belection\b|\bminister\b|\bmps?\b|\bpoll\b)/i;
  const EXPLAINS = /(\bhow\b|\bwhy\b|\bwhat\b|\?|\bthe (science|story|history|secret|rise|fall|end|future|power|art) of\b|\bscientists\b|\bresearch(ers)?\b|\bstudy\b)/i;
  const NEWS = /\b(says?|said|urges?|warns?|calls? for|insiders|government|ministers?|council|court|police|protest|strike|bann?(ed)?|sues?|charged|accused|row)\b/gi;
  const DARK = /\b(rape|abuse|murder|killed|kills|stabb|shooting|suicide|assault|terror)/i;
  const WPM = 220;

  const topicOf = (it, txt) => {
    let best = SECTION_TOPIC[it.section] || '';
    let hits = 0;
    for (const [k, re] of Object.entries(TOPICS)) {
      const n = (txt.match(new RegExp(re.source, 'gi')) || []).length;
      if (n > hits) (hits = n), (best = k);
    }
    return { topic: best || 'society', hits };
  };

  // how hard an article reads, from what the list carries: the length of its words and of its
  // text, and the Long Read being the hardest kind of passage
  function hardness(it, txt) {
    const ws = txt.match(/[A-Za-z][A-Za-z'-]*/g) || [];
    const avg = ws.length ? ws.reduce((n, w) => n + w.length, 0) / ws.length : 5;
    const long = ws.length ? ws.filter((w) => w.length >= 9).length / ws.length : 0.1;
    let h = (avg - 4.6) * 1.4 + long * 6;
    if (it.words) h += Math.min(2, Math.max(-1, (it.words - 1000) / 600));
    if (it.section === 'longread') h += 1.2;
    if (it.section === 'books' || it.section === 'culture') h += 0.4;
    return h;
  }

  // the articles that read like a passage, best first; each with its topic, minutes and hardness
  function rank(items) {
    const out = [];
    // an article already saved knows its length even when the list didn't say
    const had = new Map(state.list.filter((m) => m.url).map((m) => [m.url, m.words]));
    for (let it of items) {
      if (!it.words && had.get(it.url)) it = { ...it, words: had.get(it.url) };
      if (NO_URL.test(it.url) || NO_TITLE.test(it.title)) continue;
      if (it.words && (it.words < 500 || it.words > 4000)) continue;
      const txt = it.title + ' ' + (it.excerpt || '');
      const { topic, hits } = topicOf(it, txt);
      let fit = (SECTION_FIT[it.section] || 1) + Math.min(3, hits) * 1.5;
      if (it.words) fit += it.words >= 700 && it.words <= 1400 ? 2 : it.words <= 2000 ? 0.6 : -1;
      // passages explain (how, why, the story of…); news reports (says, urges, the government…) don't
      if (EXPLAINS.test(txt)) fit += 1.5;
      fit -= Math.min(3, (it.title.match(NEWS) || []).length * 1.5);
      if (/^(i|my|we)\b/i.test(it.title)) fit -= 1.5; // first-person pieces
      if (DARK.test(txt)) fit -= 2; // crime and abuse make poor practice texts
      fit += Math.max(0, 1 - (Date.now() - (it.date || 0)) / (14 * 864e5)); // the newest a little ahead
      if (fit < 2.5) continue;
      out.push({ it, fit, topic, h: hardness(it, txt) });
    }
    return out.sort((a, b) => b.fit - a.fit);
  }

  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  // today's three: from the best fits, split by hardness into thirds, the best of each third,
  // each on a topic of its own; kept for the day
  function daySet(ranked) {
    const n = state.notes;
    const by = new Map(ranked.map((r) => [r.it.url, r]));
    const kept = n.ielts && n.ielts.day === today() ? n.ielts.urls.map((u) => by.get(u)).filter(Boolean) : [];
    if (kept.length === 3) return kept;
    const pool = ranked.slice(0, 30).sort((a, b) => a.h - b.h);
    const set = [];
    const third = Math.max(1, Math.floor(pool.length / 3));
    for (let p = 0; p < 3 && pool.length; p++) {
      const part = pool.slice(p * third, p === 2 ? pool.length : (p + 1) * third).sort((a, b) => b.fit - a.fit);
      const pick = part.find((r) => !set.some((s) => s.topic === r.topic)) || part.find((r) => !set.includes(r));
      if (pick) set.push(pick);
    }
    if (set.length === 3) {
      n.ielts = { day: today(), urls: set.map((r) => r.it.url) };
      save();
    }
    return set;
  }

  const levelOf = (r, ranked) => {
    const hs = ranked.map((x) => x.h).sort((a, b) => a - b);
    const at = hs.findIndex((h) => h >= r.h) / Math.max(1, hs.length - 1);
    return at < 0.34 ? 1 : at < 0.67 ? 2 : 3;
  };

  // the list, drawn with the shelf's own row: row(item, i, num, tags) → html
  function render(items, row, status, q) {
    const ranked = rank(items);
    if (!ranked.length) return `<li class="gd-msg">${esc(t('ie.none'))}</li>`;
    const set = daySet(ranked);
    const tags = (r, lv) => `<p class="ie-tags"><span>${esc(t('ie.t.' + r.topic))}</span>${r.it.words ? `<span>${esc(t('ie.words', r.it.words))}</span>` : ''}<span class="ie-lv l${lv}"><i></i><i></i><i></i>${esc(t('ie.l' + lv))}</span></p>`;
    const match = (r) => !q || (r.it.title + ' ' + r.it.excerpt).toLowerCase().includes(q);
    const show = (r) => state.filter === 'all' || status(r.it) === state.filter;
    let html = '';
    if (set.length) {
      const read = set.filter((r) => status(r.it) === 'done').length;
      const mins = set.every((r) => r.it.words) ? Math.max(5, Math.round(set.reduce((m, r) => m + r.it.words / WPM, 0) / 5) * 5) : 0;
      html += `<li class="ie-head${read === set.length ? ' all' : ''}"><div><h3>${esc(t('ie.today'))}</h3><p>${esc(read === set.length ? t('ie.done') : t('ie.sub', mins, read))}</p></div><span class="ie-dots">${set.map((r) => `<i class="${status(r.it) === 'done' ? 'on' : ''}"></i>`).join('')}</span></li>`;
      html += set.map((r, i) => row(r.it, i, 'P' + (i + 1), tags(r, i + 1))).join('');
    }
    const rest = ranked.filter((r) => !set.includes(r) && match(r) && show(r));
    if (rest.length) html += `<li class="ie-sep">${esc(t('ie.more'))}</li>` + rest.map((r, i) => row(r.it, i + 3, null, tags(r, levelOf(r, ranked)))).join('');
    return html;
  }

  return { render, rank };
})();

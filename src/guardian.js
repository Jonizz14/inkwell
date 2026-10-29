'use strict';
// The Guardian shelf's source: the Guardian's Content API (open-platform.theguardian.com), with
// the reader's own free key from Settings. Its terms allow non-commercial use and ask that no
// article text is kept longer than 24 hours, so a saved article keeps its place in the library,
// with the reader's highlights, words and notes, while its text is fetched again once it is a day
// old (renderer/guardian.js, main.js and web/api.js take care of that). Pictures are shown from
// the Guardian's servers and never stored. Used by main.js and by the web's web/api/guardian.js.
// Only the article body is kept: standfirst, paragraphs and subheadings, without asides, figures
// or pull quotes. The result has the shape of a PDF extraction (extract.mjs).

const API = process.env.GUARDIAN_API || 'https://content.guardianapis.com'; // (another address only in tests)
const DAY = 24 * 3600 * 1000;

// the sections offered; "longread" is the Long Read series, the best fit for a reader
const SECTIONS = ['longread', 'science', 'environment', 'technology', 'culture', 'world', 'books', 'lifeandstyle'];
const WHERE = { longread: { tag: 'news/series/the-long-read' } };

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', mdash: '—', ndash: '–', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”' };
const unescape = (s) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) =>
    e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENT[e.toLowerCase()] ?? m,
  );
const text = (html) => unescape(String(html || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();

// an article, not a video, gallery, podcast, live blog or crossword
const isArticle = (link) => /^https:\/\/www\.theguardian\.com\/[^?#]+\/\d{4}\/[a-z]{3}\/\d{2}\//.test(link) && !/\/(video|gallery|audio|picture|live|crosswords?)\//.test(link);
const isLink = (url) => /^https:\/\/(www\.)?theguardian\.com\/\S+/.test(String(url || ''));

async function api(key, path, params) {
  key = String(key || '').trim();
  if (!key) throw new Error('no-key');
  const q = new URLSearchParams({ ...params, 'api-key': key });
  const r = await fetch(`${API}/${path}?${q}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(20000) });
  if (r.status === 401 || r.status === 403) throw new Error('bad-key');
  if (r.status === 429) throw new Error('limit');
  if (r.status === 404) throw new Error('gone');
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  if (!j.response || j.response.status !== 'ok') throw new Error((j.response && j.response.message) || 'api');
  return j.response;
}

// does a key answer? (Settings → The Guardian → Check)
const test = (key) => api(key, 'search', { 'page-size': 1 }).then(() => ({ ok: true }), (e) => ({ ok: false, err: e.message }));

// "IELTS Reading" (renderer/ielts.js picks from it): the sections passages come from, at once
const IELTS = { section: 'science|environment|education|society|technology|global-development|books|culture' };

// a section's newest articles
async function feed(key, section) {
  const ask = (where, page) => api(key, 'search', { ...where, type: 'article', 'order-by': 'newest', 'page-size': 50, page, 'show-fields': 'trailText,byline,thumbnail,wordcount' });
  // two pages of 50: about a hundred articles a section (one was 30); IELTS takes three of its
  // sections and one of the Long Read
  const asks = section === 'ielts' ? [[IELTS, 1], [IELTS, 2], [IELTS, 3], [WHERE.longread, 1]] : [1, 2].map((page) => [WHERE[section] || { section: SECTIONS.includes(section) ? section : 'news' }, page]);
  const pages = await Promise.all(asks.map(([where, page], i) => ask(where, page).catch((e) => (i === 0 ? Promise.reject(e) : { results: [] }))));
  const seen = new Set();
  return pages.flatMap((res, i) => res.results.map((it) => ({ it, longread: asks[i][0] === WHERE.longread })))
    .filter(({ it }) => isArticle(it.webUrl) && !seen.has(it.webUrl) && seen.add(it.webUrl))
    .map(({ it, longread }) => {
      const f = it.fields || {};
      return { url: it.webUrl.split('?')[0], title: it.webTitle, excerpt: text(f.trailText).slice(0, 260), date: Date.parse(it.webPublicationDate) || 0, by: f.byline || '', img: f.thumbnail || null, words: +f.wordcount || 0, section: longread ? 'longread' : it.sectionId || section };
    });
}

// one article's text, by its link
async function article(key, url) {
  if (!isLink(url)) throw new Error('not-guardian');
  const id = new URL(url).pathname.replace(/^\//, '');
  const res = await api(key, id, { 'show-fields': 'headline,standfirst,byline,body,isPaidContent', 'show-elements': 'image' });
  const c = res.content;
  const f = c.fields || {};
  if (f.isPaidContent === 'true') throw new Error('paid');
  const standfirst = text((String(f.standfirst || '').match(/<p[^>]*>([\s\S]*?)<\/p>/) || [])[1] || f.standfirst);
  const body = String(f.body || '')
    .replace(/<(aside|figure|figcaption|script|style|svg|button|noscript)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<blockquote[^>]*class="[^"]*(pullquote|pull-quote)[^"]*"[\s\S]*?<\/blockquote>/gi, '');
  const blocks = [];
  if (standfirst) blocks.push({ type: 'p', text: standfirst });
  for (const [, tag, inner] of body.matchAll(/<(p|h2|h3|li)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const t = text(inner);
    if (!t || t.length < 2) continue;
    if (/^(Related:|Explore more on these topics|Share|Reuse this content|Sign up to|Photograph:|Listen to our podcasts|Follow the Long Read)/i.test(t)) continue;
    blocks.push({ type: /^h/i.test(tag) ? 'h' : 'p', text: t });
  }
  // the main picture, about 1000px wide, as a link (shown from the Guardian, not kept)
  const main = (c.elements || []).find((e) => e.relation === 'main' && e.type === 'image');
  const assets = ((main && main.assets) || []).filter((a) => a.file && !/\.svg$/.test(a.file));
  assets.sort((a, b) => Math.abs(((a.typeData || {}).width || 0) - 1000) - Math.abs(((b.typeData || {}).width || 0) - 1000));
  const img = (assets[0] && assets[0].file) || null;
  const caption = text(((assets[0] && assets[0].typeData) || {}).caption).replace(/\s*(Photograph|Illustration|Composite):.*$/i, '').trim();
  const words = blocks.reduce((n, b) => n + b.text.split(/\s+/).filter(Boolean).length, 0);
  if (words < 120) throw new Error('no-text');
  const first = standfirst || (blocks.find((b) => b.type === 'p' && b.text.length > 80) || blocks[0]).text;
  return { url: c.webUrl.split('?')[0], title: f.headline || c.webTitle, by: f.byline || '', date: Date.parse(c.webPublicationDate) || 0, section: c.sectionName || '', blocks, words, img, caption, excerpt: first.slice(0, 220), fetchedAt: Date.now() };
}

// a kept text older than a day has to be fetched again (or dropped)
const stale = (fetchedAt) => !fetchedAt || Date.now() - fetchedAt > DAY - 60000;

module.exports = { SECTIONS, isLink, test, feed, article, stale, DAY };

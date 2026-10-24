'use strict';

// Listening (renderer/listen.js): the newest episodes of a show, from YouTube's public feeds
// (a channel's or a playlist's videos.xml, no key needed), and a pasted link turned into a show.
// Feeds are kept for 20 minutes so switching shows back and forth doesn't fetch again.

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';
const cache = new Map();
const FRESH = 20 * 60000;

const unxml = (s) => String(s || '')
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const tag = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? unxml(m[1]).trim() : '';
};

async function get(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en' } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.text();
}

/* YouTube's feeds/videos.xml started answering 404 for every show (Oct 2026). Then the show's own
   page is read instead: its ytInitialData lists the videos as lockupViewModel entries (id, title,
   channel, "106K" views, "2w ago"). The date is only that rough "ago", turned back into a day. */
const feedUrl = (kind, id) => `https://www.youtube.com/feeds/videos.xml?${kind === 'playlist' ? 'playlist_id' : 'channel_id'}=${encodeURIComponent(id)}`;
const pageUrl = (kind, id) => (kind === 'playlist' ? `https://www.youtube.com/playlist?list=${encodeURIComponent(id)}` : `https://www.youtube.com/channel/${encodeURIComponent(id)}/videos`);

function initialData(html) {
  // written as `var ytInitialData = {…};` or `window["ytInitialData"] = {…};`, depending on the page
  const m = html.match(/(?:var ytInitialData|window\[["']ytInitialData["']\])\s*=\s*(\{[\s\S]*?\});\s*<\/script>/);
  if (!m) throw new Error('no ytInitialData');
  return JSON.parse(m[1]);
}
const UNIT = { s: 1, m: 60, h: 3600, d: 86400, w: 604800, mo: 2592000, y: 31536000 };
function agoToDate(txt) {
  const m = String(txt || '').match(/(\d+)\s*(mo|[smhdwy])\w*\s+ago/i);
  return m ? new Date(Date.now() - +m[1] * UNIT[m[2].toLowerCase()] * 1000).toISOString() : '';
}
function count(txt) {
  const m = String(txt || '').replace(/,/g, '').match(/([\d.]+)\s*([KMB])?/i);
  return m ? Math.round(+m[1] * ({ k: 1e3, m: 1e6, b: 1e9 }[(m[2] || '').toLowerCase()] || 1)) : 0;
}
function pageItems(data) {
  const owner = (data.metadata && data.metadata.channelMetadataRenderer && data.metadata.channelMetadataRenderer.title) || '';
  const found = [];
  (function walk(o) {
    if (!o || typeof o !== 'object') return;
    if (o.lockupViewModel) return void found.push(o.lockupViewModel);
    for (const k in o) walk(o[k]);
  })(data.contents);
  const seen = new Set();
  const items = [];
  for (const l of found) {
    if (l.contentType !== 'LOCKUP_CONTENT_TYPE_VIDEO' || !/^[\w-]{11}$/.test(l.contentId || '') || seen.has(l.contentId)) continue;
    seen.add(l.contentId);
    const md = (l.metadata && l.metadata.lockupMetadataViewModel) || {};
    const rows = ((md.metadata && md.metadata.contentMetadataViewModel && md.metadata.contentMetadataViewModel.metadataRows) || []).map((r) => (r.metadataParts || []).map((p) => (p.text && p.text.content) || ''));
    const flat = rows.flat();
    const ago = flat.find((x) => /ago$/i.test(x)) || '';
    const views = flat.find((x) => /^[\d.,]+\s*[KMB]?(\s*views?)?$/i.test(x)) || '';
    const by = rows.length > 1 ? rows[0][0] : owner;
    items.push({ v: l.contentId, title: (md.title && md.title.content) || '', by: by || owner, date: agoToDate(ago), about: '', views: count(views) });
  }
  return items;
}
const pageTitle = (data) =>
  (data.metadata && data.metadata.channelMetadataRenderer && data.metadata.channelMetadataRenderer.title) ||
  (data.metadata && data.metadata.playlistMetadataRenderer && data.metadata.playlistMetadataRenderer.title) ||
  (data.header && data.header.pageHeaderRenderer && data.header.pageHeaderRenderer.pageTitle) || '';

// kind: 'playlist' | 'channel'
async function feed(kind, id) {
  const key = kind + ':' + id;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < FRESH) return hit.items;
  let xml;
  try {
    xml = await get(feedUrl(kind, id));
  } catch {
    const items = pageItems(initialData(await get(pageUrl(kind, id))));
    if (!items.length) throw new Error('no videos');
    cache.set(key, { at: Date.now(), items });
    return items;
  }
  const items = xml.split('<entry>').slice(1).map((e) => {
    const v = tag(e, 'yt:videoId');
    const views = (e.match(/<media:statistics views="(\d+)"/) || [])[1];
    return {
      v,
      title: tag(e, 'title'),
      by: tag(e, 'name'),
      date: tag(e, 'published'),
      about: tag(e, 'media:description').split('\n').find((l) => l.trim()) || '',
      views: views ? +views : 0,
    };
  }).filter((x) => x.v);
  cache.set(key, { at: Date.now(), items });
  return items;
}

// a pasted YouTube link: a playlist, a channel (/channel/UC…, /@handle, /c/…, /user/…) or a video's channel
async function resolve(input) {
  const s = String(input || '').trim();
  let u;
  try {
    u = new URL(/^https?:/i.test(s) ? s : 'https://www.youtube.com/' + s.replace(/^\/+/, ''));
  } catch {
    return null;
  }
  if (!/(^|\.)(youtube\.com|youtu\.be)$/i.test(u.hostname)) return null;
  const list = u.searchParams.get('list');
  if (list && !/^(WL|LL|RD)/.test(list)) {
    return { kind: 'playlist', id: list, title: (await showTitle('playlist', list)) || 'Playlist' };
  }
  const ch = u.pathname.match(/^\/channel\/(UC[\w-]{22})/);
  let id = ch && ch[1];
  if (!id) {
    // anything else (a handle, a video): the page names its channel
    const html = await get(u.href);
    // a channel page names itself as externalId; a video page names its uploader in videoDetails
    id = (html.match(/"externalId":"(UC[\w-]{22})"/) || html.match(/"videoDetails":\{[^}]*?"channelId":"(UC[\w-]{22})"/) || [])[1];
  }
  if (!id) return null;
  return { kind: 'channel', id, title: (await showTitle('channel', id)) || 'YouTube' };
}

// a show's name: from its feed, or from its page when the feed is down
async function showTitle(kind, id) {
  try {
    return tag(await get(feedUrl(kind, id)), 'title');
  } catch {
    return pageTitle(initialData(await get(pageUrl(kind, id))));
  }
}

module.exports = { feed, resolve };

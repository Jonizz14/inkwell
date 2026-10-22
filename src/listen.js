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

// kind: 'playlist' | 'channel'
async function feed(kind, id) {
  const key = kind + ':' + id;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < FRESH) return hit.items;
  const xml = await get(`https://www.youtube.com/feeds/videos.xml?${kind === 'playlist' ? 'playlist_id' : 'channel_id'}=${encodeURIComponent(id)}`);
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
    const xml = await get(`https://www.youtube.com/feeds/videos.xml?playlist_id=${encodeURIComponent(list)}`);
    return { kind: 'playlist', id: list, title: tag(xml, 'title') || 'Playlist' };
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
  const xml = await get(`https://www.youtube.com/feeds/videos.xml?channel_id=${id}`);
  return { kind: 'channel', id, title: tag(xml, 'title') || 'YouTube' };
}

module.exports = { feed, resolve };

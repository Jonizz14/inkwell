'use strict';
// Listening on the web: YouTube's feeds don't answer a browser page (no CORS), so the site asks
// here and this asks YouTube, with the desktop app's own code (src/listen.js, copied beside this
// file by scripts/build-web.mjs).
const listen = require('./_listen.js');

module.exports = async (req, res) => {
  const q = new URL(req.url, 'http://x').searchParams;
  res.setHeader('Cache-Control', 's-maxage=1200, stale-while-revalidate=3600');
  try {
    if (q.has('resolve')) return res.status(200).json(await listen.resolve(q.get('resolve')).catch(() => null));
    const kind = q.get('kind') === 'playlist' ? 'playlist' : 'channel';
    const id = String(q.get('id') || '');
    if (!/^[\w-]{10,64}$/.test(id)) return res.status(400).json({ ok: false, err: 'bad id' });
    res.status(200).json({ ok: true, items: await listen.feed(kind, id) });
  } catch (e) {
    res.status(200).json({ ok: false, err: e.message });
  }
};

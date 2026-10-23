'use strict';
// The Guardian on the web: its Content API doesn't answer a browser page (no CORS), so the site
// asks here, with the reader's own key in the x-guardian-key header (passed on, never kept or
// logged), and this asks the API with the desktop app's own code (src/guardian.js, copied beside
// this file by scripts/build-web.mjs). Nothing is cached: every answer belongs to one key.
const guardian = require('./_guardian.js');

module.exports = async (req, res) => {
  const q = new URL(req.url, 'http://x').searchParams;
  const key = String(req.headers['x-guardian-key'] || '');
  res.setHeader('Cache-Control', 'private, no-store');
  try {
    if (q.has('test')) return res.status(200).json(await guardian.test(key));
    if (q.has('feed')) return res.status(200).json({ ok: true, items: await guardian.feed(key, q.get('feed')) });
    if (q.has('url')) return res.status(200).json({ ok: true, article: await guardian.article(key, q.get('url')) });
    res.status(400).json({ ok: false, err: 'bad request' });
  } catch (e) {
    res.status(200).json({ ok: false, err: e.message });
  }
};

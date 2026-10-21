// Moves an article's highlights, vocabulary and paragraph notes from old
// blocks onto re-extracted blocks. Highlights are stored as paragraph index +
// character offsets, so each one is found again by its text (with a little of
// the text around it to pick the right occurrence), comparing letters and
// digits only so spacing and punctuation fixes don't matter.
// web/migrate.js is this file without the `export`.

function normMap(text) {
  let n = '';
  const at = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (/[\p{L}\p{N}]/u.test(c)) {
      n += c.toLowerCase();
      at.push(i);
    }
  }
  return { n, at };
}
const normOnly = (t) => normMap(t).n;

export function migrateRecord(r, oldBlocks, newBlocks) {
  const lost = [];
  const idx = newBlocks.map((b) => normMap(b.text));
  const rel = (p, len) => (len > 1 ? p / (len - 1) : 0);

  // every place `needle` occurs, as { p, i } in normalized text
  const findAll = (needle) => {
    const out = [];
    if (!needle) return out;
    idx.forEach((m, p) => {
      for (let i = m.n.indexOf(needle); i >= 0; i = m.n.indexOf(needle, i + 1)) out.push({ p, i });
    });
    return out;
  };

  const moved = new Map(); // old hl id -> new { p, s, e } or null
  for (const h of r.hl || []) {
    const ot = (oldBlocks[h.p] && oldBlocks[h.p].text) || '';
    const target = normOnly(h.text || ot.slice(h.s, h.e));
    const before = normOnly(ot.slice(Math.max(0, h.s - 40), h.s));
    const after = normOnly(ot.slice(h.e, h.e + 40));
    let hit = null;
    // widest context first, then narrower, then the word alone
    for (const [pre, post] of [[before, after], ['', after], [before, ''], [before.slice(-12), after.slice(0, 12)], ['', '']]) {
      const all = findAll(pre + target + post);
      if (!all.length) continue;
      // several matches: take the one at about the same place in the article
      const want = rel(h.p, oldBlocks.length);
      const best = all.reduce((a, b) => (Math.abs(rel(b.p, newBlocks.length) - want) < Math.abs(rel(a.p, newBlocks.length) - want) ? b : a));
      hit = { p: best.p, ns: best.i + pre.length };
      break;
    }
    if (!hit || !target) {
      moved.set(h.id, null);
      lost.push(h.text);
      continue;
    }
    const m = idx[hit.p];
    const s = m.at[hit.ns];
    const e = m.at[hit.ns + target.length - 1] + 1;
    moved.set(h.id, { p: hit.p, s, e });
    Object.assign(h, { p: hit.p, s, e, text: newBlocks[hit.p].text.slice(s, e) });
  }
  if (r.hl) r.hl = r.hl.filter((h) => moved.get(h.id) !== null);
  // vocabulary keeps its word and context; it only follows its highlight
  for (const v of r.vocab || []) {
    const to = moved.get(v.hlId);
    v.p = to ? to.p : -1;
  }

  // a note follows its paragraph: matched by the paragraph's opening, its
  // ending, or else by the most shared words
  if (r.notes) {
    const out = {};
    for (const [p, text] of Object.entries(r.notes)) {
      const ot = (oldBlocks[+p] && oldBlocks[+p].text) || '';
      const nt = normOnly(ot);
      let to = -1;
      // the opening is the most reliable (old text may have a jumbled tail)
      for (const probe of [nt.slice(0, 50), nt.slice(0, 20), nt.slice(-50)]) {
        if (probe.length < 8) continue;
        const f = findAll(probe);
        if (f.length) {
          to = f[0].p;
          break;
        }
      }
      if (to < 0) {
        const words = new Set(ot.toLowerCase().match(/\p{L}{4,}/gu) || []);
        let best = 0;
        newBlocks.forEach((b, i) => {
          const w = new Set(b.text.toLowerCase().match(/\p{L}{4,}/gu) || []);
          let common = 0;
          for (const x of words) if (w.has(x)) common++;
          const score = common / (words.size + w.size - common || 1);
          if (score > best) ((best = score), (to = i));
        });
      }
      if (to < 0) to = Math.min(+p, newBlocks.length - 1);
      out[to] = out[to] ? out[to] + '\n' + text : text;
    }
    r.notes = out;
  }
  return { lost };
}

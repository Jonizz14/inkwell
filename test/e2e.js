// Drives the real app headlessly: imports sample PDFs, highlights, adds vocab,
// writes a conclusion, restarts and checks everything persisted. Screenshots go to test/shots.
const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const tmp = process.env.E2E_DATA || path.join(require('node:os').tmpdir(), 'reader-e2e');
app.setPath('userData', tmp);
app.setPath('documents', path.join(tmp, 'docs'));
require('../src/main.js');

const shots = path.join(__dirname, 'shots');
fs.mkdirSync(shots, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const phase = process.env.E2E_PHASE || '1';

app.whenReady().then(async () => {
  await wait(1500);
  const win = BrowserWindow.getAllWindows()[0];
  const js = (code) => win.webContents.executeJavaScript(code);
  const shot = async (name) => fs.writeFileSync(path.join(shots, name + '.png'), (await win.webContents.capturePage()).toPNG());
  win.webContents.on('console-message', (_e, level, msg) => level >= 2 && console.log('renderer:', msg));
  try {
    if (phase === '1') {
      await js(`api.scanInbox()`);
      await js(`loadLibrary()`);
      await wait(500);
      await shot('1-library');
      const id = await js(`state.list[0] && state.list[0].id`);
      await js(`openArticle(${JSON.stringify(id)})`);
      await wait(700);
      await shot('2-reader');
      // select a word in paragraph 2 and add to vocab
      const ok = await js(`(() => {
        const para = [...document.querySelectorAll('#doc div.para')][1];
        const t = para.querySelector('.ptext').firstChild;
        const txt = t.textContent; const m = /\\b[a-z]{7,}\\b/.exec(txt);
        const r = document.createRange(); r.setStart(t, m.index + 2); r.setEnd(t, m.index + 4);
        const s = getSelection(); s.removeAllRanges(); s.addRange(r);
        showPopForSelection(); return m[0];
      })()`);
      await wait(300);
      await shot('3-popover');
      await js(`popAction('word')`);
      await wait(800);
      await js(`document.activeElement.value = 'misol tarjima'; document.activeElement.dispatchEvent(new Event('input', {bubbles:true}))`);
      // highlight a sentence in paragraph 1
      await js(`(() => {
        const t = document.querySelector('#doc div.para .ptext').firstChild;
        const r = document.createRange(); r.setStart(t, 0); r.setEnd(t, 60);
        const s = getSelection(); s.removeAllRanges(); s.addRange(r); showPopForSelection(); popAction('hl');
      })()`);
      await js(`toggleNote(+document.querySelectorAll('#doc div.para')[0].dataset.p)`);
      await wait(500);
      await js(`(() => { const ta = document.querySelector('.note textarea'); ta.value = 'Muallif tejash haqida gapiryapti.'; ta.dispatchEvent(new Event('input', {bubbles:true})); ta.blur(); })()`);
      await wait(600);
      await shot('4-vocab-note');
      console.log('picked word:', ok);
      console.log('EXPORT>>>\n' + (await js(`buildExport('all')`)).slice(0, 900));
      await js(`api.saveNotes(state.notes)`);
      await wait(400);
    } else {
      await js(`openArticle(state.list[0].id)`);
      await wait(800);
      const s = await js(`({ marks: document.querySelectorAll('#doc mark').length, notes: document.querySelectorAll('.note textarea').length, vocab: rec(state.current.id).vocab.map(v => v.word + '=' + v.tr) })`);
      console.log('PERSISTED', JSON.stringify(s));
      await js(`openDrawer()`);
      await wait(600);
      await shot('5-reopen');
      await js(`backToLibrary()`);
      await wait(600);
      await shot('6-library-after');
    }
  } catch (e) {
    console.error('E2E error', e);
  }
  app.exit(0);
});

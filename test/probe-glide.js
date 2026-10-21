// Temporary probe: measures scroll position per frame after pressing ✎.
const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const ud = process.env.E2E_DATA;
app.setPath('userData', ud);
app.setPath('documents', path.join(ud, 'docs'));
require('../src/main.js');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
app.whenReady().then(async () => {
  await wait(1500);
  const win = BrowserWindow.getAllWindows()[0];
  const js = (c) => win.webContents.executeJavaScript(c);
  await js(`loadLibrary()`); await wait(400);
  const id = await js(`state.list[0].id`);
  await js(`openArticle(${JSON.stringify(id)})`); await wait(1200);
  const out = await js(`(async () => {
    const sc = document.querySelector('#scroller'); sc.scrollTop = 0;
    if (${JSON.stringify(!!process.env.CSS)}) { const st = document.createElement('style'); st.textContent = ${JSON.stringify(process.env.CSS||'')}; document.head.append(st); }
    await new Promise(r => setTimeout(r, 300));
    const paras = [...document.querySelectorAll('#doc .para[data-p]')];
    const para = paras.find(p => p.getBoundingClientRect().top > sc.clientHeight * 0.7 && !p.querySelector('.note')) || paras[6];
    const log = []; const t0 = performance.now(); let run = true;
    const tick = () => { log.push([Math.round(performance.now()-t0), Math.round(sc.scrollTop)]); if (run) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    para.querySelector('.ptool').click();
    await new Promise(r => setTimeout(r, 900)); run = false;
    return { n: paras.length, p: para.dataset.p, h: sc.clientHeight, active: document.activeElement.tagName, log };
  })()`);
  const gaps = out.log.slice(1).map((x,i)=>x[0]-out.log[i][0]); console.log(process.env.CSS||'baseline', 'maxgap', Math.max(...gaps), 'frames>20ms', gaps.filter(g=>g>20).length);
  app.exit(0);
});

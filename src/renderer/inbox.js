// Notification centre. Everything the app announces (for now: updates) is also kept here, in
// notes.inbox, newest first; the bell in the library bar shows a dot while something is unread
// and opens the panel. A card opens what it is about ("What's new" for an update).
const Inbox = (() => {
  const TX = {
    uz: { title: 'Bildirishnomalar', clear: 'Tozalash', today: 'Bugun', earlier: 'Oldinroq', empty: "Hozircha bildirishnoma yo'q", bell: 'Bildirishnomalar' },
    en: { title: 'Notifications', clear: 'Clear', today: 'Today', earlier: 'Earlier', empty: 'No notifications yet', bell: 'Notifications' },
    ru: { title: 'Уведомления', clear: 'Очистить', today: 'Сегодня', earlier: 'Ранее', empty: 'Пока уведомлений нет', bell: 'Уведомления' },
  };
  const tx = () => TX[document.documentElement.lang] || TX.uz;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const ICON = {
    update: '<path d="M12 5v13M6 12.5 12 18.5l6-6"/>',
    done: '<path d="M5 12.5 10 17.5 19 7.5"/>',
  };
  const MAX = 50;
  let bell, panel, scrim;
  const list = () => (state.notes.inbox ||= []);

  function setup() {
    if (bell) return;
    bell = document.createElement('button');
    bell.className = 'btn ghost icon ib-bell';
    bell.id = 'btn-inbox-bell';
    bell.title = tx().bell;
    bell.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 11.5V7a4 4 0 0 1 8 0v4.5l1 1.2H3z"/><path d="M6.6 14.2a1.5 1.5 0 0 0 2.8 0"/></svg><i class="ib-dot"></i>';
    document.querySelector('#btn-music').after(bell);
    bell.onclick = () => (panel.classList.contains('open') ? close() : open());

    scrim = document.createElement('div');
    scrim.className = 'ib-scrim';
    scrim.onclick = close;
    panel = document.createElement('aside');
    panel.className = 'ib-panel';
    panel.innerHTML = '<div class="ib-head"><h2></h2><button class="ib-clear" type="button"></button></div><div class="ib-list"></div>';
    panel.querySelector('.ib-clear').onclick = () => {
      state.notes.inbox = [];
      save();
      render();
    };
    document.body.append(scrim, panel);
    document.addEventListener('keydown', (e) => e.key === 'Escape' && panel.classList.contains('open') && close());
    dot();
  }

  const dot = () => bell && bell.classList.toggle('unread', list().some((n) => !n.read));

  function when(at) {
    const d = new Date(at);
    const now = new Date();
    const same = d.toDateString() === now.toDateString();
    return same ? d.toLocaleTimeString(document.documentElement.lang || 'uz', { hour: '2-digit', minute: '2-digit' }) : dateFmt({ day: 'numeric', month: 'short' }).format(d);
  }

  function render() {
    const t = tx();
    panel.querySelector('h2').textContent = t.title;
    const clr = panel.querySelector('.ib-clear');
    clr.textContent = t.clear;
    clr.hidden = !list().length;
    const box = panel.querySelector('.ib-list');
    if (!list().length) {
      box.innerHTML = `<div class="ib-empty" style="--k:0">${esc(t.empty)}</div>`;
      return;
    }
    const today = new Date().toDateString();
    let k = 0, group = '';
    box.innerHTML = list().map((n, i) => {
      const g = new Date(n.at).toDateString() === today ? t.today : t.earlier;
      const head = g !== group ? `<div class="ib-group" style="--k:${k++}">${esc((group = g))}</div>` : '';
      return `${head}<button class="ib-card" type="button" data-i="${i}" style="--k:${k++}">
        <span class="ib-icon"><img src="icon.png" alt="" /><span class="ib-badge"><svg viewBox="0 0 24 24">${ICON[n.icon] || ICON.update}</svg></span></span>
        <span class="ib-body"><span class="ib-top"><b>${esc(n.title)}</b><time>${esc(when(n.at))}</time>${n.read ? '' : '<i class="ib-new"></i>'}</span><span class="ib-sub">${esc(n.sub || '')}</span></span>
      </button>`;
    }).join('');
    box.querySelectorAll('.ib-card').forEach((c) => (c.onclick = () => act(list()[+c.dataset.i])));
  }

  function act(n) {
    if (!n) return;
    close();
    if (n.kind === 'update' && typeof UpdateUI !== 'undefined') setTimeout(() => UpdateUI.openPage(n.v), 200);
  }

  function open() {
    setup();
    render();
    scrim.classList.add('open');
    requestAnimationFrame(() => panel.classList.add('open'));
    if (typeof Haptic !== 'undefined' && Haptic.align) Haptic.align();
    // seen once the panel is open; the dots go on the next opening
    if (list().some((n) => !n.read)) {
      list().forEach((n) => (n.read = true));
      save();
      dot();
    }
  }
  function close() {
    if (!panel) return;
    panel.classList.remove('open');
    scrim.classList.remove('open');
  }

  // adds (or refreshes, by id) a notification at the top
  function add(n) {
    setup();
    const all = list();
    const i = all.findIndex((x) => x.id === n.id);
    if (i >= 0) all.splice(i, 1);
    all.unshift({ at: Date.now(), read: false, ...n });
    all.length = Math.min(all.length, MAX);
    save();
    dot();
    if (panel.classList.contains('open')) render();
  }

  return { setup, add, open, close };
})();

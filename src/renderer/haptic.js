// Trackpad taps (Mac only, main.js → tools/haptic.swift). macOS plays them only while a finger
// rests on the trackpad, so they mark things the finger is doing: a paragraph or a bar passed,
// a slider step, a swipe crossing its line, the header snapping. Settings → Vibration turns them off.
const Haptic = (() => {
  const api = window.api || {};
  let last = 0;
  const tap = (k) => () => {
    if (!api.haptic || (state.notes && state.notes.settings && state.notes.settings.haptic === 'off')) return;
    const now = performance.now();
    if (now - last < 40) return; // a fast drag would turn into a buzz
    last = now;
    api.haptic(k);
  };
  return { align: tap(0), level: tap(1), generic: tap(2) };
})();

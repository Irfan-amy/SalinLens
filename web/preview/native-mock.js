// Web stand-in for the Kotlin SalinNative module. Runs inside the Lynx web background worker.
// Every call answers with a JSON string, like the real module (see src/native.ts).
const QUAD = [0.1417, 0.1437, 0.8417, 0.1187, 0.8833, 0.8562, 0.1083, 0.8875]; // paper corners in fixtures/doc.jpg
const DOC = '/fixtures/doc.jpg';        // raw camera photo (desk around the paper)
const PAGE = '/fixtures/page.jpg';      // what the real app returns after warp: the deskewed page only
const THUMB = '/fixtures/page_thumb.jpg';
const now = Date.now();
const q = new URL(import.meta.url).searchParams; // ?w=&h= come from the host page; test flags: slow=ms, fail=a,b, denied=1, empty=1, many=N
const SLOW = +q.get('slow') || 0;
const FAIL = new Set((q.get('fail') || '').split(',').filter(Boolean));
const NAMES = ['Service Agreement — Maple Ridge Marketing final signed copy', 'Receipt', 'Scan Nov 18'];
const seed = (q.get('empty') ? [] : Array.from({ length: +q.get('many') || 3 }, (_, i) => [NAMES[i] || `Scan ${i + 1} 📄 ${'x'.repeat(i % 5)}`, now - 3600e3 * (i * 20 + 1)]))
.map(([name, ts], i) => ({
  id: 's' + i, name, ts, w: 1200, h: 1600, thumb: THUMB,
  files: [{ fmt: 'pdf', path: PAGE, size: 5.5e6 }, ...(i === 0 ? [{ fmt: 'jpg', path: PAGE, size: 480e3 }, { fmt: 'png', path: PAGE, size: 2.1e6 }] : [])],
}));

export default function () {
  const items = [...seed];
  const ok = (cb, o = {}) => cb(JSON.stringify({ ok: true, ...o }));
  const base = {
    // (module is registered as NativeModules.SalinNative by the lynx-view nativeModulesMap key)
      env: (cb) => ok(cb, { top: 28, bottom: 16, name: 'Scan Nov 20', w: +q.get('w') || 360, h: +q.get('h') || 640, web: true }),
      cameraPermission: (_ask, cb) => ok(cb, { granted: !q.get('denied') }),
      capture: (cb) => ok(cb, { path: DOC }),
      pickImage: (cb) => ok(cb, { path: DOC }),
      detect: (_p, cb) => ok(cb, { quad: QUAD, conf: 0.9, found: true, w: 1200, h: 1600 }),
      rotate: (p, q, cb) => ok(cb, { path: p, quad: JSON.parse(q) }),
      preview: (_p, _q, _m, cb) => ok(cb, { path: PAGE, w: 1000, h: 1333 }),
      export: (json, cb) => {
        const o = JSON.parse(json); const n = o.pages.length;
        const files = o.formats.flatMap((f) => f === 'pdf' ? [{ fmt: 'pdf', path: PAGE, size: 5.5e6 * n, page: 0 }]
          : o.pages.map((_, i) => ({ fmt: f, path: PAGE, size: f === 'jpg' ? 480e3 : 2.1e6, page: i + 1 })));
        const item = { id: 'n' + items.length, name: o.name || 'Scan', ts: Date.now(), w: 1200, h: 1600, pages: n, thumb: THUMB, files };
        items.unshift(item); ok(cb, { item });
      },
      gallery: (cb) => ok(cb, { items }),
      remove: (id, cb) => { const i = items.findIndex((x) => x.id === id); if (i >= 0) items.splice(i, 1); ok(cb); },
      targets: (cb) => ok(cb, { targets: { whatsapp: 'com.whatsapp', tiktok: 'com.zhiliaoapp.musically', instagram: 'com.instagram.android', telegram: null, facebook: 'com.facebook.katana', messenger: 'com.facebook.orca', x: null, snapchat: null, discord: null, gmail: 'com.google.android.gm', signal: null, pinterest: null, reddit: null, threads: null, line: null, viber: null } }),
      saveFile: (p, cb) => ok(cb, { count: JSON.parse(p).length }),
      share: (_p, _pkg, cb) => ok(cb),
      haptic: () => {},
      exit: () => {},
  };
  // every call can be delayed (slow=) or made to fail (fail=name,name) so the UI's busy / error paths get exercised
  const api = {};
  for (const k of Object.keys(base)) {
    api[k] = (k === 'haptic') ? base[k] : (k === 'exit') ? () => { fetch(q.get('o') + '/__exit?rid=' + (q.get('rid') || '')).catch(() => {}); } : (...a) => {
      const cb = a.pop(); const run = () => (FAIL.has(k) ? cb(JSON.stringify({ ok: false, error: 'mock failure: ' + k })) : base[k](...a, cb));
      SLOW ? setTimeout(run, SLOW) : run();
    };
  }
  return api;
}

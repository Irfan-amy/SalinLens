// UI stress test: drives the REAL Lynx bundle in headless Chromium through long, rapid and failing user flows and, after every
// step, asserts invariants (nothing invisible blocks a button, no duplicate screens, nothing stuck busy, no clipped/overlapping text,
// no JS errors). Natives are the web mock (preview/native-mock.js) with slow= / fail= flags.
//   pnpm stress                         -> build + run everything
//   node preview/stress.mjs [--only 360x780] [--scenario rapid] [--shots]
import { chromium } from 'playwright-core';
import { serve, stats } from './server.mjs';
import { inspect, tappables } from './inspect.mjs';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, 'out', 'stress'); fs.mkdirSync(outDir, { recursive: true });
const arg = (k) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : null);
const SIZES = [[360, 780], [320, 568], [360, 640], [412, 915]];
const onlySize = arg('--only'), onlyScn = arg('--scenario'), shots = process.argv.includes('--shots');
const cache = path.join(os.homedir(), 'Library/Caches/ms-playwright');
const exe = process.env.CHROME || path.join(cache, fs.readdirSync(cache).filter((d) => d.startsWith('chromium_headless_shell-')).sort().pop(), 'chrome-headless-shell-mac-arm64/chrome-headless-shell');
const { srv, port } = await serve(0);
const browser = await chromium.launch({ executablePath: exe });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- finders that run in the page (shadow-DOM aware, scoped to the top screen) ----
const INIT = () => {
  const deep = (sel) => { const out = []; (function walk(r) { for (const el of r.querySelectorAll(sel)) out.push(el); for (const el of r.querySelectorAll('*')) if (el.shadowRoot) walk(el.shadowRoot); })(document); return out; };
  const shown = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const rootEl = () => deep('.bg-dawn')[0];
  const live = () => [...(rootEl()?.children || [])].filter((c) => !c.className.includes('a-leave'));
  const top = () => live().slice(-1)[0];
  const pressOf = (el) => el.closest('.press') || el;
  const matches = (el, q) => { const t = (el.textContent || '').trim(); return q instanceof RegExp ? q.test(t) : t === q; };
  window.__s = {
    deep, depth: () => live().length,
    texts: () => deep('x-text').filter((e) => top()?.contains(e) && shown(e)).map((e) => e.textContent.trim()).filter(Boolean),
    text: (q, nth = 0, scope = 'top') => { const re = q.re ? new RegExp(q.re) : q; const t = scope === 'top' ? top() : document; const l = deep('x-text').filter((e) => t.contains(e) && shown(e) && matches(e, re)); return l[nth] ? pressOf(l[nth]) : null; },
    icon: (name, nth = 0) => { const l = deep('salin-icon').filter((e) => top()?.contains(e) && shown(e) && e.getAttribute('name') === name); return l[nth] ? pressOf(l[nth]) : null; },
    cls: (c, nth = 0) => { const l = deep('.' + c).filter((e) => top()?.contains(e) && shown(e)); return l[nth] ? pressOf(l[nth]) : null; },
    thumb: (n) => { const sv = deep('scroll-view').find((s) => live()[0]?.contains(s)); const l = sv ? [...sv.querySelectorAll('.press')] : []; return l[n - 1] || null; },
    setInput: (v) => { const el = deep('x-input')[0]; const i = el?.shadowRoot?.querySelector('input') || el; if (!i) return false; i.value = v; i.dispatchEvent(new Event('input', { bubbles: true, composed: true })); return true; },
  };
};

class T {
  constructor(page, vp, scn) { this.page = page; this.vp = vp; this.scn = scn; this.problems = []; this.errors = []; this.n = 0; this.log = []; }
  fail(step, kind, what) { this.problems.push({ vp: this.vp, scn: this.scn, step, kind, what }); }
  async open(q = '') {
    const [w, h] = this.vp.split('x');
    await this.page.goto(`http://127.0.0.1:${port}/?w=${w}&h=${h}&rid=${this.vp}${q}`);
    await this.page.waitForFunction(() => document.querySelector('#lv')?.shadowRoot?.querySelector('x-view'), null, { timeout: 15000 });
    await sleep(1700);
  }
  emit(n, ...a) { return this.page.evaluate(([n, a]) => window.__lv.sendGlobalEvent(n, a), [n, a]); }
  async handle(fn, ...a) { return this.page.evaluateHandle(([f, a]) => window.__s[f](...a), [fn, a]); }
  /** tap like a finger: click the centre of whatever finder returns, at page coordinates (so whatever is on top gets it) */
  async tap(fn, ...a) {
    const h = await this.handle(fn, ...a); const el = h.asElement();
    if (!el) { this.fail(this.last || '?', 'missing', `${fn}(${JSON.stringify(a)}) not found on top screen`); return false; }
    await el.evaluate((e) => e.scrollIntoView({ block: 'nearest', inline: 'nearest' })).catch(() => {});
    const b = await el.boundingBox(); if (!b) { this.fail(this.last || '?', 'missing', `${fn} has no box`); return false; }
    await this.page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); return true;
  }
  tapText(t, nth = 0) { return this.tap('text', t instanceof RegExp ? { re: t.source } : t, nth); }
  tapIcon(name, nth = 0) { return this.tap('icon', name, nth); }
  async has(re) { const ts = await this.page.evaluate(() => window.__s.texts()); return ts.some((t) => (re instanceof RegExp ? re.test(t) : t === re)); }
  async depth() { return this.page.evaluate(() => window.__s.depth()); }
  /** settle, then assert every invariant. expect: {depth, has:[re], not:[re], idle} */
  async check(step, ex = {}) {
    this.last = step; this.n++; await sleep(ex.wait ?? 650);
    const t = await this.page.evaluate(tappables, '#frame');
    for (const b of t.blocked) this.fail(step, 'blocked', `${b.what} is covered by ${b.by}`);
    if (ex.depth !== undefined && t.depth - 1 !== ex.depth) this.fail(step, 'depth', `expected ${ex.depth} screen(s) above the camera, found ${t.depth - 1}`);
    if (ex.idle !== false && t.spinning) this.fail(step, 'stuck', `${t.spinning} spinner(s) still spinning`);
    for (const re of ex.has || []) if (!(await this.has(re))) this.fail(step, 'expect', `text ${re} not on screen`);
    for (const re of ex.not || []) if (await this.has(re)) this.fail(step, 'expect', `text ${re} should not be on screen`);
    if (ex.layout !== false) { const iss = await this.page.evaluate(inspect, '#frame'); for (const i of iss) if (i.kind !== 'ellipsis') this.fail(step, i.kind, `"${i.text}" ${i.note}`); }
    while (this.errors.length) this.fail(step, 'js-error', this.errors.shift());
    if (shots || this.problems.some((p) => p.step === step)) await this.page.locator('#frame').screenshot({ path: path.join(outDir, `${this.vp}-${this.scn}-${String(this.n).padStart(3, '0')}-${step.replace(/\W+/g, '_').slice(0, 40)}.png`) }).catch(() => {});
  }
  async addPages(n, gap = 330) { for (let i = 0; i < n; i++) { await this.emit('salinOpenImage', '/fixtures/doc.jpg'); await sleep(gap); } }
  async back() { await this.emit('salinBack'); }
  async wheel(x, y, dx, dy = 0) { await this.page.mouse.move(x, y); await this.page.mouse.wheel(dx, dy); }
  /** finger drag with intermediate moves */
  async drag(x0, y0, x1, y1, steps = 8) {
    // real touch events through CDP: web-core only turns touches (not mouse drags) into bindtouchstart/move/end
    const cdp = this.cdp ??= await this.page.context().newCDPSession(this.page); const tp = (x, y) => [{ x, y, id: 1 }];
    const send = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
    await send('touchStart', tp(x0, y0));
    for (let i = 1; i <= steps; i++) { await send('touchMove', tp(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps)); await sleep(16); }
    await send('touchEnd', []);
  }
  /** page the carousel (whatever 'Page x of n' says) by swiping; returns the page number now shown */
  async pageNo() { const ts = await this.page.evaluate(() => window.__s.texts()); const m = ts.map((t) => /^Page (\d+) of (\d+)$/.exec(t)).find(Boolean); return m ? +m[1] : 0; }
}

// ---------------------------------------------------------------- scenarios
const BRANDS = ['WhatsApp', 'Instagram', 'TikTok', 'Telegram', 'Facebook', 'Messenger', 'X', 'Snapchat', 'Discord', 'Gmail', 'Signal', 'Pinterest', 'Reddit', 'Threads', 'LINE', 'Viber'];
const FILTERS = ['Magic', 'Scanner', 'Lighten', 'Crisp', 'Eco', 'Gray', 'B&W', 'Original', 'Auto'];

async function saveFlow(t, tag, finish) {
  await t.tapText('Save'); await sleep(1900); await t.check(`${tag} saved`, { depth: 1, has: [/^Saved!/] });
  {
    const pg = await t.pageNo();
    if (pg) { const mx = Math.round(+t.vp.split('x')[0] / 2), my = await t.page.evaluate(() => { const e = window.__s.deep('salin-photo').find((x) => x.getBoundingClientRect().width > 20 && x.getBoundingClientRect().height > 20); const b = e?.getBoundingClientRect(); return b ? Math.round(b.top + b.height / 2) : 200; });
      await t.drag(mx + 80, my, mx - 80, my); await sleep(450);
      if ((await t.pageNo()) !== 2) t.fail(`${tag} saved carousel`, 'swipe', `Saved hero should swipe to page 2, got ${await t.pageNo()}`);
      await t.check(`${tag} saved carousel`, { depth: 1, has: [/Page 2 of \d+/] }); }
    else if (!tag.endsWith('single')) t.fail(`${tag} saved`, 'expect', 'multi-page scan: Saved screen shows no "Page x of n" carousel');
  }
  for (const f of ['JPG', 'PNG', 'PDF']) { await t.tapText(f); await t.check(`${tag} pick ${f}`, { depth: 1 }); }
  await t.tapText('Save file'); await t.check(`${tag} save file`, { depth: 1, has: [/Saved .*SalinLens/] });
  for (const b of BRANDS) { await t.tapText(b); await t.check(`${tag} share ${b}`, { depth: 1, wait: 250 }); }
  await t.tapText('More'); await t.check(`${tag} share More`, { depth: 1, wait: 250 });
  if (finish === 'scan-another') await t.tapText('Scan another');
  else if (finish === 'close') await t.tapIcon('close');
  else await t.back();
  await t.check(`${tag} back at camera via ${finish}`, { depth: 0, not: [/^Continue/] });
}

const SCENARIOS = {
  // the user's report: many captures -> adjust -> save -> save file -> back to camera, buttons must still work, repeated
  async 'full-cycle'(t, vp) {
    await t.open();
    const cycles = vp === '360x780' ? 3 : 1;
    for (let c = 1; c <= cycles; c++) {
      const tag = `c${c}`; await t.check(`${tag} camera empty`, { depth: 0 });
      await t.addPages(6); await t.check(`${tag} six pages`, { depth: 0, has: [/^Continue · 6 pages/] });
      for (let n = 1; n <= 6; n++) { await t.tap('thumb', n); await t.check(`${tag} adjust page ${n}`, { depth: 0, wait: 300 }); }
      for (const l of ['Rotate', 'Rotate', 'Auto-fit', 'Full page', 'Reset']) { await t.tapText(l); await t.check(`${tag} tool ${l}`, { depth: 0, wait: 350 }); }
      await t.tapIcon('trash'); await t.check(`${tag} delete page`, { depth: 0, has: [/^Continue · 5 pages/] });
      await t.tapIcon('plus'); await t.check(`${tag} camera mode`, { depth: 0 });
      for (let i = 0; i < 2; i++) { await t.tap('cls', 'shutter-core'); await sleep(700); }
      await t.check(`${tag} two captures`, { depth: 0, has: [/^Continue · 7 pages/] });
      await t.tapText('Gallery'); await sleep(500); await t.check(`${tag} import from gallery`, { depth: 0, has: [/^Continue · 8 pages/] });
      await t.tapText(/^Continue/); await t.check(`${tag} save as`, { depth: 1, has: ['Save as', /Page 1 of 8/] });
      const mx = Math.round(+vp.split('x')[0] / 2);
      for (let i = 0; i < 4; i++) { await t.drag(mx + 90, 220, mx - 90, 220); await sleep(450); }
      await t.check(`${tag} carousel swiped`, { depth: 1, has: [/Page \d of 8/] });
      if ((await t.pageNo()) !== 5) t.fail(`${tag} carousel swiped`, 'swipe', `4 left-swipes should land on page 5, got ${await t.pageNo()}`);
      await t.drag(mx - 90, 220, mx + 90, 220); await sleep(450);
      if ((await t.pageNo()) !== 4) t.fail(`${tag} carousel swiped back`, 'swipe', `right-swipe should land on page 4, got ${await t.pageNo()}`);
      await t.drag(mx - 90, 220, mx + 90, 220, 3); await t.drag(mx - 90, 220, mx + 90, 220, 3); await t.drag(mx - 90, 220, mx + 90, 220, 3); await t.drag(mx - 90, 220, mx + 90, 220, 3); await t.drag(mx - 90, 220, mx + 90, 220, 3); await sleep(450);
      if ((await t.pageNo()) !== 1) t.fail(`${tag} carousel first page`, 'swipe', `swiping right at the first page must stop at page 1, got ${await t.pageNo()}`);
      for (const f of FILTERS) { await t.tapText(f); await t.check(`${tag} filter ${f}`, { depth: 1, wait: 300 }); }
      await t.page.evaluate((v) => window.__s.setInput(v), c === 2 ? 'A'.repeat(120) : c === 3 ? 'my/scan: "q"?*' : 'Invoice');
      await t.check(`${tag} name typed`, { depth: 1 });
      await saveFlow(t, tag, ['scan-another', 'close', 'hwback'][(c - 1) % 3]);
      await t.tapIcon('layers'); await t.check(`${tag} your saved`, { depth: 1, has: ['Your Saved'] });
      await t.tap('cls', 'card'); await t.check(`${tag} open item`, { depth: 2 });
      await t.tapText('Share'); await t.check(`${tag} item share`, { depth: 2, wait: 300 });
      await t.tapIcon('back'); await sleep(450); await t.tapIcon('back'); await t.check(`${tag} back to camera`, { depth: 0 });
    }
  },

  // hardware back everywhere, and the back arrow double-tap (must never close the app)
  async 'exit-paths'(t) {
    await t.open(); const ex = () => stats.exits[t.vp] || 0; let e0 = ex();
    await t.addPages(2); await t.back(); await t.check('back from adjust -> camera mode', { depth: 0, has: [/^Continue/] });
    await t.back(); await t.check('back with pages -> warns', { depth: 0, has: [/discard/] });
    if (ex() !== e0) t.fail('back with pages -> warns', 'exit', 'app closed on the first back press');
    await t.tapText(/^Continue/); await t.check('to export', { depth: 1 });
    await t.back(); await t.check('hw back from export', { depth: 0, has: [/^Continue · 2 pages/] });
    await t.tapText(/^Continue/); await t.check('to export again', { depth: 1 });
    await t.tapIcon('back'); await t.check('arrow back from export', { depth: 0, has: [/^Continue · 2 pages/] });
    await t.tapIcon('layers'); await t.check('gallery', { depth: 1 });
    await t.back(); await t.check('hw back from gallery', { depth: 0 });
    await t.tapIcon('layers'); await sleep(500); await t.tapIcon('back'); await t.page.mouse.click(30, 60).catch(() => {}); await t.check('gallery arrow tapped twice fast', { depth: 0 });
    // double-tap the arrow in a pushed screen with NO session pages: the second tap used to hit the root and call exit()
    await t.emit('salinBack'); await t.emit('salinBack'); await sleep(2700); e0 = ex();
    await t.open('&empty=1'); await t.tapIcon('layers'); await sleep(500);
    const h = await t.handle('icon', 'back'); const b = await h.asElement().boundingBox();
    await t.page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); await t.page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); await sleep(900);
    if (ex() !== e0) t.fail('double-tap back arrow', 'exit', 'double-tapping the back arrow closed the app');
    await t.check('after double back', { depth: 0 });
    await t.emit('salinBack'); await sleep(500);
    if (ex() !== e0 + 1) t.fail('hw back at empty root', 'exit', 'back at the root with no pages should leave the app exactly once');
  },

  // fast repeated taps must not stack duplicate screens or duplicate saves
  async 'rapid'(t) {
    await t.open(); await t.addPages(2);
    const burst = async (fn, n = 4) => { for (let i = 0; i < n; i++) { const h = await t.handle(...fn); const el = h.asElement(); if (!el) break; const b = await el.boundingBox(); if (b) await t.page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); await sleep(40); } };
    await burst(['text', { re: '^Continue' }]); await t.check('Continue x4', { depth: 1, has: ['Save as'] });
    await t.tapIcon('back'); await t.check('back', { depth: 0 });
    await burst(['icon', 'layers']); await t.check('Your Saved x4', { depth: 1, has: ['Your Saved'] });
    await t.tapIcon('back'); await t.check('back 2', { depth: 0 });
    await t.tapText(/^Continue/); await sleep(600);
    await burst(['text', 'Save'], 4); await sleep(2200); await t.check('Save x4', { depth: 1, has: [/^Saved!/] });
    await t.tapText('Scan another'); await t.check('scan another', { depth: 0 });
    await t.tapIcon('layers'); await sleep(500);
    const cards = await t.page.evaluate(() => window.__s.deep('.card').filter((e) => e.classList.contains('press')).length);
    if (cards !== 4) t.fail('Save x4', 'duplicate', `4 quick Save taps created ${cards - 3} scans (expected 1)`);
    await t.tapIcon('back');
    await burst(['icon', 'flashOff'], 6); await t.check('torch x6', { depth: 0 });
    for (let i = 0; i < 5; i++) { await t.tap('cls', 'shutter-core'); await sleep(35); } await sleep(900); await t.check('shutter x5', { depth: 0 });
    for (let i = 0; i < 12; i++) { await t.tap('thumb', 1 + (i % 3)); await sleep(30); } await t.check('thumbs x12', { depth: 0 });
    for (const l of ['Rotate', 'Auto-fit', 'Full page', 'Reset']) await burst(['text', l], 3);
    await t.check('tools burst', { depth: 0 });
  },

  // natives failing one by one: the UI must report it, stay usable, never hang on a spinner
  async 'failures'(t) {
    const run = async (flag, fn) => { await t.open(`&fail=${flag}`); await fn(); };
    await run('detect', async () => { await t.tapText('Gallery'); await sleep(500); await t.check('detect fails (import)', { depth: 0, not: [/^Continue/] }); await t.tapText('Gallery'); await t.check('import retry', { depth: 0 }); });
    await run('capture', async () => { await t.tap('cls', 'shutter-core'); await sleep(500); await t.check('capture fails', { depth: 0, has: [/Capture failed/] }); await t.tap('cls', 'shutter-core'); await sleep(500); await t.check('capture retry', { depth: 0 }); });
    await run('pickImage', async () => { await t.tapText('Gallery'); await t.check('pick fails', { depth: 0, has: [/Could not import/] }); });
    await run('cameraPermission', async () => { await t.check('permission call fails', { depth: 0 }); await t.tapIcon('layers'); await t.check('open gallery without camera', { depth: 1 }); });
    await run('rotate', async () => { await t.addPages(1); await t.tapText('Rotate'); await t.check('rotate fails', { depth: 0 }); await t.tapText('Rotate'); await t.check('rotate retry', { depth: 0 }); });
    await run('preview', async () => { await t.addPages(2); await t.tapText(/^Continue/); await t.check('preview fails', { depth: 1, layout: false }); await t.tapText('Save'); await sleep(1800); await t.check('saved without previews', { depth: 1, has: [/^Saved!/] }); });
    await run('export', async () => {
      await t.addPages(1); await t.tapText(/^Continue/); await sleep(500); await t.tapText('Save'); await sleep(900);
      await t.check('export fails', { depth: 1, has: [/mock failure: export/, 'Save'], not: [/Saving/] });
      await t.tapText('Save'); await sleep(900); await t.check('export retry', { depth: 1, has: ['Save'] });
    });
    await run('saveFile', async () => { await t.open(); await t.tapIcon('layers'); await sleep(500); await t.tap('cls', 'card'); await sleep(500); await t.tapText('Save file'); await t.check('save file (ok baseline)', { depth: 2 }); });
    await t.open('&fail=saveFile'); await t.tapIcon('layers'); await sleep(500); await t.tap('cls', 'card'); await sleep(500); await t.tapText('Save file'); await t.check('saveFile fails', { depth: 2, has: [/mock failure: saveFile/] });
    await t.open('&fail=share'); await t.tapIcon('layers'); await sleep(500); await t.tap('cls', 'card'); await sleep(500); await t.tapText('More'); await t.check('share fails', { depth: 2, has: [/Could not share/] });
    await t.open('&fail=targets'); await t.tapIcon('layers'); await sleep(500); await t.tap('cls', 'card'); await sleep(500); await t.check('targets fails', { depth: 2 });
    await t.open('&fail=gallery'); await t.tapIcon('layers'); await t.check('gallery fails', { depth: 1 });
    await t.open('&fail=remove'); await t.tapIcon('layers'); await sleep(500); await t.tap('cls', 'card'); await sleep(500); await t.tapIcon('trash'); await t.check('remove fails', { depth: 1 });
  },

  // slow natives: busy states, taps while busy, leaving mid-save
  async 'slow'(t) {
    await t.open('&slow=900');
    await t.tapText('Gallery'); await sleep(150); await t.check('importing (busy)', { depth: 0, idle: false, layout: false, wait: 100 });
    await t.tap('cls', 'shutter-core'); await t.tapText('Gallery'); await sleep(2600); await t.check('imports settled', { depth: 0 });
    await t.tapText(/^Continue/); await sleep(300); await t.check('export with slow previews', { depth: 1, idle: false, layout: false });
    await t.tapText('Save'); await sleep(200); await t.check('saving...', { depth: 1, idle: false, layout: false, has: [/Saving/], wait: 50 });
    await sleep(2600); await t.check('saved (slow)', { depth: 1, has: [/^Saved!/] });
    await t.tapText('Scan another'); await t.check('scan another (slow)', { depth: 0 });
    // leave while a save is still running: the result must not hijack navigation afterwards
    await t.addPages(1); await sleep(1500); await t.tapText(/^Continue/); await sleep(400); await t.tapText('Save'); await sleep(250); await t.tapIcon('back'); await sleep(2800);
    await t.check('left while saving', { depth: 0, not: [/^Saved!/] });
  },

  // camera unavailable / permission denied: top bar + import must keep working
  async 'camera-states'(t) {
    for (const q of ['&cam=bad', '&denied=1']) {
      await t.open(q); await t.check(`${q} initial`, { depth: 0 });
      await t.tapIcon('layers'); await t.check(`${q} your saved`, { depth: 1, has: ['Your Saved'] }); await t.tapIcon('back'); await t.check(`${q} back`, { depth: 0 });
      await t.tapIcon('flashOff'); await t.check(`${q} torch`, { depth: 0 });
      await t.tapText(/Try again|Allow camera/); await t.check(`${q} retry button`, { depth: 0 });
      await t.tapText('Gallery'); await sleep(500); await t.check(`${q} import`, { depth: 0, has: [/^Continue/] });
      await t.tapText(/^Continue/); await t.check(`${q} to export`, { depth: 1 }); await t.tapIcon('back'); await t.check(`${q} back to adjust`, { depth: 0 });
      await t.tapIcon('plus'); await t.check(`${q} + while camera is unavailable`, { depth: 0 });
    }
  },

  // gallery with many / zero scans, delete, reopen
  async 'gallery'(t) {
    await t.open('&many=14'); await t.tapIcon('layers'); await t.check('14 scans', { depth: 1 });
    for (let i = 0; i < 4; i++) { await t.wheel(180, 400, 0, 700); await sleep(350); await t.check(`scrolled ${i + 1}`, { depth: 1, wait: 200 }); }
    await t.tap('cls', 'card', 3); await t.check('open a card', { depth: 2 });
    await t.tapIcon('trash'); await t.check('delete from item', { depth: 1, has: ['Your Saved'] });
    await t.open('&empty=1'); await t.tapIcon('layers'); await t.check('empty gallery', { depth: 1, has: ['Nothing here yet'] });
    await t.tapText('Scan your first page'); await t.check('empty -> scan', { depth: 0 });
    await t.open('&many=1'); await t.tapIcon('layers'); await sleep(400); await t.tap('cls', 'card'); await sleep(400); await t.tapIcon('trash'); await sleep(500);
    await t.check('delete the only scan', { depth: 1, has: ['Nothing here yet'] });
  },

  // pages, names and sizes at the edges
  async 'edges'(t) {
    await t.open('&many=30'); await t.addPages(12, 260); await t.check('12 pages', { depth: 0, has: [/^Continue · 12 pages/] });
    for (let i = 0; i < 12; i++) await t.tap('thumb', 12 - i);
    await t.check('thumb strip scrolling', { depth: 0 });
    for (let i = 0; i < 11; i++) { await t.tapIcon('trash'); await sleep(120); } await t.check('deleted down to 1', { depth: 0, has: [/^Continue$/] });
    await t.tapIcon('trash'); await t.check('deleted the last page', { depth: 0, not: [/^Continue/] });
    await t.addPages(1); await t.tapText(/^Continue/); await t.check('1 page save as', { depth: 1, not: [/Page 1 of/] });
    await t.page.evaluate(() => window.__s.setInput('')); await t.tapText('Save'); await sleep(1800); await t.check('empty name saves', { depth: 1, has: [/^Saved!/] });
  },
};

// ---------------------------------------------------------------- run
const jobs = SIZES.filter(([w, h]) => !onlySize || onlySize === `${w}x${h}`).map(async ([w, h]) => {
  const vp = `${w}x${h}`; const problems = [];
  for (const [name, fn] of Object.entries(SCENARIOS)) {
    if (onlyScn && onlyScn !== name) continue;
    const ctx = await browser.newContext({ viewport: { width: w + 40, height: h + 40 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage(); await page.addInitScript(INIT);
    const t = new T(page, vp, name);
    page.on('pageerror', (e) => t.errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) t.errors.push(m.text().slice(0, 160)); });
    const t0 = Date.now();
    try { await fn(t, vp); } catch (e) { t.fail(t.last || 'start', 'crash', String(e.message).split('\n')[0]); }
    console.log(`${t.problems.length ? '✗' : '✓'} ${vp.padEnd(8)} ${name.padEnd(14)} ${t.n} checks, ${((Date.now() - t0) / 1000).toFixed(0)}s${t.problems.length ? `, ${t.problems.length} problem(s)` : ''}`);
    problems.push(...t.problems); await ctx.close();
  }
  return problems;
});
const all = (await Promise.all(jobs)).flat();
await browser.close(); srv.close();
const seen = new Set(); let shown = 0;
for (const p of all) { const k = `${p.scn}|${p.kind}|${p.what}`; if (seen.has(k)) continue; seen.add(k); shown++; console.log(`  ! [${p.scn}] ${p.vp} @ ${p.step}: ${p.kind} — ${p.what}`); }
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(all, null, 1));
console.log(all.length ? `\n${all.length} problem(s) (${shown} distinct). Screenshots of failing steps + report.json in web/preview/out/stress/` : '\nStress test: all clear.');
process.exit(all.length ? 1 : 0);

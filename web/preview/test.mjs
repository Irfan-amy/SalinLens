// Web UI test: runs the REAL Lynx bundle in headless Chromium (no Android emulator) at several phone sizes,
// takes a screenshot of every screen and checks for clipped text, overlaps and off-screen content.
//   pnpm test:web            -> build + run   |   node preview/test.mjs [--only 360x640] [--keep-open]
import { chromium } from 'playwright-core';
import { serve } from './server.mjs';
import { inspect } from './inspect.mjs';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, 'out');
const VIEWPORTS = [[360, 640], [320, 568], [360, 780], [412, 915]];
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;

const cache = path.join(os.homedir(), 'Library/Caches/ms-playwright');
const dir = fs.readdirSync(cache).filter((d) => d.startsWith('chromium_headless_shell-')).sort().pop();
const exe = process.env.CHROME || path.join(cache, dir, 'chrome-headless-shell-mac-arm64/chrome-headless-shell');

const { srv, port } = await serve(0);
const browser = await chromium.launch({ executablePath: exe });
const report = []; let failed = 0;

for (const [w, h] of VIEWPORTS) {
  const vp = `${w}x${h}`; if (only && only !== vp) continue;
  fs.mkdirSync(path.join(out, vp), { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: w + 40, height: h + 40 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text() + ' @' + (m.location().url || '').split('/').pop() + ':' + m.location().lineNumber); });
  const open = async (q = '') => { await page.goto(`http://127.0.0.1:${port}/?w=${w}&h=${h}${q}`); await page.waitForFunction(() => document.querySelector('#lv')?.shadowRoot?.querySelector('x-view'), null, { timeout: 15000 }); await page.waitForTimeout(1600); };
  const emit = (n, ...a) => page.evaluate(([n, a]) => window.__lv.sendGlobalEvent(n, a), [n, a]);
  const tap = async (t) => { await page.getByText(t, typeof t === 'string' ? { exact: true } : {}).first().click({ timeout: 4000 }); };
  const shot = async (name) => {
    await page.waitForTimeout(900);
    const issues = await page.evaluate(inspect, '#frame');
    await page.locator('#frame').screenshot({ path: path.join(out, vp, name + '.png') });
    const bad = issues.filter((i) => i.kind !== 'ellipsis'); failed += bad.length;
    report.push({ viewport: vp, screen: name, issues });
    console.log(`${bad.length ? '✗' : '✓'} ${vp} ${name}${bad.length ? '' : ''}`);
    for (const i of issues) console.log(`    ${i.kind === 'ellipsis' ? '·' : '!'} ${i.kind}: "${i.text}" (${i.note})`);
  };
  // regression: nothing invisible may sit on top of the top-bar buttons (torch / Your Saved) - an overlay once swallowed their taps
  const topBarFree = async (when) => {
    const bad = await page.evaluate(() => { const r = document.querySelector('#lv').shadowRoot; const out = [];
      for (const n of ['flashOff', 'flash', 'trash', 'layers']) { for (const el of [...r.querySelectorAll('salin-icon')].filter((x) => x.getAttribute('name') === n)) { const bb = el.getBoundingClientRect(); if (!bb.width) continue; const t = r.elementFromPoint(bb.x + bb.width / 2, bb.y + bb.height / 2); if (!(t && (t === el || el.contains(t) || t.contains(el)))) out.push(n); } } return out; });
    if (bad.length) { failed++; console.log(`✗ ${vp} top-bar buttons blocked ${when}: ${bad.join(', ')}`); }
  };
  try {
    await open(); await shot('camera'); await topBarFree('on camera');
    await page.locator('.shutter-core').first().click({ force: true }); await page.waitForTimeout(1500); await topBarFree('after a capture');
    await open('&cam=bad'); await shot('camera-unavailable'); await topBarFree('with camera unavailable');
    await open(); await emit('salinNav', 'gallery'); await page.waitForTimeout(700); await shot('gallery');
    await tap('PDF'); await page.waitForTimeout(700); await shot('item'); // first card = the long-named 3-file seed (tapping its PDF tag: the clipped title is not clickable)
    // multi-page session: import two photos (each opens for adjusting), tap thumbnail 1, back to camera, continue
    await open(); await emit('salinOpenImage', '/fixtures/doc.jpg'); await page.waitForTimeout(1200); await shot('adjust-1page');
    await emit('salinOpenImage', '/fixtures/doc.jpg'); await page.waitForTimeout(1200);
    await tap('1'); await page.waitForTimeout(500); await shot('adjust');
    await emit('salinSelect', 0); await page.waitForTimeout(500); await shot('camera-pages');
    await tap(/^Continue/); await page.waitForTimeout(800); await shot('save-as');
    await tap('Save'); await page.waitForTimeout(2200); await shot('saved');
    await tap('JPG'); await tap('Save file'); await page.waitForTimeout(500); await shot('saved-file');
  } catch (e) { failed++; console.log(`✗ ${vp} flow stopped: ${String(e.message).split('\n')[0]}`); report.push({ viewport: vp, screen: 'flow', issues: [{ kind: 'flow', text: String(e.message).split('\n')[0], note: '' }] }); }
  for (const e of errors) { console.log(`    ! console error: ${e.slice(0, 160)}`); }
  await ctx.close();
}
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 1));
await browser.close(); srv.close();
console.log(failed ? `\n${failed} problem(s). Screenshots + report.json in web/preview/out/` : '\nAll clear. Screenshots in web/preview/out/');
process.exit(failed ? 1 : 0);

// Renders every scene of the UI board in headless Chromium and writes PNGs to preview/out/board/<size>/<n>.png.
// Lynx's web layer only works in Chromium (it needs @container style() queries), so the board page shows these
// screenshots; that way it looks the same in Firefox/Zen/Safari. Usage: node preview/board-shots.mjs
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './server.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const { sizes, scenes } = JSON.parse(fs.readFileSync(path.join(here, 'scenes.json'), 'utf8'));
const only = process.argv[2]; // optional: one size key, e.g. 360×780
const cache = path.join(os.homedir(), 'Library/Caches/ms-playwright');
const shell = fs.readdirSync(cache).filter((d) => d.startsWith('chromium_headless_shell-')).sort().pop();
const exe = process.env.CHROME || path.join(cache, shell, 'chrome-headless-shell-mac-arm64/chrome-headless-shell');

const { srv, port } = await serve(0);
const browser = await chromium.launch({ executablePath: exe });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const out = path.join(here, 'out/board'); fs.mkdirSync(out, { recursive: true });
const errors = [];

for (const [key, [w, h]] of Object.entries(sizes)) {
  if (only && only !== key) continue;
  fs.mkdirSync(path.join(out, key), { recursive: true });
  await Promise.all(scenes.map(async (s, i) => {
    const ctx = await browser.newContext({ viewport: { width: w + 40, height: h + 40 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`${key} #${i}: ${e.message}`));
    await page.goto(`http://127.0.0.1:${port}/?w=${w}&h=${h}${s.query}`);
    await page.waitForFunction(() => document.querySelector('#lv')?.shadowRoot?.querySelector('x-view'), null, { timeout: 20000 });
    await wait(1600);
    for (const [name, arg] of s.steps) { await page.evaluate(([n, a]) => window.__lv.sendGlobalEvent(n, [a]), [name, arg]); await wait(name === 'salinOpenImage' ? 1000 : 600); }
    await wait(900);
    await page.locator('#frame').screenshot({ path: path.join(out, key, `${i}.png`) });
    await ctx.close();
  }));
  console.log(`shot ${key} (${scenes.length} scenes)`);
}
fs.writeFileSync(path.join(out, 'index.json'), JSON.stringify({ at: Date.now() }));
await browser.close(); srv.close();
if (errors.length) { console.log('page errors:\n  ' + errors.join('\n  ')); }

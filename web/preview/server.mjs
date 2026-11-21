// Tiny static server for the web preview. No bundler: web-core ships a prebuilt client.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const web = path.resolve(here, '..');
const core = path.join(web, 'node_modules/@lynx-js/web-core/dist/client_prod');
const kt = path.resolve(web, '../android/app/src/main/java/com/salinlens/IconElement.kt');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.json': 'application/json', '.wasm': 'application/wasm', '.bundle': 'application/octet-stream', '.map': 'application/json' };

// Icon path data is read straight from the Kotlin source so the preview never drifts from the app.
function icons() {
  const src = fs.readFileSync(kt, 'utf8');
  const out = {};
  for (const m of src.matchAll(/"(\w+)" to "([^"]+)"/g)) out[m[1]] = m[2];
  return `export const ICONS = ${JSON.stringify(out)};`;
}

const roots = [['/web-core/', core], ['/preview/', here], ['/fixtures/', path.join(here, 'fixtures')], ['/dist/', path.join(web, 'dist')]];

export const stats = { exits: {} }; // native.exit() calls per run id (?rid=), so parallel viewports don't mix

export function serve(port = 0) {
  const srv = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x'); let p = decodeURIComponent(url.pathname);
    const send = (code, body, type = 'text/plain') => { res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store', 'access-control-allow-origin': '*' }); res.end(body); };
    if (p === '/__exit') { const id = new URL(req.url, 'http://x').searchParams.get('rid') || ''; stats.exits[id] = (stats.exits[id] || 0) + 1; return send(200, 'ok'); }
    if (p === '/') return send(200, fs.readFileSync(path.join(here, 'index.html')), 'text/html');
    if (p === '/lab') return send(200, fs.readFileSync(path.join(here, 'lab.html')), 'text/html');
    if (p === '/smoke') return send(200, fs.readFileSync(path.join(here, 'smoke/index.html')), 'text/html');
    if (p === '/layouts') return send(200, fs.readFileSync(path.join(here, 'smoke/layouts.html')), 'text/html');
    if (p === '/app') return send(200, fs.readFileSync(path.join(here, 'board.html')), 'text/html');
    if (p === '/preview/icons.js') return send(200, icons(), 'text/javascript');
    for (const [prefix, dir] of roots) {
      if (p.startsWith(prefix)) {
        const f = path.join(dir, p.slice(prefix.length));
        if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return send(404, 'not found');
        return send(200, fs.readFileSync(f), MIME[path.extname(f)] || 'application/octet-stream');
      }
    }
    send(404, 'not found');
  });
  return new Promise((r) => srv.listen(port, '127.0.0.1', () => r({ srv, port: srv.address().port })));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { port } = await serve(+process.env.PORT || 5173);
  console.log(`web preview: http://127.0.0.1:${port}/?w=360&h=640`);
  console.log(`app board:   http://127.0.0.1:${port}/app`);
  console.log(`glass lab:   http://127.0.0.1:${port}/lab`);
  console.log(`smoke:       http://127.0.0.1:${port}/smoke`);
  console.log(`layouts:     http://127.0.0.1:${port}/layouts`);
}

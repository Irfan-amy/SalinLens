// Glass lab: liquid-glass look in the browser, no Lynx, no emulator.
// Refraction = an SVG feDisplacementMap inside `backdrop-filter` (Chromium). The displacement map is computed per element from a rounded-rect
// SDF and the same Snell's-law bezel profile the native AGSL shader uses (profile from liquid-glass-studio, MIT, (c) 2025 Yinchao).
const $ = (s, r = document) => r.querySelector(s);
const SVGNS = 'http://www.w3.org/2000/svg';
const defs = $('#defs');

const ICON = {
  flash: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="m3 17 5-5 4 4 3-3 6 6"/>',
  dots: '<circle cx="5.5" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="18.5" cy="12" r="1.5" fill="currentColor"/>',
  back: '<path d="m15 5-7 7 7 7"/>',
  rotate: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
  wand: '<path d="M5 19 17 7M14 4l1 2 2 1-2 1-1 2-1-2-2-1 2-1zM19 12l.7 1.3L21 14l-1.3.7L19 16l-.7-1.3L17 14l1.3-.7z"/>',
  crop: '<path d="M6 2v14a2 2 0 0 0 2 2h14M2 6h14a2 2 0 0 1 2 2v14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  grid: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16M15 4v16"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  pin: '<path d="M9 3h6l-1 7 3 3H7l3-3zM12 13v8"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  share: '<path d="M12 15V3M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>',
  scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  layers: '<path d="m12 3-9 5 9 5 9-5zM3 13l9 5 9-5"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/>',
};
const ic = (n, s = 22, sw = 1.9) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${ICON[n]}</svg>`;

// ---------- parameters ----------
const BASE = { blur: 8, sat: 1.7, bright: 0.98, tint: '#0f1722', tintA: 0.2, bezel: 14, refract: 1, ior: 1.45, disp: 0.03, rim: 0.85, glow: 0.18, shadow: 0.16, fg: 'white' };
const PRESETS = {
  'Liquid clear': { ...BASE },
  'Apple frosted': { ...BASE, blur: 26, sat: 1.55, bright: 1.02, tint: '#9fb0c4', tintA: 0.3, bezel: 10, refract: 0.45, disp: 0.01, rim: 0.7, glow: 0.25 },
  'Smoke': { ...BASE, blur: 16, sat: 1.4, bright: 0.95, tint: '#14171a', tintA: 0.42, bezel: 12, refract: 0.7, rim: 0.55, glow: 0.1, shadow: 0.3 },
  'Crystal': { ...BASE, blur: 1.5, sat: 1.3, bright: 1.0, tintA: 0.1, bezel: 24, refract: 1.7, disp: 0.07, rim: 1, glow: 0.1 },
  'Milk': { ...BASE, blur: 30, sat: 1.3, bright: 1.1, tint: '#ffffff', tintA: 0.5, bezel: 8, refract: 0.3, disp: 0, rim: 0.9, glow: 0.4, fg: 'ink' },
};
const SLIDERS = [
  ['blur', 'Blur', 0, 40, 0.5, 'px'], ['sat', 'Saturation', 0.8, 2.5, 0.05, ''], ['bright', 'Brightness', 0.8, 1.3, 0.01, ''],
  ['tint', 'Tint color'], ['tintA', 'Tint amount', 0, 0.7, 0.01, ''],
  ['bezel', 'Bezel', 2, 36, 1, 'px'], ['refract', 'Refraction', 0, 2.5, 0.05, ''], ['ior', 'Index', 1.1, 2.2, 0.01, ''], ['disp', 'Dispersion', 0, 0.15, 0.005, ''],
  ['rim', 'Rim light', 0, 1, 0.01, ''], ['glow', 'Inner glow', 0, 0.6, 0.01, ''], ['shadow', 'Shadow', 0, 0.5, 0.01, ''],
];

const state = { mode: 'play', bd: 'scenic', scene: 'camera', preset: 'Liquid clear', play: { ...PRESETS['Liquid clear'] }, custom: null };

// ---------- backdrops ----------
let scenicCache = null;
function scenic() {
  if (scenicCache) return scenicCache;
  const W = 780, H = 1688, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const sky = x.createLinearGradient(0, 0, 0, H * 0.62); sky.addColorStop(0, '#7fa9d8'); sky.addColorStop(1, '#dfe9f3'); x.fillStyle = sky; x.fillRect(0, 0, W, H);
  x.fillStyle = 'rgba(255,255,255,.75)'; for (let i = 0; i < 16; i++) { const cx = rnd() * W, cy = 120 + rnd() * 700; for (let k = 0; k < 6; k++) { x.beginPath(); x.ellipse(cx + k * 34, cy + rnd() * 18, 70 + rnd() * 40, 26 + rnd() * 14, 0, 0, 7); x.fill(); } }
  x.fillStyle = '#7f9c86'; x.beginPath(); x.moveTo(0, 820); for (let i = 0; i <= W; i += 40) x.lineTo(i, 780 + Math.sin(i / 90) * 40); x.lineTo(W, 1100); x.lineTo(0, 1100); x.fill();
  // castle
  const body = (bx, by, bw, bh, roof) => {
    x.fillStyle = '#ece5d6'; x.fillRect(bx, by, bw, bh);
    x.fillStyle = roof; x.beginPath(); x.moveTo(bx - 10, by); x.lineTo(bx + bw / 2, by - bw * 0.7); x.lineTo(bx + bw + 10, by); x.fill();
    x.fillStyle = '#3d4350'; for (let wy = by + 24; wy < by + bh - 26; wy += 54) for (let wx = bx + 20; wx < bx + bw - 20; wx += 44) x.fillRect(wx, wy, 16, 28);
  };
  body(110, 760, 380, 360, '#2d3a55'); body(70, 600, 120, 520, '#27324d'); body(430, 640, 150, 480, '#2d3a55'); body(300, 520, 110, 240, '#35446a');
  // forest + cliff
  const cl = x.createLinearGradient(0, 1100, 0, H); cl.addColorStop(0, '#6c7a45'); cl.addColorStop(1, '#2d4a22'); x.fillStyle = cl; x.fillRect(0, 1110, W, H);
  const gs = ['#2f5a24', '#4b7a2c', '#7c9a2e', '#c9b53f', '#e0a43a', '#3f6e2a'];
  for (let i = 0; i < 520; i++) { x.fillStyle = gs[(rnd() * gs.length) | 0]; x.beginPath(); x.arc(rnd() * W, 1040 + rnd() * (H - 1040), 16 + rnd() * 34, 0, 7); x.fill(); }
  return (scenicCache = c.toDataURL('image/jpeg', 0.9));
}
const BACKDROPS = { scenic: 'Scenic', doc: 'Document', stripes: 'Stripes', aurora: 'Aurora' };
function bdHTML() {
  if (state.bd === 'custom' && state.custom) return `<div class="bd" style="background-image:url(${state.custom})"></div>`;
  if (state.bd === 'doc') return `<div class="bd warm"><img src="/fixtures/doc.jpg" alt=""></div>`;
  if (state.bd === 'stripes') return `<div class="bd stripes"></div>`;
  if (state.bd === 'aurora') return `<div class="bd aurora"></div>`;
  return `<div class="bd" style="background-image:url(${scenic()})"></div>`;
}

// ---------- scenes ----------
const circ = (name, cls = '', extra = '') => `<div class="g circle ${cls}" data-r="full" ${extra}>${ic(name)}</div>`;
const rowItem = (t, i) => `<div class="item"><span>${t}</span>${ic(i, 26, 1.7)}</div>`;
const SCENES = {
  camera: () => `
    <div class="dyn"></div><div class="sb"><span>9:41</span><span>5G ▮▮▮</span></div>
    <div class="abs" style="left:16px;right:16px;top:62px"><div class="g bar" data-r="33" data-drag>${circ('flash', 'sm flat')}${circ('image', 'sm flat')}${circ('layers', 'sm flat')}${circ('dots', 'sm solid')}</div></div>
    <div class="abs" style="right:16px;top:146px"><div class="g menu" data-r="32" data-drag>
      <div class="tools">${ic('scan', 26, 1.7)}${ic('timer', 26, 1.7)}${ic('lock', 26, 1.7)}</div><hr>
      ${rowItem('Auto-detect', 'wand')}${rowItem('Import photo', 'image')}${rowItem('Lines &amp; grids', 'grid')}${rowItem('Delete last', 'trash')}</div></div>
    <div class="abs" style="left:18px;top:556px"><div class="g pill press" data-r="full" data-drag><i class="dot"></i>Page found</div></div>
    <div class="abs" style="left:0;right:0;bottom:184px;display:flex;justify-content:center"><div class="g segc" data-r="full" data-drag><span class="it sel">Original</span><span class="it">Magic</span><span class="it">B&amp;W</span><span class="it">Gray</span></div></div>
    <div class="abs" style="left:30px;bottom:62px"><div class="g thumb press" data-r="20" data-drag>3</div></div>
    <div class="abs" style="left:0;right:0;bottom:44px;display:flex;justify-content:center"><div class="g shutter press" data-r="full" data-drag><i></i></div></div>`,
  adjust: () => `
    <div class="dyn"></div><div class="sb ink"><span>9:41</span><span>5G ▮▮▮</span></div>
    <div class="abs" style="left:16px;right:16px;top:62px;display:flex;justify-content:space-between;align-items:center">
      <div class="g circle press" data-r="full" data-drag>${ic('back')}</div>
      <div class="g pill press" data-r="full" data-drag><i class="dot"></i>Edges found</div>
      <div style="width:52px"></div></div>
    <div class="abs" style="left:0;right:0;top:330px;display:flex;justify-content:center"><div class="g toast" data-r="full" data-drag>Looks good</div></div>
    <div class="g sheet abs" data-r="38" style="border-radius:38px 38px 0 0">
      <div class="tools4">
        ${[['rotate', 'Rotate'], ['wand', 'Auto-fit'], ['crop', 'Full page'], ['back', 'Reset']].map(([i, t]) => `<div class="tool"><div class="g circle press" data-r="full">${ic(i, 24)}</div>${t}</div>`).join('')}
      </div>
      <div class="g cta dark press" data-r="28">Continue ${ic('chevron', 20, 2.6)}</div>
    </div>`,
};

// ---------- refraction ----------
function sdfRR(px, py, hw, hh, r) {
  const qx = Math.abs(px) - (hw - r), qy = Math.abs(py) - (hh - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}
function makeMap(w, h, r, bezel, ior) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); const img = x.createImageData(w, h); const d = img.data;
  const hw = w / 2, hh = h / 2;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const px = i + 0.5 - hw, py = j + 0.5 - hh, s = sdfRR(px, py, hw, hh, r), k = (j * w + i) * 4;
    let vx = 0, vy = 0;
    const depth = -s;
    if (depth > 0 && depth < bezel) {
      const gx = sdfRR(px + 1, py, hw, hh, r) - sdfRR(px - 1, py, hw, hh, r), gy = sdfRR(px, py + 1, hw, hh, r) - sdfRR(px, py - 1, hw, hh, r), gl = Math.hypot(gx, gy) || 1;
      const xr = 1 - depth / bezel, thI = Math.asin(Math.min(xr * xr, 1)), thT = Math.asin(Math.min(Math.sin(thI) / ior, 1));
      const edge = Math.min(-Math.tan(thT - thI), 3);
      vx = (-(gx / gl) * edge) / 3; vy = (-(gy / gl) * edge) / 3;
    }
    d[k] = 128 + 127 * vx; d[k + 1] = 128 + 127 * vy; d[k + 2] = 128; d[k + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  return c.toDataURL('image/png');
}

let uid = 0;
function refresh(g, p) {
  const w = g.offsetWidth, h = g.offsetHeight; if (!w || !h) return;
  const nested = !!g.parentElement.closest('.g');
  if (nested && !g.classList.contains('solid') && !g.classList.contains('dark')) g.classList.add('flat');
  const r = g.dataset.r === 'full' ? Math.min(w, h) / 2 : Math.min(+g.dataset.r || 20, Math.min(w, h) / 2);
  g.style.setProperty('--r', r + 'px');
  if (g.classList.contains('solid') || g.classList.contains('flat')) { g.style.backdropFilter = 'none'; g.style.webkitBackdropFilter = 'none'; return; }
  const id = g._fid || (g._fid = 'gf' + ++uid);
  const bezel = Math.max(1, Math.min(p.bezel, Math.min(w, h) / 2 - 1));
  const key = `${w}|${h}|${r}|${bezel}|${p.ior}`;
  if (g._key !== key) { g._key = key; g._map = makeMap(w, h, r, bezel, p.ior); }
  let f = document.getElementById(id);
  if (!f) { f = document.createElementNS(SVGNS, 'filter'); f.id = id; defs.appendChild(f); }
  const S = 6 * bezel * p.refract;
  f.setAttribute('filterUnits', 'userSpaceOnUse'); f.setAttribute('primitiveUnits', 'userSpaceOnUse'); f.setAttribute('color-interpolation-filters', 'sRGB');
  f.setAttribute('x', 0); f.setAttribute('y', 0); f.setAttribute('width', w); f.setAttribute('height', h);
  const disp = (ch, sc, res) => `<feDisplacementMap in="SourceGraphic" in2="m" scale="${sc}" xChannelSelector="R" yChannelSelector="G" result="${res}"/>`;
  const only = (res, m) => `<feColorMatrix in="${res}" type="matrix" values="${m}" result="${res}c"/>`;
  const R = '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0', G = '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0', B = '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0';
  const map = `<feImage href="${g._map}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="m"/>`;
  f.innerHTML = p.disp > 0.001
    ? map + disp('R', S * (1 + p.disp), 'dr') + only('dr', R) + disp('G', S, 'dg') + only('dg', G) + disp('B', S * (1 - p.disp), 'db') + only('db', B)
      + '<feComposite in="drc" in2="dgc" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="rg"/><feComposite in="rg" in2="dbc" operator="arithmetic" k1="0" k2="1" k3="1" k4="0"/>'
    : map + disp('R', S, 'd');
  const bf = `blur(${p.blur}px) saturate(${p.sat}) brightness(${p.bright}) url(#${id})`;
  g.style.backdropFilter = bf; g.style.webkitBackdropFilter = bf;
}

const hex = (h) => { const n = parseInt(h.slice(1), 16); return `${n >> 16},${(n >> 8) & 255},${n & 255}`; };
function paint(phone, p) {
  const s = phone.style;
  s.setProperty('--tint', hex(p.tint)); s.setProperty('--tintA', p.tintA); s.setProperty('--bezel', Math.max(2, p.bezel * 0.6));
  s.setProperty('--rimA', p.rim); s.setProperty('--glow', p.glow); s.setProperty('--shA', p.shadow); s.setProperty('--fg', p.fg === 'white' ? '#fff' : '#16181c');
  phone.classList.toggle('fgw', p.fg === 'white');
  let raf = phone._raf; if (raf) cancelAnimationFrame(raf);
  phone._raf = requestAnimationFrame(() => phone.querySelectorAll('.g').forEach((g) => refresh(g, p)));
}

// ---------- dragging ----------
function makeDraggable(phone) {
  phone.querySelectorAll('[data-drag]').forEach((el) => {
    let sx, sy, ox = 0, oy = 0, on = false;
    el.addEventListener('pointerdown', (e) => { if (e.target.closest('[data-drag]') !== el) return; on = true; sx = e.clientX; sy = e.clientY; el.setPointerCapture(e.pointerId); el.classList.add('dragging'); });
    el.addEventListener('pointermove', (e) => { if (!on) return; el.style.translate = `${ox + e.clientX - sx}px ${oy + e.clientY - sy}px`; });
    const end = (e) => { if (!on) return; on = false; ox += e.clientX - sx; oy += e.clientY - sy; el.classList.remove('dragging'); };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  });
}

// ---------- ui ----------
const stage = $('#stage');
const phones = [];
function phoneHTML() { return `<div class="phone">${bdHTML()}${SCENES[state.scene]()}</div>`; }
function render() {
  stage.className = 'stage' + (state.mode === 'vars' ? ' vars' : '');
  stage.innerHTML = ''; phones.length = 0;
  const list = state.mode === 'play' ? [[state.preset === '__custom' ? 'Playground' : state.preset, state.play, true]] : Object.entries(PRESETS).map(([n, p]) => [n, p, false]);
  for (const [name, p, live] of list) {
    const slot = document.createElement('div'); slot.className = 'slot';
    slot.innerHTML = `<h4>${name}${live ? '' : '<button>Open in playground</button>'}</h4>${phoneHTML()}`;
    stage.appendChild(slot);
    const phone = $('.phone', slot); phones.push({ phone, p });
    paint(phone, p); makeDraggable(phone);
    if (!live) $('button', slot).onclick = () => { state.mode = 'play'; state.preset = name; state.play = { ...p }; sync(); render(); };
  }
  document.fonts.ready.then(() => phones.forEach(({ phone, p }) => paint(phone, p)));
}
function repaint() { phones.forEach(({ phone, p }) => paint(phone, p)); }

function seg(el, items, cur, on) {
  el.innerHTML = Object.entries(items).map(([k, v]) => `<button data-k="${k}" class="${k === cur ? 'on' : ''}">${v}</button>`).join('');
  el.onclick = (e) => { const b = e.target.closest('button'); if (b) on(b.dataset.k); };
}
function sync() {
  seg($('#bdSeg'), BACKDROPS, state.bd, (k) => { state.bd = k; sync(); render(); });
  seg($('#sceneSeg'), { camera: 'Camera', adjust: 'Adjust' }, state.scene, (k) => { state.scene = k; sync(); render(); });
  $('#modeTabs').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.mode === state.mode));
  $('#presets').innerHTML = Object.keys(PRESETS).map((n) => `<button class="${n === state.preset ? 'on' : ''}">${n}</button>`).join('');
  $('#presets').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; state.preset = b.textContent; state.play = { ...PRESETS[state.preset] }; sync(); render(); };
  const play = state.mode === 'play';
  $('#presetSec').style.display = play ? '' : 'none'; $('#sliders').style.display = play ? '' : 'none'; document.querySelector('.btns').style.display = play ? '' : 'none';
  if (play) {
    const p = state.play;
    $('#sliders').innerHTML = SLIDERS.map(([k, label, min, max, step, unit]) => k === 'tint'
      ? `<div class="row"><label>${label}</label><input type="color" data-k="tint" value="${p.tint}"><output></output></div>`
      : `<div class="row"><label>${label}</label><input type="range" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${p[k]}"><output>${(+p[k]).toFixed(step < 0.01 ? 3 : step < 1 ? 2 : 0)}${unit}</output></div>`).join('')
      + `<div class="row"><label>Text</label><div class="seg" id="fgSeg" style="grid-column:2 / 4"></div></div>`;
    seg($('#fgSeg'), { white: 'White', ink: 'Ink' }, p.fg, (k) => { p.fg = k; state.preset = '__custom'; sync(); repaint(); });
    $('#sliders').oninput = (e) => {
      const k = e.target.dataset.k; if (!k) return; p[k] = k === 'tint' ? e.target.value : +e.target.value; state.preset = '__custom';
      const out = e.target.parentElement.querySelector('output'); if (out && k !== 'tint') { const sl = SLIDERS.find((s) => s[0] === k); out.textContent = p[k].toFixed(sl[4] < 0.01 ? 3 : sl[4] < 1 ? 2 : 0) + sl[5]; }
      $('#presets').querySelectorAll('button').forEach((b) => b.classList.remove('on')); repaint();
    };
  }
}
$('#modeTabs').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; state.mode = b.dataset.mode; sync(); render(); };
$('#bdFile').onchange = (e) => { const f = e.target.files[0]; if (!f) return; state.custom = URL.createObjectURL(f); state.bd = 'custom'; sync(); render(); };
$('#reset').onclick = () => { state.preset = 'Liquid clear'; state.play = { ...PRESETS['Liquid clear'] }; sync(); render(); };
$('#copy').onclick = async () => { const t = JSON.stringify(state.play, null, 2); try { await navigator.clipboard.writeText(t); $('#copy').textContent = 'Copied'; setTimeout(() => ($('#copy').textContent = 'Copy params'), 1200); } catch { prompt('Params', t); } };

const q = new URLSearchParams(location.search);
if (q.get('mode')) state.mode = q.get('mode'); if (q.get('bd')) state.bd = q.get('bd'); if (q.get('scene')) state.scene = q.get('scene');
if (q.get('preset') && PRESETS[q.get('preset')]) { state.preset = q.get('preset'); state.play = { ...PRESETS[state.preset] }; }
sync(); render();
window.lab = { state, render, sync };

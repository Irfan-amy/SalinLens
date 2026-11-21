// Shared kit for the standalone smoke pages: icons, generated art, and the glass refraction engine.
// Shares nothing with the app or the other lab. All pictures are generated on canvas below.
// Refraction: SVG feDisplacementMap inside backdrop-filter (Chromium), Snell's-law bezel profile as in liquid-glass-studio (MIT, (c) 2025 Yinchao).
export const $ = (s, r = document) => r.querySelector(s);
const SVGNS = 'http://www.w3.org/2000/svg';
const defs = $('#defs');

export const SMOKE = { blur: 16, sat: 1.4, bright: 0.95, tint: '#14171a', tintA: 0.42, bezel: 12, refract: 0.7, ior: 1.45, disp: 0.03, rim: 0.55, glow: 0.1, shadow: 0.3 };
export const P = { ...SMOKE };
export const SLIDERS = [['blur', 'Blur', 0, 40, 0.5], ['tintA', 'Smoke', 0, 0.8, 0.01], ['bezel', 'Bezel', 2, 30, 1], ['refract', 'Refraction', 0, 2.5, 0.05], ['disp', 'Dispersion', 0, 0.15, 0.005], ['rim', 'Rim', 0, 1, 0.01]];
export const state = { bd: 'original' };

// ---------- icons ----------
export const ICON = {
  flash: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>', image: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="m3 17 5-5 4 4 3-3 6 6"/>',
  back: '<path d="m15 5-7 7 7 7"/>', rotate: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>', wand: '<path d="M5 19 17 7M14 4l1 2 2 1-2 1-1 2-1-2-2-1 2-1zM19 12l.7 1.3L21 14l-1.3.7L19 16l-.7-1.3L17 14l1.3-.7z"/>',
  crop: '<path d="M6 2v14a2 2 0 0 0 2 2h14M2 6h14a2 2 0 0 1 2 2v14"/>', trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  share: '<path d="M12 15V3M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>', scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>', layers: '<path d="m12 3-9 5 9 5 9-5zM3 13l9 5 9-5"/>', check: '<path d="m5 12 5 5 9-10"/>', close: '<path d="M6 6l12 12M18 6 6 18"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h6"/>', download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
};
export const ic = (n, s = 22, sw = 1.9, col = 'currentColor') => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${ICON[n]}</svg>`;

// ---------- generated art ----------
let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
export const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
function paperFace(x, w, h, tint = '#f3f1ea') {
  x.fillStyle = tint; x.fillRect(0, 0, w, h);
  x.fillStyle = '#1b1b1b'; x.font = `800 ${w * 0.075}px Georgia, serif`; x.textAlign = 'center'; x.fillText('SERVICE AGREEMENT', w / 2, h * 0.11);
  x.textAlign = 'left'; x.font = `${w * 0.032}px Georgia, serif`; x.fillStyle = '#2a2a2a';
  for (let i = 0, y = h * 0.19; y < h * 0.93; i++, y += h * 0.034) x.fillText('This Service Agreement is entered into ' + ['by and between', 'under the laws of', 'on the date first'][i % 3], w * 0.09, y);
  x.fillStyle = '#555'; x.fillRect(w * 0.1, h * 0.93, w * 0.3, 2); x.fillRect(w * 0.58, h * 0.93, w * 0.3, 2);
}
export const docURL = (w, h, tint) => { const [c, x] = cv(w, h); paperFace(x, w, h, tint); return c.toDataURL('image/jpeg', 0.9); };
// dark desk with a tilted page. Returns picture + the page corners (css px) for the crop overlay.
export function desk(w, h, cx, cy, pw, ph) {
  const S = 2, [c, x] = cv(w * S, h * S); x.scale(S, S);
  const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#2b2420'); g.addColorStop(1, '#17120f'); x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.strokeStyle = 'rgba(255,255,255,.05)'; for (let i = 0; i < 60; i++) { x.beginPath(); const y = rnd() * h; x.moveTo(0, y); x.bezierCurveTo(w * .3, y + 8, w * .6, y - 8, w, y + 4); x.stroke(); }
  const a = -3 * Math.PI / 180, rot = (px, py) => [cx + px * Math.cos(a) - py * Math.sin(a), cy + px * Math.sin(a) + py * Math.cos(a)];
  const q = [rot(-pw / 2 + 8, -ph / 2), rot(pw / 2 - 6, -ph / 2 + 4), rot(pw / 2 + 4, ph / 2), rot(-pw / 2 - 6, ph / 2 - 4)];
  x.save(); x.shadowColor = 'rgba(0,0,0,.6)'; x.shadowBlur = 40; x.shadowOffsetY = 16; x.beginPath(); q.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py))); x.closePath(); x.fillStyle = '#f3f1ea'; x.fill(); x.restore();
  x.save(); x.beginPath(); q.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py))); x.closePath(); x.clip();
  x.translate(cx, cy); x.rotate(a); x.translate(-pw / 2, -ph / 2); paperFace(x, pw, ph); x.restore();
  return { url: c.toDataURL('image/jpeg', 0.88), q };
}
export function scenic() {
  const W = 780, H = 1688, [c, x] = cv(W, H);
  const sky = x.createLinearGradient(0, 0, 0, H * 0.62); sky.addColorStop(0, '#7fa9d8'); sky.addColorStop(1, '#dfe9f3'); x.fillStyle = sky; x.fillRect(0, 0, W, H);
  x.fillStyle = 'rgba(255,255,255,.75)'; for (let i = 0; i < 14; i++) { const cx = rnd() * W, cy = 120 + rnd() * 700; for (let k = 0; k < 6; k++) { x.beginPath(); x.ellipse(cx + k * 34, cy + rnd() * 18, 70 + rnd() * 40, 26 + rnd() * 14, 0, 0, 7); x.fill(); } }
  x.fillStyle = '#7f9c86'; x.beginPath(); x.moveTo(0, 820); for (let i = 0; i <= W; i += 40) x.lineTo(i, 780 + Math.sin(i / 90) * 40); x.lineTo(W, 1100); x.lineTo(0, 1100); x.fill();
  const body = (bx, by, bw, bh, roof) => { x.fillStyle = '#ece5d6'; x.fillRect(bx, by, bw, bh); x.fillStyle = roof; x.beginPath(); x.moveTo(bx - 10, by); x.lineTo(bx + bw / 2, by - bw * .7); x.lineTo(bx + bw + 10, by); x.fill(); x.fillStyle = '#3d4350'; for (let wy = by + 24; wy < by + bh - 26; wy += 54) for (let wx = bx + 20; wx < bx + bw - 20; wx += 44) x.fillRect(wx, wy, 16, 28); };
  body(110, 760, 380, 360, '#2d3a55'); body(70, 600, 120, 520, '#27324d'); body(430, 640, 150, 480, '#2d3a55'); body(300, 520, 110, 240, '#35446a');
  const cl = x.createLinearGradient(0, 1100, 0, H); cl.addColorStop(0, '#6c7a45'); cl.addColorStop(1, '#2d4a22'); x.fillStyle = cl; x.fillRect(0, 1110, W, H);
  const gs = ['#2f5a24', '#4b7a2c', '#7c9a2e', '#c9b53f', '#e0a43a', '#3f6e2a']; for (let i = 0; i < 520; i++) { x.fillStyle = gs[(rnd() * gs.length) | 0]; x.beginPath(); x.arc(rnd() * W, 1040 + rnd() * (H - 1040), 16 + rnd() * 34, 0, 7); x.fill(); }
  return c.toDataURL('image/jpeg', 0.9);
}
export const ART = {};
export const art = () => {
  if (ART.ready) return ART; ART.ready = true; seed = 11;
  ART.cam = desk(390, 844, 195, 400, 250, 330); ART.adj = desk(390, 524, 195, 262, 250, 340);
  ART.doc = docURL(300, 400); ART.docB = docURL(300, 400, '#efe6d2'); ART.docC = docURL(300, 400, '#e4ecef'); ART.scenic = scenic();
  return ART;
};
export const bgDiv = (kind) => {
  const A = art();
  if (state.bd === 'scenic') return `<div class="bg" style="background-image:url(${A.scenic})"></div>`;
  if (state.bd === 'night') return '<div class="bg night"></div>';
  return kind === 'camera' ? `<div class="bg" style="background-image:url(${A.cam.url})"></div>` : `<div class="bg ${kind}"></div>`;
};
export const polyPts = (q) => q.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
export const cropOverlay = (q) => `<svg class="ov" viewBox="0 0 390 ${q.h}" style="height:${q.h}px"><polygon points="${polyPts(q.q)}" fill="rgba(47,107,255,.14)" stroke="#2F6BFF" stroke-width="3" stroke-linejoin="round"/>
  ${q.q.map(([x, y], i) => { const [nx, ny] = q.q[(i + 1) % 4]; return `<circle cx="${(x + nx) / 2}" cy="${(y + ny) / 2}" r="7" fill="#fff" stroke="#2F6BFF" stroke-width="3"/>`; }).join('')}
  ${q.q.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="11" fill="rgba(255,255,255,.35)" stroke="#fff" stroke-width="3"/>`).join('')}</svg>`;

// ---------- refraction ----------
const sdf = (px, py, hw, hh, r) => { const qx = Math.abs(px) - (hw - r), qy = Math.abs(py) - (hh - r); return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r; };
export function makeMap(w, h, r, bezel, ior) {
  const [c, x] = cv(w, h), img = x.createImageData(w, h), d = img.data, hw = w / 2, hh = h / 2;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const px = i + 0.5 - hw, py = j + 0.5 - hh, depth = -sdf(px, py, hw, hh, r), k = (j * w + i) * 4; let vx = 0, vy = 0;
    if (depth > 0 && depth < bezel) {
      const gx = sdf(px + 1, py, hw, hh, r) - sdf(px - 1, py, hw, hh, r), gy = sdf(px, py + 1, hw, hh, r) - sdf(px, py - 1, hw, hh, r), gl = Math.hypot(gx, gy) || 1;
      const xr = 1 - depth / bezel, thI = Math.asin(Math.min(xr * xr, 1)), thT = Math.asin(Math.min(Math.sin(thI) / ior, 1)), edge = Math.min(-Math.tan(thT - thI), 3);
      vx = (-(gx / gl) * edge) / 3; vy = (-(gy / gl) * edge) / 3;
    }
    d[k] = 128 + 127 * vx; d[k + 1] = 128 + 127 * vy; d[k + 2] = 128; d[k + 3] = 255;
  }
  x.putImageData(img, 0, 0); return c.toDataURL('image/png');
}
let uid = 0;
export function refresh(el) {
  const w = el.offsetWidth, h = el.offsetHeight; if (!w || !h) return;
  if (el.parentElement.closest('.g') && !el.classList.contains('solid')) el.classList.add('flat');
  const r = el.dataset.r === 'full' ? Math.min(w, h) / 2 : Math.min(+el.dataset.r || 20, Math.min(w, h) / 2);
  el.style.setProperty('--r', r + 'px');
  if (el.classList.contains('solid') || el.classList.contains('flat')) { el.style.backdropFilter = 'none'; return; }
  const id = el._fid || (el._fid = 'sf' + ++uid), bezel = Math.max(1, Math.min(P.bezel, Math.min(w, h) / 2 - 1)), key = `${w}|${h}|${r}|${bezel}|${P.ior}`;
  if (el._key !== key) { el._key = key; el._map = makeMap(w, h, r, bezel, P.ior); }
  let f = document.getElementById(id); if (!f) { f = document.createElementNS(SVGNS, 'filter'); f.id = id; defs.appendChild(f); }
  const S = 6 * bezel * P.refract;
  for (const [k, v] of Object.entries({ filterUnits: 'userSpaceOnUse', primitiveUnits: 'userSpaceOnUse', 'color-interpolation-filters': 'sRGB', x: 0, y: 0, width: w, height: h })) f.setAttribute(k, v);
  const dm = (sc, res) => `<feDisplacementMap in="SourceGraphic" in2="m" scale="${sc}" xChannelSelector="R" yChannelSelector="G" result="${res}"/>`;
  const ch = (res, m) => `<feColorMatrix in="${res}" type="matrix" values="${m}" result="${res}c"/>`;
  const map = `<feImage href="${el._map}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="m"/>`;
  f.innerHTML = P.disp > 0.001
    ? map + dm(S * (1 + P.disp), 'dr') + ch('dr', '1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0') + dm(S, 'dg') + ch('dg', '0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0') + dm(S * (1 - P.disp), 'db') + ch('db', '0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0')
      + '<feComposite in="drc" in2="dgc" operator="arithmetic" k2="1" k3="1" result="rg"/><feComposite in="rg" in2="dbc" operator="arithmetic" k2="1" k3="1"/>'
    : map + dm(S, 'd');
  el.style.backdropFilter = `blur(${P.blur}px) saturate(${P.sat}) brightness(${P.bright}) url(#${id})`;
}
export const hex = (h) => { const n = parseInt(h.slice(1), 16); return `${n >> 16},${(n >> 8) & 255},${n & 255}`; };
export const phones = [];
export function paint() {
  for (const ph of phones) {
    const s = ph.style; s.setProperty('--tint', hex(P.tint)); s.setProperty('--tintA', P.tintA); s.setProperty('--bezel', Math.max(2, P.bezel * 0.6)); s.setProperty('--rimA', P.rim); s.setProperty('--glow', P.glow); s.setProperty('--shA', P.shadow); s.setProperty('--fg', '#fff');
    cancelAnimationFrame(ph._raf); ph._raf = requestAnimationFrame(() => ph.querySelectorAll('.g').forEach(refresh));
  }
}


export function resetArt() { seed = 11; Object.keys(ART).forEach((k) => delete ART[k]); }

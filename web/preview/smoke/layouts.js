// Smoke layouts: seven different layouts of the Saved / Item screen, smoked glass. Engine + art come from kit.js.
import { $, P, SMOKE, SLIDERS, state, ic, art, bgDiv, phones, paint, resetArt } from '/preview/smoke/kit.js';

const mode = { v: 'saved' };
const g = (cls, r, style, inner) => `<div class="g ${cls}" data-r="${r}" style="${style}">${inner}</div>`;
const circ = (name, style = '', cls = '') => g(`c press ${cls}`, 'full', style, ic(name));
const status = () => `<div class="dyn"></div><div class="sb"><span>9:41</span><span>5G ▮▮▮</span></div>`;
const TOP = 62;
const NAME = 'Scan 2026-11-20 19:54 service agreement';
const saved = () => mode.v === 'saved';
const topRow = () => `<div class="a row" style="left:16px;right:16px;top:${TOP}px;justify-content:space-between">${circ(saved() ? 'close' : 'back')}${saved() ? '<div style="width:46px"></div>' : circ('trash')}</div>`;
const title = (size = 32, align = 'left') => saved()
  ? `<h1 class="txt-h1" style="font-size:${size}px;line-height:${size + 2}px;letter-spacing:-1.1px;text-align:${align}">Saved!</h1><div class="txt-body" style="margin-top:2px;text-align:${align}">2 files ready to send</div>`
  : `<h1 class="txt-h1" style="font-size:${size - 6}px;line-height:${size - 2}px;letter-spacing:-1.1px;text-align:${align}">${NAME}</h1><div class="txt-body" style="margin-top:2px;text-align:${align}">Nov 20 · 19:54</div>`;
const paper = (w, h, rot = 0, img = art().doc, st = '') => `<div class="paper" style="width:${w}px;height:${h}px;transform:rotate(${rot}deg);flex:none;${st}"><img src="${img}" alt="" style="object-position:top"></div>`;
const APPS = [['WhatsApp', '#CFEBD5', '#1E8E3E', 'W'], ['TikTok', '#D9D9DE', '#202428', 'T'], ['Instagram', '#EBCFE0', '#B03A7A', 'I'], ['Telegram', '#CFE3F4', '#2A7CC0', 'Tg'], ['Facebook', '#CDD8F0', '#2F55B8', 'f']];
const badge = (a, s = 58, fs = 24) => `<div class="badge" style="width:${s}px;height:${s}px;background:${a[1]};color:${a[2]};font-size:${fs}px;font-weight:900">${a[3]}</div>`;
const appRow = (n = 4, more = true) => `<div class="apps">${APPS.slice(0, n).map((a) => `<div class="app">${badge(a)}${a[0]}</div>`).join('')}${more ? `<div class="app">${g('c l press', 'full', '', ic('share', 24))}More</div>` : ''}</div>`;
const chk = (on) => `<div class="chk ${on ? 'on' : ''}">${on ? ic('check', 13, 3, '#fff') : ''}</div>`;
const cta = (extra = '') => g(`cta solid press`, 28, extra, saved() ? ic('scan', 22, 2) + ' Scan another' : ic('share', 22, 2) + ' Share');
const FILES = [['PDF', '214 KB', '#D3BDC9', 'file', 1], ['JPG', '388 KB', '#F2D9A0', 'image', 0]];

const LAYOUTS = [
  ['A. Hero + sheet', 'Page up top as the hero, one glass sheet below with file switch, apps and the action.', () => `${bgDiv('dawn')}${status()}${topRow()}
    <div class="a" style="left:76px;right:76px;top:118px;text-align:center">${title(26, 'center')}</div>
    <div class="a row" style="left:0;right:0;top:${saved() ? 178 : 200}px;justify-content:center">${paper(196, 262, -2)}</div>
    <div class="a" style="left:0;right:0;bottom:0">${g('', 36, 'border-radius:36px 36px 0 0;padding:16px 20px 34px', `
      <div class="seg2">${FILES.map(([t, s, , , on]) => `<div class="o ${on ? 'on' : ''}">${chk(on)}<span>${t}</span><span class="dim" style="font-weight:600">${s}</span></div>`).join('')}</div>
      <div class="lbl" style="margin:16px 4px 12px;color:rgba(255,255,255,.6)">SEND TO</div>${appRow(4)}
      <div style="margin-top:20px">${cta()}</div>`)}</div>`],

  ['B. Cards + dock', 'Document card, a scrolling row of apps, and a floating dock for the action.', () => `${bgDiv('dawn')}${status()}${topRow()}
    <div class="a" style="left:22px;right:22px;top:120px">${title(30)}</div>
    <div class="a" style="left:18px;right:18px;top:${saved() ? 192 : 212}px">${g('', 30, 'padding:16px;display:flex;gap:16px;align-items:center', `${paper(104, 138, -2)}
      <div style="flex:1;min-width:0"><div class="txt-h3 ell">service agreement</div><div class="cap-w" style="margin:2px 0 12px">1 page · 602 KB</div>
      ${FILES.map(([t, s, , i, on]) => g(`press ${on ? 'on' : ''}`, 'full', 'display:flex;align-items:center;gap:8px;height:38px;padding:0 12px;margin-bottom:8px;font-weight:700;font-size:14px', `${ic(i, 16)}<span style="flex:1">${t}</span>${chk(on)}`)).join('')}</div>`)}</div>
    <div class="a lbl" style="left:22px;top:${saved() ? 410 : 430}px">SEND TO</div>
    <div class="a" style="left:0;right:0;top:${saved() ? 438 : 458}px;overflow:hidden"><div class="row" style="padding:0 22px;gap:12px">${APPS.map((a) => g('press', 26, 'width:104px;height:112px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;flex:none', `${badge(a, 50, 21)}<span class="txt-h3" style="font-size:14px">${a[0]}</span>`)).join('')}</div></div>
    <div class="a row" style="left:20px;right:20px;bottom:34px;gap:12px">${cta('flex:1')}${g('c l press', 'full', 'width:56px;height:56px', ic('share', 24))}</div>`],

  ['C. Share sheet', 'iOS-style sheet over a peeking page: header, app row, then action list.', () => `${bgDiv('dawn')}${status()}${topRow()}
    <div class="a row" style="left:0;right:0;top:104px;justify-content:center">${paper(214, 290, -3)}</div>
    <div class="a" style="left:0;right:0;bottom:0;top:262px">${g('', 38, 'border-radius:38px 38px 0 0;height:100%;padding-top:6px', `
      <div class="row" style="padding:16px 20px;gap:14px">${paper(48, 62, 0, art().doc, 'box-shadow:none')}<div style="flex:1;min-width:0"><div class="txt-h3 ell">${saved() ? 'Saved! 2 files' : NAME}</div><div class="cap-w">PDF · JPG · 602 KB</div></div>${g('c s press', 'full', '', ic('close', 18))}</div>
      <div class="hr"></div>
      <div style="padding:16px 20px">${appRow(4)}</div><div class="hr"></div>
      <div class="lrow"><span>Save to Files</span>${ic('download', 24, 1.7)}</div><div class="lrow"><span>Print</span>${ic('file', 24, 1.7)}</div><div class="lrow"><span>Copy link</span>${ic('layers', 24, 1.7)}</div>
      <div style="padding:14px 20px 0">${cta()}</div>`)}</div>`],

  ['D. Floating dock', 'Page and file switch on top, an iOS-dock of apps floating over the backdrop.', () => `${bgDiv('dawn')}${status()}${topRow()}
    <div class="a" style="left:60px;right:60px;top:118px;text-align:center">${title(30, 'center')}</div>
    <div class="a row" style="left:0;right:0;top:${saved() ? 188 : 208}px;justify-content:center">${paper(214, 288, -2)}</div>
    <div class="a row" style="left:0;right:0;top:${saved() ? 512 : 528}px;justify-content:center">${g('seg2', 'full', 'width:336px', FILES.map(([t, s, , , on]) => `<div class="o ${on ? 'on' : ''}" style="justify-content:center">${t}<span class="dim" style="font-weight:600">${s}</span></div>`).join(''))}</div>
    <div class="a row" style="left:18px;right:18px;bottom:112px;justify-content:center">${g('', 42, 'width:100%;height:86px;display:flex;align-items:center;justify-content:space-around;padding:0 10px', APPS.concat([['More', '', '', '']]).map((a, i) => i < 5 ? badge(a, 54, 22) : g('c l press', 'full', '', ic('share', 24))).join(''))}</div>
    <div class="a" style="left:20px;right:20px;bottom:34px">${cta()}</div>`],

  ['E. Fan + tiles', 'Each file as a fanned page, apps as a glass tile grid.', () => `${bgDiv('dawn')}${status()}${topRow()}
    <div class="a" style="left:22px;right:22px;top:118px">${title(30)}</div>
    <div class="a" style="left:0;right:0;top:${saved() ? 186 : 206}px;height:240px">
      <div style="position:absolute;left:62px;top:14px">${paper(150, 200, -7, art().docB)}${g('pill', 'full', 'position:absolute;left:20px;bottom:-12px;height:30px;font-size:13px;padding:0 12px', 'PDF')}</div>
      <div style="position:absolute;left:176px;top:4px">${paper(150, 200, 6)}${g('pill', 'full', 'position:absolute;right:14px;bottom:-8px;height:30px;font-size:13px;padding:0 12px', 'JPG')}</div></div>
    <div class="a lbl" style="left:22px;top:${saved() ? 456 : 476}px">SEND TO</div>
    <div class="a" style="left:22px;right:22px;top:${saved() ? 484 : 504}px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px">${APPS.concat([['More', '', '', '']]).map((a, i) => g('press', 24, 'height:92px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px', `${i < 5 ? badge(a, 44, 19) : `<div style="height:44px;display:grid;place-items:center">${ic('share', 24)}</div>`}<span style="font-size:13px;font-weight:700">${a[0]}</span>`)).join('')}</div>
    <div class="a" style="left:20px;right:20px;bottom:34px">${cta()}</div>`],

  ['F. Centered', 'Everything on one axis: check, title, small page, round apps, two buttons.', () => `${bgDiv('dawn')}${status()}${topRow()}
    <div class="a col" style="left:0;right:0;top:${saved() ? 112 : 126}px;align-items:center">
      ${saved() ? g('c', 'full', 'width:84px;height:84px;margin-bottom:14px', ic('check', 44, 3)) : ''}
      <div style="padding:0 30px">${title(34, 'center')}</div>
      <div style="margin-top:22px">${paper(104, 138, -2)}</div>
      <div class="row" style="gap:8px;margin-top:20px">${FILES.map(([t, , , i, on]) => g(`press chip ${on ? 'on' : ''}`, 'full', 'display:flex;gap:8px;align-items:center;height:36px', `${ic(i, 16)}${t}${chk(on)}`)).join('')}</div></div>
    <div class="a" style="left:22px;right:22px;top:${saved() ? 548 : 568}px"><div class="lbl ctr" style="margin-bottom:12px">SEND TO</div>${appRow(4)}</div>
    <div class="a col" style="left:20px;right:20px;bottom:34px;gap:10px">${cta()}${g('cta press', 28, 'height:50px', saved() ? 'Done' : 'Delete')}</div>`],

  ['G. Menu list', 'One tall glass menu, like the Notes menu you sent: file switch up top, apps as rows.', () => `${bgDiv('dawn')}${status()}${topRow()}
    <div class="a row" style="left:22px;right:22px;top:118px;gap:16px;align-items:center">${paper(78, 104, -2)}<div style="flex:1;min-width:0">${title(26)}</div></div>
    <div class="a" style="left:18px;right:18px;top:${saved() ? 252 : 270}px">${g('', 32, 'padding:6px 0', `
      <div class="row" style="justify-content:space-around;padding:16px 8px 14px">${FILES.map(([t, s, , i, on]) => `<div class="col" style="align-items:center;gap:6px">${g(`c l press ${on ? 'on' : ''}`, 'full', '', ic(i, 24))}<span style="font-size:12px;font-weight:700">${t} · ${s}</span></div>`).join('')}<div class="col" style="align-items:center;gap:6px">${g('c l press', 'full', '', ic('wand', 24))}<span style="font-size:12px;font-weight:700">Enhance</span></div></div>
      <div class="hr"></div>
      ${APPS.map((a) => `<div class="lrow"><span>${a[0]}</span>${badge(a, 34, 15)}</div>`).join('')}
      <div class="lrow"><span>More apps…</span>${ic('share', 24, 1.7)}</div>`)}</div>
    <div class="a" style="left:20px;right:20px;bottom:34px">${cta()}</div>`],
];

const stage = $('#stage');
function render() {
  stage.innerHTML = ''; phones.length = 0; resetArt();
  LAYOUTS.forEach(([name, note, build], i) => {
    const slot = document.createElement('div'); slot.className = 'slot'; slot.id = 'scr' + i;
    slot.innerHTML = `<h4>${name}<small>${note}</small></h4><div class="phone">${build()}</div>`; stage.appendChild(slot); phones.push($('.phone', slot));
  });
  paint(); document.fonts.ready.then(paint);
}
function ui() {
  $('#jump').innerHTML = LAYOUTS.map(([n], i) => `<button data-i="${i}">${n.split('.')[0]}</button>`).join('');
  $('#jump').onclick = (e) => { const b = e.target.closest('button'); if (b) document.getElementById('scr' + b.dataset.i).scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' }); };
  const seg = (el, items, cur, on) => { el.innerHTML = Object.entries(items).map(([k, v]) => `<button data-k="${k}" class="${k === cur ? 'on' : ''}">${v}</button>`).join(''); el.onclick = (e) => { const b = e.target.closest('button'); if (b) on(b.dataset.k); }; };
  seg($('#modeSeg'), { saved: 'Saved', item: 'Item' }, mode.v, (k) => { mode.v = k; ui(); render(); });
  seg($('#bdSeg'), { original: 'Original', scenic: 'Scenic', night: 'Night' }, state.bd, (k) => { state.bd = k; ui(); render(); });
  $('#sliders').innerHTML = SLIDERS.map(([k, l, mn, mx, st]) => `<label class="sl">${l}<input type="range" data-k="${k}" min="${mn}" max="${mx}" step="${st}" value="${P[k]}"><output>${(+P[k]).toFixed(st < 0.01 ? 3 : st < 1 ? 2 : 0)}</output></label>`).join('') + `<label class="sl">Tint<input type="color" data-k="tint" value="${P.tint}"></label>`;
  $('#sliders').oninput = (e) => { const k = e.target.dataset.k; if (!k) return; P[k] = k === 'tint' ? e.target.value : +e.target.value; const o = e.target.parentElement.querySelector('output'); if (o) { const st = SLIDERS.find((s) => s[0] === k)[4]; o.textContent = P[k].toFixed(st < 0.01 ? 3 : st < 1 ? 2 : 0); } paint(); };
}
$('#reset').onclick = () => { Object.assign(P, SMOKE); ui(); paint(); };
$('#copy').onclick = async () => { const t = JSON.stringify(P, null, 2); try { await navigator.clipboard.writeText(t); $('#copy').textContent = 'Copied'; setTimeout(() => ($('#copy').textContent = 'Copy params'), 1200); } catch { prompt('Params', t); } };
const q = new URLSearchParams(location.search); if (q.get('bd')) state.bd = q.get('bd'); if (q.get('mode')) mode.v = q.get('mode');
ui(); render();

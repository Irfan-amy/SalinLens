// Smoke screens: a standalone mock of every SalinLens screen in smoked liquid glass (engine + art live in kit.js).
import { $, P, SMOKE, SLIDERS, state, ic, art, bgDiv, cropOverlay, phones, paint, resetArt } from '/preview/smoke/kit.js';

// ---------- screen builders ----------
const g = (cls, r, style, inner) => `<div class="g ${cls}" data-r="${r}" style="${style}">${inner}</div>`;
const circ = (name, style = '', cls = '') => g(`c press ${cls}`, 'full', style, ic(name));
const status = (w) => `<div class="dyn"></div><div class="sb ${w ? 'w' : ''}"><span>9:41</span><span>5G ▮▮▮</span></div>`;
const TOP = 62;
const topRow = (l, r = '', mid = '') => `<div class="a row" style="left:16px;right:16px;top:${TOP}px;justify-content:space-between">${l}${mid}${r || '<div style="width:46px"></div>'}</div>`;
const files = (sel) => [['PDF', '214 KB', '#D3BDC9', 'file'], ['JPG', '388 KB', '#F2D9A0', 'image']].map(([t, s, tint, i], k) => g(`press ${sel[k] ? 'on' : ''}`, 20, 'display:flex;align-items:center;padding:8px 12px;margin-bottom:8px', `<div class="badge" style="width:30px;height:30px;background:${tint};color:#202428">${ic(i, 16)}</div><div style="flex:1;margin-left:10px"><div class="txt-h3" style="font-size:15px">${t}</div><div class="cap-w">${s}</div></div><div class="chk ${sel[k] ? 'on' : ''}">${sel[k] ? ic('check', 13, 3, '#fff') : ''}</div>`)).join('');
const shareBlock = (top) => `
  <div class="a lbl" style="left:22px;top:${top}px">SEND TO</div>
  <div class="a row" style="left:22px;right:22px;top:${top + 28}px;justify-content:space-between;align-items:flex-start">
    ${[['WhatsApp', '#CFEBD5', '#1E8E3E', 'W', -9, 14], ['TikTok', '#D9D9DE', '#202428', 'T', 0, 0], ['Instagram', '#EBCFE0', '#B03A7A', 'I', 9, 14]].map(([n, tint, ink, gl, rot, dy]) => g('press', 28, `width:31%;height:116px;display:flex;flex-direction:column;align-items:center;justify-content:center;transform:translateY(${dy}px) rotate(${rot}deg)`, `<div class="badge" style="width:54px;height:54px;background:${tint};color:${ink};font-size:24px;font-weight:900">${gl}</div><div class="txt-h3" style="margin-top:12px;font-size:14px">${n}</div>`)).join('')}
  </div>
  <div class="a row" style="left:22px;top:${top + 170}px;gap:10px">${g('press chip', 22, 'height:44px', 'Telegram')}${g('press chip', 22, 'height:44px', 'Facebook')}${g('press chip solid', 22, 'height:44px;display:flex;gap:8px', ic('share', 18) + ' More apps…')}</div>`;

const SCREENS = [
  ['Splash', () => `${bgDiv('dawn')}${status()}
    <div class="a col" style="left:0;right:0;top:0;bottom:0;align-items:center;justify-content:center">
      ${g('', 34, 'width:104px;height:104px;display:grid;place-items:center', ic('scan', 56, 2.1))}
      <h1 class="txt-h1" style="margin-top:28px;font-size:42px;line-height:44px;letter-spacing:-2px">SalinLens</h1>
      ${g('pill', 'full', 'margin-top:14px;height:36px;font-weight:600', 'Scan it. Tidy it. Send it.')}
    </div>
    <div class="a row" style="left:0;right:0;bottom:72px;justify-content:center">${[0, 1, 2].map((i) => `<i style="width:7px;height:7px;border-radius:4px;background:#202428;margin:0 4px;opacity:${0.35 + i * 0.2}"></i>`).join('')}</div>`],

  ['Camera', () => `${bgDiv('camera')}${state.bd === 'original' ? cropOverlay({ q: art().cam.q, h: 844 }) : ''}${status(true)}
    ${topRow(circ('flash'), circ('image'), g('pill', 'full', '', '<i class="dot"></i>Page found'))}
    <div class="a row" style="left:28px;right:28px;bottom:44px;justify-content:space-between">
      <div style="position:relative">${g('press', 20, 'width:58px;height:58px;overflow:hidden', `<img src="${art().doc}" style="width:100%;height:100%;object-fit:cover;opacity:.9;border-radius:inherit">`)}<div class="badge" style="position:absolute;right:-4px;top:-4px;min-width:20px;height:20px;background:#fff;color:#111;font-size:11px;font-weight:800;z-index:5">3</div></div>
      ${g('press', 'full', 'width:98px;height:98px;display:grid;place-items:center;box-shadow:0 0 0 0 transparent', '<i style="width:70px;height:70px;border-radius:50%;background:#fff;box-shadow:0 2px 12px rgba(0,0,0,.35)"></i>')}
      <div style="width:58px"></div>
    </div>`],

  ['Adjust', () => `${bgDiv('warm')}${status()}
    <div class="a photo" style="left:0;right:0;top:${TOP - 52 + 70}px;height:524px;background:#000;overflow:hidden"><img src="${art().adj.url}" alt="">${cropOverlay({ q: art().adj.q, h: 524 })}</div>
    ${topRow(circ('back'), '', g('pill', 'full', 'max-width:244px', '<i class="dot"></i><span class="ell">Edges found — fine-tune</span>'))}
    <div class="a" style="left:0;right:0;bottom:0">${g('', 34, 'border-radius:34px 34px 0 0;padding:20px 20px 34px', `
      <div class="row" style="justify-content:space-between;margin-bottom:16px">${[['rotate', 'Rotate'], ['wand', 'Auto-fit'], ['crop', 'Full page'], ['back', 'Reset']].map(([i, t]) => `<div class="col" style="align-items:center;width:72px">${g('c l press', 'full', '', ic(i, 24))}<div class="cap-w" style="margin-top:6px">${t}</div></div>`).join('')}</div>
      ${g('cta solid press', 28, '', 'Continue ' + ic('chevron', 20, 2.6))}`)}</div>`],

  ['Save as', () => `${bgDiv('warm')}${status()}
    ${topRow(circ('back'), '', '')}<div class="a txt-h2" style="left:78px;top:${TOP + 9}px">Save as</div>
    <div class="a row" style="left:0;right:0;top:124px;height:316px;justify-content:center"><div class="paper" style="width:226px;height:300px"><img src="${art().doc}" alt=""></div></div>
    <div class="a" style="left:0;right:0;top:454px;height:40px;overflow:hidden"><div class="row" style="padding-left:20px;gap:8px">${['Auto', 'Magic', 'Scanner', 'Lighten', 'Crisp', 'Eco'].map((m, i) => g(`press chip ${i === 0 ? 'solid' : ''}`, 19, '', m)).join('')}</div></div>
    <div class="a lbl" style="left:20px;top:514px">FILE NAME</div>
    <div class="a" style="left:20px;right:20px;top:536px">${g('field', 28, '', 'Scan 2026-11-20 19:54')}</div>
    <div class="a lbl" style="left:20px;top:612px">FILE TYPES · pick any</div>
    <div class="a row" style="left:20px;right:20px;top:636px;justify-content:space-between;align-items:stretch">${[['PDF', 'Best to share', '#D3BDC9', 'file', 1], ['JPG', 'Small size', '#F2D9A0', 'image', 0], ['PNG', 'Lossless', '#B8DCE2', 'layers', 0]].map(([t, h, tint, i, on]) => g(`press ${on ? 'on' : ''}`, 28, 'width:31.5%;padding:14px 12px;position:relative', `<div class="badge" style="width:38px;height:38px;background:${tint};color:#202428">${ic(i, 20)}</div><div class="txt-h3" style="margin-top:12px">${t}</div><div class="cap-w" style="margin-top:2px">${h}</div><div class="chk ${on ? 'on' : ''}" style="position:absolute;right:10px;top:10px;width:24px;height:24px">${on ? ic('check', 14, 3, '#fff') : ''}</div>`)).join('')}</div>
    <div class="a" style="left:20px;right:20px;bottom:34px">${g('cta solid press', 28, '', ic('download', 22, 2) + ' Save 1 file')}</div>`],

  ['Saved', () => `${bgDiv('dawn')}${status()}
    ${topRow(circ('close'), '', '')}
    <div class="a row" style="left:22px;right:22px;top:128px">${g('c', 'full', 'width:54px;height:54px;margin-right:14px', ic('check', 28, 3))}<div><h1 class="txt-h1" style="font-size:32px;line-height:34px;letter-spacing:-1.1px">Saved!</h1><div class="txt-body" style="margin-top:2px">2 files ready to send</div></div></div>
    <div class="a row" style="left:22px;right:22px;top:222px;align-items:center"><div class="paper" style="width:112px;height:112px;margin-right:14px;transform:rotate(-2deg);flex:none"><img src="${art().doc}" alt="" style="object-position:top"></div><div style="flex:1">${files([1, 0])}</div></div>
    ${shareBlock(392)}
    <div class="a" style="left:20px;right:20px;bottom:34px">${g('cta solid press', 28, '', ic('scan', 22, 2) + ' Scan another')}</div>`],

  ['Item', () => `${bgDiv('dawn')}${status()}
    ${topRow(circ('back'), circ('trash'), '')}
    <div class="a" style="left:22px;right:22px;top:126px"><h1 class="txt-h1" style="font-size:26px;line-height:30px;letter-spacing:-1.1px">Scan 2026-11-20 19:54 service agreement</h1><div class="txt-body" style="margin-top:2px">Nov 20 · 19:54</div></div>
    <div class="a row" style="left:22px;right:22px;top:218px;align-items:center"><div class="paper" style="width:112px;height:150px;margin-right:14px;transform:rotate(-2deg);flex:none"><img src="${art().doc}" alt=""></div><div style="flex:1">${files([1, 0])}</div></div>
    ${shareBlock(404)}`],

  ['Gallery', () => `${bgDiv('dawn')}${status()}
    ${topRow(circ('back'), '', '')}
    <div class="a" style="left:78px;top:${TOP - 4}px"><div class="txt-h2">Your scans</div><div class="txt-cap">3 saved on this phone</div></div>
    <div class="a" style="left:18px;right:18px;top:132px;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px;align-items:start">
      ${[['Scan 2026-11-20 19:56 a very long name', 'Nov 20 · 19:56', art().doc, ['PDF']], ['Scan 2026-11-20 19:54', 'Nov 20 · 19:54', art().docB, ['PDF', 'JPG']], ['Scan 2026-11-20 19:50', 'Nov 20 · 19:50', art().docC, ['PDF']]].map(([n, d, img, f]) => g('press', 28, 'padding:8px 8px 12px', `<div style="height:172px;border-radius:20px;overflow:hidden;background:#222"><img src="${img}" alt="" style="width:100%;height:100%;object-fit:cover;object-position:top"></div><div class="txt-h3 ell" style="margin:10px 6px 0;font-size:14.5px">${n}</div><div class="cap-w" style="margin:2px 6px 0">${d}</div><div class="row" style="margin:6px 6px 0">${f.map((t) => `<span class="tag" style="background:rgba(255,255,255,.2)">${t}</span>`).join('')}</div>`)).join('')}
    </div>`],
];

// ---------- page ----------
const stage = $('#stage');
function render() {
  stage.innerHTML = ''; phones.length = 0; resetArt();
  SCREENS.forEach(([name, build], i) => {
    const slot = document.createElement('div'); slot.className = 'slot'; slot.id = 'scr' + i;
    slot.innerHTML = `<h4>${i + 1}. ${name}</h4><div class="phone">${build()}</div>`; stage.appendChild(slot); phones.push($('.phone', slot));
  });
  paint(); document.fonts.ready.then(paint);
}
function ui() {
  $('#jump').innerHTML = SCREENS.map(([n], i) => `<button data-i="${i}">${n}</button>`).join('');
  $('#jump').onclick = (e) => { const b = e.target.closest('button'); if (b) document.getElementById('scr' + b.dataset.i).scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' }); };
  const bd = { original: 'Original', scenic: 'Scenic', night: 'Night' };
  $('#bdSeg').innerHTML = Object.entries(bd).map(([k, v]) => `<button data-k="${k}" class="${k === state.bd ? 'on' : ''}">${v}</button>`).join('');
  $('#bdSeg').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; state.bd = b.dataset.k; ui(); render(); };
  $('#sliders').innerHTML = SLIDERS.map(([k, l, mn, mx, st]) => `<label class="sl">${l}<input type="range" data-k="${k}" min="${mn}" max="${mx}" step="${st}" value="${P[k]}"><output>${(+P[k]).toFixed(st < 0.01 ? 3 : st < 1 ? 2 : 0)}</output></label>`).join('') + `<label class="sl">Tint<input type="color" data-k="tint" value="${P.tint}"></label>`;
  $('#sliders').oninput = (e) => { const k = e.target.dataset.k; if (!k) return; P[k] = k === 'tint' ? e.target.value : +e.target.value; const o = e.target.parentElement.querySelector('output'); if (o) { const st = SLIDERS.find((s) => s[0] === k)[4]; o.textContent = P[k].toFixed(st < 0.01 ? 3 : st < 1 ? 2 : 0); } paint(); };
}
$('#reset').onclick = () => { Object.assign(P, SMOKE); ui(); paint(); };
$('#copy').onclick = async () => { const t = JSON.stringify(P, null, 2); try { await navigator.clipboard.writeText(t); $('#copy').textContent = 'Copied'; setTimeout(() => ($('#copy').textContent = 'Copy params'), 1200); } catch { prompt('Params', t); } };
const q = new URLSearchParams(location.search); if (q.get('bd')) state.bd = q.get('bd');
ui(); render();

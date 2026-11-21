// Page-side audits shared by test.mjs and stress.mjs. Everything here runs inside the page (page.evaluate), so it must stay self-contained.
/** Runs inside the page. Walks every shadow root, returns problems found on the current screen. */
export function inspect(frameSel) {
  const frame = document.querySelector(frameSel).getBoundingClientRect();
  let all = [];
  (function walk(root) { for (const el of root.querySelectorAll('*')) { all.push(el); if (el.shadowRoot) walk(el.shadowRoot); } })(document);
  // Screens stack on top of each other; only inspect the top one (last non-leaving child of the root).
  const rootEl = all.find((e) => e.classList?.contains('bg-dawn'));
  const entries = rootEl ? [...rootEl.children].filter((c) => !c.className.includes('a-leave')) : [];
  const top = entries[entries.length - 1];
  if (top) all = all.filter((e) => top.contains(e));
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05; };
  const label = (el) => (el.textContent || el.getAttribute('name') || el.className || el.tagName).toString().trim().slice(0, 40);
  const issues = [];
  // how many of 9 sample points of el show el itself on top (0 = completely hidden behind something, e.g. under a full-screen overlay)
  const shown = (el) => { const r = visRect(el); if (!r) return 0; let n = 0; for (const fx of [.2, .5, .8]) for (const fy of [.2, .5, .8]) { const t = topAt(r.left + r.width * fx, r.top + r.height * fy); if (t && el.contains(t)) n++; } return n; };
  // rect of the part of el that is actually on screen (clipped by scroll-view ancestors); null when fully scrolled out
  const visRect = (el, base) => {
    let r = base || el.getBoundingClientRect(); let l = r.left, t = r.top, rt = r.right, b = r.bottom;
    for (let n = el.parentNode || el.host; n; n = n.parentNode || n.host) {
      if (isScroller(n)) { const s = n.getBoundingClientRect(); l = Math.max(l, s.left); t = Math.max(t, s.top); rt = Math.min(rt, s.right); b = Math.min(b, s.bottom); }
    }
    return rt - l > 0 && b - t > 0 ? { left: l, top: t, right: rt, bottom: b, width: rt - l, height: b - t } : null;
  };
  const texts = all.filter((e) => e.tagName === 'X-TEXT' && vis(e) && e.textContent.trim());
  const trect = (el) => { const cs = getComputedStyle(el); if (cs.textOverflow === 'ellipsis' && cs.overflow !== 'visible') return el.getBoundingClientRect(); const r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect(); };
  const isScroller = (n) => n.nodeType === 1 && (n.tagName === 'SCROLL-VIEW' || (/LIST/.test(n.tagName) && !/ITEM/.test(n.tagName)));
  const inScroll = (el) => { for (let n = el; n; n = n.parentNode || n.host) if (isScroller(n)) return true; return false; };
  // what the user actually sees on top at a point (walks into shadow roots)
  const topAt = (x, y) => { let root = document, el = null; for (;;) { const e = root.elementFromPoint(x, y); if (!e || e === el) break; el = e; if (e.shadowRoot) root = e.shadowRoot; else break; } return el; };
  const hiddenAncestors = (el) => { const a = []; for (let n = el.parentNode || el.host; n; n = n.parentNode || n.host) { if (n.nodeType === 1 && getComputedStyle(n).overflow !== 'visible') a.push(n); } return a; };

  for (const el of texts) {
    const tr = trect(el); const cs = getComputedStyle(el);
    // 1. wider/taller than its own box and clipped
    const ell = cs.textOverflow === 'ellipsis' && cs.overflow !== 'visible';
    if (cs.overflow !== 'visible' && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)) {
      issues.push({ kind: cs.textOverflow === 'ellipsis' ? 'ellipsis' : 'clipped', text: label(el), note: `scroll ${el.scrollWidth}x${el.scrollHeight} > box ${el.clientWidth}x${el.clientHeight}` });
    }
    // 2. text pushed outside an ancestor that clips it
    for (const a of (ell || inScroll(el) ? [] : hiddenAncestors(el))) {
      if (isScroller(a)) continue;
      const ar = a.getBoundingClientRect();
      if (ar.width > 0 && (tr.right > ar.right + 1.5 || tr.left < ar.left - 1.5 || tr.bottom > ar.bottom + 1.5 || tr.top < ar.top - 1.5) && !(tr.width === 0)) {
        issues.push({ kind: 'clipped', text: label(el), note: `text ${Math.round(tr.left)}..${Math.round(tr.right)} vs clip box ${Math.round(ar.left)}..${Math.round(ar.right)}` }); break;
      }
    }
    // 3. off screen
    if (!inScroll(el) && !ell && (tr.right > frame.right + 1.5 || tr.left < frame.left - 1.5 || tr.bottom > frame.bottom + 1.5)) issues.push({ kind: 'offscreen', text: label(el), note: `${Math.round(tr.left - frame.left)}..${Math.round(tr.right - frame.left)} of ${frame.width}` });
  }
  // 4. text lines drawn over each other
  for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
    const a = texts[i], b = texts[j]; if (a.contains(b) || b.contains(a)) continue;
    const ra = visRect(a, trect(a)), rb = visRect(b, trect(b)); if (!ra || !rb) continue; const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left); const h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
    if (w > 3 && h > 3) issues.push({ kind: 'overlap', text: `${label(a)} / ${label(b)}`, note: `${Math.round(w)}x${Math.round(h)}px` });
  }
  // 5. tappable things sitting on top of each other (e.g. chips hidden under a button)
  const press = all.filter((e) => e.classList?.contains('press') && vis(e));
  for (let i = 0; i < press.length; i++) for (let j = i + 1; j < press.length; j++) {
    const a = press[i], b = press[j]; if (a.contains(b) || b.contains(a)) continue;
    const ra = visRect(a), rb = visRect(b); if (!ra || !rb || !shown(a) || !shown(b)) continue; const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left); const h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
    const cx = Math.max(ra.left, rb.left) + w / 2, cy = Math.max(ra.top, rb.top) + h / 2; const tp = w > 6 && h > 6 ? topAt(cx, cy) : null;
    if (tp && (a.contains(tp) || b.contains(tp))) issues.push({ kind: 'overlap', text: `${label(a)} / ${label(b)}`, note: `buttons overlap ${Math.round(w)}x${Math.round(h)}px` });
  }
  // 6. text/inputs sitting underneath a button, and small controls sliced in half by a scroll area
  const under = all.filter((e) => (e.tagName === 'X-INPUT' || e.tagName === 'INPUT' || e.tagName === 'X-TEXT') && vis(e));
  for (const el of under) {
    const r = el.getBoundingClientRect(); if (r.width < 2) continue;
    for (const p of press) {
      if (p.contains(el) || el.contains(p)) continue;
      const pr = p.getBoundingClientRect(); const w = Math.min(r.right, pr.right) - Math.max(r.left, pr.left); const h = Math.min(r.bottom, pr.bottom) - Math.max(r.top, pr.top);
      if (w > 6 && h > 4 && el.tagName !== 'X-TEXT') issues.push({ kind: 'covered', text: label(el) || el.tagName, note: `${el.tagName.toLowerCase()} hidden ${Math.round(h)}px under "${label(p)}"` });
    }
  }
  const slicable = [...press, ...all.filter((e) => e.tagName === 'INPUT' && vis(e))];
  for (const p of slicable) {
    const pr = p.getBoundingClientRect(); if (pr.height > 64 || !inScroll(p)) continue;
    for (let n = p.parentNode || p.host; n; n = n.parentNode || n.host) {
      if (isScroller(n)) { const sr = n.getBoundingClientRect(); const cut = Math.max(0, pr.bottom - sr.bottom) + Math.max(0, sr.top - pr.top);
        if (cut > 2 && cut < pr.height - 2 && pr.width > 0 && sr.width < frame.width + 1 && n.scrollHeight > n.clientHeight + 2 && getComputedStyle(n).overflowY !== 'hidden') issues.push({ kind: 'sliced', text: label(p) || (p.getAttribute('placeholder') || p.tagName), note: `${Math.round(cut)}px of ${Math.round(pr.height)}px cut off by scroll area` }); break; }
    }
  }
  const seen = new Set(); return issues.filter((x) => { const k = x.kind + x.text + x.note; if (seen.has(k)) return false; seen.add(k); return true; });
}


/** Every interactive thing (.press / input) on the TOP screen that a finger can actually reach must be what's on top at its centre. */
export function tappables(frameSel) {
  const frame = document.querySelector(frameSel).getBoundingClientRect();
  const all = []; (function walk(root) { for (const el of root.querySelectorAll('*')) { all.push(el); if (el.shadowRoot) walk(el.shadowRoot); } })(document);
  const rootEl = all.find((e) => e.classList?.contains('bg-dawn'));
  const live = rootEl ? [...rootEl.children].filter((c) => !c.className.includes('a-leave')) : [];
  const top = live[live.length - 1];
  const isScroller = (n) => n.nodeType === 1 && (n.tagName === 'SCROLL-VIEW' || (/LIST/.test(n.tagName) && !/ITEM/.test(n.tagName)));
  const topAt = (x, y) => { let root = document, el = null; for (;;) { const e = root.elementFromPoint(x, y); if (!e || e === el) break; el = e; if (e.shadowRoot) root = e.shadowRoot; else break; } return el; };
  const shown = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const clip = (el) => {
    const r = el.getBoundingClientRect(); let l = Math.max(r.left, frame.left), t = Math.max(r.top, frame.top), rt = Math.min(r.right, frame.right), b = Math.min(r.bottom, frame.bottom);
    for (let n = el.parentNode || el.host; n; n = n.parentNode || n.host) { if (isScroller(n)) { const s = n.getBoundingClientRect(); l = Math.max(l, s.left); t = Math.max(t, s.top); rt = Math.min(rt, s.right); b = Math.min(b, s.bottom); } }
    return rt - l > 4 && b - t > 4 ? { l, t, r: rt, b } : null;
  };
  const name = (el) => (el.textContent || '').trim().slice(0, 28) || [...el.querySelectorAll('salin-icon')].map((i) => 'icon:' + i.getAttribute('name')).join(',') || el.className.toString().slice(0, 24);
  const blocked = [];
  if (top) for (const el of all) {
    if (!top.contains(el) || !(el.classList?.contains('press') || el.tagName === 'X-INPUT')) continue;
    // a node whose own opacity animation hasn't started / is faded out is not a target
    let hidden = false; for (let n = el; n && n !== top; n = n.parentNode || n.host) if (n.nodeType === 1 && (+getComputedStyle(n).opacity < 0.05 || getComputedStyle(n).visibility === 'hidden')) hidden = true;
    if (hidden || !shown(el)) continue;
    const c = clip(el); if (!c) continue;
    const t = topAt((c.l + c.r) / 2, (c.t + c.b) / 2);
    const rel = (a, b) => { for (let n = a; n; n = n.parentNode || n.host) if (n === b) return true; return false; };
    if (!(t && (rel(t, el) || rel(el, t)))) blocked.push({ what: name(el), by: t ? `${t.tagName.toLowerCase()}.${(t.className || '').toString().slice(0, 30)} "${(t.textContent || '').trim().slice(0, 20)}"` : 'nothing' });
  }
  return { depth: live.length, blocked, spinning: top ? [...top.querySelectorAll('.spin')].filter(shown).length : 0 };
}

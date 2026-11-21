import { useCallback, useEffect, useRef, useState } from '@lynx-js/react';
import { native, rotQuad } from '../native.js';
import type { Page, Quad } from '../native.js';
import { useEnv, useNav, useReady } from '../nav.js';
import { CircleBtn, Icon, Press } from '../ui.js';

// One screen for the whole scan session: live camera and the crop editor share the page, with a strip of
// the pages captured so far. The strip's "+" tile is camera mode; tapping a page opens it for adjusting.
const FULL: Quad = [0.03, 0.03, 0.97, 0.03, 0.97, 0.97, 0.03, 0.97];
const SMOKE_TXT = '#FBF7F0';
const CAM = -1; // `sel` value for camera mode

let pageId = 1;

export function Scan() {
  const env = useEnv();
  const nav = useNav();
  const ready = useReady();
  const [perm, setPerm] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [torch, setTorch] = useState(false);
  const [hot, setHot] = useState(false);
  const [busy, setBusy] = useState(false);
  const [camBad, setCamBad] = useState(false);
  const [camKey, setCamKey] = useState(0);
  const [flash, setFlash] = useState(0);
  useEffect(() => { if (flash === 0) return; const t = setTimeout(() => setFlash(0), 360); return () => clearTimeout(t); }, [flash]);
  const [count, setCount] = useState(0);
  const [toast, setToast] = useState('');
  const [pages, setPages] = useState<Page[]>([]);
  const [sel, setSel] = useState(CAM);
  const [grab, setGrab] = useState(false);
  const [touched, setTouched] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [msg, setMsg] = useState('');
  const pagesRef = useRef(pages); pagesRef.current = pages;
  const selRef = useRef(sel); selRef.current = sel;
  const lastBack = useRef(0);

  const ask = useCallback((prompt: boolean) => {
    native.cameraPermission(prompt).then((r) => { setPerm(r.granted ? 'granted' : 'denied'); ready(); }).catch(() => { setPerm('denied'); ready(); });
  }, []);
  useEffect(() => { ask(true); }, []);
  useEffect(() => {
    const em = lynx.getJSModule('GlobalEventEmitter');
    const h = (...a: unknown[]) => { setBusy(true); addPage(String(a[0]), true); };
    const g = (...a: unknown[]) => { if (String(a[0]) === 'gallery') nav.push({ name: 'gallery' }); }; // debug-only hook (driven by `am start --es nav gallery`)
    const s = (...a: unknown[]) => select(Number(a[0]) - 1); // debug-only hook: open page N (1-based; 0 = camera)
    const go = (...a: unknown[]) => { // debug-only hook (web UI board): jump straight to export / item / saved using the newest gallery item
      native.gallery().then((r) => {
        const it = r.items[0]; if (!it) return;
        const k = String(a[0]);
        if (k === 'export') nav.push({ name: 'export', pages: [{ path: it.files[0].path, quad: FULL }] });
        else if (k === 'item' || k === 'saved') nav.push({ name: 'item', item: it, saved: k === 'saved' });
      }).catch(() => {});
    };
    em.addListener('salinOpenImage', h); em.addListener('salinNav', g); em.addListener('salinSelect', s); em.addListener('salinGo', go);
    return () => { em.removeListener('salinOpenImage', h); em.removeListener('salinNav', g); em.removeListener('salinSelect', s); em.removeListener('salinGo', go); };
  }, []);
  useEffect(() => {
    if (!nav.top) return;
    native.gallery().then((g) => setCount(g.items.length)).catch(() => {});
  }, [nav.top]);

  // hardware back / "scan finished" come from the app shell
  nav.root.current.back = () => {
    if (selRef.current !== CAM) { select(CAM); return true; }
    if (pagesRef.current.length > 0 && Date.now() - lastBack.current > 2500) { lastBack.current = Date.now(); say('Press back again to discard this scan'); return true; }
    return false;
  };
  nav.root.current.clear = () => { setPages([]); setSel(CAM); };

  const say = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2200); };

  const select = (i: number) => {
    setSel(i); setGrab(false); setTouched(false); native.haptic('tick');
    const pg = pagesRef.current[i];
    setMsg(pg ? (pg.found ? 'Edges found' : 'No edges — drag corners') : '');
  };
  const patch = (i: number, o: Partial<Page>) => setPages((ps) => ps.map((p, k) => (k === i ? { ...p, ...o } : p)));

  const addPage = async (path: string, open: boolean) => {
    try {
      const d = await native.detect(path);
      const pg: Page = { id: pageId++, path, quad: d.quad, detected: d.found ? d.quad : null, found: d.found };
      const at = pagesRef.current.length;
      setPages((ps) => [...ps, pg]);
      if (open) { setSel(at); setGrab(false); setTouched(false); setMsg(d.found ? 'Edges found' : 'No edges — drag corners'); }
    } catch (e) { say('Could not open that photo'); }
    setBusy(false);
  };

  const shoot = async () => {
    if (busy || perm !== 'granted' || camBad) return;
    setBusy(true); setFlash((n) => n + 1); native.haptic('heavy');
    try { const r = await native.capture(); await addPage(r.path, false); native.haptic('tick'); } catch (e) { setBusy(false); say('Capture failed, try again'); }
  };
  const pick = async () => {
    if (busy) return;
    try { const r = await native.pickImage(); if (r.path) { setBusy(true); await addPage(r.path, true); } } catch (e) { say('Could not import'); }
  };

  // ---- adjust tools (act on the selected page)
  const pg = sel >= 0 ? pages[sel] : undefined;
  const rotate = async () => {
    if (!pg || rotating) return; setRotating(true);
    const at = sel;
    try { const r = await native.rotate(pg.path, pg.quad); patch(at, { path: r.path, quad: r.quad, detected: pg.detected ? rotQuad(pg.detected) : null }); } catch (_) { /* keep */ }
    setRotating(false);
  };
  const autoFit = async () => {
    if (!pg) return; const at = sel;
    native.haptic('tap'); setMsg('Looking again…');
    try {
      const d = await native.detect(pg.path);
      if (d.found) { patch(at, { quad: d.quad, detected: d.quad, found: true }); setMsg('Snapped to the page'); native.haptic('success'); } else setMsg('No edge — try Full page');
    } catch (_) { setMsg('Something went wrong'); }
  };
  const fullPage = () => { if (!pg) return; patch(sel, { quad: FULL }); setTouched(false); setMsg('Whole photo selected'); };
  const resetQuad = () => { if (pg?.detected) { patch(sel, { quad: pg.detected }); setTouched(false); } };
  const removePage = () => {
    if (!pg) return; native.haptic('heavy');
    const left = pages.filter((_, k) => k !== sel);
    setPages(left); setGrab(false);
    if (left.length === 0) setSel(CAM); else select(Math.min(sel, left.length - 1));
  };

  // ---- layout
  const compact = env.h < 680;
  const tw = compact ? 44 : 52, th = compact ? 56 : 66; // strip tile
  const rowH = compact ? 72 : 84;                         // shutter / tool row
  const cH = compact ? 50 : 56;                           // Continue
  const cell = Math.floor((env.w - 40) / 5);              // gallery + 4 tools share the sheet width
  const bs = Math.min(compact ? 44 : 50, cell - 8);
  const sheetH = 14 + (th + 8) + 12 + rowH + (pages.length > 0 ? cH + 12 : 0) + env.bottom + 14;
  const tight = env.h - sheetH - env.top < 330; // little room above the sheet (small phone + page strip): drop the icon from the camera-unavailable card
  const editing = sel >= 0 && pg !== undefined;
  const status = busy ? (editing ? 'Working…' : 'Finding the edges…') : editing ? (touched ? 'Looks good' : msg) : hot ? 'Page found' : pages.length ? 'Add another page' : 'Point at a page';

  return (
    <view className="screen" style={{ backgroundColor: '#101214' }}>
      <salin-camera key={camKey} className="screen" bindcamerastate={(e) => setCamBad(!e.detail.ok)} active={perm === 'granted' && nav.top && !editing} torch={torch} binddetected={(e) => { if (e.detail.value !== hot) { setHot(e.detail.value); if (e.detail.value) native.haptic('tick'); } }} />

      {/* adjust mode: the selected page and its corner handles cover the viewfinder */}
      {editing && (
        <view className="screen bg-warm">
          <view style={{ position: 'absolute', left: '0px', right: '0px', top: `${env.top + 10}px`, bottom: `${sheetH + 4}px` }}>
            <salin-crop key={pg!.id} style={{ width: '100%', height: '100%' }} src={pg!.path} quad={JSON.stringify(pg!.quad)}
              bindchange={(e) => { patch(sel, { quad: JSON.parse(e.detail.quad) }); setTouched(true); }}
              bindgrab={(e) => setGrab(e.detail.value)} />
          </view>
        </view>
      )}

      {/* shutter flash: removed once it has faded (an invisible full-screen view would still swallow taps on Android); below the top bar */}
      {flash > 0 && <view key={flash} className="screen" style={{ backgroundColor: '#FFFFFF', opacity: 0, animation: 'flashOut 320ms ease-out both' }} />}

      {/* camera unavailable: sits below the top bar so torch / Your Saved stay tappable */}
      {(perm === 'denied' || camBad) && !editing && (
        <view className="bg-dawn a-fade" style={{ position: 'absolute', left: '0px', right: '0px', top: '0px', bottom: `${sheetH}px`, alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <view className="card shadow-soft a-pop" style={{ padding: tight ? '16px 20px 16px' : compact ? '22px 22px 20px' : '30px 26px 26px', alignItems: 'center', width: '100%', marginTop: `${env.top + (tight ? 30 : 40)}px` }}>
            {!tight && <view className="badge" style={{ width: '64px', height: '64px', borderRadius: '32px', backgroundColor: '#B8DCE2', animation: 'bob 2.4s ease-in-out infinite' }}>
              <Icon name="camera" size={30} color="#202428" />
            </view>}
            <text className="h2" style={{ marginTop: tight ? '0px' : '16px', textAlign: 'center' }}>{perm === 'denied' ? 'Let SalinLens see' : 'Camera not available'}</text>
            <text className="body" style={{ marginTop: '6px', textAlign: 'center' }}>{perm === 'denied' ? 'We only use the camera to find and scan pages. Nothing leaves your phone.' : 'Another app may be using it. You can still scan from a photo.'}</text>
            <Press onTap={() => (perm === 'denied' ? ask(true) : (setCamBad(false), setCamKey((k) => k + 1)))} className="pill-btn pill-dark" style={{ marginTop: '18px', width: '100%' }}><text className="pill-text-light">{perm === 'denied' ? 'Allow camera' : 'Try again'}</text></Press>
          </view>
        </view>
      )}

      {/* top bar */}
      <view style={{ position: 'absolute', left: '16px', right: '16px', top: `${env.top + 10}px`, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }} className="a-fade d3">
        {editing ? <CircleBtn smoke icon="trash" onTap={removePage} /> : <CircleBtn smoke icon={torch ? 'flash' : 'flashOff'} onTap={() => setTorch(!torch)} />}
        <view style={{ flex: 1, alignItems: 'center', marginLeft: '10px', marginRight: '10px' }}>
          <view className="smoke" style={{ height: '38px', borderRadius: '19px', paddingLeft: '14px', paddingRight: '16px', flexDirection: 'row', alignItems: 'center', maxWidth: '100%', opacity: editing && grab ? 0 : 1, transition: 'opacity 200ms' }}>
            <view style={{ width: '9px', height: '9px', borderRadius: '5px', marginRight: '9px', backgroundColor: busy ? '#E7A93B' : hot || editing ? '#2F6BFF' : '#B5B0A6', transition: 'background-color 300ms' }} />
            <text className="chip-text one-line" text-maxline="1" style={{ color: SMOKE_TXT }}>{status}</text>
          </view>
        </view>
        <view>
          <CircleBtn smoke icon="layers" onTap={() => nav.push({ name: 'gallery' })} />
          {count > 0 && (
            <view style={{ position: 'absolute', right: '-3px', top: '-3px', minWidth: '19px', height: '19px', borderRadius: '10px', backgroundColor: '#FBF7F0', alignItems: 'center', justifyContent: 'center', paddingLeft: '4px', paddingRight: '4px' }}>
              <text style={{ fontSize: '11px', fontWeight: '800', color: '#202428' }}>{count}</text>
            </view>
          )}
        </view>
      </view>

      {toast !== '' && (
        <view className="smoke a-scale" style={{ position: 'absolute', left: '0px', right: '0px', alignItems: 'center', bottom: `${sheetH + 12}px`, marginLeft: '24px', marginRight: '24px', borderRadius: '18px' }}>
          <text className="chip-text" style={{ padding: '10px 16px', color: SMOKE_TXT, textAlign: 'center' }}>{toast}</text>
        </view>
      )}

      {/* bottom sheet: page strip, mode controls, Continue */}
      <view className="smoke-sheet a-up d2" style={{ position: 'absolute', left: '0px', right: '0px', bottom: '0px', paddingTop: '14px', paddingLeft: '20px', paddingRight: '20px', paddingBottom: `${env.bottom + 14}px` }}>
        <scroll-view scroll-orientation="horizontal" style={{ height: `${th + 8}px`, marginLeft: '-20px', marginRight: '-20px' }}>
          <view style={{ flexDirection: 'row', alignItems: 'center', height: `${th + 8}px`, paddingLeft: '20px', paddingRight: '12px' }}>
            {pages.map((p, i) => {
              const on = sel === i;
              return (
                <Press key={p.id} onTap={() => select(i)} haptic={false} style={{ width: `${tw}px`, height: `${th}px`, marginRight: '10px', borderRadius: '12px', overflow: 'hidden', border: on ? '2px solid #2F6BFF' : '2px solid rgba(255,255,255,0.28)', backgroundColor: '#FFFFFF' }}>
                  <salin-photo src={p.path} fit="cover" style={{ width: '100%', height: '100%' }} />
                  <view style={{ position: 'absolute', left: '3px', bottom: '3px', minWidth: '17px', height: '17px', borderRadius: '9px', backgroundColor: on ? '#2F6BFF' : 'rgba(20,23,26,0.72)', alignItems: 'center', justifyContent: 'center', paddingLeft: '4px', paddingRight: '4px' }}>
                    <text style={{ fontSize: '10.5px', fontWeight: '800', color: '#FFFFFF' }}>{i + 1}</text>
                  </view>
                </Press>
              );
            })}
            <Press onTap={() => select(CAM)} haptic={false} style={{ width: `${tw}px`, height: `${th}px`, borderRadius: '12px', alignItems: 'center', justifyContent: 'center', backgroundColor: sel === CAM ? 'rgba(47,107,255,0.4)' : 'rgba(255,255,255,0.14)', border: sel === CAM ? '2px solid #2F6BFF' : '2px solid rgba(255,255,255,0.28)' }}>
              <Icon name="plus" size={22} color={SMOKE_TXT} stroke={2.4} />
            </Press>
          </view>
        </scroll-view>

        <view style={{ marginTop: '12px', height: `${rowH}px`, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          {editing ? (
            <>
              <Cell cell={cell} bs={bs} icon="image" label="Gallery" onTap={pick} />
              <Cell cell={cell} bs={bs} icon="rotate" label="Rotate" onTap={rotate} spin={rotating} />
              <Cell cell={cell} bs={bs} icon="wand" label="Auto-fit" onTap={autoFit} />
              <Cell cell={cell} bs={bs} icon="crop" label="Full page" onTap={fullPage} />
              <Cell cell={cell} bs={bs} icon="back" label="Reset" onTap={resetQuad} disabled={!pg?.detected} />
            </>
          ) : (
            <>
              <view style={{ width: '80px', alignItems: 'flex-start' }}><Cell cell={64} bs={bs} icon="image" label="Gallery" onTap={pick} /></view>
              <Press onTap={shoot} haptic={false}>
                <view className={`shutter-halo ${hot && !busy ? 'shutter-halo-hot' : ''}`} style={{ width: `${rowH}px`, height: `${rowH}px`, borderRadius: `${rowH / 2}px` }}>
                  <view className="shutter-core" style={{ width: `${rowH - 22}px`, height: `${rowH - 22}px`, borderRadius: `${(rowH - 22) / 2}px`, backgroundColor: '#FFFFFF' }}>
                    {busy ? <view className="spin"><Icon name="rotate" size={28} color="#202428" /></view> : <Icon name="scan" size={32} color="#202428" stroke={2.1} />}
                  </view>
                </view>
              </Press>
              <view style={{ width: '80px' }} />
            </>
          )}
        </view>

        {pages.length > 0 && (
          <Press onTap={() => nav.push({ name: 'export', pages: pages.map((p) => ({ path: p.path, quad: p.quad })) })} className="pill-btn" style={{ marginTop: '12px', width: '100%', height: `${cH}px`, backgroundColor: '#FFFFFF' }}>
            <text className="pill-text-dark">{pages.length > 1 ? `Continue · ${pages.length} pages` : 'Continue'}</text>
            <view style={{ marginLeft: '8px' }}><Icon name="chevron" size={20} color="#202428" stroke={2.6} /></view>
          </Press>
        )}
      </view>
    </view>
  );
}

function Cell(p: { cell: number; bs: number; icon: string; label: string; onTap: () => void; spin?: boolean; disabled?: boolean }) {
  return (
    <Press onTap={p.onTap} disabled={p.disabled} style={{ width: `${p.cell}px`, alignItems: 'center', opacity: p.disabled ? 0.38 : 1 }}>
      <view className="badge" style={{ width: `${p.bs}px`, height: `${p.bs}px`, borderRadius: `${p.bs / 2}px`, backgroundColor: 'rgba(255,255,255,0.16)' }}>
        <view className={p.spin ? 'spin' : ''}><Icon name={p.icon} size={Math.round(p.bs * 0.48)} color={SMOKE_TXT} /></view>
      </view>
      <text style={{ marginTop: '6px', fontSize: p.cell < 62 ? '11px' : '12px', fontWeight: '600', color: SMOKE_TXT }}>{p.label}</text>
    </Press>
  );
}

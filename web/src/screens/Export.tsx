import { useEffect, useRef, useState } from '@lynx-js/react';
import { native } from '../native.js';
import type { Mode, PageSrc } from '../native.js';
import { useEnv, useNav } from '../nav.js';
import { CircleBtn, Icon, Pager, Press } from '../ui.js';

const MODES: { id: Mode; label: string }[] = [
  { id: 'color', label: 'Auto' }, { id: 'magic', label: 'Magic' }, { id: 'scanner', label: 'Scanner' }, { id: 'lighten', label: 'Lighten' },
  { id: 'crisp', label: 'Crisp' }, { id: 'eco', label: 'Eco' }, { id: 'gray', label: 'Gray' }, { id: 'bw', label: 'B&W' }, { id: 'original', label: 'Original' },
];
// every scan is written as PDF + JPG + PNG; the Saved screen is where you pick which type to send or save as a file
const FORMATS = ['pdf', 'jpg', 'png'];

export function Export(p: { pages: PageSrc[] }) {
  const env = useEnv();
  const nav = useNav();
  const [mode, setMode] = useState<Mode>('color');
  const [prevs, setPrevs] = useState<({ path: string; w: number; h: number } | null)[]>(() => p.pages.map(() => null)); // one corrected preview per page
  const [cur, setCur] = useState(0);                                  // page centred in the carousel
  const [name, setName] = useState(env.name);
  const [saving, setSaving] = useState(false);
  const topRef = useRef(nav.top); topRef.current = nav.top;
  const [err, setErr] = useState('');
  const seq = useRef(0);
  const curRef = useRef(0); curRef.current = cur;

  // (re)render every page's preview when the filter changes: centred page first, then the rest, one at a time
  useEffect(() => {
    const my = ++seq.current;
    setPrevs(p.pages.map(() => null));
    const c = curRef.current;
    const order = [c, ...p.pages.map((_, i) => i).filter((i) => i !== c)];
    (async () => {
      for (const i of order) {
        if (my !== seq.current) return;
        try {
          const r = await native.preview(p.pages[i].path, p.pages[i].quad, mode);
          if (my === seq.current) setPrevs((ps) => ps.map((x, k) => (k === i ? r : x)));
        } catch (_) { /* leave the shimmer */ }
      }
    })();
  }, [mode]);

  const save = async () => {
    if (saving) return;
    setSaving(true); setErr('');
    try {
      const r = await native.exportScan({ pages: p.pages, mode, name: name.trim() || env.name, formats: FORMATS });
      native.haptic('success');
      if (!topRef.current) { setSaving(false); return; } // user backed out while it was saving: the scan is in Your Saved, don't yank them to a screen they left
      nav.resetTo([{ name: 'item', item: r.item, saved: true }]);
    } catch (e: any) { setErr(e?.message ?? 'Could not save'); setSaving(false); }
  };

  const n = p.pages.length;
  const box = Math.max(160, Math.min(300, env.w - 112)); // width of the centred page; neighbours peek in at the sides
  // preview height: as tall as fits above the filters + name (max 340px)
  const ph = Math.round(Math.max(150, Math.min(340, env.h - 400)));

  return (
    <view className="screen bg-warm">
      <view style={{ position: 'absolute', left: '16px', right: '16px', top: `${env.top + 10}px`, flexDirection: 'row', alignItems: 'center' }}>
        <CircleBtn icon="back" onTap={nav.back} />
        <view style={{ marginLeft: '14px' }}>
          <text className="h2">Save as</text>
          {n > 1 && <text className="cap">{n} pages</text>}
        </view>
      </view>

      <scroll-view scroll-orientation="vertical" style={{ position: 'absolute', left: '0px', right: '0px', top: `${env.top + 68}px`, bottom: `${env.bottom + 92}px` }}>
        <view style={{ padding: '4px 20px 24px' }}>
          {/* pages: swipe sideways, each one snaps to the centre */}
          <view className="a-scale d1" style={{ marginLeft: '-20px', marginRight: '-20px' }}>
            <Pager n={n} cur={cur} onChange={setCur} width={env.w} itemW={box} gap={14} height={ph + 16}
              render={(i, active) => {
                const pv = prevs[i]; const ar = pv ? pv.w / pv.h : 0.75;
                return (
                  <view className="shadow-soft" style={{ height: `${ph}px`, width: `${Math.min(box, ph * ar)}px`, borderRadius: '10px', overflow: 'hidden', backgroundColor: '#FFFFFF', transform: active ? 'scale(1)' : 'scale(0.92)', transition: 'transform 220ms ease-out' }}>
                    {pv && <salin-photo src={pv.path} fit="contain" style={{ width: '100%', height: '100%' }} />}
                    {!pv && <view className="screen shimmer" style={{ backgroundColor: 'rgba(255,255,255,0.7)' }} />}
                  </view>
                );
              }} />
          </view>
          {n > 1 && <text className="cap" style={{ marginTop: '4px', textAlign: 'center' }}>Page {cur + 1} of {n}</text>}

          {/* filters */}
          <scroll-view className="a-rise d2" scroll-orientation="horizontal" style={{ marginTop: '14px', marginLeft: '-20px', marginRight: '-20px', height: '40px' }}>
            <view style={{ flexDirection: 'row', paddingLeft: '20px', paddingRight: '12px' }}>
              {MODES.map((m) => (
                <Press key={m.id} onTap={() => setMode(m.id)} className={`chip ${mode === m.id ? 'chip-on' : ''}`} style={{ marginRight: '8px' }}>
                  <text className={`chip-text ${mode === m.id ? 'chip-text-on' : ''}`}>{m.label}</text>
                </Press>
              ))}
            </view>
          </scroll-view>

          {/* name */}
          <text className="cap a-rise d3" style={{ marginTop: '24px', marginBottom: '8px' }}>FILE NAME</text>
          <view className="card a-rise d3" style={{ height: '56px', paddingLeft: '18px', paddingRight: '18px', justifyContent: 'center' }}>
            <input default-value={name} maxlength={80} placeholder="Name your scan" bindinput={(e) => setName(e.detail.value)}
              style={{ width: '100%', height: '40px', fontSize: '17px', fontWeight: '400', color: '#000000' }} />
          </view>

          {err !== '' && <text className="cap a-scale" style={{ marginTop: '12px', color: '#B3402A' }}>{err}</text>}
        </view>
      </scroll-view>

      <view style={{ position: 'absolute', left: '20px', right: '20px', bottom: `${env.bottom + 14}px` }}>
        <Press onTap={save} className="pill-btn pill-dark" style={{ width: '100%' }}>
          {saving ? <view className="spin"><Icon name="rotate" size={22} color="#FFFFFF" /></view> : <Icon name="download" size={22} color="#FFFFFF" />}
          <text className="pill-text-light" style={{ marginLeft: '10px' }}>{saving ? 'Saving…' : 'Save'}</text>
        </Press>
      </view>
    </view>
  );
}

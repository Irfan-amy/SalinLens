import { useEffect, useState } from '@lynx-js/react';
import { native } from '../native.js';
import type { Item } from '../native.js';
import { BRANDS } from '../brands.js';
import { useEnv, useNav } from '../nav.js';
import { CircleBtn, Icon, Pager, Press, fmtDate, fmtSize } from '../ui.js';

// social apps in Send to: real brand glyph + colour (src/brands.ts). Installed ones come first; the rest stay visible but dimmed.
// Snapchat's yellow needs a dark glyph; everything else is a white glyph on the brand colour.
const inkFor = (id: string) => (id === 'snapchat' ? '#000000' : '#FFFFFF');
const LABEL = '#000000';
const SECOND = 'rgba(60,60,67,0.6)';
const BLUE = '#2F6BFF';

export function ItemScreen({ item, saved }: { item: Item; saved: boolean }) {
  const env = useEnv();
  const nav = useNav();
  // one chip per format (a 3-page scan has 3 JPGs but one JPG chip); a chip sends every file of its format
  const groups = [...new Set(item.files.map((f) => f.fmt))].map((fmt) => {
    const fs = item.files.filter((f) => f.fmt === fmt);
    const pages = item.pages ?? 1;
    const note = fmt === 'pdf' ? (pages > 1 ? `${pages} pages` : fmtSize(fs[0].size)) : fs.length > 1 ? `${fs.length} files` : fmtSize(fs[0].size);
    return { fmt, paths: fs.map((f) => f.path), note };
  });
  // one image per page, in order (the JPG/PNG files carry their page number); a single-page scan just shows its thumbnail
  const pageImgs = (() => {
    const by = (fmt: string) => item.files.filter((f) => f.fmt === fmt).sort((a, b) => (a.page ?? 0) - (b.page ?? 0)).map((f) => f.path);
    const j = by('jpg'), g = by('png'); const l = j.length > 1 ? j : g.length > 1 ? g : [];
    return l.length > 1 ? l : [item.thumb];
  })();
  const np = pageImgs.length;
  const [cur, setCur] = useState(0);
  const [sel, setSel] = useState<string>(groups[0]?.fmt ?? 'pdf'); // the one file type that gets sent or saved
  const [targets, setTargets] = useState<Record<string, string | null>>({});
  const [note, setNote] = useState('');
  const [good, setGood] = useState(false); // note is a confirmation, not an error
  const apps = [...BRANDS].sort((x, y) => (targets[x.id] ? 0 : 1) - (targets[y.id] ? 0 : 1)); // installed first (sort is stable)
  const chosen = groups.find((g) => g.fmt === sel) ?? groups[0];

  useEffect(() => { native.targets().then((r) => setTargets(r.targets)).catch(() => {}); }, []);
  useEffect(() => { if (saved) setTimeout(() => native.haptic('success'), 250); }, []);

  const pick = (fmt: string) => { native.haptic('tick'); setSel(fmt); setNote(''); };
  const send = async (pkgKey: string) => {
    setNote(''); setGood(false);
    const installed = pkgKey === '' ? '' : targets[pkgKey];
    if (pkgKey !== '' && !installed) setNote(`${BRANDS.find((b) => b.id === pkgKey)?.label ?? 'That app'} isn't installed — try More`);
    try {
      const r: any = await native.share(chosen.paths, installed ?? '');
      if (r?.fallback) setNote(`${BRANDS.find((b) => b.id === pkgKey)?.label ?? 'That app'} didn't take it directly — pick it from the list`);
    } catch (e: any) { setNote(`Could not share: ${e?.message ?? 'unknown error'}`); }
  };
  const saveFile = async () => {
    setNote(''); setGood(false);
    try {
      const r = await native.saveFile(chosen.paths);
      native.haptic('success'); setGood(true);
      setNote(r.count > 1 ? `Saved ${r.count} ${chosen.fmt.toUpperCase()} files to Pictures/SalinLens` : `Saved ${chosen.fmt.toUpperCase()} to ${chosen.fmt === 'pdf' ? 'Documents' : 'Pictures'}/SalinLens`);
    } catch (e: any) { setNote(e?.message ?? 'Could not save the file'); }
  };
  const del = async () => { native.haptic('heavy'); await native.remove(item.id).catch(() => {}); nav.back(); };

  // Layout A: title, the page as the hero, and one white sheet holding file switch, apps and the action (iOS look).
  const sheetH = 290 + env.bottom + (note !== '' ? 22 : 0);
  const titleH = saved ? 56 : 78;
  const heroTop = env.top + 66 + titleH + 6;
  const heroH = Math.round(Math.max(96, Math.min(270, env.h - sheetH - heroTop - (np > 1 ? 28 : 8))));
  const ar = item.w > 0 && item.h > 0 ? item.w / item.h : 0.75;
  const heroW = Math.round(Math.min(260, heroH * ar));
  const many = groups.length > 2;
  const segW = Math.floor((env.w - 40 - 6) / Math.max(1, groups.length)); // explicit widths: flex:1 collapsed to 0 on Android and stacked the labels
  const cell = Math.max(68, Math.floor((env.w - 40) / 5.4)); // the SEND TO row scrolls sideways; the sixth cell peeks in as a hint
  const bs = Math.min(56, cell - 4);
  const lf = cell < 62 ? '11px' : '12px';

  return (
    <view className="screen bg-dawn">
      <view style={{ position: 'absolute', left: '16px', right: '16px', top: `${env.top + 10}px`, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <CircleBtn icon={saved ? 'close' : 'back'} onTap={() => (saved ? nav.resetTo([]) : nav.back())} />
        {!saved && <CircleBtn icon="trash" onTap={del} />}
      </view>

      <view style={{ position: 'absolute', left: '24px', right: '24px', top: `${env.top + 62}px`, alignItems: 'center' }}>
        <text className={saved ? 'h2 a-rise' : 'h2 a-rise two-line'} style={{ fontSize: saved ? '28px' : '20px', lineHeight: saved ? '34px' : '25px', textAlign: 'center' }} text-maxline={saved ? '1' : '2'}>{saved ? 'Saved!' : item.name}</text>
        <text className="body a-rise d1" style={{ marginTop: '2px', textAlign: 'center' }}>{saved ? `${(item.pages ?? 1) > 1 ? `${item.pages} pages · ` : ''}Pick a file type to send` : `${fmtDate(item.ts)}${(item.pages ?? 1) > 1 ? ` · ${item.pages} pages` : ''}`}</text>
      </view>

      <view className="a-scale d1" style={{ position: 'absolute', left: '0px', right: '0px', top: `${heroTop}px`, height: `${heroH}px`, alignItems: 'center', justifyContent: 'center' }}>
        {np === 1 ? (
          <view className="shadow-soft" style={{ width: `${heroW}px`, height: `${heroH}px`, borderRadius: '10px', overflow: 'hidden', backgroundColor: '#fff', transform: 'rotate(-2deg)' }}>
            <salin-photo src={pageImgs[0]} fit="cover" style={{ width: '100%', height: '100%' }} />
          </view>
        ) : (
          <Pager n={np} cur={cur} onChange={setCur} width={env.w} itemW={heroW} gap={14} height={heroH + 14}
            render={(i, active) => (
              <view className="shadow-soft" style={{ width: `${heroW}px`, height: `${heroH}px`, borderRadius: '10px', overflow: 'hidden', backgroundColor: '#fff', transform: active ? 'scale(1)' : 'scale(0.9)', transition: 'transform 220ms ease-out' }}>
                <salin-photo src={pageImgs[i]} fit="cover" style={{ width: '100%', height: '100%' }} />
              </view>
            )} />
        )}
      </view>
      {np > 1 && (
        <view style={{ position: 'absolute', left: '0px', right: '0px', top: `${heroTop + heroH + 2}px`, alignItems: 'center' }}>
          <text className="cap">{`Page ${cur + 1} of ${np}`}</text>
        </view>
      )}

      <view className="sheet a-up d2" style={{ position: 'absolute', left: '0px', right: '0px', bottom: '0px', paddingTop: '16px', paddingLeft: '20px', paddingRight: '20px', paddingBottom: `${env.bottom + 16}px` }}>
        {/* file type: iOS segmented control, one type is picked for sending / saving */}
        <view className="seg-wrap" style={{ width: `${env.w - 40}px` }}>
          {groups.map((g) => {
            const on = sel === g.fmt;
            return (
              <Press key={g.fmt} onTap={() => pick(g.fmt)} haptic={false} className={on ? 'seg-on' : ''}
                style={{ width: `${segW}px`, height: '40px', borderRadius: '11px', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', transition: 'background-color 200ms' }}>
                {on && <view className="badge" style={{ width: '20px', height: '20px', borderRadius: '10px', backgroundColor: BLUE, marginRight: '7px' }}>
                  <Icon name="check" size={12} color="#FFFFFF" stroke={3.2} />
                </view>}
                <text text-maxline="1" style={{ fontSize: '15px', fontWeight: '600', letterSpacing: '-0.24px', color: LABEL }}>{g.fmt.toUpperCase()}</text>
                {!many && on && <text style={{ marginLeft: '6px', fontSize: '13px', fontWeight: '400', color: SECOND }}>{g.note}</text>}
              </Press>
            );
          })}
        </view>

        {/* apps */}
        <text style={{ marginTop: '16px', marginLeft: '4px', marginBottom: '12px', fontSize: '13px', fontWeight: '400', letterSpacing: '-0.08px', color: SECOND }}>SEND TO</text>
        <scroll-view scroll-orientation="horizontal" style={{ marginLeft: '-20px', marginRight: '-20px', height: `${bs + 30}px` }}>
          <view style={{ flexDirection: 'row', paddingLeft: '20px', paddingRight: '20px' }}>
            <Press onTap={saveFile} style={{ width: `${cell}px`, alignItems: 'center' }}>
              <view className="badge" style={{ width: `${bs}px`, height: `${bs}px`, borderRadius: `${bs / 2}px`, backgroundColor: '#2A2926' }}>
                <Icon name="download" size={24} color="#FFFFFF" />
              </view>
              <text style={{ marginTop: '6px', fontSize: lf, fontWeight: '500', color: LABEL }}>Save file</text>
            </Press>
            {apps.map((a) => (
              <Press key={a.id} onTap={() => send(a.id)} style={{ width: `${cell}px`, alignItems: 'center', opacity: targets[a.id] === null ? 0.5 : 1 }}>
                <view className="badge" style={{ width: `${bs}px`, height: `${bs}px`, borderRadius: `${bs / 2}px`, backgroundColor: a.hex }}>
                  <Icon name="" d={a.d} size={Math.round(bs * 0.54)} color={inkFor(a.id)} filled stroke={0} />
                </view>
                <text style={{ marginTop: '6px', fontSize: lf, fontWeight: '500', color: LABEL }}>{a.label}</text>
              </Press>
            ))}
            <Press onTap={() => send('')} style={{ width: `${cell}px`, alignItems: 'center' }}>
              <view className="badge" style={{ width: `${bs}px`, height: `${bs}px`, borderRadius: `${bs / 2}px`, backgroundColor: 'rgba(255,255,255,0.7)' }}>
                <Icon name="share" size={24} color={LABEL} />
              </view>
              <text style={{ marginTop: '6px', fontSize: lf, fontWeight: '500', color: LABEL }}>More</text>
            </Press>
          </view>
        </scroll-view>
        {note !== '' && <text className="a-scale" style={{ marginTop: '10px', fontSize: '12.5px', fontWeight: '600', color: good ? '#14803F' : '#B3402A' }}>{note}</text>}

        {/* action */}
        <Press onTap={() => (saved ? nav.resetTo([]) : send(''))} className="pill-btn pill-dark" style={{ marginTop: '18px', width: '100%' }}>
          <Icon name={saved ? 'scan' : 'share'} size={22} color="#FFFFFF" />
          <text className="pill-text-light" style={{ marginLeft: '10px' }}>{saved ? 'Scan another' : 'Share'}</text>
        </Press>
      </view>
    </view>
  );
}

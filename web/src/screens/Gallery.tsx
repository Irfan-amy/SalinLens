import { useEffect, useState } from '@lynx-js/react';
import { native } from '../native.js';
import type { Draft, Item } from '../native.js';
import { useEnv, useNav } from '../nav.js';
import { CircleBtn, Icon, Press, fmtDate } from '../ui.js';

export function Gallery() {
  const env = useEnv();
  const nav = useNav();
  const [saved, setSaved] = useState<Item[] | null>(null);
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [tab, setTab] = useState<'saved' | 'drafts'>('saved'); // the (v) beside the title switches between saved scans and unsaved drafts
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    if (!nav.top) return;
    native.gallery().then((g) => setSaved(g.items)).catch(() => setSaved([]));
    native.drafts().then((g) => setDrafts(g.items)).catch(() => setDrafts([]));
  }, [nav.top]);

  const isDrafts = tab === 'drafts';
  const items = isDrafts ? drafts : saved;
  const pick = (t: 'saved' | 'drafts') => { native.haptic('tick'); setTab(t); setMenu(false); };
  const openDraft = (d: Draft) => { nav.root.current.resume?.(d); nav.back(); };
  const dropDraft = (id: string) => {
    native.haptic('heavy'); setDrafts((ds) => (ds ?? []).filter((d) => d.id !== id));
    if (nav.root.current.activeDraft?.() === id) nav.root.current.clear?.(); // the scan on screen: empty it too, its photos are about to be deleted
    else native.draftRemove(id).catch(() => {});
  };

  return (
    <view className="screen bg-dawn">
      {/* empty state first: it fills the screen, so it must sit BELOW the header or it swallows taps on the back arrow */}
      {items && items.length === 0 && (
        <view className="a-fade d2" style={{ position: 'absolute', left: '0px', right: '0px', top: '0px', bottom: '0px', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
          <view className="badge a-pop" style={{ width: '112px', height: '112px', borderRadius: '56px', backgroundColor: 'rgba(255,255,255,0.6)', animation: 'bob 2.6s ease-in-out infinite' }}>
            <Icon name="scan" size={54} color="#2A2926" stroke={1.8} />
          </view>
          <text className="h2" style={{ marginTop: '22px' }}>{isDrafts ? 'No drafts' : 'Nothing here yet'}</text>
          <text className="body" style={{ marginTop: '6px', textAlign: 'center' }}>{isDrafts ? 'Pages you scan are kept here until you save them.' : 'Scan a page and it will show up here, neat and ready to share.'}</text>
          <Press onTap={nav.back} className="pill-btn pill-dark" style={{ marginTop: '24px' }}><text className="pill-text-light">Scan your first page</text></Press>
        </view>
      )}

      <view style={{ position: 'absolute', left: '16px', right: '16px', top: `${env.top + 10}px`, flexDirection: 'row', alignItems: 'center' }}>
        <CircleBtn icon="back" onTap={nav.back} />
        <Press onTap={() => setMenu(!menu)} style={{ marginLeft: '14px', flexDirection: 'row', alignItems: 'center' }}>
          <text className="h2">{isDrafts ? 'Drafts' : 'Your Saved'}</text>
          <view style={{ marginLeft: '4px', transform: `rotate(${menu ? -90 : 90}deg)`, transition: 'transform 200ms' }}><Icon name="chevron" size={20} color="#2A2926" stroke={2.6} /></view>
        </Press>
      </view>

      {items && items.length > 0 && (
        <list key={tab} list-type="flow" span-count={2} scroll-orientation="vertical" main-axis-gap="0px" cross-axis-gap="0px"
          style={{ position: 'absolute', left: '11px', right: '11px', top: `${env.top + 66}px`, bottom: '0px' }}>
          {isDrafts && (drafts ?? []).map((d, i) => (
            <list-item key={d.id} item-key={d.id} estimated-main-axis-size-px={250}>
              <view className="card" style={{ margin: '7px', padding: '8px 8px 8px', animation: `riseIn 460ms cubic-bezier(0.2,0.85,0.25,1) ${Math.min(i, 6) * 50}ms both` }}>
                <Press onTap={() => openDraft(d)} haptic style={{ height: '172px', borderRadius: '20px', overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.5)' }}>
                  <salin-photo src={d.pages[0].path} fit="cover" radius={20} style={{ width: '100%', height: '100%' }} />
                  {d.pages.length > 1 && (
                    <view style={{ position: 'absolute', right: '8px', top: '8px', height: '24px', borderRadius: '12px', paddingLeft: '8px', paddingRight: '9px', flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(24,27,31,0.72)' }}>
                      <Icon name="layers" size={13} color="#FBF7F0" stroke={2.2} />
                      <text style={{ marginLeft: '4px', fontSize: '12px', fontWeight: '800', color: '#FBF7F0' }}>{d.pages.length}</text>
                    </view>
                  )}
                </Press>
                <view style={{ flexDirection: 'row', alignItems: 'center', marginTop: '6px' }}>
                  <Press onTap={() => openDraft(d)} haptic style={{ flex: 1, paddingTop: '4px', paddingBottom: '4px' }}>
                    <text className="h3 one-line" style={{ marginLeft: '6px', fontSize: '14.5px' }} text-maxline="1">{d.pages.length > 1 ? `Draft · ${d.pages.length} pages` : 'Draft'}</text>
                    <text className="cap one-line" style={{ marginTop: '2px', marginLeft: '6px' }} text-maxline="1">{fmtDate(d.ts)}</text>
                  </Press>
                  <Press onTap={() => dropDraft(d.id)} style={{ width: '34px', height: '34px', borderRadius: '17px', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(42,41,38,0.08)' }}>
                    <Icon name="trash" size={16} color="#FF3B30" stroke={2.1} />
                  </Press>
                </view>
              </view>
            </list-item>
          ))}
          {!isDrafts && (saved ?? []).map((it, i) => (
            <list-item key={it.id} item-key={it.id} estimated-main-axis-size-px={250}>
              <Press onTap={() => nav.push({ name: 'item', item: it, saved: false })} haptic className="card" style={{ margin: '7px', padding: '8px 8px 12px', animation: `riseIn 460ms cubic-bezier(0.2,0.85,0.25,1) ${Math.min(i, 6) * 50}ms both` }}>
                <view style={{ height: '172px', borderRadius: '20px', overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.5)' }}>
                  <salin-photo src={it.thumb} fit="cover" radius={20} style={{ width: '100%', height: '100%' }} />
                  {(it.pages ?? 1) > 1 && (
                    <view style={{ position: 'absolute', right: '8px', top: '8px', height: '24px', borderRadius: '12px', paddingLeft: '8px', paddingRight: '9px', flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(24,27,31,0.72)' }}>
                      <Icon name="layers" size={13} color="#FBF7F0" stroke={2.2} />
                      <text style={{ marginLeft: '4px', fontSize: '12px', fontWeight: '800', color: '#FBF7F0' }}>{it.pages}</text>
                    </view>
                  )}
                </view>
                <text className="h3 one-line" style={{ marginTop: '10px', marginLeft: '6px', marginRight: '6px', fontSize: '14.5px' }} text-maxline="1">{it.name}</text>
                <text className="cap one-line" style={{ marginTop: '2px', marginLeft: '6px' }} text-maxline="1">{fmtDate(it.ts)}</text>
                <view style={{ flexDirection: 'row', marginTop: '6px', marginLeft: '6px' }}>
                  {[...new Set(it.files.map((f) => f.fmt))].map((fmt) => (
                    <view key={fmt} style={{ marginRight: '4px', padding: '1px 6px', borderRadius: '6px', backgroundColor: 'rgba(42,41,38,0.08)' }}>
                      <text style={{ fontSize: '10px', fontWeight: '600', color: '#2A2926' }}>{fmt.toUpperCase()}</text>
                    </view>
                  ))}
                </view>
              </Press>
            </list-item>
          ))}
        </list>
      )}

      {/* switcher: rendered last so it sits above the list; only exists while open, so it never eats taps otherwise */}
      {menu && (
        <view className="screen" bindtap={() => setMenu(false)}>
          <view className="card shadow-soft a-pop" style={{ position: 'absolute', left: '16px', top: `${env.top + 62}px`, width: '190px', padding: '6px', backgroundColor: '#FBF7F0' }}>
            {([['saved', 'Your Saved', saved?.length ?? 0], ['drafts', 'Drafts', drafts?.length ?? 0]] as const).map(([k, label, n]) => (
              <Press key={k} onTap={() => pick(k)} style={{ height: '44px', borderRadius: '16px', paddingLeft: '12px', paddingRight: '12px', flexDirection: 'row', alignItems: 'center', backgroundColor: tab === k ? 'rgba(42,41,38,0.08)' : 'rgba(0,0,0,0)' }}>
                <view style={{ width: '22px' }}>{tab === k && <Icon name="check" size={18} color="#2A2926" stroke={2.6} />}</view>
                <text className="h3" style={{ flex: 1, fontSize: '16px' }}>{label}</text>
                <text className="cap">{n}</text>
              </Press>
            ))}
          </view>
        </view>
      )}
    </view>
  );
}

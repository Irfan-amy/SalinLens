import { useEffect, useState } from '@lynx-js/react';
import { native } from '../native.js';
import type { Item } from '../native.js';
import { useEnv, useNav } from '../nav.js';
import { CircleBtn, Icon, Press, fmtDate } from '../ui.js';

export function Gallery() {
  const env = useEnv();
  const nav = useNav();
  const [items, setItems] = useState<Item[] | null>(null);

  useEffect(() => { if (nav.top) native.gallery().then((g) => setItems(g.items)).catch(() => setItems([])); }, [nav.top]);

  return (
    <view className="screen bg-dawn">
      {/* empty state first: it fills the screen, so it must sit BELOW the header or it swallows taps on the back arrow */}
      {items && items.length === 0 && (
        <view className="a-fade d2" style={{ position: 'absolute', left: '0px', right: '0px', top: '0px', bottom: '0px', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
          <view className="badge a-pop" style={{ width: '112px', height: '112px', borderRadius: '56px', backgroundColor: 'rgba(255,255,255,0.6)', animation: 'bob 2.6s ease-in-out infinite' }}>
            <Icon name="scan" size={54} color="#2A2926" stroke={1.8} />
          </view>
          <text className="h2" style={{ marginTop: '22px' }}>Nothing here yet</text>
          <text className="body" style={{ marginTop: '6px', textAlign: 'center' }}>Scan a page and it will show up here, neat and ready to share.</text>
          <Press onTap={nav.back} className="pill-btn pill-dark" style={{ marginTop: '24px' }}><text className="pill-text-light">Scan your first page</text></Press>
        </view>
      )}

      <view style={{ position: 'absolute', left: '16px', right: '16px', top: `${env.top + 10}px`, flexDirection: 'row', alignItems: 'center' }}>
        <CircleBtn icon="back" onTap={nav.back} />
        <text className="h2" style={{ marginLeft: '14px' }}>Your Saved</text>
      </view>

      {items && items.length > 0 && (
        <list list-type="flow" span-count={2} scroll-orientation="vertical" main-axis-gap="0px" cross-axis-gap="0px"
          style={{ position: 'absolute', left: '11px', right: '11px', top: `${env.top + 66}px`, bottom: '0px' }}>
          {items.map((it, i) => (
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
    </view>
  );
}

import { useRef, useState } from '@lynx-js/react';
import type { ReactNode } from '@lynx-js/react';
import { native } from './native.js';

// Main-thread press feedback: runs synchronously on the UI thread so it never lags the finger.
function down(e: any) { 'main thread'; e.currentTarget.setStyleProperty('transform', 'scale(0.93)'); }
function up(e: any) { 'main thread'; e.currentTarget.setStyleProperty('transform', 'scale(1)'); }

export function Press(p: { onTap?: () => void; className?: string; style?: any; children?: ReactNode; haptic?: boolean; disabled?: boolean }) {
  return (
    <view
      className={`press ${p.className ?? ''}`}
      style={p.style}
      main-thread:bindtouchstart={down}
      main-thread:bindtouchend={up}
      main-thread:bindtouchcancel={up}
      bindtap={() => { if (p.disabled) return; if (p.haptic !== false) native.haptic('tap'); p.onTap?.(); }}
    >
      {p.children}
    </view>
  );
}

export const Icon = (p: { name: string; size?: number; color?: string; stroke?: number; filled?: boolean; d?: string }) => (
  <salin-icon name={p.d ? undefined : p.name} d={p.d} color={p.color ?? '#151515'} stroke={p.stroke ?? 2} filled={p.filled} style={{ width: `${p.size ?? 22}px`, height: `${p.size ?? 22}px` }} />
);

export function CircleBtn(p: { icon: string; onTap: () => void; dark?: boolean; smoke?: boolean; size?: number; badge?: boolean }) {
  const s = p.size ?? 46;
  const light = p.dark || p.smoke;
  return (
    <Press onTap={p.onTap} className={p.smoke ? 'circle-btn smoke' : 'circle-btn glass'} style={{ width: `${s}px`, height: `${s}px`, borderRadius: `${s / 2}px`, backgroundColor: p.dark ? '#202428' : undefined }}>
      <Icon name={p.icon} size={s * 0.48} color={light ? '#FBF7F0' : p.icon === 'trash' ? '#FF3B30' : '#1C1C1E'} />
    </Press>
  );
}

export function fmtSize(n: number) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function fmtDate(ts: number) {
  const d = new Date(ts); const p2 = (n: number) => (n < 10 ? '0' + n : '' + n);
  return `${MON[d.getMonth()]} ${d.getDate()} · ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

/**
 * Horizontal swipe carousel built from plain views (no x-swiper / x-viewpager: those tags are not guaranteed to exist in the Android build,
 * and an unknown tag renders as nothing). The track follows the finger, then snaps the nearest page to the centre; tapping a peeking neighbour selects it.
 */
export function Pager(p: { n: number; cur: number; onChange: (i: number) => void; width: number; itemW: number; gap: number; height: number; render: (i: number, active: boolean) => ReactNode }) {
  const step = p.itemW + p.gap;
  const [dx, setDx] = useState(0);
  const [drag, setDrag] = useState(false);
  const st = useRef({ x: 0, y: 0, lx: 0, lt: 0, v: 0, axis: '' as '' | 'x' | 'y', moved: false });
  const pt = (e: any) => { const t = e.touches?.[0] ?? e.changedTouches?.[0]; return { x: t?.pageX ?? t?.clientX ?? t?.x ?? e.detail?.x ?? 0, y: t?.pageY ?? t?.clientY ?? t?.y ?? e.detail?.y ?? 0 }; };
  const clampDx = (d: number) => ((p.cur === 0 && d > 0) || (p.cur === p.n - 1 && d < 0) ? d * 0.3 : d); // rubber-band at both ends
  const start = (e: any) => { const q = pt(e); st.current = { x: q.x, y: q.y, lx: q.x, lt: Date.now(), v: 0, axis: '', moved: false }; };
  const move = (e: any) => {
    const s = st.current; const q = pt(e);
    if (s.axis === '') { const ax = Math.abs(q.x - s.x), ay = Math.abs(q.y - s.y); if (ax < 6 && ay < 6) return; s.axis = ax >= ay ? 'x' : 'y'; if (s.axis === 'x') setDrag(true); }
    if (s.axis !== 'x') return;
    const t = Date.now(); if (t > s.lt) s.v = (q.x - s.lx) / (t - s.lt); s.lx = q.x; s.lt = t; s.moved = true;
    setDx(clampDx(q.x - s.x));
  };
  const end = () => {
    const s = st.current; if (s.axis === 'x') {
      const thr = Math.min(70, step * 0.22); let next = p.cur;
      if (dx < -thr || s.v < -0.45) next = p.cur + 1; else if (dx > thr || s.v > 0.45) next = p.cur - 1;
      next = Math.max(0, Math.min(p.n - 1, next));
      if (next !== p.cur) { native.haptic('tick'); p.onChange(next); }
    }
    setDrag(false); setDx(0); s.axis = '';
    setTimeout(() => { s.moved = false; }, 60); // swallow the tap that ends a drag
  };
  const x = (p.width - step) / 2 - p.cur * step + dx;
  return (
    <view style={{ width: `${p.width}px`, height: `${p.height}px`, overflow: 'hidden', flexShrink: '0' }} bindtouchstart={start} bindtouchmove={move} bindtouchend={end} bindtouchcancel={end}>
      <view style={{ position: 'absolute', left: '0px', top: '0px', width: `${p.n * step}px`, height: `${p.height}px`, flexDirection: 'row', transform: `translateX(${x}px)`, transition: drag ? 'none' : 'transform 280ms cubic-bezier(0.22, 0.9, 0.3, 1)' }}>
        {Array.from({ length: p.n }, (_, i) => (
          <view key={i} bindtap={() => { if (!st.current.moved && i !== p.cur) { native.haptic('tick'); p.onChange(i); } }}
            style={{ width: `${step}px`, height: `${p.height}px`, alignItems: 'center', justifyContent: 'center' }}>
            {p.render(i, i === p.cur)}
          </view>
        ))}
      </view>
    </view>
  );
}

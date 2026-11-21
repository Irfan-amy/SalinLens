import { useCallback, useEffect, useRef, useState } from '@lynx-js/react';
import './theme.css';
import { native } from './native.js';
import { EnvCtx, NavCtx, ReadyCtx } from './nav.js';
import type { Route, RootHooks } from './nav.js';
import { Splash } from './screens/Splash.js';
import { Scan } from './screens/Scan.js';
import { Export } from './screens/Export.js';
import { ItemScreen } from './screens/Item.js';
import { Gallery } from './screens/Gallery.js';

interface Entry { id: number; route: Route; leaving: boolean }
let uid = 1;

export function App() {
  const [env, setEnv] = useState<{ top: number; bottom: number; name: string; w: number; h: number; web?: boolean }>({ top: 28, bottom: 16, name: 'Scan', w: 360, h: 780 });
  const [splash, setSplash] = useState(true);
  const [splashOut, setSplashOut] = useState(false);
  const [stack, setStack] = useState<Entry[]>([{ id: uid++, route: { name: 'camera' }, leaving: false }]);
  const rootHooks = useRef<RootHooks>({});
  const stackRef = useRef(stack);
  stackRef.current = stack;

  // Splash is a loading gate, not a timer: it leaves once insets are known and the camera screen reports ready
  // (permission resolved). 450 ms floor so the logo animation never flashes; 8 s ceiling so it can never hang.
  const gate = useRef({ env: false, cam: false, t0: Date.now(), done: false });
  const release = useCallback(() => {
    const g = gate.current;
    if (g.done || !(g.env && g.cam)) return;
    g.done = true;
    setTimeout(() => { setSplashOut(true); setTimeout(() => setSplash(false), 300); }, Math.max(0, 450 - (Date.now() - g.t0)));
  }, []);
  const camReady = useCallback(() => { gate.current.cam = true; release(); }, [release]);

  useEffect(() => {
    const load = () => native.env().then((e) => { setEnv(e); gate.current.env = true; release(); }).catch(() => { gate.current.env = true; release(); });
    load();
    const t0 = setTimeout(load, 700); // insets can arrive after first layout
    const failsafe = setTimeout(() => { gate.current.env = gate.current.cam = true; release(); }, 8000);
    return () => { clearTimeout(t0); clearTimeout(failsafe); };
  }, []);

  const push = useCallback((route: Route) => setStack((s) => [...s, { id: uid++, route, leaving: false }]), []);
  const lastBack = useRef(0);
  const back = useCallback(() => {
    const now = Date.now(); if (now - lastBack.current < 300) return; lastBack.current = now; // double-tap on an arrow must not pop two screens (or fall through to exit)
    const s = stackRef.current;
    const live = s.filter((e) => !e.leaving);
    if (live.length <= 1) { if (!rootHooks.current.back?.()) native.exit(); return; }
    const topId = live[live.length - 1].id;
    setStack((cur) => cur.map((e) => (e.id === topId ? { ...e, leaving: true } : e)));
    setTimeout(() => setStack((cur) => cur.filter((e) => e.id !== topId)), 270);
  }, []);
  const resetTo = useCallback((routes: Route[]) => {
    rootHooks.current.clear?.(); // the scan is finished: the next one starts empty
    setStack((s) => [s[0], ...routes.map((r) => ({ id: uid++, route: r, leaving: false }))]);
  }, []);

  // hardware back -> JS
  useEffect(() => {
    const em = lynx.getJSModule('GlobalEventEmitter');
    const h = () => back();
    em.addListener('salinBack', h);
    return () => em.removeListener('salinBack', h);
  }, [back]);

  const liveTopId = stack.filter((e) => !e.leaving).slice(-1)[0]?.id;

  return (
    <EnvCtx.Provider value={env}>
     <ReadyCtx.Provider value={camReady}>
      <view className="screen bg-dawn">
        {stack.map((e) => (
          <NavCtx.Provider key={e.id} value={{ push, back, resetTo, top: e.id === liveTopId && !splash, root: rootHooks }}>
            <view className={`screen ${e.leaving ? 'a-leave' : e.id === stack[0].id ? '' : 'a-up'}`}>
              {e.route.name === 'camera' && <Scan />}
              {e.route.name === 'export' && <Export {...e.route} />}
              {e.route.name === 'item' && <ItemScreen {...e.route} />}
              {e.route.name === 'gallery' && <Gallery />}
            </view>
          </NavCtx.Provider>
        ))}
        {splash && <Splash out={splashOut} />}
      </view>
     </ReadyCtx.Provider>
    </EnvCtx.Provider>
  );
}

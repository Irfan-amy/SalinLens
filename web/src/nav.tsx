import { createContext, useContext } from '@lynx-js/react';
import type { Item, Mode, PageSrc } from './native.js';

export type Route =
  | { name: 'camera' }
  | { name: 'export'; pages: PageSrc[] }
  | { name: 'item'; item: Item; saved: boolean }
  | { name: 'gallery' };

/** Hooks the root (scan) screen registers: hardware back and "the scan is finished, drop the session". */
export interface RootHooks { back?: () => boolean; clear?: () => void }

export interface Nav {
  push: (r: Route) => void;
  back: () => void;
  /** replace the whole stack below camera with these routes (e.g. after saving) */
  resetTo: (r: Route[]) => void;
  top: boolean;
  root: { current: RootHooks };
}
export const NavCtx = createContext<Nav>({ push() {}, back() {}, resetTo() {}, top: true, root: { current: {} } });
export const useNav = () => useContext(NavCtx);

export const EnvCtx = createContext<{ top: number; bottom: number; name: string; w: number; h: number; web?: boolean }>({ top: 28, bottom: 16, name: 'Scan', w: 360, h: 780 });
export const useEnv = () => useContext(EnvCtx);
/** Camera calls this once its permission state is known; splash waits for it. */
export const ReadyCtx = createContext<() => void>(() => {});
export const useReady = () => useContext(ReadyCtx);

export type { Mode };

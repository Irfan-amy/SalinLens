// Typed wrapper around the Kotlin LynxModule `SalinNative` (every async call answers with a JSON string).
declare const NativeModules: { SalinNative: Record<string, (...a: any[]) => any> };

export type Quad = number[]; // tl,tr,br,bl as x,y normalized 0..1
export interface FileEntry { fmt: 'pdf' | 'jpg' | 'png'; path: string; size: number; page?: number }
export interface Item { id: string; name: string; ts: number; w: number; h: number; pages?: number; thumb: string; files: FileEntry[] }
/** one page of the scan session: the photo + the crop quad the user settled on */
export interface PageSrc { path: string; quad: Quad }
/** a scan that was captured but not saved yet */
export interface Draft { id: string; ts: number; pages: PageSrc[] }
export interface Page extends PageSrc { id: number; detected: Quad | null; found: boolean }
export type Mode = 'original' | 'color' | 'magic' | 'lighten' | 'crisp' | 'scanner' | 'eco' | 'gray' | 'bw';

function call<T = any>(name: string, ...args: any[]): Promise<T> {
  return new Promise((resolve, reject) => {
    try {
      NativeModules.SalinNative[name](...args, (json: string) => {
        try {
          const r = JSON.parse(json);
          r.ok ? resolve(r as T) : reject(new Error(r.error || 'native error'));
        } catch (e) { reject(e); }
      });
    } catch (e) { reject(e); }
  });
}
const fire = (name: string, ...args: any[]) => { try { NativeModules.SalinNative[name](...args); } catch (_) { /* noop */ } };

export const native = {
  env: () => call<{ top: number; bottom: number; name: string; w: number; h: number; web?: boolean }>('env'),
  cameraPermission: (ask: boolean) => call<{ granted: boolean }>('cameraPermission', ask),
  capture: () => call<{ path: string }>('capture'),
  pickImage: () => call<{ path: string | null }>('pickImage'),
  detect: (path: string) => call<{ quad: Quad; conf: number; found: boolean; w: number; h: number }>('detect', path),
  rotate: (path: string, quad: Quad) => call<{ path: string; quad: Quad }>('rotate', path, JSON.stringify(quad)),
  preview: (path: string, quad: Quad, mode: Mode) => call<{ path: string; w: number; h: number }>('preview', path, JSON.stringify(quad), mode),
  exportScan: (o: { pages: PageSrc[]; mode: Mode; name: string; formats: string[] }) => call<{ item: Item }>('export', JSON.stringify(o)),
  gallery: () => call<{ items: Item[] }>('gallery'),
  remove: (id: string) => call('remove', id),
  drafts: () => call<{ items: Draft[] }>('drafts'),
  draftSave: (id: string, pages: PageSrc[]) => call('draftSave', id, JSON.stringify(pages)),
  draftRemove: (id: string) => call('draftRemove', id),
  targets: () => call<{ targets: Record<string, string | null> }>('targets'),
  saveFile: (paths: string[]) => call<{ count: number }>('saveFile', JSON.stringify(paths)),
  share: (paths: string[], pkg: string) => call('share', JSON.stringify(paths), pkg),
  haptic: (kind: 'tap' | 'tick' | 'heavy' | 'success') => fire('haptic', kind),
  exit: () => fire('exit'),
};

/** rotate a normalized quad 90deg clockwise together with its image (mirrors Imaging.rotateQuad) */
export function rotQuad(q: Quad): Quad {
  const o: number[] = [];
  for (let i = 0; i < 4; i++) { o.push(1 - q[2 * i + 1], q[2 * i]); }
  return [o[6], o[7], o[0], o[1], o[2], o[3], o[4], o[5]];
}

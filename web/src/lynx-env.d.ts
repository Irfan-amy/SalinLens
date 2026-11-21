declare module '@lynx-js/types' {
  interface GlobalProps {}
  interface IntrinsicElements {
    'salin-camera': { id?: string; className?: string; style?: any; active?: boolean; torch?: boolean; binddetected?: (e: { detail: { value: boolean } }) => void; bindcamerastate?: (e: { detail: { ok: boolean } }) => void; key?: any; bindtap?: any };
    'salin-crop': { key?: any; className?: string; style?: any; src: string; quad: string; bindchange?: (e: { detail: { quad: string } }) => void; bindgrab?: (e: { detail: { value: boolean } }) => void };
    'salin-photo': { className?: string; style?: any; src: string; fit?: 'cover' | 'contain'; radius?: number };
    'salin-icon': { className?: string; style?: any; name?: string; d?: string; color?: string; stroke?: number; filled?: boolean };
  }
}
export {};

// Browser versions of the four native Lynx elements, so the real UI bundle can run in a web page.
// Layout-faithful stand-ins only (the drawing is simple); they exist to test overflow/spacing, not pixels of the camera.
import { ICONS } from '/preview/icons.js';

const fit = (v) => (v && v.startsWith('/') ? v : '/fixtures/doc.jpg'); // any device path -> fixture
const def = (n, c) => !customElements.get(n) && customElements.define(n, c);
const ev = (el, name, detail) => el.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));

class Base extends HTMLElement {
  static get observedAttributes() { return ['name', 'd', 'color', 'stroke', 'filled', 'src', 'fit', 'radius', 'quad', 'active', 'torch']; }
  connectedCallback() { if (!this.style.display) this.style.display = 'block'; this.render?.(); }
  attributeChangedCallback() { this.render?.(); }
}

def('salin-icon', class extends Base {
  render() {
    const d = this.getAttribute('d') || ICONS[this.getAttribute('name')] || '';
    const filled = this.getAttribute('filled') === 'true' || this.getAttribute('filled') === '';
    const sw = this.getAttribute('stroke') || 2; const fillOnly = filled && +sw <= 0;
    this.innerHTML = `<svg viewBox="0 0 24 24" width="100%" height="100%" style="display:block"><path d="${d}" fill="${filled ? 'currentColor' : 'none'}" stroke="${fillOnly ? 'none' : 'currentColor'}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    this.style.color = this.getAttribute('color') || '#000';
  }
});

def('salin-photo', class extends Base {
  render() {
    const cover = this.getAttribute('fit') !== 'contain';
    const r = parseFloat(this.getAttribute('radius') || '0');
    this.style.overflow = 'hidden'; this.style.borderRadius = r + 'px';
    this.innerHTML = `<img src="${fit(this.getAttribute('src'))}" style="width:100%;height:100%;display:block;object-fit:${cover ? 'cover' : 'contain'}">`;
  }
});

def('salin-camera', class extends Base {
  connectedCallback() {
    super.connectedCallback();
    this.style.background = '#000'; this.style.overflow = 'hidden'; this.style.position ||= 'relative';
    const bad = new URLSearchParams(location.search).get('cam') === 'bad'; // ?cam=bad simulates a device with no usable camera
    setTimeout(() => { ev(this, 'camerastate', { ok: !bad }); if (!bad) ev(this, 'detected', { value: true }); }, 250);
  }
  render() {
    this.innerHTML = `<img src="/fixtures/doc.jpg" style="width:100%;height:100%;object-fit:cover;display:block">
      <svg viewBox="0 0 1200 1600" preserveAspectRatio="xMidYMid slice" style="position:absolute;inset:0;width:100%;height:100%"><polygon points="170,230 1010,190 1060,1370 130,1420" fill="rgba(47,107,255,.22)" stroke="#2F6BFF" stroke-width="10"/></svg>`;
  }
});

def('salin-crop', class extends Base {
  connectedCallback() { super.connectedCallback(); this.style.position ||= 'relative'; this.style.touchAction = 'none'; }
  render() {
    let q; try { q = JSON.parse(this.getAttribute('quad')); } catch { q = null; }
    if (!Array.isArray(q) || q.length < 8) q = [.1, .1, .9, .1, .9, .9, .1, .9];
    this.q = this.q || q; if (this.getAttribute('quad') !== this._last) { this.q = q; this._last = this.getAttribute('quad'); }
    const pts = [0, 1, 2, 3].map((i) => [this.q[2 * i] * 100, this.q[2 * i + 1] * 100]);
    this.innerHTML = `<div style="position:absolute;inset:0;padding:24px 20px;box-sizing:border-box"><div class="box" style="position:relative;width:100%;height:100%">
      <img src="${fit(this.getAttribute('src'))}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%"><polygon points="${pts.map((p) => p.join(',')).join(' ')}" fill="rgba(47,107,255,.2)" stroke="#2F6BFF" stroke-width="0.8" vector-effect="non-scaling-stroke"/></svg>
      ${pts.map((p, i) => `<i data-i="${i}" style="position:absolute;left:${p[0]}%;top:${p[1]}%;width:26px;height:26px;margin:-13px;border-radius:13px;background:#fff;border:3px solid #2F6BFF;box-sizing:border-box"></i>`).join('')}
    </div></div>`;
    this.querySelectorAll('i').forEach((h) => h.addEventListener('pointerdown', (e) => {
      const box = this.querySelector('.box').getBoundingClientRect(); const i = +h.dataset.i; ev(this, 'grab', { value: true });
      const mv = (m) => { this.q[2 * i] = Math.min(1, Math.max(0, (m.clientX - box.left) / box.width)); this.q[2 * i + 1] = Math.min(1, Math.max(0, (m.clientY - box.top) / box.height)); this.render(); };
      const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); ev(this, 'grab', { value: false }); ev(this, 'change', { quad: JSON.stringify(this.q) }); };
      addEventListener('pointermove', mv); addEventListener('pointerup', up);
    }));
  }
});

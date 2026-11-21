"""Builds the README charts (plain SVG, light + dark) from data.json. No dependencies: python3 docs/charts/make_charts.py"""
import json, os
from xml.sax.saxutils import escape as esc

HERE = os.path.dirname(os.path.abspath(__file__)); D = json.load(open(os.path.join(HERE, 'data.json')))
OUT = os.path.join(HERE, '..', 'screenshots'); OUT = os.path.abspath(OUT)
THEMES = {
    'light': dict(surface='#fcfcfb', text='#0b0b0b', text2='#52514e', grid='#e4e3df', ours='#2a78d6', other='#eb6834', good='#006300'),
    'dark': dict(surface='#1a1a19', text='#f0efec', text2='#c3c2b7', grid='#33332f', ours='#3987e5', other='#d95926', good='#0ca30c'),
}
FONT = "font-family=\"-apple-system,'SF Pro Text',Inter,'Segoe UI',Roboto,Helvetica,Arial,sans-serif\""

def bar(x, y, w, h, fill, r=4):
    """vertical bar anchored to the baseline: rounded data end (top), square base"""
    r = min(r, w / 2, h)
    return f'<path d="M{x},{y+h} V{y+r} Q{x},{y} {x+r},{y} H{x+w-r} Q{x+w},{y} {x+w},{y+r} V{y+h} Z" fill="{fill}"/>'

def hbar(x, y, w, h, fill, r=4):
    """horizontal bar anchored to the left baseline: rounded data end (right)"""
    r = min(r, h / 2, w)
    return f'<path d="M{x},{y} H{x+w-r} Q{x+w},{y} {x+w},{y+r} V{y+h-r} Q{x+w},{y+h} {x+w-r},{y+h} H{x} Z" fill="{fill}"/>'

def head(W, H, c, title, sub, label):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-label="{esc(label)}" {FONT}>'
            f'<rect width="{W}" height="{H}" rx="14" fill="{c["surface"]}"/>'
            f'<text x="24" y="34" font-size="16" font-weight="650" fill="{c["text"]}">{esc(title)}</text>'
            f'<text x="24" y="54" font-size="12.5" fill="{c["text2"]}">{esc(sub)}</text>')

def accuracy(c):
    a = D['accuracy']; W, H = 720, 380; x0, x1, yb, yt = 70, 696, 300, 96
    s = head(W, H, c, 'Page-outline accuracy', 'Jaccard overlap with the labelled page, higher is better (1.0 = perfect)', 'Grouped bar chart: classic OpenCV scores 0.64 and 0.18, SalinLens 0.95 and 0.84 on a clean and a cluttered desk')
    for i in range(0, 6):
        v = i * 0.2; y = yb - (yb - yt) * v
        s += f'<line x1="{x0}" y1="{y}" x2="{x1}" y2="{y}" stroke="{c["grid"]}" stroke-width="1"/><text x="{x0-10}" y="{y+4}" font-size="11" text-anchor="end" fill="{c["text2"]}">{v:.1f}</text>'
    gw = (x1 - x0) / 2; bw = 70
    for g in range(2):
        cx = x0 + gw * (g + 0.5)
        for k, (val, col, name) in enumerate([(a['classic_opencv'][g], c['other'], 'Classic'), (a['salinlens'][g], c['ours'], 'SalinLens')]):
            h = (yb - yt) * val; bx = cx - bw - 1 + k * (bw + 2)
            s += bar(bx, yb - h, bw, h, col)
            s += f'<text x="{bx+bw/2}" y="{yb-h-8}" font-size="14" font-weight="650" text-anchor="middle" fill="{c["text"]}">{val:.2f}</text>'
        s += f'<text x="{cx}" y="{yb+22}" font-size="12.5" font-weight="600" text-anchor="middle" fill="{c["text"]}">{esc(["Clean desk (white paper)", "Cluttered desk (stacked sheets, cable)"][g])}</text>'
    s += f'<line x1="{x0}" y1="{yb}" x2="{x1}" y2="{yb}" stroke="{c["text2"]}" stroke-width="1"/>'
    lx = 24
    for col, name in [(c['other'], 'Classic OpenCV contour finder'), (c['ours'], 'SalinLens (on-device model)')]:
        s += f'<rect x="{lx}" y="{H-34}" width="12" height="12" rx="3" fill="{col}"/><text x="{lx+18}" y="{H-24}" font-size="12" fill="{c["text2"]}">{esc(name)}</text>'; lx += 250
    return s + '</svg>'

def heldout(c):
    h = D['heldout']; W, H = 720, 384; x0, x1, yb, yt = 70, 696, 280, 96
    s = head(W, H, c, 'Held-out photos: mean 0.90, none missed', '8 photos labelled before any model ran, scored once. Every page was found (overlap above 0.5)', 'Bar chart of 8 held-out photos, overlap between 0.65 and 0.99, mean 0.898, no failures')
    for i in range(0, 6):
        v = i * 0.2; y = yb - (yb - yt) * v
        s += f'<line x1="{x0}" y1="{y}" x2="{x1}" y2="{y}" stroke="{c["grid"]}" stroke-width="1"/><text x="{x0-10}" y="{y+4}" font-size="11" text-anchor="end" fill="{c["text2"]}">{v:.1f}</text>'
    n = len(h['salinlens']); gw = (x1 - x0) / n; bw = 40
    for i, v in enumerate(h['salinlens']):
        bh = (yb - yt) * v; bx = x0 + gw * (i + 0.5) - bw / 2
        s += bar(bx, yb - bh, bw, bh, c['ours'])
        s += f'<text x="{bx+bw/2}" y="{yb-bh-7}" font-size="12.5" font-weight="650" text-anchor="middle" fill="{c["text"]}" stroke="{c["surface"]}" stroke-width="4" paint-order="stroke">{v:.2f}</text>'
        s += f'<text x="{bx+bw/2}" y="{yb+20}" font-size="11.5" text-anchor="middle" fill="{c["text2"]}">{esc(h["photos"][i].split(" ")[0])}</text>'
    ym = yb - (yb - yt) * h['mean']
    s += f'<line x1="{x0}" y1="{ym}" x2="{x1}" y2="{ym}" stroke="{c["text"]}" stroke-width="1.5" stroke-dasharray="5 4"/>'
    s += f'<line x1="24" y1="{H-38}" x2="48" y2="{H-38}" stroke="{c["text"]}" stroke-width="1.5" stroke-dasharray="5 4"/><text x="56" y="{H-34}" font-size="12" fill="{c["text2"]}">mean {h["mean"]:.3f}; bars = overlap between the found page and the labelled page</text>'
    s += f'<line x1="{x0}" y1="{yb}" x2="{x1}" y2="{yb}" stroke="{c["text2"]}" stroke-width="1"/>'
    s += f'<text x="24" y="{H-14}" font-size="12" fill="{c["text2"]}">t7 is a very steep angle, the weakest shot (0.65). Only 8 photos: a good sign, not proof.</text>'
    return s + '</svg>'

def apk(c):
    parts = D['apk']['parts_mb']; W = 720; rowh = 46; H = 96 + rowh * len(parts) + 40; x0, x1 = 250, 640
    s = head(W, H, c, f'Install size: {D["apk"]["total_mb"]} MB', 'What is inside the arm64 release APK (compressed size in MB)', 'Horizontal bar chart of APK contents: native libraries 13.7 MB, model 3.3, code 2.3, resources 0.5, UI bundle 0.09')
    mx = max(v for _, v in parts)
    short = ['Native libraries', 'Edge-detection model', 'App + library code', 'Icons and resources', 'UI bundle (all screens)']
    sub = ['ONNX Runtime, Lynx engine, text, graphics', '0.9 M parameters', 'Kotlin app + dependencies', '', 'ReactLynx, minified']
    for i, (name, v) in enumerate(parts):
        y = 84 + i * rowh; w = max(3, (x1 - x0) * v / mx)
        s += f'<text x="{x0-14}" y="{y+14}" font-size="13" font-weight="600" text-anchor="end" fill="{c["text"]}">{esc(short[i])}</text>'
        if sub[i]: s += f'<text x="{x0-14}" y="{y+29}" font-size="10.5" text-anchor="end" fill="{c["text2"]}">{esc(sub[i])}</text>'
        s += hbar(x0, y, w, 26, c['ours'])
        s += f'<text x="{x0+w+9}" y="{y+18}" font-size="13" font-weight="650" fill="{c["text"]}">{v:.2f}'.rstrip('0').rstrip('.') + ' MB</text>'
    s += f'<line x1="{x0}" y1="78" x2="{x0}" y2="{H-44}" stroke="{c["text2"]}" stroke-width="1"/>'
    s += f'<text x="24" y="{H-16}" font-size="12" fill="{c["text2"]}">The UI is 0.09 MB; the weight is the engines. No ads, analytics or network SDKs.</text>'
    return s + '</svg>'

def latency(c):
    L = D['latency']; W, H = 720, 360; x0, x1, yb, yt = 70, 696, 280, 96; top = 70.0
    s = head(W, H, c, f'Edge detection: {L["p50_ms"][1]:.1f} ms per frame', 'Model inference time, median of 300 runs (desktop CPU proxy, see note)', 'Bar chart of model inference time: 9.3 ms on 1 thread, 4.5 on 2, 3.2 on 4, far under the 60 ms live budget')
    for v in (0, 20, 40, 60):
        y = yb - (yb - yt) * v / top
        s += f'<line x1="{x0}" y1="{y}" x2="{x1}" y2="{y}" stroke="{c["grid"]}" stroke-width="1"/><text x="{x0-10}" y="{y+4}" font-size="11" text-anchor="end" fill="{c["text2"]}">{v}</text>'
    s += f'<text x="{x0-10}" y="{yt-14}" font-size="11" text-anchor="end" fill="{c["text2"]}">ms</text>'
    gw = (x1 - x0) / 3; bw = 96
    for i, th in enumerate(L['threads']):
        v = L['p50_ms'][i]; bh = (yb - yt) * v / top; bx = x0 + gw * (i + 0.5) - bw / 2
        s += bar(bx, yb - bh, bw, bh, c['ours'])
        s += f'<text x="{bx+bw/2}" y="{yb-bh-8}" font-size="14" font-weight="650" text-anchor="middle" fill="{c["text"]}">{v:.1f} ms</text>'
        lab = f'{th} thread' + ('s' if th > 1 else '') + ('  (what the app uses)' if th == L['app_threads'] else '')
        s += f'<text x="{bx+bw/2}" y="{yb+22}" font-size="12.5" font-weight="{650 if th == L["app_threads"] else 500}" text-anchor="middle" fill="{c["text"]}">{esc(lab)}</text>'
    yl = yb - (yb - yt) * L['live_budget_ms'] / top
    s += f'<line x1="{x0}" y1="{yl}" x2="{x1}" y2="{yl}" stroke="{c["other"]}" stroke-width="2" stroke-dasharray="6 4"/>'
    s += f'<text x="{x1}" y="{yl-7}" font-size="12" font-weight="600" text-anchor="end" fill="{c["text"]}">live outline budget: one pass every 60 ms</text>'
    s += f'<line x1="{x0}" y1="{yb}" x2="{x1}" y2="{yb}" stroke="{c["text2"]}" stroke-width="1"/>'
    s += f'<text x="24" y="{H-16}" font-size="12" fill="{c["text2"]}">Measured on an Apple-silicon Mac. Phones are slower; on-phone timing is not measured yet.</text>'
    return s + '</svg>'

for name, fn in [('accuracy', accuracy), ('heldout', heldout), ('size', apk), ('speed', latency)]:
    for mode, c in THEMES.items():
        open(os.path.join(OUT, f'chart-{name}-{mode}.svg'), 'w').write(fn(c))
print('ok')

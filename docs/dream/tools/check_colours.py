"""Measures the colour pairs that matter and writes data/contrast.json. Run: python3 tools/check_colours.py"""
import json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAL = json.load(open(os.path.join(ROOT, 'data', 'palettes.json')))
T, Q = PAL['tokens'], PAL['quilt']

def hx(c): c = c.lstrip('#'); return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))
def mix(a, b, t): a, b = hx(a), hx(b); return '#%02X%02X%02X' % tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))
def lum(c):
    v = [x / 255 for x in hx(c)]; v = [x / 12.92 if x <= 0.03928 else ((x + 0.055) / 1.055) ** 2.4 for x in v]
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]
def ratio(a, b): la, lb = sorted((lum(a), lum(b)), reverse=True); return round((la + 0.05) / (lb + 0.05), 2)

rows = []
def row(stage, what, fg, bg, need):
    r = ratio(fg, bg); rows.append(dict(stage=stage, pair=what, fg=fg, bg=bg, ratio=r, need=need, ok=r >= need))

SHEEP = '#F7F4FB'
for n, P in PAL['stages'].items():
    row(n, 'sheep on the hills behind it', SHEEP, P['mid'], 4.5)
    row(n, 'sheep on the horizon band', SHEEP, mix(P['sky'][4], P['glow'], 0.55), 3.0)
    for i in (0, 1, 2):
        row(n, f'star words (frost at 85%) on sky band {i}', mix(P['sky'][i], T['frost'], 0.85), P['sky'][i], 4.5)
    row(n, 'newest star word (lantern-hi) on sky band 2', T['lanternHi'], P['sky'][2], 4.5)
    row(n, 'sign board against the sky behind it (its outline is ink)', T['night2'], P['sky'][3], 1.0)
    row(n, 'counter text (wool on night-2)', T['wool'], T['night2'], 4.5)
    # the lane must be the brightest band
    others = {'hills': P['mid'], 'horizon band': mix(P['sky'][4], P['glow'], 0.55), 'ground under the lane': P['soil']}
    if n == '1': others['field in front'] = mix(P['snow'], P['sky'][2], 0.62)
    if n == '3': others.update({f'quilt patch {PAL["quiltNames"][i]}': mix(Q[i], P['soil'], 0.18) for i in range(5)})
    for k, c in others.items():
        rows.append(dict(stage=n, pair=f'lane brighter than {k}', fg=P['snow'], bg=c, ratio=ratio(P['snow'], c), need=1.5, ok=lum(P['snow']) > lum(c) and ratio(P['snow'], c) >= 1.5))
row('all', 'sign and tray letters (ink on lantern)', T['ink'], T['lantern'], 4.5)
row('all', 'typed letters (ink on wool)', T['ink'], T['wool'], 4.5)
row('all', 'card title (wool on ink)', T['wool'], T['ink'], 4.5)
row('all', 'card line 2 and hints (frost on ink)', T['frost'], T['ink'], 4.5)
row('all', 'hint example word (lantern-hi on ink)', T['lanternHi'], T['ink'], 4.5)
row('all', 'refusal bar text (frost on ink)', T['frost'], T['ink'], 4.5)
row('all', 'results count (ink on nightshirt cream)', T['ink'], '#E6DFD3', 4.5)
row('all', 'tray label (frost on night)', T['frost'], T['night'], 4.5)
json.dump(rows, open(os.path.join(ROOT, 'data', 'contrast.json'), 'w'), indent=1)
bad = [r for r in rows if not r['ok']]
for r in rows: print(('ok  ' if r['ok'] else 'FAIL'), r['stage'], r['pair'], r['ratio'], 'need', r['need'])
print(len(rows), 'pairs,', len(bad), 'fail')

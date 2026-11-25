"""The checks this pack can run without the game. Run: python3 checks.py
1. Text contrast of the interface (WCAG ratio, pass mark 4.5; 3.0 for large display type).
2. The track is the brightest band of each world.
3. The harshness measures of PLAN_DEPTH_AND_LIGHT (Appendix A): hard edges and the strongest colour.
4. The style rules: every colour is a LADDER token or a named glow; no model uses more than six materials.
Writes data/checks.json."""
import json
import os

import numpy as np

import models_dream
import models_farm
import models_obstacles
import scenes
from ladder import LADDER, tok
from render import Scene, render, hexrgb

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
T = json.load(open(os.path.join(ROOT, 'data', 'palette.json')))['interface_tokens']
out = {}


def lum(h):
    c = np.array(hexrgb(h)) / 255.0
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    return float(0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2])


def ratio(a, b):
    la, lb = lum(a), lum(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


pairs = [
    ('letters on a sign or tray tile', T['ink'], T['lantern'], 4.5), ('letters on a typed tile', T['ink'], T['wool'], 4.5),
    ('letters on a wrong-word tile', T['ink'], T['ember'], 4.5), ('the count on the counter', T['woolHi'], T['night2'], 4.5),
    ('"Best 32" on its tab', T['frost'], T['ink'], 4.5), ('"New best" on its tab', T['ink'], T['lantern'], 4.5),
    ('the chip\'s text', T['wool'], T['ink'], 4.5), ('a card\'s title', T['wool'], T['ink'], 4.5), ('a card\'s second line', T['frost'], T['ink'], 4.5),
    ('the hint strip\'s text', T['frost'], T['ink'], 4.5), ('the hint\'s example word', T['lanternHi'], T['ink'], 4.5),
    ('"Jump" on its button', T['ink'], T['lantern'], 4.5), ('results: text on the board', T['wool'], T['night'], 4.5),
    ('results: small labels on the board', T['frost'], T['night'], 4.5), ('results: text in a well', T['frost'], T['nightDeep'], 4.5),
    ('results: a word in the word list', T['wool'], T['nightDeep'], 4.5), ('results: the count on the pocket', T['ink'], '#E6DFD3', 4.5),
    ('results: the title on its ribbon', T['ink'], T['lantern'], 4.5), ('the snore, on the bedroom wall (its outline)', T['woolHi'], T['ink'], 4.5),
]
for n in (1, 2, 3):
    for part in ('top', 'mid', 'horizon'):
        pairs.append(('the count that pops up, over world %d\'s sky (%s)' % (n, part), T['woolHi'], scenes.SKY[n][part], 3.0))
rows = []
for name, a, b, need in pairs:
    r = ratio(a, b)
    rows.append({'what': name, 'text': a, 'on': b, 'ratio': round(r, 2), 'pass_mark': need, 'pass': r >= need})
out['text_contrast'] = rows
print('text contrast: %d pairs, %d fail' % (len(rows), sum(not r['pass'] for r in rows)))


def oklab(a):
    lin = np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
    r, g, b = lin[..., 0], lin[..., 1], lin[..., 2]
    l = np.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
    m = np.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
    s = np.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
    return (0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s)


out['worlds'] = {}
for n, fn, moon in ((1, scenes.world1, ('moonCrescent', 0.42, 0.36, 96)), (2, scenes.world2, ('moonFull', 0.70, 0.36, 128)), (3, scenes.world3, ('moonFull', 0.62, 0.44, 190))):
    w = fn()
    cam = scenes.camera(28.0, ss=1)
    sc = Scene()
    w.build(sc, cam.cam_x - 60, cam.cam_x + 60)
    scenes.add_moon(sc, cam, *moon)
    f = scenes.FOG[n]
    img, zb = render(sc, cam, scenes.sky_for(n, cam, stars=0), scenes.LIGHT[n], {'colour': scenes.SKY[n]['fog'], 'start': f[0], 'end': f[1], 'most': f[2]})
    a = np.asarray(img).astype(np.float64) / 255
    L, A, B = oklab(a)
    # the track's band: from its far edge to its near edge on screen
    y_far = int(cam.px(0, 0, -1.2)[1])
    y_near = int(cam.px(0, 0, 1.2)[1])
    h = y_near - y_far
    track = float(L[y_far:y_near].mean())
    others = []
    for y in range(0, img.height - h, h):
        if abs(y - y_far) < h:
            continue
        others.append((float(L[y:y + h].mean()), y))
    best_other = max(others)
    jump = np.maximum(np.abs(L[:, 2:] - L[:, :-2])[1:-1, :], np.abs(L[2:, :] - L[:-2, :])[:, 1:-1])
    C = np.hypot(A, B)
    out['worlds'][str(n)] = {
        'track_band_rows': [y_far, y_near], 'track_lightness': round(track, 3),
        'next_brightest_band': {'lightness': round(best_other[0], 3), 'from_row': best_other[1]},
        'track_is_brightest': track > best_other[0],
        'hard_edges_percent': round(float((jump > 0.30).mean()) * 100, 2), 'hard_edges_pass_mark': 2.5,
        'strongest_colour_95th': round(float(np.percentile(C, 95)), 3), 'strongest_colour_pass_mark': 0.17,
        'average_colour_strength': round(float(C.mean()), 3),
    }
    print('world', n, out['worlds'][str(n)])

allm = models_farm.all_models() + models_dream.all_models() + models_obstacles.all_models()
bad_tok, over = [], []
for m in allm:
    for b in m.boxes:
        c = b['c']
        if c.startswith('glow:'):
            continue
        mat, _, st = c.partition(':')
        if mat not in LADDER or not -2 <= int(st) <= 2:
            bad_tok.append((m.id, c))
    mats = {b['c'].split(':')[0] for b in m.boxes if not b['season'] and not b['c'].startswith(('glow', 'snow'))}
    if len(mats) > 6:
        over.append(m.id)
out['style'] = {'models': len(allm), 'boxes': sum(len(m.boxes) for m in allm), 'colours_not_in_the_ladder': bad_tok, 'models_over_six_materials': over}
print('style: models %d, boxes %d, bad tokens %d, over six %d' % (len(allm), out['style']['boxes'], len(bad_tok), len(over)))
json.dump(out, open(os.path.join(ROOT, 'data', 'checks.json'), 'w'), indent=1)

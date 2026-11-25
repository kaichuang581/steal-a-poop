"""Writes the pack's data files from the same code that draws the pictures. Run: python3 build_data.py"""
import json
import os

import models_dream
import models_farm
import models_obstacles
import scenes
from ladder import LADDER, GLOW, tok

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, 'data')
os.makedirs(os.path.join(D, 'models'), exist_ok=True)

groups = [('farm', models_farm.all_models()), ('dream', models_dream.all_models()), ('obstacles', models_obstacles.all_models())]
index = []
used = set()
for gname, ms in groups:
    for m in ms:
        m.save(os.path.join(D, 'models'))
        j = m.to_json()
        index.append({'id': m.id, 'file': 'models/%s.json' % m.id, 'group': gname, 'what': m.what, 'original': m.original,
                      'cell_m': m.cell, 'size_m': j['size_m'], 'boxes': j['box_count'], 'colours': len(j['colours']), 'lights': len(m.lights)})
        used |= set(j['colours'])
json.dump({'note': 'Every voxel model of the dream. Sizes are width (along the lane), height, depth, in metres.', 'models': index},
          open(os.path.join(D, 'models', 'index.json'), 'w'), indent=1)

worlds = {}
for n, fn in ((1, scenes.world1), (2, scenes.world2), (3, scenes.world3)):
    w = fn()
    for r in w.raw:
        used.add(r['c'])
    worlds[str(n)] = {
        'name': {1: 'His own farm', 2: 'The farm lifts off', 3: 'Under the quilt'}[n],
        'sky': scenes.SKY[n], 'fog': dict(zip(('start_m', 'end_m', 'most'), scenes.FOG[n])),
        'picture_light': {k: list(v) for k, v in scenes.LIGHT[n].items()},
        'models_placed': [{k: v for k, v in it.items() if not (v is None or v is False or v == '')} for it in w.items],
        'boxes_placed': [{k: v for k, v in r.items() if not (v is None or v is False or v == '')} for r in w.raw],
        'light_sheets': w.lights,
        'counts': {'models_placed': len(w.items), 'boxes_placed': len(w.raw), 'light_sheets': len(w.lights),
                   'boxes_in_one_strip': sum(len([b for b in scenes.MODELS[it['model']].boxes if not it['parts'] or b['part'] in it['parts']]) for it in w.items) + len(w.raw)},
    }
json.dump({
    'note': 'Where everything stands in each world. One strip is 96 m long and repeats. x runs along the lane, y is up (the track is y 0, the snow beside it y 0.1), z comes toward the camera (the track is z -1.2 to 1.2). Metres. "tint" overrides the row tint. "parts" limits a model to the named parts.',
    'strip_m': scenes.STRIP, 'bay_m': scenes.BAY, 'ground_y_m': scenes.GROUND,
    'rows': {k: {'z_m': v[0], 'tint': v[1]} for k, v in scenes.ROWS.items()},
    'worlds': worlds}, open(os.path.join(D, 'worlds.json'), 'w'), separators=(',', ':'))

json.dump({
    'note': 'The camera of the dream (file 02). It looks level, straight across the track, and never turns. A_px_per_m is the game\'s own art scale: 90 is what the build shows at 1440 x 900; read the real value from the mapping.',
    **scenes.CAMERA,
    'formula': {'horizon_y_px': 'lane_line_y_px - A * EYE', 'screen_x': 'W/2 + A * (x - cam_x) * CAM / (CAM - z)', 'screen_y': 'horizon_y_px - A * (y - EYE) * CAM / (CAM - z)',
                'cam_x': 'sheep_x + (0.5 - sheep_x_share) * W / A'},
    'frustum_at_near_plane_n': {'left': '-(W/2) * n / (A*CAM)', 'right': '(W/2) * n / (A*CAM)', 'top': 'horizon_y_px * n / (A*CAM)', 'bottom': '-(H - horizon_y_px) * n / (A*CAM)'},
    'near_m': 1.0, 'far_m': 600.0, 'phones': {'lane_line_share_of_window_height': 0.72}}, open(os.path.join(D, 'camera.json'), 'w'), indent=1)

pal = {'note': 'Every colour the dream uses. Scenery colours are tokens of the game\'s LADDER (src/skin/voxel/paint.ts): use solid(material, step); the hex values are here only so the pictures can be checked.',
       'ladder_tokens_used': {t: tok(t) for t in sorted(u for u in used if not u.startswith(('glow:', '#')))},
       'glow': GLOW,
       'quilt_order': {'colours': models_dream.QUILT, 'rule': 'A square at column ix, row iz is cream (trimWhite:0) when ix + iz is even; otherwise it takes scarfRed, coopYellow, giftGreen, slate in turn by floor((ix + 3*iz) / 2) mod 4.'},
       'interface_tokens': {'night': '#1B2742', 'night2': '#26365C', 'night3': '#34497A', 'nightDeep': '#141D36', 'ink': '#0E1528', 'wool': '#FFF4DC', 'woolHi': '#FFFDF4',
                            'woolLip': '#D8C49A', 'lantern': '#F2A444', 'lanternHi': '#FFD98A', 'lanternLip': '#B96F1E', 'frost': '#B9C8E6', 'ember': '#F48C6E'},
       'sky': scenes.SKY, 'row_tints': {k: v[1] for k, v in scenes.ROWS.items()}}
# what an untinted block of each paint looks like on each face under each world's light: the game's lights are tuned to these
import numpy as np
from render import srgb_to_lin, lin_to_srgb, hexrgb
tg = {}
for n in (1, 2, 3):
    tg[str(n)] = {}
    for name in ('snow:2', 'snow:0', 'barnRed:0', 'trimWhite:2', 'scarfRed:0', 'giftGreen:0', 'darkWood:0'):
        base = srgb_to_lin(hexrgb(tok(name)))
        tg[str(n)][name] = {face: '#%02X%02X%02X' % tuple(lin_to_srgb(base * np.array(scenes.LIGHT[n][face])).astype(int)) for face in ('top', 'front', 'left', 'right')}
pal['light_targets'] = {'note': "What an untinted block of each paint must look like on its top, front, left and right faces under each world's lights, before haze. Tune the game's lights until a block on the track comes within 8% of these on every face (file 02, section 5).", 'worlds': tg}
json.dump(pal, open(os.path.join(D, 'palette.json'), 'w'), indent=1)
for n in ('1', '2', '3'):
    print('world', n, worlds[n]['counts'])
print('models', len(index), 'boxes in all models', sum(i['boxes'] for i in index))

"""Places Practice's models on the swept farm pond and draws the reference pictures.
The placements are written to data/rink.json; file 03's tables are made from the same list."""
import json
import math
import os

import numpy as np

import bursts
import models_farm
import models_practice as mp
import skins
from kit import Model
from ladder import tok
from render import Camera, Scene, render, sky_gradient, srgb_to_lin, hexrgb

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS = {m.id: m for m in models_farm.all_models() + mp.all_models() + skins.all_models()}
MODELS['bomb_ice_low'] = skins.bomb('ice', fuse=3, id='bomb_ice_low')
MODELS['bomb_ice_game'] = skins.bomb('ice', id='bomb_ice_game')
MODELS['sheepStandIn'] = mp.sheep_standin()
MODELS['dogStandIn'] = mp.dog_standin()
LIGHT = {'top': (0.60, 0.69, 0.96), 'front': (0.40, 0.47, 0.72), 'left': (0.25, 0.30, 0.52), 'right': (0.31, 0.37, 0.60), 'bottom': (0.14, 0.17, 0.32)}
SKY = {'top': '#0E1834', 'mid': '#1C2B52', 'horizon': '#2D406B', 'below': '#2D406B', 'fog': '#2D406B'}
FOG = (14, 70, 0.80)

SHEEP_X = 1.7          # each sheep stands this far from the middle line
ICE = (-6.0, 6.0, -2.6, 2.2)


def tint_at(z):
    return float(np.interp(z, [-60, -20, -8, -3, 0, 3], [0.54, 0.58, 0.68, 0.86, 1.0, 0.78]))


class Rink:
    def __init__(self):
        self.items, self.raw = [], []

    def put(self, model, x, z, y=0.0, mirror=False, note='', parts=None, tint=None):
        self.items.append({'model': model, 'x': round(x, 3), 'y': round(y, 3), 'z': round(z, 3), 'mirror': mirror, 'parts': parts, 'note': note, 'tint': tint})

    def box(self, x0, y0, z0, x1, y1, z1, c, note='', unlit=False, tint=None):
        self.raw.append({'b': [round(v, 3) for v in (x0, y0, z0, x1, y1, z1)], 'c': c, 'note': note, 'unlit': unlit, 'tint': tint})

    def build(self, sc, festive=True, skip=()):
        for it in self.items:
            if it['model'] in skip:
                continue
            t = it['tint'] if it['tint'] is not None else tint_at(it['z'])
            MODELS[it['model']].place(sc, it['x'], it['y'], it['z'], tint=t, festive=festive, mirror=it['mirror'], parts=it['parts'], glow=0.0 if it['parts'] else 1.0, skip=it.get('skip', ()))
        for r in self.raw:
            x0, y0, z0, x1, y1, z1 = r['b']
            t = r['tint'] if r['tint'] is not None else tint_at((z0 + z1) / 2)
            sc.box(x0, y0, z0, x1, y1, z1, tok(r['c']), r['unlit'], 1.0 if r['unlit'] else t)


def ring(rk, cx, cz, r, note):
    """A chalk ring, 0.1 m pixels: the cells whose middle lies within 0.05 m of the circle."""
    n = int(r / 0.1) + 2
    for i in range(-n, n):
        for j in range(-n, n):
            x, z = (i + 0.5) * 0.1, (j + 0.5) * 0.1
            if abs(math.hypot(x, z) - r) < 0.055:
                rk.box(cx + i * 0.1, 0.0, cz + j * 0.1, cx + (i + 1) * 0.1, 0.008, cz + (j + 1) * 0.1, 'snow:2', note)


def rink():
    rk = Rink()
    x0, x1, z0, z1 = ICE
    # the snow field the pond lies in
    rk.box(-80, -0.4, -90, 80, 0.0, 8, 'snow:0', 'snow field (one step below the boards; the ice is cut into it)')
    # the ice: 1.2 m plates in two steps, as a checker (the ice was cut and laid in plates)
    for i, x in enumerate(np.arange(x0, x1, 1.2)):
        for j, z in enumerate(np.arange(z0, z1, 1.2)):
            even = (i + j) % 2 == 0
            rk.box(x, -0.05, z, min(x + 1.2, x1), 0.004, min(z + 1.2, z1), 'ice:-2', 'ice plate', tint=0.60 if even else 0.53)
    # chalk: the middle line, the two standing rings, the two end lines
    rk.box(-0.04, 0.0, z0, 0.04, 0.008, z1, 'snow:2', 'chalk: middle line')
    for sx in (-SHEEP_X, SHEEP_X):
        ring(rk, sx, 0.0, 0.75, 'chalk: standing ring')
    # boards: back row, two sides, a low front row
    for k in range(5):
        rk.put('rinkBoards', x0 + k * 2.4, z0 - 0.05, note='back boards')
    rk.box(x0 - 0.1, 0, z0, x0, 0.6, z1, 'wood:0', 'side boards (left)')
    rk.box(x1, 0, z0, x1 + 0.1, 0.6, z1, 'wood:0', 'side boards (right)')
    for k in range(5):
        rk.put('rinkBoardsFront', x0 + k * 2.4, z1 + 0.1, note='front boards, 0.3 m')
    for k in range(5):
        rk.put('snowBank', x0 + k * 2.4, z0 - 0.15, note='the swept snow, behind the back boards')
    # the tally board, the coach, the crate, the broom
    rk.put('tallyBoard', 0.0, -4.3, note='tally board, its face 1.5..2.7 m up')
    rk.put('coachChair', -2.15, -3.35, note="the coach's high chair, beside the board")
    rk.put('dogStandIn', -2.15, -3.35, y=1.75, note="the game's own sheepdog sits here, facing the ice (picture: stand-in)")
    rk.put('whistle', -1.77, -3.15, y=2.05, note="the whistle on the sheepdog's chest")
    rk.put('tileRack', 0.0, 2.35, note='the tile rack on the middle bay of the front boards')
    rk.put('practiceCrate', 3.2, -1.9, note='crate of corked practice bombs')
    rk.put('broom', 2.45, -2.45, note='broom leaning on the back boards')
    rk.put('lightPost', -4.4, -2.95, note='rink corner post with lantern')
    rk.put('lightPost', 4.4, -2.95, note='rink corner post with lantern')
    # the season's bulb strings: from each post's top to the tally board's roof corner, sagging 0.25 m
    for (ax, ay, az), (bx, by, bz) in (((-4.4, 2.45, -2.95), (-1.45, 2.95, -4.3)), ((4.4, 2.45, -2.95), (1.45, 2.95, -4.3))):
        n = 12
        for i in range(n + 1):
            t = i / n
            x, z = ax + (bx - ax) * t, az + (bz - az) * t
            y = ay + (by - ay) * t - 0.25 * 4 * t * (1 - t)
            rk.box(x - 0.015, y - 0.015, z - 0.015, x + 0.015, y + 0.015, z + 0.015, 'darkWood:-1', 'bulb wire')
            if 0 < i < n:
                c = ('glow:bulbRed', 'glow:bulbGold', 'glow:bulbSage')[i % 3]
                rk.box(x - 0.05, y - 0.11, z - 0.05, x + 0.05, y - 0.01, z + 0.05, c, 'bulb (season)', unlit=True)
    # the farm beyond the pond: Home's own buildings, far and hazed
    rk.put('barn', -9.5, -26, note='the barn')
    rk.put('silo', -4.2, -27, note='the silo')
    rk.put('farmhouse', 10.0, -32, note='the farmhouse')
    for k in range(-8, 8):
        rk.put('fenceBay', k * 2.4, -9.0, parts=['body'], note='farm fence along the field (its bulbs left off: the rink has its own)')
    for x, z, kind, h in ((-15, -14, 'spire', 6.5), (-12.2, -16, 'cone', 5.0), (-1.5, -46, 'round', 7.0), (4.4, -44, 'spire', 8.0),
                          (7.2, -13, 'cone', 4.5), (15, -15, 'spire', 6.0), (18, -20, 'round', 6.5), (-20, -22, 'cone', 7.0)):
        pid = f'pine_{kind}_{h}'
        if pid not in MODELS:
            MODELS[pid] = models_farm.pine(pid, h, kind)
        rk.put(pid, x, z, note='pine')
    return rk


def sheep(sc, holder='player', bot='bibEasy', frozen=None):
    """The two sheep (stand-ins), the bot's bib, the bomb by whoever holds it, their shadows. frozen: 'player' | 'bot'."""
    sh = MODELS['sheepStandIn']
    for side, x, mirror in (('player', -SHEEP_X, False), ('bot', SHEEP_X, True)):
        sh.place(sc, x, 0.0, 0.0, mirror=mirror, tint=0.92 if frozen == side else 1.0)
        if frozen == side:
            MODELS['iceBlock'].place(sc, x, 0.0, 0.0)
            sc.add(x - 0.75, 0.0, x + 0.75, 1.55, 0.44, tok('ice:0'), 0.10)
        if side == 'bot' and bot:
            MODELS[bot].place(sc, x, 0.0, 0.0, mirror=True)
        sc.shadow(x - 0.55, -0.32, x + 0.55, 0.36, 0.0, 0.30)
    if holder:
        bx = -0.62 if holder == 'player' else 0.62
        sc.shadow(bx - 0.22, 0.12, bx + 0.22, 0.58, 0.0, 0.32)
        return bx, 0.35
    return None


def camera(W=1440, H=900, A=210.0, CAM=9.0, EYE=2.7, lane=0.70, ss=2, cam_x=0.0):
    return Camera(W=W, H=H, A=A, CAM=CAM, EYE=EYE, lane_frac=lane, cam_x=cam_x, ss=ss)


def sky(cam, stars=80, seed=5):
    stops = [(0.0, SKY['top']), (0.55, SKY['mid']), (1.0, SKY['horizon']), (cam.H / max(cam.hy, 1), SKY['below'])]
    s = sky_gradient(cam, stops)
    rng = np.random.RandomState(seed)
    for i in range(stars):
        x, y = int(rng.rand() * cam.W), int(rng.rand() * cam.hy * 0.85)
        sz = cam.ss * (2 if i % 3 else 3)
        a = (0.35, 0.55, 0.8)[i % 3]
        s[y:y + sz, x:x + sz] = s[y:y + sz, x:x + sz] * (1 - a) + srgb_to_lin(hexrgb('#B9C8E6')) * a
    return s


def shot(cam, holder='player', bomb='bomb_ice_game', bot='bibEasy', extra=None, festive=True, frozen=None, skip=(), board_skip=()):
    sc = Scene()
    rk = rink()
    for it in rk.items:
        if it['model'] == 'tallyBoard' and board_skip:
            it['skip'] = board_skip
    rk.build(sc, festive=festive, skip=skip)
    at = sheep(sc, holder, bot, frozen)
    if at and bomb:
        MODELS[bomb].place(sc, at[0], 0.0, at[1])
    if extra:
        extra(sc)
    img, zb = render(sc, cam, sky(cam), LIGHT, {'colour': SKY['fog'], 'start': FOG[0], 'end': FOG[1], 'most': FOG[2]})
    return img, len(sc.boxes)


def save_data():
    rk = rink()
    out = {'about': 'Every placement of the rink, in metres. x across the screen (+x toward the bot), y up, z toward the camera. '
                    'Ice top is y 0. Models are in data/models; raw boxes are drawn as given. Tints: tint_at(z) unless given.',
           'sheep_x_m': SHEEP_X, 'ice_m': dict(zip(('x0', 'x1', 'z0', 'z1'), ICE)),
           'bomb_at_m': {'player': [-0.62, 0.0, 0.35], 'bot': [0.62, 0.0, 0.35]},
           'tint_at_z': {'z': [-60, -20, -8, -3, 0, 3], 'tint': [0.54, 0.58, 0.68, 0.86, 1.0, 0.78]},
           'light': LIGHT, 'sky': SKY, 'fog': dict(zip(('start_m', 'end_m', 'most'), FOG)),
           'items': rk.items, 'raw_boxes': rk.raw}
    json.dump(out, open(os.path.join(ROOT, 'data', 'rink.json'), 'w'), indent=1)
    return out


if __name__ == '__main__':
    img, n = shot(camera())
    img.save('/tmp/p1.png')
    print(n)

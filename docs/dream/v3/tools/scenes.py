"""Places the models into the three worlds, at the plan's own numbers, and draws the reference pictures.
The placements are written to data/worlds.json; the plan's tables are made from the same lists."""
import json
import math
import os
import sys

import numpy as np
from PIL import Image

import models_dream
import models_farm
import models_obstacles
from ladder import tok
from render import Camera, Scene, render, sky_gradient, srgb_to_lin, hexrgb

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS = {m.id: m for m in models_farm.all_models() + models_dream.all_models() + models_obstacles.all_models()}
MODELS['sheepStandIn'] = models_obstacles.sheep_standin()

# ---- the camera (file 02) -------------------------------------------------------------------------
CAMERA = {'A_px_per_m_at_1440x900': 90.0, 'CAM_m': 16.0, 'EYE_m': 2.4, 'lane_line_share_of_window_height': 0.76,
          'sheep_x_share_of_window_width': 0.221}
WIN = (1440, 626)          # the dream window at 1440 x 900
STRIP = 96.0               # every world's strip repeats after 96 m
GROUND = 0.1               # the snow lies one step above the track
BAY = 2.4

ROWS = {  # name: (z of the row's middle, tint)
    'F2': (5.6, 0.46), 'F1': (3.4, 0.54), 'lane': (0.0, 1.0), 'B1': (-3.0, 0.72),
    'B2': (-10.0, 0.68), 'B3': (-30.0, 0.68), 'B4': (-60.0, 0.66), 'B5': (-110.0, 0.64),
}
TINT_TRACK_EDGE = 0.60     # the tint of the ground right beside the track, both sides

LIGHT = {
    1: {'top': (0.60, 0.69, 0.96), 'front': (0.37, 0.44, 0.70), 'left': (0.25, 0.30, 0.52), 'right': (0.31, 0.37, 0.60), 'bottom': (0.14, 0.17, 0.32)},
    2: {'top': (0.50, 0.76, 0.90), 'front': (0.31, 0.46, 0.66), 'left': (0.21, 0.31, 0.50), 'right': (0.26, 0.39, 0.58), 'bottom': (0.20, 0.36, 0.44)},
    3: {'top': (0.92, 0.78, 0.64), 'front': (0.62, 0.50, 0.50), 'left': (0.38, 0.31, 0.40), 'right': (0.54, 0.42, 0.42), 'bottom': (0.22, 0.17, 0.24)},
}
SKY = {
    1: {'top': '#0E1834', 'mid': '#1C2B52', 'horizon': '#2D406B', 'below': '#2D406B', 'fog': '#2D406B'},
    2: {'top': '#0B1730', 'mid': '#16304F', 'horizon': '#235066', 'below': '#0F2238', 'fog': '#1E4459'},
    3: {'top': '#1A1430', 'mid': '#2C1F3F', 'horizon': '#5A3A4A', 'below': '#241A30', 'fog': '#4A3340'},
}
FOG = {1: (26, 150, 0.82), 2: (26, 170, 0.80), 3: (20, 110, 0.62)}


def tint_at(z):
    """The row tint for any z: straight lines between the rows' tints."""
    pts = sorted((v[0], v[1]) for v in ROWS.values())
    zs, ts = [p[0] for p in pts], [p[1] for p in pts]
    return float(np.interp(z, zs, ts))


class World:
    def __init__(self, n):
        self.n, self.items, self.raw, self.lights = n, [], [], []

    def put(self, model, x, z, y=None, mirror=False, note='', parts=None, tint=None):
        self.items.append({'model': model, 'x': round(x, 2), 'y': round(GROUND if y is None else y, 2), 'z': round(z, 2),
                           'mirror': mirror, 'parts': parts, 'note': note, 'tint': tint})

    def box(self, x0, y0, z0, x1, y1, z1, c, note='', unlit=False, tint=None):
        self.raw.append({'b': [round(v, 3) for v in (x0, y0, z0, x1, y1, z1)], 'c': c, 'note': note, 'unlit': unlit, 'tint': tint})

    def sheet(self, x0, y0, x1, y1, z, c, amount, note=''):
        self.lights.append({'b': [round(v, 2) for v in (x0, y0, x1, y1, z)], 'c': c, 'amount': amount, 'note': note})

    def build(self, scene, x_from, x_to, festive=True):
        """Lay the strip end to end as often as the picture needs."""
        k0, k1 = int(math.floor((x_from - 60) / STRIP)), int(math.floor((x_to + 60) / STRIP))
        for k in range(k0, k1 + 1):
            off = k * STRIP
            for it in self.items:
                m = MODELS[it['model']]
                t = it['tint'] if it['tint'] is not None else tint_at(it['z'])
                m.place(scene, it['x'] + off, it['y'], it['z'], tint=t, festive=festive, mirror=it['mirror'], parts=it['parts'])
            for l in self.lights:
                x0, y0, x1, y1, z = l['b']
                scene.add(x0 + off, y0, x1 + off, y1, z, tok(l['c']), l['amount'])
            for r in self.raw:
                x0, y0, z0, x1, y1, z1 = r['b']
                t = r['tint'] if r['tint'] is not None else tint_at((z0 + z1) / 2)
                scene.box(x0 + off, y0, z0, x1 + off, y1, z1, tok(r['c']), r['unlit'], 1.0 if r['unlit'] else t)


# ---- world 1: his own farm ---------------------------------------------------------------------------

def ripples(w, z0, z1, x_step=1.6, note='wind ripple'):
    """Home's wind ripples (PLAN_DEPTH_AND_LIGHT 6.4), made finer for this close view and turned to lie
    across the lane's wind: one low ridge every 1.6 m along the lane, 0.3 m wide, 0.1 m high, its two
    ends staggered by a fixed order of four."""
    n = int(STRIP / x_step)
    for i in range(n):
        x = i * x_step + 0.5
        a = z0 + (0.0, 0.6, 0.2, 0.9)[i % 4]
        b = z1 - (0.5, 0.0, 0.8, 0.3)[i % 4]
        w.box(x, GROUND, a, x + 0.3, GROUND + 0.1, b, 'snow:1', note)


def world1():
    w = World(1)
    # the ground, one step above the track; the track is the brightest thing in the dream
    w.box(0, -1.0, -150, STRIP, GROUND, -1.2, 'snow:0', 'the snow behind the track', tint=0.56)
    w.box(0, -1.0, 1.2, STRIP, GROUND, 9.0, 'snow:0', 'the snow in front of the track', tint=0.50)
    w.box(0, -1.0, -1.2, STRIP, 0.0, 1.2, 'snow:2', 'the track', tint=1.0)
    for sgn in (-1, 1):                                  # banks: one step, two steps, one step (Home's rule)
        for (a, b, h) in ((1.2, 1.5, 0.1), (1.5, 1.9, 0.2), (1.9, 2.2, 0.1)):
            z0, z1 = (a, b) if sgn > 0 else (-b, -a)
            w.box(0, GROUND, z0, STRIP, GROUND + h, z1, 'snow:1', 'bank beside the track', tint=0.78 if sgn < 0 else 0.60)
    ripples(w, 2.7, 4.6)
    ripples(w, -8.4, -4.4, note='wind ripple, behind the fence')
    # B1: the farm fence and its string of bulbs, the whole way
    for i in range(int(STRIP / BAY)):
        w.put('fenceBay', i * BAY, ROWS['B1'][0], note='fence bay %d' % i)
    # F2: the dry-stone wall, the whole way, nearest the camera. Nothing stands between it and the track but snow
    for i in range(int(STRIP / BAY)):
        w.put('wallBay', i * BAY, ROWS['F2'][0], note='wall bay %d' % i)
    # things that poke through the snow behind the fence: each low, each at a fixed place, each beside something
    for (mm, x, z) in (('stump', 22.0, -6.6), ('snowman', 36.5, -6.4), ('log', 61.0, -6.8), ('shrubMound', 9.5, -6.2),
                       ('shrubMound', 44.0, -7.0), ('stump', 70.0, -6.0), ('shrubMound', 78.0, -6.6), ('log', 95.0, -6.4)):
        w.put(mm, x, z)
    # the farm, in its order along the strip (x, z)
    farm = [
        ('pineSpire', 2.0, -33.0), ('baleStack', 6.0, -9.0), ('barn', 14.0, -30.0), ('silo', 19.4, -29.4),
        ('pineCone', 24.0, -13.0), ('pineSpire', 26.5, -36.0), ('scarecrow', 29.0, -10.5), ('pineCone', 30.5, -33.0),
        ('pineRound', 33.0, -8.5), ('farmhouse', 40.0, -29.0), ('pineSpire', 49.5, -14.5), ('pineSpire', 46.5, -35.0),
        ('coop', 54.0, -11.5), ('pineCone', 57.0, -31.0), ('pineCone', 59.5, -9.0), ('windmill', 64.0, -60.0),
        ('pineSpire', 67.0, -13.0), ('pond', 73.5, -9.5), ('pineSpire', 77.5, -32.0), ('pineRound', 81.0, -8.5),
        ('pineCone', 84.5, -35.0), ('pineCone', 87.0, -14.0), ('baleStack', 90.0, -9.5), ('pineSpire', 93.0, -11.0),
    ]
    for (m, x, z) in farm:
        w.put(m, x, z, GROUND + (2.5 if m == 'windmill' else 0))
    # the windmill's hill: three steps of land
    for k, (hw, hd) in enumerate(((11.0, 7.0), (8.0, 5.0), (5.0, 3.5))):
        w.box(64 - hw, GROUND + k * 0.8 + (0.1 if k else 0), -60 - hd, 64 + hw, GROUND + (k + 1) * 0.8 + 0.1, -60 + hd, 'snow:%d' % (-1 + k), 'the mill hill, step %d' % (k + 1))
    # B5: far hills, each a pile of long low steps, with a stand of small pines
    for (cx, half, steps) in ((12, 30, 3), (50, 22, 2), (82, 34, 4)):
        for k in range(steps):
            hw = half - k * 7.0
            w.box(cx - hw, GROUND + k * 1.5, -124 + k * 3, cx + hw, GROUND + (k + 1) * 1.5, -100 - k * 3, 'snow:%d' % (-2 + min(k, 2)), 'far hill, step %d' % (k + 1))
        top = GROUND + steps * 1.5
        for j, dx in enumerate((-7.0, -4.2, -1.0, 3.4, 5.6)):
            h = (3.2, 4.4, 3.6, 4.8, 3.0)[j]
            px = cx + dx
            w.box(px - 0.3, top, -112.3, px + 0.3, top + 0.8, -111.7, 'darkWood:-2', 'far pine, trunk')
            w.box(px - 1.1, top + 0.8, -113.1, px + 1.1, top + 0.8 + h * 0.5, -110.9, 'pine:-2', 'far pine, lower tier')
            w.box(px - 0.6, top + 0.8 + h * 0.5, -112.6, px + 0.6, top + 0.8 + h, -111.4, 'pine:-1', 'far pine, upper tier')
    return w


def world2():
    """The same farm, lifted off: every building keeps its place along the strip and rides its own island."""
    w = World(2)
    for i in range(int(STRIP / BAY)):                    # the floating track
        w.put('laneBayFloat', i * BAY, 0.0, 0.0, tint=1.0, note='track bay %d' % i)
    for i in range(int(STRIP / BAY)):                    # the string of bulbs, free of its fence, in one long wave
        x = i * BAY
        w.put('fenceBay', x, ROWS['B1'][0], 0.35 + 0.30 * math.sin(x / 3.0), parts=['string'], note='string bay %d' % i)
    isl = [  # island, x, y of its top, z, then what stands on it: (model, dx, dz)
        ('islandBarn', 16.2, 1.4, -30.0, [('barn', -2.2, 0.0), ('silo', 3.2, 0.6)]),
        ('islandHouse', 40.0, -0.9, -29.0, [('farmhouse', 0.0, 0.0)]),
        ('islandMill', 64.0, 5.0, -60.0, [('windmill', 0.0, 0.0)]),
        ('islandYard', 29.0, 0.9, -10.5, [('scarecrow', -1.2, 0.2), ('baleStack', 1.2, -0.2)]),
        ('islandYard', 54.0, -0.7, -11.5, [('coop', 0.0, 0.0)]),
        ('islandYard', 73.5, 1.6, -9.5, [('pineRound', -1.6, 0.0), ('pineCone', 1.2, -0.3)]),
        ('clodSmall', 24.0, 1.7, -13.0, [('pineCone', 0.0, 0.0)]),
        ('clodSmall', 33.0, -1.1, -8.5, [('pineRound', 0.0, 0.0)]),
        ('clodSmall', 49.5, 0.8, -14.5, [('pineSpire', 0.0, 0.0)]),
        ('clodSmall', 59.5, -1.5, -9.0, [('pineCone', 0.0, 0.0)]),
        ('clodSmall', 67.0, 1.2, -13.0, [('pineSpire', 0.0, 0.0)]),
        ('clodSmall', 81.0, -0.5, -8.5, [('pineRound', 0.0, 0.0)]),
        ('clodSmall', 87.0, 1.0, -14.0, [('pineCone', 0.0, 0.0)]),
        ('clodSmall', 93.0, -1.3, -11.0, [('pineSpire', 0.0, 0.0)]),
        ('clodSmall', 2.0, 2.2, -33.0, [('pineSpire', 0.0, 0.0)]),
        ('clodSmall', 26.5, -2.0, -36.0, [('pineSpire', 0.0, 0.0)]),
        ('clodSmall', 46.5, 2.6, -35.0, [('pineSpire', 0.0, 0.0)]),
        ('clodSmall', 57.0, -2.4, -31.0, [('pineCone', 0.0, 0.0)]),
        ('clodSmall', 77.5, 0.4, -32.0, [('pineSpire', 0.0, 0.0)]),
        ('clodSmall', 84.5, 3.0, -35.0, [('pineCone', 0.0, 0.0)]),
        ('clodWide', 6.0, 2.3, -9.0, [('fenceBay', -1.2, 0.0)]),
        ('clodWide', 89.5, -1.9, -9.5, [('fenceBay', -1.2, 0.0)]),
        ('clodWide', 12.0, 7.0, -105.0, []), ('clodWide', 50.0, -5.0, -112.0, []), ('clodWide', 82.0, 10.0, -108.0, []),
    ]
    for (m, x, y, z, riders) in isl:
        w.put(m, x, z, y)
        for (rm, dx, dz) in riders:
            w.put(rm, x + dx, z + dz, y, parts=['body', 'sails'] if rm in ('fenceBay', 'windmill') else None)
    # in front of the track, just under its level: clods drifting by, dark against the sky
    for (m, x, y, z) in (('clodSmall', 8.0, -0.5, 3.6), ('clodWide', 20.0, -0.2, 5.2), ('clodSmall', 31.0, -0.6, 3.8), ('clodWide', 47.0, -0.25, 5.4),
                         ('clodSmall', 58.0, -0.45, 3.6), ('clodWide', 70.0, -0.2, 5.2), ('clodSmall', 88.0, -0.55, 3.8)):
        w.put(m, x, z, y)
    # the northern light: upright sheets of light far behind, brightest along their lower edge, fading upward
    n = int(STRIP / 1.6)
    for i in range(n):
        x = i * 1.6
        ph = 2 * math.pi * i / n
        y0 = 9.0 + 5.0 * math.sin(ph * 2) + 2.0 * math.sin(ph * 5 + 1.0)
        h = 15 + 6 * math.sin(ph * 3 + 0.6)
        col = ('glow:aurora2', 'glow:aurora1', 'glow:aurora1', 'glow:aurora3')[int((ph / (2 * math.pi)) * 4) % 4]
        for k, (a, b, amt) in enumerate(((0.0, 0.15, 0.50), (0.15, 0.4, 0.34), (0.4, 0.7, 0.20), (0.7, 1.0, 0.09))):
            w.sheet(x, y0 + a * h, x + 1.0, y0 + b * h, -180.0, col, amt, 'northern light, sheet %d, part %d' % (i, k + 1))
    return w


def world3():
    """Under the quilt: the track is the edge of his made bed; behind it the quilt rolls away in padded squares."""
    w = World(3)
    Q = models_dream.QUILT
    for i in range(int(STRIP / BAY)):
        w.put('laneBayBed%d' % (i % 4), i * BAY, 0.0, 0.0, parts=['body'], tint=1.0, note='track bay %d' % i)
        w.put('laneBayBed%d' % (i % 4), i * BAY, 0.0, 0.0, parts=['hang'], tint=0.55, note='track bay %d, hanging part' % i)
    # right behind the track: the quilt's plain lining, turned back. A calm band for the sheep and the signs
    w.box(0, -1.0, -5.2, STRIP, 0.1, -1.2, 'slate:-1', 'the quilt\'s lining, turned back', tint=0.58)
    w.box(0, 0.1, -5.2, STRIP, 0.4, -4.6, 'slate:0', 'the roll where the quilt turns back', tint=0.70)
    for i in range(int(STRIP / 0.8)):
        w.box(i * 0.8 + 0.3, 0.4, -5.1, i * 0.8 + 0.4, 0.5, -4.7, 'trimWhite:1', 'stitch on the roll', tint=0.8)
    # the quilt behind that: squares of 2 m, piled 0 to 3 high by a fixed rule
    def level(ix, iz):
        v = 0.7 + 1.25 * math.sin(2 * math.pi * ix / 16 + iz * 0.55) + 0.9 * math.sin(2 * math.pi * ix / 12 - iz * 0.8 + 1.0)
        v += 0.14 * iz
        lv = int(max(0, min(3, round(v))))
        if iz <= 3:
            lv = 0
        elif iz == 4:
            lv = min(lv, 1)
        return lv
    levels = {}
    for iz in range(3, 17):
        for ix in range(int(STRIP / 2)):
            lv = level(ix, iz)
            levels[(ix, iz)] = lv
            x, z = ix * 2 + 1.0, -1.2 - 2 * iz + 1.0
            y = lv * 0.5 - 0.3
            ci = models_dream.quilt_index(ix, iz)
            w.put(('quiltPatch%d' if iz <= 8 else 'quiltPatchFar%d') % ci, x, z, y)
            if lv > 0:
                w.box(x - 1.0, -1.0, z - 1.0, x + 1.0, y, z + 1.0, Q[ci].partition(':')[0] + ':-2', 'under a raised square')
    w.levels = levels
    w.box(0, -1.2, -150, STRIP, -0.3, -33.2, 'slate:-2', 'the quilt, far away')
    top = lambda ix, iz: levels[(ix, iz)] * 0.5 + 0.2
    props = [('needles', 11, 5), ('spool', 18, 6), ('yarnBall', 25, 4), ('needles', 33, 7), ('yarnBall', 40, 6),
             ('spool', 44, 4), ('bedpost', 6, 14), ('bedpost', 30, 14)]
    for (m, ix, iz) in props:
        w.put(m, ix * 2 + 1.0, -1.2 - 2 * iz + 1.0, top(ix, iz))
    # far away: the quilt's far folds, three long low hills of big squares, and his candle as a lighthouse
    for h, (cx, half, steps) in enumerate(((14, 30, 3), (50, 22, 2), (84, 32, 3))):
        for k in range(steps):
            hw = half - k * 8.0
            mat = ('slate', 'trimWhite', ('scarfRed', 'giftGreen', 'coopYellow')[h])[k]
            n = int(round(2 * hw / 8.0))
            for j in range(n):
                x0 = cx - hw + j * 8.0
                w.box(x0, -0.3 + k * 1.6, -118 + k * 4, x0 + 8.0, -0.3 + (k + 1) * 1.6, -94 - k * 4, '%s:%d' % (mat, -1 if j % 2 == 0 else -2), 'far fold %d, step %d' % (h + 1, k + 1))
    w.put('candle', 54.0, -52.0, -0.3, tint=1.0)
    # button stars on threads, at fixed places
    kinds = ('buttonBrass', 'buttonCream', 'buttonRed')
    for i, (x, y, z) in enumerate(((4, 5.4, -14), (12, 6.8, -26), (19, 4.6, -9), (27, 7.4, -34), (34, 5.8, -18), (41, 5.0, -10),
                                   (48, 7.0, -30), (55, 5.2, -15), (63, 6.6, -24), (70, 4.8, -9), (77, 7.6, -36), (84, 5.6, -17), (91, 6.2, -27))):
        w.put(kinds[i % 3], x, z, y, tint=1.0)
        w.box(x - 0.05, y + 0.4, z, x + 0.05, 60.0, z + 0.1, 'trimWhite:-2', 'thread', tint=0.8)
    return w


def sky_for(n, cam, stars=70, seed=3):
    s = SKY[n]
    H = cam.H
    stops = [(0.0, s['top']), (0.55, s['mid']), (1.0, s['horizon']), (H / max(cam.hy, 1), s['below'])]
    sky = sky_gradient(cam, stops)
    rng = np.random.RandomState(seed)          # the pictures only; in the game stars are hashed from the date
    for i in range(stars):
        x, y = int(rng.rand() * cam.W), int(rng.rand() * cam.hy * 0.9)
        sz = cam.ss * (2 if i % 3 else 3)
        a = (0.35, 0.55, 0.8)[i % 3]
        sky[y:y + sz, x:x + sz] = sky[y:y + sz, x:x + sz] * (1 - a) + srgb_to_lin(hexrgb('#B9C8E6')) * a
    return sky


def camera(strip_x, ss=2, W=WIN[0], H=WIN[1], A=None, lane=None):
    return Camera(W=W, H=H, A=A or CAMERA['A_px_per_m_at_1440x900'], CAM=CAMERA['CAM_m'], EYE=CAMERA['EYE_m'],
                  lane_frac=lane or CAMERA['lane_line_share_of_window_height'], cam_x=strip_x, ss=ss)


def sheep_x(cam):
    return cam.cam_x + (CAMERA['sheep_x_share_of_window_width'] - 0.5) * (cam.W / cam.ss) / (cam.A / cam.ss)


def add_moon(sc, cam, model, share_x, share_y_of_sky, across_px):
    """Hang a moon 420 m away so that it lands where the plan says, at the size the plan says."""
    m = MODELS[model]
    d = 436.0
    z = cam.CAM - d
    cells = (m.size()[3] - m.size()[0]) if 'Full' in model else 32
    cell_px = across_px * cam.ss / cells
    cell_m = cell_px * d / cam.f
    sx, sy = share_x * cam.W, share_y_of_sky * cam.hy
    x = cam.cam_x + (sx - cam.cx) * d / cam.f
    y = cam.EYE + (cam.hy - sy) * d / cam.f
    old = m.cell
    m.cell = cell_m
    m.place(sc, x, y, z)
    m.cell = old


def place_run(sc, cam, obstacle, sheep_y=0.0, jump=False, festive=True):
    """The sheep, one obstacle with its signpost, their shadows on the track."""
    sx = sheep_x(cam)
    sh = MODELS['sheepStandIn']
    sh.place(sc, sx, sheep_y, 0.0)
    sc.shadow(sx - 0.55, -0.32, sx + 0.5, 0.36, 0.0, 0.30 if not jump else 0.16)
    ox = sx + (1.5 if jump else 6.2)
    ob = MODELS[obstacle]
    ob.place(sc, ox, 0.0, 0.0)
    sc.shadow(ox - 0.5, -0.36, ox + 0.5, 0.48, 0.0, 0.30)
    MODELS['signpost'].place(sc, ox - 0.62, 0.0, -0.45)
    return sx, ox


def shot(n, strip_x, obstacle, path, moon=None, jump=False, extra=None, ss=2, festive=True):
    w = {1: world1, 2: world2, 3: world3}[n]()
    cam = camera(strip_x, ss=ss)
    sc = Scene()
    w.build(sc, cam.cam_x - 60, cam.cam_x + 60, festive=festive)
    if moon:
        add_moon(sc, cam, *moon)
    sx, ox = place_run(sc, cam, obstacle, sheep_y=1.25 if jump else 0.0, jump=jump)
    if extra:
        extra(sc, cam, w)
    f = FOG[n]
    img, zb = render(sc, cam, sky_for(n, cam, stars=70 if n == 1 else 50), LIGHT[n], {'colour': SKY[n]['fog'], 'start': f[0], 'end': f[1], 'most': f[2]})
    if path:
        img.save(path)
    return img, cam, sx, ox, len(sc.boxes)

"""Model kit: a model is a list of boxes on its own cell grid.

Axes: x runs along the lane (the sheep runs toward +x), y is up, z comes toward the camera.
A model's origin is the middle of its footprint, on the ground. Box corners are whole cells.
Colours are tokens of the game's LADDER ("barnRed:-1") or "glow:<name>" for things that give light.
"""
import json
import math
import os

from ladder import tok


class Model:
    def __init__(self, id, cell, what, original, step):
        self.id, self.cell, self.what, self.original, self.step = id, cell, what, original, step
        self.boxes, self.lights, self.notes = [], [], []

    def b(self, x0, y0, z0, x1, y1, z1, c, name='', part='body', season=False):
        if x1 <= x0 or y1 <= y0 or z1 <= z0:
            return
        self.boxes.append({'n': name, 'part': part, 'c': c, 'season': season,
                           'b': [x0, y0, z0, x1, y1, z1]})

    def light(self, x, y, z, colour, radius, strength, name=''):
        """A glow sprite and a pool on the ground; never a real light (file 02)."""
        self.lights.append({'n': name, 'at': [x, y, z], 'c': colour, 'radius_m': radius, 'strength': strength})

    def size(self):
        xs = [v for bx in self.boxes for v in (bx['b'][0], bx['b'][3])]
        ys = [v for bx in self.boxes for v in (bx['b'][1], bx['b'][4])]
        zs = [v for bx in self.boxes for v in (bx['b'][2], bx['b'][5])]
        return [min(xs), min(ys), min(zs), max(xs), max(ys), max(zs)]

    def to_json(self):
        s = self.size()
        return {
            'id': self.id, 'what': self.what, 'original': self.original,
            'cell_m': self.cell, 'ladder_step': self.step,
            'axes': 'x along the lane (+x is the way the sheep runs); y up; z toward the camera. Origin: the middle of the footprint, on the ground.',
            'bounds_cells': s,
            'size_m': [round((s[3] - s[0]) * self.cell, 3), round((s[4] - s[1]) * self.cell, 3), round((s[5] - s[2]) * self.cell, 3)],
            'box_count': len(self.boxes),
            'colours': sorted({bx['c'] for bx in self.boxes}),
            'boxes': self.boxes, 'lights': self.lights, 'notes': self.notes,
        }

    def save(self, folder):
        with open(os.path.join(folder, self.id + '.json'), 'w') as fh:
            json.dump(self.to_json(), fh, separators=(',', ':'))

    def place(self, scene, X, Y, Z, tint=1.0, festive=True, mirror=False, parts=None, glow=1.0, scale=1.0, flat=None, skip=()):
        """flat: one hex colour for every box, unlit (a paper cut-out of the model). skip: part names left out."""
        c = self.cell * scale
        for bx in self.boxes:
            if bx['season'] and not festive:
                continue
            if parts and bx['part'] not in parts:
                continue
            if bx['part'] in skip:
                continue
            x0, y0, z0, x1, y1, z1 = bx['b']
            if mirror:
                x0, x1 = -x1, -x0
            unlit = bx['c'].startswith(('glow:', 'lit:'))
            if flat:
                scene.box(X + x0 * c, Y + y0 * c, Z + z0 * c, X + x1 * c, Y + y1 * c, Z + z1 * c, flat, True, 1.0)
                continue
            scene.box(X + x0 * c, Y + y0 * c, Z + z0 * c, X + x1 * c, Y + y1 * c, Z + z1 * c, tok(bx['c']), unlit, 1.0 if unlit else tint)
        for li in ([] if flat else self.lights):
            x, y, z = li['at']
            if mirror:
                x = -x
            scene.glow(X + x * c, Y + y * c, Z + z * c, tok(li['c']), li['radius_m'], li['strength'] * glow)


PAT = (0, -1, 0, 1)   # the game's board order: 0, -1, 0, +1


def boards_x(m, x0, x1, y0, y1, z0, z1, mat, w=4, pat=PAT, name='board', part='body'):
    """Upright boards side by side along x."""
    i = 0
    for x in range(x0, x1, w):
        m.b(x, y0, z0, min(x + w, x1), y1, z1, f'{mat}:{pat[i % len(pat)]}', name, part)
        i += 1


def boards_z(m, x0, x1, y0, y1, z0, z1, mat, w=4, pat=PAT, name='board', part='body'):
    """Upright boards side by side along z."""
    i = 0
    for z in range(z0, z1, w):
        m.b(x0, y0, z, x1, y1, min(z + w, z1), f'{mat}:{pat[i % len(pat)]}', name, part)
        i += 1


def courses_y(m, x0, x1, y0, y1, z0, z1, mat, h=4, pat=(0, 1), name='course', part='body'):
    """Level boards stacked up y (clapboard)."""
    i = 0
    for y in range(y0, y1, h):
        m.b(x0, y, z0, x1, min(y + h, y1), z1, f'{mat}:{pat[i % len(pat)]}', name, part)
        i += 1


def disc_rows(r):
    """Half-widths of each row of a pixel disc of radius r cells (rows -r .. r-1)."""
    out = []
    for j in range(-r, r):
        v = (j + 0.5)
        out.append(int(round(math.sqrt(max(r * r - v * v, 0)))))
    return out


def ball(m, cx, cy, cz, r, colour_of, name='ball', part='body'):
    """A voxel ball: one box per row of each layer. colour_of(dx, dy, dz) -> token."""
    for jy in range(-r, r):
        ry = math.sqrt(max(r * r - (jy + 0.5) ** 2, 0))
        for jz in range(-r, r):
            v = ry * ry - (jz + 0.5) ** 2
            if v <= 0:
                continue
            hx = int(round(math.sqrt(v)))
            if hx <= 0:
                continue
            m.b(cx - hx, cy + jy, cz + jz, cx + hx, cy + jy + 1, cz + jz + 1, colour_of(0, jy, jz), name, part)


def octagon(m, r, y0, y1, c, name='', part='body', cx=0, cz=0):
    """An eight-sided column from three boxes. r: half-width in cells."""
    a = max(1, int(round(r * 0.45)))
    b_ = max(1, int(round(r * 0.75)))
    m.b(cx - r, y0, cz - a, cx + r, y1, cz + a, c, name, part)
    m.b(cx - b_, y0, cz - b_, cx + b_, y1, cz + b_, c, name, part)
    m.b(cx - a, y0, cz - r, cx + a, y1, cz + r, c, name, part)


def _two(mat, base):
    """The material's base step and its neighbour one step darker (one lighter at the bottom of the ladder)."""
    return (f'{mat}:{base}', f'{mat}:{base - 1 if base - 1 >= -2 else base + 1}')


def tile(m, x0, y0, z0, x1, y1, z1, mat, base=0, long='x', across='y', L=None, W=4, name='plank', part='body', season=False, colour=None):
    """Boards, the house style of PLAN_DIORAMA_SCENERY 3.2 and the miniature plan: the box is cut across `across` into
    boards W cells wide that run its whole length along `long`, through its full depth. Boards alternate between the
    material's base step and one step darker, each board one flat colour (VOXEL_GRAIN.md, rule 4). colour(i, j) may
    override (i is always 0; j counts boards). L is ignored: boards are never cut short into patchwork."""
    ax = {'x': 0, 'y': 1, 'z': 2}
    lo = [x0, y0, z0]; hi = [x1, y1, z1]
    b = ax[across]
    tones = _two(mat, base)
    for j, c0 in enumerate(range(lo[b], hi[b], W)):
        c1 = min(c0 + W, hi[b])
        q0, q1 = list(lo), list(hi)
        q0[b], q1[b] = c0, c1
        col = colour(0, j) if colour else tones[j % 2]
        m.b(q0[0], q0[1], q0[2], q1[0], q1[1], q1[2], col, name, part, season)

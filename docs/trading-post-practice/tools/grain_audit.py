"""Audits every model for the two kinds of inconsistency:
1. Grain: the cell size, and the thinnest feature (the smallest box dimension) in metres.
2. Plain slabs: on every exposed face plane, a same-colour area that holds a solid 4 x 13-cell rectangle (either way round).
Text surfaces (parts named face, card, slip, sign, ledge) are exempt from 2."""
import json
import os
import sys
from collections import defaultdict

import numpy as np
from scipy.ndimage import binary_erosion

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXEMPT_PARTS = {'face', 'card', 'slip', 'sign', 'ledge'}
EXEMPT_NAMES = ('page', 'board face', 'cork', 'letter card', 'clock card', 'sign board', 'mission slip', 'milestone sheet', 'patch')


def voxels(m):
    occ = {}
    for bx in m['boxes']:
        x0, y0, z0, x1, y1, z1 = [int(round(v)) for v in bx['b']]
        ex = bx['part'] in EXEMPT_PARTS or bx['n'].startswith(EXEMPT_NAMES)
        for x in range(x0, x1):
            for y in range(y0, y1):
                for z in range(z0, z1):
                    occ[(x, y, z)] = (bx['c'], ex)
    return occ


def outside(occ):
    """The empty cells reachable from outside the model: only faces that look onto these can be seen.
    (Models keep only their surface cells, so their insides are hollow but closed.)"""
    xs = [k[0] for k in occ]; ys = [k[1] for k in occ]; zs = [k[2] for k in occ]
    lo = (min(xs) - 1, min(ys) - 1, min(zs) - 1); hi = (max(xs) + 1, max(ys) + 1, max(zs) + 1)
    seen = {lo}
    stack = [lo]
    while stack:
        x, y, z = stack.pop()
        for dx, dy, dz in ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1)):
            n = (x + dx, y + dy, z + dz)
            if n in seen or n in occ or not all(lo[i] <= n[i] <= hi[i] for i in range(3)):
                continue
            seen.add(n); stack.append(n)
    return seen


def plain_regions(occ, cell=0.05, side_m=0.45):
    """Plain areas: on every exposed face plane, a one-colour area that holds a solid square of side_m (0.4 m: 8 cells at
    0.05 m is 9 cells, so a 0.4 m stripe passes). A board 0.2 m wide passes however long it is; a 0.5 m plain block does not (VOXEL_GRAIN.md, rule 3)."""
    S = max(1, int(round(side_m / cell)))
    bad = []
    out = outside(occ)
    dirs = {'front': (0, 0, 1), 'top': (0, 1, 0), 'left': (-1, 0, 0), 'right': (1, 0, 0)}
    for dname, (dx, dy, dz) in dirs.items():
        faces = defaultdict(dict)
        for (x, y, z), (c, ex) in occ.items():
            if (x + dx, y + dy, z + dz) not in out or ex:
                continue
            if dname == 'front':
                faces[z][(x, y)] = c
            elif dname == 'top':
                faces[y][(x, z)] = c
            else:
                faces[x][(z, y)] = c
        for plane, cells in faces.items():
            seen = set()
            for start in cells:
                if start in seen:
                    continue
                col = cells[start]
                stack, comp = [start], []
                seen.add(start)
                while stack:
                    u, v = stack.pop()
                    comp.append((u, v))
                    for nu, nv in ((u + 1, v), (u - 1, v), (u, v + 1), (u, v - 1)):
                        if (nu, nv) in cells and (nu, nv) not in seen and cells[(nu, nv)] == col:
                            seen.add((nu, nv)); stack.append((nu, nv))
                us = [p[0] for p in comp]; vs = [p[1] for p in comp]
                a, b = max(us) - min(us) + 1, max(vs) - min(vs) + 1
                if a < S or b < S:
                    continue
                mask = np.zeros((a, b), bool)
                for (u, v) in comp:
                    mask[u - min(us), v - min(vs)] = True
                if binary_erosion(mask, structure=np.ones((S, S), bool)).any():
                    bad.append((dname, col, a, b))
    return bad


ACCENT_PARTS = {'spark', 'face'}
ACCENT_NAMES = ('glint', 'star', 'spark')


def front_image(m):
    """What the front camera sees: for each (x, y), the colour, part and name of the nearest box's cell."""
    img = {}
    for bx in m['boxes']:                                      # later boxes win, as in voxels()
        x0, y0, z0, x1, y1, z1 = [int(round(v)) for v in bx['b']]
        for x in range(x0, x1):
            for y in range(y0, y1):
                k = (x, y)
                if k not in img or z1 - 1 >= img[k][0]:
                    img[k] = (z1 - 1, bx['c'], bx['part'], bx['n'])
    return img


def thin_parts(m):
    """Cells, seen from the front, of colour patches narrower than 0.05 m (rule 1: one detail size). Sparks, glints, stars
    and the face are accents and are not counted. Returns the thin cells."""
    k = max(1, int(round(0.05 / m['cell_m'])))
    if k == 1:
        return []
    img = front_image(m)
    xs = [p[0] for p in img]; ys = [p[1] for p in img]
    X0, Y0 = min(xs), min(ys)
    W, H = max(xs) - X0 + 1, max(ys) - Y0 + 1
    thin = []
    from scipy.ndimage import binary_opening
    free = np.ones((W + 2, H + 2), bool)                       # outside the model, the face and the accents count as any colour:
    for (x, y), v in img.items():                              # an outline or a face edge is not a sliver
        if v[2] not in ACCENT_PARTS and not v[3].startswith(ACCENT_NAMES):
            free[x - X0 + 1, y - Y0 + 1] = False
    for col in {v[1] for v in img.values()}:
        mask = free.copy()
        for (x, y), v in img.items():
            if v[1] == col:
                mask[x - X0 + 1, y - Y0 + 1] = True
        kept = binary_opening(mask, structure=np.ones((k, k), bool))
        for (x, y), v in img.items():
            if v[1] == col and not kept[x - X0 + 1, y - Y0 + 1] and v[2] not in ACCENT_PARTS and not v[3].startswith(ACCENT_NAMES):
                thin.append((x, y, col, v[3]))
    return thin


def audit(m):
    c = m['cell_m']
    dims = [min(b['b'][3] - b['b'][0], b['b'][4] - b['b'][1], b['b'][5] - b['b'][2]) * c for b in m['boxes']]
    occ = voxels(m)
    bad = plain_regions(occ, c)
    thin = thin_parts(m)
    return dict(id=m['id'], cell=c, thinnest=round(min(dims), 3), median=round(float(np.median(dims)), 3), boxes=len(m['boxes']),
                cells=len(occ), slabs=len(bad), thin=len(thin), worst=max(bad, key=lambda t: t[2] * t[3]) if bad else None)


ANIMAL_WORN = {'bibEasy', 'bibMedium', 'bibHard', 'whistle'}   # on the animals' 0.04 m grid (VOXEL_GRAIN.md, rule 2)


def cell_for(mid):
    """The cell each model must declare (VOXEL_GRAIN.md, rule 2): small round things in the hand are XS, so their outline
    is round; what animals wear is on the animals' grid; everything else is S."""
    if mid.startswith(('bomb_', 'sound_')):
        return 0.025
    return 0.04 if mid in ANIMAL_WORN else 0.05


def grain_ok(r):
    return abs(r['cell'] - cell_for(r['id'])) < 1e-9


if __name__ == '__main__':
    """python3 grain_audit.py [--data DIR] [-v] [out.json]. Prints only models off the grain or with a plain slab, unless -v."""
    data = sys.argv[sys.argv.index('--data') + 1] if '--data' in sys.argv else os.path.join(ROOT, 'data')
    idx = json.load(open(os.path.join(data, 'models', 'index.json')))['models']
    rows = []
    for e in idx:
        m = json.load(open(os.path.join(data, e['file'])))
        r = audit(m); r['group'] = e['group']; r['on_grain'] = grain_ok(r); rows.append(r)
    for r in rows:
        w = r['worst']
        if r['slabs'] == 0 and r['thin'] == 0 and r['on_grain'] and '-v' not in sys.argv:
            continue
        print(f"{r['group']:13s} {r['id']:20s} cell {r['cell']:.3f}  thinnest {r['thinnest']:.3f}  median {r['median']:.3f}  boxes {r['boxes']:4d}  plain {r['slabs']:3d}  thin {r['thin']:3d}  {'' if r['on_grain'] else 'OFF GRAIN  '}{('worst %s %s %dx%d' % w) if w else ''}")
    out = [a for a in sys.argv[1:] if a.endswith('.json')]
    if out:
        json.dump(rows, open(out[0], 'w'), indent=1, default=str)

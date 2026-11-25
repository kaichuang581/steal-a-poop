"""The eight bomb skins, remodelled. One anatomy (shell, face, cap, fuse, spark), eight characters.
Cell 0.025 m. Skins use their own colours (they stay out of harmonize(), PLAN_DEPTH_AND_LIGHT 3.3); 'lit:' colours give light."""
import math

from kit import Model
from vox import Vox

D = 0.025
PATH = [(0, 1), (0, 1), (1, 1), (0, 1), (1, 1), (1, 0), (1, 1), (1, 0), (1, 0), (1, -1), (1, 0), (1, -1)]   # the fuse's 12 steps

EMBLEM = {
    'ice':        ['..XX..', 'X.XX.X', '.XXXX.', '.XXXX.', 'X.XX.X', '..XX..'],
    'ember':      ['..X...', '..XX..', '.XXX.X', 'XXXXXX', 'XXXXXX', '.XXXX.'],
    'peppermint': ['.XXXX.', 'X....X', 'X.XX.X', 'X.X..X', 'X.XXXX', '.X....'],
    'plum':       ['...XXX', '..XXXX', '.XXXXX', 'XXXXX.', 'XXXX..', 'X.....'],
    'gold':       ['......', 'X.XX.X', 'X.XX.X', 'XXXXXX', 'XXXXXX', 'XXXXXX'],
    'diamond':    ['.XXXX.', 'XX..XX', 'XXXXXX', '.XXXX.', '..XX..', '......'],
    'brassBell':  ['..XX..', '.XXXX.', '.XXXX.', '.XXXX.', 'XXXXXX', '..XX..'],
    'aurora':     ['..XX..', '..XX..', 'XXXXXX', '.XXXX.', '.XXXX.', 'XX..XX'],
}

SKINS = {   # name, where it comes from (as the catalogue has it today), one line, colours
    'ice':        dict(name='Ice', source='Starter', line='The classic frozen bomb.',
                       rim='#CFE8F5', face='#EEF6FB', digit='#1F3A66', danger='#B3261E', cap='#9FB4C8', lip='#EEF6FB',
                       fuse=('#EEF6FB', '#BFDDF0'), tip='#BFEFFF', spark='#FFFFFF'),
    'ember':      dict(name='Ember', source='Oat Sack, common', line='Banked coals in an iron shell.',
                       rim='#2A201E', face='lit:#FFD08A', digit='#3A2418', danger='#A3200F', cap='#4A403C', lip='#6A5A54',
                       fuse=('#5A4842', '#8A6A58'), tip='#F28A3C', spark='#FFC773'),
    'peppermint': dict(name='Peppermint', source='Oat Sack, common', line='A boiled sweet with a short temper.',
                       rim='#69A97F', face='#FFFBF2', digit='#7A211C', danger='#B3261E', cap='#B33B33', lip='#69A97F',
                       fuse=('#C8453C', '#F7F0E6'), tip='#F2A26A', spark='#FFE7B0'),
    'plum':       dict(name='Plum', source='Oat Sack, uncommon', line='Ripe, with a leaf still on.',
                       rim='#E3D5B5', face='#F6ECD6', digit='#3B2548', danger='#B3261E', cap='#5F4530', lip='#7A5A3E',
                       fuse=('#6B4A32', '#7FA86A'), tip='#F2A26A', spark='#FFE7B0'),
    'gold':       dict(name='Gold', source='Oat Sack, rare', line='Polished. Heavier than it looks.',
                       rim='#A87A2A', face='#FAE9B0', digit='#4A3312', danger='#A3200F', cap='#B88A2C', lip='#F7E3A0',
                       fuse=('#B88A2C', '#F7E3A0'), tip='#FFD08A', spark='#FFF8DC'),
    'diamond':    dict(name='Diamond', source='Oat Sack, legendary', line='Cut, not round. Every face catches light.',
                       rim='#74C0CC', face='#F2FDFE', digit='#1E4D59', danger='#B3261E', cap='#C6D5DC', lip='#F2FDFE',
                       fuse=('#C6D5DC', '#FFFFFF'), tip='#DFFBFF', spark='#FFFFFF'),
    'brassBell':  dict(name='Brass Bell', source='Bell Shelf, 30 Bells', line='Rings once. Loudly.',
                       rim='#99702A', face='#F8ECC8', digit='#4A3312', danger='#A3200F', cap='#99702A', lip='#99702A',
                       fuse=('#99702A', '#F2CE7C'), tip='#FFD08A', spark='#FFF8DC'),
    'aurora':     dict(name='Aurora', source='Mission: count sheep 7 nights in a row', line='A piece of the night sky.',
                       rim='#6FB7B0', face='#101830', digit='lit:#C8F5D6', danger='lit:#FF9C8A', cap='#39456A', lip='#6FB7B0',
                       fuse=('#6FB7B0', '#8C8FD8'), tip='#7BC48E', spark='#D6FFE4'),
}
ORDER = ['ice', 'ember', 'peppermint', 'plum', 'gold', 'diamond', 'brassBell', 'aurora']


def th(x, z):
    return math.atan2(z, x)                 # 0 toward +x, pi/2 toward the camera


def ball(v, colour):
    v.fill(((-10, 10), (0, 20), (-10, 10)), lambda x, y, z: x * x + (y - 10) ** 2 + z * z <= 100, colour)


def plus(v, cx, cy, colour, front=True):
    """A four-armed glint on the surface nearest the camera."""
    def pick(x, y, z, c):
        if (z > 0) == front and ((abs(x - cx) < .6 and abs(y - cy) < 1.6) or (abs(y - cy) < .6 and abs(x - cx) < 1.6)):
            return colour
    v.paint(pick, 'detail')


def seg_d(px, py, a, b):
    (ax, ay), (bx, by) = a, b
    dx, dy = bx - ax, by - ay
    t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - ax - t * dx, py - ay - t * dy)


def body_ice(v):
    ball(v, lambda x, y, z: '#2B5A97' if y < 6 else ('#3A72B6' if y < 12 else '#4F8ACB'))
    def cap(x, y, z, c):
        edge = 14.5 + 1.5 * math.cos(4 * th(x, z))                 # the snow cap's scalloped edge: four lobes
        if y >= edge:
            return '#F4F8FB'
        a = (th(x, z) - math.pi / 4) % (math.pi / 2)
        if min(a, math.pi / 2 - a) < 0.13 and edge - 3 <= y < edge:  # an icicle under each low point
            return '#CFE8F5'
    v.paint(cap, 'detail')
    plus(v, -7.5, 5.5, '#CFE8F5'); plus(v, 7.5, 6.5, '#CFE8F5')
    return 19, 10, 9


def body_ember(v):
    ball(v, lambda x, y, z: '#3A2C2A' if y < 10 else '#463633')
    cracks = [[(-9, 12), (-6, 9), (-7, 5), (-4, 2)], [(9, 8), (6, 11), (8, 15), (5, 18)], [(-2, 1), (1, 3), (4, 2), (6, 5)], [(-5, 17), (-2, 19), (1, 17)]]
    def pick(x, y, z, c):
        px = x if z > 0 else -x
        for line in cracks:
            for a, b in zip(line, line[1:]):
                if seg_d(px, y, a, b) < 0.62:
                    hot = any(math.hypot(px - p[0], y - p[1]) < 0.9 for p in line[1:-1])
                    return 'lit:#FFC773' if hot else 'lit:#F28A3C'
    v.paint(pick, 'detail')
    return 19, 10, 9


def body_peppermint(v):
    def col(x, y, z):
        s = (th(x, z) * 4 / (2 * math.pi) + y / 12.0) % 1.0          # four bold stripes, one turn in 12 cells
        return '#C8453C' if s < 0.42 else '#F7F0E6'
    ball(v, col)
    return 19, 10, 9


def body_plum(v):
    ball(v, lambda x, y, z: '#573868' if y < 5 else '#6C4A80')
    def pick(x, y, z, c):
        if z > 0 and (x + 6.5) ** 2 + (y - 15.5) ** 2 <= 5:
            return '#8B6C9F'                                         # the bloom
        if z > 0 and 7 <= x < 8 and 4 < y < 17:
            return '#573868'                                         # the cleft
    v.paint(pick, 'detail')
    for (y, x0, x1) in ((20, 4, 8), (21, 4, 10), (22, 5, 11), (23, 7, 11)):   # the leaf, upright, to the right of the stem
        for x in range(x0, x1):
            for z in (-1, 0):
                v.set(x, y, z, '#4A8056' if x - y == -16 or x - y == -15 else '#5E9B6A', 'detail')
    return 19, 10, 9


def body_gold(v):
    ball(v, lambda x, y, z: '#A87A2A' if y < 5 else ('#E9C25E' if y >= 13 else '#D6A53B'))
    def pick(x, y, z, c):
        if 9 <= y < 11:
            a = th(x, z) % (math.pi / 4)
            return '#F7E3A0' if min(a, math.pi / 4 - a) < 0.10 else '#B88A2C'      # the belt and its rivets
        if z > 0 and (x + 6) ** 2 + (y - 15.5) ** 2 <= 4.5:
            return '#F7E3A0'
    v.paint(pick, 'detail')
    plus(v, 7.5, 15.5, 'lit:#FFF8DC'); plus(v, -7.5, 4.5, 'lit:#FFF8DC')
    return 19, 10, 9


def body_diamond(v):
    def r(y):
        return 3 + 7 * y / 12.0 if y < 12 else (10 if y < 14 else 10 - (y - 13.5))
    def inside(x, y, z):
        rr = r(y)
        return max(abs(x), abs(z)) <= rr and abs(x) + abs(z) <= 1.41 * rr
    def col(x, y, z):
        k = int(math.floor((th(x, z) + math.pi / 8) / (math.pi / 4))) % 2
        if y >= 14:
            return ('#D8F6F8', '#B6E9EE')[k]
        if y >= 12:
            return '#EAFBFC'
        return ('#8FD3DC', '#74C0CC')[k]
    v.fill(((-11, 11), (0, 18), (-11, 11)), inside, col)
    plus(v, -6.5, 15.5, 'lit:#FFFFFF'); plus(v, 6.5, 5.5, 'lit:#FFFFFF')
    return 17, 11, 9


def bell_r(y):
    prof = [10, 10, 9.2, 8.6, 8.1, 7.7, 7.4, 7.2, 7.0, 6.9, 6.8, 6.7, 6.6, 6.4, 6.1, 5.6, 4.9, 3.9, 2.6]
    return prof[int(y)] if 0 <= y < len(prof) else 0


def body_bell(v):
    def col(x, y, z):
        if y < 2 or 4 <= y < 5 or 13 <= y < 14:
            return '#B6852E'
        if 1.95 < th(x, z) < 2.45 and 5 <= y < 13:
            return '#F2CE7C'
        return '#D8A340'
    v.fill(((-10, 10), (0, 19), (-10, 10)), lambda x, y, z: x * x + z * z <= bell_r(y) ** 2, col)
    return 19, 9, 7


def body_aurora(v):
    ball(v, lambda x, y, z: '#18223C' if y >= 14 else '#1F2A49')
    def pick(x, y, z, c):
        a = th(x, z)
        d = y - (8.5 + 2 * math.sin(2 * a + 0.6))
        if -1.5 <= d < -0.5:
            return 'lit:#6FB7B0'
        if -0.5 <= d < 1.0:
            return 'lit:#7BC48E'
        if 1.0 <= d < 2.0:
            return 'lit:#8C8FD8'
        k = int(math.floor(a / (math.pi / 8)))                      # the curtain: a ray above the band every 22.5 degrees
        if abs(a - (k + .5) * math.pi / 8) < 0.07 and 2.0 <= d < 2.0 + (2, 4, 3)[k % 3]:
            return '#4A4F86'
    v.paint(pick, 'detail')
    for (a, y) in ((0.4, 16), (1.1, 17.5), (2.0, 16.5), (2.6, 15.5), (-0.5, 15.5), (-1.4, 17), (-2.4, 16), (3.0, 17.5), (1.57, 18.5)):
        rr = math.sqrt(max(100 - (y - 10) ** 2, 0)) - 0.6
        k = (int(math.floor(rr * math.cos(a))), int(y), int(math.floor(rr * math.sin(a))))
        if k in v.v:
            v.set(*k, 'lit:#E8F0FF', 'detail')
    return 19, 10, 9


BODY = {'ice': body_ice, 'ember': body_ember, 'peppermint': body_peppermint, 'plum': body_plum, 'gold': body_gold,
        'diamond': body_diamond, 'brassBell': body_bell, 'aurora': body_aurora}


def bomb(key, fuse=12, lit=True, emblem=True, id=None):
    s = SKINS[key]
    v = Vox()
    top, cy, zf = BODY[key](v)                   # top: where the cap starts; cy: the face's middle; zf: the face's cell layer
    for z in range(zf - 4, zf + 1):               # the face: a rim of radius 5 and a flat disc of radius 4, one cell proud
        for x in range(-5, 5):
            for y in range(cy - 5, cy + 5):
                d2 = (x + .5) ** 2 + (y + .5 - cy) ** 2
                if d2 <= 25:
                    v.set(x, y, z, s['face'] if (d2 <= 16 and z == zf) else s['rim'], 'face')
    if emblem:
        rows = EMBLEM[key]
        for r, row in enumerate(rows):
            for c, ch in enumerate(row):
                if ch == 'X':
                    v.set(-3 + c, cy + 2 - r, zf, s['digit'], 'emblem')
    if key == 'brassBell':                        # the bell's crown loop is its cap
        for x in (-2, 1):
            for y in range(top, top + 2):
                for z in (-1, 0):
                    v.set(x, y, z, s['cap'], 'cap')
        for x in range(-2, 2):
            for z in (-1, 0):
                v.set(x, top + 2, z, s['cap'], 'cap')
    else:
        for y in range(top, top + 3):
            for x in range(-4, 4):
                for z in range(-4, 4):
                    if abs(x + .5) + abs(z + .5) <= 6 and (y < top + 2 or max(abs(x + .5), abs(z + .5)) <= 3):
                        v.set(x, y, z, s['lip'] if y == top + 2 else s['cap'], 'cap')
    x, y = 0, top + 3
    for i in range(fuse):
        dx, dy = PATH[i]
        for a in (0, 1):
            for b in (0, 1):
                for z in (-1, 0):
                    v.set(x - 1 + a, y + b, z, s['fuse'][i % 2], 'fuse')
        x, y = x + dx, y + dy
    m = Model(id or ('bomb_' + key), D, f"{s['name']}: {s['line']}", s['source'], 'D')
    if lit:
        for a in (0, 1):
            for b in (0, 1):
                for z in (-1, 0):
                    v.set(x - 1 + a, y + b, z, 'lit:' + s['tip'], 'spark')
        for (sx, sy) in ((2, 2), (-2, 3), (3, -1), (0, 4)):
            v.set(x + sx, y + sy, 0, 'lit:' + s['spark'], 'spark')
        m.light(x, y + 1, 0, s['tip'], 0.35, 0.8, 'spark glow')
    v.into(m)
    m.meta = {'key': key, 'name': s['name'], 'source': s['source'], 'line': s['line'],
              'face': {'centre_cells': [0, cy, zf + 1], 'radius_cells': 4, 'rim_radius_cells': 5},
              'digit': s['digit'], 'danger_digit': s['danger'], 'face_colour': s['face'], 'fuse': list(s['fuse']),
              'spark': [s['tip'], s['spark']], 'cap_top_cells': top + 3, 'emblem': EMBLEM[key]}
    return m


def all_models():
    return [bomb(k) for k in ORDER]


if __name__ == '__main__':
    for m in all_models():
        j = m.to_json()
        print(m.id, j['size_m'], j['box_count'], len(j['colours']))

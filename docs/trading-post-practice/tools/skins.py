"""The eight bomb skins, remodelled. One anatomy (shell, detail, face, cap, fuse, spark), eight characters.
VOXEL_GRAIN.md: the cell is 0.025 m so the outline is round, but every part you can see is at least 0.05 m (2 cells):
patterns are worked out on 2 x 2 blocks as the camera sees them, then cleaned of slivers. Skins use their own colours
(they stay out of harmonize(), PLAN_DEPTH_AND_LIGHT 3.3); 'lit:' colours give light."""
import math

from kit import Model
from vox import Vox

D = 0.025         # cell (XS): a bomb is 20 cells across, so it reads round
P = 2             # one part-step: 2 cells = 0.05 m, the detail size of every model (VOXEL_GRAIN.md, rule 1)
FUSE = [(0, 0), (0, 1), (0, 2), (1, 2), (1, 3), (2, 3), (3, 3), (4, 3), (4, 2), (5, 2), (6, 2), (6, 1)]   # 12 pieces of 2 x 2 x 2 cells; each touches the last by a whole face

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


R = 10                                      # radius in cells; the middle is 10 cells up


def blk(c):
    """The middle of the 2-cell block a cell centre c lies in: patterns are decided per block, so no part is under 0.05 m."""
    return math.floor(c / P) * P + P / 2


def zs(bx, by, z, r=R, cy=R):
    """Where a ball's surface is, at block (bx, by), on the cell's side (front or back)."""
    return math.copysign(math.sqrt(max(0.0, r * r - bx * bx - (by - cy) ** 2)), z)


def ball(v, colour):
    """colour(bx, by, theta) with (bx, by) the block as the front camera sees it."""
    v.fill(((-R, R), (0, 2 * R), (-R, R)), lambda x, y, z: x * x + (y - R) ** 2 + z * z <= R * R + 0.5,
           lambda x, y, z: colour(blk(x), blk(y), th(blk(x), zs(blk(x), blk(y), z))))


def front(v):
    """{(x, y): (z, colour, part)} for the nearest cell of every column, as the front camera sees it."""
    f = {}
    for (x, y, z), (c, p) in v.v.items():
        if (x, y) not in f or z > f[(x, y)][0]:
            f[(x, y)] = (z, c, p)
    return f


def clean(v, parts=('shell', 'detail'), rounds=4):
    """Recolour slivers: a front cell of `parts` that is in no 2 x 2 square of its own colour takes the colour most of its
    neighbours have (VOXEL_GRAIN.md, rule 1). Nothing random: ties go to the first colour met in a fixed order."""
    for _ in range(rounds):
        f = front(v)
        def same(k, c):                                         # outside the model, the face and sparks count as any colour
            n = f.get(k)
            return n is None or n[1] == c or n[2] in ('face', 'spark')
        def held(x, y, c):
            for ox in (0, -1):
                for oy in (0, -1):
                    if all(same((x + ox + a, y + oy + b), c) for a in (0, 1) for b in (0, 1)):
                        return True
            return False
        changed = 0
        for (x, y), (z, c, p) in sorted(f.items()):
            if p not in parts or held(x, y, c):
                continue
            votes = {}
            for (a, b) in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, 1), (1, -1), (-1, -1)):
                n = f.get((x + a, y + b))
                if n and n[2] in parts and n[1] != c:
                    votes[n[1]] = votes.get(n[1], 0) + 1
            if votes:
                best = max(votes, key=lambda k: votes[k])
                v.v[(x, y, z)] = (best, p)
                changed += 1
        if not changed:
            return


def patch(v, x0, y0, w, h, colour, part='detail'):
    """Paint a w x h patch (cells) on the front surface, lower-left corner at (x0, y0)."""
    f = front(v)
    for x in range(x0, x0 + w):
        for y in range(y0, y0 + h):
            if (x, y) in f:
                v.v[(x, y, f[(x, y)][0])] = (colour, part)


def accent(v, x, y, colour):
    """A glint or star: a 2 x 2 patch on the front surface, so even the smallest sparkle is 0.05 m (VOXEL_GRAIN.md, rule 1)."""
    patch(v, x, y, 2, 2, colour)


def seg_d(px, py, a, b):
    (ax, ay), (bx, by) = a, b
    dx, dy = bx - ax, by - ay
    t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - ax - t * dx, py - ay - t * dy)


def body_ice(v):
    def col(bx, by, t):
        if by >= 16 + 1.5 * math.cos(4 * t):
            return '#F4F8FB'                                        # the snow cap, its edge in four lobes
        return '#2B5A97' if by < 6 else ('#3A72B6' if by < 12 else '#4F8ACB')
    ball(v, col)
    clean(v)
    for x in (-8, 6):                                               # an icicle under each front low point of the cap: 2 wide, 4 long
        patch(v, x, 10, 2, 4, '#CFE8F5')
    patch(v, -6, 4, 2, 2, '#6E9FD6')                                # one shine, low on the left
    return 20, 10


def body_ember(v):
    cracks = [[(-9, 13), (-6, 9), (-7, 5)], [(9, 8), (6, 11), (8, 15)], [(-2, 1.5), (3, 3)], [(-5, 17), (1, 18.5)]]
    def col(bx, by, t):
        px = bx if math.sin(t) >= 0 else -bx
        for line in cracks:
            for a, b in zip(line, line[1:]):
                if seg_d(px, by, a, b) < 1.1:
                    hot = any(math.hypot(px - p[0], by - p[1]) < 1.6 for p in line[1:-1])
                    return 'lit:#FFC773' if hot else 'lit:#F28A3C'
        return '#3A2C2A' if by < 10 else '#463633'
    ball(v, col)
    clean(v)
    return 20, 10


def body_peppermint(v):
    ball(v, lambda bx, by, t: '#C8453C' if int(by // 4) % 2 == 0 else '#F7F0E6')   # candy bands 4 cells (0.1 m) tall: red, white, red, white, red
    clean(v)
    return 20, 10


def body_plum(v):
    ball(v, lambda bx, by, t: '#573868' if by < 4 else '#6C4A80')
    clean(v)
    patch(v, -7, 13, 4, 4, '#8B6C9F')                               # the bloom
    patch(v, 5, 6, 2, 8, '#573868')                                 # the cleft
    for (x0, x1, y) in ((-7, -3, 22), (-9, -3, 24), (-9, -5, 26)):  # the leaf beside the stem, leaning left (the fuse goes right), 2 cells deep
        for yy in (y, y + 1):
            for x in range(x0, x1):
                v.set(x, yy, 0, '#5E9B6A', 'detail'); v.set(x, yy, -1, '#5E9B6A', 'detail')
    for (x, y) in ((-5, 22), (-7, 24), (-9, 26)):                   # its midrib: three 2 x 2 steps
        for a in (0, 1):
            for b in (0, 1):
                v.set(x + a, y + b, 0, '#4A8056', 'detail')
    return 20, 10


def body_gold(v):
    def col(bx, by, t):
        if 8 <= by < 10:
            k = (t % (math.pi / 4))
            return '#F7E3A0' if min(k, math.pi / 4 - k) < 0.17 else '#B88A2C'      # the belt and its rivets
        return '#A87A2A' if by < 4 else ('#E9C25E' if by >= 14 else '#D6A53B')
    ball(v, col)
    clean(v)
    patch(v, -7, 13, 4, 4, '#F7E3A0')                               # a polished patch
    accent(v, 4, 14, 'lit:#FFF8DC')
    return 20, 10


def body_diamond(v):
    def r(y):
        return 3 + 7 * y / 12.0 if y < 12 else (10 if y < 14 else 10 - (y - 13.5) * 0.8)
    def inside(x, y, z):
        rr = r(y)
        return max(abs(x), abs(z)) <= rr and abs(x) + abs(z) <= 1.41 * rr
    def col(x, y, z):
        bx, by = blk(x), blk(y)
        rr = r(by)
        k = int(math.floor((th(bx, math.copysign(max(0.0, min(rr, 1.41 * rr - abs(bx))), z)) + math.pi / 8) / (math.pi / 4))) % 2
        if 12 <= by < 14:
            return '#EAFBFC'
        if by >= 14:
            return ('#D8F6F8', '#B6E9EE')[k]
        return ('#8FD3DC', '#74C0CC')[k]
    v.fill(((-10, 10), (0, 18), (-10, 10)), inside, col)
    clean(v)
    accent(v, -6, 14, 'lit:#FFFFFF'); accent(v, 6, 6, 'lit:#FFFFFF')
    return 18, 10


BELL = [10, 10, 9.2, 8.6, 8.1, 7.7, 7.4, 7.2, 7.0, 6.9, 6.8, 6.7, 6.6, 6.4, 6.1, 5.6, 4.9, 3.9, 2.6]   # radius by row, cells


def body_bell(v):
    def col(x, y, z):
        bx, by = blk(x), blk(y)
        if by < 2 or 4 <= by < 6 or 14 <= by < 16:
            return '#B6852E'                                        # the lip and two engraved rings
        if 1.95 < th(bx, z if z else 1) < 2.6 and 6 <= by < 14:
            return '#F2CE7C'                                        # the bright strip
        return '#D8A340'
    v.fill(((-10, 10), (0, 19), (-10, 10)), lambda x, y, z: x * x + z * z <= BELL[int(y)] ** 2 + 0.5, col)
    clean(v)
    return 19, 8


def body_aurora(v):
    def col(bx, by, t):
        d = by - (8.5 + 2.0 * math.sin(2 * t + 0.6))
        if -3 <= d < -1:
            return 'lit:#6FB7B0'
        if -1 <= d < 1:
            return 'lit:#7BC48E'
        if 1 <= d < 3:
            return 'lit:#8C8FD8'
        return '#18223C' if by >= 14 else '#1F2A49'
    ball(v, col)
    clean(v)
    for (x, y) in ((-6, 16), (4, 16), (-2, 18)):                    # three stars
        accent(v, x, y, 'lit:#E8F0FF')
    return 20, 10


BODY = {'ice': body_ice, 'ember': body_ember, 'peppermint': body_peppermint, 'plum': body_plum, 'gold': body_gold,
        'diamond': body_diamond, 'brassBell': body_bell, 'aurora': body_aurora}


def bomb(key, fuse=12, lit=True, emblem=None, id=None):
    """A skin with `fuse` of its 12 fuse pieces. emblem is kept for old callers and ignored: the face shows 10 outside a game."""
    s = SKINS[key]
    v = Vox()
    top, cy = BODY[key](v)                       # top: the first row above the body; cy: the face's middle row
    f = front(v)
    disc = [(x, y) for x in range(-4, 4) for y in range(cy - 4, cy + 4) if (x + .5) ** 2 + (y + .5 - cy) ** 2 <= 16.5]
    zf = max(f[k][0] for k in disc if k in f)    # the face stands on the body's most forward cell under it
    for (x, y) in disc:                          # a flat disc 8 cells (0.2 m) across, 2 cells (0.05 m) proud: its edge in the rim colour
        for z in range((f[(x, y)][0] + 1) if (x, y) in f else zf, zf + 2):
            v.set(x, y, z, s['rim'], 'face')
        v.set(x, y, zf + 2, s['face'], 'face')
    if key == 'brassBell':                        # the bell's crown loop is its cap; the fuse threads through it
        for (x0, x1, y0, y1) in ((-3, -1, top, top + 4), (1, 3, top, top + 4), (-3, 3, top + 4, top + 6)):
            for x in range(x0, x1):
                for y in range(y0, y1):
                    for z in (-1, 0):
                        v.set(x, y, z, s['cap'], 'cap')
        x0, y0 = -1, top + 6
    else:                                         # a neck 8 across with its corners cut, and a lip 4 across, each 2 cells tall
        for x in range(-4, 4):
            for z in range(-4, 4):
                if abs(x + .5) + abs(z + .5) <= 6:
                    for y in (top, top + 1):
                        v.set(x, y, z, s['cap'], 'cap')
        for x in range(-2, 2):
            for z in range(-2, 2):
                for y in (top + 2, top + 3):
                    v.set(x, y, z, s['lip'], 'cap')
        x0, y0 = -1, top + 4
    def piece(i, colour, part):
        fx, fy = FUSE[i]
        for a in (0, 1):
            for b in (0, 1):
                for c in (-1, 0):
                    v.set(x0 + 2 * fx + a, y0 + 2 * fy + b, c, colour, part)
    for i in range(fuse):
        piece(i, s['fuse'][i % 2], 'fuse')
    m = Model(id or ('bomb_' + key), D, f"{s['name']}: {s['line']}", s['source'], 'S')
    if lit:
        if fuse:
            piece(fuse - 1, 'lit:' + s['tip'], 'spark')
            fx, fy = FUSE[fuse - 1]
            tx, ty = x0 + 2 * fx, y0 + 2 * fy
        else:
            tx, ty = x0, y0 - 2
        for (sx, sy) in ((2, 2), (-1, 2), (2, -1), (-1, -1)):   # four sparks, one at each corner of the tip
            if (tx + sx, ty + sy, 0) not in v.v:
                v.set(tx + sx, ty + sy, 0, 'lit:' + s['spark'], 'spark')
        m.light(tx + 1, ty + 1, 0, s['tip'], 0.35, 0.8, 'spark glow')
    v.into(m)
    m.meta = {'key': key, 'name': s['name'], 'source': s['source'], 'line': s['line'],
              'face': {'centre_cells': [0, cy, zf + 3], 'disc_cells': '8 across, round', 'size_m': 0.2},
              'digit': s['digit'], 'danger_digit': s['danger'], 'face_colour': s['face'], 'fuse': list(s['fuse']),
              'spark': [s['tip'], s['spark']], 'fuse_start_cells': [x0, y0, -1], 'fuse_pieces': FUSE, 'fuse_piece_cells': 2}
    return m


def all_models():
    return [bomb(k) for k in ORDER]


if __name__ == '__main__':
    for m in all_models():
        j = m.to_json()
        print(m.id, j['size_m'], j['box_count'], len(j['colours']))

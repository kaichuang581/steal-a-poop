"""The eight bomb skins (ITEMS_REMODEL.md). One anatomy (shell, detail, face, cap, fuse, spark), eight characters.
Built of tiny 0.025 m cubes, the same density the site already draws its bombs at (about 20 cubes across). Detail is
real parts raised one cube off the body, or named motifs; nothing random. Skins use their own colours (they stay out
of harmonize(), PLAN_DEPTH_AND_LIGHT 3.3); 'lit:' colours give light."""
import math

from kit import Model
from vox import Vox

D = 0.025         # one cube (the ladder's XS step): a bomb is 20 cubes across
FUSE = [(0, 0), (0, 1), (0, 2), (1, 2), (1, 3), (2, 3), (3, 3), (4, 3), (4, 2), (5, 2), (6, 2), (6, 1)]   # 12 braid pieces of 2 x 2 x 2 cubes; each touches the last by a whole face

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


R = 10                                      # a ball's radius in cubes; its middle is 10 cubes up


class Body:
    """A round body: inside(x, y, z) on cube middles, and its outward direction, so parts can be raised off it."""
    def __init__(self, v, inside, centre=(0.0, 10.0, 0.0)):
        self.v, self.inside, self.c = v, inside, centre

    def surface(self):
        return [k for k in self.v.v if any((k[0] + a, k[1] + b, k[2] + c) not in self.v.v for a, b, c in N6)]

    def normal(self, x, y, z):
        dx, dy, dz = x + .5 - self.c[0], y + .5 - self.c[1], z + .5 - self.c[2]
        n = math.sqrt(dx * dx + dy * dy + dz * dz) or 1.0
        return dx / n, dy / n, dz / n


N6 = ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1))


def ball(v, colour, r=R, cy=R, ry=None, part='shell'):
    ry = ry or r
    def inside(x, y, z):
        return (x / r) ** 2 + ((y - cy) / ry) ** 2 + (z / r) ** 2 <= 1.0 + 0.5 / (r * r)
    v.fill(((-r - 1, r + 1), (0, int(cy + ry) + 1), (-r - 1, r + 1)), inside, colour, part)
    return Body(v, inside, (0.0, cy, 0.0))


def paint(b, pick, part='detail'):
    """Recolour cubes of the body's skin where pick(x, y, z, normal) gives a colour."""
    for k in b.surface():
        c = pick(k[0] + .5, k[1] + .5, k[2] + .5, b.normal(*k))
        if c:
            b.v.v[k] = (c, part)


def raise_(b, pick, depth=1, part='detail'):
    """A part raised off the body: every empty cube within `depth` of the skin where pick(...) gives a colour."""
    new = {}
    for k in b.surface():
        for (a, bb, c) in N6:
            for d in range(1, depth + 1):
                n = (k[0] + a * d, k[1] + bb * d, k[2] + c * d)
                if n in b.v.v or n in new:
                    continue
                if n[1] < 0:
                    continue
                col = pick(n[0] + .5, n[1] + .5, n[2] + .5, b.normal(*n))
                if col:
                    new[n] = (col, part)
    b.v.v.update(new)


def front(v):
    f = {}
    for (x, y, z), (c, p) in v.v.items():
        if (x, y) not in f or z > f[(x, y)][0]:
            f[(x, y)] = (z, c, p)
    return f


def on_front(v, x, y, colour, part='detail', lift=0):
    """Colour (or, with lift, stand out from) the front-most cube of column (x, y)."""
    f = front(v)
    if (x, y) in f:
        z = f[(x, y)][0]
        v.set(x, y, z + lift, colour, part)


def seg_d(px, py, a, b):
    (ax, ay), (bx, by) = a, b
    dx, dy = bx - ax, by - ay
    t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - ax - t * dx, py - ay - t * dy)


def body_ice(v):
    """An iron-blue ball under a snow cap with four lobes; an icicle hangs under each front low point; a frost shine."""
    b = ball(v, lambda x, y, z: '#2B5A97' if y < 5 else ('#3A72B6' if y < 11 else '#4F8ACB'))
    edge = lambda x, z: 15.0 + 1.5 * math.cos(4 * th(x, z))                          # high over the face, low at 45 and 135 degrees
    paint(b, lambda x, y, z, n: '#F4F8FB' if y >= edge(x, z) else None)
    raise_(b, lambda x, y, z, n: '#F4F8FB' if (y >= edge(x, z) + 1 and n[1] > 0.45) else None)   # the cap is thick on top
    f = front(v)
    for (k, c) in list(v.v.items()):                                                  # its lower edge one step darker, as a lip
        if c[0] == '#F4F8FB' and (k[0], k[1] - 1, k[2]) in v.v and v.v[(k[0], k[1] - 1, k[2])][0] not in ('#F4F8FB', '#D6E6F2'):
            v.v[k] = ('#D6E6F2', 'detail')
    for x0 in (-8, 6):                                                                # icicles: 2 wide for two cubes, then 1, a white tip
        f = front(v)
        top = max(y for (x, y) in f if x == x0 and f[(x, y)][1] in ('#D6E6F2', '#F4F8FB') and y < 15)
        for i in range(5):
            y = top - 1 - i
            for dx in range(2 if i < 2 else 1):
                fz = front(v).get((x0 + dx + (0 if i < 2 or x0 < 0 else 1), y), (8, None, None))[0]
                v.set(x0 + dx + (0 if i < 2 or x0 < 0 else 1), y, fz + 1, '#FFFFFF' if i == 4 else '#CFE8F5', 'detail')
    for (x, y) in ((-7, 6), (-6, 7), (-5, 8)):                                        # a frost shine: three cubes in a short diagonal
        on_front(v, x, y, '#8DB8E6')
    return 20, 10


def body_ember(v):
    """A charred iron shell in two plates, a riveted seam round the middle, and glowing cracks with hot bends."""
    b = ball(v, lambda x, y, z: '#3A2C2A' if y < 10 else '#463633')
    cracks = [[(-8.5, 15), (-6, 12.5), (-7.5, 11.5)], [(7, 16), (5, 13.5), (7.5, 12)], [(-7, 7), (-4.5, 4), (-6, 2)],
              [(8, 7.5), (5.5, 5), (6.5, 2.5)], [(-2, 18.5), (1.5, 17)]]
    def crack(x, y, z, n):
        px = x if z > 0 else -x
        for line in cracks:
            for a, bb in zip(line, line[1:]):
                if seg_d(px, y, a, bb) < 0.75:
                    return 'lit:#FFC773' if any(math.hypot(px - p[0], y - p[1]) < 1.0 for p in line[1:-1]) else 'lit:#F28A3C'
    paint(b, crack)
    raise_(b, lambda x, y, z, n: '#2A201E' if 9 <= y < 11 else None)                       # the seam band, one cube proud
    for k in range(12):                                                                   # twelve rivets on it, every 30 degrees
        a = math.radians(k * 30 + 15)
        x, z = int(math.floor(11.2 * math.cos(a))), int(math.floor(11.2 * math.sin(a)))
        v.set(x, 9, z, '#6A5A54', 'detail:rivet')
    return 20, 10


def body_peppermint(v):
    """A boiled sweet in its wrapper: a white ball with a red pinwheel swirl front and back, and twisted cellophane ends."""
    r = 9
    def col(x, y, z):
        phi = math.atan2(y - 9.5, x)
        rho = math.hypot(x, y - 9.5)
        return '#C8453C' if int(math.floor((phi + 0.07 * rho) / (2 * math.pi / 6))) % 2 == 0 else '#F7F0E6'   # six swirled wedges
    ball(v, col, r=r, cy=9.5)
    for s in (-1, 1):                                                                    # the wrapper ends, left and right
        for i, (rad, c) in enumerate(((1.6, '#D8E6EC'), (1.6, '#D8E6EC'), (2.4, '#EAF2F5'), (3.2, '#EAF2F5'), (4.0, '#EAF2F5'))):
            x = s * (r + i) if s > 0 else -(r + i) - 1
            for y in range(0, 20):
                for z in range(-6, 6):
                    dy, dz = y + .5 - 9.5, z + .5
                    if dy * dy + dz * dz <= rad * rad:
                        pleat = int(math.floor((math.atan2(dz, dy) + math.pi) / (math.pi / 3))) % 2
                        v.set(x, y, z, (c if pleat else '#CFE0E8') if i >= 2 else c, 'detail')
    return 19, 9


def body_plum(v):
    """A plum: a little taller than wide, a dusty bloom, a groove down its front, a stem with a leaf."""
    b = ball(v, lambda x, y, z: '#573868' if y < 4 else '#6C4A80', r=10, cy=10.5, ry=10.5)
    for k in list(v.v):                                                                  # a dimple at the top round the stem
        if k[1] >= 20 and k[0] ** 2 + k[2] ** 2 <= 6:
            del v.v[k]
    paint(b, lambda x, y, z, n: '#8B6C9F' if (-0.55 * n[0] + 0.5 * n[1] + 0.67 * n[2]) > 0.93 else None)    # the bloom, top left
    f = front(v)                                                                         # the groove: one cube deep, darker
    for y in range(3, 20):
        xs = 5 + round(1.2 * math.sin(y * 0.32))
        if (xs, y) in f:
            z = f[(xs, y)][0]
            del v.v[(xs, y, z)]
            v.set(xs, y, z - 1, '#4E3060', 'detail')
    for (x, y) in ((0, 19), (0, 20), (0, 21), (1, 22)):                                 # the stem, 2 x 2, bending right at the top
        for a in (-1, 0):
            for c in (-1, 0):
                v.set(x + a, y, c, '#5F4530', 'cap')
    leaf = [(-2, 21), (-3, 21), (-4, 22), (-3, 22), (-5, 22), (-4, 23), (-5, 23), (-6, 23), (-7, 23), (-5, 24), (-6, 24), (-7, 24), (-8, 24), (-7, 25), (-8, 25)]
    rib = {(-2, 21), (-3, 22), (-5, 23), (-6, 24), (-8, 25)}
    for (x, y) in leaf:                                                                  # the leaf, leaning left (the fuse goes right)
        for c in (-1, 0):
            v.set(x, y, c, '#4A8056' if (x, y) in rib else '#5E9B6A', 'detail')
    return 22, 10


def body_gold(v):
    """Polished and heavy: a squat gold ball, a crown band with studs and two rubies, one bright shine."""
    b = ball(v, lambda x, y, z: '#A87A2A' if y < 4 else ('#E9C25E' if y >= 13 else '#D6A53B'), r=10, cy=9.5, ry=9.5)
    raise_(b, lambda x, y, z, n: '#B88A2C' if 8 <= y < 11 else None)                     # the crown band, 3 rows, one cube proud
    for k in range(12):
        a = math.radians(k * 30 + 15)
        x, z = int(math.floor(11.3 * math.cos(a))), int(math.floor(11.3 * math.sin(a)))
        ruby = k in (1, 4)                                                               # 45 and 135 degrees: the two front rubies
        v.set(x, 9, z, '#B3261E' if ruby else '#F7E3A0', 'detail:stud')
        if ruby:
            v.set(x, 8, z, '#8E1D17', 'detail:stud')
    paint(b, lambda x, y, z, n: ('lit:#FFF8DC' if (-0.5 * n[0] + 0.6 * n[1] + 0.62 * n[2]) > 0.985 else '#F7E3A0') if (-0.5 * n[0] + 0.6 * n[1] + 0.62 * n[2]) > 0.95 else None)
    return 19, 10


def body_diamond(v):
    """A cut gem: eight sides, a pavilion in two tiers, a bright girdle, a crown, a flat table, two four-point sparkles."""
    def r(y):
        return 3 + 7 * y / 12.0 if y < 12 else (10 if y < 14 else 10 - (y - 13.5) * 0.8)
    def inside(x, y, z):
        rr = r(y)
        return max(abs(x), abs(z)) <= rr and abs(x) + abs(z) <= 1.41 * rr
    def col(x, y, z):
        rr = r(y)                                                                        # the facet is decided where the camera meets the side
        k = int(math.floor((th(x, math.copysign(max(0.0, min(rr, 1.41 * rr - abs(x))), z)) + math.pi / 8) / (math.pi / 4))) % 2
        if y >= 17.5:
            return '#F2FDFE'
        if y >= 14:
            return ('#D8F6F8', '#B6E9EE')[k]
        if y >= 12:
            return '#EAFBFC'
        if y >= 6:
            return ('#8FD3DC', '#74C0CC')[k]
        return ('#74C0CC', '#5FAFBE')[k]
    v.fill(((-10, 10), (0, 18), (-10, 10)), inside, col)
    for (cx, cy) in ((-6, 15), (6, 6)):                                                  # four-point sparkles, standing one cube out
        f = front(v)
        z0 = f[(cx, cy)][0] + 1
        for (dx, dy) in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)):
            v.set(cx + dx, cy + dy, z0 if (dx, dy) != (0, 0) else z0 + 1, 'lit:#FFFFFF', 'detail:sparkle star')
    return 18, 9


BELL = [10, 10, 9.2, 8.6, 8.1, 7.7, 7.4, 7.2, 7.0, 6.9, 6.8, 6.7, 6.6, 6.4, 6.1, 5.6, 4.9, 3.9, 2.6]   # radius by row, cubes


def body_bell(v):
    """A brass bell: a flared lip, two raised rings, a bright strip down the front left, a crown loop."""
    def col(x, y, z):
        if 1.95 < th(x, z if z else 1) < 2.6 and 4 <= y < 15:
            return '#F2CE7C'
        return '#D8A340'
    v.fill(((-11, 11), (0, 19), (-11, 11)), lambda x, y, z: x * x + z * z <= BELL[int(y)] ** 2 + 0.5, col)
    b = Body(v, None, (0.0, 9.0, 0.0))
    for k in list(b.surface()):                                                          # the lip and two rings, raised one cube
        x, y, z = k
        if y in (0, 1, 6, 14):
            rr = BELL[y] + 1
            for (a, c) in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                n = (x + a, y, z + c)
                if n not in v.v and (n[0] + .5) ** 2 + (n[2] + .5) ** 2 <= rr * rr + 0.5:
                    v.set(n[0], y, n[2], '#B6852E', 'detail')
    return 19, 8


def body_aurora(v):
    """A piece of the night sky: a dark orb, a ribbon of three lights round it, the Plough and a bright pole star."""
    b = ball(v, lambda x, y, z: '#18223C' if y >= 14 else '#1F2A49')
    def rib(x, y, z, n):
        d = y - (8.5 + 2.0 * math.sin(2 * th(x, z) + 0.6))
        if -2.5 <= d < -0.8:
            return 'lit:#6FB7B0'
        if -0.8 <= d < 0.8:
            return 'lit:#7BC48E'
        if 0.8 <= d < 2.5:
            return 'lit:#8C8FD8'
    paint(b, rib)
    for (x, y) in ((-9, 13), (-7, 14), (-5, 15), (-3, 15), (-3, 17), (0, 17), (0, 15)):  # the Plough: a handle of three, a bowl of four
        on_front(v, x, y, 'lit:#E8F0FF', 'detail:star')
    f = front(v)
    z0 = f[(5, 17)][0]
    for (dx, dy) in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)):                           # the pole star, a four-point sparkle
        v.set(5 + dx, 17 + dy, z0 + (1 if (dx, dy) == (0, 0) else 0), 'lit:#FFFFFF', 'detail:star')
    return 20, 10


BODY = {'ice': body_ice, 'ember': body_ember, 'peppermint': body_peppermint, 'plum': body_plum, 'gold': body_gold,
        'diamond': body_diamond, 'brassBell': body_bell, 'aurora': body_aurora}


def bomb(key, fuse=12, lit=True, emblem=None, id=None):
    """A skin with `fuse` of its 12 braid pieces. emblem is kept for old callers and ignored: the face shows 10 outside a game."""
    s = SKINS[key]
    v = Vox()
    top, cy = BODY[key](v)
    f = front(v)
    disc = lambda rr: [(x, y) for x in range(-6, 6) for y in range(cy - 6, cy + 6) if (x + .5) ** 2 + (y + .5 - cy) ** 2 <= rr]
    zf = max(f[k][0] for k in disc(25.5) if k in f)
    for (x, y) in disc(25.5):                    # a gauge: a bezel ring 10 cubes across, one cube proud of the face it holds
        for z in range((f[(x, y)][0] + 1) if (x, y) in f else zf, zf + 2):
            v.set(x, y, z, s['rim'], 'face')
        inner = (x + .5) ** 2 + (y + .5 - cy) ** 2 <= 16.5
        v.set(x, y, zf + 2, s['face'] if inner else s['rim'], 'face')
        if not inner:
            v.set(x, y, zf + 3, s['rim'], 'face')
    if key == 'brassBell':                        # the bell's crown loop is its cap; the fuse threads through it
        for (x0, x1, y0, y1) in ((-3, -1, top, top + 4), (1, 3, top, top + 4), (-3, 3, top + 4, top + 6)):
            for x in range(x0, x1):
                for y in range(y0, y1):
                    for z in (-1, 0):
                        v.set(x, y, z, s['cap'], 'cap')
        x0, y0 = -1, top + 6
    elif key == 'plum':                           # the stem is the cap
        x0, y0 = 0, top + 1
    else:
        for x in range(-4, 4):                    # a neck 8 across with its corners cut, 2 high, and a lip 4 across, 2 high
            for z in range(-4, 4):
                if abs(x + .5) + abs(z + .5) <= 6:
                    for y in (top, top + 1):
                        v.set(x, y, z, s['cap'], 'cap')
        for x in range(-2, 2):
            for z in range(-2, 2):
                for y in (top + 2, top + 3):
                    v.set(x, y, z, s['lip'], 'cap')
        if key == 'gold':                          # a crown: four points at the neck's corners
            for (x, z) in ((-3, -3), (2, -3), (-3, 2), (2, 2)):
                v.set(x, top + 2, z, '#E9C25E', 'cap:crown point'); v.set(x, top + 3, z, '#F7E3A0', 'cap:crown point tip')
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
              'face': {'centre_cells': [0, cy, zf + 3], 'disc_cells': '8 across inside a 10-across bezel', 'size_m': 0.2},
              'digit': s['digit'], 'danger_digit': s['danger'], 'face_colour': s['face'], 'fuse': list(s['fuse']),
              'spark': [s['tip'], s['spark']], 'fuse_start_cells': [x0, y0, -1], 'fuse_pieces': FUSE, 'fuse_piece_cells': 2}
    return m


def all_models():
    return [bomb(k) for k in ORDER]


if __name__ == '__main__':
    for m in all_models():
        j = m.to_json()
        print(m.id, j['size_m'], j['box_count'], len(j['colours']))

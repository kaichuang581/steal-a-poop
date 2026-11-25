"""The eight fuse sounds, each shown as the thing that makes the sound (ITEMS_REMODEL.md). Built of tiny 0.025 m cubes
like the bombs, with real parts and named motifs (a pixel sheep on the 8-bit's screen, a sheep on the music box), never
random detail. 0.35 to 0.7 m tall, the same size class as the bombs they sit beside. Scenery colours only (LADDER and the
named glows)."""
import math

from kit import Model
from vox import Vox

D = 0.025
SOUNDS = {
    'iceChime':    ('Ice chime', 'Icicles on a frame, tapped by a bead'),
    'eightBit':    ('8-bit', 'A pocket game, beeping'),
    'woodBlock':   ('Wood block', 'A hollow block and its mallet'),
    'cowbell':     ('Cowbell', 'A copper bell on a leather strap'),
    'sleighBells': ('Sleigh bells', 'Three brass bells on a strap stand'),
    'musicBox':    ('Music box', 'A wound box with a tiny dancer'),
    'owl':         ('Owl', 'A carved owl call on its perch'),
    'lullaby':     ('Lullaby', 'A moon and a star on a cradle hook'),
}
ORDER = list(SOUNDS)


def M(key):
    return Model('sound_' + key, D, *SOUNDS[key], 'S')


def blob(v, cx, cy, cz, rx, ry, rz, colour, part='shell', ymin=None):
    """A rounded body: every cube whose middle is inside the ellipsoid. colour may be a function of (x, y, z)."""
    for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for z in range(int(cz - rz) - 1, int(cz + rz) + 2):
                if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 + ((z + .5 - cz) / rz) ** 2 <= 1 and (ymin is None or y >= ymin):
                    v.set(x, y, z, colour(x, y, z) if callable(colour) else colour, part)


def box(v, x0, y0, z0, x1, y1, z1, colour, part='shell'):
    for x in range(x0, x1):
        for y in range(y0, y1):
            for z in range(z0, z1):
                v.set(x, y, z, colour, part)


def front(v):
    f = {}
    for (x, y, z), (c, p) in v.v.items():
        if (x, y) not in f or z > f[(x, y)][0]:
            f[(x, y)] = (z, c, p)
    return f


def dots(v, cells, colour, lift=0, part='detail'):
    """Colour the front-most cube of each column in `cells`, or stand a cube `lift` in front of it."""
    f = front(v)
    for (x, y) in cells:
        if (x, y) in f:
            v.set(x, y, f[(x, y)][0] + lift, colour, part)


def ice_chime():
    m = M('iceChime')
    m.b(-11, 0, -4, 11, 2, 4, 'darkWood:0', 'base')
    m.b(-10, 2, -3, 10, 3, 3, 'darkWood:1', 'base, top step')
    for x in (-10, 8):
        m.b(x, 3, -1, x + 2, 23, 1, 'darkWood:-1', 'post')
    m.b(-11, 23, -2, 11, 25, 2, 'darkWood:0', 'top bar')
    m.b(-12, 23, -2, -11, 25, 2, 'darkWood:1', 'bar end'); m.b(11, 23, -2, 12, 25, 2, 'darkWood:1', 'bar end')
    m.b(-11, 25, -2, 11, 26, 2, 'snow:1', 'snow on the bar')
    m.b(-9, 26, -1, -5, 27, 1, 'snow:2', 'snow lump'); m.b(1, 26, -1, 6, 27, 1, 'snow:2', 'snow lump')
    for i, (x, L) in enumerate(((-8, 10), (-4, 7), (0, 12), (4, 8))):   # four icicles: 3 wide at the bar, then 2, then 1, a pale tip
        c = f'ice:{(0, 1, -1, 1)[i]}'
        m.b(x, 20, -1, x + 3, 23, 1, c, 'icicle')
        m.b(x, 23 - L + 3, -1, x + 2, 20, 1, c, 'icicle')
        m.b(x, 23 - L + 1, -1, x + 1, 23 - L + 3, 0, c, 'icicle')
        m.b(x, 23 - L, -1, x + 1, 23 - L + 1, 0, 'ice:2', 'icicle tip')
    m.b(6, 16, -1, 7, 23, 0, 'iron:1', 'bead cord')
    m.b(5, 12, -1, 8, 16, 1, 'scarfRed:0', 'striker bead'); m.b(5, 15, -1, 6, 16, 1, 'scarfRed:1', 'bead shine')
    return m


def eight_bit():
    m = M('eightBit')
    m.b(-9, 0, -4, 9, 1, 4, 'slate:-1', 'stand')
    m.b(-8, 1, -2, 8, 22, 2, 'trimWhite:0', 'case'); m.b(-7, 22, -2, 7, 23, 2, 'trimWhite:0', 'case, rounded top')
    m.b(-8, 1, -2, 8, 3, 2, 'trimWhite:-2', 'case foot')
    m.b(-6, 11, 2, 6, 21, 3, 'slate:0', 'screen bezel')
    m.b(-5, 12, 2, 5, 20, 3, 'glass:-2', 'screen')
    sheep = [(-3, 18), (-2, 18), (-1, 18), (0, 18), (-4, 17), (-3, 17), (-2, 17), (-1, 17), (0, 17), (1, 17), (-4, 16), (-3, 16),
             (-2, 16), (-1, 16), (0, 16), (1, 16), (-3, 15), (-2, 15), (-1, 15), (0, 15), (-3, 14), (0, 14)]   # a pixel sheep: a round fleece, two legs
    for (x, y) in sheep:
        m.b(x, y, 2, x + 1, y + 1, 3, 'glow:bulbSage', 'pixel sheep')
    for (x, y) in ((2, 17), (3, 17), (2, 16), (3, 16), (3, 15)):
        m.b(x, y, 2, x + 1, y + 1, 3, 'glow:bulbGold', 'pixel sheep, face')
    m.b(-6, 7, 2, -1, 8, 3, 'ink:1', 'pad'); m.b(-4, 5, 2, -3, 10, 3, 'ink:1', 'pad'); m.b(-6, 7, 3, -1, 8, 4, 'ink:1', 'pad, raised'); m.b(-4, 5, 3, -3, 10, 4, 'ink:1', 'pad, raised')
    m.b(1, 6, 2, 3, 8, 4, 'scarfRed:0', 'button B'); m.b(4, 8, 2, 6, 10, 4, 'scarfRed:0', 'button A')
    m.b(-3, 3, 2, -1, 4, 3, 'slate:0', 'select'); m.b(0, 3, 2, 2, 4, 3, 'slate:0', 'start')
    for (x, y) in ((4, 3), (5, 4), (6, 5)):
        m.b(x, y, 2, x + 1, y + 1, 3, 'slate:-1', 'speaker slot')
    return m


def wood_block():
    m = M('woodBlock')
    for x in (-7, 5):
        m.b(x, 0, -4, x + 2, 1, 4, 'scarfRed:-2', 'felt foot')
    m.b(-8, 1, -5, 8, 9, 5, 'wood:1', 'block')
    m.b(-8, 8, -5, 8, 9, 5, 'wood:2', 'block top')
    m.b(-8, 1, -5, -7, 9, 5, 'wood:0', 'end grain'); m.b(7, 1, -5, 8, 9, 5, 'wood:0', 'end grain')
    m.b(-6, 4, 4, 6, 6, 5, 'darkWood:-1', 'slot')
    m.b(-6, 3, 4, 6, 4, 5, 'wood:0', 'slot lip')
    m.b(-3, 9, 0, 9, 10, 1, 'houseCream:0', 'mallet handle')
    v = Vox()
    blob(v, -4.5, 10.5, 0.5, 2.2, 2.2, 2.2, lambda x, y, z: 'scarfRed:1' if y >= 11 else 'scarfRed:0')
    v.into(m)
    return m


def cowbell():
    m = M('cowbell')
    v = Vox()
    for y in range(2, 17):                                            # widens downward: half-width 6.5 at the rim to 4 at the crown
        hw = 6.5 - 2.5 * (y - 2) / 14.0
        for x in range(-7, 7):
            for z in range(-6, 6):
                if abs(x + .5) <= hw and abs(z + .5) <= hw - 1.5:
                    v.set(x, y, z, 'carrot:-2')
    box(v, -7, 2, -6, 7, 4, 6, 'brass:-1', 'detail')                   # the rim, flared one cube
    f = front(v)
    for y in range(5, 15):                                            # a shine down the front left, 2 cubes wide
        hw = 6.5 - 2.5 * (y - 2) / 14.0
        x0 = int(math.floor(-hw + 1.5))
        for x in (x0, x0 + 1):
            if (x, y) in f:
                v.set(x, y, f[(x, y)][0], 'carrot:1', 'detail')
    blob(v, 0, 1.2, 0, 1.6, 1.4, 1.6, 'iron:0', 'detail')             # the clapper, showing under the rim
    box(v, -4, 17, -2, 4, 19, 2, 'brass:-1', 'detail')                # the crown
    v.into(m)
    m.b(-4, 19, 0, -2, 25, 1, 'darkWood:0', 'strap'); m.b(2, 19, 0, 4, 25, 1, 'darkWood:0', 'strap')
    m.b(-4, 25, 0, 4, 27, 1, 'darkWood:1', 'strap top')
    for x in (-3, -1, 1, 3):
        m.b(x, 26, 1, x + 1, 27, 2, 'trimWhite:1', 'stitch')
    for (x0, y0, x1, y1) in ((2, 20, 5, 21), (2, 23, 5, 24), (2, 21, 3, 23), (4, 21, 5, 23)):
        m.b(x0, y0, 1, x1, y1, 2, 'brass:0', 'buckle')
    return m


def sleigh_bells():
    m = M('sleighBells')
    for x in (-13, 11):
        m.b(x, 0, -2, x + 2, 18, 0, 'darkWood:-1', 'stand post')
        m.b(x - 1, 0, -4, x + 3, 2, 2, 'snow:1', 'snow at the foot')
    m.b(-13, 18, -2, 13, 20, 0, 'darkWood:0', 'strap')
    for x in range(-11, 12, 4):
        m.b(x, 19, 0, x + 1, 20, 1, 'brass:1', 'strap rivet')
    v = Vox()
    for c in (-7.5, 0.5, 8.5):
        blob(v, c - 0.5, 12, -1, 3.4, 3.4, 3.4, lambda x, y, z: 'brass:1' if y >= 14 else 'brass:0')
        box(v, int(c) - 1, 15, -2, int(c) + 1, 18, 0, 'iron:0', 'detail')
    f = front(v)
    for c in (-8, 0, 8):                                               # the slot across the bottom, ending in two holes
        for x in range(c - 2, c + 2):
            if (x, 10) in f:
                v.set(x, 10, f[(x, 10)][0], 'iron:0', 'detail')
        for x in (c - 2, c + 1):
            if (x, 11) in f:
                v.set(x, 11, f[(x, 11)][0], 'iron:0', 'detail')
    v.into(m)
    return m


def music_box():
    m = M('musicBox')
    m.b(-10, 0, -7, 10, 1, 7, 'darkWood:0', 'plinth')
    m.b(-9, 1, -6, 9, 8, 6, 'barnRed:0', 'box')
    m.b(-7, 2, 6, 7, 6, 7, 'barnRed:1', 'front panel, raised')
    m.b(-1, 3, 7, 2, 5, 8, 'brass:0', 'keyhole plate'); m.b(0, 3, 8, 1, 4, 9, 'darkWood:-2', 'keyhole')
    m.b(-9, 7, -6, 9, 8, 6, 'trimWhite:0', 'box rim')
    m.b(-9, 8, -7, 9, 21, -5, 'barnRed:-1', 'lid, open')
    m.b(-7, 10, -5, 7, 19, -4, 'trimWhite:1', 'lid lining')
    m.b(-3, 12, -4, 3, 17, -3, 'trimWhite:2', 'lid mirror')
    for x in range(-8, -2):                                            # the comb: teeth of two brasses in turn
        m.b(x, 8, 1, x + 1, 9, 5, 'brass:0' if x % 2 else 'brass:-1', 'comb tooth')
    m.b(-2, 8, 1, 1, 10, 5, 'brass:-1', 'drum')
    v = Vox()
    blob(v, 4.5, 8.5, 0.5, 3.0, 0.6, 3.0, 'trimWhite:2', 'detail')     # the turntable
    box(v, 3, 9, -1, 7, 12, 2, 'wool:1')                               # a small sheep on it: wool, head, ears, legs
    box(v, 4, 12, 0, 6, 13, 1, 'wool:2')
    box(v, 7, 10, -1, 9, 12, 1, 'pink:0', 'detail')
    v.into(m)
    m.b(7, 12, -1, 8, 13, 0, 'pink:-1', 'ear'); m.b(8, 12, 0, 9, 13, 1, 'pink:-1', 'ear')
    m.b(8, 11, 1, 9, 12, 2, 'darkWood:-2', 'eye')
    m.b(9, 2, 0, 11, 4, 2, 'brass:0', 'crank'); m.b(11, 2, 0, 12, 7, 1, 'brass:0', 'crank arm'); m.b(11, 7, 0, 13, 9, 2, 'barnRed:1', 'crank knob')
    return m


def owl():
    m = M('owl')
    m.b(-12, 0, -2, 12, 2, 2, 'darkWood:0', 'perch')
    m.b(-12, 2, -2, -8, 4, 2, 'snow:1', 'snow on the perch'); m.b(8, 2, -2, 12, 4, 2, 'snow:1', 'snow on the perch')
    v = Vox()
    blob(v, 0, 10, 0, 6.5, 8, 4.5, 'wood:0', ymin=2)                                # the body
    blob(v, 0, 19, 0, 7, 5.2, 4.5, 'wood:-1')                                         # the head, wider than the body
    f = front(v)
    for (x, y), (z, c, p) in f.items():                                               # the pale chest
        if (x / 4.2) ** 2 + ((y - 8.5) / 5.5) ** 2 <= 1 and y < 14:
            v.v[(x, y, z)] = ('wood:2', 'detail')
    for (cy, xs) in ((11, (-3, 0, 3)), (8, (-2, 1)), (5, (-1,))):                    # carved chevron feathers in rows of 3, 2 and 1
        for x0 in xs:
            for (dx, dy) in ((0, 0), (1, -1), (2, 0)):
                if (x0 - 1 + dx, cy + dy) in f:
                    v.set(x0 - 1 + dx, cy + dy, front(v)[(x0 - 1 + dx, cy + dy)][0], 'wood:0', 'detail')
    for s in (-1, 1):                                                                 # carved wing edges: a groove down each side
        for y in range(5, 14):
            x = s * 5 if s > 0 else -6
            if (x, y) in f:
                v.set(x, y, front(v)[(x, y)][0], 'wood:-2', 'detail')
    for x0 in (-7, 5):                                                                # ear tufts, 2 wide then 1
        box(v, x0, 22, -2, x0 + 2, 25, 2, 'wood:-2', 'detail')
        box(v, x0 + (0 if x0 < 0 else 1), 25, -2, x0 + (1 if x0 < 0 else 2), 27, 2, 'wood:-2', 'detail')
    for (cx, px) in ((-3, -3), (3, 2)):                                               # facial discs, amber eyes, pupils toward the middle
        cells = [(cx - 3 + a, 16 + b) for a in range(6) for b in range(6) if not (a in (0, 5) and b in (0, 5))]
        dots(v, cells, 'wood:1')
        dots(v, [(cx - 2 + a, 17 + b) for a in range(4) for b in range(4) if not (a in (0, 3) and b in (0, 3))], 'coopYellow:0')
        dots(v, [(px + (0 if cx < 0 else -1) + a, 18 + b) for a in range(2) for b in range(2)], 'ink:0')
    f = front(v)
    for (x, y) in ((-1, 14), (0, 14), (-1, 15), (0, 15)):                             # the beak, standing out
        v.set(x, y, f[(x, y)][0] + 1, 'carrot:0', 'detail')
    for x0 in (-4, 2):                                                                # feet: three toes each on the perch
        for dx in (0, 1, 2):
            v.set(x0 + dx, 2, 3, 'carrot:-1', 'detail'); v.set(x0 + dx, 2, 4, 'carrot:-1', 'detail')
    v.into(m)
    return m


def lullaby():
    m = M('lullaby')
    m.b(-12, 0, -3, 3, 2, 3, 'darkWood:0', 'base')
    m.b(-12, 2, -2, -10, 27, 0, 'darkWood:-1', 'post')
    m.b(-12, 27, -2, 9, 29, 0, 'darkWood:0', 'arm')
    for (x, y) in ((9, 28), (10, 28), (10, 27), (10, 26), (9, 26)):                    # the arm's end curls under: a carved hook
        m.b(x, y, -2, x + 1, y + 1, 0, 'darkWood:0', 'hook curl')
    cres = set()
    for x in range(-6, 12):                       # the crescent: a disc of radius 7 round (3, 14) less a disc of radius 5.6 round (5.8, 15.6)
        for y in range(4, 24):
            cx, cy = x + .5, y + .5
            if (cx - 3) ** 2 + (cy - 14) ** 2 <= 49 and (cx - 5.8) ** 2 + (cy - 15.6) ** 2 > 31.4:
                cres.add((x, y))
    cres = {(x, y) for (x, y) in cres if any(all((x + a + i, y + b + j) in cres for i in (0, 1) for j in (0, 1)) for a in (0, -1) for b in (0, -1))}
    for (x, y) in sorted(cres):
        m.b(x, y, -2, x + 1, y + 1, 0, 'glow:moon', 'moon', 'moon')
    for (x, y) in ((-2, 14), (-1, 13), (0, 13), (1, 14)):                              # a closed, sleeping eye
        if (x, y) in cres:
            m.b(x, y, 0, x + 1, y + 1, 1, 'ink:2', 'sleeping eye')
    m.b(0, 10, 0, 2, 11, 1, 'pink:0', 'cheek')
    tip = max(cres, key=lambda p: (p[1], -p[0]))
    m.b(tip[0] - 1, tip[1] + 1, -2, tip[0] + 2, tip[1] + 3, 0, 'scarfRed:0', 'nightcap')          # a red nightcap on the top tip, and its pompom
    m.b(tip[0] + 2, tip[1] + 2, -2, tip[0] + 4, tip[1] + 4, 0, 'trimWhite:2', 'pompom')
    m.b(tip[0], tip[1] + 3, -2, tip[0] + 2, tip[1] + 4, 0, 'scarfRed:0', 'nightcap')
    m.b(tip[0], tip[1] + 4, -1, tip[0] + 1, 27, 0, 'iron:1', 'moon cord')
    star = ['...X...', '...X...', 'XXXXXXX', '.XXXXX.', '..XXX..', '.XX.XX.', 'X.....X']
    for r, row in enumerate(star):                                                    # a five-point star
        for c, ch in enumerate(row):
            if ch == 'X':
                m.b(-9 + c, 19 - r, -2, -8 + c, 20 - r, 0, 'glow:lit', 'star')
    m.b(-6, 20, -1, -5, 27, 0, 'iron:1', 'star cord')
    m.light(3, 14, -1, 'glow:moon', 0.3, 0.35)
    return m


def all_models():
    return [ice_chime(), eight_bit(), wood_block(), cowbell(), sleigh_bells(), music_box(), owl(), lullaby()]

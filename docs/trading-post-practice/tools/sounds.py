"""The eight fuse sounds, each shown as the thing that makes the sound. Like the bombs (VOXEL_GRAIN.md): the cell is
0.025 m so round things read round, but every part is at least 0.05 m (2 cells). 0.35 to 0.65 m tall, the same size
class as the bombs they sit beside. Scenery colours only (LADDER and the named glows)."""
from kit import Model
from vox import Vox
from skins import front, patch, clean

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
    """A rounded body: every cell whose middle is inside the ellipsoid."""
    for x in range(int(cx - rx) - 1, int(cx + rx) + 1):
        for y in range(int(cy - ry) - 1, int(cy + ry) + 1):
            for z in range(int(cz - rz) - 1, int(cz + rz) + 1):
                if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 + ((z + .5 - cz) / rz) ** 2 <= 1 and (ymin is None or y >= ymin):
                    v.set(x, y, z, colour, part)


def box(v, x0, y0, z0, x1, y1, z1, colour, part='shell'):
    for x in range(x0, x1):
        for y in range(y0, y1):
            for z in range(z0, z1):
                v.set(x, y, z, colour, part)


def ice_chime():
    m = M('iceChime')
    m.b(-12, 0, -4, 12, 2, 4, 'darkWood:0', 'base')
    for x in (-12, 10):
        m.b(x, 2, -2, x + 2, 22, 0, 'darkWood:-1', 'post')
    m.b(-12, 22, -2, 12, 24, 2, 'darkWood:0', 'top bar')
    m.b(-12, 24, -2, 12, 26, 2, 'snow:1', 'snow on the bar')
    for i, (x, L) in enumerate(((-9, 12), (-5, 8), (-1, 14), (3, 10))):      # four icicles, 3 cells wide at the bar, 2 below, a pale tip
        c = f'ice:{(0, 1, -1, 1)[i]}'
        m.b(x, 18, -2, x + 3, 22, 0, c, 'icicle')
        m.b(x, 22 - L + 2, -2, x + 2, 18, 0, c, 'icicle')
        m.b(x, 22 - L, -2, x + 2, 22 - L + 2, 0, 'ice:2', 'icicle tip')
    m.b(7, 16, -2, 9, 22, 0, 'iron:1', 'bead cord')
    m.b(7, 12, -2, 9, 16, 0, 'scarfRed:0', 'striker bead'); m.b(6, 13, -2, 10, 15, 0, 'scarfRed:0', 'striker bead')
    return m


def eight_bit():
    m = M('eightBit')
    m.b(-10, 0, -4, 10, 2, 4, 'slate:-1', 'stand')
    m.b(-8, 2, -2, 8, 23, 2, 'trimWhite:0', 'case'); m.b(-7, 23, -2, 7, 24, 2, 'trimWhite:0', 'case, rounded top')
    m.b(-8, 2, -2, 8, 4, 2, 'trimWhite:-2', 'case foot')
    m.b(-6, 14, 2, 6, 22, 3, 'glass:-2', 'screen')
    for (x, y, c) in ((-4, 16, 'glow:bulbSage'), (-2, 18, 'glow:bulbSage'), (0, 16, 'glow:bulbSage'), (2, 18, 'glow:bulbGold')):
        m.b(x, y, 2, x + 2, y + 2, 3, c, 'pixel')
    m.b(-6, 8, 2, 0, 10, 3, 'ink:1', 'pad'); m.b(-4, 6, 2, -2, 12, 3, 'ink:1', 'pad')
    m.b(2, 6, 2, 4, 8, 3, 'scarfRed:0', 'button'); m.b(4, 9, 2, 6, 11, 3, 'scarfRed:0', 'button')
    m.b(-2, 4, 2, 2, 6, 3, 'slate:0', 'speaker slot')
    return m


def wood_block():
    m = M('woodBlock')
    m.b(-8, 0, -4, 8, 8, 4, 'wood:1', 'block')
    m.b(-8, 6, -4, 8, 8, 4, 'wood:2', 'block top')
    m.b(-8, 0, -4, -6, 8, 4, 'wood:0', 'end grain'); m.b(6, 0, -4, 8, 8, 4, 'wood:0', 'end grain')
    m.b(-6, 2, 2, 6, 4, 4, 'darkWood:-1', 'slot')
    m.b(-4, 8, 0, 8, 10, 2, 'houseCream:0', 'mallet handle')
    m.b(-8, 8, -2, -4, 12, 2, 'scarfRed:0', 'mallet head')
    m.b(-8, 10, -2, -4, 12, 2, 'scarfRed:1', 'mallet head, top')
    return m


def cowbell():
    m = M('cowbell')
    v = Vox()
    for (y0, y1, hw) in ((2, 6, 6), (6, 10, 5), (10, 16, 4)):           # widens downward, a step every 4 to 6 cells
        box(v, -hw, y0, -hw + 2, hw, y1, hw - 2, 'carrot:-2')
    box(v, -7, 2, -5, 7, 4, 5, 'brass:-1')                               # the rim, flared
    patch(v, -4, 6, 2, 8, 'carrot:1')                                   # a shine down the front left
    box(v, -2, 0, -2, 2, 2, 2, 'iron:0', 'detail')                       # the clapper
    box(v, -4, 16, -2, 4, 18, 2, 'brass:-1', 'detail')                   # the crown
    v.into(m)
    m.b(-4, 18, 0, -2, 24, 2, 'darkWood:0', 'strap'); m.b(2, 18, 0, 4, 24, 2, 'darkWood:0', 'strap')
    m.b(-4, 24, 0, 4, 26, 2, 'darkWood:1', 'strap top'); m.b(2, 20, 2, 4, 22, 3, 'brass:0', 'buckle')
    return m


def sleigh_bells():
    m = M('sleighBells')
    for x in (-14, 12):
        m.b(x, 0, -2, x + 2, 18, 0, 'darkWood:-1', 'stand post')
        m.b(x - 1, 0, -4, x + 3, 2, 2, 'snow:1', 'snow at the foot')
    m.b(-14, 18, -2, 14, 20, 0, 'darkWood:0', 'strap')
    v = Vox()
    for c in (-8, 0, 8):                                                # three round bells, 6 cells across, 2 apart
        blob(v, c, 12, -1, 3.2, 3.2, 3.2, 'brass:0')
        box(v, c - 1, 15, -2, c + 1, 18, 0, 'iron:0', 'detail')          # the neck to the strap
    for c in (-8, 0, 8):
        patch(v, c - 1, 9, 2, 2, 'iron:0')                              # the slit, at the bottom in the middle
        patch(v, c - 2, 13, 2, 2, 'brass:2')                            # a shine, upper left
    v.into(m)
    return m


def music_box():
    m = M('musicBox')
    m.b(-8, 0, -6, 8, 6, 6, 'barnRed:0', 'box')
    m.b(-8, 4, 4, 8, 6, 6, 'trimWhite:0', 'box rim')
    m.b(-8, 6, -6, 8, 18, -4, 'barnRed:-1', 'lid, open')
    m.b(-6, 8, -4, 6, 16, -2, 'trimWhite:1', 'lid lining')
    m.b(-6, 6, 0, 0, 8, 4, 'brass:0', 'comb'); m.b(2, 6, 0, 6, 8, 4, 'brass:-1', 'drum')
    m.b(8, 2, 0, 10, 4, 2, 'brass:0', 'crank'); m.b(10, 2, 0, 12, 6, 2, 'brass:0', 'crank'); m.b(10, 6, 0, 12, 8, 2, 'scarfRed:0', 'crank knob')
    m.b(-4, 8, -2, 0, 12, 2, 'wool:1', 'dancer, wool'); m.b(-3, 12, -1, -1, 14, 1, 'pink:0', 'dancer, head')
    m.b(-2, 2, 6, 2, 4, 8, 'brass:1', 'clasp')
    return m


def owl():
    m = M('owl')
    m.b(-12, 0, -2, 12, 2, 2, 'darkWood:0', 'perch')
    m.b(-12, 2, -2, -8, 4, 2, 'snow:1', 'snow on the perch'); m.b(8, 2, -2, 12, 4, 2, 'snow:1', 'snow on the perch')
    v = Vox()
    blob(v, 0, 9, 0, 6, 7, 4, 'wood:0', ymin=2)                         # the body
    blob(v, 0, 18, 0, 7, 5, 4, 'wood:-1')                               # the head, wider than the body
    f = front(v)
    for (x, y), (z, c, p) in f.items():                                 # the pale chest, decided per 2 x 2 block
        bx, by = (x // 2) * 2 + 1, (y // 2) * 2 + 1
        if (bx / 4.2) ** 2 + ((by - 8) / 5.2) ** 2 <= 1 and y < 14:
            v.v[(x, y, z)] = ('wood:2', 'detail')
    clean(v)
    for (x, y) in ((-4, 8), (2, 8), (-1, 5)):                           # three chest feathers
        patch(v, x, y, 2, 2, 'wood:0')
    for x0 in (-7, 5):                                                  # ear tufts
        box(v, x0, 22, -2, x0 + 2, 26, 2, 'wood:-2', 'detail')
    for (x0, px) in ((-5, -3), (1, 1)):                                 # two big eyes, their pupils low and toward the middle
        patch(v, x0, 16, 4, 4, 'trimWhite:2')
        patch(v, px, 16, 2, 2, 'ink:0')
    f = front(v)
    for x in (-1, 0):                                                   # the beak, standing out
        for y in (14, 15):
            v.set(x, y, f[(x, y)][0] + 1, 'carrot:0', 'detail')
    for x0 in (-4, 2):                                                  # feet on the perch
        box(v, x0, 2, 2, x0 + 2, 4, 4, 'carrot:-1', 'detail')
    v.into(m)
    return m


def lullaby():
    m = M('lullaby')
    m.b(-12, 0, -2, 2, 2, 2, 'darkWood:0', 'base')
    m.b(-12, 2, -2, -10, 26, 0, 'darkWood:-1', 'post')
    m.b(-12, 24, -2, 10, 26, 0, 'darkWood:0', 'arm')
    cres = set()
    for x in range(-4, 12):                       # the crescent: a disc of radius 6.4 round (4, 13) less a disc of radius 5.2 round (6.6, 14.4)
        for y in range(5, 21):
            cx, cy = x + .5, y + .5
            if (cx - 4) ** 2 + (cy - 13) ** 2 <= 41 and (cx - 6.6) ** 2 + (cy - 14.4) ** 2 > 27:
                cres.add((x, y))
    cres = {(x, y) for (x, y) in cres if any(all((x + a + i, y + b + j) in cres for i in (0, 1) for j in (0, 1)) for a in (0, -1) for b in (0, -1))}
    top = max(y for (x, y) in cres if 2 <= x <= 4)
    m.b(3, top + 1, -2, 5, 24, 0, 'iron:1', 'moon cord')
    for (x, y) in sorted(cres):
        m.b(x, y, -2, x + 1, y + 1, 0, 'glow:moon', 'moon', 'moon')
    for (x, y) in ((-5, 13), (-7, 13), (-3, 13), (-5, 15), (-5, 11)):       # a star: five 2 x 2 blocks in a plus
        m.b(x, y, -2, x + 2, y + 2, 0, 'glow:lit', 'star')
    m.b(-5, 17, -2, -3, 24, 0, 'iron:1', 'star cord')
    m.light(3, 13, -1, 'glow:moon', 0.3, 0.35)
    return m


def all_models():
    return [ice_chime(), eight_bit(), wood_block(), cowbell(), sleigh_bells(), music_box(), owl(), lullaby()]

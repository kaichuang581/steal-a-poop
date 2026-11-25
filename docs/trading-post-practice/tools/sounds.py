"""The eight fuse sounds, each shown as the thing that makes the sound. Cell 0.025 m. Scenery colours only (LADDER, glows)."""
from kit import Model
from vox import Vox

D = 0.025
SOUNDS = {
    'iceChime':    ('Ice chime', 'Icicles on a frame, tapped by a bead'),
    'eightBit':    ('8-bit', 'A pocket game, beeping'),
    'woodBlock':   ('Wood block', 'A hollow block and its mallet'),
    'cowbell':     ('Cowbell', 'A copper bell on a leather strap'),
    'sleighBells': ('Sleigh bells', 'Five brass bells on a strap'),
    'musicBox':    ('Music box', 'A wound box with a tiny dancer'),
    'owl':         ('Owl', 'A carved owl call on its perch'),
    'lullaby':     ('Lullaby', 'A moon and a star on a cradle hook'),
}
ORDER = list(SOUNDS)


def ice_chime():
    m = Model('sound_iceChime', D, *SOUNDS['iceChime'], 'D')
    m.b(-9, 0, -3, 9, 1, 3, 'darkWood:0', 'base')
    for x in (-8, 7):
        m.b(x, 1, -1, x + 1, 19, 0, 'darkWood:-1', 'post')
    m.b(-9, 19, -1, 9, 20, 0, 'darkWood:0', 'top bar')
    m.b(-9, 20, -1, 9, 21, 0, 'snow:1', 'snow on the bar')
    for i, (x, L) in enumerate(((-6, 10), (-3, 7), (0, 12), (3, 8))):
        m.b(x, 18, -1, x + 1, 19, 0, 'iron:1', 'thread')
        m.b(x - 1 + 1, 19 - 1 - L + 2, -1, x + 2, 18, 1, f'ice:{(0, 1, -1, 1)[i]}', 'icicle')
        m.b(x, 19 - 1 - L, -1, x + 1, 19 - 1 - L + 2, 0, 'ice:2', 'icicle tip')
    m.b(5, 9, 0, 7, 11, 2, 'scarfRed:0', 'striker bead')
    m.b(5, 11, 0, 6, 19, 1, 'iron:1', 'bead thread')
    return m


def eight_bit():
    m = Model('sound_eightBit', D, *SOUNDS['eightBit'], 'D')
    m.b(-6, 0, -2, 6, 1, 3, 'slate:-1', 'stand')
    m.b(-6, 1, -1, 6, 19, 1, 'trimWhite:0', 'case')
    m.b(-6, 1, -1, 6, 2, 1, 'trimWhite:-2', 'case foot')
    m.b(-5, 10, 1, 5, 18, 2, 'glass:-2', 'screen')
    for (x, y, c) in ((-3, 12, 'glow:bulbSage'), (-2, 13, 'glow:bulbSage'), (-1, 12, 'glow:bulbSage'), (2, 15, 'glow:bulbGold'), (0, 11, 'glow:bulbSage'), (1, 11, 'glow:bulbSage')):
        m.b(x, y, 2, x + 1, y + 1, 3, c, 'pixel')
    m.b(-4, 5, 1, -1, 6, 2, 'ink:1', 'pad'); m.b(-3, 4, 1, -2, 7, 2, 'ink:1', 'pad')
    m.b(1, 4, 1, 3, 6, 2, 'scarfRed:0', 'button'); m.b(3, 6, 1, 5, 8, 2, 'scarfRed:0', 'button')
    m.b(-2, 2, 1, 2, 3, 2, 'slate:0', 'speaker slot')
    return m


def wood_block():
    m = Model('sound_woodBlock', D, *SOUNDS['woodBlock'], 'D')
    m.b(-8, 0, -4, 8, 7, 4, 'wood:1', 'block')
    m.b(-8, 6, -4, 8, 7, 4, 'wood:2', 'block top')
    m.b(-6, 3, 4, 6, 4, 5, 'darkWood:-1', 'slot')
    m.b(-8, 0, -4, -7, 7, 4, 'wood:0', 'end grain'); m.b(7, 0, -4, 8, 7, 4, 'wood:0', 'end grain')
    m.b(-4, 7, -1, 7, 8, 0, 'houseCream:0', 'mallet handle')
    m.b(-7, 7, -2, -4, 10, 1, 'scarfRed:0', 'mallet head')
    m.b(-7, 9, -2, -4, 10, 1, 'scarfRed:1', 'mallet head, top')
    return m


def cowbell():
    m = Model('sound_cowbell', D, *SOUNDS['cowbell'], 'D')
    for i, hw in enumerate((6, 6, 6, 5, 5, 5, 5, 4, 4, 4, 4, 3)):
        m.b(-hw, 1 + i, -3, hw, 2 + i, 3, 'carrot:-2' if i else 'carrot:-1', 'bell')
    m.b(-6, 1, -3, 6, 2, 3, 'brass:-1', 'rim')
    m.b(-4, 3, 3, -3, 11, 4, 'carrot:1', 'shine')
    m.b(-1, 0, -1, 1, 2, 1, 'iron:0', 'clapper')
    m.b(-3, 13, -1, 3, 14, 1, 'brass:-1', 'crown')
    m.b(-3, 14, -1, -2, 19, 0, 'darkWood:0', 'strap'); m.b(2, 14, -1, 3, 19, 0, 'darkWood:0', 'strap')
    m.b(-3, 19, -1, 3, 20, 0, 'darkWood:1', 'strap top'); m.b(2, 16, 0, 3, 18, 1, 'brass:0', 'buckle')
    return m


def sleigh_bells():
    m = Model('sound_sleighBells', D, *SOUNDS['sleighBells'], 'D')
    arc = [(-9, 6), (-6, 10), (-2, 12), (2, 12), (6, 10), (9, 6)]
    for (x0, y0), (x1, y1) in zip(arc, arc[1:]):
        m.b(min(x0, x1), max(y0, y1), -1, max(x0, x1) + 1, max(y0, y1) + 2, 1, 'darkWood:0', 'strap')
    for i, (x, y) in enumerate(((-9, 2), (-5, 6), (0, 8), (5, 6), (9, 2))):
        m.b(x - 2, y, -2, x + 2, y + 4, 2, 'brass:0', 'bell')
        m.b(x - 2, y + 3, -2, x + 2, y + 4, 2, 'brass:1', 'bell top')
        m.b(x - 1, y, 2, x + 1, y + 2, 3, 'iron:0', 'bell slit')
    m.b(-11, 0, -2, -7, 1, 2, 'snow:0', 'rest'); m.b(7, 0, -2, 11, 1, 2, 'snow:0', 'rest')
    return m


def music_box():
    m = Model('sound_musicBox', D, *SOUNDS['musicBox'], 'D')
    m.b(-8, 0, -5, 8, 6, 5, 'barnRed:0', 'box')
    m.b(-8, 5, -5, 8, 6, 5, 'trimWhite:0', 'box rim')
    m.b(-8, 6, -5, 8, 16, -4, 'barnRed:-1', 'lid, open')
    m.b(-7, 7, -4, 7, 15, -3, 'trimWhite:1', 'lid lining')
    m.b(-6, 6, 1, 0, 7, 3, 'brass:0', 'comb'); m.b(1, 6, 0, 5, 8, 4, 'brass:-1', 'drum')
    m.b(8, 2, -1, 10, 3, 1, 'brass:0', 'crank'); m.b(10, 2, -1, 11, 6, 1, 'brass:0', 'crank'); m.b(10, 6, -1, 12, 7, 1, 'scarfRed:0', 'crank knob')
    m.b(-4, 7, -2, -1, 10, 0, 'wool:1', 'dancer, wool'); m.b(-2, 9, -2, 0, 11, 0, 'pink:0', 'dancer, head'); m.b(-4, 6, -2, -3, 7, -1, 'wool:-2', 'dancer, leg'); m.b(-2, 6, -2, -1, 7, -1, 'wool:-2', 'dancer, leg')
    m.b(-2, 0, 5, 2, 3, 6, 'brass:1', 'clasp')
    return m


def owl():
    m = Model('sound_owl', D, *SOUNDS['owl'], 'D')
    m.b(-10, 0, -2, 10, 2, 2, 'darkWood:0', 'perch'); m.b(-10, 2, -2, -6, 3, 2, 'snow:1', 'snow on the perch'); m.b(6, 2, -2, 10, 3, 2, 'snow:1', 'snow on the perch')
    m.b(-5, 2, -3, 5, 12, 3, 'wood:0', 'body'); m.b(-4, 3, 3, 4, 9, 4, 'wood:2', 'chest')
    for r, y in enumerate((4, 6, 8)):
        for x in range(-3, 4, 2):
            m.b(x, y, 4, x + 1, y + 1, 5, 'wood:0', 'feather')
    m.b(-6, 11, -3, 6, 17, 3, 'wood:-1', 'head'); m.b(-6, 17, -3, -4, 19, 3, 'wood:-2', 'ear tuft'); m.b(4, 17, -3, 6, 19, 3, 'wood:-2', 'ear tuft')
    for x in (-5, 1):
        m.b(x, 12, 3, x + 4, 16, 4, 'trimWhite:2', 'eye'); m.b(x + 1, 13, 4, x + 3, 15, 5, 'ink:0', 'pupil')
    m.b(-1, 11, 3, 1, 13, 5, 'carrot:0', 'beak')
    m.b(-4, 1, 2, -2, 2, 4, 'carrot:-1', 'foot'); m.b(2, 1, 2, 4, 2, 4, 'carrot:-1', 'foot')
    return m


def lullaby():
    m = Model('sound_lullaby', D, *SOUNDS['lullaby'], 'D')
    m.b(-8, 0, -3, 2, 1, 3, 'darkWood:0', 'base'); m.b(-7, 1, -1, -6, 21, 0, 'darkWood:-1', 'post'); m.b(-7, 21, -1, 7, 22, 0, 'darkWood:0', 'arm')
    m.b(3, 17, -1, 4, 21, 0, 'iron:1', 'thread'); m.b(-3, 14, -1, -2, 21, 0, 'iron:1', 'thread')
    v = Vox()
    v.fill(((-2, 12), (2, 18), (-1, 1)), lambda x, y, z: (x - 5) ** 2 + (y - 10) ** 2 <= 49 and (x - 8) ** 2 + (y - 11.5) ** 2 > 36, 'glow:moon', 'moon')
    v.into(m, 'moon')
    for (x, y) in ((-3, 12), (-4, 11), (-3, 11), (-2, 11), (-3, 10), (-3, 13)):
        m.b(x, y, -1, x + 1, y + 1, 0, 'glow:lit', 'star')
    m.light(3, 10, 0, 'glow:moon', 0.3, 0.35)
    return m


def all_models():
    return [ice_chime(), eight_bit(), wood_block(), cowbell(), sleigh_bells(), music_box(), owl(), lullaby()]

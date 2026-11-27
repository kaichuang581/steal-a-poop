"""The Trading Post as a place: a market row of four stops. Models (cell 0.05 m) and every placement.
x runs along the row, y up, z toward the camera. The snow is y 0. Stops stand at STOP_X."""
import math

import numpy as np

import bursts
import models_farm
import skins
import sounds
from kit import Model, boards_x, octagon, tile
from ladder import tok
from render import Camera, Scene, render, sky_gradient, srgb_to_lin, hexrgb
from vox import Vox

S = 0.05
STOP_X = {'sacks': 0.0, 'bells': 6.4, 'missions': 12.4, 'book': 18.6}
CAM = {'sacks': dict(cx=0.35, A=185.0, lane=0.78), 'bells': dict(cx=6.4, A=205.0, lane=0.78),
       'missions': dict(cx=12.4, A=212.0, lane=0.83), 'book': dict(cx=18.6, A=205.0, lane=0.84)}
LIGHT = {'top': (1.00, 0.90, 0.78), 'front': (0.84, 0.74, 0.66), 'left': (0.52, 0.44, 0.48), 'right': (0.66, 0.56, 0.54), 'bottom': (0.30, 0.26, 0.32)}
SKY = {'top': '#2B2F58', 'mid': '#6A4F74', 'horizon': '#E3A482', 'fog': '#B98A86'}
FOG = (16, 80, 0.72)
SACKS = {'oat':    dict(name='Oat Sack', holds='Bomb skins', tie='scarfRed:0', grain='straw:2', emblem=['....XX', '...X..', '.XXXX.', 'XXXXXX', 'XXXXXX', '.XXXX.'], x=-1.3),
         'corn':   dict(name='Corn Sack', holds='Bursts', tie='carrot:0', grain='brass:1', emblem=['X.XX.X', '.XXXX.', 'XXXXXX', 'XXXXXX', '.XXXX.', 'X.XX.X'], x=0.0),
         'barley': dict(name='Barley Sack', holds='Fuse sounds', tie='giftGreen:0', grain='wood:2', emblem=['..XXXX', '..X..X', '..X..X', '.XX.XX', 'XXX.XX', '.X..X.'], x=1.3)}


def awning(m, hw, c1, c2, y_back=58, z_back=-36, z_front=12, stripe=8, sign=None):
    n = 4
    dz = (z_front - z_back) // n
    for k in range(n):
        z0, y = z_back + k * dz, y_back - k * 2
        for i, x in enumerate(range(-hw, hw, stripe)):
            m.b(x, y, z0, min(x + stripe, hw), y + 2, z0 + dz, c1 if i % 2 == 0 else c2, 'awning stripe', 'awning')
        if k < 2:
            m.b(-hw, y + 2, z0, hw, y + 3, z0 + dz - 4, 'snow:1', 'snow on the awning', 'awning')
    yv = y_back - (n - 1) * 2
    for i, x in enumerate(range(-hw, hw, stripe)):          # the valance: one tab per stripe, its lower corners stepped
        col = c1 if i % 2 == 0 else c2
        m.b(x, yv - 5, z_front - 1, min(x + stripe, hw), yv, z_front, col, 'valance', 'awning')
        m.b(x + 1, yv - 6, z_front - 1, min(x + stripe, hw) - 1, yv - 5, z_front, col, 'valance tab', 'awning')
    if sign:
        m.b(-sign, yv - 5, z_front, sign, yv + 2, z_front + 1, 'trimWhite:2', 'sign board', 'sign')
        m.b(-sign - 1, yv - 6, z_front, sign + 1, yv - 5, z_front + 1, 'darkWood:0', 'sign frame', 'sign')
        m.b(-sign - 1, yv + 2, z_front, sign + 1, yv + 3, z_front + 1, 'darkWood:0', 'sign frame', 'sign')
        m.b(-sign - 1, yv - 5, z_front, -sign, yv + 2, z_front + 1, 'darkWood:0', 'sign frame', 'sign')
        m.b(sign, yv - 5, z_front, sign + 1, yv + 2, z_front + 1, 'darkWood:0', 'sign frame', 'sign')
    return yv


def posts(m, hw, y_back, y_front, z_back, z_front):
    for x in (-hw, hw - 3):
        m.b(x, 0, z_back, x + 3, y_back, z_back + 3, 'darkWood:-1', 'back post')
        m.b(x, 0, z_front - 3, x + 3, y_front, z_front, 'darkWood:-1', 'front post')
        m.b(x - 1, 0, z_front - 4, x + 4, 2, z_front + 1, 'snow:1', 'snow at the post')
    m.b(-hw, y_front - 2, z_front - 3, hw, y_front, z_front, 'darkWood:0', 'front beam')


STOCK = [('scarfRed:0', 4, 6), ('trimWhite:1', 3, 5), ('giftGreen:0', 4, 7), ('coopYellow:0', 3, 4), ('slate:0', 4, 6), ('trimWhite:0', 3, 7), ('scarfRed:-1', 3, 5), ('coopYellow:-1', 4, 6)]


def stock_row(m, x0, x1, y, z0, start=0):
    """Tins and jars on a shelf: a fixed order of eight, lids alternating iron and brass, one cell apart."""
    x, i = x0, start
    while x < x1 - 4:
        c, w, h = STOCK[i % 8]
        m.b(x, y, z0, x + w, y + h, z0 + 4, c, 'tin', 'stock')
        m.b(x, y + h, z0, x + w, y + h + 1, z0 + 4, 'iron:1' if i % 2 else 'brass:0', 'lid', 'stock')
        if i % 3 == 0:
            m.b(x + 1, y + 2, z0 + 4, x + w - 1, y + 4, z0 + 5, 'trimWhite:2', 'label', 'stock')
        x += w + 1
        i += 1


def feed_stall():
    m = Model('feedStall', S, 'The feed stall: counter, back wall with stock, red and cream awning', "The Trading Post's market stall, rebuilt as a real voxel stall", 'S')
    hw = 43
    posts(m, hw, 58, 52, -36, 9)
    m.b(-hw, 0, -36, hw, 2, -34, 'stone:-1', 'footing')
    tile(m, -40, 2, -35, 40, 56, -34, 'wood', -1, long='y', across='x', L=12, W=5, name='back wall board')
    for y in (30, 42):
        m.b(-40, y, -34, 40, y + 1, -28, 'darkWood:0', 'shelf')
        stock_row(m, -38, 38, y + 1, -33, start=0 if y == 30 else 3)
    tile(m, -40, 19, -15, 40, 21, 1, 'wood', 1, long='x', across='z', L=12, W=4, name='counter top plank')
    m.b(-40, 19, 1, 40, 21, 2, 'wood:2', 'counter top, lit edge')
    tile(m, -40, 2, 0, 40, 19, 1, 'wood', 0, long='y', across='x', L=12, W=5, name='counter front board')
    m.b(-40, 0, -1, 40, 2, 2, 'darkWood:0', 'counter plinth')
    m.b(-39, 2, -14, 39, 19, 0, 'wood:-2', 'counter body (hidden)')
    for x0 in (-40, 39):
        tile(m, x0, 2, -15, x0 + 1, 19, 0, 'wood', -1, long='y', across='z', L=12, W=5, name='counter end board')
    awning(m, hw + 2, 'scarfRed:0', 'trimWhite:1', sign=16)
    return m


def crate(grain):
    m = Model('sackCrate_' + grain.split(':')[0], S, 'An open crate that holds one sack, with loose grain round the sack', 'The stall crates of today, rebuilt', 'S')
    boards_x(m, -9, 9, 0, 6, 5, 6, 'wood', w=3, name='crate board')
    m.b(-9, 0, -6, 9, 5, 5, 'wood:-1', 'crate body')
    m.b(-10, 0, 5, -9, 7, 6, 'darkWood:0', 'crate corner'); m.b(9, 0, 5, 10, 7, 6, 'darkWood:0', 'crate corner')
    gm, gs = grain.split(':')
    tile(m, -9, 5, -6, 9, 6, 5, gm, int(gs), long='x', across='z', L=6, W=4, name='grain')
    for (x, z) in ((-7, 2), (5, 3), (-2, 4), (7, 0)):
        m.b(x, 6, z, x + 2, 7, z + 1, grain, 'grain heap')
    return m


def sack(key):
    s = SACKS[key]
    m = Model('sack_' + key, S, f"{s['name']}: burlap, tied with yarn, its stencil says what it holds ({s['holds'].lower()})", "Today's feed sacks, remodelled: clean weave, no speckle", 'S')
    prof = [5.8, 6.6, 7.0, 7.2, 7.2, 7.1, 6.9, 6.6, 6.1, 5.4, 4.4, 3.2, 2.6, 2.6, 3.8, 4.2, 3.6]
    v = Vox()
    v.fill(((-8, 8), (0, 17), (-8, 8)), lambda x, y, z: x * x + z * z <= prof[int(y)] ** 2,
           lambda x, y, z: s['tie'] if 11 <= y < 14 else ('hay:-2' if int(y) % 2 else 'hay:-1'))
    for x in range(-4, 4):
        for y in range(2, 10):
            for z in (5, 6, 7):
                v.set(x, y, z, 'trimWhite:2', 'patch')
    for r, row in enumerate(s['emblem']):
        for c, ch in enumerate(row):
            if ch == 'X':
                v.set(-3 + c, 8 - r, 7, 'ink:1', 'stencil')
    for (x, y) in ((-1, 12), (0, 12), (-1, 11), (0, 11),                          # the yarn bow: a knot, two loops, two tails
                   (-5, 13), (-4, 13), (-3, 13), (-5, 12), (-3, 12), (-2, 12), (-5, 11), (-4, 11), (-3, 11),
                   (2, 13), (3, 13), (4, 13), (1, 12), (2, 12), (4, 12), (2, 11), (3, 11), (4, 11),
                   (-2, 10), (-3, 9), (-3, 8), (1, 10), (2, 9), (2, 8)):
        v.set(x, y, 3, s['tie'], 'tie'); v.set(x, y, 4, s['tie'], 'tie')
    v.into(m)
    return m


def bench():
    m = Model('sampleBench', S, 'The low bench in front of the counter where a sack shows what it holds', 'New: replaces the "Inside the sack" cards', 'S')
    tile(m, -40, 4, 7, 40, 6, 19, 'wood', 1, long='x', across='z', L=12, W=4, name='bench plank')
    tile(m, -39, 6, 8, 39, 7, 18, 'trimWhite', 1, long='x', across='z', W=5, name='cloth runner panel')
    tile(m, -39, 3, 18, 39, 6, 19, 'trimWhite', 0, long='x', across='y', L=12, W=3, name='cloth, front drop')
    for x in (-39, -14, 11, 36):
        m.b(x, 0, 8, x + 3, 4, 18, 'darkWood:0', 'bench leg')
    return m


def a_board():
    m = Model('oddsBoard', S, 'The chalk board that stands by the stall and states the odds', "Today's odds slate, made a real board", 'S')
    m.b(-10, 2, -1, 10, 30, 1, 'iron:-1', 'board face', 'face')
    for (x0, x1, y0, y1) in ((-11, -10, 0, 31), (10, 11, 0, 31), (-11, 11, 30, 31), (-11, 11, 2, 3)):
        m.b(x0, y0, -1, x1, y1, 2, 'wood:0', 'frame')
    m.b(-11, 0, -6, -10, 28, -5, 'wood:-1', 'back leg'); m.b(10, 0, -6, 11, 28, -5, 'wood:-1', 'back leg')
    m.b(-11, 31, -1, 11, 32, 2, 'snow:1', 'snow on top')
    return m


def barrel():
    m = Model('barrel', S, 'A barrel at the stall end: staves two cells wide in turn, two iron hoops', "Today's barrel, rebuilt", 'S')
    for (y0, y1, r) in ((0, 3, 6), (3, 13, 7), (13, 16, 6)):
        a, b_ = max(1, int(round(r * 0.45))), max(1, int(round(r * 0.75)))
        for (hx, hz) in ((r, a), (b_, b_), (a, r)):       # the eight-sided body, each of its three boxes cut into 2-cell staves
            tile(m, -hx, y0, -hz, hx, y1, hz, 'wood', 0, long='y', across='x', L=16, W=2, name='stave',
                 colour=lambda i_, j_: 'wood:%d' % (0 if j_ % 2 == 0 else -1))
    octagon(m, 7, 4, 5, 'iron:0', 'hoop'); octagon(m, 7, 11, 12, 'iron:0', 'hoop')
    for x in range(-6, 6):                                  # the lid: four boards 3 cells wide, two tones in turn
        for z in range(-6, 6):
            ax, az = abs(x + .5), abs(z + .5)
            if ax <= 6 and az <= 6 and ax + az <= 8.6:
                m.b(x, 16, z, x + 1, 17, z + 1, 'wood:1' if ((x + 6) // 3) % 2 == 0 else 'wood:0', 'lid board')
    return m


def lantern():
    m = Model('stallLantern', S, 'The lantern that hangs over the picked sack', "Home's lantern", 'S')
    m.b(0, 6, 0, 1, 10, 1, 'iron:0', 'chain'); m.b(-2, 5, -2, 3, 6, 3, 'iron:0', 'roof'); m.b(-1, 1, -1, 2, 5, 2, 'glow:lit', 'glass'); m.b(-2, 0, -2, 3, 1, 3, 'iron:0', 'base')
    m.light(0.5, 3, 0.5, 'glow:lit', 0.6, 0.32)
    return m


BIG_BELL = [8.0, 8.0, 7.4, 6.9, 6.5, 6.2, 5.9, 5.8, 5.6, 5.5, 5.4, 5.3, 5.1, 4.8, 4.3, 3.4]   # radius by row, 0.05 m cells


def big_bell():
    m = Model('bigBell', S, 'The big brass bell that hangs at the Bell Shelf', 'New: names the stand; rings when Bells are spent', 'S')
    v = Vox()
    v.fill(((-8, 8), (0, 16), (-8, 8)), lambda x, y, z: x * x + z * z <= BIG_BELL[int(y)] ** 2 + 0.5,
           lambda x, y, z: 'brass:-2' if (y < 1 or 10 <= y < 11) else ('brass:2' if 1.95 < math.atan2(z, x) < 2.6 and 3 <= y < 10 else ('brass:-1' if y < 3 else 'brass:0')))
    v.into(m)
    m.b(-1, 16, -1, 1, 20, 1, 'iron:0', 'hanger'); m.b(-1, -2, -1, 1, 0, 1, 'iron:1', 'clapper')
    return m


def bell_stand():
    m = Model('bellStand', S, 'The Bell Shelf: two display steps under a green and cream awning', "Today's Bell Shelf, made a stand in the row", 'S')
    hw = 32
    posts(m, hw, 58, 52, -30, 9)
    tile(m, -29, 2, -29, 29, 56, -28, 'wood', -1, long='y', across='x', L=12, W=5, name='back wall board')
    tile(m, -29, 0, 3, 29, 15, 4, 'wood', -1, long='y', across='x', L=12, W=5, name='lower step, front board')
    tile(m, -29, 0, -12, 29, 18, 3, 'wood', -1, long='y', across='z', L=12, W=5, name='lower step')
    tile(m, -29, 18, -12, 29, 19, 4, 'trimWhite', 1, long='x', across='z', W=4, name='cloth panel')
    tile(m, -29, 15, 4, 29, 19, 5, 'trimWhite', 0, long='x', across='y', L=12, W=4, name='cloth, front drop')
    tile(m, -29, 0, -13, 29, 29, -12, 'wood', -2, long='y', across='x', L=12, W=5, name='upper step, front board')
    tile(m, -29, 0, -28, 29, 32, -13, 'wood', -2, long='y', across='z', L=12, W=5, name='upper step')
    tile(m, -29, 32, -28, 29, 33, -12, 'trimWhite', 1, long='x', across='z', W=4, name='cloth panel')
    tile(m, -29, 29, -12, 29, 33, -11, 'trimWhite', 0, long='x', across='y', L=12, W=4, name='cloth, front drop')
    m.b(-hw, 46, 6, -hw + 14, 48, 8, 'darkWood:0', 'bell bracket')
    awning(m, hw + 2, 'giftGreen:0', 'trimWhite:1', z_back=-30, sign=14)
    return m


def notice_board():
    m = Model('noticeBoard', S, 'The mission board: cork under a little roof, with paper slips pinned to it', "Today's Missions tab, made a board in the row", 'S')
    for x in (-36, 34):
        m.b(x, 0, -2, x + 2, 54, 0, 'darkWood:-1', 'post'); m.b(x - 1, 0, -3, x + 3, 2, 1, 'snow:1', 'snow at the post')
    m.b(-34, 4, -2, 34, 50, -1, 'straw:-2', 'cork', 'face')
    for (x0, x1, y0, y1) in ((-34, 34, 48, 50), (-34, 34, 4, 6), (-34, -32, 6, 48), (32, 34, 6, 48)):
        m.b(x0, y0, -2, x1, y1, 0, 'barnRed:-1', 'frame')
    m.b(-39, 54, -6, 39, 56, 5, 'darkWood:0', 'roof board'); m.b(-36, 56, -5, 36, 58, 4, 'darkWood:1', 'roof ridge')
    m.b(-39, 56, -6, -36, 57, 5, 'snow:0', 'roof snow'); m.b(36, 56, -6, 39, 57, 5, 'snow:0', 'roof snow'); m.b(-36, 58, -4, 36, 59, 4, 'snow:1', 'roof snow')
    for (x0, x1) in ((-31, -11), (-10, 10), (11, 31)):                    # three mission slips
        m.b(x0, 32, -1, x1, 47, 0, 'trimWhite:2', 'mission slip', 'slip'); m.b((x0 + x1) // 2, 46, 0, (x0 + x1) // 2 + 1, 47, 1, 'brass:0', 'pin', 'slip')
    m.b(-31, 7, -1, 31, 30, 0, 'trimWhite:2', 'milestone sheet', 'slip')
    for x in (-30, 29):
        m.b(x, 29, 0, x + 1, 30, 1, 'brass:0', 'pin', 'slip')
    m.notes.append('Faces in cells: mission slips x -31..-11, -10..10, 11..31, y 32..47 (1.0 x 0.75 m each). Milestone sheet x -31..31, y 7..30 (3.1 x 1.15 m).')
    return m


def book_pockets(n):
    """Where each item stands in the standing book: (x, y of its ledge top, in cells from the book's middle on the table top)."""
    cols = 2 if n <= 8 else 3
    per = cols * 2
    out = []
    for i in range(n):
        page, k = (0, i) if i < (n + 1) // 2 else (1, i - (n + 1) // 2)
        half = (n + 1) // 2 if page == 0 else n - (n + 1) // 2
        row, col = k // cols, k % cols
        in_row = min(cols, half - row * cols)
        w = 34.0 / cols
        x0 = (-36 if page == 0 else 2) + (34 - in_row * w) / 2
        out.append((round(x0 + (col + .5) * w, 2), 38 if row == 0 else 19))
    return out, cols


def barn_book(n=8):
    m = Model('barnBook%d' % n, S, 'The Barn Book: a big book standing open on a table, a ledge on its pages for every item', "Today's Barn Book tab, made a real book", 'S')
    tile(m, -41, 8, -9, 41, 10, 9, 'wood', 1, long='x', across='z', L=12, W=4, name='table plank'); m.b(-41, 9, 9, 41, 10, 10, 'wood:2', 'table edge')
    for x in (-40, 37):
        m.b(x, 0, -8, x + 3, 8, -5, 'darkWood:0', 'table leg'); m.b(x, 0, 5, x + 3, 8, 8, 'darkWood:0', 'table leg')
    m.b(-38, 10, -5, 38, 58, -4, 'barnRed:-1', 'cover'); m.b(-1, 10, -5, 1, 58, -2, 'barnRed:-2', 'spine')
    for (x0, x1) in ((-37, -1), (1, 37)):
        m.b(x0, 11, -4, x1, 57, -3, 'trimWhite:0', 'page block'); m.b(x0 + 1, 12, -3, x1 - 1, 56, -2, 'trimWhite:2', 'page')
    pk, cols = book_pockets(n)
    hw = 7 if cols == 2 else 5
    for (x, y) in pk:
        xi = int(round(x))
        m.b(xi - hw, y, -2, xi + hw, y + 1, 3, 'trimWhite:-1', 'ledge', 'ledge')
        m.b(xi - hw, y + 1, -2, xi + hw, y + 14, -1, 'trimWhite:1', 'pocket back', 'ledge')
    m.b(-38, 58, -5, 38, 59, -2, 'snow:1', 'snow on the book')
    return m


def gate_post():
    m = Model('rowPost', S, 'A post of the market row, with a lantern: the string of bulbs runs from post to post', "Home's lamp posts", 'S')
    m.b(-1, 0, -1, 1, 62, 1, 'darkWood:-1', 'post'); m.b(-2, 0, -2, 2, 2, 2, 'snow:1', 'snow at the foot')
    m.b(-2, 62, -2, 2, 63, 2, 'iron:0', 'lantern base'); m.b(-1, 63, -1, 1, 67, 1, 'glow:lit', 'lantern glass'); m.b(-2, 67, -2, 2, 68, 2, 'iron:0', 'lantern roof'); m.b(-1, 68, -1, 1, 69, 1, 'snow:1', 'snow')
    m.light(0, 65, 0, 'glow:lit', 1.0, 0.45)
    return m


MODELS = {m.id: m for m in [feed_stall(), bench(), a_board(), barrel(), lantern(), big_bell(), bell_stand(), notice_board(),
                            barn_book(8), barn_book(10), gate_post()] + [sack(k) for k in SACKS] + [crate(SACKS[k]['grain']) for k in SACKS]
          + skins.all_models() + sounds.all_models() + models_farm.all_models()}
for kind, h in (('spire', 7.0), ('cone', 5.5), ('round', 6.5)):
    MODELS['pine_' + kind] = models_farm.pine('pine_' + kind, h, kind)
MODELS['sheepStandIn'] = __import__('models_practice').sheep_standin()

INSIDE = {'oat': ['ember', 'peppermint', 'plum', 'gold', 'diamond'],
          'corn': ['confetti', 'snowfall', 'hay', 'frost', 'northern', 'ember', 'bubblegum'],          # which seven: as the catalogue has it
          'barley': ['eightBit', 'woodBlock', 'cowbell', 'sleighBells', 'musicBox', 'owl']}


def tint_at(z):
    return float(np.interp(z, [-60, -20, -6, -1.6, -0.8, 0, 3], [0.50, 0.56, 0.66, 0.74, 0.90, 1.0, 1.0]))


class Layout:
    def __init__(self):
        self.items, self.raw, self.extra, self.shown = [], [], [], []

    def put(self, model, x, z, y=0.0, note='', tint=None, **kw):
        self.items.append(dict(model=model, x=round(x, 3), y=round(y, 3), z=round(z, 3), note=note, tint=tint, kw=kw))

    def box(self, x0, y0, z0, x1, y1, z1, c, note='', unlit=False, tint=None):
        self.raw.append(dict(b=[round(v, 3) for v in (x0, y0, z0, x1, y1, z1)], c=c, note=note, unlit=unlit, tint=tint))

    def build(self, sc, festive=True):
        for it in self.items:
            t = it['tint'] if it['tint'] is not None else tint_at(it['z'])
            MODELS[it['model']].place(sc, it['x'], it['y'], it['z'], tint=t, festive=festive, **it['kw'])
        for r in self.raw:
            x0, y0, z0, x1, y1, z1 = r['b']
            t = r['tint'] if r['tint'] is not None else tint_at((z0 + z1) / 2)
            sc.box(x0, y0, z0, x1, y1, z1, tok(r['c']), r['unlit'], 1.0 if r['unlit'] else t)
        for f in self.extra:
            f(sc)


def item_xs(n, x0, span):
    step = span / max(n, 1) if n > 5 else 0.72
    return [x0 + (i - (n - 1) / 2) * step for i in range(n)]


def put_item(L, kind, key, x, y, z, scale=1.0, flat=None):
    """kind: skin | burst | sound. A burst is shown as its fullest moment over a small stand, its positions drawn in to 42%, its pieces full size."""
    L.shown.append(dict(kind=kind, key=key, x=round(x, 3), y=round(y, 3), z=round(z, 3), scale=scale, cut_out=bool(flat)))
    if kind == 'skin':
        L.put('bomb_' + key, x, z, y=y, scale=scale, flat=flat, glow=0.0 if flat else 0.5, tint=1.0)
    elif kind == 'sound':
        L.put('sound_' + key, x, z, y=y, scale=scale * 1.1, flat=flat, glow=0.0 if flat else 0.6, tint=1.0)
    else:
        L.extra.append(lambda sc, key=key, x=x, y=y, z=z, scale=scale, flat=flat: (bursts.stand(sc, x, y, z, 1.0), bursts.place(sc, key, x, y + 0.15, z, flat=flat, spread=0.42 * scale)))


def market(picked='oat', festive=True):
    L = Layout()
    L.box(-60, -0.4, -90, 80, 0.0, 9, 'snow:1', 'snow', tint=1.0)
    for r, z in enumerate((1.25, 1.80, 2.35)):                              # the market lane: three rows of packed-snow pavers, laid like bricks
        for i, x in enumerate(np.arange(-6.0 + (0.35 if r % 2 else 0), 25.0, 0.7)):
            L.box(x, 0.0, z, x + 0.62, 0.02, z + 0.45, 'trimWhite:0' if (i + r) % 3 else 'snow:-2', 'lane paver', tint=1.0)
    # stop 1: the feed stall
    X = STOP_X['sacks']
    L.put('feedStall', X, -0.1, note='feed stall; counter front at z -0.1')
    for k, s in SACKS.items():
        sel = k == picked
        z = -0.42 + (0.12 if sel else 0)
        L.put('sackCrate_' + s['grain'].split(':')[0], X + s['x'], z, y=1.05, note='crate of the ' + s['name'])
        L.put('sack_' + k, X + s['x'], z - 0.02, y=1.30, note=s['name'] + (' (picked: 0.12 m forward)' if sel else ''), tint=1.0 if sel else 0.86)
    for lx in (-0.65, 0.65):
        L.put('stallLantern', X + lx - 0.02, 0.2, y=1.98, note='stall lantern, hung from the front beam between the sack tags')
    L.put('sampleBench', X, 0.0, note='sample bench; top 0.35 m')
    kind = {'oat': 'skin', 'corn': 'burst', 'barley': 'sound'}[picked]
    for key, x in zip(INSIDE[picked], item_xs(len(INSIDE[picked]), X, 3.6)):
        put_item(L, kind, key, x, 0.35, 0.65)
    L.put('oddsBoard', X + 3.0, 0.55, note='odds board')
    L.put('barrel', X - 2.62, 0.5, note='barrel')
    # stop 2: the Bell Shelf
    X = STOP_X['bells']
    L.put('bellStand', X, -0.1, note='Bell Shelf stand')
    L.put('bigBell', X - 1.25, 0.25, y=1.44, note='the big bell, hanging from its bracket')
    put_item(L, 'skin', 'brassBell', X - 0.55, 0.95, -0.25)
    put_item(L, 'burst', 'lantern', X + 0.75, 0.95, -0.25, scale=1.6)
    # stop 3: the mission board
    X = STOP_X['missions']
    L.put('noticeBoard', X, -0.3, note='mission board')
    L.put('rowPost', X - 2.3, -0.3, note='row post'); L.put('rowPost', X + 2.3, -0.3, note='row post')
    # stop 4: the Barn Book
    X = STOP_X['book']
    L.put('barnBook8', X, -0.2, note='Barn Book, open at Bomb skins')
    pk, cols = book_pockets(8)
    found = {'ice', 'ember', 'plum'}
    for key, (px, py) in zip(skins.ORDER, pk):
        put_item(L, 'skin', key, X + px * S, (py + 1) * S, -0.2, scale=0.8, flat=None if key in found else tok('trimWhite:-2'))
    L.put('rowPost', X - 2.6, -0.3, note='row post'); L.put('rowPost', X + 2.6, -0.3, note='row post')
    # the row's own posts and the farm behind
    L.put('rowPost', -3.4, -0.3, note='row post'); L.put('rowPost', 3.9, -0.3, note='row post'); L.put('rowPost', 8.9, -0.3, note='row post')
    for k in range(-4, 13):
        L.put('fenceBay', k * 2.4, -5.0, note='farm fence behind the row', parts=['body'], glow=0.0)
    for (x, z, kind) in ((-7.5, -16, 'spire'), (-3.6, -21, 'cone'), (3.6, -17, 'round'), (5.4, -24, 'spire'), (9.6, -16, 'cone'), (11.4, -22, 'spire'),
                         (15.6, -17, 'round'), (17.4, -25, 'cone'), (22.4, -16, 'spire'), (24.6, -22, 'round')):
        L.put('pine_' + kind, x, z, note='pine')
    L.put('barn', 9.5, -34, note='the barn, far'); L.put('silo', 15.0, -36, note='the silo, far'); L.put('farmhouse', -8.0, -38, note='the farmhouse, far')
    if festive:                                                                 # the season's bulbs, post to post, sagging 0.3 m
        ps = [-3.4, 3.9, 8.9, 10.1, 14.7]
        for a, b in zip(ps, ps[1:]):
            n = max(6, int((b - a) / 0.45))
            for i in range(1, n):
                t = i / n
                x, y = a + (b - a) * t, 3.1 - 0.3 * 4 * t * (1 - t)
                L.box(x - 0.05, y - 0.1, -0.35, x + 0.05, y, -0.25, ('glow:bulbRed', 'glow:bulbGold', 'glow:bulbSage')[i % 3], 'bulb (season)', unlit=True)
    return L


def camera(stop=None, W=1440, H=900, ss=2, cx=None, A=None, lane=None, EYE=1.9, CAMD=9.0):
    c = CAM[stop] if stop else {}
    return Camera(W=W, H=H, A=A or c['A'] * min(W / 1440, H / 900), CAM=CAMD, EYE=EYE, lane_frac=lane or c['lane'], cam_x=cx if cx is not None else c['cx'], ss=ss)


def sky(cam, stars=26, seed=9):
    s = sky_gradient(cam, [(0.0, SKY['top']), (0.55, SKY['mid']), (1.0, SKY['horizon']), (cam.H / max(cam.hy, 1), SKY['horizon'])])
    rng = np.random.RandomState(seed)
    for i in range(stars):
        x, y = int(rng.rand() * cam.W), int(rng.rand() * cam.hy * 0.45)
        sz = cam.ss * 2
        s[y:y + sz, x:x + sz] = s[y:y + sz, x:x + sz] * 0.5 + srgb_to_lin(hexrgb('#F3E3D0')) * 0.5
    return s


def shot(cam, picked='oat', festive=True, extra=None):
    sc = Scene()
    L = market(picked, festive)
    if extra:
        L.extra.append(extra)
    L.build(sc, festive)
    img, zb = render(sc, cam, sky(cam), LIGHT, {'colour': SKY['fog'], 'start': FOG[0], 'end': FOG[1], 'most': FOG[2]})
    return img, len(sc.boxes), L


if __name__ == '__main__':
    import time
    t = time.time()
    img, n, L = shot(camera('sacks'))
    img.save('/tmp/m1.png')
    print(n, round(time.time() - t, 1))

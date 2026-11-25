"""The ten bursts, remodelled: shaped voxel pieces, at most 24 of them, at most three colours, one timing.
Each burst is a table of pieces at its fullest moment (300 ms). Positions are metres from the bomb's spot on the ground.
P is one piece cell: the one 0.05 m grain (VOXEL_GRAIN.md). Nothing here is random."""
import math

from ladder import tok
from vox import Vox

P = 0.05
C = {'red': tok('scarfRed:0'), 'yellow': tok('coopYellow:1'), 'green': tok('giftGreen:1'), 'white': '#F4F8FB', 'ice': tok('ice:1'), 'ice2': tok('ice:2'),
     'hay': tok('hay:0'), 'straw': tok('straw:1'), 'hayd': tok('hay:-2'), 'lantern': '#FFE7B0', 'lantern2': '#FFD08A', 'iron': tok('iron:0'),
     'au1': '#7BC48E', 'au2': '#6FB7B0', 'au3': '#8C8FD8', 'star': '#FFE9A8', 'star2': '#FFFFFF', 'em1': '#FFC773', 'em2': '#F28A3C', 'em3': '#B8521E',
     'gum': '#F29CB7', 'gumd': '#D97A9B', 'sun': '#FFD08A', 'sun2': '#FFF0C0', 'sun3': '#F2A26A'}

BURSTS = {
    'confetti':  dict(name='Confetti', colours=['red', 'yellow', 'green'], pieces=20, move='Thrown up in a fan, then each slab tumbles end over end and flutters down', sound='pop'),
    'snowfall':  dict(name='Snowfall', colours=['white', 'ice'], pieces=22, move='Flakes puff out in a ring, hang for a beat, then drift down swaying 0.1 m side to side', sound='soft thump'),
    'hay':       dict(name='Hay', colours=['hay', 'straw', 'hayd'], pieces=18, move='Straws kick out low and wide, like a bale burst, spin once and settle', sound='rustle'),
    'lantern':   dict(name='Lantern Glow', colours=['lantern', 'lantern2', 'iron'], pieces=12, move='Paper lanterns lift off slowly, rise 1.6 m with a slow sway and fade at the top', sound='low chime'),
    'frost':     dict(name='Frost', colours=['ice', 'ice2', 'white'], pieces=12, move='Ice needles shoot out and stop dead, a frozen star, hold 300 ms, then snap into chips that drop', sound='crack'),
    'northern':  dict(name='Northern Lights', colours=['au1', 'au2', 'au3'], pieces=9, move='Three curtains of light rise from the spot and ripple left to right, then thin out upward', sound='hum'),
    'starlight': dict(name='Starlight', colours=['star', 'star2'], pieces=12, move='Stars shoot up, hang and twinkle twice, then fall as shooting stars with three-cell tails', sound='glitter'),
    'ember':     dict(name='Ember', colours=['em1', 'em2', 'em3'], pieces=20, move='Sparks fountain up with tails, arc over and die out one by one', sound='crackle'),
    'bubblegum': dict(name='Bubblegum', colours=['gum', 'gumd', 'white'], pieces=15, move='Three bubbles swell, wobble, and pop one after another into four bits each', sound='three pops'),
    'solstice':  dict(name='Solstice', colours=['sun', 'sun2', 'sun3'], pieces=13, move='A small sun rises 0.8 m and its twelve rays push outward once, like a breath', sound='warm swell'),
}
ORDER = ['confetti', 'snowfall', 'hay', 'lantern', 'frost', 'northern', 'starlight', 'ember', 'bubblegum', 'solstice']
LIT = {'lantern', 'lantern2', 'au1', 'au2', 'au3', 'star', 'star2', 'em1', 'em2', 'sun', 'sun2', 'sun3'}

STAR = ['.X.', 'XXX', '.X.']
STAR5 = ['..X..', '.XXX.', 'XXXXX', '.XXX.', '..X..']
FLAKE = ['.X.', 'XXX', '.X.']


def sprite(out, rows, x, y, z, colour, lit=False):
    h = len(rows)
    for r, row in enumerate(rows):
        for c, ch in enumerate(row):
            if ch != '.':
                out.append((x + (c - len(row) / 2) * P, y + (h / 2 - r - 1) * P, z, P, P, P, colour if ch == 'X' else ch, lit))


def line(out, x, y, z, ang, n, colour, lit=False, tip=None):
    for i in range(n):
        cx, cy = x + math.cos(ang) * i * P, y + math.sin(ang) * i * P
        out.append((round(cx / P) * P, round(cy / P) * P, z, P, P, P, tip if (tip and i == n - 1) else colour, lit))


def pieces(key):
    """[(x, y, z, w, h, d, colour key, lit)] with (x, y, z) the piece's lower-left-back corner."""
    o = []
    if key == 'confetti':
        for i in range(20):
            a = math.radians(20 + i * 140 / 19)
            r = 0.55 + 0.30 * ((i * 7) % 5) / 4
            x, y, z = r * math.cos(a), 0.35 + r * math.sin(a), ((i % 3) - 1) * 0.12
            w, h = ((2, 2), (2, 1), (1, 2))[i % 3]
            o.append((x, y, z, w * P, h * P, P, ('red', 'yellow', 'green')[i % 3], False))
    elif key == 'snowfall':
        for i in range(16):
            a = math.radians(i * 22.5 + 11.25)
            r = 0.55 if i % 2 else 0.85
            sprite(o, FLAKE, r * math.cos(a), 0.55 + r * math.sin(a) * 0.8, ((i % 3) - 1) * 0.1, 'white' if i % 4 else 'ice')
        for i in range(6):
            a = math.radians(i * 60 + 30)
            o.append((0.3 * math.cos(a), 0.55 + 0.3 * math.sin(a), 0, P, P, P, 'white', False))
    elif key == 'hay':
        for i in range(18):
            a = math.radians(8 + i * 164 / 17)
            r = 0.45 + 0.35 * ((i * 5) % 4) / 3
            line(o, r * math.cos(a), 0.2 + r * math.sin(a) * 0.7, ((i % 3) - 1) * 0.12, a + (0, 0.8, -0.8)[i % 3], 5, ('hay', 'straw', 'hayd')[i % 3])
    elif key == 'lantern':
        spots = [(-0.62, 0.55), (-0.36, 1.05), (-0.12, 0.62), (0.14, 1.28), (0.40, 0.78), (0.64, 1.12), (-0.52, 1.42), (-0.02, 1.62), (0.30, 0.42), (0.56, 1.52), (-0.26, 0.30), (0.10, 0.95)]
        for i, (x, y) in enumerate(spots):
            z = ((i % 3) - 1) * 0.14
            o.append((x, y, z, 3 * P, 3 * P, 2 * P, 'lantern' if i % 2 else 'lantern2', True))
            o.append((x + P, y + P, z + 2 * P, P, P, P, 'sun2', True))
            o.append((x, y + 3 * P, z, 3 * P, P, 2 * P, 'iron', False))
            o.append((x + P, y - P, z, P, P, 2 * P, 'iron', False))
    elif key == 'frost':
        for i in range(12):
            a = math.radians(i * 30)
            line(o, 0.2 * math.cos(a), 0.6 + 0.2 * math.sin(a), 0, a, 11 if i % 2 == 0 else 6, 'ice' if i % 2 == 0 else 'ice2', False, 'white')
    elif key == 'northern':
        for k, (x0, col) in enumerate(((-0.55, 'au2'), (-0.05, 'au1'), (0.45, 'au3'))):
            for j in range(9):
                h = round((0.55 + 0.35 * math.sin(j * 0.7 + k * 1.3) + (0.25 if k == 1 else 0)) / P) * P   # whole cells
                o.append((x0 + j * 0.06, 0.3 + 0.08 * math.sin(j * 0.9 + k), (k - 1) * 0.12, 0.05, h, P, col, True))
        for (x, y) in ((-0.7, 1.5), (-0.2, 1.75), (0.35, 1.6), (0.8, 1.35), (-0.45, 1.2), (0.6, 1.05)):
            o.append((x, y, -0.2, P, P, P, 'star2', True))
    elif key == 'starlight':
        for i in range(12):
            a = math.radians(25 + i * 130 / 11)
            r = 0.7 + 0.35 * ((i * 3) % 4) / 3
            x, y = r * math.cos(a), 0.45 + r * math.sin(a)
            sprite(o, STAR if i % 3 else STAR5, x, y, ((i % 3) - 1) * 0.1, 'star' if i % 3 else 'star2', True)
            for t in (1, 2, 3):
                o.append((x - 0.2 * math.cos(a) * t / 3 * 1.6, y - 0.2 * math.sin(a) * t / 3 * 1.6 - 0.09, ((i % 3) - 1) * 0.1, P, P, P, 'star', True))
    elif key == 'ember':
        for i in range(20):
            a = math.radians(50 + i * 80 / 19)
            r = 0.4 + 0.75 * ((i * 7) % 6) / 5
            x, y, z = r * math.cos(a) * 1.3, 0.3 + r * math.sin(a), ((i % 3) - 1) * 0.1
            o.append((x, y, z, P, P, P, 'em1', True))
            o.append((x - 0.02 * math.cos(a), y - P, z, P, P, P, 'em2', True))
            o.append((x - 0.04 * math.cos(a), y - 2 * P, z, P, P, P, 'em3', False))
            o.append((x - 0.06 * math.cos(a), y - 3 * P, z, P, P, P, 'em3', False))
    elif key == 'bubblegum':
        for (cx, cy, r) in ((-0.38, 0.72, 4), (0.30, 1.00, 3), (0.02, 0.42, 3)):
            v = Vox()
            v.fill(((-r, r), (-r, r), (-r, r)), lambda x, y, z: x * x + y * y + z * z <= r * r, lambda x, y, z: 'gumd' if y < -r * 0.45 else 'gum')
            for (x0, y0, z0, x1, y1, z1, c, _) in v.boxes():
                o.append((cx + x0 * P, cy + y0 * P, z0 * P, (x1 - x0) * P, (y1 - y0) * P, (z1 - z0) * P, c, False))
            o.append((cx - r * 0.5 * P, cy + r * 0.35 * P, r * P, 2 * P, 2 * P, P, 'white', False))
        for i in range(6):
            a = math.radians(i * 60 + 15)
            o.append((0.95 * math.cos(a), 0.7 + 0.6 * math.sin(a), 0, 2 * P, 2 * P, P, 'gum', False))
    elif key == 'solstice':
        v = Vox()
        v.fill(((-5, 5), (-5, 5), (-1, 0)), lambda x, y, z: x * x + y * y <= 25, lambda x, y, z: 'sun2' if x * x + y * y <= 8 else 'sun')
        for (x0, y0, z0, x1, y1, z1, c, _) in v.boxes():
            o.append((x0 * P, 0.85 + y0 * P, z0 * P, (x1 - x0) * P, (y1 - y0) * P, (z1 - z0) * P, c, True))
        for i in range(12):
            a = math.radians(i * 30 + 15)
            line(o, 0.32 * math.cos(a), 0.85 + 0.32 * math.sin(a), 0, a, 5 if i % 2 == 0 else 3, 'sun3' if i % 2 else 'sun', True)
    return o


def place(sc, key, X, Y, Z, scale=1.0, flat=None, spread=None):
    """scale: the whole burst. spread: positions only, pieces keep their size, so a burst shown small in the Trading Post
    still shows the one 0.05 m grain (VOXEL_GRAIN.md, rule 5). Positions shrink toward the burst's middle, 0.6 m up."""
    for (x, y, z, w, h, d, c, lit) in pieces(key):
        col = flat or C[c]
        if spread is not None:
            cx, cy, cz = x + w / 2, y + h / 2, z + d / 2
            nx, ny, nz = cx * spread, 0.6 * spread + (cy - 0.6) * spread, cz * spread
            x, y, z = nx - w / 2, ny - h / 2, nz - d / 2
            sc.box(X + x, Y + y, Z + z, X + x + w, Y + y + h, Z + z + d, col, bool(flat) or lit or c in LIT, 1.0)
            continue
        sc.box(X + x * scale, Y + y * scale, Z + z * scale, X + (x + w) * scale, Y + (y + h) * scale, Z + (z + d) * scale, col, bool(flat) or lit or c in LIT, 1.0)


def stand(sc, X, Y, Z, scale=1.0, tint=1.0):
    """The little display stand a burst is shown on in the Trading Post: a dark disc with a brass rim, on the 0.05 m grain."""
    for (hw, y0, y1, c) in ((0.20, 0.0, 0.05, tok('brass:-1')), (0.15, 0.05, 0.10, tok('iron:0')), (0.05, 0.10, 0.15, tok('iron:1'))):
        sc.box(X - hw * scale, Y + y0 * scale, Z - hw * scale, X + hw * scale, Y + y1 * scale, Z + hw * scale, c, False, tint)

"""Models for world 2 (the farm lifts off) and world 3 (under the quilt), the gates, the sky."""
import math

from kit import Model, ball, octagon, disc_rows

M = 0.1
S = 0.05
QUILT = ['scarfRed:0', 'coopYellow:0', 'giftGreen:0', 'trimWhite:0', 'slate:0']   # the five colours of Home's clothesline quilts
CREAM = 3
COLOURED = [0, 1, 2, 4]


def quilt_index(ix, iz):
    """Which of the five colours a square takes. Every second square is cream, so no two strong colours touch."""
    if (ix + iz) % 2 == 0:
        return CREAM
    return COLOURED[((ix + 3 * iz) // 2) % 4]


# ---------------------------------------------------------------- world 2

def _icicle(m, x, y_top, z, length, part='ice'):
    m.b(x, y_top - length + 1, z, x + 1, y_top, z + 1, 'ice:1', 'icicle', part)
    m.b(x, y_top - length, z, x + 1, y_top - length + 1, z + 1, 'ice:2', 'icicle tip', part)


def island(id, w, d, what, original):
    """A diorama base, floating: a snow top, two soil rows, stone rows stepping in, icicles, roots, stones.
    w, d in cells (0.1 m). Its top is at y 0, so whatever stood on the ground stands on it unchanged."""
    m = Model(id, M, what, original, 'M (rows are 0.5 m and 0.6 m thick, as the L step asks of land)')
    hx, hz = w // 2, d // 2
    m.b(-hx, -3, -hz, hx, 0, hz, 'snow:0', 'snow top')
    m.b(-hx + 2, -8, -hz + 2, hx - 2, -3, hz - 2, 'darkWood:0', 'soil, row 1')
    m.b(-hx + 5, -14, -hz + 4, hx - 5, -8, hz - 4, 'darkWood:-1', 'soil, row 2')
    inset, y = 10, -14
    k = 0
    while hx - inset >= 4 and hz - inset * 0.7 >= 3 and k < 5:
        iz = int(inset * 0.7)
        m.b(-hx + inset, y - 7, -hz + iz, hx - inset, y, hz - iz, f'stone:{-1 if k % 2 == 0 else -2}', f'stone, row {k + 1}')
        y -= 7
        inset += 7 + 2 * k
        k += 1
    # stones set in the soil's front face, at fixed places
    for i, x in enumerate(range(-hx + 8, hx - 10, 17)):
        yy = -7 if i % 2 == 0 else -12
        zz = hz - 2 if i % 2 == 0 else hz - 4
        m.b(x, yy, zz - 1, x + 4 + (i % 2), yy + 2, zz + 1, f'stone:{(0, 1)[i % 2]}', 'stone in the soil')
    # icicles under the snow's front lip, by a fixed rule: never random
    for x in range(-hx + 2, hx - 2):
        if (x * 7) % 11 < 2:
            _icicle(m, x, -3, hz - 1, 2 + (x * 5) % 4)
    # roots under the soil
    for i, x in enumerate(range(-hx + 12, hx - 12, 23)):
        L = 5 + (i * 3) % 5
        m.b(x, -14 - L, hz - 6, x + 1, -14, hz - 5, 'darkWood:1', 'root')
        m.b(x + 1, -14 - L + 2, hz - 6, x + 3, -14 - L + 3, hz - 5, 'darkWood:1', 'root, side shoot')
    return m


def lane_bay_2():
    m = Model('laneBayFloat', M, 'World 2: one 2.4 m bay of the floating track, 1.4 m thick, its underside in uneven teeth', 'The farm track of world 1, lifted', 'M')
    m.b(0, -3, -12, 24, 0, 12, 'snow:1', 'the track: snow top')
    m.b(0, -7, -11, 24, -3, 11, 'darkWood:0', 'soil, row 1')
    m.b(0, -10, -9, 24, -7, 9, 'darkWood:-1', 'soil, row 2')
    for (x0, x1, y0, z) in ((0, 5, -13, 7), (5, 9, -15, 6), (9, 15, -12, 7), (15, 19, -16, 5), (19, 24, -13, 6)):
        m.b(x0, y0, -z, x1, -10, z, f'stone:{-1 if (x0 // 5) % 2 == 0 else -2}', 'stone tooth')
    m.b(5, -6, 10, 9, -4, 12, 'stone:0', 'stone in the soil')
    m.b(15, -9, 8, 20, -7, 10, 'stone:1', 'stone in the soil')
    for x, L in ((2, 4), (8, 2), (13, 5), (19, 3), (22, 2)):
        _icicle(m, x, -3, 11, L)
    m.b(17, -19, 4, 18, -10, 5, 'darkWood:1', 'root')
    m.b(18, -16, 4, 20, -15, 5, 'darkWood:1', 'root, side shoot')
    return m


def clod(id, w, d, h, what):
    m = Model(id, M, what, 'A piece of the farm\'s ground that broke off at lift-off', 'M')
    hx, hz = w // 2, d // 2
    m.b(-hx, -2, -hz, hx, 0, hz, 'snow:0', 'snow top')
    m.b(-hx + 1, -2 - h // 2, -hz + 1, hx - 1, -2, hz - 1, 'darkWood:-1', 'soil')
    m.b(-hx + 3, -2 - h, -hz + 2, hx - 3, -2 - h // 2, hz - 2, 'stone:-2', 'stone')
    _icicle(m, -hx + 2, -2, hz - 1, 3)
    _icicle(m, hx - 3, -2, hz - 1, 2)
    return m


def moon(id, r, crescent, what):
    """A flat voxel moon, two cells thick, facing the camera. Cells here are 1 m: it hangs 420 m away."""
    m = Model(id, 1.0, what, 'The moon in the bedroom\'s far window', 'sky (1 m cells, far away)')
    rows = disc_rows(r)
    cut = disc_rows(r - 1)
    for j, hw in enumerate(rows):
        y = j - r
        x0, x1 = -hw, hw
        if crescent:
            # take away a disc of radius r - 1 whose middle is 7 cells right and 3 up
            yy = y - 3
            if -(r - 1) <= yy < (r - 1):
                c = cut[yy + r - 1]
                x1 = min(x1, 7 - c)
        if x1 > x0:
            m.b(x0, y, 0, x1, y + 1, 2, 'glow:moon', 'moon')
    if not crescent:
        for (cx, cy, cr) in ((-int(r * 0.35), int(r * 0.3), max(2, r // 5)), (int(r * 0.3), -int(r * 0.35), max(1, r // 7)), (int(r * 0.1), int(r * 0.55), max(1, r // 9))):
            for j, hw in enumerate(disc_rows(cr)):
                m.b(cx - hw, cy + j - cr, 2, cx + hw, cy + j - cr + 1, 3, 'glow:moonDim', 'crater')
    m.light(0, 0, 3, 'glow:moon', r * 2.6, 0.22, 'moon halo')
    return m


# ---------------------------------------------------------------- world 3

def quilt_patch(i):
    """One quilt square, 2 m x 0.4 m x 2 m: a base and a raised middle, so each square reads as padded."""
    c = QUILT[i % 5]
    mat, _, st = c.partition(':')
    m = Model(f'quiltPatch{i % 5}', M, f'A quilt square in {mat}', 'The patchwork quilt on his bed (the five colours of Home\'s clothesline quilts)', 'M')
    m.b(-10, 0, -10, 10, 3, 10, f'{mat}:-1', 'square, base')
    m.b(-9, 3, -9, 9, 4, 9, f'{mat}:0', 'square, padding')
    m.b(-6, 4, -6, 6, 5, 6, f'{mat}:1', 'square, padding, top')
    for x in (-10, 9):
        for z in (-10, 9):
            m.b(x, 3, z, x + 1, 4, z + 1, 'trimWhite:1', 'corner stitch')
    return m


def quilt_patch_far(i):
    """The same square for the rows far from the track: two boxes, no stitches."""
    c = QUILT[i % 5]
    mat = c.partition(':')[0]
    m = Model(f'quiltPatchFar{i % 5}', M, f'A quilt square in {mat}, for the far rows', 'The patchwork quilt on his bed', 'M')
    m.b(-10, 0, -10, 10, 3, 10, f'{mat}:-1', 'square, base')
    m.b(-8, 3, -8, 8, 5, 8, f'{mat}:0', 'square, padding')
    return m


def pillow(id, w, h, d, cell=M, step='M'):
    m = Model(id, cell, 'A pillow' + (', as big as a hill' if cell > M else ''), 'The pillow under his head', step)
    hx, hz = w // 2, d // 2
    e = max(1, w // 20)
    m.b(-hx + e, 0, -hz + e, hx - e, e, hz - e, 'trimWhite:0', 'underside')
    m.b(-hx, e, -hz, hx, h - 2 * e, hz, 'trimWhite:1', 'body')
    m.b(-hx + 2 * e, h - 2 * e, -hz + e, hx - 2 * e, h - e, hz - e, 'trimWhite:2', 'top, row 1')
    m.b(-hx + 4 * e, h - e, -hz + 2 * e, hx - 4 * e, h, hz - 2 * e, 'snow:1', 'top, row 2')
    m.b(-hx - 1, h // 2 - 1, -hz - 1, hx + 1, h // 2, hz + 1, 'trimWhite:-1', 'seam')
    for sx in (-1, 1):
        x = -hx - e if sx < 0 else hx
        m.b(x, h // 2 - e, hz - e, x + e, h // 2 + e, hz + 1, 'trimWhite:0', 'corner ear')
    return m


def candle():
    m = Model('candle', M, 'His candle, as tall as a lighthouse, in its brass dish', 'The candle on his nightstand', 'M')
    octagon(m, 16, 0, 2, 'brass:-1', 'dish')
    octagon(m, 18, 2, 4, 'brass:0', 'dish rim')
    m.b(16, 3, -2, 24, 5, 2, 'brass:0', 'dish handle')
    m.b(22, 5, -2, 24, 9, 2, 'brass:0', 'dish handle, ring')
    octagon(m, 7, 2, 58, 'trimWhite:1', 'candle')
    octagon(m, 8, 54, 58, 'trimWhite:2', 'melted rim')
    for (x, z, L) in ((-8, 2, 9), (5, 7, 13), (7, -3, 6), (-3, 7, 5)):
        m.b(x, 54 - L, z, x + 2, 54, z + 2, 'trimWhite:2', 'wax drip')
    m.b(-1, 58, -1, 1, 61, 1, 'ink:0', 'wick')
    m.b(-2, 61, -2, 2, 66, 2, 'glow:flame', 'flame')
    m.b(-1, 66, -1, 1, 69, 1, 'glow:flame', 'flame tip')
    m.b(-1, 61, -1, 1, 63, 3, 'glow:ember', 'flame heart')
    m.light(0, 64, 2, 'glow:lit', 11.0, 0.85, 'candle flame')
    return m


def yarn_ball():
    m = Model('yarnBall', M, 'A ball of his red yarn, 1.6 m across, with a loose end', 'The red yarn in his knitting basket (the yarn of the loading screen)', 'M')

    def col(dx, dy, dz):
        return f'scarfRed:{((dy + dz) // 2) % 3 - 1}'
    ball(m, 0, 8, 0, 8, col, 'yarn')
    m.b(8, 0, 2, 22, 1, 3, 'scarfRed:0', 'loose end')
    m.b(21, 0, 3, 22, 1, 9, 'scarfRed:0', 'loose end, turn')
    m.notes.append('In the game the ball is its own mesh and rolls: it turns about its middle (y 8 cells) as it moves.')
    return m


def needles():
    m = Model('needles', M, 'Two knitting needles stuck in the quilt, crossed', 'The needles in his knitting basket', 'M')
    for sgn in (-1, 1):
        for i in range(20):
            x = sgn * (-10 + i) if sgn > 0 else (10 - i)
            m.b(min(x, x + sgn), i * 2, -1 + (0 if sgn > 0 else 1), max(x, x + sgn) + 1, i * 2 + 2, (0 if sgn > 0 else 1) + 1, 'brass:0', 'needle')
        tx = sgn * 10
        m.b(tx - 1, 40, -2, tx + 3, 43, 2, 'trimWhite:1', 'needle knob')
    return m


def spool():
    m = Model('spool', M, 'A spool of thread, 1.7 m tall', 'The spool of thread in his knitting basket', 'M')
    octagon(m, 8, 0, 2, 'wood:1', 'spool end')
    for i, y in enumerate(range(2, 15, 2)):
        octagon(m, 6, y, min(y + 2, 15), f'slate:{0 if i % 2 == 0 else 1}', 'thread')
    octagon(m, 8, 15, 17, 'wood:1', 'spool end')
    m.b(-2, 17, -2, 2, 18, 2, 'darkWood:0', 'spool hole')
    m.b(6, 9, 3, 7, 10, 12, 'slate:1', 'thread end')
    return m


def button(id, mat):
    m = Model(id, M, f'A nightshirt button ({mat}) on a thread: a star of world 3', 'The three buttons on his nightshirt', 'M')
    outer, inner = disc_rows(4), disc_rows(3)
    for j, hw in enumerate(outer):
        y = j - 4
        iw = inner[j - 1] if 1 <= j <= 6 else 0
        if iw:
            m.b(-hw, y, 0, -iw, y + 1, 2, f'{mat}:1', 'rim')
            m.b(iw, y, 0, hw, y + 1, 2, f'{mat}:1', 'rim')
            m.b(-iw, y, 0, iw, y + 1, 1, f'{mat}:-1', 'face')
        else:
            m.b(-hw, y, 0, hw, y + 1, 2, f'{mat}:1', 'rim')
    for (x, y) in ((-2, 0), (1, 0), (-2, -2), (1, -2)):
        m.b(x, y, 1, x + 1, y + 1, 2, 'ink:1', 'hole')
    m.notes.append("The thread is one more box, 1 cell wide, trimWhite:-2, from the button's top up out of the picture.")
    return m


def bedpost():
    m = Model('bedpost', M, 'A bedpost with its ball, 6.4 m tall', 'The posts of his bed', 'M')
    m.b(-5, 0, -5, 5, 8, 5, 'darkWood:0', 'foot block')
    m.b(-4, 8, -4, 4, 10, 4, 'darkWood:1', 'foot collar')
    octagon(m, 3, 10, 48, 'darkWood:0', 'shaft')
    octagon(m, 4, 24, 27, 'darkWood:1', 'ring')
    octagon(m, 5, 48, 51, 'darkWood:1', 'neck collar')
    ball(m, 0, 57, 0, 6, lambda dx, dy, dz: 'darkWood:1' if dy > 1 else 'darkWood:0', 'ball')
    return m


def gate_bed(id, tall, what, original, head=False):
    """A bed end standing along the far side of the track, just behind it: two posts with balls, 6 m apart,
    the rail and the carved board between them. The sheep runs past it."""
    m = Model(id, M, what, original, 'M')
    top = tall
    for x in (-33, 27):
        m.b(x, 0, -3, x + 6, top, 3, 'darkWood:0', 'post')
        m.b(x - 1, 0, -4, x + 7, 3, 4, 'darkWood:-1', 'post foot')
        m.b(x - 1, top, -4, x + 7, top + 2, 4, 'darkWood:1', 'post collar')
        ball(m, x + 3, top + 7, 0, 5, lambda dx, dy, dz: 'darkWood:1' if dy > 0 else 'darkWood:0', 'post ball')
    m.b(-27, top - 8, -2, 27, top - 4, 2, 'darkWood:1', 'top rail')
    m.b(-27, 8, -1, 27, top - 8, 1, 'darkWood:0', 'board')
    m.b(-27, 5, -2, 27, 8, 2, 'darkWood:1', 'bottom rail')
    for x0 in (-24, -7, 10):
        m.b(x0, 11, 1, x0 + 14, top - 11, 2, 'darkWood:-1', 'board panel')
        m.b(x0 + 2, 13, 2, x0 + 12, top - 13, 3, 'darkWood:0', 'board panel, raised middle')
    # his stocking hangs on the left post, facing the camera
    m.b(-32, top - 9, 3, -28, top - 7, 4, 'trimWhite:1', 'stocking cuff')
    m.b(-32, top - 17, 3, -28, top - 9, 4, 'scarfRed:0', 'stocking')
    m.b(-32, top - 19, 3, -25, top - 16, 4, 'scarfRed:-1', 'stocking foot')
    if head:
        cols = ['glow:bulbRed', 'glow:bulbSage', 'glow:bulbGold']
        m.b(-27, top - 4, 2, 27, top - 3, 3, 'fir:0', 'garland', season=True)
        for i, x in enumerate(range(-24, 26, 6)):
            y = top - 5 - (1 if i % 2 else 0)
            m.b(x, y, 2, x + 1, y + 1, 3, cols[i % 3], 'garland bulb', season=True)
            m.light(x + 0.5, y + 0.5, 3, cols[i % 3], 0.5, 0.4, 'garland bulb')
    m.notes.append('It stands at z -1.9 m: behind the far bank of the track, so the sheep runs in front of it.')
    return m


def lane_bay_3(i):
    c1, c2 = QUILT[COLOURED[i % 4]], QUILT[COLOURED[(i + 2) % 4]]
    cols = [[c1, QUILT[CREAM]], [QUILT[CREAM], c2]]
    m = Model(f'laneBayBed{i % 4}', M, "World 3: one 2.4 m bay of the track: the turned-down sheet, the quilt hanging over the bed's side, the mattress under it", 'His bed, made: sheet, quilt, mattress', 'M')
    m.b(0, -2, -12, 24, 0, 12, 'trimWhite:2', 'the track: the sheet')
    m.b(0, -3, 11, 24, -2, 13, 'trimWhite:0', 'sheet hem')
    for x in range(1, 24, 3):
        m.b(x, -3, 13, x + 1, -1, 14, 'scarfRed:0', 'blanket stitch')
    for row in range(2):
        for j in range(2):
            mat = cols[row][j].partition(':')[0]
            y1 = -3 - row * 8
            m.b(j * 12, y1 - 8, -11, j * 12 + 12, y1, 12, f'{mat}:-1', 'quilt square, hanging', 'hang')
            m.b(j * 12 + 1, y1 - 7, 12, j * 12 + 11, y1 - 1, 13, f'{mat}:0', 'quilt square, padding', 'hang')
    m.b(0, -20, 11, 24, -19, 13, 'trimWhite:0', 'quilt hem', 'hang')
    m.b(0, -30, -10, 24, -20, 11, 'houseCream:1', 'mattress', 'hang')
    for x in range(2, 24, 6):
        m.b(x, -30, 11, x + 1, -20, 12, 'slate:0', 'mattress stripe', 'hang')
    m.notes.append('Part "hang" (everything under the sheet) takes the tint 0.55, so the sheet stays the brightest band.')
    return m


def feather():
    m = Model('feather', S, 'A pillow feather, 0.5 m long', 'His pillow', 'S')
    m.b(-5, 0, 0, 5, 1, 1, 'trimWhite:-1', 'quill')
    m.b(-4, 1, 0, 3, 2, 1, 'trimWhite:2', 'vane')
    m.b(-3, -1, 0, 4, 0, 1, 'trimWhite:1', 'vane')
    m.b(-2, 2, 0, 1, 3, 1, 'trimWhite:2', 'vane tip')
    return m


def all_models():
    out = [
        island('islandBarn', 124, 76, 'World 2: the island the barn and silo ride on', 'The ground under Home\'s barn'),
        island('islandHouse', 84, 70, 'World 2: the island the farmhouse rides on', 'The ground under Home\'s farmhouse'),
        island('islandMill', 44, 40, 'World 2: the island the windmill rides on', 'The windmill\'s hill'),
        island('islandYard', 60, 34, 'World 2: an island for the scarecrow, the bales or the coop', 'A piece of the farmyard'),
        lane_bay_2(),
        clod('clodSmall', 16, 12, 8, 'World 2: a small floating clod, for a pine or for the foreground'),
        clod('clodWide', 30, 14, 10, 'World 2: a wide floating clod, for a fence bay'),
        moon('moonCrescent', 16, True, 'The crescent moon of world 1'),
        moon('moonFull', 16, False, 'The full moon of worlds 2 and 3 (scaled up for world 3 and the moon show)'),
    ]
    out += [quilt_patch(i) for i in range(5)] + [quilt_patch_far(i) for i in range(5)]
    out += [candle(), yarn_ball(), needles(), spool(),
            button('buttonBrass', 'brass'), button('buttonCream', 'trimWhite'), button('buttonRed', 'scarfRed'),
            bedpost(),
            gate_bed('gateFootboard', 34, 'Gate 2: the foot of his bed, 6.6 m long, standing behind the track', 'The footboard of his bed, with its two posts'),
            gate_bed('gateHeadboard', 44, 'Gate 3: the head of his bed, taller, with his stocking and the garland', 'The headboard of his bed, with his stocking and the garland of bulbs', head=True)]
    out += [lane_bay_3(i) for i in range(4)]
    out += [feather()]
    return out

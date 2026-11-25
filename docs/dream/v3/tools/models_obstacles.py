"""What the sheep jumps, the signpost, and a stand-in sheep for the pictures.

Every obstacle here is drawn at one nominal size: 0.70 m wide, 1.05 m tall, 0.60 m deep (14 x 21 x 12
cells of 0.05 m). The game's rules box decides the real width and height (file 04, section 6)."""
from kit import Model, ball, octagon, disc_rows

S = 0.05


def _lanterns(m, y, z=6):
    """The two small lanterns every obstacle carries: dim until the word is taken, then lit."""
    for x in (-10, 8):
        m.b(x, y, z - 1, x + 2, y + 1, z + 1, 'iron:0', 'lantern foot', 'lanterns')
        m.b(x, y + 1, z - 1, x + 2, y + 4, z + 1, 'glow:lit', 'lantern glass', 'lanterns')
        m.b(x - 1, y + 4, z - 2, x + 3, y + 5, z + 2, 'iron:-1', 'lantern cap', 'lanterns')
        m.b(x, y + 5, z - 1, x + 2, y + 6, z + 1, 'snow:1', 'snow on the lantern', 'lanterns')
        m.light(x + 1, y + 2.5, z + 1.5, 'glow:lit', 0.55, 0.55, 'obstacle lantern')


def ob_gate():
    m = Model('obGate', S, 'A five-bar farm gate with a brace', "Home's pen gates", 'S')
    for x in (-7, 5):
        m.b(x, 0, -1, x + 2, 21, 1, 'darkWood:-1', 'gate post')
        m.b(x - 1, 21, -2, x + 3, 22, 2, 'snow:1', 'snow cap')
    for i, y in enumerate((2, 6, 10, 14, 18)):
        m.b(-5, y, 0, 5, y + 2, 1, f'wood:{(0, 1)[i % 2]}', 'bar')
    for i in range(10):
        m.b(-5 + i, 2 + int(i * 1.6), 1, -4 + i, 4 + int(i * 1.6), 2, 'wood:-1', 'brace')
    m.b(-8, 0, 1, 8, 1, 4, 'snow:1', 'snow at the foot')
    m.b(-5, 1, 1, 0, 2, 3, 'snow:1', 'snow at the foot, top')
    _lanterns(m, 14, 2)
    return m


def ob_planks():
    m = Model('obPlanks', S, 'A plank fence panel: five pointed planks on two rails', "Home's plank fences", 'S')
    for i, x in enumerate(range(-7, 7, 3)):
        m.b(x, 0, 0, x + 2, 19, 1, f'wood:{(0, -1, 0, 1, 0)[i]}', 'plank')
        m.b(x, 19, 0, x + 2, 20, 1, 'snow:1', 'snow on the plank')
        m.b(x, 20, 0, x + 1, 21, 1, 'snow:2', 'snow on the plank, tip')
    m.b(-7, 5, -1, 7, 7, 0, 'darkWood:0', 'back rail')
    m.b(-7, 13, -1, 7, 15, 0, 'darkWood:0', 'back rail')
    m.b(-8, 0, 1, 8, 1, 4, 'snow:1', 'snow at the foot')
    m.b(1, 1, 1, 6, 2, 3, 'snow:1', 'snow at the foot, top')
    _lanterns(m, 13, 2)
    return m


def ob_brick():
    m = Model('obBrick', S, 'A brick gatepost with a stone cap', "The farmhouse's brick chimney", 'S')
    m.b(-6, 0, -5, 6, 18, 5, 'trimWhite:-2', 'mortar')
    for course in range(6):
        y = course * 3
        off = 0 if course % 2 == 0 else -3
        for x in range(-6 + off, 6, 6):
            x0, x1 = max(x, -6), min(x + 5, 6)
            if x1 > x0:
                m.b(x0, y, 5, x1, y + 2, 6, f'barnRed:{(0, -1, 1)[(course + x) % 3]}', 'brick, front')
        for z in range(-5 + off, 5, 6):
            z0, z1 = max(z, -5), min(z + 5, 5)
            if z1 > z0:
                m.b(-7, y, z0, -6, y + 2, z1, f'barnRed:{(0, -1, 1)[(course + z) % 3]}', 'brick, left')
                m.b(6, y, z0, 7, y + 2, z1, f'barnRed:{(-1, 0, 1)[(course + z) % 3]}', 'brick, right')
    m.b(-8, 18, -7, 8, 20, 7, 'stone:1', 'cap stone')
    m.b(-7, 20, -6, 7, 21, 6, 'snow:1', 'snow on the cap')
    m.b(-4, 21, -3, 4, 22, 3, 'snow:2', 'snow on the cap, top')
    m.b(-9, 0, 6, 9, 1, 9, 'snow:1', 'snow at the foot')
    _lanterns(m, 12, 7)
    return m


def ob_logs():
    m = Model('obLogs', S, 'A log pile between two stakes, the cut ends showing', "Home's woodpile by the porch", 'S')
    for x in (-8, 7):
        m.b(x, 0, -1, x + 1, 21, 1, 'darkWood:-1', 'stake')
    for row in range(5):
        n = 3 if row % 2 == 0 else 2
        x0 = -7 if n == 3 else -5
        for i in range(n):
            x = x0 + i * 5
            y = row * 4
            m.b(x, y, -6, x + 4, y + 4, 5, 'darkWood:0', 'log')
            m.b(x, y, 5, x + 4, y + 4, 6, 'wood:1', 'log end')
            m.b(x + 1, y + 1, 6, x + 3, y + 3, 7, 'wood:-1', 'log end, heart')
    m.b(-7, 20, -6, 8, 21, 6, 'snow:1', 'snow on the pile')
    m.b(-9, 0, 6, 9, 1, 9, 'snow:1', 'snow at the foot')
    _lanterns(m, 13, 2)
    return m


def ob_bales():
    m = Model('obBales', S, 'Three hay bales stacked, with straps', "Home's bale stack", 'S')
    for row in range(3):
        y = row * 7
        dx = (0, 1, -1)[row]
        m.b(-7 + dx, y, -6, 7 + dx, y + 7, 6, f'hay:{(0, -1, 0)[row]}', 'bale')
        m.b(-7 + dx, y + 6, -6, 7 + dx, y + 7, 6, 'hay:1', 'bale top')
        for sx in (-4, 2):
            m.b(sx + dx, y, -6, sx + dx + 1, y + 7, 7, 'hay:-2', 'strap')
    m.b(-8, 21, -6, 6, 22, 6, 'snow:1', 'snow on the bales')
    m.b(-9, 0, 6, 9, 1, 9, 'snow:1', 'snow at the foot')
    _lanterns(m, 13, 7)
    return m


def ob_crates():
    m = Model('obCrates', S, 'Two crates stacked, each with a frame and a brace', "Home's crates in the tool shed", 'S')
    for (x0, y0, w, h) in ((-7, 0, 14, 11), (-6, 11, 12, 9)):
        m.b(x0, y0, -6, x0 + w, y0 + h, 6, 'wood:0', 'crate')
        m.b(x0, y0, 6, x0 + w, y0 + 1, 7, 'wood:-1', 'crate frame')
        m.b(x0, y0 + h - 1, 6, x0 + w, y0 + h, 7, 'wood:-1', 'crate frame')
        m.b(x0, y0, 6, x0 + 1, y0 + h, 7, 'wood:-1', 'crate frame')
        m.b(x0 + w - 1, y0, 6, x0 + w, y0 + h, 7, 'wood:-1', 'crate frame')
        for i in range(1, h - 1):
            xx = x0 + 1 + int((i - 1) * (w - 3) / max(h - 3, 1))
            m.b(xx, y0 + i, 6, xx + 1, y0 + i + 1, 7, 'wood:1', 'crate brace')
    m.b(-6, 20, -6, 6, 21, 6, 'snow:1', 'snow on the crates')
    m.b(-9, 0, 6, 9, 1, 9, 'snow:1', 'snow at the foot')
    _lanterns(m, 13, 7)
    return m


def iced(base, id):
    """World 2's obstacles: the same thing, its snow turned to ice, with icicles under its top edge."""
    m = Model(id, S, base.what + ', iced over', base.original, 'S')
    s = base.size()
    for bx in base.boxes:
        b2 = dict(bx)
        if bx['c'].startswith('snow') and 'foot' not in bx['n']:
            b2['c'] = 'ice:1' if bx['c'].endswith(':1') else 'ice:2'
        if 'foot' in bx['n']:
            continue
        m.boxes.append(b2)
    m.lights = [dict(l) for l in base.lights]
    top = max(bx['b'][4] for bx in base.boxes if bx['part'] == 'body' and 'snow' not in bx['c']) 
    for x, L in ((-6, 4), (-2, 2), (1, 5), (5, 3)):
        m.b(x, top - L, 6, x + 1, top, 7, 'ice:1', 'icicle')
        m.b(x, top - L - 1, 6, x + 1, top - L, 7, 'ice:2', 'icicle tip')
    return m


def ob_books():
    m = Model('obBooks', S, 'Four of his books in a pile', 'The five books on his bedroom shelf', 'S')
    cols = ['scarfRed:0', 'coopYellow:-1', 'pine:-1', 'slate:-1']
    for i, c in enumerate(cols):
        y = i * 5
        dx = (0, 1, -1, 0)[i]
        mat = c.partition(':')[0]
        m.b(-7 + dx, y, -6, 7 + dx, y + 5, 6, c, 'book cover')
        m.b(-6 + dx, y + 1, 6, 7 + dx, y + 4, 7, 'trimWhite:1', 'pages')
        m.b(-7 + dx, y, 6, -5 + dx, y + 5, 7, f'{mat}:-2' if mat != 'slate' else 'slate:-2', 'spine')
        m.b(-3 + dx, y + 2, 7, 3 + dx, y + 3, 8, 'coopYellow:1', 'title line')
    m.b(-5, 20, -4, 5, 21, 4, 'trimWhite:2', 'a page lying on top')
    _lanterns(m, 13, 7)
    return m


def ob_pillows():
    m = Model('obPillows', S, 'Three pillows in a pile, each with its seam and two corner ears', 'The pillow under his head', 'S')
    for i in range(3):
        y = i * 7
        dx = (0, 1, -1)[i]
        m.b(-6 + dx, y, -6, 6 + dx, y + 7, 6, f'trimWhite:{(1, 0, 1)[i]}', 'pillow')
        m.b(-7 + dx, y + 1, -5, 7 + dx, y + 6, 5, f'trimWhite:{(1, 0, 1)[i]}', 'pillow, bulge')
        m.b(-7 + dx, y + 3, -6, 7 + dx, y + 4, 7, 'trimWhite:-1', 'seam')
        m.b(-8 + dx, y + 2, 5, -7 + dx, y + 5, 7, f'trimWhite:{(2, 1, 2)[i]}', 'corner ear')
        m.b(7 + dx, y + 2, 5, 8 + dx, y + 5, 7, f'trimWhite:{(2, 1, 2)[i]}', 'corner ear')
    _lanterns(m, 13, 7)
    return m


def ob_spools():
    m = Model('obSpools', S, 'Two spools of thread, one on the other', 'The spool of thread in his knitting basket', 'S')
    for i, mat in enumerate(('scarfRed', 'giftGreen')):
        y = i * 10 + (1 if i else 0)
        octagon(m, 7, y, y + 2, 'wood:1', 'spool end')
        for k in range(3):
            octagon(m, 5, y + 2 + 2 * k, y + 4 + 2 * k, f'{mat}:{(0, 1, 0)[k]}', 'thread')
        octagon(m, 7, y + 8, y + 10, 'wood:1', 'spool end')
    m.b(-2, 21, -2, 2, 22, 2, 'darkWood:0', 'spool hole')
    _lanterns(m, 13, 7)
    return m


def ob_clock():
    m = Model('obClock', S, 'His alarm clock: red, two brass bells, two feet', 'The alarm clock on his nightstand', 'S')
    m.b(-6, 0, -2, -3, 3, 2, 'brass:-1', 'foot')
    m.b(3, 0, -2, 6, 3, 2, 'brass:-1', 'foot')
    rows = disc_rows(7)
    for j, hw in enumerate(rows):
        m.b(-hw, 2 + j, -4, hw, 3 + j, 4, 'scarfRed:0', 'case')
    rows = disc_rows(5)
    for j, hw in enumerate(rows):
        m.b(-hw, 4 + j, 4, hw, 5 + j, 5, 'trimWhite:2', 'face')
    m.b(0, 9, 5, 1, 13, 6, 'ink:0', 'long hand')
    m.b(0, 9, 5, 3, 10, 6, 'ink:0', 'short hand')
    for x in (-7, 3):
        m.b(x, 15, -2, x + 4, 18, 2, 'brass:1', 'bell')
        m.b(x + 1, 18, -1, x + 3, 19, 1, 'brass:2', 'bell top')
    m.b(-1, 16, -1, 1, 20, 1, 'iron:1', 'hammer')
    m.b(-2, 20, -1, 2, 21, 1, 'iron:0', 'hammer head')
    _lanterns(m, 13, 5)
    return m


def signpost():
    m = Model('signpost', S, 'The post and arm the sign hangs from, 4.2 m tall. The board itself is interface (file 08)', "The dream's own signpost, as today, rebuilt in voxels", 'S')
    m.b(-1, 0, -1, 2, 84, 2, 'wood:-1', 'post')
    m.b(-3, 0, -3, 4, 2, 4, 'stone:0', 'post foot')
    m.b(-4, 2, -4, 5, 3, 5, 'snow:1', 'snow at the foot')
    m.b(-24, 80, 0, 4, 82, 2, 'wood:0', 'arm')
    m.b(-24, 82, 0, 4, 83, 2, 'snow:1', 'snow on the arm')
    m.b(-2, 84, -2, 3, 85, 3, 'snow:1', 'snow on the post')
    for i in range(5):
        m.b(-2 - i, 75 + i, 0, -1 - i, 76 + i, 2, 'wood:-1', 'arm brace')
    m.b(-22, 75, 2, -21, 80, 3, 'iron:0', 'chain')
    m.b(-6, 75, 2, -5, 80, 3, 'iron:0', 'chain')
    m.notes.append('Hang points for the board: the bottom ends of the two chains, at x -21.5 and -5.5, y 75, z 2.5 cells (3.75 m up).')
    m.notes.append("The post stands 0.45 m behind the lane's middle line (z -0.45 m), 0.62 m left of its obstacle's middle.")
    m.notes.append('The board hangs from 3.75 m down to about 2.45 m, so the jumping sheep (its back reaches about 2.0 m) passes under it.')
    return m


def sheep_standin():
    m = Model('sheepStandIn', 0.04, 'A stand-in sheep for the reference pictures only. The game\'s own sheep is not changed', 'none: not part of the plan', 'picture only')
    W = 'wool'
    m.b(-13, 9, -7, 11, 24, 7, f'{W}:0', 'wool')
    m.b(-12, 8, -6, 10, 25, 6, f'{W}:1', 'wool')
    m.b(-14, 11, -6, 12, 22, 6, f'{W}:0', 'wool')
    m.b(-11, 24, -5, 8, 26, 5, f'{W}:1', 'wool, top')
    for x in (-10, -6, 4, 8):
        m.b(x, 0, -4 if x in (-10, 4) else 2, x + 3, 9, -1 if x in (-10, 4) else 5, 'houseCream:-1', 'leg')
    m.b(10, 14, -5, 18, 24, 5, 'pink:0', 'head')
    m.b(9, 22, -5, 16, 26, 5, f'{W}:1', 'wool cap')
    m.b(16, 19, 5, 17, 21, 6, 'ink:0', 'eye')
    m.b(18, 15, -2, 19, 17, 2, 'pink:-1', 'nose')
    m.b(9, 20, 5, 12, 22, 7, 'pink:-1', 'ear')
    m.b(8, 26, -4, 16, 28, 4, 'scarfRed:0', 'hat')
    m.b(7, 28, -3, 14, 31, 3, 'scarfRed:0', 'hat')
    m.b(6, 31, -2, 11, 33, 2, 'scarfRed:1', 'hat')
    m.b(4, 32, -2, 7, 35, 2, 'snow:1', 'hat bobble')
    m.b(8, 25, -5, 17, 26, 5, 'snow:1', 'hat trim')
    m.b(-15, 16, -2, -13, 19, 2, f'{W}:1', 'tail')
    return m


def all_models():
    farm = [ob_gate(), ob_planks(), ob_brick(), ob_logs(), ob_bales(), ob_crates()]
    icy = [iced(b, b.id + 'Iced') for b in farm]
    bed = [ob_books(), ob_pillows(), ob_spools(), ob_clock()]
    return farm + icy + bed + [signpost()]

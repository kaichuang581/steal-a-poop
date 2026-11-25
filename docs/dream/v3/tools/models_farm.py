"""The farm's models for worlds 1 and 2. Every one is a small copy of something on Home's farm."""
from kit import Model, boards_x, boards_z, courses_y, octagon, PAT

M = 0.1    # the ladder's structure step
S = 0.05   # the ladder's prop step


def barn():
    m = Model('barn', M, 'The red barn with white X doors and a snowy stepped roof', "Home's barn", 'M')
    m.b(-36, 0, -25, 36, 32, 25, 'barnRed:-1', 'core')
    m.b(-37, 0, -26, 37, 3, 26, 'stone:-1', 'stone footing')
    boards_x(m, -36, 36, 3, 32, 25, 26, 'barnRed', name='front board')
    boards_z(m, 36, 37, 3, 32, -25, 25, 'barnRed', name='right side board')
    boards_z(m, -37, -36, 3, 32, -25, 25, 'barnRed', name='left side board')
    for k in range(5):                                   # the gable, stepped
        m.b(-30 + 6 * k, 32 + 4 * k, -25, 30 - 6 * k, 36 + 4 * k, 26, f'barnRed:{0 if k % 2 == 0 else -1}', 'gable row')
    for k in range(6):                                   # roof steps, their white edge, their snow
        for sgn in (-1, 1):
            x0, x1 = (-39 + 6 * k, -30 + 6 * k) if sgn < 0 else (30 - 6 * k, 39 - 6 * k)
            m.b(x0, 30 + 4 * k, -28, x1, 34 + 4 * k, 28, 'slate:0', 'roof step')
            m.b(x0, 30 + 4 * k, 28, x1, 34 + 4 * k, 29, 'trimWhite:0', 'roof edge board')
            sx0, sx1 = (x0 - 1, x0 + 6) if sgn < 0 else (x1 - 6, x1 + 1)
            if k == 5:
                continue
            m.b(sx0, 34 + 4 * k, -29, sx1, 36 + 4 * k, 30, 'snow:1', 'roof snow')
    m.b(-10, 54, -29, 10, 56, 30, 'snow:1', 'ridge snow')
    m.b(-6, 56, -27, 6, 57, 28, 'snow:2', 'ridge snow, top')
    for x in (-37, 35):
        m.b(x, 3, 25, x + 2, 32, 27, 'trimWhite:0', 'corner board')
    # the doors
    m.b(-12, 3, 26, 12, 25, 27, 'barnRed:-2', 'door leaves')
    m.b(-14, 25, 26, 14, 27, 28, 'trimWhite:0', 'door frame, top')
    m.b(-14, 3, 26, -12, 25, 28, 'trimWhite:0', 'door frame, left')
    m.b(12, 3, 26, 14, 25, 28, 'trimWhite:0', 'door frame, right')
    m.b(-1, 3, 26, 1, 25, 28, 'trimWhite:0', 'door frame, middle')
    for leaf in (-12, 1):
        for i in range(11):
            m.b(leaf + i, 3 + 2 * i, 27, min(leaf + i + 2, leaf + 11), 5 + 2 * i, 28, 'trimWhite:0', 'door X')
            m.b(leaf + i, 23 - 2 * i, 27, min(leaf + i + 2, leaf + 11), 25 - 2 * i, 28, 'trimWhite:0', 'door X')
    # the hayloft door
    m.b(-6, 35, 26, 6, 47, 27, 'trimWhite:0', 'loft frame')
    m.b(-5, 36, 27, 5, 46, 28, 'darkWood:-2', 'loft opening')
    m.b(-4, 36, 28, 4, 39, 29, 'hay:0', 'hay in the loft')
    m.b(-2, 39, 28, 2, 40, 29, 'hay:1', 'hay in the loft, top')
    # two wall lanterns
    for x in (-19, 17):
        m.b(x, 21, 26, x + 2, 22, 28, 'darkWood:-2', 'lantern cap')
        m.b(x, 18, 26, x + 2, 21, 28, 'glow:lit', 'lantern glass')
        m.b(x, 17, 26, x + 2, 18, 28, 'darkWood:-2', 'lantern foot')
        m.light(x + 1, 19.5, 28.5, 'glow:lit', 1.6, 0.42, 'wall lantern')
    # the season: a wreath and one string of bulbs along the roof's edge
    m.b(-3, 28, 27, 3, 29, 28, 'fir:0', 'wreath', season=True)
    m.b(-3, 33, 27, 3, 34, 28, 'fir:0', 'wreath', season=True)
    m.b(-4, 29, 27, -3, 33, 28, 'fir:0', 'wreath', season=True)
    m.b(3, 29, 27, 4, 33, 28, 'fir:0', 'wreath', season=True)
    m.b(-1, 28, 28, 1, 29, 29, 'scarfRed:1', 'wreath bow', season=True)
    cols = ['glow:bulbRed', 'glow:bulbSage', 'glow:bulbGold']
    n = 0
    for k in range(6):
        for sgn in (-1, 1):
            x = (-36 + 6 * k) if sgn < 0 else (35 - 6 * k)
            m.b(x, 29 + 4 * k, 29, x + 1, 30 + 4 * k, 30, cols[n % 3], 'roof bulb', season=True)
            n += 1
    return m


def silo():
    m = Model('silo', M, 'The grain silo with three hoops and a round snow cap', "Home's silo, beside the barn", 'M')
    octagon(m, 11, 0, 52, 'stone:0', 'wall')
    for y in (12, 26, 40):
        octagon(m, 12, y, y + 1, 'stone:-1', 'hoop')
    octagon(m, 12, 52, 54, 'slate:0', 'roof rim')
    octagon(m, 11, 54, 57, 'snow:1', 'snow cap, row 1')
    octagon(m, 8, 57, 60, 'snow:1', 'snow cap, row 2')
    octagon(m, 5, 60, 62, 'snow:2', 'snow cap, row 3')
    m.b(-1, 3, 11, 1, 52, 12, 'iron:1', 'ladder')
    for y in range(6, 52, 5):
        m.b(-2, y, 11, 2, y + 1, 12, 'iron:1', 'ladder rung')
    return m


def farmhouse():
    m = Model('farmhouse', M, 'The cream farmhouse; its left window is lit: the farmer\'s bedroom', "Home's farmhouse", 'M')
    m.b(-30, 0, -22, 30, 28, 22, 'houseCream:-1', 'core')
    m.b(-31, 0, -23, 31, 3, 23, 'houseCream:-2', 'footing')
    courses_y(m, -30, 30, 3, 28, 22, 23, 'houseCream', 4, (0, 1), 'front clapboard')
    courses_y(m, 30, 31, 3, 28, -22, 22, 'houseCream', 4, (0, 1), 'right clapboard')
    courses_y(m, -31, -30, 3, 28, -22, 22, 'houseCream', 4, (0, 1), 'left clapboard')
    for x in (-31, 29):
        m.b(x, 3, 22, x + 2, 28, 24, 'trimWhite:0', 'corner board')
    for k in range(6):                                  # the roof: its slope faces the camera
        z = 26 - 4 * k
        m.b(-33, 27 + 3 * k, -z, 33, 30 + 3 * k, z, 'roofBrown:0', 'roof step')
        m.b(-33, 27 + 3 * k, z, 33, 30 + 3 * k, z + 1, 'roofBrown:-1', 'roof step edge')
        if k < 5:
            m.b(-34, 30 + 3 * k, z - 4, 34, 32 + 3 * k, z + 1, 'snow:1', 'roof snow')
    m.b(-34, 45, -6, 34, 47, 7, 'snow:1', 'ridge snow')
    m.b(-30, 47, -3, 30, 48, 4, 'snow:2', 'ridge snow, top')
    # the chimney
    m.b(13, 30, -9, 20, 55, -2, 'barnRed:-1', 'brick chimney')
    for y in range(33, 55, 6):
        m.b(13, y, -2, 20, y + 1, -1, 'trimWhite:-2', 'chimney mortar line')
    m.b(12, 55, -10, 21, 57, -1, 'trimWhite:-2', 'chimney cap')
    m.b(13, 57, -9, 20, 58, -2, 'snow:1', 'chimney snow')
    # the door and its step
    m.b(-5, 3, 23, 5, 21, 24, 'trimWhite:0', 'door frame')
    m.b(-4, 3, 24, 4, 20, 25, 'darkWood:0', 'door')
    m.b(2, 11, 25, 3, 12, 26, 'trimWhite:2', 'door knob')
    m.b(-8, 0, 23, 8, 2, 31, 'darkWood:1', 'door step')
    m.b(-8, 2, 28, 8, 3, 31, 'snow:1', 'snow on the step')
    # windows: left is his bedroom, lit
    for x0, lit in ((-23, True), (11, False)):
        m.b(x0, 9, 23, x0 + 12, 23, 24, 'trimWhite:0', 'window frame')
        m.b(x0 + 1, 10, 24, x0 + 11, 22, 25, 'glow:lit' if lit else 'glass:0', 'bedroom window, lit' if lit else 'window glass')
        m.b(x0 + 5, 10, 25, x0 + 7, 22, 26, 'trimWhite:0', 'window bar, upright')
        m.b(x0 + 1, 15, 25, x0 + 11, 17, 26, 'trimWhite:0', 'window bar, level')
        m.b(x0 - 1, 8, 23, x0 + 13, 9, 26, 'trimWhite:1', 'window sill')
        m.b(x0, 9, 25, x0 + 12, 10, 26, 'snow:1', 'snow on the sill')
        m.b(x0 - 3, 9, 23, x0 - 1, 23, 24, 'roofBrown:1', 'shutter')
        m.b(x0 + 13, 9, 23, x0 + 15, 23, 24, 'roofBrown:1', 'shutter')
    m.light(-17, 16, 26, 'glow:lit', 3.4, 0.55, 'his bedroom window')
    # the season: a wreath on the door
    m.b(-2, 13, 25, 2, 14, 26, 'fir:0', 'wreath', season=True)
    m.b(-2, 17, 25, 2, 18, 26, 'fir:0', 'wreath', season=True)
    m.b(-3, 14, 25, -2, 17, 26, 'fir:0', 'wreath', season=True)
    m.b(2, 14, 25, 3, 17, 26, 'fir:0', 'wreath', season=True)
    m.b(-1, 13, 26, 1, 14, 27, 'scarfRed:1', 'wreath bow', season=True)
    return m


def windmill():
    m = Model('windmill', M, 'The windmill: a stone foot, a pale tower, a brown cap, four sails', "Home's windmill", 'M')
    m.b(-9, 0, -9, 9, 14, 9, 'stone:0', 'tower, foot')
    m.b(-8, 14, -8, 8, 28, 8, 'trimWhite:-1', 'tower, row 2')
    m.b(-7, 28, -7, 7, 42, 7, 'trimWhite:0', 'tower, row 3')
    m.b(-6, 42, -6, 6, 52, 6, 'trimWhite:-1', 'tower, row 4')
    m.b(-8, 52, -8, 8, 55, 8, 'roofBrown:0', 'cap, row 1')
    m.b(-6, 55, -6, 6, 58, 6, 'roofBrown:1', 'cap, row 2')
    m.b(-7, 55, -7, 7, 56, -5, 'snow:1', 'cap snow, back')
    m.b(-4, 58, -4, 4, 60, 4, 'snow:1', 'cap snow')
    m.b(-3, 3, 9, 3, 13, 10, 'darkWood:0', 'door')
    m.b(-2, 20, 8, 2, 25, 9, 'darkWood:-2', 'window')
    m.b(-2, 34, 7, 2, 38, 8, 'darkWood:-2', 'window, upper')
    m.b(-1, 47, 6, 1, 49, 11, 'darkWood:-1', 'axle')
    # four sails, shown upright; in the game they are one mesh turning about the axle (0, 48, z)
    P = 'sails'
    m.b(-1, 48, 10, 1, 74, 12, 'wood:-1', 'sail spar, up', P)
    m.b(1, 55, 10, 7, 74, 11, 'trimWhite:-1', 'sail, up', P)
    m.b(-1, 22, 10, 1, 48, 12, 'wood:-1', 'sail spar, down', P)
    m.b(-7, 22, 10, -1, 41, 11, 'trimWhite:-1', 'sail, down', P)
    m.b(0, 47, 10, 26, 49, 12, 'wood:-1', 'sail spar, right', P)
    m.b(7, 41, 10, 26, 47, 11, 'trimWhite:-1', 'sail, right', P)
    m.b(-26, 47, 10, 0, 49, 12, 'wood:-1', 'sail spar, left', P)
    m.b(-26, 49, 10, -7, 55, 11, 'trimWhite:-1', 'sail, left', P)
    for y in (59, 64, 69):
        m.b(1, y, 11, 7, y + 1, 12, 'wood:-1', 'sail bar, up', P)
    for y in (26, 31, 36):
        m.b(-7, y, 11, -1, y + 1, 12, 'wood:-1', 'sail bar, down', P)
    for x in (11, 16, 21):
        m.b(x, 41, 11, x + 1, 47, 12, 'wood:-1', 'sail bar, right', P)
    for x in (-22, -17, -12):
        m.b(x, 49, 11, x + 1, 55, 12, 'wood:-1', 'sail bar, left', P)
    m.notes.append('Part "sails" is its own mesh. It turns about the axle at x 0, y 48 cells.')
    return m


def coop():
    m = Model('coop', M, 'The yellow hen coop on legs, with its ramp', "Home's chicken coop", 'M')
    for x in (-11, 9):
        for z in (-7, 5):
            m.b(x, 0, z, x + 2, 6, z + 2, 'darkWood:0', 'leg')
    m.b(-12, 6, -8, 12, 18, 8, 'coopYellow:-1', 'core')
    boards_x(m, -12, 12, 6, 18, 8, 9, 'coopYellow', 4, PAT, 'front board')
    for k in range(3):
        m.b(-14, 18 + 2 * k, -10 + 5 * k, 14, 20 + 2 * k, 10, 'roofBrown:0', 'roof step')
    for k in range(3):
        m.b(-15, 20 + 2 * k, -10 + 5 * k, 15, 21 + 2 * k, (-5 + 5 * k) if k < 2 else 11, 'snow:1', 'roof snow')
    m.b(-15, 20, 5, 15, 21, 11, 'snow:1', 'roof snow, front')
    m.b(3, 7, 9, 9, 15, 10, 'darkWood:-2', 'hen door')
    m.b(2, 6, 9, 10, 7, 10, 'trimWhite:0', 'hen door sill')
    m.b(-9, 10, 9, -3, 15, 10, 'glass:0', 'nest window')
    m.b(-10, 9, 9, -2, 10, 10, 'trimWhite:0', 'nest window sill')
    for i in range(6):
        m.b(4, 5 - i, 10 + 2 * i, 8, 6 - i, 12 + 2 * i, 'darkWood:1', 'ramp step')
    return m


def scarecrow():
    m = Model('scarecrow', S, 'The scarecrow: a red coat, a straw head, a brown hat', "Home's scarecrow", 'S')
    m.b(-1, 0, -1, 1, 30, 1, 'darkWood:0', 'post')
    m.b(-13, 24, -1, 13, 26, 1, 'darkWood:0', 'arm pole')
    m.b(-5, 13, -2, 5, 28, 2, 'scarfRed:-1', 'coat')
    m.b(-6, 11, -2, 6, 13, 2, 'scarfRed:-2', 'coat hem')
    m.b(-12, 23, -2, -5, 27, 2, 'scarfRed:-1', 'sleeve')
    m.b(5, 23, -2, 12, 27, 2, 'scarfRed:-1', 'sleeve')
    m.b(-15, 23, -1, -12, 27, 1, 'straw:0', 'straw hand')
    m.b(12, 23, -1, 15, 27, 1, 'straw:0', 'straw hand')
    m.b(-1, 15, 2, 1, 16, 3, 'straw:1', 'button')
    m.b(-1, 20, 2, 1, 21, 3, 'straw:1', 'button')
    m.b(-5, 27, -3, 5, 29, 3, 'trimWhite:0', 'scarf')
    m.b(-4, 29, -3, 4, 37, 3, 'straw:1', 'head')
    m.b(-3, 33, 3, -1, 35, 4, 'ink:0', 'eye')
    m.b(1, 33, 3, 3, 35, 4, 'ink:0', 'eye')
    m.b(-1, 31, 3, 1, 32, 6, 'carrot:0', 'nose')
    m.b(-7, 37, -6, 7, 38, 6, 'darkWood:-1', 'hat brim')
    m.b(-4, 38, -4, 4, 43, 4, 'darkWood:0', 'hat crown')
    m.b(-4, 39, -4, 4, 40, 5, 'scarfRed:0', 'hat band')
    m.b(-4, 43, -4, 4, 44, 4, 'snow:1', 'snow on the hat')
    m.b(-12, 27, -2, -6, 28, 2, 'snow:1', 'snow on the arm')
    m.b(6, 27, -2, 12, 28, 2, 'snow:1', 'snow on the arm')
    return m


def _bale(m, x0, y0, z0, name='bale'):
    m.b(x0, y0, z0, x0 + 20, y0 + 12, z0 + 12, 'hay:0', name)
    for dx in (4, 14):
        m.b(x0 + dx, y0, z0, x0 + dx + 2, y0 + 12, z0 + 13, 'hay:-1', name + ' strap')
    m.b(x0, y0 + 11, z0, x0 + 20, y0 + 12, z0 + 12, 'hay:1', name + ' top')


def bale_stack():
    m = Model('baleStack', S, 'Three hay bales: two below, one on top, snow on them', "Home's bale stack", 'S')
    _bale(m, -21, 0, -6)
    _bale(m, 1, 0, -6)
    _bale(m, -10, 12, -6, 'top bale')
    m.b(-10, 24, -6, 10, 26, 6, 'snow:1', 'snow on the top bale')
    m.b(-21, 12, -6, -10, 13, 6, 'snow:1', 'snow on the shoulder')
    m.b(10, 12, -6, 21, 13, 6, 'snow:1', 'snow on the shoulder')
    return m


def pine(id, height_m, kind):
    """kind: 'spire' | 'cone' | 'round'. In the game, build these with tieredPine(height, genesFor(seed))."""
    m = Model(id, M, f'A {kind} pine, {height_m} m, with snow on each shelf', "Home's pines (tieredPine with genes)", 'M')
    H = int(round(height_m / M))
    tiers, width, profile = {'spire': (7, 0.19, 1.25), 'cone': (5, 0.23, 1.0), 'round': (4, 0.27, 0.8)}[kind]
    bare = max(2, int(round(H * 0.13)))
    R = max(2.0, H * width)
    m.b(-1, 0, -1, 1, bare + 2, 1, 'darkWood:0', 'trunk')
    th = (H - bare - 2) / tiers
    for k in range(tiers):
        r = max(1, int(round(R * max(0.0, 1 - k / (tiers + 0.6)) ** profile + 0.5)))
        y0, y1 = bare + int(round(k * th)), bare + int(round((k + 1) * th))
        tone = 0 if k % 2 == 0 else 1
        m.b(-r, y0, -r, r, y1 - 1, r, f'pine:{tone}', 'tier')
        m.b(-r, y1 - 1, -r, r, y1, r, 'snow:-1', 'snow shelf')
        if r > 2:
            m.b(-r + 1, y0 - 1, -r + 1, r - 1, y0, r - 1, f'pine:{tone - 1 if tone > -1 else -2}', 'tier, under')
    m.b(-1, H - 2, -1, 1, H, 1, 'pine:0', 'tip')
    m.b(-1, H, -1, 1, H + 1, 1, 'snow:1', 'snow tip')
    return m


def fence_bay():
    m = Model('fenceBay', S, 'One 2.4 m bay of the farm fence: a post, two rails, a snow cap, and the string of bulbs', "Home's plank fences, and the season's bulbs", 'S')
    m.b(-1, 0, -1, 2, 18, 2, 'darkWood:-1', 'post')
    m.b(-2, 18, -2, 3, 19, 3, 'snow:1', 'snow cap')
    m.b(2, 6, 0, 47, 8, 1, 'wood:0', 'lower rail')
    m.b(2, 13, 0, 47, 15, 1, 'wood:1', 'upper rail')
    m.b(2, 15, 0, 47, 16, 1, 'snow:0', 'snow on the upper rail')
    # the wire sags from 17 to 14 and back, in five level runs
    for (x0, x1, y) in ((2, 8, 16), (8, 16, 15), (16, 32, 14), (32, 40, 15), (40, 47, 16)):
        m.b(x0, y + 1, 1, x1, y + 2, 2, 'iron:0', 'wire', 'string')
    cols = ['glow:bulbRed', 'glow:bulbSage', 'glow:bulbGold']
    for i, (x, y) in enumerate(((11, 14), (23, 13), (35, 14))):
        m.b(x, y, 1, x + 2, y + 2, 3, cols[i], 'bulb', 'string')
        m.light(x + 1, y + 1, 3, cols[i], 0.42, 0.5, 'bulb')
    m.notes.append('Part "string" (wire and bulbs) is its own mesh: at the first gate the fence falls and the string stays.')
    m.notes.append('With FESTIVE false, all three bulbs take glow:lit.')
    return m


def wall_bay():
    m = Model('wallBay', M, 'One 2.4 m bay of dry-stone wall, two courses, snow on top', "Home's dry-stone wall along the lane", 'M')
    order = (0, -1, 1, 0, 1, -1)
    n = 0
    for course in range(2):
        off = 0 if course % 2 == 0 else -2
        for x in range(off, 24, 4):
            x0, x1 = max(x, 0), min(x + 4, 24)
            if x1 > x0:
                m.b(x0, course * 2, -2, x1, course * 2 + 2, 2, f'stone:{order[n % 6]}', 'stone')
            n += 1
    m.b(0, 4, -2, 24, 5, 2, 'snow:1', 'snow cap')
    m.b(3, 5, -1, 10, 6, 1, 'snow:1', 'snow lump')
    m.b(15, 5, -1, 20, 6, 1, 'snow:2', 'snow lump')
    return m


def pond():
    m = Model('pond', M, 'The frozen pond: ice, three streaks of snow, a stone rim, reeds', "Home's pond", 'M')
    m.b(-24, 0, -11, 24, 1, 11, 'ice:0', 'ice')
    m.b(-20, 0, -13, 20, 1, 13, 'ice:0', 'ice')
    for (x0, x1, z) in ((-2, 16, -6), (4, 20, 1), (-6, 10, 7)):
        m.b(x0, 1, z, x1, 2, z + 2, 'snow:1', 'snow streak')
    order = (0, -1, 1)
    n = 0
    for x in range(-24, 24, 4):
        for z in (-15, 13):
            if abs(x + 2) > 18:
                continue
            m.b(x, 0, z, x + 3, 2 + (n % 2), z + 2, f'stone:{order[n % 3]}', 'rim stone')
            n += 1
    for z in range(-11, 11, 4):
        for x in (-26, 24):
            m.b(x, 0, z, x + 2, 2 + (n % 2), z + 3, f'stone:{order[n % 3]}', 'rim stone')
            n += 1
    for (x, z, h) in ((-22, 9, 9), (-21, 11, 12), (-19, 10, 7), (21, -12, 10), (19, -13, 8)):
        m.b(x, 1, z, x + 1, h, z + 1, 'reed:0', 'reed')
        m.b(x, h, z, x + 1, h + 1, z + 1, 'snow:1', 'snow on the reed')
    return m


def gate_farm():
    m = Model('gateFarm', M, 'Gate 1: the farm gate as a small roofed gateway the sheep runs through', "Home's gate arch over the lane (posts, beam, the board with a sheep cut in it)", 'M')
    for x in (-12, 9):
        for z in (-17, 14):
            m.b(x, 0, z, x + 3, 30, z + 3, 'wood:-1', 'post')
            m.b(x - 1, 0, z - 1, x + 4, 2, z + 4, 'stone:0', 'post foot')
    for z in (-17, 14):
        m.b(-15, 30, z, 15, 33, z + 3, 'wood:0', 'beam along the lane')
    for x in (-12, 9):
        m.b(x, 30, -17, x + 3, 33, 17, 'wood:0', 'beam across the lane')
    for k in range(4):                                  # a small stepped roof, its ridge along the lane
        z = 20 - 5 * k
        m.b(-17, 33 + 3 * k, -z, 17, 36 + 3 * k, z, 'slate:0', 'roof step')
        m.b(-17, 33 + 3 * k, z, 17, 36 + 3 * k, z + 1, 'trimWhite:0', 'roof edge board')
        if k < 3:
            m.b(-18, 36 + 3 * k, z - 5, 18, 38 + 3 * k, z + 1, 'snow:1', 'roof snow')
    m.b(-18, 45, -6, 18, 47, 7, 'snow:1', 'ridge snow')
    # the board with the sheep, hung on two chains under the near beam, facing the camera
    m.b(-7, 27, 15, -6, 30, 16, 'iron:0', 'chain')
    m.b(6, 27, 15, 7, 30, 16, 'iron:0', 'chain')
    m.b(-9, 20, 15, 9, 27, 16, 'wood:1', 'board')
    sheep = ['..XXXX.', '.XXXXXX', 'XXXXXXX', '.X.X.X.']
    for r, row in enumerate(sheep):
        for c, ch in enumerate(row):
            if ch == 'X':
                m.b(-4 + c, 25 - r, 16, -3 + c, 26 - r, 17, 'trimWhite:0', 'sheep cut')
    for x in (-13, 12):                                 # a lantern on each near post
        m.b(x, 22, 17, x + 2, 23, 19, 'iron:0', 'lantern cap')
        m.b(x, 19, 17, x + 2, 22, 19, 'glow:lit', 'lantern glass')
        m.b(x, 18, 17, x + 2, 19, 19, 'iron:0', 'lantern foot')
        m.light(x + 1, 20.5, 19.5, 'glow:lit', 1.8, 0.5, 'gate lantern')
    m.notes.append('The gap between the near and far posts is 2.8 m; the track is 2.4 m. The sheep runs through at z 0.')
    return m


def shrub_mound():
    m = Model('shrubMound', M, 'A buried shrub: a snow mound in two tiers with five twig tips', "Home's buried shrubs (PLAN_DEPTH_AND_LIGHT 6.6)", 'M')
    m.b(-7, 0, -5, 7, 2, 5, 'snow:0', 'mound, tier 1')
    m.b(-4, 2, -3, 4, 3, 3, 'snow:1', 'mound, tier 2')
    for (x, z, h) in ((-3, 0, 3), (-1, -2, 4), (1, 1, 3), (3, -1, 2), (0, 2, 2)):
        m.b(x, 3 if abs(x) < 4 else 2, z, x + 1, 3 + h, z + 1, 'darkWood:0', 'twig tip')
    return m


def stump():
    m = Model('stump', S, 'A tree stump with a snow cap', "Home's stump west of the farmhouse (PLAN_DEPTH_AND_LIGHT 6.7)", 'S')
    m.b(-4, 0, -4, 4, 6, 4, 'darkWood:0', 'bark')
    m.b(-5, 0, -2, 5, 2, 2, 'darkWood:-1', 'root flare')
    m.b(-2, 0, -5, 2, 2, 5, 'darkWood:-1', 'root flare')
    m.b(-3, 6, -3, 3, 7, 3, 'wood:1', 'cut face')
    m.b(-3, 7, -3, 2, 8, 2, 'snow:1', 'snow cap')
    return m


def log():
    m = Model('log', S, 'A fallen log, 1.6 m, with a line of snow along it', "Home's log on the pond's east bank (PLAN_DEPTH_AND_LIGHT 6.7)", 'S')
    m.b(-16, 0, -2, 16, 5, 3, 'darkWood:0', 'bark')
    m.b(-17, 1, -1, -16, 4, 2, 'wood:1', 'cut end')
    m.b(16, 1, -1, 17, 4, 2, 'wood:1', 'cut end')
    m.b(-13, 5, -1, 12, 6, 2, 'snow:1', 'snow along the top')
    m.b(4, 5, 2, 6, 9, 3, 'darkWood:0', 'broken branch')
    return m


def snowman():
    m = Model('snowman', S, 'A small snowman: two balls, a carrot nose, a red scarf', "Home's snowman by the snow fort", 'S')
    m.b(-5, 0, -5, 5, 8, 5, 'snow:0', 'lower ball')
    m.b(-6, 2, -4, 6, 6, 4, 'snow:0', 'lower ball, bulge')
    m.b(-4, 8, -4, 4, 9, 4, 'scarfRed:0', 'scarf')
    m.b(2, 5, 4, 4, 9, 5, 'scarfRed:-1', 'scarf end')
    m.b(-4, 9, -4, 4, 15, 4, 'snow:1', 'upper ball')
    m.b(-2, 12, 4, -1, 13, 5, 'ink:0', 'eye')
    m.b(1, 12, 4, 2, 13, 5, 'ink:0', 'eye')
    m.b(-1, 10, 4, 1, 11, 7, 'carrot:0', 'nose')
    m.b(-8, 7, 0, -5, 8, 1, 'darkWood:0', 'stick arm')
    m.b(5, 8, 0, 9, 9, 1, 'darkWood:0', 'stick arm')
    return m


def all_models():
    return [barn(), silo(), farmhouse(), windmill(), coop(), scarecrow(), bale_stack(),
            pine('pineSpire', 4.6, 'spire'), pine('pineCone', 3.4, 'cone'), pine('pineRound', 2.4, 'round'),
            fence_bay(), wall_bay(), pond(), gate_farm(), shrub_mound(), stump(), log(), snowman()]

"""Practice's own models: the rink on the farm pond, the tally board, the bomb, the effects' pieces.
Every colour is a token of the game's LADDER or a named glow (ladder.py)."""
import math

from kit import Model, boards_x, courses_y, octagon, tile, PAT

M = 0.1     # structure step
S = 0.05    # prop step
D = 0.025   # detail step: the bomb and the whistle, which must stay round at their small size


# ---- the rink ------------------------------------------------------------------------------------

def rink_boards(id='rinkBoards', h=12, what='One 2.4 m bay of the rink boards around the swept pond, 0.6 m tall'):
    m = Model(id, S, what, "Home's plank fence, made solid and low, as boards round a farm rink", 'S')
    m.b(-1, 0, -2, 2, h + 2, 1, 'darkWood:-1', 'post')
    m.b(-2, h + 2, -3, 3, h + 3, 2, 'snow:1', 'snow cap on the post')
    tile(m, 2, 0, -1, 47, h, 0, 'wood', 0, long='x', across='y', L=12, W=4, name='board')
    m.b(2, h, -2, 47, h + 1, 1, 'trimWhite:0', 'cap rail')
    m.b(2, h + 1, -2, 47, h + 2, 1, 'snow:0', 'snow on the cap rail')
    m.b(2, 0, -2, 47, 1, -1, 'wood:-2', 'kick board')
    m.notes.append('Bays repeat every 2.4 m (48 cells): place one bay per 2.4 m, its post at the bay start.')
    m.notes.append('The board pattern runs 0, +1, -1 from the bottom, the same three courses in every bay: never random.')
    return m


def rink_boards_front():
    m = rink_boards('rinkBoardsFront', 6, 'One 2.4 m bay of the front boards, 0.3 m tall, so both sheep and the bomb show over them')
    return m


def snow_bank(id='snowBank', w=48, d=16):
    m = Model(id, S, 'The snow pushed off the pond when it was swept: a stepped bank, 2.4 m long', 'New: the sweeping that made the rink', 'S')
    steps = [(0, 4, -1), (2, 8, 0), (5, 11, 1), (8, 13, 2)]         # (inset from the front, top, step): four terraces, front lowest
    for i, (inset, top, st) in enumerate(steps):                  # each terrace one whole piece of snow, one step lighter than the one below
        m.b(0, 0, -d, w, top, -inset, f'snow:{st}', 'bank terrace %d' % (i + 1))
    for x in range(4, w, 12):                                     # shovel scoops: a notch every 0.6 m on the top terrace, the same each bay
        m.b(x, 12, -d, x + 4, 13, -8, 'snow:-1', 'shovel scoop')
    m.notes.append('One bay is 2.4 m long. Terraces step up away from the ice: 0.2, 0.4, 0.55, 0.65 m. Scoops: one 0.2 m notch every 0.6 m on the top terrace, in the same places in every bay.')
    return m


def broom():
    m = Model('broom', S, 'The broom that swept the ice, leaning on the boards', 'New: says how the rink was made', 'S')
    m.b(0, 0, 0, 1, 30, 1, 'wood:1', 'handle')
    m.b(-3, 0, -1, 4, 5, 2, 'straw:0', 'bristles')
    m.b(-3, 5, -1, 4, 6, 2, 'scarfRed:0', 'binding')
    m.b(-2, 6, -1, 3, 7, 2, 'straw:1', 'bristle top')
    m.notes.append('Leans at 14 degrees against the boards: rotate about its foot.')
    return m


# ---- the tally board -----------------------------------------------------------------------------

def tally_board():
    m = Model('tallyBoard', S, 'The chalkboard behind the rink: your count and tally marks in chalk, the letter card, the clock card', 'New: a green school chalkboard in a barn-red frame', 'S')
    for x in (-27, 25):
        m.b(x, 0, -1, x + 2, 58, 1, 'darkWood:-1', 'post')
        m.b(x - 1, 0, -2, x + 3, 2, 2, 'darkWood:-2', 'post foot')
        m.b(x - 2, 2, -3, x + 4, 3, 3, 'snow:1', 'snow at the foot')
    m.b(-26, 28, -1, 26, 30, 1, 'barnRed:-1', 'frame bottom')
    m.b(-26, 54, -1, 26, 56, 1, 'barnRed:-1', 'frame top')
    m.b(-26, 30, -1, -24, 54, 1, 'barnRed:-1', 'frame left')
    m.b(24, 30, -1, 26, 54, 1, 'barnRed:-1', 'frame right')
    m.b(-24, 30, -1, 24, 54, 0, 'pine:-2', 'board face (green chalkboard)', 'face')
    m.b(-29, 56, -4, 29, 58, 3, 'darkWood:0', 'roof board')
    m.b(-27, 58, -3, 27, 60, 2, 'darkWood:1', 'roof ridge')
    m.b(-29, 58, -4, -27, 59, 3, 'snow:0', 'snow on the roof')
    m.b(-27, 60, -3, 27, 61, 2, 'snow:1', 'snow on the ridge')
    m.b(27, 58, -4, 29, 59, 3, 'snow:0', 'snow on the roof')
    m.b(-6, 34, 0, 6, 50, 1, 'trimWhite:2', 'letter card', 'card')
    m.b(-6, 50, 0, 6, 51, 1, 'trimWhite:-1', 'letter card, top edge', 'card')
    for x in (-4, 3):
        m.b(x, 51, 0, x + 1, 54, 1, 'brass:0', 'card hook', 'card')
    m.b(12, 37, 0, 22, 47, 1, 'trimWhite:2', 'clock card', 'card')
    for x in (13, 20):
        m.b(x, 47, 0, x + 1, 54, 1, 'brass:0', 'card hook', 'card')
    m.b(-24, 28, 1, 24, 29, 3, 'darkWood:1', 'chalk ledge')
    m.b(-20, 29, 1, -17, 30, 2, 'snow:2', 'chalk stick')
    m.b(14, 29, 1, 19, 31, 3, 'trimWhite:-1', 'duster')
    for i, x in enumerate(range(-26, 27, 8)):
        c = ('glow:bulbRed', 'glow:bulbGold', 'glow:bulbSage')[i % 3]
        m.b(x, 55, 3, x + 2, 57, 5, c, 'bulb', 'season', True)
        m.light(x + 1, 56, 4, c, 0.25, 0.35)
    m.notes.append('The face (cells, front at z 0): x -24..24, y 30..54 (2.4 x 1.2 m). Count panel: x -23..-8. Letter card x -6..6, y 34..50. Clock card x 12..22, y 37..47.')
    m.notes.append('The two cards are their own part ("card"): at the end of a run they lift off their hooks, leaving the whole face for the chalk report.')
    return m


def coach_chair():
    m = Model('coachChair', S, "The coach's high chair: an umpire's chair beside the board, 1.6 m to the seat", 'New: says who is in charge of practice', 'S')
    for x in (-6, 4):
        for z in (-6, 4):
            m.b(x, 0, z, x + 2, 32, z + 2, 'wood:0', 'leg')
    for y in (7, 14, 21, 28):
        m.b(-6, y, 4, 6, y + 1, 6, 'wood:1', 'rung')
    m.b(-7, 32, -7, 7, 34, 7, 'wood:1', 'seat')
    m.b(-6, 34, -6, 0, 35, 6, 'scarfRed:0', 'cushion, left pad'); m.b(0, 34, -6, 6, 35, 6, 'scarfRed:-1', 'cushion, right pad')
    tile(m, -7, 34, -7, 7, 48, -6, 'wood', 0, long='y', across='x', L=12, W=3, name='back slat')
    m.b(-7, 48, -8, 7, 49, -5, 'trimWhite:0', 'back rail'); m.b(-7, 49, -8, 7, 50, -5, 'snow:1', 'snow on the rail')
    for x in (-7, 6):
        tile(m, x, 34, -6, x + 1, 40, 6, 'wood', 0, long='z', across='y', L=6, W=3, name='arm side'); m.b(x, 40, -6, x + 1, 41, 7, 'wood:2', 'arm rest')
    m.b(-8, 0, -8, -4, 1, -4, 'snow:1', 'snow at the foot'); m.b(4, 0, 4, 8, 1, 8, 'snow:1', 'snow at the foot')
    return m


def tile_rack():
    m = Model('tileRack', S, 'The rack on the middle bay of the front boards: the letters you type stand on it as tiles', 'New: replaces the typing line; the same tiles as the FLEECED logo', 'S')
    m.b(-23, 2, 1, 23, 3, 4, 'trimWhite:1', 'rack shelf')
    m.b(-23, 3, 3, 23, 4, 4, 'trimWhite:-1', 'rack lip')
    m.b(-23, 1, 1, 23, 2, 2, 'trimWhite:-2', 'rack shadow line')
    m.notes.append('Tiles stand on the shelf: 0.15 m square, 0.165 m apart, the first at x -1.02 m. Up to 13 fit between the two posts.')
    return m


def ice_block():
    m = Model('iceBlock', S, 'The ice the bomb leaves round a sheep: a fitted block, clear, frost on its edges, three icicles', "Today's ice block, fitted closer and made clear", 'S')
    x0, x1, y1, z0, z1 = -15, 15, 31, -9, 9
    for (a, b) in ((x0, z0), (x0, z1 - 1), (x1 - 1, z0), (x1 - 1, z1 - 1)):
        m.b(a, 0, b, a + 1, y1, b + 1, 'ice:1', 'edge')
    for y in (0, y1 - 1):
        m.b(x0, y, z0, x1, y + 1, z0 + 1, 'ice:1', 'edge'); m.b(x0, y, z1 - 1, x1, y + 1, z1, 'ice:2', 'edge')
        m.b(x0, y, z0, x0 + 1, y + 1, z1, 'ice:1', 'edge'); m.b(x1 - 1, y, z0, x1, y + 1, z1, 'ice:1', 'edge')
    for (x, y) in ((x0, y1 - 4), (x1 - 4, y1 - 4), (x0, 0), (x1 - 4, 0)):
        m.b(x, y, z1 - 1, x + 4, y + 4, z1, 'ice:2', 'frost corner')
    for k, c in enumerate(('snow:0', 'snow:1', 'snow:2')):     # a stepped mound of snow on top: three whole layers, each 3 cells in from the last
        m.b(x0 + 3 * k, y1 + k, z0 + 3 * k, x1 - 3 * k, y1 + k + 1, z1 - 3 * k, c, 'snow on top, layer %d' % (k + 1))
    for (x, L) in ((-9, 4), (-1, 6), (8, 3)):
        m.b(x, y1 - 1 - L, z1 - 1, x + 2, y1 - 1, z1, 'ice:2', 'icicle')
    m.notes.append('The faces between the edges are clear ice: draw them as glass at 22% of ice 0, so the sheep and its face stay visible. Margin round the sheep: 5 voxels.')
    return m


# ---- props (the bombs themselves are in skins.py) -----------------------------------------------

def practice_crate():
    m = Model('practiceCrate', S, 'A crate of spare practice bombs: corks in their fuses, chalk tick on the side', 'New: says this is practice; the bombs here cannot go off', 'S')
    m.b(-8, 0, -6, 8, 9, 6, 'wood:0', 'crate core')
    boards_x(m, -8, 8, 0, 9, 6, 7, 'wood', w=4, pat=(0, -1, 0, 1), name='crate board')
    tile(m, -8, 0, -6, -7, 9, 6, 'wood', 0, long='z', across='y', W=3, name='crate side board')
    tile(m, 7, 0, -6, 8, 9, 6, 'wood', 0, long='z', across='y', W=3, name='crate side board')
    m.b(-9, 0, 6, -7, 10, 7, 'darkWood:0', 'crate corner')
    m.b(7, 0, 6, 9, 10, 7, 'darkWood:0', 'crate corner')
    m.b(-9, 8, 6, 9, 10, 7, 'darkWood:0', 'crate rim')
    for cx in (-4, 4):
        m.b(cx - 3, 9, -3, cx + 3, 11, 3, '#3A72B6', 'spare bomb (Ice), body')
        m.b(cx - 3, 11, -3, cx + 3, 12, 3, '#F4F8FB', 'spare bomb, snow cap')
        m.b(cx - 2, 12, -2, cx + 2, 13, 2, '#F4F8FB', 'spare bomb, snow cap')
        m.b(cx - 1, 13, -1, cx + 1, 14, 1, '#9FB4C8', 'spare bomb, cap')
        m.b(cx - 1, 14, -1, cx + 1, 15, 1, '#EEF6FB', 'spare bomb, fuse stub')
        m.b(cx - 1, 15, -1, cx + 1, 17, 1, 'wood:2', 'cork')
    for (x, y) in ((-3, 4), (-2, 3), (-1, 2), (0, 3), (1, 4), (2, 5), (3, 6)):
        m.b(x, y, 7, x + 1, y + 1, 8, 'snow:2', 'chalk tick')
    m.b(-8, 9, -6, -6, 10, 6, 'snow:1', 'snow on the rim')
    return m


def whistle():
    m = Model('whistle', 0.04, "The coach's whistle on its cord: an accessory for the sheepdog, on the animals' 0.04 m grid", 'New accessory; the sheepdog itself is unchanged', 'animal grid')
    m.b(0, 0, -1, 3, 2, 1, 'brass:0', 'whistle body')
    m.b(3, 1, -1, 5, 2, 1, 'brass:1', 'mouthpiece')
    for i in range(4):
        m.b(1 - i, 2 + i, 0, 2 - i, 3 + i, 1, 'scarfRed:0', 'cord')
    m.notes.append("Hangs at the sheepdog's chest on its cord; when blown it rises to the mouth for 0.3 s.")
    return m


def bib(level):
    colour, icon_c = {'easy': ('giftGreen:0', 'trimWhite:2'), 'medium': ('coopYellow:-1', 'ink:0'), 'hard': ('scarfRed:-1', 'trimWhite:2')}[level]
    m = Model('bib' + level.title(), 0.04, f"The practice partner's bib, {level}: a knitted tabard over the bot's back", 'New accessory; the farm sheep itself is unchanged', 'S')
    for z0, z1 in ((7, 8), (-8, -7)):
        for k, y in enumerate(range(14, 25, 2)):          # knitted rows: the colour's own two steps, alternating
            m.b(-6, y, z0, 4, y + 2, z1, colour if k % 2 == 0 else colour.split(':')[0] + ':' + str(int(colour.split(':')[1]) + 1), 'bib knit row', 'bib')
        m.b(-6, 13, z0, 4, 14, z1, colour.split(':')[0] + ':-2', 'bib rib hem', 'bib')
    tile(m, -6, 26, -8, 4, 27, 8, colour.split(':')[0], int(colour.split(':')[1]), long='z', across='x', L=8, W=2, name='bib over the back, knit rows', part='bib')
    rows = {'easy': ['..X.X..', '...X...', '...X...', '...X...'],
            'medium': ['.X.X.X.', '..XXX..', '...X...', '...X...'],
            'hard': ['...X...', '..XXX..', '.XXXXX.', '...X...']}[level]
    for r, row in enumerate(rows):
        for c, ch in enumerate(row):
            if ch == 'X':
                m.b(-5 + c, 21 - r, 8, -4 + c, 22 - r, 9, icon_c, 'level icon', 'bib')
    m.notes.append('Sized on the reference stand-in sheep (cell 0.04 m): fit it to the real sheep by its body box. The panels cover x 0.29..0.71 of the body length from the tail and y 0.50..1.0 of the body height; the icon sits on the camera-side panel.')
    return m


def light_post():
    m = Model('lightPost', S, 'A post at a corner of the rink with a lantern, and the string of bulbs to the next post', "Home's lamp posts and bulbs", 'S')
    m.b(-1, 0, -1, 1, 44, 1, 'darkWood:-1', 'post')
    m.b(-2, 0, -2, 2, 2, 2, 'stone:0', 'post foot')
    m.b(-3, 44, -3, 3, 45, 3, 'iron:0', 'lantern base')
    m.b(-2, 45, -2, 2, 50, 2, 'glow:lit', 'lantern glass')
    m.b(-3, 50, -3, 3, 51, 3, 'iron:0', 'lantern roof')
    m.b(-2, 51, -2, 2, 52, 2, 'snow:1', 'snow on the lantern')
    m.light(0, 47, 0, 'glow:lit', 1.1, 0.55, 'lantern')
    return m


# ---- picture stand-ins (never built) --------------------------------------------------------------

def dog_standin():
    m = Model('dogStandIn', 0.04, "A stand-in sheepdog for the pictures only. The game's own sheepdog is used", 'none: not part of the plan', 'picture only')
    m.b(-5, 0, -3, -2, 6, 3, 'ink:1', 'back leg')
    m.b(2, 0, -3, 5, 10, 3, 'trimWhite:1', 'front leg')
    m.b(-6, 4, -4, 5, 14, 4, 'ink:1', 'body')
    m.b(1, 6, -4, 6, 16, 4, 'trimWhite:1', 'chest')
    m.b(1, 15, -4, 9, 23, 4, 'ink:1', 'head')
    m.b(5, 15, -3, 11, 19, 3, 'trimWhite:1', 'muzzle')
    m.b(10, 17, -1, 12, 19, 1, 'ink:0', 'nose')
    m.b(6, 20, 4, 7, 21, 5, 'trimWhite:2', 'eye')
    m.b(1, 22, -4, 4, 26, -2, 'ink:0', 'ear')
    m.b(1, 22, 2, 4, 26, 4, 'ink:0', 'ear')
    m.b(-9, 6, -1, -6, 12, 1, 'ink:1', 'tail')
    m.b(-10, 11, -1, -8, 13, 1, 'trimWhite:1', 'tail tip')
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
    return [rink_boards(), rink_boards_front(), snow_bank(), broom(), tally_board(), coach_chair(), tile_rack(), ice_block(),
            practice_crate(), whistle(), bib('easy'), bib('medium'), bib('hard'), light_post()]

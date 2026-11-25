"""Rough sketches for the Counting Sheep plan. Flat shapes only: guides to layout, colour and content, not final art.
Run:  python3 tools/sketches.py   ->  reference/sketch-*.png
"""
import json, math, os, random
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAL = json.load(open(os.path.join(ROOT, 'data', 'palettes.json')))
TOK, STAGES, QUILT = PAL['tokens'], {int(k): v for k, v in PAL['stages'].items()}, PAL['quilt']
FONT = json.load(open(os.path.join(ROOT, 'data', 'dotfont.json')))['letters']
SERIF = '/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf'
SANS = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
F = lambda p, s: ImageFont.truetype(p, s)
W, H, BED = 1440, 900, 216
WIN_BOTTOM = H - BED - 6
LANE = 10 + int((WIN_BOTTOM - 10) * 0.66)


def hx(c):
    c = c.lstrip('#'); return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))


def mix(a, b, t):
    a = hx(a) if isinstance(a, str) else a; b = hx(b) if isinstance(b, str) else b
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def h01(n):
    x = math.sin(n * 127.1 + 311.7) * 43758.5453
    return x - math.floor(x)


def R(d, x0, y0, x1, y1, fill):
    d.rectangle([min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1)], fill=fill)


def a(col, alpha):
    return (hx(col) if isinstance(col, str) else tuple(col)) + (alpha,)


def dots_word(d, word, x, y, col, dot=2, pitch=4):
    for ch in word:
        g = FONT.get(ch)
        if not g:
            x += 2 * pitch; continue
        rows = g.split(' ')
        for r, row in enumerate(rows):
            for c, b in enumerate(row):
                if b == '1':
                    R(d, x + c * pitch, y + r * pitch, x + c * pitch + dot - 1, y + r * pitch + dot - 1, col)
        x += (len(rows[0]) + 1) * pitch


def pine(d, x, base, h, col, snow=None):
    tiers = max(3, h // 12)
    for t in range(tiers):
        w = 6 + (tiers - t) * 6; y = base - 6 - (t + 1) * (h - 6) // tiers
        R(d, x - w // 2, y, x + w // 2, y + (h - 6) // tiers + 2, col)
        if snow: R(d, x - w // 2, y, x + w // 2, y + 2, snow)
    R(d, x - 2, base - 6, x + 1, base, mix(col, '#000000', 0.3))


def sky(P, w=W, h=H, lane=LANE, stars=160, seed=7):
    im = Image.new('RGB', (w, h), P['sky'][0]); d = ImageDraw.Draw(im, 'RGBA')
    for i, c in enumerate(P['sky']):
        R(d, 0, lane * i // 5, w, lane * (i + 1) // 5, c)
    R(d, 0, lane - 46, w, lane, mix(P['sky'][4], P['glow'], 0.55))
    rnd = random.Random(seed)
    for _ in range(int(stars * w / W)):
        x, y, s = rnd.randrange(w), rnd.randrange(max(1, lane - 60)), rnd.choice([2, 2, 2, 3, 3])
        R(d, x, y, x + s - 1, y + s - 1, a(TOK['frost'], rnd.choice([115, 165, 230])))
    return im, d


def sheep(d, x, lane, streaks=True, puff='#FFFFFF'):
    if streaks:
        R(d, x - 66, lane - 34, x - 22, lane - 31, (255, 255, 255, 110))
        R(d, x - 92, lane - 50, x - 40, lane - 48, (255, 255, 255, 80))
        R(d, x - 74, lane - 20, x - 34, lane - 18, (255, 255, 255, 60))
    for lx in (x + 8, x + 26, x + 58, x + 76):
        R(d, lx, lane - 20, lx + 7, lane, '#D9B79A')
    R(d, x, lane - 70, x + 88, lane - 18, '#F7F4FB'); R(d, x, lane - 26, x + 88, lane - 18, '#DCD6EC')
    R(d, x + 80, lane - 82, x + 110, lane - 50, '#F2C9B8'); R(d, x + 100, lane - 72, x + 104, lane - 68, TOK['ink'])
    R(d, x + 78, lane - 92, x + 108, lane - 82, '#BF6055'); R(d, x + 76, lane - 84, x + 110, lane - 80, '#FFFFFF')
    R(d, x + 70, lane - 102, x + 80, lane - 92, '#FFFFFF')
    for i, (px, py) in enumerate([(-8, -6), (-22, -10), (-36, -4)]):
        r = 6 - i
        d.ellipse([x + px - r, lane + py - r, x + px + r, lane + py + r], fill=a(puff, 190 - i * 50))


def tile(d, x, y, s, kind, ch=None, font=None, side=6):
    face, hi, lip = {'lantern': (TOK['lantern'], TOK['lanternHi'], TOK['lanternLip']), 'wool': (TOK['wool'], TOK['woolHi'], TOK['woolLip'])}[kind]
    R(d, x - 2, y - 2, x + s + 1, y + s + side + 1, TOK['ink']); R(d, x, y + s, x + s - 1, y + s + side - 1, lip)
    R(d, x, y, x + s - 1, y + s - 1, face); R(d, x, y, x + s - 1, y + 2, hi)
    if ch:
        bb = d.textbbox((0, 0), ch, font=font)
        d.text((x + (s - (bb[2] - bb[0])) / 2 - bb[0], y + (s - (bb[3] - bb[1])) / 2 - bb[1] + 1), ch, font=font, fill=TOK['ink'])


def slot(d, x, y, s, ring=False, side=6):
    if ring: R(d, x - 5, y - 5, x + s + 4, y + s + side + 4, TOK['lantern'])
    R(d, x - 2, y - 2, x + s + 1, y + s + side + 1, TOK['ink']); R(d, x, y, x + s - 1, y + s + side - 1, TOK['nightDeep'])
    R(d, x, y + s + side - 3, x + s - 1, y + s + side - 1, TOK['night2']); R(d, x + s // 2 - 8, y + s - 8, x + s // 2 + 7, y + s - 6, TOK['night3'])


def quilt_band(d, x0, y, x1, hgt=6, patch=18):
    for i, x in enumerate(range(x0, x1, patch)):
        c = QUILT[i % 5]
        R(d, x, y, min(x + patch - 2, x1), y + hgt - 1, c); R(d, x, y, min(x + patch - 2, x1), y + 1, mix(c, '#FFFFFF', 0.25))


def sign(d, post_x, lane, letters, arm=250):
    wood2 = '#6E4D38'
    R(d, post_x, lane - arm, post_x + 8, lane - 70, wood2)
    bw = 26 + len(letters) * 50 + 44
    bx, by = post_x + 4 - bw // 2, lane - arm - 12
    R(d, bx + 12, by - 12, bx + 13, by, wood2); R(d, bx + bw - 14, by - 12, bx + bw - 13, by, wood2)
    R(d, bx + 4, by - 16, bx + bw - 5, by - 11, wood2)
    R(d, bx - 3, by - 3, bx + bw + 2, by + 92, TOK['ink']); R(d, bx, by, bx + bw - 1, by + 89, TOK['night2']); R(d, bx, by, bx + bw - 1, by + 2, TOK['night3'])
    f = F(SERIF, 30)
    for i, ch in enumerate(letters):
        tile(d, bx + 14 + i * 50, by + 12, 42, 'lantern', ch, f)
    for i in range(3):
        R(d, bx + 18 + len(letters) * 50 + i * 14, by + 40, bx + 27 + len(letters) * 50 + i * 14, by + 49, TOK['nightDeep'])
    R(d, bx + 10, by + 68, bx + bw - 11, by + 82, TOK['nightDeep'])


def lantern_pair(d, xs, lane, top):
    for px in xs:
        R(d, px - 1, lane - top - 14, px + 10, lane - top - 2, TOK['lanternHi'])
        d.ellipse([px - 20, lane - top - 28, px + 30, lane - top + 14], fill=a(TOK['lantern'], 50))


# ------------------------------------------------------------------ stage 1: his own farm
def stage1():
    P = STAGES[1]; im, d = sky(P)
    d.ellipse([1180, 96, 1276, 192], fill='#FFE9A8'); d.ellipse([1206, 84, 1296, 174], fill=P['sky'][1])       # crescent
    for i in range(46):                                                                                          # snowfall
        x, y = int(h01(i * 3.7) * W), int(h01(i * 9.1) * (LANE - 30))
        R(d, x, y, x + 1, y + 1, (255, 255, 255, 200))
    for x in range(0, W, 60):                                                                                    # far hills and forest
        hgt = 60 + int(30 * math.sin(x / 210) + 18 * math.sin(x / 67)) // 12 * 12
        R(d, x, LANE - 40 - hgt, x + 59, LANE, P['far'])
        pine(d, x + 30, LANE - 40 - hgt + 6, 30, mix(P['far'], '#000000', 0.15))
    hx_, hy = 1010, LANE - 148                                                                                   # windmill on a hill
    R(d, hx_ - 9, hy - 46, hx_ + 9, hy, mix('#C9C0CF', P['far'], 0.4))
    for k in range(4):
        ang = math.radians(20 + k * 90)
        d.line([hx_, hy - 46, hx_ + 34 * math.cos(ang), hy - 46 + 34 * math.sin(ang)], fill=mix('#5B3923', P['far'], 0.3), width=5)
    g = LANE - 30; R(d, 0, g, W, LANE, mix(P['snow'], P['mid'], 0.55))                                           # the farm's own ground
    t = lambda c: mix(c, P['mid'], 0.35)
    R(d, 150, g - 120, 330, g, t('#B75946')); d.polygon([140, g - 120, 240, g - 176, 340, g - 120], fill=t('#EEE9E1'))   # barn
    R(d, 214, g - 62, 266, g, t('#E4D7C4')); d.line([214, g - 62, 266, g], fill=t('#B75946'), width=4); d.line([266, g - 62, 214, g], fill=t('#B75946'), width=4)
    R(d, 350, g - 150, 400, g, t('#9A9087')); d.pieslice([350, g - 176, 400, g - 126], 180, 360, fill=t('#EEE9E1'))        # silo
    for px in (60, 470, 520, 1150, 1380): pine(d, px, g, 70 + int(h01(px) * 40), t('#3D7460'), t('#EEE9E1'))
    R(d, 640, g - 92, 800, g, t('#D8C0A1')); d.polygon([626, g - 92, 720, g - 142, 814, g - 92], fill=t('#84604D'))          # farmhouse
    d.polygon([626, g - 92, 720, g - 142, 720, g - 134, 640, g - 92], fill=t('#EEE9E1'))
    R(d, 766, g - 150, 782, g - 110, t('#84604D'))
    for i, (px, py, r) in enumerate([(774, g - 164, 7), (782, g - 184, 9), (776, g - 208, 11)]):
        d.ellipse([px - r, py - r, px + r, py + r], fill=(255, 255, 255, 120 - i * 30))
    d.ellipse([672, g - 84, 742, g - 14], fill=a(TOK['lantern'], 60)); R(d, 690, g - 66, 724, g - 30, TOK['lanternHi'])     # his bedroom window
    R(d, 706, g - 66, 708, g - 30, t('#84604D')); R(d, 690, g - 49, 724, g - 47, t('#84604D'))
    R(d, 900, g - 70, 906, g, t('#5B3923')); R(d, 878, g - 56, 928, g - 50, t('#5B3923')); R(d, 892, g - 86, 914, g - 66, t('#D0B476'))   # scarecrow
    R(d, 884, g - 92, 922, g - 86, t('#5B3923'))
    for bx in (960, 1004): R(d, bx, g - 26, bx + 40, g, t('#DEB870'))
    R(d, 982, g - 52, 1022, g - 26, t('#DEB870'))
    R(d, 1230, g - 54, 1320, g, t('#DCB87A')); d.polygon([1222, g - 54, 1275, g - 84, 1328, g - 54], fill=t('#EEE9E1'))     # coop
    for i, x in enumerate(range(20, W, 64)):                                                                     # the farm fence, with its string of bulbs
        R(d, x, LANE - 44, x + 7, LANE, '#5B3923'); R(d, x - 1, LANE - 48, x + 8, LANE - 44, '#FFFFFF')
        for k in range(1, 4):
            bx_, by_ = x + 4 + k * 16, LANE - 40 + int(8 * math.sin(k / 4 * math.pi))
            on = (i * 3 + k) % 4 == 0
            if on: d.ellipse([bx_ - 9, by_ - 7, bx_ + 11, by_ + 13], fill=a(TOK['lantern'], 60))
            R(d, bx_, by_, bx_ + 3, by_ + 5, TOK['lanternHi'] if on else mix(TOK['lantern'], P['sky'][2], 0.5))
    R(d, 0, LANE - 30, W, LANE - 25, '#6E4D38'); R(d, 0, LANE - 14, W, LANE - 9, '#6E4D38')
    R(d, 0, LANE, W, LANE + 14, P['snow']); R(d, 0, LANE + 14, W, LANE + 24, P['shade'])                         # the lane: a snowy farm track
    R(d, 0, LANE + 4, W, LANE + 5, P['shade']); R(d, 0, LANE + 9, W, LANE + 10, P['shade'])                      # wheel ruts
    field = mix(P['snow'], P['sky'][2], 0.62); R(d, 0, LANE + 24, W, H, field)                                   # the field in front, in shadow
    for r_ in range(7):                                                                                          # snowed-over crop rows, catching the moon
        y = LANE + 44 + r_ * 26
        for x in range(-40 + r_ * 18, W, 120):
            R(d, x, y, x + 84, y + 3, mix(field, P['snow'], 0.35)); R(d, x, y + 4, x + 84, y + 9, mix(field, P['sky'][1], 0.35))
    for x in range(0, W, 180):                                                                                   # a dry-stone wall, nearest the camera
        for k in range(4):
            R(d, x + k * 46 - 20, WIN_BOTTOM - 46 + (k % 2) * 6, x + k * 46 + 22, WIN_BOTTOM + 10, mix('#867B71', P['sky'][1], 0.55))
            R(d, x + k * 46 - 20, WIN_BOTTOM - 50 + (k % 2) * 6, x + k * 46 + 22, WIN_BOTTOM - 45 + (k % 2) * 6, mix(P['snow'], P['sky'][2], 0.3))
    for k in range(5):                                                                                           # hoofprints
        R(d, 250 - k * 36, LANE + 2, 256 - k * 36, LANE + 5, P['shade'])
    sheep(d, 300, LANE, streaks=False)
    gx = 1010                                                                                                    # a five-bar gate
    for px in (gx, gx + 62): R(d, px, LANE - 74, px + 9, LANE, '#6E4D38'); R(d, px - 2, LANE - 80, px + 11, LANE - 74, '#FFFFFF')
    for ry in range(LANE - 64, LANE - 8, 13): R(d, gx + 6, ry, gx + 64, ry + 6, '#9B704C')
    d.line([gx + 8, LANE - 10, gx + 62, LANE - 62], fill='#9B704C', width=6)
    lantern_pair(d, (gx, gx + 62), LANE, 80); sign(d, gx + 32, LANE, 'H')
    return im, dict(count=2, card=None, locked='H', typed='AY', words={'HEN': (170, 100), 'HILL': (520, 150)}, filled=2)


# ------------------------------------------------------------------ stage 2: the farm lifts off
def island(d, cx, top, w, P, tint, build):
    s = P['sky'][2]; snow, soil, rock = mix(P['snow'], s, tint), mix(P['soil'], s, tint), mix(P['rock'], s, tint * 0.6)
    R(d, cx - w // 2 - 3, top, cx + w // 2 + 3, top + 7, snow); R(d, cx - w // 2, top + 8, cx + w // 2, top + 17, soil)
    for i, k in enumerate([0.86, 0.66, 0.5, 0.3, 0.14]):
        ww = int(w * k); off = int(w * 0.06 * i)
        R(d, cx - ww // 2 - off, top + 18 + i * 8, cx + ww // 2 - off, top + 25 + i * 8, rock if i % 2 == 0 else mix(rock, s, 0.25))
    for i in range(3):                                                                                           # clods trailing below
        R(d, cx - 30 + i * 22, top + 66 + i * 10, cx - 20 + i * 22 - i * 2, top + 74 + i * 10, rock)
    t = lambda c: mix(c, s, tint)
    if build == 'barn':
        R(d, cx - 34, top - 44, cx + 20, top, t('#B75946')); d.polygon([cx - 40, top - 44, cx - 7, top - 68, cx + 26, top - 44], fill=snow)
        R(d, cx + 26, top - 60, cx + 44, top, t('#9A9087'))
    if build == 'mill':
        R(d, cx - 8, top - 34, cx + 8, top, t('#C9C0CF'))
        for k in range(4):
            ang = math.radians(35 + k * 90)
            d.line([cx, top - 34, cx + 30 * math.cos(ang), top - 34 + 30 * math.sin(ang)], fill=mix('#5B3923', s, tint * 0.6), width=5)
    if build == 'house':
        R(d, cx - 30, top - 34, cx + 30, top, t('#D8C0A1')); d.polygon([cx - 36, top - 34, cx, top - 56, cx + 36, top - 34], fill=snow)
        d.ellipse([cx - 22, top - 34, cx + 14, top + 2], fill=a(TOK['lantern'], 70)); R(d, cx - 12, top - 26, cx + 4, top - 8, TOK['lanternHi'])
        pine(d, cx + 46, top, 30, t('#3D7460'), snow)


def stage2():
    P = STAGES[2]; im, d = sky(P)
    d.ellipse([1150, 100, 1290, 240], fill=a('#FFE9A8', 40)); d.ellipse([1168, 118, 1272, 222], fill='#FFE9A8')
    d.ellipse([1196, 140, 1216, 160], fill='#F2D58E'); d.ellipse([1232, 178, 1246, 192], fill='#F2D58E')
    for x in range(380, 1120, 8):                                                                                # the northern light, as bars
        t = (x - 380) / 740; hgt = 46 + 30 * math.sin(x / 70) + 16 * math.sin(x / 23); top = 250 - 26 * math.sin(x / 120) - hgt
        col = mix('#9CCB78', '#6FC7D6', min(1, t * 2)) if t < 0.5 else mix('#6FC7D6', '#7B67C0', (t - 0.5) * 2)
        R(d, x, top, x + 5, top + hgt, col + (95,)); R(d, x, top, x + 5, top + 5, col + (200,))
    island(d, 300, 268, 150, P, 0.5, 'mill'); island(d, 760, 296, 130, P, 0.5, 'house'); island(d, 1250, 318, 140, P, 0.5, 'barn')
    for i, x in enumerate(range(40, W, 150)):                                                                    # fence pieces and pines on small clods
        y = LANE - 60 - int(h01(x) * 60); c = mix(P['mid'], '#000000', 0.1)
        R(d, x, y, x + 44, y + 8, c); R(d, x + 8, y + 8, x + 34, y + 16, c)
        if i % 2: pine(d, x + 22, y, 40, c)
        else:
            R(d, x + 6, y - 22, x + 10, y, c); R(d, x + 34, y - 22, x + 38, y, c); R(d, x + 2, y - 18, x + 42, y - 14, c)
    R(d, 0, LANE, W, LANE + 12, P['snow']); R(d, 0, LANE + 12, W, LANE + 16, P['shade'])                         # the lane: a floating island
    R(d, 0, LANE + 16, W, LANE + 40, P['soil']); R(d, 0, LANE + 40, W, LANE + 62, P['soil2'])
    for x in range(20, W, 96):
        R(d, x, LANE + 44 + (x // 96 % 2) * 6, x + 13, LANE + 53 + (x // 96 % 2) * 6, mix(P['soil2'], '#9A90B8', 0.35))
    for x in range(70, W, 260):                                                                                  # roots
        R(d, x, LANE + 62, x + 3, LANE + 92, '#5B3923'); R(d, x + 3, LANE + 78, x + 6, LANE + 104, '#5B3923')
    for x in range(0, W, 12):
        dep = max(8, int((34 + 22 * math.sin(x / 150) + 14 * math.sin(x / 47 + 1.3) + 8 * math.sin(x / 19)) // 8) * 8)
        R(d, x, LANE + 62, x + 11, LANE + 62 + dep, P['rock']); R(d, x, LANE + 62, x + 11, LANE + 66, mix(P['rock'], P['soil2'], 0.5))
    for x in range(10, W, 31):
        ln = [9, 15, 6, 12][x // 31 % 4]
        R(d, x, LANE + 16, x + 5, LANE + 16 + ln // 3, P['snow']); R(d, x + 1, LANE + 16 + ln // 3, x + 4, LANE + 16 + 2 * ln // 3, P['snow'])
        R(d, x + 2, LANE + 16 + 2 * ln // 3, x + 3, LANE + 16 + ln, P['shade'])
    for i in range(46):                                                                                          # mist streaks
        x = int(h01(i * 3.1) * W); y = LANE + 120 + int(h01(i * 7.7) * (WIN_BOTTOM - LANE - 130)); ln = 60 + int(h01(i * 1.3) * 220)
        R(d, x, y, x + ln, y + 2 + i % 2, a(P['mist'], 70 + i % 3 * 30))
    prev = None                                                                                                  # the bulb string, floating free
    for i, x in enumerate(range(0, W + 16, 16)):
        y = LANE - 46 + int(14 * math.sin(x / 90)); on = i % 4 == 1
        if prev: d.line([prev[0] + 2, prev[1], x + 2, y], fill=a(TOK['ink'], 200), width=1)
        if on: d.ellipse([x - 9, y - 7, x + 11, y + 13], fill=a(TOK['lantern'], 60))
        R(d, x, y, x + 3, y + 5, TOK['lanternHi'] if on else mix(TOK['lantern'], P['sky'][2], 0.5)); prev = (x, y)
    for i in range(40):                                                                                          # snow drifting upward
        x, y = int(h01(i * 4.1) * W), int(h01(i * 8.3) * (LANE - 20))
        R(d, x, y, x + 1, y + 1, (255, 255, 255, 190)); R(d, x, y + 3, x + 1, y + 6, (255, 255, 255, 60))
    sheep(d, 300, LANE)
    gx = 1010                                                                                                    # a fence on its own clod, iced
    for px in (gx, gx + 54): R(d, px, LANE - 78, px + 9, LANE, '#6E4D38'); R(d, px - 2, LANE - 84, px + 11, LANE - 78, '#FFFFFF')
    for ry in (LANE - 62, LANE - 40, LANE - 18):
        R(d, gx - 6, ry, gx + 70, ry + 9, '#9B704C')
        for ix in range(gx, gx + 66, 14): R(d, ix, ry + 10, ix + 2, ry + 15, P['snow'])
    lantern_pair(d, (gx, gx + 54), LANE, 84); sign(d, gx + 28, LANE, 'CA')
    return im, dict(count=6, card='Dreaming…', locked='CA', typed='RD', filled=6,
                    words={'HACK': (150, 96), 'TACH': (320, 150), 'WREN': (650, 78), 'OTTER': (880, 250), 'JUMPY': (1010, 64)})


# ------------------------------------------------------------------ stage 3: under the quilt
def button(d, x, y, r, col, holes=4):
    d.ellipse([x - r, y - r, x + r, y + r], fill=col); d.ellipse([x - r + 2, y - r + 2, x + r - 2, y + r - 2], outline=mix(col, '#000000', 0.25))
    for dx, dy in ([(-2, -2), (2, -2), (-2, 2), (2, 2)] if holes == 4 else [(-2, 0), (2, 0)]):
        R(d, x + dx - 1, y + dy - 1, x + dx, y + dy, mix(col, '#000000', 0.55))


def yarn(d, x, y, r):
    base = (196, 74, 58)
    d.ellipse([x - r, y - r, x + r, y + r], fill=base)
    for k in range(-r + 4, r, 7):
        d.arc([x - r, y - r + k, x + r, y + r + k], 200, 340, fill=mix(base, '#000000', 0.25), width=2)
        d.arc([x - r + k, y - r, x + r + k, y + r], 100, 250, fill=mix(base, '#FFFFFF', 0.2), width=2)


def stage3(finale=False):
    P = STAGES[3]; im, d = sky(P, stars=90, seed=11)
    mr = 150 if finale else 95; mx_, my = (640, 262) if finale else (1130, 190)                                  # the moon
    d.ellipse([mx_ - mr - 16, my - mr - 16, mx_ + mr + 16, my + mr + 16], fill=a('#FFE9A8', 36)); d.ellipse([mx_ - mr, my - mr, mx_ + mr, my + mr], fill='#FFE9A8')
    d.ellipse([mx_ - mr * 0.5, my - mr * 0.45, mx_ - mr * 0.2, my - mr * 0.15], fill='#F2D58E'); d.ellipse([mx_ + mr * 0.25, my + mr * 0.2, mx_ + mr * 0.5, my + mr * 0.45], fill='#F2D58E')
    if finale:                                                                                                   # every sheep you counted crosses the moon
        for k in range(9):
            t = k / 8; x = mx_ - mr * 0.92 + t * mr * 1.84; y = my + 10 - math.sin(t * math.pi) * mr * 0.62
            R(d, x - 8, y - 5, x + 6, y + 3, TOK['ink']); R(d, x + 5, y - 8, x + 10, y - 2, TOK['ink']); R(d, x - 6, y + 3, x - 4, y + 7, TOK['ink']); R(d, x + 2, y + 3, x + 4, y + 7, TOK['ink'])
        for sx, sy in ((200, 90), (1010, 70), (1200, 150)):
            d.line([sx, sy, sx + 44, sy + 16], fill=a('#FFFFFF', 150), width=2); R(d, sx + 44, sy + 15, sx + 47, sy + 18, '#FFFFFF')
    for i in range(22):                                                                                          # button stars, hanging on threads
        x = 40 + int(h01(i * 1.9) * (W - 80)); ln = 50 + int(h01(i * 6.3) * 190)
        if abs(x - mx_) < mr + 20 and ln > my - mr - 30: ln = max(20, my - mr - 40)
        if 560 < x < 880 and ln < 120: continue
        d.line([x, 10, x, 10 + ln], fill=a(TOK['wool'], 70), width=1)
        button(d, x, 10 + ln, 5 + i % 3, [QUILT[1], QUILT[3], QUILT[0], TOK['woolHi']][i % 4], 4 if i % 2 else 2)
    for cx, wdt in ((250, 360), (620, 280), (1280, 320)):                                                        # pillow mountains
        c = mix('#F4F0EA', P['sky'][3], 0.45)
        for k in range(6):
            ww = wdt * (1 - k * 0.15); R(d, cx - ww / 2, LANE - 60 - k * 18, cx + ww / 2, LANE - 40 - k * 18 + 18, c)
        for sx in range(int(cx - wdt / 2 + 10), int(cx - wdt / 2 + 60), 12): R(d, sx, LANE - 60, sx + 3, LANE - 30, mix('#8F97AC', P['sky'][3], 0.45))
    cx = 70                                                                                                      # the candle, as a lighthouse
    R(d, cx - 12, LANE - 200, cx + 12, LANE - 40, mix('#F4F0EA', P['sky'][3], 0.35)); d.ellipse([cx - 40, LANE - 262, cx + 40, LANE - 182], fill=a(TOK['lantern'], 60))
    d.polygon([cx - 7, LANE - 200, cx, LANE - 232, cx + 7, LANE - 200], fill=TOK['lanternHi'])
    for i, x in enumerate(range(-48, W, 48)):                                                                    # quilt hills
        hgt = 30 + int((22 * math.sin(x / 190 + 1) + 14 * math.sin(x / 61)) // 12) * 12 + 24
        for r_ in range(0, hgt, 24):
            c = mix(QUILT[(i + r_ // 24 * 2) % 5], P['mid'], 0.30)
            R(d, x, LANE - hgt + r_, x + 46, LANE - hgt + r_ + 22, c); R(d, x, LANE - hgt + r_, x + 46, LANE - hgt + r_ + 1, mix(c, '#FFFFFF', 0.18))
    yarn(d, 520, LANE - 96, 34); d.line([554, LANE - 80, 640, LANE - 62, 700, LANE - 70], fill=(196, 74, 58), width=3)
    yarn(d, 1330, LANE - 84, 26)
    for (x0, y0, x1, y1) in ((860, LANE - 40, 930, LANE - 190), (935, LANE - 40, 872, LANE - 186)):              # knitting needles
        d.line([x0, y0, x1, y1], fill='#B8B0A6', width=5); d.ellipse([x1 - 6, y1 - 6, x1 + 6, y1 + 6], fill='#C9C1B6')
    R(d, 0, LANE, W, LANE + 12, P['snow']); R(d, 0, LANE + 12, W, LANE + 15, P['shade'])                         # the lane: the turned-down sheet
    for i, x in enumerate(range(-20, W, 96)):                                                                    # the quilt's face
        c = mix(QUILT[i % 5], P['soil'], 0.18); R(d, x, LANE + 15, x + 94, LANE + 62, c); R(d, x, LANE + 15, x + 94, LANE + 17, mix(c, '#FFFFFF', 0.2))
        for sx in range(x + 6, x + 94, 12): R(d, sx, LANE + 15, sx + 1, LANE + 21, TOK['wool'])
        if i == 3: R(d, x, LANE + 17, x + 94, LANE + 64, mix(c, '#000000', 0.08))                                # the patch under the sheep, pressed in
    R(d, 0, LANE + 62, W, LANE + 68, mix(QUILT[3], P['soil'], 0.2))
    for x in range(0, W, 14):                                                                                    # mattress ticking
        R(d, x, LANE + 68, x + 13, LANE + 100, mix('#E6DFD3', P['rock'], 0.55)); R(d, x, LANE + 68, x + 2, LANE + 100, mix('#8F97AC', P['rock'], 0.5))
    R(d, 0, LANE + 100, W, WIN_BOTTOM + 40, P['rock'])
    for i in range(34):                                                                                          # feathers drifting down
        x, y = int(h01(i * 2.7) * W), LANE + 112 + int(h01(i * 6.1) * (WIN_BOTTOM - LANE - 120))
        R(d, x, y, x + 8, y + 1, a('#FFFFFF', 120)); R(d, x + 2, y - 2, x + 6, y - 1, a('#FFFFFF', 80)); R(d, x + 2, y + 2, x + 6, y + 3, a('#FFFFFF', 80))
    sheep(d, 300, LANE, puff='#FFF4DC')
    gx = 1012                                                                                                    # an obstacle from his shelf: three books
    for k, (c, wdt) in enumerate(((QUILT[0], 70), (QUILT[3], 60), (QUILT[2], 66))):
        y = LANE - 24 - k * 24; R(d, gx - wdt // 2 + 30, y, gx + wdt // 2 + 30, y + 22, c); R(d, gx - wdt // 2 + 34, y + 4, gx + wdt // 2 + 26, y + 18, '#F4F0EA')
        R(d, gx - wdt // 2 + 30, y, gx - wdt // 2 + 40, y + 22, c)
    lantern_pair(d, (gx, gx + 54), LANE, 72); sign(d, gx + 30, LANE, 'STR')
    words = {'HACK': (150, 96), 'TACH': (330, 150), 'OTTER': (420, 60), 'JUMPY': (760, 130), 'CARD': (210, 210), 'PLUM': (560, 196)}
    if finale: words = {'HACK': (150, 96), 'TACH': (300, 150), 'OTTER': (120, 180), 'JUMPY': (900, 110), 'CARD': (1180, 96), 'PLUM': (1060, 200)}
    return im, dict(count=27 if finale else 19, card='Nearly out cold' if finale else 'Deep dream', locked='STR', typed='AW', words=words, filled=27 if finale else 19)


# ------------------------------------------------------------------ the frame round the dream
def bedroom(o, P):
    y0 = H - BED - 30
    R(o, 0, y0, W, H, '#3B2A2E')
    for y in range(y0, H - 86, 26): R(o, 0, y, W, y + 1, '#31222A')
    R(o, 0, H - 86, W, H - 80, '#55604F'); R(o, 0, H - 80, W, H - 16, '#2F3D36')
    for x in range(0, W, 34): R(o, x, H - 80, x + 1, H - 16, '#27332D')
    R(o, 0, H - 16, W, H, '#2A1D1F')
    R(o, 1236, 716, 1400, 812, '#5A4038'); R(o, 1244, 724, 1392, 804, '#1B2742'); R(o, 1316, 724, 1320, 804, '#5A4038'); R(o, 1244, 790, 1392, 804, '#DDE3F2')
    o.ellipse([1340, 734, 1364, 758], fill='#FFE9A8')

    def T(x, y): return (34 + (x - 34) * 1.2, 884 - (884 - y) * 1.1)
    def br(b, fill): o.rectangle(sorted_box(T(b[0], b[1]) + T(b[2], b[3])), fill=fill)
    def sorted_box(b): return [min(b[0], b[2]), min(b[1], b[3]), max(b[0], b[2]), max(b[1], b[3])]
    br([34, 712, 54, 884], '#5B3923'); br([28, 704, 60, 716], '#6E4D38'); br([54, 846, 470, 868], '#6E4D38'); br([54, 818, 470, 846], '#D9D3CC')
    br([470, 770, 488, 884], '#5B3923'); br([464, 762, 494, 774], '#6E4D38'); br([62, 800, 168, 820], '#F4F0EA'); br([62, 816, 168, 820], '#CFC8C0')
    for i in range(7):                                                                                           # his quilt: the dream's patches come from here
        c = QUILT[[0, 1, 2, 3, 4, 1, 0][i]]; x = 176 + i * 42; top = 778 - (10 if 1 <= i <= 3 else 0) - (6 if i == 6 else 0)
        br([x, top, x + 41, 846], c); br([x, top, x + 41, top + 3], mix(c, '#FFFFFF', 0.25)); br([x, 826, x + 41, 846], mix(c, '#000000', 0.18))
    br([92, 760, 140, 802], '#E3C6AB'); br([70, 756, 96, 804], '#E1DAD0'); br([94, 756, 98, 804], '#B5594C')                      # the farmer
    br([56, 770, 72, 790], '#E1DAD0'); br([50, 790, 62, 794], '#B5594C'); br([46, 794, 62, 808], '#E9E3DA')
    br([116, 750, 126, 760], '#D6B596'); br([106, 766, 114, 768], '#3D2818'); br([104, 760, 116, 763], '#7A6C5C')
    br([128, 756, 150, 802], '#B9B2A6'); br([150, 764, 168, 800], '#B9B2A6'); br([168, 772, 178, 796], '#A69E92'); br([132, 754, 136, 757], '#6A5142')
    br([180, 764, 262, 780], '#E6DFD3')
    for sx in range(188, 262, 12): br([sx, 764, sx + 2, 780], '#8F97AC')
    br([262, 764, 280, 780], '#E3C6AB')
    br([500, 824, 560, 884], '#6E4D38'); br([494, 818, 566, 826], '#81614E')                                                     # nightstand, candle, clock
    o.ellipse(sorted_box(T(488, 760) + T(568, 836)), fill=a(TOK['lantern'], 38))
    br([522, 796, 532, 818], '#F4F0EA'); br([524, 784, 530, 796], TOK['lanternHi']); br([540, 800, 558, 818], '#C9A24F'); br([543, 804, 555, 814], '#F4F0EA')
    R(o, 596, 746, 680, 752, '#81614E')                                                                                          # the shelf: the dream's books come from here
    for i, (c, wd) in enumerate(((QUILT[0], 12), (QUILT[3], 10), (QUILT[2], 14), (QUILT[4], 10), ('#E6DCC6', 12))):
        R(o, 602 + i * 15, 716 + (i % 2) * 4, 602 + i * 15 + wd, 746, c)
    R(o, 606, 860, 668, 884, '#9B704C'); R(o, 602, 856, 672, 862, '#81614E')                                                      # the knitting basket: the dream's yarn comes from here
    yarn(o, 626, 852, 13); o.line([648, 858, 664, 824], fill='#B8B0A6', width=3); o.line([656, 858, 644, 826], fill='#B8B0A6', width=3)
    o.text((176, 716), 'z', font=F(SERIF, 18), fill=TOK['woolHi']); o.text((150, 730), 'z', font=F(SERIF, 14), fill=TOK['woolHi'])


def frame(dream, info, stage, name):
    P = STAGES[stage]; d = ImageDraw.Draw(dream, 'RGBA')
    for word, (x, y) in info['words'].items(): dots_word(d, word, x, y, a(TOK['frost'], 235))
    f12, f22 = F(SANS, 12), F(SERIF, 26)                                                                          # counters
    R(d, 26, 26, 232, 56, TOK['ink']); d.ellipse([36, 33, 52, 49], fill=TOK['lanternHi']); d.ellipse([42, 31, 56, 45], fill=TOK['ink'])
    d.text((62, 33), "Tonight's dream · Nov 24", font=f12, fill=TOK['wool'])
    tx = W // 2 - 190
    for i in range(30):
        x = tx + i * 12 + (10 if i >= 5 else 0) + (10 if i >= 16 else 0)
        R(d, x - 1, 33, x + 9, 43, TOK['ink']); R(d, x, 34, x + 8, 42, TOK['lantern'] if i < info['filled'] else TOK['nightDeep'])
        if i == info['filled']: R(d, x, 34, x + 8, 42, TOK['lanternHi'])
    R(d, W - 190, 24, W - 84, 66, TOK['ink']); R(d, W - 187, 27, W - 87, 60, TOK['night2']); R(d, W - 178, 34, W - 160, 52, TOK['wool'])
    cw = d.textlength(str(info['count']), font=f22); R(d, W - 200, 24, W - 84, 66, TOK['ink']); R(d, W - 197, 27, W - 87, 60, TOK['night2']); R(d, W - 190, 34, W - 172, 52, TOK['wool'])
    d.text((W - 164, 28), str(info['count']), font=f22, fill=TOK['wool']); d.text((W - 160 + cw, 40), 'of 30', font=f12, fill=TOK['frost'])
    tile(d, W - 70, 24, 40, 'wool', '×', F(SANS, 22))
    if info['card']:
        R(d, W // 2 - 110, 62, W // 2 + 110, 100, TOK['ink']); R(d, W // 2 - 110, 62, W // 2 - 105, 100, TOK['lantern'])
        d.text((W // 2 - 92, 71), info['card'], font=F(SERIF, 17), fill=TOK['wool'])
    out = Image.new('RGB', (W, H), '#1E1518'); o = ImageDraw.Draw(out, 'RGBA'); bedroom(o, P)
    s = 3; m = Image.new('L', (W // s, H // s), 0); md = ImageDraw.Draw(m)                                        # the thought bubble, stepped
    md.rectangle([10 // s, 10 // s, (W - 10) // s, (WIN_BOTTOM - 30) // s], fill=255)
    x, k = 10, 0
    while x < W - 10:
        w_ = [72, 48, 60, 40][k % 4]
        md.ellipse([x // s, (WIN_BOTTOM - 30 - w_ // 2) // s, (x + w_) // s, (WIN_BOTTOM - 30 + w_ // 2) // s], fill=255); x += w_ - 6; k += 1
    m = m.resize((W, H), Image.NEAREST); rim = m.filter(ImageFilter.MaxFilter(13)); shade = Image.new('L', (W, H), 0); shade.paste(rim, (0, 4))
    out.paste(Image.new('RGB', (W, H), TOK['frost']), (0, 0), shade); out.paste(Image.new('RGB', (W, H), TOK['woolHi']), (0, 0), rim); out.paste(dream, (0, 0), m)
    o = ImageDraw.Draw(out, 'RGBA')
    for (cx, cy, r) in [(236, 690, 21), (212, 716, 13), (196, 736, 8)]:
        R(o, cx - r, cy - r + 3, cx + r, cy + r + 3, TOK['frost']); R(o, cx - r, cy - r, cx + r, cy + r, TOK['woolHi']); R(o, cx - r + 4, cy - r + 4, cx + r - 4, cy + r - 4, P['sky'][3])
    n = len(info['locked']) + len(info['typed']) + 3                                                              # the tray
    cx = (700 + W) // 2; tw = 44 + n * 54 + 130; ty = 786; x0 = cx - tw // 2
    R(o, x0 - 3, ty - 3, x0 + tw + 2, ty + 106, TOK['ink']); R(o, x0, ty + 96, x0 + tw - 1, ty + 103, TOK['nightDeep']); R(o, x0, ty, x0 + tw - 1, ty + 95, TOK['night'])
    quilt_band(o, x0, ty, x0 + tw - 1)
    f = F(SERIF, 30); tx = x0 + 22; i = 0
    for ch in info['locked']: tile(o, tx + i * 54, ty + 20, 44, 'lantern', ch, f); i += 1
    for ch in info['typed']: tile(o, tx + i * 54, ty + 20, 44, 'wool', ch, f); i += 1
    slot(o, tx + i * 54, ty + 20, 44, ring=True); slot(o, tx + (i + 1) * 54, ty + 20, 44); slot(o, tx + (i + 2) * 54, ty + 20, 44)
    jx = x0 + tw - 128
    R(o, jx - 3, ty + 17, jx + 108, ty + 73, TOK['ink']); R(o, jx, ty + 64, jx + 105, ty + 70, TOK['lanternLip']); R(o, jx, ty + 20, jx + 105, ty + 63, TOK['lantern']); R(o, jx, ty + 20, jx + 105, ty + 22, TOK['lanternHi'])
    o.text((jx + 22, ty + 28), 'Jump', font=F(SERIF, 22), fill=TOK['ink'])
    segs = (tw - 44 - 130) // 27
    for k in range(segs): R(o, tx + k * 27, ty + 82, tx + k * 27 + 22, ty + 89, TOK['lantern'] if k < segs * 0.62 else TOK['nightDeep'])
    out.save(os.path.join(ROOT, 'reference', name)); return out


# ------------------------------------------------------------------ phone
def phone():
    PW, PH, KB = 390, 844, 300
    P = STAGES[2]; vis = PH - KB; win_b = vis - 150; lane = 6 + int((win_b - 6) * 0.70)
    im, d = sky(P, PW, PH, lane, stars=70)
    d.ellipse([292, 70, 350, 128], fill='#FFE9A8')
    for x in range(30, 250, 8):
        hgt = 26 + 14 * math.sin(x / 34) + 8 * math.sin(x / 11); top = 150 - hgt
        col = mix('#9CCB78', '#6FC7D6', x / 250); R(d, x, top, x + 5, top + hgt, col + (95,)); R(d, x, top, x + 5, top + 4, col + (200,))
    island(d, 96, 176, 84, P, 0.5, 'house')
    R(d, 0, lane, PW, lane + 8, P['snow']); R(d, 0, lane + 8, PW, lane + 11, P['shade']); R(d, 0, lane + 11, PW, lane + 30, P['soil']); R(d, 0, lane + 30, PW, lane + 44, P['soil2'])
    for x in range(0, PW, 10):
        dep = max(6, int((22 + 14 * math.sin(x / 90) + 9 * math.sin(x / 28)) // 6) * 6); R(d, x, lane + 44, x + 9, lane + 44 + dep, P['rock'])
    for i in range(16):
        x = int(h01(i * 3.1) * PW); y = lane + 74 + int(h01(i * 7.7) * 30); R(d, x, y, x + 60, y + 1, a(P['mist'], 90))
    R(d, 70, lane - 34, 114, lane - 9, '#F7F4FB'); R(d, 110, lane - 40, 126, lane - 24, '#F2C9B8')
    for lx in (74, 84, 100, 108): R(d, lx, lane - 9, lx + 3, lane, '#D9B79A')
    px = 300; R(d, px, lane - 40, px + 5, lane, '#6E4D38'); R(d, px + 30, lane - 40, px + 35, lane, '#6E4D38')
    for ry in (lane - 32, lane - 20, lane - 8): R(d, px - 3, ry, px + 38, ry + 4, '#9B704C')
    R(d, px + 15, lane - 130, px + 19, lane - 36, '#6E4D38')
    R(d, px - 22, lane - 138, px + 58, lane - 78, TOK['ink']); R(d, px - 20, lane - 136, px + 56, lane - 80, TOK['night2'])
    f = F(SERIF, 20)
    for i, ch in enumerate('CA'): tile(d, px - 14 + i * 36, lane - 130, 30, 'lantern', ch, f, side=4)
    R(d, px - 14, lane - 92, px + 50, lane - 84, TOK['nightDeep'])
    dots_word(d, 'HACK', 26, 96, a(TOK['frost'], 235), pitch=3); dots_word(d, 'WREN', 190, 70, a(TOK['frost'], 235), pitch=3)
    R(d, 14, 14, 110, 38, TOK['ink']); d.text((22, 19), 'Nov 24', font=F(SANS, 11), fill=TOK['wool'])
    R(d, PW - 130, 12, PW - 62, 44, TOK['ink']); R(d, PW - 128, 14, PW - 64, 40, TOK['night2']); d.text((PW - 104, 14), '6', font=F(SERIF, 20), fill=TOK['wool'])
    tile(d, PW - 52, 12, 36, 'wool', '×', F(SANS, 18), side=4)
    for i in range(30):
        x = 18 + i * 9 + (6 if i >= 5 else 0) + (6 if i >= 16 else 0); R(d, x, 52, x + 5, 57, TOK['lantern'] if i < 6 else TOK['nightDeep'])
    R(d, 12, win_b - 50, PW - 12, win_b - 14, TOK['ink']); R(d, 12, win_b - 50, 17, win_b - 14, TOK['lantern'])                    # the hint, inside the window
    d.text((26, win_b - 46), 'Now two letters: start your word with', font=F(SANS, 10), fill=TOK['frost']); d.text((26, win_b - 32), 'all of them, like GRASS for GR.', font=F(SANS, 10), fill=TOK['frost'])
    out = Image.new('RGB', (PW, PH), '#1E1518'); o = ImageDraw.Draw(out, 'RGBA')
    R(o, 0, win_b - 20, PW, vis, '#3B2A2E'); R(o, 0, vis - 96, PW, vis - 92, '#55604F')
    m = Image.new('L', (PW // 3, PH // 3), 0); md = ImageDraw.Draw(m); md.rectangle([2, 2, (PW - 6) // 3, (win_b - 16) // 3], fill=255)
    x, k = 6, 0
    while x < PW - 6:
        w_ = [48, 32, 40, 28][k % 4]; md.ellipse([x // 3, (win_b - 16 - w_ // 2) // 3, (x + w_) // 3, (win_b - 16 + w_ // 2) // 3], fill=255); x += w_ - 4; k += 1
    m = m.resize((PW, PH), Image.NEAREST); rim = m.filter(ImageFilter.MaxFilter(9))
    out.paste(Image.new('RGB', (PW, PH), TOK['woolHi']), (0, 0), rim); out.paste(im, (0, 0), m); o = ImageDraw.Draw(out, 'RGBA')
    sy = win_b + 6                                                                                                # bed strip: head and shoulders only
    R(o, 8, sy + 30, 180, sy + 56, '#D9D3CC'); R(o, 10, sy + 18, 70, sy + 34, '#F4F0EA'); R(o, 34, sy + 2, 70, sy + 32, '#E3C6AB'); R(o, 16, sy, 38, sy + 34, '#E1DAD0'); R(o, 36, sy, 39, sy + 34, '#B5594C')
    R(o, 60, sy, 80, sy + 32, '#B9B2A6'); R(o, 80, sy + 6, 96, sy + 30, '#B9B2A6'); R(o, 52, sy - 5, 60, sy + 2, '#D6B596'); R(o, 44, sy + 8, 50, sy + 9, '#3D2818')
    for i in range(3): R(o, 100 + i * 28, sy + 12, 126 + i * 28, sy + 56, QUILT[i])
    R(o, 196, sy + 30, 204, sy + 50, '#F4F0EA'); R(o, 198, sy + 20, 202, sy + 30, TOK['lanternHi']); o.ellipse([176, sy + 4, 224, sy + 52], fill=a(TOK['lantern'], 40))
    for (cx_, cy_, r) in [(92, win_b - 2, 9), (80, win_b + 2, 5)]: R(o, cx_ - r, cy_ - r, cx_ + r, cy_ + r, TOK['woolHi'])
    ty = vis - 90                                                                                                 # tray
    R(o, 6, ty, PW - 6, ty + 84, TOK['ink']); R(o, 8, ty + 2, PW - 8, ty + 78, TOK['night']); quilt_band(o, 8, ty + 2, PW - 8, 5, 14)
    f = F(SERIF, 19)
    for i, (ch, kind) in enumerate((('C', 'lantern'), ('A', 'lantern'), ('R', 'wool'), ('D', 'wool'))): tile(o, 20 + i * 36, ty + 18, 28, kind, ch, f, side=4)
    slot(o, 20 + 4 * 36, ty + 18, 28, ring=True, side=4); slot(o, 20 + 5 * 36, ty + 18, 28, side=4); slot(o, 20 + 6 * 36, ty + 18, 28, side=4)
    R(o, PW - 86, ty + 14, PW - 16, ty + 54, TOK['ink']); R(o, PW - 84, ty + 16, PW - 18, ty + 46, TOK['lantern']); R(o, PW - 84, ty + 46, PW - 18, ty + 50, TOK['lanternLip'])
    o.text((PW - 68, ty + 22), '↵', font=F(SANS, 18), fill=TOK['ink'])
    for k in range(12): R(o, 20 + k * 21, ty + 62, 20 + k * 21 + 17, ty + 68, TOK['lantern'] if k < 7 else TOK['nightDeep'])
    R(o, 0, vis, PW, PH, '#2B2F3A')                                                                               # the phone's keyboard (not ours)
    for r_, row in enumerate(('QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM')):
        kw = 34; x0 = (PW - len(row) * (kw + 4)) // 2
        for i, ch in enumerate(row):
            R(o, x0 + i * (kw + 4), vis + 14 + r_ * 54, x0 + i * (kw + 4) + kw, vis + 58 + r_ * 54, '#4A4F5C'); o.text((x0 + i * (kw + 4) + 11, vis + 26 + r_ * 54), ch, font=F(SANS, 14), fill='#E8EAF0')
    R(o, 96, vis + 180, 294, vis + 224, '#4A4F5C')
    out.save(os.path.join(ROOT, 'reference', 'sketch-phone.png'))


# ------------------------------------------------------------------ results board
def results():
    out = Image.new('RGB', (W, H), '#4A3328'); o = ImageDraw.Draw(out, 'RGBA')
    for y in range(0, 520, 64): R(o, 0, y, W, y + 3, '#3E2A21')
    R(o, 0, 520, W, 760, '#55684F')
    for x in range(0, W, 56): R(o, x, 520, x + 3, 760, '#49593F')
    R(o, 0, 500, W, 524, '#E0D6C2'); R(o, 0, 760, W, H, '#3A2218')
    R(o, 60, 150, 330, 420, '#5A4038'); R(o, 74, 164, 316, 406, '#1B2742'); R(o, 190, 164, 198, 406, '#5A4038'); R(o, 74, 330, 316, 406, '#DDE3F2'); o.ellipse([230, 190, 280, 240], fill='#FFE9A8')
    R(o, 250, 440, 290, 800, '#5B3923'); R(o, 290, 640, 880, 700, '#E4DED6'); R(o, 290, 700, 880, 760, '#6E4D38'); R(o, 880, 560, 920, 800, '#5B3923')
    for i in range(6):
        c = QUILT[[0, 1, 2, 3, 4, 1][i]]; R(o, 470 + i * 68, 600, 536 + i * 68, 700, c); R(o, 470 + i * 68, 600, 536 + i * 68, 606, mix(c, '#FFFFFF', 0.25))
    R(o, 300, 600, 420, 640, '#F4F0EA'); R(o, 340, 540, 420, 612, '#E3C6AB'); R(o, 300, 532, 348, 616, '#E1DAD0'); R(o, 344, 532, 351, 616, '#B5594C')       # farmer, asleep
    R(o, 398, 544, 440, 616, '#B9B2A6'); R(o, 440, 560, 470, 610, '#B9B2A6'); R(o, 372, 524, 392, 540, '#D6B596'); R(o, 404, 536, 414, 546, '#6A5142'); R(o, 356, 556, 370, 559, '#3D2818')
    R(o, 470, 566, 600, 596, '#E6DFD3')
    for sx in range(482, 600, 20): R(o, sx, 566, sx + 4, 596, '#8F97AC')
    o.text((430, 470), 'Z', font=F(SERIF, 40), fill=TOK['woolHi']); o.text((396, 500), 'z', font=F(SERIF, 26), fill=TOK['woolHi'])
    bx, by, bw, bh = W - 24 - 420, 110, 420, 680                                                                  # the board
    R(o, bx - 3, by - 3, bx + bw + 2, by + bh + 8, TOK['ink']); R(o, bx, by + bh, bx + bw - 1, by + bh + 5, TOK['nightDeep']); R(o, bx, by, bx + bw - 1, by + bh - 1, TOK['night'])
    quilt_band(o, bx, by, bx + bw - 1, 10, 22)
    for sx in range(bx + 6, bx + bw - 4, 9): R(o, sx, by + 10, sx + 1, by + 13, TOK['wool'])
    R(o, bx - 9, by + 30, bx + 300, by + 70, TOK['ink']); R(o, bx - 7, by + 32, bx + 298, by + 68, TOK['lantern']); o.text((bx + 16, by + 38), 'The farmer drifted off', font=F(SERIF, 20), fill=TOK['ink'])
    y = by + 92                                                                                                   # the count, on a nightshirt pocket
    R(o, bx + 20, y, bx + 120, y + 88, TOK['ink']); R(o, bx + 22, y + 2, bx + 118, y + 86, '#E6DFD3')
    for sx in range(bx + 30, bx + 118, 16): R(o, sx, y + 2, sx + 1, y + 86, '#8F97AC')
    o.text((bx + 38, y + 10), '30', font=F(SERIF, 44), fill=TOK['ink']); o.text((bx + 50, y + 64), 'sheep', font=F(SANS, 12), fill='#4A4258')
    for i, t in enumerate(('Asleep after 30 fences', 'No bumps', 'Longest word: 5 letters')): o.text((bx + 138, y + 10 + i * 24), t, font=F(SANS, 13), fill=TOK['wool'])
    y += 106; o.text((bx + 20, y), 'Your night sky', font=F(SANS, 11), fill=TOK['frost'])                         # the night sky
    P = STAGES[3]; R(o, bx + 20, y + 18, bx + bw - 21, y + 114, P['sky'][1]); R(o, bx + 20, y + 66, bx + bw - 21, y + 114, P['sky'][2])
    o.ellipse([bx + bw - 86, y + 28, bx + bw - 40, y + 74], fill='#FFE9A8')
    for i, wd in enumerate(('HACK', 'TACH', 'WREN', 'OTTER', 'CARD', 'PLUM', 'STRAW', 'GRAN', 'JUMPY', 'SLEEP', 'ROAR', 'TRAY')):
        dots_word(o, wd, bx + 30 + (i % 4) * 82 + (i // 4) * 8, y + 28 + (i // 4) * 28, a(TOK['frost'], 235), pitch=3)
    y += 132; R(o, bx + 20, y, bx + bw - 21, y + 116, TOK['night2']); R(o, bx + 20, y, bx + bw - 21, y + 2, TOK['night3'])     # streak
    o.text((bx + 34, y + 12), '9-night streak', font=F(SERIF, 17), fill=TOK['wool']); o.text((bx + bw - 86, y + 16), 'best 9', font=F(SANS, 11), fill=TOK['frost'])
    for i in range(7):
        x = bx + 34 + i * 30
        if i < 2: tile(o, x, y + 44, 24, 'lantern', '✓', F(SANS, 14), side=3)
        else: slot(o, x, y + 44, 24, ring=(i == 2), side=3)
    o.text((bx + 34, y + 84), 'Every 7 nights earns a Warm Blanket.', font=F(SANS, 11), fill=TOK['frost']); o.text((bx + 34, y + 98), 'It saves your streak if you miss a night.', font=F(SANS, 11), fill=TOK['frost'])
    y += 132; R(o, bx + 20, y, bx + bw - 21, y + 84, TOK['night2']); R(o, bx + 20, y, bx + bw - 21, y + 2, TOK['night3'])      # coins
    R(o, bx + 34, y + 14, bx + 52, y + 32, TOK['lantern']); o.text((bx + 62, y + 12), '+50 Wool Coins', font=F(SERIF, 17), fill=TOK['wool'])
    for i, (t, v) in enumerate((('30 sheep counted', '+30'), ('The farmer slept', '+20'))):
        o.text((bx + 34, y + 42 + i * 18), t, font=F(SANS, 12), fill=TOK['frost']); o.text((bx + bw - 62, y + 42 + i * 18), v, font=F(SANS, 12), fill=TOK['wool'])
    y += 100
    for i, (t, kind, wd) in enumerate((('Share', 'lantern', 96), ('Practice', 'wool', 108), ('Back to the farm', 'wool', 172))):
        x = bx + 20 + [0, 100, 212][i]; face, hi, lip = (TOK['lantern'], TOK['lanternHi'], TOK['lanternLip']) if kind == 'lantern' else (TOK['wool'], TOK['woolHi'], TOK['woolLip'])
        R(o, x - 2, y - 2, x + wd - 6, y + 46, TOK['ink']); R(o, x, y + 38, x + wd - 9, y + 43, lip); R(o, x, y, x + wd - 9, y + 37, face); R(o, x, y, x + wd - 9, y + 2, hi)
        o.text((x + 12, y + 10), t, font=F(SERIF, 13), fill=TOK['ink'])
    o.text((bx + 20, y + 58), 'The next dream arrives at 12:00 am.', font=F(SANS, 11), fill=TOK['frost'])
    out.save(os.path.join(ROOT, 'reference', 'sketch-results.png'))


if __name__ == '__main__':
    for n, fn in ((1, stage1), (2, stage2), (3, stage3)):
        im, info = fn(); frame(im, info, n, f'sketch-stage-{n}.png')
    im, info = stage3(finale=True); frame(im, info, 3, 'sketch-finale.png')
    phone(); results()
    print('sketches written')

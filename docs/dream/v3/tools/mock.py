"""Draws the interface of files 05 and 06 over a rendered dream window, and builds whole-screen pictures.
Sizes are the plan's own, at 1440 x 900."""
import json
import os

from PIL import Image, ImageDraw, ImageFont

from ladder import tok

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTS = os.environ.get('DREAM_FONTS', '/tmp/fontsrc')     # a folder holding Fraunces 800 and Nunito 700/800 (.woff or .ttf)


def _find(name, fallback):
    for root, _, files in os.walk(FONTS):
        for f in files:
            if f.lower().startswith(name) and f.lower().endswith(('.woff', '.ttf')):
                return os.path.join(root, f)
    return fallback


FR = _find('fraunces-latin-800-normal', 'DejaVuSerif-Bold.ttf')
NU8 = _find('nunito-latin-800-normal', 'DejaVuSans-Bold.ttf')
NU7 = _find('nunito-latin-700-normal', 'DejaVuSans-Bold.ttf')
T = {'night': '#1B2742', 'night2': '#26365C', 'night3': '#34497A', 'nightDeep': '#141D36', 'ink': '#0E1528',
     'wool': '#FFF4DC', 'woolHi': '#FFFDF4', 'woolLip': '#D8C49A', 'lantern': '#F2A444', 'lanternHi': '#FFD98A',
     'lanternLip': '#B96F1E', 'frost': '#B9C8E6', 'ember': '#F48C6E'}
QUILT_BAND = ['scarfRed:0', 'trimWhite:0', 'coopYellow:0', 'trimWhite:0', 'giftGreen:0', 'trimWhite:0', 'slate:0', 'trimWhite:0']


def F(path, size):
    return ImageFont.truetype(path, size)


def lighten(h, t):
    h = h.lstrip('#')
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    return '#%02X%02X%02X' % tuple(int(round(v + (255 - v) * t)) for v in (r, g, b))


def prect(d, x0, y0, x1, y1, fill, step=2, n=1):
    """A rectangle with pixel-stepped corners: n steps of `step` px."""
    for i in range(n + 1):
        inset = (n - i) * step
        d.rectangle([x0 + inset, y0 + i * step, x1 - inset - 1, y1 - i * step - 1], fill=fill)


def grid(d, x, y, rows, px, colours):
    for r, row in enumerate(rows):
        for c, ch in enumerate(row):
            if ch != '.':
                d.rectangle([x + c * px, y + r * px, x + (c + 1) * px - 1, y + (r + 1) * px - 1], fill=colours[ch])


ART = json.load(open(os.path.join(ROOT, 'data', 'pixel-art.json')))['grids']


def slab(d, x, y, w, h, side, face, lip, outline=T['ink']):
    prect(d, x - 2, y - 2, x + w + 2, y + h + side + 2, outline, 2, 1)
    d.rectangle([x, y + h, x + w - 1, y + h + side - 1], fill=lip)
    d.rectangle([x, y, x + w - 1, y + h - 1], fill=face)
    d.rectangle([x, y, x + w - 1, y + 1], fill=lighten(face, 0.35))


def tile(d, x, y, s, ch, kind='lantern', side=6, size=None):
    face, lip = {'lantern': (T['lantern'], T['lanternLip']), 'wool': (T['wool'], T['woolLip']), 'ember': (T['ember'], '#B9543A')}[kind]
    slab(d, x, y, s, s, side, face, lip)
    if ch:
        f = F(FR, size or int(s * 0.66))
        bb = d.textbbox((0, 0), ch, font=f)
        d.text((x + (s - (bb[2] - bb[0])) / 2 - bb[0], y + (s - (bb[3] - bb[1])) / 2 - bb[1]), ch, font=f, fill=T['ink'])


def sunk(d, x, y, s, ring=False):
    d.rectangle([x, y, x + s - 1, y + s - 1], fill=T['nightDeep'])
    d.rectangle([x, y, x + s - 1, y + 1], fill=T['ink'])
    d.rectangle([x + s // 2 - 8, y + s - 9, x + s // 2 + 7, y + s - 7], fill=T['night3'])
    if ring:
        for (a, b) in ((x - 2, y - 2), (x + s - 4, y - 2), (x - 2, y + s - 4), (x + s - 4, y + s - 4)):
            d.rectangle([a, b, a + 5, b + 5], fill=T['lantern'])
        d.rectangle([x, y, x + s - 1, y + s - 1], fill=T['nightDeep'])
        d.rectangle([x + s // 2 - 8, y + s - 9, x + s // 2 + 7, y + s - 7], fill=T['night3'])
        d.rectangle([x + s // 2 - 1, y + 8, x + s // 2 + 1, y + s - 9], fill=T['lanternHi'])


def quilt_band(d, x, y, w, h=8, n=None):
    """Whole squares only: the squares' width is the board's width over a whole number."""
    n = n or max(8, round(w / 26))
    for i in range(n):
        x0 = x + round(i * w / n)
        x1 = x + round((i + 1) * w / n)
        c = tok(QUILT_BAND[i % 8])
        d.rectangle([x0, y, x1 - 1, y + h - 1], fill=c)
        d.rectangle([x0, y, x1 - 1, y + 1], fill=lighten(c, 0.25))
        d.rectangle([x1 - 1, y, x1 - 1, y + h - 1], fill=T['ink'])
    d.rectangle([x, y + h, x + w - 1, y + h], fill=T['ink'])


def hud(img, count, best, date='Nov 24', new_best=False, short=False):
    """The chip, the counter with the best score under it, the close button. No stage meter."""
    d = ImageDraw.Draw(img)
    W = img.width
    # chip
    f13 = F(NU8, 13)
    txt = date if short else "Tonight's dream: " + date
    tw = d.textlength(txt, font=f13)
    prect(d, 18, 18, 18 + 38 + tw + 14, 48, T['ink'], 2, 1)
    grid(d, 28, 25, ART['moon-small']['rows'], 2, {'X': T['lanternHi']})
    d.text((52, 23), txt, font=f13, fill=T['wool'])
    # close
    cx = W - 18 - 40
    slab(d, cx, 18, 40, 36, 4, T['night2'], T['nightDeep'])
    for i in range(7):
        d.rectangle([cx + 13 + i * 2, 29 + i * 2, cx + 14 + i * 2, 30 + i * 2], fill=T['wool'])
        d.rectangle([cx + 25 - i * 2, 29 + i * 2, cx + 26 - i * 2, 30 + i * 2], fill=T['wool'])
    # counter
    f28 = F(FR, 28)
    s = str(count)
    nw = d.textlength(s, font=f28)
    w = 12 + 33 + 10 + nw + 16
    x = cx - 12 - w
    slab(d, x, 18, w, 36, 4, T['night2'], T['nightDeep'])
    grid(d, x + 12, 23, ART['sheep-head']['rows'], 3, {'X': T['wool'], 'o': T['ink'], 'p': '#E8B1AC', 'w': T['woolHi']})
    d.text((x + 55, 16), s, font=f28, fill=T['woolHi'])
    # the best score, a tab hung under the counter
    f12 = F(NU8, 12)
    bt = 'New best' if new_best else 'Best %d' % best
    bw = d.textlength(bt, font=f12) + 20
    bx = x + (w - bw) / 2
    prect(d, bx, 62, bx + bw, 84, T['lantern'] if new_best else T['ink'], 2, 1)
    d.text((bx + 10, 65), bt, font=f12, fill=T['ink'] if new_best else T['frost'])
    return img


def sign(img, x, y, letters, word=None, scale=1.0):
    """The sign's board, level, hung from the two chain ends at (x, y) and (x + 144 * scale, y)."""
    d = ImageDraw.Draw(img)
    n = len(letters)
    ts = 42
    w = 20 + n * ts + (n - 1) * 8 + 14 + 3 * 10 + 2 * 4 + 20
    w = max(w, 150)
    h = 12 + ts + 6 + 10 + 20 + 12
    cx = x + 72 * scale
    bx, by = int(cx - w / 2), int(y)
    d.rectangle([bx + 14, by - 8, bx + 15, by], fill='#4A403C')
    d.rectangle([bx + w - 16, by - 8, bx + w - 15, by], fill='#4A403C')
    prect(d, bx - 2, by - 2, bx + w + 2, by + h + 8, T['ink'], 2, 1)
    d.rectangle([bx, by + h, bx + w - 1, by + h + 5], fill=T['nightDeep'])
    d.rectangle([bx, by, bx + w - 1, by + h - 1], fill=T['night2'])
    d.rectangle([bx, by, bx + w - 1, by + 1], fill=T['night3'])
    tx = bx + 20
    for ch in letters:
        tile(d, tx, by + 12, ts, ch, 'lantern', 6, 28)
        tx += ts + 8
    tx += 6
    for i in range(3):
        d.rectangle([tx + i * 14, by + 12 + 20, tx + i * 14 + 9, by + 12 + 29], fill=T['nightDeep'])
    py = by + 12 + ts + 6 + 10
    d.rectangle([bx + 10, py, bx + w - 11, py + 19], fill=T['nightDeep'])
    d.rectangle([bx + 10, py, bx + w - 11, py + 1], fill=T['ink'])
    if word:
        f = F(FR, 12)
        ww = len(word) * 15 - 1
        wx = bx + (w - ww) // 2
        for ch in word:
            d.rectangle([wx, py + 3, wx + 13, py + 16], fill=T['wool'])
            bb = d.textbbox((0, 0), ch, font=f)
            d.text((wx + (14 - (bb[2] - bb[0])) / 2 - bb[0], py + 3 + (14 - (bb[3] - bb[1])) / 2 - bb[1]), ch, font=f, fill=T['ink'])
            wx += 15
    return img


def pop(img, x, y, text, gold=False):
    d = ImageDraw.Draw(img)
    f = F(FR, 44)
    for dx, dy in ((-2, 0), (2, 0), (0, -2), (0, 2), (2, 4)):
        d.text((x + dx, y + dy), text, font=f, fill=T['ink'])
    d.text((x, y), text, font=f, fill=T['lanternHi'] if gold else T['woolHi'])


def card(img, title, line2, icon='moon-small', y=92):
    d = ImageDraw.Draw(img)
    f17, f12 = F(FR, 17), F(NU8, 12)
    w = max(d.textlength(title, font=f17), d.textlength(line2, font=f12)) + 6 + 14 + 28 + 12 + 16
    x = (img.width - w) // 2
    prect(d, x, y, x + w, y + 54, T['ink'], 2, 1)
    d.rectangle([x, y + 2, x + 5, y + 51], fill=T['lantern'])
    rows = ART[icon]['rows']
    px = 24 // len(rows[0]) if len(rows[0]) <= 12 else 2
    grid(d, x + 20 + (24 - len(rows[0]) * px) // 2, y + 15 + (24 - len(rows) * px) // 2, rows, px, {'X': T['lanternHi'], 'o': T['ink'], 'r': '#BF6055', 'w': T['woolHi']})
    d.text((x + 56, y + 8), title, font=f17, fill=T['wool'])
    d.text((x + 56, y + 31), line2, font=f12, fill=T['frost'])


def tray(d, x, y, w, locked, typed='', meter=(11, 11), caret=True):
    h = 104
    prect(d, x - 2, y - 2, x + w + 2, y + h + 8, T['ink'], 2, 1)
    d.rectangle([x, y + h, x + w - 1, y + h + 5], fill=T['nightDeep'])
    d.rectangle([x, y, x + w - 1, y + h - 1], fill=T['night'])
    quilt_band(d, x, y, w, 8)
    tx, ty = x + 18, y + 24
    for ch in locked:
        tile(d, tx, ty, 40, ch, 'lantern', 6, 26); tx += 46
    for ch in typed:
        tile(d, tx, ty, 40, ch, 'wool', 6, 26); tx += 46
    for i in range(3):
        sunk(d, tx, ty, 40, ring=(i == 0 and caret)); tx += 46
    # Jump
    jx = x + w - 18 - 100
    slab(d, jx, ty, 100, 40, 6, T['lantern'], T['lanternLip'])
    grid(d, jx + 14, ty + 12, ART['return-key']['rows'], 2, {'X': T['ink']})
    d.text((jx + 40, ty + 8), 'Jump', font=F(FR, 18), fill=T['ink'])
    # fence meter
    my = y + 82
    n = meter[1]
    seg = 24
    for i in range(n):
        c = T['lantern'] if i < meter[0] else T['nightDeep']
        d.rectangle([x + 18 + i * (seg + 5), my, x + 18 + i * (seg + 5) + seg - 1, my + 7], fill=c)
        if i < meter[0]:
            d.rectangle([x + 18 + i * (seg + 5), my, x + 18 + i * (seg + 5) + seg - 1, my + 1], fill=T['lanternHi'])


def puff(d, cx, cy, r):
    """A round wool puff, pixel-stepped, with its shade under it."""
    import math
    step = 2
    for dy in range(-r, r + 4, step):
        for sh, col in ((4, T['woolLip']), (0, T['woolHi'])):
            yy = dy - sh
            if abs(yy) >= r:
                continue
            hw = int(math.sqrt(r * r - yy * yy) // step * step)
            d.rectangle([cx - hw, cy + dy, cx + hw - 1, cy + dy + step - 1], fill=col)


def window_frame(canvas, dream, x=10, y=10):
    """The dream window: a wool rim with pixel corners and a straight lower edge; its shade under it."""
    d = ImageDraw.Draw(canvas)
    w, h = dream.width, dream.height
    prect(d, x - 6, y - 6, x + w + 6, y + h + 10, T['woolLip'], 4, 3)
    prect(d, x - 6, y - 6, x + w + 6, y + h + 6, T['woolHi'], 4, 3)
    mask = Image.new('L', dream.size, 0)
    prect(ImageDraw.Draw(mask), 0, 0, w, h, 255, 4, 2)
    canvas.paste(dream, (x, y), mask)

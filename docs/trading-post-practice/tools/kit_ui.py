"""Shared drawing helpers for the reference pictures: fonts, the kit's colours, stepped rectangles, pixel grids, tiles."""
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

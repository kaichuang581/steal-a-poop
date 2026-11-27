"""The Trading Post's interface, drawn over the rendered market at the plan's sizes. Paper, yarn, chalk and wool tiles: no navy boards."""
import json
import os

from PIL import Image, ImageDraw

from kit_ui import F, FR, NU7, NU8, T, prect, grid, slab, lighten
from ladder import tok

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART = json.load(open(os.path.join(ROOT, 'data', 'pixel-art.json')))['grids']
PAPER, PAPER_LIP, INK, SOFT = '#FFF6E0', '#DCC9A0', '#2B2230', '#6B5B4B'
YARN, YARN_D = tok('scarfRed:0'), tok('scarfRed:-2')
CHALK = '#F3EEE6'
RARITY = {'starter': ('Starter', '#8E8A84'), 'common': ('Common', '#8E8A84'), 'uncommon': ('Uncommon', '#4E9A6A'), 'rare': ('Rare', '#4F86C6'),
          'legendary': ('Legendary', '#D9A02E'), 'bells': ('Bell Shelf', '#C98A1E'), 'mission': ('Mission', '#C8643C')}


def P(cam, x, y, z):
    sx, sy, _ = cam.px(x, y, z)
    return sx / cam.ss, sy / cam.ss


def text_c(d, cx, y, s, font, fill):
    d.text((cx - d.textlength(s, font=font) / 2, y), s, font=font, fill=fill)


def icon(d, x, y, name, px=2, col=None):
    rows = ART[name]['rows']
    cols = dict(col or {'X': INK})
    for ch in 'Xokrw':
        cols.setdefault(ch, cols.get('X', INK))
    grid(d, int(x), int(y), rows, px, cols)
    return len(rows[0]) * px, len(rows) * px


COIN = {'X': '#E0A93A', 'o': '#F7DE95', 'k': '#8A5F16'}
BELL = {'X': '#E0A93A', 'o': '#F7DE95', 'k': '#8A5F16'}


def tag(d, x, y, w, h, face=PAPER, lip=PAPER_LIP, hole=True, border=None, string_to=None):
    """A paper tag: clipped top corners, a punched hole, a yarn string up to where it hangs."""
    x, y, w, h = int(x), int(y), int(w), int(h)
    if string_to is not None:
        d.line([x + w // 2, y + 6, x + w // 2, string_to], fill=YARN, width=2)
    if border:
        prect(d, x - 3, y - 3, x + w + 3, y + h + 6, border, 2, 2)
    prect(d, x - 1, y - 1, x + w + 1, y + h + 4, INK, 2, 2)
    prect(d, x, y + 3, x + w, y + h + 3, lip, 2, 2)
    prect(d, x, y, x + w, y + h, face, 2, 2)
    if hole:
        d.rectangle([x + w // 2 - 2, y + 4, x + w // 2 + 1, y + 7], fill=INK)


def pips(d, x, y, kinds, found=()):
    for i, k in enumerate(kinds):
        c = RARITY[k][1]
        d.rectangle([x + i * 11, y, x + i * 11 + 7, y + 7], fill=c if i in found else lighten(c, 0.55))
        d.rectangle([x + i * 11, y, x + i * 11 + 7, y + 7], outline=c)


def yarn_line(d, x0, x1, y, sag=10):
    pts = [(x0 + (x1 - x0) * i / 40, y + sag * 4 * (i / 40) * (1 - i / 40)) for i in range(41)]
    d.line(pts, fill=YARN_D, width=4)
    d.line([(p[0], p[1] - 1) for p in pts], fill=YARN, width=2)
    return lambda x: y + sag * 4 * ((x - x0) / (x1 - x0)) * (1 - (x - x0) / (x1 - x0))


def tabs(img, picked, phone=False):
    """The four stops as paper tags pegged on a line of red yarn. The picked one is lantern and hangs 6 lower."""
    d = ImageDraw.Draw(img)
    W = img.width
    names = [('sacks', 'Feed Sacks', 'sack'), ('bells', 'Bell Shelf', 'bell'), ('missions', 'Missions', 'pin'), ('book', 'Barn Book', 'book')]
    tw, gap = (156, 18) if not phone else (84, 6)
    total = 4 * tw + 3 * gap
    x0 = (W - total) // 2
    y = 30 if not phone else 70
    f = yarn_line(d, x0 - 60, x0 + total + 60, y - 8, 4)
    for i, (k, label, ic) in enumerate(names):
        x = x0 + i * (tw + gap)
        sel = k == picked
        ty = int(f(x + tw / 2)) + (12 if sel else 6)
        h = 40 if not phone else 50
        tag(d, x, ty, tw, h, face=T['lantern'] if sel else PAPER, lip=T['lanternLip'] if sel else PAPER_LIP, hole=False)
        d.rectangle([x + tw // 2 - 4, ty - 8, x + tw // 2 + 3, ty + 6], fill=tok('wood:1'))          # the peg
        d.rectangle([x + tw // 2 - 4, ty - 8, x + tw // 2 + 3, ty - 7], fill=tok('wood:2'))
        if not phone:
            iw, ih = icon(d, x + 14, ty + 12, ic, 2)
            d.text((x + 14 + iw + 8, ty + 9), label, font=F(FR, 17), fill=INK)
        else:
            iw = len(ART[ic]['rows'][0]) * 2
            icon(d, x + (tw - iw) // 2, ty + 10, ic, 2)
            text_c(d, x + tw / 2, ty + 29, label, F(FR, 12), INK)


def chip(d, x, y, ic, text, cols):
    f = F(FR, 18)
    w = int(10 + len(ART[ic]['rows'][0]) * 2 + 8 + d.textlength(text, font=f) + 12)
    slab(d, x, y, w, 34, 4, T['wool'], T['woolLip'])
    icon(d, x + 10, y + 17 - len(ART[ic]['rows']), ic, 2, cols)
    d.text((x + 10 + len(ART[ic]['rows'][0]) * 2 + 8, y + 5), text, font=f, fill=INK)
    return w


def wallet(img, coins, bells, phone=False):
    d = ImageDraw.Draw(img)
    W = img.width
    x = W - 18 - 38
    slab(d, x, 16, 38, 34, 4, T['wool'], T['woolLip'])
    icon(d, x + 11, 25, 'cross', 2, {'X': INK})
    f = F(FR, 18)
    bw = int(10 + 20 + 8 + d.textlength(str(bells), font=f) + 12)
    x -= bw + 8
    chip(d, x, 16, 'bell', str(bells), BELL)
    cs = f'{coins:,}'
    cw = int(10 + 20 + 8 + d.textlength(cs, font=f) + 12)
    x -= cw + 8
    chip(d, x, 16, 'coin', cs, COIN)
    if not phone:
        for dx, dy in ((2, 2),):
            d.text((20 + dx, 14 + dy), 'The Trading Post', font=F(FR, 24), fill=INK)
        d.text((20, 14), 'The Trading Post', font=F(FR, 24), fill=T['woolHi'])


def level_strip(img, level, title, xp_share, to_next, today, cap, y=None, phone=False):
    """One strip at the bottom: the level tile, a knitted row that grows from a yarn ball, what is left, today's coins from games."""
    d = ImageDraw.Draw(img)
    W, H = img.size
    y = y or H - 50
    w = min(W - 36, 1040)
    x = (W - w) // 2
    prect(d, x - 1, y - 1, x + w + 1, y + 34, INK, 2, 2)
    prect(d, x, y + 3, x + w, y + 33, PAPER_LIP, 2, 2)
    prect(d, x, y, x + w, y + 30, PAPER, 2, 2)
    f = F(FR, 14)
    lab = f'Level {level}: {title}'
    lw = int(d.textlength(lab, font=f) + 20)
    d.rectangle([x + 6, y + 5, x + 6 + lw, y + 25], fill=T['lantern'])
    d.text((x + 16, y + 6), lab, font=f, fill=INK)
    right = f'{to_next} XP to level {level + 1}'
    f2 = F(NU8, 12)
    t2 = f'{today} / {cap} from games today'
    rw = d.textlength(right, font=f2) + 18 + 16 + d.textlength(t2, font=f2) + 14
    if phone:                                               # phones: the level tile and the knitted row only; today's coins go under the wallet
        rw = 0
    bx0, bx1 = x + 6 + lw + 30, int(x + w - rw - 12)
    icon(d, bx0 - 22, y + 7, 'yarn', 2, {'X': YARN, 'o': lighten(YARN, 0.35), 'k': YARN_D})
    d.rectangle([bx0, y + 9, bx1, y + 20], fill=lighten(PAPER_LIP, 0.3))
    n = (bx1 - bx0) // 8
    for i in range(int(n * xp_share)):                         # knit stitches: a V every 8 px
        sx = bx0 + i * 8
        d.rectangle([sx, y + 9, sx + 7, y + 20], fill=YARN)
        d.line([sx + 1, y + 10, sx + 3, y + 19], fill=YARN_D, width=1)
        d.line([sx + 6, y + 10, sx + 4, y + 19], fill=YARN_D, width=1)
    tx = bx1 + 12
    if not phone:
        d.text((tx, y + 7), right, font=f2, fill=INK)
        tx += d.textlength(right, font=f2) + 18
        icon(d, tx, y + 7, 'coin', 2, COIN)
        d.text((tx + 26, y + 7), t2, font=f2, fill=INK)


def honest(img, y=None):
    d = ImageDraw.Draw(img)
    s = 'Only for show: nothing here changes how a game plays. Wool Coins and Golden Bells are earned by playing, never bought.'
    text_c(d, img.width / 2, y or img.height - 16, s, F(NU7, 11), SOFT)


def button(d, cx, y, label, w=320, h=48, on=True, ic=None, cols=None, sub=None):
    x = int(cx - w / 2)
    face, lip = (T['lantern'], T['lanternLip']) if on else ('#E9DDC3', '#C9BA98')
    slab(d, x, y, w, h, 6, face, lip)
    f = F(FR, 19)
    tw = d.textlength(label, font=f) + (28 if ic else 0)
    tx = cx - tw / 2
    if ic:
        icon(d, tx, y + h / 2 - len(ART[ic]['rows']), ic, 2, cols)
        tx += 28
    d.text((tx, y + (h - 26) / 2 - (7 if sub else 0)), label, font=f, fill=INK if on else SOFT)
    if sub:
        text_c(d, cx, y + h - 19, sub, F(NU8, 11), INK if on else SOFT)


def chalk(d, x, y, s, size=15, fill=CHALK, font=None):
    d.text((x, y), s, font=F(font or FR, size), fill=fill)

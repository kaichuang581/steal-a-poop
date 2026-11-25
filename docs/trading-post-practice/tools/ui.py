"""Practice's interface. Nothing here is a navy board: the count and the report are chalk on the board in the scene,
your word is a row of tiles on the rink's own boards, and messages are the coach speaking."""
import json
import os

from PIL import Image, ImageDraw

from kit_ui import F, FR, NU7, NU8, T, prect, grid, slab, tile, lighten
from ladder import tok

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART = json.load(open(os.path.join(ROOT, 'data', 'pixel-art.json')))['grids']
CHALK, CHALK_DIM, INK = '#F3EEE6', '#DCE8E0', '#2B2230'
BZ = -4.3
SK = {'digit': '#1F3A66', 'danger': '#B3261E'}          # the Ice skin's digits (data/skins.json)


def P(cam, x, y, z):
    sx, sy, _ = cam.px(x, y, z)
    return sx / cam.ss, sy / cam.ss


def rect(cam, x0, y0, x1, y1, z):
    a, b = P(cam, x0, y1, z), P(cam, x1, y0, z)
    return a[0], a[1], b[0], b[1]


def centred(d, box, text, font, fill):
    x0, y0, x1, y1 = box
    bb = d.textbbox((0, 0), text, font=font)
    d.text(((x0 + x1) / 2 - (bb[0] + bb[2]) / 2, (y0 + y1) / 2 - (bb[1] + bb[3]) / 2), text, font=font, fill=fill)


def icon(d, x, y, name, px, colours):
    cols = dict(colours)
    for ch in 'Xokrw':
        cols.setdefault(ch, cols.get('X', INK))
    grid(d, int(x), int(y), ART[name]['rows'], px, cols)


def tally(d, x, y, w, h, n, lw):
    """n chalk marks in fives: four upright, the fifth across."""
    gx = x
    for g in range((n + 4) // 5):
        k = min(5, n - g * 5)
        for i in range(min(k, 4)):
            d.rectangle([gx + i * w * 0.24, y, gx + i * w * 0.24 + lw - 1, y + h], fill=CHALK)
        if k == 5:
            d.line([gx - w * 0.08, y + h * 0.85, gx + w * 0.82, y + h * 0.15], fill=CHALK, width=lw)
        gx += w * 1.25


def board(img, cam, count, letter, clock, best=None, flash=False, out=False, step=5):
    d = ImageDraw.Draw(img)
    c = 0.05
    x0, y0, x1, y1 = rect(cam, -23 * c, 30 * c, -8 * c, 54 * c, BZ)             # the count panel: chalk on the green board
    w, h = x1 - x0, y1 - y0
    centred(d, (x0, y0 + h * 0.04, x1, y0 + h * 0.44), str(count), F(FR, int(h * 0.36)), CHALK)
    marks = count % step
    tally(d, x0 + w * 0.2, y0 + h * 0.50, w * 0.62, h * 0.18, marks, max(2, int(w * 0.035)))
    if h > 110:
        centred(d, (x0, y0 + h * 0.72, x1, y0 + h * 0.84), '-1 s at %d' % step, F(FR, max(10, int(h * 0.085))), CHALK)
        if best is not None:
            centred(d, (x0, y0 + h * 0.85, x1, y0 + h * 0.97), 'best %d' % best, F(NU8, max(10, int(h * 0.075))), CHALK_DIM)
    box = rect(cam, -6 * c, 34 * c, 6 * c, 50 * c, BZ + 0.05)                     # the letter card
    hh = box[3] - box[1]
    if out:
        centred(d, box, 'OUT', F(FR, int(hh * 0.34)), tok('scarfRed:-2'))
    else:
        centred(d, (box[0], box[1] - hh * 0.04, box[2], box[3]), letter, F(FR, int(hh * 0.72)), INK)
        d.rectangle([box[0] + 2, (box[1] + box[3]) / 2, box[2] - 2, (box[1] + box[3]) / 2], fill=tok('trimWhite:-2'))
    box = rect(cam, 12 * c, 37 * c, 22 * c, 47 * c, BZ + 0.05)                    # the clock card
    hh = box[3] - box[1]
    fb, fs = F(FR, int(hh * 0.50)), F(FR, int(hh * 0.26))
    nw, sw = d.textlength(str(clock), font=fb), d.textlength('s', font=fs)
    x = (box[0] + box[2]) / 2 - (nw + 3 + sw) / 2
    col = tok('scarfRed:-2') if flash else INK
    bb = d.textbbox((0, 0), str(clock), font=fb)
    top = (box[1] + box[3]) / 2 - (bb[1] + bb[3]) / 2
    d.text((x, top), str(clock), font=fb, fill=col)
    d.text((x + nw + 3, top + bb[3] - d.textbbox((0, 0), 's', font=fs)[3]), 's', font=fs, fill=col)


def face(img, cam, bx, bz, secs, danger=False):
    """The seconds on the bomb's face (the worn skin's own digit colour)."""
    d = ImageDraw.Draw(img)
    x0, y0, x1, y1 = rect(cam, bx - 0.1, 0.15, bx + 0.1, 0.35, bz + 0.25)
    centred(d, (x0, y0 + 1, x1, y1), str(secs), F(FR, int((y1 - y0) * (0.74 if secs < 10 else 0.60))), SK['danger'] if danger else SK['digit'])


def buttons(img, phone=False):
    """Four wool tiles, top right: how Practice works, the word log, sound, leave."""
    d = ImageDraw.Draw(img)
    s, gap = (38, 8) if not phone else (36, 6)
    names = ['book', 'list', 'speaker', 'cross']
    x = img.width - 16 - len(names) * s - (len(names) - 1) * gap
    for i, n in enumerate(names):
        bx = x + i * (s + gap)
        slab(d, bx, 16, s, 34, 4, T['wool'], T['woolLip'])
        rows = ART[n]['rows']
        icon(d, bx + (s - len(rows[0]) * 2) // 2, 16 + (34 - len(rows) * 2) // 2, n, 2, {'X': INK, 'o': '#8A7F78'})


def plate(img, cam, x, label, level=None, you=False, dy=0):
    d = ImageDraw.Draw(img)
    x = x + (0.55 if x < 0 else -0.55)
    px, py = P(cam, x, 1.5, 0.0)
    py += dy
    f = F(FR, 14)
    tw = d.textlength(label, font=f)
    extra = (6 + 14 + 4 + d.textlength(level.title(), font=F(NU8, 11)) + 2) if level else 0
    w = int(12 + tw + extra + 12)
    x0 = int(px - w / 2)
    fc, lip = (T['lantern'], T['lanternLip']) if you else (T['wool'], T['woolLip'])
    slab(d, x0, int(py) - 26, w, 24, 3, fc, lip)
    d.text((x0 + 12, int(py) - 25), label, font=f, fill=INK)
    if level:
        lx = x0 + 12 + tw + 8
        d.rectangle([lx - 4, int(py) - 22, lx - 3, int(py) - 7], fill=T['woolLip'])
        icon(d, lx + 2, int(py) - 21, level, 2, {'X': tok({'easy': 'giftGreen:-1', 'medium': 'coopYellow:-2', 'hard': 'scarfRed:-2'}[level])})
        d.text((lx + 20, int(py) - 22), level.title(), font=F(NU8, 11), fill=INK)
    for i in range(3):
        d.rectangle([px - 5 + i * 2, int(py) + 1 + i * 2, px + 4 - i * 2, int(py) + 2 + i * 2], fill=T['ink'])


def bubble(img, cam, x, word, phone=False):
    """What a sheep just played, said once."""
    d = ImageDraw.Draw(img)
    x = x + (0.55 if x < 0 else -0.55)
    px, py = P(cam, x, 1.5, 0.0)
    if phone:
        py += 40
    f = F(FR, 17)
    w = int(d.textlength(word, font=f) + 28)
    x0, y0 = int(px - w / 2), int(py) - 74
    prect(d, x0 - 2, y0 - 2, x0 + w + 2, y0 + 36, T['ink'], 2, 1)
    d.rectangle([x0, y0, x0 + w - 1, y0 + 33], fill=T['woolHi'])
    d.text((x0 + 14, y0 + 5), word, font=f, fill=INK)
    for i in range(3):
        d.rectangle([px - 5 + i * 2, y0 + 36 + i * 2, px + 4 - i * 2, y0 + 37 + i * 2], fill=T['ink'])


def coach(img, cam, text, sub=None, phone=False):
    """The coach speaks: one wool-white bubble from the sheepdog on its chair. Every message in Practice is this."""
    d = ImageDraw.Draw(img)
    f, f2 = F(FR, 18 if not phone else 16), F(NU8, 12)
    w = int(max(d.textlength(text, font=f), d.textlength(sub, font=f2) if sub else 0) + 30)
    h = 38 + (18 if sub else 0)
    hx, hy = P(cam, -2.15, 2.45, -3.35)                       # the dog's head
    if phone:
        x0 = int(max(10, min(hx - w / 2, img.width - w - 10))); y0 = int(P(cam, 0, 2.85, -3.35)[1] - h - 16)
        tail = [(hx - 6, y0 + h + 1), (hx + 6, y0 + h + 1), (hx, y0 + h + 11)]
    else:
        x0, y0 = int(hx - 70 - w), int(hy - h / 2 + 18)
        tail = [(x0 + w + 1, y0 + h / 2 - 7), (x0 + w + 1, y0 + h / 2 + 7), (x0 + w + 13, y0 + h / 2)]
    prect(d, x0 - 2, y0 - 2, x0 + w + 2, y0 + h + 2, T['ink'], 2, 2)
    prect(d, x0, y0, x0 + w, y0 + h, T['woolHi'], 2, 2)
    d.polygon(tail, fill=T['woolHi'], outline=T['ink'])
    d.text((x0 + 15, y0 + 6), text, font=f, fill=INK)
    if sub:
        d.text((x0 + 15, y0 + 32), sub, font=f2, fill='#6B5B4B')


def rack(img, cam, letter, typed, wrong=False, your_turn=True):
    """Your word as tiles on the rink's own front boards (computer and tablet)."""
    d = ImageDraw.Draw(img)
    x0 = -1.02
    n = 1 + len(typed)
    pitch = min(0.165, 2.1 / max(n + 2, 1))
    s = int((P(cam, x0 + pitch * 0.9, 0.15, 2.47)[0] - P(cam, x0, 0.15, 2.47)[0]))
    def at(i):
        px, py = P(cam, x0 + i * pitch, 0.15, 2.47)
        return int(px), int(py) - s - 6
    tile(d, *at(0), s, letter, 'lantern', 5, int(s * 0.66))
    for i, ch in enumerate(typed):
        tile(d, *at(i + 1), s, ch, 'ember' if wrong else 'wool', 5, int(s * 0.66))
    cx, cy = at(n)                                             # the caret: where the next tile will stand
    if your_turn:
        d.rectangle([cx + 2, cy + s + 2, cx + s - 3, cy + s + 5], fill=T['lantern'])
        d.rectangle([cx + s // 2 - 1, cy + 6, cx + s // 2 + 1, cy + s - 4], fill=T['lanternHi'])
    bx, by = P(cam, 1.33, 0.12, 2.36)                          # Pass: a lantern slab on the next bay of the boards
    slab(d, int(bx), int(by) - 44, 112, 38, 5, T['lantern'] if your_turn else '#C9BA98', T['lanternLip'] if your_turn else '#A3956F')
    icon(d, int(bx) + 12, int(by) - 34, 'return-key', 2, {'X': INK})
    d.text((int(bx) + 38, int(by) - 43), 'Pass', font=F(FR, 19), fill=INK)


def rack_phone(img, letter, typed, wrong=False):
    """Phones: the same rack as a strip above the keyboard."""
    d = ImageDraw.Draw(img)
    W, H = img.size
    y = H - 96
    s, gap = 32, 4
    d.rectangle([0, y + s + 8, W, y + s + 15], fill=tok('trimWhite:1')); d.rectangle([0, y + s + 15, W, y + s + 19], fill=tok('trimWhite:-2'))
    d.rectangle([0, y + s + 8, W, y + s + 8], fill=T['ink'])
    x = 12
    tile(d, x, y, s, letter, 'lantern', 5, 21); x += s + gap
    for ch in typed:
        tile(d, x, y, s, ch, 'ember' if wrong else 'wool', 5, 21); x += s + gap
    d.rectangle([x + 2, y + s + 2, x + s - 3, y + s + 5], fill=T['lantern'])
    slab(d, W - 12 - 92, y - 2, 92, s + 2, 5, T['lantern'], T['lanternLip'])
    icon(d, W - 12 - 92 + 10, y + 8, 'return-key', 2, {'X': INK})
    d.text((W - 12 - 92 + 36, y + 1), 'Pass', font=F(FR, 18), fill=INK)


def report(img, cam, words, best, new, clock0, clock1, level, rating):
    """The end of a run: the coach's report, in chalk, on the whole board."""
    d = ImageDraw.Draw(img)
    c = 0.05
    x0, y0, x1, y1 = rect(cam, -24 * c, 30 * c, 24 * c, 54 * c, BZ)
    w, h = x1 - x0, y1 - y0
    title = 'New best!' if new else ('Good session' if words >= 10 else 'Warm-up done')
    d.text((x0 + w * 0.05, y0 + h * 0.07), title, font=F(FR, int(h * 0.15)), fill=T['lanternHi'] if new else CHALK)
    d.line([x0 + w * 0.05, y0 + h * 0.27, x0 + w * 0.95, y0 + h * 0.27], fill=CHALK_DIM, width=max(1, int(h * 0.008)))
    fb = F(FR, int(h * 0.40))
    d.text((x0 + w * 0.05, y0 + h * 0.27), str(words), font=fb, fill=CHALK)
    nw = d.textlength(str(words), font=fb)
    d.text((x0 + w * 0.05 + nw + w * 0.02, y0 + h * 0.52), 'words', font=F(FR, int(h * 0.11)), fill=CHALK)
    tally(d, x0 + w * 0.05, y0 + h * 0.80, w * 0.09, h * 0.11, words, max(2, int(h * 0.012)))
    rows = [('Best', str(max(best, words))), ('Clock', '%d to %d s' % (clock0, clock1)), ('Bot', level.title()), ('Rating', str(rating))]
    for i, (k, v) in enumerate(rows):
        yy = y0 + h * (0.33 + i * 0.105)
        d.text((x0 + w * 0.60, yy), k, font=F(NU8, max(10, int(h * 0.065))), fill=CHALK_DIM)
        fv = F(FR, max(11, int(h * 0.08)))
        d.text((x1 - w * 0.05 - d.textlength(v, font=fv), yy - h * 0.012), v, font=fv, fill=CHALK)
    if new:                                                    # the rosette, pinned to the frame's corner
        rows_ = ART['rosette']['rows']
        px = max(2, int(h * 0.016))
        icon(d, x1 - len(rows_[0]) * px - w * 0.03, y0 + h * 0.03, 'rosette', px, {'X': T['lantern'], 'o': T['lanternHi'], 'r': tok('scarfRed:0'), 'k': T['ink']})
    return x0, y0, x1, y1


def slips(img, x0, x1, y, words, rows=2):
    """Your words, each on a paper slip, in the order played."""
    d = ImageDraw.Draw(img)
    f = F(NU8, 13)
    lines, cur, cw = [], [], 0
    for wd in words:
        ww = int(d.textlength(wd, font=f) + 16)
        if cw + ww > x1 - x0 and cur:
            lines.append(cur); cur, cw = [], 0
        cur.append((wd, ww)); cw += ww + 6
    lines.append(cur)
    shown = 0
    for r, ln in enumerate(lines[:rows]):
        last = r == rows - 1 and len(lines) > rows
        rest = len(words) - shown
        if last:
            more = '+%d more' % (rest - len(ln) + 1)
            mw = int(d.textlength(more, font=f) + 16)
            while ln and sum(w for _, w in ln) + 6 * len(ln) + mw > x1 - x0:
                ln = ln[:-1]
            more = '+%d more' % (rest - len(ln))
        tw = sum(w for _, w in ln) + 6 * (len(ln) - 1) + ((mw + 6) if last else 0)
        x = (x0 + x1) / 2 - tw / 2
        for wd, ww in ln:
            slab(d, int(x), int(y + r * 32), ww, 22, 2, T['wool'], T['woolLip'])
            d.text((int(x) + 8, int(y + r * 32) + 2), wd, font=f, fill=INK)
            x += ww + 6
        shown += len(ln)
        if last:
            slab(d, int(x), int(y + r * 32), mw, 22, 2, T['lantern'], T['lanternLip'])
            d.text((int(x) + 8, int(y + r * 32) + 2), more, font=f, fill=INK)


def end_buttons(img, cx, y, w=300, dream=True):
    d = ImageDraw.Draw(img)
    slab(d, int(cx - w / 2), y, w, 48, 6, T['lantern'], T['lanternLip'])
    centred(d, (cx - w / 2, y, cx + w / 2, y + 48), 'Go again', F(FR, 20), INK)
    slab(d, int(cx - w / 2), y + 66, w, 40, 5, T['wool'], T['woolLip'])
    centred(d, (cx - w / 2, y + 66, cx + w / 2, y + 106), 'Back to the farm', F(FR, 16), INK)
    if dream:
        f = F(NU8, 12)
        t = "Tonight's dream is waiting"
        tw = d.textlength(t, font=f) + 34
        x = cx - tw / 2
        prect(d, x, y + 120, x + tw, y + 142, T['woolHi'], 2, 1)
        icon(d, x + 8, y + 123, 'moon-small', 2, {'X': '#C98A1E'})
        d.text((x + 28, y + 123), t, font=f, fill=INK)

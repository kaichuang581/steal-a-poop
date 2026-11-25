"""Draws the Trading Post's reference pictures from the data. Run: python3 tp_pictures.py"""
import os

from PIL import Image, ImageDraw

import bursts
import market
import skins
import sounds
import studio
import tp_ui as ui
from kit_ui import F, FR, NU7, NU8, T, prect, slab, lighten
from ladder import tok
from market import MODELS, STOP_X, SACKS, INSIDE, camera, shot
from tp_ui import P, INK, SOFT, PAPER, CHALK, RARITY

REF = os.path.join(market.__file__.rsplit(os.sep, 2)[0], 'reference')
RAR = {'ember': 'common', 'peppermint': 'common', 'plum': 'uncommon', 'gold': 'rare', 'diamond': 'legendary'}
NAMES = {**{k: v['name'] for k, v in skins.SKINS.items()}, **{k: v['name'] for k, v in bursts.BURSTS.items()}, **{k: v[0] for k, v in sounds.SOUNDS.items()}}


def bomb_faces(img, cam, L):
    """Outside a game, every bomb's face shows 10 in its own digit colour: the bomb as it looks when a turn starts."""
    d = ImageDraw.Draw(img)
    for sh in L.shown:
        if sh['kind'] != 'skin' or sh['cut_out']:
            continue
        meta = MODELS['bomb_' + sh['key']].meta
        cx, cy, cz = meta['face']['centre_cells']
        c = MODELS['bomb_' + sh['key']].cell * sh['scale']
        x, y, z = sh['x'] + cx * c, sh['y'] + cy * c, sh['z'] + cz * c
        px, py = P(cam, x, y, z)
        if not (0 <= px <= img.width):
            continue
        h = abs(P(cam, x, y + 0.1 * sh['scale'], z)[1] - py) * 2
        f = F(FR, max(8, int(h * 0.62)))
        bb = d.textbbox((0, 0), '10', font=f)
        col = meta['digit'].replace('lit:', '')
        d.text((px - (bb[0] + bb[2]) / 2, py - (bb[1] + bb[3]) / 2), '10', font=f, fill=col)


def frame(stop, picked='oat', coins=1240, bells=15, W=1440, H=900, extra=None, **cam_kw):
    cam = camera(stop, W=W, H=H, **cam_kw)
    img, n, L = shot(cam, picked, extra=extra)
    bomb_faces(img, cam, L)
    return img, cam, n


def chrome(img, stop, coins, bells, phone=False):
    ui.tabs(img, stop, phone)
    ui.wallet(img, coins, bells, phone)
    ui.level_strip(img, 4, 'Yearling', 0.42, 140, 180, 300, phone=phone, y=img.height - (58 if not phone else 44))
    if not phone:
        ui.honest(img)


def sign_text(d, cam, X, text, y=2.52, z=0.56, size=24):
    px, py = P(cam, X, y, z)
    ui.text_c(d, px, py - size * 0.62, text, F(FR, size), INK)


def stop_sacks(path, picked='oat', coins=1240, bells=15, found=('ember', 'plum')):
    img, cam, n = frame('sacks', picked)
    d = ImageDraw.Draw(img)
    X = STOP_X['sacks']
    sign_text(d, cam, X, 'Feed Sacks')
    for k, s in SACKS.items():                                   # each sack's tag hangs from the front beam
        px, py = P(cam, X + s['x'], 2.46, 0.3)
        sel = k == picked
        n_in = len(INSIDE[k])
        nf = len([f for f in found if f in INSIDE[k]]) if k == 'oat' else (3 if k == 'corn' else 1)
        ui.tag(d, px - 76, py + 12, 152, 52, border=T['lantern'] if sel else None, string_to=py)
        ui.text_c(d, px, py + 20, s['name'], F(FR, 16), INK)
        ui.text_c(d, px, py + 42, f"{s['holds']}: {nf} of {n_in} found", F(NU8, 11), SOFT)
    xs = market.item_xs(len(INSIDE[picked]), X, 3.6)              # what the picked sack holds: a tag under each thing on the bench
    for key, x in zip(INSIDE[picked], xs):
        px, py = P(cam, x, 0.30, 0.95)
        r = RAR.get(key, 'common')
        ui.tag(d, px - 58, py + 10, 116, 44, string_to=py + 2)
        ui.text_c(d, px, py + 18, NAMES[key], F(FR, 14), INK)
        lab = RARITY[r][0]
        f = F(NU8, 11)
        tw = 10 + d.textlength(lab, font=f) + (22 if key in found else 0)
        tx = px - tw / 2
        d.rectangle([tx, py + 41, tx + 6, py + 47], fill=RARITY[r][1])
        d.text((tx + 10, py + 36), lab, font=f, fill=SOFT)
        if key in found:
            ui.icon(d, tx + tw - 13, py + 38, 'tick', 2, {'X': '#2F7A4D'})
    x0, y0 = P(cam, X + 3.0 - 0.5, 1.5, 0.6)                      # the odds, in chalk on the board
    x1, y1 = P(cam, X + 3.0 + 0.5, 0.1, 0.6)
    ui.chalk(d, x0 + 14, y0 + 10, SACKS[picked]['name'], 19)
    ui.chalk(d, x0 + 14, y0 + 34, 'The odds, every time', 12, font=NU8)
    yy = y0 + 62
    for k, pc in (('common', '62%'), ('uncommon', '28%'), ('rare', '8%'), ('legendary', '2%')):
        d.rectangle([x0 + 14, yy + 4, x0 + 23, yy + 13], fill=RARITY[k][1])
        ui.chalk(d, x0 + 32, yy, RARITY[k][0], 14, font=NU8)
        f = F(FR, 15)
        d.text((x1 - 14 - d.textlength(pc, font=f), yy - 1), pc, font=f, fill=CHALK)
        yy += 26
    d.line([x0 + 14, yy + 4, x1 - 14, yy + 4], fill='#8A7F78', width=1)
    ui.chalk(d, x0 + 14, yy + 14, 'Rare or better', 12, font=NU8); ui.chalk(d, x0 + 14, yy + 30, 'within 7 sacks', 14)
    ui.chalk(d, x0 + 14, yy + 56, 'Legendary', 12, font=NU8); ui.chalk(d, x0 + 14, yy + 72, 'within 31 sacks', 14)
    can = coins >= 250
    ui.button(d, P(cam, X, 0, 0)[0], 772, 'Open an ' + SACKS[picked]['name'] if can else 'Need 250 Wool Coins', w=340, h=54, on=can, ic='coin', cols=ui.COIN,
              sub='250 Wool Coins. One at a time.' if can else f'You have {coins}.')
    chrome(img, 'sacks', coins, bells)
    img.save(path)
    return img, n


def thumb(kind, key, size=72, bg=PAPER):
    if kind == 'burst':
        from render import Camera, Scene, render, sky_gradient
        cam = Camera(W=size, H=size, A=size * 0.95, CAM=8, EYE=0.45, lane_frac=0.9, cam_x=0, ss=3)
        sc = Scene(); sc.box(-9, -0.2, -9, 9, 0, 6, bg, True, 1.0)
        bursts.place(sc, key, 0, 0, 0, spread=0.42)
        img, _ = render(sc, cam, sky_gradient(cam, [(0, bg), (1, bg), (cam.H / max(cam.hy, 1), bg)]), studio.WARM)
        return img
    m = MODELS[('bomb_' if kind == 'skin' else 'sound_') + key]
    img, _ = studio.shot(m, W=size, H=size, fill=0.78, floor=bg, wall=(bg, bg), glow=0.0, ss=3)
    return img


def knit_bar(d, x, y, w, share, h=10):
    d.rectangle([x, y, x + w, y + h], fill=lighten(ui.PAPER_LIP, 0.3))
    for i in range(int((w // 8) * share + 0.001)):
        sx = x + i * 8
        d.rectangle([sx, y, sx + 7, y + h], fill=ui.YARN)
        d.line([sx + 1, y + 1, sx + 3, y + h - 1], fill=ui.YARN_D); d.line([sx + 6, y + 1, sx + 4, y + h - 1], fill=ui.YARN_D)


def stop_bells(path, coins=1240, bells=15):
    img, cam, n = frame('bells')
    d = ImageDraw.Draw(img)
    X = STOP_X['bells']
    sign_text(d, cam, X, 'Bell Shelf')
    for (dx, name, kind, price) in ((-0.55, 'Brass Bell', 'Bomb skin', 30), (0.75, 'Lantern Glow', 'Burst', 40)):
        px, py = P(cam, X + dx, 0.93, 0.12)
        ui.tag(d, px - 30, py + 6, 60, 26, face='#F2CE7C', lip='#B8862F', string_to=py)          # the brass price tag
        ui.icon(d, px - 22, py + 12, 'bell', 2, ui.BELL)
        d.text((px + 2, py + 9), str(price), font=F(FR, 16), fill=INK)
        ui.tag(d, px - 80, py + 44, 160, 50, hole=False)
        ui.text_c(d, px, py + 49, name, F(FR, 16), INK)
        ui.text_c(d, px, py + 71, kind, F(NU8, 11), SOFT)
        can = bells >= price
        ui.button(d, px, py + 108, 'Buy' if can else f'{price - bells} more Bells', w=160, h=36, on=can)
    px, py = P(cam, X, 1.66, -0.75)
    ui.tag(d, px - 74, py - 44, 148, 30, hole=False)
    ui.text_c(d, px, py - 38, 'More on the way', F(NU8, 13), SOFT)
    cx = P(cam, X, 0, 0)[0]
    ui.tag(d, cx - 330, 772, 660, 50, hole=False)
    ui.icon(d, cx - 312, 787, 'bell', 2, ui.BELL)
    d.text((cx - 284, 778), 'Golden Bells: +5 every level, +10 every milestone, +20 every 7 dream nights.', font=F(NU8, 13), fill=INK)
    d.text((cx - 284, 798), 'Bells buy only what is on this shelf.', font=F(NU8, 13), fill=SOFT)
    chrome(img, 'bells', coins, bells)
    img.save(path)


def stop_missions(path, coins=1240, bells=15):
    img, cam, n = frame('missions')
    d = ImageDraw.Draw(img)
    X, Z, S = STOP_X['missions'], -0.3, 0.05
    cx = P(cam, X, 0, 0)[0]
    ui.tag(d, cx - 300, 778, 600, 34, hole=False)
    ui.icon(d, cx - 284, 787, 'pin', 2)
    d.text((cx - 258, 785), 'Missions are earned by playing, never found in a sack. Each one is yours for good.', font=F(NU8, 13), fill=INK)
    for (x0, x1, kind, key, name, typ, goal, have, need) in ((-31, -11, 'skin', 'aurora', 'Aurora', 'Bomb skin', 'Count sheep 7 nights in a row', 3, 7),
                                                             (-10, 10, 'burst', 'starlight', 'Starlight', 'Burst', 'Count sheep 30 nights in a row', 3, 30),
                                                             (11, 31, 'sound', 'lullaby', 'Lullaby', 'Fuse sound', 'Count sheep 100 nights in a row', 3, 100)):
        ax, ay = P(cam, X + x0 * S, 47 * S, Z)
        bx, by = P(cam, X + x1 * S, 32 * S, Z)
        img.paste(thumb(kind, key, 68, '#F9EDDA' if kind != 'burst' else tok('iron:-1')), (int(ax) + 10, int(ay) + 18))
        d = ImageDraw.Draw(img)
        d.text((ax + 86, ay + 18), name, font=F(FR, 19), fill=INK)
        d.text((ax + 86, ay + 44), typ, font=F(NU8, 12), fill=SOFT)
        d.text((ax + 12, ay + 92), goal, font=F(NU8, 12), fill=INK)
        w = bx - ax - 24
        if need <= 7:                                              # seven nights: seven stamp boxes
            bw = (w - 6 * 5) / 7
            for i in range(7):
                sx = ax + 12 + i * (bw + 5)
                d.rectangle([sx, ay + 116, sx + bw, ay + 138], fill=ui.YARN if i < have else lighten(ui.PAPER_LIP, 0.3), outline=ui.YARN_D if i < have else ui.PAPER_LIP)
                if i < have:
                    ui.icon(d, sx + bw / 2 - 8, ay + 121, 'tick', 2, {'X': '#FFF6E0'})
        else:
            knit_bar(d, ax + 12, ay + 122, w, have / need)
        f = F(FR, 15)
        t = f'{have} / {need}'
        d.text((bx - 12 - d.textlength(t, font=f), ay + 144 if need > 7 else ay + 142), t, font=f, fill=INK)
    ax, ay = P(cam, X - 31 * S, 30 * S, Z)
    bx, by = P(cam, X + 31 * S, 7 * S, Z)
    Wd = bx - ax
    d.text((ax + 16, ay + 14), 'Milestones', font=F(FR, 20), fill=INK)
    d.text((ax + 136, ay + 20), 'Different words played at the table. Each pays once.', font=F(NU8, 12), fill=SOFT)
    rows = [('50 different words', 12, 50, 25), ('250 different words', 12, 250, 75), ('1,000 different words', 12, 1000, 200), ('5,000 different words', 12, 5000, 500),
            ('10 words starting with X, Z, Q or J', 1, 10, 50), ('25 words starting with X, Z, Q or J', 1, 25, 120)]
    yy = ay + 48
    rh = (by - yy - 8) / 6
    for (lab, have, need, c) in rows:
        d.line([ax + 16, yy - 3, bx - 16, yy - 3], fill=ui.PAPER_LIP)
        d.text((ax + 16, yy + rh / 2 - 9), lab, font=F(NU8, 13), fill=INK)
        knit_bar(d, ax + 0.42 * Wd, yy + rh / 2 - 5, int(0.22 * Wd), have / need)
        t = f'{have:,} / {need:,}'
        f = F(FR, 14)
        d.text((ax + 0.79 * Wd - d.textlength(t, font=f), yy + rh / 2 - 10), t, font=f, fill=INK)
        ui.icon(d, ax + 0.815 * Wd, yy + rh / 2 - 10, 'coin', 2, ui.COIN); d.text((ax + 0.815 * Wd + 24, yy + rh / 2 - 10), f'+{c}', font=F(FR, 14), fill=INK)
        ui.icon(d, ax + 0.915 * Wd, yy + rh / 2 - 8, 'bell', 2, ui.BELL); d.text((ax + 0.915 * Wd + 24, yy + rh / 2 - 10), '+10', font=F(FR, 14), fill=INK)
        yy += rh
    chrome(img, 'missions', coins, bells)
    img.save(path)


WHERE = {'ice': ('Wearing', 'tick'), 'ember': ('Found. Wear it', 'tick'), 'plum': ('Found. Wear it', 'tick'), 'peppermint': ('In the Oat Sack', 'lock'), 'gold': ('In the Oat Sack', 'lock'),
         'diamond': ('In the Oat Sack', 'lock'), 'brassBell': ('30 Bells, Bell Shelf', 'lock'), 'aurora': ('Mission: 7 dream nights', 'lock')}
RAR_ALL = {'ice': 'starter', **RAR, 'brassBell': 'bells', 'aurora': 'mission'}


def stop_book(path, coins=1240, bells=15):
    img, cam, n = frame('book')
    d = ImageDraw.Draw(img)
    X, Z, S = STOP_X['book'], -0.2, 0.05
    pk, cols = market.book_pockets(8)
    for key, (px_, py_) in zip(skins.ORDER, pk):
        cx, cy = P(cam, X + px_ * S, py_ * S, Z + 0.15)
        ui.text_c(d, cx, cy + 8, NAMES[key], F(FR, 15), INK)
        lab, ic = WHERE[key]
        r = RAR_ALL[key]
        f = F(NU8, 11)
        tw = 10 + d.textlength(RARITY[r][0], font=f)
        d.rectangle([cx - tw / 2, cy + 33, cx - tw / 2 + 6, cy + 39], fill=RARITY[r][1])
        d.text((cx - tw / 2 + 10, cy + 28), RARITY[r][0], font=f, fill=SOFT)
        tw = 16 + d.textlength(lab, font=f)
        ui.icon(d, cx - tw / 2, cy + 46, ic, 1 if ic == 'lock' else 1, {'X': '#2F7A4D' if ic == 'tick' else SOFT})
        d.text((cx - tw / 2 + 14, cy + 43), lab, font=f, fill='#2F7A4D' if ic == 'tick' else SOFT)
    ax, ay = P(cam, X - 36 * S, 55.4 * S, Z)                # page heads
    d.text((ax + 18, ay), 'Bomb skins', font=F(FR, 22), fill=INK)
    d.text((ax + 150, ay + 8), '3 of 8 found', font=F(NU8, 13), fill=SOFT)
    bx, by = P(cam, X + 36 * S, 55.4 * S, Z)
    by += 8
    t = '3 of 26 found'
    d.text((bx - 14 - d.textlength(t, font=F(FR, 17)), by - 6), t, font=F(FR, 17), fill=INK)
    tx, ty = P(cam, X, 2.95, Z)                                   # the three bookmarks that stick out of the book's top
    for i, (lab, sel) in enumerate((('Bomb skins', True), ('Bursts', False), ('Fuse sounds', False))):
        x = tx - 222 + i * 150
        ui.tag(d, x, ty - 30, 140, 32, face=T['lantern'] if sel else PAPER, lip=T['lanternLip'] if sel else ui.PAPER_LIP, hole=False)
        ui.text_c(d, x + 70, ty - 25, lab, F(FR, 15), INK)
    chrome(img, 'book', coins, bells)
    img.save(path)


def overview(path):
    cam = camera(None, W=1600, H=560, cx=9.2, A=57.0, lane=0.80)
    img, n, L = shot(cam)
    d = ImageDraw.Draw(img)
    for k, lab in (('sacks', '1  Feed Sacks'), ('bells', '2  Bell Shelf'), ('missions', '3  Missions'), ('book', '4  Barn Book')):
        px, py = P(cam, STOP_X[k], 0, 1.0)
        ui.tag(d, px - 80, py + 22, 160, 34, hole=False)
        ui.text_c(d, px, py + 27, lab, F(FR, 17), INK)
    img.save(path)
    return n


def before_after(path, new):
    old = Image.open(os.path.join(REF, 'build-today', 'shop-feed-sacks.jpg')).convert('RGB').resize((720, 450), Image.LANCZOS)
    out = Image.new('RGB', (1460, 500), '#F3EBDD')
    out.paste(old, (10, 40)); out.paste(new.resize((720, 450), Image.LANCZOS), (730, 40))
    d = ImageDraw.Draw(out)
    d.text((14, 10), 'Today: a wooden panel over Home, with a picture of a stall inside it', font=F(NU8, 15), fill=SOFT)
    d.text((734, 10), 'This plan: the stall is the screen, and what a sack holds stands on its bench', font=F(NU8, 15), fill=INK)
    out.save(path)


def sheets():
    cells = []
    for k in skins.ORDER:
        m = skins.bomb(k)
        img, cam = studio.shot(m, fill=0.74, glow=0.4)
        cells.append((img, m.meta['name'], m.meta['source']))
    studio.sheet(os.path.join(REF, 'models-bombs.png'), cells, 4, 'The eight bombs: round outlines, every part at least 0.05 m (face left plain here; the game paints the seconds on it)')
    cells = []
    for m in sounds.all_models():
        img, cam = studio.shot(m, W=300, H=300, fill=0.62)
        cells.append((img, m.what, m.original))
    studio.sheet(os.path.join(REF, 'models-fuse-sounds.png'), cells, 4, 'The eight fuse sounds, each as the thing that makes the sound', W=300, H=300)
    from render import Camera, Scene, render, sky_gradient
    cells = []
    for k in bursts.ORDER:
        cam = Camera(W=300, H=300, A=118, CAM=8, EYE=0.9, lane_frac=0.88, cam_x=0, ss=2)
        sc = Scene(); sc.box(-30, -0.2, -30, 30, 0, 6, '#2A3558', True, 1.0)
        MODELS['bomb_ice'].place(sc, 0, 0, 0, flat='#1B2444')
        bursts.place(sc, k, 0, 0, 0)
        img, _ = render(sc, cam, sky_gradient(cam, [(0, '#151C36'), (1, '#243056'), (cam.H / max(cam.hy, 1), '#243056')]), studio.WARM)
        b = bursts.BURSTS[k]
        cells.append((img, b['name'], '%d pieces, %d colours' % (b['pieces'], len(b['colours']))))
    studio.sheet(os.path.join(REF, 'models-bursts.png'), cells, 5, 'The ten bursts at their fullest (300 ms), over where the bomb stood', W=300, H=300)
    cells = []
    for k in SACKS:
        img, cam = studio.shot(MODELS['sack_' + k], W=300, H=300, fill=0.66)
        cells.append((img, SACKS[k]['name'], 'Holds ' + SACKS[k]['holds'].lower()))
    for mid, a, b in (('sampleBench', 'Sample bench', 'What the picked sack holds stands here'), ('oddsBoard', 'Odds board', 'Chalk: the real odds'), ('bigBell', 'The big bell', 'Hangs at the Bell Shelf'), ('barrel', 'Barrel', ''), ('rowPost', 'Row post', 'Lantern; bulbs run post to post')):
        img, cam = studio.shot(MODELS[mid], W=300, H=300, fill=0.66, glow=0.3)
        cells.append((img, a, b))
    studio.sheet(os.path.join(REF, 'models-market.png'), cells, 4, 'Sacks and market pieces', W=300, H=300)


def opening(path):
    """The sack reveal, four moments. Honest: the light is the item's own rarity colour from the first frame."""
    from render import Camera, Scene, render
    GREEN, GREEN_HI = '#4E9A6A', '#A6E3BD'
    caps = ['0 ms. You press Open. The sack hops to the middle of the counter.',
            '0 to 500 ms. Two shakes. The light inside is already green: uncommon.',
            '500 to 1,100 ms. The yarn bow unties. The item rises and turns once.',
            '1,600 ms. It lands on its stand. Wear it, or Done. No "Open another".']
    out = Image.new('RGB', (4 * 372 + 12, 372 + 76), '#F3EBDD')
    d = ImageDraw.Draw(out)
    for k in range(4):
        cam = Camera(W=360, H=360, A=170, CAM=9, EYE=1.9, lane_frac=1.215, cam_x=0.25 if k == 3 else 0.0, ss=2)
        sc = Scene()
        L = market.Layout()
        L.put('feedStall', 0, -0.1)
        L.build(sc)
        dx = 0.035 if k == 1 else 0
        MODELS['sack_oat'].place(sc, dx - (0.35 if k == 3 else 0), 1.05, -0.3, skip=('tie',) if k >= 2 else ())
        sx = dx - (0.35 if k == 3 else 0)
        if k in (1, 2):
            sc.glow(sx, 1.85, -0.2, GREEN_HI, 0.55, 0.75)
            for (rx, h) in ((-0.14, 0.38), (0.0, 0.55), (0.14, 0.38)):
                sc.box(sx + rx - 0.02, 1.88, -0.32, sx + rx + 0.02, 1.88 + h, -0.28, GREEN_HI, True, 1.0)
        if k == 2:
            MODELS['bomb_plum'].place(sc, 0, 1.98, -0.3, glow=0.4, scale=0.65)
        if k == 3:
            bursts.stand(sc, 0.62, 1.05, -0.25, 1.4)
            MODELS['bomb_plum'].place(sc, 0.62, 1.15, -0.25, glow=0.4)
            sc.glow(0.62, 1.4, -0.1, GREEN_HI, 0.6, 0.35)
        img, _ = render(sc, cam, market.sky(cam), market.LIGHT)
        dd = ImageDraw.Draw(img)
        if k == 0:
            ui.button(dd, 180, 304, 'Open an Oat Sack', w=250, h=42, ic='coin', cols=ui.COIN)
        if k == 3:
            px, py = P(cam, 0.62, 1.05, 0.0)
            ui.tag(dd, px - 70, py + 14, 140, 46, hole=False, border=GREEN)
            ui.text_c(dd, px, py + 19, 'Plum', F(FR, 16), INK)
            ui.text_c(dd, px, py + 40, 'Uncommon. New!', F(NU8, 11), '#2F7A4D')
            ui.button(dd, px - 40, py + 74, 'Wear it', w=96, h=34)
            ui.button(dd, px + 62, py + 74, 'Done', w=84, h=34, on=False)
        out.paste(img, (12 + k * 372, 12))
        words, line, yy = caps[k].split(' '), '', 380
        for w in words:
            if d.textlength(line + w, font=F(NU8, 12)) > 350:
                d.text((14 + k * 372, yy), line, font=F(NU8, 12), fill=INK); line = ''; yy += 17
            line += w + ' '
        d.text((14 + k * 372, yy), line, font=F(NU8, 12), fill=INK)
    out.save(path)


def phone_sacks(path, coins=1240, bells=15, found=('ember', 'plum')):
    W, H = 390, 844
    cam = camera(None, W=W, H=H, cx=0.0, A=86.0, lane=0.47)
    img, n, L = shot(cam, 'oat')
    d = ImageDraw.Draw(img)
    sign_text(d, cam, 0, 'Feed Sacks', size=13)
    for k, s in SACKS.items():
        px, py = P(cam, s['x'], 2.46, 0.3)
        sel = k == 'oat'
        ui.tag(d, px - 46, py + 6, 92, 22, border=T['lantern'] if sel else None, hole=False)
        ui.text_c(d, px, py + 8, s['name'], F(FR, 12), INK)
    # the till roll: what the picked sack holds and the odds, on one strip of paper that scrolls
    x, y, w = 14, 436, W - 28
    h = 268
    prect(d, x - 1, y - 1, x + w + 1, y + h + 1, INK, 2, 1)
    d.rectangle([x, y, x + w - 1, y + h - 1], fill=PAPER)
    for i in range(x, x + w, 12):                                  # the roll's torn lower edge: a row of small teeth
        d.polygon([(i, y + h - 1), (i + 6, y + h + 5), (i + 12, y + h - 1)], fill=PAPER)
    d.text((x + 14, y + 10), 'Inside the Oat Sack', font=F(FR, 17), fill=INK)
    d.text((x + w - 14 - d.textlength('2 of 5 found', font=F(NU8, 12)), y + 15), '2 of 5 found', font=F(NU8, 12), fill=SOFT)
    yy = y + 40
    for key in INSIDE['oat']:
        r = RAR[key]
        d.line([x + 14, yy, x + w - 14, yy], fill=ui.PAPER_LIP)
        d.rectangle([x + 14, yy + 10, x + 23, yy + 19], fill=RARITY[r][1])
        d.text((x + 32, yy + 5), NAMES[key], font=F(FR, 15), fill=INK)
        d.text((x + 150, yy + 8), RARITY[r][0], font=F(NU8, 12), fill=SOFT)
        if key in found:
            ui.icon(d, x + w - 78, yy + 9, 'tick', 2, {'X': '#2F7A4D'}); d.text((x + w - 58, yy + 8), 'Found', font=F(NU8, 12), fill='#2F7A4D')
        yy += 30
    d.line([x + 14, yy, x + w - 14, yy], fill=ui.PAPER_LIP)
    d.text((x + 14, yy + 8), 'The odds, every time', font=F(NU8, 12), fill=SOFT)
    d.text((x + 14, yy + 26), 'Common 62%   Uncommon 28%   Rare 8%   Legendary 2%', font=F(NU8, 12), fill=INK)
    d.text((x + 14, yy + 46), 'Rare or better within 7 sacks. Legendary within 31.', font=F(NU8, 12), fill=INK)
    ui.button(d, W / 2, 724, 'Open an Oat Sack', w=W - 28, h=50, ic='coin', cols=ui.COIN, sub='250 Wool Coins. One at a time.')
    ui.tabs(img, 'sacks', phone=True)
    ui.wallet(img, coins, bells, phone=True)
    ui.level_strip(img, 4, 'Yearling', 0.42, 140, 180, 300, phone=True, y=H - 46)
    img.save(path)


if __name__ == '__main__':
    import sys
    os.makedirs(REF, exist_ok=True)
    img, n = stop_sacks(os.path.join(REF, 'trading-post-1-feed-sacks.png'))
    print('boxes', n)
    before_after(os.path.join(REF, 'trading-post-before-and-after.png'), img)
    stop_bells(os.path.join(REF, 'trading-post-2-bell-shelf.png'))
    stop_missions(os.path.join(REF, 'trading-post-3-missions.png'))
    stop_book(os.path.join(REF, 'trading-post-4-barn-book.png'))
    overview(os.path.join(REF, 'trading-post-the-market-row.png'))
    opening(os.path.join(REF, 'trading-post-opening-a-sack.png'))
    phone_sacks(os.path.join(REF, 'trading-post-phone-feed-sacks.png'))
    sheets()

"""Draws every reference picture of the pack from the data. Run: python3 pictures.py"""
import os
import sys

from PIL import Image, ImageDraw

import mock
import scenes
from render import Scene, render
from scenes import MODELS, shot, CAMERA

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF = os.path.join(ROOT, 'reference')
SHOTS = os.path.join(REF, 'build-today') + os.sep


def hang_point(cam, ox):
    """Where the sign's two chains end, on screen (1x)."""
    c = 0.05
    px = ox - 0.62
    xa, ya, _ = cam.px(px - 21.5 * c, 75 * c, -0.45 + 2.5 * c)
    xb, yb, _ = cam.px(px - 5.5 * c, 75 * c, -0.45 + 2.5 * c)
    return ((xa + xb) / 2 / cam.ss, ya / cam.ss)


def dressed(n, letters, word, count, best, obstacle, moon, jump=False, extra=None, card=None, strip_x=26.0, new_best=False, gold=False, show_sign=True):
    img, cam, sx, ox, nb = shot(n, strip_x, obstacle, None, moon=moon, jump=jump, extra=extra)
    if show_sign:
        hx, hy = hang_point(cam, ox)
        mock.sign(img, hx - 72, hy, letters, word)
    mock.hud(img, count, best, new_best=new_best)
    if jump:
        px, py, _ = cam.px(sx + 0.9, 2.9, 0)
        mock.pop(img, px / cam.ss, py / cam.ss - 30, str(count), gold)
    if card:
        mock.card(img, *card)
    return img, cam, nb


def moon_show(sc, cam, w):
    """Ten small sheep cross the big moon: the stand-in model, dark, far away."""
    sh = MODELS['sheepStandIn']
    old = sh.cell
    d = 430.0
    for i in range(5):
        sx_ = (0.50 + i * 0.062) * cam.W
        sy_ = (0.50 - 0.16 * (1 - ((i - 2) / 2.2) ** 2)) * cam.hy + 0.10 * cam.hy
        x = cam.cam_x + (sx_ - cam.cx) * d / cam.f
        y = cam.EYE + (cam.hy - sy_) * d / cam.f
        sh.cell = 0.04 * 9.5
        for bx in sh.boxes:
            x0, y0, z0, x1, y1, z1 = bx['b']
            sc.box(x + x0 * sh.cell, y + y0 * sh.cell, cam.CAM - d + z0 * sh.cell, x + x1 * sh.cell, y + y1 * sh.cell, cam.CAM - d + z1 * sh.cell, '#2D2020', True, 1.0)
    sh.cell = old


def gate_extra(model, dx=5.4, z=0.0):
    def f(sc, cam, w):
        sx = scenes.sheep_x(cam)
        if z != 0 and w.n == 2:              # in world 2 a bed gate stands on two yard islands (file 07, section 2)
            for k in (0, 1):
                MODELS['islandYard'].place(sc, sx + dx - 3.0 + 6.0 * k, 0.0, -2.9, tint=0.8)
        MODELS[model].place(sc, sx + dx, 0.1 if (z != 0 and w.n == 3) else 0.0, z, tint=1.0 if z == 0 else 0.8)
        if z == 0:
            sc.shadow(sx + dx - 1.4, -1.8, sx + dx + 1.4, 1.8, 0.0, 0.18)
    return f


def whole_screen(dream, path, locked='C', typed='', meter=(8, 11)):
    """The new dream window over the bedroom strip of the build (picture 08), with the new rim, puffs, snores and tray."""
    base = Image.open(SHOTS + '08-stage1.jpg').convert('RGB')
    out = Image.new('RGB', (1440, 900), '#0A0E22')
    out.paste(base.crop((0, 690, 1440, 900)), (0, 690))
    # the old scalloped edge is gone: fill the band it cut with plain wall boards, and carry the window's uprights up
    patch = base.crop((1060, 690, 1150, 742))
    for x in range(0, 1440, 90):
        out.paste(patch, (x, 638))
    out.paste(base.crop((372, 690, 520, 694)).resize((148, 56)), (372, 636))
    out.paste(base.crop((1290, 690, 1440, 694)).resize((150, 56)), (1290, 636))
    out.paste(base.crop((240, 690, 330, 742)), (140, 690))      # hide the old square puffs
    win = dream.crop((10, 0, 1430, dream.height))
    mock.window_frame(out, win, 10, 10)
    d = ImageDraw.Draw(out)
    for (cx, cy, r) in ((196, 668, 20), (170, 700, 13), (156, 724, 8)):
        mock.puff(d, cx, cy, r)
    for (zx, zy, px) in ((206, 738, 2), (224, 718, 3), (248, 692, 4)):
        for dx, dy in ((-2, 0), (2, 0), (0, -2), (0, 2)):
            mock.grid(d, zx + dx, zy + dy, mock.ART['z']['rows'], px, {'X': mock.T['ink']})
        mock.grid(d, zx, zy, mock.ART['z']['rows'], px, {'X': mock.T['woolHi']})
    mock.tray(d, 724, 776, 512, locked, typed, meter)
    out.save(path)
    return out


def camera_diagram(path):
    """A side view of the dream: the camera, the rows, what the window sees."""
    from PIL import ImageFont
    W, H = 1440, 560
    im = Image.new('RGB', (W, H), '#ECEBE6')
    d = ImageDraw.Draw(im)
    f = ImageFont.truetype(mock.NU8, 14); f2 = ImageFont.truetype(mock.NU7, 13)

    def sx(z):                       # the camera is at the left and looks right; beyond 50 m the drawing is squeezed
        dd = 16 - z
        return 110 + dd * 13 if dd <= 50 else 110 + 650 + (dd - 50) * 6.6
    sy = lambda y: 400 - y * 30.0
    G = sy(0.1)
    d.rectangle([60, G, W - 40, G + 3], fill='#9A9087')
    d.text((60, 20), 'Side view of the dream. The camera looks level and never tilts; its lens is shifted, so the track sits 76% of the way down the window.', font=f, fill='#222')
    d.text((60, 42), 'Beyond 50 m the drawing is squeezed. Heights are to scale.', font=f2, fill='#555')
    cam = (sx(16), sy(2.4))
    d.line([cam[0], cam[1], W - 40, cam[1]], fill='#B75946', width=1)
    d.text((W - 330, cam[1] - 22), 'the horizon: level with the camera', font=f2, fill='#B75946')
    d.ellipse([cam[0] - 8, cam[1] - 8, cam[0] + 8, cam[1] + 8], fill='#B75946')
    d.text((cam[0] - 50, cam[1] - 62), 'camera\n2.4 m up', font=f, fill='#B75946')
    things = [('F2: wall', 5.6, 0.5, 0.4, '#867B71'), ('track, sheep', 0.0, 0.9, 1.1, '#EEE5D6'), ('B1: fence', -3.0, 0.9, 0.2, '#6E4D38'),
              ('B2: yard', -10.0, 3.4, 1.4, '#497E6A'), ('B3: buildings', -30.0, 5.7, 5.0, '#B75946'), ('B4: mill', -60.0, 9.9, 2.0, '#D9CCB8'), ('B5: far hills', -110.0, 6.0, 24.0, '#D8D2C9')]
    for i, (name, z, h, depth, col) in enumerate(things):
        x0, x1 = sx(z + depth / 2), sx(z - depth / 2)
        d.rectangle([x0, sy(h + 0.1), max(x1, x0 + 4), G], fill=col, outline='#2D406B')
        d.text(((x0 + x1) / 2 - 30, G + 12 + (20 if i % 2 else 0)), name, font=f2, fill='#2D406B')
        d.text(((x0 + x1) / 2 - 16, G + 56), 'z %g' % z, font=f2, fill='#777')
    d.rectangle([sx(1.2), G, sx(-1.2), G + 3], fill='#F3EEE7')
    # the window's lower and upper edge as lines of sight (1440 x 900: the lane line is 476 px down a 626 px window, 90 px a metre)
    low_z = 16 - 16 * 2.4 * 90 / (2.4 * 90 + 150)
    d.line([cam[0], cam[1], sx(low_z), G], fill='#555', width=1)
    d.text((sx(low_z) - 44, G + 80), 'lower edge of the window\nmeets the ground at z %.1f' % low_z, font=f2, fill='#555')
    top_at_track = 476 / 90.0
    zz = -60
    d.line([cam[0], cam[1], sx(zz), sy(2.4 + (top_at_track - 2.4) * (16 - zz) / 16)], fill='#555', width=1)
    d.text((sx(-8), sy(9.4)), 'upper edge of the window: %.1f m above the track at z 0' % top_at_track, font=f2, fill='#555')
    d.text((cam[0] - 40, G + 12), '16 m in front\nof the track', font=f2, fill='#B75946')
    im.save(path)


def before_after(path):
    from PIL import ImageFont
    a = Image.open(SHOTS + '08-stage1.jpg').convert('RGB')
    b = Image.open(os.path.join(REF, 'whole-screen.png'))
    out = Image.new('RGB', (1440, 1800 + 80), '#ECEBE6')
    d = ImageDraw.Draw(out)
    f = ImageFont.truetype(mock.NU8, 22)
    d.text((16, 6), 'The build today (picture 08): the dream is flat pixel art', font=f, fill='#222')
    out.paste(a, (0, 40))
    d.text((16, 946), 'This plan: the same moment, built from the voxel models in data/models, seen by the camera of file 02', font=f, fill='#222')
    out.paste(b, (0, 980))
    out.save(path)


def phone(path):
    """A phone's dream window: 378 wide, the art scale 42 px a metre, the lane 72% of the way down."""
    w = scenes.world2()
    cam = scenes.Camera(W=378, H=470, A=42.0, CAM=16.0, EYE=2.4, lane_frac=0.72, cam_x=30.0, ss=3)
    sc = Scene()
    w.build(sc, cam.cam_x - 80, cam.cam_x + 80)
    scenes.add_moon(sc, cam, 'moonFull', 0.72, 0.34, 64)
    sx = cam.cam_x + (0.24 - 0.5) * 378 / 42.0
    MODELS['sheepStandIn'].place(sc, sx, 0, 0)
    sc.shadow(sx - 0.55, -0.32, sx + 0.5, 0.36, 0.0, 0.3)
    ox = sx + 3.6
    MODELS['obGateIced'].place(sc, ox, 0, 0)
    MODELS['signpost'].place(sc, ox - 0.62, 0, -0.45)
    fg = scenes.FOG[2]
    img, _ = render(sc, cam, scenes.sky_for(2, cam, stars=30), scenes.LIGHT[2], {'colour': scenes.SKY[2]['fog'], 'start': fg[0], 'end': fg[1], 'most': fg[2]})
    img.save(path)


if __name__ == '__main__':
    os.makedirs(REF, exist_ok=True)
    which = sys.argv[1:] or ['all']
    A = lambda k: 'all' in which or k in which
    if A('w1'):
        img, cam, nb = dressed(1, 'F', None, 2, 32, 'obPlanks', ('moonCrescent', 0.42, 0.36, 96), strip_x=28.0)
        img.save(os.path.join(REF, 'world-1-his-own-farm.png')); print('w1', nb)
        whole_screen(img, os.path.join(REF, 'whole-screen.png'), 'F', 'AB')
    if A('w1j'):
        img, cam, nb = dressed(1, 'F', 'FABLE', 3, 32, 'obGate', ('moonCrescent', 0.64, 0.40, 96), jump=True, strip_x=60.0)
        img.save(os.path.join(REF, 'world-1-jump.png'))
    if A('g1'):
        img, cam, nb = dressed(1, 'CA', None, 5, 32, 'obLogs', ('moonCrescent', 0.64, 0.40, 96), extra=gate_extra('gateFarm', 2.6), strip_x=44.0, show_sign=True)
        img.save(os.path.join(REF, 'gate-1-the-farm-gate.png'))
    if A('w2'):
        img, cam, nb = dressed(2, 'GL', None, 8, 32, 'obBrickIced', ('moonFull', 0.70, 0.36, 128), card=('Dreaming…', 'Two letters now', 'island'))
        img.save(os.path.join(REF, 'world-2-the-farm-lifts-off.png')); print('w2', nb)
    if A('w3'):
        img, cam, nb = dressed(3, 'CRE', None, 19, 32, 'obClock', ('moonFull', 0.62, 0.44, 190))
        img.save(os.path.join(REF, 'world-3-under-the-quilt.png')); print('w3', nb)
    if A('ms'):
        img, cam, nb = dressed(3, 'SHO', 'SHOVEL', 40, 32, 'obBooks', ('moonFull', 0.60, 0.52, 300), jump=True, extra=moon_show, new_best=True, gold=True, strip_x=52.0)
        img.save(os.path.join(REF, 'moon-show.png'))
    if A('g2'):
        img, cam, nb = dressed(2, 'CRE', None, 16, 32, 'obCratesIced', ('moonFull', 0.70, 0.36, 128), extra=gate_extra('gateFootboard', 1.6, -1.9), strip_x=70.0)
        img.save(os.path.join(REF, 'gate-2-the-foot-of-the-bed.png'))
    if A('boards'):
        import sheet, models_farm, models_dream, models_obstacles
        sheet.board(models_farm.all_models(), os.path.join(REF, 'models-farm.png'), cols=5, w=360, h=300, title='The farm models (worlds 1 and 2). Each is a small copy of something on Home')
        md = models_dream.all_models()
        w2 = [m for m in md if m.id.startswith(('island', 'laneBayFloat', 'clod', 'moon'))]
        w3 = [m for m in md if m not in w2]
        sheet.board(w2, os.path.join(REF, 'models-world-2.png'), cols=5, w=360, h=300, title='World 2: the islands, the floating track, the moons')
        sheet.board(w3, os.path.join(REF, 'models-world-3.png'), cols=5, w=360, h=300, title="World 3: his bed's things, and the two bed gates")
        sheet.board(models_obstacles.all_models(), os.path.join(REF, 'models-obstacles.png'), cols=5, w=360, h=320, title='What the sheep jumps (farm, iced, bedroom) and the signpost')
    if A('extras'):
        camera_diagram(os.path.join(REF, 'camera-side-view.png'))
        before_after(os.path.join(REF, 'before-and-after.png'))
        phone(os.path.join(REF, 'phone-dream-window.png'))

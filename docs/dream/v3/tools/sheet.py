"""Draws every model alone, three-quarter view, on the off-white studio colour: the prop board."""
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from render import Camera, Scene, render, srgb_to_lin, hexrgb

STUDIO = '#ECEBE6'
DAY = {'top': (1.0, 1.0, 1.0), 'front': (0.80, 0.80, 0.82), 'left': (0.62, 0.62, 0.66), 'right': (0.66, 0.66, 0.70), 'bottom': (0.4, 0.4, 0.45)}
import mock
FONT = mock.NU8


def tile(model, w=360, h=320, festive=True, parts=None, glow=0.45):
    s = model.size()
    c = model.cell
    sx, sy, sz = (s[3] - s[0]) * c, (s[4] - s[1]) * c, (s[5] - s[2]) * c
    span = max(sx, sy, sz, 0.5)
    cam = Camera(W=w, H=h, A=100.0, CAM=span * 3.2 + sz / 2, EYE=s[4] * c + span * 0.55, lane_frac=0.5, cam_x=-(sx / 2 + span * 0.42), ss=3)
    y_lo, y_hi = s[1] * c, s[4] * c
    pts = [(x, y, z) for x in (-sx / 2, sx / 2) for y in (y_lo, y_hi) for z in (-sz / 2, sz / 2)]
    for _ in range(3):                      # fit the model's eight corners into the tile
        pr = [cam.px(*p) for p in pts]
        xs, ys = [p[0] for p in pr], [p[1] for p in pr]
        k = min(cam.W * 0.80 / (max(xs) - min(xs)), cam.H * 0.78 / (max(ys) - min(ys)))
        cam.A *= k; cam.f = cam.A * cam.CAM
        cam.hy = cam.lane_y - cam.A * cam.EYE
        pr = [cam.px(*p) for p in pts]
        xs, ys = [p[0] for p in pr], [p[1] for p in pr]
        cam.cx += cam.W / 2 - (max(xs) + min(xs)) / 2
        cam.hy += cam.H / 2 - (max(ys) + min(ys)) / 2
    sc = Scene()
    cx0 = -(s[0] + s[3]) / 2 * c
    cz0 = -(s[2] + s[5]) / 2 * c
    model.place(sc, cx0, 0, cz0, festive=festive, parts=parts, glow=glow)
    if s[1] >= 0:
        sc.shadow(-sx / 2 - 0.04, -sz / 2, sx / 2 + 0.04, sz / 2 + span * 0.05, -0.004, 0.10)
    sky = np.empty((cam.H, cam.W, 3)); sky[:] = srgb_to_lin(hexrgb(STUDIO))
    img, _ = render(sc, cam, sky, DAY, None)
    return img


def board(models, path, cols=5, w=360, h=320, title=None):
    rows = (len(models) + cols - 1) // cols
    top = 46 if title else 0
    out = Image.new('RGB', (cols * w, rows * (h + 34) + top), STUDIO)
    d = ImageDraw.Draw(out)
    f = ImageFont.truetype(FONT, 15)
    if title:
        d.text((14, 12), title, font=ImageFont.truetype(FONT, 20), fill='#2A2A2A')
    for i, m in enumerate(models):
        x, y = (i % cols) * w, (i // cols) * (h + 34) + top
        out.paste(tile(m, w, h), (x, y))
        j = m.to_json()
        d.text((x + 12, y + h + 4), f"{m.id}   {j['size_m'][0]} x {j['size_m'][1]} x {j['size_m'][2]} m   {j['box_count']} boxes", font=f, fill='#3A3A3A')
    out.save(path)
    print(path, out.size)


if __name__ == '__main__':
    import models_farm
    import os
    board(models_farm.all_models(), os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'reference', 'models-farm.png'), title='The farm models (worlds 1 and 2)')

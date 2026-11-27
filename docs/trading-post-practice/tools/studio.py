"""Sheets of models on a plain studio floor, for the plan's model pictures."""
import numpy as np
from PIL import Image, ImageDraw

from kit_ui import F, FR, NU8, T
from ladder import tok
from render import Camera, Scene, render, sky_gradient

WARM = {'top': (1.00, 0.95, 0.86), 'front': (0.86, 0.80, 0.74), 'left': (0.56, 0.50, 0.52), 'right': (0.70, 0.63, 0.60), 'bottom': (0.34, 0.30, 0.34)}


def shot(model, W=340, H=340, fill=0.6, extra=None, light=WARM, floor='#E9DFCF', wall=('#F3EBDD', '#E9DFCF'), scale=1.0, lane=0.80, ss=2, **place):
    s = model.size()
    c = model.cell * scale
    w, h = (s[3] - s[0]) * c, (s[4] - s[1]) * c
    A = min(W * fill / max(w, 1e-6), H * fill / max(h, 1e-6))
    cam = Camera(W=W, H=H, A=A, CAM=max(4.0, w * 6), EYE=h * 0.62, lane_frac=lane, cam_x=(s[0] + s[3]) / 2 * c, ss=ss)
    sc = Scene()
    sc.box(-30, -0.2, -30, 30, 0.0, 6, floor, True, 1.0)
    model.place(sc, 0, 0, 0, scale=scale, **place)
    sc.shadow((s[0] + 2) * c, (s[2]) * c, (s[3] - 2) * c, (s[5]) * c, 0.0, 0.16)
    if extra:
        extra(sc, cam)
    sky = sky_gradient(cam, [(0.0, wall[0]), (1.0, wall[1]), (cam.H / max(cam.hy, 1), wall[1])])
    img, _ = render(sc, cam, sky, light)
    return img, cam


def sheet(path, cells, cols, title=None, W=340, H=340, label_h=44, bg='#F3EBDD'):
    """cells: [(image, line 1, line 2)]"""
    rows = (len(cells) + cols - 1) // cols
    top = 56 if title else 12
    out = Image.new('RGB', (cols * (W + 12) + 12, top + rows * (H + label_h + 12)), bg)
    d = ImageDraw.Draw(out)
    if title:
        d.text((16, 12), title, font=F(FR, 26), fill=T['ink'])
    for i, (img, a, b) in enumerate(cells):
        x, y = 12 + (i % cols) * (W + 12), top + (i // cols) * (H + label_h + 12)
        out.paste(img, (x, y))
        d.text((x + 4, y + H + 4), a, font=F(FR, 16), fill=T['ink'])
        if b:
            d.text((x + 4, y + H + 24), b, font=F(NU8, 12), fill='#6B5B4B')
    out.save(path)
    return out

#!/usr/bin/env python3
"""Depth plan, section 6: how flat a picture is, and how its blocks and snow are lit.

    python3 measure.py flat <picture> [<picture> ...]
        share of the picture that is flat (a 5 x 5 pixel patch whose brightness barely changes), after scaling the
        picture to about 264,000 pixels so pictures of any size compare. Lower means more shape and detail.
    python3 measure.py faces <picture> <x,y> <x,y> [...]
        brightness of each point (median of a 5 x 5 patch) as a share of the brightest one, and its colour.

Needs Pillow and NumPy (pip3 install pillow numpy).
"""
import sys

import numpy as np
from numpy.lib.stride_tricks import sliding_window_view
from PIL import Image


def linear(c):
    c = c / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def luminance(rgb):
    r, g, b = linear(np.asarray(rgb, dtype=float)).T if np.ndim(rgb) == 1 else (linear(rgb[..., 0]), linear(rgb[..., 1]), linear(rgb[..., 2]))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def flat(path):
    im = Image.open(path).convert('RGB')
    s = (264000 / (im.width * im.height)) ** 0.5
    if s < 1:
        im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    a = np.asarray(im).astype(float)
    lp = luminance(a) ** (1 / 2.2)
    share = (sliding_window_view(lp, (5, 5)).std(axis=(-1, -2)) < 0.006).mean()
    print(f'{path}: flat {share:.1%}')


def faces(path, points):
    a = np.asarray(Image.open(path).convert('RGB')).astype(float)
    rows = []
    for p in points:
        x, y = (int(v) for v in p.split(','))
        c = np.median(a[y - 2:y + 3, x - 2:x + 3].reshape(-1, 3), axis=0)
        rows.append((p, c, float(luminance(c))))
    top = max(r[2] for r in rows)
    for p, c, l in rows:
        print(f'{p:>10}  rgb {tuple(int(v) for v in c)}  {l / top:5.0%} of the brightest')


if __name__ == '__main__':
    if len(sys.argv) < 3 or sys.argv[1] not in ('flat', 'faces'):
        print(__doc__)
        sys.exit(1)
    if sys.argv[1] == 'flat':
        for path in sys.argv[2:]:
            flat(path)
    else:
        faces(sys.argv[2], sys.argv[3:])

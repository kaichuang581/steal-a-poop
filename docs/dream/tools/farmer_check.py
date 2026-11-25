"""Draws the box model beside the sheet and measures how well the front outlines overlap.
Run:  python3 tools/farmer_check.py   ->  reference/farmer-model-check.png
"""
import os, sys
from PIL import Image, ImageDraw, ImageFont, ImageChops
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import farmer_model as fm

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sheet = Image.open(os.path.join(ROOT, 'reference', 'farmer-sheet.png')).convert('RGB')
PX = 340 / 84            # on the sheet, the front figure is 340 px tall: that is 84 units
FEET_Y, FRONT_X, BACK_X = 445, 196, 513


def model(view):
    m = fm.render(view, k=6, pad=4); s = PX / 6
    return m.resize((round(m.width * s), round(m.height * s)), Image.LANCZOS)


def ref(cx):
    w, h = round(44 * PX), round(92 * PX); bottom = FEET_Y + round(4 * PX)
    return sheet.crop((cx - w // 2, bottom - h, cx - w // 2 + w, bottom))


def mask(im, bg, tol):
    px = im.load(); w, h = im.size; m = Image.new('1', (w, h), 0); mp = m.load()
    for y in range(h):
        for x in range(w):
            if max(abs(px[x, y][i] - bg[i]) for i in range(3)) > tol: mp[x, y] = 1
    return m


rf, rb = ref(FRONT_X), ref(BACK_X)
mf, mb, ml = (model(v).resize(rf.size) for v in ('front', 'back', 'left'))
hem_row = rf.height - round((4 + 9.5) * PX)       # compare from the cap's top down to the hem; the floor below is straw
ms = mask(rf, rf.getpixel((3, 3)), 13).load()
best = 0
for dx in range(-4, 5):
    mm = ImageChops.offset(mask(mf, (232, 232, 226), 4), dx, 0).load()
    inter = union = 0
    for y in range(hem_row):
        for x in range(rf.width):
            a, b = ms[x, y], mm[x, y]
            inter += 1 if (a and b) else 0; union += 1 if (a or b) else 0
    best = max(best, inter / union)
print('front outline overlap above the hem: %.3f (pass mark 0.88)' % best)

out = Image.new('RGB', (rf.width * 5 + 60, rf.height + 34), (232, 232, 226)); d = ImageDraw.Draw(out)
f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 12)
x = 10
for im, lab in ((rf, 'sheet: front'), (mf, 'model: front'), (rb, 'sheet: back'), (mb, 'model: back'), (ml, 'model: his left side')):
    out.paste(im, (x, 26)); d.text((x, 6), lab, font=f, fill=(40, 40, 40)); x += im.width + 10
out.save(os.path.join(ROOT, 'reference', 'farmer-model-check.png'))

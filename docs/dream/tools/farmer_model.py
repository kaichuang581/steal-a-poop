"""The farmer as boxes, measured from reference/farmer-sheet.png (front view).

One unit is 0.02 m. x: + is the farmer's left (the viewer's right when facing him). y: up from the floor.
z: + is his front. Every box is [x0, x1, y0, y1, z0, z1] in whole units, so it sits on a 1-unit grid.
Run:  python3 tools/farmer_model.py   ->  data/farmer.boxes.json, reference/farmer-model-check.png
"""
import json, os
from PIL import Image, ImageDraw

C = dict(
    slipper='#B8B0A6', slipper_top='#C9C1B6', sole='#9E968C', leg='#4A3A2C',
    shirt='#E6DFD3', shirt_dark='#D8D0C4', stripe='#8F97AC', button='#BFB6AA',
    skin='#E3C6AB', skin_shade='#D6B596', neck='#C9A589',
    eye='#3D2818', brow='#7A6C5C', mouth='#6A5142',
    beard='#B9B2A6', beard_dark='#A69E92',
    cap='#E1DAD0', band='#B5594C', pom='#E9E3DA',
)
B = []  # (part, name, colour key, x0, x1, y0, y1, z0, z1)


def box(part, name, col, x0, x1, y0, y1, z0, z1):
    assert x1 > x0 and y1 > y0 and z1 > z0, name
    B.append(dict(part=part, name=name, colour=C[col], x0=x0, x1=x1, y0=y0, y1=y1, z0=z0, z1=z1))


# The body is an odd number of units wide, so it has a true centre column. Parts are written in columns:
# column c covers x from c - 0.5 to c + 0.5. Column 0 is the centre line.
def cols(c0, c1):  # inclusive column range -> x0, x1
    return c0 - 0.5, c1 + 0.5


def cbox(part, name, col, c0, c1, y0, y1, z0, z1):
    x0, x1 = cols(c0, c1); box(part, name, col, x0, x1, y0, y1, z0, z1)


def cmirror(part, name, col, c0, c1, y0, y1, z0, z1):
    pl, pr = part.split('|') if '|' in part else (part, part)
    cbox(pl, name + ' (his left)', col, c0, c1, y0, y1, z0, z1)
    cbox(pr, name + ' (his right)', col, -c1, -c0, y0, y1, z0, z1)


# ---- feet and legs ----
cmirror('slipperL|slipperR', 'slipper sole', 'sole', 3, 10, 0, 1, -4.5, 8.5)
cmirror('slipperL|slipperR', 'slipper', 'slipper', 3, 10, 1, 4, -4.5, 8.5)
cmirror('slipperL|slipperR', 'slipper top', 'slipper_top', 3, 10, 4, 5, -4.5, 6.5)   # the toe's top front is one lower
cmirror('legL|legR', 'leg', 'leg', 4, 9, 5, 9, -3.5, 2.5)

# ---- nightshirt ----
cbox('body', 'hem row', 'shirt_dark', -11, 11, 9, 10, -7.5, 7.5)
cbox('body', 'skirt', 'shirt', -11, 11, 10, 25, -7.5, 7.5)
cbox('body', 'chest', 'shirt', -10, 10, 25, 55, -6.5, 6.5)
cbox('body', 'shoulder row', 'shirt', -9, 9, 55, 56, -6.5, 6.5)
for c in (-8, -4, 0, 4, 8):                                   # stripes, front and back
    cbox('body', f'front stripe {c}', 'stripe', c, c, 10, 25, 7.5, 7.7)
    cbox('body', f'front stripe {c} upper', 'stripe', c, c, 25, (38 if c == 0 else 55), 6.5, 6.7)
    cbox('body', f'back stripe {c}', 'stripe', c, c, 10, 25, -7.7, -7.5)
    cbox('body', f'back stripe {c} upper', 'stripe', c, c, 25, 55, -6.7, -6.5)
for z in (-4, 0, 4):                                           # stripes on both sides
    for s in (1, -1):
        box('body', f'side stripe z{z}', 'stripe', *sorted((s * 11.5, s * 11.7)), 10, 25, z - 0.5, z + 0.5)
        box('body', f'side stripe z{z} upper', 'stripe', *sorted((s * 10.5, s * 10.7)), 25, 55, z - 0.5, z + 0.5)
cbox('body', 'placket', 'shirt_dark', 0, 0, 38, 52, 6.5, 6.8)
for y in (40, 44, 48):
    cbox('body', f'button {y}', 'button', 0, 0, y, y + 1, 6.8, 7.0)
cbox('body', 'collar V top', 'neck', -1, 1, 54, 56, 6.5, 6.8)
cbox('body', 'collar V foot', 'neck', 0, 0, 52, 54, 6.5, 6.9)

# ---- arms: two stepped segments (a voxel lean, no rotation), flaring toward the cuff ----
cmirror('armL|armR', 'upper sleeve', 'shirt', 11, 16, 42, 54, -3.5, 2.5)
cmirror('armL|armR', 'lower sleeve', 'shirt', 12, 19, 32, 42, -3.5, 3.5)
cmirror('armL|armR', 'cuff', 'shirt_dark', 12, 19, 30, 32, -3.5, 3.5)
for c, y0, y1 in ((13, 42, 54), (14, 32, 42), (18, 32, 42)):   # sleeve stripes, front face
    for s in (1, -1):
        a, b = sorted((s * c - 0.5, s * c + 0.5))
        zf = 2.5 if y0 == 42 else 3.5
        arm = 'armL' if s == 1 else 'armR'
        box(arm, f'sleeve stripe {s * c}', 'stripe', a, b, y0, y1, zf, zf + 0.2)
        box(arm, f'sleeve stripe back {s * c}', 'stripe', a, b, y0, y1, -3.7, -3.5)
cmirror('handL|handR', 'hand', 'skin', 13, 18, 24, 30, -2.5, 2.5)
cmirror('handL|handR', 'fingers', 'skin', 14, 17, 23, 24, -2.5, 2.5)
cmirror('handL|handR', 'thumb', 'skin_shade', 13, 14, 26, 28, 2.5, 3.5)

# ---- neck and head ----
cbox('head', 'neck', 'neck', -3, 3, 56, 58, -3.5, 3.5)
cbox('head', 'head', 'skin', -8, 8, 58, 74, -8.5, 8.5)
cmirror('head', 'ear', 'skin_shade', 9, 9, 64, 68, -1.5, 1.5)
cbox('head', 'hair back', 'beard', -8, 8, 60, 73, -9.5, -8.5)
cmirror('head', 'hair side', 'beard', 9, 9, 60, 73, -9.5, -2.5)
cmirror('head', 'hair side upper', 'beard', 9, 9, 68, 73, -2.5, 8.5)
cmirror('head', 'eye', 'eye', 4, 5, 68, 70, 8.5, 8.7)
cmirror('head', 'brow', 'brow', 3, 6, 71, 72, 8.5, 9.5)
cbox('head', 'nose', 'skin_shade', -1, 1, 64, 69, 8.5, 10.5)
cbox('head', 'beard on the face', 'beard', -8, 8, 58, 62, 8.5, 10.5)
cmirror('head', 'sideburn', 'beard', 7, 8, 62, 73, 8.5, 9.5)
cbox('head', 'moustache', 'beard', -4, 4, 62, 64, 8.5, 9.5)
cbox('head', 'beard shade row', 'beard_dark', -3, 3, 60, 61, 10.5, 10.7)
cbox('head', 'mouth', 'mouth', -1, 1, 61, 62, 10.5, 10.8)
cbox('head', 'beard under the chin', 'beard', -6, 6, 56, 58, 3.5, 10.5)
cbox('head', 'beard tip', 'beard', -4, 4, 55, 56, 6.9, 10.5)

# ---- nightcap ----
cbox('cap', 'brim', 'cap', -9, 9, 73, 74, -9.5, 9.5)
cbox('cap', 'band', 'band', -9, 9, 74, 75, -9.5, 9.5)
cbox('cap', 'dome 1', 'cap', -9, 9, 75, 78, -9.5, 9.5)
cbox('cap', 'dome 2', 'cap', -8, 8, 78, 80, -8.5, 8.5)
cbox('cap', 'dome 3', 'cap', -7, 7, 80, 82, -7.5, 7.5)
cbox('cap', 'dome 4', 'cap', -5, 5, 82, 84, -5.5, 5.5)
cbox('capTail', 'tail root', 'cap', 10, 12, 75, 79, -1.5, 1.5)
cbox('capTail', 'tail', 'cap', 10, 12, 65, 75, -1.5, 1.5)
cbox('capTail', 'tail ring', 'band', 10, 12, 64, 65, -1.5, 1.5)
cbox('capTail', 'pom-pom', 'pom', 9, 13, 59, 64, -2.5, 2.5)

HEIGHT = max(b['y1'] for b in B)


def hx(c):
    c = c.lstrip('#'); return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))


def render(view, k=6, pad=4, bg=(232, 232, 226)):
    """Straight-on picture. view: 'front' | 'back' | 'left' (seen from his left side)."""
    span = 22
    W, H = int((2 * span) * k), int((HEIGHT + 2 * pad) * k)
    im = Image.new('RGB', (W, H), bg); d = ImageDraw.Draw(im)
    if view == 'front':
        order = sorted(B, key=lambda b: b['z1']); f = lambda b: (b['x0'], b['x1'])
    elif view == 'back':
        order = sorted(B, key=lambda b: -b['z0']); f = lambda b: (-b['x1'], -b['x0'])
    else:
        order = sorted(B, key=lambda b: b['x1']); f = lambda b: (-b['z1'], -b['z0'])
    for b in order:
        a0, a1 = f(b)
        d.rectangle([(a0 + span) * k, H - (b['y1'] + pad) * k, (a1 + span) * k - 1, H - (b['y0'] + pad) * k - 1], fill=hx(b['colour']))
    return im


def mask_of(im, bg, tol):
    px = im.load(); w, h = im.size
    m = Image.new('L', (w, h), 0); mp = m.load()
    for y in range(h):
        for x in range(w):
            p = px[x, y]
            if max(abs(p[i] - bg[i]) for i in range(3)) > tol:
                mp[x, y] = 255
    return m


if __name__ == '__main__':
    here = os.path.dirname(os.path.abspath(__file__)); root = os.path.dirname(here)
    json.dump(dict(unit_m=0.02, height_units=HEIGHT, axes='x: + is his left; y: up; z: + is his front',
                   colours=C, boxes=B), open(os.path.join(root, 'data', 'farmer.boxes.json'), 'w'), indent=1)
    print(len(B), 'boxes; height', HEIGHT)
    for v in ('front', 'back', 'left'):
        render(v).save(os.path.join(root, 'reference', f'farmer-model-{v}.png'))

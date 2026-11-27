"""A small voxel renderer for this plan's reference pictures.

It draws axis-aligned boxes with the plan's own camera (file 02): a shift-lens view that looks level,
straight across the lane, from EYE metres above it and CAM metres in front of it. Nothing rotates, so
every point on the lane's plane (z = 0) lands exactly where the game's side-on mapping puts it:
    screen x = W/2 + A * (x - cam_x) * CAM / (CAM - z)
    screen y = horizon - A * (y - EYE) * CAM / (CAM - z)       horizon = lane line - A * EYE
The pictures show where things stand, how big they are and which colours they take. They are not the
game's light: the game's own lights, corner shading and soft edges will look better than this.
"""
import numpy as np
from PIL import Image


def srgb_to_lin(c):
    c = np.asarray(c, dtype=np.float64) / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def lin_to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055) * 255.0


def hexrgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


class Camera:
    def __init__(self, W=1440, H=626, A=90.0, CAM=16.0, EYE=2.4, lane_frac=0.66, cam_x=0.0, ss=2):
        self.W, self.H, self.ss = W * ss, H * ss, ss
        self.A, self.CAM, self.EYE, self.cam_x = A * ss, CAM, EYE, cam_x
        self.f = self.A * CAM
        self.lane_y = lane_frac * self.H
        self.hy = self.lane_y - self.A * EYE          # the horizon's row
        self.cx = self.W / 2

    def px(self, x, y, z):
        d = self.CAM - z
        return self.cx + self.f * (x - self.cam_x) / d, self.hy - self.f * (y - self.EYE) / d, d


class Scene:
    """Boxes in metres: (x0, y0, z0, x1, y1, z1, hex colour, unlit?, tint)."""

    def __init__(self):
        self.boxes, self.decals, self.glows, self.adds = [], [], [], []

    def box(self, x0, y0, z0, x1, y1, z1, colour, unlit=False, tint=1.0):
        self.boxes.append((min(x0, x1), min(y0, y1), min(z0, z1), max(x0, x1), max(y0, y1), max(z0, z1), colour, unlit, tint))

    def add(self, x0, y0, x1, y1, z, colour, amount):
        """A flat sheet of light facing the camera (the northern light): added to what is behind it."""
        self.adds.append((x0, y0, x1, y1, z, colour, amount))

    def shadow(self, x0, z0, x1, z1, y, alpha=0.28):
        self.decals.append((x0, z0, x1, z1, y + 0.004, alpha))

    def glow(self, x, y, z, colour, radius=0.6, strength=0.6):
        self.glows.append((x, y, z, colour, radius, strength))


DEFAULT_LIGHT = {  # what each face keeps of its paint, in linear light (r, g, b)
    'top': (0.80, 0.86, 1.00), 'front': (0.50, 0.56, 0.78), 'left': (0.30, 0.36, 0.58),
    'right': (0.40, 0.46, 0.68), 'bottom': (0.20, 0.24, 0.40),
}


def render(scene, cam, sky, light=DEFAULT_LIGHT, fog=None):
    """sky: an (H, W, 3) float array in linear light. fog: dict(colour hex, start, end, most)."""
    W, H, f, hy, cx, camx, EYE, CAM = cam.W, cam.H, cam.f, cam.hy, cam.cx, cam.cam_x, cam.EYE, cam.CAM
    img = sky.copy()
    zb = np.full((H, W), np.inf)
    L = {k: np.array(v) for k, v in light.items()}
    cols_all = np.arange(W) + 0.5
    rows_all = np.arange(H) + 0.5

    def put(r0, r1, c0, c1, mask, depth, colour):
        sub = zb[r0:r1, c0:c1]
        ok = mask & (depth <= sub)   # a later box wins a tie, as the game's fill() does: the last box to set a cell owns it
        if ok.any():
            sub[ok] = np.broadcast_to(depth, sub.shape)[ok]
            img[r0:r1, c0:c1][ok] = colour

    def top_face(x0, x1, z0, z1, Y, colour, decal=None):
        dn, df = CAM - z1, CAM - z0
        if dn <= 0.05:
            dn = 0.05
        k = f * (EYE - Y)
        if abs(k) < 1e-9:
            return
        ya, yb = hy + k / df, hy + k / dn
        r0, r1 = int(np.floor(min(ya, yb))), int(np.ceil(max(ya, yb)))
        r0, r1 = max(r0, 0), min(r1, H)
        if r1 <= r0:
            return
        rows = rows_all[r0:r1]
        with np.errstate(divide='ignore', invalid='ignore'):
            d = k / (rows - hy)
        valid = (d >= dn) & (d <= df)
        if not valid.any():
            return
        d = np.where(valid, d, 1.0)
        xl, xr = cx + f * (x0 - camx) / d, cx + f * (x1 - camx) / d
        c0, c1 = int(np.floor(xl[valid].min())), int(np.ceil(xr[valid].max()))
        c0, c1 = max(c0, 0), min(c1, W)
        if c1 <= c0:
            return
        cols = cols_all[c0:c1]
        mask = valid[:, None] & (cols[None, :] >= xl[:, None]) & (cols[None, :] < xr[:, None])
        depth = np.broadcast_to(d[:, None], mask.shape)
        if decal is None:
            put(r0, r1, c0, c1, mask, depth, colour)
        else:
            sub = zb[r0:r1, c0:c1]
            ok = mask & (depth <= sub + 0.05)
            img[r0:r1, c0:c1][ok] *= (1 - decal)

    def side_face(X, y0, y1, z0, z1, colour):
        dn, df = max(CAM - z1, 0.05), CAM - z0
        k = f * (X - camx)
        if abs(k) < 1e-9:
            return
        xa, xb = cx + k / df, cx + k / dn
        c0, c1 = int(np.floor(min(xa, xb))), int(np.ceil(max(xa, xb)))
        c0, c1 = max(c0, 0), min(c1, W)
        if c1 <= c0:
            return
        cols = cols_all[c0:c1]
        with np.errstate(divide='ignore', invalid='ignore'):
            d = k / (cols - cx)
        valid = (d >= dn) & (d <= df)
        if not valid.any():
            return
        d = np.where(valid, d, 1.0)
        yt, yb = hy - f * (y1 - EYE) / d, hy - f * (y0 - EYE) / d
        r0, r1 = int(np.floor(yt[valid].min())), int(np.ceil(yb[valid].max()))
        r0, r1 = max(r0, 0), min(r1, H)
        if r1 <= r0:
            return
        rows = rows_all[r0:r1]
        mask = valid[None, :] & (rows[:, None] >= yt[None, :]) & (rows[:, None] < yb[None, :])
        depth = np.broadcast_to(d[None, :], mask.shape)
        put(r0, r1, c0, c1, mask, depth, colour)

    def front_face(x0, x1, y0, y1, Z, colour):
        d = CAM - Z
        if d <= 0.05:
            return
        xa, xb = cx + f * (x0 - camx) / d, cx + f * (x1 - camx) / d
        ya, yb = hy - f * (y1 - EYE) / d, hy - f * (y0 - EYE) / d
        c0, c1 = max(int(round(xa)), 0), min(int(round(xb)), W)
        r0, r1 = max(int(round(ya)), 0), min(int(round(yb)), H)
        if c1 <= c0 or r1 <= r0:
            return
        put(r0, r1, c0, c1, np.ones((r1 - r0, c1 - c0), bool), np.full((r1 - r0, c1 - c0), d), colour)

    for (x0, y0, z0, x1, y1, z1, colour, unlit, tint) in scene.boxes:
        if CAM - z0 <= 0.1:
            continue
        dn = max(CAM - z1, 0.1)
        # quick cull by x
        if cx + f * (x0 - camx) / (dn if x0 > camx else CAM - z0) > W + 2:
            continue
        if cx + f * (x1 - camx) / (dn if x1 < camx else CAM - z0) < -2:
            continue
        base = srgb_to_lin(hexrgb(colour)) * tint
        shade = (lambda k: base) if unlit else (lambda k: base * L[k])
        if EYE > y1:
            top_face(x0, x1, z0, z1, y1, shade('top'))
        elif EYE < y0:
            top_face(x0, x1, z0, z1, y0, shade('bottom'))
        if camx < x0:
            side_face(x0, y0, y1, z0, z1, shade('left'))
        elif camx > x1:
            side_face(x1, y0, y1, z0, z1, shade('right'))
        front_face(x0, x1, y0, y1, z1, shade('front'))

    for (x0, z0, x1, z1, Y, alpha) in scene.decals:
        if EYE > Y:
            top_face(x0, x1, z0, z1, Y, None, decal=alpha)

    if fog:
        fc = srgb_to_lin(hexrgb(fog['colour']))
        t = np.clip((zb - fog['start']) / (fog['end'] - fog['start']), 0, 1)
        t = np.where(zb < fog.get('sky_from', 300.0), t * t * (3 - 2 * t) * fog['most'], 0)   # the moon and the northern light are sky: no haze
        img = img * (1 - t[..., None]) + fc * t[..., None]

    for (x0, y0, x1, y1, Z, colour, amount) in scene.adds:
        d = CAM - Z
        xa, xb = cx + f * (x0 - camx) / d, cx + f * (x1 - camx) / d
        ya, yb = hy - f * (y1 - EYE) / d, hy - f * (y0 - EYE) / d
        c0, c1 = max(int(round(xa)), 0), min(int(round(xb)), W)
        r0, r1 = max(int(round(ya)), 0), min(int(round(yb)), H)
        if c1 <= c0 or r1 <= r0:
            continue
        ok = zb[r0:r1, c0:c1] > d
        img[r0:r1, c0:c1][ok] += srgb_to_lin(hexrgb(colour)) * amount

    yy, xx = np.mgrid[0:H, 0:W]
    for (x, y, z, colour, radius, strength) in scene.glows:
        sx, sy, d = cam.px(x, y, z)
        if d <= 0.1 or not (-200 < sx < W + 200 and -200 < sy < H + 200):
            continue
        ix, iy = int(np.clip(sx, 0, W - 1)), int(np.clip(sy, 0, H - 1))
        if zb[iy, ix] < d - 0.45:
            continue
        R = radius * f / d
        c0, c1, r0, r1 = max(int(sx - R), 0), min(int(sx + R) + 1, W), max(int(sy - R), 0), min(int(sy + R) + 1, H)
        if c1 <= c0 or r1 <= r0:
            continue
        rr = np.hypot(xx[r0:r1, c0:c1] + 0.5 - sx, yy[r0:r1, c0:c1] + 0.5 - sy) / R
        fall = np.clip(1 - rr, 0, 1) ** 2 * strength
        img[r0:r1, c0:c1] += fall[..., None] * srgb_to_lin(hexrgb(colour))

    out = Image.fromarray(lin_to_srgb(img).astype(np.uint8), 'RGB')
    if cam.ss > 1:
        out = out.resize((W // cam.ss, H // cam.ss), Image.LANCZOS)
    return out, zb


def sky_gradient(cam, stops):
    """stops: [(share of the way from the picture's top to the horizon, hex), ...]; flat below the last."""
    H, W = cam.H, cam.W
    rows = (np.arange(H) + 0.5) / max(cam.hy, 1)
    out = np.zeros((H, 3))
    pos = [s[0] for s in stops]
    cols = [srgb_to_lin(hexrgb(s[1])) for s in stops]
    for ch in range(3):
        out[:, ch] = np.interp(rows, pos, [c[ch] for c in cols])
    return np.repeat(out[:, None, :], W, axis=1)

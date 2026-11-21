// The two pictures of the Queue chooser (src/skin/ranked/PlayChooser.tsx), drawn as pixel art on a 2D canvas, every
// pixel placed by this file (Brian, 2026-11-21: "use high bitrate pixelrate ... make the first one a relaxing scenery
// ... and the second one should be like an epic battle ... in the same farm theme").
//
//  - Casual, "the evening meadow": a sheep in a green knit cap among sunflowers, looking over the hills to the barn at
//    sunset, bumblebees drifting round it, big soft clouds, a faint rainbow.
//  The Ranked side's picture is Brian's own (tools/art/ranked-source.webp), re-encoded by tools/renderPlayArt.mjs.
//
// The meadow is drawn in layers, so the chooser can move them at different speeds (parallax) and fly the bees itself:
//   'casual'         the sky, the sun's glow, the rainbow, the three ridges, the farm and the lane (opaque);
//   'casual-clouds'  the clouds alone (clear round them);
//   'casual-field'   the field of sunflowers and the sheep, with the bee on its nose (clear above the field);
//   'bee'            one bumblebee, 18 x 16, for the chooser to fly about.
//
// Plain JavaScript with no imports: tools/renderPlayArt.mjs puts this file into a blank page and calls
// `drawPlayArt(name)`. The same seed gives the same picture, pixel for pixel. Art is W x H pixels; the tool scales it
// up by whole pixels (nearest neighbour), so every pixel stays square.

/* eslint-disable */
var PLAY_ART = { W: 480, H: 300, SCALE: 3 };

function drawPlayArt(name) {
  var BEE = name === 'bee';
  var W = BEE ? 18 : PLAY_ART.W, H = BEE ? 16 : PLAY_ART.H;
  var BASE = name === 'casual', CLOUDS = name === 'casual-clouds', FIELD = name === 'casual-field';
  var cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  var ctx = cv.getContext('2d');
  var img = ctx.createImageData(W, H);
  var buf = img.data;

  // ---- the toolkit ----
  function rng(seed) { return function () { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; var t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function hex(h) { var n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function bayer(x, y) { return (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16; }
  function px(x, y, c, a) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    var i = (y * W + x) * 4;
    if (a === undefined || a >= 1) { buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = 255; return; }
    // Over nothing (a layer's clear part), the colour itself at that much opacity; over a colour, a blend of the two.
    if (buf[i + 3] === 0) { buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = Math.round(a * 255); return; }
    buf[i] = Math.round(buf[i] + (c[0] - buf[i]) * a); buf[i + 1] = Math.round(buf[i + 1] + (c[1] - buf[i + 1]) * a); buf[i + 2] = Math.round(buf[i + 2] + (c[2] - buf[i + 2]) * a); buf[i + 3] = 255;
  }
  function get(x, y) { var i = (y * W + x) * 4; return [buf[i], buf[i + 1], buf[i + 2]]; }
  function rect(x0, y0, w, h, c, a) { for (var y = y0; y < y0 + h; y++) for (var x = x0; x < x0 + w; x++) px(x, y, c, a); }
  /** A colour from a ramp at t (0 to 1), dithered between its two nearest steps. */
  function ramp(cols, t, x, y) {
    t = Math.max(0, Math.min(0.9999, t)) * (cols.length - 1);
    var k = Math.floor(t), f = t - k;
    return f > bayer(x, y) ? cols[Math.min(cols.length - 1, k + 1)] : cols[k];
  }
  /** Fills a disc, each pixel coloured by `paint(x, y, nx, ny)`, n the unit vector from the centre. */
  function disc(cx, cy, r, paint) {
    for (var y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (var x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        var dx = x + 0.5 - cx, dy = y + 0.5 - cy;
        if (dx * dx + dy * dy <= r * r) { var c = paint(x, y, dx / r, dy / r); if (c) px(x, y, c); }
      }
  }
  /** A lit sphere's shade at a pixel: 0 dark to 1 lit, from a light up and to `lx`. */
  function lit(nx, ny, lx, ly) { var nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny)); var l = Math.hypot(lx, ly, 0.75); return Math.max(0, (nx * lx + ny * ly + nz * 0.75) / l); }
  /** A filled polygon (even-odd), each pixel coloured by `paint(x, y)`. */
  function poly(pts, paint) {
    var minY = Infinity, maxY = -Infinity;
    for (var i = 0; i < pts.length; i++) { minY = Math.min(minY, pts[i][1]); maxY = Math.max(maxY, pts[i][1]); }
    for (var y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      var yy = y + 0.5, xs = [];
      for (var j = 0, k = pts.length - 1; j < pts.length; k = j++) {
        var a = pts[j], b = pts[k];
        if ((a[1] > yy) !== (b[1] > yy)) xs.push(a[0] + ((yy - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
      }
      xs.sort(function (p, q) { return p - q; });
      for (var m = 0; m + 1 < xs.length; m += 2)
        for (var x = Math.ceil(xs[m] - 0.5); x <= Math.floor(xs[m + 1] - 0.5); x++) { var c = paint(x, y); if (c) px(x, y, c); }
    }
  }
  function line(x0, y0, x1, y1, c, a) {
    var n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (var i = 0; i <= n; i++) px(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), c, a);
  }
  /** A dark one-pixel outline round everything of the given colour test, drawn into the empty pixels beside it. */
  function outline(x0, y0, x1, y1, inside, c) {
    var hits = [];
    for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) {
      if (inside(x, y)) continue;
      if (inside(x - 1, y) || inside(x + 1, y) || inside(x, y - 1) || inside(x, y + 1)) hits.push(x, y);
    }
    for (var i = 0; i < hits.length; i += 2) px(hits[i], hits[i + 1], c);
  }

  if (BEE) bee(9, 10, 1, 1); else casual();
  ctx.putImageData(img, 0, 0);
  return cv;

  // =================================================================================================================
  // Casual: the evening meadow
  // =================================================================================================================
  function casual() {
    var R = rng(20261121);
    var SKY = ['#C9452E', '#DB5730', '#E86A34', '#F07F3A', '#F49442', '#F7A84C', '#F9BC5C', '#FBD078', '#FCE09A'].map(hex);
    var HORIZON = 182;
    // The sky: a sunset from deep coral at the top to pale gold on the hills, in dithered bands.
    if (BASE) for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) px(x, y, ramp(SKY, Math.pow(y / HORIZON, 1.1), x, y));
    // The sun's glow behind the far hills, right of the barn.
    var GLOW = hex('#FFF1C4');
    if (BASE) for (var y = 110; y < HORIZON + 4; y++) for (var x = 230; x < 470; x++) {
      var d = Math.hypot((x - 352) / 120, (y - 186) / 60);
      if (d < 1 && (1 - d) * (1 - d) > bayer(x, y) * 1.15) px(x, y, GLOW, 0.55);
    }
    // A faint rainbow, high on the right, in six thin bands that fade toward the hills.
    var BOW = ['#E8574A', '#F2934A', '#F5D36A', '#8FC46A', '#6FA7C9', '#9B85C9'].map(hex);
    if (BASE) for (var y = 0; y < 170; y++) for (var x = 300; x < W; x++) {
      var r = Math.hypot(x - 520, y - 250), band = Math.floor((r - 214) / 3);
      if (band < 0 || band >= BOW.length) continue;
      var fade = Math.min(1, (170 - y) / 90) * Math.min(1, (x - 300) / 60) * 0.5;
      if (fade > bayer(x, y)) px(x, y, BOW[band], 0.55);
    }

    // Clouds: soft heaps lit from the low sun on the right, flat underneath.
    var CLOUD = ['#C9806C', '#E0A086', '#F0C0A0', '#FBDDC0', '#FFF2DE'].map(hex);
    function cloud(cx, cy, s, seed) {
      var r2 = rng(seed), puffs = [];
      var n = 7 + Math.floor(r2() * 4);
      for (var i = 0; i < n; i++) {
        var t = i / (n - 1) - 0.5;
        puffs.push([cx + t * 62 * s + (r2() - 0.5) * 6 * s, cy - (1 - Math.abs(t) * 1.7) * 14 * s - r2() * 6 * s, (9 + r2() * 8 + (1 - Math.abs(t) * 1.6) * 7) * s]);
      }
      var base = cy + 6 * s;
      var inside = function (x, y) {
        if (y > base) return false;
        for (var i = 0; i < puffs.length; i++) { var p = puffs[i]; if ((x + 0.5 - p[0]) * (x + 0.5 - p[0]) + (y + 0.5 - p[1]) * (y + 0.5 - p[1]) <= p[2] * p[2]) return true; }
        return false;
      };
      var x0 = Math.floor(cx - 50 * s), x1 = Math.ceil(cx + 50 * s), y0 = Math.floor(cy - 46 * s), y1 = Math.ceil(base);
      for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) {
        if (!inside(x, y)) continue;
        var best = 0;
        for (var i = 0; i < puffs.length; i++) {
          var p = puffs[i], dx = (x + 0.5 - p[0]) / p[2], dy = (y + 0.5 - p[1]) / p[2];
          if (dx * dx + dy * dy <= 1) best = Math.max(best, lit(dx, dy, 0.7, -0.55));
        }
        var under = Math.max(0, (y - (base - 10 * s)) / (10 * s)); // the flat base is in its own shadow
        px(x, y, ramp(CLOUD, best * 0.95 + 0.12 - under * 0.45, x, y));
      }
    }
    if (CLOUDS) { cloud(96, 52, 1.15, 11); cloud(268, 34, 0.8, 23); cloud(395, 92, 1.0, 37); cloud(180, 120, 0.55, 41); cloud(36, 140, 0.5, 53); return; }

    // The hills: three ridges, the far one hazed toward the sky, each a step greener and darker as it nears.
    function ridge(base, amp, f1, f2, ph, cols, haze) {
      var top = [];
      for (var x = 0; x < W; x++) top.push(Math.round(base - amp * (0.6 * Math.sin(x * f1 + ph) + 0.4 * Math.sin(x * f2 + ph * 1.7))));
      if (BASE) for (var x = 0; x < W; x++) for (var y = top[x]; y < H; y++) {
        var t = Math.min(1, (y - top[x]) / 26);
        var c = ramp(cols, 1 - t, x, y);
        px(x, y, c);
        if (haze) px(x, y, hex('#F6C27A'), haze);
      }
      return top;
    }
    var far = ridge(178, 10, 0.018, 0.041, 1.2, ['#5E7A4A', '#6F8C52', '#82A05C'].map(hex), 0.42);
    // The farm on the far ridge: a red barn with a white-trimmed roof, its silo, a fence along the crest.
    if (BASE) (function farm() {
      var bx = 118, gy = far[bx + 12];
      var RED = hex('#A9473A'), RED_D = hex('#8A3A31'), ROOF = hex('#6E4A3C'), TRIM = hex('#EFE3D0'), SILO = hex('#B9AFA2'), SILO_D = hex('#958B80');
      rect(bx + 30, gy - 30, 8, 30, SILO); rect(bx + 35, gy - 30, 3, 30, SILO_D); disc(bx + 34, gy - 30, 4, function (x, y, nx, ny) { return ny < 0 ? (nx > 0.3 ? SILO_D : SILO) : null; });
      rect(bx, gy - 16, 26, 16, RED); rect(bx + 18, gy - 16, 8, 16, RED_D);
      poly([[bx - 2, gy - 15], [bx + 13, gy - 26], [bx + 28, gy - 15]], function () { return ROOF; });
      line(bx - 2, gy - 15, bx + 13, gy - 26, TRIM); line(bx + 13, gy - 26, bx + 28, gy - 15, TRIM);
      rect(bx + 9, gy - 9, 8, 9, hex('#5A2E28')); line(bx + 9, gy - 9, bx + 16, gy - 1, TRIM); line(bx + 16, gy - 9, bx + 9, gy - 1, TRIM);
      for (var x = 20; x < 240; x += 7) { var fy = far[x]; rect(x, fy - 4, 1, 4, hex('#6A5038')); }
      for (var x = 20; x < 240; x++) px(x, far[x] - 3, hex('#7C6046'));
    })();
    var mid = ridge(198, 9, 0.011, 0.033, 3.1, ['#4E7A3C', '#5E8A44', '#74A050'].map(hex), 0.16);
    // A lane winding up the middle ridge toward the barn, with a hay cart on it.
    var LANE = hex('#C8A26A'), LANE_D = hex('#A8834F');
    if (BASE) for (var y = 0; y < 60; y++) {
      var t = y / 60, cx = 150 + Math.sin(t * 5.2) * 30 * (1 - t) + t * 0;
      var yy = 240 - y * 0.95, w = 1 + (1 - t) * 6;
      for (var x = Math.round(cx - w); x <= Math.round(cx + w); x++) if (yy >= mid[x] + 1) px(x, Math.round(yy), x < cx - w + 1.5 ? LANE_D : LANE);
    }
    var near = ridge(228, 6, 0.009, 0.027, 0.4, ['#3C6A30', '#4A7A36', '#5C8E40'].map(hex), 0);
    if (!FIELD) return;

    // The sunflowers: row upon row, small and dense at the back, big at the front.
    var PET = ['#B8741A', '#D9961E', '#F2B829', '#FFD54A', '#FFE88A'].map(hex);
    var DISC = ['#3A220F', '#55331A', '#6E4524', '#8A5A2E'].map(hex);
    var STEM = hex('#3C6A2C'), STEM_L = hex('#5A8C3A'), LEAF = ['#2E5A26', '#3F7230', '#58903C', '#74A84A'].map(hex);
    var flowers = [];
    for (var row = 0; row < 9; row++) {
      var y = 214 + row * row * 1.15 + row * 3.2, r = 2.2 + row * 1.55, gap = r * 2.3;
      for (var x = -10 + (row % 2) * gap * 0.5 + R() * gap; x < W + 10; x += gap * (0.85 + R() * 0.3))
        flowers.push({ x: x, y: y + (R() - 0.5) * r * 0.8, r: r * (0.85 + R() * 0.3), turn: (R() - 0.5) * 0.5, row: row });
    }
    // The sheep stands among them, about a third in; the flowers in front of it are drawn after it.
    var SHEEP = { x: 150, y: 262 };
    flowers.sort(function (a, b) { return a.y - b.y; });
    function foliage(f) {
      // The dark mass of leaves and stems under each head, so the field reads as a field and not as dots.
      var r = f.r;
      disc(f.x - r * 0.9, f.y + r * 1.6, r * 0.9, function (x, y, nx, ny) { return ramp(LEAF, lit(nx, ny, 0.6, -0.6) * 0.9, x, y); });
      disc(f.x + r * 0.9, f.y + r * 1.9, r * 0.85, function (x, y, nx, ny) { return ramp(LEAF, lit(nx, ny, 0.6, -0.6) * 0.8, x, y); });
      rect(Math.round(f.x), Math.round(f.y + r * 0.5), Math.max(1, Math.round(r * 0.22)), Math.round(r * 3.5), STEM);
      if (r > 6) rect(Math.round(f.x) + 1, Math.round(f.y + r * 0.5), 1, Math.round(r * 3.5), STEM_L);
    }
    function head(f) {
      var r = f.r, cx = f.x, cy = f.y;
      // Petals: a ring of points, each a small lit lozenge, longer at the front-facing sides.
      var n = r > 7 ? 16 : r > 4 ? 12 : 8;
      for (var i = 0; i < n; i++) {
        var a = (i / n) * Math.PI * 2 + f.turn, px0 = cx + Math.cos(a) * r * 0.62, py0 = cy + Math.sin(a) * r * 0.55;
        var pr = Math.max(1, r * 0.42);
        disc(px0, py0, pr, function (x, y, nx, ny) { return ramp(PET, 0.25 + lit(nx, ny, 0.7, -0.6) * 0.75 + (Math.sin(a) < 0 ? 0.05 : -0.1), x, y); });
      }
      disc(cx, cy, Math.max(1, r * 0.46), function (x, y, nx, ny) {
        var t = lit(nx, ny, 0.6, -0.6);
        if (r > 6 && ((x * 7 + y * 13) % 5 === 0)) return DISC[0]; // seeds
        return ramp(DISC, t, x, y);
      });
    }
    var behind = flowers.filter(function (f) { return f.y < SHEEP.y - 22; }), front = flowers.filter(function (f) { return f.y >= SHEEP.y - 22; });
    // A dark field floor first, under every row.
    for (var x = 0; x < W; x++) for (var y = 212; y < H; y++) if (y >= near[x] - 6 || y > 236) px(x, y, ramp(LEAF, 0.25 - (y - 212) / 300, x, y));
    behind.forEach(foliage); behind.forEach(head);
    sheep(SHEEP.x, SHEEP.y);
    front.forEach(foliage); front.forEach(head);

    // The bumblebees fly in the chooser itself (the 'bee' layer), and the light falls there too.
  }

  /** A woolly sheep from behind and to the left, its head turned to the sunset, in a green knit cap. Feet at (fx, fy). */
  function sheep(fx, fy) {
    var WOOL = ['#8E8378', '#B4A898', '#D8CDBD', '#EEE5D6', '#FFF6E8'].map(hex);
    var RIM = hex('#FFD9A8'), FACE = ['#2E2422', '#433533', '#5A4A46'].map(hex), EAR = hex('#7A5A52');
    var CAP = ['#1F5A3A', '#2C7A4C', '#3C9A5E', '#5BB878'].map(hex);
    var bx = fx, by = fy - 36;
    // The fleece: overlapping tufts, lit from the right.
    var tufts = [[0, 0, 22], [-16, 4, 15], [16, 2, 17], [-6, -12, 15], [10, -12, 14], [-22, -6, 10], [24, -6, 11], [0, 12, 18], [-14, 14, 12], [14, 14, 13], [-26, 8, 9], [28, 6, 9], [4, -20, 9], [-14, -18, 8]];
    tufts = tufts.map(function (t) { return [t[0] * 1.2, t[1] * 1.2, t[2] * 1.2]; });
    function tuftAt(x, y) { var best = -1, bi = -1; for (var i = 0; i < tufts.length; i++) { var t = tufts[i], dx = (x + 0.5 - bx - t[0]) / t[2], dy = (y + 0.5 - by - t[1]) / t[2], d = 1 - dx * dx - dy * dy; if (d >= 0 && t[1] * 0.02 + d * 0.3 + i * 0.001 > best) { best = t[1] * 0.02 + d * 0.3 + i * 0.001; bi = i; } } return bi; }
    var inside = function (x, y) {
      for (var i = 0; i < tufts.length; i++) { var t = tufts[i], dx = x + 0.5 - bx - t[0], dy = y + 0.5 - by - t[1]; if (dx * dx + dy * dy <= t[2] * t[2]) return true; }
      return false;
    };
    outline(bx - 48, by - 36, bx + 52, by + 40, inside, hex('#4A3A34'));
    for (var y = by - 36; y <= by + 40; y++) for (var x = bx - 48; x <= bx + 52; x++) {
      if (!inside(x, y)) continue;
      var me = tuftAt(x, y);
      if (me !== tuftAt(x, y + 1) && inside(x, y + 1)) { px(x, y, WOOL[1]); continue; } // the curl between two tufts
      var best = 0;
      for (var i = 0; i < tufts.length; i++) { var t = tufts[i], dx = (x + 0.5 - bx - t[0]) / t[2], dy = (y + 0.5 - by - t[1]) / t[2]; if (dx * dx + dy * dy <= 1) best = Math.max(best, lit(dx, dy, 0.8, -0.5)); }
      px(x, y, ramp(WOOL, best * 0.95 + 0.05, x, y));
      if (!inside(x + 1, y) || !inside(x + 1, y - 1)) px(x, y, RIM, 0.75); // the sun on its edge
    }
    // The head: turned up and to the right, toward the sun.
    var hx = bx + 36, hy = by - 30;
    var headIn = function (x, y) { var dx = (x + 0.5 - hx) / 11, dy = (y + 0.5 - hy) / 9; return dx * dx + dy * dy <= 1 || (x >= hx && x <= hx + 13 && y >= hy - 2 && y <= hy + 7 - (x - hx) * 0.2); };
    outline(hx - 14, hy - 12, hx + 16, hy + 12, headIn, hex('#1A1210'));
    for (var y = hy - 12; y <= hy + 12; y++) for (var x = hx - 14; x <= hx + 16; x++) if (headIn(x, y)) px(x, y, ramp(FACE, Math.min(1, (x - hx + 10) / 26 + (hy - y) / 30), x, y));
    // Warm light on the muzzle and the brow, a dark eye with a catchlight, the ear dropped back.
    for (var y = hy - 6; y <= hy + 6; y++) for (var x = hx; x <= hx + 14; x++) if (headIn(x, y) && !headIn(x + 1, y)) px(x, y, RIM, 0.8);
    rect(hx + 4, hy - 2, 2, 2, hex('#120C0A')); px(hx + 5, hy - 2, hex('#F7E6C8'));
    rect(hx + 12, hy + 3, 1, 1, hex('#1A1210'));
    poly([[hx - 8, hy - 2], [hx - 18, hy + 2], [hx - 16, hy + 5], [hx - 7, hy + 2]], function () { return EAR; });
    // The cap: a knit dome with a rolled brim and a small pompom, sitting back on the wool of the head.
    var cx = hx - 2, cy = hy - 9;
    disc(cx, cy, 9, function (x, y, nx, ny) { if (ny > 0.25) return null; var t = lit(nx, ny, 0.7, -0.6); if ((x + y) % 3 === 0) t -= 0.12; return ramp(CAP, t, x, y); });
    rect(cx - 10, cy + 1, 21, 3, CAP[1]); rect(cx - 10, cy + 1, 21, 1, CAP[2]);
    for (var x = cx - 10; x <= cx + 10; x += 2) px(x, cy + 3, CAP[0]);
    disc(cx - 1, cy - 9, 3, function (x, y, nx, ny) { return ramp(CAP, lit(nx, ny, 0.7, -0.6) + 0.1, x, y); });
    // A bee resting on its nose.
    bee(hx + 15, hy - 1, 0.7, 1);
  }

  /** A round bumblebee, `s` times the size of a small one, facing `dir`. */
  function bee(cx, cy, s, dir) {
    var BODY = ['#1E1612', '#2E2420'].map(hex), YEL = ['#C8901C', '#F0B82A', '#FFD860'].map(hex), WING = hex('#FFF6E6');
    var rx = 5 * s, ry = 3.6 * s;
    // Wings: two pale ovals over the back, half see-through.
    for (var w = 0; w < 2; w++) {
      var wx = cx - dir * (1 + w * 2.2) * s, wy = cy - ry - 2.2 * s + w * 0.8 * s, wr = 3.2 * s;
      for (var y = Math.floor(wy - wr); y <= wy + wr; y++) for (var x = Math.floor(wx - wr * 1.2); x <= wx + wr * 1.2; x++) {
        var dx = (x + 0.5 - wx) / (wr * 1.2), dy = (y + 0.5 - wy) / wr;
        if (dx * dx + dy * dy <= 1) px(x, y, WING, dx * dx + dy * dy > 0.6 ? 0.85 : 0.55);
      }
    }
    for (var y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) for (var x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
      var dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, d = dx * dx + dy * dy;
      if (d > 1) { if (d < 1.35 && ((x + y) & 1)) px(x, y, YEL[0], 0.5); continue; } // fuzz
      var along = dx * dir, t = lit(dx, dy, 0.6 * dir, -0.7);
      var stripe = along < -0.55 ? 0 : along < -0.15 ? 1 : along < 0.25 ? 0 : along < 0.62 ? 1 : 2;
      px(x, y, stripe === 1 ? ramp(YEL, t + 0.1, x, y) : stripe === 2 ? ramp(BODY, t, x, y) : ramp(BODY, t * 0.6, x, y));
    }
    px(cx + dir * rx * 0.75, cy - ry * 0.2, hex('#FFF6E6'));
  }

}

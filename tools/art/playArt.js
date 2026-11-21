// The two pictures of the Queue chooser (src/skin/ranked/PlayChooser.tsx), drawn as pixel art on a 2D canvas, every
// pixel placed by this file (Brian, 2026-11-21: "use high bitrate pixelrate ... make the first one a relaxing scenery
// ... and the second one should be like an epic battle ... in the same farm theme").
//
//  - Casual, "the evening meadow": a sheep in a green knit cap among sunflowers, looking over the hills to the barn at
//    sunset, bumblebees drifting round it, big soft clouds, a faint rainbow.
//  - Ranked, "the face-off": three slanted panels, each in its own neon light with streaks of it falling past, a ram, a
//    sheep and a goat squaring up.
//
// Plain JavaScript with no imports: tools/renderPlayArt.mjs puts this file into a blank page and calls
// `drawPlayArt(name)`. The same seed gives the same picture, pixel for pixel. Art is W x H pixels; the tool scales it
// up by whole pixels (nearest neighbour), so every pixel stays square.

/* eslint-disable */
var PLAY_ART = { W: 480, H: 300, SCALE: 3 };

function drawPlayArt(name) {
  var W = PLAY_ART.W, H = PLAY_ART.H;
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

  if (name === 'casual') casual(); else ranked();
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
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) px(x, y, ramp(SKY, Math.pow(y / HORIZON, 1.1), x, y));
    // The sun's glow behind the far hills, right of the barn.
    var GLOW = hex('#FFF1C4');
    for (var y = 110; y < HORIZON + 4; y++) for (var x = 230; x < 470; x++) {
      var d = Math.hypot((x - 352) / 120, (y - 186) / 60);
      if (d < 1 && (1 - d) * (1 - d) > bayer(x, y) * 1.15) px(x, y, GLOW, 0.55);
    }
    // A faint rainbow, high on the right, in six thin bands that fade toward the hills.
    var BOW = ['#E8574A', '#F2934A', '#F5D36A', '#8FC46A', '#6FA7C9', '#9B85C9'].map(hex);
    for (var y = 0; y < 170; y++) for (var x = 300; x < W; x++) {
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
    cloud(96, 52, 1.15, 11); cloud(268, 34, 0.8, 23); cloud(395, 92, 1.0, 37); cloud(180, 120, 0.55, 41); cloud(36, 140, 0.5, 53);

    // The hills: three ridges, the far one hazed toward the sky, each a step greener and darker as it nears.
    function ridge(base, amp, f1, f2, ph, cols, haze) {
      var top = [];
      for (var x = 0; x < W; x++) top.push(Math.round(base - amp * (0.6 * Math.sin(x * f1 + ph) + 0.4 * Math.sin(x * f2 + ph * 1.7))));
      for (var x = 0; x < W; x++) for (var y = top[x]; y < H; y++) {
        var t = Math.min(1, (y - top[x]) / 26);
        var c = ramp(cols, 1 - t, x, y);
        px(x, y, c);
        if (haze) px(x, y, hex('#F6C27A'), haze);
      }
      return top;
    }
    var far = ridge(178, 10, 0.018, 0.041, 1.2, ['#5E7A4A', '#6F8C52', '#82A05C'].map(hex), 0.42);
    // The farm on the far ridge: a red barn with a white-trimmed roof, its silo, a fence along the crest.
    (function farm() {
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
    for (var y = 0; y < 60; y++) {
      var t = y / 60, cx = 150 + Math.sin(t * 5.2) * 30 * (1 - t) + t * 0;
      var yy = 240 - y * 0.95, w = 1 + (1 - t) * 6;
      for (var x = Math.round(cx - w); x <= Math.round(cx + w); x++) if (yy >= mid[x] + 1) px(x, Math.round(yy), x < cx - w + 1.5 ? LANE_D : LANE);
    }
    var near = ridge(228, 6, 0.009, 0.027, 0.4, ['#3C6A30', '#4A7A36', '#5C8E40'].map(hex), 0);

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

    // Bumblebees drifting about, a few big ones close to us.
    var BEES = [[120, 70, 1.6], [208, 92, 1.1], [300, 60, 0.9], [352, 130, 1.3], [410, 40, 1.0], [440, 178, 1.9], [60, 190, 2.2], [246, 150, 0.8], [30, 58, 1.2], [392, 236, 2.6], [228, 125, 1.0]];
    BEES.forEach(function (b, i) { bee(b[0], b[1], b[2], i % 2 ? 1 : -1); });

    // A soft warm light over everything from the low sun: a vignette darker at the bottom corners.
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      var v = Math.hypot((x - W * 0.55) / (W * 0.75), (y - H * 0.42) / (H * 0.8));
      if (v > 0.8 && (v - 0.8) * 1.4 > bayer(x, y)) px(x, y, hex('#2A1A2E'), 0.22);
    }
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

  // =================================================================================================================
  // Ranked: the face-off
  // =================================================================================================================
  /**
   * Three slanted panels, each in its own neon light with streaks of it falling past (Brian, 2026-11-21, after a picture
   * of his: a rooster in a karate gi making a hand sign, a ram throwing a punch, a goat with its arms crossed, roaring;
   * "the same level of detail as krillion"). Drawn chunkier than the meadow: 120 x 75 pixels, each one 4 x 4 here, so
   * the fighters are small sprites placed pixel by pixel from the maps below.
   */
  function ranked() {
    var w = 120, h = 75, S = W / w;
    var mine = new Int8Array(w * h);
    var small = new Array(w * h);
    function set(x, y, c, who) { x |= 0; y |= 0; if (x >= 0 && y >= 0 && x < w && y < h) { small[y * w + x] = c; if (who !== undefined) mine[y * w + x] = who; } }
    function at(x, y) { return small[y * w + x]; }
    function mix(a, b, t) { return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)]; }
    var INK = hex('#07050C');
    // The gutters: x at the top and at the bottom of each.
    var G1 = [44, 36], G2 = [83, 75];
    var gx = function (g, y) { return g[0] + (g[1] - g[0]) * (y / h); };
    var panelOf = function (x, y) { return x < gx(G1, y) - 1 ? 0 : x > gx(G1, y) + 2 && x < gx(G2, y) - 1 ? 1 : x > gx(G2, y) + 2 ? 2 : -1; };
    var LIGHT = [
      ['#041019', '#07304A', '#0C6E96', '#22B8E8', '#8EEBFF', '#E8FCFF'],
      ['#17041A', '#460A44', '#951A82', '#E23CB8', '#FF96E4', '#FFEEFA'],
      ['#061404', '#16400A', '#348A16', '#7EDC34', '#D4FF7A', '#F8FFE8'],
    ].map(function (l) { return l.map(hex); });
    var CENTRE = [[20, 30], [59, 30], [99, 30]];
    // The dark of each panel, lighter round its fighter; then the rain of light.
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var p = panelOf(x, y);
      if (p < 0) { set(x, y, INK); continue; }
      var L = LIGHT[p], c = CENTRE[p], g = Math.max(0, 1 - Math.hypot((x - c[0]) / 26, (y - c[1]) / 40));
      set(x, y, g > 0.55 ? L[2] : g > 0.2 ? L[1] : L[0]); // hard rings of light, no dithering at this size
    }
    var rr = rng(4242);
    for (var k = 0; k < 150; k++) {
      var x = Math.floor(rr() * w), y0 = Math.floor(rr() * h * 1.3) - 15, len = 3 + Math.floor(rr() * rr() * 30), b = rr();
      for (var y = y0; y < y0 + len; y++) { if (y < 0 || y >= h) continue; var p = panelOf(x, y); if (p < 0) continue; var L = LIGHT[p]; set(x, y, mix(at(x, y), L[b > 0.85 ? 5 : b > 0.5 ? 4 : 3], (b > 0.85 ? 0.9 : 0.55) * (1 - (y - y0) / len * 0.6))); }
    }
    for (var k = 0; k < 40; k++) { var x = Math.floor(rr() * w), y = Math.floor(rr() * h), p = panelOf(x, y); if (p >= 0) set(x, y, LIGHT[p][5]); }
    // Each panel's edge catches its light.
    for (var y = 0; y < h; y++) {
      set(Math.round(gx(G1, y)) - 2, y, LIGHT[0][4]); set(Math.round(gx(G1, y)) + 3, y, LIGHT[1][4]);
      set(Math.round(gx(G2, y)) - 2, y, LIGHT[1][4]); set(Math.round(gx(G2, y)) + 3, y, LIGHT[2][4]);
    }

    // ---- the fighters, from maps: one character a pixel, '.' nothing ----
    function sprite(rows, pal, x0, y0, panel) {
      for (var j = 0; j < rows.length; j++) for (var i = 0; i < rows[j].length; i++) {
        var ch = rows[j][i];
        if (ch === '.' || ch === ' ') continue;
        var x = x0 + i, y = y0 + j;
        if (panel !== undefined && panelOf(x, y) !== panel) continue;
        set(x, y, hex(pal[ch]), panel + 1);
      }
    }
    /** The panel's light on a fighter: every pixel of it with open air up and to the panel's back gets the rim colour. */
    function rim(x0, y0, x1, y1, panel, isMine, side) {
      var hits = [];
      for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) {
        if (!isMine(x, y)) continue;
        if (!isMine(x + side, y) || !isMine(x, y - 1)) hits.push(x, y);
      }
      for (var i = 0; i < hits.length; i += 2) if (panelOf(hits[i], hits[i + 1]) === panel) set(hits[i], hits[i + 1], LIGHT[panel][4]);
    }
    function aura(cx, cy, rx, ry, panel) {
      for (var y = Math.floor(cy - ry); y <= cy + ry; y++) for (var x = Math.floor(cx - rx); x <= cx + rx; x++) {
        var d = Math.hypot((x - cx) / rx, (y - cy) / ry);
        if (d < 1 && panelOf(x, y) === panel && d < 0.75) set(x, y, mix(at(x, y), LIGHT[panel][3], d < 0.45 ? 0.4 : 0.22));
      }
    }

    /** A torso from the shoulders down past the bottom: flat colour, a shaded far side, inked edges. */
    function body(panel, cx, top, rx, col, shade, wool) {
      for (var y = top; y < h; y++) {
        var t = y - top, hw = rx * Math.min(1, Math.sqrt(t / 8 + 0.12)) + (wool ? (Math.floor(y / 3) % 2) : 0);
        var x0 = Math.round(cx - hw), x1 = Math.round(cx + hw);
        for (var x = x0; x <= x1; x++) {
          if (panelOf(x, y) !== panel) continue;
          var edge = x === x0 || x === x1 || y === top;
          set(x, y, edge ? INK : hex(x > cx + hw * 0.4 ? shade : col), panel + 1);
        }
      }
    }
    function blk(panel, x0, y0, ww, hh, c) { for (var y = y0; y < y0 + hh; y++) for (var x = x0; x < x0 + ww; x++) if (panelOf(x, y) === panel) set(x, y, hex(c), panel + 1); }

    // The rooster, in the cyan panel: a karate gi open over white feathers, a black belt, its wing-hands making a sign
    // before its chest, crowing at us.
    var ROO = { k: '#0B0910', w: '#F4F1EC', g: '#B9C2CE', d: '#7D8796', r: '#E0303C', R: '#97182A', y: '#F6C433', o: '#C77A1A', m: '#3A0E1C', t: '#E8707C', e: '#FFFFFF', p: '#0B0910',
      b: '#A9773E', B: '#7A5226', n: '#17131A' };
    aura(20, 34, 24, 34, 0);
    body(0, 20, 21, 14, ROO.w, ROO.g);
    for (var y = 22; y < h; y++) { // the gi: brown from the sides in, open in a V down to the belt
      var open = y < 46 ? Math.max(0, 9 - (y - 22) * 0.38) : 0;
      for (var x = 0; x < 44; x++) {
        if (mine[y * w + x] !== 1 || small[y * w + x] === INK) continue;
        var d = Math.abs(x - 20);
        if (y >= 46 || d > open + 2) set(x, y, hex(x > 26 ? ROO.B : ROO.b), 1);
        else if (d > open) set(x, y, hex(ROO.B), 1);
      }
    }
    for (var x = 0; x < 44; x++) for (var y = 47; y < 50; y++) if (mine[y * w + x] === 1) set(x, y, hex(ROO.n), 1); blk(0, 18, 46, 5, 5, ROO.n); blk(0, 17, 51, 2, 8, ROO.n); blk(0, 22, 51, 2, 7, ROO.n); // the belt and its knot
    for (var k = 0; k < 4; k++) { set(12 + k * 4, 30 + (k % 2), hex(ROO.g), 1); set(13 + k * 4, 31 + (k % 2), hex(ROO.g), 1); } // feathers
        sprite([
      '..........k.kk.kk.......',
      '.........krkrrkrrk......',
      '........krrrrrrrrrk.....',
      '........krrRrrrrrrrk....',
      '.........kRrrrrrrRk.....',
      '........kkwwwwwwwwkk....',
      '.......kwwwwwwwwwwwgk...',
      '......kwkkkwwwwwwwwwgk..',
      '......kwwrkkwwwwwwwwgk..',
      '.....kkkwkpkwwwwwwwwgk..',
      '....kyyykkkwwwwwwwwggk..',
      '...kyyyyyykwwwwwwwwgk...',
      '..kyyyyyyyykwwwwwwwgk...',
      '...kmmmmmmkrwwwwwwggk...',
      '....kmtttmkrrwwwwwgk....',
      '...koooooookrrwwwggk....',
      '....kkkkkkkkrRrrwgk.....',
      '..........kRrrrRkgk.....',
      '...........kRRRk.gk.....',
      '............kkk..k......',
    ], ROO, 8, 2, 0);
    limb(0, 9, 27, 6, 42, 4, ROO.w, ROO.g); limb(0, 31, 27, 34, 42, 4, ROO.w, ROO.g); // the wings, as arms
    limb(0, 6, 42, 16, 38, 3, ROO.w, ROO.g); limb(0, 34, 42, 24, 38, 3, ROO.w, ROO.g);
    sprite([
      '...kkk.....kkk...',
      '..kwwwk...kwwwk..',
      '.kwwkwwk.kwwkwwk.',
      'kwwwkwwwkwwwkwwwk',
      'kwwkwwwwwwwwwkwwk',
      '.kwwkwwgwwgwkwwk.',
      '..kwwwkwwwwkwwwk.',
      '...kwwwwggwwwwk..',
      '....kkwwwwwwkk...',
      '......kkkkkk.....',
    ], ROO, 12, 32, 0);
    for (var k = 0; k < 5; k++) { set(6 + k, 28 - k, LIGHT[0][5], 1); set(30 + k, 40 + k, LIGHT[0][5], 1); } // the sign's energy

    // The ram, in the magenta panel: curled horns, a mane of wool, teeth gritted, a fist coming straight at us.
    var RAM = { k: '#0B0910', c: '#F4E8D0', C: '#CDB898', h: '#D29A44', H: '#8C5A22', s: '#E8B088', S: '#B87A58', e: '#FFFFFF', p: '#0B0910', t: '#FFFFFF', m: '#4A1020', f: '#EEB48C', F: '#B8785A' };
    aura(59, 34, 24, 34, 1);
    body(1, 59, 19, 15, RAM.c, RAM.C, true);
    var tu = rng(77);
    for (var k = 0; k < 40; k++) { var x = 42 + Math.floor(tu() * 36), y = 22 + Math.floor(tu() * 52); if (mine[y * w + x] === 2 && small[y * w + x] !== INK) { set(x, y, hex(RAM.C), 2); set(x + 1, y - 1, hex(RAM.C), 2); } } // the curls
    /** A thick limb from one point to another: inked round its edge, shaded on its far side. */
    function limb(panel, x0, y0, x1, y1, r, col, shade) {
      for (var pass = 0; pass < 2; pass++) for (var t = 0; t <= 1; t += 0.04) {
        var ax = x0 + (x1 - x0) * t, ay = y0 + (y1 - y0) * t;
        for (var dx = -4; dx <= 4; dx++) for (var dy = -4; dy <= 4; dy++) {
          var d = Math.hypot(dx, dy);
          if (pass === 0 && d <= r + 0.9) set(ax + dx, ay + dy, INK, panel + 1);
          if (pass === 1 && d <= r - 0.1) set(ax + dx, ay + dy, hex(dx + dy > 1 ? shade : col), panel + 1);
        }
      }
    }
    // The fleece's edge: a run of tufts round the shoulders and down the sides, inked first and filled after, so they
    // read as one heap of curls.
    var puffs = [];
    for (var x = 45; x <= 73; x += 5) puffs.push([x, 22 + Math.abs(x - 59) * 0.18]);
    for (var y = 27; y < 75; y += 5) { puffs.push([44 + (y % 2), y]); puffs.push([74 - (y % 2), y]); }
    for (var pass = 0; pass < 2; pass++) puffs.forEach(function (q) {
      for (var dx = -4; dx <= 4; dx++) for (var dy = -4; dy <= 4; dy++) {
        var d = Math.hypot(dx, dy), x = q[0] + dx, y = q[1] + dy;
        if (panelOf(x, y) !== 1) continue;
        if (pass === 0 && d <= 3.8) set(x, y, INK, 2);
        if (pass === 1 && d <= 2.9) set(x, y, hex(dx + dy > 1 ? RAM.C : RAM.c), 2);
      }
    });
    limb(1, 47, 30, 46, 58, 3, RAM.s, RAM.S); limb(1, 71, 30, 74, 40, 3, RAM.s, RAM.S); // the arms, bare and strong
    // Curls all over the fleece: a small dark arc every few pixels, in staggered rows.
    var woolC = hex(RAM.c), woolS = hex(RAM.C), curlD = hex('#A8946E');
    var isWool = function (x, y) { var c = at(x, y); return c && mine[y * w + x] === 2 && ((c[0] === woolC[0] && c[1] === woolC[1]) || (c[0] === woolS[0] && c[1] === woolS[1])); };
    for (var y = 24; y < h; y += 4) for (var x = 40 + ((y / 4) % 2) * 2; x < 80; x += 4) {
      if (!isWool(x, y) || !isWool(x + 2, y) || !isWool(x, y + 1)) continue;
      set(x, y + 1, curlD, 2); set(x + 1, y, curlD, 2); set(x + 2, y + 1, curlD, 2);
    }
    limb(1, 74, 40, 68, 38, 3, RAM.s, RAM.S); // the forearm, behind the fist
    sprite([
      '.......kkkkkkkkkkk.......',
      '..kkk.kcccCcccCccck.kkk..',
      '.khhhkcccccccccccccckhhhk',
      'khhHhkcCcccccccccCcckhHhk',
      'khHkhkccccCcccCccccckhHhk',
      'khHkhhkcccccccccccckhhkHk',
      'khhHHhkssssssssssssskHHhk',
      '.khhhkkkkkssssssskkkkkhk.',
      '..kkkssskkkssssskkksssk..',
      '....kskeepkssssskpeeksk..',
      '....ksskkkksssssskkkkssk.',
      '....ksssssssSSSsssssssk..',
      '.....ksssssSSsSSssssssk..',
      '.....ksssssskkkssssssk...',
      '......kskkkkkkkkkkksk....',
      '......ksktttttttttksk....',
      '......ksktktktktktksk....',
      '......kskkkkkkkkkkksk....',
      '.......ksssssSSSsssk.....',
      '........kkkkkkkkkkk......',
    ], RAM, 47, 2, 1);
    sprite([
      '...kkkkkkkkkk...',
      '..kffkffkffkfk..',
      '.kfffkffkffkffk.',
      '.kfffkffkffkffk.',
      '.kfffkffkffkffk.',
      'kkffffffffffffk.',
      'kfkfffffffffffk.',
      'kffkffffFFfffFk.',
      'kfffkfffffffffk.',
      '.kFfffffffffFk..',
      '..kFFffffffFFk..',
      '...kkkkkkkkkk...',
    ], RAM, 59, 31, 1);
    for (var k = 0; k < 4; k++) { set(76, 33 + k * 2, LIGHT[1][5], 2); set(77, 33 + k * 2, LIGHT[1][5], 2); } // the punch's swing

    // The goat, in the green panel: green fire round it, long horns, wild white eyes, roaring, arms crossed, a ragged beard.
    var GOAT = { k: '#0B0910', h: '#A08868', H: '#6E5A40', g: '#B4B0A6', G: '#7E7A72', d: '#5A564E', e: '#FFFFFF', p: '#0B0910', m: '#3A0E14', t: '#E07080', T: '#FFFFFF', b: '#B49A70', B: '#7E6844', a: '#A8A498', A: '#6E6A60' };
    aura(99, 34, 24, 34, 2);
    var fl = rng(91);
    for (var k = 0; k < 14; k++) { // flames licking up behind it
      var fx = 80 + Math.floor(fl() * 40), fy = 40 + Math.floor(fl() * 36), fh = 6 + Math.floor(fl() * 14);
      for (var j = 0; j < fh; j++) { var wdt = Math.max(0, Math.round((1 - j / fh) * 2.2)); for (var dx = -wdt; dx <= wdt; dx++) if (panelOf(fx + dx, fy - j) === 2) set(fx + dx, fy - j, LIGHT[2][j < fh * 0.4 ? 4 : 3]); }
    }
    body(2, 99, 22, 14, GOAT.g, GOAT.G);
        // Arms crossed over the chest, the fists up at the shoulders.
    limb(2, 88, 27, 85, 44, 4, GOAT.a, GOAT.A); limb(2, 110, 27, 113, 44, 4, GOAT.a, GOAT.A); // the upper arms
    limb(2, 85, 44, 106, 32, 3, GOAT.a, GOAT.A); limb(2, 113, 44, 92, 32, 3, GOAT.a, GOAT.A); // crossed
    for (var sx of [92, 106]) { blk(2, sx - 3, 29, 7, 6, GOAT.k); blk(2, sx - 2, 30, 5, 4, GOAT.d); } // the hooves at the shoulders
        sprite([
      'kk....................kk',
      'khk..................khk',
      'kHhk................khHk',
      '.kHhk..............khHk.',
      '.khHhk............khHhk.',
      '..khHhk..kkkkkk..khHhk..',
      '..kkhHhkkggggggkkhHhkk..',
      'kkggkhHhggggggggggHhkggk',
      'kggggkkgggggggggggkkgggk',
      '.kGgggkgkkkggggkkkgkggGk',
      '..kkkkgkeepkggkpeekgkkk.',
      '.....kgkeekkggkkeekgk...',
      '.....kgggggggGggggggk...',
      '.....kgGgggggGGgggGgk...',
      '......kgggggkkkggggk....',
      '......kgkmmmmmmmmkgk....',
      '......kgkmTTTTTTmkgk....',
      '......kgkmmttttmmkgk....',
      '......kbkmTTTTTTmkbk....',
      '.....kbbbkkkkkkkkbbbk...',
      '.....kbBbbbbbbbbbbBbk...',
      '......kbBbbBbbBbbBbk....',
      '.......kbBbbbbbbBbk.....',
      '........kbkbBbkbbk......',
      '.........k.kbk.kk.......',
    ], GOAT, 87, 0, 2);

    // Every fighter's outer edge burns in its panel's light.
    var edgeHits = [];
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var m = mine[y * w + x];
      if (!m) continue;
      if ((x > 0 && !mine[y * w + x - 1]) || (x + 1 < w && !mine[y * w + x + 1]) || (y > 0 && !mine[(y - 1) * w + x])) edgeHits.push(x, y, m - 1);
    }
    for (var i = 0; i < edgeHits.length; i += 3) set(edgeHits[i], edgeHits[i + 1], LIGHT[edgeHits[i + 2]][4]);

    // Copy the small picture into the big one, each pixel 3 x 3.
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) { var c = small[y * w + x]; if (c) for (var dy = 0; dy < S; dy++) for (var dx = 0; dx < S; dx++) px(x * S + dx, y * S + dy, c); }
  }
}

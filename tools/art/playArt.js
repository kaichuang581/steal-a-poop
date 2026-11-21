// The Queue chooser's two pictures (src/skin/ranked/PlayChooser.tsx), drawn as pixel art on a 2D canvas, every pixel
// placed by this file (Brian, 2026-11-21: "rehash everything solely with pixel art ... one looks casual/playful/
// nonstressful, while the other one looks exciting and competitive").
//
//  - Casual, "snow day": a soft winter morning. Far mountains and forest fading into the sky, the barn on its hill with
//    smoke from the chimney, a snowman in a knit cap with a robin on it, a sheep in a scarf admiring it, another sheep
//    sledding down the slope.
//  - Ranked, "the rink": a night match on the ice. Floodlights, fireworks, a crowd of farm animals in the stands with
//    camera flashes, the red corner against the blue corner, two rams meeting head on in the spotlight.
//
// Each scene is SCENE.W x SCENE.H pixels; tools/renderPlayArt.mjs scales them up by whole pixels (nearest neighbour), so
// every pixel stays square. Two small layers move in the chooser: 'casual-snow' (a tile of falling snow) and
// 'ranked-flash' (the second frame of the crowd's flashes and the fireworks' sparkle).
//
// Plain JavaScript with no imports: the tool puts this file into a blank page and calls `drawPlayArt(name)`. Nothing is
// random: the same code gives the same picture, pixel for pixel.

/* eslint-disable */
var PLAY_ART = { SCALE: 5, SCENE: { W: 160, H: 176 }, SNOW: { W: 48, H: 48 } };

function drawPlayArt(name) {
  var size = name === 'casual-snow' ? PLAY_ART.SNOW : PLAY_ART.SCENE;
  var W = size.W, H = size.H;
  var cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  var ctx = cv.getContext('2d');
  var img = ctx.createImageData(W, H);
  var buf = img.data;

  // ---- the toolkit ----
  function hex(h) { var n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mix(a, b, t) { return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)]; }
  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function bayer(x, y) { return (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16; }
  function seeded(s) { return function () { s |= 0; s = (s + 0x6d2b79f5) | 0; var t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  /** Sets a pixel; with `a`, blends over what is there (or, over nothing, sets it at that opacity). */
  function put(x, y, c, a) {
    x = Math.round(x); y = Math.round(y);
    if (!c || x < 0 || y < 0 || x >= W || y >= H) return;
    var i = (y * W + x) * 4;
    if (a === undefined || a >= 1) { buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = 255; return; }
    if (buf[i + 3] === 0) { buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = Math.round(a * 255); return; }
    buf[i] = Math.round(buf[i] + (c[0] - buf[i]) * a); buf[i + 1] = Math.round(buf[i + 1] + (c[1] - buf[i + 1]) * a); buf[i + 2] = Math.round(buf[i + 2] + (c[2] - buf[i + 2]) * a);
  }
  function get(x, y) { if (x < 0 || y < 0 || x >= W || y >= H) return null; var i = (y * W + x) * 4; return buf[i + 3] ? [buf[i], buf[i + 1], buf[i + 2]] : null; }
  function rect(x0, y0, w, h, c) { for (var y = y0; y < y0 + h; y++) for (var x = x0; x < x0 + w; x++) put(x, y, c); }
  /** A step of a ramp at t (0 to 1): solid bands, dithered only in a narrow strip where two bands meet. */
  function band(cols, t, x, y, soft) {
    var f = Math.max(0, Math.min(0.9999, t)) * (cols.length - 1), k = Math.floor(f), r = f - k, w = soft === undefined ? 0.22 : soft;
    if (r < 0.5 - w) return cols[k];
    if (r > 0.5 + w) return cols[Math.min(cols.length - 1, k + 1)];
    return (r - (0.5 - w)) / (2 * w) > bayer(x, y) ? cols[Math.min(cols.length - 1, k + 1)] : cols[k];
  }
  /** A sprite from rows of characters; '.' is clear. `flip` mirrors it. */
  function sprite(rows, pal, x0, y0, flip) {
    for (var j = 0; j < rows.length; j++) {
      var row = rows[j];
      for (var i = 0; i < row.length; i++) {
        var ch = row[i];
        if (ch === '.' || ch === ' ') continue;
        put(x0 + (flip ? row.length - 1 - i : i), y0 + j, pal[ch]);
      }
    }
  }
  /** A ridge line: the y of its top at each x, from a few slow waves. */
  function ridge(base, waves) {
    var top = [];
    for (var x = 0; x < W; x++) { var y = base; for (var k = 0; k < waves.length; k++) y += waves[k][0] * Math.sin(x * waves[k][1] + waves[k][2]); top.push(Math.round(y)); }
    return top;
  }
  /** A test for the inside of a blob made of circles, each [x, y, r]. */
  function blobInside(circles) {
    return function (x, y) {
      for (var i = 0; i < circles.length; i++) { var c = circles[i], dx = x + 0.5 - c[0], dy = y + 0.5 - c[1]; if (dx * dx + dy * dy <= c[2] * c[2]) return true; }
      return false;
    };
  }

  if (name === 'casual') casual();
  else if (name === 'casual-snow') snowTile();
  else if (name === 'ranked') ranked(false);
  else if (name === 'ranked-flash') ranked(true);
  ctx.putImageData(img, 0, 0);
  return cv;

  // ---- shared drawing for both scenes ----
  /**
   * A fluffy body: a union of puffs, each [x, y, r], lit from the upper left: the lit rim, the body, the shade toward
   * the lower right and the seams between puffs, then an outline round the outside (a step of the wool's own shade on
   * the lit side, the ink elsewhere). `pal` is [ink, deep, shade, body, lit]. Returns its inside test.
   */
  function fluff(puffs, pal, softLeft) {
    var inside = blobInside(puffs), x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    puffs.forEach(function (p) { x0 = Math.min(x0, p[0] - p[2] - 1); x1 = Math.max(x1, p[0] + p[2] + 1); y0 = Math.min(y0, p[1] - p[2] - 1); y1 = Math.max(y1, p[1] + p[2] + 1); });
    function owner(x, y) { var best = -1, bd = 1e9; for (var i = 0; i < puffs.length; i++) { var p = puffs[i], d = Math.hypot(x + 0.5 - p[0], y + 0.5 - p[1]) - p[2]; if (d < bd) { bd = d; best = i; } } return best; }
    for (var y = Math.floor(y0); y <= y1; y++) for (var x = Math.floor(x0); x <= x1; x++) {
      if (inside(x, y)) {
        var o = owner(x, y), c;
        if (!inside(x - 1, y - 1) || !inside(x, y - 1)) c = pal[4];
        else if (!inside(x + 1, y + 2) || !inside(x + 2, y + 1)) c = pal[2];
        else if (o !== owner(x, y + 1) && inside(x, y + 1) && owner(x, y + 1) !== -1 && puffs[owner(x, y + 1)][1] > puffs[o][1]) c = pal[2];
        else c = pal[3];
        if (!inside(x + 1, y + 1) && !inside(x + 1, y)) c = pal[1];
        put(x, y, c);
      } else if (inside(x + 1, y) || inside(x - 1, y) || inside(x, y + 1) || inside(x, y - 1)) {
        put(x, y, softLeft && (inside(x + 1, y) || inside(x, y + 1)) && !inside(x - 1, y) ? pal[1] : pal[0]);
      }
    }
    return inside;
  }
  /** A disc lit from the upper left in three tones with an outline: [ink, shade, body, lit]. */
  function ball(cx, cy, r, pal) {
    for (var y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) for (var x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
      var dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy);
      if (d <= r) put(x, y, d > r - 1.2 && dx + dy > 0 ? pal[1] : (dx + dy) / r < -0.75 ? pal[3] : dx + dy > r * 0.55 ? pal[1] : pal[2]);
      else if (d <= r + 1) put(x, y, pal[0]);
    }
  }

  // =================================================================================================================
  // Casual: snow day
  // =================================================================================================================
  function casual() {
    var C = {
      sky: ['#79A9E0', '#8FBAE9', '#A8CBF0', '#C3DCF4', '#DCEAF6', '#F1EFEE'].map(hex),
      sun: hex('#FFF8DE'), halo: hex('#FBEFC8'),
      cloud: ['#B4C7E2', '#CCDAEE', '#E7EFF9', '#FFFFFF'].map(hex),
      mtnFar: [hex('#A9C2E1'), hex('#97B1D8'), hex('#EAF1FA'), hex('#CDDCEF')],
      mtn: [hex('#8DA8D1'), hex('#7894C2'), hex('#F1F6FC'), hex('#C6D6EC')],
      forest: hex('#6B8DBB'), forestSnow: hex('#D2E1F2'),
      hill: hex('#EAF0F8'), hillShade: hex('#CDDAEC'),
      snow: ['#A9BDD9', '#C5D4E9', '#E0E9F4', '#F8FAFD'].map(hex),
      pine: ['#22455A', '#2F5E6E', '#467879', '#6A9478'].map(hex), trunk: hex('#5A4036'),
      ink: hex('#2F2C45'),
    };
    var SKY_END = 92;
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) put(x, y, band(C.sky, Math.pow(y / SKY_END, 1.05), x, y, 0.14));
    // The sun, low on the right, with a soft halo.
    for (var y = 4; y < 44; y++) for (var x = 104; x < 150; x++) {
      var d = Math.hypot(x + 0.5 - 128, y + 0.5 - 22);
      if (d <= 6.5) put(x, y, C.sun); else if (d <= 9) put(x, y, C.halo); else if (d <= 11.5 && bayer(x, y) < 0.5) put(x, y, C.halo);
    }
    // Clouds: heaps lit from the sun's side, flat underneath, no outline.
    function cloud(cx, cy, w, h, seed) {
      var r = seeded(seed), circ = [], n = Math.max(3, Math.round(w / 8));
      for (var i = 0; i < n; i++) {
        var t = i / (n - 1), mid = 1 - Math.abs(t - 0.45) * 1.9;
        circ.push([cx - w / 2 + t * w, cy - Math.max(0, mid) * h * 0.6 - r() * 2, 3 + Math.max(0, mid) * h * 0.55 + r() * 2]);
      }
      var base = cy + 1, inside = blobInside(circ);
      for (var y = Math.floor(cy - h * 1.4); y <= base; y++) for (var x = Math.floor(cx - w / 2 - 8); x <= cx + w / 2 + 8; x++) {
        if (!inside(x, y)) continue;
        var c = y >= base ? 0 : y >= base - 2 || !inside(x - 1, y + 3) ? 1 : !inside(x + 1, y - 1) || !inside(x + 2, y - 2) ? 3 : 2;
        put(x, y, C.cloud[c]);
      }
    }
    cloud(38, 28, 58, 14, 3); cloud(118, 50, 38, 9, 7); cloud(150, 12, 22, 6, 11);
    // Two ranges of mountains, the far one paler. Each face toward the sun is lit, each away is shaded; snow on top.
    function range(base, waves, pal, capMin) {
      var top = ridge(base, waves), sm = [];
      for (var x = 0; x < W; x++) { var a = top[Math.max(0, x - 3)], b = top[Math.min(W - 1, x + 3)]; sm.push(b - a); }
      for (var x = 0; x < W; x++) for (var y = top[x]; y < SKY_END + 30; y++) {
        var away = sm[x] > 0, depth = y - top[x], cap = capMin + Math.round(2 + 2 * Math.sin(x * 0.7) + (base - top[x]) * 0.35);
        put(x, y, depth < cap ? (away ? pal[3] : pal[2]) : away ? pal[1] : pal[0]);
      }
      return top;
    }
    range(58, [[8, 0.05, 0.6], [4, 0.13, 2.1]], C.mtnFar, 1);
    range(70, [[7, 0.065, 2.6], [3, 0.17, 0.4]], C.mtn, 0);
    // The forest at the foot of the mountains: a ridge of small pines, one colour, snow on the tips.
    var far = ridge(82, [[2, 0.08, 1.2], [1, 0.21, 0.3]]);
    for (var x = 0; x < W; x++) for (var y = far[x]; y < H; y++) put(x, y, C.forest);
    for (var x = 1; x < W; x += 3) {
      var h = 4 + ((x * 13) % 5), base = far[x] + 1;
      for (var j = 0; j < h; j++) { var half = Math.floor(j / 2.2); for (var i = -half; i <= half; i++) put(x + i, base - h + j, j === 0 && x % 2 ? C.forestSnow : C.forest); }
    }
    // The barn's hill, with the barn and its silo on the crest and smoke from the farmhouse.
    var hill = ridge(90, [[3, 0.04, 0.4], [1, 0.15, 1.1]]);
    for (var x = 0; x < W; x++) for (var y = hill[x]; y < H; y++) put(x, y, y - hill[x] < 2 && x + 1 < W && hill[x + 1] > hill[x] ? C.hillShade : C.hill);
    barn(66, hill[78]);
    [[56, 8], [61, 11], [67, 7], [132, 9], [138, 12], [145, 8]].forEach(function (p) { pine(p[0], hill[p[0]] + 1, p[1], true); });
    // The near ground: flat on the left, a slope rising to the right for the sled.
    var ground = [];
    for (var x = 0; x < W; x++) ground.push(Math.round(x < 84 ? 116 : 116 - Math.pow((x - 84) / 76, 1.3) * 22 + Math.sin(x * 0.11)));
    for (var x = 0; x < W; x++) for (var y = ground[x]; y < H; y++) {
      var d = y - ground[x];
      put(x, y, d === 0 ? C.snow[3] : band([C.snow[3], C.snow[2], C.snow[2], C.snow[1]], Math.min(1, d / 95), x, y, 0.08));
    }
    // Long low drifts in the foreground.
    [[26, 142, 34, 4], [112, 152, 46, 5], [60, 170, 40, 4], [150, 132, 22, 3]].forEach(function (m) {
      for (var x = Math.round(m[0] - m[2]); x <= m[0] + m[2]; x++) {
        var t = (x - m[0]) / m[2], top = Math.round(m[1] - (1 - t * t) * m[3]);
        for (var y = top; y <= m[1] + 1; y++) put(x, y, y <= top + 1 ? C.snow[3] : y > m[1] - 1 ? C.snow[1] : C.snow[2]);
      }
    });
    // The fence behind the snowman, and the big framing pines at the edges, partly out of the picture.
    fence(0, 96, 96, ground);
    pine(5, 120, 56, false); pine(156, 98, 66, false); pine(145, 104, 30, false);
    // The sled's tracks: two thin grooves down the slope behind it.
    for (var x = 132; x < 152; x++) { put(x, ground[x] + 2, C.snow[1]); put(x, ground[x] + 4, C.snow[1]); }
    snowman(34, 117);
    sheep(60, 117);
    sled(98, ground[110]);
    robin(30, 78, false); robin(11, 92, true); robin(83, 92, false);

    function pine(cx, base, h, distant) {
      // A pine in tiers with ragged hems, lit on the left, snow on each tier's shelf. A distant one is paler and flatter.
      var col = distant ? [mix(C.forest, C.pine[0], 0.25), mix(C.forest, C.pine[1], 0.3), mix(C.forest, C.pine[2], 0.3)] : [C.pine[0], C.pine[1], C.pine[2]];
      var snowLit = C.snow[3], snowShade = distant ? C.forestSnow : C.snow[2];
      var tiers = Math.max(2, Math.round(h / 9)), trunk = Math.max(1, Math.round(h / 11));
      rect(cx - (h > 30 ? 1 : 0), base - trunk, h > 30 ? 3 : 1, trunk, distant ? mix(C.forest, C.trunk, 0.4) : C.trunk);
      var top = base - h, th = (h - trunk) / tiers;
      for (var t = 0; t < tiers; t++) {
        var y0 = Math.round(top + t * th * 0.8), y1 = Math.round(top + (t + 1) * th + 1), wMax = 1.5 + (t + 1) * h / (tiers * 2.7);
        for (var y = y0; y <= Math.min(y1, base - trunk); y++) {
          var f = (y - y0) / Math.max(1, y1 - y0), half = Math.round(wMax * (0.2 + 0.8 * f));
          for (var i = -half; i <= half; i++) put(cx + i, y, col[i < -half * 0.3 ? 2 : i > half * 0.35 ? 0 : 1]);
          if (y - y0 <= (t === 0 ? 2 : 1)) for (var i = -half; i <= Math.floor(half * 0.4); i++) put(cx + i, y, i < 0 ? snowLit : snowShade);
        }
        for (var i = -Math.round(wMax) + (t % 2); i <= Math.round(wMax); i += 2) put(cx + i, Math.min(y1 + 1, base - trunk), col[0]);
      }
      put(cx, top - 1, snowLit);
    }
    function barn(x0, gy) {
      var B = { o: C.ink, r: hex('#C8574A'), R: hex('#9E413D'), f: hex('#6E3D40'), s: C.snow[3], S: C.snow[2], t: hex('#F3EBE4'), d: hex('#5B3437'),
        g: hex('#B9B1AC'), G: hex('#918A8A'), h: hex('#E3D2B9'), H: hex('#BCA88E'), w: hex('#FFE29A'), c: hex('#7E5B4C') };
      sprite([
        '...gg.......................',
        '..gGGg......................',
        '..gGGg...ssssssss...........',
        '..gGGg..sSsssssssS....c.....',
        '..gGGg.sSssssssssSs..sc.....',
        '..gGGgoffffffffffffo.ssss...',
        '..gGGg.orrrrrrrrrrRossSsss..',
        '..gGGg.orrtttttrrrRohhhhhHo.',
        '..gGGg.orrtdtdtrrrRohwhhwHo.',
        '..gGGg.orrttdttrrrRohhhhhHo.',
        '..gGGg.orrtdtdtrrrRohhhwhHo.',
        '..oooo.ooooooooooooooooooooo',
      ], B, x0, gy - 11);
      for (var i = 0; i < 6; i++) {
        var sx = x0 + 23 + i * 1.5 + Math.sin(i * 1.3), sy = gy - 13 - i * 3, rad = 0.9 + i * 0.4;
        for (var yy = Math.floor(sy - rad); yy <= sy + rad; yy++) for (var xx = Math.floor(sx - rad); xx <= sx + rad; xx++)
          if (Math.hypot(xx + 0.5 - sx, yy + 0.5 - sy) <= rad) put(xx, yy, mix(hex('#EEF2F8'), C.sky[3], i / 7));
      }
    }
    function fence(x0, y0, len, gr) {
      var wood = hex('#9A7157'), dark = hex('#6E4E3E'), lit = hex('#BC926F');
      for (var x = x0; x < x0 + len; x++) {
        put(x, y0 + 2, C.snow[3]); put(x, y0 + 3, x % 3 ? wood : lit); put(x, y0 + 4, dark);
        put(x, y0 + 8, x % 3 ? wood : lit); put(x, y0 + 9, dark);
      }
      for (var x = x0 + 2; x < x0 + len; x += 9) {
        for (var y = y0; y < gr[x] + 1; y++) { put(x, y, lit); put(x + 1, y, wood); put(x + 2, y, dark); }
        put(x, y0 - 1, C.snow[3]); put(x + 1, y0 - 1, C.snow[3]); put(x + 2, y0 - 1, C.snow[2]); put(x + 1, y0 - 2, C.snow[3]);
      }
    }
    function snowman(cx, gy) {
      var pal = [C.ink, C.snow[1], C.snow[2], C.snow[3]];
      ball(cx, gy - 9, 9, pal); ball(cx, gy - 22, 6.5, pal); ball(cx, gy - 32, 5, pal);
      var S = { o: C.ink, c: hex('#2B2933'), n: hex('#F28A2E'), N: hex('#C4621B'), h: hex('#4F9E6C'), H: hex('#367656'), g: hex('#7CC08F'), w: hex('#FFFFFF'),
        r: hex('#E0524A'), R: hex('#A8383A'), t: hex('#6B4A3A') };
      // Cap with a pompom, face, carrot, scarf, coal buttons, twig arms.
      sprite([
        '....ooo....',
        '...owwwo...',
        '....owo....',
        '...ohhHo...',
        '..ohhhhHo..',
        '.ohhhhhhHo.',
        '.ogwgwgwgo.',
      ], S, cx - 5, gy - 44);
      put(cx - 2, gy - 33, S.c); put(cx + 2, gy - 33, S.c);
      sprite(['nnnNN', '.nnN.', '..N..'], S, cx, gy - 32);
      [[-3, -29], [-1, -28], [1, -28], [3, -29]].forEach(function (p) { put(cx + p[0], gy + p[1], S.c); });
      for (var i = -5; i <= 5; i++) { put(cx + i, gy - 27, S.r); put(cx + i, gy - 26, i > 2 ? S.R : S.r); }
      rect(cx + 2, gy - 25, 2, 4, S.r); put(cx + 3, gy - 25, S.R); put(cx + 2, gy - 21, S.R); put(cx + 3, gy - 21, S.R);
      [-23, -19, -12, -7].forEach(function (dy) { put(cx - 1, gy + dy, S.c); put(cx, gy + dy, S.c); });
      [[-7, -23], [-8, -24], [-9, -25], [-10, -26], [-11, -26], [-10, -28], [-12, -27]].forEach(function (p) { put(cx + p[0], gy + p[1], S.t); });
      [[7, -23], [8, -24], [9, -24], [10, -25], [11, -26], [12, -27], [11, -28], [13, -26]].forEach(function (p) { put(cx + p[0], gy + p[1], S.t); });
    }
    function sheep(x0, gy) {
      // A sheep in a red scarf, side on, looking up at the snowman.
      var wool = [C.ink, hex('#B9BFD6'), hex('#D6DBE9'), hex('#F4F6FB'), hex('#FFFFFF')];
      var legs = hex('#3E3238');
      [[6, -2], [10, -1], [17, -2], [21, -1]].forEach(function (p) { rect(x0 + p[0], gy - 6, 2, 6, legs); put(x0 + p[0], gy - 1, C.ink); put(x0 + p[0] + 1, gy - 1, C.ink); });
      fluff([[x0 + 8, gy - 12, 5.5], [x0 + 14, gy - 13, 6.5], [x0 + 20, gy - 12, 5.5], [x0 + 23, gy - 9, 4], [x0 + 11, gy - 8, 4.5], [x0 + 17, gy - 8, 4.5], [x0 + 12, gy - 18, 4], [x0 + 18, gy - 18, 3.8], [x0 + 6, gy - 7, 3]], wool, true);
      var P = { o: C.ink, f: hex('#463A40'), F: hex('#6C5A5D'), e: hex('#FFFFFF'), k: hex('#F2A39A'), w: hex('#FFFFFF'), r: hex('#E0524A'), R: hex('#A8383A') };
      // The head, tilted up toward the snowman, with a tuft of wool on top and the scarf round the neck.
      sprite([
        '....wwwww...',
        '...owwwwwo..',
        '..offffwwwo.',
        '.oFfffffwoFFo',
        'oFfffffffoFo.',
        'oFeefffffo...',
        'ofeoffffffo..',
        'offffffkffo..',
        '.offffffffo..',
        '..ooooooo....',
      ], P, x0 - 5, gy - 23);
      sprite(['..rrrrr.', '.rrrRRrR', 'rrR.RrR.', 'rR...R..'], P, x0 + 1, gy - 15);
    }
    function sled(x0, y0) {
      // A lamb on a red sled, coming down the slope, its yellow scarf flying, snow thrown up behind the runners.
      var wool = [C.ink, hex('#B9BFD6'), hex('#D6DBE9'), hex('#F4F6FB'), hex('#FFFFFF')];
      fluff([[x0 + 11, y0 - 7, 5], [x0 + 16, y0 - 8, 5], [x0 + 20, y0 - 5, 3.5], [x0 + 13, y0 - 4, 3.5]], wool, true);
      var P = { o: C.ink, f: hex('#463A40'), F: hex('#6C5A5D'), e: hex('#FFFFFF'), k: hex('#F2A39A'), w: hex('#FFFFFF'), y: hex('#F2C14E'), Y: hex('#C9932B'),
        r: hex('#D8443C'), R: hex('#94302F'), u: hex('#5A4036'), U: hex('#3E2C26') };
      sprite([
        '..www...',
        '.owwwwo.',
        'offffwo.',
        'oFefffo.',
        'offkffo.',
        '.offffo.',
        '..oooo..',
      ], P, x0 + 2, y0 - 13);
      sprite(['......yyY', '..yyyyyY.', 'yyyYY....', '.yY.yY...'], P, x0 + 16, y0 - 15);
      sprite([
        'oooooooooooooooooooooo..',
        'orrrrrrrrrrrrrrrrrrRRo..',
        '.oRRRRRRRRRRRRRRRRRRo...',
        '..UU.....UU.....UU......',
        'uuuuuuuuuuuuuuuuuuuuuuu.',
        '.......................u',
      ], P, x0, y0 - 4);
      [[23, 0], [25, -1], [26, 1], [28, -2], [29, 0], [31, -1], [27, -3], [32, 1], [34, -2], [30, -4]].forEach(function (p, i) { put(x0 + p[0], y0 + p[1], i % 3 ? C.snow[3] : C.snow[2]); });
    }
    function robin(x0, y0, flip) {
      var P = { o: C.ink, b: hex('#6B4A3A'), r: hex('#E8673C'), y: hex('#F2C14E') };
      sprite(['.ob..', 'obbby', 'orrbo', '.ooo.'], P, x0, y0, flip);
    }
  }

  /** A tile of falling snow (clear round the flakes), for the chooser to scroll down over the meadow. */
  function snowTile() {
    var r = seeded(91), white = hex('#FFFFFF'), soft = hex('#E6EEF8');
    for (var i = 0; i < 26; i++) {
      var x = Math.floor(r() * W), y = Math.floor(r() * H), big = r() < 0.3;
      put(x, y, white);
      if (big) { put(x + 1, y, soft); put(x, y + 1, soft); }
    }
  }

  // =================================================================================================================
  // Ranked: the rink
  // =================================================================================================================
  /**
   * A night match on the ice. `flash` draws only the second frame of what twinkles (the crowd's camera flashes and the
   * fireworks' sparkle) on a clear picture, for the chooser to blink over the first.
   */
  function ranked(flash) {
    var R = {
      sky: ['#0B0B22', '#120F31', '#1B1442', '#2A1A52', '#3A1F5C'].map(hex),
      star: hex('#C9C6FF'), ink: hex('#07060F'),
      seat: [hex('#2A2553'), hex('#322C61'), hex('#3B3470'), hex('#453D7E')], crowd: [hex('#0E0C22'), hex('#121029'), hex('#161331'), hex('#1A1739')], rim: hex('#6D66C2'), rimWarm: hex('#C08A8E'),
      red: hex('#E2453B'), redD: hex('#9C2D2E'), blue: hex('#3E86E8'), blueD: hex('#2652A0'),
      gold: hex('#F6C84C'), goldD: hex('#B9862A'), white: hex('#FFFFFF'), cream: hex('#FFF1C9'),
      board: hex('#E7ECF4'), boardD: hex('#AEB8CC'), rail: hex('#2B2C48'),
      ice: [hex('#0F2141'), hex('#16305A'), hex('#1F4173'), hex('#2F5B92'), hex('#4D7FB8'), hex('#8DB7E3')],
      beam: hex('#FFF2C8'),
    };
    var r = seeded(flash ? 77 : 31);
    if (flash) { twinkles(seeded(77)); return; }

    // The night sky, stars, and fireworks.
    for (var y = 0; y < 48; y++) for (var x = 0; x < W; x++) put(x, y, band(R.sky, y / 48, x, y, 0.12));
    for (var i = 0; i < 40; i++) { var sx = Math.floor(r() * W), sy = Math.floor(r() * 36); put(sx, sy, mix(R.star, R.sky[1], r() * 0.6)); }
    firework(30, 15, 12, [R.gold, hex('#FFE7A1'), hex('#FF9B4A')], 14);
    firework(132, 11, 10, [hex('#FF6FC8'), hex('#FFC4EC'), hex('#8A6CFF')], 12);
    firework(104, 30, 6, [hex('#6BE3FF'), hex('#D6F8FF'), hex('#3E86E8')], 9);
    // The scoreboard hung over the ice: red half, blue half, the cup in the middle.
    scoreboard(80, 6);
    // The stands: rows of seats rising away, a crowd of farm animals, red flags on the left half, blue on the right.
    var standTop = 34, rows = 4, rowH = 8;
    for (var row = 0; row < rows; row++) {
      var y0 = standTop + row * rowH, shade = R.seat[Math.min(3, row)];
      for (var y = y0; y < y0 + rowH; y++) for (var x = 0; x < W; x++) put(x, y, y >= y0 + rowH - 2 ? R.ink : shade);
      for (var x = 2 + (row % 2) * 3; x < W - 2; x += 6 + (r() < 0.35 ? 1 : 0)) fan(x, y0 + rowH - 2, row, r);
    }
    // Floodlights on two towers, their beams crossing the stands and pooling on the ice.
    tower(6, 2); tower(W - 12, 2);
    beam(10, 8, 40, 96, 128, 0.10); beam(W - 9, 8, 64, 120, 128, 0.10); beam(10, 8, 66, 84, 116, 0.06); beam(W - 9, 8, 76, 98, 116, 0.06);
    // Bunting along the front of the stands.
    for (var x = 0; x < W; x += 6) {
      var bc = [R.red, R.gold, R.blue][(x / 6) % 3];
      put(x, by - 2, R.rail); put(x + 1, by - 2, R.rail); put(x + 2, by - 2, R.rail); put(x + 3, by - 2, R.rail); put(x + 4, by - 2, R.rail); put(x + 5, by - 2, R.rail);
      put(x + 1, by - 1, bc); put(x + 2, by - 1, bc); put(x + 3, by - 1, bc); put(x + 4, by - 1, bc); put(x + 2, by, bc); put(x + 3, by, bc);
    }
    // The boards round the rink: white, a dark rail, the red corner's panels on the left and the blue corner's on the right.
    var by = standTop + rows * rowH;
    for (var x = 0; x < W; x++) {
      put(x, by, R.rail); put(x, by + 1, R.rail);
      for (var y = by + 2; y < by + 9; y++) put(x, y, y === by + 8 ? R.boardD : R.board);
    }
    [[6, 20, R.red], [32, 18, R.gold], [58, 14, R.red], [88, 14, R.blue], [110, 18, R.gold], [134, 20, R.blue]].forEach(function (p) {
      for (var x = p[0]; x < p[0] + p[1]; x++) for (var y = by + 3; y < by + 7; y++) put(x, y, (x === p[0] || y === by + 3) ? mix(p[2], R.white, 0.25) : p[2]);
    });
    // The ice: dark at the edges, bright in the spotlight's pool, the rink's lines, reflections of the lights.
    var iy = by + 9, cx = 80, cy = 112;
    for (var y = iy; y < H; y++) for (var x = 0; x < W; x++) {
      var d = Math.hypot((x - cx) / 62, (y - cy) / 26);
      put(x, y, band(R.ice, Math.max(0, Math.min(1, 0.72 - d * 0.6 + (y - iy) * 0.002)), x, y, 0.1));
    }
    for (var x = 0; x < W; x++) { put(x, iy + 1, mix(R.ice[2], R.white, 0.25)); }
    // A red line across the middle, blue lines either side (in the ice's perspective, flatter toward the back).
    for (var y = iy + 2; y < H; y++) {
      var spread = (y - iy) * 0.22;
      put(Math.round(cx), y, mix(R.red, R.ice[2], 0.35)); put(Math.round(cx) + 1, y, mix(R.red, R.ice[2], 0.5));
      put(Math.round(cx - 34 - spread), y, mix(R.blue, R.ice[2], 0.35)); put(Math.round(cx + 34 + spread), y, mix(R.blue, R.ice[2], 0.35));
    }
    // The face-off circle under the rams.
    for (var a = 0; a < Math.PI * 2; a += 0.02) put(Math.round(cx + Math.cos(a) * 34), Math.round(cy + 6 + Math.sin(a) * 9), mix(R.red, R.ice[3], 0.4));
    // Reflections: long soft streaks under the floodlights and the fireworks.
    [[10, R.beam, 0.22], [W - 9, R.beam, 0.22], [30, R.gold, 0.14], [132, hex('#FF6FC8'), 0.14], [104, hex('#6BE3FF'), 0.1]].forEach(function (p) {
      for (var y = iy + 3; y < H; y += 1) { if ((y * 7) % 5 === 0) continue; put(p[0], y, p[1], p[2] * (1 - (y - iy) / (H - iy))); put(p[0] + 1, y, p[1], p[2] * 0.5 * (1 - (y - iy) / (H - iy))); }
    });
    // Skate scratches.
    [[18, 150, 30, 146], [120, 160, 150, 154], [40, 168, 66, 166], [100, 140, 118, 137]].forEach(function (l) {
      var n = Math.abs(l[2] - l[0]); for (var i = 0; i <= n; i++) put(Math.round(l[0] + (l[2] - l[0]) * i / n), Math.round(l[1] + (l[3] - l[1]) * i / n), R.ice[3]);
    });
    // The two rams, head on: the red corner from the left, the blue corner from the right.
    var gy = 118;
    speedLines(34, gy - 16, -1, R.red); speedLines(126, gy - 16, 1, R.blue);
    ram(57, gy, 1, [R.ink, hex('#A79B8C'), hex('#D8CCB8'), hex('#F2E9D9'), hex('#FFFFFF')], hex('#5E4648'), hex('#866467'), [hex('#7A5A2A'), hex('#B48D45'), hex('#E2C27C'), hex('#FFE6A8')], R.red, R.redD);
    ram(103, gy, -1, [R.ink, hex('#2E2A40'), hex('#45405A'), hex('#605A78'), hex('#847DA0')], hex('#3A3148'), hex('#5A4D6E'), [hex('#7E705A'), hex('#B6A88C'), hex('#E6DCC6'), hex('#FFFFFF')], R.blue, R.blueD);
    impact(80, gy - 16);
    twinkles(seeded(41));

    function firework(fx, fy, rad, cols, spokes) {
      for (var k = 0; k < spokes; k++) {
        var a = (k / spokes) * Math.PI * 2 + 0.3, len = rad * (0.75 + ((k * 37) % 10) / 40);
        for (var t = 2; t <= len; t++) {
          var x = Math.round(fx + Math.cos(a) * t), y = Math.round(fy + Math.sin(a) * t * 0.95);
          put(x, y, t > len - 1.5 ? cols[1] : t > len * 0.55 ? cols[0] : cols[2], t > len - 1.5 ? 1 : 0.85);
        }
        // a droop of sparks at each spoke's end
        put(Math.round(fx + Math.cos(a) * (len + 2)), Math.round(fy + Math.sin(a) * (len + 2) + 1), cols[0], 0.6);
      }
      put(fx, fy, cols[1]);
    }
    function scoreboard(mx, y0) {
      var wd = 34, ht = 14, x0 = mx - wd / 2;
      for (var y = 0; y < y0; y++) { put(x0 + 3, y, R.rail); put(x0 + wd - 4, y, R.rail); }
      for (var y = y0; y < y0 + ht; y++) for (var x = x0; x < x0 + wd; x++) {
        var edge = x === x0 || x === x0 + wd - 1 || y === y0 || y === y0 + ht - 1;
        put(x, y, edge ? R.rail : y === y0 + 1 ? hex('#3A3B5E') : x < mx ? mix(R.red, R.ink, 0.45) : mix(R.blue, R.ink, 0.45));
      }
      // Each side's lit dots, and the cup in the middle.
      for (var i = 0; i < 4; i++) { put(x0 + 4 + i * 2, y0 + 10, R.red); put(x0 + wd - 5 - i * 2, y0 + 10, R.blue); }
      sprite([
        'o.ooooo.o',
        'oygggggYo',
        '.ogggggo.',
        '..ogggo..',
        '...oYo...',
        '..ogggo..',
      ], { o: R.ink, g: R.gold, Y: R.goldD, y: hex('#FFE7A1') }, mx - 4, y0 + 3);
    }
    function fan(x, y, row, rnd) {
      // One of the crowd, seen from behind the light: shoulders, a round head with its animal's ears, horns or comb,
      // lit along the top by the floodlights (warm on the red side, cool on the blue).
      var kind = Math.floor(rnd() * 4), c = R.crowd[Math.min(3, row)], cl = mix(c, R.rim, 0.3), rim = rnd() < 0.5 ? (x < W / 2 ? R.rimWarm : R.rim) : cl;
      for (var i = -2; i <= 3; i++) { put(x + i, y, c); put(x + i, y - 1, c); }
      for (var i = -1; i <= 2; i++) { put(x + i, y - 2, c); put(x + i, y - 3, c); }
      put(x, y - 4, rim); put(x + 1, y - 4, rim); put(x - 1, y - 3, cl); put(x - 2, y - 1, cl);
      if (kind === 0) { put(x - 2, y - 3, rim); put(x + 3, y - 3, c); } // a sheep's ears
      if (kind === 1) { put(x - 1, y - 5, R.cream); put(x + 2, y - 5, R.cream); put(x - 2, y - 4, R.cream); put(x + 3, y - 4, R.cream); } // a cow's horns
      if (kind === 2) { put(x, y - 5, R.red); put(x + 1, y - 5, R.red); put(x + 1, y - 6, R.red); } // a hen's comb
      if (kind === 3) { put(x - 1, y - 5, c); put(x + 2, y - 5, c); put(x - 1, y - 6, rim); put(x + 2, y - 6, rim); } // a goat's horns
      // Now and then an arm up with a flag in its side's colour.
      if (rnd() < 0.22) {
        var col = x < W / 2 ? R.red : R.blue, colD = x < W / 2 ? R.redD : R.blueD;
        put(x + 3, y - 2, c); put(x + 4, y - 3, c); put(x + 4, y - 4, R.rail); put(x + 4, y - 5, R.rail); put(x + 4, y - 6, R.rail);
        put(x + 5, y - 6, col); put(x + 6, y - 6, col); put(x + 7, y - 6, col); put(x + 5, y - 5, colD); put(x + 6, y - 5, col);
      }
    }
    function tower(x0, y0) {
      for (var y = y0 + 9; y < 48; y++) { put(x0 + 2, y, R.rail); put(x0 + 3, y, R.rail); }
      for (var y = y0; y < y0 + 9; y++) for (var x = x0; x < x0 + 6; x++) put(x, y, R.rail);
      for (var j = 0; j < 3; j++) for (var i = 0; i < 2; i++) { put(x0 + 1 + i * 3, y0 + 1 + j * 3, R.white); put(x0 + 2 + i * 3, y0 + 1 + j * 3, R.cream); put(x0 + 1 + i * 3, y0 + 2 + j * 3, R.cream); put(x0 + 2 + i * 3, y0 + 2 + j * 3, R.beam); }
      for (var a = 0; a < Math.PI * 2; a += 0.15) put(Math.round(x0 + 3 + Math.cos(a) * 6), Math.round(y0 + 4 + Math.sin(a) * 6), R.beam, 0.25);
    }
    function beam(sx, sy, xa, xb, yEnd, alpha) {
      for (var y = sy; y < yEnd; y++) {
        var t = (y - sy) / (yEnd - sy), lo = sx + (xa - sx) * t, hi = sx + (xb - sx) * t;
        for (var x = Math.floor(Math.min(lo, hi)); x <= Math.max(lo, hi); x++) put(x, y, R.beam, alpha * (0.6 + 0.4 * t));
      }
    }
    function speedLines(x0, y0, dir, col) {
      [[0, 0, 16], [3, 5, 22], [1, 10, 12], [5, -6, 10], [2, 14, 18]].forEach(function (l) {
        for (var i = 0; i < l[2]; i++) put(x0 + dir * (l[0] + i), y0 + l[1], i < 3 ? col : R.white, i < 3 ? 0.9 : 0.45 - i * 0.02);
      });
    }
    function ram(x0, gy, dir, wool, face, faceLit, horn, band, bandD) {
      // x0 is the middle of the fleece; the ram faces +x when dir is 1.
      var X = function (dx) { return x0 + dir * dx; };
      // Legs braced back, hooves dug into the ice, chips of ice kicked up behind.
      [[-15, 0], [-10, 0], [0, 0], [5, 0]].forEach(function (l) {
        for (var t = 0; t < 10; t++) { put(X(l[0] - Math.round(t * 0.4)), gy - 10 + t, face); put(X(l[0] + 1 - Math.round(t * 0.4)), gy - 10 + t, faceLit); }
        put(X(l[0] - 4), gy, R.ink); put(X(l[0] - 3), gy, R.ink); put(X(l[0] - 2), gy, R.ink);
        put(X(l[0] - 6), gy - 1, R.ice[5]); put(X(l[0] - 8), gy - 3, R.ice[5]); put(X(l[0] - 7), gy - 2, R.white);
      });
      // The fleece, heaped and leaning into the push.
      var P = [[-13, -16, 7], [-6, -18, 8.5], [2, -17, 7.5], [6, -13, 6], [-15, -10, 5], [-7, -10, 6.5], [1, -10, 6], [-10, -24, 5.5], [-2, -25, 6], [4, -22, 4.5], [-18, -15, 4]];
      fluff(P.map(function (p) { return [X(p[0]), gy + p[1], p[2]]; }), wool, true);
      // The head, lowered and butting forward: a hard brow over a narrowed eye, the sweatband in the corner's colour.
      var H = [
        '......ooooo....',
        '....oobbbbboo..',
        '...oBbbbbbbbbo.',
        '..offFFFffffffo',
        '.offFFfkkkffffo',
        '.offfffwwkffffo',
        '.offffffffffffo',
        '..offffffffffo.',
        '...offffffnnfo.',
        '....offffnnno..',
        '.....ooooooo...',
      ];
      sprite(H, { o: R.ink, f: face, F: faceLit, b: band, B: bandD, w: hex('#FFFFFF'), k: R.ink, n: hex('#2A1F24') }, dir > 0 ? X(8) : X(22), gy - 25, dir < 0);
      // The sweatband's tails, flying out behind.
      [[9, -24], [8, -25], [7, -25], [6, -26], [8, -24]].forEach(function (p, i) { put(X(p[0]), gy + p[1], i % 2 ? bandD : band); });
      // The horn: a heavy ridged curl at the back of the head, its tip forward under the eye.
      var hx = X(9), hy = gy - 20;
      for (var y = -7; y <= 7; y++) for (var x = -7; x <= 7; x++) {
        var d = Math.hypot(x, y);
        if (d > 5.8 || d < 2.1) continue;
        var a = Math.atan2(y, x * dir), shade = d > 5 ? 0 : (a < -0.4 && a > -2.6) ? 3 : a > 0.9 ? 1 : 2;
        if (d > 2.8 && d < 4.8 && (Math.round((a + 3.2) * 3) % 2) === 0) shade = Math.max(0, shade - 1);
        put(hx + x, hy + y, horn[shade]);
      }
      put(hx, hy, horn[0]); put(hx + dir, hy, horn[1]);
      [[4, 5], [5, 6], [6, 6], [7, 5]].forEach(function (p) { put(hx + dir * p[0], hy + p[1], horn[2]); put(hx + dir * p[0], hy + p[1] + 1, horn[0]); });
      // A short tail.
      put(X(-22), gy - 19, wool[3]); put(X(-23), gy - 18, wool[2]); put(X(-23), gy - 19, wool[0]); put(X(-22), gy - 20, wool[0]);
    }
    function impact(ix, iy) {
      // Where the horns meet: a white star, a ring of sparks, chips of ice thrown up.
      var star = [[0, -7], [0, -6], [0, -5], [0, 5], [0, 6], [0, 7], [-5, 0], [-6, 0], [5, 0], [6, 0], [-4, -4], [4, -4], [-4, 4], [4, 4], [-3, -3], [3, 3], [3, -3], [-3, 3]];
      star.forEach(function (p) { put(ix + p[0], iy + p[1], Math.abs(p[0]) + Math.abs(p[1]) > 6 ? R.gold : R.cream); });
      for (var y = -2; y <= 2; y++) for (var x = -2; x <= 2; x++) if (Math.abs(x) + Math.abs(y) <= 3) put(ix + x, iy + y, Math.abs(x) + Math.abs(y) <= 1 ? R.white : R.cream);
      for (var a = 0; a < Math.PI * 2; a += Math.PI / 7) put(Math.round(ix + Math.cos(a) * 10), Math.round(iy + Math.sin(a) * 8), R.gold);
      [[-12, -12], [11, -13], [-15, -4], [15, -6], [-9, -16], [8, -17], [-18, -9], [17, -11]].forEach(function (p, i) { put(ix + p[0], iy + p[1], i % 2 ? R.ice[5] : R.white); });
    }
    function twinkles(rnd) {
      // Camera flashes in the crowd, and sparkle trailing from the fireworks: each a pixel with a short cross of light.
      for (var i = 0; i < 9; i++) {
        var x = 3 + Math.floor(rnd() * (W - 6)), y = 37 + Math.floor(rnd() * 32);
        put(x, y, R.white); put(x - 1, y, R.cream, 0.8); put(x + 1, y, R.cream, 0.8); put(x, y - 1, R.cream, 0.8); put(x, y + 1, R.cream, 0.8);
      }
      for (var i = 0; i < 10; i++) {
        var f = [[30, 15, 14], [132, 11, 12], [104, 30, 8]][i % 3], a = rnd() * Math.PI * 2, t = f[2] * (0.6 + rnd() * 0.6);
        put(Math.round(f[0] + Math.cos(a) * t), Math.round(f[1] + Math.sin(a) * t + rnd() * 4), i % 2 ? R.white : R.gold);
      }
    }
  }
}

/**
 * The dream's gate (docs/REDESIGN_PLAN_V4_1.md Part 10). Opens Counting Sheep in practice with a fixed seed, waits for
 * the ready state, takes a screenshot and measures it. Prints every number with its pass range and exits non-zero on
 * any failure. Run it against a dev server:
 *
 *   npx vite-node tools/dreamGate.ts -- --base http://localhost:5173/steal-a-poop/ [--only G1,G3,G5] [--phone] [--out dir]
 *
 * The scene is sampled from a second screenshot with the HUD hidden. L is the Rec. 709 weighting of the sRGB values as stored, without linearising: the plan's table only agrees with its
 * own colours that way (#A99BDD is 0.64 like this, 0.36 linear). A sample averages a 9 x 9 patch. Positions are
 * percentages of width and height. On a phone the samples are projected from world points by the same camera.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import type { Page } from 'playwright';

const arg = (name: string, fallback = '') => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] ?? '' : fallback; };
const BASE = arg('base', 'http://localhost:5173/steal-a-poop/');
const ONLY = arg('only').split(',').filter(Boolean);
const PHONE = process.argv.includes('--phone');
const OUT = arg('out', 'test-results/dream-gate');
const W = PHONE ? 390 : 1920, H = PHONE ? 844 : 1080;

type Rect = { x: number; y: number; w: number; h: number };
interface Shot { px: Uint8Array; hud: Rect[]; bubble: Rect | null; moon: Rect; counts: { z: number; puff: number }; stats: string; points: Record<string, [number, number]> }

const lum = (r: number, g: number, b: number) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
function hsl(r: number, g: number, b: number) {
  const R = r / 255, G = g / 255, B = b / 255, mx = Math.max(R, G, B), mn = Math.min(R, G, B), d = mx - mn, l = (mx + mn) / 2;
  // HSV saturation: in HSL the plan's own snow, #F3F0FA, would read 0.5 and fail its limit of 0.12.
  const s = mx === 0 ? 0 : d / mx;
  const h = d === 0 ? 0 : mx === R ? 60 * (((G - B) / d) % 6) : mx === G ? 60 * ((B - R) / d + 2) : 60 * ((R - G) / d + 4);
  return { h: (h + 360) % 360, s, l };
}
const hueGap = (a: number, b: number) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

function sampler(s: Shot) {
  const at = (x: number, y: number) => { const i = (Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))) * 4; return [s.px[i], s.px[i + 1], s.px[i + 2]] as const; };
  const Lxy = (x: number, y: number) => { const [r, g, b] = at(x, y); return lum(r, g, b); };
  const rgb = (px: number, py: number) => {
    const cx = Math.round((px / 100) * W), cy = Math.round((py / 100) * H);
    let r = 0, g = 0, b = 0;
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const c = at(cx + dx, cy + dy); r += c[0]; g += c[1]; b += c[2]; }
    return [r / 81, g / 81, b / 81] as const;
  };
  const L = (px: number, py: number) => { const [r, g, b] = rgb(px, py); return lum(r, g, b); };
  const inHud = (x: number, y: number) => s.hud.some((h) => x >= h.x && x < h.x + h.w && y >= h.y && y < h.y + h.h);
  return { at, Lxy, L, rgb, inHud };
}

const rows: { gate: string; name: string; value: string; range: string; ok: boolean }[] = [];
function check(gate: string, name: string, value: number | string, range: string, ok: boolean) {
  rows.push({ gate, name, value: typeof value === 'number' ? value.toFixed(3) : value, range, ok });
}
const between = (gate: string, name: string, v: number, lo: number, hi: number) => check(gate, name, v, `${lo} to ${hi}`, v >= lo && v <= hi);
const atLeast = (gate: string, name: string, v: number, lo: number) => check(gate, name, v, `>= ${lo}`, v >= lo);
const atMost = (gate: string, name: string, v: number, hi: number) => check(gate, name, v, `<= ${hi}`, v <= hi);

function measure(s: Shot) {
  const { L, Lxy, at, rgb, inHud } = sampler(s);
  const P = s.points;
  const p = (k: string, x: number, y: number): [number, number] => (PHONE ? P[k] ?? [x, y] : [x, y]);
  // ---- G1 sky
  between('G1', `sky top L(${p('skyTop', 50, 3).map((v) => v.toFixed(0))})`, L(...p('skyTop', 50, 3)), 0.2, 0.3);
  between('G1', 'sky L(20,8)', L(...p('skyA', 20, 8)), 0.26, 0.38);
  between('G1', 'sky L(80,8)', L(...p('skyB', 80, 8)), 0.26, 0.38);
  let stars = 0;
  for (let y = 0; y < H * 0.1; y++) for (let x = 0; x < W; x++) {
    if (inHud(x, y)) continue;
    if (x >= s.moon.x && x < s.moon.x + s.moon.w && y >= s.moon.y && y < s.moon.y + s.moon.h) continue;
    if (Lxy(x, y) > 0.9) stars++;
  }
  atLeast('G1', 'star pixels in y 0..10%', stars, 40);
  atLeast('G1', 'moon L(88,10)', L(...p('moon', 88, 10)), 0.92);
  // ---- G2 lane and raft
  between('G2', 'lane L(50,67)', L(...p('laneA', 50, 67)), 0.84, 0.92);
  between('G2', 'lane L(70,67)', L(...p('laneB', 70, 67)), 0.84, 0.92);
  between('G2', 'ridge L(45,84)', L(...p('ridgeA', 45, 84)), 0.78, 0.86);
  between('G2', 'ridge L(65,84)', L(...p('ridgeB', 65, 84)), 0.78, 0.86);
  between('G2', 'sea L(50,46)', L(...p('sea', 50, 46)), 0.66, 0.76);
  const [lx, ly] = p('laneA', 50, 67);
  const box: number[] = []; let br = 0, bg = 0, bb = 0;
  const bw = Math.round(W / 64), bh = Math.round(W / 192);
  for (let y = -bh; y < bh; y++) for (let x = -bw; x < bw; x++) {
    const c = at(Math.round((lx / 100) * W) + x, Math.round((ly / 100) * H) + y);
    box.push(lum(...c)); br += c[0]; bg += c[1]; bb += c[2];
  }
  const mean = box.reduce((a, b) => a + b, 0) / box.length;
  atMost('G2', 'lane box std', Math.sqrt(box.reduce((a, b) => a + (b - mean) ** 2, 0) / box.length), 0.03);
  const c = hsl(br / box.length, bg / box.length, bb / box.length), snow = hsl(0xF3, 0xF0, 0xFA);
  atMost('G2', 'lane box hue gap to #F3F0FA', hueGap(c.h, snow.h), 8);
  atMost('G2', 'lane box saturation', c.s, 0.12);
  // ---- G3 far layers
  const hillA = L(...p('hillA', 30, 25));
  between('G3', 'hills L(30,25)', hillA, 0.36, 0.46);
  between('G3', 'hills L(70,25)', L(...p('hillB', 70, 25)), 0.36, 0.46);
  atMost('G3', 'L(30,25) - L(30,19)', hillA - L(...p('mountA', 30, 19)), -0.08);
  const mount = L(...p('mountB', 50, 15));
  between('G3', 'mountains L(50,15)', mount, 0.48, 0.58);
  atLeast('G3', '|L(50,15) - L(50,9)|', Math.abs(mount - L(...p('skyAbove', 50, 9))), 0.08);
  const row = p('hillRow', 30, 25)[1];
  let edges = 0, prev = L(0, row);
  for (let x = 1; x <= 100; x++) { const v = L(x, row); if (Math.abs(v - prev) >= 0.04) edges++; prev = v; }
  atLeast('G3', 'edges along y = 25%', edges, 12);
  // ---- G4 islands
  const sky = L(...p('skyA', 20, 8));
  const boxes: Record<string, [number, number, number, number]> = PHONE
    ? { A: [6, 38, 13, 21], B: [50, 78, 17, 23], C: [14, 38, 25, 31] }
    : { A: [12, 26, 18, 30], B: [62, 76, 12, 22], C: [40, 50, 25, 33] };
  for (const [name, [x0, x1, y0, y1]] of Object.entries(boxes)) {
    let hit = 0, all = 0;
    for (let y = Math.round((y0 / 100) * H); y < (y1 / 100) * H; y += 2) for (let x = Math.round((x0 / 100) * W); x < (x1 / 100) * W; x += 2) { all++; if (Math.abs(Lxy(x, y) - sky) >= 0.15) hit++; }
    atLeast('G4', `island ${name} differs from sky`, hit / all, 0.6);
  }
  // Sampled as patches, like every other sample, or the stars in the top 4% count as cloud.
  let edgeCloud = 0;
  const edgeAt: string[] = [];
  // In the sky only: the plan's rule is about islands cropped by the frame, and the cloud sea rightly meets its sides.
  for (let y = 1; y < (PHONE ? 19 : 30); y += 1) for (let x = 1; x < 100; x += 1) {
    if (y >= 4 && x >= 4 && x <= 96) continue;
    if (inHud((x / 100) * W, (y / 100) * H)) continue;
    const [r, g, b] = rgb(x, y), l = lum(r, g, b);
    if (l >= 0.66 && l <= 0.9 && hsl(r, g, b).s <= 0.25) { edgeCloud++; if (edgeCloud <= 4) edgeAt.push(`${x},${y}`); }
  }
  check('G4', `cloud tone at the top and side edges${edgeAt.length ? ` (${edgeAt.join(' ')})` : ''}`, edgeCloud, '<= 0', edgeCloud === 0);
  between('G4', 'underside L(19,29)', L(...p('underA', 19, 29)), 0.66, 0.78);
  between('G4', 'underside L(69,21)', L(...p('underB', 69, 21)), 0.66, 0.78);
  between('G4', 'underside L(45,32)', L(...p('underC', 45, 32)), 0.66, 0.78);
  // ---- G5 contrast
  const vals: number[] = [];
  for (let y = Math.round(H * 0.2); y < H * 0.7; y += 3) for (let x = 0; x < W; x += 3) if (!inHud(x, y)) vals.push(Lxy(x, y));
  const m = vals.reduce((a, b) => a + b, 0) / vals.length;
  atLeast('G5', 'std of L over y 20..70%', Math.sqrt(vals.reduce((a, b) => a + (b - m) ** 2, 0) / vals.length), 0.12);
  // ---- G6 bubble
  const bu = s.bubble;
  const pct = (v: number, of: number) => (v / of) * 100;
  check('G6', 'bubble inside x 2..28%, y 70..98%', bu ? `${pct(bu.x, W).toFixed(1)}..${pct(bu.x + bu.w, W).toFixed(1)}, ${pct(bu.y, H).toFixed(1)}..${pct(bu.y + bu.h, H).toFixed(1)}` : 'none', 'inside',
    !!bu && (PHONE || (pct(bu.x, W) >= 1.9 && pct(bu.x + bu.w, W) <= 28.1 && pct(bu.y, H) >= 69.9 && pct(bu.y + bu.h, H) <= 98.1)));
  if (bu) {
    const wall = L(pct(bu.x + bu.w * 0.8, W), pct(bu.y + bu.h * 0.25, H));
    atMost('G6', 'wall L in the upper right third', wall, 0.2);
    const skin = hsl(0xEB, 0xCD, 0xB9);
    let found = false;
    for (let y = bu.y + bu.h * 0.3; y < bu.y + bu.h * 0.7 && !found; y += 3) for (let x = bu.x + bu.w * 0.15; x < bu.x + bu.w * 0.85 && !found; x += 3) {
      const [r, g, b] = rgb(pct(x, W), pct(y, H)), l = lum(r, g, b);
      if (l >= 0.55 && l <= 0.75 && hueGap(hsl(r, g, b).h, skin.h) <= 36) found = true;
    }
    check('G6', 'a patch of skin in the middle band', found ? 'found' : 'none', 'found', found);
  }
  check('G6', '.dream-z and .dream-puff', `${s.counts.z} and ${s.counts.puff}`, '3 and 3', s.counts.z === 3 && s.counts.puff === 3);
  // ---- G7 fence
  const beam = hsl(0x8B, 0x5E, 0x3C);
  let fence = false, nearest = 'none', gap = 999;
  const [fx0, fx1, fy0, fy1] = PHONE ? [40, 100, 30, 62] : [70, 95, 58, 72];
  for (let y = fy0; y < fy1 && !fence; y += 0.5) for (let x = fx0; x < fx1 && !fence; x += 0.5) {
    const [r, g, b] = rgb(x, y), l = lum(r, g, b);
    const hg = hueGap(hsl(r, g, b).h, beam.h);
    if (l >= 0.25 && l <= 0.45 && hg <= 16) fence = true;
    if (l >= 0.2 && l <= 0.6 && hg < gap) { gap = hg; nearest = `L ${l.toFixed(2)}, hue gap ${hg.toFixed(0)}`; }
  }
  check('G7', 'a patch of fence brown at ready', fence ? 'found' : `none (nearest ${nearest})`, 'found', fence);
}

async function capture(page: Page): Promise<Shot> {
  await page.goto(`${BASE}?dreamSeed=1&dev=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelector('.sk-menu-item') && !document.body.textContent?.includes('Loading…'), null, { timeout: 90000 });
  // A string, so the runner does not rewrite the browser's import().
  await page.evaluate(`(async () => {
    const url = performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes('/src/skin/dream/dreamStore.ts'));
    (await import(url)).useDreamUi.getState().openDream(true);
  })()`);
  await page.waitForSelector('.dr-root[data-phase="ready"] canvas', { timeout: 90000 });
  await page.waitForTimeout(9000);
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, PHONE ? 'phone.png' : 'desktop.png'), await page.screenshot({ type: 'png' }));
  // The scene is measured with the HUD hidden: the plan's own samples (50,9) and (50,15) fall under its board.
  await page.addStyleTag({ content: '.sk-notice, .sk-input-bar, .sk-input-prompt, .sk-chip, .dr-hud, #sk-dev, .dr-help { visibility: hidden !important; }' });
  await page.waitForTimeout(500);
  const png = await page.screenshot({ type: 'png' });
  writeFileSync(join(OUT, PHONE ? 'phone-scene.png' : 'desktop-scene.png'), png);
  const info = await page.evaluate(() => {
    const rect = (e: Element) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
    // Only what is still on screen in the scene shot: the rest of the HUD is hidden for it.
    const hud = [...document.querySelectorAll('.dr-bubble, .dream-puff')].map(rect);
    const bubble = document.querySelector('.dr-bubble');
    const w = window as unknown as { __dreamFrame?: Record<string, [number, number]> };
    return { hud, bubble: bubble ? rect(bubble) : null, counts: { z: document.querySelectorAll('.dream-z').length, puff: document.querySelectorAll('.dream-puff').length }, stats: document.getElementById('sk-dev')?.textContent ?? '', points: w.__dreamFrame ?? {} };
  });
  const decoder = await page.context().browser()!.newPage();
  const raw = await decoder.evaluate(async (b64) => {
    const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob();
    const bmp = await createImageBitmap(blob);
    const c = new OffscreenCanvas(bmp.width, bmp.height), g = c.getContext('2d')!;
    g.drawImage(bmp, 0, 0);
    const d = g.getImageData(0, 0, bmp.width, bmp.height).data;
    let s = '';
    for (let i = 0; i < d.length; i += 32768) s += String.fromCharCode(...d.subarray(i, i + 32768));
    return btoa(s);
  }, png.toString('base64'));
  await decoder.close();
  const p = info.points.moon ?? [88, 10];
  const moon = { x: (p[0] / 100) * W - W * 0.04, y: (p[1] / 100) * H - H * 0.07, w: W * 0.08, h: H * 0.14 };
  return { px: Uint8Array.from(Buffer.from(raw, 'base64')), moon, ...info };
}

// PW_CHROMIUM picks an installed Chrome when Playwright's own browser is not downloaded.
const browser = await chromium.launch({ ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const shot = await capture(page);
await browser.close();
measure(shot);
const shown = ONLY.length ? rows.filter((r) => ONLY.includes(r.gate)) : rows;
for (const r of shown) console.log(`${r.ok ? 'pass' : 'FAIL'}  ${r.gate}  ${r.name.padEnd(38)} ${r.value.padEnd(16)} ${r.range}`);
console.log(`\ndev overlay: ${shot.stats || 'none'} (budget: under 500k triangles, under 60 draws, under 5 ms; software rendering here, so the time means nothing)`);
const failed = shown.filter((r) => !r.ok);
console.log(`${shown.length - failed.length} of ${shown.length} passed${ONLY.length ? ` (${ONLY.join(', ')})` : ''}; screenshot in ${OUT}`);
process.exit(failed.length ? 1 : 0);

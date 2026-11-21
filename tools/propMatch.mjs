// The diorama's match test (docs/diorama/PLAN.md, 5.3). For every recipe (src/skin/scene/style/recipes), renders its
// front, side and top views (?preview=prop) and compares each with its reference sheet in docs/diorama/reference/
// (<reference>-front.png, -side.png, -top.png):
//   outline   the two silhouettes, each cut from its background and fitted to the same box, overlap (intersection over
//             union) at least 0.90;
//   colour    at the centre of each part's face toward the camera, the render and the reference are within ΔE 6
//             (CIE 1976, 3 x 3 pixels averaged).
// A recipe with no reference fails. The pass marks are the plan's; this tool may not be changed to pass a prop.
//
//   node tools/propMatch.mjs [--base http://localhost:5173/steal-a-poop/] [--only bale,crate] [--out <dir>]
// Needs `npm run dev`. Exit 0 every recipe passed; 1 anything else. --out keeps the renders and the overlays.
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const base = arg('base', 'http://localhost:5173/steal-a-poop/');
const only = arg('only', '')?.split(',').filter(Boolean);
const out = arg('out', '');
const REF = 'docs/diorama/reference';
const VIEWS = ['front', 'side', 'top'];
const PASS = { iou: 0.9, dE: 6 };
if (out) mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--use-gl=angle', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 600, height: 600 } });
const open = async (q) => {
  await page.goto(`${base}?skin=painted&preview=prop&${q}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__recipes !== undefined, null, { timeout: 60000 });
};
await open('id=');
const recipes = (await page.evaluate(() => window.__recipes)).filter((r) => !only?.length || only.includes(r.id));
if (!recipes.length) console.log('propMatch: no recipes to match yet');

// The comparison runs in the page: both pictures as data URLs in, the numbers out.
const compare = (shot, ref, parts) => page.evaluate(async ({ shot, ref, parts }) => {
  const load = async (src) => { const im = new Image(); im.src = src; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0); return { w: im.width, h: im.height, d: g.getImageData(0, 0, im.width, im.height).data }; };
  const A = await load(shot), B = await load(ref);
  const maskOf = (I) => { const bg = [I.d[0], I.d[1], I.d[2]], m = new Uint8Array(I.w * I.h); let x0 = I.w, y0 = I.h, x1 = -1, y1 = -1;
    for (let y = 0; y < I.h; y++) for (let x = 0; x < I.w; x++) { const i = (y * I.w + x) * 4; if (Math.abs(I.d[i] - bg[0]) + Math.abs(I.d[i + 1] - bg[1]) + Math.abs(I.d[i + 2] - bg[2]) > 40) { m[y * I.w + x] = 1; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } }
    return { m, box: [x0, y0, x1 + 1, y1 + 1] }; };
  const a = maskOf(A), b = maskOf(B);
  if (a.box[2] <= a.box[0] || b.box[2] <= b.box[0]) return { iou: 0, parts: [], why: 'an empty picture' };
  // Both outlines fitted to one 256 x 256 box, keeping their own proportions, centred.
  const N = 256, fit = (I, M) => { const [x0, y0, x1, y1] = M.box, w = x1 - x0, h = y1 - y0, k = N / Math.max(w, h), ox = (N - w * k) / 2, oy = (N - h * k) / 2;
    const at = (u, v) => [x0 + (u - ox) / k, y0 + (v - oy) / k]; const g = new Uint8Array(N * N);
    for (let v = 0; v < N; v++) for (let u = 0; u < N; u++) { const [x, y] = at(u + 0.5, v + 0.5); if (x >= x0 && x < x1 && y >= y0 && y < y1) g[v * N + u] = M.m[Math.floor(y) * I.w + Math.floor(x)]; }
    return { g, toShare: (x, y) => [((x - x0) * k + ox) / N, ((y - y0) * k + oy) / N], fromShare: (s, t) => at(s * N, t * N) }; };
  const fa = fit(A, a), fb = fit(B, b);
  let inter = 0, uni = 0; for (let i = 0; i < N * N; i++) { inter += fa.g[i] & fb.g[i]; uni += fa.g[i] | fb.g[i]; }
  const lab = (r, g, bb) => { const f = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; const [R, G, B2] = [f(r), f(g), f(bb)];
    const X = (0.4124 * R + 0.3576 * G + 0.1805 * B2) / 0.95047, Y = 0.2126 * R + 0.7152 * G + 0.0722 * B2, Z = (0.0193 * R + 0.1192 * G + 0.9505 * B2) / 1.08883;
    const t = (v) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116); return [116 * t(Y) - 16, 500 * (t(X) - t(Y)), 200 * (t(Y) - t(Z))]; };
  const avg = (I, x, y) => { let s = [0, 0, 0], n = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = Math.round(x) + dx, Y = Math.round(y) + dy; if (X < 0 || Y < 0 || X >= I.w || Y >= I.h) continue; const i = (Y * I.w + X) * 4; s[0] += I.d[i]; s[1] += I.d[i + 1]; s[2] += I.d[i + 2]; n++; } return s.map((v) => v / Math.max(1, n)); };
  const out = parts.map((p) => { const x = p.x * A.w, y = p.y * A.h; if (!a.m[Math.floor(y) * A.w + Math.floor(x)]) return { ...p, dE: null };
    const [s, t] = fa.toShare(x, y), [rx, ry] = fb.fromShare(s, t); const la = lab(...avg(A, x, y)), lb = lab(...avg(B, rx, ry));
    return { ...p, dE: Math.hypot(la[0] - lb[0], la[1] - lb[1], la[2] - lb[2]) }; });
  return { iou: inter / Math.max(1, uni), parts: out };
}, { shot, ref, parts });

let failed = 0;
for (const r of recipes) {
  const lines = [];
  let ok = true;
  for (const view of VIEWS) {
    const file = join(REF, `${r.reference}-${view}.png`);
    if (!existsSync(file)) { ok = false; lines.push(`  ${view}: NO REFERENCE (${file})`); continue; }
    await open(`id=${encodeURIComponent(r.id)}&view=${view}`);
    await page.waitForFunction(() => window.__propReady === true, null, { timeout: 60000 });
    const png = await page.screenshot({ type: 'png' });
    if (out) writeFileSync(join(out, `${r.id}-${view}.png`), png);
    const parts = await page.evaluate(() => window.__propParts);
    const res = await compare(`data:image/png;base64,${png.toString('base64')}`, `data:image/png;base64,${readFileSync(file).toString('base64')}`, parts);
    const off = res.parts.filter((p) => p.dE !== null && p.dE > PASS.dE);
    const pass = res.iou >= PASS.iou && !off.length;
    ok &&= pass;
    lines.push(`  ${view}: ${pass ? 'PASS' : 'FAIL'}  outline ${(res.iou * 100).toFixed(1)}% (needs ${PASS.iou * 100}%)${res.why ? `, ${res.why}` : ''}; ${res.parts.filter((p) => p.dE !== null).length} parts seen, ${off.length} over ΔE ${PASS.dE}${off.length ? `: ${off.map((p) => `${p.name} ${p.dE.toFixed(1)}`).join(', ')}` : ''}`);
  }
  if (!ok) failed++;
  console.log(`${r.id}: ${ok ? 'PASS' : 'FAIL'}\n${lines.join('\n')}`);
}
await browser.close();
console.log(`propMatch: ${recipes.length - failed} of ${recipes.length} recipes pass`);
process.exit(failed ? 1 : 0);

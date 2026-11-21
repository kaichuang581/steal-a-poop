// Where Home's picture flickers: two frames a moment apart while the tour's camera drifts; bright = big change.
//   node tools/miniature/shimmer.mjs <outDir> [pov ...]
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { home, advance } from '../gate/lib/painted.mjs';
const [out, ...povs] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--use-gl=angle', '--ignore-gpu-blocklist'] });
for (let pov of povs) {
  // pov is "x,y,z,tx,ty,tz,fov"; the second frame's camera is pushed 2% of the way to the target.
  const c = pov.split(',').map(Number), f = Number(process.env.PUSH ?? 0.02);
  const c2 = [...c.slice(0, 3).map((v, i) => v + (c[i + 3] - v) * f), ...c.slice(3)];
  const shot = async (cam) => {
    const o = await home(browser, { url: 'http://localhost:5173/steal-a-poop/', viewport: { width: 1280, height: 800 }, pov: 0, extraQuery: { gfx: 'high', cam: cam.join(',') } });
    await o.page.evaluate(() => { for (const el of document.body.querySelectorAll('*')) if (!(el instanceof HTMLCanvasElement) && !el.querySelector('canvas')) el.style.visibility = 'hidden'; });
    await o.page.waitForTimeout(300);
    const png = await o.page.screenshot({ type: 'png' });
    return { o, png };
  };
  const { png: a, o: o1 } = await shot(c); await o1.context.close();
  const { png: b, o } = await shot(c2);
  pov = process.env.NAME ?? 'x';
  writeFileSync(`${out}/pov${pov}-a.png`, a);
  const heat = await o.page.evaluate(async ([a, b]) => {
    const load = (s) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + s; });
    const [ia, ib] = await Promise.all([load(a), load(b)]);
    const c = document.createElement('canvas'); c.width = ia.width; c.height = ia.height;
    const x = c.getContext('2d'); x.drawImage(ia, 0, 0); const da = x.getImageData(0, 0, c.width, c.height);
    x.drawImage(ib, 0, 0); const db = x.getImageData(0, 0, c.width, c.height);
    for (let i = 0; i < da.data.length; i += 4) {
      const d = Math.abs(da.data[i] - db.data[i]) + Math.abs(da.data[i + 1] - db.data[i + 1]) + Math.abs(da.data[i + 2] - db.data[i + 2]);
      const v = Math.min(255, d * 2);
      db.data[i] = v; db.data[i + 1] = v * 0.3; db.data[i + 2] = 0; db.data[i + 3] = 255;
      // faint scene underneath
      db.data[i + 1] += da.data[i + 1] * 0.25; db.data[i + 2] += da.data[i + 2] * 0.25;
    }
    x.putImageData(db, 0, 0);
    return c.toDataURL('image/png').split(',')[1];
  }, [a.toString('base64'), b.toString('base64')]);
  writeFileSync(`${out}/pov${pov}-heat.png`, Buffer.from(heat, 'base64'));
  console.log('pov', pov);
  await o.context.close();
}
await browser.close();

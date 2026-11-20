// The painted-miniature plan's pictures (docs/miniature/04, section 7; 08, section 4), from the development server.
//
//   node tools/miniature/shots.mjs piece <name> | sheet kit | sheet home
//       opens ?preview=mini at 1600 x 1200 and saves docs/miniature/review/<what>-<name>.jpg
//   node tools/miniature/shots.mjs cluster <name> [--query shade=off] [--name word]
//       one micro cluster on Home itself, the camera stood by it (?cam=), the menu hidden: review/cluster-<name>.jpg
//   node tools/miniature/shots.mjs tour [--hour day|dawn|dusk|night] [--phone] [--shots 0,1,5] [--query k=v] [--name word]
//       saves Home's tour shots through ?pov=N and ?hour=, 1280 x 800 (computer) or 390 x 844 (phone), to
//       docs/miniature/review/tour/<shot>.jpg, a shot being pov<N>-<hour>[-phone][-<word>]
//   node tools/miniature/shots.mjs before [--hour ...] [--phone] [--shots ...]
//       the same pictures, saved once in M0 to docs/miniature/before/ and never written over
//   node tools/miniature/shots.mjs scene table|table:<seats>|ice|podium|dream|pen [--phone] [--before] [--name word]
//       one picture of another scene, to review/tour/ (or before/)
//   node tools/miniature/shots.mjs pair <shot> [<shot> ...] [--against <other shot name in review/tour>] [--left <one>]
//       the "before" and the "after" of a shot side by side in one image: docs/miniature/review/pairs/<shot>.jpg
//       (--left: the left picture is that one from review/tour instead, for a switch's off and on)
//
// Pictures are JPEG (quality 90), not the plan's PNG: the four hours of the tour, before and after, are over a hundred
// pictures of 1.3 MB each as PNG (docs/miniature/inventory.md, deviations).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { dream, duel, home, shoot, table, tableResults } from '../gate/lib/painted.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DOCS = resolve(ROOT, 'docs', 'miniature');
const URL_ = process.env.MINIATURE_URL ?? 'http://localhost:5173/steal-a-poop/';
const [cmd, ...rest] = process.argv.slice(2);
const flags = { hour: 'day', phone: false, shots: null, query: {}, name: '', against: null, left: null, before: false }, words = [];
for (let i = 0; i < rest.length; i++) {
  const a = rest[i];
  if (a === '--hour') flags.hour = rest[++i];
  else if (a === '--phone') flags.phone = true;
  else if (a === '--before') flags.before = true;
  else if (a === '--shots') flags.shots = rest[++i].split(',').map(Number);
  else if (a === '--query') { const [k, v = ''] = rest[++i].split('='); flags.query[k] = v; }
  else if (a === '--name') flags.name = `-${rest[++i]}`;
  else if (a === '--against') flags.against = rest[++i];
  else if (a === '--left') flags.left = rest[++i];
  else words.push(a);
}
const usage = () => { console.error('usage: shots.mjs piece <name> | sheet kit|home | cluster <name> | tour | before | scene <place> | pair <shot> ...   (the top of the file says more)'); process.exit(64); };
if (!['piece', 'sheet', 'cluster', 'tour', 'before', 'scene', 'pair'].includes(cmd)) usage();
const launch = () => chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--use-gl=angle', '--ignore-gpu-blocklist'] });
const PHONE = { viewport: { width: 390, height: 844 }, touch: true }, COMPUTER = { viewport: { width: 1280, height: 800 } };
const size = () => (flags.phone ? PHONE : COMPUTER);
const save = (dir, name, bytes, keep = false) => {
  mkdirSync(dir, { recursive: true });
  const file = resolve(dir, name);
  if (keep && existsSync(file)) { console.log(`${name} kept (a "before" picture is never written over)`); return; }
  writeFileSync(file, bytes);
  console.log(name);
};
let failed = 0;

// Where the camera stands for a cluster's picture: on Home itself (?cam=), where the wall it stands against is.
const CLUSTER_CAMS = {
  workCorner: '9.4,2.7,13.6,4.4,0.9,7.6,34', workCornerDoors: '-0.6,2.4,14.6,0.1,2.2,7.3,40',
  toolCorner: '-9.6,2.2,12.2,-5.7,0.7,7.6,30', tractorSide: '11.0,1.7,16.9,7.9,0.5,16.0,28',
  henCorner: '-9.2,3.6,12.6,-14.8,0.3,11.4,46', gate: '1.4,1.5,19.6,-1.3,0.7,16.6,34',
};
if (cmd === 'cluster') {
  if (!words.length) usage();
  const browser = await launch();
  for (const name of words) {
    const file = `cluster-${name}${flags.name}.jpg`;
    try {
      if (!CLUSTER_CAMS[name]) throw new Error(`no camera for "${name}": add one to CLUSTER_CAMS`);
      const o = await home(browser, { url: URL_, width: 1600, height: 1200, pov: 0, hour: flags.hour, extraQuery: { gfx: 'high', cam: CLUSTER_CAMS[name], ...flags.query } });
      // The scene alone: the menu would cover half of it.
      await o.page.evaluate(() => { for (const el of document.body.querySelectorAll('*')) if (!(el instanceof HTMLCanvasElement) && !el.querySelector('canvas')) el.style.visibility = 'hidden'; });
      await o.page.waitForTimeout(600);
      save(resolve(DOCS, 'review'), file, await shoot(o.page, { type: 'jpeg', quality: 90 }));
      await o.context.close();
    } catch (e) { failed++; console.log(`${file} FAILED: ${String(e.message).slice(0, 240)}`); }
  }
  await browser.close();
} else if (cmd === 'piece' || cmd === 'sheet') {
  if (!words.length) usage();
  const browser = await launch();
  for (const name of words) {
    const file = `${cmd}-${name}.jpg`;
    try {
      const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
      page.on('pageerror', (e) => console.log(`  ${name}: ${String(e.message).slice(0, 300)}`));
      await page.goto(`${URL_}?${new URLSearchParams({ preview: 'mini', [cmd]: name, ...flags.query })}`);
      await page.waitForFunction(() => document.body.dataset.miniReady === '1', null, { timeout: 60_000 });
      await page.waitForTimeout(400);
      save(resolve(DOCS, 'review'), file, await page.screenshot({ type: 'jpeg', quality: 90 }));
      await page.close();
    } catch (e) { failed++; console.log(`${file} FAILED: ${String(e.message).slice(0, 240)}`); }
  }
  await browser.close();
} else if (cmd === 'tour' || cmd === 'before') {
  const browser = await launch(), dir = resolve(DOCS, cmd === 'before' ? 'before' : 'review/tour');
  for (const pov of flags.shots ?? (flags.phone ? [0, 1, 2, 3, 4, 5] : [0, 1, 2, 3, 4, 5, 6, 7])) {
    const name = `pov${pov}-${flags.hour}${flags.phone ? '-phone' : ''}${flags.name}.jpg`;
    try {
      // ?wendigoDebug is handed over as a plain switch: given as the helper's own, it waits for the figure's sprite, which
      // the magenta figure is not. Its model lands a few seconds after the farm, so the picture waits for it here.
      const { wendigoDebug, ...plain } = flags.query, debug = wendigoDebug !== undefined;
      const o = await home(browser, { url: URL_, ...size(), pov, hour: flags.hour, extraQuery: { gfx: 'high', ...plain }, ...(debug ? { query: { wendigoDebug: '' } } : {}) });
      if (debug) await o.page.waitForTimeout(8000);
      save(dir, name, await shoot(o.page, { type: 'jpeg', quality: 90 }), cmd === 'before');
      await o.context.close();
    } catch (e) { failed++; console.log(`${name} FAILED: ${String(e.message).slice(0, 240)}`); }
  }
  await browser.close();
} else if (cmd === 'scene') {
  const browser = await launch(), dir = resolve(DOCS, flags.before ? 'before' : 'review/tour');
  for (const item of words) {
    const [place, seats] = item.split(':'), base = { url: URL_, ...size() }, query = { gfx: 'high', ...flags.query };
    const name = `${item.replace(':', '-')}${flags.phone ? '-phone' : ''}${flags.name}.jpg`;
    try {
      let o;
      if (place === 'table') o = await table(browser, { ...base, seats: seats ? Number(seats) : null, query });
      else if (place === 'podium') o = await tableResults(browser, { ...base, query });
      else if (place === 'ice') o = await duel(browser, { ...base, query });
      else if (place === 'dream') o = await dream(browser, { ...base, query });
      else if (place === 'pen') {
        const context = await browser.newContext(size()), page = await context.newPage();
        await page.goto(`${URL_}?${new URLSearchParams({ preview: 'pen', ...query })}`);
        await page.waitForTimeout(9000);
        o = { page, context, raw: true };
      } else throw new Error(`no such place: ${item}`);
      save(dir, name, o.raw ? await o.page.screenshot({ type: 'jpeg', quality: 90 }) : await shoot(o.page, { type: 'jpeg', quality: 90 }), flags.before);
      await o.context.close();
    } catch (e) { failed++; console.log(`${name} FAILED: ${String(e.message).slice(0, 240)}`); }
  }
  await browser.close();
} else {
  // pair: the two pictures side by side on one canvas, the "before" on the left.
  if (!words.length) usage();
  const browser = await launch(), page = await browser.newPage();
  const data = (file) => `data:image/jpeg;base64,${readFileSync(file).toString('base64')}`;
  for (const shot of words) {
    const left = flags.left ? resolve(DOCS, 'review/tour', `${flags.left}.jpg`) : resolve(DOCS, 'before', `${shot}.jpg`), right = resolve(DOCS, 'review/tour', `${flags.against ?? shot}.jpg`);
    try {
      if (!existsSync(left) || !existsSync(right)) throw new Error(`missing ${existsSync(left) ? right : left}`);
      const url = await page.evaluate(async ([a, b]) => {
        const load = async (src) => { const im = new Image(); im.src = src; await im.decode(); return im; };
        const [l, r] = [await load(a), await load(b)], gap = 12, c = document.createElement('canvas');
        c.width = l.width + r.width + gap; c.height = Math.max(l.height, r.height);
        const g = c.getContext('2d');
        g.fillStyle = '#1b1b1b'; g.fillRect(0, 0, c.width, c.height);
        g.drawImage(l, 0, 0); g.drawImage(r, l.width + gap, 0);
        return c.toDataURL('image/jpeg', 0.9);
      }, [data(left), data(right)]);
      save(resolve(DOCS, 'review/pairs'), `${flags.left ?? flags.against ?? shot}.jpg`, Buffer.from(url.split(',')[1], 'base64'));
    } catch (e) { failed++; console.log(`${shot} FAILED: ${String(e.message).slice(0, 240)}`); }
  }
  await browser.close();
}
process.exit(failed ? 1 : 0);

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { withBootDoors } from '../../../../vite.config';
import { BOOT_DOORS_ID, FLAKES, bootDoorsCss, bootDoorsMarkup, doorArt } from '../bootDoors';

// The barn doors the page itself comes with (index.html), so something is on screen before the game's code arrives.
const page = readFileSync('index.html', 'utf8');
const skin = readFileSync('src/skin/styles/skin.css', 'utf8');
const doors = readFileSync('src/skin/components/BarnDoors.tsx', 'utf8');
const BASE = '/steal-a-poop/';

describe('the page comes with the doors shut', () => {
  const built = withBootDoors(page);

  it('writes the doors into the page, after the game\'s root and inside the body', () => {
    expect(built).toContain(`<div id="${BOOT_DOORS_ID}" class="sk-doors" data-phase="shut"`);
    expect(built).not.toContain('<!--boot-doors-->');
    expect(built.indexOf(`id="${BOOT_DOORS_ID}"`)).toBeGreaterThan(built.indexOf('<div id="root">'));
    expect(built.indexOf(`id="${BOOT_DOORS_ID}"`)).toBeLessThan(built.indexOf('</body>'));
  });

  it('puts their rules in the head, so they are drawn with the first frame', () => {
    const at = built.indexOf('<style id="boot-doors-style">');
    expect(at).toBeGreaterThan(-1);
    expect(at).toBeLessThan(built.indexOf('</head>'));
    expect(built.slice(at, built.indexOf('</style>', at))).toContain('.sk-doors {');
  });

  it('fetches the three pictures with the page', () => {
    for (const part of ['leaves', 'lintel', 'sill']) expect(page).toContain(`<link rel="preload" as="image" type="image/webp" href="loading/doors-${part}.webp" />`);
  });

  it('says so, loudly, if the page has lost the place for them or skin.css its marks', () => {
    expect(() => withBootDoors(page.replace('<!--boot-doors-->', ''))).toThrow(/barn doors/);
    expect(() => bootDoorsCss(skin.replace('/* boot-doors:end */', ''))).toThrow(/boot-doors/);
  });
});

describe('the doors as text', () => {
  const html = bootDoorsMarkup(BASE);

  it('is markup only: the built page allows no inline script', () => {
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/\son\w+=/i);
    expect(html).not.toMatch(/javascript:/i);
  });

  it('has both leaves, the beam, the drift, the sky behind the snow, and the snow', () => {
    for (const cls of ['sk-doors-frame', 'sk-door sk-door-l', 'sk-door sk-door-r', 'sk-door-art', 'sk-doors-sky', 'sk-doors-lintel', 'sk-doors-sill', 'sk-doors-snow']) expect(html).toContain(`class="${cls}"`);
    expect(html.match(/<i style=/g)).toHaveLength(FLAKES.length);
    expect(FLAKES).toHaveLength(22);
  });

  it('is laid out from the numbers and pictures BarnDoors uses, at the path the site is served from', () => {
    const art = doorArt(BASE);
    expect(art['--doors-leaves']).toBe(`url("${BASE}loading/doors-leaves.webp")`);
    for (const [k, v] of Object.entries(art)) expect(html).toContain(`${k}:${String(v).replace(/"/g, '&quot;')}`);
    expect(html).toContain('--vox-cols:96');
    expect(html).toContain('--leaf-rows:52');
  });

  it('is the same picture BarnDoors draws: the same parts, art and snowflakes, so the handover shows nothing', () => {
    expect(doors).toContain("import { BOOT_DOORS_ID, FLAKES, doorArt } from '../loading/bootDoors';");
    expect(doors).toContain('doorArt(import.meta.env.BASE_URL)');
    for (const cls of ['sk-doors-frame', 'sk-door-art', 'sk-doors-sky', 'sk-doors-lintel', 'sk-doors-sill', 'sk-doors-snow']) expect(doors).toContain(`className="${cls}"`);
    expect(doors).toContain('className={`sk-door sk-door-${side}`}');
  });
});

describe('the rules that draw them', () => {
  const css = bootDoorsCss(skin);

  it('cover every part of the shut doors', () => {
    for (const sel of ['.sk-doors {', '.sk-doors-frame {', '.sk-door {', '.sk-door-art {', '.sk-doors-lintel {', '.sk-doors-sky {', '.sk-doors-sill {', '.sk-doors-snow {', '.sk-doors-snow i {', `#${BOOT_DOORS_ID} {`]) expect(css, sel).toContain(sel);
  });

  it('stand alone: every custom property they read is set by them, by the doors\' own style, or has a fallback', () => {
    const own = new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
    for (const k of Object.keys(doorArt(BASE))) own.add(k);
    for (const k of Object.keys(FLAKES[0])) if (k.startsWith('--')) own.add(k);
    for (const m of css.matchAll(/var\((--[\w-]+)(,)?/g)) expect(own.has(m[1]) || !!m[2], `${m[1]} is not set for the page's doors`).toBe(true);
    expect(css).not.toMatch(/var\(--(skin|kit)-/);
    expect(css).not.toMatch(/url\(/); // the pictures come in through the doors' own style, at the site's path
  });

  it('draw the doors shut and nothing else: no swing, no sign, and only the snow moves', () => {
    expect(css).not.toMatch(/data-phase/);
    expect(css).not.toMatch(/sk-load/);
    expect([...css.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1])).toEqual(['sk-doors-flake']);
    expect(css).toContain('@media (prefers-reduced-motion: reduce) { .sk-doors-snow { display: none; } }');
  });

  it('keep the page\'s doors just under the ones BarnDoors draws', () => {
    expect(css).toMatch(/\.sk-doors \{[^}]*z-index: 90;/);
    expect(css).toMatch(/#boot-doors \{ z-index: 89; \}/);
  });

  it('are small', () => {
    expect(css.length + bootDoorsMarkup(BASE).length).toBeLessThan(8 * 1024);
  });
});

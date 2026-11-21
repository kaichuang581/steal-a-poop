import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { withBootDoors } from '../../../../vite.config';
import { BALL_AT, BOOT_DOORS_ID, FLAKES, ballImage, bootDoorsCss, bootDoorsMarkup } from '../bootDoors';

// The loading screen the page itself comes with (index.html), so something is on screen before the game's code arrives.
const page = readFileSync('index.html', 'utf8');
const skin = readFileSync('src/skin/styles/skin.css', 'utf8');
const screen = readFileSync('src/skin/components/BarnDoors.tsx', 'utf8');
const BASE = '/steal-a-poop/';

describe('the page comes with the yarn screen at its start', () => {
  const built = withBootDoors(page);

  it('writes the screen into the page, after the game\'s root and inside the body', () => {
    expect(built).toContain(`<div id="${BOOT_DOORS_ID}" class="sk-doors sk-yarn" data-phase="shut" role="progressbar"`);
    expect(built).toContain('aria-valuenow="0"');
    expect(built).not.toContain('<!--boot-doors-->');
    expect(built.indexOf(`id="${BOOT_DOORS_ID}"`)).toBeGreaterThan(built.indexOf('<div id="root">'));
    expect(built.indexOf(`id="${BOOT_DOORS_ID}"`)).toBeLessThan(built.indexOf('</body>'));
  });

  it('puts its rules in the head, so it is drawn with the first frame', () => {
    const at = built.indexOf('<style id="boot-doors-style">');
    expect(at).toBeGreaterThan(-1);
    expect(at).toBeLessThan(built.indexOf('</head>'));
    expect(built.slice(at, built.indexOf('</style>', at))).toContain('.sk-doors {');
  });

  it('fetches the one picture with the page, the ball\'s, and no door pictures', () => {
    expect(page).toContain('<link rel="preload" as="image" type="image/webp" href="loading/yarn-ball.webp" />');
    expect(page).not.toMatch(/doors-(leaves|lintel|sill)/);
    expect(page.match(/rel="preload" as="image"/g)).toHaveLength(1);
  });

  it('says so, loudly, if the page has lost the place for it or skin.css its marks', () => {
    expect(() => withBootDoors(page.replace('<!--boot-doors-->', ''))).toThrow(/loading screen has nowhere to go/);
    expect(() => bootDoorsCss(skin.replace('/* boot-doors:end */', ''))).toThrow(/boot-doors/);
  });
});

describe('the screen as text', () => {
  const html = bootDoorsMarkup(BASE);

  it('is markup only: the built page allows no inline script', () => {
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/\son\w+=/i);
    expect(html).not.toMatch(/javascript:/i);
  });

  it('has the snow, the dotted word, the two empty canvases and the ball at the foot of the "f", and nothing else', () => {
    for (const cls of ['sk-yarn-snow', 'sk-yarn-word', 'sk-yarn-guide', 'sk-yarn-shadow', 'sk-yarn-strand', 'sk-yarn-ball', 'sk-yarn-ball-body', 'sk-yarn-ball-shadow', 'sk-yarn-ball-wraps', 'sk-yarn-ball-shade']) expect(html).toContain(`class="${cls}"`);
    expect(html.match(/<i style=/g)).toHaveLength(FLAKES.length);
    expect(FLAKES).toHaveLength(22);
    expect(BALL_AT).toEqual({ left: '4.797%', top: '94.444%' });
    expect(html).toContain(`style="left:${BALL_AT.left};top:${BALL_AT.top}"`);
    expect(html).toContain(`src="${ballImage(BASE)}"`);
    expect(html).toContain('id="yb0-shade"');
    // No text: no percentage, no line, no sheep.
    expect(html.replace(/<[^>]*>/g, '').trim()).toBe('');
    expect(html).not.toMatch(/sheep|%<|sheared/i);
  });

  it('snows slowly: 2 to 4 px, 16% to 40% white, 16 to 30 s, drifting up to 40 px, no shadow', () => {
    for (const f of FLAKES) {
      expect(parseFloat(f.width)).toBeGreaterThanOrEqual(2); expect(parseFloat(f.width)).toBeLessThanOrEqual(4);
      expect(Number(f.opacity)).toBeGreaterThanOrEqual(0.16); expect(Number(f.opacity)).toBeLessThanOrEqual(0.4);
      expect(parseFloat(f.animationDuration)).toBeGreaterThanOrEqual(16); expect(parseFloat(f.animationDuration)).toBeLessThanOrEqual(30);
      expect(Math.abs(parseFloat(f['--drift']))).toBeLessThanOrEqual(40);
    }
  });

  it('is the same picture the game draws: the same pieces, from the same functions, so the handover shows nothing', () => {
    expect(screen).toContain("import { BALL_AT, BOOT_DOORS_ID, FLAKES, ballImage, ballShadeMarkup, ballShadowMarkup, guideMarkup } from '../loading/bootDoors';");
    expect(screen).toContain("const GUIDE = guideMarkup(), SHADOW = ballShadowMarkup(), SHADE = ballShadeMarkup('yb1');");
    expect(screen).toContain('ballImage(import.meta.env.BASE_URL)');
    for (const cls of ['sk-doors sk-yarn', 'sk-yarn-snow', 'sk-yarn-word', 'sk-yarn-shadow', 'sk-yarn-strand', 'sk-yarn-ball', 'sk-yarn-ball-body', 'sk-yarn-ball-wraps']) expect(screen).toContain(`className="${cls}"`);
  });
});

describe('the rules that draw it', () => {
  const css = bootDoorsCss(skin);

  it('cover every part of the screen at its start', () => {
    for (const sel of ['.sk-doors {', '.sk-yarn-snow {', '.sk-yarn-snow i {', '.sk-yarn-word {', '.sk-yarn-guide path {', '.sk-yarn-ball {', '.sk-yarn-ball-body {', `#${BOOT_DOORS_ID} {`]) expect(css, sel).toContain(sel);
    expect(css).toContain('background: #1B2742');
    expect(css).toContain('stroke: #3D5283; stroke-width: 4.2; stroke-linecap: round;');
    expect(css).toContain('stroke-dasharray: 0.1 11.7');
    expect(css).toContain('--r: max(28px, calc(38 * var(--u)))');
  });

  it('stand alone: every custom property they read is set by them, by the flakes\' own style, or has a fallback', () => {
    const own = new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
    for (const k of Object.keys(FLAKES[0])) if (k.startsWith('--')) own.add(k);
    for (const m of css.matchAll(/var\((--[\w-]+)(,)?/g)) expect(own.has(m[1]) || !!m[2], `${m[1]} is not set for the page's screen`).toBe(true);
    expect(css).not.toMatch(/var\(--(skin|kit|hm)-/);
    expect(css).not.toMatch(/url\(/);
  });

  it('draw the screen at p = 0 and nothing else: no phase, and only the snow moves', () => {
    expect(css).not.toMatch(/data-phase/);
    expect(css).not.toMatch(/\.sk-doors-|\.sk-door[\s{-]|sk-load/);
    expect([...css.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1])).toEqual(['sk-yarn-flake']);
    expect(css).toContain('@media (prefers-reduced-motion: reduce) { .sk-yarn-snow { display: none; } }');
  });

  it('keep the page\'s screen just under the one BarnDoors draws', () => {
    expect(css).toMatch(/\.sk-doors \{[^}]*z-index: 90;/);
    expect(css).toMatch(/#boot-doors \{ z-index: 89; \}/);
  });

  it('are small: the page grows by at most 12 kB', () => {
    expect(withBootDoors(page).length - page.length).toBeLessThan(12 * 1024);
  });

  it('skin.css keeps no door or old loading-sign rule', () => {
    expect(skin).not.toMatch(/\.sk-doors-|\.sk-door\b|\.sk-door-|\.sk-load/);
  });
});

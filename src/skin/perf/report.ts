import { PAINTED_GAME_TITLE } from '../../config';
import { useMusic } from '../../audio/music';
import { audioContext } from '../../audio/sound';

/*
 * The device report (docs/visual-overhaul/17-performance-and-stability.md, change 8): a few plain lines about the device
 * and how the game ran on it, for a player to copy and paste to whoever asked ("like 10 fps, a ton of broken assets").
 * It is text on the player's own screen and clipboard and is never sent anywhere. It holds no name, account, room code
 * or word played: the address is cut at its path, and every error and file is cut at its "?".
 *
 * Everything here is read from counters the game keeps anyway: when each scene drew (a ring of its last 120 frame
 * gaps), the renderer's own draw and triangle counts, long tasks and files that failed as the browser reports them,
 * and the last five errors. Nothing is measured on purpose but the display's rate, once, when a card is opened.
 */

// ---------------------------------------------------------------------------------------------------------------------
// What a report holds, and how it is written out (pure: the unit test builds one by hand)
// ---------------------------------------------------------------------------------------------------------------------

export interface SceneReport {
  name: string;
  /** Frames a second: the middle one, and the slowest twentieth. Null before enough frames were seen. */
  fpsMedian: number | null;
  fpsWorst: number | null;
  /** The pixel ratio the scene draws at. */
  resolution: number;
  draws: number;
  triangles: number;
  /** The canvas in CSS pixels, and the window it sat in. */
  canvas: [number, number];
  window: [number, number];
}

export interface ReportData {
  game: string;
  version: string;
  /** The page's address up to its path: no query, so no room code. */
  url: string;
  /** Local date and time, "2026-11-16 19:42". */
  when: string;
  browser: string;
  screen: [number, number];
  pixelRatio: number;
  displayHz: number | null;
  cores: number | null;
  memoryGb: number | null;
  webgl2: boolean;
  renderer: string;
  maxTexture: number | null;
  reducedMotion: boolean;
  doorsOpenS: number | null;
  doorsGaveUp: boolean | null;
  longTasks: number;
  longestTaskMs: number;
  scenes: SceneReport[];
  contexts: { made: number; lost: number; restored: number };
  fonts: [name: string, loaded: boolean][];
  failedFiles: string[];
  music: boolean;
  audio: boolean;
  errors: string[];
  saved: [key: string, value: string][];
}

const yesNo = (v: boolean) => (v ? 'yes' : 'no');
/** 1 -> "1", 1.5 -> "1.5", 0.75 -> "0.75". */
const trim = (n: number, digits = 2) => String(Number(n.toFixed(digits)));
const triangles = (n: number) => (n >= 10_000 ? `${trim(n / 1e6)} M` : String(Math.round(n)));

/** The report as text: one fact group to a line, commas and semicolons between facts. */
export function formatReport(d: ReportData): string {
  const device = [
    d.browser,
    `screen ${d.screen[0]} x ${d.screen[1]} at ${trim(d.pixelRatio)}x`,
    d.displayHz ? `display ${d.displayHz} Hz` : 'display rate not measured',
    d.cores ? `${d.cores} cores` : null,
    d.memoryGb ? `${trim(d.memoryGb)} GB` : null,
  ].filter(Boolean).join('; ');
  const scenes = d.scenes.map((s) => {
    const speed = s.fpsMedian === null ? 'no frames yet' : `${Math.round(s.fpsMedian)} fps median, ${Math.round(s.fpsWorst ?? s.fpsMedian)} fps worst 5%`;
    return `${s.name}: ${speed}; resolution ${trim(s.resolution)}x; ${Math.round(s.draws)} draws; ${triangles(s.triangles)} triangles; canvas ${s.canvas[0]} x ${s.canvas[1]} in a ${s.window[0]} x ${s.window[1]} window`;
  });
  const lines = [
    `${d.game} ${d.version}, ${d.url}, ${d.when}`,
    `Browser: ${device}`,
    `WebGL2: ${yesNo(d.webgl2)}; renderer ${d.renderer || 'not told'}${d.maxTexture ? `; max texture ${d.maxTexture}` : ''}`,
    `Motion: reduced motion ${yesNo(d.reducedMotion)}`,
    `Load: ${d.doorsOpenS === null ? 'doors not open yet' : `doors open ${d.doorsOpenS.toFixed(1)} s`}${d.doorsGaveUp === null ? '' : `; doors gave up: ${yesNo(d.doorsGaveUp)}`}; long tasks ${d.longTasks}${d.longTasks ? `, longest ${Math.round(d.longestTaskMs)} ms` : ''}`,
    ...(scenes.length ? scenes : ['Scenes: none drawn']),
    `Contexts: made ${d.contexts.made}, lost ${d.contexts.lost}, restored ${d.contexts.restored}`,
    `Fonts: ${d.fonts.map(([name, ok]) => `${name} ${yesNo(ok)}`).join(', ')}`,
    `Files that failed: ${d.failedFiles.length ? d.failedFiles.join(', ') : 'none'}`,
    `Sound: music ${d.music ? 'on' : 'off'}, audio ${d.audio ? 'running' : 'not started'}`,
    d.errors.length ? `Last errors:\n${d.errors.map((e) => `  ${e}`).join('\n')}` : 'Last errors: none',
    `Saved: ${d.saved.length ? d.saved.map(([k, v]) => `${k} ${v}`).join('; ') : 'nothing'}`,
  ];
  return lines.join('\n');
}

/** "Chrome 142 on ChromeOS" from a user-agent string. */
export function browserOf(ua: string): string {
  const os = /CrOS/.test(ua) ? 'ChromeOS'
    : /iPhone|iPad|iPod/.test(ua) ? 'iOS'
    : /Android/.test(ua) ? 'Android'
    : /Windows/.test(ua) ? 'Windows'
    : /Mac OS X|Macintosh/.test(ua) ? 'macOS'
    : /Linux/.test(ua) ? 'Linux' : 'an unknown system';
  const pick = (re: RegExp) => re.exec(ua)?.[1] ?? null;
  const [name, version] = /Edg\//.test(ua) ? ['Edge', pick(/Edg\/(\d+)/)]
    : /OPR\//.test(ua) ? ['Opera', pick(/OPR\/(\d+)/)]
    : /SamsungBrowser\//.test(ua) ? ['Samsung Internet', pick(/SamsungBrowser\/(\d+)/)]
    : /Firefox\/|FxiOS\//.test(ua) ? ['Firefox', pick(/(?:Firefox|FxiOS)\/(\d+)/)]
    : /Chrome\/|CriOS\//.test(ua) ? ['Chrome', pick(/(?:Chrome|CriOS)\/(\d+)/)]
    : /Safari\//.test(ua) ? ['Safari', pick(/Version\/(\d+(?:\.\d+)?)/)]
    : ['An unknown browser', null];
  return `${name}${version ? ` ${version}` : ''} on ${os}`;
}

/** Text safe to show: every address cut at its "?" or "#" (a join link carries a room code), one line, not too long. */
export function scrub(text: string, max = 180): string {
  const one = text.replace(/\s+/g, ' ').trim().replace(/(\bhttps?:\/\/[^\s?#)'"]+)[?#][^\s)'"]*/g, '$1');
  return one.length > max ? `${one.slice(0, max - 3)}...` : one;
}

/** The middle frame rate and the slowest twentieth's, from gaps between frames in milliseconds. */
export function frameRates(gaps: readonly number[]): { median: number; worst: number } | null {
  if (gaps.length < 10) return null;
  const sorted = [...gaps].sort((a, b) => a - b);
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  return { median: 1000 / at(0.5), worst: 1000 / at(0.95) };
}

// ---------------------------------------------------------------------------------------------------------------------
// The counters
// ---------------------------------------------------------------------------------------------------------------------

/** The part of three's renderer the report reads. */
export interface GlLike {
  domElement: HTMLCanvasElement;
  info: { render: { frame: number; calls: number; triangles: number } };
  getPixelRatio(): number;
  getContext(): WebGLRenderingContext | WebGL2RenderingContext;
}

const RING = 120;
/** A gap longer than this is a pause (a hidden tab, the farm stopped behind the Trading Post), not a slow frame. */
const PAUSE_MS = 1000;
interface Scene { gl: GlLike | null; gaps: number[]; next: number; lastAt: number; lastFrame: number; draws: number; triangles: number; resolution: number; canvas: [number, number]; window: [number, number] }
const scenes = new Map<string, Scene>();
const contexts = { made: 0, lost: 0, restored: 0 };
const NAMES: Record<string, string> = { farm: 'Home', table: 'Table', ice: 'Practice', podium: 'Results', dream: 'Counting Sheep', bedroom: 'Bedroom', pen: 'Lobby', 'boards-sky': 'Leaderboards' };

let version = '';
/** The game's version, told once by the app (which already reads it for the title screen). */
export function setReportVersion(v: string): void { version = v; }

let graphics: { renderer: string; maxTexture: number | null; webgl2: boolean } | null = null;
function readGraphics(gl: WebGLRenderingContext | WebGL2RenderingContext): void {
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    graphics = {
      renderer: String((ext && gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) || gl.getParameter(gl.RENDERER) || ''),
      maxTexture: Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)) || null,
      webgl2: typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext,
    };
  } catch { /* a lost context answers nothing */ }
}
/** No scene ever got a context: ask for one, read it and give it straight back. */
function probeGraphics(): void {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (!gl) { graphics = { renderer: '', maxTexture: null, webgl2: false }; return; }
    readGraphics(gl);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  } catch { graphics = { renderer: '', maxTexture: null, webgl2: false }; }
}

let ticking = false;
/**
 * A scene's canvas has its renderer (AdaptiveCanvas calls this as each is made). From here on the report knows when it
 * draws and what a frame of it costs, and counts its context if the browser takes it away. `everyFrame` is the canvas
 * library's own after-frame hook: the report adds one callback to it, once, and no loop of its own.
 */
export function watchScene(memory: string | undefined, gl: GlLike, everyFrame: (fn: (now: number) => void) => unknown): void {
  const name = NAMES[memory ?? ''] ?? memory ?? 'Scene';
  contexts.made++;
  const was = scenes.get(name);
  scenes.set(name, { gl, gaps: was?.gaps ?? [], next: was?.next ?? 0, lastAt: 0, lastFrame: gl.info.render.frame, draws: was?.draws ?? 0, triangles: was?.triangles ?? 0, resolution: gl.getPixelRatio(), canvas: was?.canvas ?? [0, 0], window: was?.window ?? [0, 0] });
  if (!graphics?.renderer) readGraphics(gl.getContext());
  const canvas = gl.domElement;
  // Leaving a screen ends its context on purpose, after its canvas has left the page: only a canvas still on the page
  // has lost anything. preventDefault asks the browser to give the context back.
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); if (canvas.isConnected) contexts.lost++; });
  canvas.addEventListener('webglcontextrestored', () => { if (canvas.isConnected) contexts.restored++; });
  if (!ticking) { ticking = true; everyFrame(sceneTick); }
}

/** After every frame the canvases drew: note which scenes drew, how long since each last did, and what it took. */
export function sceneTick(now: number = performance.now()): void {
  for (const s of scenes.values()) {
    const gl = s.gl;
    if (!gl) continue;
    // A scene that has left the page keeps its numbers and lets go of its renderer.
    if (!gl.domElement.isConnected) { s.gl = null; continue; }
    // Read through `gl` each time: the renderer makes a new `info` when a lost context comes back.
    const render = gl.info.render;
    if (render.frame === s.lastFrame) continue;
    s.lastFrame = render.frame;
    const gap = now - s.lastAt;
    if (s.lastAt && gap > 0 && gap < PAUSE_MS) { s.gaps[s.next] = gap; s.next = (s.next + 1) % RING; }
    s.lastAt = now;
    s.draws = render.calls;
    s.triangles = render.triangles;
    const ratio = gl.getPixelRatio() || 1;
    s.resolution = ratio;
    s.canvas = [Math.round(gl.domElement.width / ratio), Math.round(gl.domElement.height / ratio)];
    s.window = [window.innerWidth, window.innerHeight];
  }
}

const MAX_ERRORS = 5;
const errors: string[] = [];
/** Every error a boundary or the page catches goes here: the report shows the last five. `where` says what caught it. */
export function noteError(error: unknown, where = ''): void {
  const e = error as { name?: unknown; message?: unknown } | null;
  const text = e && typeof e === 'object' && typeof e.message === 'string' ? `${typeof e.name === 'string' && e.name !== 'Error' ? `${e.name}: ` : ''}${e.message}` : String(error);
  const line = scrub(`${where ? `${where}: ` : ''}${text}`);
  if (errors[errors.length - 1] === line) return;
  errors.push(line);
  if (errors.length > MAX_ERRORS) errors.shift();
}

const MAX_FILES = 8;
const failedFiles: string[] = [];
function noteFailedFile(url: string): void {
  let path = url;
  try { path = new URL(url, location.href).pathname; } catch { /* keep it as given */ }
  path = scrub(path, 120);
  if (!path || failedFiles.includes(path) || failedFiles.length >= MAX_FILES) return;
  failedFiles.push(path);
}

const longTasks = { count: 0, longest: 0 };
let doors: { openS: number; gaveUp: boolean } | null = null;
/** The loading doors have started to open, for the first time: how long the load took, and whether a scene had drawn. */
export function noteDoorsOpen(): void {
  if (doors || typeof document === 'undefined') return;
  const canvases = [...document.querySelectorAll('canvas[data-engine^="three"]')];
  doors = { openS: performance.now() / 1000, gaveUp: !canvases.length || !canvases.every((c) => c.hasAttribute('data-drawn')) };
}

let started = false;
/** Start listening for errors, long tasks and failed files. Once; safe to call again. */
export function startReport(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  // In the capture phase a failed <script>, <link> or <img> is heard here too: it has no message, only its address.
  window.addEventListener('error', (e) => {
    const target = e.target as (Element & { src?: string; href?: string }) | Window | null;
    if (target && target !== window && 'tagName' in target) { const url = target.src || target.href; if (url) noteFailedFile(url); return; }
    noteError((e as ErrorEvent).error ?? (e as ErrorEvent).message, 'page');
  }, true);
  window.addEventListener('unhandledrejection', (e) => noteError(e.reason, 'promise'));
  const watch = (type: string, each: (entry: PerformanceEntry) => void) => {
    try {
      if (!PerformanceObserver.supportedEntryTypes?.includes(type)) return; // asking for one it lacks is a console warning
      new PerformanceObserver((list) => list.getEntries().forEach(each)).observe({ type, buffered: true });
    } catch { /* this browser does not report it */ }
  };
  watch('longtask', (t) => { longTasks.count++; longTasks.longest = Math.max(longTasks.longest, t.duration); });
  watch('resource', (r) => { if (((r as PerformanceResourceTiming).responseStatus ?? 0) >= 400) noteFailedFile(r.name); });
}

const RATES = [24, 30, 40, 48, 50, 60, 72, 75, 90, 100, 120, 144, 165, 240];
let displayHz: number | null = null;
let measuring = false;
/** Times forty bare frames and takes the quick end of them as the display's rate. Run when a card opens; kept after. */
export function measureDisplayHz(): void {
  if (displayHz || measuring || typeof requestAnimationFrame === 'undefined') return;
  measuring = true;
  const gaps: number[] = [];
  let last = 0;
  const frame = (now: number) => {
    if (last) gaps.push(now - last);
    last = now;
    if (gaps.length < 40) return void requestAnimationFrame(frame);
    measuring = false;
    const quick = gaps.sort((a, b) => a - b)[Math.floor(gaps.length / 4)];
    if (quick > 0) { const hz = 1000 / quick; displayHz = RATES.reduce((best, r) => (Math.abs(r - hz) < Math.abs(best - hz) ? r : best), RATES[0]); }
  };
  requestAnimationFrame(frame);
}

const FONTS = ['Fraunces', 'Patrick Hand', 'Nunito'];
function fontLoaded(name: string): boolean {
  try {
    for (const face of document.fonts) if (face.family.replace(/["']/g, '') === name && face.status === 'loaded') return true;
  } catch { /* no font list */ }
  return false;
}

/** The device caches the report may show: how sharp each scene settled. Never player data. */
function savedCaches(): [string, string][] {
  const out: [string, string][] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith('sap:dpr:')) continue;
      let value = localStorage.getItem(key) ?? '';
      try { const v = JSON.parse(value) as { dpr?: unknown } | null; if (typeof v?.dpr === 'number') value = trim(v.dpr); } catch { /* shown as kept */ }
      out.push([key, scrub(value, 24)]);
    }
  } catch { /* storage blocked */ }
  return out.sort(([a], [b]) => a.localeCompare(b));
}

const two = (n: number) => String(n).padStart(2, '0');

/** Reads the device and the counters now. Browser only. */
export function collectReport(): ReportData {
  if (!graphics) probeGraphics();
  const now = new Date();
  const nav = navigator as Navigator & { deviceMemory?: number };
  let reduced = false;
  try { reduced = document.documentElement.classList.contains('reduce-motion') || window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* no media queries */ }
  let music = false;
  try { music = useMusic.getState().on; } catch { /* no store */ }
  return {
    game: PAINTED_GAME_TITLE,
    version,
    url: `${location.origin}${location.pathname}`,
    when: `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())} ${two(now.getHours())}:${two(now.getMinutes())}`,
    browser: browserOf(nav.userAgent),
    screen: [window.screen.width, window.screen.height],
    pixelRatio: window.devicePixelRatio || 1,
    displayHz,
    cores: nav.hardwareConcurrency || null,
    memoryGb: nav.deviceMemory || null,
    webgl2: graphics?.webgl2 ?? false,
    renderer: scrub(graphics?.renderer ?? '', 120),
    maxTexture: graphics?.maxTexture ?? null,
    reducedMotion: reduced,
    doorsOpenS: doors?.openS ?? null,
    doorsGaveUp: doors?.gaveUp ?? null,
    longTasks: longTasks.count,
    longestTaskMs: longTasks.longest,
    scenes: [...scenes].map(([name, s]) => {
      const rates = frameRates(s.gaps);
      return { name, fpsMedian: rates?.median ?? null, fpsWorst: rates?.worst ?? null, resolution: s.resolution, draws: s.draws, triangles: s.triangles, canvas: s.canvas, window: s.window };
    }),
    contexts: { ...contexts },
    fonts: FONTS.map((name) => [name, fontLoaded(name)]),
    failedFiles: [...failedFiles],
    music,
    audio: audioContext() !== null,
    errors: [...errors],
    saved: savedCaches(),
  };
}

/** The report as text, now. */
export function deviceReport(): string {
  return formatReport(collectReport());
}

/** Copies the report. Where the clipboard is refused, a prompt holds the text to copy by hand, as the share buttons do. */
export async function copyDeviceReport(): Promise<boolean> {
  const text = deviceReport();
  try { await navigator.clipboard.writeText(text); return true; } catch { window.prompt('Copy the device report:', text); return false; }
}

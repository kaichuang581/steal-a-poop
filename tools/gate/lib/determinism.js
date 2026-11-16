// Runs in the page before any of the game's own code (painted.mjs adds it with addInitScript, ahead of the pinned
// clock). It takes the dice out of the page: Math.random, crypto.getRandomValues and crypto.randomUUID are replaced by
// mulberry32 streams made from one seed, so two loads with the same seed roll the same numbers in the same order.
//
// Plain browser JavaScript, no imports: the page's policy lets an init script run, nothing else. The seed arrives as
// window.__GATE_SEED (painted.mjs writes that line in front of this file); without it the plan's own seed is used.
//
// What it leaves on the page, as window.__gate:
//   seed            the seed in use
//   reseed(n)       start every stream again from n (or from the seed). The helper calls it straight before a click
//                   that deals a game, because how many numbers the page has rolled by then depends on how many
//                   frames it has drawn, and that is not the same from one load to the next.
//   drawn           how many numbers each stream has given out so far: { random, crypto, uuid }
//   real            the browser's own functions, kept from before the pinned clock took them: raf, now, setTimeout
//   noDraw(on)      stop (or start again) WebGL from putting triangles on the screen. three.js still walks the scene,
//                   uploads and compiles, so the game runs on exactly as before, but a frame under software rendering
//                   costs a millisecond instead of a second. The helper steps the clock with drawing off and draws
//                   only the last frames before a shot; that picture is the same, pixel for pixel, as one where every
//                   frame was drawn (measured: README.md, "Drawing").
//   drawing         whether WebGL is drawing now
//   skipped         draw calls left out while noDraw was on
//   stale           true when a draw has been skipped since the last real one: the canvas shows an older moment
(() => {
  if (window.__gate) return;
  const seed = Number.isFinite(window.__GATE_SEED) ? window.__GATE_SEED >>> 0 : 20261116;

  // mulberry32: a small, well-known 32-bit generator. The same seed gives the same list of numbers on every machine.
  const mulberry32 = (a) => () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // Two streams: one for Math.random, one for crypto. Snow and sparks call Math.random every frame, and the things that
  // must not move (a sack's roll, an id) read crypto, so a frame more or less never shifts those.
  const CRYPTO_SALT = 0x9E3779B9;
  let random = mulberry32(seed);
  let secure = mulberry32((seed ^ CRYPTO_SALT) >>> 0);
  const drawn = { random: 0, crypto: 0, uuid: 0 };

  const real = {
    raf: window.requestAnimationFrame.bind(window),
    now: performance.now.bind(performance),
    setTimeout: window.setTimeout.bind(window),
  };

  Math.random = () => { drawn.random++; return random(); };

  const byte = () => { drawn.crypto++; return Math.floor(secure() * 256); };
  const fill = (view) => {
    // Any integer typed array: fill its bytes, whatever the element size.
    const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
    for (let i = 0; i < bytes.length; i++) bytes[i] = byte();
    return view;
  };
  const cryptoObj = window.crypto;
  if (cryptoObj) {
    const patch = (name, value) => {
      try { Object.defineProperty(cryptoObj, name, { value, configurable: true, writable: true }); } catch { /* a browser that will not let go of it */ }
    };
    patch('getRandomValues', (view) => fill(view));
    patch('randomUUID', () => {
      drawn.uuid++;
      const b = fill(new Uint8Array(16));
      b[6] = (b[6] & 0x0f) | 0x40; // version 4
      b[8] = (b[8] & 0x3f) | 0x80; // the standard variant
      const hex = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    });
  }

  // noDraw: the calls that put pixels down are skipped while it is on. Everything else (state, buffers, shaders,
  // framebuffer binds) still happens, so nothing is different when drawing is switched back on. `stale` says the
  // picture on screen is older than the page: a draw was skipped since the last one that was really made.
  let noDraw = false;
  let skipped = 0;
  let stale = false;
  const DRAW_CALLS = ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced', 'drawRangeElements', 'clear', 'blitFramebuffer'];
  for (const proto of [window.WebGL2RenderingContext?.prototype, window.WebGLRenderingContext?.prototype]) {
    if (!proto) continue;
    for (const name of DRAW_CALLS) {
      const own = proto[name];
      if (typeof own !== 'function') continue;
      proto[name] = function (...args) {
        if (noDraw) { skipped++; stale = true; return undefined; }
        stale = false;
        return own.apply(this, args);
      };
    }
  }

  window.__gate = {
    seed,
    drawn,
    real,
    reseed(n) {
      const s = Number.isFinite(n) ? n >>> 0 : seed;
      random = mulberry32(s);
      secure = mulberry32((s ^ CRYPTO_SALT) >>> 0);
    },
    noDraw(on) { noDraw = !!on; return noDraw; },
    get drawing() { return !noDraw; },
    get skipped() { return skipped; },
    get stale() { return stale; },
  };
})();

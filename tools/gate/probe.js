// The count gate's probe (plan file 17, section 4, change 1). A Playwright init script: it runs in the page before any
// of the game's own code and counts what the game asks the graphics chip, React, the sound system and storage to do.
// It changes nothing the game can see, except where it is told to: count-only mode, a faked display rate, a faked
// hidden tab. tools/gate/counts.mjs is the tool that reads it; the numbers it hands in are that file's business.
//
// Plain browser JavaScript, no imports. With the gate's helper it is passed as `init`, so it runs after
// tools/gate/lib/determinism.js: its wrappers sit on each context itself, outside that file's wrappers on the
// prototype, and so see every call, the ones the helper skips included. It also works alone, on a page with no helper.
//
// What it wraps:
//   HTMLCanvasElement.prototype.getContext (and OffscreenCanvas's): every WebGL context made is counted; a WebGL2 one
//     gets wrappers of its own on the draw calls (drawArrays, drawElements, their instanced and range forms, and the
//     multi-draw extension's), clear, blitFramebuffer, bindFramebuffer, the calls that give a texture or a renderbuffer
//     its size (texStorage2D, texStorage3D, texImage2D with no picture, renderbufferStorage, renderbufferStorageMultisample),
//     the calls that hang those on a framebuffer, bufferData, createProgram, and the matching delete calls.
//   requestAnimationFrame: each tick of the display starts a new frame in the record. Draws and triangles are kept per
//     frame, per context and per framebuffer, so every pass is seen by itself: the shadow map, the multisampled target,
//     each step of the bloom chain, the canvas.
//   __REACT_DEVTOOLS_GLOBAL_HOOK__: a stub in the place React looks for its developer tools, so each renderer (react-dom,
//     and the 3D scene's own) reports every commit. It is left alone when something real is already there.
//   BaseAudioContext.prototype.createOscillator, Storage.prototype.getItem (localStorage only), a long-task observer,
//     and the window's error and unhandledrejection events.
//
// What it leaves on the page:
//   window.__GATE_NODRAW = true     count-only mode: draw, clear and blit calls are counted and not carried out. three.js
//                                   still culls, uploads and compiles, so the counts are the real ones and a frame under
//                                   software rendering costs milliseconds. (The helper has its own switch for the same
//                                   thing, __gate.noDraw; either one works, and the probe counts through both.)
//   window.__gate.setRafHz(hz)      fakes the display's rate: 144, 30, any positive number; 0 stops frames altogether, as
//                                   a hidden tab does; null gives the page's own rate back. Frames then come from the
//                                   page's timers (the pinned clock's, when one is installed), at exact multiples of
//                                   1000 / hz ms, so a second of the page's clock holds exactly hz frames.
//   window.__gate.hide(on)          fakes a hidden tab: document.hidden and visibilityState say so, visibilitychange is
//                                   sent, and no frame comes until it is shown again.
//   window.__probe                  the record: frameNo(), frames(from, brief), contexts(), boxes(), totals(), snapshot(from).
(() => {
  if (window.__probe) return;
  const gate = (window.__gate = window.__gate || {});

  // -------------------------------------------------------------------------------------------------------------------
  // Frames
  // -------------------------------------------------------------------------------------------------------------------

  /** How many frames are kept. A whole game played out by the helper is about 1,500 of its hops. */
  const FRAME_CAP = 8192;
  const frames = [];
  let frameNo = 0;
  let rafHz = null; // null: the page's own rate
  let hidden = false;
  const totals = { commits: {}, storageReads: 0, oscillators: 0, longTasks: 0, longTaskMs: 0, longestTaskMs: 0, contextsMade: 0, otherWebgl: 0 };
  const errors = [];
  const drawingNow = () => window.__GATE_NODRAW !== true && gate.drawing !== false;

  // Frame 0 is everything before the first tick of the display.
  let cur = { n: 0, t: 0, hz: null, ctx: {}, commits: {}, reads: 0 };
  frames.push(cur);
  function tick(t) {
    if (cur.n > 0 && cur.t === t) return; // a second callback of the same tick
    cur = { n: ++frameNo, t, hz: rafHz, ctx: {}, commits: {}, reads: 0 };
    frames.push(cur);
    if (frames.length > FRAME_CAP) frames.shift();
  }

  // -------------------------------------------------------------------------------------------------------------------
  // The display's ticks: requestAnimationFrame, and the faked rates
  // -------------------------------------------------------------------------------------------------------------------

  // The pinned clock puts its own requestAnimationFrame over the browser's after this script has run, by plain
  // assignment. So the name is made a property that hands out a wrapper of whatever was last put there. A wrapper only
  // marks frames while it is the one in place: whoever kept the browser's own function from before (Playwright does, for
  // its own waiting) goes on getting the browser's own frames, and none of those are counted as the page's.
  const queued = new Map(); // callbacks waiting for a faked tick, by id
  let ownId = 5e12;
  let ownTimer = null;
  let current = null;
  let currentCancel = null;

  const fire = () => {
    ownTimer = null;
    const t = performance.now();
    const batch = [...queued.values()];
    queued.clear();
    tick(t);
    let first = null;
    for (const cb of batch) { try { cb(t); } catch (e) { first = first ?? { e }; } }
    plan();
    if (first) throw first.e;
  };
  /** Sets the one timer that brings the next faked tick, when callbacks are waiting and frames are not stopped. */
  function plan() {
    if (ownTimer !== null || !rafHz || !queued.size) return;
    const period = 1000 / rafHz, now = performance.now();
    const due = (Math.floor(now / period + 1e-9) + 1) * period;
    ownTimer = window.setTimeout(fire, Math.max(0, due - now));
  }
  function makeRaf(inner) {
    const w = function requestAnimationFrame(cb) {
      if (w !== current) return inner.call(window, cb);
      if (rafHz === null) return inner.call(window, (t) => { if (w === current) tick(t); return cb(t); });
      const id = ++ownId;
      queued.set(id, cb);
      plan();
      return id;
    };
    return w;
  }
  function makeCancel(inner) {
    return function cancelAnimationFrame(id) {
      if (queued.delete(id)) return undefined;
      return inner.call(window, id);
    };
  }
  try {
    current = makeRaf(window.requestAnimationFrame);
    currentCancel = makeCancel(window.cancelAnimationFrame);
    Object.defineProperty(window, 'requestAnimationFrame', { configurable: true, enumerable: true, get: () => current, set: (fn) => { current = typeof fn === 'function' ? makeRaf(fn) : fn; } });
    Object.defineProperty(window, 'cancelAnimationFrame', { configurable: true, enumerable: true, get: () => currentCancel, set: (fn) => { currentCancel = typeof fn === 'function' ? makeCancel(fn) : fn; } });
  } catch { /* a page that will not let go of them: frames are then not told apart */ }

  gate.setRafHz = (hz) => {
    const next = hz === null || hz === undefined ? null : Number(hz);
    if (next !== null && !(next >= 0)) throw new Error(`setRafHz takes a rate in Hz, 0 or null, not ${hz}`);
    rafHz = next;
    if (ownTimer !== null) { window.clearTimeout(ownTimer); ownTimer = null; }
    if (rafHz === null) {
      // Back to the page's own rate: what was waiting for a faked tick waits for a real one.
      const waiting = [...queued.values()];
      queued.clear();
      for (const cb of waiting) window.requestAnimationFrame(cb);
    } else plan();
    return rafHz;
  };
  Object.defineProperty(gate, 'rafHz', { configurable: true, get: () => rafHz });

  let rateBeforeHiding = null;
  gate.hide = (on) => {
    const want = !!on;
    if (want === hidden) return hidden;
    hidden = want;
    try {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (hidden ? 'hidden' : 'visible') });
    } catch { /* a document that will not be told */ }
    if (hidden) { rateBeforeHiding = rafHz; gate.setRafHz(0); } else gate.setRafHz(rateBeforeHiding);
    document.dispatchEvent(new Event('visibilitychange'));
    return hidden;
  };
  Object.defineProperty(gate, 'hidden', { configurable: true, get: () => hidden });

  // -------------------------------------------------------------------------------------------------------------------
  // WebGL
  // -------------------------------------------------------------------------------------------------------------------

  const GL = {
    FRAMEBUFFER: 0x8D40, DRAW_FRAMEBUFFER: 0x8CA9, READ_FRAMEBUFFER: 0x8CA8,
    TEXTURE_2D: 0x0DE1, TEXTURE_BINDING_2D: 0x8069, TEXTURE_BINDING_CUBE_MAP: 0x8514, TEXTURE_3D: 0x806F, TEXTURE_BINDING_3D: 0x806A,
    TEXTURE_2D_ARRAY: 0x8C1A, TEXTURE_BINDING_2D_ARRAY: 0x8C1D, RENDERBUFFER_BINDING: 0x8CA7,
    ARRAY_BUFFER: 0x8892, ELEMENT_ARRAY_BUFFER: 0x8893, COLOR_ATTACHMENT0: 0x8CE0,
  };
  /** Which binding to ask for the buffer a target names. */
  const BUFFER_BINDING = { 0x8892: 0x8894, 0x8893: 0x8895, 0x8F36: 0x8F36, 0x8F37: 0x8F37, 0x88EB: 0x88ED, 0x88EC: 0x88EF, 0x8C8E: 0x8C8F, 0x8A11: 0x8A28 };
  /** A format's name and its bytes a pixel, for the formats a render target or a texture of this game can have. */
  const FORMAT = {
    0x8058: ['RGBA8', 4], 0x8C43: ['SRGB8_ALPHA8', 4], 0x8051: ['RGB8', 3], 0x8C41: ['SRGB8', 3], 0x881A: ['RGBA16F', 8], 0x881B: ['RGB16F', 6],
    0x8814: ['RGBA32F', 16], 0x8C3A: ['R11F_G11F_B10F', 4], 0x8229: ['R8', 1], 0x822B: ['RG8', 2], 0x822D: ['R16F', 2], 0x822F: ['RG16F', 4],
    0x822E: ['R32F', 4], 0x8230: ['RG32F', 8], 0x81A5: ['DEPTH_COMPONENT16', 2], 0x81A6: ['DEPTH_COMPONENT24', 4], 0x8CAC: ['DEPTH_COMPONENT32F', 4],
    0x88F0: ['DEPTH24_STENCIL8', 4], 0x8CAD: ['DEPTH32F_STENCIL8', 8], 0x1908: ['RGBA', 4], 0x1907: ['RGB', 3], 0x1902: ['DEPTH_COMPONENT', 4],
    0x84F9: ['DEPTH_STENCIL', 4], 0x8056: ['RGBA4', 2], 0x8D62: ['RGB565', 2], 0x8057: ['RGB5_A1', 2], 0x8059: ['RGB10_A2', 4], 0x1909: ['LUMINANCE', 1],
    0x8D48: ['STENCIL_INDEX8', 1],
  };
  const formatName = (f) => FORMAT[f]?.[0] ?? `0x${Number(f).toString(16)}`;
  const formatBytes = (f) => FORMAT[f]?.[1] ?? 4;
  /** The bytes of a texture with every level of its chain. */
  const chainBytes = (w, h, levels, bpp, layers = 1) => {
    let sum = 0;
    for (let i = 0; i < Math.max(1, levels); i++) sum += Math.max(1, w >> i) * Math.max(1, h >> i) * bpp * layers;
    return sum;
  };

  const contexts = [];
  const known = new WeakMap(); // context -> its record
  const slot = (rec) => (cur.ctx[rec.id] ??= { draws: 0, real: 0, triangles: 0, points: 0, lines: 0, clears: 0, blits: 0, fb: {} });
  const pass = (f, fb) => (f.fb[fb] ??= { draws: 0, triangles: 0, clears: 0 });

  function instrument(gl, canvas) {
    const rec = {
      id: contexts.length + 1, kind: 'webgl2', canvas, madeAtFrame: cur.n, madeAt: cur.t, lost: 0, restored: 0, released: false,
      programsMade: 0, programsDeleted: 0, buffers: new Map(), textures: new Map(), renderbuffers: new Map(),
      fbIds: new WeakMap(), fbCount: 0, fbs: new Map(), drawFb: 0, readFb: 0,
      total: { draws: 0, triangles: 0, clears: 0, blits: 0, multiDraws: 0 },
    };
    contexts.push(rec);
    known.set(gl, rec);
    const wrap = (name, make) => {
      const inner = gl[name];
      if (typeof inner !== 'function') return;
      try { gl[name] = make(inner); } catch { /* a context that will not take it */ }
    };
    const fbId = (fb) => {
      if (!fb) return 0;
      let id = rec.fbIds.get(fb);
      if (!id) { id = ++rec.fbCount; rec.fbIds.set(fb, id); rec.fbs.set(id, { att: {} }); }
      return id;
    };
    const fbOf = (target) => (target === GL.READ_FRAMEBUFFER ? rec.readFb : rec.drawFb);

    // What one draw call puts down: triangles for the triangle modes, points and line segments for the others.
    const tally = (mode, count, instances) => {
      const f = slot(rec), p = pass(f, rec.drawFb);
      let tris = 0;
      if (mode === 4) tris = Math.floor(count / 3) * instances;
      else if (mode === 5 || mode === 6) tris = Math.max(0, count - 2) * instances;
      else if (mode === 0) f.points += count * instances;
      else f.lines += (mode === 1 ? Math.floor(count / 2) : mode === 3 ? Math.max(0, count - 1) : count) * instances;
      f.draws++; p.draws++; f.triangles += tris; p.triangles += tris;
      rec.total.draws++; rec.total.triangles += tris;
      if (drawingNow()) f.real++;
    };
    const draw = (name, read) => wrap(name, (inner) => function (...a) {
      const [mode, count, instances] = read(a);
      tally(mode, count, instances);
      if (window.__GATE_NODRAW === true) return undefined;
      return inner.apply(this, a);
    });
    draw('drawArrays', (a) => [a[0], a[2], 1]);
    draw('drawElements', (a) => [a[0], a[1], 1]);
    draw('drawArraysInstanced', (a) => [a[0], a[2], a[3]]);
    draw('drawElementsInstanced', (a) => [a[0], a[1], a[4]]);
    draw('drawRangeElements', (a) => [a[0], a[3], 1]);
    wrap('clear', (inner) => function (...a) {
      const f = slot(rec);
      f.clears++; pass(f, rec.drawFb).clears++; rec.total.clears++;
      if (window.__GATE_NODRAW === true) return undefined;
      return inner.apply(this, a);
    });
    wrap('blitFramebuffer', (inner) => function (...a) {
      slot(rec).blits++; rec.total.blits++;
      if (window.__GATE_NODRAW === true) return undefined;
      return inner.apply(this, a);
    });
    wrap('bindFramebuffer', (inner) => function (target, fb) {
      const id = fbId(fb);
      if (target === GL.FRAMEBUFFER) { rec.drawFb = id; rec.readFb = id; } else if (target === GL.DRAW_FRAMEBUFFER) rec.drawFb = id; else if (target === GL.READ_FRAMEBUFFER) rec.readFb = id;
      return inner.call(this, target, fb);
    });
    wrap('deleteFramebuffer', (inner) => function (fb) {
      const id = fb ? rec.fbIds.get(fb) : 0;
      if (id) { rec.fbs.delete(id); if (rec.drawFb === id) rec.drawFb = 0; if (rec.readFb === id) rec.readFb = 0; }
      return inner.call(this, fb);
    });

    // Sizes: a texture or a renderbuffer is given its size once; what hangs on a framebuffer says what a pass draws into.
    const boundTexture = (target) => {
      const binding = target === GL.TEXTURE_2D ? GL.TEXTURE_BINDING_2D : target === GL.TEXTURE_3D ? GL.TEXTURE_BINDING_3D : target === GL.TEXTURE_2D_ARRAY ? GL.TEXTURE_BINDING_2D_ARRAY : GL.TEXTURE_BINDING_CUBE_MAP;
      try { return gl.getParameter(binding); } catch { return null; }
    };
    const sized = (target, levels, format, w, h, layers) => {
      const tex = boundTexture(target);
      if (!tex) return;
      const faces = target === GL.TEXTURE_2D || target === GL.TEXTURE_3D || target === GL.TEXTURE_2D_ARRAY ? 1 : 6;
      rec.textures.set(tex, { w, h, format, levels, bytes: chainBytes(w, h, levels, formatBytes(format), layers * faces) });
    };
    wrap('texStorage2D', (inner) => function (target, levels, format, w, h) { sized(target, levels, format, w, h, 1); return inner.call(this, target, levels, format, w, h); });
    wrap('texStorage3D', (inner) => function (target, levels, format, w, h, d) { sized(target, levels, format, w, h, d); return inner.call(this, target, levels, format, w, h, d); });
    wrap('texImage2D', (inner) => function (...a) {
      // The nine-argument form with no picture is how three.js gives a render target's texture its size.
      if (a.length >= 9 && a[1] === 0 && a[8] === null && a[0] === GL.TEXTURE_2D) sized(a[0], 1, a[2], a[3], a[4], 1);
      return inner.apply(this, a);
    });
    wrap('deleteTexture', (inner) => function (tex) { rec.textures.delete(tex); return inner.call(this, tex); });
    const storage = (samples, format, w, h) => {
      let rb = null;
      try { rb = gl.getParameter(GL.RENDERBUFFER_BINDING); } catch { /* lost */ }
      if (rb) rec.renderbuffers.set(rb, { w, h, format, samples, bytes: w * h * formatBytes(format) * Math.max(1, samples) });
    };
    wrap('renderbufferStorage', (inner) => function (target, format, w, h) { storage(0, format, w, h); return inner.call(this, target, format, w, h); });
    wrap('renderbufferStorageMultisample', (inner) => function (target, samples, format, w, h) { storage(samples, format, w, h); return inner.call(this, target, samples, format, w, h); });
    wrap('deleteRenderbuffer', (inner) => function (rb) { rec.renderbuffers.delete(rb); return inner.call(this, rb); });
    const hang = (target, attachment, kind, what) => {
      const info = rec.fbs.get(fbOf(target));
      if (!info) return;
      if (what) info.att[attachment] = { kind, what }; else delete info.att[attachment];
    };
    wrap('framebufferTexture2D', (inner) => function (target, attachment, textarget, tex, level) { hang(target, attachment, 'texture', tex); return inner.call(this, target, attachment, textarget, tex, level); });
    wrap('framebufferTextureLayer', (inner) => function (target, attachment, tex, level, layer) { hang(target, attachment, 'texture', tex); return inner.call(this, target, attachment, tex, level, layer); });
    wrap('framebufferRenderbuffer', (inner) => function (target, attachment, rbtarget, rb) { hang(target, attachment, 'renderbuffer', rb); return inner.call(this, target, attachment, rbtarget, rb); });

    // Buffers: the bytes each one holds now. bufferData replaces a buffer whole; deleteBuffer lets it go.
    wrap('bufferData', (inner) => function (...a) {
      const [target, what] = a;
      let bytes = 0;
      if (typeof what === 'number') bytes = what;
      else if (what) bytes = a.length >= 5 && a[4] ? a[4] * (what.BYTES_PER_ELEMENT ?? 1) : a.length >= 4 && a[3] ? Math.max(0, what.byteLength - a[3] * (what.BYTES_PER_ELEMENT ?? 1)) : what.byteLength ?? 0;
      let buffer = null;
      try { buffer = gl.getParameter(BUFFER_BINDING[target] ?? 0x8894); } catch { /* lost */ }
      if (buffer) rec.buffers.set(buffer, { bytes, target });
      return inner.apply(this, a);
    });
    wrap('deleteBuffer', (inner) => function (buffer) { rec.buffers.delete(buffer); return inner.call(this, buffer); });
    wrap('createProgram', (inner) => function () { rec.programsMade++; return inner.call(this); });
    wrap('deleteProgram', (inner) => function (program) { if (program) rec.programsDeleted++; return inner.call(this, program); });

    // Extensions: the one that draws many things in a call, and the one a page uses to let its own context go.
    wrap('getExtension', (inner) => function (name) {
      const ext = inner.call(this, name);
      if (!ext || ext.__probed) return ext;
      const lower = String(name).toLowerCase();
      try {
        if (lower === 'webgl_multi_draw') {
          const many = (method, countsAt, drawCountAt, instancesAt) => {
            const own = ext[method];
            if (typeof own !== 'function') return;
            ext[method] = function (...a) {
              const offset = a[countsAt + 1] ?? 0, n = a[drawCountAt] ?? 0;
              for (let i = 0; i < n; i++) tally(a[0], a[countsAt][offset + i] ?? 0, instancesAt === null ? 1 : a[instancesAt][(a[instancesAt + 1] ?? 0) + i] ?? 1);
              rec.total.multiDraws++;
              if (window.__GATE_NODRAW === true) return undefined;
              return own.apply(this, a);
            };
          };
          many('multiDrawArraysWEBGL', 3, 5, null);
          many('multiDrawElementsWEBGL', 1, 6, null);
          many('multiDrawArraysInstancedWEBGL', 3, 7, 5);
          many('multiDrawElementsInstancedWEBGL', 1, 8, 6);
          ext.__probed = true;
        } else if (lower === 'webgl_lose_context') {
          const own = ext.loseContext;
          ext.loseContext = function () { rec.released = true; return own.call(this); };
          ext.__probed = true;
        }
      } catch { /* an extension object that will not take a wrapper */ }
      return ext;
    });

    try {
      canvas.addEventListener?.('webglcontextlost', () => { rec.lost++; });
      canvas.addEventListener?.('webglcontextrestored', () => { rec.restored++; rec.released = false; });
    } catch { /* no events on this canvas */ }
    return rec;
  }

  for (const proto of [window.HTMLCanvasElement?.prototype, window.OffscreenCanvas?.prototype]) {
    if (!proto || typeof proto.getContext !== 'function') continue;
    const own = proto.getContext;
    proto.getContext = function (type, ...rest) {
      const gl = own.call(this, type, ...rest);
      try {
        if (gl && !known.has(gl)) {
          if (type === 'webgl2') { totals.contextsMade++; instrument(gl, this); }
          else if (type === 'webgl' || type === 'experimental-webgl') { totals.contextsMade++; totals.otherWebgl++; known.set(gl, null); }
        }
      } catch (e) { errors.push({ kind: 'probe', text: String(e?.message ?? e) }); }
      return gl;
    };
  }

  // -------------------------------------------------------------------------------------------------------------------
  // React, sound, storage, long tasks, errors
  // -------------------------------------------------------------------------------------------------------------------

  const rendererNames = {};
  const commit = (id) => {
    const name = rendererNames[id] ?? `renderer ${id}`;
    cur.commits[name] = (cur.commits[name] ?? 0) + 1;
    totals.commits[name] = (totals.commits[name] ?? 0) + 1;
  };
  try {
    const there = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (!there) {
      let nextRenderer = 0;
      const renderers = new Map();
      Object.defineProperty(window, '__REACT_DEVTOOLS_GLOBAL_HOOK__', {
        configurable: true, enumerable: false, writable: true,
        value: {
          supportsFiber: true, isDisabled: false, renderers,
          inject(internals) { const id = ++nextRenderer; renderers.set(id, internals); rendererNames[id] = String(internals?.rendererPackageName ?? `renderer ${id}`); return id; },
          onCommitFiberRoot(id) { commit(id); },
          onPostCommitFiberRoot() {}, onCommitFiberUnmount() {}, onScheduleFiberRoot() {}, checkDCE() {},
        },
      });
    } else if (typeof there.onCommitFiberRoot === 'function') {
      const own = there.onCommitFiberRoot;
      there.onCommitFiberRoot = function (id, ...rest) { commit(id); return own.call(this, id, ...rest); };
      for (const [id, internals] of there.renderers ?? []) rendererNames[id] = String(internals?.rendererPackageName ?? `renderer ${id}`);
    }
  } catch { /* React is then not counted */ }

  try {
    const proto = (window.BaseAudioContext ?? window.AudioContext ?? window.webkitAudioContext)?.prototype;
    const own = proto?.createOscillator;
    if (typeof own === 'function') proto.createOscillator = function (...a) { totals.oscillators++; return own.apply(this, a); };
  } catch { /* no sound system */ }

  try {
    const store = window.localStorage;
    const own = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key) {
      if (this === store) { totals.storageReads++; cur.reads++; }
      return own.call(this, key);
    };
  } catch { /* a page with no storage of its own */ }

  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) { totals.longTasks++; totals.longTaskMs += e.duration; totals.longestTaskMs = Math.max(totals.longestTaskMs, e.duration); }
    }).observe({ type: 'longtask', buffered: true });
  } catch { /* a browser without long tasks */ }

  const note = (kind, text) => { if (errors.length < 50) errors.push({ kind, text: String(text ?? '').slice(0, 500) }); };
  window.addEventListener('error', (e) => {
    if (e instanceof ErrorEvent) note('error', e.message);
    else note('resource', `${e.target?.tagName ?? 'something'} ${e.target?.src ?? e.target?.href ?? ''} did not load`);
  }, true);
  window.addEventListener('unhandledrejection', (e) => note('unhandledrejection', e.reason?.message ?? e.reason));

  // -------------------------------------------------------------------------------------------------------------------
  // Reading the record
  // -------------------------------------------------------------------------------------------------------------------

  const round = (n) => Math.round(n * 1000) / 1000;
  const sizeOf = (rec, a) => {
    if (!a) return null;
    const info = a.kind === 'texture' ? rec.textures.get(a.what) : rec.renderbuffers.get(a.what);
    return info ? { kind: a.kind, w: info.w, h: info.h, format: formatName(info.format), samples: info.samples ?? 0 } : { kind: a.kind, w: 0, h: 0, format: 'unknown', samples: 0 };
  };
  /** What a framebuffer draws into, in a few words: its size, its colour format, its depth format, its samples. */
  function passOf(rec, id) {
    if (id === 0) return { w: rec.canvas.width, h: rec.canvas.height, color: 'canvas', depth: '', samples: 0 };
    const info = rec.fbs.get(id);
    if (!info) return { w: 0, h: 0, color: 'deleted', depth: '', samples: 0 };
    const color = sizeOf(rec, info.att[GL.COLOR_ATTACHMENT0]);
    const depth = sizeOf(rec, info.att[0x8D00] ?? info.att[0x821A]);
    const main = color ?? depth;
    return { w: main?.w ?? 0, h: main?.h ?? 0, color: color?.format ?? '', depth: depth?.format ?? '', samples: Math.max(color?.samples ?? 0, depth?.samples ?? 0) };
  }
  const sum = (map) => { let n = 0; for (const v of map.values()) n += v.bytes; return n; };

  window.__probe = {
    version: 1,
    frameNo: () => frameNo,
    /**
     * The frames from number `from` on. `brief` gives [n, t, draws, triangles, real, [contexts that drew]] for each:
     * `real` is how many of the draw calls were carried out, not only counted.
     */
    frames(from = 0, brief = false) {
      const out = [];
      for (const f of frames) {
        if (f.n < from) continue;
        if (!brief) { out.push(f); continue; }
        let draws = 0, triangles = 0, real = 0;
        const who = [];
        for (const id of Object.keys(f.ctx)) { draws += f.ctx[id].draws; triangles += f.ctx[id].triangles; real += f.ctx[id].real; if (f.ctx[id].draws > 0) who.push(Number(id)); }
        out.push([f.n, f.t, draws, triangles, real, who]);
      }
      return out;
    },
    /** Every WebGL2 context made on this page, in the order made, with what it holds now. */
    contexts() {
      return contexts.map((rec) => {
        const passes = {};
        for (const id of [0, ...rec.fbs.keys()]) passes[id] = passOf(rec, id);
        let vertexBytes = 0, indexBytes = 0, otherBytes = 0;
        for (const b of rec.buffers.values()) { if (b.target === GL.ARRAY_BUFFER) vertexBytes += b.bytes; else if (b.target === GL.ELEMENT_ARRAY_BUFFER) indexBytes += b.bytes; else otherBytes += b.bytes; }
        return {
          id: rec.id, madeAtFrame: rec.madeAtFrame, madeAt: rec.madeAt, lost: rec.lost, restored: rec.restored, released: rec.released,
          live: !rec.released && rec.lost <= rec.restored,
          canvas: { width: rec.canvas.width, height: rec.canvas.height, connected: rec.canvas.isConnected !== false, engine: rec.canvas.getAttribute?.('data-engine') ?? null, drawn: rec.canvas.hasAttribute?.('data-drawn') ?? false },
          programs: rec.programsMade - rec.programsDeleted, programsMade: rec.programsMade,
          buffers: rec.buffers.size, bufferBytes: vertexBytes + indexBytes + otherBytes, vertexBytes, indexBytes,
          textures: rec.textures.size, textureBytes: sum(rec.textures), renderbuffers: rec.renderbuffers.size, renderbufferBytes: sum(rec.renderbuffers),
          passes, total: { ...rec.total },
        };
      });
    },
    /** Each WebGL canvas's box on the page against its parent's, and its drawing buffer. */
    boxes() {
      return contexts.filter((rec) => rec.canvas.isConnected && rec.canvas.getBoundingClientRect).map((rec) => {
        const c = rec.canvas.getBoundingClientRect();
        const p = rec.canvas.parentElement?.getBoundingClientRect() ?? c;
        return {
          context: rec.id, box: [round(c.width), round(c.height)], parent: [round(p.width), round(p.height)], buffer: [rec.canvas.width, rec.canvas.height],
          ratio: [p.width > 0 ? round(c.width / p.width) : 0, p.height > 0 ? round(c.height / p.height) : 0],
        };
      });
    },
    totals: () => ({ ...totals, commits: { ...totals.commits }, longTaskMs: round(totals.longTaskMs), longestTaskMs: round(totals.longestTaskMs), frameNo, rafHz, hidden, errors: errors.slice() }),
    /** Everything at once: one call from the tool. */
    snapshot(from = 0, brief = false) {
      return { frames: this.frames(from, brief), contexts: this.contexts(), boxes: this.boxes(), totals: this.totals() };
    },
  };
})();

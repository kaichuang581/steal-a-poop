// Gate module: the picture gate, head against base (plan file 16, section 4.1 d and section 5 item 3; file 04,
// section 4.1 step 7). No stored baselines: the base commit is built and photographed by the same tool, in the same
// browser, in the same font files as the head, and each of the fixed shots (shots.mjs) is compared with its twin.
//
//   The twelve shots    compared as pictures. A shot has CHANGED when the two differ by more than its tolerance:
//                       four times the noise recorded for it in noise.json, and never looser than the plan's figures
//                       (at most 0.5 % of pixels more than 24 of 255 apart; no tile's mean more than 3 apart, under
//                       both readings of "tile", lib/png.mjs). A recorded noise of 0 is a tolerance of 0.
//   The wendigo's pair  compared by the magenta shape only: its intersection over union with the base's, at least
//                       0.98, by day and at night. It may not move in any milestone, and fails in every kind of run.
//   A shot that wobbles one whose recorded noise is OVER the plan's figures: the same build gives more than one
//                       picture, further apart than a changed picture may be, so one pair cannot tell a change from
//                       the wobble. It is a known failure, never excused: it is counted (the ratchet
//                       pictures.wobblingShots, which may only fall), named in every report, and judged harder, not
//                       softer. The base is photographed five times; the head once, and four times more only if
//                       that one matches none of the base's; it is the same when one of the head's pictures matches
//                       one of the base's within four times the noise of ONE of its states (0 today: to the pixel).
//                       A real change moves every state, so it matches none.
//
// The rule (plan file 16, section 4.1 d):
//   --milestone NN     a changed shot outside ctx.plan.shots fails; a shot declared there must change (its pair is
//                      listed for a person to look at);
//   --milestone none   changes are listed for the reviewer, not failed;
//   --baseline         the head is the base: nothing is asked to change, and nothing may.
// In every kind of run a page error, a console error, a failed request, an answer of 400 or more or an answer of the
// wrong type, in any shot of either build, fails the module: a picture of a page that said so is not evidence.
//
// Where the pictures are kept (never in the repo):
//   <cache>/<base commit>/shots/base/<id>.png   kept between runs with shots.json, which says how they were made. They
//                                               are used again only when made the same way: this tool, the helper, the
//                                               browser, the machine and the font files all as they are now.
//   <cache>/<tree>/shots/head/<id>.png          made afresh every run. When the head is the base the two folders sit
//                                               side by side under one commit, which is why the names differ.
//
// The noise file is made by this file too, by hand, when a shot is added or a milestone has changed how one is drawn:
//   node tools/gate/pictures.mjs --noise             ten separate contexts a shot on this tree; prints what it found
//   node tools/gate/pictures.mjs --noise --write     and writes tools/gate/noise.json
// (--runs N, --browsers N and --jobs N change how many; --from <folder> compares an earlier run's pictures again;
// --help says the same.) $GATE_PICTURES_JOBS is how many places a gate run opens at once (half the cores, four at
// most, when not set).
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { availableParallelism, cpus } from 'node:os';
import { basename, dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHROMIUM_ARGS, PINNED, ROOT, cacheDir, ensureBaseCheckout, ensureGateBuild, launch, serve, shoot, withLock } from './lib/painted.mjs';
import { PLAN_LIMITS, compare, countMask, decode, maskIoU, withinLimits } from './lib/png.mjs';
import { ALL, SHOTS, WENDIGO_MASKS, WENDIGO_MIN_IOU, fileOf, openShot } from './shots.mjs';

export const id = 'pictures';
export const modes = ['milestone', 'baseline'];

const HERE = dirname(fileURLToPath(import.meta.url));
const NOISE_FILE = join(HERE, 'noise.json');
const MILESTONES_FILE = join(HERE, 'milestones.json');

/** A shot's tolerance is this many times its recorded noise (plan file 16, section 4.1 d). */
const TIMES = 4;
/** How many times milestone 0 shoots each shot to record its noise. */
const NOISE_RUNS = 10;
/**
 * How many pictures of each build are taken of a shot that wobbles. With two states, one of them seen one run in five
 * (table-results today: 6 of 30 runs), an unchanged shot is called changed only when every picture of one build shows
 * one state and every picture of the other build shows the other: about 2 runs in 10,000 with five pictures a build.
 * With one picture a build it was 1 run in 3.
 */
const WOBBLE_SAMPLES = 5;

// ---------------------------------------------------------------------------------------------------------------------
// Small things
// ---------------------------------------------------------------------------------------------------------------------

const sha256 = (data) => createHash('sha256').update(data).digest('hex');
const firstLine = (e) => String(e?.message ?? e).split('\n').map((l) => l.trim()).find(Boolean)?.slice(0, 400) ?? 'no message';
const slashes = (path) => path.split(sep).join('/');
const pct = (share) => `${(share * 100).toFixed(4)} %`;
const num = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(4));
const list = (ids) => (ids.length ? ids.join(', ') : 'none');
/** The file of a shot's nth picture: the first is <id>.png, the others (a shot that wobbles) <id>.2.png and on. */
const sampleFile = (shotId, n) => (n === 1 ? fileOf(shotId) : `${shotId}.${n}.png`);
/** Whether a noise is over the plan's own figures: no tolerance the plan allows could cover it. */
const overPlan = (n) => n.share > PLAN_LIMITS.share || n.tileMean > PLAN_LIMITS.tileMean || n.patchMean > PLAN_LIMITS.tileMean;

/** How many places are opened at once: $GATE_PICTURES_JOBS, or half the cores, four at most (lib/README.md, section 6). */
function jobsWanted(asked) {
  const given = Number(asked ?? process.env.GATE_PICTURES_JOBS);
  if (Number.isInteger(given) && given > 0) return Math.min(given, 16);
  return Math.max(1, Math.min(4, Math.floor(availableParallelism() / 2)));
}

/** Runs `work` over `items`, `jobs` at a time, and resolves every answer in the items' own order. Never rejects. */
async function pool(items, jobs, work) {
  const out = new Array(items.length);
  let next = 0;
  const lane = async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      try { out[i] = await work(items[i], i); } catch (e) { out[i] = { ok: false, error: firstLine(e), errors: [] }; }
    }
  };
  await Promise.all(Array.from({ length: Math.min(jobs, items.length) }, lane));
  return out;
}

/** What a page logged, made the same from run to run: the preview server's port is a new one each time. */
function tidyErrors(errors) {
  const plain = (text) => String(text ?? '').replace(/https?:\/\/(127\.0\.0\.1|localhost):\d+/g, '').replace(/\s+/g, ' ').trim().slice(0, 300);
  return errors.map((e) => ({ kind: e.kind, text: plain(e.text), ...(e.url ? { url: plain(e.url) } : {}) }));
}

/**
 * Opens one shot's place on one build, photographs it and writes the PNG. Resolves { ok, file, sha256, errors,
 * clockMs, ms }, or { ok: false, error, errors, ms } when the place could not be reached. The context is always closed.
 */
async function take(browser, shot, { url, dir, name = fileOf(shot.id) }) {
  const t0 = Date.now();
  let opened = null;
  try {
    opened = await openShot(browser, shot, { url });
    const png = await shoot(opened.page);
    // The page's own clock at the shot. On a quiet machine every run of a place lands on the same reading
    // (lib/README.md, section 6); on a busy one a place has been seen one or two frames late, its picture the same.
    const clockMs = Math.round(await opened.page.evaluate(() => performance.now()));
    const errors = tidyErrors(opened.errors);
    mkdirSync(dir, { recursive: true });
    const file = join(dir, name);
    writeFileSync(`${file}.${process.pid}.tmp`, png);
    renameSync(`${file}.${process.pid}.tmp`, file);
    return { ok: true, file, sha256: sha256(png), errors, clockMs, ms: Date.now() - t0 };
  } catch (e) {
    return { ok: false, error: firstLine(e), errors: tidyErrors(opened?.errors ?? []), ms: Date.now() - t0 };
  } finally {
    await opened?.context.close().catch(() => {});
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// The noise file and a shot's tolerance
// ---------------------------------------------------------------------------------------------------------------------

/**
 * A shot's own tolerance: four times its recorded noise, never looser than the plan's figures. The plan's one tile
 * figure is held under both readings (a 16 x 9 grid of tiles, and tiles of 16 x 9 pixels), each against its own noise.
 */
export function toleranceOf(noise) {
  return {
    share: Math.min(PLAN_LIMITS.share, TIMES * noise.share),
    tileMean: Math.min(PLAN_LIMITS.tileMean, TIMES * noise.tileMean),
    patchMean: Math.min(PLAN_LIMITS.tileMean, TIMES * noise.patchMean),
  };
}

const isShare = (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0;

/**
 * Reads noise.json. Resolves { shots: { id: { noise, wobbles, steady, tolerance } }, problems }: a shot with no usable
 * record has no entry. Whether a shot wobbles is worked out from its noise here, never taken from the file's word.
 */
function readNoise() {
  const problems = [];
  let json = null;
  try { json = JSON.parse(readFileSync(NOISE_FILE, 'utf8')); } catch (e) {
    return { shots: {}, problems: [`tools/gate/noise.json could not be read (${firstLine(e)}): no shot has a recorded noise, so none has a tolerance`] };
  }
  const shots = {};
  for (const s of SHOTS) {
    const row = json?.shots?.[s.id];
    const n = row?.noise;
    if (!n || !isShare(n.share) || !isShare(n.tileMean) || !isShare(n.patchMean)) {
      problems.push(`tools/gate/noise.json has no recorded noise for ${s.id}: measure it (node tools/gate/pictures.mjs --noise --write)`);
      continue;
    }
    if (!(row.runs >= NOISE_RUNS)) problems.push(`tools/gate/noise.json records ${row.runs ?? 0} runs of ${s.id}; the plan asks for ${NOISE_RUNS}`);
    const noise = { share: n.share, tileMean: n.tileMean, patchMean: n.patchMean };
    const wobbles = overPlan(noise);
    // A shot that wobbles is held to the noise of one of its states, which the file must record.
    const st = row.steadyNoise;
    if (wobbles && (!st || !isShare(st.share) || !isShare(st.tileMean) || !isShare(st.patchMean) || overPlan(st))) {
      problems.push(`tools/gate/noise.json: ${s.id} wobbles (its noise is over the plan's figures) and has no usable steadyNoise: measure it again`);
      continue;
    }
    const steady = wobbles ? { share: st.share, tileMean: st.tileMean, patchMean: st.patchMean } : null;
    const tolerance = toleranceOf(steady ?? noise);
    // The tolerance written in the file is for a person to read. It must be the one that follows from the noise.
    const written = row.tolerance;
    if (!written || written.share !== tolerance.share || written.tileMean !== tolerance.tileMean || written.patchMean !== tolerance.patchMean) {
      problems.push(`tools/gate/noise.json: the tolerance written for ${s.id} is not ${TIMES} times its noise (capped at the plan's figures)`);
    }
    shots[s.id] = { noise, wobbles, steady, tolerance, states: Array.isArray(row.states) ? row.states : null };
  }
  return { shots, problems };
}

/** How far apart a base shot and a head shot are, and whether that is past the shot's tolerance. */
function judge(basePng, headPng, tolerance) {
  const a = decode(basePng), b = decode(headPng);
  const r = compare(a, b);
  const any = compare(a, b, { threshold: 0 }).differing;
  // withinLimits cuts any limit back to the plan's, so nothing here can let through more than the plan does; the two
  // tile readings are then each held to their own, tighter, figure.
  const inside = withinLimits(r, { share: tolerance.share, tileMean: Math.max(tolerance.tileMean, tolerance.patchMean) })
    && r.worstTileMeanDelta <= tolerance.tileMean && r.worstPatchMeanDelta <= tolerance.patchMean;
  return {
    changed: !inside, sameSize: r.sameSize, pixels: r.pixels, over24: r.differing, share: r.share, differingAtAll: any,
    tileMean: r.worstTileMeanDelta, patchMean: r.worstPatchMeanDelta, worstPatch: r.worstPatch,
  };
}

/**
 * One shot, every picture of the head against every picture of the base (one of each, but for a shot that wobbles).
 * The same when any pair is inside the tolerance: resolves that pair's figures and which two they were. Changed when
 * none is: resolves the figures of the nearest pair, so the report shows the least the two builds differ by.
 */
function judgeAll(base, head, tolerance) {
  let nearest = null;
  for (const h of head) {
    for (const b of base) {
      const j = { ...judge(b.bytes, h.bytes, tolerance), pair: { base: b.n, head: h.n } };
      if (!j.changed) return j;
      if (!nearest || j.patchMean < nearest.patchMean || (j.patchMean === nearest.patchMean && j.share < nearest.share)) nearest = j;
    }
  }
  return nearest;
}

// ---------------------------------------------------------------------------------------------------------------------
// The base's shots, kept by commit
// ---------------------------------------------------------------------------------------------------------------------

/** A hash of the font files in the cache: base and head must be set in the same ones (lib/README.md, "Fonts"). */
function fontsHash() {
  const dir = join(cacheDir(), 'fonts');
  const h = createHash('sha256');
  let names = [];
  try { names = readdirSync(dir).filter((f) => /\.(body|json)$/.test(f)).sort(); } catch { /* none yet */ }
  for (const name of names) {
    h.update(`${name}\0`);
    try { h.update(readFileSync(join(dir, name))); } catch { h.update('<gone>'); }
    h.update('\0');
  }
  return `${names.length}:${h.digest('hex').slice(0, 24)}`;
}

/**
 * Everything but the commit and the fonts that decides what a shot looks like: the shots' own list, this tool, the
 * helper and its init script, the browser, how it is started, the pinned moment and seed, and the machine (software
 * rendering is compiled for the processor it runs on; whether two kinds give the same pixels has not been measured).
 * Kept base shots are used again only under the same recipe.
 */
function recipeOf(browserVersion) {
  const files = ['shots.mjs', 'pictures.mjs', 'lib/painted.mjs', 'lib/determinism.js'].map((f) => [f, sha256(readFileSync(join(HERE, f)))]);
  const parts = {
    files: Object.fromEntries(files),
    browser: browserVersion,
    args: CHROMIUM_ARGS,
    chromium: process.env.PW_CHROMIUM || 'playwright',
    pinned: PINNED,
    machine: `${process.platform} ${process.arch} ${cpus()[0]?.model ?? 'unknown processor'}`,
  };
  return sha256(JSON.stringify(parts)).slice(0, 24);
}

/** Whether the kept base shots can be used as they are: `samplesOf(shot)` pictures of each. Resolves { ok, why, stamp }. */
function keptBase(dir, base, recipe, fonts, samplesOf) {
  let stamp;
  try { stamp = JSON.parse(readFileSync(join(dir, 'shots.json'), 'utf8')); } catch { return { ok: false, why: 'none are kept' }; }
  if (stamp.base !== base) return { ok: false, why: 'the kept ones are of another commit' };
  if (stamp.recipe !== recipe) return { ok: false, why: 'the kept ones were made another way (the tool, the helper, the browser or the machine has changed since)' };
  if (stamp.fonts !== fonts) return { ok: false, why: 'the kept ones were set in other font files than the cache holds now' };
  for (const s of ALL) {
    const rows = stamp.shots?.[s.id]?.samples;
    if (!Array.isArray(rows) || rows.length < samplesOf(s)) return { ok: false, why: `${samplesOf(s)} pictures of ${s.id} are needed and ${Array.isArray(rows) ? rows.length : 0} are kept` };
    for (const row of rows) {
      let bytes = null;
      try { bytes = readFileSync(join(dir, row.file)); } catch { /* missing */ }
      if (!bytes || sha256(bytes) !== row.sha256) return { ok: false, why: `the kept ${row.file} is missing or is not the file that was kept` };
    }
  }
  return { ok: true, why: '', stamp };
}

// ---------------------------------------------------------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------------------------------------------------------

/**
 * The numbers handed to the ratchet store: the shots may not become fewer, no tolerance may become looser, and the
 * shots that wobble (a known failure, named in every report) may not become more.
 */
function ratchets(noise) {
  const tolerances = Object.values(noise.shots).map((s) => s.tolerance);
  const loosest = (key) => tolerances.reduce((m, t) => Math.max(m, t[key]), 0);
  return {
    measured: {
      shots: SHOTS.length,
      wendigoMasks: WENDIGO_MASKS.length,
      wobblingShots: Object.values(noise.shots).filter((s) => s.wobbles).length,
      loosestTolerance: { share: loosest('share'), tileMean: loosest('tileMean'), patchMean: loosest('patchMean') },
    },
    seedWith: { shots: { min: SHOTS.length }, wendigoMasks: { min: WENDIGO_MASKS.length } },
  };
}

export async function run(ctx) {
  const log = ctx.log ?? (() => {});
  const cache = ctx.cache ?? cacheDir();
  const rel = (file) => slashes(relative(cache, file));
  const noise = readNoise();
  const { measured, seedWith } = ratchets(noise);
  const notRun = (why, lines = []) => ({ ok: false, summary: `NOT RUN: ${why}`, lines, data: {}, measured, seedWith, decisions: [], human: [] });

  // Which rule this run applies.
  const rule = ctx.mode === 'baseline' ? 'baseline' : ctx.mode === 'milestone' && ctx.milestone !== null && ctx.milestone !== undefined ? 'milestone' : 'none';
  const declared = rule === 'milestone' ? [...(ctx.plan?.shots ?? [])] : [];
  const ids = SHOTS.map((s) => s.id);
  const problems = [...noise.problems];
  /** How many pictures of one build are taken of a shot: one, but for a shot that wobbles. */
  const samplesOf = (s) => (noise.shots[s.id]?.wobbles ? WOBBLE_SAMPLES : 1);

  // Names are fixed once used: the twelve here are the twelve of the milestone table, and a milestone declares only those.
  try {
    const fixed = JSON.parse(readFileSync(MILESTONES_FILE, 'utf8')).shots;
    if (!Array.isArray(fixed) || fixed.length !== ids.length || fixed.some((x) => !ids.includes(x)) || ids.some((x) => !fixed.includes(x))) {
      problems.push(`the shots of tools/gate/shots.mjs (${list(ids)}) are not the shots of tools/gate/milestones.json (${Array.isArray(fixed) ? list(fixed) : 'no list'}): a shot's name is fixed once used`);
    }
  } catch (e) {
    problems.push(`tools/gate/milestones.json could not be read (${firstLine(e)}): the fixed list of shots could not be checked`);
  }
  const unknown = declared.filter((x) => !ids.includes(x));
  if (unknown.length) problems.push(`milestone ${ctx.milestone} declares ${list(unknown)}, which the gate does not photograph`);

  let browser = null;
  const sites = [];
  try {
    // The head's build, and the folder that belongs to exactly this source.
    let headDist;
    try { headDist = await ensureGateBuild(ctx.root, { log }); } catch (e) { return notRun(`the head's gate build failed: ${firstLine(e)}`); }
    const tree = basename(dirname(headDist));
    const headDir = join(dirname(headDist), 'shots', 'head');
    const baseDir = join(cache, ctx.base, 'shots', 'base');

    return await withLock(`pictures-${tree}`, async () => {
      try { browser = await launch(); } catch (e) { return notRun(`the browser could not be started: ${firstLine(e)}`); }
      const browserVersion = browser.version();
      const recipe = recipeOf(browserVersion);
      const jobs = jobsWanted();

      return withLock(`shots-base-${ctx.base}`, async () => {
        // The base's shots: the kept ones when they were made the same way, else made now.
        const kept = keptBase(baseDir, ctx.base, recipe, fontsHash(), samplesOf);
        let baseUrl = null;
        if (!kept.ok) {
          log(`base shots: ${kept.why}; photographing ${ctx.base.slice(0, 7)}`);
          let baseDist;
          try {
            // A clean head at the base commit is the base: one build serves both.
            baseDist = tree === ctx.base ? headDist : await ensureGateBuild(await ensureBaseCheckout(ctx.root, ctx.base, { log }), { log });
          } catch (e) { return notRun(`the base (${ctx.base.slice(0, 7)}) could not be checked out and built: ${firstLine(e)}`); }
          try { sites.push(await serve(baseDist)); baseUrl = sites.at(-1).url; } catch (e) { return notRun(`the base's build could not be served: ${firstLine(e)}`); }
        } else log(`base shots: the kept ones of ${ctx.base.slice(0, 7)} are used (same tool, browser, machine and fonts)`);
        let headUrl;
        try { sites.push(await serve(headDist)); headUrl = sites.at(-1).url; } catch (e) { return notRun(`the head's build could not be served: ${firstLine(e)}`); }

        // The head's pictures are made afresh every run: an older one must never be read as this run's.
        rmSync(headDir, { recursive: true, force: true });
        mkdirSync(headDir, { recursive: true });
        const freshBase = `${baseDir}.${process.pid}.new`;
        if (!kept.ok) {
          // A run that was stopped while photographing the base left its half-made folder beside the kept one. This
          // run holds the base's lock, so any such folder is nobody's.
          let beside = [];
          try { beside = readdirSync(dirname(baseDir)); } catch { /* nothing there yet */ }
          for (const name of beside) if (/^base\.\d+\.new$/.test(name)) rmSync(join(dirname(baseDir), name), { recursive: true, force: true });
          mkdirSync(freshBase, { recursive: true });
        }

        // got[build][shot id] is the list of that shot's pictures, the first at [0].
        const got = { base: {}, head: {} };
        const task = (build, shot, n) => ({ build, shot, n, url: build === 'base' ? baseUrl : headUrl, dir: build === 'base' ? freshBase : headDir, name: sampleFile(shot.id, n) });
        let places = 0, spentMs = 0;
        const photograph = async (tasks) => {
          const t0 = Date.now();
          const taken = await pool(tasks, jobs, async (t) => {
            const r = await take(browser, t.shot, t);
            log(`${t.build} ${t.shot.id}${t.n > 1 ? ` (picture ${t.n})` : ''}: ${r.ok ? `${(r.ms / 1000).toFixed(1)} s` : `NOT TAKEN after ${(r.ms / 1000).toFixed(1)} s: ${r.error}`}`);
            return r;
          });
          tasks.forEach((t, i) => { (got[t.build][t.shot.id] ??= [])[t.n - 1] = { n: t.n, ...taken[i] }; });
          places += tasks.length;
          spentMs += Date.now() - t0;
        };
        const first = [
          ...(kept.ok ? [] : ALL.flatMap((shot) => Array.from({ length: samplesOf(shot) }, (_, k) => task('base', shot, k + 1)))),
          ...ALL.map((shot) => task('head', shot, 1)),
        ];
        log(`photographing ${first.length} places, ${jobs} at a time, in Chromium ${browserVersion}`);
        await photograph(first);

        // Keep the base's shots only when every one was taken: half a set is no base.
        if (!kept.ok) {
          const missed = ALL.flatMap((s) => got.base[s.id].filter((r) => !r.ok).map((r) => ({ name: sampleFile(s.id, r.n), error: r.error })));
          if (missed.length) {
            rmSync(freshBase, { recursive: true, force: true });
            return notRun(
              `${missed.length} of the base's ${first.length - ALL.length} pictures could not be taken (${list(missed.map((m) => m.name))}), so there is nothing to compare the head with`,
              missed.map((m) => `base ${m.name}: ${m.error ?? 'not taken'}`),
            );
          }
          const stamp = {
            base: ctx.base, recipe, fonts: fontsHash(), browser: browserVersion,
            shots: Object.fromEntries(ALL.map((s) => [s.id, { samples: got.base[s.id].map((r) => ({ file: sampleFile(s.id, r.n), sha256: r.sha256, clockMs: r.clockMs, errors: r.errors })) }])),
          };
          writeFileSync(join(freshBase, 'shots.json'), `${JSON.stringify(stamp, null, 2)}\n`);
          rmSync(baseDir, { recursive: true, force: true });
          mkdirSync(dirname(baseDir), { recursive: true });
          renameSync(freshBase, baseDir);
          kept.stamp = stamp;
        }
        /** The base's pictures of a shot: as many as this run asks for, each with the path of its file. */
        const baseOf = (s) => kept.stamp.shots[s.id].samples.slice(0, samplesOf(s)).map((row, k) => ({ n: k + 1, ...row, path: join(baseDir, row.file) }));
        const headOf = (s) => got.head[s.id].filter((r) => r.ok);

        // The twelve, each against its twin. A shot that wobbles and matched none of the base's pictures is
        // photographed again, as often as the base was: only if none of those matches either has it changed.
        const pictures = new Map();
        const decoded = (path) => { if (!pictures.has(path)) pictures.set(path, decode(readFileSync(path))); return pictures.get(path); };
        const judgeShot = (s) => {
          const tol = noise.shots[s.id]?.tolerance;
          if (!tol || !got.head[s.id][0].ok) return null;
          return judgeAll(baseOf(s).map((b) => ({ n: b.n, bytes: decoded(b.path) })), headOf(s).map((h) => ({ n: h.n, bytes: decoded(h.file) })), tol);
        };
        const judged = Object.fromEntries(SHOTS.map((s) => [s.id, judgeShot(s)]));
        const again = SHOTS.filter((s) => samplesOf(s) > 1 && judged[s.id]?.changed);
        if (again.length) {
          log(`${list(again.map((s) => s.id))} wobble${again.length === 1 ? 's' : ''} and matched none of the base's ${WOBBLE_SAMPLES} pictures: photographing ${again.length === 1 ? 'it' : 'each'} ${WOBBLE_SAMPLES - 1} times more`);
          await photograph(again.flatMap((shot) => Array.from({ length: samplesOf(shot) - 1 }, (_, k) => task('head', shot, k + 2))));
          for (const s of again) judged[s.id] = judgeShot(s);
        }
        pictures.clear();
        log(`photographed ${places} places in ${Math.round(spentMs / 1000)} s`);

        writeFileSync(join(headDir, 'shots.json'), `${JSON.stringify({
          tree, recipe, browser: browserVersion,
          shots: Object.fromEntries(ALL.map((s) => [s.id, { samples: got.head[s.id].map((r) => (r.ok
            ? { file: sampleFile(s.id, r.n), sha256: r.sha256, clockMs: r.clockMs, errors: r.errors }
            : { file: sampleFile(s.id, r.n), notTaken: r.error, errors: r.errors })) }])),
        }, null, 2)}\n`);

        // What the pages said, base and head alike, and what could not be photographed.
        const errors = [];
        const notTaken = [];
        for (const s of ALL) {
          for (const b of baseOf(s)) for (const e of b.errors ?? []) errors.push({ shot: s.id, build: 'base', picture: b.n, ...e });
          for (const h of got.head[s.id]) {
            for (const e of h.errors ?? []) errors.push({ shot: s.id, build: 'head', picture: h.n, ...e });
            if (!h.ok) notTaken.push({ shot: s.id, picture: h.n, why: h.error });
          }
        }

        const lines = [];
        const shots = [];
        const changed = [];
        for (const s of SHOTS) {
          const record = noise.shots[s.id] ?? null;
          const tol = record?.tolerance ?? null;
          const j = judged[s.id];
          const wobbles = samplesOf(s) > 1;
          const basePath = (n) => rel(join(baseDir, sampleFile(s.id, n)));
          const headPath = (n) => rel(join(headDir, sampleFile(s.id, n)));
          const row = { id: s.id, declared: declared.includes(s.id), wobbles, tolerance: tol, base: basePath(j?.pair.base ?? 1), head: got.head[s.id][0].ok ? headPath(j?.pair.head ?? 1) : null };
          if (!got.head[s.id][0].ok) {
            lines.push(`${s.id}: NOT TAKEN at the head (${got.head[s.id][0].error})`);
            shots.push({ ...row, taken: false });
            continue;
          }
          if (!j) {
            lines.push(`${s.id}: NOT JUDGED, it has no recorded noise and so no tolerance`);
            shots.push({ ...row, taken: true, judged: false });
            continue;
          }
          if (j.changed) changed.push(s.id);
          const clockMs = { base: baseOf(s)[j.pair.base - 1].clockMs, head: got.head[s.id][j.pair.head - 1].clockMs };
          const { pair, ...figures } = j;
          shots.push({ ...row, taken: true, judged: true, ...figures, clockMs, ...(wobbles ? { pictures: { base: baseOf(s).length, head: headOf(s).length }, pair } : {}) });
          const which = !wobbles ? '' : j.changed
            ? ` None of the head's ${headOf(s).length} pictures matches any of the base's ${baseOf(s).length}; the nearest two are the head's picture ${pair.head} and the base's picture ${pair.base}:`
            : ` The head's picture ${pair.head} of ${headOf(s).length} matches the base's picture ${pair.base} of ${baseOf(s).length}:`;
          lines.push(`${s.id}: ${j.changed ? 'CHANGED' : 'the same'}${j.sameSize ? '' : ' (the two pictures are not the same size)'}.${which} ${j.over24} pixels over 24 of 255 (${pct(j.share)}, may be ${pct(tol.share)}); ${j.differingAtAll} differ at all; tile mean ${num(j.tileMean)} (may be ${num(tol.tileMean)}); 16 x 9 pixel tile mean ${num(j.patchMean)} (may be ${num(tol.patchMean)})${j.changed && j.sameSize ? `, worst at x ${j.worstPatch.x}, y ${j.worstPatch.y}` : ''}`);
          // The two builds are meant to reach a place on the same reading of the page's clock; when they did not, say so.
          if (clockMs.base !== clockMs.head) lines.push(`${s.id}: the page's clock read ${clockMs.base} ms at the base's shot and ${clockMs.head} ms at the head's`);
        }

        // The wendigo's pair: the magenta shape against the base's.
        const wendigo = [];
        for (const s of WENDIGO_MASKS) {
          const head = got.head[s.id][0];
          const base = baseOf(s)[0];
          if (!head.ok) {
            lines.push(`${s.id}: NOT TAKEN at the head (${head.error})`);
            wendigo.push({ id: s.id, taken: false, ok: false, base: rel(base.path), head: null });
            continue;
          }
          const m = maskIoU(readFileSync(base.path), readFileSync(head.file));
          // maskIoU scores two empty masks 0: a run that never saw the figure does not pass.
          const ok = m.sameSize && m.a > 0 && m.b > 0 && m.iou >= WENDIGO_MIN_IOU;
          wendigo.push({ id: s.id, taken: true, ok, iou: m.iou, basePixels: m.a, headPixels: m.b, both: m.both, either: m.either, base: rel(base.path), head: rel(head.file) });
          lines.push(`${s.id}: ${ok ? 'the mask matches' : 'THE MASK DOES NOT MATCH'}. Intersection over union ${m.iou.toFixed(4)} (at least ${WENDIGO_MIN_IOU}); ${m.a} magenta pixels at the base, ${m.b} at the head, ${m.both} in both`);
        }

        // The rule.
        const unexpected = rule === 'milestone' ? changed.filter((x) => !declared.includes(x)) : [...changed];
        const unchanged = rule === 'milestone' ? declared.filter((x) => ids.includes(x) && !changed.includes(x) && judged[x]) : [];
        const failed = [...problems];
        if (notTaken.length) failed.push(`${notTaken.length} of the head's pictures could not be taken: ${list([...new Set(notTaken.map((n) => n.shot))])}`);
        if (errors.length) {
          const where = [...new Set(errors.map((e) => `${e.build} ${e.shot}`))];
          failed.push(`${errors.length} page error${errors.length === 1 ? '' : 's'}, failed request${errors.length === 1 ? '' : 's'} or wrong answer${errors.length === 1 ? '' : 's'} in ${where.length} shot${where.length === 1 ? '' : 's'}: ${list(where.slice(0, 6))}${where.length > 6 ? ', ...' : ''}`);
          for (const e of errors.slice(0, 20)) lines.push(`${e.build} ${e.shot} said (${e.kind}): ${e.text}${e.url ? ` [${e.url}]` : ''}`);
          if (errors.length > 20) lines.push(`... and ${errors.length - 20} more`);
        }
        const badMasks = wendigo.filter((w) => w.taken && !w.ok);
        if (badMasks.length) failed.push(`the wendigo's mask does not match the base's: ${badMasks.map((w) => `${w.id} (intersection over union ${w.iou.toFixed(4)}, at least ${WENDIGO_MIN_IOU} is asked)`).join(', ')}`);
        if (rule === 'milestone') {
          if (unexpected.length) failed.push(`changed and not declared for milestone ${ctx.milestone}: ${list(unexpected)}`);
          if (unchanged.length) failed.push(`declared for milestone ${ctx.milestone} and not changed: ${list(unchanged)}`);
        } else if (rule === 'baseline' && changed.length) {
          failed.push(`the head is the base, and ${changed.length === 1 ? 'a picture differs' : `${changed.length} pictures differ`} from it: ${list(changed)}`);
        }

        // Every changed pair, for a person to look at.
        const pairs = shots.filter((s) => changed.includes(s.id)).map((s) => ({ id: s.id, base: s.base, head: s.head }));
        const human = pairs.map((p) => `Look at the pair for ${p.id}${declared.includes(p.id) ? ' (declared for this milestone)' : ''}: <cache>/${p.base} against <cache>/${p.head}`);
        for (const p of pairs) lines.push(`pair ${p.id}: <cache>/${p.base} against <cache>/${p.head}`);

        // The known failure, by name, in every report: a shot the same build draws more than one way.
        const wobbling = SHOTS.filter((s) => samplesOf(s) > 1);
        const known = wobbling.map((s) => {
          const r = noise.shots[s.id];
          return `KNOWN, counted in the ratchet pictures.wobblingShots: ${s.id} wobbles. One build gives more than one picture of it${r.states ? ` (${r.states.join(' and ')} of ${r.states.reduce((a, b) => a + b, 0)} recorded runs)` : ''}, up to ${pct(r.noise.share)} of pixels over 24 and ${num(r.noise.patchMean)} apart in a 16 x 9 pixel tile mean, where the plan allows ${pct(PLAN_LIMITS.share)} and ${PLAN_LIMITS.tileMean}. It is photographed ${WOBBLE_SAMPLES} times at the base and up to ${WOBBLE_SAMPLES} times at the head, and is the same only when one of the head's pictures matches one of the base's.`;
        });
        lines.unshift(
          rule === 'milestone' ? `Milestone ${ctx.milestone}: the shots it may change are ${list(declared)}; any other change fails, and each of those must change.`
            : rule === 'baseline' ? 'A baseline: the head is the base, so no picture may differ from it.'
              : 'Not a milestone: a changed picture is listed for the reviewer, not failed.',
          `Base ${ctx.base.slice(0, 7)} against the head, ${SHOTS.length} shots and the wendigo's pair, in Chromium ${browserVersion}, drawn in software.`,
          ...known,
        );

        const masks = `${wendigo.map((w) => (w.taken ? w.iou.toFixed(3) : 'not taken')).join(' by day, ')} at night`;
        const good = `${SHOTS.length} shots: ${changed.length ? `${changed.length} changed (${list(changed)})${rule === 'milestone' ? ', as declared' : ', listed for the reviewer'}` : 'none changed'}; the wendigo's mask overlaps the base's ${masks}${wobbling.length ? `; known: ${list(wobbling.map((s) => s.id))} wobble${wobbling.length === 1 ? 's' : ''}` : ''}`;
        return {
          ok: failed.length === 0,
          summary: failed.length ? failed.join('; ') : good,
          lines,
          data: { rule, browser: browserVersion, tree, declared, changed, unexpected, unchanged, pairs, shots, wendigo, wobbling: wobbling.map((s) => s.id), errors, notTaken },
          measured,
          seedWith,
          decisions: [],
          human,
        };
      }, { log });
    }, { log });
  } finally {
    await browser?.close().catch(() => {});
    for (const site of sites) await site.close().catch(() => {});
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Recording the noise (run by hand: node tools/gate/pictures.mjs --noise)
// ---------------------------------------------------------------------------------------------------------------------

/** JSON for a file a person reads: two spaces a level, and anything that fits in 120 characters kept on one line. */
function pretty(value, indent = '') {
  const flat = JSON.stringify(value);
  if (value === null || typeof value !== 'object') return flat;
  const spaced = JSON.stringify(value, null, 1).replace(/\n\s*/g, ' ');
  const isText = (v) => typeof v === 'string';
  // A list of sentences reads best one to a line, however short.
  if (spaced.length + indent.length <= 120 && !(Array.isArray(value) && value.some(isText) && value.length > 1)) return spaced;
  const inner = `${indent}  `;
  const rows = Array.isArray(value)
    ? value.map((v) => `${inner}${pretty(v, inner)}`)
    : Object.entries(value).map(([k, v]) => `${inner}${JSON.stringify(k)}: ${pretty(v, inner)}`);
  return `${Array.isArray(value) ? '[' : '{'}\n${rows.join(',\n')}\n${indent}${Array.isArray(value) ? ']' : '}'}`;
}

/** The largest gap between two pictures on any one channel of any one pixel, of 255. */
function largestStep(a, b) {
  if (a.width !== b.width || a.height !== b.height) return 255;
  let worst = 0;
  for (let i = 0; i < a.data.length; i++) {
    const d = a.data[i] > b.data[i] ? a.data[i] - b.data[i] : b.data[i] - a.data[i];
    if (d > worst) worst = d;
  }
  return worst;
}

/**
 * Shoots every shot `runs` times on this tree, each in a context of its own, spread over `browsers` browsers started
 * one after the other. The pictures go to <cache>/<tree>/shots/noise/<id>/<run>.png, with runs.json beside them saying
 * how they were made. Resolves that file's content.
 */
async function photographNoise({ runs, browsers, jobs, log }) {
  const dist = await ensureGateBuild(ROOT, { log });
  const tree = basename(dirname(dist));
  const dir = join(dirname(dist), 'shots', 'noise');
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const site = await serve(dist);
  const taken = Object.fromEntries(ALL.map((s) => [s.id, []]));
  const wrong = [];
  let version = '';
  const t0 = Date.now();
  try {
    for (let b = 0; b < browsers; b++) {
      // Run n goes to browser n mod `browsers`, so each browser makes its share whatever the two numbers are.
      const mine = Array.from({ length: runs }, (_, n) => n).filter((n) => n % browsers === b);
      if (!mine.length) continue;
      const browser = await launch();
      version = browser.version();
      try {
        const tasks = mine.flatMap((n) => ALL.map((shot) => ({ n, shot })));
        log(`browser ${b + 1} of ${browsers}: ${tasks.length} places, ${jobs} at a time`);
        const got = await pool(tasks, jobs, async (task) => {
          const name = `${String(task.n + 1).padStart(2, '0')}.png`;
          const r = await take(browser, task.shot, { url: site.url, dir: join(dir, task.shot.id), name });
          log(`  ${task.shot.id} run ${task.n + 1}: ${r.ok ? `${(r.ms / 1000).toFixed(1)} s` : `NOT TAKEN: ${r.error}`}`);
          return { ...r, name };
        });
        tasks.forEach((task, i) => {
          const r = got[i];
          if (!r.ok) wrong.push(`${task.shot.id} run ${task.n + 1} could not be taken: ${r.error}`);
          else {
            taken[task.shot.id].push({ run: task.n + 1, file: r.name, clockMs: r.clockMs });
            for (const e of r.errors) wrong.push(`${task.shot.id} run ${task.n + 1} said (${e.kind}): ${e.text}${e.url ? ` [${e.url}]` : ''}`);
          }
        });
      } finally {
        await browser.close().catch(() => {});
      }
    }
  } finally {
    await site.close().catch(() => {});
  }
  log(`photographed in ${Math.round((Date.now() - t0) / 1000)} s`);
  for (const rows of Object.values(taken)) rows.sort((a, b) => a.run - b.run);
  const made = {
    on: new Date().toISOString().slice(0, 10),
    runs, browsers,
    atOnce: jobs,
    browser: `Chromium ${version}, headless, drawing in software (${CHROMIUM_ARGS.join(' ')})`,
    machine: `${process.platform} ${process.arch}, ${cpus()[0]?.model ?? 'unknown processor'}, ${availableParallelism()} cores`,
    node: process.version,
    tree,
    shots: taken,
    wrong,
  };
  writeFileSync(join(dir, 'runs.json'), `${JSON.stringify(made, null, 1)}\n`);
  return { dir, made };
}

/**
 * The runs of one shot sorted into states. Runs that gave the same file are one picture; two pictures within the
 * plan's limits of each other are one state (so are any they are chained to). Resolves how many runs each state had,
 * the largest first; the noise over every pair of runs; and the steady noise, which is over pairs of one state only.
 */
function statesOf(bytes) {
  const hashes = bytes.map((x) => sha256(x));
  const distinct = [...new Set(hashes)];
  const pics = distinct.map((h) => decode(bytes[hashes.indexOf(h)]));
  const root = distinct.map((_, i) => i);
  const find = (i) => { while (root[i] !== i) i = root[i]; return i; };
  const gaps = [];
  for (let i = 0; i < pics.length; i++) {
    for (let j = i + 1; j < pics.length; j++) {
      const r = compare(pics[i], pics[j]);
      gaps.push({ i, j, r, any: compare(pics[i], pics[j], { threshold: 0 }).differing, step: largestStep(pics[i], pics[j]) });
      if (withinLimits(r, PLAN_LIMITS)) root[find(i)] = find(j);
    }
  }
  const worst = (some) => some.reduce((n, g) => ({
    share: Math.max(n.share, g.r.share), tileMean: Math.max(n.tileMean, g.r.worstTileMeanDelta), patchMean: Math.max(n.patchMean, g.r.worstPatchMeanDelta),
    pixelsOver24: Math.max(n.pixelsOver24, g.r.differing), pixelsDifferingAtAll: Math.max(n.pixelsDifferingAtAll, g.any), largestStep: Math.max(n.largestStep, g.step),
  }), { share: 0, tileMean: 0, patchMean: 0, pixelsOver24: 0, pixelsDifferingAtAll: 0, largestStep: 0 });
  const sizes = new Map();
  for (const h of hashes) { const at = find(distinct.indexOf(h)); sizes.set(at, (sizes.get(at) ?? 0) + 1); }
  const count = (h) => hashes.filter((x) => x === h).length;
  return {
    distinctPictures: distinct.length,
    // Pairs of runs whose pictures are not the same picture.
    pairsDiffering: gaps.filter((g) => g.any > 0).reduce((n, g) => n + count(distinct[g.i]) * count(distinct[g.j]), 0),
    states: [...sizes.values()].sort((a, b) => b - a),
    noise: worst(gaps),
    steady: worst(gaps.filter((g) => find(g.i) === find(g.j))),
  };
}

/** Compares every pair of runs of each shot in a folder photographNoise made. Resolves { file, wrong }: what noise.json holds. */
function analyzeNoise(dir, log) {
  const made = JSON.parse(readFileSync(join(dir, 'runs.json'), 'utf8'));
  const wrong = [...made.wrong];
  log('comparing every pair');
  const shots = {};
  for (const s of SHOTS) {
    const rows = made.shots[s.id] ?? [];
    const st = statesOf(rows.map((r) => readFileSync(join(dir, s.id, r.file))));
    const wobbles = overPlan(st.noise);
    const steadyNoise = { share: st.steady.share, tileMean: st.steady.tileMean, patchMean: st.steady.patchMean };
    shots[s.id] = {
      runs: rows.length,
      pairs: (rows.length * (rows.length - 1)) / 2,
      pairsDiffering: st.pairsDiffering,
      distinctPictures: st.distinctPictures,
      clockMs: [...new Set(rows.map((r) => r.clockMs))].sort((a, b) => a - b),
      noise: st.noise,
      wobbles,
      ...(wobbles ? { states: st.states, steadyNoise, picturesABuild: WOBBLE_SAMPLES } : {}),
      tolerance: toleranceOf(wobbles ? steadyNoise : st.noise),
    };
    if (rows.length < made.runs) wrong.push(`${s.id}: ${rows.length} of ${made.runs} runs were taken`);
  }
  const wendigo = {};
  for (const s of WENDIGO_MASKS) {
    const rows = made.shots[s.id] ?? [];
    const pics = rows.map((r) => decode(readFileSync(join(dir, s.id, r.file))));
    const counts = pics.map((p) => countMask(p));
    let lowest = 1, pairs = 0;
    for (let i = 0; i < pics.length; i++) for (let j = i + 1; j < pics.length; j++) { pairs++; lowest = Math.min(lowest, maskIoU(pics[i], pics[j]).iou); }
    wendigo[s.id] = {
      runs: rows.length, pairs,
      maskPixels: [...new Set(counts)].sort((a, b) => a - b),
      lowestIoU: pairs ? lowest : 0,
      atLeast: WENDIGO_MIN_IOU,
    };
    if (rows.length < made.runs) wrong.push(`${s.id}: ${rows.length} of ${made.runs} runs were taken`);
    if (counts.some((c) => c === 0)) wrong.push(`${s.id}: a run shows no magenta pixel at all`);
  }
  const { shots: _rows, wrong: _wrong, ...measured } = made;
  const file = {
    about: [
      "The gate's picture noise (plan file 16, section 4.1 d): how much two photographs of the same shot of the same build differ, measured by shooting each shot in separate browser contexts and comparing every pair.",
      `Written by node tools/gate/pictures.mjs --noise --write and read by tools/gate/pictures.mjs. A shot's tolerance is ${TIMES} times its noise, never looser than the plan's figures: at most ${PLAN_LIMITS.share * 100} % of pixels more than 24 of 255 apart (share, 0 to 1) and no tile's mean more than ${PLAN_LIMITS.tileMean} apart, under both readings of "16 x 9 tile" (tileMean: a 16 x 9 grid of tiles; patchMean: tiles of 16 x 9 pixels).`,
      "noise: the largest figure seen over all pairs. pixelsOver24, pixelsDifferingAtAll (by any amount) and largestStep (the largest gap on one channel of one pixel, of 255) are there for a reader; the gate uses share, tileMean and patchMean. distinctPictures is how many different files the runs gave; clockMs is the reading of the page's pinned clock at the shot.",
      'A noise of 0 gives a tolerance of 0: the head must then match the base in every tile mean, which is to say pixel for pixel.',
      `wobbles: true where the noise is over the plan's own figures, so that no tolerance the plan allows covers it. That is a known failure of the game's picture, not of the gate: it is counted in the ratchet pictures.wobblingShots, which may only fall, and named in every report. states is how many runs gave each of its pictures; steadyNoise is the noise between runs of one state, and the tolerance is ${TIMES} times that. The gate photographs such a shot picturesABuild times at the base and up to as often at the head, and calls it the same only when one of the head's pictures matches one of the base's.`,
      "wendigo: the magenta mask of the paddock shot under ?wendigoDebug. maskPixels is the mask's size in each run; lowestIoU the worst overlap between two runs. The gate asks for an overlap of at least atLeast with the base's, whatever the noise.",
      'Raising a figure here loosens the gate. This file is under tools/gate/**, so the gate prints every change to it as a decision for Brian, and the loosest tolerance of all is a ratchet (pictures.loosestTolerance in RATCHETS.json).',
    ],
    measured,
    times: TIMES,
    plan: { share: PLAN_LIMITS.share, tileMean: PLAN_LIMITS.tileMean, threshold: 24 },
    shots,
    wendigo,
  };
  return { file, wrong };
}

async function cli(argv) {
  const has = (flag) => argv.includes(flag);
  const after = (flag) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : undefined; };
  const whole = (flag) => (after(flag) === undefined ? undefined : Number(after(flag)));
  if (has('--help') || has('-h') || !has('--noise')) {
    console.log([
      'The picture gate is a module of the gate: node tools/gate/gate.mjs --milestone none --only pictures',
      '',
      'By hand, to record how much each shot differs from itself (noise.json):',
      '  node tools/gate/pictures.mjs --noise             ten separate contexts a shot on this tree; prints what it found',
      '  node tools/gate/pictures.mjs --noise --write     and writes tools/gate/noise.json',
      '  --runs N (10)  --browsers N (2, started one after the other)  --jobs N (places open at once)',
      '  --from <folder>   compare again the pictures an earlier --noise run left there, photographing nothing',
    ].join('\n'));
    return has('--noise') || has('--help') || has('-h') ? 0 : 64;
  }
  const runs = whole('--runs') ?? NOISE_RUNS;
  const browsers = whole('--browsers') ?? 2;
  const jobs = jobsWanted(whole('--jobs'));
  if (!Number.isInteger(runs) || runs < 2 || !Number.isInteger(browsers) || browsers < 1) { console.error('--runs takes a whole number of 2 or more, --browsers one of 1 or more'); return 64; }
  const log = (line) => console.log(line);
  const dir = has('--from') ? after('--from') : (await photographNoise({ runs, browsers, jobs, log })).dir;
  const { file, wrong } = analyzeNoise(dir, log);
  const text = `${pretty(file)}\n`;
  // Beside the pictures in the cache, whatever happens next.
  writeFileSync(join(dir, 'noise.json'), text);
  console.log(text);
  console.log(`the pictures are under ${dir}, and this report beside them as noise.json`);
  if (wrong.length) {
    console.error(`NOT RECORDED: ${wrong.length} thing${wrong.length === 1 ? '' : 's'} went wrong, so this is not a measurement of the noise:`);
    for (const w of wrong.slice(0, 40)) console.error(`  ${w}`);
    return 1;
  }
  if (file.measured.runs < NOISE_RUNS) console.log(`(${file.measured.runs} runs: the plan asks for ${NOISE_RUNS}, and the gate will say so if this is written)`);
  if (has('--write')) {
    writeFileSync(NOISE_FILE, text);
    console.log('written to tools/gate/noise.json');
  } else console.log('not written: add --write to put it in tools/gate/noise.json');
  return 0;
}

/** True when this file is the command being run, not a module the gate imported (a link in the path is followed). */
function isCommand() {
  try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; }
}

if (isCommand()) {
  cli(process.argv.slice(2)).then((code) => process.exit(code), (e) => { console.error(e?.stack ?? e); process.exit(1); });
}

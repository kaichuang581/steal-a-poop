/**
 * The scenery is built in steps (plan file 17, change 14). A builder is a generator that yields wherever the page may
 * have a turn, between one piece and the next; it returns what it built. `finish` runs one straight through, the way
 * the tools and tests call the builders. `queueBuild` runs them in the page: one after another in the order asked,
 * never two at once, each in timer tasks that hand the page back once 50 ms have gone, so the doors keep moving and
 * a click is answered while the farm goes up. The voxels are the same either way: a builder reads nothing that
 * changes between its steps.
 */
export type Steps<T, Part = never> = Generator<Part | undefined, T, void>;

/** Runs a builder to its end in one go. */
export function finish<T, Part>(steps: Steps<T, Part>): T {
  for (;;) {
    const r = steps.next();
    if (r.done) return r.value;
  }
}

/** Builds one geometry per item, a step each. */
export function* each<A, B>(items: readonly A[], make: (item: A, i: number) => B): Generator<undefined, B[], void> {
  const out: B[] = [];
  for (let i = 0; i < items.length; i++) {
    out.push(make(items[i], i));
    yield;
  }
  return out;
}

/** How long one timer task may build before it hands the page back. */
export const SLICE_MS = 50;

interface Job {
  steps: Steps<unknown, unknown>;
  done: (value: unknown) => void;
  /** Told what a builder yields, when it yields something: a part built so far. */
  part?: (part: unknown) => void;
}
const queue: Job[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
/** Called with a time in ms just before each slice and again as it ends (the resolution judge looks away). */
let around: (ms: number) => void = () => {};

/** The longest slice so far, in ms (read by the tools that measure the build). */
export let longestSlice = 0;

function slice() {
  timer = null;
  around(SLICE_MS * 2);
  const t0 = performance.now();
  try {
    while (queue.length && performance.now() - t0 < SLICE_MS) {
      const job = queue[0];
      let r: IteratorResult<unknown, unknown>;
      // A build that throws is taken out of the queue and never reported done: done with nothing showed an empty sky.
      try { r = job.steps.next(); } catch (e) { queue.shift(); reportError(e); continue; }
      if (r.done) { queue.shift(); job.done(r.value); }
      else if (r.value !== undefined) job.part?.(r.value);
    }
  } finally {
    longestSlice = Math.max(longestSlice, performance.now() - t0);
    around(250); // the frame after a slice waited for it
    if (queue.length) timer = setTimeout(slice, 0);
  }
}

/**
 * Finishes a queued build now, in one go, with everything queued before it (a screen that cannot wait any longer and
 * would rather freeze in the dark than show a piece missing). Nothing happens if it is already built.
 */
export function rush(steps: Steps<unknown, unknown>): void {
  const at = queue.findIndex((j) => j.steps === steps);
  if (at < 0) return;
  const jobs = queue.splice(0, at + 1);
  for (const job of jobs) {
    for (;;) {
      const r = job.steps.next();
      if (r.done) { job.done(r.value); break; }
      if (r.value !== undefined) job.part?.(r.value);
    }
  }
}

/** Builds in the page, after whatever was queued before it. `done` gets what it built. */
export function queueBuild<T, Part = never>(steps: Steps<T, Part>, done: (value: T) => void, options: { part?: (part: Part) => void; around?: (ms: number) => void } = {}): void {
  if (options.around) around = options.around;
  queue.push({ steps, done: done as (v: unknown) => void, part: options.part as ((p: unknown) => void) | undefined });
  timer ??= setTimeout(slice, 0);
}

/** Takes a queued build out of the queue, finished or not: what it built so far is let go. Nothing happens if it is not queued. */
export function dropBuild(steps: Steps<unknown, unknown>): void {
  const at = queue.findIndex((j) => j.steps === steps);
  if (at >= 0) queue.splice(at, 1);
}

export interface RngState {
  rng: number;
}

/** FNV-1a 32-bit hash. Turns any string seed into a starting RNG state. */
export function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mulberry32 step. Mutates `state.rng` and returns a float in [0, 1). */
export function drawRandom(state: RngState): number {
  state.rng = (state.rng + 0x6d2b79f5) | 0;
  let t = Math.imul(state.rng ^ (state.rng >>> 15), 1 | state.rng);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Inclusive integer range. */
export function drawInt(state: RngState, min: number, max: number): number {
  return min + Math.floor(drawRandom(state) * (max - min + 1));
}

export function drawPick<T>(state: RngState, items: readonly T[]): T {
  return items[Math.floor(drawRandom(state) * items.length)];
}

export function shuffle<T>(state: RngState, items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(drawRandom(state) * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

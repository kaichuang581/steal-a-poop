import { load, save } from '../lib/storage';
import type { PredatorKind } from './hunt';

/**
 * The bestiary (plan v7 Part 4.5): one card per predator kind, a silhouette until it is met. It counts every run, first
 * try or tenth; its tallies show on the card and never in the share text. It is a record, never a power (guardrail (a)).
 */
export interface DexEntry {
  met: boolean;
  /** Times this kind has been beaten, on any run. */
  beaten: number;
  /** The highest shown level (Lv) of this kind beaten. */
  highestLevel: number;
  /** The biggest hit ever landed on this kind. */
  bestWord: { word: string; damage: number } | null;
  /** The device's date when it was first met. */
  firstMet?: string;
}
export type Bestiary = Record<PredatorKind, DexEntry>;

export const DEX_KEY = 'sap:hunt-bestiary';
/** In the order the cards are laid out; the Shadow Wolf last. */
export const DEX_ORDER: readonly PredatorKind[] = ['fox', 'wolf', 'lynx', 'eagle', 'bear', 'shadow'];

const blank = (): DexEntry => ({ met: false, beaten: 0, highestLevel: 0, bestWord: null });
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;

/** A stored card, checked field by field; null when it is not a card. */
export function asDexEntry(v: unknown): DexEntry | null {
  if (!v || typeof v !== 'object') return null;
  const e = v as Record<string, unknown>;
  const bw = e.bestWord as Record<string, unknown> | null | undefined;
  const bestOk = bw === null || bw === undefined || (typeof bw === 'object' && typeof bw.word === 'string' && isNum(bw.damage));
  if (typeof e.met !== 'boolean' || !isNum(e.beaten) || !isNum(e.highestLevel) || !bestOk) return null;
  if (e.firstMet !== undefined && typeof e.firstMet !== 'string') return null;
  return {
    met: e.met, beaten: e.beaten, highestLevel: e.highestLevel,
    bestWord: bw ? { word: bw.word as string, damage: bw.damage as number } : null,
    ...(typeof e.firstMet === 'string' ? { firstMet: e.firstMet } : {}),
  };
}

/** Every card, with the default for any kind not stored (or stored badly). */
export function readBestiary(): Bestiary {
  const raw = load<unknown>(DEX_KEY, {});
  const stored = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const out = {} as Bestiary;
  for (const k of DEX_ORDER) out[k] = asDexEntry(stored[k]) ?? blank();
  return out;
}

function write(b: Bestiary): void { save(DEX_KEY, b); }

/** A predator appeared: its card turns over, with the date the first time. */
export function meet(kind: PredatorKind, date: string): void {
  const b = readBestiary();
  if (b[kind].met) return;
  b[kind] = { ...b[kind], met: true, firstMet: b[kind].firstMet ?? date };
  write(b);
}

/** A predator fainted: one more beaten, the higher level kept, the bigger hit kept. */
export function beat(kind: PredatorKind, level: number, word: { word: string; damage: number } | null): void {
  const b = readBestiary();
  const e = b[kind];
  b[kind] = {
    ...e, met: true, beaten: e.beaten + 1, highestLevel: Math.max(e.highestLevel, level),
    bestWord: word && (!e.bestWord || word.damage > e.bestWord.damage) ? word : e.bestWord,
  };
  write(b);
}

export function dexProgress(b: Bestiary): { met: number; beaten: number; of: 6 } {
  const cards = DEX_ORDER.map((k) => b[k]);
  return { met: cards.filter((e) => e.met).length, beaten: cards.filter((e) => e.beaten > 0).length, of: 6 };
}

/** Two cards merged for the save code: per-field maxima, the bigger best word, the earlier first meeting. */
export function mergeDex(a: DexEntry, b: DexEntry): DexEntry {
  const firstMet = [a.firstMet, b.firstMet].filter((d): d is string => !!d).sort()[0];
  const bestWord = !a.bestWord ? b.bestWord : !b.bestWord ? a.bestWord : b.bestWord.damage > a.bestWord.damage ? b.bestWord : a.bestWord;
  return {
    met: a.met || b.met, beaten: Math.max(a.beaten, b.beaten), highestLevel: Math.max(a.highestLevel, b.highestLevel), bestWord,
    ...(firstMet ? { firstMet } : {}),
  };
}

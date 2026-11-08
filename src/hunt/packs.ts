import { load, save } from '../lib/storage';

/**
 * Packs played on this device (plan v7 Part 4.1): the last 100 codes, how many times each was fought and its best.
 * The attempt number is the only thing that separates a first try from a rerun; nothing is locked.
 */
export interface PackRecord {
  code: string;
  attempts: number;
  best: { defeated: number; damage: number };
}

export const PACKS_KEY = 'sap:hunt-packs';
export const PACKS_MAX = 100;

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
export function isPackRecord(v: unknown): v is PackRecord {
  if (!v || typeof v !== 'object') return false;
  const p = v as Record<string, unknown>;
  const b = p.best as Record<string, unknown> | undefined;
  return typeof p.code === 'string' && isNum(p.attempts) && !!b && isNum(b.defeated) && isNum(b.damage);
}

/** Every pack on record, least recently played first. */
export function readPacks(): PackRecord[] {
  const raw = load<unknown>(PACKS_KEY, []);
  return Array.isArray(raw) ? raw.filter(isPackRecord) : [];
}

/** The attempt number the next run of this code will be: 1 for a code never fought here. */
export function attemptOf(code: string): number {
  return (readPacks().find((p) => p.code === code)?.attempts ?? 0) + 1;
}

/** Counts a finished run of the code (any ending) and keeps its best. Returns the attempt number it was. */
export function recordAttempt(code: string, result: { defeated: number; damage: number }): number {
  const packs = readPacks();
  const old = packs.find((p) => p.code === code);
  const better = !old || result.defeated > old.best.defeated || (result.defeated === old.best.defeated && result.damage > old.best.damage);
  const rec: PackRecord = {
    code, attempts: (old?.attempts ?? 0) + 1,
    best: better ? { defeated: result.defeated, damage: result.damage } : old!.best,
  };
  save(PACKS_KEY, [...packs.filter((p) => p.code !== code), rec].slice(-PACKS_MAX));
  return rec.attempts;
}

/** The pack played most recently, for the lobby's "last pack" line. */
export function lastPack(): PackRecord | null {
  return readPacks().at(-1) ?? null;
}

/** 1st, 2nd, 3rd, 4th ... 11th, 12th, 13th, 21st. */
export function ordinal(n: number): string {
  const t = n % 100;
  const s = t >= 11 && t <= 13 ? 'th' : n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th';
  return `${n}${s}`;
}

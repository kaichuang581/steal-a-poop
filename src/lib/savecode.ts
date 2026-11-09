import { ADMIN_AVATAR_ID, isAvatarId } from '../avatars/ids';

/**
 * The save code (plan v7 Part 6): a copy-and-paste text that carries a player's records to another browser, because
 * school Chromebooks wipe profiles and Safari clears script storage after a week away. `FTW1.` + base64url of
 * `{ v: 1, at, data: { key: value } }` + `.` + an 8-hex FNV-1a checksum of the base64 part. Import checks the prefix,
 * the checksum and each record's shape, skips what it cannot read, and merges, never lowering a best.
 * Records only: never admin, guest, server, mute or volume.
 */
export const SAVE_PREFIX = 'FTW1.';
export const MAX_CODE_LENGTH = 100_000;

type Json = unknown;
interface Spec {
  key: string;
  /** How the change reads in the summary: "the dream streak". */
  label: string;
  /** Stored as plain text rather than JSON (the avatar). */
  raw?: boolean;
  /** The value if it is the right shape, else null. */
  valid(v: Json): Json | null;
  /** Local and imported, merged; local is undefined when this device has none. */
  merge(local: Json | undefined, incoming: Json): Json;
  /** Imported only when the local value is at its default (absent). */
  onlyIfDefault?: boolean;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

interface Streak { count: number; last: string; best: number; blankets: number; earnedAt: number; covered?: boolean }

/** Records older versions saved that this one no longer has. */
const RETIRED_KEYS: readonly string[] = ['sap:hunt-best', 'sap:hunt-bestiary', 'sap:hunt-packs', 'sap:hunt-log'];

export const SAVE_KEYS: readonly Spec[] = [
  {
    key: 'sap:dream', label: "the last night's dream",
    valid: (v) => (isObj(v) && isDate(v.date) && (v.status === 'started' || v.status === 'done') ? v : null),
    merge: (l, i) => {
      if (!l) return i;
      const a = l as { date: string; status: string }, b = i as { date: string; status: string };
      if (b.date !== a.date) return b.date > a.date ? b : a;
      return a.status === 'done' ? a : b;
    },
  },
  {
    key: 'sap:dream-streak', label: 'the dream streak',
    valid: (v) => (isObj(v) && isNum(v.count) && typeof v.last === 'string' && (v.best === undefined || isNum(v.best)) && (v.blankets === undefined || isNum(v.blankets)) ? v : null),
    merge: (l, i) => {
      if (!l) return i;
      const a = l as Streak, b = i as Streak;
      const later = b.last > a.last ? b : a;
      return { ...later, best: Math.max(a.best ?? 0, b.best ?? 0, a.count, b.count), blankets: Math.max(a.blankets ?? 0, b.blankets ?? 0) };
    },
  },
  { key: 'sap:dream-best', label: 'the dream best', valid: (v) => (isNum(v) ? v : null), merge: (l, i) => Math.max((l as number) ?? 0, i as number) },
  {
    key: 'sap:dream-covered', label: 'the blanket nights',
    valid: (v) => (Array.isArray(v) && v.every(isDate) ? v : null),
    merge: (l, i) => [...new Set([...((l ?? []) as string[]), ...(i as string[])])].sort().slice(-14),
  },
  {
    key: 'sap:dream-repaired', label: 'the repaired night',
    valid: (v) => (isDate(v) ? v : null),
    merge: (l, i) => (!l || (i as string) > (l as string) ? i : l),
  },
  {
    key: 'sap:practice-best', label: 'the practice bests',
    valid: (v) => (isObj(v) && Object.values(v).every(isNum) ? v : null),
    merge: (l, i) => {
      const out: Record<string, number> = { ...((l ?? {}) as Record<string, number>) };
      for (const [k, n] of Object.entries(i as Record<string, number>)) out[k] = Math.max(out[k] ?? 0, n);
      return out;
    },
  },
  {
    key: 'sap:record', label: 'your game records',
    valid: (v) => (isObj(v) && (v.played === undefined || isNum(v.played)) && (v.results === undefined || (Array.isArray(v.results) && v.results.every((r) => typeof r === 'boolean')))
      && (v.bests === undefined || (isObj(v.bests) && (v.bests.wool === undefined || isNum(v.bests.wool)) && (v.bests.longest === undefined || typeof v.bests.longest === 'string'))) ? v : null),
    merge: (l, i) => {
      if (!l) return i;
      type Rec = { played?: number; results?: boolean[]; bests?: { wool?: number; longest?: string } };
      const a = l as Rec, b = i as Rec;
      const newer = (b.played ?? 0) > (a.played ?? 0) ? b : a;
      const la = a.bests?.longest ?? '', lb = b.bests?.longest ?? '';
      return {
        ...newer, played: Math.max(a.played ?? 0, b.played ?? 0),
        bests: { wool: Math.max(a.bests?.wool ?? 0, b.bests?.wool ?? 0), longest: lb.length > la.length ? lb : la },
      };
    },
  },
  {
    key: 'sap:avatar', label: 'your avatar', raw: true, onlyIfDefault: true,
    valid: (v) => (isAvatarId(v) && v !== ADMIN_AVATAR_ID ? v : null),
    merge: (l, i) => l ?? i,
  },
  {
    key: 'sap:settings', label: 'your name and table', onlyIfDefault: true,
    valid: settingsFromCode,
    merge: (l, i) => l ?? i,
  },
];

/**
 * The settings record from a pasted code, keeping only known fields with values the game can offer: a code shared
 * around ("free records!") must not be able to give someone a billion wool balls or a broken clock. Unknown or
 * out-of-range fields are dropped, and the game fills them in with its defaults.
 */
function settingsFromCode(v: unknown): Json | null {
  if (!isObj(v)) return null;
  if (v.name !== undefined && (typeof v.name !== 'string' || v.name.length > 40)) return null;
  const pick = <T>(x: unknown, ok: readonly T[]): T | undefined => (ok.includes(x as T) ? (x as T) : undefined);
  const levels = ['easy', 'medium', 'hard'] as const;
  const out: Record<string, Json> = {};
  if (typeof v.name === 'string') out.name = v.name;
  const players = pick(v.playerCount, [4, 5, 6, 7, 8, 9, 10]);
  if (players !== undefined) out.playerCount = players;
  const level = pick(v.difficulty, levels);
  if (level) out.difficulty = level;
  if (v.tableChosen === true) out.tableChosen = true;
  if (isObj(v.game)) {
    const g = v.game, game: Record<string, Json> = {};
    const rounds = pick(g.rounds, [1, 2, 3, 5]); if (rounds !== undefined) game.rounds = rounds;
    const turns = pick(g.turnsPerRound, [2, 3, 5, 7]); if (turns !== undefined) game.turnsPerRound = turns;
    const lives = pick(g.lives, [1, 2, 3, 5, 'unlimited']); if (lives !== undefined) game.lives = lives;
    if (typeof g.twists === 'boolean') game.twists = g.twists;
    const bots = pick(g.botCount, [3, 4, 5, 6, 7, 8, 9]); if (bots !== undefined) game.botCount = bots;
    const botLevel = pick(g.botDifficulty, levels); if (botLevel) game.botDifficulty = botLevel;
    const carry = pick(g.timeCarry, ['off', 'more', 'less']); if (carry) game.timeCarry = carry;
    out.game = game;
  }
  if (isObj(v.practice)) {
    const clock = pick(v.practice.clock, [5, 10, 15]), level2 = pick(v.practice.difficulty, levels);
    if (clock !== undefined && level2) out.practice = { clock, difficulty: level2 };
  }
  return out;
}

// ---------- encoding ----------
function fnv(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h.toString(16).padStart(8, '0');
}
function toB64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64Url(b64: string): string {
  const bin = atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}
function encode(payload: object): string {
  const b64 = toB64Url(JSON.stringify(payload));
  return `${SAVE_PREFIX}${b64}.${fnv(b64)}`;
}

function readLocal(spec: Spec): Json | undefined {
  try {
    const raw = localStorage.getItem(spec.key);
    if (raw === null) return undefined;
    const v = spec.raw ? raw : JSON.parse(raw);
    return spec.valid(v) ?? undefined;
  } catch { return undefined; }
}
function writeLocal(spec: Spec, v: Json): void {
  try { localStorage.setItem(spec.key, spec.raw ? String(v) : JSON.stringify(v)); } catch { /* storage blocked */ }
}

/** Every record on this device as one code. */
export function exportSave(now = new Date()): string {
  const data: Record<string, Json> = {};
  for (const spec of SAVE_KEYS) {
    const v = readLocal(spec);
    if (v !== undefined) data[spec.key] = v;
  }
  return encode({ v: 1, at: now.toISOString(), data });
}

export type Change = 'new' | 'merged' | 'same' | 'kept';
export interface ImportRow { key: string; label: string; change: Change }
export type ImportPlan =
  | { ok: false; reason: string }
  | { ok: true; at: string; rows: ImportRow[]; skipped: string[]; values: Record<string, Json>; summary: string };

/** Reads a pasted code and works out what restoring it would change, without writing anything (the dry run). */
export function planImport(input: string): ImportPlan {
  const code = input.trim().replace(/\s+/g, '');
  if (code.length > MAX_CODE_LENGTH) return { ok: false, reason: 'That code is too long to be a save code.' };
  if (!code.startsWith(SAVE_PREFIX)) return { ok: false, reason: "That isn't a save code: it should start with FTW1." };
  const body = code.slice(SAVE_PREFIX.length);
  const dot = body.lastIndexOf('.');
  if (dot < 0) return { ok: false, reason: 'That save code is cut short.' };
  const b64 = body.slice(0, dot), sum = body.slice(dot + 1);
  if (fnv(b64) !== sum.toLowerCase()) return { ok: false, reason: "That save code doesn't add up: a letter was changed or missed when it was copied." };
  let payload: unknown;
  try { payload = JSON.parse(fromB64Url(b64)); } catch { return { ok: false, reason: 'That save code could not be read.' }; }
  if (!isObj(payload) || payload.v !== 1 || !isObj(payload.data)) return { ok: false, reason: 'That save code is from a version this game cannot read.' };
  const data = payload.data;
  const rows: ImportRow[] = [], skipped: string[] = [], values: Record<string, Json> = {};
  for (const spec of SAVE_KEYS) {
    if (!(spec.key in data)) continue;
    const incoming = spec.valid(data[spec.key]);
    if (incoming === null) { skipped.push(spec.label); continue; }
    const local = readLocal(spec);
    if (spec.onlyIfDefault && local !== undefined) { rows.push({ key: spec.key, label: spec.label, change: 'kept' }); continue; }
    const merged = spec.merge(local, incoming);
    const same = local !== undefined && JSON.stringify(merged) === JSON.stringify(local);
    rows.push({ key: spec.key, label: spec.label, change: local === undefined ? 'new' : same ? 'same' : 'merged' });
    if (!same) values[spec.key] = merged;
  }
  // Keys this version does not know are skipped, never written. The Hunt's records (removed in 0.5.0) are dropped quietly:
  // a code saved before then is still good, there is just nothing left to restore them into.
  for (const k of Object.keys(data)) if (!SAVE_KEYS.some((s) => s.key === k) && !RETIRED_KEYS.includes(k)) skipped.push(k);
  const total = rows.length + skipped.length;
  const restored = rows.filter((r) => r.change === 'new' || r.change === 'merged' || r.change === 'same').length;
  const summary = `${restored} of ${total} records restored${skipped.length ? `; ${skipped.join(', ')} ${skipped.length === 1 ? 'was' : 'were'} unreadable` : ''}.`;
  return { ok: true, at: typeof payload.at === 'string' ? payload.at : '', rows, skipped, values, summary };
}

/** Writes a planned import. Returns the plan's summary, or the reason it could not be restored. */
export function applyImport(input: string): ImportPlan {
  const plan = planImport(input);
  if (!plan.ok) return plan;
  for (const spec of SAVE_KEYS) if (spec.key in plan.values) writeLocal(spec, plan.values[spec.key]);
  return plan;
}

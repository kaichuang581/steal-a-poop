import { load, save } from '../lib/storage';
import type { PredatorKind } from './hunt';

/**
 * The Hunt's run log (plan v7 Part 3): one entry per run, kept on this device only, the last 50. It is the Hunt's only
 * telemetry: nothing leaves the device unless the log is copied out of the admin panel by hand.
 */
export type RunCause = 'timeout' | 'broke' | 'hits' | 'walk' | 'left';

export interface RunLog {
  /** The pack code; 'legacy' for runs from before pack codes. */
  code: string;
  /** 1 for the first run of this code on this device. */
  attempt: number;
  /** The device's local date, e.g. 2026-11-07. */
  date: string;
  defeated: number;
  damage: number;
  words: number;
  level: number;
  /** The predator on screen when the run ended. */
  reached: PredatorKind;
  cause: RunCause;
  /** The rule's id when the cause is 'broke'. */
  brokeRule?: string;
  /** Marks (turns) spent on the last predator. */
  turnsAtDeath: number;
  itemsLeft: { milk: number; bell: number; pepper: number };
  /** Wall-clock seconds of the run, rounded. */
  seconds: number;
  wordsVersion: number;
}

export const LOG_KEY = 'sap:hunt-log';
export const LOG_MAX = 50;

const CAUSES: readonly RunCause[] = ['timeout', 'broke', 'hits', 'walk', 'left'];
const KINDS: readonly PredatorKind[] = ['wolf', 'fox', 'lynx', 'bear', 'eagle', 'shadow'];
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Whether a stored value is a log entry of the right shape (used here and by the save code). */
export function isRunLog(v: unknown): v is RunLog {
  if (!v || typeof v !== 'object') return false;
  const e = v as Record<string, unknown>;
  const items = e.itemsLeft as Record<string, unknown> | undefined;
  return typeof e.code === 'string' && isNum(e.attempt) && typeof e.date === 'string' && isNum(e.defeated) && isNum(e.damage)
    && isNum(e.words) && isNum(e.level) && KINDS.includes(e.reached as PredatorKind) && CAUSES.includes(e.cause as RunCause)
    && (e.brokeRule === undefined || typeof e.brokeRule === 'string') && isNum(e.turnsAtDeath)
    && !!items && isNum(items.milk) && isNum(items.bell) && isNum(items.pepper) && isNum(e.seconds) && isNum(e.wordsVersion);
}

/** The log, oldest first. A malformed stored value is ignored and the log starts fresh. */
export function readLog(): RunLog[] {
  const raw = load<unknown>(LOG_KEY, []);
  return Array.isArray(raw) ? raw.filter(isRunLog) : [];
}

/** Adds one run, keeping the last LOG_MAX. */
export function appendLog(entry: RunLog): void {
  save(LOG_KEY, [...readLog(), entry].slice(-LOG_MAX));
}

/** Where the predator index of the run's end is: the predator reached, which a walk home has already beaten. */
function endIndex(e: RunLog): number {
  return e.cause === 'walk' ? Math.max(0, e.defeated - 1) : e.defeated;
}

export interface LogSummary {
  /** Runs that ended at each predator index, by cause ('left' runs are not counted here). */
  byPredator: Record<number, { timeout: number; broke: number; hits: number; walk: number }>;
  /** Runs that died at the first predator (time-out, broken rule or its strikes). */
  firstFoxDeaths: number;
  medianDefeated: number;
}

export function logSummary(log: RunLog[]): LogSummary {
  const byPredator: LogSummary['byPredator'] = {};
  let firstFoxDeaths = 0;
  for (const e of log) {
    if (e.cause === 'left') continue;
    const i = endIndex(e);
    const row = (byPredator[i] ??= { timeout: 0, broke: 0, hits: 0, walk: 0 });
    row[e.cause] += 1;
    if (i === 0 && e.cause !== 'walk') firstFoxDeaths += 1;
  }
  const sorted = log.map((e) => e.defeated).sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  const medianDefeated = !sorted.length ? 0 : sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return { byPredator, firstFoxDeaths, medianDefeated };
}

/** The dev overlay's one line: runs, deaths at the first predator by cause, and the median beaten. */
export function logLine(log: RunLog[]): string {
  const s = logSummary(log);
  const first = s.byPredator[0] ?? { timeout: 0, broke: 0, hits: 0, walk: 0 };
  return `log: ${log.length} run${log.length === 1 ? '' : 's'} · first-predator deaths ${s.firstFoxDeaths} (timeout ${first.timeout}, broke ${first.broke}, hits ${first.hits}) · median beaten ${s.medianDefeated}`;
}

/** The whole log as pretty JSON, for the admin panel's copy button. */
export function exportLog(now = new Date()): string {
  return JSON.stringify({ exported: now.toISOString(), version: 1, runs: readLog() }, null, 2);
}

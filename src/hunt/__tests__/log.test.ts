import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appendLog, exportLog, LOG_KEY, LOG_MAX, logLine, logSummary, readLog } from '../log';
import type { RunLog } from '../log';

function memoryStorage(): Map<string, string> {
  const data = new Map<string, string>();
  (globalThis as { localStorage?: Storage }).localStorage = {
    getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k), clear: () => data.clear(), key: () => null, get length() { return data.size; },
  } as Storage;
  return data;
}

const entry = (over: Partial<RunLog> = {}): RunLog => ({
  code: 'legacy', attempt: 1, date: '2026-11-07', defeated: 0, damage: 20, words: 2, level: 5, reached: 'fox', cause: 'timeout',
  turnsAtDeath: 4, itemsLeft: { milk: 2, bell: 1, pepper: 1 }, seconds: 61, wordsVersion: 1, ...over,
});

describe('the run log', () => {
  let data: Map<string, string>;
  beforeEach(() => { data = memoryStorage(); });
  afterEach(() => { delete (globalThis as { localStorage?: Storage }).localStorage; });

  it('keeps the last 50 runs, oldest first', () => {
    for (let i = 0; i < LOG_MAX + 7; i++) appendLog(entry({ damage: i }));
    const log = readLog();
    expect(log).toHaveLength(LOG_MAX);
    expect(log[0].damage).toBe(7);
    expect(log.at(-1)!.damage).toBe(LOG_MAX + 6);
  });

  it('counts causes per predator index, deaths at the first predator, and the median beaten', () => {
    const log = [
      entry({ cause: 'timeout' }), entry({ cause: 'timeout' }), entry({ cause: 'broke', brokeRule: 'bane' }),
      entry({ cause: 'hits', defeated: 2 }), entry({ cause: 'walk', defeated: 5 }), entry({ cause: 'left', defeated: 1 }),
    ];
    const s = logSummary(log);
    expect(s.byPredator[0]).toEqual({ timeout: 2, broke: 1, hits: 0, walk: 0 });
    expect(s.byPredator[2]).toEqual({ timeout: 0, broke: 0, hits: 1, walk: 0 });
    expect(s.byPredator[4]).toEqual({ timeout: 0, broke: 0, hits: 0, walk: 1 }); // walked home after beating the boss at index 4
    expect(s.firstFoxDeaths).toBe(3);
    expect(s.medianDefeated).toBe(0.5); // 0 0 0 1 2 5
    expect(logLine(log)).toBe('log: 6 runs · first-predator deaths 3 (timeout 2, broke 1, hits 0) · median beaten 0.5');
  });

  it('exports valid JSON that parses back to the same runs', () => {
    appendLog(entry());
    appendLog(entry({ cause: 'broke', brokeRule: 'min5', reached: 'wolf' }));
    const parsed = JSON.parse(exportLog(new Date('2026-11-07T12:00:00Z')));
    expect(parsed.version).toBe(1);
    expect(parsed.exported).toBe('2026-11-07T12:00:00.000Z');
    expect(parsed.runs).toEqual(readLog());
  });

  it('ignores a malformed stored value and starts fresh', () => {
    data.set(LOG_KEY, '{not json');
    expect(readLog()).toEqual([]);
    data.set(LOG_KEY, JSON.stringify({ runs: 3 }));
    expect(readLog()).toEqual([]);
    data.set(LOG_KEY, JSON.stringify([entry(), { code: 7 }]));
    expect(readLog()).toEqual([entry()]);
    appendLog(entry({ damage: 99 }));
    expect(readLog().map((e) => e.damage)).toEqual([20, 99]);
  });
});

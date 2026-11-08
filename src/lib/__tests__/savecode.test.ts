import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyImport, exportSave, MAX_CODE_LENGTH, planImport, SAVE_PREFIX } from '../savecode';

let data: Map<string, string>;
beforeEach(() => {
  data = new Map();
  (globalThis as { localStorage?: Storage }).localStorage = {
    getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k), clear: () => data.clear(), key: () => null, get length() { return data.size; },
  } as Storage;
});
afterEach(() => { delete (globalThis as { localStorage?: Storage }).localStorage; });

const set = (k: string, v: unknown) => data.set(k, JSON.stringify(v));
const get = (k: string) => JSON.parse(data.get(k)!);
const run = (damage: number) => ({ code: 'K7QX1', attempt: 1, date: '2026-11-07', defeated: 1, damage, words: 3, level: 6, reached: 'wolf', cause: 'timeout', turnsAtDeath: 2, itemsLeft: { milk: 2, bell: 1, pepper: 1 }, seconds: 50, wordsVersion: 1 });

function populate() {
  set('sap:hunt-best', { defeated: 4, damage: 560, code: 'K7QX1', attempt: 2 });
  set('sap:hunt-bestiary', { fox: { met: true, beaten: 3, highestLevel: 7, bestWord: { word: 'blizzard', damage: 48 }, firstMet: '2026-11-02' } });
  set('sap:hunt-packs', [{ code: 'K7QX1', attempts: 2, best: { defeated: 4, damage: 560 } }]);
  set('sap:hunt-log', [run(40), run(80)]);
  set('sap:dream', { date: '2026-11-07', status: 'done', count: 30 });
  set('sap:dream-streak', { count: 5, last: '2026-11-07', best: 9, blankets: 1, earnedAt: 0 });
  set('sap:dream-best', 30);
  set('sap:practice-best', { '15:easy': 22 });
  set('sap:record', { played: 8, results: [true, false, true], bests: { wool: 3, longest: 'blizzard' } });
  data.set('sap:avatar', 'goat');
  set('sap:settings', { name: 'Brian', playerCount: 4 });
  // Never exported:
  set('sap:admin', true);
  set('sap:volume', 0.4);
}

describe('the save code', () => {
  it('round-trips every record to an empty browser', () => {
    populate();
    const code = exportSave(new Date('2026-11-07T10:00:00Z'));
    expect(code.startsWith(SAVE_PREFIX)).toBe(true);
    expect(code).not.toContain('admin');
    const before = new Map(data);
    data.clear();
    const plan = applyImport(code);
    expect(plan.ok && plan.summary).toBe('11 of 11 records restored.');
    for (const k of ['sap:hunt-best', 'sap:hunt-bestiary', 'sap:hunt-packs', 'sap:hunt-log', 'sap:dream', 'sap:dream-streak', 'sap:dream-best', 'sap:practice-best', 'sap:record', 'sap:settings']) {
      expect(JSON.parse(data.get(k)!), k).toEqual(JSON.parse(before.get(k)!));
    }
    expect(data.get('sap:avatar')).toBe('goat');
    expect(data.has('sap:admin') || data.has('sap:volume')).toBe(false);
  });

  it('a flipped character fails the checksum', () => {
    populate();
    const code = exportSave();
    const i = SAVE_PREFIX.length + 20;
    const flipped = code.slice(0, i) + (code[i] === 'A' ? 'B' : 'A') + code.slice(i + 1);
    const plan = planImport(flipped);
    expect(plan.ok).toBe(false);
    expect(!plan.ok && plan.reason).toMatch(/doesn't add up/);
    expect(planImport('hello').ok).toBe(false);
  });

  it('skips an unknown key, and a record of the wrong shape, and says so', () => {
    const b64 = (s: string) => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const fnv = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0; return h.toString(16).padStart(8, '0'); };
    const body = b64(JSON.stringify({ v: 1, at: 'x', data: {
      'sap:hunt-best': { defeated: 2, damage: 90 },
      'sap:hunt-bestiary': { fox: { met: true, beaten: 'twelve', highestLevel: 5, bestWord: null } },
      'sap:admin': true,
    } }));
    const plan = applyImport(`${SAVE_PREFIX}${body}.${fnv(body)}`);
    expect(plan.ok && plan.summary).toBe('1 of 3 records restored; the bestiary, sap:admin were unreadable.');
    expect(get('sap:hunt-best')).toEqual({ defeated: 2, damage: 90 });
    expect(data.has('sap:hunt-bestiary') || data.has('sap:admin')).toBe(false);
  });

  it('merges: never lowers a best, takes per-field maxima, keeps local settings and avatar', () => {
    populate();
    const code = exportSave();
    // This device: a better Hunt best, a weaker bestiary card, a different name and avatar, a longer streak behind.
    set('sap:hunt-best', { defeated: 6, damage: 100 });
    set('sap:hunt-bestiary', { fox: { met: true, beaten: 5, highestLevel: 6, bestWord: { word: 'cat', damage: 9 }, firstMet: '2026-11-05' }, wolf: { met: true, beaten: 0, highestLevel: 0, bestWord: null } });
    set('sap:dream-streak', { count: 2, last: '2026-11-03', best: 12, blankets: 0, earnedAt: 0 });
    set('sap:dream-best', 41);
    set('sap:hunt-log', [run(80), run(10)]);
    set('sap:settings', { name: 'Kai' });
    data.set('sap:avatar', 'pig');
    const plan = planImport(code);
    expect(plan.ok).toBe(true);
    // The dry run writes nothing.
    expect(get('sap:hunt-best')).toEqual({ defeated: 6, damage: 100 });
    applyImport(code);
    expect(get('sap:hunt-best')).toEqual({ defeated: 6, damage: 100 });
    expect(get('sap:hunt-bestiary').fox).toEqual({ met: true, beaten: 5, highestLevel: 7, bestWord: { word: 'blizzard', damage: 48 }, firstMet: '2026-11-02' });
    expect(get('sap:hunt-bestiary').wolf.met).toBe(true);
    expect(get('sap:dream-streak')).toMatchObject({ count: 5, last: '2026-11-07', best: 12, blankets: 1 });
    expect(get('sap:dream-best')).toBe(41);
    expect(get('sap:hunt-log').map((e: { damage: number }) => e.damage).sort()).toEqual([10, 40, 80]);
    expect(get('sap:settings')).toEqual({ name: 'Kai' });
    expect(data.get('sap:avatar')).toBe('pig');
    expect(plan.ok && plan.rows.find((r) => r.key === 'sap:settings')!.change).toBe('kept');
  });

  it('refuses a code over 100 KB, and trims the oldest log runs to stay under it', () => {
    expect(planImport(SAVE_PREFIX + 'A'.repeat(MAX_CODE_LENGTH)).ok).toBe(false);
    set('sap:hunt-log', Array.from({ length: 50 }, (_, i) => ({ ...run(i), code: 'X'.repeat(3000) })));
    const code = exportSave();
    expect(code.length).toBeLessThanOrEqual(MAX_CODE_LENGTH);
    const plan = planImport(code);
    expect(plan.ok).toBe(true);
  });
});

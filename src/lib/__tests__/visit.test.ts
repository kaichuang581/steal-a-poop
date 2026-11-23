import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The visit ping: what a tab tells the server, and when it stays quiet.
function memoryStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => (m.has(k) ? m.get(k)! : null), setItem: (k: string, v: string) => { m.set(k, String(v)); }, removeItem: (k: string) => { m.delete(k); } };
}

let sent: Array<{ url: string; body: { tab: string; open: boolean; first: boolean; unique?: { day: boolean; week: boolean; month: boolean } } }>;
let visibility: 'visible' | 'hidden';
let listeners: Array<() => void>;
let admin = false;

vi.mock('../../auth/config', () => ({ apiBase: () => { const b = (globalThis as { __base?: string | null }).__base; return b === undefined ? 'http://srv.test' : b; } }));
vi.mock('../admin', () => ({ useAdmin: { getState: () => ({ admin }) } }));

async function load() {
  vi.resetModules();
  return import('../visit');
}

beforeEach(() => {
  sent = [];
  visibility = 'visible';
  listeners = [];
  admin = false;
  (globalThis as { __base?: string | null }).__base = undefined;
  vi.useFakeTimers();
  vi.stubGlobal('sessionStorage', memoryStorage());
  vi.stubGlobal('localStorage', memoryStorage());
  vi.stubGlobal('navigator', { webdriver: false });
  vi.stubGlobal('document', {
    get visibilityState() { return visibility; },
    addEventListener: (_: string, f: () => void) => { listeners.push(f); },
    removeEventListener: (_: string, f: () => void) => { listeners = listeners.filter((x) => x !== f); },
  });
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: { body: string }) => { sent.push({ url, body: JSON.parse(init.body) }); return { ok: true }; }));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('telling the server a tab is open', () => {
  it('says whether an opening tab is the browser\'s first visit of the day, week and month, and keeps only the day', async () => {
    vi.setSystemTime(Date.UTC(2026, 10, 18, 10)); // Wednesday 18 November
    localStorage.setItem('sap:seen', '1');
    localStorage.setItem('sap:last-visit', '2026-11-18');
    (await load()).startVisitReports();
    expect(sent[0].body.unique).toEqual({ day: false, week: false, month: false });
    expect(localStorage.getItem('sap:last-visit')).toBe('2026-11-18');
    sessionStorage.removeItem('sap:tab');
    localStorage.setItem('sap:last-visit', '2026-11-16'); // Monday of the same week
    (await load()).startVisitReports();
    expect(sent[1].body.unique).toEqual({ day: true, week: false, month: false });
    sessionStorage.removeItem('sap:tab');
    localStorage.setItem('sap:last-visit', '2026-11-15'); // the Sunday before
    (await load()).startVisitReports();
    expect(sent[2].body.unique).toEqual({ day: true, week: true, month: false });
    sessionStorage.removeItem('sap:tab');
    localStorage.setItem('sap:last-visit', '2026-10-30');
    (await load()).startVisitReports();
    expect(sent[3].body.unique).toEqual({ day: true, week: true, month: true });
    expect(localStorage.getItem('sap:last-visit')).toBe('2026-11-18');
  });

  it('says "opened" once, with a code that is only a random string, and "new browser" the first time', async () => {
    const { startVisitReports } = await load();
    startVisitReports();
    expect(sent).toHaveLength(1);
    expect(sent[0].url).toBe('http://srv.test/api/site/ping');
    expect(sent[0].body).toMatchObject({ open: true, first: true });
    expect(sent[0].body.tab).toMatch(/^[0-9a-f]{24}$/);
    expect(Object.keys(sent[0].body).sort()).toEqual(['first', 'open', 'tab', 'unique']);
    expect(sent[0].body).toMatchObject({ unique: { day: true, week: true, month: true } });
  });

  it('is not a new visit on a refresh in the same tab, and not a new browser the second time', async () => {
    const { startVisitReports } = await load();
    startVisitReports();
    const firstCode = sent[0].body.tab;
    const again = await load();
    again.startVisitReports(); // the same tab, loaded again
    expect(sent[1].body).toEqual({ tab: firstCode, open: false, first: false });
    sessionStorage.removeItem('sap:tab'); // a new tab in the same browser
    const third = await load();
    third.startVisitReports();
    expect(sent[2].body).toMatchObject({ open: true, first: false });
    expect(sent[2].body.tab).not.toBe(firstCode);
  });

  it('keeps saying it is there every 45 s while on screen, and stops while hidden', async () => {
    const { startVisitReports, PING_EVERY_MS } = await load();
    startVisitReports();
    vi.advanceTimersByTime(PING_EVERY_MS);
    vi.advanceTimersByTime(PING_EVERY_MS);
    expect(sent.map((s) => s.body.open)).toEqual([true, false, false]);
    visibility = 'hidden';
    vi.advanceTimersByTime(PING_EVERY_MS * 3);
    expect(sent).toHaveLength(3);
    visibility = 'visible';
    listeners.forEach((f) => f()); // coming back to the tab says so at once
    expect(sent).toHaveLength(4);
  });

  it('counts a tab opened in the background only once it is seen', async () => {
    visibility = 'hidden';
    const { startVisitReports } = await load();
    startVisitReports();
    expect(sent).toHaveLength(0);
    visibility = 'visible';
    listeners.forEach((f) => f());
    expect(sent.map((s) => s.body.open)).toEqual([true]);
  });

  it('stays quiet for the admin, for automated browsers, and with no game server', async () => {
    admin = true;
    let m = await load();
    m.startVisitReports();
    expect(sent).toHaveLength(0);
    admin = false;
    vi.stubGlobal('navigator', { webdriver: true });
    m = await load();
    m.startVisitReports();
    expect(sent).toHaveLength(0);
    vi.stubGlobal('navigator', { webdriver: false });
    (globalThis as { __base?: string | null }).__base = null;
    m = await load();
    m.startVisitReports();
    expect(sent).toHaveLength(0);
  });

  it('works with storage switched off, and a failed send changes nothing', async () => {
    vi.stubGlobal('sessionStorage', { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } });
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } });
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const { startVisitReports } = await load();
    expect(() => startVisitReports()).not.toThrow();
    await vi.advanceTimersByTimeAsync(100);
  });

  it('can be stopped', async () => {
    const { startVisitReports, PING_EVERY_MS } = await load();
    const stop = startVisitReports();
    stop();
    vi.advanceTimersByTime(PING_EVERY_MS * 3);
    expect(sent).toHaveLength(1);
    expect(listeners).toHaveLength(0);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_BOTS as SERVER_MAX_BOTS, MAX_ROOM_SIZE, MIN_TABLE, MIN_TO_START } from '../../../../server/types';
import { MAX_BOTS, lobbyBots, rememberLobbyBots, tableFor, tableLine } from '../lobbyBots';

// A lobby's farm sheep, as the game shows them (the server's side is server/lobbyBots.test.ts).
describe('who sits down at a lobby table', () => {
  const t = (bots: number | null | undefined, people: number) => tableFor(bots === undefined ? undefined : { bots }, people, MAX_ROOM_SIZE, MIN_TO_START);

  it('only bots: one person and the farm sheep they added can start', () => {
    expect(t(3, 1)).toEqual({ chosen: true, bots: 3, seats: 4, enough: true });
    expect(t(1, 1)).toMatchObject({ seats: 2, enough: true });
  });

  it('only players: no farm sheep, and two people are enough', () => {
    expect(t(0, 2)).toEqual({ chosen: true, bots: 0, seats: 2, enough: true });
    expect(t(0, 1)).toMatchObject({ seats: 1, enough: false });
  });

  it('bots and players: both, up to what the table holds', () => {
    expect(t(2, 3)).toMatchObject({ bots: 2, seats: 5, enough: true });
    expect(t(7, 8)).toMatchObject({ bots: 2, seats: MAX_ROOM_SIZE });
  });

  it('with no number chosen (the casual queue, an older server) farm sheep fill a table of four and two people are needed', () => {
    for (const none of [null, undefined]) {
      expect(t(none, 1)).toEqual({ chosen: false, bots: MIN_TABLE - 1, seats: MIN_TABLE, enough: false });
      expect(t(none, 2)).toEqual({ chosen: false, bots: 2, seats: 4, enough: true });
      expect(t(none, 6)).toMatchObject({ bots: 0, seats: 6 });
    }
  });

  it('says in words what kind of table it is', () => {
    expect(tableLine(1, 3)).toBe('You and 3 bots');
    expect(tableLine(2, 0)).toBe('2 players, no bots');
    expect(tableLine(3, 1)).toBe('3 players and 1 bot');
    expect(tableLine(1, 0)).toBe('Just you so far');
  });

  it('allows as many farm sheep as the server does', () => {
    expect(MAX_BOTS).toBe(SERVER_MAX_BOTS);
  });
});

describe('the host\'s last choice', () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) });
  });

  it('a first lobby opens with three farm sheep at medium: a full table of four, one press from a game', () => {
    expect(lobbyBots()).toEqual({ bots: 3, botLevel: 'medium' });
  });

  it('the next lobby opens the way the last one was left, people only included', () => {
    rememberLobbyBots({ bots: 0, botLevel: 'hard' });
    expect(lobbyBots()).toEqual({ bots: 0, botLevel: 'hard' });
    rememberLobbyBots({ bots: 6, botLevel: 'easy' });
    expect(lobbyBots()).toEqual({ bots: 6, botLevel: 'easy' });
  });

  it('a damaged or out-of-range note is ignored', () => {
    store.set('sap:lobby-bots', JSON.stringify({ bots: 40, botLevel: 'godlike' }));
    expect(lobbyBots()).toEqual({ bots: 3, botLevel: 'medium' });
    store.set('sap:lobby-bots', 'not json');
    expect(lobbyBots()).toEqual({ bots: 3, botLevel: 'medium' });
  });
});

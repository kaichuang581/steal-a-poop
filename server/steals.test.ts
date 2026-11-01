import { describe, expect, it } from 'vitest';
import { RoomManager } from './rooms';
import { RttTracker, estimatedSendTime, orderPending } from './steals';
import type { PendingAction } from './steals';
import type { ClientAction } from './rooms';
import { ctx } from '../src/engine/__tests__/helpers';

describe('RttTracker', () => {
  it('uses the smallest of the most recent samples, and nothing before the first', () => {
    const r = new RttTracker(3);
    expect(r.minRtt('a')).toBeUndefined();
    for (const v of [90, 40, 120]) r.record('a', v);
    expect(r.minRtt('a')).toBe(40);
    r.record('a', 200); // 90 falls out
    r.record('a', 210); // 40 falls out
    expect(r.minRtt('a')).toBe(120);
    r.record('a', -5);
    r.record('a', NaN);
    expect(r.minRtt('a')).toBe(120); // junk is ignored
    r.forget('a');
    expect(r.minRtt('a')).toBeUndefined();
  });
});

describe('estimatedSendTime', () => {
  it('moves the arrival back by half the round trip', () => {
    expect(estimatedSendTime(1000, 80)).toBe(960);
    expect(estimatedSendTime(1000, 0)).toBe(1000);
  });
  it('never moves it back more than the cap, however slow the connection looks', () => {
    expect(estimatedSendTime(1000, 2000)).toBe(850); // default cap 150
    expect(estimatedSendTime(1000, 2000, 100)).toBe(900);
    expect(estimatedSendTime(1000, 2000, 0)).toBe(1000);
  });
  it('does nothing without a measurement', () => {
    expect(estimatedSendTime(1000, undefined)).toBe(1000);
  });
});

describe('orderPending', () => {
  const e = (userId: string, arrivalAt: number, estSendAt: number): PendingAction => ({ userId, action: null, arrivalAt, estSendAt });
  it('orders by estimated send time, then by arrival', () => {
    expect(orderPending([e('b', 10, 5), e('a', 20, 0), e('c', 5, 5)]).map((x) => x.userId)).toEqual(['a', 'c', 'b']);
  });
  it('does not change the input', () => {
    const input = [e('b', 2, 2), e('a', 1, 1)];
    orderPending(input);
    expect(input[0].userId).toBe('b');
  });
});

describe('two steals 50 ms apart from players with different latencies', () => {
  function table() {
    let t = 1_000_000;
    let seed = 99;
    const m = new RoomManager({ ctx, now: () => t, randomInt: (n) => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff), seed % n) });
    const made = m.createRoom('u0', 'Host', { visibility: 'private' });
    if (!made.ok) throw new Error('create');
    for (const id of ['u1', 'u2', 'u3']) {
      t += 10;
      m.join(id, id, made.code);
    }
    m.start('u0');
    t += 3000;
    m.tick(); // past the intro
    const room = m.room(made.code)!;
    // the round is quiet: no bot moves, and the chain letter is one both stealers have a word for
    room.game = structuredClone(room.game!);
    room.game.turn!.botActAt = null;
    room.game.turn!.stealPlans = [];
    room.game.chainLetter = 'c';
    room.game.modifier = 'double_points_fast'; // no restriction on which words are legal
    const owner = room.game.turn!.seat;
    const [x, y] = ['u0', 'u1', 'u2', 'u3'].filter((id) => room.seatOf[id] !== owner);
    t = room.game.turn!.endsAt - 2000; // inside the 3 s steal window
    return { m, room, code: made.code, x, y, T: t, set: (v: number) => (t = v) };
  }
  // X presses at T but is on a slow link (round trip 200 ms), so it arrives at T+100.
  // Y presses 50 ms later at T+50 on a fast link (round trip 20 ms), so it arrives at T+60 and gets there first.
  const stealer = (_id: string, word: string): ClientAction => ({ type: 'steal', word });

  it('arrival order (the default): the faster connection wins even though it pressed later', () => {
    const { m, room, x, y, T, set } = table();
    set(T + 60);
    expect(m.act(y, stealer(y, 'cat'))).toMatchObject({ ok: true, result: { accepted: true } });
    set(T + 100);
    m.act(x, stealer(x, 'cattle'));
    expect(room.game!.players[room.seatOf[y]].steals).toBe(1);
    expect(room.game!.players[room.seatOf[x]].steals).toBe(0);
  });

  it('compensated: the player who pressed first wins, judged at the time they pressed', () => {
    const { m, room, code, x, y, T, set } = table();
    const entries: PendingAction<ClientAction>[] = [
      { userId: y, action: stealer(y, 'cat'), arrivalAt: T + 60, estSendAt: estimatedSendTime(T + 60, 20) }, // T+50
      { userId: x, action: stealer(x, 'cattle'), arrivalAt: T + 100, estSendAt: estimatedSendTime(T + 100, 200) }, // T
    ];
    set(T + 60);
    expect(m.beginHold(code, T + 60)).toBe(true);
    set(T + 310); // the buffer has elapsed
    const out = m.resolveHold(code, entries, T + 310);
    expect(out.map((o) => o.entry.userId)).toEqual([x, y]); // applied in order of pressing
    expect(out[0].outcome).toMatchObject({ ok: true, result: { accepted: true } });
    expect(room.game!.players[room.seatOf[x]].steals).toBe(1);
    expect(room.game!.players[room.seatOf[y]].steals).toBe(0);
    expect(room.hold).toBeNull();
  });

  it('compensation is capped: a link slower than 300 ms does not buy more than 150 ms', () => {
    // X presses at T, round trip 2000 ms, so arrives at T+1000; Y presses at T+200 and arrives at T+210.
    // Uncapped, X would sort first (T). Capped, X is only moved back to T+850, so Y (T+200) wins.
    expect(estimatedSendTime(1000, 2000)).toBe(850);
    const order = orderPending([
      { userId: 'x', action: null, arrivalAt: 1000, estSendAt: estimatedSendTime(1000, 2000) },
      { userId: 'y', action: null, arrivalAt: 210, estSendAt: estimatedSendTime(210, 20) },
    ]);
    expect(order.map((o) => o.userId)).toEqual(['y', 'x']);
  });

  it('a steal sent just before the turn ended still counts, even though the buffer outlasts the turn', () => {
    const { m, room, code, x, T, set } = table();
    const endsAt = room.game!.turn!.endsAt;
    const arrival = endsAt - 20; // arrives 20 ms before the end
    set(arrival);
    m.beginHold(code, arrival);
    set(arrival + 250); // by now the turn would have timed out
    const out = m.resolveHold(code, [{ userId: x, action: stealer(x, 'cat'), arrivalAt: arrival, estSendAt: arrival }], arrival + 250);
    expect(out[0].outcome).toMatchObject({ ok: true, result: { accepted: true } });
    expect(room.game!.players[room.seatOf[x]].steals).toBe(1);
    void T;
  });

  it('while held, the clock does not move the game; afterwards it catches up', () => {
    const { m, room, code, T, set } = table();
    const turnBefore = room.game!.turn!.seat;
    set(T + 10);
    m.beginHold(code, T + 10);
    set(room.game!.turn!.endsAt + 5000); // far past the end of the turn
    expect(m.tick()).toEqual([]); // held: nothing advances
    expect(room.game!.turn!.seat).toBe(turnBefore);
    m.resolveHold(code, [], room.game!.turn!.endsAt + 5000);
    expect(room.game!.turn?.seat === turnBefore && room.game!.phase === 'playing').toBe(false); // caught up (the turn timed out)
  });

  it('a player who leaves while steals are held is replaced by a bot in the held game too', () => {
    const { m, room, code, x, T, set } = table();
    set(T + 10);
    m.beginHold(code, T + 10);
    const seat = room.seatOf[x];
    m.leave(x);
    m.resolveHold(code, [], T + 300);
    expect(room.game!.players[seat].isHuman).toBe(false);
  });
});

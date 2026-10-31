import { advance, apply, createGame, replaceWithBot } from '../src/engine';
import type { ActionResult, EngineContext } from '../src/engine';
import { CODE_PATTERN, generateCode, normalizeCode } from './codes';
import { MAX_ROOM_SIZE, MIN_TO_START } from './types';
import type { Member, PublicRoomInfo, Result, Room, Visibility } from './types';

/** What a client may send during a game. The server fills in the seat from who is asking. */
export type ClientAction = { type: 'play'; word: string } | { type: 'bank' } | { type: 'steal'; word: string };

export interface RoomManagerDeps {
  ctx: EngineContext;
  now: () => number;
  /** Integer in [0, n). Production uses crypto.randomInt. */
  randomInt: (n: number) => number;
}

export interface RoomView {
  code: string;
  name: string;
  visibility: Visibility;
  hostId: string;
  members: { userId: string; name: string }[];
  phase: Room['phase'];
  min: number;
  max: number;
  seatOf: Record<string, number>;
  game: Room['game'];
}

const NAME_MAX = 12;
const ROOM_NAME_MAX = 24;

export class RoomManager {
  private rooms = new Map<string, Room>();
  private roomOfUser = new Map<string, string>();

  constructor(private deps: RoomManagerDeps) {}

  /** The live room object, for server code and tests. Clients get `view()`. */
  room(code: string): Room | null {
    return this.rooms.get(code) ?? null;
  }

  roomFor(userId: string): Room | null {
    const code = this.roomOfUser.get(userId);
    return code ? (this.rooms.get(code) ?? null) : null;
  }

  get roomCount(): number {
    return this.rooms.size;
  }

  createRoom(userId: string, rawName: string, opts: { visibility: Visibility; roomName?: string }): Result<{ code: string }> {
    const name = rawName.trim().slice(0, NAME_MAX);
    if (!name) return { ok: false, error: 'bad_name' };
    if (this.roomOfUser.has(userId)) return { ok: false, error: 'already_in_room' };
    const code = generateCode(new Set(this.rooms.keys()), this.deps.randomInt);
    const room: Room = {
      code,
      name: (opts.roomName?.trim() || `${name}'s room`).slice(0, ROOM_NAME_MAX),
      visibility: opts.visibility,
      hostId: userId,
      members: [{ userId, name, joinedAt: this.deps.now() }],
      phase: 'lobby',
      game: null,
      seatOf: {},
    };
    this.rooms.set(code, room);
    this.roomOfUser.set(userId, code);
    return { ok: true, code };
  }

  join(userId: string, rawName: string, rawCode: string): Result<{ code: string }> {
    const name = rawName.trim().slice(0, NAME_MAX);
    if (!name) return { ok: false, error: 'bad_name' };
    const code = normalizeCode(rawCode);
    if (!CODE_PATTERN.test(code)) return { ok: false, error: 'bad_code' };
    if (this.roomOfUser.has(userId)) return { ok: false, error: 'already_in_room' };
    const room = this.rooms.get(code);
    if (!room) return { ok: false, error: 'room_not_found' };
    if (room.phase !== 'lobby') return { ok: false, error: 'room_started' };
    if (room.members.length >= MAX_ROOM_SIZE) return { ok: false, error: 'room_full' };
    room.members.push({ userId, name: this.uniqueName(room, name), joinedAt: this.deps.now() });
    this.roomOfUser.set(userId, code);
    return { ok: true, code };
  }

  /**
   * Leaving the lobby frees the spot. Leaving a running game puts a bot in the seat. Either way, if
   * the host goes, the member who joined next becomes host, and an empty room is closed.
   */
  leave(userId: string): Result<{ code: string; newHostId: string | null; botSeat: number | null; roomClosed: boolean }> {
    const room = this.roomFor(userId);
    if (!room) return { ok: false, error: 'not_in_room' };
    let botSeat: number | null = null;
    if (room.phase === 'playing' && room.game && userId in room.seatOf) {
      botSeat = room.seatOf[userId];
      room.game = replaceWithBot(room.game, botSeat, 'medium', this.deps.now());
      delete room.seatOf[userId];
    }
    room.members = room.members.filter((m) => m.userId !== userId);
    this.roomOfUser.delete(userId);

    let newHostId: string | null = null;
    if (room.members.length > 0 && room.hostId === userId) {
      newHostId = [...room.members].sort((a, b) => a.joinedAt - b.joinedAt)[0].userId;
      room.hostId = newHostId;
    }
    const roomClosed = room.members.length === 0;
    if (roomClosed) this.rooms.delete(room.code);
    return { ok: true, code: room.code, newHostId, botSeat, roomClosed };
  }

  /** The host starts the game by hand once at least four players are in. */
  start(userId: string): Result<{ code: string }> {
    const room = this.roomFor(userId);
    if (!room) return { ok: false, error: 'not_in_room' };
    if (room.hostId !== userId) return { ok: false, error: 'not_host' };
    if (room.phase !== 'lobby') return { ok: false, error: 'room_started' };
    if (room.members.length < MIN_TO_START) return { ok: false, error: 'not_enough_players' };
    const seated = [...room.members].sort((a, b) => a.joinedAt - b.joinedAt);
    const now = this.deps.now();
    room.seatOf = Object.fromEntries(seated.map((m, seat) => [m.userId, seat]));
    room.game = createGame(
      { seed: `room:${room.code}:${now}`, now, humans: seated.map((m) => m.name), playerCount: seated.length, difficulty: 'medium' },
      this.deps.ctx.dict,
    );
    room.phase = 'playing';
    return { ok: true, code: room.code };
  }

  /** A player's move. Returns the engine's verdict, or a room error if they are not in a running game. */
  act(userId: string, action: ClientAction): Result<{ result: ActionResult }> {
    const room = this.roomFor(userId);
    if (!room) return { ok: false, error: 'not_in_room' };
    if (room.phase !== 'playing' || !room.game) return { ok: false, error: 'game_not_running' };
    const seat = room.seatOf[userId];
    if (seat === undefined) return { ok: false, error: 'not_in_room' };
    const result = apply(room.game, this.deps.ctx, { ...action, seat }, this.deps.now());
    room.game = result.state;
    this.finishIfOver(room);
    return { ok: true, result };
  }

  /** Runs timers (timeouts, bots) for every running game. Returns the codes whose state changed. */
  tick(): string[] {
    const now = this.deps.now();
    const changed: string[] = [];
    for (const room of this.rooms.values()) {
      if (room.phase !== 'playing' || !room.game) continue;
      const next = advance(room.game, this.deps.ctx, now);
      if (next !== room.game) {
        room.game = next;
        changed.push(room.code);
        this.finishIfOver(room);
      }
    }
    return changed;
  }

  listPublic(): PublicRoomInfo[] {
    return [...this.rooms.values()]
      .filter((r) => r.visibility === 'public' && r.phase === 'lobby' && r.members.length < MAX_ROOM_SIZE)
      .map((r) => ({
        code: r.code,
        name: r.name,
        hostName: r.members.find((m) => m.userId === r.hostId)?.name ?? '',
        players: r.members.length,
        max: MAX_ROOM_SIZE,
        min: MIN_TO_START,
      }));
  }

  view(code: string): RoomView | null {
    const r = this.rooms.get(code);
    if (!r) return null;
    return {
      code: r.code, name: r.name, visibility: r.visibility, hostId: r.hostId,
      members: r.members.map((m: Member) => ({ userId: m.userId, name: m.name })),
      phase: r.phase, min: MIN_TO_START, max: MAX_ROOM_SIZE, seatOf: { ...r.seatOf }, game: r.game,
    };
  }

  private finishIfOver(room: Room) {
    if (room.game?.phase === 'gameOver') room.phase = 'finished';
  }

  private uniqueName(room: Room, name: string): string {
    const taken = new Set(room.members.map((m) => m.name.toLowerCase()));
    if (!taken.has(name.toLowerCase())) return name;
    for (let i = 2; i < 100; i++) {
      const candidate = `${name.slice(0, NAME_MAX - String(i).length - 1)} ${i}`;
      if (!taken.has(candidate.toLowerCase())) return candidate;
    }
    return name;
  }
}

import { advance, apply, createGame, dailySetup, replaceWithBot } from '../src/engine';
import type { ActionResult, EngineContext } from '../src/engine';
import type { GameResult } from './contracts';
import { CODE_PATTERN, generateCode, normalizeCode } from './codes';
import { DEFAULT_ROOM_SETTINGS, MAX_ROOM_SIZE, MIN_TABLE, MIN_TO_START } from './types';
import type { Member, PublicRoomInfo, Result, Room, RoomSettings, Visibility } from './types';

/** What a client may send during a game. The server fills in the seat from who is asking. */
export type ClientAction = { type: 'play'; word: string } | { type: 'bank' } | { type: 'pass' };

export interface RoomManagerDeps {
  ctx: EngineContext;
  now: () => number;
  /** Integer in [0, n). Production uses crypto.randomInt. */
  randomInt: (n: number) => number;
  /** Called once when a game ends. Must not throw; failures are the caller's to handle. */
  onFinished?: (room: Room) => void;
  /** Called when a room is gone for good (its last member left, a daily table ended, or a finished room was swept). */
  onClosed?: (code: string) => void;
}

export interface RoomView {
  code: string;
  name: string;
  visibility: Visibility;
  hostId: string;
  queue: boolean;
  settings: RoomSettings;
  members: { userId: string; name: string }[];
  phase: Room['phase'];
  min: number;
  max: number;
  seatOf: Record<string, number>;
  game: Room['game'];
  chatMuted: boolean;
  mutedIds: string[];
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
      queue: false,
      settings: { ...DEFAULT_ROOM_SETTINGS },
      members: [{ userId, name, joinedAt: this.deps.now() }],
      phase: 'lobby',
      game: null,
      seatOf: {},
      kind: 'room',
      dailyDate: null,
      gameId: null,
      reported: false,
      chatMuted: false,
      mutedIds: [],
      kicked: [],
      finishedAt: null,
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
    if (room.kicked.includes(userId)) return { ok: false, error: 'kicked' };
    if (room.phase !== 'lobby') return { ok: false, error: 'room_started' };
    if (room.members.length >= MAX_ROOM_SIZE) return { ok: false, error: 'room_full' };
    room.members.push({ userId, name: this.uniqueName(room, name), joinedAt: this.deps.now() });
    this.roomOfUser.set(userId, code);
    return { ok: true, code };
  }

  /**
   * Quick start: puts the player in the fullest open public room they may join (the oldest on a tie), so tables fill
   * one at a time, or opens a new public room when there is none.
   */
  quickJoin(userId: string, rawName: string): Result<{ code: string; created: boolean }> {
    const name = rawName.trim().slice(0, NAME_MAX);
    if (!name) return { ok: false, error: 'bad_name' };
    if (this.roomOfUser.has(userId)) return { ok: false, error: 'already_in_room' };
    const open = [...this.rooms.values()]
      .filter((r) => r.kind === 'room' && r.visibility === 'public' && r.phase === 'lobby' && r.members.length < MAX_ROOM_SIZE && !r.kicked.includes(userId))
      .sort((a, b) => b.members.length - a.members.length || (a.members[0]?.joinedAt ?? 0) - (b.members[0]?.joinedAt ?? 0));
    if (open.length > 0) {
      const joined = this.join(userId, name, open[0].code);
      return joined.ok ? { ...joined, created: false } : joined;
    }
    const made = this.createRoom(userId, name, { visibility: 'public', roomName: 'Quick play' });
    if (!made.ok) return made;
    this.rooms.get(made.code)!.queue = true;
    return { ...made, created: true };
  }

  /**
   * Host-only, before the game starts: the game length (turns per round, wool balls, twists) and whether the room is
   * open to quick-start players. Only the listed values are accepted; anything else changes nothing.
   */
  setOptions(hostId: string, patch: { turnsPerRound?: unknown; lives?: unknown; twists?: unknown; visibility?: unknown }): Result<{ code: string }> {
    const room = this.roomFor(hostId);
    if (!room || room.kind === 'daily') return { ok: false, error: 'not_in_room' };
    if (room.hostId !== hostId) return { ok: false, error: 'not_host' };
    if (room.phase !== 'lobby') return { ok: false, error: 'room_started' };
    const next = { ...room.settings };
    let visibility = room.visibility;
    if (patch.turnsPerRound !== undefined) {
      if (patch.turnsPerRound !== 2 && patch.turnsPerRound !== 3 && patch.turnsPerRound !== 5) return { ok: false, error: 'bad_settings' };
      next.turnsPerRound = patch.turnsPerRound;
    }
    if (patch.lives !== undefined) {
      if (patch.lives !== 1 && patch.lives !== 2 && patch.lives !== 3 && patch.lives !== 5) return { ok: false, error: 'bad_settings' };
      next.lives = patch.lives;
    }
    if (patch.twists !== undefined) {
      if (typeof patch.twists !== 'boolean') return { ok: false, error: 'bad_settings' };
      next.twists = patch.twists;
    }
    if (patch.visibility !== undefined) {
      if (patch.visibility !== 'public' && patch.visibility !== 'private') return { ok: false, error: 'bad_settings' };
      visibility = patch.visibility;
    }
    room.settings = next;
    room.visibility = visibility;
    return { ok: true, code: room.code };
  }

  /**
   * Leaving the lobby frees the spot. Leaving a running game puts a bot in the seat. Either way, if
   * the host goes, the member who joined next becomes host, and an empty room is closed.
   */
  leave(userId: string): Result<{ code: string; newHostId: string | null; botSeat: number | null; roomClosed: boolean }> {
    const room = this.roomFor(userId);
    if (!room) return { ok: false, error: 'not_in_room' };
    if (room.kind === 'daily') {
      this.close(room.code);
      this.roomOfUser.delete(userId);
      return { ok: true, code: room.code, newHostId: null, botSeat: null, roomClosed: true };
    }
    return { ok: true, code: room.code, ...this.removeMember(room, userId) };
  }

  /** Takes a member out. In a running game a bot takes the seat and keeps the score. */
  private removeMember(room: Room, userId: string): { newHostId: string | null; botSeat: number | null; roomClosed: boolean } {
    let botSeat: number | null = null;
    if (room.phase === 'playing' && room.game && userId in room.seatOf) {
      botSeat = room.seatOf[userId];
      room.game = replaceWithBot(room.game, botSeat, 'medium', this.deps.now());
      delete room.seatOf[userId];
    }
    room.members = room.members.filter((m) => m.userId !== userId);
    room.mutedIds = room.mutedIds.filter((id) => id !== userId);
    this.roomOfUser.delete(userId);

    let newHostId: string | null = null;
    if (room.members.length > 0 && room.hostId === userId) {
      newHostId = [...room.members].sort((a, b) => a.joinedAt - b.joinedAt)[0].userId;
      room.hostId = newHostId;
    }
    const roomClosed = room.members.length === 0;
    if (roomClosed) this.close(room.code);
    return { newHostId, botSeat, roomClosed };
  }

  /**
   * The host removes a player. A bot takes the seat in a running game and keeps the score, and the
   * player cannot rejoin this room. The host cannot kick themselves (they leave instead).
   */
  kick(hostId: string, targetId: string): Result<{ code: string; botSeat: number | null }> {
    const room = this.roomFor(hostId);
    if (!room || room.kind === 'daily') return { ok: false, error: 'not_in_room' };
    if (room.hostId !== hostId) return { ok: false, error: 'not_host' };
    if (targetId === hostId) return { ok: false, error: 'cannot_target' };
    if (!room.members.some((m) => m.userId === targetId)) return { ok: false, error: 'not_in_room' };
    const { botSeat } = this.removeMember(room, targetId);
    if (!room.kicked.includes(targetId)) room.kicked.push(targetId);
    return { ok: true, code: room.code, botSeat };
  }

  /**
   * Host-only. With a userId, silences or unsilences that player in this room. Without one, stops or
   * resumes chat for everyone except the host.
   */
  setMute(hostId: string, on: boolean, targetId?: string): Result<{ code: string }> {
    const room = this.roomFor(hostId);
    if (!room || room.kind === 'daily') return { ok: false, error: 'not_in_room' };
    if (room.hostId !== hostId) return { ok: false, error: 'not_host' };
    if (targetId === undefined) {
      room.chatMuted = on;
      return { ok: true, code: room.code };
    }
    if (targetId === hostId) return { ok: false, error: 'cannot_target' };
    if (!room.members.some((m) => m.userId === targetId)) return { ok: false, error: 'not_in_room' };
    room.mutedIds = on ? [...new Set([...room.mutedIds, targetId])] : room.mutedIds.filter((id) => id !== targetId);
    return { ok: true, code: room.code };
  }

  /** True if this player may not chat in their room because of a host mute. */
  isMuted(userId: string): boolean {
    const room = this.roomFor(userId);
    if (!room) return false;
    return room.mutedIds.includes(userId) || (room.chatMuted && room.hostId !== userId);
  }

  /**
   * Starts today's Daily Table for one player: a game against bots whose lineup comes from the date.
   * The caller must already have reserved the player's one attempt for this date.
   */
  startDaily(userId: string, rawName: string, dailyDate: string): Result<{ code: string }> {
    const name = rawName.trim().slice(0, NAME_MAX);
    if (!name) return { ok: false, error: 'bad_name' };
    if (this.roomOfUser.has(userId)) return { ok: false, error: 'already_in_room' };
    const now = this.deps.now();
    const code = generateCode(new Set(this.rooms.keys()), this.deps.randomInt);
    const setup = dailySetup(new Date(`${dailyDate}T00:00:00Z`), name, now);
    const room: Room = {
      code,
      name: `Daily Table ${dailyDate}`,
      visibility: 'private',
      hostId: userId,
      queue: false,
      settings: { ...DEFAULT_ROOM_SETTINGS },
      members: [{ userId, name, joinedAt: now }],
      phase: 'playing',
      game: createGame(setup, this.deps.ctx.dict),
      seatOf: { [userId]: 0 },
      kind: 'daily',
      dailyDate,
      gameId: `daily:${dailyDate}:${userId}:${now}`,
      reported: false,
      chatMuted: false,
      mutedIds: [],
      kicked: [],
      finishedAt: null,
    };
    this.rooms.set(code, room);
    this.roomOfUser.set(userId, code);
    return { ok: true, code };
  }

  /** The host starts the game by hand once at least two people are in. Farm sheep (bots) fill the table up to four. */
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
      { seed: `room:${room.code}:${now}`, now, humans: seated.map((m) => m.name), playerCount: Math.max(seated.length, MIN_TABLE), difficulty: 'medium', settings: { ...room.settings, timeCarry: 'more' } },
      this.deps.ctx.dict,
    );
    room.phase = 'playing';
    room.gameId = `${room.code}:${now}`;
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

  /**
   * Removes finished rooms that have been over for `ttlMs`, so a long-running server does not keep
   * every game it ever hosted. Returns the removed rooms' members so the caller can tell them.
   */
  sweepFinished(ttlMs: number): { code: string; members: string[] }[] {
    const now = this.deps.now();
    const gone: { code: string; members: string[] }[] = [];
    for (const room of [...this.rooms.values()]) {
      if (room.phase !== 'finished' || room.finishedAt === null || now - room.finishedAt < ttlMs) continue;
      const members = room.members.map((m) => m.userId);
      for (const id of members) if (this.roomOfUser.get(id) === room.code) this.roomOfUser.delete(id);
      this.close(room.code);
      gone.push({ code: room.code, members });
    }
    return gone;
  }

  private close(code: string): void {
    this.rooms.delete(code);
    try { this.deps.onClosed?.(code); } catch { /* a listener must never break the rooms */ }
  }

  /** Counts for monitoring. */
  stats(): { rooms: number; players: number } {
    let players = 0;
    for (const r of this.rooms.values()) players += r.members.length;
    return { rooms: this.rooms.size, players };
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
      code: r.code, name: r.name, visibility: r.visibility, hostId: r.hostId, queue: r.queue, settings: { ...r.settings },
      members: r.members.map((m: Member) => ({ userId: m.userId, name: m.name })),
      phase: r.phase, min: MIN_TO_START, max: MAX_ROOM_SIZE, seatOf: { ...r.seatOf }, game: r.game, chatMuted: r.chatMuted, mutedIds: [...r.mutedIds],
    };
  }

  private finishIfOver(room: Room) {
    if (room.game?.phase !== 'gameOver') return;
    room.phase = 'finished';
    room.finishedAt ??= this.deps.now();
    if (room.reported) return;
    room.reported = true;
    this.deps.onFinished?.(room);
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

/**
 * A finished game as the accounts lane stores it. Seats held by bots, including a bot that took over
 * from someone who left, have a null userId, and bots are never listed as winners.
 */
export function toGameResult(room: Room, finishedAt: number): GameResult {
  const userOfSeat = new Map<number, string>(Object.entries(room.seatOf).map(([userId, seat]) => [seat, userId]));
  const game = room.game!;
  return {
    gameId: room.gameId ?? `${room.code}:${finishedAt}`,
    mode: room.kind === 'daily' ? 'daily' : 'room',
    roomCode: room.kind === 'daily' ? null : room.code,
    dailyDate: room.dailyDate,
    finishedAt,
    players: game.players.map((p) => ({
      userId: p.isHuman ? (userOfSeat.get(p.id) ?? null) : null,
      name: p.name,
      seat: p.id,
      banked: p.banked,
      wordsPlayed: p.wordsPlayed,
      longestWord: p.longestWord,
    })),
    winners: (game.winners ?? []).flatMap((seat) => {
      const id = userOfSeat.get(seat);
      return id && game.players[seat].isHuman ? [id] : [];
    }),
  };
}

import { advance, apply, createGame, dailySetup, replaceWithBot } from '../src/engine';
import type { ActionResult, EngineContext } from '../src/engine';
import type { GameResult } from './contracts';
import { CODE_PATTERN, generateCode, normalizeCode } from './codes';
import { DEFAULT_ROOM_SETTINGS, MAX_BOTS, MAX_ROOM_SIZE, MIN_TABLE, MIN_TO_START, QUEUE_BOT_GAP_MS, QUEUE_FULL_WAIT_MS, QUEUE_QUIET_MS, RANKED_FULL_WAIT_MS, RANKED_MAX_PLAYERS, RANKED_MIN_PLAYERS, RANKED_WAIT_MS } from './types';
import { playerName } from '../src/lib/playerNames';
import type { Member, PublicRoomInfo, Result, Room, RoomSettings, Visibility } from './types';

/** What a client may send during a game. The server fills in the seat from who is asking. */
export type ClientAction = { type: 'play'; word: string } | { type: 'bank' } | { type: 'pass' };

export interface RoomManagerDeps {
  ctx: EngineContext;
  /** The French word list, for rooms opened by a French player. Without it they play the English list. */
  dictFr?: EngineContext['dict'];
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
  /** The casual queue's bots seated so far, by name, in seat order after the people. */
  botNames: string[];
  phase: Room['phase'];
  min: number;
  max: number;
  seatOf: Record<string, number>;
  game: Room['game'];
  chatMuted: boolean;
  mutedIds: string[];
  /** A ranked table, when it will start (null: still waiting for a second player), and the rating changes once it is over. */
  ranked: boolean;
  startAt: number | null;
  rated: Room['rated'];
}

/** The parts of a room every new room starts with (not ranked, nothing rated). */
const FRESH = { ranked: false, startAt: null, ratedSeats: [], leftAt: {}, rated: null, botAt: null } as const;

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

  /** The engine context for a room: its own language's word list. */
  private ctxFor(room: Room): EngineContext {
    return room.lang === 'fr' && this.deps.dictFr ? { ...this.deps.ctx, dict: this.deps.dictFr } : this.deps.ctx;
  }

  createRoom(userId: string, rawName: string, opts: { visibility: Visibility; roomName?: string; lang?: 'en' | 'fr' }): Result<{ code: string }> {
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
      ...FRESH, ratedSeats: [], leftAt: {}, botNames: [], quietSince: this.deps.now(),
      ...(opts.lang === 'fr' ? { lang: 'fr' as const } : {}),
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
    // A ranked table is reached through the ranked queue only: a code would let friends pick who they are rated against.
    if (!room || room.ranked) return { ok: false, error: 'room_not_found' };
    if (room.kicked.includes(userId)) return { ok: false, error: 'kicked' };
    if (room.phase !== 'lobby') return { ok: false, error: 'room_started' };
    if (room.members.length >= MAX_ROOM_SIZE) return { ok: false, error: 'room_full' };
    room.members.push({ userId, name: this.uniqueName(room, name), joinedAt: this.deps.now() });
    this.roomOfUser.set(userId, code);
    if (fillsSeats(room)) {
      // A person takes a bot's seat once the table is full, and the bots wait for another quiet spell.
      if (room.members.length + room.botNames.length > MIN_TABLE && room.botNames.length > 0) room.botNames.pop();
      room.quietSince = this.deps.now();
      room.botAt = null;
      this.armQueue(room);
    }
    return { ok: true, code };
  }

  /**
   * Quick start: puts the player in the fullest open public room they may join (the oldest on a tie), so tables fill
   * one at a time, or opens a new public room when there is none.
   */
  quickJoin(userId: string, rawName: string, lang: 'en' | 'fr' = 'en'): Result<{ code: string; created: boolean }> {
    const name = rawName.trim().slice(0, NAME_MAX);
    if (!name) return { ok: false, error: 'bad_name' };
    if (this.roomOfUser.has(userId)) return { ok: false, error: 'already_in_room' };
    const open = [...this.rooms.values()]
      .filter((r) => r.kind === 'room' && !r.ranked && (r.lang ?? 'en') === lang && r.visibility === 'public' && r.phase === 'lobby' && r.members.length < MAX_ROOM_SIZE && !r.kicked.includes(userId))
      .sort((a, b) => b.members.length - a.members.length || (a.members[0]?.joinedAt ?? 0) - (b.members[0]?.joinedAt ?? 0));
    if (open.length > 0) {
      const joined = this.join(userId, name, open[0].code);
      return joined.ok ? { ...joined, created: false } : joined;
    }
    const made = this.createRoom(userId, name, { visibility: 'public', roomName: lang === 'fr' ? 'Partie rapide' : 'Quick play', lang });
    if (!made.ok) return made;
    this.rooms.get(made.code)!.queue = true;
    return { ...made, created: true };
  }

  /**
   * The ranked queue: the fullest ranked table still waiting (the oldest on a tie), or a new one. A ranked table seats
   * two to four people and no farm sheep, plays the standard rules, and starts itself: RANKED_WAIT_MS after its second
   * player sits down, or RANKED_FULL_WAIT_MS after its fourth. Nobody hosts it, and it cannot be joined by code. The
   * caller has already checked that this is an account (a guest has no rating to play for).
   */
  rankedJoin(userId: string, rawName: string, lang: 'en' | 'fr' = 'en'): Result<{ code: string; created: boolean }> {
    const name = rawName.trim().slice(0, NAME_MAX);
    if (!name) return { ok: false, error: 'bad_name' };
    if (this.roomOfUser.has(userId)) return { ok: false, error: 'already_in_room' };
    const now = this.deps.now();
    const open = [...this.rooms.values()]
      .filter((r) => r.kind === 'room' && r.ranked && (r.lang ?? 'en') === lang && r.phase === 'lobby' && r.members.length < RANKED_MAX_PLAYERS)
      .sort((a, b) => b.members.length - a.members.length || (a.members[0]?.joinedAt ?? 0) - (b.members[0]?.joinedAt ?? 0));
    if (open.length > 0) {
      const room = open[0];
      room.members.push({ userId, name: this.uniqueName(room, name), joinedAt: now });
      this.roomOfUser.set(userId, room.code);
      this.armRanked(room);
      return { ok: true, code: room.code, created: false };
    }
    const made = this.createRoom(userId, name, { visibility: 'public', roomName: lang === 'fr' ? 'Classée' : 'Ranked', lang });
    if (!made.ok) return made;
    const room = this.rooms.get(made.code)!;
    room.queue = true;
    room.ranked = true;
    return { ...made, created: true };
  }

  /** The casual queue: a table of MIN_TABLE or more starts itself QUEUE_FULL_WAIT_MS on; a smaller one waits. */
  private armQueue(room: Room): void {
    if (!isCasualQueue(room) || room.phase !== 'lobby') return;
    if (room.members.length + room.botNames.length >= MIN_TABLE) room.startAt ??= this.deps.now() + QUEUE_FULL_WAIT_MS;
    else room.startAt = null;
  }

  /** Empty seats: after a quiet spell, one bot sits down, then the next a gap later. True if one did. */
  private seatQueueBot(room: Room, now: number): boolean {
    if (!fillsSeats(room) || room.phase !== 'lobby' || room.members.length === 0) return false;
    if (room.members.length + room.botNames.length >= MIN_TABLE) return false;
    if (now - room.quietSince < QUEUE_QUIET_MS) return false;
    room.botAt ??= now; // the first one sits down as the quiet spell ends
    if (now < room.botAt) return false;
    const taken = new Set([...room.members.map((m) => m.name), ...room.botNames].map((n) => n.toLowerCase()));
    room.botNames.push(playerName(`${room.code}:${room.botNames.length}:${this.deps.randomInt(1_000_000_000)}`, taken));
    const [lo, hi] = QUEUE_BOT_GAP_MS;
    room.botAt = now + lo + this.deps.randomInt(hi - lo + 1);
    this.armQueue(room);
    return true;
  }

  /** Sets, moves up or clears a waiting ranked table's start, after someone sat down or left. */
  private armRanked(room: Room): void {
    if (!room.ranked || room.phase !== 'lobby') return;
    const now = this.deps.now();
    if (room.members.length < RANKED_MIN_PLAYERS) room.startAt = null;
    else if (room.members.length >= RANKED_MAX_PLAYERS) room.startAt = Math.min(room.startAt ?? Infinity, now + RANKED_FULL_WAIT_MS);
    else room.startAt ??= now + RANKED_WAIT_MS;
  }

  /**
   * Host-only, before the game starts: the game length (turns per round, wool balls, twists) and whether the room is
   * open to quick-start players. Only the listed values are accepted; anything else changes nothing.
   */
  setOptions(hostId: string, patch: { turnsPerRound?: unknown; lives?: unknown; twists?: unknown; visibility?: unknown; bots?: unknown; botLevel?: unknown }): Result<{ code: string }> {
    const room = this.roomFor(hostId);
    if (!room || room.kind === 'daily') return { ok: false, error: 'not_in_room' };
    if (room.ranked) return { ok: false, error: 'ranked_room' }; // everyone is rated on the same rules
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
    // Farm sheep at the table: a whole number the host picks. The Quick play queue keeps the old fill-to-four rule.
    if (patch.bots !== undefined) {
      if (room.queue || typeof patch.bots !== 'number' || !Number.isInteger(patch.bots) || patch.bots < 0 || patch.bots > MAX_BOTS) return { ok: false, error: 'bad_settings' };
      next.bots = patch.bots;
    }
    if (patch.botLevel !== undefined) {
      if (patch.botLevel !== 'easy' && patch.botLevel !== 'medium' && patch.botLevel !== 'hard') return { ok: false, error: 'bad_settings' };
      next.botLevel = patch.botLevel;
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
      // Walking out of a ranked game is a loss from that moment: the seat is placed as if it had just frozen.
      if (room.ranked) room.leftAt[userId] = this.deps.now();
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
    else { this.armRanked(room); this.armQueue(room); }
    return { newHostId, botSeat, roomClosed };
  }

  /**
   * The host removes a player. A bot takes the seat in a running game and keeps the score, and the
   * player cannot rejoin this room. The host cannot kick themselves (they leave instead).
   */
  kick(hostId: string, targetId: string): Result<{ code: string; botSeat: number | null }> {
    const room = this.roomFor(hostId);
    if (!room || room.kind === 'daily') return { ok: false, error: 'not_in_room' };
    if (room.ranked) return { ok: false, error: 'ranked_room' }; // nobody hosts a ranked table
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
    if (room.ranked) return { ok: false, error: 'ranked_room' };
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
      ...FRESH, ratedSeats: [], leftAt: {}, botNames: [], quietSince: this.deps.now(),
    };
    this.rooms.set(code, room);
    this.roomOfUser.set(userId, code);
    return { ok: true, code };
  }

  /** The host starts the game by hand once at least two people are in. Farm sheep (bots) fill the table up to four. */
  start(userId: string): Result<{ code: string }> {
    const room = this.roomFor(userId);
    if (!room) return { ok: false, error: 'not_in_room' };
    if (room.ranked) return { ok: false, error: 'ranked_room' }; // a ranked table starts itself (tick)
    if (room.hostId !== userId) return { ok: false, error: 'not_host' };
    if (room.phase !== 'lobby') return { ok: false, error: 'room_started' };
    // A game needs two at the table, counting the seats filled after a quiet spell. The host no longer chooses bots:
    // an older client may still send `bots`, which is stored and has no effect.
    const enough = room.members.length + room.botNames.length >= 2;
    if (!enough) return { ok: false, error: 'not_enough_players' };
    this.begin(room);
    return { ok: true, code: room.code };
  }

  /** Seats everyone in the order they came and deals the game. A ranked table seats only its people: no farm sheep. */
  private begin(room: Room): void {
    const seated = [...room.members].sort((a, b) => a.joinedAt - b.joinedAt);
    const now = this.deps.now();
    room.seatOf = Object.fromEntries(seated.map((m, seat) => [m.userId, seat]));
    room.game = createGame(
      room.ranked
        ? {
            seed: `ranked:${room.code}:${now}`, now, humans: seated.map((m) => m.name), playerCount: seated.length, minPlayers: RANKED_MIN_PLAYERS, difficulty: 'medium',
            settings: { turnsPerRound: DEFAULT_ROOM_SETTINGS.turnsPerRound, lives: DEFAULT_ROOM_SETTINGS.lives, twists: DEFAULT_ROOM_SETTINGS.twists, timeCarry: 'more' },
          }
        : {
            seed: `room:${room.code}:${now}`, now, humans: seated.map((m) => m.name), playerCount: seated.length + botsFor(room), minPlayers: 2, difficulty: room.settings.botLevel,
            botNames: room.botNames,
            settings: { turnsPerRound: room.settings.turnsPerRound, lives: room.settings.lives, twists: room.settings.twists, timeCarry: 'more' },
          },
      this.ctxFor(room).dict,
    );
    room.phase = 'playing';
    room.gameId = `${room.code}:${now}`;
    room.startAt = null;
    room.ratedSeats = room.ranked ? seated.map((m, seat) => ({ userId: m.userId, seat })) : [];
    room.leftAt = {};
  }

  /** A player's move. Returns the engine's verdict, or a room error if they are not in a running game. */
  act(userId: string, action: ClientAction): Result<{ result: ActionResult }> {
    const room = this.roomFor(userId);
    if (!room) return { ok: false, error: 'not_in_room' };
    if (room.phase !== 'playing' || !room.game) return { ok: false, error: 'game_not_running' };
    const seat = room.seatOf[userId];
    if (seat === undefined) return { ok: false, error: 'not_in_room' };
    const result = apply(room.game, this.ctxFor(room), { ...action, seat }, this.deps.now());
    room.game = result.state;
    this.finishIfOver(room);
    return { ok: true, result };
  }

  /** Runs timers (timeouts, bots) for every running game. Returns the codes whose state changed. */
  tick(): string[] {
    const now = this.deps.now();
    const changed: string[] = [];
    for (const room of this.rooms.values()) {
      // A waiting ranked table whose time has come sits down and starts.
      if (room.ranked && room.phase === 'lobby' && room.startAt !== null && now >= room.startAt && room.members.length >= RANKED_MIN_PLAYERS) {
        this.begin(room);
        changed.push(room.code);
        continue;
      }
      // The casual queue and lobbies: bots sit down after a quiet spell, one at a time; a full queue table starts itself.
      if (fillsSeats(room) && room.phase === 'lobby') {
        if (this.seatQueueBot(room, now)) changed.push(room.code);
        if (isCasualQueue(room) && room.startAt !== null && now >= room.startAt) {
          this.begin(room);
          if (!changed.includes(room.code)) changed.push(room.code);
        }
        continue;
      }
      if (room.phase !== 'playing' || !room.game) continue;
      const next = advance(room.game, this.ctxFor(room), now);
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
      .filter((r) => !r.ranked && r.visibility === 'public' && r.phase === 'lobby' && r.members.length < MAX_ROOM_SIZE)
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
      botNames: [...r.botNames],
      phase: r.phase, min: r.ranked ? RANKED_MIN_PLAYERS : MIN_TO_START, max: r.ranked ? RANKED_MAX_PLAYERS : MAX_ROOM_SIZE,
      seatOf: { ...r.seatOf }, game: r.game, chatMuted: r.chatMuted, mutedIds: [...r.mutedIds],
      ranked: r.ranked, startAt: r.startAt, rated: r.rated,
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

/**
 * How many farm sheep sit down with a room's people. The host's number where one was chosen (never more than the table
 * holds); otherwise the old rule: enough to fill the table to MIN_TABLE.
 */
export function botsFor(room: Pick<Room, 'settings' | 'members'> & Partial<Pick<Room, 'queue' | 'ranked' | 'botNames'>>): number {
  const people = room.members.length;
  // Only the bots that sat down after a quiet spell (the host no longer chooses any; a ranked table has none).
  if (!room.ranked) return Math.min(room.botNames?.length ?? 0, Math.max(0, MAX_ROOM_SIZE - people));
  if (room.settings.bots === null) return Math.max(0, MIN_TABLE - people);
  return Math.max(0, Math.min(room.settings.bots, MAX_ROOM_SIZE - people));
}

/**
 * A finished ranked game's finishing order, for the ratings: one entry for everyone who sat down. The last sheep
 * standing is first; behind it, whoever was out later is ahead (frozen, or gone: walking out counts from that
 * moment, whatever the farm sheep that took the seat did afterwards). Two who were out at the same instant tie.
 */
export function rankedPlaces(room: Room): { userId: string; place: number }[] {
  const game = room.game;
  if (!game) return [];
  const rows = room.ratedSeats.map(({ userId, seat }) => {
    const p = game.players[seat];
    const left = room.leftAt[userId];
    const out = left !== undefined ? left : p?.frozen ? (p.frozenAt ?? 0) : Infinity;
    return { userId, out, lives: left !== undefined ? 0 : (p?.lives ?? 0) };
  }).sort((a, b) => (a.out === b.out ? b.lives - a.lives : a.out > b.out ? -1 : 1));
  let place = 0;
  return rows.map((r, i) => {
    const prev = rows[i - 1];
    if (!prev || prev.out !== r.out || prev.lives !== r.lives) place = i + 1;
    return { userId: r.userId, place };
  });
}

/** A room opened by the casual queue (Queue, then Casual): not ranked, and not someone's own lobby. */
export function isCasualQueue(room: Pick<Room, 'queue' | 'ranked' | 'kind'>): boolean {
  return room.kind === 'room' && room.queue && !room.ranked;
}

/** A room whose empty seats fill after a quiet spell: the casual queue and every lobby. Never ranked, never the daily. */
export function fillsSeats(room: Pick<Room, 'ranked' | 'kind'>): boolean {
  return room.kind === 'room' && !room.ranked;
}

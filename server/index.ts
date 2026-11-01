import { WebSocketServer } from 'ws';
import type { AuthUser, DailyGate, GameResultSink, VerifyToken } from './contracts';
import type { WebSocket } from 'ws';
import type { IncomingMessage, Server } from 'node:http';
import { utcDateKey } from '../src/engine';
import type { EngineContext } from '../src/engine';
import { ChatService } from './chat';
import { RateLimiter } from './ratelimit';
import { RoomManager, toGameResult } from './rooms';
import type { ClientAction } from './rooms';
import type { RoomError, Visibility } from './types';
import { BlockList } from './blocks';
import type { AuditLog } from './moderation/audit';

export type { AuthUser, VerifyToken } from './contracts';

export interface ServerOptions {
  /** Listen on this port, or attach to `httpServer` when one is given. */
  port: number;
  httpServer?: Server;
  ctx: EngineContext;
  chat: ChatService;
  verifyToken: VerifyToken;
  /** Told about every finished game (rooms and Daily Table). The accounts lane stores them. */
  onGameFinished?: GameResultSink;
  /** Without a gate, the server-run Daily Table is unavailable: it must never be playable without limit. */
  dailyGate?: DailyGate;
  /** Personal block lists. Without one, an in-memory list is used. */
  blocks?: BlockList;
  /** Where host actions (kick, mute) are logged. */
  audit?: AuditLog;
  randomInt: (n: number) => number;
  now?: () => number;
  /** How long a dropped connection keeps its seat before a bot takes over. */
  reconnectGraceMs?: number;
  tickMs?: number;
  reviewEveryMs?: number;
  limits?: ConnectionLimits;
}

export interface ConnectionLimits {
  /** Site origins allowed to open a socket. Unset means not checked (tests and local development only). */
  allowedOrigins?: readonly string[];
  /** Open sockets per address. Default 20 (a household or classroom can share one). */
  maxPerIp?: number;
  /** Open sockets in total. Default 2000. */
  maxTotal?: number;
  /** How often to ping every socket; one that misses a whole interval is dropped. Default 25 s. */
  heartbeatMs?: number;
  /** Read the client address from the proxy's header (Fly-Client-IP, then X-Forwarded-For) instead of the socket. Only turn on behind a proxy you control. */
  trustProxy?: boolean;
  /** How long a finished game stays in memory. Default 10 minutes. */
  finishedRoomTtlMs?: number;
  /** After telling clients the server is restarting, wait this long before closing them. Default 1000 ms. */
  shutdownGraceMs?: number;
  /** Per-type message budgets as [max, windowMs] per player ("*" is the overall budget). */
  messageLimits?: Record<string, readonly [number, number]>;
}

/** Every message type has a budget, so no single kind of message can flood the server. */
export const DEFAULT_MESSAGE_LIMITS: Record<string, readonly [number, number]> = {
  '*': [120, 10_000],
  hello: [5, 60_000],
  rooms: [10, 10_000],
  create: [10, 60_000],
  join: [30, 60_000],
  leave: [10, 60_000],
  start: [10, 60_000],
  daily: [5, 60_000],
  act: [40, 10_000],
  chat: [12, 10_000],
  report: [10, 60_000],
  appeal: [5, 3_600_000],
  block: [30, 60_000],
  unblock: [30, 60_000],
  mute: [30, 60_000],
  kick: [20, 60_000],
};

type ClientMsg =
  | { t: 'hello'; token: string }
  | { t: 'rooms' }
  | { t: 'create'; visibility: Visibility; roomName?: string }
  | { t: 'join'; code: string }
  | { t: 'leave' }
  | { t: 'start' }
  | { t: 'daily' }
  | { t: 'act'; action: ClientAction }
  | { t: 'chat'; text: string }
  | { t: 'report'; messageId: number }
  | { t: 'appeal'; note: string }
  | { t: 'block'; userId: string }
  | { t: 'unblock'; userId: string }
  | { t: 'mute'; on: boolean; userId?: string }
  | { t: 'kick'; userId: string };

const MAX_PAYLOAD = 4096;

export async function startServer(opts: ServerOptions) {
  const now = opts.now ?? Date.now;
  const grace = opts.reconnectGraceMs ?? 15_000;
  const rooms = new RoomManager({
    ctx: opts.ctx,
    now,
    randomInt: opts.randomInt,
    onFinished: (room) => {
      // A failing sink must never break the game or the server.
      try {
        void Promise.resolve(opts.onGameFinished?.(toGameResult(room, now()))).catch(() => undefined);
      } catch {
        /* ignored on purpose */
      }
    },
  });
  const sockets = new Map<string, WebSocket>(); // userId -> live socket
  const names = new Map<string, string>();
  const pendingLeave = new Map<string, ReturnType<typeof setTimeout>>();
  const createLimit = new RateLimiter(3, 60_000);
  const joinLimit = new RateLimiter(20, 60_000);
  const blockLimit = new RateLimiter(30, 60_000);
  const lim = opts.limits ?? {};
  const allowedOrigins = lim.allowedOrigins ? new Set(lim.allowedOrigins) : null;
  const maxPerIp = lim.maxPerIp ?? 20;
  const maxTotal = lim.maxTotal ?? 2000;
  let closing = false;
  const perIp = new Map<string, number>();
  let total = 0;
  const addressOf = (req: IncomingMessage): string => {
    if (lim.trustProxy) {
      const fly = req.headers['fly-client-ip'];
      const fwd = req.headers['x-forwarded-for'];
      const first = (typeof fly === 'string' ? fly : typeof fwd === 'string' ? fwd.split(',')[0] : '')?.trim();
      if (first) return first;
    }
    return req.socket.remoteAddress ?? 'unknown';
  };
  // Decided before the upgrade completes, so a refused client costs almost nothing.
  const verifyClient = (info: { origin: string; req: IncomingMessage }, cb: (ok: boolean, code?: number, message?: string) => void) => {
    if (closing) return cb(false, 503, 'server restarting');
    if (allowedOrigins && !allowedOrigins.has(info.origin)) return cb(false, 403, 'origin not allowed');
    if (total >= maxTotal) return cb(false, 503, 'server full');
    if ((perIp.get(addressOf(info.req)) ?? 0) >= maxPerIp) return cb(false, 429, 'too many connections');
    cb(true);
  };
  const wss = opts.httpServer
    ? new WebSocketServer({ server: opts.httpServer, maxPayload: MAX_PAYLOAD, verifyClient })
    : new WebSocketServer({ port: opts.port, maxPayload: MAX_PAYLOAD, verifyClient });
  if (!opts.httpServer) await new Promise<void>((resolve) => wss.once('listening', () => resolve()));

  const send = (ws: WebSocket | undefined, msg: object) => {
    if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
  };
  const sendTo = (userId: string, msg: object) => send(sockets.get(userId), msg);
  const roomMembers = (code: string) => rooms.view(code)?.members.map((m) => m.userId) ?? [];
  const broadcastRoom = (code: string) => {
    const view = rooms.view(code);
    if (!view) return;
    const serverNow = now(); // timers in the game state are in server time; clients correct for the difference
    for (const m of view.members) sendTo(m.userId, { t: 'room', view, serverNow, you: { userId: m.userId, seat: view.seatOf[m.userId] ?? null } });
  };
  const blocks = opts.blocks ?? new BlockList();
  const sendBlocks = (userId: string) => sendTo(userId, { t: 'blocks', list: blocks.list(userId) });
  const hostAction = (hostId: string, action: 'host_kick' | 'host_mute' | 'host_unmute', roomCode: string, target: string | null) => {
    void opts.audit?.record({ at: now(), actor: hostId, action, userId: target ?? undefined, details: { roomCode } }).catch(() => {});
  };
  const fail = (ws: WebSocket, error: RoomError | 'bad_message' | 'rate_limited' | 'not_signed_in') => send(ws, { t: 'error', error });

  async function handle(ws: WebSocket, userRef: { user: AuthUser | null }, msg: ClientMsg) {
    if (msg.t === 'hello') {
      const user = typeof msg.token === 'string' ? await opts.verifyToken(msg.token) : null;
      if (!user) return ws.close(4001, 'bad token');
      userRef.user = user;
      names.set(user.userId, user.name);
      const timer = pendingLeave.get(user.userId);
      if (timer) {
        clearTimeout(timer);
        pendingLeave.delete(user.userId); // back within the grace period: keep the seat
      }
      const old = sockets.get(user.userId);
      sockets.set(user.userId, ws);
      if (old && old !== ws) old.close(4002, 'signed in elsewhere');
      send(ws, { t: 'welcome', userId: user.userId, name: user.name, serverNow: now(), chat: opts.chat.state(user.userId), moderation: opts.chat.status(user.userId) });
      sendBlocks(user.userId);
      const room = rooms.roomFor(user.userId);
      if (room) broadcastRoom(room.code);
      return;
    }
    const user = userRef.user;
    if (!user) return fail(ws, 'not_signed_in');
    const { userId, name } = user;

    switch (msg.t) {
      case 'rooms':
        return send(ws, { t: 'rooms', list: rooms.listPublic(), serverNow: now() });
      case 'create': {
        if (!createLimit.allow(userId, now())) return fail(ws, 'rate_limited');
        const r = rooms.createRoom(userId, name, { visibility: msg.visibility === 'private' ? 'private' : 'public', roomName: msg.roomName });
        if (!r.ok) return fail(ws, r.error);
        return broadcastRoom(r.code);
      }
      case 'join': {
        if (!joinLimit.allow(userId, now())) return fail(ws, 'rate_limited');
        const r = rooms.join(userId, name, String(msg.code ?? ''));
        if (!r.ok) return fail(ws, r.error);
        return broadcastRoom(r.code);
      }
      case 'leave': {
        if (!rooms.roomFor(userId)) return send(ws, { t: 'left' }); // the room may already be gone (a finished game is cleaned up)
        const r = rooms.leave(userId);
        if (!r.ok) return fail(ws, r.error);
        send(ws, { t: 'left' });
        return broadcastRoom(r.code);
      }
      case 'daily': {
        if (!opts.dailyGate) return fail(ws, 'daily_unavailable');
        if (rooms.roomFor(userId)) return fail(ws, 'already_in_room'); // checked first, so the attempt is not wasted
        const date = utcDateKey(new Date(now()));
        let reserved = false;
        try {
          reserved = await opts.dailyGate.reserve(userId, date);
        } catch {
          return fail(ws, 'daily_unavailable');
        }
        if (!reserved) return fail(ws, 'daily_used');
        const r = rooms.startDaily(userId, name, date);
        if (!r.ok) return fail(ws, r.error);
        return broadcastRoom(r.code);
      }
      case 'start': {
        const r = rooms.start(userId);
        if (!r.ok) return fail(ws, r.error);
        return broadcastRoom(r.code);
      }
      case 'act': {
        const a = msg.action;
        const valid = a && ((a.type === 'bank') || ((a.type === 'play' || a.type === 'steal') && typeof a.word === 'string' && a.word.length <= 40));
        if (!valid) return fail(ws, 'bad_message');
        const r = rooms.act(userId, a);
        if (!r.ok) return fail(ws, r.error);
        send(ws, { t: 'result', accepted: r.result.accepted, reason: r.result.reason ?? null, suggestion: r.result.suggestion ?? null });
        const room = rooms.roomFor(userId);
        if (room && r.result.accepted) broadcastRoom(room.code);
        return;
      }
      case 'chat': {
        const room = rooms.roomFor(userId);
        if (!room) return fail(ws, 'not_in_room');
        // Accounts that may not chat (for example under 13 without parental consent) are refused here.
        if (!user.chatAllowed) return send(ws, { t: 'chatBlocked', reason: 'not_allowed', until: null, retryAfterMs: null });
        // A host mute stops the message before it is checked or recorded: it is not a rule violation.
        if (rooms.isMuted(userId)) return send(ws, { t: 'chatBlocked', reason: 'muted', until: null, retryAfterMs: null });
        const res = opts.chat.submit({ userId, name, roomCode: room.code, text: String(msg.text ?? '') });
        if (res.delivered) {
          // Anyone who blocked the sender never receives the message, and is not told it existed.
          for (const id of roomMembers(room.code)) if (id === userId || !blocks.isBlocked(id, userId)) sendTo(id, { t: 'chat', message: res.message });
        } else {
          // Only the sender hears about a held message; nobody else ever receives it.
          send(ws, { t: 'chatBlocked', reason: res.reason, until: 'until' in res ? res.until : null, retryAfterMs: 'retryAfterMs' in res ? res.retryAfterMs : null });
        }
        return;
      }
      case 'report': {
        const room = rooms.roomFor(userId);
        if (!room) return fail(ws, 'not_in_room');
        const r = opts.chat.report({ reporterId: userId, messageId: Number(msg.messageId), roomCode: room.code });
        return send(ws, { t: 'reportResult', ok: r.ok, reason: r.reason ?? null });
      }
      case 'appeal': {
        const r = opts.chat.appeal(userId, String(msg.note ?? ''));
        return send(ws, { t: 'appealResult', ok: r.ok, reason: r.reason ?? null });
      }
      case 'block': {
        if (!blockLimit.allow(userId, now())) return fail(ws, 'rate_limited');
        const r = blocks.block(userId, String(msg.userId ?? ''));
        if (r === 'self') return fail(ws, 'cannot_target');
        if (r !== 'ok') return fail(ws, 'bad_message');
        return sendBlocks(userId);
      }
      case 'unblock':
        blocks.unblock(userId, String(msg.userId ?? ''));
        return sendBlocks(userId);
      case 'mute': {
        const target = msg.userId === undefined ? undefined : String(msg.userId);
        const on = msg.on === true;
        const r = rooms.setMute(userId, on, target);
        if (!r.ok) return fail(ws, r.error);
        hostAction(userId, on ? 'host_mute' : 'host_unmute', r.code, target ?? null);
        return broadcastRoom(r.code);
      }
      case 'kick': {
        const target = String(msg.userId ?? '');
        const r = rooms.kick(userId, target);
        if (!r.ok) return fail(ws, r.error);
        hostAction(userId, 'host_kick', r.code, target);
        sendTo(target, { t: 'kicked' });
        sendTo(target, { t: 'left' });
        return broadcastRoom(r.code);
      }
      default:
        return fail(ws, 'bad_message');
    }
  }

  // One limiter per message type, keyed by player (or by connection before sign-in).
  const budgets = { ...DEFAULT_MESSAGE_LIMITS, ...lim.messageLimits };
  const limiters = new Map<string, RateLimiter>();
  const limiterFor = (type: string) => {
    const key = type in budgets ? type : '*';
    let l = limiters.get(key);
    if (!l) {
      const [max, windowMs] = budgets[key];
      l = new RateLimiter(max, windowMs);
      limiters.set(key, l);
    }
    return l;
  };
  const abuse = new RateLimiter(30, 10_000); // refusals; a client that ignores them is disconnected
  const heartbeat = new WeakMap<WebSocket, { alive: boolean; pingAt: number; rtt: number | null }>();
  let connectionSeq = 0;

  wss.on('connection', (ws, req) => {
    const ip = addressOf(req);
    const connKey = `conn:${++connectionSeq}`;
    perIp.set(ip, (perIp.get(ip) ?? 0) + 1);
    total += 1;
    heartbeat.set(ws, { alive: true, pingAt: 0, rtt: null });
    ws.on('pong', () => {
      const h = heartbeat.get(ws);
      if (!h) return;
      h.alive = true;
      h.rtt = Date.now() - h.pingAt;
    });
    ws.on('error', () => undefined); // a broken socket is handled by 'close'; it must not crash the server
    const ref: { user: AuthUser | null } = { user: null };
    const helloTimer = setTimeout(() => !ref.user && ws.close(4000, 'no hello'), 5000);
    ws.on('message', (data) => {
      let msg: ClientMsg;
      try {
        msg = JSON.parse(data.toString()) as ClientMsg;
      } catch {
        return fail(ws, 'bad_message');
      }
      if (!msg || typeof msg !== 'object' || typeof msg.t !== 'string') return fail(ws, 'bad_message');
      // Every message counts against the overall budget and its own type's budget.
      const who = ref.user?.userId ?? connKey;
      const at = now();
      if (!limiterFor('*').allow(who, at) || !limiterFor(msg.t).allow(who, at)) {
        if (!abuse.allow(who, at)) return void ws.close(4008, 'too many messages');
        return fail(ws, 'rate_limited');
      }
      handle(ws, ref, msg).catch(() => fail(ws, 'bad_message'));
    });
    ws.on('close', () => {
      clearTimeout(helloTimer);
      total -= 1;
      const left = (perIp.get(ip) ?? 1) - 1;
      if (left <= 0) perIp.delete(ip);
      else perIp.set(ip, left);
      const user = ref.user;
      if (!user || sockets.get(user.userId) !== ws) return;
      sockets.delete(user.userId);
      if (!rooms.roomFor(user.userId)) return;
      // Hold the seat briefly so a dropped connection does not hand the player's seat to a bot.
      pendingLeave.set(
        user.userId,
        setTimeout(() => {
          pendingLeave.delete(user.userId);
          const r = rooms.leave(user.userId);
          if (r.ok) broadcastRoom(r.code);
        }, grace),
      );
    });
  });

  const tickTimer = setInterval(() => {
    for (const code of rooms.tick()) broadcastRoom(code);
  }, opts.tickMs ?? 100);
  // Tell a player right away when their case changes, so the chat unlocks (or locks) without a reload.
  const unsubscribeModeration = opts.chat.onChange((userId) => {
    const ws = sockets.get(userId);
    if (ws) send(ws, { t: 'moderation', status: opts.chat.status(userId) });
  });
  const reviewTimer = setInterval(() => void opts.chat.processReviews(), opts.reviewEveryMs ?? 5000);

  // Heartbeat: a socket that did not answer the last ping is gone (a phone that lost signal, a laptop that slept).
  const heartbeatTimer = setInterval(() => {
    for (const ws of wss.clients) {
      const h = heartbeat.get(ws);
      if (!h) continue;
      if (!h.alive) {
        ws.terminate(); // the 'close' handler then holds the seat for the reconnect grace period
        continue;
      }
      h.alive = false;
      h.pingAt = Date.now();
      try {
        ws.ping();
      } catch {
        ws.terminate();
      }
    }
  }, lim.heartbeatMs ?? 25_000);

  // Housekeeping: forget finished games and idle rate-limit entries.
  const finishedTtl = lim.finishedRoomTtlMs ?? 10 * 60_000;
  const sweepTimer = setInterval(() => {
    rooms.sweepFinished(finishedTtl);
    const at = now();
    for (const l of limiters.values()) l.prune(at);
    for (const l of [createLimit, joinLimit, blockLimit, abuse]) l.prune(at);
    opts.chat.prune();
    for (const id of [...names.keys()]) if (!sockets.has(id) && !rooms.roomFor(id)) names.delete(id);
  }, Math.min(30_000, Math.max(1000, finishedTtl / 4)));

  return {
    port: opts.httpServer ? ((opts.httpServer.address() as { port: number } | null)?.port ?? opts.port) : (wss.address() as { port: number }).port,
    rooms,
    chat: opts.chat,
    /** Open sockets, for monitoring. */
    connections: () => total,
    async close() {
      closing = true; // new connections are refused from here on
      clearInterval(tickTimer);
      clearInterval(reviewTimer);
      clearInterval(heartbeatTimer);
      clearInterval(sweepTimer);
      unsubscribeModeration();
      // Tell everyone before cutting them off, so the app can say "restarting" instead of "connection lost".
      for (const ws of wss.clients) send(ws, { t: 'shutdown', reconnectInMs: 3000 });
      const grace = lim.shutdownGraceMs ?? 1000;
      if (grace > 0) await new Promise((r) => setTimeout(r, grace));
      for (const ws of wss.clients) ws.close(1001, 'server restarting');
      await opts.chat.flush(); // pending moderation writes must not be lost on shutdown
      for (const t of pendingLeave.values()) clearTimeout(t);
      await new Promise((r) => setTimeout(r, 50));
      for (const ws of wss.clients) ws.terminate(); // anyone who did not close in time
      await new Promise<void>((resolve) => wss.close(() => resolve()));
    },
  };
}

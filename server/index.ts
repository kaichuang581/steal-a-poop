import { WebSocketServer } from 'ws';
import type { WebSocket } from 'ws';
import type { EngineContext } from '../src/engine';
import { ChatService } from './chat';
import { RateLimiter } from './ratelimit';
import { RoomManager } from './rooms';
import type { ClientAction } from './rooms';
import type { RoomError, Visibility } from './types';

export interface AuthUser {
  userId: string;
  name: string;
}

/** Turns a login token into a user, or null. Production plugs Supabase JWT verification in here. */
export type VerifyToken = (token: string) => Promise<AuthUser | null>;

export interface ServerOptions {
  port: number;
  ctx: EngineContext;
  chat: ChatService;
  verifyToken: VerifyToken;
  randomInt: (n: number) => number;
  now?: () => number;
  /** How long a dropped connection keeps its seat before a bot takes over. */
  reconnectGraceMs?: number;
  tickMs?: number;
  reviewEveryMs?: number;
}

type ClientMsg =
  | { t: 'hello'; token: string }
  | { t: 'rooms' }
  | { t: 'create'; visibility: Visibility; roomName?: string }
  | { t: 'join'; code: string }
  | { t: 'leave' }
  | { t: 'start' }
  | { t: 'act'; action: ClientAction }
  | { t: 'chat'; text: string }
  | { t: 'report'; messageId: number }
  | { t: 'appeal'; note: string };

const MAX_PAYLOAD = 4096;

export async function startServer(opts: ServerOptions) {
  const now = opts.now ?? Date.now;
  const grace = opts.reconnectGraceMs ?? 15_000;
  const rooms = new RoomManager({ ctx: opts.ctx, now, randomInt: opts.randomInt });
  const sockets = new Map<string, WebSocket>(); // userId -> live socket
  const names = new Map<string, string>();
  const pendingLeave = new Map<string, ReturnType<typeof setTimeout>>();
  const createLimit = new RateLimiter(3, 60_000);
  const joinLimit = new RateLimiter(20, 60_000);
  const wss = new WebSocketServer({ port: opts.port, maxPayload: MAX_PAYLOAD });
  await new Promise<void>((resolve) => wss.once('listening', () => resolve()));

  const send = (ws: WebSocket | undefined, msg: object) => {
    if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
  };
  const sendTo = (userId: string, msg: object) => send(sockets.get(userId), msg);
  const roomMembers = (code: string) => rooms.view(code)?.members.map((m) => m.userId) ?? [];
  const broadcastRoom = (code: string) => {
    const view = rooms.view(code);
    if (!view) return;
    for (const m of view.members) sendTo(m.userId, { t: 'room', view, you: { userId: m.userId, seat: view.seatOf[m.userId] ?? null } });
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
      send(ws, { t: 'welcome', userId: user.userId, name: user.name, chat: opts.chat.state(user.userId) });
      const room = rooms.roomFor(user.userId);
      if (room) broadcastRoom(room.code);
      return;
    }
    const user = userRef.user;
    if (!user) return fail(ws, 'not_signed_in');
    const { userId, name } = user;

    switch (msg.t) {
      case 'rooms':
        return send(ws, { t: 'rooms', list: rooms.listPublic() });
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
        const r = rooms.leave(userId);
        if (!r.ok) return fail(ws, r.error);
        send(ws, { t: 'left' });
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
        const res = opts.chat.submit({ userId, name, roomCode: room.code, text: String(msg.text ?? '') });
        if (res.delivered) {
          for (const id of roomMembers(room.code)) sendTo(id, { t: 'chat', message: res.message });
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
      default:
        return fail(ws, 'bad_message');
    }
  }

  wss.on('connection', (ws) => {
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
      handle(ws, ref, msg).catch(() => fail(ws, 'bad_message'));
    });
    ws.on('close', () => {
      clearTimeout(helloTimer);
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
  const reviewTimer = setInterval(() => void opts.chat.processReviews(), opts.reviewEveryMs ?? 5000);

  return {
    port: (wss.address() as { port: number }).port,
    rooms,
    chat: opts.chat,
    async close() {
      clearInterval(tickTimer);
      clearInterval(reviewTimer);
      for (const t of pendingLeave.values()) clearTimeout(t);
      for (const ws of wss.clients) ws.terminate();
      await new Promise<void>((resolve) => wss.close(() => resolve()));
    },
  };
}

import { create } from 'zustand';
import type { Action, ActionResult } from '../engine';
import { load, save } from '../lib/storage';
import { NetClient } from '../net/client';
import { getServerUrl } from '../net/config';
import { describeError } from '../net/protocol';
import type { ChatMsg, ModerationStatus, PublicRoomInfo, RoomViewDTO, ServerMsg } from '../net/protocol';
import { bridge } from './bridge';
import { useStore } from './store';

const RULES_KEY = 'sap:chatRulesAccepted';
const ACT_TIMEOUT_MS = 4000;
const CHAT_KEEP = 200;

interface RoomStore {
  /** The lobby screen is showing. */
  open: boolean;
  status: 'off' | 'connecting' | 'online' | 'reconnecting' | 'closed';
  statusDetail: string | null;
  user: { userId: string; name: string } | null;
  publicRooms: PublicRoomInfo[];
  room: RoomViewDTO | null;
  mySeat: number | null;
  /** Server clock minus this browser's clock, in ms. */
  skew: number;
  chat: ChatMsg[];
  unread: number;
  chatNotice: { reason: string; until: number | null } | null;
  /** The player's own moderation case, pushed by the server whenever it changes. */
  moderation: ModerationStatus | null;
  /** Ids this player has blocked. The server never sends their messages; this is for the buttons. */
  blocked: string[];
  /** The player has read and accepted the chat rules on this browser. */
  rulesAccepted: boolean;
  notice: string | null;

  openLobby(name: string): void;
  closeLobby(): void;
  refresh(): void;
  create(visibility: 'public' | 'private', roomName?: string): void;
  join(code: string): void;
  leave(): void;
  start(): void;
  sendChat(text: string): void;
  report(messageId: number): void;
  appeal(note: string): void;
  block(userId: string): void;
  unblock(userId: string): void;
  /** Host only. With a userId: silence that player. Without: stop chat for everyone but the host. */
  mute(on: boolean, userId?: string): void;
  kick(userId: string): void;
  acceptRules(): void;
  markRead(): void;
  clearNotice(): void;
}

let net: NetClient | null = null;
let pending: ((r: ActionResult | null) => void)[] = [];

function noticeFrom(c: { banned: boolean; suspendedUntil: number | null }): { reason: string; until: number | null } | null {
  return c.banned ? { reason: 'banned', until: null } : c.suspendedUntil ? { reason: 'suspended', until: c.suspendedUntil } : null;
}

export const useRoomStore = create<RoomStore>((set, get) => {
  const send = (msg: Parameters<NetClient['send']>[0]) => {
    if (!net?.send(msg)) set({ notice: 'Not connected to the game server.' });
  };

  const onMessage = (msg: ServerMsg) => {
    switch (msg.t) {
      case 'welcome':
        set({
          user: { userId: msg.userId, name: msg.name },
          skew: msg.serverNow - Date.now(),
          chatNotice: noticeFrom(msg.chat),
          moderation: msg.moderation ?? null,
        });
        send({ t: 'rooms' });
        break;
      case 'blocks':
        set((s) => ({ blocked: msg.list, chat: s.chat.filter((m) => !msg.list.includes(m.userId)) }));
        break;
      case 'kicked':
        set({ notice: 'The host removed you from the room.' });
        break;
      case 'moderation':
        // The server decides; the chat locks or unlocks to match, with no reload.
        set({ moderation: msg.status, chatNotice: noticeFrom(msg.status) });
        break;
      case 'rooms':
        set({ publicRooms: msg.list, skew: msg.serverNow - Date.now() });
        break;
      case 'room': {
        const previous = get().room;
        set({
          room: msg.view,
          mySeat: msg.you.seat,
          skew: msg.serverNow - Date.now(),
          chat: previous && previous.code === msg.view.code ? get().chat : [],
        });
        // Feed the table: the game screen reads the same store it uses for solo games.
        useStore.setState(
          msg.view.game
            ? { game: msg.view.game, mode: 'room', mySeat: msg.you.seat ?? 0, now: Date.now() + (msg.serverNow - Date.now()) }
            : { game: null },
        );
        break;
      }
      case 'left':
        set({ room: null, mySeat: null, chat: [], unread: 0 });
        useStore.setState({ game: null, mode: 'quick', mySeat: 0 });
        break;
      case 'result': {
        const resolve = pending.shift();
        resolve?.({ state: undefined as never, accepted: msg.accepted, reason: msg.reason ?? undefined, suggestion: msg.suggestion ?? undefined });
        break;
      }
      case 'chat':
        if (get().blocked.includes(msg.message.userId)) break; // belt and braces: the server already withholds these
        set((s) => ({ chat: [...s.chat, msg.message].slice(-CHAT_KEEP), unread: s.unread + 1 }));
        break;
      case 'chatBlocked':
        set({ chatNotice: { reason: msg.reason, until: msg.until }, notice: msg.reason === 'rate_limited' ? 'You are sending messages too fast.' : null });
        break;
      case 'reportResult':
        set({ notice: msg.ok ? 'Thanks. Your report was sent for review.' : 'Could not send that report.' });
        break;
      case 'appealResult':
        set({ notice: msg.ok ? 'Your appeal was sent. A person will review it.' : msg.reason === 'appeal_already_open' ? 'You already have an appeal open.' : 'There is nothing to appeal.' });
        break;
      case 'error':
        set({ notice: describeError(msg.error) });
        break;
    }
  };

  const act = (action: Action): Promise<ActionResult | null> =>
    new Promise((resolve) => {
      const body =
        action.type === 'bank' ? ({ type: 'bank' } as const)
        : action.type === 'play' || action.type === 'steal' ? ({ type: action.type, word: action.word } as const)
        : null;
      if (!body || !net?.send({ t: 'act', action: body })) return resolve(null);
      const timer = setTimeout(() => resolve(null), ACT_TIMEOUT_MS);
      pending.push((r) => {
        clearTimeout(timer);
        resolve(r);
      });
    });

  bridge.act = act;
  bridge.leaveRoom = () => get().leave();
  bridge.skew = () => get().skew;

  return {
    open: false,
    status: 'off',
    statusDetail: null,
    user: null,
    publicRooms: [],
    room: null,
    mySeat: null,
    skew: 0,
    chat: [],
    unread: 0,
    chatNotice: null,
    moderation: null,
    blocked: [],
    rulesAccepted: load<boolean>(RULES_KEY, false),
    notice: null,

    openLobby(name) {
      const url = getServerUrl();
      set({ open: true, notice: null });
      if (!url) return set({ notice: 'The game server is not set up yet.' });
      if (net) return;
      // Sign-in is a development stub until real accounts exist: the server only accepts it locally.
      const nickname = name.trim() || `Player${Math.floor(Math.random() * 900 + 100)}`;
      net = new NetClient(url, `dev:${nickname}`, {
        onMessage,
        onStatus: (status, detail) => set({ status, statusDetail: detail ?? null }),
      });
      net.connect();
    },
    closeLobby() {
      if (get().room) get().leave();
      net?.close();
      net = null;
      pending = [];
      set({ open: false, status: 'off', user: null, publicRooms: [], notice: null });
    },
    refresh: () => send({ t: 'rooms' }),
    create: (visibility, roomName) => send({ t: 'create', visibility, roomName }),
    join: (code) => send({ t: 'join', code }),
    leave: () => send({ t: 'leave' }),
    start: () => send({ t: 'start' }),
    sendChat: (text) => send({ t: 'chat', text }),
    report: (messageId) => send({ t: 'report', messageId }),
    appeal: (note) => send({ t: 'appeal', note }),
    block: (userId) => send({ t: 'block', userId }),
    unblock: (userId) => send({ t: 'unblock', userId }),
    mute: (on, userId) => send(userId === undefined ? { t: 'mute', on } : { t: 'mute', on, userId }),
    kick: (userId) => send({ t: 'kick', userId }),
    acceptRules() {
      save(RULES_KEY, true);
      set({ rulesAccepted: true });
    },
    markRead: () => set({ unread: 0 }),
    clearNotice: () => set({ notice: null }),
  };
});

import { getAvatar } from '../skin/avatars/store';
import { create } from 'zustand';
import type { Action, ActionResult } from '../engine';
import { load, save } from '../lib/storage';
import { NetClient } from '../net/client';
import { getServerUrl } from '../net/config';
import { describeError } from '../net/protocol';
import type { ChatMsg, ModerationStatus, PublicRoomInfo, RoomSettingsDTO, RoomViewDTO, ServerMsg } from '../net/protocol';
import { authEnabled } from '../auth/config';
import { getAccessToken } from '../auth/authStore';
import { bridge } from './bridge';
import { useSocial } from './socialStore';
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

  /** Friends who invited you to a room. Each lasts a minute. */
  invites: Invite[];
  /** What the last finished game paid, for the end screen. */
  lastReward: Reward | null;
  /** Opens the connection without showing the lobby (signed-in players stay connected so friends can invite them). */
  connect(): void;
  disconnect(): void;
  invite(userId: string): void;
  /** Tells the server which avatar you picked (null: the default sheep). Quiet if offline. */
  sendAvatar(id: string | null): void;
  acceptInvite(code: string): void;
  dismissInvite(code: string): void;
  /** Starts today's server-run Daily Table. */
  startDaily(): void;
  openLobby(name: string): void;
  /**
   * Connects if need be, then does one thing: quick play, a new lobby, or a party code. No lobby screen in between;
   * the room appears when the server answers. `entering` is true until it does.
   */
  enter(name: string, intent: Intent): void;
  entering: boolean;
  closeLobby(): void;
  refresh(): void;
  create(visibility: 'public' | 'private', roomName?: string): void;
  join(code: string): void;
  /** Quick start: straight into the fullest open room, or a new one. */
  quick(): void;
  /** Host only: game length, and whether the room is open to quick-start players. */
  setOptions(patch: Partial<RoomSettingsDTO> & { visibility?: 'public' | 'private' }): void;
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

export type Intent = { t: 'quick' } | ({ t: 'create'; visibility: 'public' | 'private' } & Partial<RoomSettingsDTO>) | { t: 'join'; code: string };

export interface Invite {
  code: string;
  roomName: string;
  from: { userId: string; name: string };
}
export interface Reward {
  coins: number;
  parts: { label: string; coins: number }[];
  balance: number;
}

let net: NetClient | null = null;

/**
 * The development sign-in (no accounts configured): "dev:<name>#<id>". The id is kept per tab, so two people who typed
 * the same name are two players, and a reload or a dropped connection comes back as the same one. A real server refuses it.
 */
function devToken(name: string): string {
  let id = '';
  try {
    id = sessionStorage.getItem('sap:devId') ?? '';
    if (!id) {
      id = Math.random().toString(36).slice(2, 10);
      sessionStorage.setItem('sap:devId', id);
    }
  } catch { /* storage blocked: the name alone still signs in */ }
  const clean = name.replace(/#/g, '').slice(0, 12);
  return id ? `dev:${clean}#${id}` : `dev:${clean}`;
}
let dailyWhenOnline = false;
let pendingIntent: Intent | null = null;
let welcomedAt = 0;
let lastRoomMsgAt = 0;
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
        // After a server restart the room is gone. The server sends the room right after the welcome if it still exists.
        if (get().room) {
          const code = get().room!.code;
          setTimeout(() => {
            if (lastRoomMsgAt < welcomedAt && get().room?.code === code) {
              set({ room: null, mySeat: null, chat: [], unread: 0, notice: 'The server restarted, so that game ended.' });
              useStore.setState({ game: null, mode: 'quick', mySeat: 0 });
            }
          }, 2000);
        }
        welcomedAt = Date.now();
        net?.send({ t: 'avatar', id: getAvatar() });
        send({ t: 'rooms' });
        if (pendingIntent) {
          send(pendingIntent);
          pendingIntent = null;
        }
        if (dailyWhenOnline) {
          dailyWhenOnline = false;
          send({ t: 'daily' });
        }
        break;
      case 'blocks':
        set((s) => ({ blocked: msg.list, chat: s.chat.filter((m) => !msg.list.includes(m.userId)) }));
        break;
      case 'invited': {
        const inv: Invite = { code: msg.code, roomName: msg.roomName, from: msg.from };
        set((st) => ({ invites: [...st.invites.filter((i) => i.code !== inv.code || i.from.userId !== inv.from.userId), inv] }));
        setTimeout(() => get().dismissInvite(inv.code), 60_000);
        break;
      }
      case 'inviteResult':
        set({ notice: msg.ok ? 'Invite sent.' : msg.reason === 'offline' ? 'That friend is not online.' : msg.reason === 'busy' ? 'That friend is already in a room.' : msg.reason === 'already_invited' ? 'You just invited them.' : msg.reason === 'not_in_lobby' ? 'You can invite friends before the game starts.' : 'You can only invite friends.' });
        break;
      case 'reward':
        set({ lastReward: { coins: msg.coins, parts: msg.parts, balance: msg.balance } });
        useSocial.getState().setBalance(msg.balance);
        break;
      case 'reauth':
        // The server wants a fresh login token before the old one expires.
        void getAccessToken().then((token) => token && net?.send({ t: 'auth', token }));
        break;
      case 'shutdown':
        set({ notice: 'The server is restarting. Reconnecting in a moment…' });
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
        lastRoomMsgAt = Date.now();
        const previous = get().room;
        set({
          room: msg.view,
          mySeat: msg.you.seat,
          skew: msg.serverNow - Date.now(),
          chat: previous && previous.code === msg.view.code ? get().chat : [],
          entering: false,
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
        set({ room: null, mySeat: null, chat: [], unread: 0, lastReward: null });
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
        set({ notice: describeError(msg.error), entering: false });
        break;
    }
  };

  const act = (action: Action): Promise<ActionResult | null> =>
    new Promise((resolve) => {
      const body =
        action.type === 'bank' ? ({ type: 'bank' } as const)
        : action.type === 'pass' ? ({ type: 'pass' } as const)
        : action.type === 'play' ? ({ type: 'play', word: action.word } as const)
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
    entering: false,
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
    invites: [],
    lastReward: null,
    rulesAccepted: load<boolean>(RULES_KEY, false),
    notice: null,

    connect() {
      const url = getServerUrl();
      if (!url || net) return;
      // With real sign-in the token is the Supabase login (fetched fresh on every connect). The dev stub is for local servers only.
      const nickname = `Player${Math.floor(Math.random() * 900 + 100)}`;
      net = new NetClient(url, authEnabled() ? getAccessToken : devToken(nickname), {
        onMessage,
        onStatus: (status, detail) => set({ status, statusDetail: detail ?? null }),
      });
      net.connect();
    },
    disconnect() {
      net?.close();
      net = null;
      pending = [];
      dailyWhenOnline = false;
      pendingIntent = null;
      set({ open: false, entering: false, status: 'off', user: null, publicRooms: [], room: null, notice: null, invites: [], lastReward: null });
    },
    openLobby(name) {
      const url = getServerUrl();
      set({ open: true, notice: null });
      if (!url) return set({ notice: 'The game server is not set up yet.' });
      if (net) return;
      // Development sign-in (no accounts configured): the typed nickname becomes the dev token. The server only accepts it locally.
      const nickname = name.trim() || `Player${Math.floor(Math.random() * 900 + 100)}`;
      net = new NetClient(url, authEnabled() ? getAccessToken : devToken(nickname), {
        onMessage,
        onStatus: (status, detail) => set({ status, statusDetail: detail ?? null }),
      });
      net.connect();
    },
    enter(name, intent) {
      const url = getServerUrl();
      if (!url) return set({ notice: 'The game server is not set up yet.' });
      set({ notice: null, entering: true });
      if (net && get().status === 'online') return send(intent);
      pendingIntent = intent;
      if (net && get().status !== 'closed') return; // already on its way up: the welcome sends it
      net?.close();
      const nickname = name.trim() || `Player${Math.floor(Math.random() * 900 + 100)}`;
      net = new NetClient(url, authEnabled() ? getAccessToken : devToken(nickname), {
        onMessage,
        onStatus: (status, detail) => {
          set({ status, statusDetail: detail ?? null });
          if (status === 'closed' && pendingIntent) {
            pendingIntent = null;
            set({ entering: false, notice: 'Could not reach the game server. Try again in a moment.' });
          }
        },
      });
      net.connect();
    },
    closeLobby() {
      if (get().room) get().leave();
      // A signed-in player stays connected, so a friend's invite still reaches them.
      if (authEnabled()) return set({ open: false, notice: null });
      net?.close();
      net = null;
      pending = [];
      set({ open: false, status: 'off', user: null, publicRooms: [], notice: null });
    },
    invite: (userId) => send({ t: 'invite', userId }),
    sendAvatar: (id) => { net?.send({ t: 'avatar', id }); },
    acceptInvite(code) {
      set((st) => ({ invites: st.invites.filter((i) => i.code !== code), open: true }));
      send({ t: 'join', code });
    },
    dismissInvite: (code) => set((st) => ({ invites: st.invites.filter((i) => i.code !== code) })),
    startDaily() {
      if (!getServerUrl()) return;
      get().connect();
      if (get().status === 'online') send({ t: 'daily' });
      else dailyWhenOnline = true; // sent as soon as the connection is up
    },
    refresh: () => send({ t: 'rooms' }),
    create: (visibility, roomName) => send({ t: 'create', visibility, roomName }),
    join: (code) => send({ t: 'join', code }),
    quick: () => send({ t: 'quick' }),
    setOptions: (patch) => send({ t: 'options', ...patch }),
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

import { useLayoutEffect, useState } from 'react';
import type { RoomViewDTO } from '../../net/protocol';
import { useRoomStore } from '../../state/roomStore';
import { PaintedRoom } from './PaintedRoom';

const NAMES = ['Brian2', 'Maple', 'Barley', 'Tansy', 'owen2008', 'Pip', 'MapleLeafKid', 'realfrog', 'libo', 'thegoatjo'];
const ANIMALS = ['sheep', 'cow', 'pig', 'goat', 'horse', 'chicken'];
const LINES = ['hi', 'anyone here?', 'yo', 'ready when you are', 'what does twists do', 'a surprise rule each round', 'gg last time', 'lol', 'one more player', 'nice hat', 'lets go', 'brb', 'ok back', 'who is host', 'me', 'start it', 'waiting on one more', 'here', 'hey all', 'good luck'];

/**
 * The pen screen with made-up players and no server, for screenshots (development only):
 * `?preview=room&kind=queue|ranked|lobby&n=1..10&bots=0..&host=1|0&chat=0..20&fold=1&paused=1&phase=starting&notice=1&offline=1`.
 * Buttons do nothing but change this page's own room (Open the gate starts the gate's swing).
 */
export function RoomPreview() {
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    const q = new URLSearchParams(location.search);
    const kind = q.get('kind') ?? 'queue', ranked = kind === 'ranked';
    const max = ranked ? 4 : 10, min = 2;
    const bots = Math.max(0, Number(q.get('bots') ?? 0));
    const n = Math.max(1, Math.min(max, Number(q.get('n') ?? 1))) - (ranked ? 0 : bots);
    const host = q.get('host') !== '0';
    const members = Array.from({ length: Math.max(1, n) }, (_, i) => ({ userId: `u${i}`, name: NAMES[i], avatar: ANIMALS[i % ANIMALS.length], rating: ranked ? 900 + i * 180 : undefined }));
    const meId = host || ranked ? 'u0' : members.length > 1 ? 'u1' : 'u0';
    const startsIn = q.get('auto');
    const room: RoomViewDTO = {
      code: 'KXLNP', name: kind === 'lobby' ? 'Brian2’s lobby' : '', visibility: 'private', hostId: 'u0', queue: kind === 'queue', ranked,
      settings: { turnsPerRound: 2, lives: 3, twists: true }, members, botNames: ranked ? [] : NAMES.slice(n, n + bots).map((x) => `${x}`),
      phase: q.get('phase') === 'starting' ? 'playing' : 'lobby', min, max, seatOf: {}, game: null,
      chatMuted: q.get('paused') === '1', mutedIds: [], startAt: startsIn ? Date.now() + Number(startsIn) * 1000 : null,
    };
    const chat = Array.from({ length: Math.min(LINES.length, Number(q.get('chat') ?? 0)) }, (_, i) => ({ id: i + 1, roomCode: room.code, userId: members[i % members.length].userId, name: members[i % members.length].name, text: LINES[i], at: Date.now() - (20 - i) * 9000 }));
    try { sessionStorage.setItem('sap:pen-chat-folded', q.get('fold') === '1' ? '1' : '0'); } catch { /* ignore */ }
    const set = (r: Partial<RoomViewDTO>) => useRoomStore.setState((s) => ({ room: s.room ? { ...s.room, ...r } : s.room }));
    useRoomStore.setState({
      status: q.get('offline') === '1' ? 'reconnecting' : 'online', user: { userId: meId, name: members.find((m) => m.userId === meId)!.name },
      room, chat, unread: q.get('fold') === '1' ? chat.length : 0, rulesAccepted: true, chatNotice: null, blocked: [], skew: 0,
      notice: q.get('notice') === '1' ? 'Maple left the pen.' : null,
      start: () => set({ phase: 'playing' }), leave: () => undefined, clearNotice: () => useRoomStore.setState({ notice: null }),
      setOptions: (o: Partial<RoomViewDTO['settings']> & { visibility?: 'public' | 'private' }) => set({ ...(o.visibility ? { visibility: o.visibility } : {}), settings: { ...useRoomStore.getState().room!.settings!, ...o } }),
      mute: (on: boolean, id?: string) => set(id ? { mutedIds: on ? [...useRoomStore.getState().room!.mutedIds, id] : useRoomStore.getState().room!.mutedIds.filter((x) => x !== id) } : { chatMuted: on }),
      kick: (id: string) => set({ members: useRoomStore.getState().room!.members.filter((m) => m.userId !== id) }),
      sendChat: (text: string) => useRoomStore.setState((s) => ({ chat: [...s.chat, { id: s.chat.length + 1, roomCode: room.code, userId: meId, name: 'you', text, at: Date.now() }] })),
      markRead: () => useRoomStore.setState({ unread: 0 }), report: () => undefined, block: () => undefined, unblock: () => undefined, appeal: () => undefined,
    } as never);
    // A test hook for the screenshots: add or take away a player.
    (window as unknown as { penPreview: unknown }).penPreview = {
      join: () => { const r = useRoomStore.getState().room!; const i = r.members.length; set({ members: [...r.members, { userId: `u${i + 20}`, name: NAMES[i % NAMES.length], avatar: ANIMALS[i % 6] }] }); },
      leave: () => { const r = useRoomStore.getState().room!; set({ members: r.members.slice(0, -1) }); },
    };
    setReady(true);
  }, []);
  return ready ? <PaintedRoom /> : null;
}

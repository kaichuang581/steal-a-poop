import { useState } from 'react';
import { useRoomStore } from '../state/roomStore';
import { ChatPanel } from './ChatPanel';

/** Waiting room: share the code, see who is in, and (for the host) start the game. */
export function RoomScreen() {
  const room = useRoomStore((s) => s.room)!;
  const me = useRoomStore((s) => s.user?.userId);
  const notice = useRoomStore((s) => s.notice);
  const status = useRoomStore((s) => s.status);
  const { start, leave, clearNotice } = useRoomStore.getState();
  const [copied, setCopied] = useState(false);
  const isHost = room.hostId === me;
  const enough = room.members.length >= room.min;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(room.code);
    } catch {
      window.prompt('Copy the room code:', room.code);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <main className="mx-auto flex h-full w-full max-w-2xl flex-col gap-3 overflow-y-auto px-4 py-4">
      <header className="flex items-center gap-2">
        <h1 className="min-w-0 flex-1 truncate text-2xl font-black text-amber-300">{room.name}</h1>
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase">{room.visibility}</span>
        <button onClick={leave} className="min-h-11 rounded-lg bg-red-400 px-3 font-black text-red-950">Leave</button>
      </header>

      <div aria-live="polite">
        {status !== 'online' && <div role="status" className="rounded-xl bg-red-500/20 px-3 py-2 text-sm font-bold">Connection lost. Reconnecting… your seat is held for a few seconds.</div>}
        {notice && (
          <div role="status" className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-500/15 px-3 py-2 text-sm font-bold">
            <span>{notice}</span>
            <button onClick={clearNotice} aria-label="Dismiss" className="min-h-11 min-w-11">✕</button>
          </div>
        )}
      </div>

      <section className="rounded-2xl border-2 border-wood-light bg-wood/30 p-4 text-center" aria-label="Room code">
        <div className="text-xs font-bold uppercase tracking-widest text-white/60">Room code</div>
        <div className="my-1 text-5xl font-black tracking-[0.3em] text-amber-300" data-room-code>{room.code}</div>
        <button onClick={copy} className="min-h-11 rounded-lg bg-white/15 px-4 font-bold">{copied ? 'Copied!' : 'Copy code'}</button>
        <p className="mt-1 text-xs text-white/60">Anyone with this code can join before the game starts.</p>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-3" aria-label="Players">
        <h2 className="text-sm font-black uppercase tracking-wider text-white/60">Players {room.members.length}/{room.max}</h2>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {room.members.map((m) => (
            <li key={m.userId} className="flex items-center gap-2 rounded-xl bg-black/30 px-3 py-2">
              <span className="flex size-8 items-center justify-center rounded-full bg-amber-400 font-black text-amber-950">{m.name[0]?.toUpperCase()}</span>
              <span className="min-w-0 flex-1 truncate font-bold">{m.name}{m.userId === me ? ' (you)' : ''}</span>
              {m.userId === room.hostId && <span className="rounded-full bg-amber-400 px-2 py-0.5 text-xs font-black text-amber-950">HOST</span>}
            </li>
          ))}
        </ul>
        <div className="mt-3">
          {isHost ? (
            <>
              <button
                onClick={start} disabled={!enough}
                className="min-h-12 w-full rounded-xl bg-emerald-500 text-lg font-black text-emerald-950 disabled:opacity-40"
              >
                Start game
              </button>
              <p className="mt-1 text-center text-xs text-white/60">
                {enough ? 'You start the game when everyone is ready. It never starts by itself.' : `You need at least ${room.min} players to start (${room.members.length}/${room.min}).`}
              </p>
            </>
          ) : (
            <p className="text-center text-sm font-bold text-white/70">Waiting for the host to start the game…</p>
          )}
        </div>
      </section>

      <ChatPanel />
    </main>
  );
}

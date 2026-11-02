import { useState } from 'react';
import { useRoomStore } from '../state/roomStore';

const seg = (on: boolean) =>
  `min-h-11 flex-1 rounded-lg px-3 text-sm font-bold ${on ? 'bg-amber-400 text-amber-950' : 'bg-white/10 hover:bg-white/15'}`;

/** Browse open public rooms, make a room, or join one with its code. */
export function Lobby() {
  const status = useRoomStore((s) => s.status);
  const detail = useRoomStore((s) => s.statusDetail);
  const user = useRoomStore((s) => s.user);
  const rooms = useRoomStore((s) => s.publicRooms);
  const notice = useRoomStore((s) => s.notice);
  const { refresh, create, join, closeLobby, clearNotice, openLobby } = useRoomStore.getState();
  const [code, setCode] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [roomName, setRoomName] = useState('');
  const online = status === 'online';

  const pill =
    status === 'online' ? `Online as ${user?.name ?? ''}`
    : status === 'connecting' ? 'Connecting…'
    : status === 'reconnecting' ? 'Reconnecting…'
    : `Disconnected${detail ? `: ${detail}` : ''}`;

  return (
    <main className="mx-auto flex h-full w-full max-w-2xl flex-col gap-3 overflow-y-auto px-4 py-4">
      <header className="flex items-center gap-2">
        <button onClick={closeLobby} className="min-h-11 rounded-lg bg-white/10 px-3 font-bold">← Back</button>
        <h1 className="flex-1 text-2xl font-black text-amber-300">Play with others</h1>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${online ? 'bg-emerald-500/30 text-emerald-200' : 'bg-red-500/30 text-red-200'}`}>{pill}</span>
      </header>

      <div aria-live="polite" className="min-h-0">
        {notice && (
          <div role="status" className="flex items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-500/15 px-3 py-2 text-sm font-bold">
            <span>{notice}</span>
            <button onClick={clearNotice} aria-label="Dismiss" className="min-h-11 min-w-11">✕</button>
          </div>
        )}
      </div>
      {(status === 'closed') && (
        <button onClick={() => { closeLobby(); openLobby(user?.name ?? ''); }} className="min-h-12 rounded-xl bg-sky-500 font-black text-sky-950">Try again</button>
      )}

      <section className="rounded-2xl border border-white/10 bg-white/5 p-3" aria-label="Create a room">
        <h2 className="text-sm font-black uppercase tracking-wider text-white/60">Create a room</h2>
        <div className="mt-2 flex gap-2">
          <button onClick={() => setVisibility('public')} aria-pressed={visibility === 'public'} className={seg(visibility === 'public')}>Public</button>
          <button onClick={() => setVisibility('private')} aria-pressed={visibility === 'private'} className={seg(visibility === 'private')}>Private</button>
        </div>
        <p className="mt-1 text-xs text-white/60">
          {visibility === 'public' ? 'Anyone can find it in the list below.' : 'Only people with the room code can join.'}
        </p>
        <div className="mt-2 flex gap-2">
          <input
            value={roomName} onChange={(e) => setRoomName(e.target.value.slice(0, 24))} aria-label="Room name (optional)"
            placeholder="Room name (optional)" className="min-h-12 min-w-0 flex-1 rounded-xl border-2 border-white/20 bg-black/40 px-3"
          />
          <button disabled={!online} onClick={() => create(visibility, roomName.trim() || undefined)} className="min-h-12 rounded-xl bg-emerald-500 px-5 font-black text-emerald-950 disabled:opacity-40">Create</button>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-3" aria-label="Join with a code">
        <h2 className="text-sm font-black uppercase tracking-wider text-white/60">Join with a code</h2>
        <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (code.trim()) join(code); }}>
          <input
            value={code} onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 8))} aria-label="Room code" placeholder="ABCDE"
            autoCapitalize="characters" autoComplete="off" spellCheck={false}
            className="min-h-12 min-w-0 flex-1 rounded-xl border-2 border-white/20 bg-black/40 px-3 text-center text-xl font-black uppercase tracking-[0.3em]"
          />
          <button type="submit" disabled={!online || !code.trim()} className="min-h-12 rounded-xl bg-fuchsia-700 px-5 font-black disabled:opacity-40">Join</button>
        </form>
      </section>

      <section className="min-h-0 rounded-2xl border border-white/10 bg-white/5 p-3" aria-label="Open public rooms">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black uppercase tracking-wider text-white/60">Open public rooms</h2>
          <button onClick={refresh} disabled={!online} className="min-h-11 rounded-lg bg-white/10 px-3 text-sm font-bold disabled:opacity-40">Refresh</button>
        </div>
        {rooms.length === 0 ? (
          <p className="py-4 text-center text-sm text-white/60">No open rooms right now. Create one and invite someone.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {rooms.map((r) => (
              <li key={r.code} className="flex items-center gap-3 rounded-xl bg-black/30 p-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-black">{r.name}</div>
                  <div className="text-xs text-white/60">Host {r.hostName} · {r.players}/{r.max} players · needs {r.min} to start</div>
                </div>
                <button onClick={() => join(r.code)} className="min-h-11 rounded-lg bg-emerald-500 px-4 font-black text-emerald-950">Join</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

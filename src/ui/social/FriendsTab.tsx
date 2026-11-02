import { useEffect, useState } from 'react';
import { useRoomStore } from '../../state/roomStore';
import { useSocial } from '../../state/socialStore';
import { NameTag } from './NameTag';

const input = 'min-h-11 min-w-0 flex-1 rounded-lg border border-white/30 bg-black/40 px-3 uppercase tracking-widest';
const small = 'min-h-11 rounded-lg px-3 text-sm font-bold';

export function FriendsTab() {
  const { friends, code, error, notice, loadFriends, loadCode, resetCode, request, accept, remove } = useSocial();
  const inRoom = useRoomStore((s) => !!s.room && s.room.phase === 'lobby');
  const [typed, setTyped] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void loadFriends();
    void loadCode();
    const t = setInterval(() => void loadFriends(), 15_000); // who is online
    return () => clearInterval(t);
  }, [loadFriends, loadCode]);

  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      window.prompt('Copy your friend code:', code);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="space-y-4">
      {error && <p role="alert" className="rounded-lg border border-red-400 bg-red-900/40 p-2 text-sm">{error}</p>}
      {notice && <p role="status" className="rounded-lg border border-sky-300/50 bg-sky-900/40 p-2 text-sm">{notice}</p>}

      <section aria-label="Your friend code" className="rounded-xl bg-white/5 p-3">
        <h3 className="text-sm font-black uppercase tracking-wider text-white/60">Your friend code</h3>
        <p className="my-1 text-3xl font-black tracking-[0.25em] text-amber-300" data-friend-code>{code ?? '…'}</p>
        <p className="text-xs text-white/60">Give it only to people you know. Anyone with the code can ask to be your friend. You choose whether to accept.</p>
        <div className="mt-2 flex gap-2">
          <button className={`${small} bg-white/15`} onClick={copy}>{copied ? 'Copied!' : 'Copy'}</button>
          <button className={`${small} bg-white/10`} onClick={() => void resetCode()}>Make a new code</button>
        </div>
      </section>

      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (typed.trim()) void request(typed).then(() => setTyped('')); }}>
        <input value={typed} onChange={(e) => setTyped(e.target.value)} maxLength={20} aria-label="Friend's code" placeholder="Friend's code" className={input} autoComplete="off" />
        <button className={`${small} bg-amber-400 text-amber-950`} disabled={!typed.trim()}>Add</button>
      </form>

      {!!friends?.incoming.length && (
        <section aria-label="Friend requests">
          <h3 className="text-sm font-black uppercase tracking-wider text-white/60">Asking to be your friend</h3>
          <ul className="mt-1 space-y-1">
            {friends.incoming.map((f) => (
              <li key={f.userId} className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-1">
                <span className="min-w-0 flex-1"><NameTag name={f.name} cosmetics={f.cosmetics} /></span>
                <button className={`${small} bg-emerald-500 text-emerald-950`} aria-label={`Accept ${f.name}`} onClick={() => void accept(f.userId)}>Accept</button>
                <button className={`${small} bg-white/10`} aria-label={`Decline ${f.name}`} onClick={() => void remove(f.userId)}>Decline</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Friends">
        <h3 className="text-sm font-black uppercase tracking-wider text-white/60">Friends {friends ? `(${friends.friends.length})` : ''}</h3>
        {friends && friends.friends.length === 0 && <p className="mt-1 text-sm text-white/60">No friends yet. Swap codes with someone you know.</p>}
        <ul className="mt-1 space-y-1">
          {friends?.friends.map((f) => (
            <li key={f.userId} className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-1">
              <span role="img" aria-label={f.online ? 'Online' : 'Offline'} className={`size-2.5 rounded-full ${f.online ? 'bg-emerald-400' : 'bg-white/25'}`} />
              <span className="min-w-0 flex-1"><NameTag name={f.name} cosmetics={f.cosmetics} /></span>
              {inRoom && f.online && (
                <button className={`${small} bg-sky-500 text-sky-950`} aria-label={`Invite ${f.name}`} onClick={() => useRoomStore.getState().invite(f.userId)}>Invite</button>
              )}
              <button className={`${small} bg-white/10`} aria-label={`Remove ${f.name}`} onClick={() => void remove(f.userId)}>Remove</button>
            </li>
          ))}
        </ul>
      </section>

      {!!friends?.outgoing.length && (
        <section aria-label="Requests you sent">
          <h3 className="text-sm font-black uppercase tracking-wider text-white/60">Waiting for an answer</h3>
          <ul className="mt-1 space-y-1">
            {friends.outgoing.map((f) => (
              <li key={f.userId} className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-1">
                <span className="min-w-0 flex-1"><NameTag name={f.name} /></span>
                <button className={`${small} bg-white/10`} aria-label={`Cancel request to ${f.name}`} onClick={() => void remove(f.userId)}>Cancel</button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

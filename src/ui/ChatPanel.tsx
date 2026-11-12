import { useEffect, useRef, useState } from 'react';
import { useRoomStore } from '../state/roomStore';
import { ChatBanner, ChatRulesModal } from './ChatRules';
import { ModerationNotice } from './mod/ModerationNotice';
import { NameTag } from './social/NameTag';

function formatUntil(until: number | null): string {
  if (!until) return 'permanently';
  const mins = Math.max(1, Math.round((until - Date.now()) / 60000));
  return mins >= 90 ? `for about ${Math.round(mins / 60)} hours` : `for about ${mins} minutes`;
}

/** Room chat. The rules banner is always on screen, and chat is locked until the rules are accepted. */
export function ChatPanel({ height = 'h-64', compact = false }: { height?: string; compact?: boolean }) {
  const chat = useRoomStore((s) => s.chat);
  const me = useRoomStore((s) => s.user?.userId);
  const accepted = useRoomStore((s) => s.rulesAccepted);
  const notice = useRoomStore((s) => s.chatNotice);
  const room = useRoomStore((s) => s.room);
  const blocked = useRoomStore((s) => s.blocked);
  const { sendChat, report, appeal, markRead, block, unblock, mute, kick } = useRoomStore.getState();
  const isHost = !!room && room.hostId === me;
  const nameOf = (id: string) => room?.members.find((m) => m.userId === id)?.name ?? 'a player';
  const [confirmKick, setConfirmKick] = useState<string | null>(null);
  // Muted by the host: the whole room (everyone but the host) or this player alone.
  const hostMuted = !!room && !!me && (room.mutedIds.includes(me) || (room.chatMuted && !isHost));
  const [text, setText] = useState('');
  const [appealing, setAppealing] = useState(false);
  const [note, setNote] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const muted = !!notice && (notice.reason === 'banned' || notice.reason === 'suspended' || notice.reason === 'blocked') && (notice.until === null || notice.until > Date.now());

  useEffect(() => {
    markRead();
    // Only the log scrolls to its newest line: scrollIntoView would also drag the whole page down to the chat.
    const log = endRef.current?.parentElement;
    if (log) log.scrollTop = log.scrollHeight;
  }, [chat.length, markRead]);

  const submit = () => {
    const t = text.trim();
    if (!t || muted || hostMuted) return;
    sendChat(t);
    setText('');
  };

  return (
    <section aria-label="Room chat" className="flex min-h-0 flex-col gap-2">
      {!accepted && <ChatRulesModal />}
      <ChatBanner compact={compact} />
      <ModerationNotice />
      {muted && (
        <div role="alert" className="rounded-xl border-2 border-red-400 bg-red-900/40 p-3 text-sm">
          <b>Your chat is {notice!.reason === 'banned' ? 'banned' : 'suspended'} {notice!.reason === 'banned' ? '' : formatUntil(notice!.until)}.</b>{' '}
          Your message was held and nobody saw it. It is being reviewed.
          {appealing ? (
            <div className="mt-2 flex gap-2">
              <input
                value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} aria-label="Why should we look again?"
                placeholder="Why should we look again?"
                className="min-h-11 min-w-0 flex-1 rounded-lg border border-white/30 bg-black/40 px-3"
              />
              <button onClick={() => { appeal(note.trim() || 'Please review.'); setAppealing(false); setNote(''); }} className="min-h-11 rounded-lg bg-amber-400 px-3 font-black text-amber-950">Send</button>
            </div>
          ) : (
            <button onClick={() => setAppealing(true)} className="mt-2 min-h-11 rounded-lg bg-white/15 px-3 font-bold">Appeal to a person</button>
          )}
        </div>
      )}
      {hostMuted && (
        <div role="status" className="rounded-xl border border-amber-300/60 bg-amber-900/30 p-3 text-sm font-bold">
          {room!.mutedIds.includes(me!) ? 'The host has muted you in this room.' : 'The host has paused chat for this room.'}
        </div>
      )}
      {isHost && room && (
        <button
          onClick={() => mute(!room.chatMuted)}
          aria-pressed={room.chatMuted}
          className="min-h-11 self-start rounded-lg bg-white/15 px-3 text-sm font-bold"
        >
          {room.chatMuted ? 'Resume chat for everyone' : 'Pause chat for everyone'}
        </button>
      )}
      {blocked.length > 0 && (
        <details className="rounded-xl bg-black/20 px-3 py-1 text-sm">
          <summary className="min-h-11 cursor-pointer py-2 font-bold">Blocked people ({blocked.length})</summary>
          <ul className="pb-2">
            {blocked.map((id) => (
              <li key={id} className="flex items-center justify-between gap-2 py-1">
                <span className="min-w-0 truncate">{nameOf(id)}</span>
                <button onClick={() => unblock(id)} className="min-h-11 rounded-md px-2 text-xs font-bold underline" aria-label={`Unblock ${nameOf(id)}`}>Unblock</button>
              </li>
            ))}
          </ul>
        </details>
      )}
      <div className={`${height} min-h-0 overflow-y-auto rounded-xl bg-black/30 p-2`} role="log" aria-live="polite" aria-label="Chat history" tabIndex={0}>
        {!accepted ? (
          <p className="p-2 text-sm text-white/60">Accept the chat rules to see messages.</p>
        ) : chat.length === 0 ? (
          <p className="p-2 text-sm text-white/50">No messages yet. Say hi.</p>
        ) : (
          chat.map((m) => (
            <div key={m.id} className="group flex items-start gap-2 rounded-lg px-2 py-1 text-sm hover:bg-white/5">
              <div className="min-w-0 flex-1 break-words">
                {room?.members.find((x) => x.userId === m.userId)?.cosmetics
                  ? <NameTag name={m.name} cosmetics={room.members.find((x) => x.userId === m.userId)!.cosmetics} />
                  : <b className={m.userId === me ? 'text-amber-300' : 'text-sky-300'}>{m.name}</b>}{' '}
                <span className="text-white/90">{m.text}</span>
              </div>
              {m.userId !== me && (
                <div className="flex shrink-0 flex-wrap justify-end">
                  <button
                    onClick={() => report(m.id)}
                    className="min-h-11 rounded-md px-2 text-xs font-bold text-white/50 underline hover:text-white"
                    aria-label={`Report message from ${m.name}`}
                  >
                    Report
                  </button>
                  <button
                    onClick={() => block(m.userId)}
                    className="min-h-11 rounded-md px-2 text-xs font-bold text-white/50 underline hover:text-white"
                    aria-label={`Block ${m.name}`}
                  >
                    Block
                  </button>
                  {isHost && (
                    <>
                      <button
                        onClick={() => mute(true, m.userId)}
                        className="min-h-11 rounded-md px-2 text-xs font-bold text-amber-200/80 underline hover:text-amber-200"
                        aria-label={`Mute ${m.name}`}
                      >
                        Mute
                      </button>
                      <button
                        onClick={() => (confirmKick === m.userId ? (kick(m.userId), setConfirmKick(null)) : setConfirmKick(m.userId))}
                        className="min-h-11 rounded-md px-2 text-xs font-bold text-red-300/90 underline hover:text-red-200"
                        aria-label={confirmKick === m.userId ? `Confirm: remove ${m.name} from the room` : `Remove ${m.name} from the room`}
                      >
                        {confirmKick === m.userId ? 'Confirm kick' : 'Kick'}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <input
          value={text} onChange={(e) => setText(e.target.value)} maxLength={200}
          disabled={!accepted || muted || hostMuted} aria-label="Chat message" placeholder={muted ? 'Chat is suspended' : hostMuted ? 'Chat is muted by the host' : 'Be kind…'}
          autoComplete="off" autoCapitalize="sentences" enterKeyHint="send"
          className="min-h-12 min-w-0 flex-1 rounded-xl border-2 border-white/20 bg-black/40 px-3 disabled:opacity-50"
        />
        <button type="submit" disabled={!accepted || muted || hostMuted || !text.trim()} className="min-h-12 rounded-xl bg-sky-500 px-4 font-black text-sky-950 disabled:opacity-40">Send</button>
      </form>
    </section>
  );
}

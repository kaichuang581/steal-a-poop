import { useEffect, useRef, useState } from 'react';
import { useRoomStore } from '../../state/roomStore';
import { CHAT_CONSEQUENCES, CHAT_RULES, ChatRulesModal } from '../../ui/ChatRules';
import { ModerationNotice } from '../../ui/mod/ModerationNotice';
import { NameTag } from '../../ui/social/NameTag';
import { ScrollBox } from '../kit/surfaces';
import { PenIcon, Shield } from './penArt';

const FOLD_KEY = 'sap:pen-chat-folded';

/** Whether the chat card is folded, remembered for the session (section 7.2). Open by default (section 13, choice 1). */
export function useChatFold(): [boolean, (v: boolean) => void] {
  const [folded, setFolded] = useState(() => { try { return sessionStorage.getItem(FOLD_KEY) === '1'; } catch { return false; } });
  const set = (v: boolean) => {
    setFolded(v);
    try { sessionStorage.setItem(FOLD_KEY, v ? '1' : '0'); } catch { /* private window: it is remembered until the screen goes */ }
  };
  return [folded, set];
}

function formatUntil(until: number | null): string {
  if (!until) return 'permanently';
  const mins = Math.max(1, Math.round((until - Date.now()) / 60000));
  return mins >= 90 ? `for about ${Math.round(mins / 60)} hours` : `for about ${mins} minutes`;
}

/**
 * The pen's chat (docs/pen/PEN-PLAN.md, 7.2): the classic ChatPanel's every function, in this screen's pieces. The rules
 * stay on screen and the chat stays locked until they are accepted; a message can be reported, its sender blocked (and
 * unblocked), and the host can mute or remove a sender and pause the chat for everyone; a suspended player is told why
 * and can appeal to a person. Messages are marked read only while the chat is in view (`open`), so a folded card or
 * another tab can count what came in.
 */
export function PenChat({ open, reduced, fold, unread }: { open: boolean; reduced: boolean; fold?: { folded: boolean; set: (v: boolean) => void }; unread: number }) {
  const chat = useRoomStore((s) => s.chat);
  const me = useRoomStore((s) => s.user?.userId);
  const accepted = useRoomStore((s) => s.rulesAccepted);
  const notice = useRoomStore((s) => s.chatNotice);
  const room = useRoomStore((s) => s.room);
  const blocked = useRoomStore((s) => s.blocked);
  const { sendChat, report, appeal, markRead, block, unblock, mute, kick } = useRoomStore.getState();
  const isHost = !!room && !room.ranked && room.hostId === me;
  const nameOf = (id: string) => room?.members.find((m) => m.userId === id)?.name ?? 'a player';
  const [confirmKick, setConfirmKick] = useState<string | null>(null);
  const hostMuted = !!room && !!me && (room.mutedIds.includes(me) || (room.chatMuted && !isHost));
  const [text, setText] = useState('');
  const [appealing, setAppealing] = useState(false);
  const [note, setNote] = useState('');
  const [allRules, setAllRules] = useState(false);
  const log = useRef<HTMLDivElement>(null);
  const muted = !!notice && (notice.reason === 'banned' || notice.reason === 'suspended' || notice.reason === 'blocked') && (notice.until === null || notice.until > Date.now());

  useEffect(() => {
    if (!open) return;
    markRead();
    // Only the log scrolls to its newest line: scrollIntoView would drag the whole page down to the chat.
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [open, chat.length, markRead]);

  const submit = () => {
    const t = text.trim();
    if (!t || muted || hostMuted) return;
    sendChat(t);
    setText('');
  };
  const folded = !!fold?.folded;

  return (
    <div className="pn-chat" data-folded={folded || undefined}>
      {!accepted && <ChatRulesModal />}
      <header className="pn-chat-head">
        <PenIcon name="chat" color="var(--hm-wool)" />
        <h2>Chat</h2>
        {folded && unread > 0 && <span className="pn-unread" aria-label={`${unread} new`}>{unread > 99 ? '99+' : String(unread)}</span>}
        <span className="pn-bar-gap" />
        {isHost && room && (
          <button type="button" className="pn-pause hm-slab hm-slab--night" onClick={() => mute(!room.chatMuted)} aria-pressed={room.chatMuted} title="Stops everyone sending messages">
            <PenIcon name="pause" color="var(--hm-wool)" /><span>{room.chatMuted ? 'Resume chat' : 'Pause chat'}</span>
          </button>
        )}
        {fold && (
          <button type="button" className="pn-ctl hm-slab hm-slab--night" onClick={() => fold.set(!folded)} aria-expanded={!folded} aria-label={folded ? 'Open the chat' : 'Fold the chat'} title={folded ? 'Open the chat' : 'Fold the chat'}>
            <PenIcon name="chevron" color="var(--hm-wool)" className={folded ? 'pn-flip' : undefined} />
          </button>
        )}
      </header>
      {!folded && (
        <>
          <div className="pn-chatrules pn-strip-inkcard" role="note">
            <i className="pn-bar6" aria-hidden="true" />
            <Shield />
            <p>
              No swearing, nothing sexual, no slurs, or you get suspended.{'\u00a0'}
              <button type="button" className="pn-link" onClick={() => setAllRules((v) => !v)} aria-expanded={allRules}>All the rules</button>
            </p>
            {allRules && (
              <div className="pn-allrules">
                <ul>{CHAT_RULES.map((r) => <li key={r}>{r}</li>)}</ul>
                <p>{CHAT_CONSEQUENCES}</p>
              </div>
            )}
          </div>
          <ModerationNotice />
          {muted && (
            <div role="alert" className="pn-chat-note rc-inkcard">
              <p><b>{`Your chat is ${notice!.reason === 'banned' ? 'banned' : `suspended ${formatUntil(notice!.until)}`}.`}</b> Your message was held and nobody saw it. It is being reviewed.</p>
              {appealing ? (
                <form className="pn-send" onSubmit={(e) => { e.preventDefault(); appeal(note.trim() || 'Please review.'); setAppealing(false); setNote(''); }}>
                  <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} aria-label="Why should we look again?" placeholder="Why should we look again?" className="pn-input" />
                  <button type="submit" className="pn-sendbtn hm-slab hm-slab--lantern hm-knit">Send</button>
                </form>
              ) : (
                <button type="button" className="pn-link" onClick={() => setAppealing(true)}>Appeal to a person</button>
              )}
            </div>
          )}
          {hostMuted && <p role="status" className="pn-chat-note rc-inkcard">{room!.mutedIds.includes(me!) ? 'The host has muted you in this room.' : 'The host has paused chat for this room.'}</p>}
          {blocked.length > 0 && (
            <details className="pn-blocked">
              <summary>{`Blocked people (${blocked.length})`}</summary>
              <ul>
                {blocked.map((id) => (
                  <li key={id}><span>{nameOf(id)}</span><button type="button" className="pn-link" onClick={() => unblock(id)} aria-label={`Unblock ${nameOf(id)}`}>Unblock</button></li>
                ))}
              </ul>
            </details>
          )}
          {/* The log is players' own words, which the French page leaves alone (i18n/translate.ts); its empty lines are the game's. */}
          <ScrollBox className="pn-log rc-well" inner={log} reduced={reduced} role={accepted && chat.length ? 'log' : 'status'} aria-live="polite" aria-label="Chat history" tabIndex={0}>
            {!accepted ? (
              <p className="pn-empty">Accept the chat rules to see messages.</p>
            ) : chat.length === 0 ? (
              <p className="pn-empty"><PenIcon name="chat" color="var(--hm-night-3)" px={3} /><span>No messages yet. Say hi.</span></p>
            ) : (
              chat.map((m) => {
                const cos = room?.members.find((x) => x.userId === m.userId)?.cosmetics;
                return (
                  <div key={m.id} className="pn-msg" data-me={m.userId === me || undefined}>
                    <p>
                      {cos ? <NameTag name={m.name} cosmetics={cos} /> : <b className="pn-msg-name">{m.name}</b>}{' '}
                      <span>{m.text}</span>
                    </p>
                    {m.userId !== me && (
                      <span className="pn-msg-acts">
                        <button type="button" className="pn-act" onClick={() => report(m.id)} aria-label={`Report message from ${m.name}`}>Report</button>
                        <button type="button" className="pn-act" onClick={() => block(m.userId)} aria-label={`Block ${m.name}`}>Block</button>
                        {isHost && (
                          <>
                            <button type="button" className="pn-act" onClick={() => mute(true, m.userId)} aria-label={`Mute ${m.name}`}>Mute</button>
                            <button
                              type="button" className="pn-act" onClick={() => (confirmKick === m.userId ? (kick(m.userId), setConfirmKick(null)) : setConfirmKick(m.userId))}
                              aria-label={confirmKick === m.userId ? `Confirm: remove ${m.name} from the room` : `Remove ${m.name} from the room`}
                            >
                              {confirmKick === m.userId ? 'Confirm kick' : 'Kick'}
                            </button>
                          </>
                        )}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </ScrollBox>
          <form className="pn-send" onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <input
              value={text} onChange={(e) => setText(e.target.value)} maxLength={200} className="pn-input"
              disabled={!accepted || muted || hostMuted} aria-label="Chat message" placeholder={muted ? 'Chat is suspended' : hostMuted ? 'Chat is muted by the host' : 'Be kind…'}
              autoComplete="off" autoCapitalize="sentences" enterKeyHint="send"
            />
            <button type="submit" disabled={!accepted || muted || hostMuted || !text.trim()} className={`pn-sendbtn hm-slab hm-knit ${text.trim() ? 'hm-slab--lantern' : ''}`}>Send</button>
          </form>
        </>
      )}
    </div>
  );
}

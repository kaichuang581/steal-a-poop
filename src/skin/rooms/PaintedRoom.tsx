import { useState } from 'react';
import { DEFAULT_SETTINGS, PRESETS, estimateMinutes, presetOf } from '../../engine';
import type { RoomSettingsDTO } from '../../net/protocol';
import { useRoomStore } from '../../state/roomStore';
import { authEnabled } from '../../auth/config';
import { useAuth } from '../../auth/authStore';
import { ChatPanel } from '../../ui/ChatPanel';
import { Hub } from '../../ui/social/Hub';
import { Chip, PaperPanel, WoodButton } from '../components/Materials';
import { Board, Paper, Tag, Tile } from '../kit';
import { inviteLink } from '../share/JoinLink';
import { useIsMobile } from '../../ui/hooks';
import { useMotionLevel } from '../hooks/useAmbient';
import { PenStage } from './PenStage';
import './rooms.css';

const FALLBACK: RoomSettingsDTO = { turnsPerRound: 2, lives: 3, twists: true };
/** The smallest table: farm sheep take the seats people leave empty (server/types.ts MIN_TABLE). */
const MIN_TABLE = 4;
const PRESET_IDS = ['quick', 'standard', 'long'] as const;
const RULES: { key: keyof RoomSettingsDTO; label: string; values: (number | boolean)[]; show?: (v: number | boolean) => string }[] = [
  { key: 'turnsPerRound', label: 'Turns per round', values: [2, 3, 5] },
  { key: 'lives', label: 'Wool balls', values: [1, 2, 3, 5] },
  { key: 'twists', label: 'Round twists', values: [true, false], show: (v) => (v ? 'On' : 'Off') },
];

async function copyText(text: string, what: string) {
  try { await navigator.clipboard.writeText(text); } catch { window.prompt(`Copy the ${what}:`, text); }
}

/**
 * The lobby is a pen on the winter farm (PenStage): everyone who is in stands inside the fence. Over it lie the title
 * plank, one paper sheet with the party code, who can join, the game length and the list of players, the chat, and the
 * sign that starts the game.
 */
export function PaintedRoom() {
  const room = useRoomStore((s) => s.room)!;
  const me = useRoomStore((s) => s.user?.userId);
  const notice = useRoomStore((s) => s.notice);
  const status = useRoomStore((s) => s.status);
  const { start, leave, clearNotice, mute, kick, setOptions } = useRoomStore.getState();
  const [confirmKick, setConfirmKick] = useState<string | null>(null);
  const [copied, setCopied] = useState<'link' | 'code' | null>(null);
  const [invite, setInvite] = useState(false);
  // Friends need an account: guests get no invite list.
  const signedIn = useAuth((s) => s.status) === 'ready' && authEnabled();
  const isHost = room.hostId === me;
  const people = room.members.length;
  const enough = people >= room.min;
  const rules = room.settings ?? FALLBACK;
  const seats = Math.max(people, MIN_TABLE);
  const bots = seats - people;
  const full = { ...DEFAULT_SETTINGS, ...rules };
  const preset = presetOf(full);
  const minutes = estimateMinutes({ ...full, botCount: seats - 1, botDifficulty: 'medium' });
  const queue = !!room.queue;
  const phone = useIsMobile();
  const reduced = useMotionLevel() === 'reduced';
  const guests = room.members.map((m) => ({ id: m.userId, name: m.name, avatar: m.avatar, you: m.userId === me, host: m.userId === room.hostId }));
  const openTo = room.visibility === 'public' ? 'Public: Quick play can send people in too.' : 'Friends only: nobody gets in without the code or link.';
  const hostName = room.members.find((m) => m.userId === room.hostId)?.name ?? 'the host';

  const copy = (what: 'link' | 'code') => {
    void copyText(what === 'link' ? inviteLink(room.code) : room.code, what === 'link' ? 'party link' : 'party code');
    setCopied(what);
    setTimeout(() => setCopied(null), 1800);
  };

  return (
    <main className="rm-screen">
      <PenStage guests={guests} farmSheep={bots} reduced={reduced} phone={phone} shift={phone ? [0, -0.2] : [0, -0.12]} />
      <div className="rm-body">
        <header className="rm-head">
          <button className="rm-back" onClick={leave}>← {queue ? 'Leave queue' : 'Leave'}</button>
          <Board size="heading" hang="ropes" snow><span>{queue ? 'Quick play' : room.name}</span></Board>
          <Tag tone={room.visibility === 'public' ? 'green' : 'gold'}>{queue ? 'in queue' : room.visibility === 'public' ? 'public' : 'friends only'}</Tag>
        </header>

        <div className="rm-start">
          <div aria-live="polite" className="flex flex-col gap-2">
            {status !== 'online' && <Paper kind="slip" className="rm-slip" role="status">Connection lost. Reconnecting… your place in the pen is held for a few seconds.</Paper>}
            {notice && (
              <Paper kind="slip" className="rm-slip" role="status">
                <span>{notice}</span>
                <button className="rm-mini" onClick={clearNotice}>Dismiss</button>
              </Paper>
            )}
          </div>
          {isHost ? (
            <button onClick={start} disabled={!enough} className="sk-btn sk-sit rm-go kit-sign w-full" data-start-game>
              <span className="sk-nail sk-nail-tl" /><span className="sk-nail sk-nail-tr" />Open the gate
            </button>
          ) : null}
          <p className="rm-caption" aria-live="polite">
            {!isHost ? `Waiting for ${hostName} to open the gate…`
              : !enough ? (queue ? 'Waiting for one more player.' : 'You need one more in the pen. Send the party link.')
              : queue ? 'You were first in: open the gate when the pen is full enough.'
              : 'Open the gate to start. It never opens by itself.'}
            {bots > 0 && ` ${bots === 1 ? 'One farm sheep fills' : `${bots} farm sheep fill`} the table to ${MIN_TABLE}.`}
          </p>
        </div>

        <PaperPanel className="rm-card rm-left">
          {queue ? (
            <section className="text-center" aria-label="Queue" data-queue>
              <h2>Finding players<span className="rm-dots" aria-hidden="true"><i /><i /><i /></span></h2>
              <p className="rm-count mt-1" aria-live="polite">{people}<small>/{room.max}</small></p>
              <p className="rm-hand mt-1">Everyone who presses Quick play lands in this pen. Say hi while it fills.</p>
              <div className="mt-2 flex justify-center"><Chip onClick={() => copy('link')}>{copied === 'link' ? 'Copied!' : 'Copy invite link'}</Chip></div>
            </section>
          ) : (
            <section className="text-center" aria-label="Party code">
              <h2>Party code</h2>
              <div className="rm-code" data-room-code={room.code} aria-label={room.code.split('').join(' ')}>
                {room.code.split('').map((ch, i) => <Tile key={i} size="md" aria-hidden="true">{ch}</Tile>)}
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <WoodButton onClick={() => copy('link')} className="min-h-10 px-4" data-copy-link>{copied === 'link' ? 'Copied!' : 'Copy party link'}</WoodButton>
                <Chip onClick={() => copy('code')}>{copied === 'code' ? 'Copied!' : 'Copy code'}</Chip>
                {signedIn && <Chip onClick={() => setInvite(true)}>Invite friends</Chip>}
              </div>
            </section>
          )}

          {!queue && (
            <section aria-label="Who can join">
              <h3>Who can join</h3>
              {isHost && (
                <div className="mt-1 flex gap-1.5">
                  <Chip aria-pressed={room.visibility === 'private'} onClick={() => setOptions({ visibility: 'private' })} data-set-private>Friends only</Chip>
                  <Chip aria-pressed={room.visibility === 'public'} onClick={() => setOptions({ visibility: 'public' })} data-set-public>Public</Chip>
                </div>
              )}
              <p className="rm-hand mt-1" aria-live="polite">{openTo}</p>
            </section>
          )}

          <section aria-label="Game length">
            <h3>Game length <span className="kit-slate kit-slate--mini"><span className="kit-slate-face kit-chalk-hand">about {minutes} min</span></span></h3>
            {isHost ? (
              <>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {PRESET_IDS.map((id) => <Chip key={id} aria-pressed={preset === id} className="capitalize" onClick={() => setOptions(PRESETS[id] as Partial<RoomSettingsDTO>)}>{id}</Chip>)}
                  {preset === 'custom' && <Chip aria-pressed className="capitalize">custom</Chip>}
                </div>
                <div className="mt-2 space-y-1.5">
                  {RULES.map((r) => (
                    <fieldset key={r.key} className="rm-rule-row">
                      <legend>{r.label}</legend>
                      <div className="flex flex-wrap gap-1">
                        {r.values.map((v) => (
                          <Chip key={String(v)} aria-pressed={rules[r.key] === v} onClick={() => setOptions({ [r.key]: v } as Partial<RoomSettingsDTO>)}>{r.show ? r.show(v) : String(v)}</Chip>
                        ))}
                      </div>
                    </fieldset>
                  ))}
                </div>
              </>
            ) : (
              <p className="mt-1 font-bold capitalize">
                {preset} <span className="rm-soft normal-case">· {rules.turnsPerRound} turns a round · {rules.lives} wool {rules.lives === 1 ? 'ball' : 'balls'} · twists {rules.twists ? 'on' : 'off'}</span>
              </p>
            )}
          </section>

          <section aria-label="Players">
            <h3>In the pen <span className="rm-soft">{people}/{room.max}</span></h3>
            <ul className="rm-list">
              {room.members.map((m) => {
                const muted = room.mutedIds.includes(m.userId);
                return (
                  <li key={m.userId} className="rm-row">
                    <span className="min-w-0 flex-1 truncate">
                      <b style={m.cosmetics?.color ? { color: m.cosmetics.color } : undefined}>{m.name}</b>
                      {m.userId === me && <span className="rm-soft"> (you)</span>}
                    </span>
                    {m.userId === room.hostId && <Tag tone="gold">host</Tag>}
                    {isHost && m.userId !== me && (
                      <span className="flex">
                        <button className="rm-mini" onClick={() => mute(!muted, m.userId)} aria-pressed={muted} aria-label={`${muted ? 'Unmute' : 'Mute'} ${m.name}`}>{muted ? 'Unmute' : 'Mute'}</button>
                        <button
                          className="rm-mini" style={{ color: 'var(--coral-dark)' }}
                          onClick={() => (confirmKick === m.userId ? (kick(m.userId), setConfirmKick(null)) : setConfirmKick(m.userId))}
                          aria-label={confirmKick === m.userId ? `Confirm: remove ${m.name}` : `Remove ${m.name}`}
                        >
                          {confirmKick === m.userId ? 'Sure?' : 'Kick'}
                        </button>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        </PaperPanel>

        <PaperPanel className="rm-card rm-chat rm-dock sk-rooms"><h2>Chat</h2><ChatPanel compact height={phone ? 'h-48' : 'h-40'} /></PaperPanel>
      </div>
      {invite && <div className="sk-rooms"><Hub initial="friends" onClose={() => setInvite(false)} /></div>}
    </main>
  );
}

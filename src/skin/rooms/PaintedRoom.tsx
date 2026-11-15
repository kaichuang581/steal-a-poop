import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { DEFAULT_SETTINGS, PRESETS, estimateMinutes, presetOf } from '../../engine';
import type { RoomSettingsDTO } from '../../net/protocol';
import { useRoomStore } from '../../state/roomStore';
import { ChatPanel } from '../../ui/ChatPanel';
import { AvatarIcon } from '../avatars/AvatarIcon';
import { Garland } from '../components/Garland';
import { Paper, Slate, Tag } from '../kit';
import { inviteLink } from '../share/JoinLink';
import { useIsMobile } from '../../ui/hooks';
import { useMotionLevel } from '../hooks/useAmbient';
import { PenStage } from './PenStage';
import { rankOf } from '../../lib/ranked';
import { RankBadge } from '../ranked/RankBadge';
import '../ranked/ranked.css';
import './rooms.css';

const FALLBACK: RoomSettingsDTO = { turnsPerRound: 2, lives: 3, twists: true };
const PRESET_IDS = ['quick', 'standard', 'long'] as const;
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** Whole seconds until a ranked table starts, counted against the server's clock; null while it waits for a second player. */
function useStartsIn(startAt: number | null | undefined): number | null {
  const skew = useRoomStore((s) => s.skew);
  const [, tick] = useState(0);
  useEffect(() => {
    if (startAt == null) return;
    const id = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, [startAt]);
  return startAt == null ? null : Math.max(0, Math.ceil((startAt - (Date.now() + skew)) / 1000));
}

async function copyText(text: string, what: string) {
  try { await navigator.clipboard.writeText(text); } catch { window.prompt(`Copy the ${what}:`, text); }
}

/** One line of the Game board: what it sets on the left, the choice (or, for a guest, what was chosen) on the right. */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return <div className="rm-row"><span className="rm-row-label">{label}</span>{children}</div>;
}
/** One choice out of a few, as the Trading Post's wooden tabs: the chosen one lit gold. */
function Pick<T extends string | number | boolean>({ label, value, options, onPick, hook, off }: {
  label: string; value: T | null; options: readonly { value: T; label: string }[]; onPick: (v: T) => void;
  /** Names each button `data-<hook>-<value>`, for the tests that press them. */ hook?: string;
  /** Nothing to choose just now (no farm sheep to set a level for): the tabs stay where they are, and wait. */ off?: boolean;
}) {
  return (
    <div className="rm-seg" role="group" aria-label={label}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)} type="button" aria-pressed={on} disabled={off} onClick={() => onPick(o.value)}
            className={on ? 'rm-tab kit-lit' : 'rm-tab'} {...(hook ? { [`data-${hook}-${o.value}`]: '' } : {})}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
/** A board's title on a small wooden sign, with a line beside it in the hint's hand: the profile's section heads. */
function Head({ title, children, end }: { title: string; children?: ReactNode; end?: ReactNode }) {
  return (
    <div className="rm-head">
      <span className="kit-plank kit-plank--label sk-room-heading"><h2>{title}</h2></span>
      {children && <p className="rm-hint">{children}</p>}
      {end}
    </div>
  );
}

/**
 * The lobby is a pen on the winter farm (PenStage): everyone who is in stands inside the fence. Over it, the layout
 * Brian picked from three mock-ups (2026-11-14, "do layout 1"): a bar across the top (leave, the room's name, the party
 * code with its copy button), the pen in the middle, and three boards side by side along the bottom, each with its
 * title: Players, Game (the gate that starts it is at its foot) and Chat.
 *
 * It is made of the pieces the Trading Post and the profile are made of, because that is the game's look and nothing
 * invented for this screen passed for it: the plank wall (`kit-wall`), section titles on small wooden signs, wooden
 * tabs lit gold when chosen, and the table's dark stitched wool (`Slate`) for lists and the chat. He chose that from
 * three such mock-ups ("do something similar to B") after turning down a dozen that were not built from the game:
 * flat black, CSS wood ("slabs of cardboard"), wood and slate baked from voxels ("ugly blocky thing"), and ten
 * restyles in other colours ("none ... are coherent with theme"). His notes on B are met here: the chat has room and a
 * speaker's name is a tag apart from what they said; the rules and the table's count are not loose text on the wood
 * (the rules are on a plate, the count is on the gate sign); snow lies in real drifts (`kit-drift`); the top bar is a
 * strapped beam with the lights hung under it, not a slab.
 */
export function PaintedRoom() {
  const room = useRoomStore((s) => s.room)!;
  const me = useRoomStore((s) => s.user?.userId);
  const notice = useRoomStore((s) => s.notice);
  const status = useRoomStore((s) => s.status);
  const { start, leave, clearNotice, mute, kick, setOptions } = useRoomStore.getState();
  const [confirmKick, setConfirmKick] = useState<string | null>(null);
  const [copied, setCopied] = useState<'link' | 'code' | null>(null);
  // The Game board has two faces: the three everyday choices, and (behind "Change rules") the three fine rules.
  const [fine, setFine] = useState(false);
  const isHost = room.hostId === me;
  const people = room.members.length;
  const rules = room.settings ?? FALLBACK;
  const queue = !!room.queue;
  // A ranked table: people only, the standard rules, nobody hosting, and it starts itself.
  const ranked = !!room.ranked;
  const lobby = !queue && !ranked;
  // The casual queue counts down once its table is full (server/rooms.ts armQueue).
  const startsIn = useStartsIn(ranked || queue ? room.startAt : null);
  // Seats the server filled after a quiet spell (Brian, 2026-11-14: "remove the option to add bots. just add in the bots
  // after the 15 sec thing ... dont say they are bots"): shown like everyone else, a name and a sheep, with nothing
  // marking them. Never at a ranked table. Absent from an older server.
  const filled = ranked ? [] : (room.botNames ?? []);
  const seats = people + filled.length;
  const enough = ranked ? people >= room.min : seats >= 2;
  const open = () => start();
  const full = { ...DEFAULT_SETTINGS, ...rules };
  const preset = presetOf(full);
  const minutes = estimateMinutes({ ...full, botCount: Math.max(1, seats - 1), botDifficulty: rules.botLevel ?? 'medium' });
  const phone = useIsMobile();
  const reduced = useMotionLevel() === 'reduced';
  const guests = [
    ...room.members.map((m) => ({ id: m.userId, name: m.name, avatar: m.avatar, you: m.userId === me, host: !ranked && m.userId === room.hostId })),
    ...filled.map((name, k) => ({ id: `seat-${k}`, name, you: false, host: false })),
  ];
  const hostName = room.members.find((m) => m.userId === room.hostId)?.name ?? 'the host';

  const copy = (what: 'link' | 'code') => {
    void copyText(what === 'link' ? inviteLink(room.code) : room.code, what === 'link' ? 'party link' : 'party code');
    setCopied(what);
    setTimeout(() => setCopied(null), 1800);
  };

  // The line over the gate: who is at the table, or what it is waiting for.
  const caption = ranked ? (startsIn === null ? 'Waiting for one more player. A ranked game needs two.' : startsIn > 0 ? `The gate opens in ${startsIn} second${startsIn === 1 ? '' : 's'}.` : 'Opening the gate…')
    : queue && startsIn !== null ? (startsIn > 0 ? `The gate opens in ${startsIn} second${startsIn === 1 ? '' : 's'}.` : 'Opening the gate…')
    : !isHost ? `Waiting for ${hostName} to open the gate.`
    : !enough ? (queue ? 'Finding players…' : 'Waiting for players. Send the party link.')
    : queue ? 'It starts by itself with four, or open the gate now.'
    : 'Open the gate to start.';

  const copyLink = (
    <button type="button" className="rm-tab kit-lit" onClick={() => copy('link')} data-copy-link={lobby ? '' : undefined}>{copied === 'link' ? 'Copied!' : phone ? 'Copy link' : 'Copy invite link'}</button>
  );
  return (
    <main className="rm-screen">
      <PenStage guests={guests} farmSheep={0} reduced={reduced} phone={phone} shift={phone ? [0, -0.16] : [0, -0.2]} />
      <div className="rm-body">
        {/* The bar: a beam strapped with iron, snow on it, the lights hung under it. The way out, where you are, and
            how friends get in. */}
        <header className="rm-bar kit-beam kit-drift">
          <i className="kit-beam-strap" /><i className="kit-beam-strap" />
          <button className="rm-tab rm-back" onClick={leave}>← {lobby ? 'Leave' : 'Leave queue'}</button>
          <div className="rm-title">
            <h1 className="rm-name">{ranked ? 'Ranked' : queue ? 'Casual' : room.name}</h1>
            <Tag tone={ranked ? 'flame' : room.visibility === 'public' ? 'green' : 'gold'}>{ranked ? 'ranked queue' : queue ? 'in queue' : room.visibility === 'public' ? 'public' : 'friends only'}</Tag>
          </div>
          {lobby ? (
            <div className="rm-code">
              <Slate size="mini" className="rm-code-plate">
                <span className="rm-kicker">Party code</span>
                <button type="button" className="rm-code-v" onClick={() => copy('code')} data-room-code={room.code} data-ok={copied === 'code' || undefined} aria-label={`Party code ${room.code.split('').join(' ')}. Copy it.`}>
                  {copied === 'code' ? 'Copied' : room.code}
                </button>
              </Slate>
              {copyLink}
            </div>
          ) : (
            <div className="rm-code" data-queue data-ranked={ranked || undefined}>
              <Slate size="mini" className="rm-code-plate">
                <span className="rm-kicker">{startsIn !== null ? 'Starting soon' : <>Finding players<i className="rm-dots" /></>}</span>
                <span className="rm-code-v rm-count" aria-live="polite" aria-label={`${seats} of ${room.max} players`}>{seats}<small>/{room.max}</small></span>
              </Slate>
              {!ranked && copyLink}
            </div>
          )}
          <Garland swags={phone ? 3 : 7} />
        </header>

        <div className="rm-dock">
          {/* Who is at the table: a line each on the wool. */}
          <section className="rm-panel rm-players kit-wall kit-drift" aria-label="Players">
            <Head title="Players">
              <span>{seats}{ranked ? ` of ${room.max}` : ''} {seats === 1 && !ranked ? 'player' : 'players'}</span>
            </Head>
            <Slate size="board" className="rm-wool">
              <ul className="rm-seats">
                {room.members.map((m) => {
                  const muted = room.mutedIds.includes(m.userId);
                  return (
                    <li key={m.userId} className="rm-seat">
                      {ranked ? <RankBadge rating={m.rating ?? 0} size={26} /> : <AvatarIcon id={m.avatar ?? 'sheep'} size={28} label="" />}
                      <span className="rm-who">
                        <b style={m.cosmetics?.color ? { color: m.cosmetics.color } : undefined}>{m.name}</b>
                        {m.userId === me && <i> (you)</i>}
                      </span>
                      {ranked && <span className="rm-soft">{rankOf(m.rating ?? 0).label}</span>}
                      {!ranked && m.userId === room.hostId && <Tag tone="gold">host</Tag>}
                      {!ranked && isHost && m.userId !== me && (
                        <span className="rm-seat-acts">
                          <button className="rm-mini" onClick={() => mute(!muted, m.userId)} aria-pressed={muted} aria-label={`${muted ? 'Unmute' : 'Mute'} ${m.name}`}>{muted ? 'Unmute' : 'Mute'}</button>
                          <button
                            className="rm-mini"
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
                {filled.map((name, k) => (
                  <li key={`seat-${k}`} className="rm-seat">
                    <AvatarIcon id="sheep" size={28} label="" />
                    <span className="rm-who"><b>{name}</b></span>
                  </li>
                ))}
              </ul>
            </Slate>
          </section>

          {/* The game: the host's choices as tabs, the rules on a plate, and at the foot the gate that starts it. */}
          <section className="rm-panel rm-game kit-wall kit-drift" aria-label="Game">
            <Head title="Game" end={!ranked && isHost && <button type="button" className="rm-tab" onClick={() => setFine((f) => !f)} aria-expanded={fine}>{fine ? 'Back' : <>Change<i> rules</i></>}</button>}>about {minutes} min</Head>
            <div className="rm-rows" aria-live="polite">
              {ranked ? null : !isHost ? (
                <>
                  <Row label="Game length"><b className="rm-val">{cap(preset)}</b></Row>
                  {lobby && <Row label="Who can join"><b className="rm-val">{room.visibility === 'public' ? 'Public' : 'Friends only'}</b></Row>}
                </>
              ) : fine ? (
                <>
                  <Row label="Turns"><Pick label="Turns per round" value={rules.turnsPerRound} onPick={(v) => setOptions({ turnsPerRound: v })} options={([2, 3, 5] as const).map((v) => ({ value: v, label: String(v) }))} /></Row>
                  <Row label="Wool balls"><Pick label="Wool balls" value={rules.lives} onPick={(v) => setOptions({ lives: v })} options={([1, 2, 3, 5] as const).map((v) => ({ value: v, label: String(v) }))} /></Row>
                  <Row label="Twists"><Pick label="Round twists" value={rules.twists} onPick={(v) => setOptions({ twists: v })} options={[{ value: true, label: 'On' }, { value: false, label: 'Off' }]} /></Row>
                </>
              ) : (
                <>
                  <Row label="Game length">
                    <Pick
                      label="Game length" value={preset === 'custom' ? null : preset}
                      onPick={(id) => setOptions(PRESETS[id] as Partial<RoomSettingsDTO>)}
                      options={PRESET_IDS.map((id) => ({ value: id, label: cap(id) }))}
                    />
                  </Row>
                  {lobby && (
                    <Row label="Who can join">
                      <Pick
                        label="Who can join" hook="set" value={room.visibility} onPick={(v) => setOptions({ visibility: v })}
                        options={[{ value: 'private' as const, label: 'Friends only' }, { value: 'public' as const, label: 'Public' }]}
                      />
                    </Row>
                  )}
                </>
              )}
              {/* The rules, on a plate of their own: a label, what they are, and for the host the way to change them. */}
              <Slate size="mini" className="rm-rules">
                <span className="rm-rule"><b>{rules.turnsPerRound}</b> turns<i> a round</i></span>
                <span className="rm-rule"><b>{rules.lives}</b> wool {rules.lives === 1 ? 'ball' : 'balls'}</span>
                <span className="rm-rule">Twists <b>{rules.twists ? 'on' : 'off'}</b></span>
              </Slate>
              {ranked && <p className="rm-ranked-note">People only, no bots. Leaving once it starts counts as a loss.</p>}
            </div>
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
              {!ranked && isHost ? (
                // The gate, and written on it under its name who is going through it (or what it is waiting for).
                <button onClick={open} disabled={!enough} className="kit-sign kit-drift kit-drift--small rm-go" data-start-game>
                  <span>Open the gate</span>
                  <small className="rm-caption" aria-live="polite">{caption}</small>
                </button>
              ) : (
                <Slate size="mini" className="rm-wait"><p className="rm-caption" aria-live="polite" data-ranked-status={ranked || undefined}>{caption}</p></Slate>
              )}
            </div>
          </section>

          <section className="rm-panel rm-chat kit-wall kit-drift sk-rooms" aria-label="Chat">
            <Head title="Chat" />
            <Slate size="board" className="rm-wool"><ChatPanel compact height="h-24" /></Slate>
          </section>
        </div>
      </div>
    </main>
  );
}

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { FESTIVE } from '../../config';
import { DEFAULT_SETTINGS, PRESETS, estimateMinutes, presetOf } from '../../engine';
import type { RoomSettingsDTO } from '../../net/protocol';
import { rankOf } from '../../lib/ranked';
import { useRoomStore } from '../../state/roomStore';
import { PixelHead } from '../avatars/AvatarIcon';
import { MenuIcon } from '../home/HomeParts';
import { useMotionLevel } from '../hooks/useAmbient';
import { BoardFrame, Lights, Padlock, ScrollBox, SnowCap } from '../kit/surfaces';
import { RankBadge } from '../ranked/RankBadge';
import { inviteLink } from '../share/JoinLink';
import { PenChat, useChatFold } from './PenChat';
import { Crown, PenIcon, Seat, SheepHead, WoolBall } from './penArt';
import { PenStage } from './PenStage';
import type { PenFrame } from './PenStage';
import { penUnit } from './unit';
import '../home/home.css';
import '../ranked/ranked.css';
import './pen.css';

const FALLBACK: RoomSettingsDTO = { turnsPerRound: 2, lives: 3, twists: true };
const PRESET_IDS = ['quick', 'standard', 'long'] as const;
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** The desktop layout needs this much room (section 5.1); anything smaller is the phone layout (5.2). */
const WIDE = '(min-width: 1000px) and (min-height: 640px)';

/** Whole seconds until a table starts by itself, counted against the server's clock; null when it is not counting down. */
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

/** Seconds since this screen came up: the waiting time beside the headline (section 4). */
function useWaited(): number {
  const [since] = useState(() => Date.now());
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return Math.floor((Date.now() - since) / 1000);
}

function useMatch(query: string): boolean {
  const [on, setOn] = useState(() => typeof matchMedia === 'function' && matchMedia(query).matches);
  useEffect(() => {
    const m = matchMedia(query);
    const f = () => setOn(m.matches);
    m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, [query]);
  return on;
}

async function copyText(text: string, what: string) {
  try { await navigator.clipboard.writeText(text); } catch { window.prompt(`Copy the ${what}:`, text); }
}

/**
 * A player row gives its name room last (docs/pen/PEN-PLAN-V3.md, 2.1.3 and 5): while the name is cut, "Host" first
 * loses its word (the crown alone), then "You" becomes a small lantern square; only then is the name cut.
 */
function useSqueeze(name: string) {
  const row = useRef<HTMLLIElement>(null), nameEl = useRef<HTMLElement>(null);
  const [level, setLevel] = useState(0);
  useLayoutEffect(() => {
    const r = row.current, el = nameEl.current;
    if (!r || !el) return;
    let at = 0;
    const fit = () => {
      // Start roomy, then step down while the name is cut.
      at = 0; r.dataset.squeeze = '0';
      while (at < 2 && el.scrollWidth > el.clientWidth + 0.5) { at++; r.dataset.squeeze = String(at); }
      setLevel(at);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(r);
    return () => ro.disconnect();
  }, [name]);
  return { row, nameEl, level };
}

/** Joined slabs, one of them chosen (lantern): the game length, who can join, the fine rules, the phone's tabs. */
function Slabs<T extends string | number | boolean>({ label, value, options, onPick, locked, hook, className = '' }: {
  label: string; value: T | null; options: readonly { value: T; label: ReactNode; sub?: string }[]; onPick: (v: T) => void;
  /** Not yours to choose (you are not the host): the choices show their disabled look, the chosen one stays lit. */ locked?: boolean;
  /** Names each button `data-<hook>-<value>`, for the tests that press them. */ hook?: string;
  className?: string;
}) {
  return (
    <div className={`pn-slabs ${className}`} role="group" aria-label={label}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)} type="button" aria-pressed={on} disabled={locked && !on} aria-disabled={locked || undefined}
            onClick={() => { if (!locked) onPick(o.value); }}
            className={`pn-slab hm-slab hm-knit ${on ? 'hm-slab--lantern' : ''} ${locked ? 'rc-static' : ''}`} data-two={o.sub ? '' : undefined}
            {...(hook ? { [`data-${hook}-${o.value}`]: '' } : {})}
          >
            <span className="pn-slab-in"><b>{o.label}</b>{o.sub && <small>{o.sub}</small>}</span>
          </button>
        );
      })}
    </div>
  );
}

interface Guest { id: string; name: string; avatar?: string; you: boolean; host: boolean }
interface HostControls { muted: boolean; sure: boolean; mute: (on: boolean) => void; kick: () => void }
/** One player in the list (section 5): avatar, name, then the tags right after it, the host's controls last. */
function PlayerRow({ g, box, ranked, rating, color, controls }: { g: Guest; box: number; ranked: boolean; rating?: number; color?: string; controls: HostControls | null }) {
  const { row, nameEl, level } = useSqueeze(g.name);
  return (
    <li ref={row} className="pn-player rc-tile" data-you={g.you || undefined} data-squeeze={level}>
      {g.you && <i className="pn-bar6" aria-hidden="true" />}
      <span className="pn-avatar">{ranked ? <RankBadge rating={rating ?? 0} size={24} /> : <PixelHead id={g.avatar ?? 'sheep'} box={box} />}</span>
      <b ref={nameEl} className="pn-name" style={color ? { color } : undefined}>{g.name}</b>
      <span className="pn-tags">
        {g.you && (level >= 2 ? <i className="pn-you-dot" title="You" aria-label="You" /> : <span className="pn-you">You</span>)}
        {g.host && <span className="pn-tag pn-tag--host" title="Host" aria-label="Host"><Crown />{level >= 1 ? null : <span>Host</span>}</span>}
        {ranked && rating !== undefined && <span className="pn-tag">{rankOf(rating).label}</span>}
      </span>
      {controls && (
        <span className="pn-ctls">
          <button type="button" className="pn-ctl hm-slab hm-slab--night" onClick={() => controls.mute(!controls.muted)} aria-pressed={controls.muted} aria-label={`${controls.muted ? 'Unmute' : 'Mute'} ${g.name}`} title={controls.muted ? `Let ${g.name} chat again` : `Stop ${g.name} chatting`}>
            <PenIcon name={controls.muted ? 'unmute' : 'mute'} color="var(--hm-wool)" />
          </button>
          <button
            type="button" className="pn-ctl hm-slab hm-slab--night" data-sure={controls.sure || undefined} onClick={controls.kick}
            aria-label={controls.sure ? `Confirm: remove ${g.name}` : `Remove ${g.name}`} title={`Remove ${g.name} from the pen`}
          >
            {controls.sure ? <span>Sure?</span> : <PenIcon name="kick" color="var(--hm-wool)" />}
          </button>
        </span>
      )}
    </li>
  );
}

type Phase = 'finding' | 'ready' | 'full' | 'starting';

/**
 * The pen screen (docs/pen/PEN-PLAN.md; Brian, 2026-11-22: the old one "looks too chunky and really unclear"): the
 * Casual queue, the Ranked queue and a created lobby, one layout. The pen is the screen; the sheep in it are the
 * players, each on its numbered mat. A slim panel on the left says what is happening, who is here and what game it
 * will be; the chat is a card at the bottom right that folds; one button under the pen starts the game and always says
 * why it can or cannot. Every function is the old screen's: the same store actions, the same rules read from the room.
 */
export function PaintedRoom() {
  const room = useRoomStore((s) => s.room)!;
  const me = useRoomStore((s) => s.user?.userId);
  const notice = useRoomStore((s) => s.notice);
  const status = useRoomStore((s) => s.status);
  const unread = useRoomStore((s) => s.unread);
  const { start, leave, clearNotice, mute, kick, setOptions } = useRoomStore.getState();
  const wide = useMatch(WIDE);
  const reduced = useMotionLevel() === 'reduced';
  const [confirmKick, setConfirmKick] = useState<string | null>(null);
  const [copied, setCopied] = useState<'link' | 'code' | null>(null);
  const [fine, setFine] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<'players' | 'game' | 'chat'>('players');
  const [folded, setFolded] = useChatFold();
  const waited = useWaited();

  const ranked = !!room.ranked;
  const queue = !!room.queue;
  const lobby = !queue && !ranked;
  const isHost = !ranked && room.hostId === me;
  const rules = room.settings ?? FALLBACK;
  // Seats the server filled after a quiet spell are shown like everyone else (Brian, 2026-11-14: "dont say they are
  // bots"). Never at a ranked table.
  const filled = ranked ? [] : (room.botNames ?? []);
  const n = room.members.length + filled.length;
  const { min, max } = room;
  const need = Math.max(0, min - n);
  const startsIn = useStartsIn(ranked || queue ? room.startAt : null);
  const hostName = room.members.find((m) => m.userId === room.hostId)?.name ?? 'the host';
  const phase: Phase = room.phase !== 'lobby' || busy || startsIn === 0 ? 'starting' : n >= max ? 'full' : n >= min ? 'ready' : 'finding';
  const canStart = isHost && phase !== 'starting' && n >= min;

  // A start the server refused comes back as a notice: the button is itself again.
  useEffect(() => { if (notice) setBusy(false); }, [notice]);
  useEffect(() => {
    if (!busy) return;
    const t = window.setTimeout(() => setBusy(false), 5000);
    return () => window.clearTimeout(t);
  }, [busy]);
  const open = useCallback(() => { if (canStart) { setBusy(true); start(); } }, [canStart, start]);
  // Enter opens the gate when it can be opened and no text field has the keys (section 7.3).
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest('input, textarea, select, button, a, [contenteditable="true"]')) return;
      if (canStart) { e.preventDefault(); open(); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [canStart, open]);

  const copy = (what: 'link' | 'code') => {
    void copyText(what === 'link' ? inviteLink(room.code) : room.code, what === 'link' ? 'party link' : 'party code');
    setCopied(what);
    window.setTimeout(() => setCopied(null), 2000);
  };

  // ---- Section 4: what the screen says ----
  const auto = (ranked || queue) && startsIn !== null && startsIn > 0 ? `Starts by itself in ${clock(startsIn)}` : null;
  const chip = phase === 'starting' ? 'Starting' : phase === 'full' ? 'Full' : phase === 'ready' ? 'Ready' : 'Finding players';
  const lit = phase === 'ready' || phase === 'full' ? 'pasture' : 'lantern';
  const needs = `Needs ${plural(need, 'more player', 'more players')}`;
  const headline = phase === 'starting' ? 'Opening the gate…'
    : phase === 'finding' ? 'Finding players…'
    : phase === 'full' ? 'The pen is full'
    : ranked ? 'Ready'
    : isHost ? 'Ready when you are' : `Waiting for ${hostName}`;
  // Line 2 of the status card, one line on a desktop (docs/pen/PEN-PLAN-V3.md, section 4).
  const line2 = phase === 'starting' ? null
    : ranked ? (phase === 'finding' ? `Starts by itself at ${min}. People only.` : 'More can join until it starts.')
    : phase === 'finding' ? (isHost ? 'Invite friends to fill it faster.' : `${hostName} starts when enough are here.`)
    : phase === 'full' ? (isHost ? 'Open the gate to start.' : `Waiting for ${hostName}.`)
    : isHost ? 'More can join until you open the gate.' : `More can join until ${hostName} opens the gate.`;
  const underPen = ranked ? (phase === 'starting' ? 'Opening the gate…' : auto ?? needs)
    : phase === 'starting' ? 'Opening the gate…'
    : phase === 'finding' ? needs
    : isHost ? `Start with ${plural(n, 'player', 'players')}` : `Waiting for ${hostName} to open the gate`;
  // Typographic apostrophes in a name the server made ("Player809's room", 2.1.7).
  const title = ranked ? 'Ranked game' : queue ? 'Casual game' : (room.name || 'Your lobby').replace(/'/g, '’');

  const full = { ...DEFAULT_SETTINGS, ...rules };
  const preset = presetOf(full);
  const minutes = (s: Partial<RoomSettingsDTO>) => estimateMinutes({ ...full, ...s, botCount: Math.max(1, n - 1), botDifficulty: rules.botLevel ?? 'medium' });
  const guests = [
    ...room.members.map((m) => ({ id: m.userId, name: m.name, avatar: m.avatar, you: m.userId === me, host: !ranked && m.userId === room.hostId })),
    ...filled.map((name, k) => ({ id: `seat-${k}`, name, avatar: undefined as string | undefined, you: false, host: false })),
  ];

  // ---- Where the pen goes: the space the panels leave (5.1), or the stage strip on a phone (5.2) ----
  const root = useRef<HTMLElement>(null), bar = useRef<HTMLElement>(null), panel = useRef<HTMLElement>(null), chat = useRef<HTMLElement>(null), go = useRef<HTMLDivElement>(null), sheet = useRef<HTMLElement>(null);
  const [frame, setFrame] = useState<PenFrame | null>(null);
  // A tab opens at its top: typing in the chat scrolls the sheet to the field, and that scroll stayed for the next tab.
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => { if (body.current) body.current.scrollTop = 0; }, [tab]);
  const [u, setU] = useState(() => penUnit(globalThis.innerWidth ?? 1280, globalThis.innerHeight ?? 720, wide));
  useLayoutEffect(() => {
    const measure = () => {
      const k = penUnit(innerWidth, innerHeight, wide), lights = FESTIVE ? 28 * k : 0;
      const b = bar.current?.getBoundingClientRect();
      if (!b) return;
      setU(k);
      const top = b.bottom + lights + 16 * k; // the plates' tops 16 under the lowest bulb (9.7)
      let next: PenFrame;
      if (wide) {
        const p = panel.current?.getBoundingClientRect(), c = chat.current?.getBoundingClientRect(), g = go.current?.getBoundingClientRect();
        if (!p || !c || !g) return;
        next = { left: p.right, right: c.left, top, bottom: g.top - 20 * k }; // the gate's foot 20 over the button
      } else {
        const s = sheet.current?.getBoundingClientRect();
        if (!s) return;
        next = { left: 8, right: innerWidth - 8, top: b.bottom + lights + 8, bottom: s.top - 4 };
      }
      setFrame((f) => (f && Math.abs(f.left - next.left) + Math.abs(f.right - next.right) + Math.abs(f.top - next.top) + Math.abs(f.bottom - next.bottom) < 1 ? f : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    for (const r of [root, bar, panel, go, sheet]) if (r.current) ro.observe(r.current);
    addEventListener('resize', measure);
    return () => { ro.disconnect(); removeEventListener('resize', measure); };
  }, [wide]);

  // When the window is too short for every row, the list shows whole rows only: a half-cut tile at its foot read as broken.
  const listIn = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = listIn.current, box = el?.parentElement;
    if (!el || !box || !wide) return;
    const snap = () => {
      box.style.maxHeight = '';
      const pitch = 40 * u, h = el.clientHeight;
      if (el.scrollHeight > h + 1) box.style.maxHeight = `${Math.max(1, Math.floor((h + 3 * u) / pitch)) * pitch - 3 * u}px`;
    };
    snap();
    addEventListener('resize', snap);
    return () => removeEventListener('resize', snap);
  }, [wide, u, n, phase, notice, status, fine, lobby, auto]);

  // ---- The pieces ----
  const notices = (status !== 'online' || notice) && (
    <div className="pn-notes" aria-live="polite">
      {status !== 'online' && <p className="pn-note rc-inkcard" role="status">Connection lost. Reconnecting… your place in the pen is held for a few seconds.</p>}
      {notice && (
        <p className="pn-note rc-inkcard" role="status">
          <span>{notice}</span>
          <button type="button" className="pn-link" onClick={clearNotice}>Dismiss</button>
        </p>
      )}
    </div>
  );

  // The party code: a sunk pill, not a button (section 3); its text can still be selected and copied.
  const codePill = lobby && (
    <span className="pn-codepill rc-well">
      <span className="pn-codepill-k">Code</span>
      <b data-room-code={room.code} aria-label={`Party code ${room.code.split('').join(' ')}`}>{room.code}</b>
    </span>
  );
  const openPlaces = n >= max ? 'Full' : plural(max - n, 'open place', 'open places');

  // Section 4: the status card. Three lines: what is happening, what happens next, the seats.
  const statusCard = (
    <section className="pn-status rc-tile" data-tone={lit} data-phase={phase} aria-label="What is happening">
      <i className="pn-bar6" aria-hidden="true" />
      <div className="pn-status-l1">
        <PenIcon name={phase === 'finding' ? 'hourglass' : 'gate'} color="var(--hm-lantern)" />
        <h2 aria-live="polite">{headline}</h2>
      </div>
      {line2 && <p className="pn-status-l2">{line2}</p>}
      {auto && phase !== 'starting' && <p className="pn-status-l2 pn-status-auto" aria-live="polite" data-ranked-status={ranked || undefined}>{auto}</p>}
      {phase !== 'starting' && (
        <div className="pn-seatrow" style={{ '--min': min, '--max': max } as CSSProperties} data-start={n < min || undefined} data-many={max > 8 || undefined}>
          <span className="pn-seats" role="img" aria-label={`${n} of ${max} places taken`}>
            {Array.from({ length: max }, (_, i) => <span key={i} className="pn-seat"><Seat filled={i < n} /></span>)}
            {n < min && <span className="pn-start-mark" aria-hidden="true"><i className="pn-caret" /><span>start</span></span>}
          </span>
          <span className="pn-count" aria-hidden="true"><b>{n}</b>{` of ${max}`}</span>
        </div>
      )}
    </section>
  );

  const box = Math.round(28 * u);
  const players = (
    <section className="pn-sec pn-sec--players" aria-label="Players">
      <header className="pn-head">
        <SheepHead px={3} />
        <h2>Players</h2>
        {wide ? <span className="pn-head-end">{openPlaces}</span> : codePill ? <span className="pn-head-end">{codePill}</span> : <span className="pn-head-end">{openPlaces}</span>}
      </header>
      {!wide && codePill && <p className="pn-head-sub">{openPlaces}</p>}
      <ScrollBox className="pn-players" inner={listIn} reduced={reduced}>
        <ul className="pn-list">
          {guests.map((g) => {
            const m = room.members.find((x) => x.userId === g.id);
            return (
              <PlayerRow
                key={g.id} g={g} box={box} ranked={ranked} rating={m?.rating} color={m?.cosmetics?.color}
                controls={isHost && m && !g.you ? { muted: room.mutedIds.includes(g.id), sure: confirmKick === g.id, mute: (on) => mute(on, g.id), kick: () => (confirmKick === g.id ? (kick(g.id), setConfirmKick(null)) : setConfirmKick(g.id)) } : null}
              />
            );
          })}
        </ul>
      </ScrollBox>
    </section>
  );
  // Section 6: the rules as three chips; the full explanation is a tooltip on each (open choice 2).
  const chips = [
    { key: 'rounds', icon: <PenIcon name="rounds" color="var(--hm-frost)" />, v: String(rules.turnsPerRound), l2: 'turns a round', tip: 'How many turns each sheep takes in a round.' },
    { key: 'lives', icon: <WoolBall />, v: String(rules.lives), l2: rules.lives === 1 ? 'wool ball (life)' : 'wool balls (lives)', tip: 'Your lives. Run out of time and you lose one.' },
    { key: 'twists', icon: <PenIcon name="twist" color="var(--hm-lantern)" />, v: rules.twists ? 'On' : 'Off', l2: 'twists', tip: rules.twists ? 'A new twist every round after the first.' : 'Every round has plain rules.' },
  ];
  const game = (
    <section className="pn-sec pn-sec--game" aria-label="Game">
      <header className="pn-head">
        <PenIcon name="die" color="var(--hm-wool)" />
        <h2>Game</h2>
        {isHost ? (
          <button type="button" className="pn-change hm-slab hm-knit pn-head-end" onClick={() => setFine((f) => !f)} aria-expanded={fine}>
            <PenIcon name="gear" /><span>{fine ? 'Back' : 'Change rules'}</span>
          </button>
        ) : (
          <span className="pn-tag pn-head-end"><Padlock color="var(--hm-frost)" />{ranked ? 'Ranked rules' : 'Host chooses'}</span>
        )}
      </header>
      {!ranked && (fine && isHost ? (
        <div className="pn-fine" aria-live="polite">
          <span className="pn-label">Turns a round</span>
          <Slabs label="Turns per round" value={rules.turnsPerRound} onPick={(v) => setOptions({ turnsPerRound: v })} options={([2, 3, 5] as const).map((v) => ({ value: v, label: String(v) }))} />
          <span className="pn-label">Wool balls</span>
          <Slabs label="Wool balls" value={rules.lives} onPick={(v) => setOptions({ lives: v })} options={([1, 2, 3, 5] as const).map((v) => ({ value: v, label: String(v) }))} />
          <span className="pn-label">Twists</span>
          <Slabs label="Round twists" value={rules.twists} onPick={(v) => setOptions({ twists: v })} options={[{ value: true, label: 'On' }, { value: false, label: 'Off' }]} />
        </div>
      ) : (
        <>
          <span className="pn-label">Game length</span>
          <Slabs
            className="pn-length" label="Game length" value={preset === 'custom' ? null : preset} locked={!isHost}
            onPick={(id) => setOptions(PRESETS[id] as Partial<RoomSettingsDTO>)}
            options={PRESET_IDS.map((id) => ({ value: id, label: cap(id), sub: `about ${minutes(PRESETS[id] as Partial<RoomSettingsDTO>)} min` }))}
          />
          {lobby && (
            <>
              <span className="pn-label pn-label--next">Who can join</span>
              <Slabs
                label="Who can join" hook="set" value={room.visibility} locked={!isHost} onPick={(v) => setOptions({ visibility: v })}
                options={[{ value: 'private' as const, label: 'Friends only', sub: 'with your code' }, { value: 'public' as const, label: 'Public', sub: 'anyone can join' }]}
              />
            </>
          )}
        </>
      ))}
      <ul className="pn-chips rc-well" aria-live="polite">
        {chips.map((c) => (
          <li key={c.key} tabIndex={0} aria-label={`${c.v} ${c.l2}. ${c.tip}`} aria-describedby={`pn-tip-${c.key}`}>
            <span className="pn-chip-l1">{c.icon}<b>{c.v}</b></span>
            <small>{c.l2}</small>
            <span className="pn-tip rc-inkcard" role="tooltip" id={`pn-tip-${c.key}`}><i className="rc-inkcard-point" aria-hidden="true" />{c.tip}</span>
          </li>
        ))}
      </ul>
      {ranked && <p className="pn-note-line">Leaving once it starts counts as a loss.</p>}
    </section>
  );

  const startButton = (
    <div className="pn-go" ref={go}>
      {isHost ? (
        <button type="button" onClick={open} disabled={!canStart && phase !== 'starting'} data-busy={phase === 'starting' || undefined} className="pn-gate hm-slab hm-slab--lantern hm-knit" data-start-game aria-describedby="pn-gate-why">
          <span className="pn-gate-in">
            <PenIcon name="gate" />
            <span><b>Open the gate</b>{phase === 'starting' ? <span className="hm-dots" aria-label="Opening the gate"><i /><i /><i /></span> : <small id="pn-gate-why">{underPen}</small>}</span>
          </span>
        </button>
      ) : (
        <p className="pn-wait rc-well" aria-live="polite" data-ranked-status={ranked || undefined}>{underPen}</p>
      )}
    </div>
  );

  const chatOpen = wide ? !folded : tab === 'chat';
  const inviteLabel = copied === 'link' ? 'Link copied' : 'Invite friends';
  // Brackets shrink to dots below --u 0.9: leave them out there (2.4.4). The panel's top corners are under its snow.
  const brackets = u < 0.9 ? [] : undefined;

  return (
    <main ref={root} className="pn hm rc" data-wide={wide || undefined} data-phone={!wide || undefined}>
      <PenStage guests={guests} max={max} reduced={reduced} phone={!wide} frame={frame} opening={room.phase !== 'lobby'} fill={wide ? 0.84 : 0.92} />

      <header ref={bar} className="pn-bar rc-bar">
        <SnowCap />
        <button type="button" className="pn-leave hm-slab hm-knit" onClick={leave} aria-label={lobby ? 'Leave lobby' : 'Leave queue'}>
          <PenIcon name="back" />{wide && <span>{lobby ? 'Leave lobby' : 'Leave queue'}</span>}
        </button>
        <div className="pn-title rc-titletag hm-slab hm-knit rc-static">
          {wide && (lobby ? <PenIcon name="room" /> : <span className="pn-title-ico"><MenuIcon id="queue" /></span>)}
          <h1>{title}</h1>
        </div>
        <span className="pn-chip" data-tone={lit} data-blink={phase === 'finding' || undefined}><i className="pn-chip-dot" aria-hidden="true" />{chip}</span>
        {wide && phase !== 'starting' && <span className="pn-waited" title="How long you have been waiting"><PenIcon name="clock" color="var(--hm-frost)" />{clock(waited)}</span>}
        <span className="pn-bar-gap" />
        {wide && codePill}
        {!ranked && (
          <button type="button" className="pn-invite hm-slab hm-knit" onClick={() => copy('link')} data-copy-link={lobby ? '' : undefined} aria-label={inviteLabel} title="Copy invite link">
            <PenIcon name={copied === 'link' ? 'check' : 'link'} px={copied === 'link' ? 3 : 2} />{wide && <span>{inviteLabel}</span>}
          </button>
        )}
        {FESTIVE && <Lights u={Math.max(1, Math.round(u))} reduced={reduced} prefix="rc" oneInSix />}
      </header>

      {wide ? (
        <>
          <aside ref={panel} className="pn-board rc-board" aria-label="The pen">
            <BoardFrame corners={brackets ?? ['bl', 'br']} />
            <SnowCap icicles />
            <div className="pn-board-in">
              {statusCard}
              {notices}
              <i className="rc-groove" aria-hidden="true" />
              {players}
              <i className="rc-groove" aria-hidden="true" />
              {game}
            </div>
          </aside>
          <section ref={chat} className="pn-chatcard rc-board" data-folded={folded || undefined} aria-label="Chat">
            <BoardFrame corners={brackets} />
            <PenChat open={chatOpen} reduced={reduced} fold={{ folded, set: setFolded }} unread={unread} />
          </section>
        </>
      ) : (
        <section ref={sheet} className="pn-sheet rc-board" aria-label="The pen">
          <SnowCap icicles />
          <div className="pn-sheet-top">
            {statusCard}
            {notices}
            <div className="pn-tabs" role="tablist" aria-label="Show">
              {(['players', 'game', 'chat'] as const).map((t) => (
                <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`pn-tab hm-slab hm-knit ${tab === t ? 'hm-slab--lantern' : ''}`}>
                  <span>{t === 'players' ? 'Players' : t === 'game' ? 'Game' : 'Chat'}</span>
                  {t === 'chat' && tab !== 'chat' && unread > 0 && <span className="pn-unread">{unread > 99 ? '99+' : String(unread)}</span>}
                </button>
              ))}
            </div>
          </div>
          <div ref={body} className="pn-sheet-body" data-tab={tab}>
            {tab === 'players' ? players : tab === 'game' ? game : <PenChat open={chatOpen} reduced={reduced} unread={unread} />}
          </div>
        </section>
      )}
      {startButton}
    </main>
  );
}

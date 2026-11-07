import { MiniBomb } from '../components/BombClock';
import { Jumpscare, WordBlast } from '../components/Jumpscare';
import { bombSize, wordsSinceBoom } from '../model/bombCharge';
import { shareCard } from '../share/card';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { previewBotTurn, rankPlayers, roundTurnMs, startingWool, summarize, utcDateKey } from '../../engine';
import { useRoomStore } from '../../state/roomStore';
import { useStore } from '../../state/store';
import { useAvatar } from '../avatars/store';
import { ChatPanel } from '../../ui/ChatPanel';
import { BookIcon, ChainIcon, ChatIcon, CloseIcon, GustIcon, SnowflakeIcon, SpeakerIcon, WolfIcon } from '../components/Icons';
import { Notice } from '../components/Notice';
import { ChainList, RulesCard } from '../components/RulesCard';
import { CoachTips } from '../../ui/CoachTips';
import { useGameLoop, useIsMobile } from '../../ui/hooks';
import { RewardBanner } from '../../ui/social/RewardBanner';
import { Tour } from '../../ui/Tour';
import { useGameSounds } from '../../ui/useGameSounds';
import { InputStrip } from '../components/InputStrip';
import { StreakString } from '../components/Lantern';
import { Lives } from '../components/Lives';
import { Chip, ClothButton, CoralButton, PaperPanel, WoodButton } from '../components/Materials';
import { PlayerCard } from '../components/PlayerCard';
import { TallyBoard } from '../components/TallyBoard';
import { TwistSign } from '../components/TwistSign';
import { Alarm, useAlarms } from '../components/Alarm';
import { useHour, useMotionLevel } from '../hooks/useAmbient';
import { useWordInput } from '../hooks/useWordInput';
import { keystrokeAt, lastRejectAt, seedOf, typingScript } from '../model/botTyping';
import { useVisualEvents } from '../model/events';
import type { VisualEvent } from '../model/events';
import { TWIST_TEXT } from '../model/types';
import type { PlayerView } from '../model/types';
import { streakDays, useTableView } from '../model/useTableView';
import { BarnTable } from '../table/BarnTable';
import type { BarnMoments } from '../table/BarnTable';
import { DevLine } from '../table/DevStats';
import { PlaceExtras } from '../table/places';
import { coatLevel } from '../table/Sheep';
import type { SheepState } from '../table/Sheep';

interface Fx { id: number; node: ReactNode }
interface Mood { state: SheepState; key: number; coldFor?: number }

export function PaintedGame() {
  useGameLoop();
  useGameSounds();
  const input = useWordInput();
  const [dimmed, setDimmed] = useState<Set<number>>(new Set());
  const view = useTableView({ typed: input.typed, message: input.message, dimmed })!;
  // Who wears what: your own pick, and what the room says the others picked (bots and offline players wear nothing).
  const myAvatar = useAvatar();
  const room = useRoomStore((s) => s.room);
  const avatarOf = (p: { id: string; isYou: boolean }): string | null => {
    if (p.isYou) return myAvatar;
    if (!room) return null;
    const uid = Object.keys(room.seatOf).find((u) => room.seatOf[u] === Number(p.id));
    return room.members.find((m) => m.userId === uid)?.avatar ?? null;
  };
  const game = useStore((s) => s.game)!;
  const mySeat = useStore((s) => s.mySeat);
  const storeMode = useStore((s) => s.mode);
  const muted = useStore((s) => s.muted);
  const toggleMute = useStore((s) => s.toggleMute);
  const quit = useStore((s) => s.quit);
  const dict = useStore((s) => s.dict);
  const now = useStore((s) => s.now);
  const mobile = useIsMobile();
  const reduced = useMotionLevel() === 'reduced';
  const deviceHour = useHour();
  const [moods, setMoods] = useState<Record<number, Mood>>({});
  const [moments, setMoments] = useState<BarnMoments>({});
  const [fx, setFx] = useState<Fx[]>([]);
  const [sheet, setSheet] = useState<'cheat' | 'chain' | 'chat' | 'leave' | null>(null);
  const [alarm, pushAlarm, clearAlarms] = useAlarms(mobile ? 2600 : 3000);
  // Each alarm jolts the barn once: the class comes off for a frame and back on, so the jolt restarts per alarm.
  const [shake, setShake] = useState(false);
  useEffect(() => {
    if (!alarm || reduced) return;
    setShake(false);
    const raf = requestAnimationFrame(() => setShake(true));
    const id = setTimeout(() => setShake(false), 560);
    return () => { cancelAnimationFrame(raf); clearTimeout(id); };
  }, [alarm?.id, reduced]); // eslint-disable-line react-hooks/exhaustive-deps
  // Rooms play in the big barn at night.
  const hour = storeMode === 'room' ? 'night' : deviceHour;
  const n = game.players.length;
  const rel = (seat: number) => (seat - mySeat + n) % n;
  const name = (id: string) => game.players[Number(id)]?.name ?? '';
  const practice = storeMode === 'practice';
  // Wool balls are lives: every sheep shows them, with an empty ring for each one lost.
  const maxLives = startingWool(game.settings);
  const k = () => Math.random();
  const rootRef = useRef<HTMLDivElement>(null);
  const [hit, setHit] = useState(0);
  const [boom, setBoom] = useState(0);
  const [blast, setBlast] = useState<{ key: number; words: string[]; power: number } | null>(null);
  // The bomb swells with every word played since it last went off, more for a long word.
  const bombSz = useMemo(() => bombSize(wordsSinceBoom(game.history)), [game.history.length]); // eslint-disable-line react-hooks/exhaustive-deps
  /** A steal lands: the whole table jolts and a red edge flashes (neither under reduced motion). */
  const jolt = (px = 9, punch = 1) => {
    if (reduced) return;
    setHit(Math.random() + 1);
    rootRef.current?.animate?.(
      [{ transform: 'translate(0,0)' }, { transform: `translate(${-px}px,${px * 0.45}px)` }, { transform: `translate(${px * 0.9}px,${-px * 0.55}px)` }, { transform: `translate(${-px * 0.55}px,${px * 0.33}px)` }, { transform: `translate(${px * 0.33}px,${-px * 0.22}px)` }, { transform: 'translate(0,0)' }],
      { duration: px > 9 ? 650 : 380, easing: 'ease-out' },
    );
    if (punch > 1) rootRef.current?.animate?.([{ scale: String(punch) }, { scale: '1' }], { duration: 900, easing: 'cubic-bezier(0.1, 0.8, 0.2, 1)' });
  };

  const flash = (node: ReactNode, ms = 900) => {
    const id = Math.random();
    setFx((list) => [...list.slice(-5), { id, node }]);
    setTimeout(() => setFx((list) => list.filter((f) => f.id !== id)), ms);
  };
  const mood = (seat: string | number, state: SheepState, coldFor?: number) =>
    setMoods((m) => ({ ...m, [Number(seat)]: { state, key: k(), coldFor } }));

  // A lost turn or failed steal dims a card until the next turn starts.
  useEffect(() => setDimmed(new Set()), [game.turn?.seat]);

  // Every change of the floor is called out: as the camera swings to the new speaker a board over the table names
  // whose turn it is (gold for yours), so the swing never leaves you guessing who is on. The tour has its own cards.
  const turnSeat = game.turn?.seat;
  const turnStartedAt = game.turn?.startedAt;
  useEffect(() => {
    if (turnSeat === undefined || game.phase !== 'playing' || storeMode === 'tour') return;
    const me = turnSeat === mySeat;
    flash(
      <Notice tone={me ? 'gold' : 'wood'} size="lg" className="sk-turn-call" title={me ? 'Your turn!' : `${name(String(turnSeat))}’s turn`}
        sub={me ? `a word starting with ${(game.chainLetter ?? '').toUpperCase()}` : undefined} />,
      1200,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnSeat, turnStartedAt]);

  // A played word lands with a stamp: big gold letters, a burst of light and a puff of wool tufts.
  const burst = (word: string, by: string, mine: boolean) => {
    const tufts = Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2 + Math.random() * 0.5, d = 70 + Math.random() * 50;
      return <span key={i} className="sk-word-burst-tuft" style={{ '--dx': `${Math.cos(a) * d}px`, '--dy': `${Math.sin(a) * d * 0.6}px` } as React.CSSProperties} />;
    });
    const size = Math.min(64, Math.max(34, 520 / Math.max(6, word.length)));
    flash(
      <div className={`sk-word-burst ${mine ? 'sk-word-burst-mine' : ''}`}>
        <span className="sk-word-burst-ring" />
        {!reduced && tufts}
        <span className="sk-word-burst-word" style={{ fontSize: mine ? size * 1.15 : size }}>{word.toUpperCase()}</span>
        <span className="sk-word-burst-by">{mine ? 'Nice one!' : by}</span>
      </div>,
      1300,
    );
  };

  useVisualEvents((e: VisualEvent) => {
    switch (e.type) {
      case 'accepted':
        setMoments((m) => ({ ...m, tuftIn: { key: k(), from: rel(Number(e.playerId)) } }));
        if (e.word.length >= 8) mood(e.playerId, 'proud');
        burst(e.word, name(e.playerId), Number(e.playerId) === mySeat);
        break;
      case 'stole':
        jolt();
        mood(e.fromId, 'startled');
        mood(e.byId, 'happy');
        setMoments((m) => ({ ...m, wolf: { key: k(), to: rel(Number(e.byId)) } }));
        setDimmed((d) => new Set(d).add(Number(e.fromId)));
        flash(<Notice tone="steal" size="lg" icon={<WolfIcon size={30} />} title={Number(e.byId) === mySeat ? `You stole it with ${e.word.toUpperCase()}!` : Number(e.fromId) === mySeat ? `${name(e.byId)} stole from you!` : `Stolen with ${e.word.toUpperCase()}!`} sub={`${name(e.byId)} took a wool ball from ${name(e.fromId)}`} />, 1800);
        break;
      case 'passed':
        mood(e.playerId, 'happy');
        flash(<Notice tone="wood" size="sm" snow={false} icon={<MiniBomb size={22} />} title="Bomb passed!" sub={e.toId ? `${name(e.playerId)} handed it to ${name(e.toId)}` : undefined} />, 1400);
        break;
      case 'stealFailed':
        if (Number(e.playerId) === mySeat) flash(<Notice tone="wood" size="sm" snow={false} title="Missed!" sub="try again in a second" />, 1000);
        break;
      case 'timedOut':
        setDimmed((d) => new Set(d).add(Number(e.playerId)));
        // Every time-out blows the bomb up, learning games included.
        {
          // Everything said since the bomb last went off comes out and goes up with it; a bigger bomb is a bigger blast.
          const words = wordsSinceBoom(useStore.getState().game?.history ?? [], true);
          const power = bombSize(words);
          jolt(40 + 22 * power, 1.12 + 0.07 * power);
          setBoom(k() + 1);
          setBlast({ key: k() + 1, words: words.slice(-14), power });
          setMoments((m) => ({ ...m, boom: { key: k(), at: rel(Number(e.playerId)), power } }));
        }
        if (game.players[Number(e.playerId)]?.isHuman && (practice || storeMode === 'tour')) {
          flash(<Notice tone="cold" icon={<GustIcon size={22} />} title="BOOM! Time’s up!" sub="no wool lost while you practise" />, 1500);
          break; // learning: no loss
        }
        mood(e.playerId, 'cold', 2);
        setMoments((m) => ({ ...m, gust: { key: k(), at: rel(Number(e.playerId)) } }));
        flash(
          <Notice tone="cold" icon={<GustIcon size={22} />} title="BOOM! Time’s up!"
            sub={`${name(e.playerId)} lost a wool ball${e.trapperId ? ` · ${name(e.trapperId)}’s trap wins one` : ''}`} />,
          1500,
        );
        break;
      case 'frozen':
        mood(e.playerId, 'freezing');
        setMoments((m) => ({ ...m, freeze: { key: k(), at: rel(Number(e.playerId)) } }));
        flash(<Notice tone="ice" size="lg" icon={<SnowflakeIcon size={26} />} title={`${name(e.playerId)} is frozen solid!`} sub="out of wool, out of the game" />, 2000);
        break;
      case 'thawed':
        mood(e.playerId, 'thawing');
        break;
      case 'roundStart':
        // The round's alarms, one after the other: faster turns (every round until the floor), then the twist.
        if (e.round > 1 && storeMode !== 'tour') {
          if (e.faster && !practice) pushAlarm({ tone: 'speed', label: `Round ${e.round} · faster`, title: `${e.turnSeconds}-second turns`, sub: 'the clock is shorter from here on' });
          if (e.twist && e.twist !== 'vowelDouble') pushAlarm({ tone: 'twist', label: `Round ${e.round} · new rule`, title: TWIST_TEXT[e.twist], sub: 'for this round only' });
        }
        break;
      case 'stealTurn': {
        if (game.players[mySeat]?.frozen) break;
        // A backgrounded tab catches up on several turns in one frame: a steal turn that is already over is not
        // announced, or the board would call a steal on a sheep whose turn has passed.
        const live = useStore.getState().game;
        if (!live?.turn || live.phase !== 'playing' || live.turn.seat !== Number(e.playerId)) break;
        const me = Number(e.playerId) === mySeat;
        pushAlarm({
          tone: 'steal', label: 'Steal turn', ms: 2600,
          title: me ? 'They can rob you!' : `Rob ${name(e.playerId)}!`,
          sub: me ? 'answer before your timer turns red' : `when their timer turns red, type a ${(view.letter ?? '').toUpperCase()}-word first`,
        });
        break;
      }
      case 'gameEnd':
        clearAlarms();
        break;
      default:
        break;
    }
  });

  // A new game starts with no leftover moods except the thaw the events just set, and a fresh coat.
  useEffect(() => {
    setMoods((m) => Object.fromEntries(Object.entries(m).filter(([, v]) => v.state === 'thawing')));
  }, [game.seed]);

  const speaker = view.currentPlayerId === '' ? null : rel(Number(view.currentPlayerId));
  // A bot on turn types into its tag like a person: thinks, types in bursts, slips and backspaces, then sends. A bot
  // that is going to run out of time starts words and gives up on them.
  const turn = game.turn;
  const botScript = useMemo(() => {
    if (!turn || !dict || game.players[turn.seat].isHuman) return null;
    const plan = previewBotTurn(game, { dict });
    const word = plan?.kind === 'play' ? plan.word : null;
    const end = word && turn.botActAt != null ? turn.botActAt : turn.endsAt;
    return { from: turn.startedAt, script: typingScript(word, Math.max(400, end - turn.startedAt), seedOf(`${game.seed}:${turn.startedAt}:${turn.seat}`), game.chainLetter, turn.durationMs) };
    // One script per turn: the plan is taken when the turn starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn?.startedAt, turn?.seat, dict]);
  const botElapsed = botScript && turn && !game.players[turn.seat].isHuman ? now - botScript.from : -1;
  const botTyped = botElapsed >= 0 ? keystrokeAt(botScript!.script, botElapsed)?.text ?? '' : '';
  // A bounced try shakes the tag red for a beat, outliving the wipe that follows it.
  const botRejectKey = botElapsed >= 0 ? lastRejectAt(botScript!.script, botElapsed) : null;
  const botReject = !!botRejectKey && botElapsed - botRejectKey.at < 380;
  const signState = game.phase === 'gameOver' ? 'raised' : game.phase === 'intro' ? 'lowering' : 'hung';
  const ranked = rankPlayers(game.players).map((p) => view.players[p.id]);
  const showTally = game.phase === 'intro' && game.round > 1 && storeMode !== 'tour';
  const winners = new Set(game.phase === 'gameOver' ? game.winners ?? [] : []);
  const stateOf = (p: PlayerView): Mood => {
    const m = moods[Number(p.id)];
    if (p.frozen && (!m || (m.state !== 'freezing' && m.state !== 'frozen'))) return { state: 'frozen', key: 0 };
    if (m) return m;
    return { state: game.phase === 'gameOver' && winners.has(Number(p.id)) ? 'proud' : 'idle', key: 0 };
  };

  return (
    <div ref={rootRef} className="sk-swoop-in relative flex h-full flex-col overflow-hidden" data-steal-open={view.stealOpen}>
      {boom > 0 && <div key={boom} className="sk-boom" aria-hidden="true"><i /><i /><i /></div>}
      {blast && !reduced && <Jumpscare key={`j${blast.key}`} power={blast.power} />}
      {blast && !reduced && <WordBlast key={`w${blast.key}`} words={blast.words} power={blast.power} />}
      {hit > 0 && <div key={hit} className="sk-steal-flash" aria-hidden="true" />}
      <div className={`absolute inset-0 ${shake ? 'sk-alarm-shake' : ''}`} data-table>
        <BarnTable
          bombSize={bombSz} pile={view.pile} speaker={speaker} fraction={view.turnSeconds ? view.secondsLeft / view.turnSeconds : 0}
          secondsLeft={game.turn ? view.secondsLeft : null} letter={view.letter ?? ''} isTrap={view.isTrapLetter}
          stealOpen={view.stealOpen} hour={hour} reduced={reduced} phone={mobile} blizzard={view.twist === 'doublePointsShort'} moments={moments}
          seats={view.players.map((p) => {
            const st = stateOf(p);
            return {
              seat: Number(p.id), index: rel(Number(p.id)), level: coatLevel(p.lives, maxLives), state: st.state, stateKey: st.key, coldFor: st.coldFor,
              dimmed: p.dimmed, scarf: winners.has(Number(p.id)) && winners.size === 1, thinking: p.id === view.currentPlayerId && !p.isYou, avatar: avatarOf(p),
              // Only the speaker's tag is large, with flames; the others shrink to the name (plan V3.3 Part 4.1).
              label: p.id === view.currentPlayerId ? (
                <span className="sk-chip sk-display flex flex-col items-center whitespace-nowrap text-lg leading-tight" style={{ boxShadow: view.stealOpen ? '0 0 0 3px var(--coral), 0 0 18px rgba(231,112,94,0.7)' : '0 0 0 3px var(--amber)' }}>
                  <span className="flex items-center gap-1.5">{p.name}<Lives lives={p.lives} max={maxLives} size={17} /></span>
                  {!p.isYou && <span className={`sk-num tracking-wider ${botReject ? 'sk-tag-reject' : ''}`} style={{ fontSize: 20, minHeight: 24, color: 'var(--ink)' }} aria-label={`${p.name} is typing`}>{botTyped.toUpperCase()}<span className="sk-caret" aria-hidden="true" /></span>}
                </span>
              ) : (
                <span className="sk-chip flex items-center gap-1 whitespace-nowrap text-xs" style={{ opacity: p.frozen ? 0.6 : 0.9 }}>{p.name}<Lives lives={p.lives} max={maxLives} size={11} /></span>
              ),
            };
          })}
        >
          <PlaceExtras mode={view.mode} reduced={reduced} streak={view.streakDays} />
        </BarnTable>
      </div>

      {/* A soft vignette holds the eye on the pile (plan V3.2 Part 2). */}
      <div className="pointer-events-none absolute inset-0 z-[5]" style={{ background: 'radial-gradient(ellipse at center, transparent 58%, rgba(59, 48, 40, 0.28) 100%)' }} aria-hidden="true" />

      {/* Top row: round and twist (left), controls (right). The letter and the clock live in the scene. */}
      <header className="pointer-events-none relative z-30 flex items-start justify-between gap-2 p-2">
        <div className="flex flex-col items-start gap-1">
          <span className="sk-chip sk-display">
            {game.phase === 'gameOver'
              ? `Game over · ${view.round} round${view.round === 1 ? '' : 's'}`
              : `Round ${view.round} · ${game.players.filter((p) => !p.frozen).length} sheep left${game.turn ? ` · ${Math.round((game.turn.endsAt - game.turn.startedAt) / 1000)}s turn` : view.turnSeconds ? ` · ${Math.round(view.turnSeconds)}s turns` : ''}`}
          </span>
          <TwistSign twist={view.twist} state={signState} compact={mobile} />
        </div>
        <div className="pointer-events-auto flex flex-wrap justify-end gap-1">
          <Chip className="sk-icon-chip" onClick={() => setSheet('cheat')} aria-label="How to play" title="How to play"><BookIcon size={22} /></Chip>
          <Chip className="sk-icon-chip" onClick={() => setSheet('chain')} aria-label="Chain history" title="Chain history"><ChainIcon size={18} /></Chip>
          {storeMode === 'room' && <Chip className="sk-icon-chip" onClick={() => setSheet('chat')} aria-label="Room chat" title="Room chat"><ChatIcon size={18} /></Chip>}
          <Chip className="sk-icon-chip" onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'} aria-pressed={muted} title={muted ? 'Unmute' : 'Mute'}><SpeakerIcon size={18} muted={muted} /></Chip>
          <Chip className="sk-icon-chip" onClick={() => setSheet('leave')} aria-label="Leave game" title="Leave game"><CloseIcon size={16} /></Chip>
        </div>
      </header>

      <aside className={mobile ? 'relative z-30 mt-14 flex gap-1 overflow-x-auto px-2' : 'relative z-30 ml-auto mr-2 mt-14 flex flex-col gap-1.5'} aria-label="Scoreboard">
        {ranked.map((p) => (
          <PlayerCard key={p.id} player={p} isTurn={p.id === view.currentPlayerId} compact={mobile} lastWord={game.players[Number(p.id)].lastWord} maxLives={maxLives} />
        ))}
      </aside>

      {/* Feedback words float over the middle of the table. */}
      <div className="pointer-events-none absolute inset-x-0 top-[30%] z-20 flex flex-col items-center gap-2" aria-hidden="true">
        {fx.map((f) => <div key={f.id}>{f.node}</div>)}
      </div>

      {/* The alarm: faster turns, a twist, a steal turn. One at a time, right across the screen, over everything but
          the end board, with the screen's edges flashing its colour. */}
      {alarm && game.phase !== 'gameOver' && (
        <>
          <div key={`flash-${alarm.id}`} className={`sk-alarm-flash sk-alarm-flash-${alarm.tone} z-[33]`} aria-hidden="true" />
          <div className="pointer-events-none absolute inset-x-0 top-[15%] z-[34]">
            <Alarm key={alarm.id} tone={alarm.tone} label={alarm.label} title={alarm.title} sub={alarm.sub} compact={mobile} />
          </div>
        </>
      )}

      {/* The steal call: when another sheep's timer is red, say plainly what you can do and what you win. */}
      {input.canSteal && (
        <div className="pointer-events-none absolute inset-x-0 top-[13%] z-20 flex justify-center px-3" role="status">
          <Notice tone="steal" size="lg" className="sk-steal-throb" icon={<WolfIcon size={30} />} title="Steal!"
            sub={`Type a ${(view.letter ?? '').toUpperCase()}-word first and take a wool ball from ${name(view.currentPlayerId)}`} />
        </div>
      )}

      {showTally && (
        <div className="absolute inset-0 z-30 flex items-center justify-center p-4">
          <TallyBoard players={ranked} round={game.round - 1} isGameEnd={false} maxLives={maxLives} nextTurnSeconds={practice ? undefined : roundTurnMs(game.round) / 1000} />
        </div>
      )}

      {/* The input strip leaves with the game: the end board is the only thing to act on. */}
      {game.phase !== 'gameOver' && (
        <div className="relative z-20 mt-auto">
          <InputStrip
            letter={view.letter ?? ''} typed={input.typed} myTurn={input.myTurn} stealOpen={input.canSteal}
            turnName={view.currentPlayerId === '' ? 'Next sheep' : name(view.currentPlayerId)}
            onChange={input.onChange} onSubmit={input.submit} acceptKey={input.acceptKey} out={!!game.players[mySeat]?.frozen}
            message={input.message} turnKey={game.turn?.seat}
            onPass={storeMode !== 'tour' && game.players[mySeat]?.passedRound !== game.round ? () => void useStore.getState().act({ type: 'pass', seat: mySeat }) : undefined}
            hints={input.learning ? { ideas: input.ideas, onHint: input.hintIdeas, onPick: input.useIdea } : undefined}
          />
        </div>
      )}

      {/* Coach tips only while a turn is running: never over the round tally or the end board. */}
      {storeMode === 'tour' ? <Tour /> : <div className={game.phase === 'playing' ? '' : 'hidden'}><CoachTips /></div>}
      {game.phase === 'gameOver' && <Results players={ranked} />}
      {sheet && sheet !== 'leave' && (
        <Sheet title={{ cheat: 'How to play', chain: 'Chain history', chat: 'Room chat' }[sheet]} onClose={() => setSheet(null)}>
          {sheet === 'cheat' && <RulesCard />}
          {sheet === 'chain' && <ChainList game={game} />}
          {sheet === 'chat' && <div className="rounded-xl p-2" style={{ background: 'var(--ink)', color: 'var(--button-text)' }}><ChatPanel height="h-56" compact /></div>}
        </Sheet>
      )}
      {sheet === 'leave' && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center p-4" style={{ background: 'color-mix(in srgb, var(--ink) 55%, transparent)' }} onClick={() => setSheet(null)}>
          <PaperPanel role="dialog" aria-modal="true" aria-label="Leave game" className="w-full max-w-xs p-4 text-center" onClick={(e) => e.stopPropagation()}>
            <p className="sk-display text-xl">Leave this table?</p>
            <p className="mt-1 text-sm" style={{ color: 'var(--ink-soft)' }}>{storeMode === 'daily' ? 'Your daily attempt is used.' : 'This game will end.'}</p>
            <div className="mt-3 flex gap-2">
              <WoodButton autoFocus onClick={() => setSheet(null)} className="flex-1">Stay</WoodButton>
              <CoralButton onClick={quit} className="flex-1">Leave</CoralButton>
            </div>
          </PaperPanel>
        </div>
      )}
      <DevLine />
    </div>
  );
}

/** A paper sheet with a wooden header, for the rules, the chain and the chat. */
function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" style={{ background: 'color-mix(in srgb, var(--ink) 45%, transparent)' }} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className="sk-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sk-sheet-head">
          <h2>{title}</h2>
          <Chip className="sk-icon-chip" onClick={onClose} aria-label="Close"><CloseIcon size={16} /></Chip>
        </div>
        <div className="sk-sheet-body">{children}</div>
      </div>
    </div>
  );
}

function Results({ players }: { players: PlayerView[] }) {
  const game = useStore((s) => s.game)!;
  const mode = useStore((s) => s.mode);
  const mySeat = useStore((s) => s.mySeat);
  const streak = useStore((s) => s.streak);
  const dailyDate = useStore((s) => s.dailyDate);
  const rematch = useStore((s) => s.rematch);
  const quit = useStore((s) => s.quit);
  const [copied, setCopied] = useState(false);
  // Read once: the table re-renders every frame and this reads storage.
  const days = useMemo(() => (mode === 'daily' ? streakDays(new Date(`${dailyDate ?? utcDateKey(new Date())}T12:00:00Z`)) : []), [mode, dailyDate]);
  const stats = summarize(game.players);
  const me = game.players[mySeat];

  const place = players.findIndex((p) => p.isYou) + 1;
  const steals = game.history.filter((h) => h.kind === 'steal' && h.word);
  const best = [...steals].sort((a, b) => (b.word?.length ?? 0) - (a.word?.length ?? 0))[0];
  const bestLine = best ? `Best steal: ${game.players[best.seat].name} took a wool ball${best.fromSeat !== undefined ? ` from ${game.players[best.fromSeat].name}` : ''} with ${best.word!.toUpperCase()} (round ${best.round})` : '';
  const share = async () => {
    const text = [
      `Finish the Word${mode === 'daily' && dailyDate ? ` · Daily ${dailyDate}` : ''}`,
      place === 1 ? `Last sheep standing out of ${game.players.length}!` : `Lasted to #${place} of ${game.players.length}`,
      `${me.steals} steal${me.steals === 1 ? '' : 's'} · longest word ${me.longestWord.length} letters`,
      bestLine,
      mode === 'daily' && streak > 1 ? `${streak}-day streak` : '',
    ].filter(Boolean).join('\n');
    await shareCard({
      title: 'Finish the Word',
      headline: place === 1 ? `Last sheep standing of ${game.players.length}!` : `Lasted to #${place} of ${game.players.length}`,
      lines: [`${me.steals} steal${me.steals === 1 ? '' : 's'} · longest word ${me.longestWord.length} letters`, bestLine].filter(Boolean),
    }, text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      {/* The barn dims and the board takes the middle: the game is over, this is the finale. */}
      <div className="sk-results-backdrop" aria-hidden="true" />
      <div className="fixed inset-0 z-40 flex items-end justify-center overflow-y-auto p-3 sm:items-center sm:p-6">
        <TallyBoard
          players={players} round={game.round} isGameEnd winnerIds={game.winners?.map(String)} maxLives={startingWool(game.settings)}
          actions={
            <>
              {(mode === 'quick' || mode === 'practice') && <ClothButton onClick={rematch} className="basis-full">Play again</ClothButton>}
              <WoodButton onClick={share} className="flex-1">{copied ? 'Copied!' : 'Share'}</WoodButton>
              <WoodButton onClick={quit} className="flex-1">{mode === 'room' ? 'Leave room' : 'Back to the farm'}</WoodButton>
            </>
          }
        >
          <p className="sk-hand mt-2 text-center text-lg" style={{ color: 'var(--glow)' }}>
            {place === 1 ? 'You outlasted everyone. The knitted scarf is yours.' : `You lasted to #${place} of ${game.players.length}. The last sheep standing gets the knitted scarf.`}
          </p>
          <dl className="mt-2 grid grid-cols-3 gap-1.5 text-sm">
            {[['Rounds', game.round], ['Words', stats.wordsPlayed], ['Steals', stats.steals]].map(([key, v]) => (
              <div key={key as string} className="sk-paper px-2 py-1 text-center">
                <dt className="sk-hand" style={{ color: 'var(--ink-soft)' }}>{key}</dt>
                <dd className="sk-display text-xl font-extrabold">{v}</dd>
              </div>
            ))}
          </dl>
          {stats.longestWord && (
            <div className="sk-paper mt-1.5 flex items-baseline justify-center gap-2 px-2 py-1 text-sm">
              <span className="sk-hand" style={{ color: 'var(--ink-soft)' }}>Longest word</span>
              <span className="truncate font-extrabold tracking-wide">{stats.longestWord.word.toUpperCase()}</span>
              <span className="sk-hand" style={{ color: 'var(--ink-soft)' }}>· {game.players[stats.longestWord.seat].name}</span>
            </div>
          )}
          {best && <p className="sk-hand mt-2 text-center" style={{ color: 'var(--glow)' }}>{bestLine}</p>}
          {mode === 'room' && <RewardBanner />}
          {mode === 'practice' && <p className="sk-hand mt-2 text-center" style={{ color: 'var(--glow)' }}>Practice game: you never lose wool here.</p>}
          {mode === 'daily' && (
            <div className="mt-2 text-center">
              <StreakString days={days} />
              <p className="sk-hand" style={{ color: 'var(--glow)' }}>Daily streak: {streak}</p>
            </div>
          )}
        </TallyBoard>
      </div>
    </>
  );
}

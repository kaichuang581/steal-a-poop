import { MiniBomb } from '../components/BombClock';
import { BOMB_TOSS_S } from '../voxel/bomb';
import { Jumpscare, WordBlast } from '../components/Jumpscare';
import { bombSize, wordsSinceBoom } from '../model/bombCharge';
import { shareCard } from '../share/card';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { previewBotTurn, rankPlayers, roundTurnMs, startingWool, utcDateKey } from '../../engine';
import { getDream } from '../../dream/daily';
import { getPracticeBest } from '../../lib/practice';
import { farmSheepLine } from '../../lib/record';
import { useRoomStore } from '../../state/roomStore';
import { useStore } from '../../state/store';
import { useAvatar } from '../avatars/store';
import { ChatPanel } from '../../ui/ChatPanel';
import { AcornIcon, BookIcon, ChainIcon, ChatIcon, CloseIcon, GustIcon, LeafIcon, SeedlingIcon, SnowflakeIcon } from '../components/Icons';
import { Notice } from '../components/Notice';
import { ChainList, RulesCard } from '../components/RulesCard';
import { CoachTips } from '../../ui/CoachTips';
import { useGameLoop, useIsMobile } from '../../ui/hooks';
import { RewardBanner } from '../../ui/social/RewardBanner';
import { Tour } from '../../ui/Tour';
import { useGameSounds } from '../../ui/useGameSounds';
import { InputStrip } from '../components/InputStrip';
import { Ledger } from '../components/Ledger';
import { Lives } from '../components/Lives';
import { TallyBoard } from '../components/TallyBoard';
import { Board, Brass, Clipboard, ClothButton, Ice, Knit, Panel, Paper, Peg, Slate, WoodButton } from '../kit';
import { TwistSign } from '../components/TwistSign';
import { LedgerRow } from '../components/Ledger';
import { Podium } from '../table/Podium';
import type { PodiumEntry } from '../table/Podium';
import { SoundMenu } from '../components/SoundMenu';
import { Alarm, useAlarms } from '../components/Alarm';
import { useHour, useMotionLevel } from '../hooks/useAmbient';
import { localDateKey } from '../hooks/useToday';
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
import { DuelTable } from '../table/DuelTable';
import { PlaceExtras } from '../table/places';
import { coatLevel } from '../table/Sheep';
import type { SheepState } from '../table/Sheep';

interface Fx { id: number; node: ReactNode }
const BADGE = { easy: <SeedlingIcon size={12} />, medium: <LeafIcon size={12} />, hard: <AcornIcon size={12} /> } as const;
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
  // A practice run has its own place: the two of you, out on the ice.
  const Stage = practice ? DuelTable : BarnTable;
  // Read once a run: the table re-renders every frame and this reads storage.
  const runBest = useMemo(() => (practice ? getPracticeBest(game.settings.practiceClock ?? 15, game.settings.botDifficulty) : 0), [practice, game.seed]); // eslint-disable-line react-hooks/exhaustive-deps
  const runWords = game.players[0].wordsPlayed;
  // Wool balls are lives: every sheep shows them, with an empty ring for each one lost.
  const maxLives = startingWool(game.settings);
  const k = () => Math.random();
  const rootRef = useRef<HTMLDivElement>(null);
  const [hit, setHit] = useState(0);
  const [boom, setBoom] = useState(0);
  const [blast, setBlast] = useState<{ key: number; words: string[]; power: number } | null>(null);
  // The bomb swells with every word played since it last went off, more for a long word.
  const bombSz = useMemo(() => bombSize(wordsSinceBoom(game.history)), [game.history.length]); // eslint-disable-line react-hooks/exhaustive-deps
  /** A blast: the whole table jolts and a frosty edge flashes (neither under reduced motion). */
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

  // A lost turn dims a card until the next turn starts.
  useEffect(() => setDimmed(new Set()), [game.turn?.seat]);

  // Every change of the floor is called out: as the camera swings to the new speaker a board over the table names
  // whose turn it is (gold for yours), so the swing never leaves you guessing who is on. The tour has its own cards.
  const turnSeat = game.turn?.seat;
  const turnStartedAt = game.turn?.startedAt;
  useEffect(() => {
    // A practice run changes turns too fast for a board, and with two seats the letter and the word bar say it all.
    if (turnSeat === undefined || game.phase !== 'playing' || storeMode === 'tour' || practice) return;
    const me = turnSeat === mySeat;
    flash(
      <Notice tone={me ? 'gold' : 'wood'} size="lg" className="sk-turn-call" title={me ? 'Your turn!' : `${name(String(turnSeat))}’s turn`}
        sub={me ? `a word starting with ${(game.chainLetter ?? '').toUpperCase()}` : undefined} />,
      1200,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnSeat, turnStartedAt]);

  // The bomb lands beside each new speaker (see Bomb) and they flinch as it hits the floor, unless they are busy being cold.
  useEffect(() => {
    if (turnSeat === undefined || game.phase !== 'playing' || reduced) return;
    const id = setTimeout(() => setMoods((m) => {
      const now = m[turnSeat]?.state;
      if (now === 'cold' || now === 'freezing' || now === 'frozen' || now === 'thawing') return m;
      return { ...m, [turnSeat]: { state: 'startled', key: k() } };
    }), BOMB_TOSS_S * 1000);
    return () => clearTimeout(id);
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
        <span className="sk-word-burst-by">{mine ? CHEERS[Math.floor(Math.random() * CHEERS.length)] : by}</span>
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
      case 'passed':
        mood(e.playerId, 'happy');
        flash(<Notice tone="wood" size="sm" snow={false} icon={<MiniBomb size={22} />} title="Bomb passed!" sub={e.toId ? `${name(e.playerId)} handed it to ${name(e.toId)}` : undefined} />, 1400);
        break;
      case 'timedOut':
        setDimmed((d) => new Set(d).add(Number(e.playerId)));
        // Every time-out blows the bomb up, learning games included.
        {
          // Everything said since the bomb last went off comes out and goes up with it; a bigger bomb is a bigger blast.
          const words = wordsSinceBoom(useStore.getState().game?.history ?? [], true);
          const power = bombSize(words);
          jolt(70 + 34 * power, 1.25 + 0.12 * power);
          setBoom(k() + 1);
          setBlast({ key: k() + 1, words: words.slice(-14), power });
          setMoments((m) => ({ ...m, boom: { key: k(), at: rel(Number(e.playerId)), power } }));
        }
        if (game.players[Number(e.playerId)]?.isHuman && storeMode === 'tour') {
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
          if (e.faster) pushAlarm({ tone: 'speed', label: `Round ${e.round} · faster`, title: `${e.turnSeconds}-second turns`, sub: 'the clock is shorter from here on' });
          if (e.twist && e.twist !== 'vowelDouble') pushAlarm({ tone: 'twist', label: `Round ${e.round} · new rule`, title: TWIST_TEXT[e.twist], sub: 'for this round only' });
        }
        break;
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
    <div ref={rootRef} className="sk-swoop-in relative flex h-full flex-col overflow-hidden">
      {boom > 0 && <div key={boom} className="sk-boom" aria-hidden="true"><i /><i /><i /></div>}
      {blast && !reduced && <Jumpscare key={`j${blast.key}`} power={blast.power} />}
      {blast && !reduced && <WordBlast key={`w${blast.key}`} words={blast.words} power={blast.power} />}
      {hit > 0 && <div key={hit} className="sk-hit-flash" aria-hidden="true" />}
      <div className={`absolute inset-0 ${shake ? 'sk-alarm-shake' : ''}`} data-table>
        <Stage
          bombSize={bombSz} pile={view.pile} speaker={speaker} fraction={view.turnSeconds ? view.secondsLeft / view.turnSeconds : 0}
          secondsLeft={game.turn ? view.secondsLeft : null} letter={view.letter ?? ''} isTrap={view.isTrapLetter}
          hour={hour} reduced={reduced} phone={mobile} blizzard={view.twist === 'doublePointsShort'} moments={moments}
          seats={view.players.map((p) => {
            const st = stateOf(p);
            return {
              seat: Number(p.id), index: rel(Number(p.id)), level: coatLevel(p.lives, maxLives), state: st.state, stateKey: st.key, coldFor: st.coldFor,
              dimmed: p.dimmed, scarf: winners.has(Number(p.id)) && winners.size === 1, thinking: p.id === view.currentPlayerId && !p.isYou, avatar: avatarOf(p),
              // Over each head: a knitted name plate (wool like the ledger, berry for the speaker) and, while a sheep
              // speaks or you type ahead, a speech bubble with the word as it is typed.
              label: (() => {
                const speaking = p.id === view.currentPlayerId;
                const typed = p.isYou ? input.typed : speaking ? botTyped : '';
                const say = p.isYou ? (speaking && !p.frozen) || !!input.typed : speaking && !!typed;
                const L = (view.letter ?? '').toLowerCase();
                return (
                  <div className="sk-head" data-speaker={speaking || undefined} data-frozen={p.frozen || undefined}>
                    {say && (
                      <div className={`sk-say ${!p.isYou && botReject ? 'sk-tag-reject' : ''}`} data-wait={!speaking || undefined}
                        aria-label={p.isYou ? undefined : `${p.name} is typing`}>
                        {typed ? [...typed].map((ch, i) => (
                          <span key={i} data-first={i === 0 && p.isYou ? (ch.toLowerCase() === L ? 'ok' : 'bad') : undefined}>{ch.toUpperCase()}</span>
                        )) : <span className="sk-say-ph">a word with {L.toUpperCase()}…</span>}
                        {speaking && <i className="sk-say-caret" aria-hidden="true" />}
                      </div>
                    )}
                    <div className="sk-plate">
                      <span className="sk-plate-who">{p.name}</span>
                      {p.difficulty && <span className="sk-plate-badge" role="img" aria-label={`${p.difficulty} bot`}>{BADGE[p.difficulty]}</span>}
                      <Lives lives={p.lives} max={maxLives} size={speaking ? 14 : 12} />
                      {p.isYou && <span className="sk-plate-you">you</span>}
                      {p.frozen && <Ice className="sk-plate-ice" />}
                    </div>
                  </div>
                );
              })(),
            };
          })}
        >
          <PlaceExtras mode={view.mode} reduced={reduced} streak={view.streakDays} />
        </Stage>
      </div>

      {/* A soft vignette holds the eye on the pile (plan V3.2 Part 2). */}
      <div className="pointer-events-none absolute inset-0 z-[5]" style={{ background: 'radial-gradient(ellipse at center, transparent 58%, rgba(59, 48, 40, 0.28) 100%)' }} aria-hidden="true" />

      {/* Top row: round and twist (left), controls (right). The letter and the clock live in the scene. */}
      <header className="pointer-events-none relative z-40 flex items-start justify-between gap-2 p-2">
        <div className="flex flex-col items-start gap-1">
          {practice ? (
            <Slate size="plaque" tone={runWords > runBest && runBest > 0 ? 'amber' : 'chalk'} className="sk-run-plaque">
              <span>{runWords}<span className="kit-chalk-hand"> word{runWords === 1 ? '' : 's'}</span></span>
              <span className="kit-chalk-hand">best {Math.max(runBest, runWords)}{game.turn ? ` · ${Math.round(game.turn.durationMs / 1000)}s turn` : ''}</span>
            </Slate>
          ) : (
            <div className="sk-hud-tab">
              <span className="sk-hud-round">{game.phase === 'gameOver'
                ? `Game over · ${view.round} round${view.round === 1 ? '' : 's'}`
                : `Round ${view.round} · ${game.players.filter((p) => !p.frozen).length} sheep left${mobile ? '' : game.turn ? ` · ${Math.round((game.turn.endsAt - game.turn.startedAt) / 1000)}s turn` : view.turnSeconds ? ` · ${Math.round(view.turnSeconds)}s turns` : ''}`}</span>
              <TwistSign twist={view.twist} state={signState} compact={mobile} />
            </div>
          )}
        </div>
        <div className="pointer-events-auto flex flex-wrap justify-end gap-1.5">
          <Peg onClick={() => setSheet('cheat')} aria-label="How to play" title="How to play"><BookIcon size={22} /></Peg>
          <Peg onClick={() => setSheet('chain')} aria-label="Chain history" title="Chain history"><ChainIcon size={18} /></Peg>
          {storeMode === 'room' && <Peg onClick={() => setSheet('chat')} aria-label="Room chat" title="Room chat"><ChatIcon size={18} /></Peg>}
          <SoundMenu peg />
          <Peg onClick={() => setSheet('leave')} aria-label="Leave game" title="Leave game"><CloseIcon size={16} /></Peg>
        </div>
      </header>

      {practice ? (
        // The fight card: two paper slips pinned up either side of a carved VS.
        <div className={`pointer-events-none absolute inset-x-0 z-30 flex items-center justify-center gap-3 ${mobile ? 'top-16' : 'top-3'}`} aria-label="Who is playing">
          <Paper kind="slip" pin="top" seed={0} tilt className="sk-vs-slip">{game.players[0].name}</Paper>
          <span className="sk-vs">VS</span>
          <Paper kind="slip" pin="top" seed={1} tilt className="sk-vs-slip">{game.players[1].name}<span className="sk-vs-farm">farm sheep · {game.settings.botDifficulty}</span></Paper>
        </div>
      ) : (
        <Ledger players={ranked} turnId={view.currentPlayerId} maxLives={maxLives} compact={mobile}
          lastWords={Object.fromEntries(ranked.map((p) => [p.id, game.players[Number(p.id)].lastWord]))} />
      )}

      {/* Feedback words float over the middle of the table. */}
      <div className={`pointer-events-none absolute inset-x-0 z-[25] flex flex-col items-center gap-5 top-[30%]`} aria-hidden="true">
        {fx.map((f) => <div key={f.id}>{f.node}</div>)}
      </div>

      {/* The alarm: faster turns, a twist. One at a time, right across the screen, over everything but
          the end board, with the screen's edges flashing its colour. */}
      {alarm && game.phase !== 'gameOver' && (
        <>
          <div key={`flash-${alarm.id}`} className={`sk-alarm-flash sk-alarm-flash-${alarm.tone} z-[33]`} aria-hidden="true" />
          <div className="pointer-events-none absolute inset-x-0 top-[15%] z-[34]">
            <Alarm key={alarm.id} tone={alarm.tone} label={alarm.label} title={alarm.title} sub={alarm.sub} compact={mobile} />
          </div>
        </>
      )}

      {/* Every solo table opens by saying who is at it, so nobody takes the farm's sheep for people. Over the letter card,
          which can sit anywhere the barn's camera puts it. */}
      {game.phase === 'intro' && game.round === 1 && (storeMode === 'quick' || storeMode === 'daily') && (
        <div className="pointer-events-none absolute inset-x-0 top-[15%] z-[34] flex justify-center px-3">
          <Notice tone="wood" size="lg" title={farmSheepLine(n - 1)} />
        </div>
      )}

      {showTally && (
        <div className="absolute inset-0 z-30 flex items-center justify-center p-4">
          <TallyBoard players={ranked} round={game.round - 1} isGameEnd={false} maxLives={maxLives} nextTurnSeconds={roundTurnMs(game.round) / 1000} />
        </div>
      )}

      {/* The input strip leaves with the game: the end board is the only thing to act on. */}
      {game.phase !== 'gameOver' && (
        <div className="relative z-20 mt-auto">
          <InputStrip
            letter={view.letter ?? ''} typed={input.typed} myTurn={input.myTurn}
            turnName={view.currentPlayerId === '' ? 'Next sheep' : name(view.currentPlayerId)}
            onChange={input.onChange} onSubmit={input.submit} acceptKey={input.acceptKey} out={!!game.players[mySeat]?.frozen}
            message={input.message} turnKey={game.turn?.seat}
            onPass={storeMode !== 'tour' && !practice && game.players[mySeat]?.passedRound !== game.round ? () => void useStore.getState().act({ type: 'pass', seat: mySeat }) : undefined}
            hints={input.learning ? { ideas: input.ideas, onHint: input.hintIdeas, onPick: input.useIdea } : undefined}
          />
        </div>
      )}

      {/* Coach tips only while a turn is running: never over the round tally or the end board. */}
      {storeMode === 'tour' ? <Tour /> : <div className={game.phase === 'playing' ? '' : 'hidden'}><CoachTips /></div>}
      {game.phase === 'gameOver' && (practice ? <RunOver /> : (
        <Results players={ranked} podium={ranked.map((p, i) => ({ key: p.id, name: p.name, place: i + 1, avatar: avatarOf(p), level: coatLevel(Math.max(p.lives, 1), maxLives), isYou: p.isYou }))} />
      ))}
      {sheet && sheet !== 'leave' && (
        <Sheet title={{ cheat: 'How to play', chain: 'Chain history', chat: 'Room chat' }[sheet]} onClose={() => setSheet(null)}>
          {sheet === 'cheat' && <RulesCard />}
          {sheet === 'chain' && <ChainList game={game} />}
          {sheet === 'chat' && <Panel className="p-2"><div className="sk-chat-card"><ChatPanel height="h-56" compact /></div></Panel>}
        </Sheet>
      )}
      {sheet === 'leave' && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center p-4" style={{ background: 'color-mix(in srgb, var(--ink) 55%, transparent)' }} onClick={() => setSheet(null)}>
          <Clipboard aria-label="Leave game" title="Leave this table?" className="sk-leave" onClick={(e) => e.stopPropagation()}>
            <p>{storeMode === 'daily' ? 'Your daily attempt is used.' : 'This game will end.'}</p>
            <div className="mt-3 flex gap-3">
              <WoodButton autoFocus onClick={() => setSheet(null)} className="flex-1">Stay</WoodButton>
              <Brass barn onClick={quit} className="flex-1">Leave</Brass>
            </div>
          </Clipboard>
        </div>
      )}
      <DevLine />
    </div>
  );
}

/** A clipboard for the rules, the chain and the chat (V6 Part 6.2): paper under a brass clip on a light board. */
function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center" style={{ background: 'color-mix(in srgb, var(--ink) 45%, transparent)' }} onClick={onClose}>
      <Clipboard aria-label={title} title={title} onClose={onClose} className="sk-table-sheet" onClick={(e) => e.stopPropagation()}>
        {children}
      </Clipboard>
    </div>
  );
}

/** What the table shouts when your word lands. */
const CHEERS = ['Nice one!', 'Ho ho ho!', 'Jolly good!', 'Fa la la la baa!', 'Merry and bright!'];
const DREAM_LINE = 'Tonight’s dream is still waiting: Counting Sheep, on the farm.';
/** Read once: the table re-renders every frame and this reads storage. */
const useDreamWaiting = () => useMemo(() => !getDream(localDateKey(new Date())), []);

/** The end of a practice run: the score, the best for this clock and bot, and straight back in. */
function RunOver() {
  const game = useStore((s) => s.game)!;
  const run = useStore((s) => s.practiceResult);
  const rematch = useStore((s) => s.rematch);
  const quit = useStore((s) => s.quit);
  const dreamWaiting = useDreamWaiting();
  const me = game.players[0];
  const score = run?.score ?? me.wordsPlayed;
  const stats: [string, string | number][] = [
    ['Best', run?.best ?? score],
    ['Clock', `${game.settings.practiceClock ?? 15} s`],
    ['Bot', game.settings.botDifficulty[0].toUpperCase() + game.settings.botDifficulty.slice(1)],
  ];
  return (
    <>
      <div className="sk-results-backdrop" aria-hidden="true" />
      <div className="fixed inset-0 z-40 flex items-end justify-center overflow-y-auto p-3 pt-16 sm:items-center sm:p-6">
        {/* The run's board (V6 Part 6.3): the score chalked big on a slate, the clock, the bot and the best on three small ones. */}
        <Board size="panel" hang="ropes" snow id="run-over" role="dialog" aria-label="Run over" className="sk-tally w-full max-w-sm">
          <h2 className="sk-tally-title">{run?.isNew ? 'New best!' : 'Baa humbug!'}</h2>
          <div className="mt-2 flex justify-center">
            <Slate size="plaque" tone={run?.isNew ? 'amber' : 'chalk'} className="sk-score-plaque">
              {score}<span className="kit-chalk-hand">word{score === 1 ? '' : 's'} before the clock ran out</span>
            </Slate>
          </div>
          <div className="sk-plaques">
            {stats.map(([key, v]) => (
              <Slate key={key} size="plaque"><span>{v}</span><span className="kit-chalk-hand">{key}</span></Slate>
            ))}
          </div>
          {(me.longestWord || dreamWaiting) && (
            <Paper kind="sheet" pin="top" seed="run" className="sk-tally-notes">
              {me.longestWord && <p>Longest word: <b className="tracking-wide">{me.longestWord.toUpperCase()}</b></p>}
              {dreamWaiting && <p className="sk-hand">{DREAM_LINE}</p>}
            </Paper>
          )}
          <div className="sk-tally-actions">
            <ClothButton autoFocus onClick={rematch} className="basis-full">Play again</ClothButton>
            <WoodButton onClick={quit} className="flex-1">Back to the farm</WoodButton>
          </div>
        </Board>
      </div>
    </>
  );
}

function Results({ players, podium }: { players: PlayerView[]; podium: PodiumEntry[] }) {
  const game = useStore((s) => s.game)!;
  const mode = useStore((s) => s.mode);
  const mySeat = useStore((s) => s.mySeat);
  const streak = useStore((s) => s.streak);
  const dailyDate = useStore((s) => s.dailyDate);
  const rematch = useStore((s) => s.rematch);
  const quit = useStore((s) => s.quit);
  const [copied, setCopied] = useState(false);
  // The scoreboard is up at once beside the podium; it can be hidden for a screenshot and shown again.
  const stats = true;
  const [hidden, setHidden] = useState(false);
  const reducedMotion = useStore((s) => s.reduceMotion);
  const phone = useIsMobile();
  // Read once: the table re-renders every frame and this reads storage.
  const days = useMemo(() => (mode === 'daily' ? streakDays(new Date(`${dailyDate ?? utcDateKey(new Date())}T12:00:00Z`)) : []), [mode, dailyDate]);
  const result = useStore((s) => s.gameResult);
  const dreamWaiting = useDreamWaiting();
  const me = game.players[mySeat];
  const tiles: [string, number, number | undefined, boolean | undefined][] = [
    ['Wool kept', me.lives, result?.bests.wool, result?.beat.wool],
  ];

  const place = players.findIndex((p) => p.isYou) + 1;
  const share = async () => {
    const text = [
      `Finish the Word${mode === 'daily' && dailyDate ? ` · Daily ${dailyDate}` : ''}`,
      place === 1 ? `Last sheep standing out of ${game.players.length}!` : `Lasted to #${place} of ${game.players.length}`,
      `Longest word: ${me.longestWord.length} letters`,
      mode === 'daily' && streak > 1 ? `${streak}-day streak` : '',
    ].filter(Boolean).join('\n');
    await shareCard({
      title: 'Finish the Word',
      headline: place === 1 ? `Last sheep standing of ${game.players.length}!` : `Lasted to #${place} of ${game.players.length}`,
      lines: [`Longest word: ${me.longestWord.length} letters`],
    }, text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <Podium entries={podium} reduced={reducedMotion} phone={phone} aside={stats && !hidden} />
      {stats && hidden && (
        <button type="button" className="sk-final-show" onClick={() => setHidden(false)}>Show the scoreboard</button>
      )}
      {stats && !hidden && (
        <div className="sk-final-wrap">
          <section className="sk-final" role="dialog" aria-modal="true" aria-label="Game over">
            <button type="button" className="sk-final-close" onClick={() => setHidden(true)} aria-label="Hide the scoreboard" title="Hide the scoreboard"><CloseIcon size={16} /></button>
            <h2 className="sk-final-title">{players.find((p) => game.winners?.map(String).includes(p.id))?.name ?? players[0].name} is the last sheep standing!</h2>
            <ol className="sk-final-rows">
              {players.map((p, i) => <LedgerRow key={p.id} player={p} place={i + 1} maxLives={startingWool(game.settings)} ringed={game.winners?.map(String).includes(p.id)} />)}
            </ol>
            <p className="sk-final-note">{place === 1 ? 'You outlasted everyone. The knitted scarf is yours.' : `You lasted to #${place} of ${game.players.length}. The last sheep standing gets the knitted scarf.`}</p>
            {dreamWaiting && <p className="sk-final-note">{DREAM_LINE}</p>}
            <div className="sk-final-stats">
              {tiles.map(([key, v, best, beat]) => (
                <div key={key} className="sk-final-stat" data-beat={beat || undefined}>
                  <b>{v}</b><span>{key}{best !== undefined ? ` · ${beat ? 'new best!' : `best ${best}`}` : ''}</span>
                </div>
              ))}
              <div className="sk-final-stat" data-beat={result?.beat.longest || undefined}>
                <b>{me.longestWord ? me.longestWord.toUpperCase() : '—'}</b>
                <span>Longest word{result?.bests.longest ? ` · ${result.beat.longest ? 'new best!' : `best ${result.bests.longest.toUpperCase()}`}` : ''}</span>
              </div>
            </div>
            {mode === 'room' && <RewardBanner />}
            {mode === 'daily' && (
              <div className="sk-tally-streak" aria-label={`Daily streak: ${days.filter(Boolean).length} of the last 7 days played`}>
                <Knit stitches={days.map((on, i) => (i === days.length - 1 && on ? 'today' : on ? 'played' : 'missed'))} />
                <p className="sk-hand">Daily streak: {streak}</p>
              </div>
            )}
            <div className="sk-final-actions">
              {mode === 'quick' && <ClothButton onClick={rematch} className="basis-full">Same table again</ClothButton>}
              <Brass onClick={share} className="flex-1">{copied ? 'Copied!' : 'Share'}</Brass>
              <WoodButton onClick={quit} className="flex-1">{mode === 'room' ? 'Leave room' : 'Back to the farm'}</WoodButton>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

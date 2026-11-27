import { MiniBomb } from '../components/BombClock';
import { CHEERS } from '../season';
import { BOMB_TOSS_S } from '../voxel/bomb';
import { BLAST_PALETTE, burstExplodes } from '../shop/catalog';
import { payEarly, PayoutLines, usePayout } from '../shop/Payout';
import type { GameReward } from '../shop/economy';
import type { GameState } from '../../engine/types';
import { useWallet } from '../shop/store';
import { playSound } from '../../audio/sound';
import { AFTERMATH_MS } from '../../engine/constants';
import { playBarnDoors, whenDoorsOpen, whenDoorsShut } from '../components/BarnDoors';
import { buzz } from '../hooks/buzz';
import { Jumpscare, WordBlast } from '../components/Jumpscare';
import { bombSize, wordsSinceBoom } from '../model/bombCharge';
import { shareCard } from '../share/card';
import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ALL_MODIFIERS, ANNOUNCE_MS, breaksRule, normalizeWord, previewBotTurn, rankPlayers, roundTurnMs, startingWool, utcDateKey } from '../../engine';
import { getDream } from '../../dream/daily';
import { farmSheepLine } from '../../lib/record';
import { useRoomStore } from '../../state/roomStore';
import { useStore } from '../../state/store';
import { useAvatar } from '../avatars/store';
import { ChatPanel } from '../../ui/ChatPanel';
import { AcornIcon, BookIcon, ChainIcon, ChatIcon, CloseIcon, GustIcon, LeafIcon, SeedlingIcon, SnowflakeIcon } from '../components/Icons';
import { Notice } from '../components/Notice';
import { ChainList, RulesCard } from '../components/RulesCard';
import { GameTips } from '../components/GameTips';
import { useGameLoop } from '../../ui/hooks';
import { usePhoneLayout } from '../device';
import { RewardBanner } from '../../ui/social/RewardBanner';
import { PaintedTour } from '../tour/PaintedTour';
import { RatedSlip } from '../ranked/RatedSlip';
import '../ranked/ranked.css';
import { TourMarks } from '../tour/TourMarks';
import { useGameSounds } from '../../ui/useGameSounds';
import { InputStrip } from '../components/InputStrip';
import { Ledger } from '../components/Ledger';
import { TallyBoard } from '../components/TallyBoard';
import { Ice } from '../kit';
import { Corner, Dialog, IconSlab, Scrim, Slab } from '../kit/modern';
import './game-hud.css';
import { TwistSign } from '../components/TwistSign';
import { LedgerRow } from '../components/Ledger';
import { Podium } from '../table/Podium';
import type { PodiumEntry } from '../table/Podium';
import { useCoveredFps } from '../perf/governor';
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
import { turnClock } from '../model/turnClock';
import { streakDays, useTableView } from '../model/useTableView';
import { BarnTable } from '../table/BarnTable';
import type { BarnMoments } from '../table/BarnTable';
import { DevLine } from '../table/DevStats';
// The rink (docs/trading-post-practice P1) loads with a practice run, behind the loading screen.
const PracticeRink = lazy(() => import('../tp/rink/PracticeRink').then((m) => ({ default: m.PracticeRink })));
import { NamePlate } from '../kit/NamePlate';
import { PlaceExtras } from '../table/places';
import { coatLevel } from '../table/Sheep';
import type { SheepState } from '../table/Sheep';
import { PAINTED_GAME_TITLE } from '../../config';

interface Fx { id: number; node: ReactNode }
/**
 * The end of a game, in ms (Brian, 2026-11-13: "some sort of a animation that transitions between the end of the game
 * and the win screen. rn its too abrupt"). The win screen used to take the table the instant the last bomb went off,
 * so the bang and the freeze were never seen. Now the table plays them out (`bang`), then turns to the winner, who
 * is named and has a moment (`winner`), and only then does the screen change, behind the loading doors' short dark fade.
 */
const FINALE = { bang: AFTERMATH_MS, winner: 2400 };
/** How long before a fuse is lit, in the beat after a bomb, the table turns to the sheep that is up next, in ms: the camera's swing. */
const PREROLL_MS = 650;
/** How long a practice run's end board waits for a worn Trading Post act to be seen, in ms. */
const ACT_WATCH_MS = 1900;
/** The rules a word can be seen to break while it is still being typed. */
const LIVE_RULES = new Set(['no_e', 'no_a', 'no_s', 'five_max']);
const BADGE = { easy: <SeedlingIcon size={12} />, medium: <LeafIcon size={12} />, hard: <AcornIcon size={12} /> } as const;
interface Mood { state: SheepState; key: number }

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
  // Walking out of a ranked game is a loss; the leave dialog says so.
  const rankedRoom = useRoomStore((s) => !!s.room?.ranked);
  const quit = useStore((s) => s.quit);
  const dict = useStore((s) => s.dict);
  // The store's clock moves every frame and is never selected here (plan file 17, change 11): this screen renders when
  // something it shows changes. What follows the clock frame by frame reads it as it draws (model/turnClock.ts).
  const mobile = usePhoneLayout();
  const reduced = useMotionLevel() === 'reduced';
  const deviceHour = useHour();
  const [moods, setMoods] = useState<Record<number, Mood>>({});
  const [moments, setMoments] = useState<BarnMoments>({});
  const [fx, setFx] = useState<Fx[]>([]);
  const [sheet, setSheet] = useState<'cheat' | 'chain' | 'chat' | 'leave' | null>(null);
  const [alarm, pushAlarm, clearAlarms] = useAlarms(mobile ? 2600 : 3000);
  // Announcements waiting for the bang that ended a round to play out (cleared with the alarms).
  const alarmWaits = useRef<number[]>([]);
  useEffect(() => () => alarmWaits.current.forEach((id) => window.clearTimeout(id)), []);
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
  // The round's rule, said beside the letter all round long (Brian, 2026-11-23: "make it clearer what event is in play.
  // after the popup, people kind of just forget about it"). Rules a word breaks as it is typed (a letter it must not
  // have, too long) show red at once; the rest are checked when it is played, as before.
  const twistNow = view.twist && view.twist !== 'vowelDouble' && ALL_MODIFIERS.includes(game.modifier) ? view.twist : null;
  const typedNow = normalizeWord(input.typed);
  const roundRule = twistNow ? {
    text: TWIST_TEXT[twistNow],
    broken: !!typedNow && LIVE_RULES.has(game.modifier) && breaksRule(typedNow, game.modifier) !== null,
  } : undefined;
  // A practice run has its own place: the two of you, out on the ice.
  const Stage = BarnTable;
  const dreamWaiting = useDreamWaiting();
  // Wool balls are lives: every sheep shows them, with an empty ring for each one lost.
  const maxLives = startingWool(game.settings);
  const k = () => Math.random();
  const rootRef = useRef<HTMLDivElement>(null);
  const [hit, setHit] = useState(0);
  const [boom, setBoom] = useState(0);
  const [blast, setBlast] = useState<{ key: number; words: string[]; power: number; glow?: string } | null>(null);
  // A worn Trading Post burst that is not an explosion (a haystack, an aurora): the screen does not flash, crack and
  // shake as for the ice blast; it glows at its edges in the burst's colour. Read through a ref by the event handler.
  const wornBurst = useWallet().equipped.blast;
  const softGlow = useRef<string | undefined>(undefined);
  softGlow.current = burstExplodes(wornBurst) ? undefined : BLAST_PALETTE[wornBurst]?.flame[2];
  // A practice run ends on the bang, and its board comes down over the very spot. A worn act is watched first: the
  // board waits ACT_WATCH_MS for it (not for the frost blast, not under reduced motion, not for the admin's end preview).
  const overAt = useRef<number | null>(null);
  if (game.phase !== 'gameOver') overAt.current = null; else if (overAt.current === null) overAt.current = performance.now();
  const watchingAct = storeMode === 'practice' && !reduced && softGlow.current !== undefined && !String(game.seed).startsWith('preview:')
    && overAt.current !== null && performance.now() - overAt.current < ACT_WATCH_MS;
  const [, afterAct] = useState(0);
  useEffect(() => {
    if (!watchingAct) return;
    const t = setTimeout(() => afterAct((v) => v + 1), ACT_WATCH_MS);
    return () => clearTimeout(t);
  }, [watchingAct]);
  // The game is paid for the moment it ends: its board (which shows the payment) only comes up after the finale or
  // the act, and a player who left in between got nothing.
  useEffect(() => {
    if (game.phase !== 'gameOver') return;
    if (storeMode === 'quick') payEarly(`quick:${game.seed}`, quickReward(game, mySeat));
    if (storeMode === 'practice') payEarly(`practice:${game.seed}`, practiceReward(game, useStore.getState().practiceResult?.score ?? game.players[0].wordsPlayed));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.phase === 'gameOver', game.seed]);
  // The finale (see FINALE): 'bang', then 'winner', then 'results', the win screen. A game that was already over
  // when this screen came up (a room joined late, the admin's end preview), a practice run and reduced motion go
  // straight to the results.
  const over = game.phase === 'gameOver';
  const sawItEnd = useRef(!over);
  if (!over) sawItEnd.current = true;
  const [finale, setFinale] = useState<'none' | 'bang' | 'winner' | 'results'>('none');
  useEffect(() => {
    if (!over) { setFinale('none'); return; }
    if (storeMode === 'practice') return;
    if (reduced || !sawItEnd.current || String(game.seed).startsWith('preview:')) { setFinale('results'); return; }
    setFinale('bang');
    let unhook = () => {};
    const toWinner = setTimeout(() => setFinale('winner'), FINALE.bang);
    const toResults = setTimeout(() => {
      playBarnDoors({ label: 'Counting the wool', quick: true });
      unhook = whenDoorsShut(() => setFinale('results'));
    }, FINALE.bang + FINALE.winner);
    return () => { clearTimeout(toWinner); clearTimeout(toResults); unhook(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [over, storeMode, reduced]);
  // Under the results the podium covers the table whole: once the podium has drawn, the table stops drawing.
  const tableFps = useCoveredFps(over && finale === 'results', 'podium');
  // The bomb swells with every word played since it last went off, more for a long word.
  const bombSz = useMemo(() => bombSize(wordsSinceBoom(game.history)), [game.history.length]); // eslint-disable-line react-hooks/exhaustive-deps
  /** A blast: the whole table jolts and a frosty edge flashes (neither under reduced motion). */
  const jolt = (px = 9, punch = 1, frost = true) => {
    if (reduced) return;
    if (frost) setHit(Math.random() + 1);
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
  const mood = (seat: string | number, state: SheepState) =>
    setMoods((m) => ({ ...m, [Number(seat)]: { state, key: k() } }));

  // The winner's moment, once the last bang has played out: the table turns to them (see `upNext` below), a gold
  // board names them, they hop, and the fanfare plays.
  useEffect(() => {
    const won = game.winners ?? [];
    if (finale !== 'winner' || !won.length) return;
    for (const w of won) mood(w, 'happy');
    playSound('fanfare');
    flash(
      <Notice tone="gold" size="lg" className="sk-turn-call" title={won.includes(mySeat) ? 'You win!' : won.length > 1 ? 'A tie!' : `${name(String(won[0]))} wins!`} sub="last sheep standing" />,
      FINALE.winner,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finale]);

  // A lost turn dims a card until the next turn starts.
  useEffect(() => setDimmed(new Set()), [game.turn?.seat]);

  // The beat after a bomb has gone off (the engine lights the next fuse AFTERMATH_MS later): first the sheep it went
  // off beside is dazed and the table watches it, then, PREROLL_MS before the fuse is lit, the table turns to the
  // sheep that is up next, so the camera has arrived and the turn has been called when its clock starts.
  const [boomSeat, setBoomSeat] = useState<number | null>(null);
  // Which part of that beat the clock is in, and no more of the clock than that: 'dazed' until PREROLL_MS before the
  // fuse is lit, then 'next', then 'lit' (and 'lit' whenever no fuse is waiting).
  const beat = useStore((s) => {
    const untilLit = s.game?.turn && s.game.phase === 'playing' ? s.game.turn.startedAt - s.now : 0;
    return untilLit > PREROLL_MS ? 'dazed' : untilLit > 0 ? 'next' : 'lit';
  });
  const dazedSeat = beat === 'dazed' && boomSeat !== null && !game.players[boomSeat]?.frozen ? boomSeat : null;
  const upNextSeat = beat === 'next' && game.turn ? game.turn.seat : null;
  // The seat whose fuse is lit: none in that beat, and none between rounds.
  const litSeat = game.turn && game.phase === 'playing' && beat === 'lit' ? game.turn.seat : undefined;

  // Every change of the floor is called out: as the camera swings to the new speaker a board over the table names
  // whose turn it is (gold for yours), so the swing never leaves you guessing who is on. The tour has its own cards.
  const turnSeat = litSeat ?? upNextSeat ?? undefined;
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
    if (litSeat === undefined || reduced) return;
    const id = setTimeout(() => setMoods((m) => {
      const now = m[litSeat]?.state;
      if (now === 'cold' || now === 'freezing' || now === 'frozen' || now === 'thawing') return m;
      return { ...m, [litSeat]: { state: 'startled', key: k() } };
    }), BOMB_TOSS_S * 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [litSeat, turnStartedAt]);

  // A played word lands with a stamp: big gold letters, a burst of light and a puff of wool tufts.
  const burst = (word: string, by: string, mine: boolean) => {
    const tufts = Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2 + Math.random() * 0.5, d = 70 + Math.random() * 50;
      return <span key={i} className="sk-word-burst-tuft" style={{ '--dx': `${Math.cos(a) * d}px`, '--dy': `${Math.sin(a) * d * 0.6}px` } as React.CSSProperties} />;
    });
    const size = Math.min(64, Math.max(34, 520 / Math.max(6, word.length)));
    flash(
      <div className={`sk-word-burst ${mine ? 'sk-word-burst-mine' : ''}`} data-rare={/[xzqj]/i.test(word) || undefined}>
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
        if (!practice) burst(e.word, name(e.playerId), Number(e.playerId) === mySeat); // on the rink the bubble and the board say it
        // Your word lands with a crunch (it breaks the frost) and, on a phone, a tiny buzz.
        if (Number(e.playerId) === mySeat) { playSound('crunch'); buzz(12); }
        break;
      case 'passed':
        mood(e.playerId, 'happy');
        flash(<Notice tone="wood" size="sm" snow={false} icon={<MiniBomb size={22} />} title="Bomb passed!" sub={e.toId ? `${name(e.playerId)} handed it to ${name(e.toId)}` : undefined} />, 1400);
        break;
      case 'timedOut':
        setDimmed((d) => new Set(d).add(Number(e.playerId)));
        if (Number(e.playerId) === mySeat) buzz([60, 40, 120]);
        // Every time-out blows the bomb up, learning games included.
        {
          // Everything said since the bomb last went off comes out and goes up with it; a bigger bomb is a bigger blast.
          const words = wordsSinceBoom(useStore.getState().game?.history ?? [], true);
          const power = bombSize(words);
          const glow = softGlow.current;
          // On the rink the worn burst, the coach's whistles and a 6 px shake are the bang (P3 section 7).
          if (!practice) {
            if (glow) jolt(8, 1, false); else { jolt(70 + 34 * power, 1.25 + 0.12 * power); setBoom(k() + 1); }
            setBlast({ key: k() + 1, words: words.slice(-14), power, glow });
          }
          setMoments((m) => ({ ...m, boom: { key: k(), at: rel(Number(e.playerId)), power } }));
        }
        // The sheep it went off beside is dazed for the table's beat (a sheep that froze is busy freezing instead).
        setBoomSeat(Number(e.playerId));
        mood(e.playerId, 'dazed');
        if (game.players[Number(e.playerId)]?.isHuman && storeMode === 'tour') {
          flash(<Notice tone="cold" icon={<GustIcon size={22} />} title="BOOM! Time’s up!" sub="no wool lost while you practise" />, 1500);
          break; // learning: no loss
        }
        setMoments((m) => ({ ...m, gust: { key: k(), at: rel(Number(e.playerId)) } }));
        if (!practice) flash(
          <Notice tone="cold" icon={<GustIcon size={22} />} title="BOOM! Time’s up!"
            sub={`${name(e.playerId)} lost a wool ball`} />,
          1500,
        );
        break;
      case 'frozen':
        mood(e.playerId, 'freezing');
        setMoments((m) => ({ ...m, freeze: { key: k(), at: rel(Number(e.playerId)) } }));
        if (!practice) flash(<Notice tone="ice" size="lg" icon={<SnowflakeIcon size={26} />} title={`${name(e.playerId)} is frozen solid!`} sub="out of wool, out of the game" />, 2000);
        break;
      case 'thawed':
        mood(e.playerId, 'thawing');
        break;
      case 'roundStart':
        // The round's alarms, one after the other: faster turns (every round until the floor), then the twist.
        // Each is up for ANNOUNCE_MS, starting once the bomb that ended the round has gone off; the engine holds the
        // first fuse until they are done (Brian, 2026-11-23: the popup must "actually stall the timer").
        if (e.round > 1 && storeMode !== 'tour') {
          const announce = () => {
            if (e.faster) pushAlarm({ tone: 'speed', label: `Round ${e.round}: faster`, title: `${e.turnSeconds}-second turns`, sub: 'the clock is shorter from here on', ms: ANNOUNCE_MS });
            if (e.twist && e.twist !== 'vowelDouble') pushAlarm({ tone: 'twist', label: `Round ${e.round}: new rule`, title: TWIST_TEXT[e.twist], sub: 'for this round only', ms: ANNOUNCE_MS });
          };
          if (e.delayMs > 0) alarmWaits.current.push(window.setTimeout(announce, e.delayMs)); else announce();
        }
        break;
      case 'chainReset':
        // A fresh letter (two sheep in a row ran out on one): said once the bang has been seen.
        if (!practice && storeMode !== 'tour') {
          window.setTimeout(() => flash(<Notice tone="wood" size="sm" snow={false} icon={<MiniBomb size={22} />} title={`New letter: ${e.letter.toUpperCase()}`} sub={e.why} />, 2400), 700);
        }
        break;
      case 'gameEnd':
        alarmWaits.current.forEach((id) => window.clearTimeout(id));
        alarmWaits.current = [];
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
  // Where the script has got to is asked of the clock by two selectors: they answer every frame, and the screen
  // renders only when an answer changes (a key, a wipe, the shake starting or stopping).
  const typing = botScript && turn && !game.players[turn.seat].isHuman ? botScript : null;
  const botTyped = useStore((s) => {
    const botElapsed = typing ? s.now - typing.from : -1;
    return botElapsed >= 0 ? keystrokeAt(typing!.script, botElapsed)?.text ?? '' : '';
  });
  // A bounced try shakes the tag red for a beat, outliving the wipe that follows it.
  const botReject = useStore((s) => {
    const botElapsed = typing ? s.now - typing.from : -1;
    const botRejectKey = botElapsed >= 0 ? lastRejectAt(typing!.script, botElapsed) : null;
    return !!botRejectKey && botElapsed - botRejectKey.at < 380;
  });
  // The table settles in as the loading screen lifts, not behind it, where its move was never seen.
  const [revealed, setRevealed] = useState(false);
  useEffect(() => whenDoorsOpen(() => setRevealed(true)), []);
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
    <div ref={rootRef} className={`${revealed ? 'sk-settle-in' : ''} relative flex h-full flex-col overflow-hidden`}>
      {boom > 0 && <div key={boom} className="sk-boom" aria-hidden="true"><i /><i /><i /></div>}
      {/* Frost creeps in from the screen's edges in the last three seconds of a turn (not on the ice, which has its own red edge). */}
      {!practice && game.turn && game.phase === 'playing' && view.secondsLeft <= 3 && <Frost />}
      {blast && !reduced && <Jumpscare key={`j${blast.key}`} power={blast.power} glow={blast.glow} />}
      {blast && !reduced && <WordBlast key={`w${blast.key}`} words={blast.words} power={blast.power} />}
      {hit > 0 && <div key={hit} className="sk-hit-flash" aria-hidden="true" />}
      <div className={`absolute inset-0 ${shake ? 'sk-alarm-shake' : ''}`} data-table>
        {practice ? (
          // Practice's own place (docs/trading-post-practice P1 to P4): the rink, its board, its coach and its report.
          <Suspense fallback={null}><PracticeRink input={input} reduced={reduced} phone={mobile} fps={tableFps} boomKey={moments.boom?.key} dreamWaiting={dreamWaiting}
            states={[0, 1].map((seat) => stateOf(view.players.find((p) => Number(p.id) === seat)!)) as [Mood, Mood]} /></Suspense>
        ) : (
        <Stage
          fps={tableFps}
          bombSize={bombSz} pile={view.pile} speaker={speaker} dazed={dazedSeat === null ? null : rel(dazedSeat)}
          upNext={finale === 'winner' && game.winners?.length ? rel(game.winners[0]) : upNextSeat === null ? null : rel(upNextSeat)}
          // The clock as of this render, to the whole second: the bomb reads the running clock itself as it draws.
          fraction={view.turnSeconds ? view.secondsLeft / view.turnSeconds : 0}
          secondsLeft={game.turn ? view.secondsLeft : null} letter={view.letter ?? ''} isTrap={view.isTrapLetter}
          hour={hour} reduced={reduced} phone={mobile} blizzard={view.twist === 'doublePointsShort'} moments={moments}
          seats={view.players.map((p) => {
            const st = stateOf(p);
            return {
              seat: Number(p.id), index: rel(Number(p.id)), level: coatLevel(p.lives, maxLives), state: st.state, stateKey: st.key,
              dimmed: p.dimmed, scarf: winners.has(Number(p.id)) && winners.size === 1, thinking: p.id === view.currentPlayerId && !p.isYou, avatar: avatarOf(p),
              // Over each head: the name tag every place shares (kit/NamePlate: yours lantern, the speaker's barn red)
              // and, while a sheep speaks or you type ahead, a speech bubble with the word as it is typed.
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
                        )) : <span className="sk-say-ph">{`a word with ${L.toUpperCase()}…`}</span>}
                        {speaking && <i className="sk-say-caret" aria-hidden="true" />}
                      </div>
                    )}
                    <NamePlate
                      tokens name={p.name} you={p.isYou} turn={speaking} frozen={p.frozen} className="sk-seat-plate"
                      // Online, a filled seat is not marked (Brian, 2026-11-14: "dont say they are bots"); offline you chose the bots.
                      lead={p.difficulty && !room ? <span className="np-badge" role="img" aria-label={`${p.difficulty} bot`}>{BADGE[p.difficulty]}</span> : undefined}
                      lives={{ left: p.lives, max: maxLives }}
                      over={p.frozen ? <Ice /> : undefined}
                    />
                  </div>
                );
              })(),
            };
          })}
        >
          <PlaceExtras mode={view.mode} reduced={reduced} streak={view.streakDays} />
          {storeMode === 'tour' && <TourMarks speaker={speaker} n={n} />}
        </Stage>
        )}
      </div>

      {/* A soft vignette holds the eye on the pile (plan V3.2 Part 2). */}
      {!practice && (
        <div className="pointer-events-none absolute inset-0 z-[5]" style={{ background: 'radial-gradient(ellipse at center, transparent 58%, rgba(59, 48, 40, 0.28) 100%)' }} aria-hidden="true" />
      )}

      {/* Top row: round and twist (left), controls (right). The letter and the clock live in the scene. Clear of a notch
          (plan file 14, change 5): every inset is 0 on a computer, so nothing moves there. */}
      <header className="pointer-events-none relative z-40 flex items-start justify-between gap-2 p-2 pt-[max(8px,env(safe-area-inset-top))] pr-[max(8px,env(safe-area-inset-right))] pl-[max(8px,env(safe-area-inset-left))]">
        <div className="flex flex-col items-start gap-1">
          {practice ? null : (
            <div className="sk-hud-tab sk-hud-card hm rc">
              <span className="sk-hud-round">{game.phase === 'gameOver'
                ? <span className="sk-hud-big">Game over after {view.round} round{view.round === 1 ? '' : 's'}</span>
                : <>
                  <span className="sk-hud-big">Round <b>{view.round}</b></span>
                  <span className="sk-hud-small">{`${game.players.filter((p) => !p.frozen).length} sheep left${mobile ? '' : game.turn ? `, ${Math.round((game.turn.endsAt - game.turn.startedAt) / 1000)} s turns` : view.turnSeconds ? `, ${Math.round(view.turnSeconds)} s turns` : ''}`}</span>
                </>}</span>
              <TwistSign twist={view.twist} state={signState} compact={mobile} />
            </div>
          )}
        </div>
        {/* Home's corner: square wool slabs (Brian, 2026-11-23: the round wooden pegs were "outdated ui"). */}
        <Corner className="pointer-events-auto flex-wrap justify-end">
          <IconSlab onClick={() => setSheet('cheat')} aria-label="How to play" title="How to play"><BookIcon /></IconSlab>
          <IconSlab onClick={() => setSheet('chain')} aria-label="Chain history" title="Chain history"><ChainIcon /></IconSlab>
          {storeMode === 'room' && <IconSlab onClick={() => setSheet('chat')} aria-label="Room chat" title="Room chat"><ChatIcon /></IconSlab>}
          <SoundMenu />
          <IconSlab onClick={() => setSheet('leave')} aria-label="Leave game" title="Leave game"><CloseIcon /></IconSlab>
        </Corner>
      </header>

      {practice ? null : (
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
      {game.phase !== 'gameOver' && !practice && (
        <div className="relative z-20 mt-auto">
          <InputStrip
            letter={view.letter ?? ''} typed={input.typed} myTurn={input.myTurn}
            turnName={(view.currentPlayerId || view.nextPlayerId) === '' ? 'Next sheep' : name(view.currentPlayerId || view.nextPlayerId)}
            onChange={input.onChange} onSubmit={input.submit} acceptKey={input.acceptKey} out={!!game.players[mySeat]?.frozen}
            message={input.message} turnKey={game.turn?.seat}
            rule={roundRule}
            onPass={storeMode !== 'tour' && !practice && game.players[mySeat]?.passedRound !== game.round ? () => void useStore.getState().act({ type: 'pass', seat: mySeat }) : undefined}
            hints={input.learning ? { ideas: input.ideas, onHint: input.hintIdeas, onPick: input.useIdea } : undefined}
          />
        </div>
      )}

      {/* Coach tips only while a turn is running: never over the round tally or the end board. */}
      {storeMode === 'tour' ? <PaintedTour /> : <div className={game.phase === 'playing' ? '' : 'hidden'}><GameTips /></div>}
      {game.phase === 'gameOver' && (practice ? null : finale === 'results' && (
        <Results players={ranked} podium={ranked.map((p, i) => ({ key: p.id, name: p.name, place: i + 1, avatar: avatarOf(p), level: coatLevel(Math.max(p.lives, 1), maxLives), isYou: p.isYou }))} />
      ))}
      {sheet && sheet !== 'leave' && (
        <Sheet title={{ cheat: 'How to play', chain: 'Chain history', chat: 'Room chat' }[sheet]} onClose={() => setSheet(null)}>
          {sheet === 'cheat' && <RulesCard />}
          {sheet === 'chain' && <ChainList game={game} />}
          {sheet === 'chat' && <div className="sk-chat-card rc-well"><ChatPanel height="h-56" compact /></div>}
        </Sheet>
      )}
      {sheet === 'leave' && (
        <Scrim onClose={() => setSheet(null)}>
          <Dialog label="Leave game" title="Leave this table?" className="sk-leave" onClick={(e) => e.stopPropagation()}>
            <p>{storeMode === 'daily' ? 'Your daily attempt is used.' : rankedRoom ? 'Leaving a ranked game counts as a loss: you are placed as if you had just frozen. A farm sheep takes your seat.' : 'This game will end.'}</p>
            <div className="md-row">
              <Slab tone="lantern" autoFocus onClick={() => setSheet(null)}>Stay</Slab>
              <Slab onClick={quit}>Leave</Slab>
            </div>
          </Dialog>
        </Scrim>
      )}
      <DevLine />
    </div>
  );
}

/** How far the frost has crept in, 0 to 1 as a CSS number: nothing with three seconds left, all the way at none. */
const frostDepth = (secondsLeft: number) => String(Math.min(1, Math.max(0, (3 - secondsLeft) / 3)));

/**
 * The frost round the screen's edges. The table mounts it for a turn's last three seconds; how deep it lies follows
 * the store's clock on every frame, written straight onto the element by a store listener, so nothing renders for it.
 */
function Frost() {
  const el = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => useStore.subscribe(() => {
    const { secondsLeft } = turnClock();
    if (secondsLeft !== null) el.current?.style.setProperty('--frost', frostDepth(secondsLeft));
  }), []);
  return (
    <div ref={el} className="sk-frost" aria-hidden="true" style={{ '--frost': frostDepth(turnClock().secondsLeft ?? 0) } as React.CSSProperties}>
      <Ice className="sk-frost-t" /><Ice className="sk-frost-b" /><Ice className="sk-frost-l" /><Ice className="sk-frost-r" />
    </div>
  );
}

/** A clipboard for the rules, the chain and the chat (V6 Part 6.2): paper under a brass clip on a light board. */
function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    // Laid over the part of the screen that can be seen (--vvtop, --vvh: the visual viewport, which the keyboard
    // shortens), so with the keyboard up the sheet stands above it, not behind it (plan file 14, change 4).
    <div className="fixed inset-x-0 z-50 flex items-end justify-center p-3 sm:items-center" style={{ top: 'var(--vvtop, 0px)', height: 'var(--vvh, 100dvh)', background: 'color-mix(in srgb, var(--ink) 45%, transparent)' }} onClick={onClose}>
      <Dialog title={title} onClose={onClose} className="sk-table-sheet" onClick={(e) => e.stopPropagation()}>
        {children}
      </Dialog>
    </div>
  );
}

const DREAM_LINE = 'Tonight’s dream is still waiting: Counting Sheep, on the farm.';
/** Read once: the table renders often and this reads storage. */
const useDreamWaiting = () => useMemo(() => !getDream(localDateKey(new Date())), []);

/** What a finished game earns in the Trading Post (shop/economy.ts): the same for the early payment and for the board that shows it. */
const wordsOf = (game: GameState, seat: number) => game.history.filter((h) => h.seat === seat && h.kind === 'play' && h.word).map((h) => h.word!);
const quickReward = (game: GameState, seat: number): GameReward => ({ mode: 'quick', won: !!game.winners?.includes(seat), words: wordsOf(game, seat) });
const practiceReward = (game: GameState, score: number): GameReward => ({ mode: 'practice', score, words: wordsOf(game, 0) });

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
  const phone = usePhoneLayout();
  // Read once: the table renders often and this reads storage.
  const days = useMemo(() => (mode === 'daily' ? streakDays(new Date(`${dailyDate ?? utcDateKey(new Date())}T12:00:00Z`)) : []), [mode, dailyDate]);
  const result = useStore((s) => s.gameResult);
  const dreamWaiting = useDreamWaiting();
  const me = game.players[mySeat];
  // Wool Coins for a finished Quick Game (not rooms, the daily or the tutorial), paid once.
  const payout = usePayout(mode === 'quick' ? `quick:${game.seed}` : null, quickReward(game, mySeat));
  const tiles: [string, number, number | undefined, boolean | undefined][] = [
    ['Wool kept', me.lives, result?.bests.wool, result?.beat.wool],
  ];

  const place = players.findIndex((p) => p.isYou) + 1;
  const share = async () => {
    const text = [
      `${PAINTED_GAME_TITLE}${mode === 'daily' && dailyDate ? `: Daily ${dailyDate}` : ''}`,
      place === 1 ? `Last sheep standing out of ${game.players.length}!` : `Lasted to #${place} of ${game.players.length}`,
      `Longest word: ${me.longestWord.length} letters`,
      mode === 'daily' && streak > 1 ? `${streak}-day streak` : '',
      `${location.origin}${import.meta.env.BASE_URL}`,
    ].filter(Boolean).join('\n');
    await shareCard({
      title: PAINTED_GAME_TITLE,
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
        <span className="sk-final-show hm rc"><Slab size="sm" onClick={() => setHidden(false)}>Show the scoreboard</Slab></span>
      )}
      {stats && !hidden && (
        <div className="sk-final-wrap">
          {/* The scoreboard: the modern kit's dialog (Brian, 2026-11-23: the dashed see-through box was outdated). */}
          <Dialog label="Game over" className="sk-final" onClose={() => setHidden(true)} closeLabel="Hide the scoreboard"
            title={(() => { const w = players.find((p) => game.winners?.map(String).includes(p.id)) ?? players[0]; return w.isYou ? 'You are the last sheep standing!' : `${w.name} is the last sheep standing!`; })()}>
            <ol className="sk-final-rows">
              {players.map((p, i) => <LedgerRow key={p.id} player={p} place={i + 1} maxLives={startingWool(game.settings)} ringed={game.winners?.map(String).includes(p.id)} />)}
            </ol>
            <p className="sk-final-note">{place === 1 ? 'You outlasted everyone. The knitted scarf is yours.' : `You lasted to #${place} of ${game.players.length}. The last sheep standing gets the knitted scarf.`}</p>
            {mode === 'room' && <RatedSlip />}
            {dreamWaiting && <p className="sk-final-note">{DREAM_LINE}</p>}
            <div className="sk-final-stats">
              {tiles.map(([key, v, best, beat]) => (
                <div key={key} className="sk-final-stat rc-tile" data-beat={beat || undefined}>
                  <b>{v}</b><span>{key}{best !== undefined ? `, ${beat ? 'new best!' : `best ${best}`}` : ''}</span>
                </div>
              ))}
              <div className="sk-final-stat rc-tile" data-beat={result?.beat.longest || undefined}>
                <b>{me.longestWord ? me.longestWord.toUpperCase() : '–'}</b>
                <span>Longest word{result?.bests.longest ? `, ${result.beat.longest ? 'new best!' : `best ${result.bests.longest.toUpperCase()}`}` : ''}</span>
              </div>
            </div>
            {payout && <PayoutLines payout={payout} className="sk-final-note" />}
            {mode === 'room' && <RewardBanner />}
            {mode === 'daily' && (
              <div className="sk-final-streak" aria-label={`Daily streak: ${days.filter(Boolean).length} of the last 7 days played`}>
                <span className="sk-final-days" aria-hidden="true">{days.map((on, i) => <i key={i} data-on={on || undefined} data-today={i === days.length - 1 || undefined} />)}</span>
                <span>Daily streak: <b>{streak}</b></span>
              </div>
            )}
            <div className="md-stack sk-final-actions">
              {mode === 'quick' && <Slab tone="lantern" onClick={rematch}>Same table again</Slab>}
              <div className="md-row">
                <Slab onClick={share}>{copied ? 'Copied!' : 'Share'}</Slab>
                <Slab onClick={quit}>{mode === 'room' ? 'Leave room' : 'Back to the farm'}</Slab>
              </div>
            </div>
          </Dialog>
        </div>
      )}
    </>
  );
}

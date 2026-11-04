import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { rankPlayers, summarize, utcDateKey } from '../../engine';
import { buildShareText } from '../../lib/share';
import { useStore } from '../../state/store';
import { ChatPanel } from '../../ui/ChatPanel';
import { CoachTips } from '../../ui/CoachTips';
import { useGameLoop, useIsMobile } from '../../ui/hooks';
import { ChainHistory } from '../../ui/Panels';
import { ScoringTable } from '../../ui/ScoringTable';
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
import { useHour, useMotionLevel } from '../hooks/useAmbient';
import { useWordInput } from '../hooks/useWordInput';
import { useVisualEvents } from '../model/events';
import type { VisualEvent } from '../model/events';
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
  const game = useStore((s) => s.game)!;
  const mySeat = useStore((s) => s.mySeat);
  const storeMode = useStore((s) => s.mode);
  const muted = useStore((s) => s.muted);
  const toggleMute = useStore((s) => s.toggleMute);
  const quit = useStore((s) => s.quit);
  const mobile = useIsMobile();
  const reduced = useMotionLevel() === 'reduced';
  const deviceHour = useHour();
  const [moods, setMoods] = useState<Record<number, Mood>>({});
  // Failed steals this game, per seat: each one shears a coat level (plan V3.2 Part 6).
  const [shears, setShears] = useState<Record<number, number>>({});
  const [moments, setMoments] = useState<BarnMoments>({});
  const [fx, setFx] = useState<Fx[]>([]);
  const [sheet, setSheet] = useState<'cheat' | 'chain' | 'chat' | 'leave' | null>(null);
  // Rooms play in the big barn at night.
  const hour = storeMode === 'room' ? 'night' : deviceHour;
  const n = game.players.length;
  const rel = (seat: number) => (seat - mySeat + n) % n;
  const name = (id: string) => game.players[Number(id)]?.name ?? '';
  const practice = storeMode === 'practice';
  const k = () => Math.random();

  const flash = (node: ReactNode, ms = 900) => {
    const id = Math.random();
    setFx((list) => [...list.slice(-5), { id, node }]);
    setTimeout(() => setFx((list) => list.filter((f) => f.id !== id)), ms);
  };
  const mood = (seat: string | number, state: SheepState, coldFor?: number) =>
    setMoods((m) => ({ ...m, [Number(seat)]: { state, key: k(), coldFor } }));

  // A lost turn or failed steal dims a card until the next turn starts.
  useEffect(() => setDimmed(new Set()), [game.turn?.seat]);

  useVisualEvents((e: VisualEvent) => {
    switch (e.type) {
      case 'accepted':
        setMoments((m) => ({ ...m, tuftIn: { key: k(), from: rel(Number(e.playerId)) } }));
        if (e.word.length >= 8) mood(e.playerId, 'proud');
        flash(<span className="sk-chip sk-rise sk-display">{e.word.toUpperCase()} +{e.points}</span>, 1000);
        break;
      case 'banked':
        mood(e.playerId, 'happy');
        if (e.amount > 0) {
          setMoments((m) => ({ ...m, tuftOut: { key: k(), to: rel(Number(e.playerId)) } }));
          flash(<span className="sk-chip sk-rise sk-display text-lg">{name(e.playerId)} banked {e.amount}</span>, 1100);
        }
        break;
      case 'stole':
        mood(e.fromId, 'startled');
        setMoments((m) => ({ ...m, wolf: { key: k(), to: rel(Number(e.byId)) } }));
        setDimmed((d) => new Set(d).add(Number(e.fromId)));
        flash(<span className="sk-chip sk-rise sk-display text-lg" style={{ color: 'var(--coral-dark)' }}>{name(e.byId)} stole {e.amount} with {e.word.toUpperCase()}!</span>, 1300);
        break;
      case 'stealFailed':
        mood(e.playerId, 'cold', 3);
        setShears((m) => ({ ...m, [Number(e.playerId)]: (m[Number(e.playerId)] ?? 0) + 1 }));
        setMoments((m) => ({ ...m, shears: { key: k(), at: rel(Number(e.playerId)) } }));
        setDimmed((d) => new Set(d).add(Number(e.playerId)));
        flash(<span className="sk-chip sk-rise" style={{ color: 'var(--coral-dark)' }}>{name(e.playerId)}’s steal failed{e.lost ? ` −${e.lost}` : ''}</span>, 800);
        break;
      case 'timedOut':
        setDimmed((d) => new Set(d).add(Number(e.playerId)));
        if (practice || storeMode === 'tour') break; // no penalty, no penalty visual
        mood(e.playerId, 'cold', 2);
        setMoments((m) => ({ ...m, gust: { key: k(), at: rel(Number(e.playerId)) } }));
        flash(
          <div className="flex flex-col items-center gap-1">
            <span className="sk-chip sk-fall" style={{ color: 'var(--coral-dark)' }}>🌬️ {name(e.playerId)} −5</span>
            {e.trapperId && <span className="sk-chip sk-rise">{name(e.trapperId)} +5 (trap)</span>}
          </div>,
          900,
        );
        break;
      case 'frozen':
        mood(e.playerId, 'freezing');
        setMoments((m) => ({ ...m, freeze: { key: k() } }));
        break;
      case 'thawed':
        mood(e.playerId, 'thawing');
        break;
      default:
        break;
    }
  });

  // A new game starts with no leftover moods except the thaw the events just set, and a fresh coat.
  useEffect(() => {
    setMoods((m) => Object.fromEntries(Object.entries(m).filter(([, v]) => v.state === 'thawing')));
    setShears({});
  }, [game.seed]);

  const speaker = view.currentPlayerId === '' ? null : rel(Number(view.currentPlayerId));
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
    <div className="relative flex h-full flex-col overflow-hidden" data-steal-open={view.stealOpen}>
      <div className="absolute inset-0" data-table>
        <BarnTable
          pile={view.pile} speaker={speaker} fraction={view.turnSeconds ? view.secondsLeft / view.turnSeconds : 0}
          secondsLeft={game.turn ? view.secondsLeft : null} letter={view.letter ?? ''} isTrap={view.isTrapLetter}
          stealOpen={view.stealOpen} hour={hour} reduced={reduced} phone={mobile} blizzard={view.twist === 'doublePointsShort'} moments={moments}
          seats={view.players.map((p) => {
            const st = stateOf(p);
            return {
              seat: Number(p.id), index: rel(Number(p.id)), level: coatLevel(p.banked, shears[Number(p.id)] ?? 0), state: st.state, stateKey: st.key, coldFor: st.coldFor,
              dimmed: p.dimmed, scarf: winners.has(Number(p.id)) && winners.size === 1,
              label: (
                <span className="sk-chip whitespace-nowrap text-xs" style={{ boxShadow: p.id === view.currentPlayerId ? '0 0 0 2px var(--amber)' : undefined }}>
                  {p.name}{p.isYou ? ' (you)' : ''}{!practice && <Lives lives={p.lives} size={10} />}
                </span>
              ),
            };
          })}
        >
          <PlaceExtras mode={view.mode} reduced={reduced} streak={view.mode === 'daily' ? streakDays() : undefined} />
        </BarnTable>
      </div>

      {/* A soft vignette holds the eye on the pile (plan V3.2 Part 2). */}
      <div className="pointer-events-none absolute inset-0 z-[5]" style={{ background: 'radial-gradient(ellipse at center, transparent 58%, rgba(59, 48, 40, 0.28) 100%)' }} aria-hidden="true" />

      {/* Top row: round and twist (left), controls (right). The letter and the clock live in the scene. */}
      <header className="pointer-events-none relative z-30 flex items-start justify-between gap-2 p-2">
        <div className="flex flex-col items-start gap-1">
          <span className="sk-chip sk-display">Round {view.round}/3 · turn {Math.min(5, view.turn)}/5</span>
          <TwistSign twist={view.twist} state={signState} compact={mobile} />
        </div>
        <div className="pointer-events-auto flex flex-wrap justify-end gap-1">
          <Chip onClick={() => setSheet('cheat')} aria-label="Scoring cheat sheet">📖</Chip>
          <Chip onClick={() => setSheet('chain')} aria-label="Chain history">🔗</Chip>
          {storeMode === 'room' && <Chip onClick={() => setSheet('chat')} aria-label="Room chat">💬</Chip>}
          <Chip onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'} aria-pressed={muted}>{muted ? '🔇' : '🔊'}</Chip>
          <Chip onClick={() => setSheet('leave')} aria-label="Leave game">✕</Chip>
        </div>
      </header>

      <aside className={mobile ? 'relative z-30 mt-14 flex gap-1 overflow-x-auto px-2' : 'relative z-30 ml-auto mr-2 mt-14 flex flex-col gap-1.5'} aria-label="Scoreboard">
        {ranked.map((p) => (
          <PlayerCard key={p.id} player={p} isTurn={p.id === view.currentPlayerId} compact={mobile} lastWord={game.players[Number(p.id)].lastWord} showLives={!practice} />
        ))}
      </aside>

      {/* Feedback words float over the middle of the table. */}
      <div className="pointer-events-none absolute inset-x-0 top-[34%] z-20 flex flex-col items-center gap-2" aria-hidden="true">
        {fx.map((f) => <div key={f.id}>{f.node}</div>)}
      </div>

      {showTally && (
        <div className="absolute inset-0 z-30 flex items-center justify-center p-4">
          <TallyBoard players={ranked} round={game.round - 1} isGameEnd={false} />
        </div>
      )}

      <div className="relative z-20 mt-auto">
        <InputStrip
          letter={view.letter ?? ''} typed={input.typed} myTurn={input.myTurn} stealOpen={input.canSteal}
          onChange={input.onChange} onPlay={input.submit} onBank={input.bank} onSteal={input.steal}
          pile={view.pile} message={input.message} turnKey={game.turn?.seat}
          hints={input.learning ? { ideas: input.ideas, onHint: input.hintIdeas, onPick: input.useIdea } : undefined}
        />
      </div>

      {storeMode === 'tour' ? <Tour /> : <CoachTips />}
      {game.phase === 'gameOver' && <Results players={ranked} />}
      {sheet && sheet !== 'leave' && (
        <Sheet title={{ cheat: 'Scoring cheat sheet', chain: 'Chain history', chat: 'Room chat' }[sheet]} onClose={() => setSheet(null)}>
          {sheet === 'cheat' && <ScoringTable />}
          {sheet === 'chain' && <ChainHistory game={game} />}
          {sheet === 'chat' && <ChatPanel height="h-56" compact />}
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

/** Classic panel content on the ink colour (it is written light-on-dark), in a painted frame. */
function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" style={{ background: 'color-mix(in srgb, var(--ink) 45%, transparent)' }} onClick={onClose}>
      <div
        role="dialog" aria-modal="true" aria-label={title}
        className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-t-2xl p-4 sm:rounded-2xl"
        style={{ background: 'var(--ink)', color: 'var(--button-text)', boxShadow: 'inset 0 4px 0 var(--wood-dark), var(--shadow-warm)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between">
          <h2 className="sk-display text-xl">{title}</h2>
          <Chip onClick={onClose} aria-label="Close">✕</Chip>
        </div>
        {children}
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
  const stats = summarize(game.players);
  const me = game.players[mySeat];
  const longest = stats.longestWord ? { word: stats.longestWord.word, playerId: String(stats.longestWord.seat) } : undefined;

  const share = async () => {
    const text = buildShareText({
      daily: mode === 'daily' ? dailyDate : null, rank: players.findIndex((p) => p.isYou) + 1, players: game.players.length,
      banked: me.banked, steals: me.steals, longest: me.longestWord.length, streak,
    });
    try { await navigator.clipboard.writeText(text); } catch { window.prompt('Copy your result:', text); }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center overflow-y-auto p-4 sm:items-center sm:inset-y-0 sm:justify-end">
      <TallyBoard
        players={players} round={3} isGameEnd winnerIds={game.winners?.map(String)} longestWord={longest}
        actions={
          <>
            {(mode === 'quick' || mode === 'practice') && <ClothButton onClick={rematch} className="flex-1">Play again</ClothButton>}
            <WoodButton onClick={share} className="flex-1">{copied ? 'Copied!' : 'Share'}</WoodButton>
            <WoodButton onClick={quit} className="flex-1">{mode === 'room' ? 'Leave room' : 'Back to the farm'}</WoodButton>
          </>
        }
      >
        <p className="sk-hand mt-1 text-center" style={{ color: 'var(--glow)' }}>The winner gets the knitted scarf and the spot by the lantern.</p>
        <dl className="mt-2 grid grid-cols-2 gap-1.5 text-sm">
          {[
            ['Words played', stats.wordsPlayed],
            ['Steals', stats.steals],
            ['Longest word', stats.longestWord ? `${stats.longestWord.word.toUpperCase()} (${game.players[stats.longestWord.seat].name})` : '—'],
            ['Best word', stats.bestWord ? `${stats.bestWord.word.toUpperCase()} · ${stats.bestWord.points}` : '—'],
          ].map(([key, v]) => (
            <div key={key as string} className="sk-paper px-2 py-1">
              <dt className="sk-hand" style={{ color: 'var(--ink-soft)' }}>{key}</dt>
              <dd className="truncate font-extrabold">{v}</dd>
            </div>
          ))}
        </dl>
        {mode === 'room' && <RewardBanner />}
        {mode === 'practice' && <p className="sk-hand mt-2 text-center" style={{ color: 'var(--glow)' }}>Practice game: no penalties were applied.</p>}
        {mode === 'daily' && (
          <div className="mt-2 text-center">
            <StreakString days={streakDays(new Date(`${dailyDate ?? utcDateKey(new Date())}T12:00:00Z`))} />
            <p className="sk-hand" style={{ color: 'var(--glow)' }}>Daily streak: {streak}</p>
          </div>
        )}
      </TallyBoard>
    </div>
  );
}

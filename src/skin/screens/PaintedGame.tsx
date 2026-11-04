import { useEffect, useRef, useState } from 'react';
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
import { Fox } from '../components/Fox';
import { InputStrip } from '../components/InputStrip';
import { Keeper } from '../components/Keeper';
import type { KeeperMood } from '../components/Keeper';
import { LetterTile } from '../components/LetterTile';
import { StreakString } from '../components/Lantern';
import { Chip, ClothButton, CoralButton, PaperPanel, WoodButton } from '../components/Materials';
import { Particles } from '../components/Particles';
import { PlayerCard } from '../components/PlayerCard';
import { Scene } from '../components/Scene';
import { Table3D } from '../components/Table3D';
import { TallyBoard } from '../components/TallyBoard';
import { TwistSign } from '../components/TwistSign';
import { useHour, useMotionLevel, useSeason } from '../hooks/useAmbient';
import { useWordInput } from '../hooks/useWordInput';
import { useVisualEvents } from '../model/events';
import type { VisualEvent } from '../model/events';
import { PLACE_FOR_MODE } from '../model/types';
import type { PlayerView, Weather } from '../model/types';
import { streakDays, useTableView } from '../model/useTableView';

interface Fx { id: number; node: ReactNode }

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
  const hour = useHour();
  const season = useSeason();
  const [mood, setMood] = useState<KeeperMood>('idle');
  const [fox, setFox] = useState<{ from: 'left' | 'right'; key: number } | null>(null);
  const [fx, setFx] = useState<Fx[]>([]);
  const [sheet, setSheet] = useState<'cheat' | 'chain' | 'chat' | 'leave' | null>(null);
  const moodTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const n = game.players.length;
  const rel = (seat: number) => (seat - mySeat + n) % n;
  const name = (id: string) => game.players[Number(id)]?.name ?? '';

  const flash = (node: ReactNode, ms = 900) => {
    const id = Math.random();
    setFx((list) => [...list.slice(-5), { id, node }]);
    setTimeout(() => setFx((list) => list.filter((f) => f.id !== id)), ms);
  };
  const feel = (m: KeeperMood, ms = 1100) => {
    setMood(m);
    clearTimeout(moodTimer.current);
    moodTimer.current = setTimeout(() => setMood('idle'), ms);
  };
  useEffect(() => () => clearTimeout(moodTimer.current), []);

  // A lost turn or failed steal dims a card until the next turn starts.
  useEffect(() => setDimmed(new Set()), [game.turn?.seat]);

  useVisualEvents((e: VisualEvent) => {
    switch (e.type) {
      case 'accepted':
        flash(
          <div className="flex flex-col items-center gap-1">
            <div className="flex gap-1">
              {e.word.toUpperCase().split('').map((ch, i) => (
                <span key={i} className="sk-tile sk-pop flex size-9 items-center justify-center text-xl" style={{ animationDelay: `${i * 80}ms` }}>{ch}</span>
              ))}
            </div>
            <span className="sk-chip sk-rise sk-display">+{e.points}</span>
            {!reduced && <Particles kind="petals" origin={{ x: 50, y: 60 }} />}
          </div>,
          1100,
        );
        break;
      case 'banked':
        feel('happy');
        if (e.amount > 0) flash(<span className="sk-chip sk-rise sk-display text-lg">{name(e.playerId)} banked {e.amount}</span>, 1100);
        break;
      case 'stole':
        feel('startled', 1300);
        if (!reduced) setFox({ from: rel(Number(e.byId)) <= n / 2 ? 'right' : 'left', key: Math.random() });
        setDimmed((d) => new Set(d).add(Number(e.fromId)));
        flash(<span className="sk-chip sk-rise sk-display text-lg" style={{ color: 'var(--coral-dark)' }}>{name(e.byId)} stole {e.amount} with {e.word.toUpperCase()}!</span>, 1300);
        break;
      case 'stealFailed':
        setDimmed((d) => new Set(d).add(Number(e.playerId)));
        flash(<span className="sk-chip sk-rise" style={{ color: 'var(--coral-dark)' }}>{name(e.playerId)}’s steal failed{e.lost ? ` −${e.lost}` : ''}</span>, 800);
        break;
      case 'timedOut':
        setDimmed((d) => new Set(d).add(Number(e.playerId)));
        // Practice has no penalty, so no penalty visual either.
        if (storeMode !== 'practice' && storeMode !== 'tour') {
          flash(
            <div className="flex flex-col items-center gap-1">
              <span className="sk-chip sk-fall" style={{ color: 'var(--coral-dark)' }}>🍂 {name(e.playerId)} −5</span>
              {e.trapperId && <span className="sk-chip sk-rise">{name(e.trapperId)} +5 (trap)</span>}
            </div>,
            900,
          );
        }
        break;
      case 'gameEnd':
        feel(game.winners?.includes(mySeat) ? 'proud' : 'sleepy', 4000);
        break;
      default:
        break;
    }
  });

  const focus = view.currentPlayerId === '' ? null : rel(Number(view.currentPlayerId));
  const turnElapsed = game.turn ? (game.turn.durationMs / 1000 - view.secondsLeft) : 0;
  // Weather is light, and never in the first 3 seconds of a turn or during the steal window.
  const weather: Weather = view.stealOpen || turnElapsed < 3 ? 'none'
    : storeMode === 'practice' ? 'rain' : hour === 'dawn' ? 'mist' : season === 'autumn' ? 'leaves' : season === 'winter' ? 'snow' : 'none';
  const signState = game.phase === 'gameOver' ? 'raised' : game.phase === 'intro' ? 'lowering' : 'hung';
  const last = (seat: number) => game.players[seat].lastWord;
  const ranked = rankPlayers(game.players).map((p) => view.players[p.id]);
  const showTally = game.phase === 'intro' && game.round > 1 && storeMode !== 'tour';

  return (
    <div className="relative flex h-full flex-col overflow-hidden" data-steal-open={view.stealOpen}>
      <Scene place={PLACE_FOR_MODE[view.mode]} hour={hour} season={season} wind={0.8} frozen={view.stealOpen} still={reduced} weather={weather} />

      <div className="absolute inset-0" data-table>
        <Table3D
          pile={view.pile} focus={focus} frozen={view.stealOpen} reduced={reduced}
          seats={view.players.map((p) => ({
            seat: Number(p.id), index: rel(Number(p.id)), creature: p.creature!, active: p.id === view.currentPlayerId, dimmed: p.dimmed,
            label: <PlayerCard player={p} isTurn={p.id === view.currentPlayerId} compact />,
          }))}
        />
      </div>

      {/* Top row: round and twist (left), starting letter (centre), controls (right). */}
      <header className="pointer-events-none relative z-30 flex items-start justify-between gap-2 p-2">
        <div className="flex flex-col items-start gap-1">
          <span className="sk-chip sk-display">Round {view.round}/3 · turn {Math.min(5, view.turn)}/5</span>
          <TwistSign twist={view.twist} state={signState} compact={mobile} />
        </div>
        <div className="absolute left-1/2 top-1 -translate-x-1/2">
          <LetterTile
            letter={view.letter ?? ''} isTrap={view.isTrapLetter} isVowel={/[aeiou]/.test(view.letter ?? '')}
            fraction={view.turnSeconds ? view.secondsLeft / view.turnSeconds : undefined}
            secondsLeft={game.turn ? view.secondsLeft : undefined}
            stealOpen={view.stealOpen} size={mobile ? 56 : 72}
          />
        </div>
        <div className="pointer-events-auto flex flex-wrap justify-end gap-1">
          <Chip onClick={() => setSheet('cheat')} aria-label="Scoring cheat sheet">📖</Chip>
          <Chip onClick={() => setSheet('chain')} aria-label="Chain history">🔗</Chip>
          {storeMode === 'room' && <Chip onClick={() => setSheet('chat')} aria-label="Room chat">💬</Chip>}
          <Chip onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'} aria-pressed={muted}>{muted ? '🔇' : '🔊'}</Chip>
          <Chip onClick={() => setSheet('leave')} aria-label="Leave game">✕</Chip>
        </div>
      </header>

      {!mobile && (
        <aside className="relative z-30 ml-auto mr-2 mt-2 flex flex-col gap-1.5" aria-label="Scoreboard">
          {ranked.map((p) => (
            <PlayerCard key={p.id} player={p} isTurn={p.id === view.currentPlayerId} compact={false} lastWord={last(Number(p.id))} />
          ))}
        </aside>
      )}

      {/* Feedback moments float over the middle of the table. */}
      <div className="pointer-events-none absolute inset-x-0 top-[34%] z-20 flex flex-col items-center gap-2" aria-hidden="true">
        {fx.map((f) => <div key={f.id}>{f.node}</div>)}
      </div>
      {fox && <Fox key={fox.key} from={fox.from} running />}

      {showTally && (
        <div className="absolute inset-0 z-30 flex items-center justify-center p-4">
          <TallyBoard players={ranked} round={game.round - 1} isGameEnd={false} />
        </div>
      )}

      <div className="relative z-20 mt-auto flex items-end gap-2">
        <div className="hidden pb-3 pl-3 sm:block"><Keeper mood={mood} size={84} /></div>
        <div className="min-w-0 flex-1">
          <InputStrip
            letter={view.letter ?? ''} typed={input.typed} myTurn={input.myTurn} stealOpen={input.canSteal}
            onChange={input.onChange} onPlay={input.submit} onBank={input.bank} onSteal={input.steal}
            pile={view.pile} message={input.message} turnKey={game.turn?.seat}
            hints={input.learning ? { ideas: input.ideas, onHint: input.hintIdeas, onPick: input.useIdea } : undefined}
          />
        </div>
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
  const reduced = useMotionLevel() === 'reduced';
  const stats = summarize(game.players);
  const me = game.players[mySeat];
  const won = game.winners?.includes(mySeat) ?? false;
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
    <div className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto p-4" style={{ background: 'color-mix(in srgb, var(--ink) 40%, transparent)' }}>
      {won && !reduced && <Particles kind="petals" count={24} origin={{ x: 50, y: 30 }} />}
      <TallyBoard
        players={players} round={3} isGameEnd winnerIds={game.winners?.map(String)} longestWord={longest}
        actions={
          <>
            {(mode === 'quick' || mode === 'practice') && <ClothButton onClick={rematch} className="flex-1">Play again</ClothButton>}
            <WoodButton onClick={share} className="flex-1">{copied ? 'Copied!' : 'Share'}</WoodButton>
            <WoodButton onClick={quit} className="flex-1">{mode === 'room' ? 'Leave room' : 'Back to the meadow'}</WoodButton>
          </>
        }
      >
        <dl className="mt-2 grid grid-cols-2 gap-1.5 text-sm">
          {[
            ['Words played', stats.wordsPlayed],
            ['Steals', stats.steals],
            ['Longest word', stats.longestWord ? `${stats.longestWord.word.toUpperCase()} (${game.players[stats.longestWord.seat].name})` : '—'],
            ['Best word', stats.bestWord ? `${stats.bestWord.word.toUpperCase()} · ${stats.bestWord.points}` : '—'],
          ].map(([k, v]) => (
            <div key={k as string} className="sk-paper px-2 py-1">
              <dt className="sk-hand" style={{ color: 'var(--ink-soft)' }}>{k}</dt>
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

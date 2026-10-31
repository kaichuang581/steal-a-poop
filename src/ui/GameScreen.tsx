import { useEffect, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { Confetti } from './Confetti';
import { EndScreen } from './EndScreen';
import { useGameLoop, useIsMobile } from './hooks';
import { InputBar } from './InputBar';
import { BottomSheet, ChainHistory, Scoreboard, SidePanel } from './Panels';
import { RoundBanner } from './RoundBanner';
import { Table } from './Table';
import { useGameSounds } from './useGameSounds';
import { useNewEvents } from './useNewEvents';
import { EventFeed } from './Toasts';
import { TopBar } from './TopBar';

export function GameScreen() {
  useGameLoop();
  useGameSounds();
  const game = useStore((s) => s.game)!;
  const mobile = useIsMobile();
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [sheet, setSheet] = useState<'score' | 'chain' | null>(null);
  const [shaking, setShaking] = useState(false);
  const shakeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(shakeTimer.current), []);
  useNewEvents((e) => {
    if (e.kind === 'steal' && e.amount >= 30) {
      setShaking(true);
      clearTimeout(shakeTimer.current);
      shakeTimer.current = setTimeout(() => setShaking(false), 500);
    }
  });

  return (
    <div className={`flex h-full flex-col ${shaking ? 'shake' : ''}`}>
      <TopBar
        onScore={mobile ? () => setSheet('score') : undefined}
        onChain={mobile ? () => setSheet('chain') : undefined}
      />
      {mobile ? (
        <>
          <div className="h-1/2 min-h-[13rem] shrink-0"><Table /></div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-1">
            <ChainHistory game={game} limit={4} />
          </div>
        </>
      ) : (
        <div className="flex min-h-0 flex-1">
          <SidePanel title="Scoreboard" side="left" open={leftOpen} onToggle={() => setLeftOpen((o) => !o)}>
            <Scoreboard game={game} />
          </SidePanel>
          <main className="min-w-0 flex-1"><Table /></main>
          <SidePanel title="Chain" side="right" open={rightOpen} onToggle={() => setRightOpen((o) => !o)}>
            <ChainHistory game={game} />
          </SidePanel>
        </div>
      )}
      <InputBar />
      <RoundBanner />
      <EventFeed />
      <BottomSheet title="Scoreboard" open={sheet === 'score'} onClose={() => setSheet(null)}><Scoreboard game={game} /></BottomSheet>
      <BottomSheet title="Chain history" open={sheet === 'chain'} onClose={() => setSheet(null)}><ChainHistory game={game} /></BottomSheet>
      {game.phase === 'gameOver' && <EndScreen />}
      {game.phase === 'gameOver' && game.winners?.includes(0) && <Confetti />}
    </div>
  );
}

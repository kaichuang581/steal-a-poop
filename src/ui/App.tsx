import { MotionConfig } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { GAME_TITLE } from '../config';
import { useRoomStore } from '../state/roomStore';
import { useStore } from '../state/store';
import { Lobby } from './Lobby';
import { RoomScreen } from './RoomScreen';
import { GameScreen } from './GameScreen';
import { useViewport } from './hooks';
import { StartScreen } from './StartScreen';

export default function App() {
  const inGame = useStore((s) => s.game !== null);
  const inRoom = useRoomStore((s) => s.room !== null);
  const lobbyOpen = useRoomStore((s) => s.open);
  const loadDictionary = useStore((s) => s.loadDictionary);
  const ready = useStore((s) => s.dictStatus === 'ready');
  const tourDone = useStore((s) => s.tourDone);
  const startTour = useStore((s) => s.startTour);
  const autoTour = useRef(false);
  const reduceMotion = useStore((s) => s.reduceMotion);
  const largeText = useStore((s) => s.largeText);
  useViewport();

  // Player display settings apply to the whole page through classes on <html>.
  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', reduceMotion);
    document.documentElement.classList.toggle('large-text', largeText);
  }, [reduceMotion, largeText]);

  // First time opening the app: go straight into the tutorial. Finishing or skipping it marks it
  // done, so it never auto-opens again; How to Play and Settings can always reopen it.
  useEffect(() => {
    if (!ready || tourDone || inGame || autoTour.current) return;
    autoTour.current = true;
    startTour('menu');
  }, [ready, tourDone, inGame, startTour]);

  useEffect(() => {
    document.title = GAME_TITLE;
    void loadDictionary();
  }, [loadDictionary]);
  return (
    <MotionConfig reducedMotion={reduceMotion ? 'always' : 'user'}>
      <div className="fixed inset-x-0" style={{ top: 'var(--vvtop, 0px)', height: 'var(--vvh, 100dvh)' }}>
        {inGame ? <GameScreen /> : inRoom ? <RoomScreen /> : lobbyOpen ? <Lobby /> : <StartScreen />}
      </div>
    </MotionConfig>
  );
}

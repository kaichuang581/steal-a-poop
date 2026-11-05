import { MotionConfig } from 'framer-motion';
import { useEffect } from 'react';
import { GAME_TITLE } from '../config';
import { useRoomStore } from '../state/roomStore';
import { useStore } from '../state/store';
import { Lobby } from './Lobby';
import { RoomScreen } from './RoomScreen';
import { GameScreen } from './GameScreen';
import { useViewport } from './hooks';
import { StartScreen } from './StartScreen';
import { isPaintedSkin } from '../skin/flag';
import { PaintedApp } from '../skin/PaintedApp';

// Chosen once per page load: painted by default; ?skin=classic (or a VITE_SKIN=classic build) for the old look.
const PAINTED = isPaintedSkin(new URLSearchParams(location.search));

export default function App() {
  const inGame = useStore((s) => s.game !== null);
  const inRoom = useRoomStore((s) => s.room !== null);
  const lobbyOpen = useRoomStore((s) => s.open);
  const loadDictionary = useStore((s) => s.loadDictionary);
  const reduceMotion = useStore((s) => s.reduceMotion);
  const largeText = useStore((s) => s.largeText);
  useViewport();

  // Player display settings apply to the whole page through classes on <html>.
  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', reduceMotion);
    document.documentElement.classList.toggle('large-text', largeText);
  }, [reduceMotion, largeText]);

  useEffect(() => {
    if (!PAINTED) document.title = GAME_TITLE;
    void loadDictionary();
  }, [loadDictionary]);
  return (
    <MotionConfig reducedMotion={reduceMotion ? 'always' : 'user'}>
      <div className="fixed inset-x-0" style={{ top: 'var(--vvtop, 0px)', height: 'var(--vvh, 100dvh)' }}>
        {PAINTED ? <PaintedApp /> : inGame ? <GameScreen /> : inRoom ? <RoomScreen /> : lobbyOpen ? <Lobby /> : <StartScreen />}
      </div>
    </MotionConfig>
  );
}

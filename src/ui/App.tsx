import { MotionConfig } from 'framer-motion';
import { useEffect } from 'react';
import { GAME_TITLE } from '../config';
import { useStore } from '../state/store';
import { GameScreen } from './GameScreen';
import { useViewport } from './hooks';
import { StartScreen } from './StartScreen';

export default function App() {
  const inGame = useStore((s) => s.game !== null);
  const loadDictionary = useStore((s) => s.loadDictionary);
  useViewport();
  useEffect(() => {
    document.title = GAME_TITLE;
    void loadDictionary();
  }, [loadDictionary]);
  return (
    <MotionConfig reducedMotion="user">
      <div className="fixed inset-x-0" style={{ top: 'var(--vvtop, 0px)', height: 'var(--vvh, 100dvh)' }}>
        {inGame ? <GameScreen /> : <StartScreen />}
      </div>
    </MotionConfig>
  );
}

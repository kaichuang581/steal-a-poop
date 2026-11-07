import { useEffect } from 'react';
import { playSound, startBombClock, stopBombClock } from '../audio/sound';
import { useStore } from '../state/store';
import { useNewEvents } from './useNewEvents';

/** Maps engine events to sounds and ticks through the last 3 seconds of every turn. */
export function useGameSounds() {
  useNewEvents((e) => {
    switch (e.kind) {
      case 'play': return playSound('play');
      case 'bank': return playSound('bank');
      case 'steal': return playSound('steal');
      case 'timeout': return playSound('boom');
      case 'invalid':
      case 'stealFail': return playSound('fail');
      case 'trapSprung': return playSound('trap');
      case 'gameOver': return playSound('roundEnd');
      case 'stealTurn': return playSound('alarm');
      case 'roundStart':
        // The round chime, then the alarm for the faster turns (and the twist) the new round brings.
        if (e.id > 1) { playSound('roundEnd'); setTimeout(() => playSound('alarm'), 480); }
        return undefined;
      default: return undefined;
    }
  });

  // The bomb's clock: a beep on every whole second of each turn, scheduled on the audio clock (see startBombClock).
  useEffect(() => {
    let turnKey = '';
    return useStore.subscribe((s) => {
      const t = s.game?.phase === 'playing' ? s.game.turn : null;
      if (!t) {
        if (turnKey) stopBombClock();
        turnKey = '';
        return;
      }
      const key = `${t.seat}:${t.startedAt}`;
      if (key !== turnKey) {
        turnKey = key;
        const remaining = t.endsAt - s.now;
        startBombClock(remaining, t.durationMs);
      }
    });
  }, []);
}

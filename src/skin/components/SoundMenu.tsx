import { useEffect, useRef, useState } from 'react';
import { nowPlaying, useMusic } from '../../audio/music';
import { useStore } from '../../state/store';
import { Lever, Peg, RopeSlider } from '../kit';
import { SpeakerIcon } from './Icons';

/**
 * The speaker button and its sound menu (Brian, 2026-11-08: "put all the music stuff in the sound menu and make all the
 * stuff adjustable"): two rows on a little dark wool panel, the game's sounds and the music, each with its own switch
 * and volume, and under them which song is playing (every screen and game mode has its own). Closes on a click outside
 * or Escape.
 */
export function SoundMenu({ peg = false, size = 18 }: { peg?: boolean; size?: number }) {
  const [open, setOpen] = useState(false);
  const muted = useStore((s) => s.muted);
  const volume = useStore((s) => s.volume);
  const toggleMute = useStore((s) => s.toggleMute);
  const setVolume = useStore((s) => s.setVolume);
  const music = useMusic();
  const root = useRef<HTMLDivElement>(null);
  const silent = muted && !music.on;
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('pointerdown', away);
    window.addEventListener('keydown', esc);
    return () => { window.removeEventListener('pointerdown', away); window.removeEventListener('keydown', esc); };
  }, [open]);
  const button = { onClick: () => setOpen((o) => !o), 'aria-label': 'Sound and music', 'aria-expanded': open, title: 'Sound and music' };
  return (
    <div ref={root} className="sk-sound">
      {peg ? <Peg {...button}><SpeakerIcon size={size} muted={silent} /></Peg>
        : <button type="button" className="sk-icon-btn" {...button}><SpeakerIcon muted={silent} /></button>}
      {open && (
        <div className="sk-sound-menu" role="dialog" aria-label="Sound and music">
          <div className="sk-sound-row">
            <span className="sk-sound-name">Game sounds</span>
            <Lever checked={!muted} onChange={toggleMute} label="Game sounds" />
            <RopeSlider min={0} max={100} value={Math.round(volume * 100)} onChange={(e) => setVolume(Number(e.target.value) / 100)} aria-label="Game sounds volume" disabled={muted} />
          </div>
          <div className="sk-sound-row">
            <span className="sk-sound-name">Music</span>
            <Lever checked={music.on} onChange={music.toggle} label="Music" />
            <RopeSlider min={0} max={100} value={Math.round(music.volume * 100)} onChange={(e) => music.setVolume(Number(e.target.value) / 100)} aria-label="Music volume" disabled={!music.on} />
          </div>
          <p className="sk-sound-note">{music.on ? `Playing: ${nowPlaying()}` : 'Music is off'}</p>
        </div>
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { nowPlaying, useMusic } from '../../audio/music';
import { useStore } from '../../state/store';
import { Switch, Peg, Slider } from '../kit';
import { SpeakerIcon } from './Icons';
import { IconTile, Ribbon } from '../kit/modern';
import { BoardFrame, Pix } from '../kit/surfaces';

/** Two joined notes, in pixels. */
const NoteGlyph = () => <Pix rows={['...XXXXXX', '...X....X', '...X....X', '...X....X', '.XXX..XXX', 'XXXX.XXXX', '.XX...XX.']} colors={{ X: 'var(--hm-wool)' }} />;

/**
 * The speaker button and its sound menu (Brian, 2026-11-08: "put all the music stuff in the sound menu and make all the
 * stuff adjustable"): a small board of the kit (the ribbon, two raised rows): the game's sounds and the music, each
 * with its icon tile, its switch and its volume; the music's row names the song playing (every screen and game mode
 * has its own). Closes on a click outside or Escape.
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
        <div className="sk-sound-menu md-dialog md-pop hm rc rc-board" role="dialog" aria-label="Sound and music">
          <BoardFrame corners={['bl', 'br']} />
          <header className="md-dialog-head"><Ribbon icon={<SpeakerIcon size={20} />}>Sound</Ribbon></header>
          <div className="md-group-rows">
            <div className="md-rowtile md-rowtile--stack rc-tile">
              <div className="md-rowline">
                <IconTile tone="lantern"><SpeakerIcon size={20} muted={muted} /></IconTile>
                <span className="md-rowtext"><b>Game sounds</b><small>{muted ? 'Off' : `${Math.round(volume * 100)}%`}</small></span>
                <span className="md-rowend"><Switch checked={!muted} onChange={toggleMute} label="Game sounds" /></span>
              </div>
              <Slider min={0} max={100} value={Math.round(volume * 100)} onChange={(e) => setVolume(Number(e.target.value) / 100)} aria-label="Game sounds volume" disabled={muted} style={{ ['--fill' as string]: `${Math.round(volume * 100)}%` }} />
            </div>
            <div className="md-rowtile md-rowtile--stack rc-tile">
              <div className="md-rowline">
                <IconTile tone="dusk"><NoteGlyph /></IconTile>
                <span className="md-rowtext"><b>Music</b><small>{music.on ? nowPlaying() : 'Off'}</small></span>
                <span className="md-rowend"><Switch checked={music.on} onChange={music.toggle} label="Music" /></span>
              </div>
              <Slider min={0} max={100} value={Math.round(music.volume * 100)} onChange={(e) => music.setVolume(Number(e.target.value) / 100)} aria-label="Music volume" disabled={!music.on} style={{ ['--fill' as string]: `${Math.round(music.volume * 100)}%` }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

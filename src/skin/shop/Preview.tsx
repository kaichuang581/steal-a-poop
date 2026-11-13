import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { playSound } from '../../audio/sound';
import { CloseIcon } from '../components/Icons';
import { useMotionLevel } from '../hooks/useAmbient';
import { Patch, Peg } from '../kit';
import { ItemArt } from './art';
import { ACTS } from '../table/burstActs';
import { BURST_SHAPE, burstExplodes, KIND_ONE } from './catalog';
import type { Item } from './catalog';
import type { Wallet } from './economy';
import { cardState, ItemTag, sourceLine } from './ItemCard';
import { frameOf } from './rarity';
import { playSample, SOUND_OFF_NOTE, stopSample, useSampleOf } from './sample';
import { equipItem } from './store';

const PreviewStage = lazy(() => import('./PreviewStage'));
/** How long after a burst has finished it plays again by itself, in ms. */
const REPLAY_GAP_MS = 1000;

/**
 * The Barn Book's closer look at one item (Brian, 2026-11-12: "a preview thing in the barnbook where u can see stuff in
 * a better view"): a big live view in the frame of its rarity, and beside it what it is, where it comes from, and the
 * way to wear it. A bomb skin or a sound's object turns on the spot; a burst is the real one from the game, playing
 * again and again; a fuse sound plays when the preview opens and on Listen. Open for found and not-found items alike.
 * Under reduced motion it is the still picture. Esc, the peg or a click outside closes it.
 */
export function Preview({ item, wallet, onClose, onNote }: { item: Item; wallet: Wallet; onClose: () => void; onNote: (s: string) => void }) {
  const reduced = useMotionLevel() === 'reduced';
  const state = cardState(item, wallet);
  const [playKey, setPlayKey] = useState(0);
  const close = useRef<HTMLButtonElement>(null);
  const burst = item.kind === 'blast';
  const play = () => { setPlayKey((k) => k + 1); if (burst) playSound(burstExplodes(item.id) ? 'boom' : 'poof', 0.5, true); };

  useEffect(() => { close.current?.focus({ preventScroll: true }); }, []);
  // A burst goes off as its scene comes up (PreviewStage), then again by itself every few seconds; a sound is heard once.
  useEffect(() => {
    if (!burst || reduced) return;
    const again = setInterval(() => setPlayKey((k) => k + 1), ACTS[BURST_SHAPE[item.id] ?? 'ball'].life * 1000 + REPLAY_GAP_MS);
    return () => clearInterval(again);
  }, [burst, reduced, item.id]);
  // A fuse sound plays as its closer look opens, and stops when the look closes.
  const sampling = useSampleOf(item.id);
  const listen = () => { if (!playSample(item.id)) onNote(SOUND_OFF_NOTE); };
  useEffect(() => {
    if (item.kind !== 'tick') return;
    const t = setTimeout(() => playSample(item.id), 300);
    return () => { clearTimeout(t); stopSample(); };
  }, [item.kind, item.id]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener('keydown', esc, true);
    return () => window.removeEventListener('keydown', esc, true);
  }, [onClose]);

  const wear = async () => {
    await equipItem(item.id);
    onNote(`${item.name} is on.`);
  };
  const still = <ItemArt item={item} size={260} />;
  return (
    <div className="sk-preview-scrim" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={`${item.name}: a closer look`} className="sk-preview kit-wall" onClick={(e) => e.stopPropagation()}>
        <Peg ref={close} small light className="sk-room-close" onClick={onClose} aria-label="Close"><CloseIcon size={18} /></Peg>
        <div className={`sk-preview-stage kit-pic kit-pic--${frameOf(item)}`} data-burst={burst || item.kind === 'bomb' || undefined}>
          <div className="kit-pic-mat sk-preview-mat">
            {reduced ? still : <Suspense fallback={still}><PreviewStage item={item} playKey={playKey} wornBomb={wallet.equipped.bomb} still={false} /></Suspense>}
          </div>
        </div>
        <div className="sk-preview-text kit-paper kit-paper--sheet">
          <ItemTag item={item} />
          <h3>{item.name}</h3>
          <p className="sk-preview-kind">{KIND_ONE[item.kind]}</p>
          <p>{item.blurb}</p>
          <p className="sk-preview-where">{state === 'locked' ? `${sourceLine(item)}.` : state === 'wearing' ? 'You are wearing it.' : 'You have found it.'}</p>
          <span className="sk-preview-act">
            {state === 'owned' && <Patch as="button" tone="green" onClick={() => void wear()}>Wear it</Patch>}
            {state === 'wearing' && <span className="kit-tag kit-tag--green">Wearing</span>}
            {state === 'locked' && <span className="sk-card-missing">Not found yet</span>}
            {item.kind === 'tick' && <Patch as="button" pressed={sampling} onClick={listen}>{sampling ? 'Playing' : 'Listen'}</Patch>}
            {burst && !reduced && <Patch as="button" onClick={play}>Set it off</Patch>}
          </span>
        </div>
      </div>
    </div>
  );
}

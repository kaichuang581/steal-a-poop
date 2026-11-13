import type { CSSProperties, ReactNode } from 'react';
import { Patch } from '../kit';
import { ItemArt, PadlockArt, SpeakerMark } from './art';
import { KIND_ONE } from './catalog';
import type { Item, Rarity } from './catalog';
import { missionFor } from './economy';
import type { Wallet } from './economy';
import { formatCoins } from './format';
import { frameOf, RARITY_LABEL, RARITY_TINT } from './rarity';
import type { Frame } from './rarity';
import { SACKS } from './sacks';
import { playSample, SOUND_OFF_NOTE, useSampleOf } from './sample';
import { equipItem } from './store';

/** Where an item comes from, for one not found yet: "In the Oat Sack", "Mission: count sheep 7 nights in a row", "30 Bells on the Bell Shelf". */
export function sourceLine(item: Item): string {
  if (item.source === 'free') return 'Yours from the start';
  if (item.source === 'sack') return `In the ${SACKS[item.kind].name}`;
  if (item.source === 'bells') return `${formatCoins(item.price ?? 0)} Bells on the Bell Shelf`;
  const goal = missionFor(item.id)?.label ?? 'play to earn it';
  return `Mission: ${goal[0].toLowerCase()}${goal.slice(1)}`;
}

export type CardState = 'locked' | 'owned' | 'wearing';
export const cardState = (item: Item, wallet: Pick<Wallet, 'owned' | 'equipped'>): CardState =>
  (!wallet.owned.includes(item.id) ? 'locked' : wallet.equipped[item.kind] === item.id ? 'wearing' : 'owned');

/** The rarity as the kit's paper hang tag: the word stays, for players who cannot tell the colours apart. */
export function RarityTag({ rarity }: { rarity: Rarity }) {
  return <span className="kit-tag sk-rarity" style={{ '--tag-tint': RARITY_TINT[rarity] } as CSSProperties}>{RARITY_LABEL[rarity]}</span>;
}
const SOURCE_TAG: Record<Exclude<Frame, Rarity>, [string, string]> = { starter: ['Starter', '#DCD6CB'], mission: ['Mission', '#F6C6A0'], bells: ['Bells', '#F2D58C'] };
/** An item's tag: its rarity, or where it comes from when it has none. */
export function ItemTag({ item }: { item: Item }) {
  const frame = frameOf(item);
  if (item.rarity) return <RarityTag rarity={item.rarity} />;
  const [label, tint] = SOURCE_TAG[frame as Exclude<Frame, Rarity>];
  return <span className="kit-tag sk-rarity" style={{ '--tag-tint': tint } as CSSProperties}>{label}</span>;
}

/**
 * An item's picture in the frame of its rarity (the kit's `kit-pic`): plain plank, green painted edge, blue-roped
 * corners, gilded with a glint. The art is never hidden: `locked` dims it and adds a padlock; `lit` rings the frame with
 * lantern light (the one being worn).
 */
export function ItemFrame({ item, size = 96, locked, lit, className = '', children }: { item: Item; size?: number; locked?: boolean; lit?: boolean; className?: string; children?: ReactNode }) {
  const frame = frameOf(item);
  return (
    <span className={`kit-pic kit-pic--${frame} ${lit ? 'kit-pic--lit' : ''} ${className}`} data-locked={locked || undefined}>
      <span className="kit-pic-mat">
        <ItemArt item={item} size={size} />
        {locked && <span className="kit-pic-lock"><PadlockArt size={16} /></span>}
      </span>
      {frame === 'rare' && <><i className="kit-pic-knot" /><i className="kit-pic-knot" /><i className="kit-pic-knot" /><i className="kit-pic-knot" /></>}
      {children}
    </span>
  );
}

/**
 * The one item card, used in the sacks, on the Bell Shelf's labels and in the Barn Book (docs/PLAN_TRADING_POST_REFINE.md
 * Part 3). Three states only: not found (dimmed art, a padlock, where it comes from), owned (full colour, a Wear patch),
 * wearing (lit frame, a WEARING tag in place of the button). Fixed height; the description is one line, whole on hover.
 * The picture opens the closer look (Preview); a fuse sound also has a small Listen button on its corner, found or not.
 */
export function ItemCard({ item, wallet, onNote, fresh, onView }: { item: Item; wallet: Wallet; onNote: (s: string) => void; fresh?: boolean; onView?: (item: Item) => void }) {
  const state = cardState(item, wallet);
  const sampling = useSampleOf(item.id);
  const line = state === 'locked' ? sourceLine(item) : item.blurb;
  const wear = async () => {
    await equipItem(item.id);
    onNote(`${item.name} is on.`);
  };
  return (
    <article className="sk-card" data-state={state} data-fresh={fresh || undefined} aria-label={`${item.name}, ${KIND_ONE[item.kind].toLowerCase()}, ${state === 'locked' ? 'not found yet' : state === 'wearing' ? 'wearing' : 'found'}`}>
      <div className="sk-card-top">
        <button type="button" className="sk-card-view" onClick={() => onView?.(item)} aria-label={`Look closer at ${item.name}`}>
          <ItemFrame item={item} locked={state === 'locked'} lit={state === 'wearing'} className="sk-card-pic" />
        </button>
        {item.kind === 'tick' && <button type="button" className="sk-card-speaker" data-on={sampling || undefined} onClick={() => { if (!playSample(item.id)) onNote(SOUND_OFF_NOTE); }} aria-label={`Listen to ${item.name}`}><SpeakerMark /></button>}
      </div>
      <div className="sk-card-label">
        <h4 title={item.name}>{item.name}</h4>
        <ItemTag item={item} />
        <p title={line}>{line}</p>
        <span className="sk-card-act">
          {state === 'owned' && <Patch as="button" small tone="green" onClick={() => void wear()}>Wear</Patch>}
          {state === 'wearing' && <span className="kit-tag kit-tag--green">Wearing</span>}
          {state === 'locked' && <span className="sk-card-missing">Not found yet</span>}
        </span>
      </div>
    </article>
  );
}

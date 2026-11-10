import type { Bestiary } from '../../hunt/bestiary';
import { DEX_ORDER } from '../../hunt/bestiary';
import { CODE_LENGTH } from '../../hunt/codes';
import type { Example, Mark, PredatorKind } from '../../hunt/hunt';
import { MOVES, START_LEVEL } from '../../hunt/hunt';
import { ordinal } from '../../hunt/packs';
import { PredatorSprite, SheepBackSprite, SilhouetteSprite } from './sprites';

/**
 * The Hunt's panels from plan v7 Part 5, drawn in the handheld console's style: the code boxes, the rule cards, the
 * death screen, the results card and the bestiary. They only draw; the screen (HuntScreen.tsx) owns the state.
 */

/** A row of buttons with a ▶ cursor. Nothing is chosen until the cursor is placed (`cursor` -1). */
export function GbButtons({ items, cursor, onPick, onHover, className = '', label }: {
  items: string[]; cursor: number; onPick: (i: number) => void; onHover: (i: number) => void; className?: string; label: string;
}) {
  return (
    <div className={`gb-buttons ${className}`} role="menu" aria-label={label}>
      {items.map((t, i) => (
        <button key={t} role="menuitem" data-on={cursor === i || undefined} onClick={() => onPick(i)} onPointerEnter={() => onHover(i)}>{t}</button>
      ))}
    </div>
  );
}

/** Five boxes for a pack code, filled as it is typed. */
export function CodeBoxes({ value, shake }: { value: string; shake: number }) {
  return (
    <div key={shake} className={`gb-code-boxes ${shake ? 'gb-shake' : ''}`} aria-hidden="true">
      {Array.from({ length: CODE_LENGTH }, (_, i) => <span key={i} data-cursor={i === value.length || undefined}>{value[i] ?? ''}</span>)}
    </div>
  );
}

/** "apple then eagle" reads APPLE → EAGLE on a card. */
const showExample = (w: string) => w.toUpperCase().replace(' THEN ', '→');

export interface RuleCard { id: string; label: string; how: string; example: Example | null; asleep?: boolean; hidden?: boolean }

/** One rule: its label, its plain sentence, and a word that obeys it and one that breaks it. */
export function RuleCardView({ card, title }: { card: RuleCard; title?: string }) {
  if (card.hidden) {
    return (
      <div className="gb-card gb-card-hidden">
        {title && <b>{title}</b>}
        <span className="gb-card-q">?</span>
        <i>wakes up when it&apos;s hurt</i>
      </div>
    );
  }
  return (
    <div className="gb-card" data-asleep={card.asleep || undefined}>
      {title && <b>{title}</b>}
      <span className="gb-card-label">{card.label}</span>
      <i>{card.asleep ? 'Asleep this turn: it lets your word off.' : card.how}</i>
      {card.example && card.example.yes && (
        <span className="gb-card-ex"><em className="gb-yes">YES {showExample(card.example.yes)}</em>{card.example.no && <em className="gb-no">NO {showExample(card.example.no)}</em>}</span>
      )}
    </div>
  );
}

/** What got you, the word that would have worked, and three equal choices (plan v7 Part 5.3). */
export function DeathPanel({ cause, help, cursor, onPick, onHover }: {
  cause: string; help: string | null; cursor: number; onPick: (i: number) => void; onHover: (i: number) => void;
}) {
  return (
    <div className="gb-death" role="dialog" aria-label="What got you">
      <h2>WHAT GOT YOU</h2>
      <p>{cause}</p>
      {help && <p className="gb-death-help">{help}</p>}
      <GbButtons label="What next?" items={['FIGHT THIS PACK AGAIN', 'NEW PACK', 'RESULTS']} cursor={cursor} onPick={onPick} onHover={onHover} className="gb-buttons-col" />
    </div>
  );
}

const MARK: Record<Mark, string> = { hit: 'o', crit: '*', broke: 'x', timeout: '-', item: '+' };

/** The results as one picture, laid out to be screenshotted (plan v7 Part 5.5). */
export function ResultsCard({ defeated, damage, marks, best, code, attempt, stale, reached, beaten, frozen, walked, record }: {
  defeated: number; damage: number; marks: Mark[]; best: { word: string; damage: number } | null; code: string; attempt: number; stale: boolean;
  reached: PredatorKind; beaten: boolean; frozen: boolean; walked: boolean; record: boolean;
}) {
  return (
    <div className="gb-polaroid" role="img" aria-label={`Pack ${code}, ${ordinal(attempt)} try: ${defeated} beaten, ${damage} damage${best ? `, best word ${best.word} for ${best.damage}` : ''}${walked ? ', walked home' : ''}${record ? ', a new best' : ''}`}>
      <div className="gb-photo">
        <div className="gb-photo-sky" />
        <div className="gb-photo-me"><SheepBackSprite size={56} frozen={frozen} /></div>
        <div className={`gb-photo-foe ${beaten ? 'gb-photo-fainted' : ''}`}><PredatorSprite kind={reached} size={56} /></div>
        <div className="gb-photo-result">{defeated} BEATEN · {damage} DMG</div>
        {best && <div className="gb-photo-word">{best.word.toUpperCase()} {best.damage}</div>}
        {walked && <div className="gb-stamp gb-stamp-walk">WALKED HOME</div>}
        {record && <div className="gb-stamp gb-stamp-best">NEW BEST</div>}
      </div>
      <div className="gb-polaroid-code">{code} · {ordinal(attempt)} try{stale ? ' · old list' : ''}</div>
      <div className="gb-polaroid-marks">{marks.map((m) => MARK[m]).join('')}</div>
    </div>
  );
}

const DATE = (d?: string) => (d ? d.split('-').reverse().slice(0, 2).join('/') + '/' + d.slice(2, 4) : '?');
const NAMES: Record<PredatorKind, string> = { fox: 'RED FOX', wolf: 'GREY WOLF', lynx: 'LYNX', eagle: 'GOLDEN EAGLE', bear: 'POLAR BEAR', shadow: 'SHADOW WOLF' };

/** Six cards, silhouettes until met (plan v7 Part 5.6). A met card flips to its back: first met, signature move. */
export function Dex({ dex, cursor, flipped, onPick, onHover }: {
  dex: Bestiary; cursor: number; flipped: PredatorKind | null; onPick: (i: number) => void; onHover: (i: number) => void;
}) {
  const met = DEX_ORDER.filter((k) => dex[k].met).length;
  const beaten = DEX_ORDER.filter((k) => dex[k].beaten > 0).length;
  return (
    <div className="gb-dex" role="dialog" aria-label="Bestiary">
      <h2>BESTIARY</h2>
      <div className="gb-dex-grid" role="grid">
        {DEX_ORDER.map((k, i) => {
          const e = dex[k];
          const back = flipped === k && e.met;
          return (
            <button key={k} role="gridcell" className="gb-dex-card" data-on={cursor === i || undefined} data-met={e.met || undefined} data-back={back || undefined}
              onClick={() => onPick(i)} onPointerEnter={() => onHover(i)} aria-label={e.met ? `${NAMES[k]}: beaten ${e.beaten}` : 'Not met yet'}>
              {back ? (
                <>
                  <span className="gb-dex-name">{NAMES[k]}</span>
                  <span className="gb-dex-small">FIRST MET</span>
                  <span>{DATE(e.firstMet)}</span>
                  <span className="gb-dex-small">MOVE</span>
                  <span>{MOVES[k]}</span>
                </>
              ) : (
                <>
                  <span className="gb-dex-art">
                    {e.met && k !== 'shadow' ? <PredatorSprite kind={k} size={40} /> : <SilhouetteSprite kind={k} size={40} eyes={k === 'shadow' && e.met} />}
                  </span>
                  <span className="gb-dex-name">{e.met ? NAMES[k] : '???'}</span>
                  {e.met && <span className="gb-dex-small">BEATEN {e.beaten}{e.highestLevel ? ` · LV ${e.highestLevel}` : ''}</span>}
                  {e.bestWord && <span className="gb-dex-small">{e.bestWord.word.toUpperCase()} {e.bestWord.damage}</span>}
                </>
              )}
            </button>
          );
        })}
      </div>
      <p className="gb-dex-foot">{met} OF 6 MET · {beaten} BEATEN · ESC BACK</p>
    </div>
  );
}

/** The shown level of a predator at an index (Lv5 for the first). */
export const shownLevel = (index: number) => index + START_LEVEL;

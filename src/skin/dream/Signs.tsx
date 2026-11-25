import type { CSSProperties, RefObject } from 'react';
import { FIELD } from '../../dream/dream';
import { CheckIcon } from '../components/Icons';
import type { FenceView, StageLive } from './DreamStage';
import { FLIGHT } from './fly';
import { signHeight } from './frame';
import { isClose } from './run';
import { PLAN_M, projectDream } from './camera';
import { ART, SHEEP_ART, worldX } from './stage';
import { SIGNPOST } from './world3d/DreamWorld';
import type { DreamView } from './stage';

/**
 * The signs (docs/dream/02-layout-and-interface.md, section 6): each fence's board is HTML hung over its obstacle, on
 * a post the scenery draws. One board per fence in the queue of four; the dream's loop moves each to its fence.
 */
export const SLOTS = 4;

/**
 * A sign's board, the same in every stage because it is the thing you read: a bar on two chains, the letters your
 * word must start with as lantern tiles, three sunk squares for the letters that are yours, and a plank your accepted
 * word lands on. It has no cap.
 */
export function SignBoard({ view }: { view: FenceView }) {
  const word = view.locked ? view.word.toUpperCase() : '';
  return (
    <div className="dr-sign" data-wrong={view.wrong || undefined} data-done={view.locked || undefined}>
      <i className="dr-sign-bar" /><i className="dr-sign-chain" /><i className="dr-sign-chain" data-r />
      <div className="dr-sign-board">
        <div className="dr-sign-letters">
          {view.letters.map((ch, i) => <span key={i} className="dr-tile dr-tile--lantern">{ch.toUpperCase()}</span>)}
          <span className="dr-sign-dots"><i /><i /><i /></span>
        </div>
        {/* Your word lands here: the sign's own letters with the first tile to arrive, then each tile as it flies in. */}
        <div className="dr-sign-plank" style={{ '--n': Math.max(1, word.length) } as CSSProperties}>
          {[...word].map((ch, i) => <span key={i} className="dr-sign-word" style={{ animationDelay: `${FLIGHT.ms + Math.max(0, i - view.letters.length) * FLIGHT.stagger}ms` }}>{ch}</span>)}
        </div>
        {view.locked && <span className="dr-sign-check"><CheckIcon size={12} /></span>}
      </div>
    </div>
  );
}

/** The signs' boards over the dream: one tag a slot, moved by `placeSigns`. */
export function Signs({ fences, tags, root }: { fences: readonly FenceView[]; tags: readonly RefObject<HTMLDivElement | null>[]; root: RefObject<HTMLDivElement | null> }) {
  return (
    <div ref={root} className="dr-tags dr-signs" aria-hidden="true">
      {tags.map((tag, slot) => { const f = fences.find((v) => v.index % SLOTS === slot); return <div key={slot} ref={tag} className="dr-tag dr-sign-tag" data-fence={f?.index}>{f && <SignBoard view={f} />}</div>; })}
    </div>
  );
}

/**
 * How high a sign hangs in a view: its board's top, CSS px above the ground line, so that the board's bottom clears
 * the standing sheep by a gap; and whether the window is tall enough for the word plank at all (a small phone with
 * its keyboard up drops it). The sheep leaps through that height, so a jumped fence's board gives way to it.
 */
export function signLayout(v: DreamView, ui: { u: number; phone: boolean }): { hang: number; plank: boolean } {
  const gap = ui.phone ? 10 : 16 * ui.u, stand = ART * SHEEP_ART.hat * v.s;
  const plank = v.ground - (ui.phone ? 52 : 60 * ui.u) >= stand + gap + signHeight(ui.phone, ui.u, true);
  return { hang: stand + gap + signHeight(ui.phone, ui.u, plank), plank };
}

const FW = FIELD.fenceW, near = FIELD.sheepX + FIELD.sheepW;
/**
 * One frame of the signs: moves each fence's board to the point the camera gives for its signpost's chain ends
 * (docs/dream/v3/08, section 5: hung level from 3.75 m, so the jumping sheep passes under it) and says what its fence
 * is doing (close, knocked, being leapt). Reads the run; writes only the DOM.
 */
export function placeSigns(L: StageLive, v: DreamView, tags: readonly RefObject<HTMLDivElement | null>[], state: string[]): void {
  const used = new Set<number>();
  for (const fe of L.fences) {
    const slot = fe.index % SLOTS, mid = worldX(fe.x + FW / 2) / PLAN_M;
    used.add(slot);
    const [x, y] = projectDream(v, mid + SIGNPOST.dx + SIGNPOST.hangX, SIGNPOST.hangY, SIGNPOST.z + SIGNPOST.hangZ);
    const tag = tags[slot].current;
    if (!tag) continue;
    tag.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    const hit = fe.knockedAt !== null || (L.crashAt !== null && !fe.passed && !fe.jumped && fe.x < near && fe.x + FW > FIELD.sheepX);
    const close = isClose(fe) && !hit, clear = fe.jumped && !fe.passed, s = `${hit ? 'k' : ''}${close ? 'c' : ''}${clear ? 'j' : ''}`;
    if (state[slot] !== s) {
      state[slot] = s;
      tag.toggleAttribute('data-knock', hit);
      tag.toggleAttribute('data-close', close);
      tag.toggleAttribute('data-clear', clear);
    }
  }
  tags.forEach((tag, i) => { if (!used.has(i) && tag.current && state[i] !== 'off') { state[i] = 'off'; tag.current.style.transform = 'translate3d(-9999px, 0, 0)'; } });
}

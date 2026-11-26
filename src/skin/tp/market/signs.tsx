import { memo } from 'react';
import type { CSSProperties } from 'react';
import * as A from './art';
import type { StopId } from './world';

/**
 * The market's signs (art.ts draws them; signs.css lays them out). Everything a player reads at the Trading Post sits
 * on one of these: a board cut in nine (`mk-board`, in a tone), an awning, the banner, a lantern, a moon token, a
 * meter. `SIGN_ART` is the boards' and wells' art as CSS variables, set once on the screen's root.
 */

/** A sprite, one art pixel to `--p`. Pass a grid that is made once (a constant, or memoised): it is the cache key. */
export const Sprite = memo(function Sprite({ g, className, style }: { g: A.Grid; className?: string; style?: CSSProperties }) {
  return <svg className={`mk-sprite ${className ?? ''}`} viewBox={`0 0 ${g[0].length} ${g.length}`} shapeRendering="crispEdges" aria-hidden="true" style={{ '--w': g[0].length, '--h': g.length, ...style } as CSSProperties} dangerouslySetInnerHTML={{ __html: A.runs(g) }} />;
});

const TONES = Object.keys(A.TONE) as A.ToneName[];
const FLECK: Record<A.ToneName, string> = { cream: '#F9ECCD', night: '#1F305C', lantern: '#EE9C3A', red: '#B0423A', green: '#3A8250', violet: '#454FAE', amber: '#D08326', pale: '#D6C9AC' };
export const SIGN_ART: Record<string, string> = Object.fromEntries([
  ...TONES.flatMap((t) => [[`--bd-${t}`, A.uriOf(A.board(A.TONE[t]))], [`--bd-${t}-thin`, A.uriOf(A.board(A.TONE[t], 1))], [`--wv-${t}`, A.uriOf(A.weave(A.TONE[t].base, FLECK[t]))]]),
  ['--well', A.uriOf(A.well('#0E152C', '#070A18', '#3A4F86'))], ['--well-pale', A.uriOf(A.well('#D9C8A0', '#C2AE82', '#FFFDF4'))],
  ['--banner', A.uriOf(A.banner(A.TONE.red))],
  // The tones themselves, so the stylesheets name a tone and never repeat its colour.
  ...TONES.flatMap((t) => (['hi', 'base', 'lo', 'side', 'text', 'soft'] as const).map((k) => [`--t-${t}-${k}`, A.TONE[t][k]])),
  ['--mk-outline', A.INK], ['--mk-ink', A.TONE.cream.text], ['--mk-soft', A.TONE.cream.soft], ['--mk-wool', A.TONE.cream.base], ['--mk-frost', A.TONE.night.soft], ['--mk-gold', '#FFD98A'], ['--mk-green', '#2F7A4C'],
  ['--sign-shadow', 'drop-shadow(0 calc(2 * var(--p)) 0 rgba(11, 16, 36, 0.3))'], ['--mk-shade', 'rgba(11, 16, 36, 0.3)'], ['--mk-shade-2', 'rgba(11, 16, 36, 0.5)'],
]);

/** Each stall's own colour: its awning, its tab, its plaques. The feed stall's fascia is red and the bell stand's green in the scene itself. */
export const STALL_TONE: Record<StopId, A.ToneName> = { sacks: 'red', bells: 'green', missions: 'violet', book: 'amber' };
const AWNING = Object.fromEntries((['sacks', 'bells', 'missions', 'book'] as StopId[]).map((s, i) => [s, { wide: A.awning(13, A.TONE[STALL_TONE[s]], true, i * 7), small: A.awning(7, A.TONE[STALL_TONE[s]], true, i * 7) }])) as Record<StopId, { wide: A.Grid; small: A.Grid }>;
const ICON = Object.fromEntries((['sacks', 'bells', 'missions', 'book'] as StopId[]).map((s) => [s, A.stallIcon(s)])) as Record<StopId, A.Grid>;
const BULB = { on: A.bulb(true), off: A.bulb(false) };
const MOON = { on: A.moon(true), off: A.moon(false) };
const CROSS = A.glyph('cross', '#FFF4DC');
export const TICK = A.glyph('tick', '#3F8A55');
export const LOCK = A.glyph('lock', '#6B5B4B', '#3A3042');
const LANTERNS = Array.from({ length: 11 }, (_, k) => A.lantern(k / 10));

const DRIFT = { l: A.drift(46, 3), r: A.drift(30, 17) };
/** Two drifts of snow for the top of a board that stands in the open. */
export const Snow = () => <><Sprite g={DRIFT.l} className="mk-snow mk-snow--l" /><Sprite g={DRIFT.r} className="mk-snow mk-snow--r" /></>;
export const StallAwning = ({ stop, small }: { stop: StopId; small?: boolean }) => <Sprite g={AWNING[stop][small ? 'small' : 'wide']} className="mk-awn" />;
export const StallIcon = ({ stop }: { stop: StopId }) => <Sprite g={ICON[stop]} className="mk-stallicon" />;
export const Bulb = ({ on }: { on: boolean }) => <Sprite g={on ? BULB.on : BULB.off} className="mk-bulb" />;
export const Cross = () => <Sprite g={CROSS} />;
/** A paper lantern lit from the bottom as far as `fill`. */
export const Lantern = ({ fill }: { fill: number }) => <Sprite g={LANTERNS[Math.round(Math.max(0, Math.min(1, fill)) * 10)]} className="mk-lantern" />;

/** A row of nights: a lit moon for each one counted. */
export function Moons({ have, need, label }: { have: number; need: number; label: string }) {
  return <span className="mk-moons" role="img" aria-label={label}>{Array.from({ length: need }, (_, k) => <Sprite key={k} g={k < have ? MOON.on : MOON.off} />)}</span>;
}
/** A meter: a sunk track with a lit fill, marked off in `marks` parts. */
export function Meter({ value, label, marks = 0, pale }: { value: number; label: string; marks?: number; pale?: boolean }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <span className="mk-meter" data-pale={pale || undefined} role="img" aria-label={label}>
      {v > 0 && <i style={{ width: `${v * 100}%` }} />}
      {Array.from({ length: Math.max(0, marks - 1) }, (_, k) => <u key={k} style={{ left: `${((k + 1) / marks) * 100}%` }} />)}
    </span>
  );
}

import { memo } from 'react';
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import type { Kind } from '../../shop/catalog';
import { RARITY_COLOR } from '../../shop/rarity';
import type { Frame } from '../../shop/rarity';
import * as A from './art';
import type { StopId } from './world';

/**
 * The market's signs (art.ts draws them; signs.css lays them out). Everything a player reads at the Trading Post sits
 * on one of these: a board cut in nine (`mk-board`, in a tone), an awning, the banner, a lantern, a moon token, a
 * meter. `SIGN_ART` is the boards' and wells' art as CSS variables, set once on the screen's root.
 *
 * No sign is a plain box with words on it (Brian, 2026-11-26: "dont use those stupid just squares with regular text
 * on them for each button/indicator/sign"). What a thing is decides its shape, and each carries a picture:
 * - something pressed is a capsule with a seal at its left end, a picture of what it does (`Btn`);
 * - a thing's name is a tag with its gem set in a crest on its top edge (`Crest`): the gem's cut and colour say how
 *   rare it is, or where it comes from;
 * - a state or a kind is a ribbon, with a seal as its medal (`Ribbon`);
 * - an amount is a pill with its coin or bell (`mk-pill`);
 * - a count of things found is a row of their gems, lit or still empty sockets (`Gems`).
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
  // Buttons (capsules, two sizes), amounts (pills), ribbons and tabs.
  ...(['lantern', 'cream', 'pale', 'night'] as const).flatMap((t) => [[`--cap-${t}`, A.uriOf(A.capsule(17, A.TONE[t]))], [`--cap-${t}-lg`, A.uriOf(A.capsule(27, A.TONE[t]))]]),
  ['--pill-night', A.uriOf(A.capsule(13, A.TONE.night, 0))], ['--pill-cream', A.uriOf(A.capsule(13, A.TONE.cream, 0))],
  ...TONES.map((t) => [`--rb-${t}`, A.uriOf(A.ribbon(A.TONE[t]))]),
  ['--tab-cream', A.uriOf(A.tab(A.TONE.cream))], ['--tab-lantern', A.uriOf(A.tab(A.TONE.lantern))],
  ['--chalk', A.uriOf(A.chalkLine(A.TONE.night.hi))], ['--wv-slate', A.uriOf(A.weave(A.TONE.night.lo, '#18244A'))], ['--t-slate', A.TONE.night.lo],
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
const PAINTED = { sacks: A.stallArt('sacks'), bells: A.stallArt('bells') };
/** A stall's picture as it is painted on the stall's own sign in the scene: no outline, as nothing in the scene has one. */
export const StallPainted = ({ stop }: { stop: 'sacks' | 'bells' }) => <Sprite g={PAINTED[stop]} className="mk-painted" />;
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

// ---------------------------------------------------------------- gems, kinds, seals

const GEM_OF: Record<Frame, [A.GemShape, string]> = {
  common: ['bead', RARITY_COLOR.common], uncommon: ['cut', RARITY_COLOR.uncommon], rare: ['diamond', RARITY_COLOR.rare], legendary: ['star', RARITY_COLOR.legendary],
  bells: ['bell', '#D99A2B'], mission: ['medal', '#F2C040'], starter: ['bead', '#C99B5A'],
};
const GEMS = Object.fromEntries((Object.keys(GEM_OF) as Frame[]).map((f) => [f, { on: A.gem(...GEM_OF[f]), off: A.gem(GEM_OF[f][0], '', false) }])) as Record<Frame, { on: A.Grid; off: A.Grid }>;
/** How rare a thing is, or where it comes from, as a gem; `off` is its empty socket. */
export const Gem = ({ of, off }: { of: Frame; off?: boolean }) => <Sprite g={GEMS[of][off ? 'off' : 'on']} className="mk-gem" />;
/** What is found of a set: each thing's gem, lit when found. */
export const Gems = ({ of, label }: { of: { frame: Frame; found: boolean }[]; label: string }) => <span className="mk-gems" role="img" aria-label={label}>{of.map((x, k) => <Gem key={k} of={x.frame} off={!x.found} />)}</span>;

const CREST = A.crest(A.TONE.cream);
/** A tag's crest: its gem in a seat on the tag's top edge. */
export const Crest = ({ of }: { of: Frame }) => <span className="mk-crest" aria-hidden="true"><Sprite g={CREST} /><Gem of={of} /></span>;
const FOUND = A.seal(9, A.TONE.green, A.mark('smallTick', '#FFF4DC'));
/** The mark on a tag's corner for a thing that is yours. */
export const Found = () => <Sprite g={FOUND} className="mk-found" />;
const POINTER = A.pointer(A.TONE.cream);
export const Pointer = () => <Sprite g={POINTER} className="mk-pointer" />;

const KIND_ICON = { bomb: A.kindIcon('bomb'), blast: A.kindIcon('blast'), tick: A.kindIcon('tick') };
/** A bomb skin, a burst or a fuse sound, as a picture. */
export const KindIcon = ({ kind }: { kind: Kind }) => <Sprite g={KIND_ICON[kind]} className="mk-kind" />;
/** Each kind's colour: its niche in the missions' case, its ribbon. */
export const KIND_TONE: Record<Kind, A.ToneName> = { bomb: 'red', blast: 'green', tick: 'violet' };

const INK = A.TONE.cream.text, C = A.TONE.cream;
/** Seals by what they show. A kind's own name (bomb, blast, tick) gives that kind's picture. */
const SEAL = {
  bomb: A.seal(13, C, A.kindIcon('bomb', true)), blast: A.seal(13, A.TONE.night, A.kindIcon('blast', true)), tick: A.seal(13, C, A.kindIcon('tick', true)),
  play: A.seal(13, C, A.mark('play', INK)), back: A.seal(13, C, A.mark('back', INK)), next: A.seal(13, C, A.mirror(A.mark('back', INK))), page: A.seal(13, C, A.mark('page', INK, '#C4AE82')),
  speaker: A.seal(13, C, A.mark('speaker', INK, '#5B4B3F')), playing: A.seal(13, A.TONE.lantern, A.mark('speaker', INK, '#4A2E0C')), flame: A.seal(13, A.TONE.night, A.mark('flame', '')), lamp: A.seal(13, A.TONE.lantern, A.mark('flame', '')),
  bell: A.seal(13, A.TONE.night, A.mark('bell', '')), star: A.seal(13, A.TONE.night, A.mark('star', '#FFD98A')),
  yes: A.seal(13, C, A.mark('tick', '#2F7A4C')), done: A.seal(13, A.TONE.green, A.mark('tick', '#FFF4DC')), lock: A.seal(13, A.TONE.pale, A.mark('lock', '#6B5B4B', '#3A3042')),
};
export type SealName = keyof typeof SEAL;
const SEAL_LG = { sacks: A.seal(23, C, A.stallArt('sacks')), done: A.seal(23, A.TONE.green, A.mark('tick', '#FFF4DC')), lock: A.seal(23, A.TONE.pale, A.mark('lock', '#6B5B4B', '#3A3042')) };
/** A seal: a disc with a picture of what a button does, or the medal on a ribbon. A kind's name (bomb, blast, tick) gives its picture. */
export const Seal = ({ name, big }: { name: SealName | keyof typeof SEAL_LG; big?: boolean }) => <Sprite g={big ? SEAL_LG[name as keyof typeof SEAL_LG] : SEAL[name as SealName]} className="mk-seal" />;

/** Something pressed: a capsule, its seal at the left end. */
export function Btn({ seal, tone = 'lantern', big, className, children, ...rest }: { seal?: SealName | keyof typeof SEAL_LG; tone?: 'lantern' | 'cream' | 'night'; big?: boolean; children?: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={`mk-cap mk-cap--${tone}${big ? ' mk-cap--lg' : ''} ${className ?? ''}`} {...rest}>{seal && <Seal name={seal} big={big} />}{children}</button>;
}
/** A state or a kind: a ribbon in a tone, a seal as its medal. */
export const Ribbon = ({ tone, seal, className, children }: { tone: A.ToneName; seal?: SealName; className?: string; children?: ReactNode }) => <span className={`mk-rib mk-rib--${tone} ${className ?? ''}`}>{seal && <Seal name={seal} />}{children}</span>;
/** The bell a way of earning Golden Bells hangs under. */
export const BellToken = () => <Sprite g={ICON.bells} className="mk-token" />;

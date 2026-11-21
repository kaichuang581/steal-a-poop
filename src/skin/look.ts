/**
 * The diorama plan's light and render pairs (docs/diorama/PLAN.md, section 4; milestone D1): switches read once from
 * the address on a development server, so the same shot can be taken twice and laid side by side. In any build players
 * load, `import.meta.env.DEV` is false and every switch is its shipped value.
 *   ?tm=aces|neutral|agx   tone mapping (Neutral since 2026-11-19; ACES before, and still on the paddock shot)
 *   ?fog=0.012             the farm's and the table's fog density (0.006 since 2026-11-18; the paddock shot keeps 0.012)
 *   ?tilt=1                Home's tilt-shift on (off since 2026-11-18; the paddock shot keeps it, as the wendigo rule says)
 *   ?soft=3                the sun's shadow edge radius (PCFShadowMap; today none)
 *   ?ao=0.25               the mesher's corner shading step (today 0.2)
 *   ?sky=warm              the day sky pale blue overhead to a warm off-white horizon, the fog in the horizon's colour
 *   ?grade=0               Home's palette grade off (docs/depth/DEPTH-PLAN.md, section 3.4)
 * Fog and tilt-shift ship at the lighter values (Brian's picture); the rest are still pairs to look at. The wendigo's
 * paddock shot keeps today's light, fog and tilt-shift (6.2).
 */
import { ACESFilmicToneMapping, AgXToneMapping, NeutralToneMapping } from 'three';
import type { ToneMapping } from 'three';

const q = import.meta.env.DEV && typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
/** The fog the wendigo's paddock shot keeps (CLAUDE.md, the wendigo zone). */
export const PADDOCK_FOG = 0.012;
const num = (k: string): number | null => { const v = q?.get(k); return v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null; };
const TONE: Record<string, ToneMapping> = { aces: ACESFilmicToneMapping, neutral: NeutralToneMapping, agx: AgXToneMapping };

export const LOOK = {
  // Neutral keeps a flat colour its paint (Brian's farm picture; every limit but the wendigo's lifted, 2026-11-19). The
  // wendigo's paddock shot is still drawn under ACES (Effects in table/Rendering.tsx).
  toneMapping: TONE[q?.get('tm') ?? 'neutral'] ?? NeutralToneMapping,
  // Brian's farm picture (2026-11-18, docs/diorama/reference/farm-34.png) is crisp: lighter fog and no tilt-shift, but on
  // the wendigo's paddock shot, which keeps today's (Rendering.tsx). ?fog=0.012 and ?tilt=1 show today's.
  fog: num('fog') ?? 0.006,
  tilt: q?.get('tilt') === '1',
  shadowRadius: num('soft'),
  ao: num('ao'),
  warmSky: q?.get('sky') === 'warm',
  noGrade: q?.get('grade') === '0',
} as const;

/** The warm day sky of `?sky=warm`: [top, horizon]. */
export const WARM_DAY_SKY = ['#8EC3EC', '#F1EDE3'] as const;

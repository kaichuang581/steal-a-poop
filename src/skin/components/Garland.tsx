const SAG = 15;
const AT = [0.1, 0.3, 0.5, 0.7, 0.9];

/**
 * A string of lights hung in swags under a beam: a wire sagging between nails, and on it glass bulbs in red, green
 * and gold, each glowing and twinkling on its own time. The lobby hangs it under its top bar.
 *
 * It used to be a straight wire across the very top of the screen with 24 small squares on it, over a layer of
 * falling dots (Brian, 2026-11-14: "the little lights are horrendous"). The falling dots are gone too: the pen has its
 * own snowfall, and the second one fell across the panels and their text.
 */
export function Garland({ swags = 7 }: { swags?: number }) {
  return (
    <div className="sk-garland" aria-hidden="true">
      {Array.from({ length: swags }, (_, s) => (
        <div key={s} className="sk-garland-wire">
          <svg viewBox="0 0 200 40" preserveAspectRatio="none"><path d={`M0,3 Q100,${3 + SAG * 2} 200,3`} /></svg>
          {AT.map((t, k) => {
            const i = s * AT.length + k;
            // The bulb hangs where the wire is: the curve's own height at this point along it. (When each one twinkles is
            // in skin.css, by its place on the wire.)
            return <i key={k} data-c={i % 3} style={{ left: `${t * 100}%`, top: 3 + 4 * SAG * t * (1 - t) }} />;
          })}
        </div>
      ))}
    </div>
  );
}

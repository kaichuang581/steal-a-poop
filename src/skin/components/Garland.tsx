/** A string of bulbs along the top of the screen and a little snow, for the screens with no 3D scene of their own. */
export function Garland() {
  return (
    <div className="sk-garland" aria-hidden="true">
      <div className="sk-garland-flakes" />
      <div className="sk-garland-wire">
        {/* Each bulb keeps its own time, from a fixed scatter so the pattern does not jump on every render. */}
        {Array.from({ length: 24 }, (_, i) => <i key={i} data-c={i % 3} style={{ animationDelay: `${-((i * 0.618) % 1) * 3}s`, animationDuration: `${1.1 + ((i * 0.377) % 1) * 1.8}s` }} />)}
      </div>
    </div>
  );
}

/** A string of bulbs along the top of the screen and a little snow, for the screens with no 3D scene of their own. */
export function Garland() {
  return (
    <div className="sk-garland" aria-hidden="true">
      <div className="sk-garland-flakes" />
      <div className="sk-garland-wire">
        {Array.from({ length: 24 }, (_, i) => <i key={i} data-c={i % 3} style={{ animationDelay: `${(i % 3) * 0.5}s` }} />)}
      </div>
    </div>
  );
}

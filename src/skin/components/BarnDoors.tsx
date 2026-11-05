/** Full-screen barn doors that swing open on a warm glow, then the view pushes through. Used when a game starts. */
export function BarnDoors() {
  return (
    <div className="sk-doors" aria-hidden="true">
      <div className="sk-doors-glow" />
      <div className="sk-doors-frame">
        <div className="sk-door sk-door-l"><span className="sk-door-brace" /><span className="sk-door-handle" /></div>
        <div className="sk-door sk-door-r"><span className="sk-door-brace" /><span className="sk-door-handle" /></div>
      </div>
    </div>
  );
}

import { useMemo } from 'react';

/** The whole screen goes up: a white flash, a fireball that swallows the view, a red glow that lingers. `power` is the bomb's size. */
export function Jumpscare({ power }: { power: number }) {
  return (
    <div className="sk-jump" aria-hidden="true" style={{ ['--p' as string]: power }}>
      <i className="sk-jump-white" />
      <i className="sk-jump-fire" />
      <i className="sk-jump-fire sk-jump-fire2" />
      <i className="sk-jump-red" />
    </div>
  );
}

/** Every word from the chain bursts out of the bomb, flies across the screen and blows up in turn. */
export function WordBlast({ words, power }: { words: string[]; power: number }) {
  const bits = useMemo(() => words.map((w, i) => {
    const a = (i / Math.max(1, words.length)) * Math.PI * 2 + Math.random() * 0.5;
    const r = 24 + Math.random() * 20;
    return {
      w, key: `${i}-${w}`,
      dx: Math.cos(a) * r * 1.5, dy: Math.sin(a) * r,
      rot: (Math.random() - 0.5) * 70, size: Math.min(88, 30 + w.length * 4.5 + power * 4), delay: i * 28,
    };
  }), [words, power]);
  return (
    <div className="sk-wordblast" aria-hidden="true">
      {bits.map((b) => (
        <span key={b.key} className="sk-wordblast-w" style={{ ['--dx' as string]: `${b.dx}vmin`, ['--dy' as string]: `${b.dy}vmin`, ['--rot' as string]: `${b.rot}deg`, fontSize: b.size, animationDelay: `${b.delay}ms` }}>
          {b.w.toUpperCase()}
        </span>
      ))}
    </div>
  );
}

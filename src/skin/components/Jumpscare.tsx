import { useMemo } from 'react';

/**
 * The ice bomb going off, over the 3D burst rather than instead of it: a short pale flash, a thin shockwave ring, ice
 * shards flung out from the bomb, and frost that creeps in at the screen's edges and thaws. The middle of the screen
 * (the table and the burst) is never covered. `power` is the bomb's size.
 */
export function Jumpscare({ power }: { power: number }) {
  const shards = useMemo(() => Array.from({ length: 18 }, (_, i) => {
    const a = (i / 18) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
    const r = 38 + Math.random() * 26 + power * 4;
    return {
      key: i, dx: Math.cos(a) * r * 1.4, dy: Math.sin(a) * r, rot: (Math.random() - 0.5) * 540,
      w: 10 + Math.random() * 18, delay: Math.random() * 60, tilt: (a * 180) / Math.PI,
    };
  }), [power]);
  return (
    <div className="sk-jump" aria-hidden="true" style={{ ['--p' as string]: power }}>
      <i className="sk-jump-white" />
      <i className="sk-jump-ring" />
      <i className="sk-jump-ring sk-jump-ring2" />
      {shards.map((s) => (
        <i key={s.key} className="sk-jump-shard" style={{
          ['--dx' as string]: `${s.dx}vmin`, ['--dy' as string]: `${s.dy}vmin`, ['--rot' as string]: `${s.rot}deg`, ['--tilt' as string]: `${s.tilt}deg`,
          width: s.w, height: s.w * 2.2, animationDelay: `${s.delay}ms`,
        }} />
      ))}
      <i className="sk-jump-frost" />
    </div>
  );
}

/** Every word from the chain bursts out of the bomb, flies across the screen and shatters in turn. */
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

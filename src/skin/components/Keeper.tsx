export type KeeperMood = 'asleep' | 'idle' | 'happy' | 'startled' | 'proud' | 'sleepy' | 'explaining';

const MOUTH: Record<KeeperMood, string> = {
  asleep: 'M45 61 q5 2 10 0',
  sleepy: 'M45 61 q5 2 10 0',
  idle: 'M44 60 q6 5 12 0',
  explaining: 'M44 59 q6 7 12 0',
  happy: 'M40 58 q10 10 20 0',
  proud: 'M40 58 q10 10 20 0',
  startled: '',
};

/** The table's Keeper: a cream, round creature with a sprout. Never shows text. */
export function Keeper({ mood, size, facing = 'right' }: { mood: KeeperMood; size: number; facing?: 'left' | 'right' }) {
  const closed = mood === 'asleep' || mood === 'sleepy';
  const anim = mood === 'happy' || mood === 'proud' ? 'sk-mood-happy' : mood === 'startled' ? 'sk-mood-startled' : 'sk-bob';
  return (
    <svg
      key={mood}
      viewBox="0 0 100 100" width={size} height={size} aria-hidden="true"
      className={anim}
      style={{ transform: facing === 'left' ? 'scaleX(-1)' : undefined, overflow: 'visible' }}
    >
      <ellipse cx="50" cy="92" rx="30" ry="5" fill="var(--ink)" opacity="0.15" />
      <path d="M50 22 Q48 10 36 7" stroke="var(--sprout)" strokeWidth="3" fill="none" strokeLinecap="round" />
      <ellipse cx="34" cy="6" rx="7" ry="4" fill="var(--sprout)" transform="rotate(-20 34 6)" />
      <ellipse cx="50" cy="56" rx="36" ry="34" fill="var(--keeper)" />
      <ellipse cx="50" cy="66" rx="24" ry="18" fill="var(--keeper-belly)" />
      {closed ? (
        <>
          <path d="M32 50 q4 3 8 0" stroke="var(--ink)" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M60 50 q4 3 8 0" stroke="var(--ink)" strokeWidth="2" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="36" cy="50" r="3.6" fill="var(--ink)" />
          <circle cx="64" cy="50" r="3.6" fill="var(--ink)" />
          <circle cx="37" cy="49" r="1.1" fill="var(--paper)" />
          <circle cx="65" cy="49" r="1.1" fill="var(--paper)" />
        </>
      )}
      <ellipse cx="27" cy="59" rx="5" ry="3" fill="var(--blush)" opacity="0.8" />
      <ellipse cx="73" cy="59" rx="5" ry="3" fill="var(--blush)" opacity="0.8" />
      {mood === 'startled'
        ? <circle cx="50" cy="60" r="4" fill="var(--ink)" />
        : <path d={MOUTH[mood]} stroke="var(--ink)" strokeWidth="2.2" fill="none" strokeLinecap="round" />}
      {mood === 'asleep' && <text x="78" y="26" fontSize="14" fill="var(--ink-soft)" className="sk-hand">z</text>}
    </svg>
  );
}

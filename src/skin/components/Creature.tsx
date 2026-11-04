import type { CreatureId } from '../model/types';

/** A small round creature face for cards: body in the creature's colour, dot eyes, blush. */
export function Creature({ id, size = 36 }: { id: CreatureId; size?: number }) {
  const ears = id === 'pip' || id === 'juniper' || id === 'quill';
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      {ears && (
        <>
          <ellipse cx="11" cy="9" rx="5" ry="8" fill={`var(--creature-${id})`} />
          <ellipse cx="29" cy="9" rx="5" ry="8" fill={`var(--creature-${id})`} />
        </>
      )}
      <circle cx="20" cy="22" r="16" fill={`var(--creature-${id})`} />
      <ellipse cx="20" cy="27" rx="9" ry="6" fill="var(--keeper-belly)" opacity="0.6" />
      <circle cx="14" cy="20" r="2" fill="var(--ink)" />
      <circle cx="26" cy="20" r="2" fill="var(--ink)" />
      <ellipse cx="10" cy="25" rx="3" ry="1.8" fill="var(--blush)" opacity="0.8" />
      <ellipse cx="30" cy="25" rx="3" ry="1.8" fill="var(--blush)" opacity="0.8" />
    </svg>
  );
}

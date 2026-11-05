/**
 * The painted skin is the default (approved by Brian, 2026-11-04). The old look is still there: ?skin=classic, or a
 * build with VITE_SKIN=classic (the end-to-end tests use that, as they are written against the classic screens).
 * ?skin=painted forces the painted skin either way.
 */
export function isPaintedSkin(searchParams?: URLSearchParams, env: string | undefined = import.meta.env.VITE_SKIN): boolean {
  if (searchParams?.get('skin') === 'painted') return true;
  if (searchParams?.get('skin') === 'classic') return false;
  return env !== 'classic';
}

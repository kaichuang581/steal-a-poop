/**
 * The painted skin is on with ?skin=painted or when built with VITE_SKIN=painted; ?skin=classic forces the old look.
 * (The plan's NEXT_PUBLIC_SKIN is a Next.js name; this is a Vite app, which only exposes VITE_* variables.)
 */
export function isPaintedSkin(searchParams?: URLSearchParams, env: string | undefined = import.meta.env.VITE_SKIN): boolean {
  if (searchParams?.get('skin') === 'painted') return true;
  if (searchParams?.get('skin') === 'classic') return false;
  return env === 'painted';
}

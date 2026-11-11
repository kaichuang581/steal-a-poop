/** A short buzz on phones that can (navigator.vibrate). Does nothing on computers, iPhones or where it is refused. */
export function buzz(pattern: number | number[]): void {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator && matchMedia('(pointer: coarse)').matches) navigator.vibrate(pattern);
  } catch { /* not allowed: no buzz */ }
}

/** No 0/O or 1/I, so a code read aloud or off a screen cannot be mistyped. 32 symbols. */
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 5;
export const CODE_PATTERN = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/;

/** Normalizes what a player typed: trims, uppercases, and drops spaces and dashes. */
export function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[\s-]/g, '');
}

/**
 * Makes a code that is not in `taken`. `randomInt(n)` returns an integer in [0, n); production
 * passes crypto.randomInt so codes are hard to guess. Throws only if the space is nearly full.
 */
export function generateCode(taken: ReadonlySet<string>, randomInt: (n: number) => number): string {
  for (let attempt = 0; attempt < 200; attempt++) {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
    if (!taken.has(code)) return code;
  }
  throw new Error('could not find an unused room code');
}

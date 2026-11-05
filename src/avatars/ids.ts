/**
 * The avatars a player can choose. The server only checks that an id is on this list; the art and the descriptions are in
 * src/skin/avatars/catalog.ts, which has a test that keeps the two in step. All names are original: none refers to a real person.
 */
export const AVATAR_IDS = [
  'sheep-dash', 'sheep-velvet', 'sheep-pebble',
  'pig-truffle', 'pig-bramble', 'pig-pudding',
  'cow-clover', 'cow-mae', 'cow-biscuit',
  'goat-rocket', 'goat-gizmo', 'goat-mischief',
  'horse-comet', 'horse-sable', 'horse-sunny',
] as const;

export type AvatarId = (typeof AVATAR_IDS)[number];
export const isAvatarId = (v: unknown): v is AvatarId => typeof v === 'string' && (AVATAR_IDS as readonly string[]).includes(v);

import { describe, expect, it } from 'vitest';
import { AVATAR_IDS } from '../../../avatars/ids';
import { CHARACTERS, byId } from '../catalog';

describe('avatar catalog', () => {
  it('has exactly the ids the server accepts, each once', () => {
    expect(CHARACTERS.map((c) => c.id).sort()).toEqual([...AVATAR_IDS].sort());
  });
  it('has three characters per animal, each with a three-item pack', () => {
    for (const a of ['sheep', 'pig', 'cow', 'goat', 'horse']) expect(CHARACTERS.filter((c) => c.animal === a)).toHaveLength(3);
    for (const c of CHARACTERS) expect(c.pack.items).toHaveLength(3);
  });
  it('looks characters up by id', () => {
    expect(byId('sheep-dash')?.name).toBe('Dash');
    expect(byId('nope')).toBeUndefined();
  });
});

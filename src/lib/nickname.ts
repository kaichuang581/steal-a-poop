export const MAX_NICKNAME = 12;

const BLOCKED = [
  'fuck', 'shit', 'bitch', 'cunt', 'dick', 'cock', 'pussy', 'asshole', 'nigg', 'fag',
  'slut', 'whore', 'rape', 'nazi', 'twat', 'wank', 'porn', 'penis', 'vagina', 'bastard',
];
const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's', '!': 'i' };

function squash(s: string): string {
  const mapped = [...s.toLowerCase()].map((c) => LEET[c] ?? c).join('');
  return mapped.replace(/[^a-z]/g, '').replace(/(.)\1+/g, '$1');
}

const BLOCKED_SQUASHED = BLOCKED.map(squash);

export type NicknameResult = { ok: true; name: string } | { ok: false; message: string };

export function checkNickname(raw: string): NicknameResult {
  // eslint-disable-next-line no-control-regex
  const name = raw.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, MAX_NICKNAME);
  if (!name) return { ok: true, name: '' };
  const flat = squash(name);
  if (BLOCKED_SQUASHED.some((bad) => flat.includes(bad))) {
    return { ok: false, message: 'Please pick a friendlier nickname.' };
  }
  return { ok: true, name };
}

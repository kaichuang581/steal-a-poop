/**
 * Which first screen a player gets. Pure, so it is tested without a browser.
 *  - 'menu': a signed-in player with a profile, or a guest, or a build with no accounts.
 *  - 'landing': nobody is signed in and there is no guest (first visit, or after logging out).
 *  - 'wait': the saved login is still being checked; show nothing rather than flash the wrong screen.
 */
export type Entry = 'menu' | 'landing' | 'wait';

export function decideEntry(input: { accounts: boolean; status: string; hasGuest: boolean }): Entry {
  if (!input.accounts) return 'menu';
  if (input.status === 'off') return 'menu';
  if (input.status === 'loading') return input.hasGuest ? 'menu' : 'wait';
  if (input.status === 'ready') return 'menu';
  if (input.hasGuest) return 'menu';
  return 'landing';
}

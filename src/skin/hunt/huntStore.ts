import { create } from 'zustand';

/**
 * Whether the Hunt screen is open, and a pack code to open it with (a friend's ?pack= link, plan v7 Part 5.1). Hunts are
 * unlimited: the lobby deals a fresh pack or takes a code.
 */
interface HuntUi {
  open: boolean;
  /** A code waiting to be fought; the screen takes it once read. */
  code: string | null;
  openHunt(code?: string): void;
  takeCode(): string | null;
  close(): void;
}

export const useHuntUi = create<HuntUi>((set, get) => ({
  open: false,
  code: null,
  openHunt: (code) => set({ open: true, code: code ?? null }),
  takeCode: () => { const c = get().code; if (c) set({ code: null }); return c; },
  close: () => set({ open: false, code: null }),
}));

/** The address that opens a pack for a friend. */
export function packLink(code: string): string {
  return `${location.origin}${import.meta.env.BASE_URL}?pack=${code}`;
}

/** Reads ?pack= once and tidies the address, so a reload does not start it again. */
export function takePackFromUrl(): string | null {
  const u = new URL(location.href);
  const code = u.searchParams.get('pack');
  if (code === null) return null;
  u.searchParams.delete('pack');
  history.replaceState(null, '', u.toString());
  return code.slice(0, 16);
}

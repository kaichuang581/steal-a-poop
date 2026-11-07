import { create } from 'zustand';

/**
 * Whether Counting Sheep is open, and which dream it is: the night's one attempt, practice (never counts), or a
 * repair of last night's missed dream (V4 Part 12.2 rule 4), played with that night's seed and recorded under it.
 */
interface DreamUi {
  open: boolean;
  practice: boolean;
  /** The missed night being repaired (its date key), or null. */
  repair: string | null;
  openDream(practice?: boolean, repair?: string | null): void;
  close(): void;
}

/** Where a friend can play, for the share text. */
export function dreamLink(): string {
  return `${location.origin}${import.meta.env.BASE_URL}`;
}

export const useDreamUi = create<DreamUi>((set) => ({
  open: false,
  practice: false,
  repair: null,
  openDream: (practice = false, repair = null) => set({ open: true, practice, repair }),
  close: () => set({ open: false, practice: false, repair: null }),
}));

import { create } from 'zustand';

/** Whether the Daily Hunt screen is open, and whether this run counts (the day's one attempt) or is practice. */
interface HuntUi {
  open: boolean;
  practice: boolean;
  openHunt(practice?: boolean): void;
  close(): void;
}

export const useHuntUi = create<HuntUi>((set) => ({
  open: false,
  practice: false,
  openHunt: (practice = false) => set({ open: true, practice }),
  close: () => set({ open: false, practice: false }),
}));

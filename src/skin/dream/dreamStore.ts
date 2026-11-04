import { create } from 'zustand';

/** Whether Counting Sheep is open, and whether this dream counts (the night's one attempt) or is practice. */
interface DreamUi {
  open: boolean;
  practice: boolean;
  openDream(practice?: boolean): void;
  close(): void;
}

export const useDreamUi = create<DreamUi>((set) => ({
  open: false,
  practice: false,
  openDream: (practice = false) => set({ open: true, practice }),
  close: () => set({ open: false, practice: false }),
}));

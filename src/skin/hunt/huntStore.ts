import { create } from 'zustand';

/** Whether the Hunt screen is open. Hunts are unlimited: every one is a fresh pack. */
interface HuntUi {
  open: boolean;
  openHunt(): void;
  close(): void;
}

export const useHuntUi = create<HuntUi>((set) => ({
  open: false,
  openHunt: () => set({ open: true }),
  close: () => set({ open: false }),
}));

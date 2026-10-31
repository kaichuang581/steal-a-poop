import { load, save } from './storage';

const KEY = 'sap:tips';
const TOUR_KEY = 'sap:tourDone';

export function tipSeen(id: string): boolean {
  return load<string[]>(KEY, []).includes(id);
}

export function markTipSeen(id: string): void {
  const seen = load<string[]>(KEY, []);
  if (!seen.includes(id)) save(KEY, [...seen, id]);
}

export function resetTips(): void {
  save(KEY, []);
}

export function isTourDone(): boolean {
  return load<boolean>(TOUR_KEY, false);
}

export function setTourDone(done: boolean): void {
  save(TOUR_KEY, done);
}

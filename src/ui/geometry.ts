/** Rotates seat numbers so `mySeat` lands at index 0, the seat nearest the wide camera shot. */
export function relativeSeat(seat: number, mySeat: number, n: number): number {
  return (seat - mySeat + n) % n;
}

/** Pile heat: cool blue at 0 to hot red at 100+. */
export function pileColor(pile: number): string {
  const t = Math.min(1, pile / 100);
  return `hsl(${Math.round(200 - 195 * t)} 90% ${62 - 6 * t}%)`;
}

/**
 * Seat i sits at 270deg + i * step (math orientation, y up), so seat 0 is at the
 * bottom and increasing seat numbers move counterclockwise: the direction of play.
 */
export function seatPosition(i: number, n: number): { x: number; y: number } {
  const theta = ((270 + (i * 360) / n) * Math.PI) / 180;
  return { x: 50 + 41 * Math.cos(theta), y: 50 - 40 * Math.sin(theta) };
}

/** Rotates seat numbers so `mySeat` lands at index 0, the bottom of the table. */
export function relativeSeat(seat: number, mySeat: number, n: number): number {
  return (seat - mySeat + n) % n;
}

/** Pile heat: cool blue at 0 to hot red at 100+. */
export function pileColor(pile: number): string {
  const t = Math.min(1, pile / 100);
  return `hsl(${Math.round(200 - 195 * t)} 90% ${62 - 6 * t}%)`;
}

/** The pen screen's scale, as pen.css sets --u: Home's (1 at 1280 x 720, 0.8 to 1.5) on a computer, 1 at 390 x 844 on a phone. */
export const penUnit = (W: number, H: number, wide: boolean) =>
  wide ? Math.min(1.5, Math.max(0.8, Math.min(W / 1280, H / 720))) : Math.min(1.2, Math.max(0.8, Math.min(W / 390, H / 844)));

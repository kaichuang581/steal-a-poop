import type { ReactElement } from 'react';

/**
 * Pixel art from rows of characters, for everything in the painted skin that is drawn that way (the icons, the Trading
 * Post's coins and tab marks, the loading sign's sheep): each character is a key into `colors`, anything without a
 * colour is empty, and a run of one character along a row is one rectangle. The one place this is done.
 */
export function pixelRects(rows: readonly string[], colors: Record<string, string>): ReactElement[] {
  const rects: ReactElement[] = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; ) {
      const ch = row[x];
      let run = 1;
      while (x + run < row.length && row[x + run] === ch) run++;
      if (colors[ch]) rects.push(<rect key={`${x},${y}`} x={x} y={y} width={run} height={1} fill={colors[ch]} />);
      x += run;
    }
  });
  return rects;
}

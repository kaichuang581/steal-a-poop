import type { Animal, Character } from './catalog';

/** [x, y, w, h, colour key] on a 12 x 12 grid. Drawn from rects so it stays crisp at any size. */
export type Rect = [number, number, number, number, keyof Character['colors']];

/** Each animal's portrait: the same head, with the one or two things that make it that animal. */
export const PORTRAIT: Record<Animal, Rect[]> = {
  sheep: [
    [1, 1, 10, 10, 'body'], [0, 3, 1, 6, 'body'], [11, 3, 1, 6, 'body'], [3, 0, 6, 1, 'body'], [3, 11, 6, 1, 'body'],
    [2, 2, 1, 1, 'shade'], [9, 2, 1, 1, 'shade'], [2, 9, 1, 1, 'shade'], [9, 9, 1, 1, 'shade'],
    [4, 3, 4, 1, 'dark'], [3, 4, 6, 6, 'dark'], [1, 5, 2, 2, 'shade'], [9, 5, 2, 2, 'shade'],
    [4, 5, 1, 1, 'soft'], [7, 5, 1, 1, 'soft'], [5, 8, 2, 1, 'pop'],
  ],
  pig: [
    [2, 1, 2, 2, 'shade'], [8, 1, 2, 2, 'shade'], [2, 3, 8, 8, 'body'], [2, 10, 8, 1, 'shade'],
    [4, 5, 1, 1, 'dark'], [7, 5, 1, 1, 'dark'], [4, 7, 4, 3, 'shade'], [5, 8, 1, 1, 'pop'], [7, 8, 1, 1, 'pop'],
  ],
  cow: [
    [1, 1, 1, 2, 'pop'], [10, 1, 1, 2, 'pop'], [0, 3, 2, 2, 'shade'], [10, 3, 2, 2, 'shade'], [2, 2, 8, 9, 'body'],
    [2, 2, 3, 2, 'dark'], [8, 6, 2, 2, 'dark'], [4, 5, 1, 1, 'dark'], [7, 5, 1, 1, 'dark'],
    [3, 8, 6, 3, 'soft'], [4, 9, 1, 1, 'shade'], [7, 9, 1, 1, 'shade'],
  ],
  goat: [
    [2, 0, 1, 2, 'pop'], [9, 0, 1, 2, 'pop'], [3, 1, 1, 1, 'pop'], [8, 1, 1, 1, 'pop'], [0, 4, 3, 1, 'shade'], [9, 4, 3, 1, 'shade'],
    [3, 2, 6, 8, 'body'], [3, 9, 6, 1, 'shade'], [4, 4, 1, 1, 'dark'], [7, 4, 1, 1, 'dark'], [5, 7, 2, 1, 'dark'],
    [5, 10, 2, 2, 'soft'],
  ],
  horse: [
    [3, 0, 1, 2, 'body'], [8, 0, 1, 2, 'body'], [3, 1, 6, 10, 'body'], [3, 1, 6, 1, 'pop'], [3, 2, 1, 4, 'pop'],
    [6, 3, 1, 4, 'soft'], [4, 4, 1, 1, 'dark'], [7, 4, 1, 1, 'dark'], [4, 8, 4, 3, 'soft'], [5, 9, 1, 1, 'shade'], [7, 9, 1, 1, 'shade'],
  ],
  chicken: [
    [4, 0, 1, 1, 'pop'], [6, 0, 1, 1, 'pop'], [4, 1, 3, 1, 'pop'], [3, 2, 6, 8, 'body'], [3, 9, 6, 1, 'shade'],
    [4, 4, 1, 1, 'dark'], [7, 4, 1, 1, 'dark'], [5, 6, 2, 1, 'soft'], [5, 7, 2, 1, 'shade'], [5, 8, 2, 2, 'pop'],
  ],
};

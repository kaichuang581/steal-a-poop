// Generated from docs/dream/data/farmer.boxes.json (plan file 01): the farmer, box by box. Do not edit by hand: change the
// data file and copy it across (farmer.test.ts checks the two are the same). One unit is 0.02 m. x: + is his left;
// y: up from the floor; z: + is his front. [part, colour, x0, x1, y0, y1, z0, z1].
export type FarmerBoxPart = 'body' | 'head' | 'cap' | 'capTail' | 'armL' | 'armR' | 'handL' | 'handR' | 'legL' | 'legR' | 'slipperL' | 'slipperR';
export type FarmerBox = readonly [FarmerBoxPart, string, number, number, number, number, number, number];
export const FARMER_BOXES: readonly FarmerBox[] = [
  ['slipperL', '#9E968C', 2.5, 10.5, 0, 1, -4.5, 8.5], // slipper sole (his left)
  ['slipperR', '#9E968C', -10.5, -2.5, 0, 1, -4.5, 8.5], // slipper sole (his right)
  ['slipperL', '#B8B0A6', 2.5, 10.5, 1, 4, -4.5, 8.5], // slipper (his left)
  ['slipperR', '#B8B0A6', -10.5, -2.5, 1, 4, -4.5, 8.5], // slipper (his right)
  ['slipperL', '#C9C1B6', 2.5, 10.5, 4, 5, -4.5, 6.5], // slipper top (his left)
  ['slipperR', '#C9C1B6', -10.5, -2.5, 4, 5, -4.5, 6.5], // slipper top (his right)
  ['legL', '#4A3A2C', 3.5, 9.5, 5, 9, -3.5, 2.5], // leg (his left)
  ['legR', '#4A3A2C', -9.5, -3.5, 5, 9, -3.5, 2.5], // leg (his right)
  ['body', '#D8D0C4', -11.5, 11.5, 9, 10, -7.5, 7.5], // hem row
  ['body', '#E6DFD3', -11.5, 11.5, 10, 25, -7.5, 7.5], // skirt
  ['body', '#E6DFD3', -10.5, 10.5, 25, 55, -6.5, 6.5], // chest
  ['body', '#E6DFD3', -9.5, 9.5, 55, 56, -6.5, 6.5], // shoulder row
  ['body', '#8F97AC', -8.5, -7.5, 10, 25, 7.5, 7.7], // front stripe -8
  ['body', '#8F97AC', -8.5, -7.5, 25, 55, 6.5, 6.7], // front stripe -8 upper
  ['body', '#8F97AC', -8.5, -7.5, 10, 25, -7.7, -7.5], // back stripe -8
  ['body', '#8F97AC', -8.5, -7.5, 25, 55, -6.7, -6.5], // back stripe -8 upper
  ['body', '#8F97AC', -4.5, -3.5, 10, 25, 7.5, 7.7], // front stripe -4
  ['body', '#8F97AC', -4.5, -3.5, 25, 55, 6.5, 6.7], // front stripe -4 upper
  ['body', '#8F97AC', -4.5, -3.5, 10, 25, -7.7, -7.5], // back stripe -4
  ['body', '#8F97AC', -4.5, -3.5, 25, 55, -6.7, -6.5], // back stripe -4 upper
  ['body', '#8F97AC', -0.5, 0.5, 10, 25, 7.5, 7.7], // front stripe 0
  ['body', '#8F97AC', -0.5, 0.5, 25, 38, 6.5, 6.7], // front stripe 0 upper
  ['body', '#8F97AC', -0.5, 0.5, 10, 25, -7.7, -7.5], // back stripe 0
  ['body', '#8F97AC', -0.5, 0.5, 25, 55, -6.7, -6.5], // back stripe 0 upper
  ['body', '#8F97AC', 3.5, 4.5, 10, 25, 7.5, 7.7], // front stripe 4
  ['body', '#8F97AC', 3.5, 4.5, 25, 55, 6.5, 6.7], // front stripe 4 upper
  ['body', '#8F97AC', 3.5, 4.5, 10, 25, -7.7, -7.5], // back stripe 4
  ['body', '#8F97AC', 3.5, 4.5, 25, 55, -6.7, -6.5], // back stripe 4 upper
  ['body', '#8F97AC', 7.5, 8.5, 10, 25, 7.5, 7.7], // front stripe 8
  ['body', '#8F97AC', 7.5, 8.5, 25, 55, 6.5, 6.7], // front stripe 8 upper
  ['body', '#8F97AC', 7.5, 8.5, 10, 25, -7.7, -7.5], // back stripe 8
  ['body', '#8F97AC', 7.5, 8.5, 25, 55, -6.7, -6.5], // back stripe 8 upper
  ['body', '#8F97AC', 11.5, 11.7, 10, 25, -4.5, -3.5], // side stripe z-4
  ['body', '#8F97AC', 10.5, 10.7, 25, 55, -4.5, -3.5], // side stripe z-4 upper
  ['body', '#8F97AC', -11.7, -11.5, 10, 25, -4.5, -3.5], // side stripe z-4
  ['body', '#8F97AC', -10.7, -10.5, 25, 55, -4.5, -3.5], // side stripe z-4 upper
  ['body', '#8F97AC', 11.5, 11.7, 10, 25, -0.5, 0.5], // side stripe z0
  ['body', '#8F97AC', 10.5, 10.7, 25, 55, -0.5, 0.5], // side stripe z0 upper
  ['body', '#8F97AC', -11.7, -11.5, 10, 25, -0.5, 0.5], // side stripe z0
  ['body', '#8F97AC', -10.7, -10.5, 25, 55, -0.5, 0.5], // side stripe z0 upper
  ['body', '#8F97AC', 11.5, 11.7, 10, 25, 3.5, 4.5], // side stripe z4
  ['body', '#8F97AC', 10.5, 10.7, 25, 55, 3.5, 4.5], // side stripe z4 upper
  ['body', '#8F97AC', -11.7, -11.5, 10, 25, 3.5, 4.5], // side stripe z4
  ['body', '#8F97AC', -10.7, -10.5, 25, 55, 3.5, 4.5], // side stripe z4 upper
  ['body', '#D8D0C4', -0.5, 0.5, 38, 52, 6.5, 6.8], // placket
  ['body', '#BFB6AA', -0.5, 0.5, 40, 41, 6.8, 7], // button 40
  ['body', '#BFB6AA', -0.5, 0.5, 44, 45, 6.8, 7], // button 44
  ['body', '#BFB6AA', -0.5, 0.5, 48, 49, 6.8, 7], // button 48
  ['body', '#C9A589', -1.5, 1.5, 54, 56, 6.5, 6.8], // collar V top
  ['body', '#C9A589', -0.5, 0.5, 52, 54, 6.5, 6.9], // collar V foot
  ['armL', '#E6DFD3', 10.5, 16.5, 42, 54, -3.5, 2.5], // upper sleeve (his left)
  ['armR', '#E6DFD3', -16.5, -10.5, 42, 54, -3.5, 2.5], // upper sleeve (his right)
  ['armL', '#E6DFD3', 11.5, 19.5, 32, 42, -3.5, 3.5], // lower sleeve (his left)
  ['armR', '#E6DFD3', -19.5, -11.5, 32, 42, -3.5, 3.5], // lower sleeve (his right)
  ['armL', '#D8D0C4', 11.5, 19.5, 30, 32, -3.5, 3.5], // cuff (his left)
  ['armR', '#D8D0C4', -19.5, -11.5, 30, 32, -3.5, 3.5], // cuff (his right)
  ['armL', '#8F97AC', 12.5, 13.5, 42, 54, 2.5, 2.7], // sleeve stripe 13
  ['armL', '#8F97AC', 12.5, 13.5, 42, 54, -3.7, -3.5], // sleeve stripe back 13
  ['armR', '#8F97AC', -13.5, -12.5, 42, 54, 2.5, 2.7], // sleeve stripe -13
  ['armR', '#8F97AC', -13.5, -12.5, 42, 54, -3.7, -3.5], // sleeve stripe back -13
  ['armL', '#8F97AC', 13.5, 14.5, 32, 42, 3.5, 3.7], // sleeve stripe 14
  ['armL', '#8F97AC', 13.5, 14.5, 32, 42, -3.7, -3.5], // sleeve stripe back 14
  ['armR', '#8F97AC', -14.5, -13.5, 32, 42, 3.5, 3.7], // sleeve stripe -14
  ['armR', '#8F97AC', -14.5, -13.5, 32, 42, -3.7, -3.5], // sleeve stripe back -14
  ['armL', '#8F97AC', 17.5, 18.5, 32, 42, 3.5, 3.7], // sleeve stripe 18
  ['armL', '#8F97AC', 17.5, 18.5, 32, 42, -3.7, -3.5], // sleeve stripe back 18
  ['armR', '#8F97AC', -18.5, -17.5, 32, 42, 3.5, 3.7], // sleeve stripe -18
  ['armR', '#8F97AC', -18.5, -17.5, 32, 42, -3.7, -3.5], // sleeve stripe back -18
  ['handL', '#E3C6AB', 12.5, 18.5, 24, 30, -2.5, 2.5], // hand (his left)
  ['handR', '#E3C6AB', -18.5, -12.5, 24, 30, -2.5, 2.5], // hand (his right)
  ['handL', '#E3C6AB', 13.5, 17.5, 23, 24, -2.5, 2.5], // fingers (his left)
  ['handR', '#E3C6AB', -17.5, -13.5, 23, 24, -2.5, 2.5], // fingers (his right)
  ['handL', '#D6B596', 12.5, 14.5, 26, 28, 2.5, 3.5], // thumb (his left)
  ['handR', '#D6B596', -14.5, -12.5, 26, 28, 2.5, 3.5], // thumb (his right)
  ['head', '#C9A589', -3.5, 3.5, 56, 58, -3.5, 3.5], // neck
  ['head', '#E3C6AB', -8.5, 8.5, 58, 74, -8.5, 8.5], // head
  ['head', '#D6B596', 8.5, 9.5, 64, 68, -1.5, 1.5], // ear (his left)
  ['head', '#D6B596', -9.5, -8.5, 64, 68, -1.5, 1.5], // ear (his right)
  ['head', '#B9B2A6', -8.5, 8.5, 60, 73, -9.5, -8.5], // hair back
  ['head', '#B9B2A6', 8.5, 9.5, 60, 73, -9.5, -2.5], // hair side (his left)
  ['head', '#B9B2A6', -9.5, -8.5, 60, 73, -9.5, -2.5], // hair side (his right)
  ['head', '#B9B2A6', 8.5, 9.5, 68, 73, -2.5, 8.5], // hair side upper (his left)
  ['head', '#B9B2A6', -9.5, -8.5, 68, 73, -2.5, 8.5], // hair side upper (his right)
  ['head', '#3D2818', 3.5, 5.5, 68, 70, 8.5, 8.7], // eye (his left)
  ['head', '#3D2818', -5.5, -3.5, 68, 70, 8.5, 8.7], // eye (his right)
  ['head', '#7A6C5C', 2.5, 6.5, 71, 72, 8.5, 9.5], // brow (his left)
  ['head', '#7A6C5C', -6.5, -2.5, 71, 72, 8.5, 9.5], // brow (his right)
  ['head', '#D6B596', -1.5, 1.5, 64, 69, 8.5, 10.5], // nose
  ['head', '#B9B2A6', -8.5, 8.5, 58, 62, 8.5, 10.5], // beard on the face
  ['head', '#B9B2A6', 6.5, 8.5, 62, 73, 8.5, 9.5], // sideburn (his left)
  ['head', '#B9B2A6', -8.5, -6.5, 62, 73, 8.5, 9.5], // sideburn (his right)
  ['head', '#B9B2A6', -4.5, 4.5, 62, 64, 8.5, 9.5], // moustache
  ['head', '#A69E92', -3.5, 3.5, 60, 61, 10.5, 10.7], // beard shade row
  ['head', '#6A5142', -1.5, 1.5, 61, 62, 10.5, 10.8], // mouth
  ['head', '#B9B2A6', -6.5, 6.5, 56, 58, 3.5, 10.5], // beard under the chin
  ['head', '#B9B2A6', -4.5, 4.5, 55, 56, 6.9, 10.5], // beard tip
  ['cap', '#E1DAD0', -9.5, 9.5, 73, 74, -9.5, 9.5], // brim
  ['cap', '#B5594C', -9.5, 9.5, 74, 75, -9.5, 9.5], // band
  ['cap', '#E1DAD0', -9.5, 9.5, 75, 78, -9.5, 9.5], // dome 1
  ['cap', '#E1DAD0', -8.5, 8.5, 78, 80, -8.5, 8.5], // dome 2
  ['cap', '#E1DAD0', -7.5, 7.5, 80, 82, -7.5, 7.5], // dome 3
  ['cap', '#E1DAD0', -5.5, 5.5, 82, 84, -5.5, 5.5], // dome 4
  ['capTail', '#E1DAD0', 9.5, 12.5, 75, 79, -1.5, 1.5], // tail root
  ['capTail', '#E1DAD0', 9.5, 12.5, 65, 75, -1.5, 1.5], // tail
  ['capTail', '#B5594C', 9.5, 12.5, 64, 65, -1.5, 1.5], // tail ring
  ['capTail', '#E9E3DA', 8.5, 13.5, 59, 64, -2.5, 2.5], // pom-pom
];

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { Vector3 } from 'three';
import { HEAP } from '../scene/layout';
import { barnSpot } from '../table/Bomb';
import { BOARD } from '../voxel/table';
import { clearMarks, rectAround, setMark } from './marks';

/** The letter board's middle: it hangs over the table from one hook and turns to face the camera (BarnTable's LetterBoard). */
const BOARD_AT = [HEAP[0], BOARD.bottom + BOARD.height / 2, 1.0] as const;
/** The bomb sits on the floor by the speaker's hooves, its fuse standing about as tall again as its shell with the spark
 *  on top: the box takes in all of it, from the floor to the spark. */
const BOMB = { midY: 0.92, halfW: 0.52, halfH: 0.98 };

/**
 * Inside the barn's scene during the tutorial: works out, every frame, where the letter board and the bomb are on
 * screen, for the guide's ring (see marks.ts). It draws nothing.
 */
export function TourMarks({ speaker, n }: { speaker: number | null; n: number }) {
  const v = useMemo(() => ({ c: new Vector3(), right: new Vector3(), up: new Vector3(), p: new Vector3() }), []);
  const spot = useMemo(() => (speaker === null ? null : barnSpot(speaker, n)(0.3)), [speaker, n]);
  useEffect(() => clearMarks, []);
  useFrame(({ camera, gl }) => {
    const box = gl.domElement.getBoundingClientRect();
    v.right.setFromMatrixColumn(camera.matrixWorld, 0);
    v.up.setFromMatrixColumn(camera.matrixWorld, 1);
    // A camera-facing box round `centre`, half as wide as `hw` and half as tall as `hh`.
    const around = (centre: readonly [number, number, number], hw: number, hh: number) => {
      const pts = [];
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
        v.p.set(centre[0], centre[1], centre[2]).addScaledVector(v.right, sx * hw).addScaledVector(v.up, sy * hh).project(camera);
        pts.push({ x: v.p.x, y: v.p.y, z: v.p.z });
      }
      return rectAround(pts, box);
    };
    setMark('board', around(BOARD_AT, BOARD.width / 2, BOARD.height / 2));
    setMark('bomb', spot ? around([spot[0], BOMB.midY, spot[1]], BOMB.halfW, BOMB.halfH) : null);
  });
  return null;
}

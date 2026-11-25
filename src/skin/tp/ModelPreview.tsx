import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useMemo } from 'react';
import { Color, Group, PerspectiveCamera, Scene, SRGBColorSpace } from 'three';
import { LOOK } from '../look';
import { Board } from '../dream/world3d/DreamPropBoard';
import { COLOURS, MODELS } from './models';
import { makeBomb } from './bomb';
import { makeBurst } from './burst';
import { BURSTS, SKINS } from './models.gen';

/**
 * Every model of the Trading Post and Practice pack on a plain floor (X2 step S1; development only,
 * `?preview=models&board=bombs|sounds|market|rink`), straight from in front, to lay beside reference/models-*.png.
 */
const BOARDS: Record<string, { title: string; ids: string[] }> = {
  bombs: { title: 'The eight bombs (T2), with their maker\'s mark', ids: ['bomb_ice', 'bomb_ember', 'bomb_peppermint', 'bomb_plum', 'bomb_gold', 'bomb_diamond', 'bomb_brassBell', 'bomb_aurora'] },
  sounds: { title: 'The eight fuse sounds (T4)', ids: ['sound_iceChime', 'sound_eightBit', 'sound_woodBlock', 'sound_cowbell', 'sound_sleighBells', 'sound_musicBox', 'sound_owl', 'sound_lullaby'] },
  market: { title: 'The market row (T1, T5, T6)', ids: ['feedStall', 'sack_oat', 'sack_corn', 'sack_barley', 'sackCrate_straw', 'sackCrate_brass', 'sackCrate_wood', 'sampleBench', 'oddsBoard', 'barrel', 'stallLantern', 'rowPost', 'bellStand', 'bigBell', 'noticeBoard', 'barnBook8', 'barnBook10'] },
  rink: { title: 'The rink (P1, P2, P3)', ids: ['rinkBoards', 'rinkBoardsFront', 'tileRack', 'snowBank', 'tallyBoard', 'coachChair', 'whistle', 'practiceCrate', 'broom', 'lightPost', 'iceBlock', 'bibEasy', 'bibMedium', 'bibHard'] },
};
const CELL = { w: 340, h: 360, label: 40 }, COLS = 4;

export function ModelPreview() {
  const which = new URLSearchParams(location.search).get('board') ?? 'bombs';
  if (which === 'seconds' || which === 'bursts') return <ObjectPreview board={which} />;
  const board = BOARDS[which] ?? BOARDS.bombs;
  const rows = Math.ceil(board.ids.length / COLS), H = 60 + rows * CELL.h;
  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'auto', background: '#ECEBE6' }}>
      <div style={{ position: 'relative', width: COLS * CELL.w, height: H }}>
        <p style={{ position: 'absolute', left: 14, top: 14, margin: 0, font: '800 19px Nunito, sans-serif', color: '#2E2A2A' }}>{board.title}</p>
        <Canvas style={{ position: 'absolute', left: 0, top: 60, width: COLS * CELL.w, height: rows * CELL.h }} gl={{ outputColorSpace: SRGBColorSpace, toneMapping: LOOK.toneMapping, antialias: true }} dpr={1}>
          <Board ids={board.ids} models={MODELS} colours={COLOURS} front cell={CELL} cols={COLS} />
        </Canvas>
        {board.ids.map((id, i) => {
          const m = MODELS[id];
          return <p key={id} style={{ position: 'absolute', left: (i % COLS) * CELL.w + 12, top: 60 + Math.floor(i / COLS) * CELL.h + CELL.h - CELL.label + 8, margin: 0, font: '700 14px Nunito, sans-serif', color: '#2E2A2A' }}>{`${id}   ${m.size.join(' x ')} m   ${m.boxes.length} boxes`}</p>;
        })}
      </div>
    </div>
  );
}

/**
 * Built objects on the same studio floor: `?preview=models&board=seconds` (S2: every skin at 12 s, 3 s and 1 s, the
 * fuse burnt to match) and `board=bursts` (S3: the ten at their fullest, 300 ms, or `&ms=` another moment).
 */
export function ObjectPreview({ board }: { board: 'seconds' | 'bursts' }) {
  const ms = Number(new URLSearchParams(location.search).get('ms') ?? 300);
  const skins = Object.keys(SKINS);
  const cells: { label: string; make: () => Group; size: number; midY: number }[] = board === 'seconds'
    ? skins.flatMap((k) => [12, 3, 1].map((sec) => ({
      label: `${SKINS[k].name}, ${sec} s`, size: 0.85, midY: 0.39,
      make: () => { const b = makeBomb(k); b.setSeconds(sec, sec <= 3); b.setFuse(sec / 15); b.setSpark(sec <= 3 ? 1.6 : 1); return b.group; },
    })))
    : Object.keys(BURSTS).map((k) => ({ label: `${BURSTS[k].name}, ${ms} ms`, size: 2.2, midY: 0.75, make: () => { const b = makeBurst(k); b.at(ms); const g = new Group(); g.add(b.group, makeBomb('ice').group); g.children[1].visible = false; return g; } }));
  const cols = board === 'seconds' ? 6 : 5, cell = { w: 230, h: 260, label: 30 };
  const rows = Math.ceil(cells.length / cols);
  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'auto', background: '#ECEBE6' }}>
      <div style={{ position: 'relative', width: cols * cell.w, height: 60 + rows * cell.h }}>
        <p style={{ position: 'absolute', left: 14, top: 14, margin: 0, font: '800 19px Nunito, sans-serif', color: '#2E2A2A' }}>{board === 'seconds' ? 'Every skin at 12 s, 3 s and 1 s (T2): the seconds on the face, the fuse burnt down' : 'The ten bursts (T3)'}</p>
        <Canvas style={{ position: 'absolute', left: 0, top: 60, width: cols * cell.w, height: rows * cell.h }} gl={{ outputColorSpace: SRGBColorSpace, toneMapping: LOOK.toneMapping, antialias: true }} dpr={1}>
          <Objects cells={cells} cols={cols} cell={cell} />
        </Canvas>
        {cells.map((c, i) => <p key={i} style={{ position: 'absolute', left: (i % cols) * cell.w + 12, top: 60 + Math.floor(i / cols) * cell.h + cell.h - cell.label + 4, margin: 0, font: '700 13px Nunito, sans-serif', color: '#2E2A2A' }}>{c.label}</p>)}
      </div>
    </div>
  );
}

function Objects({ cells, cols, cell }: { cells: { make: () => Group; size: number; midY: number }[]; cols: number; cell: { w: number; h: number; label: number } }) {
  const gl = useThree((s) => s.gl);
  const items = useMemo(() => cells.map((c) => {
    const scene = new Scene();
    scene.background = new Color('#ECEBE6');
    scene.add(c.make());
    const cam = new PerspectiveCamera(30, cell.w / (cell.h - cell.label), 0.05, 50);
    cam.position.set(0, c.midY, c.size * 2.2);
    cam.lookAt(0, c.midY, 0);
    return { scene, cam };
  }), [cells, cell]);
  useFrame(() => {
    const H = Math.ceil(cells.length / cols) * cell.h;
    gl.setScissorTest(true);
    items.forEach(({ scene, cam }, i) => {
      const x = (i % cols) * cell.w, y = H - (Math.floor(i / cols) + 1) * cell.h + cell.label;
      gl.setViewport(x, y, cell.w, cell.h - cell.label);
      gl.setScissor(x, y, cell.w, cell.h - cell.label);
      gl.render(scene, cam);
    });
    gl.setScissorTest(false);
  }, 1);
  return null;
}


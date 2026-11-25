import { Canvas } from '@react-three/fiber';
import { SRGBColorSpace } from 'three';
import { LOOK } from '../look';
import { Board } from '../dream/world3d/DreamPropBoard';
import { COLOURS, MODELS } from './models';

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
  const board = BOARDS[new URLSearchParams(location.search).get('board') ?? 'bombs'] ?? BOARDS.bombs;
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

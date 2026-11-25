import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useMemo } from 'react';
import { Color, DirectionalLight, Group, HemisphereLight, Mesh, MeshBasicMaterial, MeshLambertMaterial, PerspectiveCamera, Scene, SRGBColorSpace } from 'three';
import { LOOK } from '../../look';
import { meshModel, toGeometry } from '../models';
import { COLOURS, GLOW, MODELS } from '../models.gen';

/**
 * The prop board (docs/dream/v3/03, section 9, check 3; development only, `?preview=dreamprops&board=farm|world2|
 * world3|obstacles`): every model of the dream alone on the studio's off-white, in the order and grouping of the pack's
 * four reference boards, so the game's models can be laid beside reference/models-*.png.
 */
const BOARDS: Record<string, { title: string; ids: string[] }> = {
  farm: { title: 'The farm models (worlds 1 and 2). Each is a small copy of something on Home', ids: ['barn', 'silo', 'farmhouse', 'windmill', 'coop', 'scarecrow', 'baleStack', 'pineSpire', 'pineCone', 'pineRound', 'fenceBay', 'wallBay', 'pond', 'gateFarm', 'shrubMound', 'stump', 'log', 'snowman'] },
  world2: { title: 'World 2: the islands, the floating track, the clods and the moons', ids: ['islandBarn', 'islandHouse', 'islandMill', 'islandYard', 'laneBayFloat', 'clodSmall', 'clodWide', 'moonCrescent', 'moonFull'] },
  world3: { title: 'World 3: his bed, his quilt and his knitting things', ids: ['quiltPatch0', 'quiltPatch1', 'quiltPatch2', 'quiltPatch3', 'quiltPatch4', 'quiltPatchFar0', 'quiltPatchFar1', 'quiltPatchFar2', 'quiltPatchFar3', 'quiltPatchFar4', 'candle', 'yarnBall', 'needles', 'spool', 'buttonBrass', 'buttonCream', 'buttonRed', 'bedpost', 'gateFootboard', 'gateHeadboard', 'laneBayBed0', 'laneBayBed1', 'laneBayBed2', 'laneBayBed3', 'feather'] },
  obstacles: { title: 'What the sheep jumps, and the signpost', ids: ['obGate', 'obPlanks', 'obBrick', 'obLogs', 'obBales', 'obCrates', 'obGateIced', 'obPlanksIced', 'obBrickIced', 'obLogsIced', 'obBalesIced', 'obCratesIced', 'obBooks', 'obPillows', 'obSpools', 'obClock', 'signpost'] },
};
const COLS = 5, CELL = { w: 360, h: 334, label: 40 };

export function DreamPropBoard() {
  const board = BOARDS[new URLSearchParams(location.search).get('board') ?? 'farm'] ?? BOARDS.farm;
  const rows = Math.ceil(board.ids.length / COLS), H = 60 + rows * CELL.h;
  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'auto', background: '#ECEBE6' }}>
      <div style={{ position: 'relative', width: COLS * CELL.w, height: H }}>
        <p style={{ position: 'absolute', left: 14, top: 14, margin: 0, font: '800 19px Nunito, sans-serif', color: '#2E2A2A' }}>{board.title}</p>
        <Canvas style={{ position: 'absolute', left: 0, top: 60, width: COLS * CELL.w, height: rows * CELL.h }} gl={{ outputColorSpace: SRGBColorSpace, toneMapping: LOOK.toneMapping, antialias: true }} dpr={1}>
          <Board ids={board.ids} />
        </Canvas>
        {board.ids.map((id, i) => {
          const m = MODELS[id], [x0, y0, z0, x1, y1, z1] = m.bounds, s = (v: number) => (v * m.cell).toFixed(2).replace(/\.?0+$/, '');
          return <p key={id} style={{ position: 'absolute', left: (i % COLS) * CELL.w + 12, top: 60 + Math.floor(i / COLS) * CELL.h + CELL.h - CELL.label + 8, margin: 0, font: '700 14px Nunito, sans-serif', color: '#2E2A2A' }}>{`${id}   ${s(x1 - x0)} x ${s(y1 - y0)} x ${s(z1 - z0)} m   ${m.boxes.length} boxes`}</p>;
        })}
      </div>
    </div>
  );
}

/** Draws each model into its own cell of the one canvas, framed from in front, to the left and above. */
function Board({ ids }: { ids: string[] }) {
  const gl = useThree((s) => s.gl);
  const items = useMemo(() => ids.map((id) => {
    const m = MODELS[id], mm = meshModel(id, m, COLOURS, GLOW, { festive: true, back: true });
    const scene = new Scene(), g = new Group();
    g.add(new Mesh(toGeometry(mm.lit), new MeshLambertMaterial({ vertexColors: true })));
    if (mm.glow.idx.length) g.add(new Mesh(toGeometry(mm.glow), new MeshBasicMaterial({ vertexColors: true })));
    scene.add(g, new HemisphereLight('#FFFFFF', '#8A8580', 1.6));
    const sun = new DirectionalLight('#FFFFFF', 2.2);
    sun.position.set(-3, 6, 5);
    scene.add(sun);
    scene.background = new Color('#ECEBE6');
    const [x0, y0, z0, x1, y1, z1] = m.bounds.map((v) => v * m.cell);
    const size = Math.max(x1 - x0, y1 - y0, z1 - z0), mid = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
    const cam = new PerspectiveCamera(30, CELL.w / (CELL.h - CELL.label), size * 0.1, size * 20);
    const d = size * 2.3;
    cam.position.set(mid[0] - d * 0.32, mid[1] + d * 0.38, mid[2] + d * 0.86);
    cam.lookAt(mid[0], mid[1], mid[2]);
    return { scene, cam };
  }), [ids]);
  useFrame(() => {
    const rows = Math.ceil(ids.length / COLS), H = rows * CELL.h;
    gl.setScissorTest(true);
    items.forEach(({ scene, cam }, i) => {
      const x = (i % COLS) * CELL.w, y = H - (Math.floor(i / COLS) + 1) * CELL.h + CELL.label;
      gl.setViewport(x, y, CELL.w, CELL.h - CELL.label);
      gl.setScissor(x, y, CELL.w, CELL.h - CELL.label);
      gl.render(scene, cam);
    });
    gl.setScissorTest(false);
  }, 1);
  return null;
}

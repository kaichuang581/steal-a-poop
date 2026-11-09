import { useState, type ReactNode } from 'react';
import { Board, Brass, Clipboard, ClothButton, Ice, Knit, Lever, Panel, PanelRow, Paper, Patch, Peg, RopeSlider, Slate, Tag, Tally, Tile, WoodButton } from '.';
import { CloseIcon, GearIcon, HelpIcon, LockIcon, PinIcon, ShareIcon, SpeakerIcon } from '../components/Icons';

/** ?preview=kit (V6 Part 4.13): every material in every size, tone and state, on paper, on barn wood and on the dream's violet. */
const GROUNDS: [string, string][] = [
  ['paper', 'var(--paper)'],
  ['barn wood', 'var(--kit-grain), #6E4423'],
  ['the dream', '#2A2346'],
];

const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 18, padding: '14px 0' }}>
    <span style={{ width: 90, fontFamily: 'var(--skin-font-body)', fontSize: 12, fontWeight: 800, opacity: 0.7 }}>{label}</span>
    {children}
  </div>
);

export default function KitPreview() {
  const [on, setOn] = useState(true);
  const [vol, setVol] = useState(60);
  const [tab, setTab] = useState('game');
  const still = new URLSearchParams(location.search).get('motion') === '0';
  return (
    <div className={still ? 'reduce-motion' : undefined} style={{ minHeight: '100vh', overflow: 'auto' }}>
      {GROUNDS.map(([name, bg]) => (
        <section key={name} style={{ background: bg, color: name === 'paper' ? 'var(--ink)' : 'var(--button-text)', padding: '24px 16px 40px' }}>
          <h2 style={{ fontFamily: 'var(--skin-font-display)', fontSize: 22, margin: '0 0 8px' }}>On {name}</h2>
          <Row label="Boards">
            <Board size="heading" hang="nails" snow id={`${name}-a`}>Your turn!</Board>
            <Board size="label" tone="light" id={`${name}-b`}>v0.3.0</Board>
            <Board size="label" tone="barn" hang="nails" id={`${name}-c`}>Steal!</Board>
            <Board size="label" tone="green" id={`${name}-d`}>Play</Board>
            <div style={{ marginTop: 44 }}><Board size="heading" hang="ropes" swing id={`${name}-e`}>Round 2</Board></div>
          </Row>
          <Row label="Paper">
            <Paper kind="slip" pin="top" seed={1}>A slip of paper</Paper>
            <Paper kind="note" pin="corner" seed={2} tilt style={{ maxWidth: 220 }}>A note: a few lines in the farmer's hand.</Paper>
            <Paper kind="ticket" seed={3}><PinIcon size={16} /> Quick game</Paper>
            <Tag tone="gold">New</Tag><Tag tone="green">Farm sheep</Tag><Tag tone="gray">Soon</Tag><Tag tone="flame">Best</Tag>
            <button className="kit-paper kit-paper--slip kit-paper--lift" data-seed="0">Lifting paper</button>
          </Row>
          <Row label="Tiles">
            {(['mini', 'sm', 'md', 'lg'] as const).map((s) => <Tile key={s} size={s}>W</Tile>)}
            <Tile lit>O</Tile><Tile bad>R</Tile><Tile done>D</Tile><Tile trap>X</Tile>
            <span style={{ marginTop: 16 }}><Tile hung>H</Tile></span>
          </Row>
          <Row label="Slates">
            <Slate size="mini">7</Slate>
            <Slate size="plaque">42<span className="kit-chalk-hand">words</span></Slate>
            <Slate size="plaque" tone="amber">Best 51</Slate>
            <Slate size="plaque" tone="coral">2s</Slate>
            <Slate size="board" style={{ width: 240 }}>
              <div className="kit-slate-row kit-chalk-ring">Brian <Tally have={2} of={3} /></div>
              <div className="kit-slate-row">Maya <Tally have={3} of={3} /></div>
              <div className="kit-slate-row"><span className="kit-chalk-strike">Clover</span> <Tally have={0} of={3} /></div>
            </Slate>
          </Row>
          <Row label="Patches">
            {(['burlap', 'cream', 'gold', 'green', 'gray', 'flame'] as const).map((t) => <Patch key={t} tone={t}>{t}</Patch>)}
            <Patch as="button" pressed>Pressed</Patch>
            <Patch as="button" disabled>Disabled</Patch>
            <Patch tone="gold" small>Small tag</Patch>
          </Row>
          <Row label="Knit">
            <div style={{ width: 200 }}><Knit /></div>
            <div style={{ width: 200 }}><Knit height={20} segments={5} filled={3} /></div>
            <Knit stitches={['played', 'played', 'missed', 'repair', 'blanket', 'played', 'today']} />
          </Row>
          <Row label="Buttons">
            <Brass>Start now</Brass>
            <Brass barn>Steal</Brass>
            <WoodButton>Back</WoodButton>
            <ClothButton>Play again</ClothButton>
            <Brass disabled>Disabled</Brass>
            <Peg aria-label="Settings"><GearIcon size={20} /></Peg>
            <Peg aria-label="Sound" aria-pressed><SpeakerIcon size={20} /></Peg>
            <Peg light aria-label="Help"><HelpIcon size={20} /></Peg>
            <Peg aria-label="Admin" data-admin=""><LockIcon size={18} /></Peg>
            <Peg small aria-label="Share"><ShareIcon size={16} /></Peg>
            <Peg small light aria-label="Close"><CloseIcon size={16} /></Peg>
          </Row>
          <Row label="Controls">
            <Panel style={{ width: 300 }}>
              <PanelRow label="Sound"><Lever checked={on} onChange={setOn} label="Sound" /></PanelRow>
              <PanelRow label="Volume"><RopeSlider min={0} max={100} value={vol} onChange={(e) => setVol(+e.target.value)} aria-label="Volume" /></PanelRow>
              <PanelRow label="Hints"><Lever checked={!on} onChange={(v) => setOn(!v)} label="Hints" /></PanelRow>
            </Panel>
            <Ice style={{ padding: '10px 16px', fontFamily: 'var(--skin-font-display)', fontWeight: 800 }}>Frozen: -1 wool</Ice>
          </Row>
          <Row label="Clipboard">
            <div style={{ position: 'relative' }}>
              <Clipboard aria-label="Settings" title="Settings" onClose={() => {}} tabs={[{ id: 'game', label: 'Game' }, { id: 'sound', label: 'Sound' }]} tab={tab} onTab={setTab}>
                <p style={{ margin: 0 }}>Paper on a clipboard: every dialog. The title sits on the first line, the close peg on the board, and the paper scrolls inside.</p>
              </Clipboard>
            </div>
          </Row>
        </section>
      ))}
    </div>
  );
}

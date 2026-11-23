import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoomViewDTO } from '../../../net/protocol';
import { MAX_ROOM_SIZE, MIN_TO_START } from '../../../../server/types';
import { RANKED_MAX_PLAYERS, RANKED_MIN_PLAYERS } from '../../../lib/ranked';
import { useRoomStore } from '../../../state/roomStore';
import { matSpot, MATS, PEN, PEN_PITCH, penShot } from '../../scene/pen';
import { paints, rules, selectors, subject, surfaceProblems } from '../../kit/surfaceCheck';
import { PEN_ART, SHEEP_HEAD } from '../penArt';

// The pen's scene needs a GPU; the screen around it is what is judged here.
vi.mock('../PenStage', () => ({ PenStage: () => null }));
const { PaintedRoom } = await import('../PaintedRoom');

/**
 * The pen screen (docs/pen/PEN-PLAN.md): every state of section 4 drawn from a made-up room, judged by the surface test
 * (12.2), the start button's second line against the real rules (12.5), the counts against each other (12.6), the
 * banned list (11) and the pixel art (9). The room's limits are the server's own constants.
 */
const NAMES = ['Brian2', 'Maple', 'Barley', 'Tansy', 'owen2008', 'Pip', 'MapleLeafKid', 'realfrog', 'libo', 'thegoatjo'];
type Kind = 'queue' | 'ranked' | 'lobby';
function room(kind: Kind, n: number, extra: Partial<RoomViewDTO> = {}): RoomViewDTO {
  const ranked = kind === 'ranked';
  return {
    code: 'KXLNP', name: kind === 'lobby' ? 'Brian2’s lobby' : '', visibility: 'private', hostId: 'u0', queue: kind === 'queue', ranked,
    settings: { turnsPerRound: 2, lives: 3, twists: true },
    members: Array.from({ length: n }, (_, i) => ({ userId: `u${i}`, name: NAMES[i], avatar: 'sheep', rating: ranked ? 1000 : undefined })),
    botNames: [], phase: 'lobby', min: ranked ? RANKED_MIN_PLAYERS : MIN_TO_START, max: ranked ? RANKED_MAX_PLAYERS : MAX_ROOM_SIZE,
    seatOf: {}, game: null, chatMuted: false, mutedIds: [], startAt: null, ...extra,
  };
}
const noop = () => undefined;
function draw(r: RoomViewDTO, me = 'u0', { wide = true, chat = 0 } = {}): string {
  vi.stubGlobal('matchMedia', () => ({ matches: wide, addEventListener: noop, removeEventListener: noop }));
  // Server rendering reads a store's initial state (zustand's server snapshot), so the room is set there too.
  const state = {
    room: r, user: { userId: me, name: 'me' }, status: 'online', notice: null, unread: 0, rulesAccepted: true, chatNotice: null, blocked: [], skew: 0,
    chat: Array.from({ length: chat }, (_, i) => ({ id: i + 1, roomCode: r.code, userId: `u${i % r.members.length}`, name: NAMES[i % r.members.length], text: `line ${i}`, at: 0 })),
  } satisfies Partial<ReturnType<typeof useRoomStore.getState>>;
  Object.assign(useRoomStore.getInitialState(), state);
  useRoomStore.setState(state);
  return renderToStaticMarkup(<PaintedRoom />);
}
const text = (html: string) => html.replace(/<[^>]+>/g, '\n').replace(/&amp;/g, '&').replace(/&#x27;/g, '\'').split('\n').map((s) => s.trim()).filter(Boolean);

const css = ['src/skin/rooms/pen.css', 'src/skin/kit/surfaces.css', 'src/skin/home/home.css'].map((f) => readFileSync(f, 'utf8')).join('\n');
const own = readFileSync('src/skin/rooms/pen.css', 'utf8');

const STATES: [string, () => string][] = [
  ['casual, alone, host', () => draw(room('queue', 1))],
  ['casual, ready, host', () => draw(room('queue', 2))],
  ['casual, ready, not host', () => draw(room('queue', 3), 'u1', { chat: 20 })],
  ['casual, full', () => draw(room('queue', 10))],
  ['casual, starts by itself', () => draw(room('queue', 4, { startAt: Date.now() + 5000 }), 'u2')],
  ['casual, starting', () => draw(room('queue', 5, { phase: 'playing' }))],
  ['ranked, waiting', () => draw(room('ranked', 1))],
  ['ranked, counting down', () => draw(room('ranked', 3, { startAt: Date.now() + 20000 }), 'u1')],
  ['lobby, host, chat paused', () => draw(room('lobby', 5, { chatMuted: true }), 'u0', { chat: 3 })],
  ['lobby, guest', () => draw(room('lobby', 2), 'u1')],
  ['phone, casual', () => draw(room('queue', 2), 'u0', { wide: false })],
  ['phone, lobby, guest', () => draw(room('lobby', 6), 'u3', { wide: false })],
];

describe('the pen screen', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-22T12:00:00Z')); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  for (const [name, page] of STATES) {
    it(`${name}: nothing is a flat, empty, single-coloured card (the surface test)`, () => {
      const html = page();
      expect(html).toContain('class="pn hm rc"');
      expect(surfaceProblems(html, css, 'pn')).toEqual([]);
    });
  }

  it('is drawn from the recipes: slabs, a board, the bar, tiles, wells, ink cards and snow', () => {
    const used = new Set(STATES.flatMap(([, p]) => [...p().matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/))));
    for (const r of ['hm-slab', 'rc-board', 'rc-bar', 'rc-tile', 'rc-well', 'rc-inkcard', 'rc-snowcap']) expect(used.has(r), r).toBe(true);
    // PEN-PLAN-V3 5: the seat badges are gone with the mats' numbers.
    expect(used.has('rc-badge')).toBe(false);
  });

  it('every background rule in its own stylesheet names the piece it paints by a class', () => {
    for (const [head, body] of rules(own)) {
      if (!paints(body)) continue;
      for (const sel of selectors(head)) expect(subject(sel).length, sel).toBeGreaterThan(0);
    }
  });

  it('keeps the banned list (section 11): no gradient, blur, glow, rounded corner, dashed or stitched border, hand font, wood', () => {
    const body = own.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(body).not.toMatch(/gradient\(|blur\(|border-radius:\s*[1-9]|dashed|dotted|font-hand|Patrick|kit-plank|kit-wall|kit-beam|kit-drift|kit-paper/);
    // A shadow is hard: no blur radius on any box-shadow or drop-shadow.
    expect(body).not.toMatch(/drop-shadow\((?!0 calc\([^()]*\([^()]*\)\) 0 )/);
  });

  it('the start button\'s second line is the real rule, from the room\'s own min and max (12.5)', () => {
    const lines = (n: number, me = 'u0', kind: Kind = 'queue') => text(draw(room(kind, n), me));
    expect(lines(1)).toContain('Needs 1 more player');
    expect(lines(2)).toContain('Start with 2 players');
    expect(lines(MAX_ROOM_SIZE)).toContain(`Start with ${MAX_ROOM_SIZE} players`);
    expect(lines(2, 'u1')).toContain('Waiting for Brian2 to open the gate');
    expect(lines(1, 'u0', 'ranked')).toContain('Needs 1 more player');
    expect(draw(room('queue', 1))).toMatch(/data-start-game[^>]*disabled=""|disabled=""[^>]*data-start-game/);
    expect(draw(room('queue', 2))).not.toMatch(/disabled=""[^>]*data-start-game/);
    // A room that needs more than two shows how many more.
    expect(text(draw({ ...room('queue', 2), min: 4 }))).toContain('Needs 2 more players');
  });

  it('the seat row, the count and the open places agree, and each number is said once (12.6, V3 2.1.4)', () => {
    for (const n of [1, 2, 5, 10]) {
      const html = draw(room('queue', n)), words = text(html);
      expect(html.match(/class="pn-seat"/g)).toHaveLength(MAX_ROOM_SIZE);
      expect(html.match(/<rect[^>]*fill="var\(--hm-wool\)"/g)?.length ?? 0).toBeGreaterThan(0);
      // "2 of 10": the number in Fraunces, the words in Nunito, once on the screen.
      expect(html).toContain(`<b>${n}</b> of ${MAX_ROOM_SIZE}`);
      expect(html.match(new RegExp(` of ${MAX_ROOM_SIZE}<`, 'g'))).toHaveLength(1);
      expect(html).toContain(`aria-label="${n} of ${MAX_ROOM_SIZE} places taken"`);
      expect(html.match(/class="pn-player rc-tile"/g)).toHaveLength(n);
      const open = n < MAX_ROOM_SIZE ? `${MAX_ROOM_SIZE - n} open place${MAX_ROOM_SIZE - n === 1 ? '' : 's'}` : 'Full';
      expect(words.filter((w) => w === open), open).toHaveLength(n < MAX_ROOM_SIZE ? 1 : 2); // "Full" is also the chip
      // "start" sits under seat `min` until there are enough.
      expect(html.includes('pn-start-mark')).toBe(n < MIN_TO_START);
    }
    // The party code once, in the bar (not also in the status card).
    expect(draw(room('lobby', 2)).match(/data-room-code=/g)).toHaveLength(1);
  });

  it('says what is happening in the words of V3 section 4, line 2 one line', () => {
    expect(text(draw(room('queue', 1)))).toEqual(expect.arrayContaining(['Casual game', 'Finding players', 'Finding players…', 'Invite friends to fill it faster.', 'Leave queue', 'Invite friends']));
    expect(text(draw(room('queue', 2)))).toEqual(expect.arrayContaining(['Ready', 'Ready when you are', 'More can join until you open the gate.']));
    expect(text(draw(room('queue', 2), 'u1'))).toEqual(expect.arrayContaining(['Waiting for Brian2', 'More can join until Brian2 opens the gate.', 'Host chooses']));
    expect(text(draw(room('queue', 1, { members: [{ userId: 'u0', name: 'Brian2' }, { userId: 'u1', name: 'Maple' }].slice(0, 2), min: 3 }), 'u1'))).toContain('Brian2 starts when enough are here.');
    expect(text(draw(room('queue', 10)))).toEqual(expect.arrayContaining(['Full', 'The pen is full', 'Open the gate to start.']));
    expect(text(draw(room('queue', 10), 'u1'))).toContain('Waiting for Brian2.');
    expect(text(draw(room('queue', 3, { phase: 'playing' })))).toEqual(expect.arrayContaining(['Starting', 'Opening the gate…']));
    expect(draw(room('queue', 3, { phase: 'playing' }))).not.toContain('pn-status-l2');
    expect(text(draw(room('queue', 4, { startAt: Date.now() + 30000 }), 'u1'))).toContain('Starts by itself in 0:30');
    expect(text(draw(room('ranked', 1)))).toEqual(expect.arrayContaining(['Ranked game', 'Ranked rules']));
    expect(text(draw(room('lobby', 2)))).toEqual(expect.arrayContaining(['Brian2’s lobby', 'Leave lobby', 'Code', 'Who can join', 'with your code', 'anyone can join']));
    expect(text(draw({ ...room('lobby', 2), name: '' }))).toContain('Your lobby');
    // A name the server made with a straight apostrophe is shown with a typographic one (2.1.7).
    expect(text(draw({ ...room('lobby', 2), name: "Player809's room" }))).toContain('Player809’s room');
    // The rules as chips, each with its explanation (open choice 2: in a tooltip).
    const game = text(draw(room('lobby', 2)));
    expect(game).toEqual(expect.arrayContaining(['turns a round', 'wool balls (lives)', 'twists', 'On', 'How many turns each sheep takes in a round.', 'Your lives. Run out of time and you lose one.']));
    expect(draw(room('lobby', 2)).match(/role="tooltip"/g)).toHaveLength(3);
  });

  it('the chat rules are one strip with no outline or band, and the shorter line (7.1)', () => {
    const html = draw(room('lobby', 2));
    expect(html).toContain('class="pn-chatrules pn-strip-inkcard"');
    expect(html).not.toMatch(/pn-chatrules[^"]*rc-inkcard/);
    expect(text(html)).toContain('No swearing, nothing sexual, no slurs, or you get suspended.');
    expect(html).toContain('placeholder="Be kind…"');
  });

  it('draws every icon from a grid, at a whole number of pixels per art pixel (12.7)', () => {
    for (const [name, page] of STATES.filter(([n]) => !n.startsWith('ranked'))) { // a ranked row shows the ranked screen's own badge
      const html = page();
      for (const m of html.matchAll(/<svg([^>]*)>/g)) {
        const a = m[1];
        const grid = /data-grid="(\d+)x(\d+)"/.exec(a);
        expect(grid, `${name}: an svg not drawn from a grid`).not.toBeNull();
        expect(a, name).toMatch(new RegExp(`width:calc\\(${grid![1]} \\* max\\(1px, round\\(nearest, `));
      }
      // No smooth pictures: images are the pixel heads (or Home's queue icon, drawn pixelated).
      for (const m of html.matchAll(/<img([^>]*)>/g)) expect(m[1], name).toMatch(/sk-pixel-head|src="[^"]*queue/);
    }
  });

  it('keeps every control the old screen had, with the same hooks', () => {
    const host = draw(room('lobby', 3), 'u0', { chat: 2 });
    for (const hook of ['data-room-code="KXLNP"', 'data-copy-link', 'data-start-game', 'data-set-private', 'data-set-public']) expect(host, hook).toContain(hook);
    for (const label of ['Mute Maple', 'Remove Maple', 'Report message from Maple', 'Block Maple', 'Chat message']) expect(host, label).toContain(`aria-label="${label}"`);
    expect(text(host)).toEqual(expect.arrayContaining(['Change rules', 'Pause chat', 'Send', 'All the rules']));
    expect(host).toContain('title="Stops everyone sending messages"');
    expect(text(draw(room('lobby', 3, { chatMuted: true })))).toContain('Resume chat');
    // Not the host: no host controls, no rules editor, no pause.
    const guest = draw(room('lobby', 3), 'u1');
    expect(guest).not.toMatch(/Mute Brian2|Remove Brian2|Change rules|Pause chat/);
    // Ranked: no invite and no host.
    expect(draw(room('ranked', 2), 'u0')).not.toMatch(/data-copy-link|Invite friends|pn-tag--host/);
    expect(text(draw(room('ranked', 2), 'u0'))).toContain('Leaving once it starts counts as a loss.');
  });

  it('a phone has the three tabs, Players first, and the button pinned under them', () => {
    const html = draw(room('queue', 3), 'u0', { wide: false });
    expect(html).toContain('data-phone="true"');
    expect(text(html)).toEqual(expect.arrayContaining(['Players', 'Game', 'Chat']));
    expect(html).toMatch(/aria-selected="true"[^>]*>(<span>)?Players</);
  });
});

describe('the pen itself (section 8)', () => {
  it('lays out max mats, the front row 1 to 5 from the screen\'s left, the back row 6 to 10, inside the rails', () => {
    for (const max of [MAX_ROOM_SIZE, RANKED_MAX_PLAYERS]) {
      const spots = Array.from({ length: max }, (_, i) => matSpot(i, max));
      for (const s of spots) {
        expect(Math.abs(s.x) + MATS.w / 2).toBeLessThan(PEN.halfX - 0.5);
        expect(Math.abs(s.z) + MATS.d / 2).toBeLessThan(PEN.halfZ - 0.5);
        // Facing the camera (the model's front is +z, the camera at -z), turned at most 10 degrees.
        expect(Math.abs(s.yaw - Math.PI)).toBeLessThanOrEqual((10 * Math.PI) / 180 + 1e-9);
      }
      const front = spots.slice(0, Math.min(5, max));
      // The camera looks along +z, so the screen's left is +x: mat 1 has the largest x.
      for (let i = 1; i < front.length; i++) expect(front[i].x).toBeLessThan(front[i - 1].x);
      // The places 1.2 m apart (the plan's 0.4 m mat and 0.8 m gap).
      for (let i = 1; i < front.length; i++) expect(front[i - 1].x - front[i].x).toBeCloseTo(1.2);
      if (max > 5) for (const s of spots.slice(5)) expect(s.z).toBeGreaterThan(front[0].z);
    }
  });

  it('looks down 20 degrees', () => {
    for (const phone of [false, true]) {
      const { position: p, target: t } = penShot(phone);
      expect(Math.atan2(p[1] - t[1], Math.hypot(p[0] - t[0], p[2] - t[2]))).toBeCloseTo(PEN_PITCH);
    }
    expect(PEN_PITCH).toBeCloseTo((20 * Math.PI) / 180);
  });
});

describe('the pixel art (V3 section 11)', () => {
  it('is every grid the plans draw, each a rectangle, at its size', () => {
    const small = ['seatEmpty', 'clock', 'gear', 'pause', 'check', 'mute', 'unmute', 'kick'];
    const size = (name: string): [number, number] => (name === 'crown' ? [8, 5] : name === 'chevron' ? [8, 4] : small.includes(name) ? [8, 8] : [12, 12]);
    for (const name of Object.keys(PEN_ART) as (keyof typeof PEN_ART)[]) {
      const rows = PEN_ART[name], [w, h] = size(name);
      expect(rows, name).toHaveLength(h);
      for (const r of rows) expect(r, name).toHaveLength(w);
    }
    expect(PEN_ART.pause.every((r) => r === '.XX..XX.')).toBe(true);
    // Brian's example, 11.6: the check is two art pixels thick, at the shield's own pixel size, and the tip narrows a pixel a row.
    expect(PEN_ART.shield).toEqual(['HHHHHHHHHHHH', 'XXXXXXXXXXXL', 'XXXXXXXXXKKL', 'XXXXXXXXKKXL', 'XKKXXXXKKXXL', 'XXKKXXKKXXXL', 'XXXKKKKXXXXL', 'XXXXKKXXXXXL', '.XXXXXXXXXL.', '..XXXXXXXL..', '...XXXXXL...', '....XXXL....']);
    expect(SHEEP_HEAD).toEqual(['..WWWW..', '.WWWWWW.', 'EWFFFFWE', 'EFKFFKFE', '.FFFFFF.', '.FFNNFF.', '..FFFF..', '........']);
  });
});

import { BoxGeometry, CanvasTexture, Color, Fog, Group, Mesh, MeshBasicMaterial, SRGBColorSpace } from 'three';
import type { Material } from 'three';
import { KINDS } from '../../shop/catalog';
import type { Item, Kind, Rarity } from '../../shop/catalog';
import { RARITY_COLOR } from '../../shop/rarity';
import type { SackId } from '../../shop/sacks';
import { makeBomb, SKIN_OF } from '../bomb';
import type { BombObject } from '../bomb';
import { makeBurst, BURST_OF } from '../burst';
import type { BurstObject } from '../burst';
import { MARKET } from '../market.gen';
import type { ShiftView } from '../camera';
import { buildRow, glowSprite, itemGroup, itemHeight, itemWidth, modelGroup, rowMaterials, spreadFor, STOP_X, STOPS, stopAt, tpPart } from './world';
import type { StopId } from './world';

/**
 * Everything three.js in the Trading Post: the still row, and what moves or changes in it. The screen (shop/Bazaar.tsx)
 * tells it what to show; `update` poses it every frame from the time. Nothing here is random.
 */
export const SACK_KEY: Record<SackId, 'oat' | 'corn' | 'barley'> = { bomb: 'oat', blast: 'corn', tick: 'barley' };
const CRATE: Record<SackId, string> = { bomb: 'sackCrate_straw', blast: 'sackCrate_brass', tick: 'sackCrate_wood' };

/** Where the picked sack's bench items stand (T5 section 3): five or fewer 0.72 m apart, six or seven over 3.6 m. */
export function benchX(n: number): number[] {
  const gap = n <= 5 ? 0.72 : 3.6 / (n - 1);
  return Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * gap);
}
export const BENCH = { y: 0.35, z: 0.65 };
/** Where a revealed item lands, beside the sack on the counter (T5 section 5). */
export const REVEAL_STAND = { x: 0.62, y: 1.05, z: 0.05 };
/** Bell Shelf places (T6 section 1): the lower step, evenly, at most four; the rest on the upper step. */
export function shelfPlace(i: number, n: number): [number, number, number] {
  const lower = Math.min(n, 4), upper = n - lower;
  if (i < lower) return [STOP_X.bells + (i - (lower - 1) / 2) * 1.3, 0.95, -0.25];
  return [STOP_X.bells + (i - lower - (upper - 1) / 2) * 1.3, 1.65, -0.6];
}
/** A Barn Book ledge, metres (data `book_pockets_cells`, the book at (18.6, 0, -0.2)). */
export function pocket(i: number, n: 8 | 10): [number, number, number] {
  const [cx, cy] = MARKET.book_pockets_cells[String(n) as '8' | '10'][i];
  return [STOP_X.book + cx * 0.05, cy * 0.05 + 0.05, -0.2];
}
/** The three mission slips and the milestone sheet on the notice board, metres (the model's notes). */
const NB = { x: STOP_X.missions, z: -0.3 };
/** An item's size in a Barn Book pocket: the pack's 0.8, or less where a tall one (a bomb with its fuse) would stand out of the pocket's 0.62 m. */
const bookScale = (item: Item): number => Math.min(0.8, 0.6 / itemHeight(item));
/** The display case (the packer's `noticeBoard`): each niche's middle, the shelf's top, and the plaque that hangs under each niche. */
export const NICHES = [-1.1, 0, 1.1].map((dx) => ({ x: NB.x + dx, shelf: 1.0, z: NB.z - 0.02 }));
export const PLAQUES = NICHES.map((n) => ({ x0: n.x - 0.54, x1: n.x + 0.54, y0: 0.37, y1: 0.93, z: NB.z - 0.04 }));
/** The milestones' rail stands on the snow in front of the case. */
export const RAIL = { x0: NB.x - 1.86, x1: NB.x + 1.86, y0: 0.0, y1: 0.47, z: 0.95 };
/** The line of words on the beam over the niches. */
export const BEAM = { x: NB.x, y: 2.45, z: NB.z };

const keep = <M extends Material>(m: M): M => { m.userData.keep = true; return m; };
const ease = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

interface Placed { g: Group; inner: Group; item: Item; x: number; y: number; z: number; s: number; at: number }

export interface RevealPlan { sack: SackId; item: Item; tier: Rarity; duplicate: boolean; at: number }

export class MarketWorld {
  readonly root = new Group();
  private mats = (() => { const m = rowMaterials(); keep(m.glow); return m; })();
  private back = { lit: new MeshBasicMaterial({ vertexColors: true, color: new Color(0.86, 0.8, 0.74) }), glow: this.mats.glow };
  private focusMats = { lit: new MeshBasicMaterial({ vertexColors: true, color: new Color(1, 0.93, 0.86) }), glow: keep(new MeshBasicMaterial({ vertexColors: true, toneMapped: false, fog: false })), flat: keep(new MeshBasicMaterial({ vertexColors: true })) };
  private itemMats = { ...this.mats, flat: keep(new MeshBasicMaterial({ vertexColors: true })) };
  private stops: Record<StopId, Group>;
  private sacks = {} as Record<SackId, { body: Group; tie: Group; crate: Group; x: number }>;
  private picked: SackId = 'bomb';
  private pickedAt = -1e9;
  private bench = new Group();
  private benchItems: Placed[] = [];
  private shelf = new Group();
  private shelfItems: Placed[] = [];
  private missions = new Group();
  private book = new Group();
  private bookItems: Placed[] = [];
  private bookModels: Record<8 | 10, Group>;
  private bell = new Group();
  private bellAt = -1e9;
  private hopId = ''; private hopAt = -1e9;
  private reveal: RevealPlan | null = null;
  private revealGlow = new Group();
  private revealRay = new MeshBasicMaterial({ color: '#ffffff', toneMapped: false, fog: false, transparent: true, opacity: 0.85 });
  private revealItem: Group | null = null;
  private revealStand: Mesh;
  focus: { id: string; at: number } | null = null;
  private lit: { bomb: BombObject; at: number; holder: Group } | null = null;
  private tried: { burst: BurstObject; at: number; holder: Group } | null = null;

  readonly sky = skyTexture();
  readonly fog = new Fog(MARKET.sky.fog, MARKET.fog.start_m, MARKET.fog.start_m + (MARKET.fog.end_m - MARKET.fog.start_m) / MARKET.fog.most);

  constructor() {
    const row = buildRow(this.mats);
    this.stops = row.stops;
    this.root.add(row.far, ...Object.values(row.stops), ...row.sprites);
    // The sacks and their crates: built apart, because the picked one stands forward and one hops in a reveal.
    for (const s of KINDS as SackId[]) {
      const it = MARKET.items.find((i) => i.model === `sack_${SACK_KEY[s]}`)!, crateAt = MARKET.items.find((i) => i.model === CRATE[s])!;
      const body = modelGroup(`sack_${SACK_KEY[s]}`, this.mats, tpPart('shell', 'patch', 'stencil'));
      const tie = modelGroup(`sack_${SACK_KEY[s]}`, this.mats, tpPart('tie'));
      const sackG = new Group(); sackG.add(body, tie);
      sackG.position.set(it.x, it.y, it.z);
      const crate = modelGroup(CRATE[s], this.mats);
      crate.position.set(crateAt.x, crateAt.y, crateAt.z);
      this.stops.sacks.add(sackG, crate);
      this.sacks[s] = { body: sackG, tie, crate, x: it.x };
    }
    this.stops.sacks.add(this.bench);
    this.stops.bells.add(this.shelf);
    this.stops.missions.add(this.missions);
    this.stops.book.add(this.book);
    // The big bell hangs from its bracket: turn it about the top.
    const bb = MARKET.items.find((i) => i.model === 'bigBell')!;
    const bellModel = modelGroup('bigBell', this.mats);
    bellModel.position.y = -24 * 0.04;
    this.bell.add(bellModel);
    // At the pack's size it was 0.8 m across and hung over the post it hangs beside; at 0.62 it clears the post and
    // still reads as the stall's bell. Its top stays on the bracket.
    this.bell.scale.setScalar(0.62);
    this.bell.position.set(bb.x + 0.1, bb.y + 24 * 0.04, bb.z);
    this.stops.bells.add(this.bell);
    // The book: one model a page count.
    this.bookModels = { 8: modelGroup('barnBook8', this.mats), 10: modelGroup('barnBook10', this.mats) };
    for (const m of Object.values(this.bookModels)) { m.position.set(STOP_X.book, 0, -0.2); this.stops.book.add(m); }
    // The reveal's light: a glow at the neck and three thin rays, in the rarity's colour.
    for (const dx of [-0.08, 0, 0.08]) {
      const ray = new Mesh(new BoxGeometry(0.03, 0.5, 0.03), this.revealRay);
      ray.position.set(dx, 0.95 + (dx ? 0 : 0.06), 0);
      this.revealGlow.add(ray);
    }
    this.revealGlow.visible = false;
    this.stops.sacks.add(this.revealGlow);
    this.revealStand = new Mesh(new BoxGeometry(0.4, 0.05, 0.4), new MeshBasicMaterial({ color: '#3b3330' }));
    this.revealStand.visible = false;
    this.stops.sacks.add(this.revealStand);
  }

  setPicked(s: SackId, now: number): void { if (s !== this.picked) { this.picked = s; this.pickedAt = now; } }

  setBench(items: Item[], now: number): void {
    this.bench.clear();
    const xs = benchX(items.length);
    this.benchItems = items.map((item, i) => {
      const inner = itemGroup(item, this.itemMats), g = new Group(); g.add(inner);
      this.bench.add(g);
      return { g, inner, item, x: xs[i], y: BENCH.y, z: BENCH.z, s: 1, at: now + i * 40 };
    });
  }
  benchPlaces(): { item: Item; x: number; y: number; z: number; h: number }[] {
    return this.benchItems.map((p) => ({ item: p.item, x: p.x, y: p.y, z: p.z, h: itemHeight(p.item) }));
  }

  setShelf(items: Item[]): void {
    this.shelf.clear();
    this.shelfItems = items.map((item, i) => {
      const [x, y, z] = shelfPlace(i, items.length);
      // A burst here is drawn in at 67% over a stand 1.6 times as large, every piece its full size (ITEMS_REMODEL.md rule 7).
      const s = 1;
      const inner = itemGroup(item, this.itemMats, false, 'shelf'), g = new Group(); g.add(inner);
      this.shelf.add(g);
      return { g, inner, item, x, y, z, s, at: -1e9 };
    });
  }

  /** The mission rewards stand in the case's niches, each as large as its niche allows. */
  setMissions(items: Item[]): void {
    this.missions.clear();
    items.forEach((item, i) => {
      const n = NICHES[i];
      if (!n) return;
      const g = itemGroup(item, this.itemMats), s = Math.min(1.02 / Math.max(itemHeight(item), 0.3), 0.8 / Math.max(itemWidth(item), 0.3));
      g.scale.setScalar(s);
      g.position.set(n.x, n.shelf, n.z);
      this.missions.add(g);
    });
  }

  setBook(kind: Kind, items: { item: Item; found: boolean }[], now: number): void {
    const n: 8 | 10 = items.length > 8 ? 10 : 8;
    this.bookModels[8].visible = n === 8; this.bookModels[10].visible = n === 10;
    this.book.clear();
    this.bookItems = items.map(({ item, found }, i) => {
      const [x, y, z] = pocket(i, n);
      const inner = itemGroup(item, this.itemMats, !found, 'book'), g = new Group(); g.add(inner);
      this.book.add(g);
      return { g, inner, item, x, y, z, s: bookScale(item), at: now + i * 30 };
    });
    void kind;
  }
  bookPlaces(): { item: Item; x: number; y: number; z: number; h: number }[] {
    return this.bookItems.map((p) => ({ item: p.item, x: p.x, y: p.y, z: p.z, h: itemHeight(p.item) * bookScale(p.item) }));
  }

  swingBell(now: number, hopId = ''): void { this.bellAt = now; this.hopId = hopId; this.hopAt = now; }

  startReveal(plan: RevealPlan): void {
    this.reveal = plan;
    this.revealRay.color.set(RARITY_COLOR[plan.tier]).lerp(new Color('#ffffff'), 0.35);
    this.revealItem?.removeFromParent();
    this.revealItem = itemGroup(plan.item, this.itemMats);
    this.stops.sacks.add(this.revealItem);
    if (!this.revealSprite) { this.revealSprite = glowSprite('#ffffff', 0.45, 0.8, 0, 0, 0); this.stops.sacks.add(this.revealSprite); }
    this.revealSprite.material.color.set(RARITY_COLOR[plan.tier]);
  }
  private revealSprite: ReturnType<typeof glowSprite> | null = null;
  endReveal(): void { this.reveal = null; this.revealItem?.removeFromParent(); this.revealItem = null; }

  /** "See it lit": the bomb's face counts 10 to 0 with its fuse burning, once. */
  seeLit(item: Item, now: number): void {
    const p = this.placeOf(item.id);
    if (!p) return;
    this.stopShow();
    const bomb = makeBomb(SKIN_OF[item.id] ?? 'ice', { rest: true, lit: this.focusMats.lit });
    const holder = new Group(); holder.add(bomb.group);
    p.g.parent?.add(holder);
    this.lit = { bomb, at: now, holder };
  }
  /** "Try it": the burst plays once, drawn in as it is shown (its pieces full size). */
  tryBurst(item: Item, now: number): void {
    const p = this.placeOf(item.id);
    if (!p) return;
    this.stopShow();
    const key = BURST_OF[item.id] ?? 'frost', slot = this.shelfItems.includes(p) ? 'shelf' : this.bookItems.includes(p) ? 'book' : 'bench';
    const burst = makeBurst(key, { lit: this.focusMats.lit, spread: spreadFor(key, slot) });
    const holder = new Group(); holder.add(burst.group);
    holder.scale.setScalar(p.s);
    holder.position.set(p.x, p.y, p.z + 0.05);
    p.g.parent?.add(holder);
    this.tried = { burst, at: now, holder };
  }
  stopShow(): void { this.lit?.holder.removeFromParent(); this.lit = null; this.tried?.holder.removeFromParent(); this.tried = null; }

  private placeOf(id: string): Placed | undefined {
    return [...this.benchItems, ...this.shelfItems, ...this.bookItems].find((p) => p.item.id === id && p.g.parent);
  }
  /** The model of an item on screen (inside its placed group), for Listen to move while it plays. */
  modelOf(id: string): Group | undefined { return this.placeOf(id)?.inner; }
  /** Where an item stands now, for the close view's camera and tag. */
  whereIs(id: string, stop: StopId): { x: number; y: number; z: number; h: number } | null {
    const list = stop === 'sacks' ? this.benchItems : stop === 'bells' ? this.shelfItems : stop === 'book' ? this.bookItems : [];
    const p = list.find((q) => q.item.id === id);
    return p ? { x: p.x, y: p.y, z: p.z, h: itemHeight(p.item) * p.s } : null;
  }

  update(now: number, v: ShiftView, reduced: boolean): void {
    // Draw only the stop on screen and its neighbours (T1 section 8).
    const here = stopAt(v.cx);
    STOPS.forEach((s, i) => { this.stops[s].visible = Math.abs(i - STOPS.indexOf(here)) <= 1; });
    const dim = this.focus ? 0.6 : 1;
    this.mats.lit.color.setRGB(dim, 0.93 * dim, 0.86 * dim);
    this.mats.glow.color.setScalar(dim);
    this.itemMats.flat.color.setScalar(dim);
    this.back.lit.color.setRGB(0.86 * dim, 0.8 * dim, 0.74 * dim);
    const motion = !reduced;
    // The sacks: the picked one and its crate 0.12 m forward over 200 ms, the others back and in less light.
    for (const s of KINDS as SackId[]) {
      const k = this.sacks[s], on = s === this.picked, t = motion ? ease((now - this.pickedAt) / 200) : 1;
      const base = MARKET.items.find((i) => i.model === `sack_${SACK_KEY[s]}`)!.z;
      const crateBase = MARKET.items.find((i) => i.model === CRATE[s])!.z;
      k.body.position.z = base + (on ? 0.12 * t : 0);
      k.crate.position.z = crateBase + (on ? 0.12 * t : 0);
      k.body.position.x = k.x; k.body.position.y = MARKET.items.find((i) => i.model === `sack_${SACK_KEY[s]}`)!.y;
      k.body.rotation.z = 0;
      k.tie.position.y = 0; k.tie.scale.setScalar(1); k.body.visible = true; k.crate.visible = true;
      setMat(k.body, on ? this.mats.lit : this.back.lit); setMat(k.crate, on ? this.mats.lit : this.back.lit);
    }
    // In a reveal the counter is the stage: the bench steps out of the camera's way.
    this.bench.visible = !this.reveal;
    // The bench: each item drops in from 0.25 m above, 240 ms, 40 ms apart.
    for (const p of this.benchItems) {
      const t = motion ? ease((now - p.at) / 240) : 1;
      place(p, now, (1 - t) * 0.25, this.focus?.id === p.item.id ? now : null);
      p.g.visible = !(this.tried && this.focusId() === p.item.id) && !(this.lit && this.focusId() === p.item.id);
    }
    for (const p of this.shelfItems) {
      const e = now - this.hopAt, hop = motion && p.item.id === this.hopId && e < 250 ? Math.sin((e / 250) * Math.PI) * 0.15 : 0;
      place(p, now, hop, this.focus?.id === p.item.id ? now : null);
      p.g.visible = !(this.tried && this.focusId() === p.item.id) && !(this.lit && this.focusId() === p.item.id);
    }
    for (const p of this.bookItems) {
      // A page turned: the new items pop up 30 ms apart.
      const t = motion ? ease((now - p.at) / 220) : 1;
      place(p, now, 0, this.focus?.id === p.item.id ? now : null, t);
      p.g.visible = !(this.tried && this.focusId() === p.item.id) && !(this.lit && this.focusId() === p.item.id);
    }
    for (const list of [this.benchItems, this.shelfItems, this.bookItems]) for (const p of list) setMat(p.g, this.focus?.id === p.item.id ? this.focusMats.lit : this.mats.lit);
    // The big bell swings 14 degrees twice in 700 ms.
    const be = now - this.bellAt;
    this.bell.rotation.z = motion && be < 700 ? Math.sin((be / 700) * Math.PI * 4) * (14 * Math.PI / 180) * (1 - be / 700) : 0;
    // The close view's shows.
    if (this.lit) {
      const p = this.placeOf(this.focus?.id ?? '');
      const e = now - this.lit.at, sec = 10 - Math.floor(e / 1000); // T6: the face counts down from 10 to 0, once
      if (p) { this.lit.holder.position.set(p.x, p.y, p.z); this.lit.holder.scale.setScalar(p.s); this.lit.holder.rotation.y = p.g.rotation.y; }
      if (sec < 0) this.stopShow();
      else { this.lit.bomb.setSeconds(sec, sec <= 3); this.lit.bomb.setFuse(1 - e / 11000); this.lit.bomb.setSpark(sec <= 3 ? 1.6 : 1); }
    }
    if (this.tried) {
      const e = now - this.tried.at;
      this.tried.burst.at(e, reduced);
      if (e > 1400) this.stopShow();
    }
    this.poseReveal(now, motion);
  }
  private focusId(): string { return this.focus?.id ?? ''; }

  private poseReveal(now: number, motion: boolean): void {
    const r = this.reveal;
    this.revealGlow.visible = !!r;
    if (this.revealSprite) this.revealSprite.visible = !!r;
    this.revealStand.visible = !!r;
    if (!r || !this.revealItem) return;
    const e = motion ? now - r.at : 1600;
    const k = this.sacks[r.sack], home = MARKET.items.find((i) => i.model === `sack_${SACK_KEY[r.sack]}`)!;
    // The middle sack's crate gives way while another sack is on the counter.
    if (r.sack !== 'blast') { this.sacks.blast.body.visible = false; this.sacks.blast.crate.visible = false; }
    const to = { x: 0, y: 1.05, z: 0.02 };
    const h = clamp01(e / 250);
    k.body.position.set(home.x + (to.x - home.x) * ease(h), home.y + (to.y - home.y) * h + Math.sin(h * Math.PI) * 0.3, home.z + (to.z - home.z) * ease(h));
    // Two shakes, 0.035 m side to side.
    const shake = (e >= 250 && e < 430) || (e >= 470 && e < 650) ? Math.sin(((e - 250) / 90) * Math.PI) * 0.035 : 0;
    k.body.position.x += shake;
    setMat(k.body, this.mats.lit); setMat(k.crate, this.back.lit);
    // The bow unties: its tails fall, the band drops away.
    const u = clamp01((e - 650) / 200);
    k.tie.position.y = -0.25 * u; k.tie.scale.setScalar(1 - u * 0.999);
    // From 250 ms a light in the item's rarity colour, from the first frame of it to the end.
    const neck = { x: k.body.position.x, y: k.body.position.y + 0.7, z: k.body.position.z };
    this.revealGlow.visible = e >= 250;
    this.revealGlow.position.set(neck.x, k.body.position.y - 0.25, neck.z);
    if (this.revealSprite) { this.revealSprite.visible = e >= 250; this.revealSprite.position.set(neck.x, neck.y, neck.z + 0.2); }
    // The item rises 0.5 m out of the neck and turns once, then lands beside the sack on a small stand.
    const stand = REVEAL_STAND;
    this.revealStand.position.set(stand.x, stand.y + 0.025, stand.z);
    this.revealStand.visible = e >= 1250;
    const it = this.revealItem;
    if (e < 850) it.visible = false;
    else if (e < 1250) { const t = (e - 850) / 400; it.visible = true; it.position.set(neck.x, neck.y - 0.25 + 0.5 * ease(t), neck.z); it.rotation.y = t * Math.PI * 2; it.scale.setScalar(0.4 + 0.6 * t); }
    else { const t = clamp01((e - 1250) / 350); it.visible = true; it.rotation.y = 0; it.scale.setScalar(1); it.position.set(neck.x + (stand.x - neck.x) * ease(t), neck.y + 0.25 + (stand.y + 0.05 - neck.y - 0.25) * ease(t), neck.z + (stand.z - neck.z) * ease(t)); }
    // A duplicate fades into coins: it shrinks away after it lands.
    if (r.duplicate && e > 1600) it.scale.setScalar(Math.max(0.001, 1 - (e - 1600) / 400));
  }
}

/** Swaps the lit meshes of a group to a material; glowing meshes and paper cut-outs (`userData.keep`) keep theirs. */
function setMat(g: Group, lit: Material): void {
  g.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh || (m.material as Material).userData.keep) return;
    if ((m.material as MeshBasicMaterial).vertexColors) m.material = lit;
  });
}

function place(p: Placed, now: number, lift: number, turning: number | null, pop = 1): void {
  p.g.position.set(p.x, p.y + lift, p.z);
  p.g.scale.set(p.s, p.s * Math.max(0.001, pop), p.s);
  // In the close view the item turns once every 8 s.
  p.g.rotation.y = turning !== null ? (now / 8000) * Math.PI * 2 : 0;
  p.g.rotation.z = 0;
}

/**
 * The dusk sky (T1 section 4) as the scene's background: top colour, the middle one 55% of the way to the horizon, the
 * horizon colour; 26 small stars in its top 45% at fixed places. The horizon sits about 40% down on a computer.
 */
function skyTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 512;
  const g = c.getContext('2d')!, hz = 0.42, grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, MARKET.sky.top); grad.addColorStop(hz * 0.55, MARKET.sky.mid); grad.addColorStop(hz, MARKET.sky.horizon); grad.addColorStop(1, MARKET.sky.horizon);
  g.fillStyle = grad; g.fillRect(0, 0, 256, 512);
  g.fillStyle = '#FFF3D6';
  for (let i = 0; i < 26; i++) g.fillRect(Math.floor((i * 37.7 + 11) % 100 * 2.56), Math.floor(((i * 53.3) % 45) * 0.01 * hz * 512 / 0.45), 1 + (i % 2), 1 + (i % 2));
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

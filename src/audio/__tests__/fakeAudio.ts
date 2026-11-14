/** A stand-in for Web Audio that writes down what was scheduled, for the tests of the fuse sounds and the music. No sound, no clock of its own. */
export class FakeParam {
  value = 0;
  events: [kind: string, value: number, at: number][] = [];
  setValueAtTime(v: number, t: number) { this.events.push(['set', v, t]); }
  exponentialRampToValueAtTime(v: number, t: number) { this.events.push(['exp', v, t]); }
  linearRampToValueAtTime(v: number, t: number) { this.events.push(['lin', v, t]); }
  setTargetAtTime(v: number, t: number) { this.events.push(['target', v, t]); }
  cancelScheduledValues(t: number) { this.events.push(['cancel', 0, t]); }
  cancelAndHoldAtTime(t: number) { this.events.push(['hold', 0, t]); }
}
export class FakeNode {
  /** What it plays into: a node, or a parameter of one (an LFO into a pitch). */
  to: FakeNode | FakeParam | null = null;
  connect<T extends FakeNode | FakeParam>(n: T): T { this.to = n; return n; }
  disconnect() { this.to = null; }
}
export class FakeOsc extends FakeNode {
  type = 'sine';
  frequency = new FakeParam();
  detune = new FakeParam();
  startAt = -1;
  stopAt = -1;
  constructor(private ctx: FakeContext) { super(); }
  start(t?: number) { this.startAt = t ?? this.ctx.currentTime; }
  stop(t?: number) { this.stopAt = t ?? this.ctx.currentTime; }
  /** The gain it plays through, and that gain's loudest level. */
  get gain(): FakeGain { return this.to as FakeGain; }
  get peak(): number { return Math.max(...this.gain.gain.events.filter((e) => e[0] === 'exp' || e[0] === 'lin').map((e) => e[1])); }
  /** The pitch it starts on. */
  get freq(): number { return this.frequency.events[0]?.[1] ?? this.frequency.value; }
}
export class FakeGain extends FakeNode { gain = new FakeParam(); }
export class FakeFilter extends FakeNode { type = ''; frequency = new FakeParam(); Q = new FakeParam(); }
export class FakeContext {
  state = 'running';
  currentTime = 0;
  destination = new FakeNode();
  oscs: FakeOsc[] = [];
  filters: FakeFilter[] = [];
  gains: FakeGain[] = [];
  createOscillator() { const o = new FakeOsc(this); this.oscs.push(o); return o; }
  createGain() { const g = new FakeGain(); this.gains.push(g); return g; }
  createBiquadFilter() { const f = new FakeFilter(); this.filters.push(f); return f; }
  createStereoPanner() { return Object.assign(new FakeNode(), { pan: new FakeParam() }); }
  createDelay() { return Object.assign(new FakeNode(), { delayTime: new FakeParam() }); }
  // The fuse sounds are tones only: asking for noise is a failure.
  createBuffer(): never { throw new Error('a fuse sound asked for a noise buffer'); }
  createBufferSource(): never { throw new Error('a fuse sound asked for a noise source'); }
  resume() { return Promise.resolve(); }
}

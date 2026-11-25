/**
 * The dream's beat (docs/dream/06-beat-and-effects.md, section 1): a running count of beats that grows by the stage's
 * beats a minute, on the dream's own clock, so it stands still while the game does and a change of stage never makes it
 * jump. Everything that moves "on the beat" is `pulse` times its amount. Drawn only: nothing here reads or changes the
 * game's timing.
 */
export const BPM = { 1: 96, 2: 112, 3: 128 } as const;
/** The beats a minute of a stage (the letters on the sign, 1 to 3). */
export const bpmOf = (stage: number): number => BPM[Math.min(3, Math.max(1, Math.round(stage))) as 1 | 2 | 3];
/** The count after `ms` more of the dream's clock in `stage`. */
export const advance = (beats: number, ms: number, stage: number): number => beats + (Math.max(0, ms) / 60000) * bpmOf(stage);
/** 0 to 1 within a beat. */
export const phase = (beats: number): number => beats - Math.floor(beats);
/** A sharp hit, gone in 35% of a beat. */
export const pulse = (beats: number): number => Math.max(0, 1 - phase(beats) / 0.35) ** 2;
/** The whole beats so far. */
export const whole = (beats: number): number => Math.floor(beats);

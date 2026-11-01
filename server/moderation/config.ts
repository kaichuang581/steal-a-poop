/**
 * Moderation settings in one place. The defaults are the rules in docs/LANES.md: every match
 * suspends for 24 hours and goes to review. Everything else here is opt-in and off by default.
 */
import type { Tier } from '../filter';

export interface ModerationConfig {
  /** Base suspension for any held message. */
  suspendMs: number;
  /** Per-tier override of the base. Unset tiers use `suspendMs`. */
  tierSuspendMs: Partial<Record<Tier, number>>;
  /**
   * Multiplies the suspension by how many earlier violations the sender has. [1] (default) means
   * every violation is the same length. [1, 3, 7] means the 2nd is 3x, the 3rd and later 7x.
   */
  repeatMultipliers: readonly number[];
  /** Ordinary words that must never be flagged even if they contain a blocked string. Default empty. */
  allowlist: readonly string[];
  /** Extra entries on top of the blocklist file. Mild and severe only change the suspension length. */
  mildTerms: readonly string[];
  severeTerms: readonly string[];
}

export const HOUR_MS = 60 * 60 * 1000;

export const DEFAULT_MODERATION_CONFIG: ModerationConfig = {
  suspendMs: 24 * HOUR_MS,
  tierSuspendMs: {},
  repeatMultipliers: [1],
  allowlist: [],
  mildTerms: [],
  severeTerms: [],
};

export function resolveConfig(partial: Partial<ModerationConfig> = {}): ModerationConfig {
  return { ...DEFAULT_MODERATION_CONFIG, ...partial };
}

/** How long to suspend for a violation of this tier, given how many the sender already has. */
export function suspensionFor(config: ModerationConfig, tier: Tier, priorViolations: number): number {
  const base = config.tierSuspendMs[tier] ?? config.suspendMs;
  const steps = config.repeatMultipliers.length ? config.repeatMultipliers : [1];
  const mult = steps[Math.min(Math.max(priorViolations, 0), steps.length - 1)];
  return Math.round(base * mult);
}

/**
 * Where other languages plug in. Each language is a blocklist file plus (optionally) its own
 * letter swaps. Add an entry here and pass its blocklist to the ChatFilter; the matching code is
 * language-neutral for Latin scripts. Nothing but English is supplied yet.
 */
export interface LanguagePack {
  code: string;
  blocklistFile: string;
}
export const LANGUAGE_PACKS: readonly LanguagePack[] = [{ code: 'en', blocklistFile: 'server/data/blocklist-en.txt' }];

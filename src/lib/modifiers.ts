import type { RoundModifier } from '../engine';

export const MODIFIER_INFO: Record<RoundModifier, { emoji: string; label: string; detail: string }> = {
  none: { emoji: '🌾', label: 'Plain rules', detail: 'No twist this round.' },
  no_e: { emoji: '🚫', label: 'No E allowed', detail: 'Words may not contain the letter E.' },
  six_plus: { emoji: '📏', label: '6+ letters only', detail: 'Every word needs at least 6 letters.' },
  double_letter: { emoji: '👯', label: 'Double letter', detail: 'Words must contain a double letter, like “ball”.' },
  vowel_double: { emoji: '✨', label: 'Vowel-start 2x', detail: 'Words starting with a vowel score double.' },
  double_points_fast: { emoji: '⚡', label: 'Double points, -2s', detail: 'All words score double, but turns are 2s shorter.' },
};

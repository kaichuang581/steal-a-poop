import type { RoundModifier } from '../engine';

export const MODIFIER_INFO: Record<RoundModifier, { emoji: string; label: string; detail: string }> = {
  none: { emoji: '🌾', label: 'Plain rules', detail: 'No twist this round.' },
  no_e: { emoji: '🚫', label: 'No E allowed', detail: 'Words may not contain the letter E.' },
  six_plus: { emoji: '📏', label: '6+ letters only', detail: 'Every word needs at least 6 letters.' },
  double_letter: { emoji: '👯', label: 'Double letter', detail: 'Words must contain a double letter, like “ball”.' },
  no_a: { emoji: '🅰️', label: 'No A allowed', detail: 'Words may not contain the letter A.' },
  no_s: { emoji: '🐍', label: 'No S allowed', detail: 'Words may not contain the letter S.' },
  five_max: { emoji: '✂️', label: '5 letters max', detail: 'Every word has 5 letters or fewer.' },
  ends_vowel: { emoji: '🔚', label: 'End on a vowel', detail: 'Words must end in A, E, I, O or U, like “piano”.' },
  has_o: { emoji: '⭕', label: 'Needs an O', detail: 'Every word must contain the letter O.' },
  vowel_double: { emoji: '✨', label: 'Plain rules', detail: 'No twist this round.' },
  double_points_fast: { emoji: '⚡', label: 'Faster round', detail: 'Turns are 2 seconds shorter this round.' },
};

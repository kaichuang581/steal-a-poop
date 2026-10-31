export function rejectMessage(reason: string | undefined, chainLetter: string): string {
  switch (reason) {
    case 'format': return 'Letters only.';
    case 'too_short': return 'Words need 3+ letters.';
    case 'wrong_start': return `Must start with ${chainLetter.toUpperCase()}.`;
    case 'not_in_dictionary': return 'Not in the dictionary.';
    case 'already_used': return 'Already used this round.';
    case 'modifier_no_e': return 'No E allowed this round.';
    case 'modifier_six_plus': return '6+ letters only this round.';
    case 'modifier_double_letter': return 'Needs a double letter this round.';
    case 'no_tokens': return 'No steal tokens left.';
    case 'outside_steal_window': return 'Steal window is the last 3 seconds.';
    default: return 'Not allowed right now.';
  }
}

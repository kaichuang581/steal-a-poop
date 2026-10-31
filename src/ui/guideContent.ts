import { FAIL_PENALTY, STEAL_BONUS, STEAL_WINDOW_MS, TOKENS_PER_ROUND, TRAP_PAYOUT, TURNS_PER_PLAYER_PER_ROUND } from '../engine';

export const BASICS = [
  { art: '🅲 → 🅰 → 🆃', title: 'Chain words', text: 'Each word must start with the last letter of the previous one. 3+ letters, real words, no repeats in a round.' },
  { art: '💩 ➕  or  💰', title: 'Play or bank', text: 'PLAY adds your word’s points to the shared pile. BANK takes the whole pile for yourself, and the chain letter stays.' },
  { art: '⏱️ 10s → 5s', title: 'Beat the clock', text: `You get 10s, minus 1s per 10 pile points (never under 5s). A timeout or invalid word costs ${FAIL_PENALTY} points.` },
  { art: `🫳 ⚡ +${STEAL_BONUS}`, title: 'Steal', text: `In the last ${STEAL_WINDOW_MS / 1000}s of someone else’s turn, spend a token (${TOKENS_PER_ROUND} per round) and submit a word to take the turn, bank the whole pile, and get +${STEAL_BONUS}.` },
  { art: '❌ 🔥  3 rounds', title: 'Traps & burns', text: `End on X, Z, Q or J and, if the next player fails, you get +${TRAP_PAYOUT}. Unbanked pile burns at round end. Highest banked score after 3 rounds wins.` },
];

export const GLOSSARY: { term: string; def: string }[] = [
  { term: 'Chain letter', def: 'The letter your word must start with: the last letter of the previous word. It does not change when someone banks.' },
  { term: 'Play', def: 'Submit a word. Its points go into the shared pile.' },
  { term: 'Pile', def: 'The shared pool of points. It belongs to nobody until someone banks or steals it, and it burns at the end of the round.' },
  { term: 'Bank', def: 'On your turn, move the whole pile into your own score instead of playing a word. The pile resets to 0.' },
  { term: 'Banked score', def: 'Your permanent score. It carries across all 3 rounds. Penalties come off it, so it can go negative.' },
  { term: 'Steal', def: `During the steal window, spend a token and submit a valid word. You take the turn, bank the whole pile (your word included) and get +${STEAL_BONUS}.` },
  { term: 'Steal window', def: `The last ${STEAL_WINDOW_MS / 1000} seconds of another player’s turn, when stealing is allowed.` },
  { term: 'Steal token', def: `You get ${TOKENS_PER_ROUND} per round. Spent when you claim a steal; refunded if the active player finishes before you submit.` },
  { term: 'Trap letter', def: `X, Z, Q or J. Ending a word on one traps the next player: if they time out or play an invalid word you get +${TRAP_PAYOUT}.` },
  { term: 'Burn', def: 'Any pile left unbanked when a round ends is destroyed.' },
  { term: 'Modifier', def: 'A special rule for one round, announced in the banner at the start of the round and shown in the top bar.' },
  { term: 'Rarity', def: 'Common, uncommon or rare. Multiplies a word’s length for points. Estimated from letter frequency.' },
  { term: 'Round', def: `One of three. Each player gets ${TURNS_PER_PLAYER_PER_ROUND} turns per round.` },
  { term: 'Tiebreak', def: 'Equal banked scores are broken by most steals, then by longest word played.' },
  { term: 'Practice', def: 'A game against easy bots with no penalties, retries for invalid words, a longer timer and hints.' },
  { term: 'Daily Table', def: 'One game per UTC day with the same letter, modifiers and bots for everyone. Your result and streak are saved in this browser.' },
];

export const FAQ: { q: string; a: string }[] = [
  { q: 'Why was my word rejected?', a: 'It must be in the dictionary, start with the chain letter, have 3+ letters, not already be used this round, and obey the round’s modifier. The dictionary is the ENABLE Scrabble-style word list, so some everyday words (names, slang, brands) are missing and some odd words are valid.' },
  { q: 'What happens if I submit an invalid word?', a: `In a normal game you lose ${FAIL_PENALTY} points and your turn passes immediately, so check your spelling first. In practice mode nothing happens and you can try again.` },
  { q: 'Can I bank when the pile is empty?', a: 'Yes. It just passes your turn without gaining anything.' },
  { q: 'Is the pile mine if I played the last word?', a: 'No. The pile is shared. Whoever banks (or steals) it gets it all. Playing a word only grows it.' },
  { q: 'When should I bank?', a: 'Bank when the pile is big enough that losing it would hurt: it can be stolen, and it burns at round end. But banking skips your word, and a growing pile also shrinks everyone’s timer.' },
  { q: 'How does stealing work?', a: `Wait for the last ${STEAL_WINDOW_MS / 1000}s of another player’s turn. Press STEAL (or type a word and press Enter): it spends a token. Submit a valid word before they finish and you take their turn and the whole pile, plus ${STEAL_BONUS}. A bad word loses the token. If they finish first, you get the token back.` },
  { q: 'Do I get anything if someone steals from a trap?', a: 'No. The trap pays only when the next player times out or plays an invalid word. A steal, a bank or a valid play cancels it.' },
  { q: 'Why do some words score so much?', a: 'Points are length × rarity plus letter bonuses, and X, Z, Q, J, Y, K, V and W are worth extra. A long word full of unusual letters can be worth many times a short common one. See the Scoring tab.' },
  { q: 'Is my progress saved?', a: 'Only in this browser: your nickname, settings, whether you have seen the tutorial, tips, and your Daily Table result and streak. There are no accounts, so clearing site data erases it, and it does not follow you to another device.' },
  { q: 'Can I replay the Daily Table?', a: 'No, one attempt per day. Starting it counts as your attempt, even if you close the tab.' },
  { q: 'Can I replay this tutorial?', a: 'Yes: Settings on the start screen, then Replay tutorial.' },
];

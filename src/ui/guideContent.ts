import { EXTRA_WOOL_CAP, LIVES_PER_GAME, STEAL_COOLDOWN_MS, STEAL_WINDOW_MS } from '../engine';

const red = STEAL_WINDOW_MS / 1000;
const cooldown = STEAL_COOLDOWN_MS / 1000;

export const BASICS = [
  { art: '🅲 → 🅰 → 🆃', title: 'Chain words', text: 'On your turn, type a real word (3+ letters) that starts with the last letter of the previous word. A word that doesn’t work just bounces, so try again while your timer runs.' },
  { art: `🧶 × ${LIVES_PER_GAME}`, title: 'Wool balls are lives', text: `Every sheep starts with ${LIVES_PER_GAME} wool balls. Run out of time and you lose one. No wool left and you freeze solid: you’re out.` },
  { art: '🔴 🫳 🧶', title: 'Steal', text: `When someone else’s timer turns red (their last ${red} seconds), type a word and press STEAL. First good word takes one of their wool balls. A bad steal word costs nothing.` },
  { art: '❌ 🪤 🧶', title: 'Traps', text: 'End a word on X, Z, Q or J. If the next sheep runs out of time, you get a wool ball.' },
  { art: '⏱️ 16s → 5s', title: 'Faster every round', text: 'Each round every sheep takes 2 turns, and turns get 2 seconds shorter each round, down to 5. Later rounds add a twist.' },
  { art: '🏆 🐑', title: 'Last sheep standing', text: 'The game ends the moment only one sheep is not frozen. That sheep wins.' },
];

export const GLOSSARY: { term: string; def: string }[] = [
  { term: 'Chain letter', def: 'The letter your word must start with: the last letter of the previous word.' },
  { term: 'Wool ball', def: `A life. Every sheep starts with ${LIVES_PER_GAME} (or whatever the table is set to). You can hold up to ${EXTRA_WOOL_CAP} more than you started with.` },
  { term: 'Running out of time', def: 'If your timer ends before you play a good word, you lose a wool ball and the turn moves on. Bad words on their own cost nothing.' },
  { term: 'Frozen', def: 'Out of wool. A frozen sheep gets no more turns and cannot steal.' },
  { term: 'Steal', def: `When another sheep’s timer turns red, type a word that starts with the chain letter and press STEAL. The first good word takes one of their wool balls (+1 for you, −1 for them) and the turn moves on.` },
  { term: 'Red timer', def: `The last ${red} seconds of a turn. That is when everyone else can steal.` },
  { term: 'Trap letter', def: 'X, Z, Q or J. End a word on one and, if the next sheep runs out of time, you get a wool ball.' },
  { term: 'Round', def: 'Every sheep takes 2 turns, then a new round starts with a shorter timer: 16 s, 14 s, 12 s and so on, down to 5 s.' },
  { term: 'Twist', def: 'A special rule for one round, shown at the top: no E, 6+ letters, a double letter, or a faster round (2 seconds shorter). The first round has none.' },
  { term: 'Practice', def: 'A game against easy bots with a longer timer and hints. You never lose wool; the bots do.' },
  { term: 'Daily Table', def: 'One game per UTC day with the same starting letter, twists and bots for everyone.' },
];

export const FAQ: { q: string; a: string }[] = [
  { q: 'How do I win?', a: 'Be the last sheep standing. Keep your wool by playing words in time, and take other sheep’s wool by stealing and setting traps.' },
  { q: 'Why was my word rejected?', a: 'It must be in the dictionary, start with the chain letter, have 3+ letters, not already be used this round, and follow the round’s twist. The dictionary is the ENABLE Scrabble-style word list, so some everyday words (names, slang, brands) are missing and some odd words are valid.' },
  { q: 'Does a bad word cost me anything?', a: 'No. It just bounces and you can try again while your timer runs. Only running out of time costs a wool ball.' },
  { q: 'What if I make a typo?', a: 'If your word is one letter away from exactly one real word, the game suggests it, for example “batmans → batman”. Submit again to accept it, or change your word. This works for steals too.' },
  { q: 'How does stealing work?', a: `When another sheep’s timer turns red (their last ${red} seconds), type a word starting with the chain letter and press STEAL or Enter. The first good word wins: you take one of their wool balls and the turn moves on.` },
  { q: 'What happens if my steal word is wrong?', a: `Nothing bad. It bounces, and you wait ${cooldown} second before you can try to steal again.` },
  { q: 'When do traps pay?', a: 'Only when the sheep after you runs out of time. If they play a good word or someone steals, the trap does nothing.' },
  { q: 'Is there a limit on wool?', a: `Yes: you can hold up to ${EXTRA_WOOL_CAP} more wool balls than you started with.` },
  { q: 'Are there points?', a: 'No. There are no points, no pile and no banking. Wool balls are all that count.' },
  { q: 'Can I lose wool in practice?', a: 'No. In practice you never lose wool, but the bots do, so you can learn stealing and traps safely.' },
  { q: 'Is my progress saved?', a: 'Only in this browser: your nickname, settings, whether you have seen the tutorial, tips, and your daily results. There are no accounts, so clearing site data erases it, and it does not follow you to another device.' },
  { q: 'Can I replay this tutorial?', a: 'Yes: Settings on the start screen, then Replay tutorial.' },
];

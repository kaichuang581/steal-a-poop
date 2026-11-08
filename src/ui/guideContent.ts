import { EXTRA_WOOL_CAP, LIVES_PER_GAME } from '../engine';

export const BASICS = [
  { art: 'C → A → T', title: 'Chain words', text: 'On your turn, type a real word (3+ letters) that starts with the last letter of the previous word. A word that doesn’t work just bounces, so try again while your timer runs.' },
  { art: `wool × ${LIVES_PER_GAME}`, title: 'Wool balls are lives', text: `Every sheep starts with ${LIVES_PER_GAME} wool balls. Run out of time and you lose one. No wool left and you freeze solid: you’re out.` },
  { art: 'X Z Q J', title: 'Traps', text: 'End a word on X, Z, Q or J. If the next sheep runs out of time, you get a wool ball.' },
  { art: '15s → 5s', title: 'Faster every round', text: 'Each round every sheep takes 2 turns, and turns get faster each round: 15, 10, then 5 seconds. An alarm calls each change. Later rounds add a twist.' },
  { art: '1 left', title: 'Last sheep standing', text: 'The game ends the moment only one sheep is not frozen. That sheep wins.' },
];

export const GLOSSARY: { term: string; def: string }[] = [
  { term: 'Chain letter', def: 'The letter your word must start with: the last letter of the previous word.' },
  { term: 'Wool ball', def: `A life. Every sheep starts with ${LIVES_PER_GAME} (or whatever the table is set to). You can hold up to ${EXTRA_WOOL_CAP} more than you started with.` },
  { term: 'Running out of time', def: 'If your timer ends before you play a good word, you lose a wool ball and the turn moves on. Bad words on their own cost nothing.' },
  { term: 'Frozen', def: 'Out of wool. A frozen sheep gets no more turns.' },
  { term: 'Trap letter', def: 'X, Z, Q or J. End a word on one and, if the next sheep runs out of time, you get a wool ball.' },
  { term: 'Round', def: 'Every sheep takes 2 turns, then a new round starts with a shorter timer: 15 s, 10 s, then 5 s.' },
  { term: 'Twist', def: 'A special rule for one round, called out by an alarm: no E, 6+ letters, or a double letter. The first round has none.' },
  { term: 'Practice', def: 'A 1v1 speed run against one bot on one life. Each word you play scores a point; choose your starting clock and bot, and beat your best.' },
  { term: 'Daily Table', def: 'One game per UTC day with the same starting letter, twists and bots for everyone.' },
];

export const FAQ: { q: string; a: string }[] = [
  { q: 'How do I win?', a: 'Be the last sheep standing. Keep your wool by playing words in time, and win more by setting traps.' },
  { q: 'Why was my word rejected?', a: 'It must be in the dictionary, start with the chain letter, have 3+ letters, not already be used this round, and follow the round’s twist. The dictionary is the ENABLE Scrabble-style word list, so some everyday words (names, slang, brands) are missing and some odd words are valid.' },
  { q: 'Does a bad word cost me anything?', a: 'No. It just bounces and you can try again while your timer runs. Only running out of time costs a wool ball.' },
  { q: 'What if I make a typo?', a: 'If your word is one letter away from exactly one real word, the game suggests it, for example “batmans → batman”. Submit again to accept it, or change your word.' },
  { q: 'When do traps pay?', a: 'Only when the sheep after you runs out of time. If they play a good word, the trap does nothing.' },
  { q: 'Is there a limit on wool?', a: `Yes: you can hold up to ${EXTRA_WOOL_CAP} more wool balls than you started with.` },
  { q: 'Are there points?', a: 'No. There are no points, no pile and no banking. Wool balls are all that count.' },
  { q: 'How does practice work?', a: 'It is you against one bot, on one life. The first time your clock runs out the run ends, and your score is the words you played. No hints or twists. The Tutorial is the safe place to learn.' },
  { q: 'Is my progress saved?', a: 'Only in this browser: your nickname, settings, whether you have seen the tutorial, tips, and your daily results. There are no accounts, so clearing site data erases it, and it does not follow you to another device.' },
  { q: 'Can I replay this tutorial?', a: 'Yes: Settings on the start screen, then Replay tutorial.' },
];

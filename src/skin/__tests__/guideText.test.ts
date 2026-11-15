import { describe, expect, it } from 'vitest';
import { ALL_MODIFIERS, LIVES_PER_GAME, TURN_MS_BY_ROUND } from '../../engine';
import { BASICS, FAQ, GLOSSARY } from '../../ui/guideContent';
import { GUIDE_QUESTIONS, GUIDE_WORDS } from '../components/PaintedGuide';

// How to play went stale once: three of eight twists, a Daily Table this game no longer has, "there are no accounts".
const shared = [...BASICS.map((b) => `${b.title} ${b.text}`), ...GLOSSARY.map((g) => `${g.term} ${g.def}`), ...FAQ.map((f) => `${f.q} ${f.a}`)].join('\n');
const painted = [...BASICS.map((b) => `${b.title} ${b.text}`), ...GUIDE_WORDS.map((g) => `${g.term} ${g.def}`), ...GUIDE_QUESTIONS.map((f) => `${f.q} ${f.a}`)].join('\n');

describe('How to play says what the game does', () => {
  it('counts the twists the engine deals', () => {
    const twist = GLOSSARY.find((g) => g.term === 'Twist')!.def;
    expect(twist).toContain(`There are ${ALL_MODIFIERS.length}`);
    expect(ALL_MODIFIERS).toHaveLength(8); // a ninth twist needs a word in that sentence
  });
  it('gives the engine\'s wool balls and turn lengths', () => {
    expect(shared).toContain(`starts with ${LIVES_PER_GAME} wool balls`);
    expect(shared).toContain(TURN_MS_BY_ROUND.map((ms) => ms / 1000).join(', ').replace(/, (\d+)$/, ', then $1') + ' seconds');
  });
  it('teaches no rule the game dropped, in either look', () => {
    for (const text of [shared, painted]) {
      expect(text).not.toMatch(/\bsteal|\btrap|\bbank(?!ing\.)|\bpile(?!\b and no banking)|hint button/i);
      expect(text).not.toMatch(/there are no accounts/i);
    }
  });
  it('the painted game speaks of Counting Sheep, the save code and what an account keeps, not of a Daily Table', () => {
    expect(painted).not.toMatch(/Daily Table|daily results/);
    expect(painted).toMatch(/Counting Sheep/);
    expect(painted).toMatch(/save code/i);
    expect(painted).toMatch(/If you sign in/);
    expect(GUIDE_WORDS).toHaveLength(GLOSSARY.length);
    expect(GUIDE_QUESTIONS).toHaveLength(FAQ.length);
  });
});

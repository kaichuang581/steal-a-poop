import {
  EXTRA_WOOL_CAP, FIRST_ROUND_TURN_MS, LAST_ROUND_TURN_MS, LIVES_PER_GAME, STEAL_COOLDOWN_MS, STEAL_WINDOW_MS, TURN_MS_STEP,
} from '../engine';
import type { RoundModifier } from '../engine';
import { MODIFIER_INFO } from '../lib/modifiers';

/** The twists the engine can still deal (the points-only one is retired). */
const TWISTS: RoundModifier[] = ['no_e', 'six_plus', 'double_letter', 'double_points_fast'];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-4">
      <h3 className="mb-2 text-sm font-black uppercase tracking-wider text-amber-300">{title}</h3>
      {children}
    </section>
  );
}

function Rule({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-2 rounded-lg bg-white/5 p-2">
      <span aria-hidden="true" className="shrink-0">{icon}</span>
      <span>{children}</span>
    </li>
  );
}

/**
 * The "How to play" rules card (kept under its old name so existing imports work). Numbers come from the engine
 * constants, so it cannot drift.
 */
export function ScoringTable() {
  const red = STEAL_WINDOW_MS / 1000;
  return (
    <div className="text-sm text-white/85">
      <Section title="Your turn">
        <ul className="space-y-1">
          <Rule icon="🔤">Type a real word (3+ letters) that starts with the <b>chain letter</b>: the last letter of the word before.</Rule>
          <Rule icon="↩️">A bad word just bounces. Try again while your timer runs. Clear typos get a suggested fix.</Rule>
          <Rule icon="🧶">Run out of time and you <b>lose a wool ball</b>. No wool left and you <b>freeze solid</b>: you’re out.</Rule>
        </ul>
      </Section>

      <Section title="Steal">
        <ul className="space-y-1">
          <Rule icon="🔴">When someone else’s timer <b>turns red</b> (their last {red} s), type a word and press <b>STEAL</b>.</Rule>
          <Rule icon="🫳">First good word <b>takes one of their wool balls</b>, and the turn moves on.</Rule>
          <Rule icon="⏳">A bad steal word costs nothing: wait {STEAL_COOLDOWN_MS / 1000} s and try again.</Rule>
        </ul>
      </Section>

      <Section title="Traps">
        <ul className="space-y-1">
          <Rule icon="🪤">End a word on <b>X, Z, Q or J</b>. If the next sheep runs out of time, you get a wool ball.</Rule>
        </ul>
      </Section>

      <Section title="Rounds">
        <ul className="space-y-1">
          <Rule icon="⏱️">
            Each round every sheep takes 2 turns. Turns get {TURN_MS_STEP / 1000} s shorter each round:{' '}
            {FIRST_ROUND_TURN_MS / 1000} s, {(FIRST_ROUND_TURN_MS - TURN_MS_STEP) / 1000} s,{' '}
            {(FIRST_ROUND_TURN_MS - 2 * TURN_MS_STEP) / 1000} s … down to {LAST_ROUND_TURN_MS / 1000} s.
          </Rule>
          <Rule icon="🎲">
            Rounds after the first add a twist:{' '}
            {TWISTS.map((m) => MODIFIER_INFO[m].label).join(', ')}.
          </Rule>
        </ul>
      </Section>

      <Section title="Winning">
        <ul className="space-y-1">
          <Rule icon="🏆"><b>Last sheep standing wins.</b> The game ends when only one sheep isn’t frozen.</Rule>
          <Rule icon="🐑">Everyone starts with {LIVES_PER_GAME} wool balls (unless the table says otherwise) and can hold up to {EXTRA_WOOL_CAP} extra.</Rule>
          <Rule icon="🌱">Practice: easy bots, a longer timer and hints. You never lose wool there.</Rule>
        </ul>
      </Section>
    </div>
  );
}

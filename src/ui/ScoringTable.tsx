import {
  ALL_MODIFIERS, EXTRA_WOOL_CAP, LAST_ROUND_TURN_MS, LIVES_PER_GAME, TURN_MS_BY_ROUND,
} from '../engine';
import { MODIFIER_INFO } from '../lib/modifiers';

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
  return (
    <div className="text-sm text-white/85">
      <Section title="Your turn">
        <ul className="space-y-1">
          <Rule icon="•">Type a real word (3+ letters) that starts with the <b>chain letter</b>: the last letter of the word before.</Rule>
          <Rule icon="•">A bad word just bounces. Try again while your timer runs. Clear typos get a suggested fix.</Rule>
          <Rule icon="•">Run out of time and you <b>lose a wool ball</b>. No wool left and you <b>freeze solid</b>: you’re out.</Rule>
        </ul>
      </Section>

      <Section title="Traps">
        <ul className="space-y-1">
          <Rule icon="•">End a word on <b>X, Z, Q or J</b>. If the next sheep runs out of time, you get a wool ball.</Rule>
        </ul>
      </Section>

      <Section title="Rounds">
        <ul className="space-y-1">
          <Rule icon="•">
            Each round every sheep takes 2 turns. Turns get faster every round:{' '}
            {TURN_MS_BY_ROUND.map((ms) => `${ms / 1000} s`).join(', ')}, then {LAST_ROUND_TURN_MS / 1000} s for good.
          </Rule>
          <Rule icon="•">
            Every round after the first has a twist:{' '}
            {ALL_MODIFIERS.map((m) => MODIFIER_INFO[m].label).join(', ')}.
          </Rule>
        </ul>
      </Section>

      <Section title="Winning">
        <ul className="space-y-1">
          <Rule icon="•"><b>Last sheep standing wins.</b> The game ends when only one sheep isn’t frozen.</Rule>
          <Rule icon="•">Everyone starts with {LIVES_PER_GAME} wool balls (unless the table says otherwise) and can hold up to {EXTRA_WOOL_CAP} extra.</Rule>
          <Rule icon="•">Practice: a 1v1 speed run against one bot on one life. Each word you play scores a point.</Rule>
        </ul>
      </Section>
    </div>
  );
}

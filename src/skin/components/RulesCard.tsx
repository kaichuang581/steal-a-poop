import type { ReactNode } from 'react';
import {
  EXTRA_WOOL_CAP, FIRST_ROUND_TURN_MS, LAST_ROUND_TURN_MS, LIVES_PER_GAME, STEAL_COOLDOWN_MS, STEAL_WINDOW_MS, TURN_MS_STEP,
} from '../../engine';
import type { GameState } from '../../engine';
import { ClockIcon, DoubleIcon, NoEIcon, RulerIcon, SnowflakeIcon, TrophyIcon, WolfIcon } from './Icons';
import { WoolBall } from './Lives';

function Row({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="sk-rule-row">
      <span className="sk-rule-icon" aria-hidden="true">{icon}</span>
      <span>{children}</span>
    </li>
  );
}

/** A tile with a letter, the way words are spelled on the table. */
export function MiniTile({ ch, hot = false }: { ch: string; hot?: boolean }) {
  return <span className={`sk-mini-tile ${hot ? 'sk-mini-tile-hot' : ''}`}>{ch.toUpperCase()}</span>;
}

/** The whole game on one card: your turn, wool, stealing, traps, rounds, winning. Numbers come from the engine. */
export function RulesCard() {
  const red = STEAL_WINDOW_MS / 1000;
  return (
    <div className="sk-rules">
      <section>
        <h3>Your turn</h3>
        <ul>
          <Row icon={<span className="flex gap-0.5"><MiniTile ch="c" /><MiniTile ch="a" /><MiniTile ch="t" hot /></span>}>
            Type a real word, 3 letters or more, starting with the <b>last letter of the word before</b>. After CAT comes a T-word.
          </Row>
          <Row icon={<WoolBall full size={22} />}>Run out of time and you <b>lose a wool ball</b>. Wool balls are your lives.</Row>
          <Row icon={<SnowflakeIcon size={20} />}>No wool left and you <b>freeze solid</b>: you’re out of the game.</Row>
        </ul>
      </section>
      <section>
        <h3>Stealing</h3>
        <ul>
          <Row icon={<WolfIcon size={22} />}>
            When another sheep’s timer <b>turns red</b> (their last {red} seconds), type a word first and press Enter. You <b>take one of their wool balls</b>.
          </Row>
          <Row icon={<ClockIcon size={20} />}>A wrong steal costs nothing. Wait {STEAL_COOLDOWN_MS / 1000} second and try again.</Row>
        </ul>
      </section>
      <section>
        <h3>Traps</h3>
        <ul>
          <Row icon={<span className="flex gap-0.5"><MiniTile ch="x" /><MiniTile ch="z" /><MiniTile ch="q" /><MiniTile ch="j" /></span>}>
            End a word on X, Z, Q or J. If the next sheep runs out of time, <b>you get a wool ball</b>.
          </Row>
        </ul>
      </section>
      <section>
        <h3>Rounds</h3>
        <ul>
          <Row icon={<ClockIcon size={20} />}>
            Turns start at {FIRST_ROUND_TURN_MS / 1000} seconds and get {TURN_MS_STEP / 1000} seconds shorter every round, down to {LAST_ROUND_TURN_MS / 1000}.
          </Row>
          <Row icon={<span className="flex gap-1"><NoEIcon size={16} /><RulerIcon size={16} /><DoubleIcon size={16} /></span>}>
            After the first round each round has a twist: no letter E, 6 letters or more, a double letter, or a faster clock.
          </Row>
        </ul>
      </section>
      <section>
        <h3>Winning</h3>
        <ul>
          <Row icon={<TrophyIcon size={20} />}><b>Last sheep standing wins.</b> Everyone starts with {LIVES_PER_GAME} wool balls and can win up to {EXTRA_WOOL_CAP} more.</Row>
        </ul>
      </section>
    </div>
  );
}

/** Every word this round, newest first: who played it, and whether it was a steal. */
export function ChainList({ game }: { game: GameState }) {
  const rows = [...game.history].reverse().filter((h) => h.word);
  if (!rows.length) return <p className="sk-hand text-center text-lg" style={{ color: 'var(--ink-soft)' }}>No words yet this round.</p>;
  return (
    <ol className="sk-chain-list">
      {rows.map((h, i) => (
        <li key={`${i}-${h.word}`} data-steal={h.kind === 'steal' || undefined}>
          <span className="sk-chain-word">{h.word!.split('').map((ch, k) => <MiniTile key={k} ch={ch} hot={k === h.word!.length - 1 && i === 0} />)}</span>
          <span className="sk-chain-who">{game.players[h.seat]?.name}{h.kind === 'steal' ? ' · stole' : ''}</span>
        </li>
      ))}
    </ol>
  );
}

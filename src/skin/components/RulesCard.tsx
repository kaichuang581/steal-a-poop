import type { ReactNode } from 'react';
import {
  LAST_ROUND_TURN_MS, LIVES_PER_GAME, TURN_MS_BY_ROUND,
} from '../../engine';
import type { GameState } from '../../engine';
import { ClockIcon, NoEIcon, SnowflakeIcon, TrophyIcon } from './Icons';
import '../kit/nameplate.css';
import '../kit/surfaces.css';
import './hud-boards.css';

function Row({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="hb-rule rc-tile">
      <span className="hb-rule-icon" aria-hidden="true">{icon}</span>
      <span>{children}</span>
    </li>
  );
}

/** A letter on a small dark tile, the name tag's look; `hot` is the lantern one (the letter the next word starts with). */
export function MiniTile({ ch, hot = false }: { ch: string; hot?: boolean }) {
  return <span className="hb-mini-tile" data-hot={hot || undefined}>{ch.toUpperCase()}</span>;
}

/** Wool balls as the name tag's dots: `have` of `of`, the lost ones dimmed. */
const Dots = ({ have, of }: { have: number; of: number }) => (
  <span className="np-lives">{Array.from({ length: of }, (_, i) => <i key={i} data-off={i >= have || undefined} />)}</span>
);

/** The whole game on one card: your turn, wool, rounds, winning. Numbers come from the engine. */
export function RulesCard() {
  return (
    <div className="hb-rules hm rc hb">
      <section>
        <h3>Your turn</h3>
        <ul>
          <Row icon={<span className="hb-tiles"><MiniTile ch="c" /><MiniTile ch="a" /><MiniTile ch="t" hot /></span>}>
            Type a real word, 3 letters or more, starting with the <b>last letter of the word before</b>. After CAT comes a T-word.
          </Row>
          <Row icon={<Dots have={2} of={3} />}>Run out of time and you <b>lose a wool ball</b>. Wool balls are your lives.</Row>
          <Row icon={<SnowflakeIcon size={20} />}>No wool left and you <b>freeze solid</b>: you’re out of the game.</Row>
        </ul>
      </section>
      <i className="rc-groove" aria-hidden="true" />
      <section>
        <h3>Rounds</h3>
        <ul>
          <Row icon={<ClockIcon size={20} />}>
            {`Turns get faster every round, and the alarm calls it: ${TURN_MS_BY_ROUND.map((ms) => ms / 1000).join(', ')} seconds, then ${LAST_ROUND_TURN_MS / 1000} for good.`}
          </Row>
          <Row icon={<NoEIcon size={20} />}>
            After the first round every round has a twist, called out by the alarm: no letter E, A or S, 6 letters or more, 5 letters or fewer, a double letter, an O, or a vowel at the end.
          </Row>
        </ul>
      </section>
      <i className="rc-groove" aria-hidden="true" />
      <section>
        <h3>Winning</h3>
        <ul>
          <Row icon={<span className="hb-gold"><TrophyIcon size={20} /></span>}><b>Last sheep standing wins.</b> {`Everyone starts with ${LIVES_PER_GAME} wool balls, and wool is never won back.`}</Row>
        </ul>
      </section>
    </div>
  );
}

/** Every word this round, newest first, and who played it: a tile a word, the newest one's last letter lit. */
export function ChainList({ game }: { game: GameState }) {
  const rows = [...game.history].reverse().filter((h) => h.word);
  if (!rows.length) return <p className="hb-empty hm rc hb">No words yet this round.</p>;
  return (
    <ol className="hb-chain hm rc hb">
      {rows.map((h, i) => {
        const w = h.word!.toUpperCase();
        return (
          <li key={`${i}-${h.word}`} className="hb-chain-row rc-tile">
            <span className="hb-chain-word">{i === 0 ? <>{w.slice(0, -1)}<span data-link>{w.slice(-1)}</span></> : w}</span>
            <span className="hb-chain-who">{game.players[h.seat]?.name}</span>
          </li>
        );
      })}
    </ol>
  );
}

import type { Player, TurnState } from '../engine';
import type { Cosmetics } from '../net/protocol';
import { SecondsLeft } from './Countdown';
import { WordText } from './WordText';

interface Props {
  player: Player;
  turn: TurnState | null;
  /** This seat is the local player in a room game. */
  mine?: boolean;
  /** What the human in this seat wears. Only the badge and title show here; the seat keeps its own color so seats stay easy to tell apart. */
  cosmetics?: Cosmetics;
}

/** The label that floats above a player's 3D character: name, banked score, last word, time left. */
export function Seat({ player, turn, mine, cosmetics }: Props) {
  const active = turn?.seat === player.id;
  return (
    <div
      className="flex w-28 flex-col items-center gap-0.5 rounded-xl border bg-black/55 px-2 py-1 backdrop-blur-sm"
      style={{ borderColor: active ? player.color : 'rgba(255,255,255,0.1)', boxShadow: mine ? '0 0 0 2px #fff' : undefined }}
      data-seat={player.id}
      data-tour={player.isHuman ? 'me' : undefined}
    >
      <div className="max-w-full truncate text-xs font-bold leading-tight sm:text-sm" style={{ color: player.color }} data-seat-name={player.id} title={cosmetics?.title}>
        {cosmetics?.badge && <span aria-hidden="true">{cosmetics.badge} </span>}{player.name}{mine ? ' (you)' : ''}
      </div>
      {!player.isHuman && <div className="text-[10px] font-bold leading-none text-white/70">farm sheep</div>}
      <div className="flex items-center gap-2 text-[11px] leading-none sm:text-xs">
        <span className="font-black tabular-nums">{player.banked}</span>
        {active && turn && (
          <span className="font-bold tabular-nums text-white/80"><SecondsLeft endsAt={turn.endsAt} max={turn.durationMs} /></span>
        )}
      </div>
      <div className="min-h-4 max-w-full truncate text-[10px] font-bold uppercase tracking-wide sm:text-xs" data-seat-word={player.id}>
        {player.lastWord ? <WordText word={player.lastWord} flash={false} /> : <span className="opacity-30">—</span>}
      </div>
    </div>
  );
}

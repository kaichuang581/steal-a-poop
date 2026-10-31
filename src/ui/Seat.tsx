import type { Player, TurnState } from '../engine';
import { Countdown, SecondsLeft } from './Countdown';
import { WordText } from './WordText';

interface Props {
  player: Player;
  x: number;
  y: number;
  turn: TurnState | null;
}

export function Seat({ player, x, y, turn }: Props) {
  const active = turn?.seat === player.id;
  // Seats on the left and right edges put their word card inward, beside the avatar, where the
  // table is empty. Top and bottom seats keep it between the seat and the table centre.
  const sideSeat = Math.abs(x - 50) > 30;
  const inward = x < 50 ? 'left-full ml-1' : 'right-full mr-1';
  const cardAbove = !sideSeat && y > 55;
  const card = (
    <div
      className={`min-h-5 max-w-[4.5rem] truncate rounded-md border border-white/10 bg-black/35 px-1.5 text-[10px] font-bold uppercase tracking-wide sm:max-w-28 sm:text-xs ${
        sideSeat ? `absolute top-1/2 z-[1] -translate-y-1/2 ${inward}` : ''
      }`}
      data-seat-word={player.id}
    >
      {player.lastWord ? <WordText word={player.lastWord} flash={false} /> : <span className="opacity-30">—</span>}
    </div>
  );
  return (
    <div
      className="absolute flex w-[4.5rem] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 sm:w-28"
      style={{ left: `${x}%`, top: `${y}%` }}
      data-seat={player.id}
    >
      {cardAbove && card}
      <div className="relative size-10 sm:size-16" data-seat-avatar={player.id} data-tour={player.isHuman ? 'me' : undefined}>
        {active && turn && (
          <>
            <span
              className="absolute -inset-1.5 rounded-full opacity-80 blur-md"
              style={{ background: player.color }}
              aria-hidden="true"
            />
            <Countdown endsAt={turn.endsAt} durationMs={turn.durationMs} />
          </>
        )}
        {sideSeat && card}
        <div
          className="relative flex size-full items-center justify-center rounded-full border-2 text-xl sm:text-3xl"
          style={{ borderColor: player.color, background: 'rgba(20,12,45,0.92)' }}
        >
          <span aria-hidden="true">{player.emoji}</span>
        </div>
      </div>
      <div className="max-w-full truncate text-[11px] font-bold leading-tight sm:text-sm" style={{ color: player.color }} data-seat-name={player.id}>
        {player.name}
      </div>
      <div className="flex items-center gap-1 text-[11px] leading-none sm:text-xs">
        <span className="font-black tabular-nums">{player.banked}</span>
      </div>
      {active && turn && (
        <div className="text-[10px] font-bold tabular-nums text-white/80 sm:text-xs">
          <SecondsLeft endsAt={turn.endsAt} />
        </div>
      )}
      {!cardAbove && !sideSeat && card}
    </div>
  );
}

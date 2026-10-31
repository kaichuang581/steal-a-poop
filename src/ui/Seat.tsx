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
  const cardAbove = y > 55; // keep the last-word card between the seat and the table centre
  const card = (
    <div
      className="min-h-5 max-w-full truncate rounded-md border border-white/10 bg-black/35 px-1.5 text-[10px] font-bold uppercase tracking-wide sm:text-xs"
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
        <div
          className="relative flex size-full items-center justify-center rounded-full border-2 text-xl sm:text-3xl"
          style={{ borderColor: player.color, background: 'rgba(20,12,45,0.92)' }}
        >
          <span aria-hidden="true">{player.emoji}</span>
        </div>
      </div>
      <div className="max-w-full truncate text-[11px] font-bold leading-tight sm:text-sm" style={{ color: player.color }}>
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
      {!cardAbove && card}
    </div>
  );
}

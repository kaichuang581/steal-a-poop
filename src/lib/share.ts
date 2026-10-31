import { GAME_TITLE } from '../config';

export interface ShareInput {
  daily: string | null;
  rank: number;
  players: number;
  banked: number;
  steals: number;
  longest: number;
  streak: number;
}

const MEDALS = ['🥇', '🥈', '🥉'];

export function buildShareText(r: ShareInput): string {
  const head = `💩 ${GAME_TITLE}${r.daily ? ` · Daily ${r.daily}` : ''}`;
  const medal = MEDALS[r.rank - 1] ?? '🪑';
  const stealBar = r.steals ? '⚡'.repeat(Math.min(r.steals, 8)) : '—';
  const lines = [
    head,
    `${medal} ${r.rank}/${r.players} · ${r.banked} pts`,
    `Steals ${stealBar}`,
    `Longest ${'🟫'.repeat(Math.min(Math.max(r.longest - 2, 1), 10))} ${r.longest}`,
  ];
  if (r.daily) lines.push(`🔥 Streak ${r.streak}`);
  return lines.join('\n');
}

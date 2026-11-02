/**
 * How coins are earned. Tuned so a regular player can buy a small item after a few games and the big ones after a few days, and so
 * that making many accounts to play each other does not pay: there is a daily limit per account.
 */
export interface EarnRules {
  roomFinish: number;
  roomWin: number;
  perSteal: number;
  stealCap: number;
  dailyFinish: number;
  dailyWin: number;
  /** The most a single account can earn from games in one UTC day. */
  dailyLimit: number;
}
export const DEFAULT_RULES: EarnRules = { roomFinish: 10, roomWin: 25, perSteal: 2, stealCap: 10, dailyFinish: 15, dailyWin: 10, dailyLimit: 200 };

export interface Reward {
  coins: number;
  /** Plain-language lines for the end screen, for example "Finished a game +10". */
  parts: { label: string; coins: number }[];
}

export function rewardFor(mode: 'room' | 'daily', p: { won: boolean; steals: number }, rules: EarnRules = DEFAULT_RULES): Reward {
  const parts: Reward['parts'] = [];
  parts.push(mode === 'room' ? { label: 'Finished the game', coins: rules.roomFinish } : { label: 'Finished the Daily Table', coins: rules.dailyFinish });
  if (p.won) parts.push(mode === 'room' ? { label: 'Won', coins: rules.roomWin } : { label: 'Won the Daily Table', coins: rules.dailyWin });
  const steals = Math.min(p.steals * rules.perSteal, rules.stealCap);
  if (steals > 0) parts.push({ label: `${p.steals} steal${p.steals === 1 ? '' : 's'}`, coins: steals });
  return { coins: parts.reduce((n, x) => n + x.coins, 0), parts };
}

/** Trims a reward so the day's total stays within the limit. */
export function capReward(reward: Reward, earnedToday: number, rules: EarnRules = DEFAULT_RULES): Reward {
  const room = Math.max(0, rules.dailyLimit - earnedToday);
  if (reward.coins <= room) return reward;
  return { coins: room, parts: [...reward.parts, { label: 'Daily limit reached', coins: room - reward.coins }] };
}

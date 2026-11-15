import { DEFAULT_SETTINGS } from '../../engine';
import type { Difficulty, GameSettings } from '../../engine';
import { load, save } from '../../lib/storage';
import type { RoomSettingsDTO } from '../../net/protocol';
import { useRoomStore } from '../../state/roomStore';
import { useStore } from '../../state/store';

/**
 * Farm sheep (bots) in a lobby. One lobby covers what used to be two menu items, Create lobby and Custom game (Brian,
 * 2026-11-14: "make custom game and create lobby the same thing. in create lobby they can choose whether to ADD bots.
 * so they can play only with bots, only players, or bots and players, like super smash bros"): the host adds as many
 * farm sheep as they like, none included.
 */
/** The most farm sheep a host can add (server/types.ts MAX_BOTS; a test keeps the two the same). */
export const MAX_BOTS = 7;
/** The old rule, for a room with no number chosen (the Quick play queue, an older server): farm sheep fill a table of four. */
const FILL_TO = 4;

export interface BotChoice { bots: number; botLevel: Difficulty }
const KEY = 'sap:lobby-bots';
/** A first lobby opens with three farm sheep, a full table of four: one press and it is a game. */
const FIRST: BotChoice = { bots: 3, botLevel: 'medium' };

/** What this device's host last chose, so their next lobby opens the same way. */
export function lobbyBots(): BotChoice {
  const saved = load<Partial<BotChoice> | null>(KEY, null);
  const bots = typeof saved?.bots === 'number' && Number.isInteger(saved.bots) && saved.bots >= 0 && saved.bots <= MAX_BOTS ? saved.bots : FIRST.bots;
  const botLevel = saved?.botLevel === 'easy' || saved?.botLevel === 'medium' || saved?.botLevel === 'hard' ? saved.botLevel : FIRST.botLevel;
  return { bots, botLevel };
}
export const rememberLobbyBots = (choice: BotChoice) => save(KEY, choice);

/** Who sits down, as the lobby shows it: how many farm sheep, whether that is the host's number, and whether it can start. */
export function tableFor(settings: Pick<RoomSettingsDTO, 'bots'> | undefined, people: number, max: number, min: number) {
  const chosen = typeof settings?.bots === 'number';
  const bots = chosen ? Math.max(0, Math.min(settings!.bots!, max - people)) : Math.max(0, FILL_TO - people);
  return { chosen, bots, seats: people + bots, enough: chosen ? people + bots >= 2 : people >= min };
}

/** "You and 3 farm sheep", "2 players, no farm sheep", "3 players and 1 farm sheep". */
export function tableLine(people: number, bots: number): string {
  // "Bots", in so many words: "farm sheep" alone did not tell a player they were not people (Brian, 2026-11-14).
  const sheep = bots === 0 ? 'no bots' : `${bots} ${bots === 1 ? 'bot' : 'bots'}`;
  if (people === 1) return bots === 0 ? 'Just you so far' : `You and ${sheep}`;
  return bots === 0 ? `${people} players, ${sheep}` : `${people} players and ${sheep}`;
}

/**
 * A lobby with nobody else in it and farm sheep added is a game against bots, and it is played on this device: the same
 * solo game Custom game used to deal, so it starts at once, pays its Wool Coins and counts on the profile as before.
 * The lobby is left first, and the game is dealt only once the server has let go of it (leaving clears the table).
 */
export function playAlone(rules: Pick<RoomSettingsDTO, 'turnsPerRound' | 'lives' | 'twists'>, choice: BotChoice): void {
  const deal = () => {
    const st = useStore.getState();
    st.setSettings({ playerCount: choice.bots + 1, tableChosen: true });
    const game: GameSettings = { ...DEFAULT_SETTINGS, turnsPerRound: rules.turnsPerRound, lives: rules.lives, twists: rules.twists };
    st.start('quick', game, choice.botLevel);
  };
  if (!useRoomStore.getState().room) return deal();
  let done = false;
  // Dealt a moment after the lobby is gone, not in the same breath: the code that hears "you have left" clears the
  // table straight after clearing the room, and would sweep away a game dealt in between.
  const go = () => { if (done) return; done = true; off(); clearTimeout(late); setTimeout(deal, 0); };
  const off = useRoomStore.subscribe((s) => { if (!s.room) go(); });
  // If the server never answers (the connection dropped as the gate opened), the game is dealt anyway.
  const late = setTimeout(go, 1500);
  useRoomStore.getState().leave();
}

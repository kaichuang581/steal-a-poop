import { motion } from 'framer-motion';
import { useState } from 'react';
import { rankPlayers, summarize } from '../engine';
import { buildShareText } from '../lib/share';
import { useStore } from '../state/store';

export function EndScreen() {
  const game = useStore((s) => s.game)!;
  const mode = useStore((s) => s.mode);
  const dailyDate = useStore((s) => s.dailyDate);
  const streak = useStore((s) => s.streak);
  const rematch = useStore((s) => s.rematch);
  const quit = useStore((s) => s.quit);
  const [copied, setCopied] = useState(false);

  const ranked = rankPlayers(game.players);
  const stats = summarize(game.players);
  const me = game.players[0];
  const myRank = ranked.findIndex((p) => p.id === 0) + 1;
  const iWon = game.winners?.includes(0) ?? false;
  const podium = [ranked[1], ranked[0], ranked[2]].filter(Boolean);
  const heights: Record<number, string> = { 0: 'h-28', 1: 'h-20', 2: 'h-14' };

  const share = async () => {
    const text = buildShareText({
      daily: mode === 'daily' ? dailyDate : null, rank: myRank, players: game.players.length,
      banked: me.banked, steals: me.steals, longest: me.longestWord.length, streak,
    });
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      window.prompt('Copy your result:', text);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/70 p-4">
      <motion.div
        role="dialog" aria-modal="true" aria-label="Game over"
        className="w-full max-w-lg rounded-3xl border-2 border-wood-light bg-[#1a1145] p-5 shadow-2xl"
        initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
      >
        <h2 className="text-center text-3xl font-black text-amber-300">
          {iWon ? 'You win! 🏆' : `${ranked[0].name} wins!`}
        </h2>
        <div className="mt-4 flex items-end justify-center gap-2">
          {podium.map((p) => {
            const place = ranked.indexOf(p);
            return (
              <div key={p.id} className="flex w-24 flex-col items-center">
                <div className="text-3xl" aria-hidden="true">{p.emoji}</div>
                <div className="max-w-full truncate text-sm font-bold" style={{ color: p.color }}>{p.name}</div>
                <div className="text-xs tabular-nums text-white/70">{p.banked} pts</div>
                <div className={`mt-1 flex w-full items-start justify-center rounded-t-lg bg-wood pt-1 text-xl ${heights[place]}`}>
                  {['🥇', '🥈', '🥉'][place]}
                </div>
              </div>
            );
          })}
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
          {[
            ['Words played', stats.wordsPlayed],
            ['Steals', stats.steals],
            ['Longest word', stats.longestWord ? `${stats.longestWord.word.toUpperCase()} (${game.players[stats.longestWord.seat].name})` : '—'],
            ['Best word', stats.bestWord ? `${stats.bestWord.word.toUpperCase()} · ${stats.bestWord.points} pts` : '—'],
          ].map(([k, v]) => (
            <div key={k as string} className="rounded-xl bg-white/5 px-3 py-2">
              <dt className="text-xs uppercase tracking-wide text-white/50">{k}</dt>
              <dd className="truncate font-black">{v}</dd>
            </div>
          ))}
        </dl>
        {mode === 'daily' && <p className="mt-3 text-center text-sm text-amber-200">🔥 Daily streak: {streak}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          {mode === 'quick' && (
            <button onClick={rematch} className="min-h-12 flex-1 rounded-xl bg-emerald-500 px-4 font-black text-emerald-950">Rematch</button>
          )}
          <button onClick={share} className="min-h-12 flex-1 rounded-xl bg-fuchsia-500 px-4 font-black">
            {copied ? 'Copied!' : 'Share'}
          </button>
          <button onClick={quit} className="min-h-12 flex-1 rounded-xl bg-white/10 px-4 font-bold">Menu</button>
        </div>
      </motion.div>
    </div>
  );
}

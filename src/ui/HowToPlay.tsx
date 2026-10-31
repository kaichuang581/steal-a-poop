import { useEffect, useRef } from 'react';
import { GAME_TITLE } from '../config';

const STEPS = [
  { art: '🅲 → 🅰 → 🆃', title: 'Chain words', text: 'Each word must start with the last letter of the previous one. 3+ letters, real words, no repeats in a round.' },
  { art: '💩 ➕  or  💰', title: 'Play or bank', text: 'PLAY adds your word’s points to the shared pile. BANK takes the whole pile for yourself, and the chain letter stays.' },
  { art: '⏱️ 10s → 5s', title: 'Beat the clock', text: 'You get 10s, minus 1s per 10 pile points (never under 5s). Timeouts and bad words cost −5.' },
  { art: '🫳 ⚡ +5', title: 'Steal', text: 'In the last 3s of someone else’s turn, spend a token (3 per round) and submit a word to take the turn, bank the whole pile, and get +5. Beaten to it? Token refunded.' },
  { art: '❌ 🔥  3 rounds', title: 'Traps & burns', text: 'End on X, Z, Q or J and if the next player fails you get +5. Unbanked pile burns at round end. Highest banked score after 3 rounds wins.' },
];

export function HowToPlay({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3" onClick={onClose}>
      <div
        role="dialog" aria-modal="true" aria-label="How to play"
        className="max-h-full w-full max-w-xl overflow-y-auto rounded-3xl border-2 border-wood-light bg-[#1a1145] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-2xl font-black text-amber-300">How to play {GAME_TITLE}</h2>
          <button ref={closeRef} onClick={onClose} className="min-h-11 min-w-11 rounded-lg bg-white/10 text-lg" aria-label="Close">✕</button>
        </div>
        <ol className="space-y-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-3 rounded-2xl bg-white/5 p-3">
              <div className="flex w-24 shrink-0 flex-col items-center justify-center rounded-xl bg-black/30 p-2 text-center text-lg font-black">
                <span aria-hidden="true">{s.art}</span>
              </div>
              <div>
                <h3 className="font-black">{i + 1}. {s.title}</h3>
                <p className="text-sm text-white/80">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

import { legalHref } from './legal/legalLinks';
import { useEffect, useRef } from 'react';
import { useRoomStore } from '../state/roomStore';

/** The rules, in one place so the banner, the first-time screen and the docs say the same thing. */
export const CHAT_RULES = [
  'No swearing or rude words.',
  'Nothing sexual.',
  'No racial slurs or hateful language.',
  'Nothing unsafe toward children, and never ask a child for personal details or photos.',
];

export const CHAT_CONSEQUENCES =
  'Spelling a word out, adding numbers or symbols, or sending one letter at a time counts too. Every message is checked before anyone sees it. A message that breaks the rules is held, your chat is suspended right away, and the message is reviewed. You can appeal to a person. Anything that puts a child at risk can be reported to the authorities.';

/** Always visible above the chat, so nobody can say they did not see it. */
export function ChatBanner({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div role="note" className="rounded-xl border-2 border-amber-400 bg-amber-500/15 p-2 text-sm">
        <div className="flex items-center gap-2 font-black text-amber-300">
          <span aria-hidden="true">⚠️</span> CHAT RULES: BREAK THEM AND YOU ARE SUSPENDED
        </div>
        <p className="mt-0.5 font-bold text-white/90">No swearing · Nothing sexual · No slurs · Keep it safe for kids</p>
        <details className="mt-0.5">
          <summary className="min-h-8 cursor-pointer text-xs font-bold text-amber-200 underline">All the rules</summary>
          <ul className="list-inside list-disc text-white/90">
            {CHAT_RULES.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-white/70">{CHAT_CONSEQUENCES}</p>
        </details>
      </div>
    );
  }
  return (
    <div role="note" className="rounded-xl border-2 border-amber-400 bg-amber-500/15 p-3 text-sm">
      <div className="flex items-center gap-2 font-black text-amber-300">
        <span aria-hidden="true">⚠️</span> CHAT RULES: BREAK THEM AND YOU ARE SUSPENDED
      </div>
      <ul className="mt-1 list-inside list-disc text-white/90">
        {CHAT_RULES.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      <p className="mt-1 text-xs text-white/70">{CHAT_CONSEQUENCES}</p>
      <p className="mt-1 text-xs text-white/70">
        <a className="underline" href={legalHref('terms')} target="_blank" rel="noopener">Terms</a>
        {' · '}
        <a className="underline" href={legalHref('child-safety')} target="_blank" rel="noopener">Child safety</a>
      </p>
    </div>
  );
}

/** Full-screen first-time notice. Chat stays locked until the player accepts. */
export function ChatRulesModal() {
  const accept = useRoomStore((s) => s.acceptRules);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => btn.current?.focus(), []);
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-black/85 p-4">
      <div
        role="alertdialog" aria-modal="true" aria-label="Chat rules"
        className="w-full max-w-md rounded-3xl border-4 border-amber-400 bg-[#1a1145] p-5 shadow-2xl"
      >
        <div className="text-center text-5xl" aria-hidden="true">⚠️</div>
        <h2 className="mt-1 text-center text-2xl font-black text-amber-300">Read the chat rules</h2>
        <p className="mt-2 text-center text-sm text-white/80">Everyone can use this chat as long as they are well-behaved. Children play here too.</p>
        <ul className="mt-3 space-y-1.5 text-base font-bold">
          {CHAT_RULES.map((r) => (
            <li key={r} className="flex gap-2 rounded-lg bg-white/5 px-3 py-2"><span aria-hidden="true">🚫</span>{r}</li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-white/75">{CHAT_CONSEQUENCES}</p>
        <p className="mt-2 text-xs text-white/70">
          By continuing you agree to the{' '}
          <a className="underline" href={legalHref('terms')} target="_blank" rel="noopener">terms</a>. See also{' '}
          <a className="underline" href={legalHref('child-safety')} target="_blank" rel="noopener">child safety</a> and the{' '}
          <a className="underline" href={legalHref('privacy')} target="_blank" rel="noopener">privacy policy</a>.
        </p>
        <button
          ref={btn} onClick={accept}
          className="mt-4 min-h-12 w-full rounded-xl bg-amber-400 text-lg font-black text-amber-950"
        >
          I understand and agree
        </button>
      </div>
    </div>
  );
}

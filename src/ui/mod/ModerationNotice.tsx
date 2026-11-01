import { useState } from 'react';
import { useRoomStore } from '../../state/roomStore';

const ago = (t: number) => {
  const mins = Math.max(1, Math.round((Date.now() - t) / 60000));
  return mins >= 90 ? `${Math.round(mins / 60)} hours` : `${mins} minute${mins === 1 ? '' : 's'}`;
};

/**
 * Tells a player where their case stands in plain words: what was held, whether a person has it,
 * whether their appeal was read, and what was decided. It never shows the filter's word or the
 * reviewer's opinion. The red "your chat is suspended" box lives in ChatPanel; this adds the detail.
 */
export function ModerationNotice() {
  const m = useRoomStore((s) => s.moderation);
  const [dismissed, setDismissed] = useState<number | null>(null);
  if (!m) return null;

  const locked = m.banned || (m.suspendedUntil !== null && m.suspendedUntil > Date.now());
  const lines: string[] = [];

  if (locked && m.heldMessage) lines.push(`Held message: "${m.heldMessage.text}"`);
  if (locked && m.openItems > 0 && m.waitingSince) {
    lines.push(`Waiting for review for ${ago(m.waitingSince)}. A person will look at anything the automatic check is unsure about.`);
  }
  if (m.appeal.state === 'open') lines.push(`Your appeal was sent${m.appeal.at ? ` ${ago(m.appeal.at)} ago` : ''} and is waiting for a person to read it.`);
  if (m.appeal.state === 'decided' && locked) {
    lines.push(`Your appeal was decided: ${m.appeal.verdict === 'clear' ? 'upheld' : 'not upheld'}.${m.appeal.reason ? ` "${m.appeal.reason}"` : ''}`);
  }

  // After a decision that restored chat, say so once, so nobody wonders why the box went away.
  const d = m.lastDecision;
  const restored = !locked && d && d.verdict === 'clear' && d.at !== dismissed && Date.now() - d.at < 24 * 3600_000;
  if (!lines.length && !restored) return null;

  return (
    <div role="status" aria-label="Moderation status" className="rounded-xl border border-sky-300/50 bg-sky-900/40 p-3 text-sm">
      {restored && d && (
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1">
            <b>Your chat is back.</b> {d.byPerson ? 'A person reviewed it and cleared it.' : 'The review cleared it.'}
            {d.reason ? ` "${d.reason}"` : ''}
          </p>
          <button onClick={() => setDismissed(d.at)} className="min-h-11 rounded-md px-2 text-xs font-bold underline">Dismiss</button>
        </div>
      )}
      {lines.map((l) => (
        <p key={l} className="mt-1 first:mt-0 break-words">{l}</p>
      ))}
    </div>
  );
}

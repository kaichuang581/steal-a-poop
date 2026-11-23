import type { MessageView } from '../model/types';

/**
 * The message card above the input: the modern kit's ink card (kit/modern InkCard), a barn-red bar for a penalty. It is
 * always mounted as the input's live region (role="status"), so screen readers hear every message, the same as the
 * classic hint line.
 */
export function MessageSlip({ message }: { message: MessageView | null }) {
  const penalty = message?.kind === 'penalty' || message?.kind === 'timeout';
  return (
    <div role="status" className="flex min-h-9 justify-center" data-typo-fix={message?.kind === 'typo' ? '' : undefined}>
      {message && (
        <div key={message.text + (message.fix ?? '')} className="md-card hm rc sk-pop sk-message-slip" data-tone={penalty ? 'barn' : 'lantern'}>
          {message.kind === 'typo' && message.fix ? (
            <span>
              “{message.text}” → <span className="sk-message-fix">“{message.fix}”</span>
              <span className="sk-message-hint">submit again to confirm, or edit</span>
            </span>
          ) : message.text}
        </div>
      )}
    </div>
  );
}

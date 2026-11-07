import type { MessageView } from '../model/types';

/**
 * Paper slip above the input. It is always mounted as the input's live region (role="status"), so screen readers
 * hear every message, the same as the classic hint line.
 */
export function MessageSlip({ message }: { message: MessageView | null }) {
  const penalty = message?.kind === 'penalty' || message?.kind === 'timeout';
  return (
    <div role="status" className="flex min-h-9 justify-center" data-typo-fix={message?.kind === 'typo' ? '' : undefined}>
      {message && (
        <div
          key={message.text + (message.fix ?? '')}
          className="kit-paper kit-paper--note sk-pop sk-message-slip text-center"
          style={{ color: penalty ? 'var(--coral-dark)' : 'var(--ink)' }}
        >
          <span className="kit-pin" />
          {message.kind === 'typo' && message.fix ? (
            <>
              “{message.text}” → <span style={{ textDecoration: 'underline', textDecorationColor: 'var(--cloth)', textDecorationThickness: 3 }}>“{message.fix}”</span>
              <span className="sk-hand ml-2" style={{ color: 'var(--ink-soft)' }}>submit again to confirm · or edit</span>
            </>
          ) : message.text}
        </div>
      )}
    </div>
  );
}

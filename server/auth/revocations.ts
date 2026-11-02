/**
 * Told when a connection must be closed because of something that happened to the account.
 *   logout  - the login ended; the client must not reconnect with that token.
 *   status  - something about the account changed (for example a parent consented); the client reconnects and picks up the new state.
 */
export type RevocationReason = 'logout' | 'status';
export type RevocationListener = (userId: string, sessionId: string | null, reason: RevocationReason) => void;

export class RevocationBus {
  private listeners = new Set<RevocationListener>();
  on(l: RevocationListener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }
  /** sessionId null means every session of that user. */
  emit(userId: string, sessionId: string | null, reason: RevocationReason): void {
    for (const l of this.listeners) {
      try {
        l(userId, sessionId, reason);
      } catch {
        /* one broken listener must not stop the others */
      }
    }
  }
}

import type { ClientMsg, ServerMsg } from './protocol';

export interface NetHandlers {
  onMessage(msg: ServerMsg): void;
  onStatus(status: 'connecting' | 'online' | 'reconnecting' | 'closed', detail?: string): void;
}

const RETRY_MS = 1000;
const MAX_RETRIES = 12; // about the server's 15 second grace period

/**
 * A WebSocket that signs in first and reconnects on its own after a drop. It knows nothing about
 * the game. Reconnecting within the server's grace period keeps the player's seat.
 */
export class NetClient {
  private ws: WebSocket | null = null;
  private retries = 0;
  private stopped = false;

  constructor(
    private url: string,
    private token: string,
    private handlers: NetHandlers,
  ) {}

  connect() {
    this.stopped = false;
    this.handlers.onStatus(this.retries ? 'reconnecting' : 'connecting');
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.onopen = () => {
      this.retries = 0;
      ws.send(JSON.stringify({ t: 'hello', token: this.token } satisfies ClientMsg));
    };
    ws.onmessage = (ev) => {
      let msg: ServerMsg;
      try {
        msg = JSON.parse(String(ev.data)) as ServerMsg;
      } catch {
        return;
      }
      if (msg.t === 'welcome') this.handlers.onStatus('online');
      this.handlers.onMessage(msg);
    };
    ws.onclose = (ev) => {
      if (this.ws === ws) this.ws = null;
      // 4001: bad sign-in, 4002: signed in from somewhere else, 4003: signed out or the login expired. None should retry.
      // 4004 (the account changed) does: reconnecting picks up the new state.
      if (this.stopped || ev.code === 4001 || ev.code === 4002 || ev.code === 4003) {
        this.handlers.onStatus('closed', ev.code === 4002 ? 'signed in elsewhere' : ev.code === 4001 ? 'sign-in refused' : ev.code === 4003 ? 'signed out' : undefined);
        return;
      }
      if (this.retries >= MAX_RETRIES) {
        this.handlers.onStatus('closed', 'connection lost');
        return;
      }
      this.retries += 1;
      this.handlers.onStatus('reconnecting');
      setTimeout(() => !this.stopped && this.connect(), RETRY_MS);
    };
  }

  send(msg: ClientMsg): boolean {
    if (this.ws?.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify(msg));
    return true;
  }

  close() {
    this.stopped = true;
    this.ws?.close();
    this.ws = null;
  }
}

import type { IncomingMessage } from 'node:http';

/**
 * The caller's address. Behind a trusted proxy (TRUST_PROXY=1 on Fly) it is Fly-Client-IP, which Fly's edge sets and
 * a client cannot. If that is missing (another host), the right-most X-Forwarded-For entry is used: the proxy appends
 * the address it saw, and anything to its left is whatever the client chose to send. Without a trusted proxy, the
 * socket's own address.
 */
export function clientAddress(req: IncomingMessage, trustProxy?: boolean): string {
  if (trustProxy) {
    const fly = req.headers['fly-client-ip'];
    if (typeof fly === 'string' && fly.trim()) return fly.trim();
    const fwd = req.headers['x-forwarded-for'];
    const last = typeof fwd === 'string' ? fwd.split(',').pop()?.trim() : '';
    if (last) return last;
  }
  return req.socket.remoteAddress ?? 'unknown';
}

/**
 * The key a per-address limit counts against. An IPv4 address is its own key. An IPv6 address counts by its /64, the
 * block one home or phone is given: otherwise one connection could rotate through billions of addresses and never meet
 * a limit.
 */
export function limitKey(ip: string): string {
  const bare = ip.replace(/%.*$/, '').replace(/^::ffff:(?=\d+\.\d+\.\d+\.\d+$)/i, '');
  if (!bare.includes(':')) return bare;
  const [head, tail] = bare.split('::');
  const h = head ? head.split(':') : [];
  const t = tail === undefined ? null : tail ? tail.split(':') : [];
  const groups = t === null ? h : [...h, ...Array<string>(Math.max(0, 8 - h.length - t.length)).fill('0'), ...t];
  return `${groups.slice(0, 4).map((g) => (parseInt(g, 16) || 0).toString(16)).join(':')}::/64`;
}

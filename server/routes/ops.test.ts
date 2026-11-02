import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { createHttpServer } from '../http';
import type { Snapshot } from '../ops/alerts';
import { createOpsRoutes } from './ops';

let server: Server | undefined;
afterEach(() => new Promise<void>((r) => (server ? server.close(() => r()) : r())));

describe('GET /api/ops/status', () => {
  it('is for moderators only and returns numbers, no player data', async () => {
    const snap: Snapshot = { at: 1, connections: 3, maxConnections: 2000, rooms: 1, players: 3, memoryMb: 150, databaseOk: true, oldestModerationItemMs: 5000, oldestChildSafetyItemMs: null, moderationWriteFailures: 0, reviewer: null };
    server = createHttpServer({
      routes: createOpsRoutes({ snapshot: async () => snap }),
      verifyToken: async (t) => (t === 'mod' ? { userId: 'm', name: 'M', chatAllowed: true, isModerator: true } : t === 'user' ? { userId: 'u', name: 'U', chatAllowed: true, isModerator: false } : null),
    });
    await new Promise<void>((r) => server!.listen(0, r));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const get = (tok?: string) => fetch(`${base}/api/ops/status`, { headers: tok ? { authorization: `Bearer ${tok}` } : {} });
    expect((await get()).status).toBe(401);
    expect((await get('user')).status).toBe(403);
    const ok = await get('mod');
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual(snap);
  });
});

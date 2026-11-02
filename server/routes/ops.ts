import type { Route } from '../contracts';
import type { Snapshot } from '../ops/alerts';

export const routes: Route[] = [];

/** GET /api/ops/status: the same numbers the alerts watch, for a moderator to look at. No player data. */
export function createOpsRoutes(deps: { snapshot: () => Promise<Snapshot> }): Route[] {
  return [
    {
      method: 'GET', path: '/api/ops/status', auth: 'moderator',
      handler: async () => ({ status: 200, json: await deps.snapshot() }),
    },
  ];
}

import { createServer } from 'node:http';
import type { IncomingMessage, Server } from 'node:http';
import type { Route, RouteRequest, VerifyToken } from './contracts';

export interface HttpOptions {
  routes: readonly Route[];
  verifyToken: VerifyToken;
  /** Origins allowed to call the API from a browser. Empty means no cross-origin calls. */
  allowedOrigins?: readonly string[];
  maxBodyBytes?: number;
}

const DEFAULT_MAX_BODY = 64 * 1024;

const compile = (path: string) => {
  const names: string[] = [];
  const source = path.replace(/[.*+?^${}()|[\]\\]/g, (c) => (c === ':' ? c : `\\${c}`)).replace(/:([A-Za-z_]+)/g, (_, n: string) => {
    names.push(n);
    return '([^/]+)';
  });
  return { re: new RegExp(`^${source}/?$`), names };
};

async function readBody(req: IncomingMessage, limit: number): Promise<unknown | 'too_large' | 'bad_json'> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > limit) return 'too_large';
    chunks.push(chunk as Buffer);
  }
  if (size === 0) return null;
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return 'bad_json';
  }
}

/**
 * The HTTP API. It also carries the WebSocket upgrade, so the whole server runs on one port.
 * Each lane adds its endpoints in its own file under server/routes/ and never edits this file.
 */
export function createHttpServer(opts: HttpOptions): Server {
  const compiled = [
    // Health check for the host (Fly, Railway, uptime monitors). Reveals nothing.
    { route: { method: 'GET', path: '/healthz', auth: 'none', handler: () => ({ status: 200, json: { ok: true } }) } as Route, ...compile('/healthz') },
    ...opts.routes.map((route) => ({ route, ...compile(route.path) })),
  ];
  const allowed = new Set(opts.allowedOrigins ?? []);

  return createServer(async (req, res) => {
    const send = (status: number, json?: unknown) => {
      res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
      res.end(json === undefined ? '' : JSON.stringify(json));
    };
    const origin = req.headers.origin;
    if (origin) {
      if (!allowed.has(origin)) return send(403, { error: 'origin_not_allowed' });
      res.setHeader('access-control-allow-origin', origin);
      res.setHeader('vary', 'origin');
      res.setHeader('access-control-allow-headers', 'authorization, content-type');
      res.setHeader('access-control-allow-methods', 'GET, POST, PUT, DELETE, OPTIONS');
    }
    if (req.method === 'OPTIONS') return send(204);

    const url = new URL(req.url ?? '/', 'http://localhost');
    let pathMatched = false;
    for (const { route, re, names } of compiled) {
      const m = re.exec(url.pathname);
      if (!m) continue;
      pathMatched = true;
      if (route.method !== req.method) continue;

      const params: Record<string, string> = {};
      try {
        names.forEach((n, i) => (params[n] = decodeURIComponent(m[i + 1])));
      } catch {
        return send(400, { error: 'bad_path' });
      }

      let user = null;
      if (route.auth !== 'none') {
        const header = req.headers.authorization ?? '';
        const token = header.startsWith('Bearer ') ? header.slice(7) : '';
        user = token ? await opts.verifyToken(token).catch(() => null) : null;
        if (!user) return send(401, { error: 'not_signed_in' });
        if (route.auth === 'moderator' && !user.isModerator) return send(403, { error: 'not_a_moderator' });
      }

      const body = req.method === 'GET' || req.method === 'DELETE' ? null : await readBody(req, opts.maxBodyBytes ?? DEFAULT_MAX_BODY);
      if (body === 'too_large') return send(413, { error: 'body_too_large' });
      if (body === 'bad_json') return send(400, { error: 'bad_json' });

      const request: RouteRequest = { params, query: Object.fromEntries(url.searchParams), body, user };
      try {
        const out = await route.handler(request);
        return send(out.status, out.json);
      } catch {
        return send(500, { error: 'server_error' }); // never leak internals
      }
    }
    return send(pathMatched ? 405 : 404, { error: pathMatched ? 'method_not_allowed' : 'not_found' });
  });
}

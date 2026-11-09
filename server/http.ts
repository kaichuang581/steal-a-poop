import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { clientAddress } from './address';
import type { Route, RouteRequest, SessionClaims, VerifyToken } from './contracts';

export interface HttpOptions {
  routes: readonly Route[];
  verifyToken: VerifyToken;
  /** Verifies a login without needing a profile. Required for routes with auth "session". */
  verifySession?: (token: string) => Promise<SessionClaims | null>;
  /** Take the caller's address from Fly-Client-IP / X-Forwarded-For. Only behind a proxy you control. */
  trustProxy?: boolean;
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

async function readBody(req: IncomingMessage, limit: number): Promise<unknown | 'too_large' | 'bad_json' | 'aborted'> {
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    for await (const chunk of req) {
      size += (chunk as Buffer).length;
      if (size > limit) return 'too_large';
      chunks.push(chunk as Buffer);
    }
  } catch {
    return 'aborted'; // the client hung up part-way (or lost signal): nobody is left to answer
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

  const handle = async (req: IncomingMessage, res: ServerResponse) => {
    const send = (status: number, json?: unknown) => {
      if (res.headersSent || res.destroyed) return;
      res.writeHead(status, {
        'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff',
        'x-frame-options': 'DENY', 'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
        'referrer-policy': 'no-referrer', 'strict-transport-security': 'max-age=31536000',
      });
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

    let url: URL;
    try {
      url = new URL(req.url ?? '/', 'http://localhost');
    } catch {
      return send(400, { error: 'bad_path' }); // e.g. "GET //" or "GET //a:b@": not a path at all
    }
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
      let session: SessionClaims | null = null;
      if (route.auth !== 'none') {
        const header = req.headers.authorization ?? '';
        const token = header.startsWith('Bearer ') ? header.slice(7) : '';
        if (route.auth === 'session') {
          session = token && opts.verifySession ? await opts.verifySession(token).catch(() => null) : null;
          if (!session) return send(401, { error: 'not_signed_in' });
        } else {
          user = token ? await opts.verifyToken(token).catch(() => null) : null;
          if (!user) return send(401, { error: 'not_signed_in' });
          if (route.auth === 'moderator' && !user.isModerator) return send(403, { error: 'not_a_moderator' });
        }
      }

      const body = req.method === 'GET' || req.method === 'DELETE' ? null : await readBody(req, opts.maxBodyBytes ?? DEFAULT_MAX_BODY);
      if (body === 'aborted') return void res.destroy();
      if (body === 'too_large') return send(413, { error: 'body_too_large' });
      if (body === 'bad_json') return send(400, { error: 'bad_json' });

      const request: RouteRequest = { params, query: Object.fromEntries(url.searchParams), body, user, session, ip: clientAddress(req, opts.trustProxy) };
      try {
        const out = await route.handler(request);
        return send(out.status, out.json);
      } catch {
        return send(500, { error: 'server_error' }); // never leak internals
      }
    }
    return send(pathMatched ? 405 : 404, { error: pathMatched ? 'method_not_allowed' : 'not_found' });
  };

  // Nothing a request does may take the process down: every room and game lives in it. Whatever escapes the handler
  // becomes a 500 (or a dropped connection if the answer had already started).
  const server = createServer((req, res) => {
    handle(req, res).catch(() => {
      if (!res.headersSent && !res.destroyed) {
        res.writeHead(500, { 'content-type': 'application/json', 'cache-control': 'no-store' });
        res.end(JSON.stringify({ error: 'server_error' }));
      } else res.destroy();
    });
  });
  // Slow clients cannot hold a request open for minutes (Node's defaults are 60 s for headers and 5 min per request).
  server.headersTimeout = 15_000;
  server.requestTimeout = 30_000;
  return server;
}

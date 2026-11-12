// Multiplayer in development, one command.
//   npm run dev:online   the game server on this computer (dev sign-in) plus the site pointed at it
//   npm run dev:fly      the site only, pointed at the deployed server: FLY_SERVER_URL, or wss://<app in fly.toml>.fly.dev
// The live site switches the same way: set the repository variable VITE_SERVER_URL (see docs/DEPLOY.md).
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';

const fly = process.argv.includes('--fly');
const port = process.env.PORT ?? '8787';
let serverUrl = `ws://localhost:${port}`;
if (fly) {
  const app = /^app\s*=\s*"([^"]+)"/m.exec(readFileSync(new URL('../fly.toml', import.meta.url), 'utf8'))?.[1];
  serverUrl = process.env.FLY_SERVER_URL ?? `wss://${app}.fly.dev`;
}
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const children = [];
const run = (args, env) => {
  const child = spawn(npm, args, { stdio: 'inherit', env: { ...process.env, ...env } });
  children.push(child);
  child.on('exit', (code) => { for (const c of children) if (c !== child) c.kill(); process.exit(code ?? 0); });
};
if (!fly) run(['run', 'server'], { ALLOW_DEV_AUTH: '1', PORT: port });
run(['run', 'dev'], { VITE_SERVER_URL: serverUrl });
console.log(`\n  multiplayer: the site talks to ${serverUrl}\n`);
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { for (const c of children) c.kill(); process.exit(0); });

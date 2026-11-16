// Runs one shell command to its end and hands back what it printed. The gate's runner and every module go through
// here (as ctx.sh), so a command that fails is a result to report, never an exception that stops the report.
//
//   const { code, stdout, stderr } = await sh('npx tsc --noEmit', { cwd: root });
//
// Options: cwd, env (added to this process's own), timeoutMs (the command and everything it started are stopped, and
// code is 124), input (text for its stdin), onData(text, 'stdout' | 'stderr') to follow it while it runs.
// `timedOut` and `truncated` are set on the result when they happened.
import { spawn } from 'node:child_process';

/** Past this much output only the end is kept: a build that prints for ever must not fill the memory. */
const KEEP_BYTES = 32 * 1024 * 1024;

/** Commands still running, so that stopping the gate (Ctrl-C) stops them too. */
const running = new Set();

function stop(child, signal) {
  // The command runs in its own process group (detached), so the shell and whatever it started go together.
  try { process.kill(-child.pid, signal); } catch { try { child.kill(signal); } catch { /* already gone */ } }
}

let hooked = false;
function hookExit() {
  if (hooked) return;
  hooked = true;
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      for (const child of running) stop(child, 'SIGTERM');
      process.exit(signal === 'SIGINT' ? 130 : 143);
    });
  }
}

export function sh(cmd, { cwd, env, timeoutMs = 0, input, onData } = {}) {
  hookExit();
  return new Promise((done) => {
    const out = { stdout: '', stderr: '' };
    let truncated = false, timedOut = false, timer = null, killer = null;
    let child;
    try {
      child = spawn(cmd, { cwd, env: { ...process.env, ...env }, shell: true, detached: process.platform !== 'win32', stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'] });
    } catch (e) {
      return done({ code: 127, stdout: '', stderr: String(e?.message ?? e) });
    }
    running.add(child);
    const take = (name) => (data) => {
      const text = data.toString();
      onData?.(text, name);
      out[name] += text;
      if (out[name].length > KEEP_BYTES) { out[name] = out[name].slice(-KEEP_BYTES / 2); truncated = true; }
    };
    child.stdout.on('data', take('stdout'));
    child.stderr.on('data', take('stderr'));
    if (input !== undefined) child.stdin.end(input);
    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        timedOut = true;
        stop(child, 'SIGTERM');
        killer = setTimeout(() => stop(child, 'SIGKILL'), 5000);
      }, timeoutMs);
    }
    const finish = (code, extra = '') => {
      clearTimeout(timer);
      clearTimeout(killer);
      running.delete(child);
      const result = { code: timedOut ? 124 : code, stdout: out.stdout, stderr: out.stderr + extra };
      if (timedOut) { result.timedOut = true; result.stderr += `\n(stopped after ${Math.round(timeoutMs / 1000)} s: ${cmd})`; }
      if (truncated) result.truncated = true;
      done(result);
    };
    child.on('error', (e) => finish(127, String(e?.message ?? e)));
    // A command ended by a signal has no exit code: that is a failure, never a zero.
    child.on('close', (code, signal) => finish(code ?? (signal ? 1 : 0)));
  });
}

/** Quotes one argument for the shell, for the few commands that carry a path or a name. */
export function quote(arg) {
  const text = String(arg);
  return /^[A-Za-z0-9_@%+=:,./-]+$/.test(text) ? text : `'${text.replace(/'/g, `'\\''`)}'`;
}

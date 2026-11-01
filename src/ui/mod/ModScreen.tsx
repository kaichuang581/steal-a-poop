import { useCallback, useEffect, useState } from 'react';
import { getServerUrl } from '../../net/config';

interface Summary {
  id: number; at: number; userId: string; category: string; status: string; mustReport: boolean;
  term?: string; opinion?: string; preview: string;
}
interface Detail {
  item: {
    id: number; at: number; userId: string; roomCode: string; text: string; category: string; term?: string;
    mustReport: boolean; status: string; verdict?: string; reason?: string; decidedBy?: string;
    context?: { id: number; name: string; text: string }[]; opinion?: { verdict: string; reason: string };
  };
  standing: { banned: boolean; suspendedUntil: number | null; items: { id: number; category: string; status: string; verdict?: string }[] };
}

const httpBase = () => (getServerUrl() ?? '').replace(/^ws/, 'http');
const KEY = 'sap:modToken';

/** Moderator screen at #/mod. The server checks the token; this page only shows what it is given. */
export default function ModScreen() {
  const [token, setToken] = useState(() => {
    try { return sessionStorage.getItem(KEY) ?? ''; } catch { return ''; }
  });
  const [draft, setDraft] = useState('');
  const [items, setItems] = useState<Summary[] | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<Detail | null>(null);
  const [reason, setReason] = useState('');

  const call = useCallback(async (method: string, path: string, body?: unknown) => {
    const res = await fetch(httpBase() + path, {
      method,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((json as { error?: string }).error ?? `error ${res.status}`);
    return json;
  }, [token]);

  const refresh = useCallback(async () => {
    try {
      setError('');
      setItems(((await call('GET', '/api/mod/queue')) as { items: Summary[] }).items);
    } catch (e) {
      setItems(null);
      setError(e instanceof Error ? e.message : 'failed');
    }
  }, [call]);

  useEffect(() => { if (token) void refresh(); }, [token, refresh]);

  const show = async (id: number) => {
    setReason('');
    setOpen((await call('GET', `/api/mod/items/${id}`)) as Detail);
  };
  const decide = async (verdict: 'clear' | 'suspend' | 'ban') => {
    if (!open) return;
    try {
      await call('POST', `/api/mod/items/${open.item.id}/resolve`, { verdict, reason });
      setOpen(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
    }
  };

  if (!token) {
    return (
      <main className="mx-auto max-w-md p-6 text-white">
        <h1 className="text-2xl font-black">Moderation</h1>
        <label className="mt-4 block text-sm font-bold">
          Moderator token
          <input value={draft} onChange={(e) => setDraft(e.target.value)} className="mt-1 w-full rounded bg-white/10 p-2" />
        </label>
        <button
          className="mt-3 rounded bg-amber-400 px-4 py-2 font-black text-black"
          onClick={() => { try { sessionStorage.setItem(KEY, draft); } catch { /* private mode */ } setToken(draft); }}
        >
          Sign in
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl p-4 text-white">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">Moderation queue</h1>
        <button className="rounded bg-white/10 px-3 py-1" onClick={() => void refresh()}>Refresh</button>
      </div>
      {error && <p role="alert" className="mt-2 rounded bg-red-500/30 p-2">{error}</p>}
      {items && items.length === 0 && <p className="mt-4 text-white/70">Nothing waiting for a person.</p>}
      <ul aria-label="Waiting for a person" className="mt-3 space-y-2">
        {items?.map((i) => (
          <li key={i.id} className="rounded border border-white/20 p-2">
            <button className="w-full text-left" onClick={() => void show(i.id)}>
              <span className="font-bold">#{i.id}</span> · {i.category}{i.mustReport ? ' · CHILD SAFETY' : ''} · {new Date(i.at).toLocaleString()}
              <span className="block text-sm text-white/70">{i.preview}</span>
            </button>
          </li>
        ))}
      </ul>
      {open && (
        <section aria-label="Item" className="mt-4 rounded border-2 border-amber-400 p-3">
          <h2 className="font-black">Item #{open.item.id} · {open.item.category}</h2>
          {open.item.mustReport && <p className="font-bold text-red-300">Child-safety item: do not decide alone; see the reporting process.</p>}
          <p className="mt-2 text-sm text-white/70">Sender {open.item.userId} · room {open.item.roomCode || '-'}</p>
          <blockquote data-testid="held-text" className="mt-2 rounded bg-black/40 p-2">{open.item.text}</blockquote>
          {open.item.context && open.item.context.length > 0 && (
            <details className="mt-2" open>
              <summary className="cursor-pointer font-bold">Before it ({open.item.context.length})</summary>
              <ul className="text-sm">{open.item.context.map((m) => <li key={m.id}><b>{m.name}:</b> {m.text}</li>)}</ul>
            </details>
          )}
          <p className="mt-2 text-sm">
            <b>Claude's opinion:</b> {open.item.opinion ? `${open.item.opinion.verdict}: ${open.item.opinion.reason}` : 'none'}
          </p>
          <p className="mt-1 text-sm">
            <b>Standing:</b> {open.standing.banned ? 'banned' : open.standing.suspendedUntil ? `suspended until ${new Date(open.standing.suspendedUntil).toLocaleString()}` : 'in good standing'}
            {' · '}{open.standing.items.length} item(s) on file
          </p>
          <label className="mt-3 block text-sm font-bold">
            Reason (required, kept in the record)
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} className="mt-1 w-full rounded bg-white/10 p-2" />
          </label>
          <div className="mt-2 flex gap-2">
            {(['clear', 'suspend', 'ban'] as const).map((v) => (
              <button key={v} disabled={!reason.trim()} onClick={() => void decide(v)} className="rounded bg-amber-400 px-3 py-2 font-black capitalize text-black disabled:opacity-40">
                {v}
              </button>
            ))}
            <button className="ml-auto rounded bg-white/10 px-3 py-2" onClick={() => setOpen(null)}>Close</button>
          </div>
        </section>
      )}
    </main>
  );
}

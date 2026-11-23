import { useEffect, useState } from 'react';
import { useGuestSocial } from '../../state/guestSocial';
import type { FriendsStore } from '../../state/guestSocial';
import { useSocial } from '../../state/socialStore';
import { Pix } from '../kit/surfaces';
import { PEN_ART, SheepHead } from '../rooms/penArt';
import { CopyArt, ShieldArt } from './art';
import { SectionHead } from './parts';

/**
 * Friends, on the profile (requested by Kai, 2026-11-14: the friend code lives on the profile, not on a tab or a button of
 * its own). Your friend code at the top, a box to add someone else's, the requests waiting for an answer, and your friends
 * with who is online. A signed-in player's list is kept on the server; a guest's is kept in this browser, and requests
 * travel through the server's mailbox (server/social/guestFriends.ts). The two stores answer alike, so one screen draws both.
 */
export function FriendsSection({ account, guestName }: { account: boolean; guestName: string }) {
  // Switching between a guest and an account (signing in beside the profile) starts the list afresh.
  return account ? <Friends key="account" useStore={useSocial} /> : <Friends key="guest" useStore={useGuestSocial} guestName={guestName} />;
}

/** A friend code shown in two equal groups ("T7XJ2 XWG22"); the space is only for the eye: copying gives the code. */
export const codeGroups = (code: string) => (code.length >= 8 && code.length % 2 === 0 ? `${code.slice(0, code.length / 2)} ${code.slice(code.length / 2)}` : code);

function Friends({ useStore, guestName }: { useStore: () => FriendsStore; guestName?: string }) {
  const { friends, code, error, notice, loadFriends, loadCode, resetCode, request, accept, remove } = useStore();
  const guest = guestName !== undefined;
  const [typed, setTyped] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (guest) useGuestSocial.getState().setName(guestName);
    void loadFriends();
    void loadCode();
    const t = setInterval(() => void loadFriends(), 15_000); // who is online, and who has asked
    return () => clearInterval(t);
  }, [guest, guestName, loadFriends, loadCode]);

  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      window.prompt('Copy your friend code:', code);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  // Their code is as long as yours (a guest's and an account's codes differ); Add waits for that many characters.
  const want = code?.length ?? 8;
  const clean = typed.replace(/\s+/g, '');
  const ready = clean.length === want;
  const list = friends?.friends ?? [];
  const asking = friends?.incoming ?? [];

  return (
    <section aria-labelledby="prof-friends" className="pf-sec pf-sec--friends">
      <SectionHead id="prof-friends" icon={<SheepHead px={3} />} title="Friends">
        {friends && <span className="pf-quiet">{`${list.length} friend${list.length === 1 ? '' : 's'}`}</span>}
      </SectionHead>
      <div className="pf-card pf-fr">
        <div className="pf-fr-part">
          <span className="pf-label">Your friend code</span>
          <span className="pf-fr-coderow">
            <b className="pf-fr-code" data-friend-code={code ?? undefined} aria-label={code ? code.split('').join(' ') : 'Loading'}>{code ? codeGroups(code) : 'Loading…'}</b>
            {resetCode && <button type="button" className="pf-slab pf-slab--28 hm-slab hm-knit" onClick={() => void resetCode()}>New code</button>}
            <button type="button" className="pf-slab pf-slab--28 hm-slab hm-knit" onClick={() => void copy()} disabled={!code}>
              {copied ? <><Pix rows={PEN_ART.check} colors={{ X: 'currentColor' }} />Copied</> : <><CopyArt />Copy</>}
            </button>
          </span>
          <span className="pf-fr-safe"><ShieldArt /><span>Give it only to people you know. Anyone with it can ask to be your friend.</span></span>
        </div>
        <i className="pf-groove" aria-hidden="true" />
        <form className="pf-fr-part" onSubmit={(e) => { e.preventDefault(); if (ready) void request(clean).then(() => setTyped('')); }}>
          <label htmlFor="friend-code-input" className="pf-label">Add a friend</label>
          <span className="pf-name-row">
            <input
              id="friend-code-input" className="pf-input pf-input--code" value={typed} maxLength={20} autoComplete="off" spellCheck={false}
              placeholder="Type their code" aria-label="Friend's code" onChange={(e) => setTyped(e.target.value.toUpperCase())}
            />
            <button type="submit" className={`pf-slab pf-slab--40 hm-slab hm-knit ${ready ? 'hm-slab--lantern' : ''}`} disabled={!ready}>Add</button>
          </span>
          {error && <span role="alert" className="pf-msg" data-bad>{error}</span>}
          {notice && !error && <span role="status" className="pf-msg">{notice}</span>}
        </form>
        <i className="pf-groove" aria-hidden="true" />
        <div className="pf-fr-part pf-fr-lists" data-scroll={asking.length + list.length > 3 || undefined}>
          {asking.length > 0 && (
            <ul className="pf-fr-list" aria-label="Asking to be your friend">
              {asking.map((f) => (
                <li key={f.userId} className="pf-fr-row">
                  <SheepHead px={3} />
                  <b className="pf-fr-name">{f.name}</b>
                  <span className="pf-fr-ask">wants to be friends</span>
                  <button type="button" className="pf-slab pf-slab--28 hm-slab hm-slab--lantern hm-knit" aria-label={`Accept ${f.name}`} onClick={() => void accept(f.userId)}>Accept</button>
                  <button type="button" className="pf-slab pf-slab--28 hm-slab hm-knit" aria-label={`Decline ${f.name}`} onClick={() => void remove(f.userId)}>Decline</button>
                </li>
              ))}
            </ul>
          )}
          {friends && list.length === 0 && asking.length === 0 && (
            <span className="pf-fr-none"><span className="pf-dim"><SheepHead px={3} /></span>No friends yet. Swap codes with someone you know.</span>
          )}
          {list.length > 0 && (
            <ul className="pf-fr-list" aria-label="Your friends">
              {list.map((f) => (
                <li key={f.userId} className="pf-fr-row">
                  <SheepHead px={3} />
                  <b className="pf-fr-name">{f.name}</b>
                  <span className="pf-fr-on" data-on={f.online || undefined}>{f.online ? 'online' : 'away'}</span>
                  <button type="button" className="pf-slab pf-slab--28 hm-slab hm-knit" aria-label={`Remove ${f.name}`} onClick={() => void remove(f.userId)}>Remove</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

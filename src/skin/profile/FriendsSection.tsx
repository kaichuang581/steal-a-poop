import { useEffect, useState } from 'react';
import { useGuestSocial } from '../../state/guestSocial';
import type { FriendsStore } from '../../state/guestSocial';
import { useSocial } from '../../state/socialStore';
import { Board as Sign, Paper, Patch, Tag } from '../kit';
import './friends.css';

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
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <section aria-labelledby="prof-friends" className="sk-fr">
      <div className="sk-prof-head">
        <Sign size="label" tone="wood" className="sk-room-heading"><h3 id="prof-friends">Friends</h3></Sign>
        <p className="sk-room-hint">{guest ? 'Kept in this browser. Clearing its data starts the list again.' : 'Swap codes with people you know. You choose who to accept.'}</p>
      </div>

      <div className="sk-fr-top">
        <Paper kind="note" className="sk-fr-code">
          <span className="sk-prof-stat-label">Your friend code</span>
          <span className="sk-fr-code-value" data-friend-code>{code ?? '...'}</span>
          <span className="sk-prof-stat-note">Give it only to people you know. Anyone with it can ask to be your friend.</span>
          <span className="sk-fr-acts">
            <Patch as="button" onClick={() => void copy()} disabled={!code}>{copied ? 'Copied!' : 'Copy code'}</Patch>
            {resetCode && <Patch as="button" onClick={() => void resetCode()}>New code</Patch>}
          </span>
        </Paper>

        <Paper kind="note" className="sk-fr-add">
          <form onSubmit={(e) => { e.preventDefault(); if (typed.trim()) void request(typed).then(() => setTyped('')); }}>
            <label htmlFor="friend-code-input" className="sk-prof-stat-label">Add a friend</label>
            <span className="sk-fr-add-row">
              <input
                id="friend-code-input" className="sk-prof-name-input sk-fr-input" value={typed} maxLength={20} autoComplete="off"
                placeholder="Their code" aria-label="Friend's code" onChange={(e) => setTyped(e.target.value)}
              />
              <Patch as="button" tone="green" disabled={!typed.trim()}>Add</Patch>
            </span>
          </form>
          {error && <p role="alert" className="sk-fr-note" data-bad>{error}</p>}
          {notice && !error && <p role="status" className="sk-fr-note">{notice}</p>}
        </Paper>
      </div>

      {!!friends?.incoming.length && (
        <div className="sk-fr-group">
          <h4 className="sk-prof-stat-label">Asking to be your friend</h4>
          <ul className="sk-fr-list">
            {friends.incoming.map((f) => (
              <li key={f.userId} className="sk-fr-row">
                <span className="sk-fr-name">{f.name}</span>
                <Patch as="button" tone="green" small aria-label={`Accept ${f.name}`} onClick={() => void accept(f.userId)}>Accept</Patch>
                <Patch as="button" small aria-label={`Decline ${f.name}`} onClick={() => void remove(f.userId)}>Decline</Patch>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="sk-fr-group">
        <h4 className="sk-prof-stat-label">Your friends{friends ? ` (${friends.friends.length})` : ''}</h4>
        {friends && friends.friends.length === 0 && <p className="sk-prof-stat-note">No friends yet. Swap codes with someone you know.</p>}
        <ul className="sk-fr-list">
          {friends?.friends.map((f) => (
            <li key={f.userId} className="sk-fr-row">
              <span className="sk-fr-name">{f.name}</span>
              <Tag tone={f.online ? 'green' : 'gray'}>{f.online ? 'online' : 'away'}</Tag>
              <Patch as="button" small aria-label={`Remove ${f.name}`} onClick={() => void remove(f.userId)}>Remove</Patch>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

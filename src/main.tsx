import { StrictMode, Suspense, lazy, useEffect, useLayoutEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { installAudioUnlock } from './audio/sound';
import { useAuth } from './auth/authStore';
import { authEnabled } from './auth/config';
import { useRoomStore } from './state/roomStore';
import { useSocial } from './state/socialStore';
import App from './ui/App';
import { LegalPopupHost } from './skin/components/LegalPopupHost';
import { dropBootDoorsUnlessShut } from './skin/components/BarnDoors';
import { PAINTED_GAME_TITLE } from './config';

installAudioUnlock();
useAuth.getState().init(); // restores a saved login, if real sign-in is on
// A signed-in player stays connected to the game server, so going into a room is quick and what a game paid arrives.
if (authEnabled()) {
  useAuth.subscribe((state, prev) => {
    if (state.status === 'ready' && prev.status !== 'ready') {
      useRoomStore.getState().connect();
      void useSocial.getState().refreshBalance();
    }
    if (state.status === 'signedOut' && prev.status !== 'signedOut') {
      useRoomStore.getState().disconnect();
      useSocial.getState().clear();
    }
  });
}

// Two small screens live outside App and load only when asked for, so players never download them.
// (App.tsx is owned by the accounts lane; this seam avoids touching it.)
const ModScreen = lazy(() => import('./ui/mod/ModScreen'));
const LegalScreen = lazy(() => import('./ui/legal/LegalScreen'));
const ConsentPage = lazy(() => import('./ui/auth/ConsentPage'));

function Root() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const on = () => setHash(location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  // The page comes with the barn doors already drawn shut (index.html), so something shows while this code is on its
  // way. The painted game keeps them until Home is ready; every other page that opens here (the old look, a preview, the
  // rules, the moderators' screen) is ready now and takes them away.
  useLayoutEffect(() => { dropBootDoorsUnlessShut(); }, []);
  if (hash.startsWith('#/mod')) return <Suspense fallback={null}><ModScreen /></Suspense>;
  if (hash.startsWith('#/legal/')) return <Suspense fallback={null}><LegalScreen slug={hash.slice('#/legal/'.length).split(/[/?]/)[0]} /></Suspense>;
  if (hash.startsWith('#/consent/')) {
    const rest = hash.slice('#/consent/'.length).split(/[?]/)[0];
    const manage = rest.startsWith('manage/');
    return <Suspense fallback={null}><ConsentPage key={hash} token={manage ? rest.slice('manage/'.length) : rest} manage={manage} /></Suspense>;
  }
  return <><App /><LegalPopupHost /></>;
}

/**
 * Inside another site's frame the game does not start, so nobody can lay a page over it and trick a signed-in player
 * into clicks (buying, befriending, joining rooms). GitHub Pages cannot send the frame-ancestors header that would do
 * this in the browser, so the page checks for itself. A frame from the game's own origin (its tests) is fine.
 */
function framedByAnotherSite(): boolean {
  if (window.top === window.self) return false;
  try {
    return window.top!.location.origin !== window.location.origin;
  } catch {
    return true; // reading a cross-origin parent throws
  }
}

if (framedByAnotherSite()) dropBootDoorsUnlessShut();
createRoot(document.getElementById('root')!).render(
  framedByAnotherSite() ? (
    <p style={{ padding: 24, font: '16px system-ui, sans-serif' }}>
      <a href={window.location.href} target="_top" rel="noopener">Open {PAINTED_GAME_TITLE} in its own tab</a>
    </p>
  ) : (
    <StrictMode>
      <Root />
    </StrictMode>
  ),
);

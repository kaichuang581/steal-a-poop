import { StrictMode, Suspense, lazy, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { installAudioUnlock } from './audio/sound';
import { useAuth } from './auth/authStore';
import { authEnabled } from './auth/config';
import { useRoomStore } from './state/roomStore';
import { useSocial } from './state/socialStore';
import { InviteToast } from './ui/social/InviteToast';
import App from './ui/App';
import { LegalPopupHost } from './skin/components/LegalPopupHost';

installAudioUnlock();
useAuth.getState().init(); // restores a saved login, if real sign-in is on
// A signed-in player stays connected to the game server, so friends see them online and invites reach them.
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
  if (hash.startsWith('#/mod')) return <Suspense fallback={null}><ModScreen /></Suspense>;
  if (hash.startsWith('#/legal/')) return <Suspense fallback={null}><LegalScreen slug={hash.slice('#/legal/'.length).split(/[/?]/)[0]} /></Suspense>;
  if (hash.startsWith('#/consent/')) {
    const rest = hash.slice('#/consent/'.length).split(/[?]/)[0];
    const manage = rest.startsWith('manage/');
    return <Suspense fallback={null}><ConsentPage key={hash} token={manage ? rest.slice('manage/'.length) : rest} manage={manage} /></Suspense>;
  }
  return <><App /><InviteToast /><LegalPopupHost /></>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);

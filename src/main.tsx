import { StrictMode, Suspense, lazy, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { installAudioUnlock } from './audio/sound';
import App from './ui/App';

installAudioUnlock();

// Two small screens live outside App and load only when asked for, so players never download them.
// (App.tsx is owned by the accounts lane; this seam avoids touching it.)
const ModScreen = lazy(() => import('./ui/mod/ModScreen'));
const LegalScreen = lazy(() => import('./ui/legal/LegalScreen'));

function Root() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const on = () => setHash(location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  if (hash.startsWith('#/mod')) return <Suspense fallback={null}><ModScreen /></Suspense>;
  if (hash.startsWith('#/legal/')) return <Suspense fallback={null}><LegalScreen slug={hash.slice('#/legal/'.length).split(/[/?]/)[0]} /></Suspense>;
  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);

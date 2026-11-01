import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { installAudioUnlock } from './audio/sound';
import App from './ui/App';

installAudioUnlock();

// The moderator screen lives at #/mod and is loaded only when asked for, so players never download it.
// (App.tsx is owned by the accounts lane; this seam avoids touching it.)
const ModScreen = lazy(() => import('./ui/mod/ModScreen'));
const isMod = location.hash.startsWith('#/mod');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isMod ? (
      <Suspense fallback={null}>
        <ModScreen />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
);

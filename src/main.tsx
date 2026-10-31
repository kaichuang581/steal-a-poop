import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { installAudioUnlock } from './audio/sound';
import App from './ui/App';

installAudioUnlock();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

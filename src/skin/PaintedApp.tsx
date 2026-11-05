import { useAvatar } from './avatars/store';
import { useEffect } from 'react';
import { useRoomStore } from '../state/roomStore';
import { useStore } from '../state/store';
import { Lobby } from '../ui/Lobby';
import { RoomScreen } from '../ui/RoomScreen';
import { useHour } from './hooks/useAmbient';
import { HuntScreen } from './hunt/HuntScreen';
import { useHuntUi } from './hunt/huntStore';
import { DreamScreen } from './dream/DreamScreen';
import { useDreamUi } from './dream/dreamStore';
import { PaintedGame } from './screens/PaintedGame';
import { PaintedHome, PAINTED_TITLE } from './screens/PaintedHome';
import { SheepPreview } from './table/SheepPreview';
import './styles/skin.css';

/** The painted skin's fonts; loaded only when the skin is on, so the classic look never contacts Google Fonts. */
const FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,700;9..144,800&family=Nunito:wght@400;600;700;800;900&family=Patrick+Hand&family=DotGothic16&display=swap';

function useSkinFonts() {
  useEffect(() => {
    if (document.querySelector(`link[href="${FONTS_HREF}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = FONTS_HREF;
    document.head.appendChild(link);
  }, []);
}

/** ?preview=sheep opens the model preview (plan V3 Milestone 1). */
const PREVIEW = new URLSearchParams(location.search).get('preview');

/**
 * The painted skin's screen switch, mirroring App's: game, room, lobby, home. The Rooms lobby and waiting room keep
 * the classic screens until the game server is live (plan Milestone 7).
 */
export function PaintedApp() {
  const inGame = useStore((s) => s.game !== null);
  const inRoom = useRoomStore((s) => s.room !== null);
  const lobbyOpen = useRoomStore((s) => s.open);
  const hour = useHour();
  const hunting = useHuntUi((s) => s.open);
  const dreaming = useDreamUi((s) => s.open);
  useSkinFonts();
  // Keep the server told which avatar you picked, so the others in a room see it.
  const avatar = useAvatar();
  useEffect(() => { useRoomStore.getState().sendAvatar(avatar); }, [avatar]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.skin = 'painted';
    document.title = PAINTED_TITLE;
    return () => { delete root.dataset.skin; };
  }, []);
  useEffect(() => { document.documentElement.dataset.hour = hour; }, [hour]);

  if (PREVIEW === 'sheep') return <SheepPreview />;
  if (dreaming) return <DreamScreen />;
  if (hunting) return <HuntScreen />;
  if (inGame) return <PaintedGame />;
  if (inRoom) return <RoomScreen />;
  if (lobbyOpen) return <Lobby />;
  return <PaintedHome />;
}

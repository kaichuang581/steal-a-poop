import { JoinLink } from './share/JoinLink';
import { useAvatar } from './avatars/store';
import { useEffect, useState } from 'react';
import { Garland } from './components/Garland';
import { useRoomStore } from '../state/roomStore';
import { useStore } from '../state/store';
import { Lobby } from '../ui/Lobby';
import { RoomScreen } from '../ui/RoomScreen';
import { useHour } from './hooks/useAmbient';
import { DreamScreen } from './dream/DreamScreen';
import { useDreamUi } from './dream/dreamStore';
import { PaintedGame } from './screens/PaintedGame';
import { PaintedHome, PAINTED_TITLE } from './screens/PaintedHome';
import { LineupPreview, SheepPreview, StripsPreview } from './table/SheepPreview';
import KitPreview from './kit/KitPreview';
import { BarnDoors, doorsShut, playBarnDoors, shutDoorsAtBoot } from './components/BarnDoors';
import { PreviewCanvas as WendigoPreviewCanvas } from './table/WendigoPreview';
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
  const dreaming = useDreamUi((s) => s.open);
  // The first load goes behind the doors from the first frame: Home's farm takes seconds to build, and shutting the
  // doors only once its scene mounted showed Home first and then covered it.
  useState(() => { if (!PREVIEW) shutDoorsAtBoot(); });
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

  // The loading screen (BarnDoors) covers every way into a 3D screen: the doors shut over the screen being left, and the
  // new one mounts only two frames later, once they are on screen, so its build never freezes the old screen half-way
  // or shows a scene still being put together. They open once it has drawn.
  const want = dreaming ? 'dream' : inGame ? 'game' : 'rest';
  const [mounted, setMounted] = useState(want);
  useEffect(() => {
    if (want === mounted) return;
    if (want === 'rest' || PREVIEW) return setMounted(want);
    if (!doorsShut()) playBarnDoors();
    let b = 0;
    const a = requestAnimationFrame(() => { b = requestAnimationFrame(() => setMounted(want)); });
    return () => { cancelAnimationFrame(a); cancelAnimationFrame(b); };
  }, [want, mounted]);

  if (PREVIEW === 'sheep') return <SheepPreview />;
  if (PREVIEW === 'strips') return <StripsPreview />;
  if (PREVIEW === 'lineup') return <LineupPreview />;
  if (PREVIEW === 'kit') return <KitPreview />;
  if (PREVIEW === 'wendigo') return <div style={{ position: 'fixed', inset: 0 }}><WendigoPreviewCanvas /></div>;
  // A ?join=CODE address joins that room once the player is signed in and online.
  // The start screen is always the first thing: nothing to get through before it. The name is picked there, and signing
  // in is one button on it, for whoever wants an account.
  const home = <PaintedHome />;
  const screen = mounted === 'dream' && dreaming ? <DreamScreen />
    : mounted === 'game' && inGame ? <PaintedGame />
    : inRoom ? <div className="sk-rooms h-full"><RoomScreen /></div>
    : lobbyOpen ? <div className="sk-rooms h-full"><Lobby /></div>
    : home;
  return <><JoinLink />{screen}{!dreaming && !inGame && (inRoom || lobbyOpen) && <Garland />}<BarnDoors /></>;
}

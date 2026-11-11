import { JoinLink } from './share/JoinLink';
import { setTickVoice } from '../audio/sound';
import { loadStreak } from '../dream/daily';
import { TICK_VOICE } from './shop/catalog';
import { grantStreak, useWallet } from './shop/store';
import { useAvatar } from './avatars/store';
import { Suspense, lazy, useEffect, useState } from 'react';
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
// Dev only: bakes the loading screen's doors (tools/renderDoors.mjs). Loaded only when asked for.
const DoorsRender = lazy(() => import('./loading/DoorsRender'));
import { BarnDoors, doorsShut, playBarnDoors, shutDoorsAtBoot, whenDoorsOpen, whenDoorsShut } from './components/BarnDoors';
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
/** True the first time the game loads in this tab; a refresh (or coming back to it) is not a first load. */
function firstLoadThisTab(): boolean {
  try {
    const seen = sessionStorage.getItem('sap:booted');
    sessionStorage.setItem('sap:booted', '1');
    return !seen;
  } catch {
    return true;
  }
}

/** What the loading slip says on the way into each screen. */
function loadingLine(to: 'dream' | 'game'): string {
  if (to === 'dream') return 'Tucking the farmer in';
  const mode = useStore.getState().mode;
  return mode === 'practice' ? 'Clearing the ice' : mode === 'tour' ? 'Whistling for the sheepdog' : mode === 'room' ? 'Seating everyone' : 'Setting the table';
}

export function PaintedApp() {
  const inGame = useStore((s) => s.game !== null);
  const inRoom = useRoomStore((s) => s.room !== null);
  const lobbyOpen = useRoomStore((s) => s.open);
  const hour = useHour();
  const dreaming = useDreamUi((s) => s.open);
  // The first load in a tab goes behind the doors from the first frame: Home's farm takes seconds to build, and shutting
  // the doors only once its scene mounted showed Home first and then covered it. A refresh skips them (Brian: "if the
  // game is already loaded ... from just refreshing the page then it shouldnt be spammed"): Home is there at once and
  // its farm fades in when it is built (FarmBackdrop).
  useState(() => { if (!PREVIEW && firstLoadThisTab()) shutDoorsAtBoot({ label: 'Opening up the barn' }); });
  useSkinFonts();
  // Keep the server told which avatar you picked, so the others in a room see it.
  const avatar = useAvatar();
  useEffect(() => { useRoomStore.getState().sendAvatar(avatar); }, [avatar]);
  // The Barn Bazaar: the fuse sound worn, and any streak item the best dream streak has earned (kept for good).
  const tick = useWallet().equipped.tick;
  useEffect(() => { setTickVoice(TICK_VOICE[tick] ?? 'chime'); }, [tick]);
  useEffect(() => { grantStreak(loadStreak().best); }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.skin = 'painted';
    document.title = PAINTED_TITLE;
    return () => { delete root.dataset.skin; };
  }, []);
  useEffect(() => { document.documentElement.dataset.hour = hour; }, [hour]);

  // The loading screen (BarnDoors) covers every way into a 3D screen: the doors swing shut over the screen being left,
  // and the new one mounts two frames after they have met, so its build never freezes the swing or the old screen
  // half-way, or shows a scene still being put together. They open once it has drawn.
  const want = dreaming ? 'dream' : inGame ? 'game' : 'rest';
  const [mounted, setMounted] = useState(want);
  useEffect(() => {
    if (want === mounted) return;
    if (want === 'rest' || PREVIEW) return setMounted(want);
    // Quick: a short dark fade, and the doors only if the new screen keeps us waiting.
    if (!doorsShut()) playBarnDoors({ label: loadingLine(want), quick: true });
    let a = 0, b = 0;
    const cancel = whenDoorsShut(() => { a = requestAnimationFrame(() => { b = requestAnimationFrame(() => setMounted(want)); }); });
    return () => { cancel(); cancelAnimationFrame(a); cancelAnimationFrame(b); };
  }, [want, mounted]);
  // A solo game is made the moment it is chosen, but nobody can see it until the doors open: its clock waits for them, so
  // the table's intro and the first turn start in front of the player instead of running down behind the doors.
  useEffect(() => {
    if (want !== 'game' || PREVIEW) return;
    useStore.getState().holdClock();
    const cancel = whenDoorsOpen(() => useStore.getState().releaseClock());
    return () => { cancel(); useStore.getState().releaseClock(); };
  }, [want]);

  if (PREVIEW === 'sheep') return <SheepPreview />;
  if (PREVIEW === 'strips') return <StripsPreview />;
  if (PREVIEW === 'lineup') return <LineupPreview />;
  if (PREVIEW === 'kit') return <KitPreview />;
  if (PREVIEW === 'doors') return <Suspense fallback={null}><DoorsRender /></Suspense>;
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

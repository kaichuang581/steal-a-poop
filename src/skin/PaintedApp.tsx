import { JoinLink } from './share/JoinLink';
import { heatFor, setMusicScene } from '../audio/scene';
import { setSoftBoom, setTickVoice } from '../audio/sound';
import { loadStreak } from '../dream/daily';
import { burstExplodes, TICK_VOICE } from './shop/catalog';
import { grantStreak, useWallet } from './shop/store';
import { useAvatar } from './avatars/store';
import { Suspense, lazy, useEffect, useState } from 'react';
import { useRoomStore } from '../state/roomStore';
import { useStore } from '../state/store';
import { useAuth } from '../auth/authStore';
import { authEnabled } from '../auth/config';
import { FESTIVE } from '../config';
import { PaintedRoom } from './rooms/PaintedRoom';
import { useHour } from './hooks/useAmbient';
import { DreamScreen } from './dream/DreamScreen';
import { useDreamUi } from './dream/dreamStore';
import { PaintedGame } from './screens/PaintedGame';
import { PaintedHome, PAINTED_TITLE, APP_VERSION } from './screens/PaintedHome';
import { AppBoundary, reloadOnceForChunk } from './perf/AppBoundary';
import { ReportCard } from './perf/ReportCard';
import { installAudioSleep } from './perf/audioSleep';
import { noteDoorsOpen, noteError, setReportVersion, startReport } from './perf/report';
import { FacesPreview, LineupPreview, SheepPreview, SheetPreview, StripsPreview } from './table/SheepPreview';
import KitPreview from './kit/KitPreview';
// Developer pages (?preview=), for the tools that bake the game's pictures and strips (tools/renderDoors.mjs,
// renderThumbs.mjs, renderStall.mjs, renderGuide.mjs, animalStrips.mjs), which all run against `npm run dev`. They are
// not in the build players load: there `import.meta.env.DEV` is false, so PREVIEW is null and all of this falls away.
// (Taken out of the build on 2026-11-14 to make room for the leaderboards' sky; no player ever opened them.)
const DEV = import.meta.env.DEV;
const DoorsRender = DEV ? lazy(() => import('./loading/DoorsRender')) : null;
const ThumbRender = DEV ? lazy(() => import('./shop/ThumbRender')) : null;
const StallRender = DEV ? lazy(() => import('./shop/StallRender')) : null;
const GuideRender = DEV ? lazy(() => import('./tour/GuideRender')) : null;
const PropPreview = DEV ? lazy(() => import('./scene/style/PropPreview').then((m) => ({ default: m.PropPreview }))) : null;
const MiniPreview = DEV ? lazy(() => import('./scene/MiniPreview').then((m) => ({ default: m.MiniPreview }))) : null;
const PropBoard = DEV ? lazy(() => import('./scene/style/PropPreview').then((m) => ({ default: m.PropBoard }))) : null;
// ?preview=pen: the lobby's pen with four guests and no server, to look at the scene alone (development only).
const PenPreview = DEV ? lazy(() => import('./rooms/PenStage').then((m) => ({ default: () => <m.PenStage guests={['sheep', 'cow', 'pig', 'chicken'].map((avatar, i) => ({ id: `p${i}`, name: ['Brian', 'Maple', 'Barley', 'Tansy'][i], avatar, you: i === 0, host: i === 0 }))} farmSheep={2} reduced={false} phone={innerWidth < 640} shift={[0, 0]} /> }))) : null;
const PaletteSwatches = DEV ? lazy(() => import('./scene/style/PropPreview').then((m) => ({ default: m.PaletteSwatches }))) : null;
import { OnboardingGate } from './onboarding/Onboarding';
import { startVisitReports } from '../lib/visit';
import { BarnDoors, doorsShut, playBarnDoors, shutDoorsAtBoot, whenDoorsOpen, whenDoorsShut } from './components/BarnDoors';
import { PreviewCanvas as WendigoPreviewCanvas } from './table/WendigoPreview';
// The painted game's three faces ship with the game (public/fonts, declared in styles/fonts.css): nothing is asked of
// another site.
import './styles/fonts.css';
import './styles/skin.css';

/** ?preview=sheep opens the model preview (plan V3 Milestone 1). Development only (see DEV above). */
const PREVIEW = DEV ? new URLSearchParams(location.search).get('preview') : null;

// Fail soft (plan file 17, changes 2, 4 and 8; the pieces are in ./perf). From the moment this file is read the device
// report keeps the last errors, long tasks and files that failed, and `?report=1` shows it on a card over the game.
setReportVersion(APP_VERSION);
startReport();
const REPORT = typeof location !== 'undefined' && new URLSearchParams(location.search).get('report') === '1';
// A tab left open across a new version asks for pieces of the game that are no longer there. Vite says so with this
// event before the import fails: the page reloads for it once, marked in sessionStorage under sap:chunk-reload so it
// can never loop; the second time, the error goes on to the nearest boundary, which shows its card.
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (e) => {
    noteError((e as Event & { payload?: unknown }).payload ?? 'a piece of the game did not load', 'missing file');
    reloadOnceForChunk();
  });
}

/**
 * The painted skin's screen switch, mirroring App's: game, room, lobby, home. The Rooms lobby and waiting room keep
 * the classic screens until the game server is live (plan Milestone 7).
 */
/** What the loading slip says on the way into each screen. */
function loadingLine(to: 'dream' | 'game'): string {
  if (to === 'dream') return 'Tucking the farmer in';
  const mode = useStore.getState().mode;
  return mode === 'practice' ? 'Clearing the ice' : mode === 'tour' ? 'Whistling for the sheepdog' : mode === 'room' ? 'Seating everyone' : 'Setting the table';
}

export function PaintedApp() {
  const inGame = useStore((s) => s.game !== null);
  const inRoom = useRoomStore((s) => s.room !== null);
  const hour = useHour();
  const dreaming = useDreamUi((s) => s.open);
  // Every page load starts behind the doors, and they stay shut until Home is ready: the page itself comes with them
  // drawn shut (loading/bootDoors.ts), and the farm takes seconds to build, on a refresh as much as on a first visit
  // (Brian, 2026-11-13: "why is the loading screen not what pops up when the game is loading?"; a refresh used to skip
  // the doors and show the menu over an empty sky instead).
  useState(() => { if (!PREVIEW) shutDoorsAtBoot({ label: 'Opening up the barn' }); });
  // The season, mirrored once onto the page for the styles that follow it (plan file 13, change 7): <html data-festive>.
  useState(() => { document.documentElement.toggleAttribute('data-festive', FESTIVE); });
  // For the device report: how long the first load took, and whether the doors opened on a drawn scene or gave up.
  useEffect(() => whenDoorsOpen(noteDoorsOpen), []);
  const [report, setReport] = useState(REPORT);
  // Tell the game server this tab is open (numbers only, for the admin panel's visit counts): src/lib/visit.ts.
  useEffect(() => startVisitReports(), []);
  // Sound sleeps while the tab is hidden and wakes with it (plan file 17, change 12): perf/audioSleep.ts.
  useEffect(() => installAudioSleep(), []);
  // Keep the server told which avatar you picked, so the others in a room see it.
  const avatar = useAvatar();
  useEffect(() => { useRoomStore.getState().sendAvatar(avatar); }, [avatar]);
  // The Trading Post: the fuse sound and the burst worn, and any streak item the best dream streak has earned (kept for good).
  // A signed-in player has one name, the account's. Solo games seat the player under `settings.name`, so it follows
  // the account: it used to keep whatever the browser's guest name had been, with nowhere to change it while signed in.
  const accountName = useAuth((st) => (authEnabled() && st.status === 'ready' ? st.profile?.nickname ?? '' : ''));
  const localName = useStore((st) => st.settings.name);
  useEffect(() => { if (accountName && accountName !== localName) useStore.getState().setSettings({ name: accountName }); }, [accountName, localName]);
  const { tick, blast } = useWallet().equipped;
  useEffect(() => { setTickVoice(TICK_VOICE[tick] ?? 'chime'); }, [tick]);
  // A worn burst that is not an explosion goes off with a soft pop, not the ice blast.
  useEffect(() => { setSoftBoom(!burstExplodes(blast)); }, [blast]);
  useEffect(() => { void grantStreak(loadStreak().best); }, []);
  // The music follows the player (audio/scene.ts): the start screen's lofi, a lobby's wait, a song for each game mode.
  // The battle song plays harder each round, as the fuses get shorter, and lets go when the game is over.
  const mode = useStore((st) => st.mode);
  const round = useStore((st) => st.game?.round ?? 1);
  const gameOver = useStore((st) => st.game?.phase === 'gameOver');
  useEffect(() => {
    if (dreaming) setMusicScene('dream');
    else if (!inGame) setMusicScene(inRoom ? 'lobby' : 'home');
    else if (mode === 'practice' || mode === 'tour') setMusicScene(mode);
    else setMusicScene('battle', heatFor(round, gameOver));
  }, [dreaming, inGame, inRoom, mode, round, gameOver]);

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
  if (PREVIEW === 'sheet') return <SheetPreview />;
  if (PREVIEW === 'faces') return <FacesPreview />;
  if (PREVIEW === 'kit') return <KitPreview />;
  if (PREVIEW === 'doors' && DoorsRender) return <Suspense fallback={null}><DoorsRender /></Suspense>;
  if (PREVIEW === 'thumb' && ThumbRender) return <Suspense fallback={null}><ThumbRender /></Suspense>;
  if (PREVIEW === 'stall' && StallRender) return <Suspense fallback={null}><StallRender /></Suspense>;
  if (PREVIEW === 'guide' && GuideRender) return <Suspense fallback={null}><GuideRender /></Suspense>;
  // The diorama scenery's pages (docs/diorama/PLAN.md, 5.3 and 5.4).
  if (PREVIEW === 'pen' && PenPreview) return <div style={{ position: 'fixed', inset: 0 }}><Suspense fallback={null}><PenPreview /></Suspense></div>;
  if (PREVIEW === 'mini' && MiniPreview) return <Suspense fallback={null}><MiniPreview /></Suspense>;
  if (PREVIEW === 'prop' && PropPreview) return <Suspense fallback={null}><PropPreview /></Suspense>;
  if (PREVIEW === 'props' && PropBoard) return <Suspense fallback={null}><PropBoard /></Suspense>;
  if (PREVIEW === 'palette' && PaletteSwatches) return <Suspense fallback={null}><PaletteSwatches /></Suspense>;
  if (PREVIEW === 'wendigo') return <div style={{ position: 'fixed', inset: 0 }}><WendigoPreviewCanvas /></div>;
  // A ?join=CODE address joins that room once the player is signed in and online.
  // The start screen is always the first thing: nothing to get through before it. The name is picked there, and signing
  // in is one button on it, for whoever wants an account.
  const home = <PaintedHome />;
  const screen = mounted === 'dream' && dreaming ? <DreamScreen />
    : mounted === 'game' && inGame ? <PaintedGame />
    : inRoom ? <PaintedRoom />
    : home;
  // The first-visit form: every new player says how they play, their country and age, and a parent agrees if needed.
  // AppBoundary: whatever the screen throws ends on a card with Reload and "Copy device report", never an empty page.
  // The doors and the report card stay outside it, so they outlive a screen that failed.
  return <><AppBoundary><JoinLink />{screen}<OnboardingGate /></AppBoundary><BarnDoors />{report && <ReportCard onClose={() => setReport(false)} />}</>;
}

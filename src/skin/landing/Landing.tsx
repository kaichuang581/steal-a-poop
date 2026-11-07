import { useState } from 'react';
import { useAuth } from '../../auth/authStore';
import { authEnabled } from '../../auth/config';
import { AuthDialog } from '../../ui/auth/AuthDialog';
import { useStore } from '../../state/store';
import { legalHref } from '../../ui/legal/legalLinks';
import { TitleBoard } from '../components/TitleBoard';
import { ClothButton, WoodButton } from '../components/Materials';
import { FarmBackdrop } from '../table/FarmBackdrop';
import { PAINTED_TITLE } from '../screens/PaintedHome';
import { useHour, useMotionLevel } from '../hooks/useAmbient';
import { useIsMobile } from '../../ui/hooks';

/** The first screen for anyone not signed in: the farm, a one-round sample game, and the three ways in. */
export function Landing() {
  const hour = useHour();
  const reduced = useMotionLevel() === 'reduced';
  const phone = useIsMobile();
  const [dialog, setDialog] = useState<null | 'account' | 'guest'>(null);
  const [error, setError] = useState('');
  const accounts = authEnabled();
  const startTour = useStore((s) => s.startTour);

  const google = async () => {
    setError('');
    try {
      await useAuth.getState().signInWith('google');
    } catch {
      setError('Google sign-in is not set up yet. Use email or play as a guest.');
    }
  };

  return (
    <main className="sk-home relative h-full overflow-hidden">
      <div className="absolute inset-0"><FarmBackdrop hour={hour} reduced={reduced} sleepy={false} phone={phone} /></div>
      <div className="absolute inset-x-0 top-6 flex justify-center">
        <TitleBoard title={PAINTED_TITLE} tagline="Chain words, keep your wool, and be the last sheep standing." compact={phone} />
      </div>
      <section aria-label="Get started" className="absolute inset-x-3 bottom-3 mx-auto flex max-w-md flex-col gap-2 sm:bottom-10 sm:left-10 sm:right-auto sm:mx-0">
        <WoodButton onClick={() => startTour('menu')} className="w-full">Watch a sample round</WoodButton>
        <p className="sk-hand text-center text-lg" style={{ color: 'var(--glow)' }}>Then choose how to play:</p>
        {accounts && <ClothButton onClick={() => void google()} className="w-full">Continue with Google</ClothButton>}
        {accounts && <ClothButton onClick={() => setDialog('account')} className="w-full">Sign in or sign up with email</ClothButton>}
        <WoodButton onClick={() => setDialog('guest')} className="w-full">Play as a guest</WoodButton>
        {error && <p role="alert" className="sk-paper px-3 py-1 text-center text-sm font-bold" style={{ color: 'var(--coral-dark)' }}>{error}</p>}
        <p className="text-center text-xs" style={{ color: 'var(--button-text)' }}>
          <a className="underline" href={legalHref('privacy')} target="_blank" rel="noopener">Privacy</a> ·{' '}
          <a className="underline" href={legalHref('terms')} target="_blank" rel="noopener">Terms</a> ·{' '}
          <a className="underline" href={legalHref('child-safety')} target="_blank" rel="noopener">Child safety</a>
        </p>
      </section>
      {dialog && <AuthDialog start={dialog === 'guest' ? 'guest' : 'main'} onClose={() => setDialog(null)} />}
    </main>
  );
}

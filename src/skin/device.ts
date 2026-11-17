import { useEffect, useState } from 'react';
import { useMediaQuery } from '../ui/hooks';

/** What kind of device the player is on: a phone (touch, narrow) or a computer. Tablets count as a computer. */
export type Device = 'phone' | 'computer';

/** Pure: a touch screen with a narrow width is a phone, or a user agent that says so. */
export function detectDevice(input: { coarse: boolean; width: number; userAgent: string }): Device {
  const mobileAgent = /Android.+Mobile|iPhone|iPod|Windows Phone|Mobile Safari/i.test(input.userAgent);
  if (mobileAgent) return 'phone';
  return input.coarse && input.width < 800 ? 'phone' : 'computer';
}

function current(): Device {
  if (typeof window === 'undefined') return 'computer';
  return detectDevice({
    coarse: window.matchMedia?.('(pointer: coarse)').matches ?? false,
    width: window.innerWidth,
    userAgent: navigator.userAgent,
  });
}

/** The device this player is on, kept up to date if the window changes size or the device rotates. Also sets data-device on <html>. */
export function useDevice(): Device {
  const [device, setDevice] = useState<Device>(current);
  useEffect(() => {
    const update = () => setDevice(current());
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.device = device;
  }, [device]);
  return device;
}

/** The window sizes that get the phone layout: a narrow window, or a short touch screen (a phone held sideways). */
export const PHONE_LAYOUT = '(max-width: 639px), (max-height: 500px) and (pointer: coarse)';

/**
 * Whether the table and Home lay themselves out for a phone. The classic `useIsMobile` only looks at the width, so a
 * phone on its side got the computer's layout with the word bar below the screen. Follows the window as it changes.
 */
export const usePhoneLayout = (): boolean => useMediaQuery(PHONE_LAYOUT);

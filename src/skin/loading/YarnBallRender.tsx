import { useEffect, useRef } from 'react';
import { BALL_PX, BALL_R, drawBallWraps } from './yarn';

declare global {
  interface Window { __thumbReady?: boolean }
}

/**
 * ?preview=yarnball: the loading screen's yarn ball, its wraps alone (no shade, no shadow: those are drawn live over and
 * under it, so they never turn with it), 320 px square, the ball's radius 320 / 2.4, spin 0, clear outside the ball,
 * for tools/renderYarnBall.mjs to bake into public/loading/yarn-ball.webp. Never shown to players.
 */
export default function YarnBallRender() {
  const cv = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = cv.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, BALL_PX, BALL_PX);
    drawBallWraps(ctx, BALL_PX / 2, BALL_PX / 2, BALL_R, 0);
    window.__thumbReady = true;
  }, []);
  return <canvas ref={cv} width={BALL_PX} height={BALL_PX} style={{ position: 'fixed', left: 0, top: 0, width: BALL_PX, height: BALL_PX }} />;
}

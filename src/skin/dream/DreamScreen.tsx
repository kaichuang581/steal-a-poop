import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { playSound, playTick } from '../../audio/sound';
import { utcDateKey } from '../../engine';
import { getDreamBest, getDreamStreak, markDreamStarted, recordBest, recordDream } from '../../dream/daily';
import { dreamSeed, dreamShareText, faceOf, fenceAt, FIELD, JUMP_MS, jumpHeight, speedAt, takeoffDistance, tryFill } from '../../dream/dream';
import type { Fence } from '../../dream/dream';
import { useStore } from '../../state/store';
import { useMotionLevel } from '../hooks/useAmbient';
import { C, getArt } from './art';
import { useDreamUi } from './dreamStore';
import './dream.css';

/**
 * Counting Sheep: the farmer asleep in bed, and above him the classic thought bubble where sheep leap a fence one by
 * one while he counts. You keep him asleep: each fence has letters missing, type ones that finish a real word and the
 * sheep clears it. Miss one and the sheep bumps the fence, the bubble pops and the farmer wakes. Runs like the
 * offline dinosaur: one life, faster and harder the longer it goes. Drawn on a 320 x 180 canvas, pixel-crisp.
 */
const W = 320, H = 180;
const { ground: GROUND, sheepX: SX, sheepW: SW, fenceW: FW, fenceH: FH } = FIELD;
const SPAWN_X = W + 24;
/** A fence takes letters only once it is about to come into view, so nobody can bank fences far ahead. */
const TYPE_X = W + 30;

type Phase = 'ready' | 'running' | 'crashed' | 'results';
interface Live {
  fences: { f: Fence; x: number; locked: boolean; passed: boolean; jumped: boolean; lucid: boolean }[];
  next: number;
  typed: string;
  wrongUntil: number;
  count: number;
  lucid: number;
  speed: number;
  dist: number;
  jumpAt: number | null;
  t: number;
  crashAt: number | null;
  pops: { n: number; at: number; x: number }[];
}

// The thought bubble: a rounded body with scallops all round, and a trail of small puffs down to the farmer's head.
const PUFFS: [number, number, number][] = [
  [72, 42, 20], [112, 32, 22], [158, 28, 22], [204, 29, 22], [248, 33, 21], [284, 48, 19],
  [50, 72, 21], [298, 74, 15], [62, 102, 20], [106, 114, 18], [154, 118, 17], [202, 117, 17], [248, 112, 18], [286, 98, 17],
];
const TRAIL: [number, number, number][] = [[40, 141, 2.5], [47, 133, 3.5], [55, 124, 5]];

function freshLive(seed: string): Live {
  const first = fenceAt(seed, 0);
  return {
    fences: [{ f: first, x: SX + SW + 120, locked: false, passed: false, jumped: false, lucid: false }],
    next: 1, typed: '', wrongUntil: 0, count: 0, lucid: 0, speed: speedAt(0), dist: 0, jumpAt: null, t: 0, crashAt: null, pops: [],
  };
}

export function DreamScreen() {
  const dict = useStore((s) => s.dict);
  const practice = useDreamUi((s) => s.practice);
  const close = useDreamUi((s) => s.close);
  const openDream = useDreamUi((s) => s.openDream);
  const reduced = useMotionLevel() === 'reduced';
  const today = utcDateKey(new Date());
  const [seed, setSeed] = useState(() => (practice ? `practice:${Date.now()}` : dreamSeed(today)));
  const [phase, setPhase] = useState<Phase>('ready');
  const [count, setCount] = useState(0);
  const [best, setBest] = useState(() => getDreamBest());
  const [streak, setStreak] = useState(0);
  const [copied, setCopied] = useState(false);
  const [scale, setScale] = useState(2);
  const [face, setFace] = useState('');
  const canvas = useRef<HTMLCanvasElement>(null);
  const ghost = useRef<HTMLInputElement>(null);
  const live = useRef<Live>(freshLive(seed));
  const phaseRef = useRef<Phase>('ready');
  phaseRef.current = phase;

  // Fit the 320 x 180 dream to the window in half steps, never past 4x.
  useLayoutEffect(() => {
    const fit = () => {
      // Half steps on big screens keep the pixels even; small screens use every pixel of width they have.
      const s = Math.min((window.innerWidth - 24) / W, (window.innerHeight * 0.72) / H, 4);
      setScale(s >= 2 ? Math.floor(s * 2) / 2 : Math.max(0.8, s));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  const begin = useCallback(() => {
    if (phaseRef.current !== 'ready' || !dict) return;
    if (!practice) markDreamStarted(today);
    live.current = freshLive(seed);
    setPhase('running');
    ghost.current?.focus();
  }, [dict, practice, seed, today]);

  const finish = useCallback(() => {
    const L = live.current;
    setPhase('results');
    if (practice) setBest(recordBest(L.count));
    else {
      setStreak(recordDream({ date: today, status: 'done', count: L.count, lucid: L.lucid }));
      setBest(getDreamBest());
    }
  }, [practice, today]);

  // Leaving mid-dream still uses up the night's attempt, with what was counted so far.
  useEffect(() => () => {
    if (phaseRef.current === 'running' && !practice) recordDream({ date: today, status: 'done', count: live.current.count, lucid: live.current.lucid });
  }, [practice, today]);

  // ---------- typing ----------
  const active = () => {
    const a = live.current.fences.find((x) => !x.locked && !x.passed);
    return a && a.x < TYPE_X ? a : null;
  };
  const typeLetter = (ch: string) => {
    if (phaseRef.current === 'ready') { begin(); return; }
    if (phaseRef.current !== 'running' || !dict) return;
    const L = live.current;
    const a = active();
    if (!a || L.t < L.wrongUntil) return;
    if (L.typed.length >= a.f.blanks.length) return;
    L.typed += ch;
    playTick(L.typed.length / a.f.blanks.length);
    const res = tryFill(dict, a.f, L.typed);
    if (res === 'ok') {
      a.locked = true;
      a.lucid = faceOf(a.f, L.typed).toLowerCase() !== a.f.word;
      if (a.lucid) L.lucid++;
      (a as { shown?: string }).shown = faceOf(a.f, L.typed);
      L.typed = '';
      playSound('bank');
    } else if (res === 'wrong') {
      L.wrongUntil = L.t + 260;
      playSound('fail');
    }
  };
  const backspace = () => { live.current.typed = live.current.typed.slice(0, -1); };

  const onKey = (e: ReactKeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (phase === 'ready' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); begin(); return; }
    if (e.key === 'Backspace') { e.preventDefault(); backspace(); }
  };
  const onInput = (value: string) => {
    for (const ch of value.toLowerCase()) if (ch >= 'a' && ch <= 'z') typeLetter(ch);
    if (ghost.current) ghost.current.value = '';
  };

  // ---------- the loop ----------
  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    const art = getArt();
    const dpr = window.devicePixelRatio || 1;
    const px = Math.max(1, Math.ceil(scale * dpr));
    cv.width = W * px;
    cv.height = H * px;
    const g = cv.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    let raf = 0;
    let last = performance.now();
    const stars = Array.from({ length: 46 }, (_, i) => ({ x: (i * 97.3) % 260 + 40, y: (i * 53.7) % 70 + 14, p: (i * 1.7) % 6.28 }));

    const step = (now: number) => {
      const dt = Math.min(50, now - last);
      last = now;
      const L = live.current;
      const running = phaseRef.current === 'running';
      if (running || phaseRef.current === 'ready') L.t += dt;
      if (running) update(L, dt);
      if (phaseRef.current === 'crashed' && L.crashAt !== null) L.t += dt;
      draw(g, px, L, now, stars);
      const a = L.fences.find((x) => !x.locked && !x.passed && x.x < TYPE_X);
      const shownFace = a ? faceOf(a.f, L.typed) : '';
      setFace((f) => (f === shownFace ? f : shownFace));
      raf = requestAnimationFrame(step);
    };

    const update = (L: Live, dt: number) => {
      const target = speedAt(L.count);
      L.speed += (target - L.speed) * Math.min(1, dt / 600);
      const dx = (L.speed * dt) / 1000;
      L.dist += dx;
      for (const fe of L.fences) fe.x -= dx;
      // Keep fences queued ahead: each one its gap in seconds behind the last, at the speed it will be met.
      while (L.fences.length < 4) {
        const prev = L.fences[L.fences.length - 1];
        const f = fenceAt(seed, L.next++);
        L.fences.push({ f, x: Math.max(SPAWN_X, prev.x + f.gap * speedAt(f.index)), locked: false, passed: false, jumped: false, lucid: false });
      }
      // Jump the next finished fence when it reaches the take-off point (or at once if it was finished late).
      const ahead = L.fences.find((fe) => !fe.passed && fe.x + FW > SX);
      if (ahead && ahead.locked && !ahead.jumped && L.jumpAt === null && ahead.x - (SX + SW) <= takeoffDistance(L.speed)) {
        ahead.jumped = true;
        L.jumpAt = L.t;
      }
      const air = L.jumpAt === null ? 0 : jumpHeight(L.t - L.jumpAt);
      if (L.jumpAt !== null && L.t - L.jumpAt >= JUMP_MS) L.jumpAt = null;
      for (const fe of L.fences) {
        if (fe.passed) continue;
        const overlaps = fe.x < SX + SW - 3 && fe.x + FW > SX + 3;
        if (overlaps && air < FH - 6) {
          // Bump: the farmer stirs.
          L.crashAt = L.t;
          L.jumpAt = null;
          playSound('trap');
          setPhase('crashed');
          setCount(L.count);
          setTimeout(finish, reduced ? 600 : 1500);
          return;
        }
        if (fe.x + FW < SX) {
          fe.passed = true;
          L.count++;
          L.pops.push({ n: L.count, at: L.t, x: SX + SW / 2 });
          setCount(L.count);
        }
      }
      L.fences = L.fences.filter((fe) => fe.x > -40);
      L.pops = L.pops.filter((p) => L.t - p.at < 1200);
    };

    const draw = (g: CanvasRenderingContext2D, px: number, L: Live, now: number, st: typeof stars) => {
      g.setTransform(px, 0, 0, px, 0, 0);
      g.imageSmoothingEnabled = false;
      const crashed = L.crashAt !== null;
      const since = crashed ? L.t - L.crashAt! : 0;
      const awake = crashed && since > 350;
      drawRoom(g, now, awake, L.count);

      // The bubble fades and wobbles away once the farmer stirs.
      const fade = crashed ? Math.max(0, 1 - Math.max(0, since - 500) / 700) : 1;
      if (fade > 0) {
        g.save();
        g.globalAlpha = fade;
        const shake = crashed && !reduced && since < 400 ? Math.round(Math.sin(since / 25) * 2) : 0;
        g.translate(shake, 0);
        // Glow, rim, then the dream clipped inside.
        g.fillStyle = 'rgba(200,185,255,0.18)';
        bubblePath(g, 5); g.fill();
        g.fillStyle = C.bubbleEdge;
        bubblePath(g, 2); g.fill();
        for (const [x, y, r] of TRAIL) { g.beginPath(); g.arc(x, y, r + 1.5, 0, Math.PI * 2); g.fill(); }
        g.fillStyle = C.bubble;
        for (const [x, y, r] of TRAIL) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
        g.save();
        bubblePath(g, 0);
        g.clip();
        drawDream(g, L, now, st);
        g.restore();
        g.restore();
      }
    };

    const drawDream = (g: CanvasRenderingContext2D, L: Live, now: number, st: typeof stars) => {
      const sky = g.createLinearGradient(0, 0, 0, GROUND);
      sky.addColorStop(0, C.skyTop); sky.addColorStop(0.55, C.skyMid); sky.addColorStop(1, C.skyLow);
      g.fillStyle = sky;
      g.fillRect(0, 0, W, 140);
      for (const s of st) {
        const tw = reduced ? 1 : 0.5 + 0.5 * Math.sin(now / 600 + s.p);
        g.fillStyle = C.star;
        g.globalAlpha = 0.35 + 0.65 * tw;
        g.fillRect(Math.round(s.x), Math.round(s.y), 1, 1);
        if (tw > 0.85) { g.fillRect(Math.round(s.x) - 1, Math.round(s.y), 3, 1); g.fillRect(Math.round(s.x), Math.round(s.y) - 1, 1, 3); }
      }
      g.globalAlpha = 1;
      // A crescent moon.
      g.fillStyle = C.moon;
      g.beginPath(); g.arc(236, 50, 9, 0, Math.PI * 2); g.fill();
      g.fillStyle = C.skyMid;
      g.beginPath(); g.arc(240, 46, 8, 0, Math.PI * 2); g.fill();
      // Rolling hills, far and near, drifting slower than the ground.
      hills(g, L.dist * 0.15, 92, 7, 0.031, C.hillFar);
      hills(g, L.dist * 0.4, 99, 5, 0.05, C.hillNear);
      // Wisps of cloud.
      g.fillStyle = 'rgba(255,255,255,0.16)';
      for (let i = 0; i < 3; i++) {
        const x = ((i * 120 - L.dist * 0.08) % 380 + 380) % 380 - 30;
        const y = 54 + i * 9;
        g.fillRect(Math.round(x), y, 26, 3); g.fillRect(Math.round(x) + 6, y - 2, 12, 2);
      }
      // The meadow.
      g.fillStyle = C.grass; g.fillRect(0, GROUND, W, 40);
      g.fillStyle = C.grassTop; g.fillRect(0, GROUND, W, 2);
      g.fillStyle = C.grassDark;
      for (let i = 0; i < 26; i++) {
        const x = Math.round(((i * 37 - L.dist) % 330 + 330) % 330 - 5);
        g.fillRect(x, GROUND + 5 + ((i * 7) % 12), 3, 1);
        if (i % 4 === 0) { g.fillStyle = C.flower; g.fillRect(x + 7, GROUND + 3 + (i % 9), 1, 1); g.fillStyle = C.grassDark; }
      }

      // Fences, each with its sign.
      const a = L.fences.find((x) => !x.locked && !x.passed && x.x < TYPE_X);
      const wrong = L.t < L.wrongUntil;
      for (const fe of L.fences) {
        const x = Math.round(fe.x);
        if (x > W + 10) continue;
        g.drawImage(art.fence, x - 1, GROUND - FH);
        const text = fe.locked ? (fe as { shown?: string }).shown ?? fe.f.word.toUpperCase() : faceOf(fe.f, fe === a ? L.typed : '');
        sign(g, x + FW / 2, GROUND - FH - 4, text, fe.locked ? C.signOk : fe === a && wrong ? C.signBad : C.sign, fe === a);
      }

      // The sheep.
      const crashed = L.crashAt !== null;
      const air = L.jumpAt === null ? 0 : jumpHeight(L.t - L.jumpAt);
      const run = Math.floor(L.t / 110) % 2 === 0;
      const img = crashed ? art.sheep.bonk : air > 0 ? art.sheep.jump : phaseRef.current === 'ready' ? art.sheep.a : run ? art.sheep.a : art.sheep.b;
      const back = crashed ? Math.min(6, (L.t - L.crashAt!) / 30) : 0;
      const bob = !crashed && air === 0 && phaseRef.current === 'running' && run ? 1 : 0;
      g.drawImage(img, SX - 1 - Math.round(back), GROUND - img.height + 1 - Math.round(air) - bob);
      if (crashed) {
        // Little stars round its head.
        g.fillStyle = C.signOk;
        for (let i = 0; i < 3; i++) {
          const an = L.t / 160 + (i * Math.PI * 2) / 3;
          g.fillRect(Math.round(SX + 16 - back + Math.cos(an) * 7), Math.round(GROUND - 20 + Math.sin(an) * 2), 2, 2);
        }
      }

      // The count pops up over each sheep as it lands.
      g.textAlign = 'center';
      g.textBaseline = 'alphabetic';
      for (const p of L.pops) {
        const k = (L.t - p.at) / 1200;
        g.globalAlpha = 1 - k;
        text(g, String(p.n), p.x, GROUND - 30 - k * 14, 12, C.star);
      }
      g.globalAlpha = 1;

      // The tally, top right, and the word to finish, top centre.
      g.drawImage(art.icon, 262, 30);
      g.textAlign = 'left';
      text(g, String(L.count), 272, 37, 11, C.star);
      if (phaseRef.current === 'ready') {
        g.textAlign = 'center';
        text(g, 'Count sheep to fall asleep', 176, 48, 11, C.star);
        text(g, 'Fill the blanks to jump each fence', 176, 61, 8, '#d9d0ff');
        text(g, Math.floor(L.t / 500) % 2 ? 'press any key' : '', 176, 80, 8, C.signOk);
      } else if (a && phaseRef.current === 'running') {
        banner(g, faceOf(a.f, L.typed), wrong);
      }
    };

    const drawRoom = (g: CanvasRenderingContext2D, now: number, awake: boolean, n: number) => {
      const wall = g.createLinearGradient(0, 0, 0, H);
      wall.addColorStop(0, C.wall); wall.addColorStop(1, C.wallLow);
      g.fillStyle = wall; g.fillRect(0, 0, W, H);
      // Moonlight from a window off to the right.
      g.fillStyle = C.moonlight;
      g.beginPath(); g.moveTo(320, 60); g.lineTo(320, 180); g.lineTo(190, 180); g.lineTo(250, 120); g.fill();
      // Floor and rug.
      g.fillStyle = C.floor; g.fillRect(0, 164, W, 16);
      g.fillStyle = C.floorLine;
      for (let x = 6; x < W; x += 22) g.fillRect(x, 164, 1, 16);
      g.fillRect(0, 164, W, 1);
      g.fillStyle = C.rugEdge; g.fillRect(196, 167, 92, 10);
      g.fillStyle = C.rug; g.fillRect(198, 168, 88, 8);
      // Bedside table and alarm clock (it rings when he wakes).
      g.fillStyle = C.bedDark; g.fillRect(166, 146, 22, 18);
      g.fillStyle = C.bed; g.fillRect(164, 144, 26, 4);
      const ring = awake ? Math.round(Math.sin(now / 30)) : 0;
      g.fillStyle = C.clock; g.fillRect(170 + ring, 134, 14, 10); g.fillRect(169 + ring, 132, 4, 3); g.fillRect(181 + ring, 132, 4, 3);
      g.fillStyle = C.clockFace; g.fillRect(172 + ring, 136, 10, 7);
      g.fillStyle = C.ink; g.fillRect(177 + ring, 137, 1, 3); g.fillRect(177 + ring, 139, 3, 1);
      if (awake) { g.textAlign = 'center'; text(g, 'RING!', 178, 128, 8, C.signOk); }

      // The bed: headboard, mattress, quilt over the farmer.
      g.fillStyle = C.bedDark; g.fillRect(4, 126, 10, 42); g.fillRect(150, 146, 8, 22);
      g.fillStyle = C.bed; g.fillRect(6, 128, 6, 38); g.fillRect(2, 124, 14, 4); g.fillRect(152, 148, 4, 18);
      g.fillStyle = C.sheet; g.fillRect(12, 152, 140, 8);
      g.fillStyle = C.bedDark; g.fillRect(12, 160, 140, 6);
      // Patchwork quilt with a body-shaped bump that rises and falls as he breathes.
      const breath = awake ? 0 : Math.round(Math.sin(now / 900) + 1) / 2;
      for (let i = 0; i < 9; i++) {
        g.fillStyle = C.quilt[i % 4];
        const bump = i >= 1 && i <= 5 ? 4 + breath : i === 6 ? 2 : 0;
        g.fillRect(40 + i * 12, 146 - bump, 12, 12 + bump);
        g.fillStyle = 'rgba(0,0,0,0.18)';
        g.fillRect(40 + i * 12, 155, 12, 3);
      }
      g.fillStyle = C.line; g.fillRect(40, 157, 108, 1);
      // Pillow.
      g.fillStyle = C.pillowShade; g.fillRect(14, 140, 30, 13);
      g.fillStyle = C.pillow; g.fillRect(15, 140, 28, 10);
      // The farmer's head: face, ear, moustache, closed (or wide) eyes, rosy cheek, and the striped nightcap.
      const hx = 22, hy = awake ? 128 : 132;
      g.fillStyle = C.skinShade; g.fillRect(hx, hy + 2, 16, 12);
      g.fillStyle = C.skin; g.fillRect(hx + 1, hy + 1, 15, 11); g.fillRect(hx + 16, hy + 6, 2, 3);
      g.fillStyle = C.cheek; g.fillRect(hx + 11, hy + 7, 3, 2);
      g.fillStyle = C.ink;
      if (awake) { g.fillRect(hx + 8, hy + 4, 2, 3); g.fillRect(hx + 13, hy + 4, 2, 3); }
      else { g.fillRect(hx + 8, hy + 5, 3, 1); g.fillRect(hx + 13, hy + 5, 3, 1); }
      g.fillStyle = C.tash; g.fillRect(hx + 9, hy + 9, 9, 2); g.fillRect(hx + 8, hy + 10, 2, 2); g.fillRect(hx + 17, hy + 10, 2, 2);
      if (awake) { g.fillStyle = C.ink; g.fillRect(hx + 12, hy + 12, 3, 2); }
      for (let i = 0; i < 6; i++) {
        g.fillStyle = i % 2 ? C.capB : C.capA;
        g.fillRect(hx - 2 + i * 3, hy - 3 + (i < 2 ? 2 : 0), 3, 5 - (i < 2 ? 2 : 0));
      }
      g.fillStyle = C.capA; g.fillRect(hx - 6, hy + 1, 5, 3); g.fillRect(hx - 9, hy + 3, 4, 3);
      g.fillStyle = C.pom; g.fillRect(hx - 12, hy + 4, 4, 4);
      if (awake) { g.textAlign = 'center'; text(g, '!', hx + 26, hy - 4, 14, C.signOk); }
      else if (phaseRef.current !== 'crashed') {
        // Zzz drifting up from the pillow.
        g.textAlign = 'left';
        for (let i = 0; i < 3; i++) {
          const k = ((now / 2200 + i / 3) % 1);
          g.globalAlpha = Math.sin(k * Math.PI);
          text(g, 'z', 66 + k * 14 + i * 2, 150 - k * 14, 7 + i * 2 + (n > 30 ? 2 : 0), '#d9d0ff');
        }
        g.globalAlpha = 1;
      }
    };

    const hills = (g: CanvasRenderingContext2D, off: number, base: number, amp: number, f: number, color: string) => {
      g.fillStyle = color;
      for (let x = 0; x < W; x += 2) {
        const h = Math.round(Math.sin((x + off) * f) * amp + Math.sin((x + off) * f * 2.3) * amp * 0.4);
        g.fillRect(x, base - h, 2, GROUND - base + h + 1);
      }
    };

    const bubblePath = (g: CanvasRenderingContext2D, grow: number) => {
      g.beginPath();
      g.roundRect(48 - grow, 30 - grow, 250 + grow * 2, 86 + grow * 2, 24);
      for (const [x, y, r] of PUFFS) { g.moveTo(x + r + grow, y); g.arc(x, y, r + grow, 0, Math.PI * 2); }
    };

    const text = (g: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string) => {
      g.font = `${size}px "DotGothic16", monospace`;
      g.fillStyle = C.line;
      g.fillText(s, x + 0.5, y + 0.75);
      g.fillStyle = color;
      g.fillText(s, x, y);
    };

    const sign = (g: CanvasRenderingContext2D, cx: number, bottom: number, s: string, fill: string, hot: boolean) => {
      g.font = '8px "DotGothic16", monospace';
      const w = Math.ceil(g.measureText(s).width) + 6;
      const x = Math.round(cx - w / 2), y = bottom - 10;
      g.fillStyle = C.woodDark; g.fillRect(Math.round(cx) - 1, bottom, 2, 4);
      g.fillStyle = C.line; g.fillRect(x - 1, y - 1, w + 2, 12);
      g.fillStyle = fill; g.fillRect(x, y, w, 10);
      if (hot) { g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(x, y, w, 1); }
      g.textAlign = 'center';
      g.fillStyle = C.ink;
      g.fillText(s, Math.round(cx), y + 8);
    };

    const banner = (g: CanvasRenderingContext2D, s: string, wrong: boolean) => {
      g.font = '14px "DotGothic16", monospace';
      const letters = s.split('');
      const step = 13;
      const w = letters.length * step + 12;
      const x = Math.round(176 - w / 2), y = 34;
      g.fillStyle = C.line; g.fillRect(x - 1, y - 1, w + 2, 22);
      g.fillStyle = wrong ? C.signBad : C.sign; g.fillRect(x, y, w, 20);
      g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(x, y, w, 2);
      g.textAlign = 'center';
      letters.forEach((ch, i) => {
        const cx = x + 6 + step * i + step / 2;
        if (ch === '_') { g.fillStyle = C.woodDark; g.fillRect(Math.round(cx) - 4, y + 15, 8, 2); }
        else { g.fillStyle = C.ink; g.fillText(ch, cx, y + 15); }
      });
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [scale, seed, finish, reduced]);

  const share = async () => {
    const text = dreamShareText({ date: today, count, lucid: live.current.lucid, streak: streak || getDreamStreak(today) });
    try { await navigator.clipboard.writeText(text); } catch { window.prompt('Copy your result:', text); }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const again = () => {
    const s = `practice:${Date.now()}`;
    openDream(true);
    setSeed(s);
    live.current = freshLive(s);
    setCount(0);
    setPhase('ready');
    ghost.current?.focus();
  };

  if (!dict) return <main className="dr-root"><p className="dr-loading">Loading the word list…</p></main>;

  return (
    <main className="dr-root" onKeyDown={onKey} aria-label="Counting Sheep" data-phase={phase}>
      <h1 className="dr-title">Counting Sheep{practice ? <small> · practice</small> : null}</h1>
      <div className="dr-frame" style={{ width: W * scale, height: H * scale }} onPointerDown={() => { ghost.current?.focus(); if (phase === 'ready') begin(); }}>
        <canvas ref={canvas} className="dr-canvas" style={{ width: W * scale, height: H * scale }} aria-hidden="true" />
        <input
          ref={ghost} className="dr-ghost" autoFocus aria-label="Missing letters" autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false}
          onChange={(e) => onInput(e.target.value)}
          onBlur={() => { if (phaseRef.current === 'running') setTimeout(() => ghost.current?.focus(), 0); }}
        />
        <p className="sr-only" aria-live="polite">{phase === 'running' ? `${face.split('').join(' ')}. ${count} sheep.` : ''}</p>
        {phase === 'results' && (
          <div className="dr-results" role="dialog" aria-label="The farmer woke up">
            <h2>The farmer woke up!</h2>
            <p className="dr-big"><b>{count}</b> sheep counted</p>
            <dl>
              <div><dt>Best</dt><dd>{best}</dd></div>
              <div><dt>Lucid jumps</dt><dd>{live.current.lucid}</dd></div>
              {!practice && <div><dt>Streak</dt><dd>{streak} night{streak === 1 ? '' : 's'}</dd></div>}
            </dl>
            <div className="dr-actions">
              {!practice && <button onClick={share} autoFocus>{copied ? 'Copied!' : 'Share'}</button>}
              <button onClick={again} autoFocus={practice}>Dream again</button>
              <button onClick={close}>Farm</button>
            </div>
            <p className="dr-note">{practice ? 'Practice dreams don’t count toward your streak.' : 'A new dream every night at midnight UTC. Practice as much as you like.'}</p>
          </div>
        )}
      </div>
      <p className="dr-help">Type letters that finish each fence’s word — any real word counts. Backspace fixes, Esc wakes up.</p>
      <button className="dr-quit" onClick={close} aria-label="Leave the dream">✕</button>
    </main>
  );
}

import { describe, expect, it } from 'vitest';
import { browserOf, formatReport, frameRates, scrub } from '../report';
import type { ReportData } from '../report';

// docs/visual-overhaul/17-performance-and-stability.md, change 8: "formatter unit test (no player name, no middle dot)".
const data: ReportData = {
  game: 'Fleeced', version: '0.7.5', url: 'https://fleeced.io/', when: '2026-11-16 19:42',
  browser: 'Chrome 142 on ChromeOS', screen: [1366, 768], pixelRatio: 1, displayHz: 60, cores: 2, memoryGb: 4,
  webgl2: true, renderer: 'ANGLE (Intel, Mesa Intel(R) UHD Graphics 600)', maxTexture: 8192, reducedMotion: false,
  doorsOpenS: 9.84, doorsGaveUp: false, longTasks: 3, longestTaskMs: 410,
  scenes: [{ name: 'Home', fpsMedian: 30.2, fpsWorst: 24.4, resolution: 1, draws: 148, triangles: 360_000, canvas: [1366, 768], window: [1366, 768] }],
  contexts: { made: 3, lost: 0, restored: 0 },
  fonts: [['Fraunces', true], ['Patrick Hand', true], ['Nunito', false]],
  failedFiles: [], music: true, audio: true, errors: [], saved: [[`sap:dpr:${'farm'}`, '1']],
};

describe('the device report', () => {
  it('is written as the plan sets it out, a group of facts to a line', () => {
    expect(formatReport(data).split('\n')).toEqual([
      'Fleeced 0.7.5, https://fleeced.io/, 2026-11-16 19:42',
      'Browser: Chrome 142 on ChromeOS; screen 1366 x 768 at 1x; display 60 Hz; 2 cores; 4 GB',
      'WebGL2: yes; renderer ANGLE (Intel, Mesa Intel(R) UHD Graphics 600); max texture 8192',
      'Motion: reduced motion no',
      'Load: doors open 9.8 s; doors gave up: no; long tasks 3, longest 410 ms',
      'Home: 30 fps median, 24 fps worst 5%; resolution 1x; 148 draws; 0.36 M triangles; canvas 1366 x 768 in a 1366 x 768 window',
      'Contexts: made 3, lost 0, restored 0',
      'Fonts: Fraunces yes, Patrick Hand yes, Nunito no',
      'Files that failed: none',
      'Sound: music on, audio running',
      'Last errors: none',
      `Saved: sap:dpr:${'farm'} 1`,
    ]);
  });

  it('has no middle dot and no field for a name, an account, a room code or a word', () => {
    const text = formatReport({ ...data, errors: ['page: TypeError: x is not a function'], failedFiles: ['/assets/BoardStage-abc.js'] });
    expect(text).not.toContain('·');
    expect(Object.keys(data).join(' ')).not.toMatch(/name|nick|account|user|room|code|word|email|id\b/i);
    expect(text).toContain('Last errors:\n  page: TypeError: x is not a function');
    expect(text).toContain('Files that failed: /assets/BoardStage-abc.js');
  });

  it('says so when a device told it nothing', () => {
    const text = formatReport({ ...data, displayHz: null, cores: null, memoryGb: null, webgl2: false, renderer: '', maxTexture: null, doorsOpenS: null, doorsGaveUp: null, longTasks: 0, scenes: [], saved: [] });
    expect(text).toContain('Browser: Chrome 142 on ChromeOS; screen 1366 x 768 at 1x; display rate not measured');
    expect(text).toContain('WebGL2: no; renderer not told');
    expect(text).toContain('Load: doors not open yet; long tasks 0');
    expect(text).toContain('Scenes: none drawn');
    expect(text).toContain('Saved: nothing');
  });

  it('cuts every address at its question mark, so a join link never carries its room code into the report', () => {
    expect(scrub('Failed to fetch https://fleeced.io/assets/x.js?join=ABCDE&v=2 (page https://fleeced.io/?join=ABCDE#top)')).toBe('Failed to fetch https://fleeced.io/assets/x.js (page https://fleeced.io/)');
    expect(scrub('a\n  b')).toBe('a b');
    expect(scrub('x'.repeat(400)).length).toBe(180);
  });

  it('names the browser and the system from the user agent', () => {
    expect(browserOf('Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36')).toBe('Chrome 142 on ChromeOS');
    expect(browserOf('Mozilla/5.0 (iPhone; CPU iPhone OS 16_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.3 Mobile/15E148 Safari/604.1')).toBe('Safari 16.3 on iOS');
    expect(browserOf('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0')).toBe('Firefox 132 on Windows');
    expect(browserOf('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0')).toBe('Edge 130 on Windows');
  });

  it('reads the middle frame rate and the slowest twentieth from the gaps between frames', () => {
    expect(frameRates([16, 16, 16])).toBeNull();
    const gaps = [...Array.from({ length: 95 }, () => 1000 / 60), ...Array.from({ length: 5 }, () => 100)];
    const rates = frameRates(gaps)!;
    expect(Math.round(rates.median)).toBe(60);
    expect(Math.round(rates.worst)).toBe(10);
  });
});

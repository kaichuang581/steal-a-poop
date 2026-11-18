// The painted fault cases, the plan's six (docs/visual-overhaul/16-qa-and-acceptance.md, section 4.1 a). Each breaks
// one thing a real device breaks and asks for the plan's end state: readable text on screen, and #root not empty (or,
// when the main script never arrives, a message from the page itself). Never a blank page.
//
// Before milestone 1 the game had no fail-soft (plan file 17, changes 2 to 5), and three of the six ended on a blank
// page or on doors shut for ever; each carried the expected-to-fail mark with what was measured on 2026-11-16.
// Milestone 1 takes each mark off as its change lands, and says so where the mark was; a marked case that passes
// fails the run until its mark is gone. The other three reached the end state already and never carried one.
//
// What a case breaks on purpose it names (`watch.fault`), so the broken request itself is not held against it. A page
// error is held against every case, marked or not.
import {
  CANVAS, FORM, HOME_MS, POST, STEP_MS,
  drawCallsAFrame, endsOnReadableText, expect, homeReady, knownToday, menuRow, postTab, test, until,
} from './helpers';

const NOT_FOUND = { status: 404, contentType: 'text/plain', body: 'Not found' };

test('no WebGL: every WebGL context is refused', async ({ page }) => {
  // No mark since milestone 1 (plan file 17, change 2): SceneBoundary catches three.js's "Error creating WebGL context"
  // and shows a card over the farm's box, and the doors open on it. Before, by 12 s #root was empty with no text.
  // The mark came off with the change, by design: this suite has not been run since (Brian, 2026-11-16: one test pass
  // at the end).
  await page.addInitScript(() => {
    window.__fault = { hits: 0 };
    for (const kind of [window.HTMLCanvasElement, window.OffscreenCanvas]) {
      if (!kind) continue;
      const own = kind.prototype.getContext as (this: unknown, ...args: unknown[]) => unknown;
      (kind.prototype as { getContext: unknown }).getContext = function (this: unknown, type: unknown, ...rest: unknown[]) {
        if (/webgl/i.test(String(type))) { window.__fault!.hits++; return null; }
        return own.call(this, type, ...rest);
      };
    }
  });
  await page.goto('./', { waitUntil: 'load' });
  const loaded = Date.now();
  // The plan's time for this one (file 17, change 2): "the card shows and #root is not empty at 12 s".
  await endsOnReadableText(page, '12 s after the page loaded with no WebGL', { at: loaded + 12_000 });
  expect(await page.evaluate(() => window.__fault?.hits ?? 0), 'times the game asked for a WebGL context and got none').toBeGreaterThan(0);
});

test('lost context on Home: lost, then given back after 4 s', async ({ page }) => {
  // No mark: this reaches the end state today. three.js keeps the lost event from ending the context and builds its
  // state again when the context comes back; measured 655 draw calls a frame before and 657 to 659 after.
  // Shot 0 is held (?pov=0) so the same scene is counted before and after.
  await page.goto('./?pov=0');
  await homeReady(page);
  const before = await drawCallsAFrame(page);
  expect(before, 'draw calls a frame on Home before the loss').toBeGreaterThan(0);
  await page.evaluate((canvas) => {
    const farm = document.querySelector<HTMLCanvasElement>(canvas)!;
    const lose = farm.getContext('webgl2')!.getExtension('WEBGL_lose_context');
    window.__fault = { hits: 0, events: [], lose };
    farm.addEventListener('webglcontextlost', () => { window.__fault!.hits++; window.__fault!.events!.push('lost'); });
    farm.addEventListener('webglcontextrestored', () => { window.__fault!.events!.push('restored'); });
    lose!.loseContext();
  }, CANVAS);
  const lostAt = Date.now();
  await until(page, 'the farm\'s canvas to say its context is lost', () => (window.__fault?.hits ?? 0) > 0, null, STEP_MS);
  // While it is lost the page is still a page: the menu can be read, #root holds the game.
  await endsOnReadableText(page, 'while the WebGL context is lost', { within: 0 });
  await page.waitForTimeout(Math.max(0, lostAt + 4000 - Date.now())); // the fault's own timing: given back 4 s after it was lost
  await page.evaluate(() => { window.__fault!.lose!.restoreContext(); });
  // The scene comes back (file 17, change 3: "draws return to the earlier count"): some canvas has a live context and
  // as many draw calls a frame as before, within a tenth. A canvas put in the old one's place counts as well.
  await expect.poll(async () => {
    const live = await page.evaluate((canvas) => [...document.querySelectorAll<HTMLCanvasElement>(canvas)].some((c) => c.getContext('webgl2')?.isContextLost() === false), CANVAS);
    if (!live) return 'no canvas has a live context';
    const now = await drawCallsAFrame(page);
    return Math.abs(now - before) <= before * 0.1 ? 'as before' : `${now} draw calls a frame, ${before} before the loss`;
  }, { timeout: HOME_MS, intervals: [500], message: 'the scene draws again as it did before the loss' }).toBe('as before');
  await endsOnReadableText(page, 'after the WebGL context came back');
});

test('a lazy piece answers 404: assets/PreviewStage-*.js', async ({ page, watch }) => {
  // No mark since milestone 1 (plan file 17, change 4): the page reloads once for the missing piece (sessionStorage
  // sap:chunk-reload), and a second failure shows a card in the closer look's frame. Before, the failed import blanked
  // the page within a second. The mark came off with the change, by design: this suite has not been run since.
  const piece = /\/assets\/PreviewStage-[^/]*\.js(\?|$)/;
  watch.fault(piece);
  await page.route(piece, (route) => route.fulfill(NOT_FOUND));
  await page.goto('./');
  await homeReady(page);
  await menuRow(page, 'Trading Post').click();
  await postTab(page, 'Barn Book').click();
  // The picture on a card opens the closer look, whose live view is the piece that is missing.
  await page.locator(`${POST} .sk-card-view`).first().click();
  await expect.poll(() => watch.faultsMet(), { timeout: STEP_MS, message: 'the closer look asked for its code' }).toBeGreaterThan(0);
  // Whatever the game does next (a card; a reload and Home again) has to end on something to read.
  await endsOnReadableText(page, 'after the closer look\'s code answered 404', { settleMs: 2000, within: HOME_MS });
});

test.describe('fonts', () => {
  test.use({ fonts: 'blocked' });

  test('font files blocked', async ({ page, watch }) => {
    // No mark: this reaches the end state today. The page falls back to the device's own fonts and Home comes up.
    await page.goto('./');
    await homeReady(page);
    await endsOnReadableText(page, 'on Home with every font file refused');
    expect(watch.faultsMet(), 'font requests that were refused').toBeGreaterThan(0);
  });
});

test('the main script answers 404: assets/index-*.js', async ({ page, watch }) => {
  // No mark since milestone 1 (plan file 17, change 5: public/boot-check.js, 543c159): the page itself shows a card
  // when its main script never runs. The mark came off in milestone 12's test pass, which found the case passing.
  const main = /\/assets\/index-[^/]*\.js(\?|$)/;
  watch.fault(main);
  await page.route(main, (route) => route.fulfill(NOT_FOUND));
  await page.goto('./', { waitUntil: 'load' });
  const loaded = Date.now();
  expect(watch.faultsMet(), 'the page asked for its main script').toBeGreaterThan(0);
  // The plan's time for this one (file 17, change 5): "the card appears within 13 s". #root has nothing to hold here.
  await endsOnReadableText(page, '13 s after the page loaded without its main script', { at: loaded + 13_000, root: false });
});

test.describe('storage', () => {
  test.use({ visitor: 'first' });

  test('localStorage throws', async ({ page }, testInfo) => {
    // No mark: this reaches the end state today. Every read and write of the game's is inside a try, so the page
    // starts as a first visit: the form comes up over Home.
    await page.addInitScript(() => {
      window.__fault = { hits: 0 };
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() { window.__fault!.hits++; throw new DOMException('The operation is insecure.', 'SecurityError'); },
      });
    });
    await page.goto('./');
    await endsOnReadableText(page, 'with localStorage refused', { within: HOME_MS });
    expect(await page.evaluate(() => window.__fault?.hits ?? 0), 'times the game reached for localStorage and was refused').toBeGreaterThan(0);

    // Past the plan's end state, and not held against the case: can this player get in? Measured on 2026-11-16: no.
    // The answers cannot be kept, so the form never goes. It is written on the case and counted by the gate.
    const form = page.locator(FORM);
    await form.getByRole('button', { name: /Play as a guest/ }).click();
    await form.getByLabel('Country').selectOption('US');
    await form.getByLabel('Age').selectOption('18');
    await form.getByRole('button', { name: 'Continue' }).click();
    const gone = await form.waitFor({ state: 'detached', timeout: 10_000 }).then(() => true, () => false);
    if (!gone) knownToday(testInfo, 'localStorage refused: answering the first-visit form does not reach Home. The answers cannot be kept, so the form stays up and the player can never play.');
  });
});

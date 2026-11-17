// The painted smoke cases, exactly the plan's six (docs/visual-overhaul/16-qa-and-acceptance.md, section 4.1 a).
// Each opens the built game as a player does and fails on a break only the painted look can have: a form nobody can
// answer, doors that stay shut, a menu row gone, a word bar that takes no keys, a screen that never draws.
// Every case also fails on what the `watch` fixture sees (helpers.ts): a page error, a failed request, an answer of
// the wrong type, a request to a stranger.
import {
  CANVAS, CLOSER_LOOK, DOORS, FORM, HOME_MS, MENU_ROWS, POST, SCREEN_MS, STEP_MS, WORD_BAR, WORD_INPUT,
  drawCalls, drawn, expect, homeReady, menuRow, postTab, test, until,
} from './helpers';

test.describe('first visit', () => {
  test.use({ visitor: 'first' });

  test('first visit: the form shows, and answering it reaches Home', async ({ page }) => {
    await page.goto('./');
    // The form is under the loading doors until Home is built; then it is what a new player sees.
    const form = page.locator(FORM);
    await expect(form, 'the first-visit form').toBeVisible({ timeout: HOME_MS });
    await form.getByRole('button', { name: /Play as a guest/ }).click();
    await form.getByLabel('Country').selectOption('US');
    await form.getByLabel('Age').selectOption('18');
    await form.getByRole('button', { name: 'Continue' }).click();
    // Answered: the form goes, and Home is there to use, its menu on top.
    await expect(form, 'the form, once answered').toHaveCount(0, { timeout: STEP_MS });
    await homeReady(page);
    await expect(page.locator('.sk-menu-item .sk-menu-label')).toHaveText(MENU_ROWS);
    await menuRow(page, 'Practice').click({ trial: true }); // nothing is in the way of the menu
    expect(await page.evaluate(() => localStorage.getItem('sap:age-check')), 'the answers are kept, so the form is asked once').not.toBeNull();
  });
});

test('Home: the doors open and every canvas has drawn', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  // The page comes with its doors shut, and the game keeps them shut while the farm is built.
  expect(await page.locator(DOORS).count(), 'loading doors while Home is being built').toBeGreaterThan(0);
  await homeReady(page);
  await expect(page.locator(DOORS)).toHaveCount(0);
  const canvases = page.locator(CANVAS);
  expect(await canvases.count(), 'three.js canvases on Home').toBeGreaterThan(0);
  expect(await page.locator(`${CANVAS}:not([data-drawn])`).count(), 'canvases that never marked themselves drawn').toBe(0);
  // The scene really asked to be drawn, and the suite really left the drawing out.
  expect(await drawCalls(page), 'WebGL draw calls counted').toBeGreaterThan(0);
  expect(await page.evaluate(() => window.__gate.drawing), 'WebGL drawing is switched off for the suite').toBe(false);
  // And it is set in the game's own faces, not a stand-in: the title's face has arrived (helpers.ts, on fonts).
  await until(page, 'the display face (Fraunces) to load', () => [...document.fonts].some((f) => /Fraunces/.test(f.family) && f.status === 'loaded'), null, STEP_MS);
});

test('Home: the menu shows the six rows of a build with no game server', async ({ page }) => {
  await page.goto('./');
  await homeReady(page);
  await expect(page.locator('.sk-menu-item .sk-menu-label')).toHaveText(MENU_ROWS);
  // Each is a button a player can press: none is left switched off once the word list is in.
  for (const label of MENU_ROWS) await expect(menuRow(page, label), `the ${label} row`).toBeEnabled();
});

test('table: Create lobby, Sit down, and the typed letters appear in the word bar', async ({ page }) => {
  await page.goto('./');
  await homeReady(page);
  // With no game server Create lobby sets a table of farm sheep on this device.
  await menuRow(page, 'Create lobby').click();
  const panel = page.locator('[role="dialog"][aria-label="Set the table"]');
  await expect(panel).toBeVisible({ timeout: STEP_MS });
  await panel.locator('.sk-sit').click();
  await drawn(page, 'the barn table', { need: WORD_BAR });
  // The word bar accepts keys: it is your turn, its input has the focus, and no doors are up to swallow them.
  await until(page, 'your turn at the table, with the word bar taking keys', ({ bar, input, doors }) => {
    const field = document.querySelector<HTMLInputElement>(input);
    return document.querySelector(bar)?.getAttribute('data-mode') === 'mine' && !!field && !field.disabled && document.activeElement === field && !document.querySelector(doors);
  }, { bar: WORD_BAR, input: WORD_INPUT, doors: DOORS }, SCREEN_MS);
  await page.keyboard.type('barn');
  await expect(page.locator('.kit-float .sk-type-tile'), 'the typed letters, floating in the word bar').toHaveText(['B', 'A', 'R', 'N']);
  await expect(page.locator(WORD_INPUT)).toHaveValue('barn');
});

test('practice: Start run begins a run on the ice', async ({ page }) => {
  await page.goto('./');
  await homeReady(page);
  await menuRow(page, 'Practice').click();
  const panel = page.locator('[role="dialog"][aria-label="Practice run"]');
  await expect(panel).toBeVisible({ timeout: STEP_MS });
  await panel.locator('.sk-sit').click();
  // The ice: its own canvas drawn, the two names face to face, the word bar under them.
  await drawn(page, 'the ice', { need: '.sk-vs' });
  await expect(page.locator('.sk-vs')).toHaveText('VS');
  await expect(page.locator(WORD_BAR)).toBeVisible();
  // The run is running: the clock gets to your turn.
  await until(page, 'your turn on the ice', (bar) => document.querySelector(bar)?.getAttribute('data-mode') === 'mine', WORD_BAR, SCREEN_MS);
});

test('Trading Post: it opens, the Barn Book opens, and one item gets a closer look', async ({ page }) => {
  await page.goto('./');
  await homeReady(page);
  await menuRow(page, 'Trading Post').click();
  const post = page.locator(POST);
  await expect(post).toBeVisible({ timeout: STEP_MS });
  await expect(post.locator('[role="tab"]')).toHaveText([/Feed Sacks/, /Bell Shelf/, /Missions/, /Barn Book/]);
  await expect(postTab(page, 'Feed Sacks')).toHaveAttribute('aria-selected', 'true');
  await postTab(page, 'Barn Book').click();
  await expect(postTab(page, 'Barn Book')).toHaveAttribute('aria-selected', 'true');
  const cards = post.locator('.sk-card');
  await expect(cards.first(), 'the Barn Book\'s first item').toBeVisible({ timeout: STEP_MS });
  // The picture on a card opens the closer look. With motion on it is a live view, whose code arrives only now.
  await post.locator('.sk-card-view').first().click();
  const closer = page.locator(CLOSER_LOOK);
  await expect(closer).toBeVisible({ timeout: STEP_MS });
  await expect(closer).toHaveAttribute('aria-label', /: a closer look$/);
  await expect(closer.locator(CANVAS), 'the closer look\'s live view').toHaveCount(1, { timeout: STEP_MS });
});

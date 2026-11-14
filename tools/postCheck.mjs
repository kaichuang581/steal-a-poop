// The Trading Post's layout check (docs/PLAN_TRADING_POST_REFINE.md Part 8, test 4): at 1920 x 1080 and 390 x 844, on
// every tab, scrolled to the end, nothing sticks out of the shop sideways, the last row is whole, and the shop is inside
// the window. Also: Left and Right change tab. Run with the dev server up:  node tools/postCheck.mjs [--base <url>]
import { chromium } from 'playwright';

const i = process.argv.indexOf('--base');
const base = i >= 0 ? process.argv[i + 1] : 'http://localhost:5173/steal-a-poop/';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader'] });
let failed = 0;
try {
  for (const [name, viewport] of [['1920 x 1080', { width: 1920, height: 1080 }], ['390 x 844', { width: 390, height: 844 }]]) {
    const page = await browser.newPage({ viewport });
    await page.goto(base);
    await page.waitForSelector('.sk-bazaar-btn', { timeout: 60000 });
    await page.waitForTimeout(4000);
    await page.locator('.sk-bazaar-btn').click();
    await page.waitForSelector('.sk-room');
    for (const tab of ['Feed Sacks', 'Bell Shelf', 'Missions', 'Barn Book']) {
      await page.getByRole('tab', { name: tab }).click();
      await page.waitForTimeout(400);
      const problems = await page.evaluate(() => {
        const out = [];
        const room = document.querySelector('.sk-room').getBoundingClientRect();
        const body = document.querySelector('.sk-room-body');
        body.scrollTo(0, body.scrollHeight);
        if (room.left < -1 || room.top < -1 || room.right > innerWidth + 1 || room.bottom > innerHeight + 1) out.push(`the shop is outside the window (${Math.round(room.width)} x ${Math.round(room.height)})`);
        const b = body.getBoundingClientRect();
        for (const el of body.querySelectorAll('.sk-room-content *')) {
          if (el.closest('.sk-shelves, svg') || getComputedStyle(el).position === 'absolute') continue;
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height) continue;
          if (r.left < b.left - 1 || r.right > b.right + 1) out.push(`${el.className || el.tagName} sticks out sideways by ${Math.round(Math.max(b.left - r.left, r.right - b.right))} px`);
        }
        const last = [...body.querySelectorAll('.sk-room-content > *')].pop();
        const gap = b.bottom - last.getBoundingClientRect().bottom;
        if (gap < 12) out.push(`the last row has ${Math.round(gap)} px under it at the end of the scroll (wants 16)`);
        return [...new Set(out)].slice(0, 8);
      });
      console.log(`${name} · ${tab}: ${problems.length ? problems.join('; ') : 'ok'}`);
      failed += problems.length;
    }
    await page.getByRole('tab', { name: 'Feed Sacks' }).click();
    await page.keyboard.press('ArrowRight');
    const moved = await page.getByRole('tab', { name: 'Bell Shelf' }).getAttribute('aria-selected');
    await page.keyboard.press('ArrowLeft');
    const back = await page.getByRole('tab', { name: 'Feed Sacks' }).getAttribute('aria-selected');
    console.log(`${name} · arrow keys: ${moved === 'true' && back === 'true' ? 'ok' : 'Left and Right do not change tab'}`);
    if (moved !== 'true' || back !== 'true') failed++;
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(failed ? `${failed} problem(s).` : 'Nothing is clipped.');
process.exit(failed ? 1 : 0);

# TASKS FOR FREEBUFF (half 1 of 2)

Claude's half is in `CLAUDE_TASKS.md`. Do not do anything listed there.

## Rules (read first)
- Work on a branch called `freebuff/<task>`. Never push to `main`: every push to `main` deploys the live site. Open a pull request.
- Read `CLAUDE.md` and follow it. In short: new UI code goes under `src/skin/` only; never edit existing tests, `src/engine`, `server/`, or the database files; no new dependencies.
- Never put secrets, keys or emails in code or messages.
- Words that must not appear anywhere: any film, studio or director name (the style is "painted" or "storybook").
- Before each pull request run `npx tsc --noEmit`, `npx vitest run` and `npm run build`. All three must pass (see task 1 for one known flaky test). Say plainly in the pull request if anything failed.

## Tasks, in order
1. **Fix the flaky timing test.** `src/skin/scene/__tests__/barn.test.ts`, "returns geometries within the triangle budget, quickly", fails about half the time with a time just above 1500 ms. Raise the time limit (for example to 4000 ms) and leave the triangle budget check alone. This is the one allowed edit to an existing test; touch nothing else in that file.
2. **Write `docs/CHARACTERS.md`** listing the 15 avatars from `src/skin/avatars/catalog.ts`: animal, name, blurb, pack name and items, skill. Generate it from the catalog; do not invent anything.
3. **Update README and CHANGELOG** for these shipped changes: avatar picker (own player card only), pixel icons replacing emoji and text buttons, "Start now" button, steal jolt and red flash, share card image, best-steal line, barn swoop when a game starts. State plainly that other players cannot see your avatar yet.
4. **Add tests under `src/skin/`** (new files only):
   - `src/skin/avatars/__tests__/store.test.ts`: `setAvatar`, `getAvatar` and `useAvatar` save to and read from local storage, ignore unknown ids, and survive storage being blocked.
   - `src/skin/components/__tests__/pixelicons.test.tsx`: `Px` renders for every icon key in its map, and renders nothing for an unknown key.
5. **Avatar picker accessibility** (`src/skin/avatars/AvatarPicker.tsx` only): Esc closes it, focus moves into it when it opens and returns to the Avatar button when it closes, Tab stays inside it. Add a test under `src/skin/avatars/__tests__/`.
6. **Pixel icon polish** (`src/skin/components/PixelIcons.tsx` only): look at each icon at 16, 20 and 32 px and redraw any that is hard to recognise. Keep one colour (they inherit text colour) and keep `Px` and the exports' names unchanged.

## Done when
Each task is its own commit on its branch with a clear message, and the pull request lists what you ran and what the results were.

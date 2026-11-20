# M1: light

Home by day and at dawn, on every tour shot but the paddock's. Dusk, night, the barn table and every other scene are
as they were. Code: `DAYLIGHT`, `shotLight`, `farEdge`, `FARM_RECT` in `src/skin/table/Rendering.tsx`; `Drift` in
`FarmBackdrop.tsx` sets a shot's light in the dark dip; `?light=today` and `?light=mini` on a development server.

## The five changes, as built

| Change | The plan | Built |
|---|---|---|
| A. Haze fitted to each shot | `0.5 / farEdge`, clamped 0.004 to 0.014 | As the plan, from today's cameras (table below) |
| B. A higher sun | 45° up by day, 30° at dawn, 40° round | As the plan |
| C. Exposure and tone mapping | Neutral; exposure 2.2 (dawn 2.0); bloom divided by exposure | Neutral. **Exposure stays 1**; the sun is 2.4 by day (2.05 at dawn) and the sky fill 1.4 (1.2). See "Deviation" |
| D. Shadows that reach the whole view | Box centred on the shot's target, half-size `clamp(0.75 d + 6, 20, 44)` (30 on Low), bias scaled | As the plan |
| E. Softer shadow edges | Radius 2, never above 2.5 | The tree already draws radius 2.5 (v0.8.2). Kept: the edge on shot 5 is smooth when enlarged |

| Shot | `farEdge` | Haze | Shadow half-size |
|---|---|---|---|
| Computer 0 | 66 m | 0.0076 | 23 m |
| Computer 1 | 88 m | 0.0057 | 43 m |
| Computer 2 (paddock) | not used | 0.0120, as today | 20 m, as today |
| Computer 3 | 62 m | 0.0080 | 20 m |
| Computer 4 | 42 m | 0.0118 | 20 m |
| Computer 5 | 62 m | 0.0081 | 26 m |
| Computer 6 | 40 m | 0.0123 | 20 m |
| Computer 7 | 79 m | 0.0063 | 28 m |
| Phone 0 | 47 m | 0.0107 | 20 m |
| Phone 1 | 101 m | 0.0050 | 42 m |
| Phone 2 (paddock) | not used | 0.0120, as today | 20 m, as today |
| Phone 3 | 50 m | 0.0100 | 20 m |
| Phone 4 | 36 m | 0.0139 | 20 m |
| Phone 5 | 39 m | 0.0129 | 20 m |

## Deviation: the brightness comes from the sun and the fill, not from exposure

The plan measured v0.8.0: sun 20° up at 1.85, fill 0.58, ACES, and argued for exposure because a stronger sun would
push snow over the bloom's threshold. The tree is v0.8.3, whose day light v0.8.2 had already changed (`DIORAMA`: sun
42° up at 1.45, fill 1.1) and whose material keeps every lit cube under the bloom's threshold (`SHOULDER` in
`voxel/material.ts`). On this tree, exposure 1.9 to 2.2 turned the sky, the haze, the lanterns, the season's bulbs and
the lit windows white (exposure multiplies what the sun does not light), and the ground did not bloom at exposure 1
with a stronger sun. So exposure stays 1 on every canvas, `lightBounds.test.ts` is untouched, and the sun and fill
were set by the plan's own targets. This was measured on this same tree on 2026-11-19. It breaks the plan's sentence
"no other light value may be tuned"; the targets it serves are met:

| Sample (shot 1, day, High, 1280 x 800) | Target | Before | After |
|---|---|---|---|
| Open snow in full sun | brightest 236 to 248, never 255 | 226 | 240 |
| The same snow in a pine's shadow | brightest 185 to 212, blue not under red | | 195 to 212, blue equal to or over red |
| Far edge of the farm | hazed, fence posts readable | | yes (pairs/pov1-day.jpg) |
| Mountains | paler than the forest, no hard black shapes | | yes |
| A shadow's edge on shot 5 | smooth when enlarged | | yes |
| Text over the picture, shots 0, 1, 5 | as easy to read as before | | the same scrims; the picture behind the menu is no brighter than the snow already was |

The barn's red and the pines' green are M2's targets.

## The wendigo

- `npx vite-node tools/scenes/check.ts -- --only wendigo`: PASS, as pinned.
- The paddock shot before and after: the same picture, byte for byte (`before/pov2-day.jpg`, `review/tour/pov2-day.jpg`).
- Magenta pixels with `?wendigoDebug`, before and after: computer shot 1, 0 and 0; computer shot 7, 0 and 0; phone shot
  5, 0 and 0. Decision 5 does not arise.

## Numbers (High, 1280 x 720)

Triangles and draw calls are what they were on every shot measured (shot 0: 1,432,386 and 239; shot 1: 2,206,282 and
454; shot 7: 2,144,078 and 439). Buffers rise by 3.6 MB on shot 1 and 1.5 MB on shot 7: the larger shadow box draws
more of the farm into the shadow map. The plan allows 4 MB.

## Checks

`npx tsc -b` clean; `npm test` 1,836 passed; `npm run size` passes with 4.62 kB to spare.

## Pairs (before on the left)

`pairs/pov0-day.jpg`, `pov1-day.jpg`, `pov5-day.jpg`, `pov7-day.jpg`, `pov0-dawn.jpg`, `pov1-dawn.jpg`,
`pov0-day-phone.jpg`, `pov1-day-phone.jpg`. For Brian: decision 1 (the new day light).

# Landing page and entry flow (plan, not built)

Status: **draft.** Nothing in this document is implemented yet. Open questions are at the end.

## What you asked for
1. A separate landing page that is the first thing a person sees when they sign up or log in.
2. If a login is already saved in the browser, the player goes straight to the landing page.
3. The landing page looks attractive and inviting, and includes a short sample game (one round) that people can play before they log in.
4. From the landing page, players choose how to get in:
   - Google account
   - Email and password
   - Guest (no account, a username saved in this browser)
5. Logging out takes the player back to the landing page.

## Proposed design
**Where it lives:** the painted skin only (`src/skin/`). The classic look keeps its current start screen. The switch point is `src/skin/PaintedApp.tsx`, which already decides which screen to show.

**Routing rule:** the landing page shows when there is no active game, room or other screen open, and the player is either signed out or has a saved login. Signing out clears the saved login and returns to the landing page. Guests count as signed in, so they also reach the landing page on return; choosing "Start" goes to the main menu.

**Landing page contents**
- Title block and a short line: what the game is and who it is for.
- The sample game: one round, played in the same barn scene, against two bots, with the same word rules. It is a scripted tutorial-style round (the existing `tour` mode is the starting point), so no account, server or saved data is involved. It never affects any stats.
- Three entry buttons: **Continue with Google**, **Sign in or sign up with email**, **Play as a guest**. Each leads to the existing account dialog, pre-set to the right option.
- Small print: links to privacy policy, terms and child safety, opening as popups (already built).

**Behaviour**
- Sample round ends → a clear "that was one round, here is how to keep playing" panel with the three buttons.
- Signed-in player returning: landing page first, with a "Continue as <name>" button that goes to the menu.
- Reduced motion: no camera or scene movement; still shows the sample round as a static first frame.

## Work breakdown (each step: build, tests, push)
1. **Routing and state:** a single "entry" flag that decides landing or menu, with logout hooked to it. Tests for signed-out, signed-in, guest and after-logout.
2. **Landing page shell:** layout, copy, buttons wired to the existing account dialog. Phone and desktop checks.
3. **Sample round:** reuse the tour mode with one scripted round and a clear end state. Test that it never writes stats.
4. **Polish:** motion, sounds, accessibility audit (existing axe checks), and the classic look left alone.

## Needs a decision before building
1. **Every visit or only the first?** You said saved logins go straight to the landing page, so the plan does that every visit. Returning players then need one extra click. Confirm this is what you want.
2. **Brian's approval.** The landing page is a new screen and changes how people enter the game. Under `CLAUDE.md` that is a design change for Brian to approve before it ships.
3. **Email sign-up without confirmation.** This still needs the Supabase setting turned off (see `docs/AUTH_SETUP.md`).
4. **Google button.** It only works once Google sign-in is set up in Supabase. Until then the button should be hidden, not shown broken.
5. **Sample round content.** Should it use the tutorial's fixed script, or a random word set each time? A fixed script is easier to make perfect; random is less repetitive.

## Risks
- Forcing a landing page on every return visit adds friction for people who play often.
- The sample round must load fast on phones. The barn scene is heavy, so the sample should start after the landing page is painted.
- Guests have no account, so anything they "save" is lost if they clear the browser. The landing page should say so plainly.

## Done when
- A new visitor sees the landing page, can play the sample round, and can enter by Google, email or guest.
- A returning signed-in player sees the landing page first and can continue in one click.
- Logging out returns to the landing page.
- Build, unit tests and the browser tests pass, and the classic look is unchanged.

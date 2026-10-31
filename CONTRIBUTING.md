# Contributing

Two people work on this repo, Kai and Brian. These rules keep the live site working.

1. **Every change goes through a pull request.** Do not push straight to `main`: each push to `main`
   deploys the live game within about two minutes.
2. **The Deploy workflow must pass before merge.** It runs `npm test` and `npm run build`.
3. **Kai and Brian review each other's pull requests.**
4. **Fetch before you start** (`git fetch origin main`) and rebase if `main` moved.
5. **Run `npm test` and `npm run build` locally** before opening the pull request.
6. **Keep the engine pure.** `src/engine/` has no React or browser imports, so a server can run it.
7. **Changelog and version.** Add a line to `CHANGELOG.md` and bump the version in `package.json` for
   every user-visible change.

## Branch protection (GitHub settings, done once by the repo owner)

1. Repo, **Settings**, **Branches**, **Add branch ruleset** (or **Add classic branch protection rule**).
2. Target the `main` branch.
3. Turn on **Require a pull request before merging** and **Require approvals** (1).
4. Turn on **Require status checks to pass** and add the **build** check from the Deploy workflow.
5. Turn on **Do not allow bypassing the above settings**, then save.

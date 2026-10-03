# Publish to GitHub, part 1 of 2 — in the dev container

Get the repository ready to publish at `https://cinash.github.io/piano-tutor/`. Branch
`github-ready`, created off `main` **only after** the owner confirms that the history rewrite
removing a personal detail has landed. Otherwise the merge brings the old history back. `CLAUDE.md` applies,
including the two-reviewer pass. Part 2 (`6-publish-to-github.md`) runs on the host afterwards.

## The owner's decisions

- **MIT for the code only**, copyright `cinash`, with no full name or email anywhere.
- **Pages copy is a showcase**: deploy on every green push to `main`.
- **Dependabot alerts only**, no PRs. A PR merged on GitHub would move GitHub's `main` ahead of
  the local one, and the owner only merges locally.

## What to build

1. **`LICENSE`**: the standard MIT text, then a paragraph on the music files that is true for
   each one (re-check with `grep -L '<rights>'` over the tracked `*.musicxml`):
   - Beyer Nos. 8-31 are not MIT; their terms are in their `<rights>`.
   - `cicha-noc.musicxml` is the owner's arrangement, and no licence is granted for it, nor for
     `src/score/fixtures/cicha-noc.snapshot.json`, which holds the same notes.
   - The PDMX files (`scripts/beyer/fixtures/*`, `beyer_op101_no38.musicxml`) are CC0.
   - The rest of `src/score/fixtures/` is MIT.

   README gets a "Licence" section that says the same. Add `"license": "MIT"` to
   `package.json`, then run `npm install --package-lock-only`; the lockfile diff should be that
   one line.

2. **`base: './'` in `vite.config.ts`**, so one build works at `/` (k3s, preview) and at
   `/piano-tutor/` (Pages). This was tried while planning, and works in both. Add an assertion
   to `e2e/content-security-policy.spec.ts` that the script `src` starts with `./assets/`.
3. **`.github/workflows/ci.yml`**:
   - **`ci` job**, on every push and pull request: `npm run ci`. On failure, upload
     `test-results/` and `playwright-report/`. On a push to `main`, upload `dist/` with
     `actions/upload-pages-artifact`. That is the build the CSP spec tested.
   - **`deploy` job**: needs `ci`, runs on a push to `main` only, declares
     `environment: github-pages`, and does nothing but `actions/deploy-pages`.
   - **Locked down:**
     - `permissions: contents: read` at the top, and only `deploy` gets `pages: write` and
       `id-token: write`;
     - every action pinned to a full commit SHA, `actions/*` only;
     - `persist-credentials: false`;
     - never `pull_request_target`, and no secrets.
   - A workflow-level `concurrency` group on `github.ref` with `cancel-in-progress: false`.
     Note in a comment that cancelled runs are expected.
4. **Lockstep**: extend `scripts/check-version-lockstep.mjs` so the Node image tag and digest
   must agree across `.devcontainer/Dockerfile:6`, the root `Dockerfile:3` and the workflow.
   Fix the script's header and README's "Version pinning" (`:121-135`) to match.
5. **README "Published copy"**: where the app is; that `main` deploys on green CI; that every
   commit on `main` becomes public, so new music goes in only if its terms allow publishing (Beyer
   8-31 were published by the owner's choice); and
   the owner's push routine from the host:
   - `git log origin/main..main` to see what is going out;
   - `gh auth login --hostname github.com --git-protocol https --web --scopes workflow`,
     answering **No** to "Authenticate Git";
   - `git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push origin main`;
   - `gh auth logout --hostname github.com`;
   - never `gh auth setup-git`: VS Code relays the host's git credentials into the container.
6. **One `DECISIONS.md` entry** covering the above and part 2's choices: a branch rule with no
   PR requirement, GitHub-owned actions only, approval for fork workflows, and logging out after
   every push.

## Traps

- **Screenshots.** The `*-chromium-linux.png` baselines were rendered in Debian bookworm. Run
  `ci` in `container: node:24.20.0-bookworm@sha256:be23f54a88d34e8824c741b19b91064094f92c1c97b194144bfc8b50d67258e2`
  (the dev container's base) with `npx playwright install --with-deps chromium`. Its Python
  3.11 covers `test:beyer`. Never regenerate the snapshots to make CI pass; report the diff.
- **`CI` is set on the runner**, which means retries and one worker. That is intended.

## Done when

- `npm run ci` passes.
- Removing `base: './'` fails the new assertion.
- Editing the workflow's image digest fails the lockstep check.
- A one-off check shows every `uses:` ends in a 40-character SHA, with no `pull_request_target`
  and no `contents: write`.
- `dist/`, copied under a `piano-tutor/` folder and served, loads at `/piano-tutor/` with no
  console errors.
- The report says the workflow's first real run is part 2's check, and that the Antigravity
  checksum is still open.

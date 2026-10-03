# Piece 5 — make the repository ready for GitHub: licence, CI, Pages deploy

The first of two pieces that publish this repository on GitHub. This one runs **in the dev
container** and is code: a `LICENSE`, one workflow file under `.github/workflows/`, and the
README and `DECISIONS.md` lines that describe them. It adds no dependency. Branch
`github-ready`, off `main`. `CLAUDE.md` is the working agreement and is loaded automatically;
follow it, including the two-reviewer pass. Piece 6 (`6-publish-to-github.md`) runs on the host
afterwards and does the GitHub side; nothing here touches GitHub.

## Why this exists

The owner wants the app public at `https://cinash.github.io/piano-tutor/`, from a public
`cinash/piano-tutor` repository, and wants it done with proper security. The security review
that preceded this found nothing exploitable in the app. It is static, it makes no network
requests, and the built page already carries a Content-Security-Policy (`vite.config.ts`). What
is left for this piece is that the code ships under a licence, that every push is checked by the
same gate the container runs, and that a deploy can only come from a green `main`.

## Decisions already taken by the owner

- **MIT licence.** The copyright line is `Copyright (c) 2026 cinash`. The owner's GitHub handle
  matches the noreply commit identity; the history was rewritten to remove a personal email
  address, so do not put a full name or an email in `LICENSE`, `package.json` or anywhere else.
  Add `"license": "MIT"` to `package.json`, and leave `"private": true` alone: it stops an
  accidental `npm publish` and has nothing to do with the GitHub repository being public.
- **Served at `cinash.github.io/piano-tutor`**, not a custom domain.
- **Only `main` is pushed** (piece 6). The workflow has no reason to know about other branches.

## What to build

One workflow, `.github/workflows/ci.yml`, with two jobs.

**`ci`** runs on every push to `main` and every pull request, and runs `npm run ci`, the whole
gate, not a subset. `CLAUDE.md` says anything a CI service would run belongs in `npm run ci`, so
the workflow adds nothing to it and leaves nothing out.

**`deploy`** needs `ci`, runs only on a push to `main`, and builds with
`npx vite build --base=/piano-tutor/`, then publishes `dist/` with GitHub's own Pages actions
(`configure-pages`, `upload-pages-artifact`, `deploy-pages`) to the `github-pages` environment.
Give it a `concurrency` group so two pushes cannot deploy out of order. It runs in the same
`container:` image as `ci` (see the traps), so the workflow names Node in exactly one place.

How it is locked down, because this is the part that is the security:

- **Least privilege.** Set `permissions: contents: read` at the top of the file. Only `deploy`
  is raised, to `pages: write` and `id-token: write`. No job gets `contents: write`.
- **Every action pinned to a full commit SHA**, with its version in a trailing comment. This is
  the repository's exact-versions rule applied to Actions. A tag can be moved to malicious code
  after the fact; a SHA cannot. Only `actions/*` are used, all GitHub's own, and piece 6 sets the
  repository to allow nothing else.
- **`persist-credentials: false`** on every `actions/checkout`. Nothing after checkout pushes, so
  the token has no reason to stay in `.git/config`.
- **Never `pull_request_target`**, and no secrets anywhere. A fork's pull request then runs with
  a read-only token and cannot reach the deploy.

## The traps

- **The screenshots will not match on a stock runner.** `e2e/falling-notes.spec.ts` and
  `e2e/note-names.spec.ts` compare against `*-chromium-linux.png` files rendered in the dev
  container, which is Debian bookworm with Chromium's dependencies installed by
  `playwright install --with-deps`. `ubuntu-24.04` has other fonts and will fail them. Run the
  `ci` job in a `container:` of the dev container's own base,
  `node:24.20.0-bookworm@sha256:be23f54a88d34e8824c741b19b91064094f92c1c97b194144bfc8b50d67258e2`
  (`.devcontainer/Dockerfile:6`). Then run `npx playwright install --with-deps chromium` there,
  as the Dockerfile does. That image already carries Python 3.11, which is all
  `npm run test:beyer` needs: the Beyer scripts import only the standard library. Do not
  regenerate the snapshots to make a runner pass. If they still differ inside the matching image,
  stop and report the diff.
- **`base` goes on the command line, not into `vite.config.ts`.** A `base` in the config would
  move the dev server off `/`, which breaks every `page.goto('/')` in `e2e/` and the
  `http://localhost:5173` URL in `CLAUDE.md`. It would also break the k3s deployment
  (`README.md`, "Deploying to k3s"), which serves `dist/` at its root.
- **The base path also has to work at runtime, not only in the HTML.** Check that nothing in
  `src/` builds an absolute URL from `/`. The CSP's `'self'` is an origin, so it is not affected
  by the base path.
- **`playwright.config.ts` behaves differently under `CI`**: retries 2, one worker, and
  `forbidOnly`. That is intended. Do not unset `CI`.

## Out of scope

- **Anything on GitHub itself.** Creating the repository, settings, Pages, branch rules and the
  push are all piece 6, because the container has no GitHub credentials by design
  (`.devcontainer/scripts/github-identity.sh`).
- **`.github/dependabot.yml` version updates.** Piece 6 turns on Dependabot alerts and security
  updates, which are enough. Version-update PRs would bump Playwright in `package.json` without
  `.devcontainer/Dockerfile`. `scripts/check-version-lockstep.mjs` would then fail every one of
  them, which is noise and not protection.
- **A `SECURITY.md`.** Piece 6 enables GitHub's private vulnerability reporting, which gives
  reporters the same route without a file to keep current.
- **The Antigravity CLI checksum** in `.devcontainer/Dockerfile:87`. It is still open from the
  security review, it is unrelated to publishing, and it needs the owner to supply the hashes.

## What this makes harder later

- **A custom domain later** means dropping `--base=/piano-tutor/` from the workflow. That is one
  line. Visitors' saved practice history would not carry over, because `localStorage` belongs to
  an origin, so a new domain starts empty. Export and import (`Download progress`) is the way
  across.
- **The CI job is tied to the dev container's base digest.** A Node bump must change it in three
  places: `.devcontainer/Dockerfile`, the root `Dockerfile` and the workflow. Extend
  `scripts/check-version-lockstep.mjs` to compare the workflow's `node:` image with
  `.devcontainer/Dockerfile`, so drift fails the gate the way a Playwright drift already does.
  This is in scope.

## Decisions to record in `DECISIONS.md`

One entry: the app is published on GitHub Pages at a base path given only to the deploy build;
CI runs the whole of `npm run ci` inside the dev container's base image, for the screenshots;
Actions are pinned by SHA with least-privilege tokens. Name what was rejected: a `base` in
`vite.config.ts`, a stock `ubuntu` runner, and Dependabot version updates, each for the reason
above.

`README.md` gets a short "Published copy" section: where the app is, that a push to `main`
deploys it once CI passes, and that Web MIDI works there because it is HTTPS.

## The gate

- `npm run ci` passes in the container, and the extended lockstep check fails when the workflow's
  `node:` digest is edited to disagree. Show that, then put it back.
- `npx vite build --base=/piano-tutor/` emits `dist/index.html` whose script and stylesheet both
  start `/piano-tutor/assets/`. Show the two lines. Then rebuild with plain `npm run build` so
  `dist/` is not left carrying the base.
- The workflow is valid YAML that names only SHA-pinned `actions/*`. Nothing in the container can
  run it, so say plainly that its first real run is piece 6's check, not this one's.

## Manual

Nothing to run in this piece, but add the item piece 6 will hand the owner to `MANUAL-CHECKS.md`:
the published copy at `https://cinash.github.io/piano-tutor/`, opened in Chrome on the host with
the P-145 connected. The MIDI prompt is granted, the piano is picked, and the opening of Cicha Noc
lights the keys and moves the cursor. That checks Web MIDI over a public HTTPS origin under the
CSP. Keep the file's ten-item budget in mind: if it is full, say which item this one replaces.

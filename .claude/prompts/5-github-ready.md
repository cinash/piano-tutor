# Piece 5 — make the repository ready for GitHub: licence, CI, Pages deploy

The first of two pieces that publish this repository on GitHub. This one runs **in the dev
container** and is code. It adds a `LICENSE`, `.github/workflows/ci.yml`, a relative `base` in
`vite.config.ts`, and an extension to `scripts/check-version-lockstep.mjs`, plus the README,
`DECISIONS.md` and `MANUAL-CHECKS.md` lines that describe them. It adds no dependency. Branch
`github-ready`, off `main`. `CLAUDE.md` is the working agreement and is loaded automatically;
follow it, including the two-reviewer pass. Piece 6 (`6-publish-to-github.md`) runs on the host
afterwards and does the GitHub side; nothing here touches GitHub.

## Why this exists

The owner wants the app public at `https://cinash.github.io/piano-tutor/`, from a public
`cinash/piano-tutor` repository, and wants it done with proper security. The security review
that preceded this found nothing exploitable. The app is static, it makes no network requests,
and the built page already carries a Content-Security-Policy (`vite.config.ts`, checked by
`e2e/content-security-policy.spec.ts`). Three things are left for this piece. The code has to
ship under a licence that does not over-claim. Every push has to be checked by the same gate the
container runs. And a deploy can only come from a green `main`.

## Decisions already taken by the owner

- **MIT for the code, and only the code.** The music files keep the terms stated in each file's
  own `<rights>` element. Beyer Nos. 8-31 derive from Nathanael Meister's engraving: "Educational
  copying welcome", no open licence (`scripts/beyer/lilypond_import.py:23-30`). `cicha-noc.musicxml`
  is the owner's own arrangement. `LICENSE` holds the standard MIT text with the copyright line
  `Copyright (c) 2026 cinash`, followed by a separate closing paragraph. That paragraph says the
  licence covers the source code and not the `*.musicxml` files, whose terms are in their
  `<rights>` element. README gets a short "Licence" section saying the same.
- **No personal details.** Use the handle `cinash`, never a full name or an email, in `LICENSE`,
  `package.json` or anywhere else. The history was rewritten to remove a personal address.
- **Add `"license": "MIT"` to `package.json`**, then run `npm install --package-lock-only` so the
  lockfile's root entry records it now, not as a stray line in some later change. Leave
  `"private": true` alone: it prevents an accidental `npm publish` and has nothing to do with
  the GitHub repository being public.
- **Deploy on every green push to `main`.** Asked whether the Pages copy is one the player will
  practise on, the owner said no: it is a showcase. Practice stays on localhost and the tailnet
  copy. So publishing is automatic, and a stored-format change (see the `AttemptRecord` entry in
  `DECISIONS.md`) costs the Pages copy's history nothing the owner relies on.
- **Served at `cinash.github.io/piano-tutor`**, not a custom domain. **Only `main` is pushed.**

## What to build

**`base: './'` in `vite.config.ts`.** With a relative base, one build works at the root (k3s,
`vite preview`, the `built` Playwright project) and at `/piano-tutor/` (Pages). The Pages deploy
is then the exact build that `e2e/content-security-policy.spec.ts` already tests. This was
tried while planning: a `--base=./` build served under `/piano-tutor/`, and the dev server
started with `--base=./` at `/`. In both, the staff, the cursor and a played note worked, with no
console errors. Rejected: an absolute `--base=/piano-tutor/` given only to the deploy build. It
would ship a build nothing tests, and an absolute base in the config would move the dev server
off `/`.

**`.github/workflows/ci.yml`**, with two jobs:

- **`ci`** runs on every push to `main` and every pull request, and runs `npm run ci`, the whole
  gate, not a subset. `CLAUDE.md` says anything a CI service would run belongs in it, so the
  workflow adds nothing and leaves nothing out. On failure, it uploads `test-results/` and
  `playwright-report/` with `actions/upload-artifact` (`if: failure()`). Without that, a
  screenshot mismatch on the runner leaves nothing to look at but a pixel count.
- **`deploy`** needs `ci` and runs only on a push to `main`. It runs `npm run build`, then
  publishes `dist/` with GitHub's own Pages actions (`configure-pages`, `upload-pages-artifact`,
  `deploy-pages`) to the `github-pages` environment.

Put a **workflow-level** `concurrency` group keyed on `github.ref`, with
`cancel-in-progress: false`. Whole runs then queue in order, so a slow run's deploy can never land
after a newer one. A group on the `deploy` job alone would not prevent that.

How it is locked down, because this is the part that is the security:

- **Least privilege.** Set `permissions: contents: read` at the top of the file. Only `deploy`
  is raised, to `pages: write` and `id-token: write`. No job gets `contents: write`.
- **Every action pinned to a full commit SHA**, with its version in a trailing comment. This is
  the repository's exact-versions rule applied to Actions. A tag can be moved to malicious code
  after the fact; a SHA cannot. Only `actions/*` are used, and piece 6 sets the repository to
  allow nothing else.
- **`persist-credentials: false`** on every `actions/checkout`. Nothing after checkout pushes.
- **Never `pull_request_target`**, and no secrets anywhere. A fork's pull request then runs with
  a read-only token and cannot reach the deploy.

## The traps

- **The screenshots will not match on a stock runner.** `e2e/falling-notes.spec.ts` and
  `e2e/note-names.spec.ts` compare against `*-chromium-linux.png` files rendered in the dev
  container: Debian bookworm, with Chromium's dependencies from `playwright install --with-deps`.
  `ubuntu-24.04` has other fonts. Run both jobs in a `container:` of the dev container's own
  base, `node:24.20.0-bookworm@sha256:be23f54a88d34e8824c741b19b91064094f92c1c97b194144bfc8b50d67258e2`
  (`.devcontainer/Dockerfile:6`). There, run `npx playwright install --with-deps chromium`, as
  the Dockerfile does. The image already has Python 3.11, which is all `npm run test:beyer` needs,
  since the Beyer scripts import only the standard library. Do not regenerate the snapshots to
  make a runner pass. If they still differ inside the matching image, stop and report the diff.
- **`container.image` cannot read `env`.** Only the `github`, `needs`, `strategy`, `matrix`,
  `vars` and `inputs` contexts are available there. Write the image once as a YAML anchor and
  reuse it with an alias in the second job. A workflow-level `env` variable would silently not
  work, and nothing in the container can show that.
- **`playwright.config.ts` behaves differently under `CI`**: retries 2, one worker, `forbidOnly`,
  and an HTML report. That is intended. Do not unset `CI`.

## The lockstep check grows to cover the Node image

A Node bump now touches four places: `.devcontainer/Dockerfile:6`, the root `Dockerfile:3`
(written as `docker.io/library/node:…`, for podman), and the workflow's anchor. Extend
`scripts/check-version-lockstep.mjs` to compare the image reference, tag and digest, across all
three files, ignoring the `docker.io/library/` prefix, so a drift fails the gate the way a
Playwright drift does. Its header comment and README's "Version pinning" section, which says
"Two versions have to be written in more than one place", both change to say three. Whether
`CLAUDE.md`'s house rule on version bumps gains a Node line is not this piece's call: a change to
`CLAUDE.md` goes through the plan gate. Name it in the report as a follow-up.

## Out of scope

- **Anything on GitHub itself.** That is piece 6. The container has no GitHub credentials by
  design (`.devcontainer/scripts/github-identity.sh`).
- **`.github/dependabot.yml` version updates**, for npm or for `github-actions`. Piece 6 turns on
  Dependabot alerts and security updates. Scheduled version PRs would arrive on GitHub, but the
  owner merges locally and pushes, so they would sit there unmerged. A Playwright bump would also
  fail the lockstep check every time. The SHA pins move when someone bumps them by hand, with the
  release notes read.
- **A `SECURITY.md`.** Piece 6 enables GitHub's private vulnerability reporting, which gives
  reporters the same route without a file to keep current.
- **The Antigravity CLI checksum** in `.devcontainer/Dockerfile:87`. It is still open from the
  security review, unrelated to publishing, and needs the owner to supply the hashes.

## What this makes harder later

- **A custom domain later** needs no code change, thanks to the relative base. Visitors' saved
  history would not carry over, because `localStorage` belongs to an origin. Export and import
  are the way across.
- **A client-side router** with nested paths would not work under `base: './'`. The app has none,
  and adding one is when to revisit this.
- **The `cinash.github.io` origin is shared** by every Pages site the owner ever publishes. That
  includes the CSP's `'self'` and `localStorage`, whose `piano-tutor.*` keys are namespaced. The
  risk is low while the owner controls every site there. Record it.

## Decisions to record in `DECISIONS.md`

One entry covering:

- the app is published on GitHub Pages from a relative base, deploying on every green push
  because that copy is a showcase and not where practice happens;
- CI runs the whole of `npm run ci` inside the dev container's base image, for the screenshots;
- Actions are pinned by SHA with least-privilege tokens;
- the shared origin;
- the MIT licence's scope.

Name what was rejected: an absolute base given only to the deploy build, a stock `ubuntu` runner,
and Dependabot version updates, each for the reason above.

README gets a "Published copy" section. It says where the app is, and that a push to `main`
deploys it once CI passes. It also says **who pushes**: agents in the container cannot, by design,
so the owner pushes from the host after merging, logging in to `gh` for that push and out again
after (piece 6 sets that up). Without that line, the next reader will expect `main` on GitHub to
keep up on its own.

## The gate

- **`npm run ci` passes in the container.** It also covers the YAML: `format:check` parses
  `.github/workflows/ci.yml`, because `.prettierignore` does not exclude `.github/`.
- **The extended lockstep check fails when the workflow's image digest is edited to disagree,
  and again when the workflow is removed.** Show both, then put it back. This is the named check
  that would fail without the feature.
- **`dist/index.html` from `npm run build` names `./assets/` for both script and stylesheet.**
  Show the built app working under a sub-path: copy `dist/` into a `piano-tutor/` folder, serve
  its parent (for example with `python3 -m http.server`), and open `/piano-tutor/` in Playwright,
  with the staff drawn and no console errors. This is a one-off check, not a new spec.
- **The workflow cannot run in the container.** Say plainly that its first real run is piece 6's
  check, not this one's.

## Manual

Extend `MANUAL-CHECKS.md` item 10, the round trip with the tailnet copy, rather than adding an
item: the file is already over its ten-item budget, and which check to drop is not this piece's
call. The extension says the same round trip applies to `https://cinash.github.io/piano-tutor/`,
whose history starts empty because it is a new origin. It also says that the P-145 should connect
there in Chrome on the host, with the opening of Cicha Noc lighting the keys and moving the
cursor. That is Web MIDI under the CSP at the github.io origin, which no spec can show.

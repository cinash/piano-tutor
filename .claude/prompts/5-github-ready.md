# Piece 5 — make the repository ready for GitHub: licence, CI, Pages deploy

The first of two pieces that publish this repository on GitHub. This one runs **in the dev
container** and is code. It adds:

- a `LICENSE`;
- `.github/workflows/ci.yml`;
- a relative `base` in `vite.config.ts`, guarded by one assertion in the CSP spec;
- an extension to `scripts/check-version-lockstep.mjs`;
- the README and `DECISIONS.md` text that describes them.

It adds no dependency. Branch `github-ready`, off `main`. `CLAUDE.md` is the working agreement
and is loaded automatically; follow it, including the two-reviewer pass. Piece 6
(`6-publish-to-github.md`) runs on the host afterwards and does the GitHub side; nothing here
touches GitHub.

## Why this exists

The owner wants the app public at `https://cinash.github.io/piano-tutor/`, from a public
`cinash/piano-tutor` repository, and wants it done with proper security. The security review
that preceded this found nothing exploitable. The app is static, it makes no network requests,
and the built page already carries a Content-Security-Policy (`vite.config.ts`, checked by
`e2e/content-security-policy.spec.ts`). Three things are left for this piece:

- the code ships under a licence that does not claim more than it should;
- every push is checked by the same gate the container runs;
- what is deployed is exactly what that gate tested.

## Decisions already taken by the owner

- **MIT for the code, and only the code.** `LICENSE` holds the standard MIT text with the line
  `Copyright (c) 2026 cinash`, then a separate closing paragraph on the music files. That
  paragraph must be true for every tracked `*.musicxml`. In outline:
  - Files with a `<rights>` element are excluded from MIT, and their terms are in that element.
    These are Beyer Nos. 8-31, which derive from Nathanael Meister's engraving ("Educational
    copying welcome", no open licence, `scripts/beyer/lilypond_import.py:23-30`), the Peters
    scan transcriptions, and `cicha-noc.musicxml`, the owner's own arrangement.
  - `scripts/beyer/fixtures/pdmx_beyer_no0{8,9}.musicxml`, `pdmx_beyer_no10.musicxml` and
    `beyer_op101_musicxml/beyer_op101_no38.musicxml` have no `<rights>`. They come from the PDMX
    dataset and are CC0 (`scripts/beyer/test_fingering.py:10`). Name them as CC0.
  - `src/score/fixtures/*.musicxml` are the project's own test fixtures, and fall under MIT.

  Re-check this list with `grep -L '<rights>'` over the tracked `*.musicxml` before writing the
  paragraph. README gets a short "Licence" section saying the same.

- **No personal details.** Use the handle `cinash`, never a full name or an email, in `LICENSE`,
  `package.json` or anywhere else.
- **Add `"license": "MIT"` to `package.json`**, then run `npm install --package-lock-only`. The
  lockfile diff should be that one `license` line in the root entry; if anything else moves,
  stop and report. Leave `"private": true` alone: it prevents an accidental `npm publish`, and
  has nothing to do with the GitHub repository being public.
- **Deploy on every green push to `main`.** The owner said the Pages copy is a showcase, not
  where practice happens. Practice stays on localhost and the tailnet copy. So publishing is
  automatic, and a change to the stored format costs the Pages copy nothing the owner relies on.
  The `DECISIONS.md` entry on this is "Every attempt records its piece and hands, and the history
  before them is not kept".
- **Served at `cinash.github.io/piano-tutor`**, not a custom domain. **Only `main` is pushed.**

## What to build

**`base: './'` in `vite.config.ts`.** With a relative base, one build works at the root (k3s,
`vite preview`, the `built` Playwright project) and at `/piano-tutor/` (Pages). This was tried
while planning, with the staff, cursor and a played note all working and no console errors:

- a `--base=./` build, served under `/piano-tutor/`;
- the dev server started with `--base=./`, at `/`.

Rejected: an absolute `--base=/piano-tutor/` given only to a deploy build, which would ship a
build nothing tests. An absolute base in the config would also move the dev server off `/`.

**Guard it.** Add one assertion to `e2e/content-security-policy.spec.ts`, which already loads
the built app: the page's script `src` starts with `./assets/`. Without it, reverting the base
breaks only the Pages copy, and only after the next push.

**`.github/workflows/ci.yml`**, with two jobs, in GitHub's usual build-then-deploy shape:

- **`ci`** runs on every push to `main` and every pull request.
  - It runs `npm run ci`, the whole gate, not a subset. `CLAUDE.md` says anything a CI service
    would run belongs in it, so the workflow adds nothing and leaves nothing out.
  - On failure, it uploads `test-results/` and `playwright-report/` with
    `actions/upload-artifact` (`if: failure()`). Otherwise a screenshot mismatch leaves only a
    pixel count to look at.
  - On a push to `main` only, it then hands `dist/` to `actions/upload-pages-artifact`. That
    `dist/` is the one the `built` Playwright project rebuilt and served to the CSP spec
    (`playwright.config.ts`), so Pages gets exactly the bytes that were tested.
- **`deploy`** needs `ci` and runs only on a push to `main`. It is only `actions/deploy-pages`,
  to the `github-pages` environment: no container, no checkout, no `npm`. The one job holding
  `pages: write` and `id-token: write` then runs no third-party code.

Put a **workflow-level** `concurrency` group keyed on `github.ref`, with
`cancel-in-progress: false`. A slow run's deploy can then never land after a newer one. GitHub
holds one running and one pending run per group, so a third quick push cancels the waiting
second. Say in a comment that "cancelled" runs are expected, so nobody reads them as failures.

How it is locked down, because this is the part that is the security:

- **Least privilege.** Set `permissions: contents: read` at the top of the file. Only `deploy`
  is raised, to `pages: write` and `id-token: write`. No job gets `contents: write`.
- **Every action pinned to a full commit SHA**, with its version in a trailing comment. This is
  the repository's exact-versions rule applied to Actions. A tag can be moved to malicious code
  after the fact; a SHA cannot. The workflow uses only `actions/*`. Piece 6 allows GitHub-owned
  actions only (`actions/*` and `github/*`; the second is needed by CodeQL).
- **`persist-credentials: false`** on `actions/checkout`. Nothing after checkout pushes.
- **Never `pull_request_target`**, and no secrets anywhere. A fork's pull request then runs with
  a read-only token and cannot reach the deploy.

## The traps

- **The screenshots will not match on a stock runner.** `e2e/falling-notes.spec.ts` and
  `e2e/note-names.spec.ts` compare against `*-chromium-linux.png` files rendered in the dev
  container: Debian bookworm, with Chromium's dependencies from `playwright install --with-deps`.
  `ubuntu-24.04` has other fonts.
  - Run `ci` in a `container:` of the dev container's own base,
    `node:24.20.0-bookworm@sha256:be23f54a88d34e8824c741b19b91064094f92c1c97b194144bfc8b50d67258e2`
    (`.devcontainer/Dockerfile:6`), and run `npx playwright install --with-deps chromium` there.
  - That image has Python 3.11, which is all `npm run test:beyer` needs: the Beyer scripts import
    only the standard library.
  - Do not regenerate the snapshots to make a runner pass. If they still differ inside the
    matching image, stop and report the diff.
- **`playwright.config.ts` behaves differently under `CI`**: retries 2, one worker, `forbidOnly`,
  and an HTML report. That is intended. Do not unset `CI`.

## The lockstep check grows to cover the Node image

A Node bump now touches three files:

- `.devcontainer/Dockerfile:6`;
- the root `Dockerfile:3`, written as `docker.io/library/node:…` for podman;
- the workflow's `container:` image.

Extend `scripts/check-version-lockstep.mjs` to compare the image tag and digest across all
three, ignoring the `docker.io/library/` prefix, so drift fails the gate the way a Playwright
drift does. Fix the text that would then be wrong:

- the script's header points readers to "the matching `ARG` in `.devcontainer/Dockerfile`",
  which is not true for Node: its pin is in `FROM`;
- README's "Version pinning" says "Two versions have to be written in more than one place" and
  "Bumping either…" (`README.md:124`, `:135`), and its opening lists only the Dockerfiles' base
  images (`:121-122`).

Whether `CLAUDE.md`'s house rule on version bumps should gain a Node line is not this piece's
call, because a change to `CLAUDE.md` goes through the plan gate. Name it in the report as a
follow-up.

## README: "Published copy"

A new section covering four things:

1. Where the app is.
2. That a push to `main` deploys it once CI passes.
3. That the copy shares the `cinash.github.io` origin.
4. **Who pushes, and how.** Agents in the container cannot, by design, so the owner pushes from
   the host after merging. Write the routine out, because it is what keeps the container
   credential-free:
   - log in with `gh auth login --hostname github.com --git-protocol https --web --scopes workflow`,
     answering **No** to "Authenticate Git with your GitHub credentials?";
   - push with
     `git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push origin main`;
   - **never** run `gh auth setup-git`;
   - finish with `gh auth logout --hostname github.com`.

Without this, the next push has only `6-publish-to-github.md` to go on, and the next reader will
expect `main` on GitHub to keep up on its own.

## Out of scope

- **Anything on GitHub itself.** That is piece 6. The container has no GitHub credentials by
  design (`.devcontainer/scripts/github-identity.sh`).
- **Any Dependabot PRs**, version or security. Piece 6 turns on Dependabot **alerts** only.
  - A PR would arrive on GitHub, where the owner never merges.
  - Merging one there would move GitHub's `main` ahead of the local one, so the owner's next
    push would be refused, and the ruleset forbids the force-push that would fix it.
  - A Playwright bump would also fail the lockstep check every time.

  The owner bumps locally from the alert. SHA pins move the same way, by hand, with the release
  notes read.

- **A `SECURITY.md`.** Piece 6 turns on GitHub's private vulnerability reporting, which gives
  reporters the same route without a file to keep current.
- **A standing `MANUAL-CHECKS.md` item for the Pages copy.** It is a showcase that runs behind
  `main` by whatever is unpushed, so re-checking it on every manual pass costs more than it
  tells. Piece 6 does one check at the piano when it publishes.
- **The Antigravity CLI checksum** in `.devcontainer/Dockerfile:87`. It is still open from the
  security review, is unrelated to publishing, and needs the owner to supply the hashes.

## What this makes harder later

- **A custom domain later** needs no code change, thanks to the relative base. Visitors' saved
  history would not carry over, because `localStorage` belongs to an origin. Export and import
  are the way across.
- **A client-side router** with nested paths would not work under `base: './'`. The app has none,
  and adding one is when to revisit this.
- **The `cinash.github.io` origin is shared** by every Pages site the owner ever publishes. That
  includes the CSP's `'self'` and `localStorage`, whose `piano-tutor.*` keys are namespaced. The
  risk is low while the owner controls every site there.

## Decisions to record in `DECISIONS.md`

One entry covering:

- the app is published on GitHub Pages from a relative base, deploying on every green push
  because that copy is a showcase;
- the deployed `dist/` is the one CI tested, and the deploy job runs no third-party code;
- CI runs the whole of `npm run ci` inside the dev container's base image, for the screenshots;
- Actions are pinned by SHA with least-privilege tokens;
- Dependabot is alerts only;
- the shared origin;
- the MIT licence's scope.

Name what was rejected: an absolute base given only to a deploy build, building separately in
the deploy job, a stock `ubuntu` runner, and Dependabot PRs, each for the reason above.

## The gate

- **`npm run ci` passes in the container.** It covers the YAML too: `format:check` parses
  `.github/workflows/ci.yml`, because `.prettierignore` does not exclude `.github/`.
- **The CSP spec's new assertion fails when `base: './'` is removed.** Show that, then put it
  back.
- **The extended lockstep check fails** when the workflow's image digest is edited to disagree,
  and again when the workflow is removed. Show both, then put it back. Together with the
  assertion above, these are the named checks that would fail without the feature.
- **The build works under a sub-path.** Copy `dist/` into a `piano-tutor/` folder, serve its
  parent (for example with `python3 -m http.server`), and open `/piano-tutor/` in Playwright:
  the staff is drawn and the console has no errors. This is a one-off; the assertion above is
  what keeps it true.
- **The workflow cannot run in the container.** Say plainly that its first real run is piece 6's
  check, not this one's.

## Manual

None in this piece. See "Out of scope" for why the Pages copy gets no standing item.

# Piece 1 — pin Claude Code in the image, and guard the pin

One of four independent pieces rebuilding the dev container work. Do only this one.
`CLAUDE.md` is the working agreement and is loaded automatically; follow it, including the
two-reviewer pass.

## Why this exists

The dev container should ship Claude Code inside the image rather than leaving it to be
installed by hand, and the version is written in two files that nothing holds together.
`scripts/check-playwright-lockstep.mjs` already solves exactly this problem for Playwright.

## Where it already stands

`.devcontainer/Dockerfile` and `.devcontainer/devcontainer.json` have uncommitted changes that
do the first half. They were verified working on 2026-09-06 by building the image and bringing a
container up:

- `claude` 2.1.261 on `PATH` at `/usr/local/bin/claude`
- `/home/node/.claude` owned by `node`, with the `piano-tutor-claude-config` named volume mounted
  over it so the login survives a rebuild
- `npm ci` completing inside the container
- `anthropic.claude-code@2.1.261` confirmed to be a real published marketplace version

Do not redo that verification from scratch; check the diff still says what it says and move on.

## What to build

Extend the lockstep guard to cover the Claude Code version as well as Playwright:

- rename `scripts/check-playwright-lockstep.mjs` to `scripts/check-version-lockstep.mjs`
- guard `CLAUDE_CODE_VERSION` in `.devcontainer/Dockerfile` against the extension pin in
  `.devcontainer/devcontainer.json`
- rename the `check:playwright` npm script accordingly and update every reference to the old
  path — the `Dockerfile` is one, and it was missed the last time this was attempted

## Prior art, and its defects

`git show worktree-devcontainer-hardening:scripts/check-version-lockstep.mjs` is an abandoned
104-line version. Read it for the shape, not to copy: reviewers found it expressed "this source
is optional" three separate ways (a helper returning null, a `filter(Boolean)`, and an
`applicable` alias), and its `catch` swallowed every throw, so a corrupt `node_modules`
`package.json` was silently dropped from the comparison instead of failing. Drop the optional
sources where the list is built, and catch only `ENOENT`.

## Out of scope

No networking, no cluster access, no GitHub credentials, no `.devcontainer/README.md`. Those are
pieces 2, 3 and 4.

## Done when

`npm run ci` passes, and the check demonstrably fails: drift each guarded source in turn and
confirm each one is caught. Show that, rather than asserting it.

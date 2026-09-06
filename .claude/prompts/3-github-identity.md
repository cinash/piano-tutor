# Piece 3 — stop the container authenticating as the host user

One of four independent pieces rebuilding the dev container work. Do only this one.
`CLAUDE.md` is the working agreement and is loaded automatically; follow it, including the
two-reviewer pass.

## Why this exists

VS Code injects a git credential helper into the dev container and forwards the host's ssh-agent.
Both mean git inside the container can authenticate as the host user. The container shares the
laptop's infrastructure — the k3s cluster and the `po-devnet` network, see piece 2 — but it must
not share identity. Each dev container gets its own GitHub credentials, and this repository must
never reuse `personal-orchestrator`'s.

## What to build

A `postAttachCommand` script that runs on every attach and undoes both:

- unset the injected `credential.helper` keys for github.com
- make the forwarded ssh-agent unreachable
- **exit non-zero when it detects either is still reachable.** An earlier version detected a leak,
  printed it, and exited 0, so the failure was one line in the Dev Containers output pane and the
  attach reported success. That is the defect that matters most here.

## Traps, all found the hard way

- **`/workspace` may be a git worktree.** Its `.git` is a file pointing at a gitdir that does not
  exist inside the container, and an earlier version aborted outright when it saw that, leaving
  the injected helper in place on every attach. Run the global config work from outside any
  repository.
- **git honours several spellings of the helper key**, and matching one of them misses the rest.
  At least these four: mixed case, no scheme, path-scoped, and
  `credential.https://user@github.com.helper` when the remote URL carries a username. Match on
  `github.com` appearing in the key. Verify against a real git config that `gitlab.com`,
  `notgithub.com`, `github.company.com` and a plain `credential.helper` are all left alone.
- `git.useIntegratedAskPass: false` in `devcontainer.json` is best-effort only. It says nothing
  about the injected `credential.helper`, so do not describe it as covering the window before
  `postAttachCommand` runs.

## Out of scope — a decision already taken

Do **not** build GitHub App credential scaffolding. An earlier attempt included `gh-app-token.sh`
and `git-credential-gh-app.sh`, and its own commit message described them as "present but idle":
this repository has no remote and no App is configured, so the helper simply answered git with
empty credentials. Leave them out until there is a remote to push to.

`git show worktree-devcontainer-hardening:.devcontainer/scripts/github-identity.sh` is the prior
art for the part that is in scope.

## Done when

`npm run ci` passes, and you have shown the exit status behaving both ways: non-zero with a host
credential helper or ssh-agent reachable, zero otherwise.

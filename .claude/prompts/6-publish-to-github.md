# Piece 6 — publish to GitHub, locked down before the first push

The second of two pieces. This one runs in **Claude Code on the host**, in this repository's
directory, with the `gh` CLI. It creates the public repository `cinash/piano-tutor`, turns its
security settings on, pushes `main`, confirms the Pages deploy, and logs the host out of GitHub
again. It changes no file in the repository. **Do not start until piece 5 (`5-github-ready.md`)
is merged into `main`.** That is what puts the licence and the workflow on the branch being pushed.

## Why it runs on the host, and what it must not leave there

The dev container is built never to hold GitHub credentials (`.devcontainer/scripts/github-identity.sh`
and its piece, `3-github-identity.md`), and the owner chose to keep it that way. There is a
second half to that. VS Code injects into the container a credential helper that forwards to
the **host's** credential store. `github-identity.sh` removes it on attach, but `3-github-identity.md`
records that the only guard for the window before that runs is best-effort. Today the host's
store holds no GitHub token, so that window exposes nothing. This piece must keep it that way:

- **Never run `gh auth setup-git`**, and never write a credential helper into the host's git
  config. `github-identity.sh:27` lists it among the things it has to undo. Push with a helper
  scoped to the one command:
  `git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push -u origin main`.
- **End with `gh auth logout --hostname github.com`.** The owner chose this over staying logged
  in: each later push means a fresh browser login, and in exchange no long-lived token with access
  to every repository on the account sits on the laptop.

## What only the owner can do

Ask for each of these and wait for a yes before continuing.

1. **`gh` is installed on the host.** Nothing in the record says it is. If it is not, the owner
   installs it; do not do it for them with `sudo`.
2. **Two-factor authentication** is on for the GitHub account (browser). A public repository's
   settings protect nothing if the account itself can be taken over.
3. **The owner runs the login in their own terminal**:
   `gh auth login --hostname github.com --git-protocol https --web --scopes workflow`, approving
   the device code in the browser. It is interactive and would hang an agent's shell. The
   `workflow` scope is needed because GitHub refuses a push containing `.github/workflows/`
   without it.
4. **Settings → Emails → "Block command line pushes that expose my email"** is on (browser). The
   history was rewritten to remove a personal address. This makes GitHub reject any future
   commit that carries one, instead of relying on someone noticing.

## Before anything is created: the inventory, and an explicit yes

Making a repository public is the one step here that cannot really be undone: forks, mirrors and
archives keep what they copied. So first check, and refuse to go on with the reason if any check
fails:

- `main` is checked out and `git status` is clean apart from untracked files. Piece 5's
  `.github/workflows/ci.yml` and `LICENSE` are on it.
- `git log main --format='%ae%n%ce' | sort -u` prints exactly
  `5518251+cinash@users.noreply.github.com`, and `git config user.email` is the same address.
- `git ls-files` contains none of `image.png`, `prompts/prompt-youtube.md` or `worktree-reviews/`.
  They are the owner's untracked files.

Then show the owner what will be public, and wait for a yes:

- the author and committer names (`git log main --format='%an%n%cn' | sort -u`);
- the top-level tracked paths;
- what was already decided. The dev container and cluster details (`.devcontainer/`,
  `.claude/prompts/2-cluster-access.md`, `chart/`) were accepted as fine. The personal detail in
  `DECISIONS.md` was reworded (commit `0a067c0`). The music files go out under their own
  `<rights>`, with MIT covering only the code.

## The order is the security

**Every setting that protects the push goes on before the push.** Create the repository empty,
with `gh repo create cinash/piano-tutor --public --disable-wiki` and no `--push` and no
`--source`. Then turn projects and discussions off, and leave issues on so people can report
problems. Apply each setting through `gh api` and read it back. The REST endpoints for Actions
settings have changed in the last two years, so check each against GitHub's current REST
documentation.

**These must read back as on before anything is pushed. If any does not, stop and report;
publish nothing:**

- secret scanning **and push protection** (`security_and_analysis`), so the very first push is
  scanned;
- Actions allowed only for GitHub-owned actions, and default `GITHUB_TOKEN` permission read-only,
  with Actions not allowed to approve pull requests;
- a ruleset on the default branch blocking deletion and force-pushes, with no bypass for
  anyone, admins included.

**These go on before the push where the API allows, and otherwise straight after it; report
each one's state:**

- Dependabot alerts and Dependabot security updates;
- private vulnerability reporting;
- full-SHA pinning required for Actions, where that setting exists;
- workflows from fork pull requests need approval for all outside contributors;
- **CodeQL default setup**, which is free on a public repository and covers the TypeScript,
  the Python under `scripts/` and the workflow itself;
- Pages with `build_type: workflow`, and the `github-pages` environment deploying from `main`
  only. If Pages cannot be enabled on an empty repository, enable it right after the push. If the
  first run's `deploy` job has already failed for lack of it, `gh run rerun --failed` it, and say
  so.

The ruleset deliberately does **not** require pull requests or status checks. The owner merges
locally in the container and pushes `main` from the host. A required check would reject a direct
push whose commit has not been through CI yet, and the deploy is already gated on CI inside the
workflow. Blocking force-pushes also means history can never be rewritten on GitHub again
without first switching the rule off by hand. That is the point of it, and the report should say
so.

Then add `origin` and push **`main` only**, with the per-command helper above. Never `--all`,
`--mirror` or `--tags`; the work branches stay local, as the owner chose.

## Done when

- **The first workflow run is green in both jobs** (`gh run watch`). A rerun of `deploy` for the
  Pages ordering reason above counts; a rerun of `ci` does not. If `ci` fails on the screenshot
  specs, download the run's artifact and report the diff. Do not update the snapshots.
- **The published copy loads.** `curl -sI https://cinash.github.io/piano-tutor/` returns 200, the
  HTML it serves carries the Content-Security-Policy meta tag, and the script it names under
  `./assets/` returns 200.
- **Every setting above**, read back from `gh api`, is listed in the report with its value.
  `gh api repos/cinash/piano-tutor/license` says whether GitHub detected MIT; report it, but do
  not change `LICENSE` over it.
- **What was published carries no personal address.**
  `gh api repos/cinash/piano-tutor/commits --paginate --jq '.[].commit | .author.email, .committer.email' | sort -u`
  shows only the noreply address. This checks what actually went out, not what was meant to.
- **The host is logged out** (`gh auth status` says so), and no credential helper for github.com
  is set in the host's git config. The owner then reattaches the dev container, and
  `github-identity.sh` prints `ok   no host credentials reachable`.

## Out of scope

- **The k3s and tailnet copy** carries on unchanged beside Pages.
- **Requiring pull requests or status checks**, for the reason above.
- **A custom domain**: not chosen.
- **Pushing other branches or tags**: not chosen.

## Manual — the owner, at the piano

The extended `MANUAL-CHECKS.md` item 10 from piece 5: the github.io copy in Chrome on the host,
with the P-145 playing the opening of Cicha Noc. Name it in the report as the one outstanding
check.

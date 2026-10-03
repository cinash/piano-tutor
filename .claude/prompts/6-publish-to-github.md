# Piece 6 — publish to GitHub, locked down before the first push

The second of two pieces. This one runs in **Claude Code on the host**, in this repository's
directory, with the `gh` CLI. It creates the public repository `cinash/piano-tutor`, turns its
security settings on, pushes `main`, and confirms the Pages deploy. It changes no file in the
repository. **Do not start until piece 5 (`5-github-ready.md`) is merged into `main`.** That is
what puts the licence and the workflow on the branch being pushed.

## Why it runs on the host

The dev container is built never to hold GitHub credentials (`.devcontainer/scripts/github-identity.sh`
and its piece, `3-github-identity.md`). The owner chose to keep it that way. So `gh` is
installed and logged in on the host, and this piece runs there. Do not copy a token into the
container to save a step.

## What only the owner can do, in a browser

Ask for each of these and wait for a yes. None of them can be done from the CLI.

1. **Two-factor authentication** is on for the GitHub account. A public repository's security
   settings protect nothing if the account itself can be taken over.
2. **`gh auth login --web --scopes workflow`**. The owner approves the device code in the
   browser. The `workflow` scope is needed: without it, GitHub refuses a push that contains
   `.github/workflows/`. Then run `gh auth setup-git` so `git push` uses that login.
3. **Settings → Emails → "Block command line pushes that expose my email"** is on. The history was
   rewritten to remove a personal address. This setting makes GitHub reject any future commit
   that carries one, instead of relying on someone to notice.

## Before anything is created

Refuse to go on, and say why, unless all of these hold:

- `main` is checked out, `git status` is clean apart from untracked files, and piece 5's
  `.github/workflows/ci.yml` and `LICENSE` are on it.
- `git log main --format='%ae%n%ce' | sort -u` prints exactly
  `5518251+cinash@users.noreply.github.com`, and `git config user.email` is the same address.
- `git ls-files` contains none of `image.png`, `prompts/prompt-youtube.md` or `worktree-reviews/`.
  They are the owner's untracked files and must not be published.

## The order is the security

**Every setting goes on before the first push**, so that push protection scans the very first
upload, and Actions are already restricted when the workflow first runs. Create the repository
empty (`gh repo create cinash/piano-tutor --public`, no `--push`, no `--source`), with wiki and
projects off. Then apply the settings below through `gh api`. Read each one back, because the
REST endpoints for Actions settings have changed in the last two years. Check each against
GitHub's current REST documentation, and report any that does not exist or does not take,
rather than skipping it quietly.

- **Secret scanning and push protection** on (`security_and_analysis` on the repository).
- **Dependabot alerts** and **Dependabot security updates** on.
- **Private vulnerability reporting** on.
- **Actions**: only GitHub-owned actions allowed. Full-SHA pinning required, where the setting
  exists. Default `GITHUB_TOKEN` permission read-only, and Actions not allowed to approve pull
  requests. Workflows from fork pull requests need approval for all outside contributors.
- **Pages** with `build_type: workflow`. HTTPS enforced once the certificate exists.
- **The `github-pages` environment** deploys from `main` only.
- **A ruleset on the default branch** that blocks deletion and force-pushes, with no bypass for
  anyone, admins included.

The ruleset deliberately does **not** require pull requests or status checks. The owner works by
merging locally and pushing `main` (see `CLAUDE.md`), and a required check rejects a direct push
whose commit has not run CI yet. The deploy is already gated on CI inside the workflow. Blocking
force-pushes also means history can never be rewritten on GitHub again without first switching
the rule off by hand. That is the point of it, and the owner should hear it in the report.

Then add `origin` and push **`main` only**: `git push -u origin main`. Never `--all`, `--mirror`
or `--tags`. The work branches stay local, as the owner chose.

## Done when

- The first workflow run is green in both jobs (`gh run watch`). If `ci` fails on the screenshot
  specs, do not update the snapshots. Report the diff: piece 5 was meant to prevent exactly that.
- `curl -sI https://cinash.github.io/piano-tutor/` returns 200. The HTML it serves carries the
  Content-Security-Policy meta tag, and the script it names under `/piano-tutor/assets/` also
  returns 200.
- Every setting above, read back from `gh api`, is listed in the report with its value.
- `gh api repos/cinash/piano-tutor/commits --paginate --jq '.[].commit.author.email' | sort -u`
  shows only the noreply address. This is the check on what actually got published, not on what
  was meant to be.

## Manual — the owner, at the piano

Open `https://cinash.github.io/piano-tutor/` in Chrome on the host with the Yamaha P-145
connected. Grant the MIDI prompt, pick the piano, and play the opening of Cicha Noc. The keys
should light and the cursor should move. This is the first time Web MIDI runs over a public
HTTPS origin and under the CSP together. The e2e suite cannot show it, because it drives a fake
MIDI source. It is the `MANUAL-CHECKS.md` item piece 5 added. Name it in the report as the one
outstanding check.

# Piece 6 — publish to GitHub, locked down before the first push

The second of two pieces. This one runs in **Claude Code on the host**, in this repository's
directory, with the `gh` CLI. It:

- creates the public repository `cinash/piano-tutor`;
- turns its security settings on;
- pushes `main` and confirms the Pages deploy;
- logs the host out of GitHub again.

It changes no file in the repository and makes no commit. **Do not start until piece 5
(`5-github-ready.md`) is merged into `main`.** That puts the licence, the workflow and README's
push routine on the branch being pushed.

## Why it runs on the host, and what it must not leave there

The dev container is built never to hold GitHub credentials (`.devcontainer/scripts/github-identity.sh`
and its piece, `3-github-identity.md`), and the owner chose to keep it that way.

There is a second half to that. VS Code injects a credential helper into the container that
forwards to the **host's** credential store. `github-identity.sh` removes it on attach, but
`3-github-identity.md` records that the only guard for the window before that runs is
best-effort. Today the host's store holds no GitHub token, so that window exposes nothing. This
piece must keep it that way:

- **Record the host's credential config first.** Save the output of
  `git config --global --get-regexp '^credential'` and of the same command with `--system`. At
  the end, it must be unchanged. Remove only what this piece added, never a helper the owner
  already had.
- **Never run `gh auth setup-git`**, and never write a credential helper. `github-identity.sh:27`
  lists it among the things it has to undo. Push with a helper scoped to the one command:
  `git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push -u origin main`.
- **Log out on every exit, finished or not**, with `gh auth logout --hostname github.com`. The
  owner chose this over staying logged in: each later push means a fresh browser login, and in
  exchange no long-lived token with access to every repository on the account stays on the
  laptop. A stop for any reason below logs out first, then reports.

## What only the owner can do

Ask for each of these and wait for a yes before continuing.

1. **`gh` is installed on the host.** Nothing in the record says it is. If it is not, the owner
   installs it; do not do it for them with `sudo`.
2. **Two-factor authentication** is on for the GitHub account (browser). A public repository's
   settings protect nothing if the account itself can be taken over.
3. **The owner runs the login in their own terminal.** It is interactive and would hang an
   agent's shell:
   `gh auth login --hostname github.com --git-protocol https --web --scopes workflow`
   - When it asks "Authenticate Git with your GitHub credentials?", the answer is **No**. Yes
     would do what `gh auth setup-git` does.
   - The `workflow` scope is needed because GitHub refuses a push containing
     `.github/workflows/` without it.
4. **Settings → Emails → "Block command line pushes that expose my email"** is on (browser). The
   history was rewritten to remove a personal address. This makes GitHub reject any future
   commit that carries one, instead of relying on someone noticing.

## Before anything is created: the inventory, and an explicit yes

Making a repository public is the one step here that cannot really be undone: forks, mirrors and
archives keep what they copied. Check each of these, and refuse to go on with the reason if any
fails:

- `main` is checked out and `git status` is clean apart from untracked files. Piece 5's
  `.github/workflows/ci.yml` and `LICENSE` are on it.
- `git log main --format='%ae%n%ce' | sort -u` prints exactly
  `5518251+cinash@users.noreply.github.com`.
- `git log main -p -i -G '<word>' --format=%h` prints nothing. The wording was removed from
  the whole history before this piece. This catches it coming back.
- `git ls-files` contains none of `image.png`, `prompts/prompt-youtube.md` or `worktree-reviews/`.
  They are the owner's untracked files.

Then show the owner what will be public, and wait for a yes:

- the author and committer names (`git log main --format='%an%n%cn' | sort -u`);
- the top-level tracked paths;
- what was already decided:
  - the dev container and cluster details (`.devcontainer/`, `.claude/prompts/2-cluster-access.md`,
    `chart/`) were accepted as fine;
  - the personal detail was reworded and removed from the history;
  - the music files go out under the terms in `LICENSE`'s closing paragraph.

## The order is the security

**Every setting that protects the push goes on before the push.**

Create the repository empty: `gh repo create cinash/piano-tutor --public --disable-wiki`, with no
`--push` and no `--source`, a description of "Learn piano from a USB keyboard over Web MIDI", and
homepage `https://cinash.github.io/piano-tutor/`. Turn projects and discussions off, and leave
issues on so people can report problems.

Apply each setting through `gh api` and read it back. The REST endpoints for Actions settings
have changed in the last two years, so check each one against GitHub's current REST
documentation.

**These must read back as on before anything is pushed. If any does not, stop, log out and
report; publish nothing.**

- secret scanning **and push protection** (`security_and_analysis`), so the very first push is
  scanned;
- Actions allowed only for GitHub-owned actions (`actions/*` and `github/*`);
- default `GITHUB_TOKEN` permission read-only, with Actions not allowed to approve pull requests;
- a ruleset targeting `refs/heads/main` explicitly, not "the default branch", which does not
  exist yet in an empty repository. It blocks deletion and force-pushes, with no bypass for
  anyone, admins included.

**These go on before the push where the API allows, otherwise straight after it. Report each
one's state:**

- **Dependabot alerts.** Alerts only, not security-update PRs: piece 5 records why.
- **Private vulnerability reporting.**
- **Workflows from fork pull requests need approval** for all outside contributors.
- **Full-SHA pinning required for Actions**, where that setting exists. If it makes the first run
  fail on an action that pins its own dependencies differently, switch this setting off, re-run,
  and report that. Do not loosen the workflow's own pins.
- **CodeQL default setup.** It is free on a public repository and covers the TypeScript, the
  Python under `scripts/` and the workflow itself.
- **Pages with `build_type: workflow`**, and the `github-pages` environment deploying from `main`
  only. If Pages cannot be enabled on an empty repository, enable it right after the push. If
  the first run's `deploy` job has already failed for lack of it, `gh run rerun --failed` it and
  say so.

The ruleset deliberately does **not** require pull requests or status checks. The owner merges
locally in the container and pushes `main` from the host. A required check would reject a
direct push whose commit has not been through CI yet, and the deploy is already gated on CI
inside the workflow. Blocking force-pushes also means history can never be rewritten on GitHub
again without first switching the rule off by hand. That is the point of it, and the report
should say so.

Then add `origin` and push **`main` only**, with the per-command helper above. Never `--all`,
`--mirror` or `--tags`; the work branches stay local, as the owner chose.

## Done when

- **The first workflow run is green in both jobs** (`gh run watch`). Two reruns count:
  - a `deploy` rerun for the Pages ordering above;
  - one after switching off SHA-pinning enforcement.

  A rerun of `ci` alone does not count.

- **If `ci` fails**, download the run's artifact, report the diff, and do not update the
  snapshots. Tell the owner what they now have: a public repository with a red first run and no
  Pages copy, to be fixed in a container session and pushed again.
- **The published copy loads.** `curl -sI https://cinash.github.io/piano-tutor/` returns 200,
  the HTML it serves carries the Content-Security-Policy meta tag, and the script it names
  under `./assets/` returns 200.
- **Every setting above**, read back from `gh api`, is listed in the report with its value.
  `gh api repos/cinash/piano-tutor/license` says whether GitHub detected MIT. Report it, but do
  not change `LICENSE` over it.
- **What was published carries no personal address.**
  `gh api repos/cinash/piano-tutor/commits --paginate --jq '.[].commit | .author.email, .committer.email' | sort -u`
  shows only the noreply address. This checks what actually went out, not what was meant to.
- **The host is logged out** (`gh auth status` says so), and its credential config matches what
  was recorded at the start. The owner then reattaches the dev container, and
  `github-identity.sh` prints `ok   no host credentials reachable`.

## Out of scope

- **The k3s and tailnet copy** carries on unchanged beside Pages.
- **Requiring pull requests or status checks**, for the reason above.
- **Dependabot PRs**, as piece 5 records.
- **A custom domain**, and **pushing other branches or tags**: not chosen.

## Manual — once, by the owner, at the piano

Open `https://cinash.github.io/piano-tutor/` in Chrome on the host with the P-145 connected.
Grant the MIDI prompt, pick the piano, and play the opening of Cicha Noc: the keys should light
and the cursor should move. This is Web MIDI under the CSP at the github.io origin, which no spec
can show, because the e2e suite drives a fake MIDI source. Name it in the report as the one
outstanding check. Piece 5 explains why it is not a standing `MANUAL-CHECKS.md` item.

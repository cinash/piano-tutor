# Publish to GitHub, part 2 of 2 — on the host

Create the public repository `cinash/piano-tutor`, lock it down, push `main`, and confirm the
Pages deploy. Run this in Claude Code **on the host**, with `gh`, after part 1
(`5-github-ready.md`) is merged into `main`. It changes no file and makes no commit.

## Never leave a credential behind

VS Code relays the host's git credentials into the dev container, and the container must never
reach a GitHub token (`.devcontainer/scripts/github-identity.sh`).

- **Record the host's credential config** at the start: `git config --global` and `--system`,
  `--get-regexp '^credential'`. It must be unchanged at the end.
- **Never run `gh auth setup-git`.** Push with a helper for that one command only:
  `git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push -u origin main`.
- **On every exit, finished or stopped:** `gh auth logout --hostname github.com`.

## The owner, before starting

1. `gh` is installed.
2. Two-factor authentication is on.
3. The owner runs, in their own terminal:
   `gh auth login --hostname github.com --git-protocol https --web --scopes workflow`, answering
   **No** to "Authenticate Git with your GitHub credentials?".
4. Settings → Emails → "Block command line pushes that expose my email" is on.

## Check, then ask for a yes

Stop (and log out) if any of these fails:

- `main` is clean, with part 1's `LICENSE` and workflow on it.
- `git log main --format='%ae%n%ce' | sort -u` prints only
  `5518251+cinash@users.noreply.github.com`.
- `image.png`, `prompts/prompt-youtube.md` and `worktree-reviews/` are not tracked.
- **A personal detail the owner removed** is in no commit's contents (`git log main -p -i -G`)
  and no commit message (`git log main -i --grep`). Ask the owner for the words. Never write
  them into a file, a commit or the report.

Then show the owner the author names and the top-level paths, and wait for a yes. Going public
cannot really be undone.

## Settings before the push

Create the repository empty: `gh repo create cinash/piano-tutor --public --disable-wiki`, with
the description "Learn piano from a USB keyboard over Web MIDI" and the Pages URL as homepage.
Projects and discussions off. Set everything with `gh api`, check each endpoint against
GitHub's current docs, and read each setting back.

**These must read back as on, or stop and publish nothing:**

- secret scanning and push protection;
- Actions limited to GitHub-owned actions (`actions/*`, `github/*`), with a read-only default
  token that cannot approve PRs;
- a ruleset on `refs/heads/main` that blocks deletion and force-push, with no bypass. It does
  not require PRs or checks, because the owner pushes `main` directly.

**These go on before the push, or straight after; report each:**

- Dependabot alerts on, and security updates **off**;
- private vulnerability reporting;
- fork-PR workflows need approval;
- SHA pinning required, if the setting exists (switch it off if it breaks a run, and say so);
- CodeQL default setup;
- Pages from the workflow, with the `github-pages` environment limited to `main`.

Then push `main` only. Never `--all` or `--tags`.

## Done when

- Both jobs of the first run are green. A `deploy` rerun after enabling Pages counts. If `ci`
  fails, report the uploaded diff and do not touch the snapshots.
- CodeQL's first analysis has completed.
- `https://cinash.github.io/piano-tutor/` returns 200 and carries the CSP meta tag.
- Every setting is listed in the report with its read-back value.
- The published commits' author and committer emails are only the noreply address.
- The host is logged out, its credential config is unchanged, and after reattaching the dev
  container `github-identity.sh` prints `ok   no host credentials reachable`.
- **Left for the owner:** open the Pages URL in Chrome with the P-145 connected and play the
  opening of Cicha Noc.

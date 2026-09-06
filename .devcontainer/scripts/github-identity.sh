#!/usr/bin/env bash
#
# devcontainer.json postAttachCommand.
#
# VS Code re-injects a credential helper proxying to the host's credential store and
# re-forwards the host's ssh-agent every time it attaches, so this runs on every attach.
# See .devcontainer/README.md.
#
# Exits non-zero when it finds the host reachable, so VS Code raises the failure instead
# of leaving it as one line in the Dev Containers output pane - the leak this exists to
# catch should not be quieter than a failed config write.
set -euo pipefail
# A failed git config write leaves the identity half-rebuilt, and would otherwise print
# nothing at all - this output is the only signal that it ran.
trap 'echo "!!   github-identity.sh failed - host credentials may still be reachable"' ERR

fatal=0

# Every git config command below is --global and needs no repository. Run them from
# outside the checkout, because git resolves the repository first and aborts if that
# fails: when /workspace is a `git worktree`, its .git file points at a gitdir path on
# the host that does not exist in the container, and every command here would die before
# reaching --global - silently leaving VS Code's injected helper in place.
cd /

# git folds credential.<url>.helper into the same list as the plain key, and an empty
# value there discards everything before it - which is what `gh auth setup-git` writes.
# Matched on github.com anywhere in the key rather than on one spelling of it: git
# honours the host with no scheme, in any case, with a userinfo prefix and with a path,
# and all four have to go. Still scoped to github.com, so a deliberate helper for
# another host survives. --name-only prints a key once per value, so dedupe: a second
# --unset-all on a cleared key exits 5 and would abort the attach.
while read -r key; do
    git config --global --unset-all "$key"
done < <(git config --global --name-only --list \
    | grep -iE '^credential\.(https?://)?([^/@]+@)?([a-z0-9-]+\.)*github\.com([:/].*)?\.helper$' \
    | sort -u)

# Discard whatever VS Code put in /etc/gitconfig for github.com without touching
# plain credential.helper or helpers for other hosts. An empty value resets the
# helper list for matching URLs.
git config --global --replace-all credential.https://github.com.helper ''
git config --global --replace-all credential.http://github.com.helper ''

# For anything reading SSH_AUTH_SOCK directly; ssh itself already ignores it.
rm -f /tmp/vscode-ssh-auth-*.sock
[[ -n "${SSH_AUTH_SOCK:-}" ]] && rm -f "$SSH_AUTH_SOCK"

# Ask git what it would actually do. Probe from inside the checkout so repo-local config
# is in view too - except a `git worktree` checkout, whose gitdir path does not exist
# here; see the note above. Reported, because a narrower probe should not be silent.
probe_dir=/workspace
git -C /workspace rev-parse --git-dir >/dev/null 2>&1 \
    || { probe_dir=/; echo "..   /workspace is not a repository here - probe excludes repo-local config"; }

# Check whether any credential helper is reachable for github.com, either by
# explicit configuration with a non-empty value or through URL-matching fallback.
leaked_helpers=$(git -C "$probe_dir" config --list \
    | grep -iE '^credential\.(https?://)?([^/@]+@)?([a-z0-9-]+\.)*github\.com([:/].*)?\.helper=.+' \
    | sort -u) || leaked_helpers=""

urlmatch_helper=$(git -C "$probe_dir" config --get-urlmatch credential.helper https://github.com || true)

if [[ -n "$leaked_helpers" || -n "$urlmatch_helper" ]]; then
    echo "!!   a credential helper is reachable for github.com:"
    [[ -n "$leaked_helpers" ]] && printf '%s\n' "$leaked_helpers" | sed 's/^/!!     /'
    [[ -n "$urlmatch_helper" ]] && echo "!!     fallback: $urlmatch_helper"
    fatal=1
else
    echo "ok   no host credentials reachable"
fi

# ssh-add exits 2 when it cannot reach an agent, 1 when it reaches an empty one; only 2
# means the socket is really gone.
agent_rc=0
ssh-add -l >/dev/null 2>&1 || agent_rc=$?
case $agent_rc in
    2) echo "ok   no host ssh-agent" ;;
    *) echo "!!   a host ssh-agent is reachable"; fatal=1 ;;
esac

exit "$fatal"

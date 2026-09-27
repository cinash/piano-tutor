#!/usr/bin/env bash
#
# devcontainer.json postStartCommand, run as root through sudo — starts the container's own
# dockerd. The container has no init system to do it, so this runs on every start. It is the
# one thing node may run as root: the sudoers rule in the Dockerfile names this file and
# nothing else.
set -euo pipefail

pgrep -x dockerd >/dev/null && exit 0

# /run is not a tmpfs here, so pid files survive a container restart, and the pids they name
# may by now belong to other processes — which dockerd would take for an earlier copy of
# itself, or of its containerd, and fail to start.
rm -f /var/run/docker.pid /var/run/docker/containerd/containerd.pid
setsid dockerd >/var/log/dockerd.log 2>&1 </dev/null &

# Wait for the socket, so a daemon that fails shows up in the container's startup log rather
# than at the first docker command. A failure still exits 0: a failing lifecycle command makes
# the dev container skip the ones after it, and postAttachCommand's identity script has to
# run whether or not docker works.
for _ in $(seq 30); do
    docker info >/dev/null 2>&1 && exit 0
    sleep 1
done
echo "dockerd did not start; see /var/log/dockerd.log" >&2

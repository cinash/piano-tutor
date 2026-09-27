#!/usr/bin/env bash
#
# devcontainer.json postStartCommand, run as root through sudo — starts the container's own
# dockerd. The container has no init system to do it, so this runs on every start. It is the
# one thing node may run as root: the sudoers rule in the Dockerfile names this file and
# nothing else.
set -euo pipefail

pgrep -x dockerd >/dev/null && exit 0

# A pid file survives a container restart, and the pid it names may by now belong to another
# process, which dockerd would take for an earlier copy of itself and refuse to start.
rm -f /var/run/docker.pid
setsid dockerd >/var/log/dockerd.log 2>&1 </dev/null &

# Wait for the socket, so a daemon that fails shows up in the container's startup log rather
# than at the first docker command.
for _ in $(seq 30); do
    docker info >/dev/null 2>&1 && exit 0
    sleep 1
done
echo "dockerd did not start; see /var/log/dockerd.log" >&2
exit 1

#!/usr/bin/env bash
#
# Builds the production image and hands it to the k3s node's containerd. There is no
# registry on this cluster: the chart names the image under localhost/local and pulls it
# IfNotPresent, so an image has to be imported into the node rather than pushed anywhere.
# `k3s ctr` needs host root, so this runs on the host and not inside the dev container.
set -euo pipefail

cd "$(dirname "$0")"

podman build -t localhost/local/piano-tutor:latest .
podman save localhost/local/piano-tutor:latest | sudo k3s ctr images import -

echo
echo "Imported localhost/local/piano-tutor:latest. The tag does not change, so a running"
echo "deployment keeps the old image until it is restarted:"
echo "  kubectl -n piano-tutor rollout restart deployment/piano-tutor"

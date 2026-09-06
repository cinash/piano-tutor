#!/usr/bin/env bash
#
# devcontainer.json initializeCommand — runs on the HOST before the container starts.
#
# This repository creates none of the host state it needs. The po-devnet network, the
# firewall unit fencing it and the k3s serving certificate that answers on its gateway
# all belong to personal-orchestrator's host-setup.sh; there is one laptop, one cluster
# and one dev-container network, and piano-tutor joins them. So this script only checks
# that they are there, then renders the kubeconfig the container is handed. It needs no
# sudo and writes nothing outside ~/.kube.
set -euo pipefail

NETWORK=po-devnet
OUT="$HOME/.kube/piano-tutor-devcontainer.yaml"
HOST_SETUP='sudo bash ~/projects/personal-orchestrator/.devcontainer/scripts/host-setup.sh'

# die <what is wrong> [what to run instead of host-setup.sh]
die() {
    printf '\n\033[1;31mDev container host setup is incomplete:\033[0m %s\n' "$1" >&2
    printf 'Run:  %s\n\n' "${2:-$HOST_SETUP}" >&2
    exit 1
}

# Checked apart from the runtime below because host-setup.sh is not the fix for it.
docker info >/dev/null 2>&1 \
    || die "cannot talk to dockerd" "newgrp docker   # if you were just added to the group"
docker info --format '{{range $name, $_ := .Runtimes}}{{$name}} {{end}}' | grep -qw sysbox-runc \
    || die "dockerd has no sysbox-runc runtime"
# Without this the container comes up on the bridge unfenced, so it is worth a check of
# its own even though nothing else here would notice.
systemctl is-active --quiet po-devcontainer-firewall.service \
    || die "po-devcontainer-firewall.service is not active"
command -v kubectl >/dev/null || die "kubectl is not installed on the host"

# The container reaches the API server at the bridge gateway rather than at 127.0.0.1,
# and the address is read back from the network here — the one place it is defined.
GATEWAY="$(docker network inspect "$NETWORK" -f '{{(index .IPAM.Config 0).Gateway}}' 2>/dev/null)" \
    || die "the $NETWORK docker network does not exist"
SERVER="https://${GATEWAY}:6443"

TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT
# k3s leaves its kubeconfig root-owned under /etc/rancher and creates no user one, so on a
# fresh host this is the first thing that fails — and `kubectl config view --minify` exits
# 1 there with a bare message that says nothing about what to do about it.
kubectl config view --raw --minify --flatten >"$TMP" 2>/dev/null \
    || die "no usable kubeconfig on this host" \
        "sudo install -m 0600 -o $USER /etc/rancher/k3s/k3s.yaml ~/.kube/config"
CLUSTER="$(KUBECONFIG="$TMP" kubectl config view -o 'jsonpath={.clusters[0].name}')"
KUBECONFIG="$TMP" kubectl config set-cluster "$CLUSTER" --server="$SERVER" >/dev/null

# One request stands in for inspecting the serving certificate by hand: it cannot succeed
# unless k3s carries $GATEWAY as a SAN and the credentials still work. It says nothing
# about whether the container can route there — that is the fence's business, and the
# host reaches this address by its own local path rather than across the bridge.
KUBECONFIG="$TMP" kubectl get --raw /version --request-timeout=5s >/dev/null \
    || die "no k3s API server at $SERVER with a certificate valid for that address"

mkdir -p "$(dirname "$OUT")"
install -m 0600 "$TMP" "$OUT"
echo "kubeconfig -> $OUT ($SERVER)"

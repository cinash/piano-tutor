# Piece 2 — run on the shared network, with access to the shared k3s

One of four independent pieces rebuilding the dev container work. Do only this one.
`CLAUDE.md` is the working agreement and is loaded automatically; follow it, including the
two-reviewer pass.

## The decision that shapes this piece

This is a **single laptop**. There is one k3s cluster on it and one dev-container network, and
`piano-tutor` uses them — it does not stand up its own. An earlier attempt built a complete
parallel stack (a `pt-devnet` network on its own bridge and subnet, a `pt-` prefixed iptables
firewall unit, its own k3s `tls-san` drop-in) so it could coexist with `personal-orchestrator`.
That was over-engineering and it is not what to build.

Share the machine's infrastructure; do not share identity. Credentials stay separate — that is
piece 3.

## Host facts, all verified on 2026-09-06

- `sysbox-runc` is installed at `/usr/bin/sysbox-runc` and registered as a docker runtime
- `po-devnet` exists: subnet `172.30.77.0/24`, gateway `172.30.77.1`, bridge `br-po-dev`
- `po-devcontainer-firewall.service` is loaded and active — the fence already covers that bridge
- k3s is active, `v1.36.2+k3s1`
- the k3s serving certificate **already** contains `IP Address:172.30.77.1`, via the existing
  drop-in `/etc/rancher/k3s/config.yaml.d/10-po-devcontainer.yaml`
- from a container on `po-devnet`, `https://172.30.77.1:6443/version` answers `401` — reachable,
  merely unauthenticated
- a host kubeconfig exists at `~/.kube/config`, current context `default`

Because the network, the fence and the certificate SAN are all already in place, this piece
**creates no host state at all**.

## What to build

- `runArgs`: `--runtime=sysbox-runc`, `--network=po-devnet`, `--dns=1.1.1.1`, `--dns=8.8.8.8`,
  `--hostname=piano-tutor-dev`. No `--privileged`, no host docker socket.
- An `initializeCommand` script that **verifies** the prerequisites above and fails fast with a
  message naming `personal-orchestrator`'s `host-setup.sh` as the thing to run, then renders a
  read-only kubeconfig pointed at `https://172.30.77.1:6443` and bind-mounts it in.
- `kubectl` matching the cluster's `v1.36.2`, plus `helm` and `kustomize`, baked into the image.
  Exact versions, verified by checksum, per the house rules.

Read the gateway back from the docker network rather than hardcoding it in more than one place.

## Explicitly do not

- create a docker network, an iptables chain, a systemd unit, or a k3s drop-in
- restart k3s, or write anything under `/etc/rancher`
- require `sudo` for anything in this repository
- mount `/dev/snd` or otherwise give the container the piano

## Two constraints this must not break

- **`http://localhost:5173` on the host must keep working.** Web MIDI needs a secure context;
  a LAN or tailnet address is not one. VS Code forwards 5173 over the docker exec channel rather
  than over the bridge, so joining `po-devnet` does not disturb it — but verify it, do not assume.
- The container still has no access to the piano. A green e2e run says nothing about hardware.

## Prior art, and the traps it hit

`git show worktree-devcontainer-hardening:.devcontainer/scripts/init-host.sh` is the abandoned
version. Two defects reviewers found in it, worth not rediscovering: `kubectl config view
--minify` exits 1 when there is no user kubeconfig, so it needs its own guarded failure rather
than letting `set -e` abort with kubectl's bare message; and the bridge gateway ended up with two
definitions that could disagree.

Most of that branch — `host-setup.sh`, `firewall.sh` — has no equivalent here. Do not port it.

## Done when

`npm run ci` passes; the container comes up; `kubectl get nodes` works from inside it; the app is
still reachable at `http://localhost:5173` on the host. Say which of those you ran.

# Piece 4 — document the dev container as it actually ended up

The last of four pieces rebuilding the dev container work. Do this one **after** pieces 1-3 have
landed, and document what they actually built rather than what was planned.
`CLAUDE.md` is the working agreement and is loaded automatically; follow it, including the
two-reviewer pass.

## What to write

`.devcontainer/README.md`, covering how someone sets this up on a fresh machine and what the
container may and may not do. Read the committed state of pieces 1-3 first; if something was
dropped or changed along the way, the README follows the code, not this prompt.

The points that are easy to get wrong and must be right:

- **The host prerequisites are `personal-orchestrator`'s, not this repository's.** This is a
  single laptop with one k3s cluster and one dev-container network (`po-devnet`, gateway
  `172.30.77.1`, fenced by `po-devcontainer-firewall.service`). `piano-tutor` joins them and
  creates no host state of its own. Say plainly which repository owns that setup, so nobody goes
  looking for a `host-setup.sh` here.
- **`http://localhost:5173` on the host is the only URL that works.** Web MIDI is exposed only in
  a secure context; a LAN or tailnet address silently has no `navigator.requestMIDIAccess`. The
  port is `strictPort` so a collision fails loudly instead of sliding to 5174.
- **The container never talks to the piano.** No `/dev/snd`, no ALSA bridge. Playwright drives a
  fake MIDI source, so a green e2e run says nothing about real hardware — that is verified by hand
  on the host.
- The container shares the laptop's infrastructure but not its identity: git inside it cannot
  authenticate as the host user.

## Worth recording while it is known

The host runs Node v22.15.0 while `package.json` sets `engines.node >= 24`, so running
`npm ci` or `npm run ci` on the host emits `EBADENGINE` warnings. Inside the container Node is
24.20.0. Note it where someone hitting the warning will find it.

## Out of scope

Do not document anything that was not built. An earlier attempt shipped a 242-line README
describing a `pt-devnet` network, a `pt-` firewall unit and a GitHub App integration, none of
which exist. A README that describes an imagined system is worse than a short one.

## Done when

`npm run ci` passes — Prettier checks Markdown — and every instruction in the README has been
followed literally at least once to confirm it works.

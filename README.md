# piano-tutor

A TypeScript / React / Vite web app, developed inside a VS Code dev container and tested
with Vitest and Playwright.

It turns a MusicXML file into a wait-mode falling-note practice view driven by a USB
piano over the Web MIDI API: MIDI input with a device picker and a dev-only recording
mode, score parsing, the practice engine, loop selection, restart, and a saved practice
history that can be exported as JSON. See `prompts/README.md` for the plan step by step,
`DECISIONS.md` for non-obvious choices, and `MANUAL-CHECKS.md` for what to verify by hand
with the real piano.

## Opening the container

Open the folder in VS Code with the Dev Containers extension installed, then run
**Dev Containers: Reopen in Container**. The first build installs Chromium and its system
libraries into the image, so it takes a few minutes; later rebuilds reuse that layer.
`npm ci` runs automatically afterwards.

To rebuild from scratch — which is what you should do before trusting a green run — use
**Dev Containers: Rebuild Container Without Cache**.

## Scripts

Run these inside the container.

| Command                | What it does                                                   |
| ---------------------- | -------------------------------------------------------------- |
| `npm run dev`          | Vite dev server on port 5173                                   |
| `npm run build`        | Type-check with `tsc -b`, then build to `dist/`                |
| `npm test`             | Vitest, once, no watch                                         |
| `npm run test:e2e`     | Playwright; starts the dev server itself if one is not running |
| `npm run test:beyer`   | Python (stdlib) checks of the Beyer files and their fingering  |
| `npm run lint`         | ESLint                                                         |
| `npm run format:check` | Prettier in check mode — reports, never rewrites               |
| `npm run format`       | Prettier, applying the changes                                 |
| `npm run ci`           | All of the above in sequence, stopping at the first failure    |

`npm run ci` is the single entry point. Anything a CI service would eventually run
belongs in it, so that pointing one at this repository later is a small change rather
than a rewrite.

Formatting is deliberately _checked_ rather than applied silently, so that a
reformatting commit is always a decision someone made rather than a side effect of
running the tests.

## Host and container boundary

The container runs the dev server, Vitest and Playwright. It does **not** talk to the
piano.

USB MIDI reaches the browser through the Web MIDI API, and that only works in Chrome on
the **host**, which owns the USB device. The container has no access to `/dev/snd` and no
ALSA bridge, and should not be given one. Playwright's bundled Chromium exists for
automated tests, which drive a fake MIDI source rather than hardware — so a green e2e run
says nothing about whether a real piano works, and is not meant to.

That leaves one constraint worth remembering:

> Open the app at **`http://localhost:5173`** on the host, never at a LAN or tailnet IP.

Web MIDI is only available in a [secure context](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts).
`localhost` counts as one; `http://192.168.x.x:5173` or a tailnet address does not, and
the API is simply unavailable there — usually with no error more helpful than
`navigator.requestMIDIAccess` being `undefined`.

Vite is therefore configured to listen on `0.0.0.0` inside the container, with VS Code's
port forwarding presenting it to the host as `localhost:5173`. The port is `strictPort`,
so a collision fails the server rather than quietly moving to 5174 and breaking that
guarantee.

## Docker inside the container

`docker` works in the container, against a daemon of its own: sysbox-runc lets the container
run one without `--privileged` and without the host's socket, and `postStartCommand` starts it
on every container start, logging to `/var/log/dockerd.log`. What it builds and runs belongs to
that daemon — the host does not see it, and rebuilding the dev container discards it. So
`build_image.sh` below still runs on the host: the k3s import it ends with needs host root
either way.

## Deploying to k3s

`chart/` is a Helm chart that puts the built app on the k3s cluster, behind the tailscale
operator. It is installed with `helm` directly — there is no GitOps controller watching
this repository, so a deploy happens when someone runs the command below.

The cluster has no registry, so the image is imported into the node's containerd the way
personal-orchestrator's services are. Run this on the **host** — it needs root for
`k3s ctr`, which the dev container deliberately cannot have:

```sh
./build_image.sh
helm upgrade --install piano-tutor ./chart --namespace piano-tutor --create-namespace
```

That leaves the app at `https://piano-tutor.<tailnet>.ts.net`, reachable from any device
on the tailnet and from nowhere else.

`npm run ci` does not check the chart — helm is a host tool and the gate is documented to
run inside the container — so the chart's checks live here instead: `helm lint chart`, and
the same `helm upgrade` line with `--dry-run=server` to put the manifests past the API
server before anything is applied.

Re-importing a newer build changes nothing on its own; restart the deployment to pick it
up:

```sh
kubectl -n piano-tutor rollout restart deployment/piano-tutor
```

### The deployed copy can talk to a piano; the dev server still cannot

The constraint above — open the dev server at `localhost:5173`, never at a LAN or tailnet
address — is about **http**. The tailscale ingress serves the deployed app over **https**,
and any https origin is a secure context, so Web MIDI is available there. Whichever
machine's browser opens that URL is the one whose USB piano the app sees; the cluster
never touches the hardware.

## Published copy

The app is published at `https://cinash.github.io/piano-tutor/`, from the public repository
`cinash/piano-tutor`. `.github/workflows/ci.yml` runs `npm run ci` on every push and pull
request, and a push to `main` that passes is deployed to GitHub Pages. Pages serves https, so
Web MIDI works there, as on the tailnet copy.

Every commit on `main` becomes public when it is pushed, history included. New music goes in
only if its terms allow publishing it; Beyer Nos. 8-31 are published by the owner's choice
(see Licence below).

The owner pushes from the host, never from the container:

```sh
git log origin/main..main   # what is about to go out
gh auth login --hostname github.com --git-protocol https --web --scopes workflow
# answer No to "Authenticate Git with your GitHub credentials?"
git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push origin main
gh auth logout --hostname github.com
```

Never run `gh auth setup-git`: VS Code relays the host's git credentials into the dev
container, so a credential helper configured on the host is one the container can reach.

## Version pinning

Every dependency is pinned to an exact version, and every base image is pinned by digest —
the dev container's, the two the production `Dockerfile` builds from, and the one CI runs in.

Three versions have to be written in more than one place, and `npm run ci` starts by
running `scripts/check-version-lockstep.mjs`, which fails if any has drifted.

The Playwright package version and the browser build baked into the image must match, so
the check compares `package.json`, the `PLAYWRIGHT_VERSION` build argument in
`.devcontainer/Dockerfile`, the installed package and the running image.

Claude Code is installed into the image and its VS Code extension is pinned to the same
version, so the check compares `CLAUDE_CODE_VERSION` in `.devcontainer/Dockerfile`
against the pinned `anthropic.claude-code` extension in `.devcontainer/devcontainer.json`.

The Node image is named by tag and digest in `.devcontainer/Dockerfile`, in the production
`Dockerfile`'s build stage and in `.github/workflows/ci.yml`. CI runs in the dev container's
image because the screenshot baselines were rendered there, so the check compares all three.

Bumping any of them means changing every file that names it and rebuilding the container.

TypeScript is held at the 6.x line rather than 7.x: TypeScript 7 is the native compiler
rewrite, and the current `typescript-eslint` release declares support for
`>=4.8.4 <6.1.0`, so moving to 7 would mean giving up linting.

## Licence

The code is under the MIT licence, in `LICENSE`. Some of the music is not:

- Beyer Nos. 8-31 (`beyer_op101_musicxml/beyer_op101_no08.musicxml` to `no31`): their terms
  are in each file's `<rights>`.
- `cicha-noc.musicxml` is the owner's own arrangement. No licence is granted for it, nor for
  `src/score/fixtures/cicha-noc.snapshot.json`, which holds the same notes.
- The files from the PDMX dataset, `scripts/beyer/fixtures/*` and
  `beyer_op101_musicxml/beyer_op101_no38.musicxml`, are CC0.
- The rest of `src/score/fixtures/` is MIT.

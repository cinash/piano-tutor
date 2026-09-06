# piano-tutor

A TypeScript / React / Vite web app, developed inside a VS Code dev container and tested
with Vitest and Playwright.

This repository currently contains the toolchain only: a page that reads `OK`, one unit
test and one end-to-end test, wired so that the whole check suite runs from a single
command.

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

## Version pinning

Every dependency is pinned to an exact version, and the base image is pinned by digest.

Two versions have to be written in more than one place, and `npm run ci` starts by
running `scripts/check-version-lockstep.mjs`, which fails if either has drifted.

The Playwright package version and the browser build baked into the image must match, so
the check compares `package.json`, the `PLAYWRIGHT_VERSION` build argument in
`.devcontainer/Dockerfile`, the installed package and the running image.

Claude Code is installed into the image and its VS Code extension is pinned to the same
version, so the check compares `CLAUDE_CODE_VERSION` in `.devcontainer/Dockerfile`
against the pinned `anthropic.claude-code` extension in `.devcontainer/devcontainer.json`.

Bumping either means changing every file that names it and rebuilding the container.

TypeScript is held at the 6.x line rather than 7.x: TypeScript 7 is the native compiler
rewrite, and the current `typescript-eslint` release declares support for
`>=4.8.4 <6.1.0`, so moving to 7 would mean giving up linting.

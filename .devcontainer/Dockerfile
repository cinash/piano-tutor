# syntax=docker/dockerfile:1

# Node 24 "Krypton" — the current Active LTS line. Pinned to an exact patch and
# by digest, so a rebuild resolves to the same image even after the tag is
# re-pushed upstream.
FROM node:24.20.0-bookworm@sha256:be23f54a88d34e8824c741b19b91064094f92c1c97b194144bfc8b50d67258e2

# Must match the @playwright/test version in package.json. `npm run ci` starts by
# running scripts/check-version-lockstep.mjs, which fails loudly if the two drift
# apart — otherwise Playwright silently re-downloads browsers at test time.
ARG PLAYWRIGHT_VERSION=1.63.0

# Claude Code, pinned exactly like everything else. The VS Code extension in
# devcontainer.json is pinned to the same version: the extension shells out to whichever
# `claude` is on PATH, and keeping the two in step avoids debugging a mismatch that the
# marketplace introduced on its own. Bump both together; the same lockstep check
# fails if they drift.
ARG CLAUDE_CODE_VERSION=2.1.261

# The host user's identity, so files written through the bind mount are owned by
# the host user rather than by root.
ARG USER_UID=1001
ARG USER_GID=1001

ENV DEBIAN_FRONTEND=noninteractive \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    PLAYWRIGHT_VERSION=${PLAYWRIGHT_VERSION}

# The upstream image ships `node` at 1000:1000; remap it onto the host's ids.
RUN groupmod -g "${USER_GID}" node \
 && usermod -u "${USER_UID}" -g "${USER_GID}" node \
 && chown -R "${USER_UID}:${USER_GID}" /home/node

# Chromium and its system libraries are baked into the image, as root, once.
# postCreateCommand then only has to run `npm ci`, so rebuilds stay fast.
# Chromium only: the e2e tests drive a fake MIDI source, and Firefox/WebKit would
# add several hundred megabytes for nothing.
RUN npx --yes playwright@${PLAYWRIGHT_VERSION} install --with-deps chromium \
 && chmod -R a+rX "${PLAYWRIGHT_BROWSERS_PATH}" \
 && rm -rf /root/.npm /var/lib/apt/lists/*

# Claude Code, installed globally as root so it lands in the image rather than in the
# bind-mounted workspace. `~/.claude` is created here, owned by node, so that the named
# volume devcontainer.json mounts over it inherits that ownership and the login survives
# a rebuild.
RUN npm install -g "@anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}" \
 && mkdir -p /home/node/.claude \
 && chown "${USER_UID}:${USER_GID}" /home/node/.claude \
 && rm -rf /root/.npm

WORKDIR /workspace
USER node

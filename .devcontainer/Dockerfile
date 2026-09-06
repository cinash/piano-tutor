# syntax=docker/dockerfile:1

# Node 24 "Krypton" — the current Active LTS line. Pinned to an exact patch and
# by digest, so a rebuild resolves to the same image even after the tag is
# re-pushed upstream.
FROM node:24.20.0-bookworm@sha256:be23f54a88d34e8824c741b19b91064094f92c1c97b194144bfc8b50d67258e2

# Must match the @playwright/test version in package.json. `npm run ci` starts by
# running scripts/check-playwright-lockstep.mjs, which fails loudly if the two drift
# apart — otherwise Playwright silently re-downloads browsers at test time.
ARG PLAYWRIGHT_VERSION=1.63.0

# Kubernetes tooling for the k3s cluster on the host. kubectl tracks the cluster's own
# version. Each download is pinned by sha256 as well as by version, for the same reason
# the base image is pinned by digest: a re-published artifact should fail the build rather
# than change it silently. Refresh a checksum only alongside the version above it.
ARG KUBECTL_VERSION=v1.36.2
ARG KUBECTL_SHA256=1e9045ec32bea85da43de85f0065358529ea7c7a152eca78154fba5b58c27d82
ARG HELM_VERSION=v4.2.4
ARG HELM_SHA256=c306b46f719b0a4da32d0f78ee21bf90ce8d602f15b22ab753f0674d1670a7f3
ARG KUSTOMIZE_VERSION=v5.8.1
ARG KUSTOMIZE_SHA256=029a7f0f4e1932c52a0476cf02a0fd855c0bb85694b82c338fc648dcb53a819d

# The host user's identity, so files written through the bind mount are owned by
# the host user rather than by root.
ARG USER_UID=1001
ARG USER_GID=1001

ENV DEBIAN_FRONTEND=noninteractive \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    PLAYWRIGHT_VERSION=${PLAYWRIGHT_VERSION}

# The upstream image ships `node` at 1000:1000; remap it onto the host's ids.
#
# ~/.kube is created here rather than left to docker, which would create it root-owned
# under the kubeconfig bind mount and leave kubectl unable to write its discovery cache.
RUN groupmod -g "${USER_GID}" node \
 && usermod -u "${USER_UID}" -g "${USER_GID}" node \
 && mkdir -p /home/node/.kube \
 && chown -R "${USER_UID}:${USER_GID}" /home/node

# Chromium and its system libraries are baked into the image, as root, once.
# postCreateCommand then only has to run `npm ci`, so rebuilds stay fast.
# Chromium only: the e2e tests drive a fake MIDI source, and Firefox/WebKit would
# add several hundred megabytes for nothing.
RUN npx --yes playwright@${PLAYWRIGHT_VERSION} install --with-deps chromium \
 && chmod -R a+rX "${PLAYWRIGHT_BROWSERS_PATH}" \
 && rm -rf /root/.npm /var/lib/apt/lists/*

# fetch <url> <file> <sha256> — download and refuse to continue unless it matches, so the
# checksum discipline is written once rather than per tool.
#
# --no-same-owner because these archives carry a non-root uid: without it the extracted
# binaries land in /usr/local/bin owned by that uid, leaving the container's own user able
# to overwrite the tools it runs. Both tarballs ship mode 0755; kubectl, downloaded bare,
# gets its mode from `install`.
RUN set -eux; \
    fetch() { curl -fsSL "$1" -o "$2"; echo "$3  $2" | sha256sum -c -; }; \
    mkdir /tmp/dl; cd /tmp/dl; \
    fetch "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/amd64/kubectl" \
        kubectl "${KUBECTL_SHA256}"; \
    install -m 0755 kubectl /usr/local/bin/kubectl; \
    fetch "https://get.helm.sh/helm-${HELM_VERSION}-linux-amd64.tar.gz" \
        helm.tgz "${HELM_SHA256}"; \
    tar --no-same-owner -xzf helm.tgz --strip-components=1 -C /usr/local/bin linux-amd64/helm; \
    fetch "https://github.com/kubernetes-sigs/kustomize/releases/download/kustomize%2F${KUSTOMIZE_VERSION}/kustomize_${KUSTOMIZE_VERSION}_linux_amd64.tar.gz" \
        kustomize.tgz "${KUSTOMIZE_SHA256}"; \
    tar --no-same-owner -xzf kustomize.tgz -C /usr/local/bin kustomize; \
    cd /; rm -rf /tmp/dl

WORKDIR /workspace
USER node

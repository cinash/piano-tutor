# Both images are named by their registry, because build_image.sh builds with podman, and
# podman resolves no unqualified FROM unless the host configures a search registry.
FROM docker.io/library/node:24.20.0-bookworm@sha256:be23f54a88d34e8824c741b19b91064094f92c1c97b194144bfc8b50d67258e2 AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# `npm run build` emits a static bundle with no server side and no runtime configuration,
# so nginx's stock config — serve /usr/share/nginx/html on port 80 — is the whole server.
FROM docker.io/library/nginx:1.31.5-alpine@sha256:72ba65eb42c10344912a84ff42408db7d34f2feb642204570ab8fc5ffd29f1d3

COPY --from=build /app/dist /usr/share/nginx/html

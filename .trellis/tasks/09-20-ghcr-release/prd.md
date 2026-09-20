# GHCR Docker release and compose deploy

## Goal

Publish Cuepoint as a container on GitHub Container Registry and document a one-file `docker compose` deploy so a host can pull and serve the SPA.

## Background

- Repo: `https://github.com/ROYIANS/Cuepoint` — Vite + React SPA, Dexie in the browser, no app server.
- No Dockerfile / `.github/workflows` exist today.
- AI keys stay in the browser (BYOK). The image must not require API secrets.

## Requirements

- **R1** Multi-stage `Dockerfile`: `pnpm build` then `nginx` serving `dist` with SPA `try_files` fallback to `index.html`.
- **R2** GitHub Action on `main` (tag `latest`) and `v*` tags (semver tags); `workflow_dispatch` allowed. Push to `ghcr.io/royians/cuepoint` with `GITHUB_TOKEN` (`packages: write`).
- **R3** `docker-compose.yml` maps host `8080` → container `80` and uses that image.
- **R4** README explains pull/login (GHCR) and `docker compose up -d`.
- **R5** `.dockerignore` keeps the build context small (`node_modules`, `.git`, `dist`, Trellis workspace noise).

## Out of scope

- Kubernetes / Helm
- HTTPS termination inside the image (use a reverse proxy in front)
- Baking connector keys into the image
- Changing app runtime or adding a backend

## Acceptance Criteria

- [ ] `docker build` produces an image that serves the SPA (client routes do not 404).
- [ ] Workflow file is valid and uses official docker/* actions + GHA cache.
- [ ] Compose file can start with `docker compose up -d` after `docker login ghcr.io`.
- [ ] README deploy section names the image and port.

## Decisions (locked)

| Decision | Choice |
| --- | --- |
| Image | `ghcr.io/royians/cuepoint` |
| Triggers | `main` → `latest`; `v*` → semver; manual dispatch |
| Serve | nginx alpine, port 80 |
| Compose host port | 8080 |
| Secrets in image | none |

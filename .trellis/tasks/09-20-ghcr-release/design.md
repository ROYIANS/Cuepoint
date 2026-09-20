# Design — GHCR release

## Image

```
node:22-bookworm-slim  →  pnpm install --frozen-lockfile && pnpm build
nginx:1.27-alpine      →  /usr/share/nginx/html = dist
```

`corepack enable` to match `packageManager: pnpm@10.15.0`.

`deploy/nginx.conf` replaces default server:

- `try_files $uri $uri/ /index.html;`
- gzip for js/css/svg/json
- long cache for hashed assets; no-cache `index.html`

## CI

`.github/workflows/ghcr.yml`:

- `permissions: contents: read, packages: write`
- `docker/login-action` → `ghcr.io` / `github.actor` / `GITHUB_TOKEN`
- `docker/metadata-action` tags: `latest` on default branch, semver on tags, `sha`
- `docker/build-push-action` + GHA cache

Package visibility follows the GitHub repo (public repo → public package after first push, or owner sets visibility).

## Compose

Root `docker-compose.yml`:

```yaml
services:
  cuepoint:
    image: ghcr.io/royians/cuepoint:latest
    ports:
      - "8080:80"
    restart: unless-stopped
```

Optional `build: .` is omitted so deploy machines pull GHCR by default; README mentions `docker compose build` only for local image iteration.

## Docs

README section「部署」: login, pull, compose, open `http://localhost:8080`.

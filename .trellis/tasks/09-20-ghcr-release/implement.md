# Implement — GHCR release

1. `Dockerfile`, `.dockerignore`, `deploy/nginx.conf`
2. `.github/workflows/ghcr.yml`
3. `docker-compose.yml`
4. README「部署」section
5. Do not run a full `docker build` unless the environment has Docker; lint does not cover YAML.

## Validation

- Workflow YAML uses official actions and lowercase GHCR image name.
- nginx config has SPA fallback.
- Compose image + `8080:80`.

## Risky files

- Dockerfile `COPY` order must stay `package.json` + lockfile first for layer cache.

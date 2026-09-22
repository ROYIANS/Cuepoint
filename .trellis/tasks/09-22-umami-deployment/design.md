# Design

GitHub Actions repository variables `VITE_UMAMI_SCRIPT_URL` and `VITE_UMAMI_WEBSITE_ID` flow into the quality build environment and Docker build arguments. Build-stage Docker arguments are available to Vite; only the generated static assets reach the Nginx runtime image. These values are public tracker configuration, not secrets.

The application entry calls a small analytics helper only in production. The helper validates the configured HTTP(S) script address, requires both fields, and appends one asynchronous script with `data-website-id`. Umami handles History API navigation itself. Script failures must not block React startup. There are no router subscriptions, custom events, new dependencies, runtime configuration endpoints, or self-hosted analytics containers.

Boundaries: `src/main.tsx`, `src/lib/umami.ts`, and `src/vite-env.d.ts` own browser initialization; `.github/workflows/ghcr.yml` and `Dockerfile` own build propagation; `.env.example`, ignore rules, README and deployment documentation own setup guidance. Tests cover initialization behavior. Existing agent/audio changes are unrelated and must remain intact.

Rollback: clear either repository variable, rerun the publication workflow, pull the new image and recreate Cuepoint. Compose remains unchanged.

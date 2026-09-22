# Implementation

- [x] Add a production-only tracker initializer, environment typings, and focused behavioral tests.
- [x] Pass repository variables to Vite builds and Docker build arguments.
- [x] Add local configuration example and exclude local environment files from Git and image contexts.
- [x] Document GitHub configuration, website ID, rebuild/redeploy, local builds, and verification.
- [x] Run typecheck, focused/full tests, model snapshot verification, production builds and Compose validation.
- [x] Review the configuration flow and record verification results and deployment limitations.

## Verification

- Typecheck passed.
- Focused Umami tests: 19 passed.
- Full Vitest suite: 117 files, 1,399 tests passed.
- Model bank snapshot verification passed (197 files, 85 providers, 1,855 models).
- Production build with a synthetic tracker URL and website UUID passed; generated entry bundle contained the exact configuration and initializer.
- Production build with both variables empty passed; synthetic settings were absent. Executed the generated initializer in an isolated JavaScript context and verified it returns without any DOM access. The bundler retains the function because of string trimming, but it cannot inject a tracker with empty settings. This disabled build is the final local dist output.
- Both builds emitted the existing large-chunk advisory; neither failed.
- Parsed GitHub workflow YAML and verified both variables match across quality build environment, Docker build arguments, and build-stage ARG declarations.
- `docker compose config --quiet` and `git diff --check` passed. Compose and Nginx config are unchanged.
- Docker daemon is unavailable locally, so no image build or container startup was executed. No live Umami service ingestion was tested because the real URL/website ID were not supplied.
- Repository variables, remote publication, and production deployment remain operator steps documented in README; no credentials were requested or stored.

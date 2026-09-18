# Implementation plan

1. Complete final planning review; curate spec/research manifests if dispatching, then start the task. Load `trellis-before-dev` before product edits.
2. Extend connector definition/capabilities without a database migration.
3. Implement metadata/schema discovery, read-only probe, upload, image/video submit and task query with runtime decoding and injectable fetch.
4. Integrate connection-page behavior and APIMart chat category filtering; keep generation entry points deferred.
5. Add meaningful contract tests for representative image/video bodies, multiple task IDs, every query state, URL collections/expiry, invalid envelopes, provider errors, abort and no submission retries. Cover connector persistence/ZIP secret exclusion where needed.
6. Run `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm lint`, then `test` and `build` with the same explicit executable.
7. Review the entire diff for credential leakage, existing-provider regressions and scope drift. Update product/spec docs with exported contracts and runtime follow-ups.

## Completion record

Steps 1–7 completed. Client and integration code, contract tests, connector docs and frontend AI connector spec are in place. Full-scope check agent reported no remaining concrete findings; lint, 164 tests and build pass. Browser smoke checked APIMart install and empty-key validation. The user authorized committing this work on 2026-09-18. See `verification.md` for limits.

## Gates

Approved R8 follow-up: extend provider discovery to retain incompatibility metadata; share selection policy between suggestions/manual/saved options; show old-model warning; gate send before mutations and transport; add regression tests; repeat full-scope check and update verification. Parent owns docs/spec; implement worker owns feature code/tests.

R8 follow-up completed and independently reviewed. Final checks: lint pass, 21 test files / 187 tests pass, build pass, diff check clean. See `verification.md`. The user authorized the final commit on 2026-09-18.

- No scheduler, job table, slot mutation or generation UI in this task.
- No dependency upgrade without an established implementation need.
- No paid live generation as a connectivity probe; distinguish fixture coverage from live validation.
- Preserve the pre-existing untracked `.tanstack/` directory.
- Final summary approved by the user with “ook”; task activated for implementation.

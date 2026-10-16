# E08 staged implementation plan

Status: approved and active after the 2026-10-16 platform decision. Keep stages
small enough to checkpoint and commit independently; do not run the full package or
installer gate until every source stage is complete.

## Stage 0 — activation and contracts

- [x] Record macOS + Windows scope, Windows NTFS baseline, derivative-row choice and
  decoder distribution caveat in `PRD.md` and `design.md`.
- [x] Curate `implement.jsonl` and `check.jsonl` with the relevant native, storage,
  media-library, Agent-tool and quality specs before dispatch.
- [x] Activate this task on `codex/desktop-workspace-media` and checkpoint the plan.

## Stage 1 — native grant, scan and operation owner

- [ ] Add native state and closed commands for directory picker, bounded recursive
  scan, paged results, revoke and operation status/cancel.
- [ ] Add the independent media process owner with frozen-copy input, fixed decoder
  argv, bounded output/logs, macOS process-group cleanup and the chosen Windows
  child/tree promise.
- [ ] Register normal and isolated/acceptance handlers, ACLs and capabilities without
  broad filesystem or shell permission.
- [ ] Add focused Rust tests for grant scope, reparse/alias rejection, changed-file
  rejection, cancellation/reap state and unsupported Windows volumes.
- [ ] Check the source changes, fix findings, commit the stage.

## Stage 2 — managed claims and shared import command

- [ ] Add the trusted prepared-claim adoption seam to the existing native transaction;
  reject foreign/stale/unregistered references and preserve unknown commit certainty.
- [ ] Add the desktop media import service and library command shared by human and
  Agent callers. Commit original media, derivative thumbnail, provenance and stable
  receipt atomically in the existing ProductStore.
- [ ] Add derivative-media closure to retention/orphan cleanup, picker/preview,
  project copy/reuse and package round-trip owners.
- [ ] Add focused Studio storage/library tests for claim adoption, rollback,
  idempotence, concurrent edits, derivative lifecycle and package mapping.
- [ ] Check the source changes, fix findings, commit the stage.

## Stage 3 — Agent tools and interaction surface

- [ ] Add a finite `desktop-media` read/prepare/import tool group with exact scope,
  approval and frozen-preview rules. Keep native work outside atomic DB callbacks.
- [ ] Wire the shared controller into the existing media library and Agent result
  surface: immediate selection acknowledgement, real progress, one Stop, truthful
  failed/unknown/committed outcomes, no drawer/navigation or transient technical
  captions.
- [ ] Add focused tool-loading, preview, report and UI tests, including browser
  unavailable behavior and duplicate/late-stop guards.
- [ ] Check the source changes, fix findings, commit the stage.

## Stage 4 — decoder resources and host validation

- [ ] Resolve the decoder candidate, obtain reviewable source/license materials and
  per-target digest manifest; add startup integrity checks and macOS/Windows resource
  mapping while preserving Linux release configuration.
- [ ] Run only the necessary target-specific source/native tests and a deterministic
  fixture workflow on available hosts. Record Windows runtime/packaging evidence as
  pending when this macOS host cannot execute it.
- [ ] Check the complete source closure and update specs with durable contracts.
- [ ] Record full build/package/emitted/live gates for the owner's end-of-epic batch
  acceptance, and commit this task's final source integration checkpoint. Do not run
  those gates merely because E08 source stages are complete.

## Validation commands

Use the machine pnpm path explicitly. During stages, run only affected finite source
tests and scoped type/lint checks, for example:

```sh
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec vitest run --config vitest.studio-source.config.ts <affected-files>
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec tsc --project tests/typecheck/tsconfig.studio-agent-source.json --pretty false
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec eslint <affected-source-files>
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/node apps/desktop/scripts/tools.mjs cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml <target>
```

The exact native command must use the repository tool resolver and a bounded target;
do not claim Windows execution from a macOS run. The final epic batch gate will add full
build/package/emitted checks only after all requested tasks are done.

## Review and rollback gates

Every stage ends with `trellis-check`, a focused source check, a commit, a journal
entry and an updated task checklist. A failed review keeps the task active and fixes
the current stage; it does not start a second branch or silently broaden scope. A
rollback removes only uncommitted stage edits or restores the last checkpoint; it
never deletes confirmed user media or rewrites unknown native outcomes.

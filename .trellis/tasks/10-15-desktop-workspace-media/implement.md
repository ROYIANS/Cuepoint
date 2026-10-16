# E08 staged implementation plan

Status: approved and active after the 2026-10-16 platform decision. Keep stages
small enough to checkpoint and commit independently; do not run the full package or
installer gate until the entire selected epic batch is complete.

## Stage 0 — activation and contracts

- [x] Record macOS + Windows scope, Windows NTFS baseline, derivative-row choice and
  decoder distribution caveat in `PRD.md` and `design.md`.
- [x] Curate `implement.jsonl` and `check.jsonl` with the relevant native, storage,
  media-library, Agent-tool and quality specs before dispatch.
- [x] Activate this task on `codex/desktop-workspace-media` and checkpoint the plan.

## Stage 1 — native grant, scan and operation owner

- [x] Add native state and closed commands for directory picker, bounded recursive
  scan, paged results, revoke and operation status/cancel.
- [x] Add the independent media process owner with frozen-copy input, fixed decoder
  argv, bounded output/logs, macOS process-group cleanup and the chosen Windows
  child/tree promise.
- [x] Register normal and isolated/acceptance handlers, ACLs and capabilities without
  broad filesystem or shell permission.
- [x] Add focused Rust tests for grant scope, reparse/alias rejection, changed-file
  rejection, cancellation/reap state and unsupported Windows volumes.
- [x] Check the source changes, fix findings, commit the stage.

Stage 1 source/native checkpoint: `52e584c7` (native grants/processes and pinned
decoder resources). Desktop-focused Rust tests **13 passed**, one
explicit-resource fixture ignored in that command; the real bundled FFmpeg fixture
ran separately and passed. Decoder/release source checks passed. Windows execution
and system-picker/installed acceptance remain in the final epic batch gate.

## Stage 2 — managed claims and shared import command

- [x] Add the trusted prepared-claim adoption seam to the existing native transaction;
  reject foreign/stale/unregistered references and preserve unknown commit certainty.
- [x] Add durable library admission/publication commands shared by human and
  Agent callers. Commit original media, derivative thumbnail, provenance and stable
  receipt atomically in the existing ProductStore.
- [x] Add derivative-media closure to retention/orphan cleanup, picker/preview,
  project copy/reuse and package round-trip owners.
- [x] Add focused Studio storage/library tests for claim adoption, rollback,
  idempotence, concurrent edits, derivative lifecycle and package mapping.
- [x] Check the source changes, fix findings, commit the stage.

Stage 2 checkpoint: `2b00d8e5`. Source review: the six foundation Studio suites passed **53 tests**;
scoped foundation lint had **0 errors, 44 warnings**. Exact approval, unknown-claim
retention and derivative closure findings were fixed before this checkpoint.

## Stage 3 — Agent tools and interaction surface

- [x] Add a finite `desktop-media` read/prepare/import tool group with exact scope,
  approval and frozen-preview rules. Keep native work outside atomic DB callbacks.
- [x] Wire the native transport and shared import coordinator into the existing
  media library and Agent result surface: immediate selection acknowledgement, real progress, one Stop, truthful
  failed/unknown/committed outcomes, no drawer/navigation or transient technical
  captions.
- [x] Add focused tool-loading, preview, report and UI tests, including browser
  unavailable behavior and duplicate/late-stop guards.
- [x] Check the source changes, fix findings, commit the stage.

## Stage 4 — decoder resources and host validation

- [x] Resolve the decoder candidate, obtain reviewable source/license materials and
  per-target digest manifest; add startup integrity checks and macOS/Windows resource
  mapping while preserving Linux release configuration.
- [x] Run only the necessary target-specific source/native tests and a deterministic
  fixture workflow on available hosts. Record Windows runtime/packaging evidence as
  pending when this macOS host cannot execute it.
- [x] Check the complete source closure and update specs with durable contracts.
- [x] Record full build/package/emitted/live gates for the owner's end-of-epic batch
  acceptance, and commit this task's final source integration checkpoint. Do not run
  those gates merely because E08 source stages are complete.

Stage 3 checkpoint: `ca2da1a5`. Source closure: actual ReactDOM interaction, strict transport/tool parsers
and shared-store workflow regressions passed. Final focused native review passed
**16 tests** plus one resource-dependent ignored fixture; the real FFmpeg fixture
ran separately. Whole changed-scope architecture had **669 files**, **2,635 static
and 14 dynamic edges**, **0 static cycles and 0 failures**. Strict E08 source and
Node typechecks passed. Final implementation evidence is consolidated in
`research/implementation-validation.md`; actual other-host/installed acceptance
remains deferred, so the task remains open for the epic batch gate.

## Validation commands

Use the machine pnpm path explicitly. During stages, run only affected finite source
tests and scoped type/lint checks, for example:

```sh
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec vitest run --config vitest.desktop-media-source.config.ts <affected-files>
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec tsc --project tests/typecheck/tsconfig.desktop-media-source.json --pretty false
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec eslint <affected-source-files>
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/node apps/desktop/scripts/tools.mjs cargo test --manifest-path /Users/xiaomengdao/WebstormProjects/aifenjing/apps/desktop/src-tauri/Cargo.toml --features desktop desktop_media -- --nocapture
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

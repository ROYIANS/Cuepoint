# E09 staged implementation and validation plan

Status: approved and active on 2026-10-16. Each stage ends with scoped check/review,
fixes, a commit and updated task/journal evidence. No remote push.

## Stage 0 — review and activate

- [x] Review the concrete PRD/design, especially text-only resources, device-wide
  scope, manual immutable updates and native Windows fixed-NTFS source baseline.
- [x] Confirm requirement convergence and all context entries resolve; read full
  scoped native/storage specs, including tails beyond injection limits.
  Context validation warns that `native-product-runtime.md` and
  `quality-guidelines.md` exceed the per-file injection cap; dispatched agents
  must explicitly read their omitted tails rather than rely on injected excerpts.
- [x] Record implementation approval and activate E09 without marking E08's
  deferred Windows/installed acceptance complete. Select a `codex/` branch suitable
  for continuing from the actual E08 source checkpoints; no base reset or lost work.
- [x] Load `trellis-before-dev` before editing each new package/layer.

## Stage 1 — portable document and installed version owner

- [x] Add pure neutral skill descriptors/validation/catalogue/resource contracts
  behind the current core public root; preserve no-runtime-dependency boundary.
- [x] Add explicit Studio YAML dependency using the approved machine pnpm only;
  verify actual bounded parser options, including pre-conversion alias/tag/depth
  rejection. No handcrafted general YAML parser or undeclared transitive imports.
- [x] Add strict text candidate validation, deterministic byte identity and
  install/update/enable/disable/uninstall commands over deviceSettings keys.
- [x] Store manifest, body and each resource in separate immutable device-setting
  rows so body loads do not hydrate unrelated resources; one retention entry owns
  the complete revision group. Add compare-and-set operation reconciliation;
  exact serialized limits, total quotas and known/unknown certainty are enforced
  by the owning transaction, with no independent per-feature store.
- [x] Validate malformed inputs, path collisions, quota edges, conflict/update,
  fault rollback and uncertain-commit readback. Exercise neutral helpers from an
  independent host fixture via public exports.
- [x] Run necessary scoped checks/review, fix findings and commit.

## Stage 2 — native/browser bounded import and management

- [x] Add separate trusted native picker/snapshot service for macOS/Windows; no
  arbitrary path parameter, broad filesystem permission or media-grant widening.
  Register normal and isolated handler/ACL/transport closure together.
- [x] Capture bounded UTF-8 text through reviewed containment/identity primitives;
  reject links/reparse/unsupported volume/changed files, bound traversal before
  reading huge trees and preserve truthful picker cancellation.
- [x] Browser directory FileList import uses the same logical-root validation and
  parser. Capability detection provides explicit unsupported behavior.
- [x] Add Agent-owned list/detail/import-review ContextPanel, plus-menu quick
  switches and explicit enable choice; view/update/uninstall retain chat and
  existing editor departure guards. Avoid permanent composer clutter.
- [x] Verify actual ReactDOM pending/error/reconciliation and wide/narrow return,
  no duplicate action, safe content rendering and no redundant success/captions.
- [x] Run necessary affected transport/native/source checks/review and commit.

## Stage 3 — run snapshots, progressive reads and retained lifecycle

- [x] Capture metadata/revision references and counts atomically with run admission;
  preserve retry/resume/legacy/conversation behavior and shared preview/budget.
- [x] Add fixed read-only load/resource tools with strict parsers and actual
  offered-definition integration, within the existing 36-tool/two-group limits.
- [x] Return requested content through durable attributed tool results; keep
  builtin refresh/compaction and both protocol suffixes correct.
- [x] Release pins in actual run-deletion lifecycle owners using their exact
  transaction; collect only unreferenced noncurrent revisions. Current project
  deletion retains chats/runs and their pins; preserve that behavior.
- [x] Exercise installation changes during held model/approval/read boundaries,
  reopen/retry, missing/corrupt versions, permission-escalation denial, late Stop
  and deletion without resurrection. No live/paid model request is required.
- [x] Add a small portable creative-workflow example using existing tools, such
  as E08 media organization, with explicit desktop/tool availability requirements.
  The example grants no extra authority and is not silently installed/enabled.
- [x] Run necessary affected checks/review, capture durable specs and commit.

## Necessary validation execution

Use `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm` and the matching machine
Node. Do not use bare/runtime pnpm, reinstall the workspace, or run aggregate scripts
that build all Agent packages just to test a source change.

During implementation create/register a finite `vitest.installable-skills-source.config.ts`
and a matching source-only noEmit type profile using the existing exact public
source export aliases. Add only meaningful affected fixtures to it; use explicit
file arguments for each stage. These are planned filenames, not current artifacts
or checks already performed.

```sh
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec vitest run --config vitest.installable-skills-source.config.ts <affected-test-files>
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec tsc --project tests/typecheck/tsconfig.installable-skills-source.json --pretty false
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec eslint <affected-source-files>
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/node apps/desktop/scripts/tools.mjs cargo test --manifest-path /Users/xiaomengdao/WebstormProjects/aifenjing/apps/desktop/src-tauri/Cargo.toml --features desktop skill_import -- --nocapture
```

The native test filter above must name the actual implemented module; fail on
zero matched tests rather than recording it as proof. Run targeted architecture
discovery if ownership/public exports change. Before each commit, stage only the
reviewed scope and run `git diff --cached --check`, including new sources.

| Requirement/AC | Minimum meaningful evidence |
| --- | --- |
| R1 / AC1 | Actual model/tool requests and both protocol chains through refresh/compaction. Storage-spy fixtures reject body/resource reads during discovery and unrelated resource reads during body/selected-resource loading. |
| R2 / AC2,AC4 | Real ProductStore catalogue/content/count CAS transactions with late fault rollback, same-name/manual-update behavior and uncertain readback. |
| R3 / AC3 | Host call attempts from a skill result cannot enable disabled tools or grant native/paid/MCP effects; unsafe logical/native paths reject before read. |
| R4 / AC2,AC5 | Held update/uninstall/run-admission races; retry/reopen and thread deletion verify exact bytes/reference release; project deletion retains surviving chat pins. |
| R5 / AC6 | Real UI held pending/failure, guarded panel replacement, narrow return/focus and unchanged running chat owner. |
| R6 / AC4,AC7 | Parser/UTF-8/quotas/path identity boundary cases and independent public-root consumer without product imports. |

## Deferred epic batch acceptance

Full root regression/formal quality, production build, emitted declarations,
offline packed consumer, full native integration, release resource/installer
closure and actual macOS/Windows installed picker/UI flow run at the owner's
end-of-epic cadence. Actual other-host/platform behavior remains explicitly pending
when unavailable; compilation and deterministic callback fixtures are narrower
evidence. E08's pending native/installed media acceptance remains recorded under
its own task and is not discharged by E09 tests.

## Review and rollback concerns

Risky owners: `agentRuns.ts`, Agent lifecycle/project cascades, context preview/
compaction, offered-tool budgeting, native trusted-window/handler registration,
and exact source/export/lockfile discovery. Reuse actual command/transaction owners;
do not copy their policy into the skills feature. Missing content/count corruption
fails explicitly. A failed review fixes the current stage before proceeding; a
rollback never erases installed or retained user data to make tests pass.

## Source delivery result — 2026-10-16

All three implementation stages are source-complete and independently reviewed.
Stage 1 was committed as `0c7b8b10`; Stage 2 as `e7a5c8ff`; Stage 3 was committed as `0449ed6f`. Necessary source checks pass; the task remains
active for the explicitly deferred epic batch and actual-host acceptance.
No native Windows execution/cross-compilation, actual installed system picker,
emitted/packed consumer or production packaging result is claimed.

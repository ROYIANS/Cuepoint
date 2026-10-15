# Hosted cold-probe correction boundary

Date: 2026-10-12. Baseline: f4d02530744e2c74db6769a67baba08b9a32d318.
Status: implementation and independent review complete; local commit review next.

## Reached failure and required behavior

The owner supplied a hosted full-test failure: six files and 92 native cases
fail with ENOENT for `desktop/tauri/.tools/target/debug/product_store_probe`.
The remaining 222 files/3,863 cases pass and seven cases are explicitly skipped.
The failure log is preserved verbatim at logs/ci-probe-readiness/owner-hosted-failure.txt.

Root tests include actual Rust SQLite bridge cases. Their executable must be
built with locked dependencies and the intended no-GUI test feature before
Vitest starts on a fresh runner. Local existing generated output is not a
workflow prerequisite. Every workflow running the complete root suite must
establish this prerequisite and bind tests to the actual resolved executable.

## Ownership and scope

The implementer owns the narrow readiness build/test entry and workflow ordering,
plus meaningful regression coverage. The read-only explorer audits all root-test
workflow callers and tool/profile interactions. Root owns task metadata,
executable specs, English distribution documentation and later commit review.
An independent check agent will verify the resulting correction.

Reuse the current native tool resolver/probe builder where possible. Preserve
all SQLite tests/assertions, failure authority, package feature isolation,
versions, image/release permissions and triggers. No product schema, runtime
business behavior, paid request, old-data migration, installer build or remote
mutation belongs in this correction. This local fix does not close hosted H1a.

## Implemented result

One shared preparation CLI and build/path helper are wired before full root
tests in both quality jobs. Fresh Node24 and Node22 actual builds/readiness
pass; the complete Node22 suite passes 228 files/3,955 tests with unchanged
opt-in skips and 1,021 frozen inputs. The independent review checks the complete
changed flow and finite limits. Specs capture the cold-job prerequisite.
Owner push and actual hosted reexecution remain pending; the task stays active.

# Desktop installer and draft-release contract

## 1. Scope / Trigger

Read before modifying desktop build tools, installer packaging, external product
smoke, artifact receipts or `.github/workflows/desktop-release.yml`. The normal
installer ships the shared React/business/Agent product with `product-sqlite`.
Keep [Native Product Runtime](./native-product-runtime.md),
[Shared Product Storage](./shared-product-storage.md) and filesystem certainty
contracts authoritative. Reference IndexedDB and fixture acceptance are distinct
lanes, never a normal-product fallback. These contracts describe source behavior;
actual corresponding-host acceptance remains a separate recorded gate.

## 2. Signatures / Owners

Owners are `desktop/tauri/scripts/tool-resolver.mjs`, `release-policy.mjs`,
`build-release.mjs`, `release-artifacts.mjs`, `finalize-release.mjs`,
`collect-release.mjs`, `publish-draft.mjs`, the dedicated workflow, and the external
`scripts/release-product-smoke.mjs` / `verify-release-smoke-store.py` harness.

```text
build:release --target TARGET --output FRESH_ABSOLUTE_DIRECTORY
finalize-release.mjs --receipt PATH --checks PATH [--checks PATH ...]
collect-release.mjs --input PATH --selection PATH --output FRESH_ABSOLUTE_DIRECTORY
publish-draft.mjs --directory PATH
release-product-smoke.mjs --target TARGET --package PATH --receipt PATH --evidence-dir FRESH_DIRECTORY
```

`TARGET` is closed to `macos-arm64`, `macos-x64`, `windows-x64`, `linux-x64`.
The first two each own one DMG; Windows owns one NSIS EXE; Linux owns one AppImage
and one DEB. The collector requires four targets and five installers.

## 3. Contracts: tools, source, checks and publication

Local Mac mode resolves the user's explicitly approved pnpm path and the
workspace-local Rust homes. Hosted mode is explicit (`CUEPOINT_TOOL_MODE=hosted`)
and receives absolute approved `CUEPOINT_CARGO_PATH`, `CUEPOINT_RUSTC_PATH`,
`CUEPOINT_RUSTUP_PATH`, `CUEPOINT_RUSTFMT_PATH` and `CUEPOINT_PNPM_PATH`.
Pinned versions are Node24.11.0, pnpm10.15.0, Rust1.99.0 and TauriCLI2.12.1.
Reject Codex runtime tool paths. On Windows invoke the pinned pnpm JavaScript
entry through Node, retaining argument boundaries; do not enable a shell or
interpolate paths into command strings. Native probe resolution honors the
explicit target directory/triple and `.exe` suffix.

`build-frontend.mjs` owns the frontend-only Node old-space budget: it spawns the
same Node executable with `--max-old-space-size=4096` and the unchanged Vite
configuration in `build-frontend-worker.mjs`. All package/app/release/native-check
callers enter this launcher. Passing a heap flag only to a parent Node process
does not configure a separately spawned Node child. Preserve argv, cwd,
environment, inherited output and nonzero/signal failure; no shell or global
Vitest/Rust budget. Node24 percentage heap options override a numeric budget, so
a conflicting `NODE_OPTIONS` percentage option fails explicitly. A measured local
build is evidence for its host only; retain peak memory/duration and validate
against corresponding runner resources before claiming hosted success.

Root quality runs real Rust SQLite bridge tests before the platform matrix.
Its own job must install pinned Rust and call the shared
`scripts/prepare-native-test-probe.mjs` with actual Cargo/rustc paths, a fresh
target/evidence directory and `GITHUB_ENV` before the full root suite. The probe
must build locked with no default features/test-hooks, acknowledge ready/close
and exit before its exact path is exported. GHCR's full root suite has the same
prerequisite while retaining Node22. Follow the executable cold-test contract
in [Quality Guidelines](./quality-guidelines.md); downstream native matrix
setup, warm ignored output and skipped native assertions are insufficient.

Normal product identity is Cuepoint / `dev.cuepoint.prototype.offline` /
`cuepoint-prototype`, profile normal, storage sqlite, features product-sqlite.
Visible branding retains the dark PNG/ICO/ICNS assets. Versions in root package,
desktop package, Cargo and Tauri config must match a numeric three-part version;
a tag must be `desktop-v<that version>`. Mac minimum is14, ad-hoc signing and no
notarization; Windows is unsigned; Ubuntu22.04 is the Linux build baseline.
No updater, signing credential or old-data importer belongs in this lane. Windows
uses the explicitly owner-approved regular-file flush / NTFS no-overwrite /
process-recovery contract; new namespace survival after sudden OS crash or power
loss is unpromised. Actual corresponding-host checks remain required.

Windows `pin_directory` opens an ordinary local NTFS directory with
`FILE_LIST_DIRECTORY | FILE_READ_ATTRIBUTES`, read/write sharing and no delete
sharing, retaining no-follow/backup flags and real handle identity checks.
Metadata-only `FILE_READ_ATTRIBUTES` opens do not participate in the required
sharing conflict and therefore cannot enforce a rename/delete guard. Keep
ordinary stat inspection metadata-only with delete sharing. Require real
DELETE-access/rename rejection while pinned and success after release on Windows;
cross-compilation or Unix tests do not prove these Win32 semantics.

Eligible release builds require a clean exact checked source commit, native
host/architecture, verified tool versions, a fresh output and fresh bundle
namespace. Snapshot tracked source hashes before/after packaging. Never seal an
eligible receipt from a dirty candidate build, stale installer or fixture
frontend. Local pre-commit candidate app checks stay separately labeled.

The pinned Tauri CLI patches bundle-type markers into Windows/Linux executables
and restores the unpatched build executable afterward. This release lane passes
`--no-binary-patching`, keeping the recorded executable hash equal to each
installed/extracted payload. The updater is outside this lane. On Mac request
`app,dmg` internally so Tauri retains the signed `.app` for hash verification;
only the DMG is an eligible downloadable asset. Do not add `.app` as a sixth
installer or substitute an unverified post-build executable hash.

A receipt begins `state: building` and can become `verified` only with the exact
required actual native/storage/payload checks. It records policy hash, immutable
repository/workflow/source/run/attempt/version context, target, normal product,
resolved tools/host, matching source hashes, exact executable/frontend identity,
installer length/hash and named evidence files. Check names and evidence closure
are closed; a passed check without its hashed evidence is insufficient.

Windows/Linux smoke runs the normal installed/extracted executable, verifies
payload architecture/hash and trusted origin/profile, creates/imports/previews
through existing UI, observes actual process exit, removes only its fixture
source, and reopens. A read-only external SQLite verifier asserts project,
material/version, committed binary reference and exact managed bytes. Each
Linux format has independent fresh state and complete evidence. No SQL seeding,
mock bridge, embedded WebDriver plugin or acceptance IPC is permitted. Mac
package/signature/bounded-launch checks do not claim UI/store persistence.
Hardware, system dialogs, providers, FUSE launch and other distributions remain
explicit residual limits where unexercised.

Native checks and their nested storage runner retain original per-command logs
and forward actual stdout/stderr to the workflow. Await child close and writable
log completion before reporting a result; a spawn, signal, stream or log failure
cannot become success. Rust test output is uncaptured so an abnormal executable
exit does not erase earlier panic diagnostics. Upload existing finite build
diagnostics on failure or cancellation, keeping installer upload/collection
success gates unchanged. Cancellation with an absent nested error is an unknown
cause, not proof of a specific storage bug.

`product_records.row_key` is canonical WireText storage text: lowercase four-hex
UTF-16 code units, not a plaintext payload ID. External verifiers must decode
that production format before comparing a row key with `payload.id`, reject
malformed encodings and mismatched IDs, and use production-encoded keys in
synthetic fixtures. A GUI-visible record plus a verifier mismatch requires
inspection of both contracts; never rewrite SQLite rows to satisfy a test.

The bootstrap exact branch push and manual dispatch are build-only. Manual
availability requires the workflow on the default branch. Desktop tag mode can
create/resume only a pipeline-owned draft prerelease after all targets pass;
only its final publisher receives `contents: write`. Existing GHCR triggers and
permissions remain separate. Implementation approval does not authorize push,
tag creation, remote dispatch or Release mutation.

Artifact selection is explicit and bound to this run, target and original
attempt. Reject ambiguous candidates and future attempts. Do not flatten loose
globs. Verify regular files, path containment, exact whitelist, sizes/hashes,
source equality and all checks before producing canonical SHA256SUMS and
release-manifest.json. Retain original immutable artifacts for draft retries.

Publisher uses authenticated paginated draft discovery and an ownership marker
bound to workflow/repository/tag/source/payload. The tag must already exist and
resolve to the checked source; never create/move it. Reject published, immutable,
duplicate, unowned or changed-payload releases. Uploads are non-atomic: a partial
owned draft remains visibly incomplete. Resume identical original assets only;
unknown extras or changed bytes stop. Reverify the full remote asset set before
marking complete. Owner publication follows completion; REST read-before-write
checks do not prevent concurrent external publication.

## 4. Validation & Error Matrix

| Trigger | Required result |
| --- | --- |
| Unknown target/format, mismatched version/tag/tools/host | Fail before producing eligible output |
| Dirty source, source changes or existing bundle namespace | Reject receipt; retain finite diagnostics |
| Acceptance frontend, test hooks or wrong product/profile | Reject normal package proof |
| Failed/missing/duplicate/unknown check or absent evidence | Cannot seal verified receipt |
| Wrong executable, architecture or trusted startup profile | Fail actual payload smoke |
| UI import/reopen lacks exact committed row/file bytes | Fail storage smoke; no SQL/mock repair |
| One Linux format absent or only other format tested | Required target remains incomplete |
| Link, path escape, stale/wrong-source/hash or extra file | Collector fails; no complete draft |
| Manual/branch mode | Build-only; no tag/Release mutation |
| Existing published/immutable/unowned/duplicate release | Reject without mutation |
| Upload interrupted / identical original retry | Incomplete owned draft / exact conservative resume |
| Changed payload or unknown remote asset | Stop; owner recovery/new version needed |
| Local tests only / unavailable host | Record finite local proof and pending actual gate |
| Frontend default heap OOM / percentage option conflict | Dedicated bounded child budget / explicit conflict error; no global CI relaxation |
| Windows metadata-only directory guard | Insufficient rename authority; retain actual list-access guard and release checks |
| Nested process failure or cancellation | Keep failure/cancel status, exact logs and useful live diagnostics |

## 5. Good / Base / Bad Cases

Good: owner pushes the bootstrap branch, actual four hosts pass, and a later
version tag collects five exact checked installers into one complete draft.
Base: local source and fake-API failure tests pass while hosted gates remain
pending; task stays active. Bad: describe Mac source tests as Windows acceptance,
drop a failing target, reuse a stale installer, automatically publish the draft
or overwrite an unrelated Release.

## 6. Tests Required

Use actual injected malformed/missing/duplicate/wrong-source/wrong-hash files and
manifests to exercise collector rejection. Controlled fake GitHub API tests must
exercise paginated drafts, published/unowned/duplicate rejection, partial upload,
identical resume and changed/unknown assets. These are protocol tests, not real
GitHub delivery. Verify tool paths, Windows argument handling and exact policy.
External SQLite verifier regressions must include production-encoded ASCII and
Unicode row keys, malformed encodings, and valid encodings with mismatched IDs.

Run existing root/desktop quality and native suites on frozen source, including
shared native storage `--suite all`; retained assertions cannot be weakened for
portability. Run corresponding-host filesystem/origin/profile tests and real
installer smoke. Actual tag/draft upload evidence closes the hosted delivery
gate; archive only after all required criteria have actual outcomes.

Launcher regressions must run the actual launcher with a tiny fixture worker:
argument/environment/cwd identity, explicit heap precedence, output, nonzero,
spawn failure and supported-host signals. Logged-process regressions require
real children producing both streams past a pipe buffer, full EOF/log parity and
nonzero/spawn/signal/log failure behavior. Retain the full unchanged native suite
and actual frontend build; fixtures do not establish renderer or installer proof.

## 7. Wrong vs Correct

Wrong: ignore a collector hash mismatch because download-artifact only warned,
mark all checks passed from a build exit code, or publish `draft: false` after a
partial upload. Correct: verify the exact file/evidence closure, require named
actual outcomes, keep an interrupted draft incomplete, and leave publication to
the owner after remote verification.

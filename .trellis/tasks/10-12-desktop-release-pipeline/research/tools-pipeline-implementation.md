# Portable tooling and release pipeline implementation

Date: 2026-10-12. Candidate source implementation on codex/desktop-release-pipeline. No remote action, release creation, signing secret access or corresponding-host build was executed by this worker.

## Change boundary

The gap was Mac-only tool/bundle discovery and absence of complete target artifact verification/draft publication. This worker owns tool resolver/wrappers, native-probe executable resolution, normal package configuration, release scripts, desktop package/Knip entries and desktop-release.yml. Shared React/business/Agent, Rust source/Cargo and runtime smoke/driver scripts are peer-owned and were not rewritten. Default local Mac tools and explicit acceptance/reference product lanes remain retained.

## Files and CLI

- tool-resolver.mjs and tools.mjs retain the approved machine pnpm and ignored local Rust homes. Explicit hosted mode resolves pinned executables, rejects command-shell shims and launches pnpm.cjs with Node. Native probe resolution supports target directories and Windows .exe; hosted self-hosted tests require the explicit resolved probe, while local mode retains its existing default.
- build-app.mjs reads normal productName from config and retains Mac acceptance receipts. Normal visible branding is Cuepoint / 小光点 Cuepoint; binary/identifier/version remain current. Existing dark PNG/ICNS/ICO are reused. macOS14/ad-hoc, Windows NSIS currentUser/downloadBootstrapper, Linux media framework/DEB dependencies are explicit configuration.
- build-release.mjs --target ID --output FRESH requires matching native host, clean exact source, fixed Node/pnpm/Rust/Tauri and all four version declarations. Normal root frontend and product-sqlite only are built with locked Cargo, fresh bundle directory, NO_STRIP=1 and target-aware payload SHA. Mac executable digest comes from the signed .app. Installer output discovery excludes AppDir staging/library links.
- release-native-checks.mjs --target ID --evidence-dir FRESH builds the normal frontend before GUI-feature compilation. It retains fmt/full test-hooks tests, adds product-sqlite,test-hooks clippy/tests for platform runtime assertions and invokes the existing shared-storage all suite with target-aware probe. This entrypoint has not been executed on hosted platforms yet.
- run-release-smokes.mjs --receipt PATH --native-checks PATH --evidence-dir ROOT invokes peer-owned scripts/release-product-smoke.mjs per receipted installer (Linux independently for AppImage/DEB), with Xvfb on Linux. finalize-release.mjs --receipt PATH --checks PATH (repeatable) seals only passed closed reports with matching source/target and independently hashed evidence.
- select-release-artifacts.mjs --output PATH [--kind targets|set] chooses exact authenticated current-run artifact IDs, target/source/attempt provenance, retaining successful original targets on retry. collect-release.mjs --input ROOT --selection PATH --output FRESH requires four targets/five installers, exact path/file/check/source/hash closure, then emits canonical SHA256SUMS/release-manifest.json.
- publish-draft.mjs --directory ROOT rechecks remote existing tag/source, authenticated paginated drafts, immutable pipeline ownership and payload digest. It creates only draft prereleases, uploads missing exact assets, verifies remote digests (or downloads/hashes), and marks complete only afterward. Published/unknown/duplicate/changed objects fail without overwrite/deletion/tag movement. A starter placeholder deliberately remains incomplete for owner recovery; no delete is attempted. GitHub REST draft reads do not provide CAS against concurrent owner publication.

## Workflow

prepare -> quality -> four native build/check/package jobs -> exact collect -> tag-only draft. The closed release-policy supplies the matrix rather than duplicated workflow entries. Exact bootstrap-branch pushes and manual dispatch are build-only; manual dispatch still requires the workflow on default branch. desktop-vMAJOR.MINOR.PATCH pushes alone enter publisher. Only that job has contents:write; collection/draft selection uses actions:read and GITHUB_TOKEN, no PAT. Root package manager calls in quality explicitly execute the fixed installed pnpm.cjs.

Named target artifacts: desktop-<target>-<runId>-<attempt>. Complete set: desktop-set-<runId>-<attempt>. Collector-only retries reconstruct identical manifest bytes from original selected target attempts; publisher-only retry downloads an explicit original set artifact ID. New rebuilt bytes conflict with existing owned draft instead of overwriting it. Target artifacts retain30 days; finite diagnostics14 days. Runtime diagnostics patterns include only runner-owned top-level JSON/log/PNG and driver setup report, excluding installed/extracted payloads.

Action refs verified read-only with git ls-remote and GitHub action.yml API on 2026-10-12:

| Action | Ref / SHA |
| --- | --- |
| actions/checkout | v6 / d23441a48e516b6c34aea4fa41551a30e30af803 |
| actions/setup-node | v6 / 249970729cb0ef3589644e2896645e5dc5ba9c38 |
| pnpm/action-setup | v4 / f40ffcd9367d9f12939873eb1018b921a783ffaa |
| actions/upload-artifact | v6 / b7c566a772e6b6bfb58ed0dc250532a479d7789f |
| actions/download-artifact | v7 / 37930b1c2abaa49bbe596cd826c3c89aef350131 |

Verified current pinned download input artifact-ids, merge-multiple and upload action inputs. Workflow YAML parsed successfully using installed ESLint's js-yaml. Action runner Node24 and policy Node24.11.0 are explicit.

## Checks actually executed

- pnpm --dir desktop/tauri test:release: PASS,42 Node tests at last run (32 collector/policy/publisher/workflow plus10 peer smoke support cases). Tests use actual fixture bytes/paths and fake GitHub API; no real API mutation. Coverage includes wrong source/run/attempt/owner/architecture/features/tool versions/checks, path traversal/links/unexpected files, bytes corruption, incomplete uploads, lost replies, page-two drafts, owned exact retries, collector reconstruction retry, published/unowned/duplicate drafts, starter placeholders and missing-digest downloaded hash mismatch.
- pnpm --dir desktop/tauri lint: PASS.
- pnpm --dir desktop/tauri quality (Knip): PASS.
- git diff --check: PASS.
- Pinned Tauri CLI observed version tauri-cli2.12.1.
- Workflow parsed to prepare/quality/build/collect/draft and push/manual/PR events; publisher permissions only contents:write + actions:read.

The explicit approved pnpm path was used locally. No native builds/full-root suite ran concurrently with peers. Initial lint/Knip diagnostics were fixed in owned source (unused imports/exports and control-character handling), without suppressing rules.

## Remaining gates and limits

Root must run frozen full quality/native/local candidate build and independent Trellis review before C0. H1a actual four-host execution, Windows NTFS proof and installation/runtime smoke remain pending. H1b actual tag/draft API/retry proof remains pending. No current source or unit/fixture test establishes those outcomes.

Windows manifest notes state the accepted regular-file byte/metadata flush, local-NTFS no-overwrite publication and process-termination recovery guarantee, explicitly excluding parent-directory persistence across sudden OS/power loss. Linux extracted AppImage is not FUSE desktop-launch evidence. Mac launch-only is not UI/store parity, Intel UI/hardware remains pending. Microphone/print/providers/PDF/media codec proof remains separate. No public Release was published, no commits/push/tags created by this worker.

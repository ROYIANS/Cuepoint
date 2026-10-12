# Research: desktop artifact collection and draft Release

- Query: How should four native build targets aggregate verified installers into one retryable draft prerelease without changing published or unrelated releases?
- Scope: mixed; source/config inspection and current official Actions/Tauri/GitHub REST documentation. Planning only.
- Date: 2026-10-12

## Findings

### Repository evidence and related contracts

| File | Pattern / implication |
| --- | --- |
| `.github/workflows/ghcr.yml:3-9,45-88` | `main`, `v*`, PR and manual triggers currently build the website/container. Desktop tags beginning `desktop-v` would avoid the existing `v*` trigger; using ordinary `v*` would also publish GHCR. Choose deliberately. |
| `desktop/tauri/scripts/build-app.mjs:10,26,45-50` | Normal build explicitly selects `product-sqlite`, but bundle selection/discovery is Mac `.app` only. Preserve owner selection while adding a portable release seam. |
| `desktop/tauri/scripts/tools.mjs:6-23` | Absolute local Node/pnpm paths and ignored local Rust homes cannot serve hosted runners unchanged. |
| `desktop/tauri/package.json:3,6,11`; `src-tauri/Cargo.toml:3,24-26`; `src-tauri/tauri.conf.json:3-6,18-19` | Version is duplicated at `0.1.0`; CLI is pinned `2.12.1`, pnpm `10.15.0`, and current identity remains Prototype. Validate consistent versions rather than letting a tag override mismatched sources. |
| `package.json:5-7` | Root version/package-manager declarations are also `0.1.0` / `10.15.0`; fresh installs must retain both lockfiles and the vendored HTTP patch. |

Related specs: `.trellis/spec/frontend/native-product-runtime.md` requires shared full-product SQLite ownership and distinguishes actual packaged evidence from fixtures. `.trellis/spec/frontend/quality-guidelines.md` requires corresponding-host evidence. `.trellis/spec/guides/development-change-policy.md` excludes unrequested old-data migration. The accepted PRD signing choice is macOS ad-hoc/no notarization and Windows unsigned.

### Recommended job boundary (conditional on owner approval)

`prepare -> quality -> build[4 targets] -> collect/verify -> draft-release`

1. **Prepare:** Resolve one exact checked source SHA and a closed release-policy document. Proposed initial policy: `desktop-vMAJOR.MINOR.PATCH` tags create a draft prerelease; manual dispatch is build-only, with no Release/tag mutation. Use numeric three-part app versions initially; GitHub `prerelease=true` is independent of app-version suffixes. Reject mismatches across the four version declarations, malformed tags, wrong storage/profile, and unavailable expected target definitions. Owner still decides first version, identity and matrix.
2. **Build:** Proposed targets: ARM64 macOS DMG, Intel macOS DMG, x64 Windows NSIS EXE, x64 Linux AppImage + DEB. Use native runners, locked dependencies and pinned tools/actions. Each target completes its required checks before uploading a target staging directory. Tauri action can be used build-only with `projectPath: desktop/tauri`, explicit `--features product-sqlite --target … --bundles …`; omit all release inputs. Its `artifactPaths` and `appVersion` outputs aid discovery, but independently validate the whitelist and version. Do not upload updater JSON/signatures or raw executables. [Official tauri-action inputs/outputs](https://github.com/tauri-apps/tauri-action)
3. **Collect:** Require successful quality and all required builds; `fail-fast:false` retains other-target diagnostics. Download only this run's explicit target artifacts into separate directories, never a repository-wide loose glob or flattened merge. Validate exactly four target receipts and five installer files for this proposed matrix, plus only named metadata; reject missing/duplicate targets, unexpected files, path escapes, size/hash mismatches, wrong SHA/version/storage/profile/signing identity and incomplete checks. Produce canonical `SHA256SUMS` and one `release-manifest.json`. Artifact-download digest mismatch is only a warning in the documented action, so explicit installer hash validation must fail the job. [GitHub artifact validation](https://docs.github.com/en/actions/tutorials/store-and-share-data)
4. **Release:** Only after complete collection succeeds, create or resume the one pipeline-owned draft. No public publication step belongs in this lane. New body initially says upload incomplete; mark complete only after remote asset verification. Include supported baselines, unsigned/ad-hoc installation instructions and truthful runtime/media acceptance gaps.

### Receipt and permissions

Each target receipt should contain schema version, repository, workflow path, source SHA, tag or build-only mode, run ID/attempt, target triple, formats, exact app version/bundle identity, `profile=normal`, `storage=sqlite`, tool/config/lockfile identities, check status/evidence and each canonical filename/byte size/SHA256. Sign status is explicit, not inferred from filename. A receipt establishes source/config provenance; successful launch/storage/media tests remain separate evidence.

Read-only prepare/quality/build/verification jobs need `contents:read`. Only the final tag-only Release job gets `contents:write`; add `actions:read` only if selecting/downloading artifacts through the REST API. No package, workflow, PAT, signing secret or updater permission is needed for this proposed lane. Serialize collectors by repository + exact desktop tag with `cancel-in-progress:false`; check remote tag still resolves to the verified source. Keep GHCR's own concurrency/permissions separate. [GitHub workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)

### Safe retry and existing-release policy

- Names containing target + run ID + attempt avoid artifact overwrite. Artifacts are immutable; overwrite creates a different artifact ID. Failed-job reruns may reuse earlier successful targets only when their receipts share the same run/source/version/policy. Reject ambiguous target candidates; choose explicit validated artifact IDs rather than matrix outputs sharing one key. [Official upload-artifact behavior](https://github.com/actions/upload-artifact)
- GitHub reruns retain original SHA/ref; they do not pick up fixes committed afterward. A source fix requires a fresh build/version/tag rather than moving an existing release tag. Collector-only rerun should reuse verified original artifact IDs. [GitHub rerun semantics](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/re-run-workflows-and-jobs)
- Authenticated, paginated `GET /repos/{owner}/{repo}/releases` is necessary to discover drafts; the tag endpoint is documented for published releases. Require exactly one matching owned draft, with an explicit body marker containing workflow/repository/tag/source and the intended payload digest. Reject published/immutable matches, missing ownership markers, different source/payload or duplicate matches. Create with `draft:true`, `prerelease:true`, `make_latest:false`, exact `target_commitish`; never patch `draft:false`. Require an already-existing checked tag, avoiding implicit tag creation or elevated workflow permissions. [Release REST API](https://docs.github.com/en/rest/releases/releases)
- Conservative initial resume policy: identical existing asset bytes are a no-op; upload only missing assets. A changed payload or unknown extra asset stops for owner recovery/new version, instead of automatic clobber/delete. Handle retryable upload failure by re-listing assets and checking hashes; delete a `starter` placeholder only after proving the draft/payload/name belongs to this operation. GitHub rejects duplicate filenames and exposes asset size/state/digest. Verify digest (or download/hash when unavailable), full expected set and draft ownership again before marking complete. [Release assets API](https://docs.github.com/en/rest/releases/assets)

## Caveats / Not Found

- Matrix, first version/public identity and tag/publication policy remain owner decisions. This memo is a recommendation, not implementation approval; no code/build/workflow/remote operation occurred.
- GitHub asset uploads and Release updates are not an atomic transaction. A failed upload can leave an incomplete **draft**; the completion marker and exact retry payload make this visible. Never advertise the draft as complete before remote verification.
- Read-before-write draft checks do not create an atomic lock against the owner publishing concurrently. The owner must publish only after the collector finishes. Strict protection against that concurrent external action would require a different approval/publication architecture; do not claim the REST API supplies compare-and-swap.
- Same-source rebuilds need not be byte-identical. If a draft already has a pinned payload, resume those original artifacts; changed hashes require an explicit recovery or new version. Artifact retention/expiry must be documented.
- No hosted runner execution, repository token-policy check, actual existing Release lookup or installer/runtime acceptance was performed. Exact pinned action SHAs and hosted artifact APIs/attempt selection need verification during implementation; avoid expanding this planning memo into an unapproved action-version audit.

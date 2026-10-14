# Desktop 0.1.3 release-preparation audit — 2026-10-14

## Outcome and scope

No confirmed source-version, packaging-policy, collection, publication-protocol or release-note blocker was found for preparing desktop 0.1.3. This is a local preparation result. It does not establish four hosted builds, actual installers, a completed GitHub draft or owner runtime acceptance.

The audit starts from `main` at `ad9fc272ec6422f18a1d356f265a69b05e8cee32`. The release-preparation candidate additionally contains the frozen model-catalog refresh and release documentation. The final release source is the later clean committed candidate selected by the main session; the tag and hosted receipt must bind that exact commit. The audit neither creates nor moves a tag, pushes, dispatches Actions, changes a Release, installs dependencies nor compiles Rust.

This is a scoped release review, not a new full-source audit of the application. The complete settings source/browser checkpoint is recorded in `settings-checkpoint-validation.md`. The model refresh owner records its generation/verification and 101 focused tests in `release-model-refresh-0.1.3.md`; the main session owns final frozen root gates after this refresh.

## Version and normal product

`sourceVersion()` was executed against the candidate and returned `0.1.3`. Its four actual version owners agree:

| Owner | Value | Verification |
| --- | --- | --- |
| `package.json` | 0.1.3 | Parsed source and actual `sourceVersion()` |
| `desktop/tauri/package.json` | 0.1.3 | Parsed source and actual `sourceVersion()` |
| `desktop/tauri/src-tauri/Cargo.toml` | 0.1.3 | Package version and actual `sourceVersion()` |
| `desktop/tauri/src-tauri/tauri.conf.json` | 0.1.3 | Parsed source and actual `sourceVersion()` |
| `desktop/tauri/src-tauri/Cargo.lock` workspace package | 0.1.3 | Located the `cuepoint-prototype` package block and asserted its version |

The normal identity remains Cuepoint / `dev.cuepoint.prototype.offline` / `cuepoint-prototype`, profile `normal`, storage `sqlite`, features exactly `product-sqlite`. The actual release-build arguments retain `--features product-sqlite`, `--no-binary-patching` and `-- --locked`, without acceptance or test-hooks. The frontend worker enters the real root product by default; the separate acceptance frontend requires its explicit flag and loopback fixture configuration. The native normal workspace remains `product-workspace-v1`, with storage-open errors propagated rather than switching to the browser owner.

Pinned declarations remain Node 24.11.0, pnpm 10.15.0, Rust 1.99.0 and Tauri CLI 2.12.1. The model dependency and generated baseline both report 0.0.104; the generated baseline contains 381 entries. The installed package metadata confirms the Models.dev notice's MIT license and canonical `anomalyco/models.dev` repository. These metadata assertions are separate from native compilation.

## Exact targets and assets

The actual closed `TARGETS` policy and `assetName()` produce four native host entries and five downloadable installers:

| Target | Hosted runner | Rust triple | Required installer |
| --- | --- | --- | --- |
| macos-arm64 | macos-14 | aarch64-apple-darwin | `Cuepoint_0.1.3_macos_arm64.dmg` |
| macos-x64 | macos-15-intel | x86_64-apple-darwin | `Cuepoint_0.1.3_macos_x64.dmg` |
| windows-x64 | windows-2022 | x86_64-pc-windows-msvc | `Cuepoint_0.1.3_windows_x64_setup.exe` |
| linux-x64 | ubuntu-22.04 | x86_64-unknown-linux-gnu | `Cuepoint_0.1.3_linux_x64.AppImage` and `Cuepoint_0.1.3_linux_x64.deb` |

Mac retains `app,dmg` internally for the executable receipt; `.app` is not a sixth download. The collector requires all four target directories and exact five-installer closure, verifies actual regular-file sizes/hashes and identical source inputs, and produces `SHA256SUMS` plus `release-manifest.json`. These two metadata files make the final remote asset set seven files.

## Trigger, draft and ownership gates

The workflow accepts `desktop-v*` tag pushes, the exact bootstrap branch and manual dispatch. Its actual prepare/build/collect dependencies preserve the four-target gate. Only the final `draft` job receives `contents: write`, and that job requires a push of `refs/tags/desktop-v...`. Manual execution remains build-only even with a tag-like ref.

An eligible actual build additionally requires clean checked source at `context.sourceSha`, the corresponding native host/architecture, pinned tools, a fresh output/bundle namespace, and unchanged tracked source hashes. Packaging emits `state: packaged` with empty `checks` and `evidenceFiles`; the dedicated Actions workflow does not run lint, tests, application launch or storage smokes. The existing independent quality/storage commands retain their separate ownership.

The publisher verifies the existing remote tag resolves to the manifest's source, discovers drafts with authenticated pagination, and creates/resumes only the exact pipeline-owned draft prerelease. The ownership marker binds repository, workflow, tag, source and payload. Published, immutable, unowned, duplicate or changed-payload Releases are rejected. Partial uploads remain incomplete; exact original files may resume, unknown extras or changed bytes stop. Completion revalidates the seven assets and explicitly retains tag/source with `draft: true`, `prerelease: true`, `make_latest: false`. It does not publicly publish the Release.

## Executed local checks

All executable checks used the approved machine Node/Pnpm directory `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin`; no Codex runtime package manager was used.

| Command/check | Result |
| --- | --- |
| Actual `sourceVersion()` plus Cargo.lock workspace-package assertion | PASS: 0.1.3 |
| `prepare-release.mjs` with local simulated `push`/`refs/tags/desktop-v0.1.3` context and a temporary `GITHUB_OUTPUT` | PASS: exact four-target matrix and `version=0.1.3` |
| Same preparation with `desktop-v1.0.3` | PASS rejection: `Tag/version mismatch`; no matrix output |
| `runContext()` with manual dispatch and tag-like ref | PASS: build-only |
| `node --test desktop/tauri/scripts/release-pipeline.test.mjs` | PASS: 57 tests, 0 failed/skipped |
| `node --test desktop/tauri/scripts/publish-draft-http.test.mjs` | PASS: 8 tests, 0 failed/skipped |
| `pnpm --dir desktop/tauri types` | PASS |
| `pnpm --dir desktop/tauri lint` | PASS |
| `pnpm --dir desktop/tauri quality` | PASS |
| Concrete 0.1.3 release-note assertions | PASS: five exact installer links plus checksum/manifest; four local document/image references; no user-facing placeholders |

The prepare dry-run uses run id `local`; it creates only temporary output, not a tag or hosted run. Collector/publisher cases use temporary real fixture files and controlled GitHub responses. The upload adapter cases use actual Node fetch with a loopback HTTP server, checking explicit Content-Length, multichunk byte parity, encoded names and resource cleanup. None of these tests uploads to GitHub or establishes hosted delivery.

## Release documentation review

Both `docs/desktop-release-template.md` and `docs/desktop-release-0.1.3.md` were inspected after the documentation owner froze them. The concrete notes cover settings, checked installer saving/manual installation, connection/autofill repair, window/popups, old-workspace migration and the verified model-catalog refresh. They link the actual 0.1.3 filenames and tag source tree, with the exact eventual source SHA delegated to `manifest.context.sourceSha` rather than a pre-commit placeholder.

Maintainer instructions retain the existing upload notice, complete status and original ownership marker, require preservation of every actual `manifest.limitations` entry, and prohibit editing while upload/retry is active. Public text states packaging-only limits and does not claim native migration, save dialogs or runtime behavior have already passed. The two installation illustrations and linked local guide/README files exist. The new tag links are intentionally prospective until the user pushes the chosen tag.

## Frozen scoped inventory

The following SHA-256 inventory was taken after model/document owners declared their files frozen and after the main session's final canonical Models.dev notice-link correction. The first integrity check detected that notice correction; its installed-package metadata was inspected, its final hash refreshed, and all scoped bytes rechecked. Ordinary pipeline and version declarations were reviewed through their actual code paths; generated model/lock content is recorded by identity with the model owner's generation/verification evidence, not claimed as manual line-by-line review. The final main-session commit must retain these scoped bytes or recheck any later changed inputs.

```text
0a926a07f692668462784cb1417facacd12cfeed9016fd68d0308a38694875fa  package.json
84ed7b21abb184b45b61f41bfd0eb199a2824cc822f99e4f4f3c013584267967  pnpm-lock.yaml
99f9a22d8e16510d2d8dfa09769ccd0390dba92318f57e1e0010dc13a616e1aa  src/lib/ai/modelCatalog/baseline.generated.json
9a147178d71278d54b627ec4569b38905250b5cf38dda4a7beaf117793da30de  THIRD_PARTY_NOTICES.md
647b2ad51bcb54a81be5b9182f7fda900e0d6c39cafb6d06a7ec5d276a76610d  desktop/tauri/package.json
39fa77e6fb71776b1dbcb78b471f5a321989792df65ebefabf62bf03e5e2da67  desktop/tauri/src-tauri/Cargo.toml
9745da01c498697f7791290d3db25f9238eba6b2206c31102946e72f02696611  desktop/tauri/src-tauri/Cargo.lock
23e58a549213d17088585cb9f1b5130de4909037d5942e3332c07b73621b79bd  desktop/tauri/src-tauri/tauri.conf.json
61dda482a3a261b3a06e7b324a9d9ae34c5b9ae71002b912b496c523a1fb11ef  .github/workflows/desktop-release.yml
20b1d85282d3fbfb2b768cd7cf0e20a3a356fe723b809f0922a881cebe4470ba  desktop/tauri/scripts/release-policy.mjs
965ec8d6393a515889c6a9b769eb05a42cff329b892224572a934a3d0774eced  desktop/tauri/scripts/prepare-release.mjs
2d9305ac563e0eda32bb12bfd67e7f926ed73f08f64310eea5eff6ba9f30b958  desktop/tauri/scripts/build-release.mjs
260de9fd0b787f10c1f1a4fe53cdbaea75baa7c8fc7b1be723ae836733fb283c  desktop/tauri/scripts/build-frontend-worker.mjs
dea9aa303a5b0d94ce0969e926f48809e710134dd319c2ce920c5c6ff6dc1e91  desktop/tauri/scripts/release-artifacts.mjs
a02c2f6861b68094bf5c857189610374e15a3fb6fb2188cf7200eb5ae674dd9b  desktop/tauri/scripts/select-release-artifacts.mjs
577d2da0264a6fbe5def9b7166b20602db69fd312ca11ed255cdca9895bb727d  desktop/tauri/scripts/publish-draft.mjs
f729340dedbc62f4161fbc421103b2cb60a9c75c6bc756404d89fc381452e998  desktop/tauri/scripts/release-source-hashes.mjs
f204fb332917011f8e2babc55ae8b8788a499190d3731a8d160bc7376643076d  docs/desktop-release-template.md
d4dee690ace46fbd045d9e7ac8efc4732fdc0c2cfbc097bc9907822d7c52ec64  docs/desktop-release-0.1.3.md
```

## Remaining delivery and acceptance

Before the user pushes the tag, main must commit the final model/docs/evidence candidate, pass its frozen root gates, and bind `desktop-v0.1.3` to that exact clean commit. The parent reported no existing local/remote 0.1.3 tag or 0.1.3 Release at the start of preparation; that observation is not authorization to overwrite a later tag or Release.

After push, require actual outcomes for all four native hosts, five installers and the complete seven-file owned draft. No real Rust build or installer was available to this audit. Owner-installed acceptance remains pending for old-workspace migration/device settings, Windows/macOS topbar and short-window popups, real update reachability/rate limiting, native system Save/cancel and installation. Keep PRD A6, A9c and A10 open until corresponding evidence exists. Upload completion alone cannot satisfy them or authorize public publication.

No production or tooling fix was needed. No findings were left unresolved within the local preparation scope; the preceding hosted delivery and owner acceptance are required subsequent stages, not results claimed by this audit.

## Parent final frozen-candidate gates

After the model and documentation owners froze their changes, the main session ran all ten final gates with the approved machine pnpm. `lint`, full `test` (280 files / 4655 tests passed; 1 file / 7 tests skipped), formal `quality`, `quality:self-test` (88 cases), `models-dev:verify`, `build`, `landing:budget`, and desktop `types/lint/quality` all passed. A 1260-file SHA-256 snapshot covering production, tests, packaging, dependencies and documentation was identical before and after execution. No later production edit is included in this checkpoint. This final run supplements the independent scoped review above; actual four-host installers and owner acceptance remain subsequent stages.

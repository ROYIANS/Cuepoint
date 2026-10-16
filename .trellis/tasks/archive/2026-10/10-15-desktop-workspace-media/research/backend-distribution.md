# Research: E08 portable media backend and distribution

- Query: Choose a concrete app-managed FFmpeg distribution for macOS arm64/x64 and Windows x64, with pinned provenance, without renderer shell access or dependency installation churn.
- Scope: mixed — repository owners and primary upstream repositories/documentation.
- Date: 2026-10-16
- Status: research and recommendation; no backend, binaries, configuration or product behavior has been changed by this investigation.

## Findings

### Existing owners and constraints

| File | Observed owner / implication |
| --- | --- |
| `apps/desktop/src-tauri/tauri.conf.json:35` | Bundling has no `externalBin` or resources declaration. macOS minimum is 14.0, ad-hoc signing and hardened runtime remain current policy. |
| `apps/desktop/src-tauri/Cargo.toml:51` | Existing Tauri/dialog/HTTP/opener dependencies; no shell plugin or media decoder library. Windows uses pinned `windows-sys` and already has a native filesystem owner. |
| `apps/desktop/scripts/tool-resolver.mjs:10` | Explicit local/hosted developer tool selection; this is build tooling, not authorization for renderer-supplied media executables. Local Cargo homes are under ignored `.tools`. |
| `apps/desktop/scripts/build-release.mjs:38` | Target triple and native host/architecture are explicit. `--no-binary-patching`, clean source, frontend identity and source-before/after remain release contracts. |
| `apps/desktop/scripts/build-release.mjs:85` | Existing receipt hashes the main executable and frontend, not separately bundled media tools. A new tool manifest and payload identity require actual integration, not assuming the existing receipt already covers them. |
| `apps/desktop/scripts/release-source-hashes.mjs:9` | Tracks source inputs outside the three metadata trees. A tracked tool lock/provenance/license file enters source identity automatically; ignored downloaded bytes need independent hash verification. |
| `.github/workflows/desktop-release.yml:38` | Four-target native packaging matrix includes Linux. E08 supports three Mac/Windows targets; adding unconditional `externalBin` would break Linux packaging unless a deliberate target override or fourth payload is provided. Preserve the existing four-target pipeline. |
| `.github/workflows/desktop-release.yml:76` | Packaging entrypoint is `build-release.mjs`. An explicit verified preparation step belongs before bundling; do not insert tests into the owner-approved packaging-only workflow. |
| `apps/desktop/src-tauri/src/product_binary.rs:548` | Prepare/write/seal/abort and later transactional adoption are the managed file owner. Tool output alone is not an imported project result. |
| `apps/desktop/.gitignore:1` | `.tools/` and `.release/` are already ignored. Neither `src-tauri/binaries` nor `src-tauri/resources` exists currently. |
| `apps/desktop/fixtures/media-provenance.json:34` | Existing synthetic `movie.mp4`: 11,940 bytes, SHA256 `91f3d0a1a72de8355add6814fa4ed8b47bc3cac5ebb02c62dcd8b5b7a5a32341`. Useful deterministic real decode fixture without scanning user media. |

Readiness observed: host is Darwin arm64; `shutil.which('ffmpeg')` and `shutil.which('ffprobe')` both returned `None`. No media executable was downloaded or executed. Existing ignored Cargo tools are not evidence of a ready media backend.

### Recommended candidate: a fixed LGPL CLI build, with explicit provenance work

[AtlasYang/ffmpeg-static-builds `ffmpeg-8.0.3-build4`](https://github.com/AtlasYang/ffmpeg-static-builds/releases/tag/ffmpeg-8.0.3-build4) provides all three required architectures with one actual FFmpeg version. Its tag resolves to build-source commit `0393ae2c796360fbcbbc44c85eeb769eead473b1`. This is a small third-party build repository, not an official FFmpeg executable distribution. Read its pinned scripts before adopting; the fixed hashes below identify published bytes, not an independent upstream endorsement.

The release's actual small configure reports were fetched. They report `n8.0.3`, disable GPL/nonfree/version3 and external-library autodetection, and record dependencies and runtime version. macOS deployment flags are 11.0 arm64 and 10.15 x64, fitting Cuepoint's 14.0 floor; Windows is documented as Windows 10+. No H.264/HEVC **software encoder** is bundled; this does not remove FFmpeg's native H.264/HEVC decoding or PNG encoding. Verify the exact fixture behavior before declaring format coverage. Keep software frame decoding for this phase instead of depending on GPU APIs.

All URLs below use the base:

`https://github.com/AtlasYang/ffmpeg-static-builds/releases/download/ffmpeg-8.0.3-build4/`

| Cuepoint target | Archive asset | Exact bytes | SHA256 |
| --- | --- | ---: | --- |
| `macos-arm64` / `aarch64-apple-darwin` | `ffmpeg-8.0.3-macos-arm64.tar.gz` | 30,110,463 | `26f6269b117a51c5fdfd3a870c4e0a62b99f0575740a3933fc3d852f0a3f80b1` |
| `macos-x64` / `x86_64-apple-darwin` | `ffmpeg-8.0.3-macos-x64.tar.gz` | 33,547,741 | `b84b4515aaf2fe443a76445f02d05544a384dcd46cc6059fb8a1a4f9aaa3035d` |
| `windows-x64` / `x86_64-pc-windows-msvc` | `ffmpeg-8.0.3-win-x64.zip` | 38,876,415 | `fd3473736674343cd1948eb45f28b46f377616432a5cc15eb896bdaabea506f2` |

The archives are described and packaged by pinned `scripts/package.sh` as exactly `ffmpeg` + `ffprobe` (Windows `.exe`) at their root. No DLL bundle or npm dependency is required. Archive member verification has **not** been performed locally because these large artifacts were not downloaded.

Small provenance assets fetched and verified against GitHub API digests:

| Asset | SHA256 |
| --- | --- |
| `checksums.sha256` | `6c7fef66e8fd85832c85ae67548f9a36e3d641a4f020887b5d7690fe8b40d185` |
| `ffmpeg-8.0.3-macos-arm64.configure.txt` | `35e03b193478f2d5bca3a1ff0db92afade1dd2d616dc78946ae81907c0337222` |
| `ffmpeg-8.0.3-macos-x64.configure.txt` | `b23147a6f4e7dd65abb8e312722d6dccffeea75c353c2cf78cf72f3369c26c56` |
| `ffmpeg-8.0.3-win-x64.configure.txt` | `6d0d6e37f261fb2a9ffc5bbd50db13256d6427f248496b34cc1e9be2e1f2ba06` |

Do not accidentally select this repository's separately tagged `shared` SDK releases. CLI build4 has only binary archives and configure/checksum reports; it does **not** contain notices or corresponding source archives. Distribution must add actual FFmpeg and included dependency notices plus exact source locations/materials independently. The pinned `scripts/versions.sh` lists zlib 1.3.1, libogg 1.3.6, libvorbis 1.3.7, libopus 1.6.1, libvpx 1.17.0, dav1d 1.5.4, libaom 3.15.0 and libwebp 1.6.0. Record source archive/commit hashes when collected; do not label repository scripts' license as the binaries' license. The [FFmpeg legal page](https://ffmpeg.org/legal.html) is authoritative background for the component's license, not proof that a particular third-party archive is complete.

### Mature alternative: Shaka uniform-version raw executables

[shaka-project/static-ffmpeg-binaries `n8.1.2-1`](https://github.com/shaka-project/static-ffmpeg-binaries/releases/tag/n8.1.2-1), build-source commit `88caac417541f3bb678fa6670cb73f2d74c7aaf9`, provides direct files and visible build scripts. Actual configuration enables GPL and version3; the binaries are GPLv3, while its build scripts are Apache-2.0. Published dependency versions are explicit in pinned `versions.txt`.

Base: `https://github.com/shaka-project/static-ffmpeg-binaries/releases/download/n8.1.2-1/`

| Asset | Bytes | GitHub API SHA256 |
| --- | ---: | --- |
| `ffmpeg-osx-arm64` | 34,074,040 | `e7b9fcd97f95f333512d6e8b8ac24d9dbc08f189f36047695499bd7b57214b22` |
| `ffmpeg-osx-x64` | 42,745,472 | `62c87854d851f202fc4a29bdda0fe7b6ebcddd37b863482ce1bdc81151b03fe4` |
| `ffmpeg-win-x64.exe` | 53,763,072 | `4044b3924c977ad31229d504c5d5b8685f9553124fbaff6e9c99048b42830341` |
| `ffprobe-osx-arm64` | 33,882,408 | `ded4c698b8ff38d0bc1fd30fcc5e768dc46f58bc15a8dfd61f98615ba49cde5c` |
| `ffprobe-osx-x64` | 42,555,344 | `d530823f480a3c7eb6334f18a00197d1e9f1070e86172b9aa89c4bf4022bd879` |
| `ffprobe-win-x64.exe` | 53,558,272 | `fc37ca23d31ee08bb8f7e108edf3822f6ef3efc1a8d306bbe0b779190230710b` |

Caveat: inspected scripts do not set `MACOSX_DEPLOYMENT_TARGET`; builds use `macos-latest` and `macos-15-intel`. The actual Mach-O minimum must be checked before adopting for Cuepoint's macOS14 floor. Release notes list MD5 values, so use the recorded SHA256 API digests above rather than adopting MD5 as the project integrity policy. License/source materials are also separate from these raw executable assets.

### Candidates to avoid adopting by name alone

- [eugeneware/ffmpeg-static `b6.1.1`](https://github.com/eugeneware/ffmpeg-static/releases/tag/b6.1.1) has convenient gzip files and SHA256 values, but the tag is an aggregation label. The fetched darwin-x64 README describes FFmpeg **8.0**, the arm64 README has no version/build provenance, and Windows records GPLv3 and FFmpeg commit `e38092ef93`. Declaring a uniform FFmpeg6.1.1 runtime from that tag would be false. It can be evaluated per asset but is not the preferred uniform backend.
- [binmgr/ffmpeg `v9.0.2`](https://github.com/binmgr/ffmpeg/tree/v9.0.2) has small raw executables, but its README/build configuration explicitly uses `--enable-nonfree` even for non-Linux targets. This conflicts with treating the artifacts as straightforward redistributable GPL builds; do not choose it for this task.
- FFmpeg official [download page](https://ffmpeg.org/download.html) distributes source and points to third-party executables. There is no official universal prebuilt artifact to assume.

### One FFmpeg executable versus FFmpeg + ffprobe

One fixed FFmpeg process is enough for the selected useful transformation: decode the first video stream into one bounded PNG frame. Filename, extension and file size come from the authorized filesystem scan. PNG IHDR can describe **thumbnail** dimensions. This option makes a small first slice possible without unreliable parsing of console diagnostics.

Original width/height, duration, codec and stream presence require a reliable probing contract. Prefer a second fixed `ffprobe` executable with selected JSON fields if those are acceptance requirements; the recommended archive already contains it. Its [official documentation](https://ffmpeg.org/ffprobe.html) specifies JSON output and field selection. Do not parse FFmpeg human stderr and call it stable structured probing, and do not substitute scaled PNG dimensions for source dimensions. Neither choice needs a generic shell.

### Concrete distribution and runtime shape

1. Track a closed target manifest: repository + build commit + FFmpeg version + immutable asset URL + archive byte length/SHA256 + extraction allowlist + expected architecture + notices/source provenance. Use literal release tags, never `/latest`.
2. Fetch only the requested target to an ignored staging directory; stream with a finite compressed/expanded ceiling, verify hash before extraction, reject traversal/absolute/duplicate/link members, and extract only known regular executable members. Failed or partial downloads never become the active tool. No package-manager install or PATH fallback.
3. After first actual artifact verification, record extracted executable byte lengths/SHA256. These are not known yet for Atlas archives; do not invent them. A content identity obtained from the pinned verified archive can then be checked at runtime and in package receipts.
4. [Tauri2 external binaries](https://v2.tauri.app/develop/sidecar/) use `base-<target-triple>[.exe]` before bundling. Alternatively use a target-specific resources map and `app.path().resource_dir()` with a closed relative location. Prefer a resources map if avoiding a global Linux `externalBin` requirement; both require actual target-specific config preparation. Check Mac signing behavior before fixing the package layout.
5. Rust chooses the immutable executable path and fixed argv itself. Renderer sends only the reviewed media operation and opaque grant/item identity. No `tauri-plugin-shell` JS permission, model-authored executable path, free-form argv, shell expansion or runtime download is needed. Fixed named child binaries can be launched through `std::process::Command` without adding the shell plugin.
6. Rust retains the real `Child`, concurrently drains bounded stdout/stderr, owns cancellation/deadline/limit checks, kills and waits before terminal acknowledgement, and holds the actual input/version authority throughout. Windows starts a real `.exe` without `cmd.exe` and suppresses a console window; stopping actual Windows children remains corresponding-host acceptance.
7. A fixed FFmpeg invocation can emit one PNG through `image2pipe` with no user output path, no stdin interaction and a constant scale/filter/stream map. Restrict protocols and demuxers to the actual selected local-video contract; FFmpeg [protocol controls](https://ffmpeg.org/ffmpeg-protocols.html) are not an OS sandbox. `file,pipe` alone does not prove all referenced local resources stay within a directory grant. Avoid playlists/concat/network protocols and feed an owned verified snapshot rather than allowing a decoder to reopen arbitrary model-authored paths. Confirm this against selected actual formats.
8. Only verified finite image bytes enter managed-binary staging. Original user files stay unchanged. Source import and thumbnail adoption must use current product commands/transactions, with cleanup and unknown acknowledgement inherited from the real owners.

### Necessary verification versus deferred delivery

Necessary development evidence: preparation rejects wrong SHA/target/member/link and does not replace a ready tool on interruption; the actual selected host binary decodes the existing synthetic video; fixed-child cancellation kills and reaps a real child; oversized PNG/logs/deadline reject and clean owned staging; source changes/revocation cannot become imported results. Use a deterministic real sleeping/test child for Stop timing in addition to a short successful media decode.

Deferred batch-end gates: all three actual artifacts checked on corresponding hosts, macOS14/Intel compatibility, Windows Unicode/long-path/executable handling and Stop, installer-contained tool identity/architecture, Mac signing of the final resource/executable layout and actual installed workflow. A source test, cross-compilation or Mac run cannot establish Windows behavior. Existing packaging remains packaging-only, with no synthetic passed runtime check rows.

## Related specs

- `.trellis/spec/desktop/runtime/index.md` — actual tool paths, runtime/delivery limits.
- `.trellis/spec/frontend/desktop-distribution.md` — native target matrix, clean source receipts, packaging-only policy.
- `.trellis/spec/frontend/native-product-runtime.md` — trusted main-window IPC, managed files and actual runtime authority.
- `.trellis/spec/frontend/shared-product-storage.md` — sole product store and transaction/managed-file adoption.
- `.trellis/spec/frontend/agent-jobs-results.md` — existing foreground job/result durability; does not establish OS process ownership.
- `research/native-media-boundary.md` — prior local owner inventory, whose pending-platform note is superseded by the owner's explicit macOS + Windows selection.

## Caveats / Not Found

- Only small primary release metadata, checksum/README/configure/license assets and pinned build source files were fetched. No large executable/archive, source tarball or user-media directory was downloaded/read.
- Atlas candidate archive member lists, extracted hashes, runtime codecs, executable architecture and signed source provenance remain to be verified after the main session selects the backend. Its small maintainer footprint is a real selection tradeoff.
- Shaka provides a stronger established build source, but inspected configuration does not establish the required macOS14 minimum. No claim that its binaries fail or pass on macOS14 is made.
- No independent process backend, renderer shell command, media grant or current native acceptance exists yet. No tests, Cargo build, package install, release build or Git mutation was run by this researcher.

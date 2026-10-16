# E08 decoder resources: implementation evidence

Date: 2026-10-16. Scope: macOS arm64/x64 and Windows x64 source/resource
implementation. This is not an installer, Windows execution or public-release
acceptance report.

## Implemented owner

- `apps/desktop/media/decoder-lock.json` pins Atlas
  `ffmpeg-8.0.3-build4`, its build commit, all three exact archive lengths/hashes,
  and the **measured** six extracted executable lengths/hashes.
- `scripts/media-archives.mjs` handles only flat two-member ordinary tar.gz/ZIP
  archives. Traversal, absolute paths, links, duplicates, unknown/missing members,
  incorrect sizes/checksums, incomplete metadata and unsupported archive features
  reject before any member reaches its output namespace.
- `scripts/media-resources.mjs` downloads only the requested target, streams
  within pinned limits, verifies the archive and extracted executable identity,
  obtains nine pinned corresponding-source archives and copies full license
  texts/build reports. Only a complete verified private directory is renamed
  into ready state. An invalid ready directory fails closed; it is not replaced.
- Generated `bundle.resources` maps explicit files to `resource_dir/media/`.
  Linux returns no decoder/resources while retaining its existing packages.
- `media_decoder.rs::verified_decoder(resource_root)` chooses the compiled
  platform/architecture, requires the closed runtime manifest to equal the
  compiled lock and verifies ordinary single-link executable identities and
  SHA-256 before returning the fixed FFmpeg path. No runtime fetch, PATH lookup,
  renderer path or shell is introduced.
- The release receipt now includes the exact `payload.mediaResources` inventory
  and manifest, or `null` on Linux. The collector independently rebuilds that
  identity from tracked pins/materials. A retained Mac app's actual resource
  directory must match it; Windows records verified bundler inputs, with actual
  installed extraction explicitly pending. Packaging still records empty checks.

## Actual checks performed

1. Downloaded all three real published archives to a temporary directory, checked
   their recorded lengths and SHA-256, examined the exact two ordinary members,
   and measured each extracted executable's length and SHA-256. No executable or
   large source archive was added to Git.
2. Downloaded and hashed all nine source archives at resolved upstream commits.
   Stored their exact identity/URLs plus 13 full license/notice texts and three
   verified upstream configure reports in tracked source. The production
   preparer was then exercised for all three targets using these exact downloaded
   bytes, producing and verifying each target's 31-file inventory plus the
   inventory file itself. Ready-resource reuse succeeded offline.
3. Executed the actual arm64 FFmpeg/ffprobe. Their version is `n8.0.3`.
   ffprobe read the repository's synthetic `movie.mp4` as H.264, 64×48 and 2s.
   A fixed local-file/pipe FFmpeg invocation generated a PNG, 320×240 and 37,822
   bytes, SHA-256
   `2508a3bc93d55b906f91d56a7cc9c87ddc52806ce213a0ad41723c85b874cd23`.
   The PNG signature, every chunk CRC and zlib image-data expansion were checked.
4. Affected Node tests: 18 passed (12 media archive/download/resource cases plus
   release-argument/collector acceptance and four new rejection cases). The
   latter cover missing/foreign media identity, changed decoder hash and an
   omitted corresponding-source archive. The full release pipeline was not run.
5. Focused Rust command:
   `node apps/desktop/scripts/tools.mjs cargo test --manifest-path src-tauri/Cargo.toml --locked --no-default-features --lib media_decoder::tests -- --nocapture`:
   3 passed, 69 filtered out. Three unrelated pending native-owner dead-code
   warnings were visible at that source checkpoint. No Windows cfg execution
   was performed.
6. Scoped desktop ESLint over the seven changed JS files: 0 errors, 0 warnings.
   `git diff --check` passed for this owner's files. No dependency installation,
   lockfile change, app build, installer build, Git commit or network publication
   was performed by this implementation owner.
7. Root review added scoped Git attributes for the pinned upstream license and
   configure-report files. Their original bytes, including mixed Windows CRLF and
   final blank lines, must survive staging and checkout because resource identity
   hashes those bytes. All 16 files were compared against their staged Git blobs;
   every blob matched the working bytes exactly. The source text is preserved,
   rather than reformatted to satisfy a generic whitespace rule.

## Honest remaining gates

- The native owner is separately testing the real source snapshot → decoder →
  managed claims path. Temporary resource root supplied for that test:
  `apps/desktop/.tools/media/native-fixture`, containing the required `media/`
  subtree. This ignored fixture is reproducible through the reviewed preparer.
- Real Windows execution/Unicode paths/cancellation, Intel execution, macOS 14,
  final Mac signing, final resource layout and installed workflows remain actual
  corresponding-host/batch gates. Download/hash or PE/Mach-O inspection does not
  establish them.
- `SOURCE.md` records the upstream libvorbis generated-configure modification
  instead of claiming entirely unmodified dependency build inputs. It preserves
  source archives, configure reports and pinned build-script references, while
  disclosing the upstream dependency cache/provenance limit.
- The Windows report identifies GCC 16.2.0/MSYS2 with static libgcc but does not
  identify the exact compiler/runtime source package. The materials do not claim
  a complete legal or reproducible-build audit. Confirm matching compiler/runtime
  source notices and final redistribution obligations before public publication.

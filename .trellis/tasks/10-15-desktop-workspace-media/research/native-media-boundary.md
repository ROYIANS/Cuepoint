# E08 native media boundary investigation

Status: planning evidence, not an approved backend or implementation. The owner
selected directory scan → video thumbnails → project import. The first supported
desktop systems remain a pending product decision in the current session.

## Actual repository owners

| Concern | Existing owner and observed boundary |
| --- | --- |
| Native runtime and dependencies | `apps/desktop/src-tauri/Cargo.toml` has Tauri/dialog/HTTP/opener and the product SQLite worker; no FFmpeg/ffprobe, shell plugin or media-process owner. |
| Packaged executables | `tauri.conf.json` currently has no `externalBin`; the default bundle target is `app`, macOS minimum is 14.0, and Windows/Linux distribution settings also exist. Configuration alone does not prove runtime coverage on those systems. |
| Selected filesystem paths | `desktop.rs` uses native dialogs for workspace selection and the older workspace asset import. That import is not the full Studio ProductStore media command and cannot be substituted for it. |
| Namespace/file identity | `paths.rs` owns `NativeStat`, pinned directories/ancestors, ordinary-file checks, namespace checkpoints, verified copy and hashing. Reuse actual handles/identity checks where applicable; a normalized string prefix is insufficient authority. |
| Managed bytes | `product_binary.rs` owns prepare/write/seal/abort and final product transaction adoption. A sealed native file alone is not a completed product row. New thumbnail/source carriers must use registered storage owners. |
| Studio binary access | `platform/storage/binary.ts` owns leases, availability and previews. Current availability does not launch or terminate a decoder; E07 draining that request does not establish process cancellation. |
| Project media changes | `features/library/commands/media.ts::putMedia` uses immutable new IDs and the owning project transaction. Existing retained-library references and orphan cleanup must include any accepted imported source/thumbnail relationship. |
| E07 result ownership | Foreground jobs, bounded original results, owned retained pages, unknown acknowledgement and parent cleanup are available from E07. Their two-kind union currently names only web reads and project availability; do not claim a generic native media job already exists. |

No user directory has been selected or scanned, no decoder has run, and no native
or package acceptance has been executed during this investigation.

## Backend evidence and open technical work

[Tauri's sidecar documentation](https://v2.tauri.app/develop/sidecar/) describes
bundling executables with `bundle.externalBin` and architecture-specific target
suffixes. This supports a possible app-managed tool distribution without asking
users to install command-line dependencies. It is not yet present in this repo
and does not establish process confinement or a reviewed renderer permission.

[FFmpeg](https://ffmpeg.org/ffmpeg.html) and
[ffprobe](https://ffmpeg.org/ffprobe.html) provide candidate frame-extraction and
structured probing capabilities. The exact build, supported input formats,
bounded output, timeout, file/network protocol restrictions and distribution
provenance still need a concrete design. Review the actual selected build against
the project's distribution requirements and [upstream build/license details](https://ffmpeg.org/legal.html).
Do not assume whichever executable happens to be on PATH is an accepted backend.

A bounded Rust-owned process is a candidate; it must hold the actual child,
bound/drain stdout and stderr, terminate and reap on Stop, and publish only
verified output. Validate against the actual selected process API and real child
fixtures; E07's saved state or a mocked cancellation reply cannot supply this
evidence. A generic user/model-supplied shell is not required by the selected
three-step media workflow.

## Decisions before implementation

1. First supported desktop systems, asked of the owner; keep pending until answered.
2. Exact executable/source/distribution strategy and architecture matrix, researched
   against those systems before fixing the backend contract.
3. Explicit native-directory grant lifetime, recursive traversal bounds, links and
   changed-file policy; no renderer-supplied arbitrary path or extra network scope.
4. Concrete accepted video/thumbnail representation, import deduplication and
   cleanup semantics through the same product transaction owner. Preserve user
   sources; report partial/import-unknown outcomes without automatic replay.
5. Necessary deterministic source/native process fixtures, with production
   build/package and broad integration retained for the batch-end gate.

The backend and systems choices above remain open. This note does not activate
E08 or authorize work against an unspecified user directory.

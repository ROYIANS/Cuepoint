# Binary review repair handoff

Worker `/root/native_binary_sessions`, 2026-10-12. Active task `10-11-shared-storage-sqlite`. Implements independent findings SB01/SB02/SB05; SB03/SB04 remain shared store owner's responsibility. No commits, installs, real user data/key/provider accesses or desktop control.

## Current gate state

**Source repairs and focused verification are ready for independent follow-up. Final six-case native binary suite passed 6/6 in43.53s.** Its previous attempt failed the existing >32MiB case with actual `ENOSPC (os error28)`, while other five passed. Root coordinated deletion of only the task's regenerable pinned `debug/incremental` build cache after confirming no cargo/rustc processes, releasing about4.3GB. No user files/deps/build/release/toolchain or evidence were deleted. The successful retry and original failed log are separate, and both are retained in the manifest. Earlier four-case native pass (45.61s) and actual Rust >32MiB proof are also retained without conflating the snapshots.

Exact commands, exit codes and qualification: `worker-binary-review-checks.json`. Source identity snapshot: `worker-binary-review-sources.json`. Raw outputs use `worker-binary-review-*` names. Prior broad consumer proofs are retained in `worker-binary-handoff.md` and `worker-binary-checks.json`; no redundant package/Agent rerun is claimed here.

## SB01 repair

`product_binary.rs` adds a managed location retaining canonical root device/inode and opaque relative path. Every read chunk and every streaming hash turn resolves the current managed parent again, checks held file identity before/after, and validates root identity. A physical/containment/hash/cancellation failure permanently retires the read handle; restoring paths cannot revive it. Playback handles use the same root/parent authority and retirement. Invalid boundary requests alone do not retire an otherwise valid handle.

Write stage chunk and finish re-resolve containment, stop using compromised handles, and retain durable intents conservatively. Publication/check/sync/unlink boundaries and recovery/discard revalidate managed locations before mutation. Verified claims retain managed authority and re-resolve it inside row claim/final commit checks. No external file is read/written/unlinked through a renamed-parent symlink; ordinary unknown/interrupted files retain existing conservative policy.

Five added actual Rust regressions cover cached read/playback/claim parent replacement; parent replacement during final hash; replacing root while reusing the original file inode; partial write parent replacement; complete write finish/discard/claim parent replacement. Actual TS→Rust fixture covers cached readBlob/verify and permanent closure after parent restore, plus both partial/complete stage write/finish/discard preserving moved external bytes and permanent handle retirement.

## SB02 repair

`nativeBinary.ts` shares cancellable FIFO slot ownership across each fixed native binary service. Reads keep the existing eight-handle bound, including readStart in flight, through settled native close. Queued cancellation issues no native request. Open failures release; read/verify errors close and release; close failure releases; repeated close awaits the same settlement without double releasing; active cancellation initiates close. Malformed read acknowledgements with a canonical opaque handle are explicitly closed without trusting their reference. Original transfer failures become proper errors and remain distinct from missing/corrupt truth.

`binary.ts` preserves the original failed consume/verify error if cleanup also fails; a successful verification cannot return success if its close fails. No user/business callback is automatically replayed.

Actual concurrent native test passes twelve requested file reads; TS scheduler tests cover sixteen consumers/FIFO, canceled queued IPC avoidance, start/read/verify/close faults, malformed acknowledgements, active cancel and idempotent close.

A native business fixture independently exposed five simultaneous putMedia preparations exceeding the existing two active write-stage handles. The same FIFO primitive now gates prepare at two, without adding any batch/user limit or retrying a transaction. Twelve actual raw native preparations passed, with unique binary IDs, actual file/hash checks and discard. Shared owner was notified; subsequent shotDeleteUndo no longer reports binary busy, but concurrent project-touch snapshot conflicts remain shared owner scope and are not hidden by this repair.

## SB05 repair

`media.ts` exposes a shared ready-state `onError` bound to both binary and the current URL owner token. An element error releases its URL once, rechecks actual availability and publishes missing/corrupt/error. Valid present bytes with a decode/unsupported-format error remain preview error. Old URL callbacks, results after owner switch, and unmounted callbacks cannot change or revoke the next preview. Browser Blob URLs obey the same release/error behavior.

Handlers are connected to MediaThumb img/video, MaterialPreview img/video/audio, ReferenceAttachments and ReferenceLibrary images. SourcePlayer's narrow optional error seam chains its existing audio feedback and ignores a source URL that is no longer current. AudioPlayer, AudioExports and ScriptDocument pass their current shared media handler. No duplicate toast was added.

`mediaPreviewFailure.test.ts` exercises actual production hook/element callbacks with a dependency-aware mounted lifecycle host. This is a deterministic callback test, **not actual DOM/WK playback**. Cases cover img/video deletion, material corruption, present decode-invalid Blob, old and late error after binary switch, URL cleanup exactly once and stale SourcePlayer error. Logical records remain intact.

## Existing fixture repair

`audioMusicSaveFeedback` now supplies the shared query seam; all original native Save bytes/name, cancellation, published-warning and pending assertions are retained. `materialPreviewSave` uses a deterministic preview seam and waits for the asynchronous byte-read boundary without weakening same-tick duplicate/pending/publication assertions. `useShotMedia` uses real shared readonly `db.transaction("r",["media"],callback)` and mounted dependency cleanup while retaining previous-result/loading identity assertions. `productStorageQueries` retains persistent refs and checks the added real preview handler.

Final focused result: 6 files /48 tests. Whole tsc passed. Direct ESLint for eleven touched product source files: zero errors,22 warnings, no added suppression/debt allowance. Root retains consolidated formal gates and final source freeze. Full diff whitespace inspection found only peer-owned nativeWorkspace.ts EOF blank line and root/engine were notified; this worker did not revert their file.

## Remaining required work owned by root

1. Independent final repair review of the fixed source and successful actual native six-case proof. ENOSPC is resolved; original failed and successful retry outputs remain separate.
2. Independent repair follow-up; consolidated product/store/Agent/browser checks and any unrelated parallel transaction issues.
3. Actual packaged WKWebView dense image grid, continuing audio/video Range/seek, disappearance/error event, relaunch and system acceptance. Mac remains locked. This worker claims no actual WK playback, microphone, print, Windows or Linux result.
4. Selected non-audio/video Blob consumers still require a complete selected Blob; metadata/list queries remain unhydrated, while audio/video use opaque native range preview. This pre-existing memory limitation is not a fixture cap or a full-library hydration claim.

# Independent review: hosted native-check corrections

## Scope and original evidence

Reviewer: dispatched `trellis-check`, source baseline
`946664ab235e0996da138796bd7d364381dab6ab`, actual owner-activated run
`38208372156`, attempt1. The review loads `check.jsonl`, the task PRD/design/
implementation plan, relevant source contracts and the three current research/
implementation reports. The reviewer owns this report and its finite
`logs/release-hosted-native-check/` checkpoint only; source fixes belong to the
assigned implementers and root owns specs/task/Git. No reviewer product edit,
commit, remote action or task completion is performed.

The original macOS logs establish frontend V8 heap exhaustion after13,195
modules transform and chunk rendering begins. Windows prints64 announced tests,
36 passes and22 failures, then terminates with0xc0000409 without individual panic
text. Directory-guard and binary/media failure ownership is supported by source
inspection, not a captured per-test hosted panic. The retained Linux workflow
log ends in cancellation; its nested failed assertion is absent. No Linux
correction or hosted success is inferred.

## Reviewed source closure

| Paths | Review and result |
| --- | --- |
| `build-frontend.mjs`, `build-frontend-worker.mjs`, `build-frontend.test.mjs` | All four existing callers enter the launcher: package script, app wrapper, release builder and native checks. The worker is byte-identical to the original builder, SHA256`2c7c31fc20f3ea4ae4e9ffe547409073ceb9cfad80287492211e9026e5cf496a`. The child receives literal argv, inherited cwd/env/stdio and one fixed4096MiB old-space flag. A percentage conflict rejects explicitly. Spawn/nonzero/signal failures remain failures; supported-host launcher cancellation forwards to the actual worker. The normal/fixture distinction and original Vite plugins/alias/definitions/outDir/inline/minification configuration are preserved. |
| `paths/windows.rs`, added tests in `paths.rs` | Only pinned directory access changes to list+attributes. Real no-follow handles, read/write sharing without delete sharing, type/reparse/NTFS/volume/index checks and the owner-approved process-only namespace contract remain intact. The existing ancestor-rename test remains; a new real DELETE-open conflict/release test covers an empty directory. Ordinary metadata inspection remains metadata-only. |
| `product_binary/tests.rs` | `BinaryStore::close` clears reads and aborts live stages while the DB exists. The takeable connection then closes explicitly before root removal. All23 existing tests remain, plus2 meaningful lifecycle/error tests. Cleanup errors still fail ordinary completion; during an existing panic they report explicitly and preserve the original panic instead of aborting via a second panic. |
| `product_media/tests.rs` | Stop/join listener, retain the existing8-second reader drain, clear playback capabilities, assert unique disk ownership, close binary state and SQLite, then remove the root. `MediaServer::stop` alone does not clear `MediaPreviews`; actual lease release is therefore necessary. All9 existing tests remain, plus2 lifecycle/error tests. The two Option access bindings preserve original test bodies. |
| `logged-process.mjs`, `logged-process.test.mjs` | The two command owners share actual child output capture. Exclusive evidence open prevents overwrite. Both live streams receive their original bytes; each pipe respects backpressure. Await child `close`, then writable completion, before reporting status. Spawn, child stream, log and live-output failures reject; resources are destroyed and listeners removed. Tests use real subprocesses, multi-MiB output through EOF, literal arguments, nonzero/spawn/signal/EPIPE failures and actual post-open EFBIG. |
| `release-native-checks.mjs`, `scripts/native-storage-regression.mjs` | Actual commands, suite selection, coverage/assertions, deadlines and status authority remain. Native Rust tests add `--nocapture` to retain panic detail before abnormal exit. Step boundaries expose real status without retries. Native acceptance identity includes the newly imported log owner. The nested helper does not normalize a failure into a successful check/report. |
| `.github/workflows/desktop-release.yml` | Only finite diagnostics condition changes from`failure()` to`failure() || cancelled()`. Event/ref gates, matrix, timeouts, five-installer policy, exact verified upload, collection dependencies and sole tag-owned write permission remain. Cancellation cleanup is best effort, not a guarantee after runner destruction. |

The Windows access-mask explanation was independently checked against the
Microsoft [share-access algorithm](https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-fsa/8c0e3f4f-0729-49f4-a14d-7f7add593819)
and [file/directory access constants](https://learn.microsoft.com/en-us/windows/win32/fileio/file-access-rights-constants).
These support the narrow source correction; they do not establish an executed
Windows sharing result. The now-unused `inspect_handle(..., false)` possibility
is harmless internal scope retention and is not a correctness finding.

The effective new guard was also traced through every existing binary/media
filesystem mutation. All six binary tests that expect successful root/ancestor/
staging-directory replacement already have `#[cfg(unix)]`; the media parent/root
replacement test and its generic symlink branch also retain their Unix cfg.
Windows-enabled mutations affect ordinary child files, not the pinned ancestor
directory itself: unlink/rewrite/hard-link and media file rename/restoration.
The directory handle does not add a no-delete-share open to each child file.
No necessary new guard/body contradiction was found. Actual Windows ordinary
file mutation and stale-handle assertions remain authoritative and unexecuted
locally; they were not skipped or weakened based on this static conclusion.

## Findings resolved during review coordination

1. **Post-open evidence error coverage.** Initial diagnostics tests proved log
   opening errors but did not exercise a later write failure. The diagnostics
   implementer added a real POSIX subprocess limited to64KiB file size, with
   SIGXFSZ ignored before exec. Actual4MiB pipe output reaches EFBIG in the
   ordinary evidence file. The test asserts rejection, retained bounded partial
   bytes and successful log deletion after process exit. This case explicitly
   skips only its POSIX fault mechanism on Windows; existing portable process
   contracts remain. No production hook or process/filesystem mock was added.
2. **New runner provenance.** Native acceptance `identity()` initially omitted
   the newly imported desktop logging helper. Root coordinated one explicit
   `desktop/tauri/scripts/logged-process.mjs` addition to the fixed file list.
   The original scope and tool/test registry mapping remain; no broad desktop
   entry discovery or unused-export suppression was introduced.

No other actionable source defect was found in the reviewed candidate.
`desktop-distribution.md` and `shared-product-storage.md` now record the verified
launcher, directory access, diagnostic and fixture-lifecycle contracts without
claiming hosted acceptance.

## Verification

The reviewer independently executed the actual8 launcher and10 logging
subprocess contracts; all18 passed. The worker/original hash comparison is
byte-equal. Existing binary/media test-name comparison found no removed tests.
The12 reviewed source hashes are retained in
`logs/release-hosted-native-check/review-checkpoint.json`.

Root coordinated resource-heavy gates sequentially on frozen source. The
retained `logs/release-hosted-final/product-checks.json` currently establishes
root types/quality/self-test/model verify, desktop types/lint/Knip and complete
desktop release tests all exit0 across1,016 input hashes with no changes.
`rust-checks.json` establishes locked all-targets strict Clippy and Rust tests
for both`test-hooks` and`product-sqlite,test-hooks`, fmt and portable contracts,
all exit0 with no changes to the30 Rust source hashes. These are actual local
macOS ARM64 checks, not corresponding-host Windows/Intel/Linux proof.

The frontend implementer's actual normal build exits0 in31.01s, peak RSS
2,585,460,736 bytes, with526 unchanged frontend inputs; the fixture acceptance
build exits0 in3.53s, peak RSS845,594,624 bytes, with543 unchanged inputs. The
reviewer did not repeat those heavy builds after proving the worker config is
unchanged. Original large-chunk warnings remain visible.

Final ordinary root/native-all results and current-source hash reconciliation
are to be appended after root's coordinated run completes; this report does
not predeclare an in-flight gate passed.

The first complete ordinary root run is retained as a failed attempt:
3,959 passes,7 skips and one existing durable Agent loop case timing out at its
unchanged5-second deadline. The64-tool/reopen/resume body and its assertions are
unchanged from the hosted source that passed3,960 tests. None of the12 corrected
paths is an ordinary Agent/DB or test-fixture implementation. The isolated
unchanged case then passes in1.2s, with21 other cases explicitly skipped only by
the focused filter. That focused pass is not a full-suite pass or proof of an
exact resource/timing cause. Root schedules one complete unchanged-source
recheck; no Agent source, fixture, concurrency or timeout was relaxed.

The complete native SQLite run subsequently reaches the same64-turn Agent
case timeout at the existing20-second native deadline, with1,904 other cases
passing. Because both ordinary/native gates reached this case, the candidate
does **not** yet satisfy the complete final gate. One previous task profile
already documented the same case's cumulative read cost and native deadline
margin. Root is obtaining bounded current measurements and source comparison
before selecting any change; repeat retries or an unexplained timing-fluke
conclusion are not an accepted resolution. Linux's missing original error
remains separate and cannot be identified with this local case.

Independent historical comparison is retained in
`logs/release-hosted-native-check/agent-prior-comparison.json`. The current native
probe SHA256`4d81003f3fc5835a9112a47864467b33a99cd6d39e748aeb68804358dde6da40`
and13,968,280-byte size match both previous passing native checkpoints. The
prior recheck's main108-suite duration was258.61s; the current failed main lane
takes393.60s. The additional self-hosted suite remains47.26s versus48.04s prior.
Comparing previous/current acceptance hashes finds only the new logging helper,
its root CLI and four Windows/Rust-test paths changed; all Agent business, test,
store and fixture inputs remain byte-identical. This narrows causal hypotheses
but does not prove host pressure, logging overhead or a specific product defect.

## Bounded Agent follow-up review

Root expanded the local corrective scope only after both complete gates reached
the existing 64-turn case. The proposed `runChat.ts` delta adds the identical
completed/failed/rejected snapshot filter already used by the first preflight
pass, after the per-item Abort check in the second pass. Every initially
nonterminal entry still obtains a fresh point read, current running run,
code-owned metadata/permission validation and atomic pending/approved claim.
Uncertain-result lookup and append-results behavior are unchanged. This is valid
under current legitimate command transitions and the thread execution lock; the
exported generic transition helper is not an immutable state graph and can
technically reverse terminal states. The new spec correctly states that limit.

Independent comparison of the implementer's matched actual SQLite profiles
finds begin 3,475→1,363, point get 5,426→3,314, and validate/abort 2,672→560:
exactly 2,112 historical read transactions removed. Query 553, prepare 613 and
seal/commit/change 803 each remain unchanged, with identical query shapes and
the same native probe bytes. Both preserve the original 20-second deadline,
actual coverage recording and all original 64-turn chain assertions. Measured
fixture duration is 15,482→14,864ms; subprocess wall duration 15.806→15.110s.
These prove the operation-count reduction and a modest local time improvement,
not a general timing guarantee or hosted pass.

Both profile configs execute the retained original research fixture at
`logs/ci-native-loop-timeout/agentToolsProfile.test.ts`, while the database
interceptor imports each new side's metrics. Consequently new result files have
empty phase/model arrays: their IPC counters are actual, but no new per-segment
breakdown is established by these files. The implementer was asked to retain
the executed fixture path/hash and qualify this provenance explicitly. The
baseline/candidate copied fixture and interceptors are byte-identical; only
the database-wrapper path differs in the matched config.

The final added five cases use real stores and transparent point-read spying,
without replacing storage operations: three rounds settle exactly three unique
calls, and the old implementation demonstrably performs six reads and fails
that regression. A later tool's async preparation changes an earlier originally
pending entry to completed (using actual atomic thread-title and ledger commit),
rejected or unknown. Assertions preserve exact original call identity/result,
one completed effect, no rejected effect, and no unknown dispatch/retry. A Stop
during later preparation preserves historical results and leaves both new calls
pending. Existing approval, metadata drift, uncertain effect and Stop cases
remain. The original 64-turn case body is byte-identical (SHA256
`b8a25339c65a062c822af4a3d5db85fbb9b69b8a77eb44e8a9ea739de6923c9d`).
The reviewer found no additional actionable source defect in this narrow delta.

The implementer retains browser Agent/metadata two-file 44/44 passes and the
expected old-implementation regression failure. Their actual SQLite counterpart
also passes all44 in23.50s (23.663s subprocess wall), with real coverage, one
worker, unchanged20s test/hook deadlines, no changed source inputs and the same
native probe bytes. Both new source hashes are recorded in
`review-checkpoint.json`; the original twelve corrected sources still match the
independent review checkpoint. Complete new-source quality gates and hash
closure remain pending. The reviewer has not substituted a focused pass for
complete ordinary/native acceptance.

## Final frozen-source verification

Root's coordinated final receipt in `logs/release-hosted-final-after-agent/`
establishes all eleven sequential checks exit0: root types/quality, desktop
types/lint/Knip, release64 tests, complete ordinary root tests, complete SQLite
acceptance, root build, desktop normal build and diff check. The reviewer
independently reconciled all1,016 before/after hashes with the current files:
no input changed, and all14 reviewed source hashes match. Prior Rust fmt,
both feature-set Clippy/test gates, portable contracts, quality self-test and
model verification remain valid on unchanged corresponding inputs; retained
gate reconciliation names only the two Agent paths as the prior source delta.

The actual complete ordinary run passes228 files,3,965 tests and7 existing skips.
The actual SQLite main lane passes108 files and1,910 tests; the self-hosted
binary lane passes6 and the explicit browser capability lane passes5. Native
`--suite all` exits0 in377.52s, with no changed inputs and the same real Rust
probe. The reviewer independently reconciled all95 registered tool names with
the95 coverage entries: each has valid/invalid parse evidence and successful
execution. All49 registered tables map to30 actual business assertion groups;
all30 owner-assertion groups retain corresponding SQLite commits, and their
actual case texts remain in the source. All missing-success/argument/committed-
table/business-table/owner-assertion lists are empty. Coverage receipts and
passing command assertions are used together, not as proof from counters alone.

Current normal desktop build exits0 (18.52s subprocess wall), peak RSS
3,167,289,344 bytes; root build exits0 in24.26s. Final acceptance frontend
compilation also exits0 in2.932s on unchanged1,016 inputs. That last check uses
explicit synthetic localhost/token compile-only values and does not establish
an application/provider/media run. Existing large-chunk warnings remain.

Both earlier complete failed attempts remain in `logs/release-hosted-final/`,
with focused/profile limits retained above. The final candidate has no relaxed
64-turn workload, assertion, timeout, tool registry, installer policy or release
event/permission gate. Local source review and validation pass; task-wide hosted
and installer completion remains outside this conclusion.

Root stored the four newly generated oversized acceptance/coverage receipts
as deterministic gzip, indexed by `logs/release-hosted-evidence-compression.json`
and each `sqlite-all/EVIDENCE.md`. The reviewer checked the complete original
JSON before packaging, then independently decompressed all four `.json.gz`
files: raw/compressed SHA256, original byte lengths and zero gzip mtime all
match the manifest. The former native receipt still has exit/testExitCode1;
the final receipt has both0. Final95-tool/49-table/30-business-anchor reconciliation
also passes after decompression. No pointer masquerades as an original receipt.
This changes no source/tests or pass/failure conclusion; both failed and
successful original records remain byte-for-byte recoverable. The final readback
is retained in `logs/release-hosted-native-check/final-readback.json`.

## Findings not fixed / outcome limits

- **Unknown Linux failed assertion:** source-specific correction would be
  speculation because the cancelled original run has no nested error artifact.
  New live output and cancellation diagnostics improve the next owner's run;
  they do not repair or identify that unknown cause.
- **Corresponding-host acceptance:** Windows guard/teardown semantics and
  macOS Intel/Linux native suites/installers require actual owner-activated
  reruns on the corrected source. Only the Darwin ARM64 target is installed
  locally; no Windows cross-target compile or host execution is claimed.
- **Release completion:** H1a installers, Linux format/runtime/media inventory
  and H1b real draft asset/retry evidence remain required task gates. Local
  checks do not authorize complete/archived task state or a complete draft.

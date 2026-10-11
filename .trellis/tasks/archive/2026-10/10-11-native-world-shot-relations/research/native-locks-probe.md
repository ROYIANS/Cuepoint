# Independent native Web Locks probe

## Change boundary

The source already coordinates Agent runs, task wrap-up and audio batches using Web Locks. Existing injected-manager tests cannot establish that the actual macOS WKWebView provides the real default manager. This change adds an acceptance-only, visible check for that gap. It does not change product source, capabilities, allowed origins, Rust commands, lock fallback/ownership semantics, or the shared product database owner.

Owned changes:

- `desktop/tauri/ui/acceptanceLocks.ts`: finite real-manager checks, importing the unchanged production `withThreadRunLock` with **no manager argument**.
- `desktop/tauri/ui/acceptance.tsx`: one import and an independent `验证原生 Web Locks` button. This action does not call `setup`, `runAll`, microphone or print checks, and never calls `persist(true)`.
- `desktop/tauri/scripts/native-locks-regression.mjs`: a one-off isolated finite runner that reuses `reserveStreamServer`, `build-app.mjs --acceptance`, and the existing closed `Evidence.persist` report sink. It owns only its spawned build/app children and records a separate lock-only receipt.
- `desktop/tauri/package.json`: mechanical `test:native-locks` entry registration, authorized by the coordinator, so the real script is reachable and Knip recognizes it.
- This report and specifically named validation logs. No task completion, commit, archive or push is part of this subtask.

## Checks and assertion boundary

Each lock request has a 5-second observation deadline. Every held gate is released and every queue controller aborted in `finally`; the final cleanup waits finitely for pending requests. Unique random probe IDs cannot recover or interrupt an existing user thread. The imported helper may access its isolated acceptance IndexedDB for its existing recovery prelude, but the probe never creates user threads, tasks, generation jobs or model requests and never runs the historical SQLite fixture setup.

| Probe | Actual code/API exercised | Assertion |
| --- | --- | --- |
| Environment | `isSecureContext`, `navigator.locks.request/query` | Real packaged secure context and unmodified manager are available |
| Agent contention | Actual default `withThreadRunLock`, no injected manager | First owner visibly holds the exclusive `cuepoint:agent:<id>` lock; the same thread is refused with zero execute calls; a different thread enters while the first remains held |
| Normal release | Actual default helper | Same thread can acquire again after normal completion |
| Exceptional release | Actual default helper | Original sentinel error identity survives; same thread can acquire again |
| Queued cancellation | Raw actual `navigator.locks` request/query/AbortSignal | An actual pending queue entry is observed, abort returns `AbortError` with zero queued callback calls, and release permits reacquisition |
| Audio lock prefix | Actual raw API using unchanged `cuepoint.audio-batch.<id>` name and `ifAvailable:true` | Same-name owner is exclusive and releases for reacquisition; no audio generation is dispatched |
| Cleanup | All owned promises/gates/controllers | Zero pending owned requests after finite cleanup |

**Limits:** queued AbortSignal is a Web Locks API check, not a new option on production `withThreadRunLock` (which uses immediate `ifAvailable` and has no queue signal option). The audio prefix check verifies actual platform exclusion under the existing name, not a complete batch dispatcher or paid generation flow. Contention uses two concurrent attempts in one WKWebView; it is not a two-window application acceptance claim. Lock behavior and actual product use/UI evidence are separate layers.

## Task wrap-up / audio source mapping

- `src/lib/agent/runOwnership.ts`: `browserLocks()` returns real `navigator.locks`; `withThreadRunLock` requests `cuepoint:agent:${threadId}` with `ifAvailable:true`, refuses a null lock before recovery/execution and holds it throughout the awaited callback.
- `src/lib/agent/taskWrapup.ts`: `prepareTaskWrapup` encloses preparation, model wait and publication inside that same unchanged helper using `task.threadId`. `recoverTaskWrapups` probes the exact same `cuepoint:agent:${threadId}` name and does not interrupt an owner while a null lock is returned. This is source mapping plus existing contract regressions; the lock probe does not send a wrap-up model request.
- `src/lib/audioGeneration/batchRuntime.ts`: `ownership` requests `cuepoint.audio-batch.${batch.id}` with `ifAvailable:true`; an Agent-owned batch also nests this inside the shared thread helper. Existing dispatcher regressions cover refusing competing dispatch, zero duplicate provider calls and holding ownership while a sibling drains. The lock probe checks the platform/name layer directly without making a batch/job.

## Offline/source validation

- Desktop strict types: passed (`native-locks-types-final.log`). The initial log retains the one unused-import diagnostic before its removal.
- Desktop lint: passed (`native-locks-lint-final.log`; final runner-only change rechecked in `native-locks-lint-runner-final.log`). The initial log retains unused-import/require-await diagnostics, both corrected locally.
- Desktop Knip quality: passed (`native-locks-quality-final.log`). The first run reported the new standalone runner as unreachable; the accurate package script registration fixes that single diagnostic without an ignore.
- Existing `agentRuns.test.ts`, `audioGenerationBatch.test.ts`, `agentTaskWrapup.test.ts`: **3 files / 74 tests passed** (`native-locks-owner-regressions.log`). These injected/fake-indexeddb source contracts are explicitly not native runtime evidence.
- Runner `--check`: **6 offline receipt-oracle cases passed** (`native-locks-report-oracle.log`): complete partial report, incomplete report, whole-acceptance completion rejection, missing check rejection, failed event rejection and inappropriate whole-product success rejection. No native lock execution is claimed.
- Node script syntax and owned tracked-file whitespace checks passed.

## Packaged run protocol / current result

The coordinator authorized building/launching the targeted runner after reviewing the minimal patch. The runner creates an existing `.acceptance/run-*` directory (ignored), reserves a separate synthetic loopback fixture endpoint, builds the historical `--acceptance` lane and launches only that copied bundle's child. It does not operate the real/normal/network product apps or the coordinator's fixture server, inspect credentials, or operate CUA. The coordinator clicks the visible button in the actual app.

The real sink keeps `finishedAt: null`. A lock-only completion event must contain every expected successful check and explicitly set both whole-product and whole-historical acceptance completion to **false**. The runner saves `native-locks-runner-receipt.json` with pre/post source hashes, bundle receipt and binary SHA-256. It leaves a passing visible result available for 30 seconds before terminating only its own child. The overall 15-minute deadline also bounds an app that never reports.

**Actual macOS packaged lock-probe result: passed.** The coordinator clicked the independent button in the actual app and saved `packaged/49-native-locks-probe.ax.txt` / `packaged/49-native-locks-probe.png`. The real report has all seven checks plus the terminal lock-only event passing; `finishedAt` remains **null** and both whole-acceptance flags remain **false**. Actual normal-product Agent/task/audio UI evidence remains owned by the coordinator, as does any later cross-platform acceptance.

Exact run:

- App: `desktop/tauri/.acceptance/builds/1791710793100-acceptance/Cuepoint Acceptance.app`.
- Isolated run root: `desktop/tauri/.acceptance/run-c76ac23f-7983-42da-b1ba-7eb80ea6292f`; app PID was `43535`, launched by finite runner session `23829`.
- Binary SHA-256: `1c3c92d9bd72bf463017be318d3c6a8ed098c470e828a3614b0741f93051ab64`.
- Build returned code 0. The release log retained the existing two vendor HTTP unused-variable warnings and skipped local ad-hoc notarization; no warning-free or notarized distribution claim is made.
- Launcher returned code 0 after the observation interval and terminated only its own app child. The reserved synthetic stream server was closed; its recorded event array is empty because this lock-only check sent no network request.
- Runner receipt reports `outcome: "passed"`, `stable: true` for its seven selected support/owner source hashes, eight named real packaged events, `wholeProductAcceptanceComplete: false` and `reportFinishedAt: null`.

Persisted byte-identical evidence copies:

| File | Bytes | SHA-256 |
| --- | --- | --- |
| `native-locks-packaged-report.json` | 3387 | `d7852cfe7972c0172f76f5bd4735d96e489e91a5f3e694eb5dc2eb079b009672` |
| `native-locks-runner-receipt.json` | 2496 | `3b8433c8a86b20a3f2ed65e776a80856e3e69750de3edba95948cb30a511f05b` |
| `native-locks-build-launch.log` | 400 | `99e2b41857470010c347488231972001aa6da3ee8b1a8b3b2d0d640ece512b7a` |
| `native-locks-fixture-events.json` | 3 | `37517e5f3dc66819f61f5a7bb8ace1921282415f10551d2defa5c3eb0985b570` |

The report's inherited historical environment description names its SQLite/projection lane. It is not evidence that this independent action ran fixture setup, projected business data, recorded microphone audio, printed a storyboard, or completed the historical suite. The verified observations are secure `tauri://localhost`, actual unmodified `navigator.locks`, one Agent owner / zero same-thread competing execute calls, successful independent-thread execution, normal/exceptional reacquisition, an observed raw pending queue canceled with `AbortError` / zero callback calls, audio-prefix exclusion/reacquisition, and **zero pending owned requests** at cleanup. These macOS native support checks do not establish Windows/Linux availability or two-window application behavior.

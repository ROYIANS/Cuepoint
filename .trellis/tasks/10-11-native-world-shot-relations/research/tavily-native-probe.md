# Independent Tavily protocol over native HTTP

## Scope and result

The dedicated visible test-only app passed its bounded actual macOS probe after root clicked its sole button. The seven checks, three native fixture requests, owned configuration cleanup and unchanged selected source/binary identities are independently reconciled below. The product keeps its fixed `https://api.tavily.com` endpoint, original UI/configuration, credentials/approval boundaries and official native HTTP service. Live Tavily remains conditional on a real authorized account; a missing key is not proof of paid search success.

The approved plan separately requires deterministic Tavily protocol fixture transport. Existing `webResearch` tests inject service/model responses; `runtimeFetch` tests inject native transport; merely having `/usage`, `/search`, `/extract` in the loopback server is not a completed packaged protocol run. This bounded lane fills that transport check with shared adapters and an explicit synthetic route seam.

## Implementation boundary

- `ui/tavilyProbeFetch.ts` accepts only adapter-generated fixed Tavily URLs for these three paths, exact GET/POST methods, the fixed synthetic key, omit credentials and error redirects. It maps only their paths to the stated exact loopback origin. This explicit `fetchImpl` exists solely in the probe bundle; production endpoints and global fetch are untouched.
- `ui/tavilyProbe.ts` calls actual `testSearchConnection` / `executeWebRequest`, whose validation, single-request policy, result parsing and safe source projections remain shared. Its transport is existing `connectorProbeFetch`, which calls real `createRuntimeFetch` → exact origin authorization → official native plugin in the packaged app. Browser fallback is not used for remote requests when the genuine native runtime is present.
- Each run has a unique `dev.cuepoint.review.tavily.<uuid>` application identity, WKWebView store and namespaced compatibility database. It rejects non-dedicated runtime/profile or any prior search row before creating synthetic configuration. It never overwrites an existing configuration. Cleanup deletes only its own revision and no fixture server or other application process is owned/terminated.
- `tavilyProbeMain.tsx` has one visible “验证 Tavily 原生合成接口” button and visible per-check events. It initiates no automatic probe. No workspace setup, SQLite project initialization, real keys/provider calls, tool approval bypass or hidden model/IPC test invocation is introduced.
- The runner builds a separate `Cuepoint Tavily Review.app`, preserving normal build scripts and all product/Rust source. Its `--build-only` mode exits without launch. Later `--launch-built` validates the original source/binary identity before starting its own child. It waits for the root-operated visible button and unfinished partial report; there is no UI automation in this worker. Only its child is terminated after the finite observation period. The root-owned loopback fixture at 56368 is reused without start/stop/reconfiguration.

This is shared Tavily adapter/protocol plus actual native transport evidence. It does not prove real Tavily TLS/DNS/auth, key entitlement, actual search quality, all registered Agent web-tool approval/history cases, the normal-profile endpoint path or whole product acceptance.

## Required actual checks

The partial report must contain the exact seven-event sequence: dedicated identity/scope; GET `/usage`; POST `/search`; POST `/extract`; stale-revision zero-request rejection; owned synthetic row cleanup; terminal independent-probe event. Search and extraction assert exact synthetic source text/URLs. Successful execution sends exactly three local requests and no paid requests. Report `finishedAt` stays null; live/whole acceptance flags are false. Root should correlate the existing fixture events with the three native requests and retain visible app/AX evidence.

## Completed source/build checks

| Gate | Result |
| --- | --- |
| Root full Vitest | 213 files; 3632 passed; one skipped |
| Root TypeScript / quality | PASS / PASS |
| Desktop TypeScript / lint / quality | PASS / PASS / PASS |
| Strict new-test compilation | PASS |
| Focused tests | Three files / 63 cases, including 22 new probe cases |
| Offline report oracle | Eight cases PASS |
| Dedicated native build-only | PASS; app not launched |

The 22 probe source cases inject the final transport and cover exact route/method/key policies, real adapter payload/result behavior, stale revision, isolated profile, existing config refusal and own cleanup without a completion claim on failure. They are not actual HTTP/OS observations. An initial unused exported mapper and a strict test-table header inference failure were corrected without ignore/debt/weakening, and their logs remain retained. Quality keeps 13 reviewed allowances, 568 visible warnings and zero failures. Native build logs retain the two historical cookie-disabled vendor warnings; Vite also reports the existing static/dynamic database import chunking observation. No warnings are disguised as zero.

## Historical build-only checkpoint

[Eight-path freeze](tavily-probe-source-freeze.json), [verification receipt](tavily-probe-verification.json) and [build receipt](native-tavily-build-receipt.json) identify the test lane. The build's selected eleven source paths are stable; this is a selected-source comparison, not an entire-repository binary reproducibility claim. Product print/vision freezes were independently reverified unchanged. Root controls the final actual launch timing and CUA, and the whole task remains in progress.

Run root: `desktop/tauri/.acceptance/run-ec68f6da-9951-403c-a224-caf8ea1d9b7b`. App: `Cuepoint Tavily Review.app`. On root readiness, launch the already built app with `node scripts/native-tavily-regression.mjs --launch-built --root <absolute run root>`, then root clicks the dedicated button. Actual outcomes will be appended only after its report and correlation are inspected.

## Actual visible native run

Root authorized launch after quitting its real application, then clicked the visible button. The reviewer launched only the existing binary with `--launch-built`; [actual launch log](tavily-probe-launch-actual.log) records success and runner exit 0. [Root AX](packaged/104-native-tavily-probe.ax.txt) and [screenshot](packaged/104-native-tavily-probe.png) retain the visible result. The [packaged report](native-tavily-packaged-report.json) has all seven checks passing, `finishedAt:null`, exactly three synthetic requests, zero paid requests, successful stale-revision rejection with zero requests, owned configuration removed and both whole-acceptance flags false. [Final runner receipt](native-tavily-runner-receipt.json) retains eleven selected source hashes unchanged; current files and the binary hash were independently rechecked. Own child PID 72663 exited; the fixture was not operated by this reviewer.

[Actual verification receipt](native-tavily-actual-verification.json) independently correlates the [root-saved current-epoch server ledger](packaged/104-native-tavily-fixture-events.json): request 18 is GET `/usage`, 19 POST `/search`, 20 POST `/extract`, all at 13:29:22 UTC with `tauri://localhost`, authorization present, no cookies and completed responses. Exact shared-adapter request bodies are independently reconstructed: 0, 178 and 114 bytes respectively, with matching SHA-256. No additional search/extract/usage request exists in that epoch snapshot. Request 21 `/evidence` is the root's subsequent read-only capture and is excluded. Server logs retain authorization presence only; the fixed synthetic key comes from the frozen strict routing and actual report, not an invented raw-header observation. Request-body hashes are not response hashes; successful adapter checks separately verify the exact synthetic response text.

The runner's historical `storage:sqlite` identity field and generic evidence environment text do not describe normal product storage. The exact probe identity event supplies its unique namespaced compatibility database, and the probe never initializes SQLite projects. Actual synthetic transport is closed; live Tavily and whole product/task completion remain separate conditions.

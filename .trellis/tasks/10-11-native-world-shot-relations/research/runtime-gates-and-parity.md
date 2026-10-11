# Runtime gates and complete product parity inventory

Date: 2026-10-11. Source inspection only. The user selected complete existing functionality in Tauri with internal IndexedDB before centralized SQLite replacement. Entries below are acceptance targets, not completed results.

## Gate extraction

The normal Tauri frontend already builds the real root product (`desktop/tauri/scripts/build-frontend.mjs:13`). No new native product pages are needed.

| Existing source | Coupling to replace | Behavior to retain |
| --- | --- | --- |
| `src/lib/nativeWorkspace.ts:197`, `:302`, `:495` | Product callers must not assume native identity means the SQLite product owner | Genuine Tauri detection and trusted closed IPC remain available |
| `src/lib/productRouterHistory.ts:6` | None: navigation is a platform concern | Tauri hash history; browser path history |
| `src/lib/videoWorkspaceRepository.tsx:844`, `:856` | Native automatically selects SQLite repository and disables Dexie live queries | Normal desktop IndexedDB owner selects existing complete browser repository/queries |
| `src/routes/_studio.index.tsx:6` | Native starts at projects instead of Agent | Restore existing shared full-product entry; no new native landing page |
| `src/routes/_studio.tsx:16`, `:20`, `:31` | Limited route allowlist, disabled imports and capability page | Existing full routes/imports under IndexedDB owner |
| `src/components/studio/MaterialLibraryPage.tsx:28` | Native switches to simplified managed-file list | Existing complete material library under IndexedDB owner |
| `src/components/studio/ProjectGalleryPage.tsx:44`, `:72`, `:216`, `:262`, `:289`, `:334`, `:403`, `:428`, `:478` | Native disables audio/music, IP, export/actions and changes deletion meaning | Existing IndexedDB project semantics and controls |
| `src/components/workspace/ProjectHomePage.tsx:53` | Native rejects audio/music | Existing audio/music page dispatch |
| `src/components/workspace/WorkspaceChrome.tsx:121`, `:122`, `:171`, `:318`, `:342`, `:361` | Core-video allowlist and disabled import/backup/world/produce/print/memory/cover | Existing product navigation and operations |
| `src/lib/media.ts:22`, `:49` | Native returns no media/rejects uploads | IndexedDB Blob copy/query and preview lifecycle |
| `src/lib/useShotMedia.ts:14` | Native returns empty index | Actual shot media projection for preview/gaps/production |

`NativeAssetLibraryPage` is reachable only through the old SQLite selection; it is not another full-product implementation to extend. Tests for SQLite adapters/commands remain separate from the normal IndexedDB product lane.

## Platform boundaries that stay native

- `desktop.rs:1325`: trusted packaged root navigation; shared product routes remain fragments rather than widened document navigation.
- `desktop.rs:1335`: trusted main window microphone permission uses the OS prompt; other permissions are rejected by the current contract.
- `capabilities/main.json:6`: closed workspace IPC and print permissions; new runtime services need declared commands/plugins and capabilities.
- `desktop.rs:1321`: fixed WKWebView data-store identifier currently exists. A different bundle identifier alone is insufficient evidence of storage isolation. Use a stable per-profile WebKit store identity and an explicit fresh desktop IndexedDB namespace; acceptance gets a separate identity/namespace and must prove isolation/reopen.
- Normal microphone usage text currently describes a temporary three-second acceptance. Product usage must accurately describe user-triggered audio recording.

## Native API acceptance matrix

| Concern | Shared source | Required packaged verification |
| --- | --- | --- |
| IndexedDB / Blob / transactions | `src/db/database.ts:112`, existing commands | Fresh app namespace, text + real Blob persistence across full close/reopen; no access to previous SQLite/browser data |
| File input / import cancel | `src/lib/media.ts:67`, `library.ts:17`, React inputs | Real picker, supported files, cancel settles without a hanging promise; format/error state |
| Internal copies | `src/lib/workspace.ts:156`, `media.ts:54` | Byte/hash equality and continued use after external source removed; these are internal Blobs, not a filesystem-workspace claim |
| Saving exports | `src/lib/projectPackage.ts:344`, `episodeDelivery.ts:192` | ZIP/package/CSV/audio/music share a native save boundary if WebKit anchor downloads do not suffice; byte equality, cancellation, existing destination and cleanup |
| Media URLs/playback | `src/lib/media.ts:29`, material/reference/audio consumers | Image/video/audio render/play, MIME and Blob URL replacement/release |
| Document parsing | `src/lib/references/pdf.ts:20`, `import.ts:19` | Bundled PDF worker/CMap/fonts, DOCX/text, corrupt/canceled document behavior; local asset fetch stays in WebView |
| Clipboard/paste | `FloatingComposer.tsx:329`, `ScriptDocument.tsx:232` | Text/image paste and existing message copy controls. Source contains no explicit `navigator.clipboard`; entity copy is not OS clipboard evidence |
| Print | `StoryboardPrintPage.tsx:101` | Actual system preview, white/A4 landscape/chrome-free/multipage |
| Recording | `src/lib/audio/recorder.ts:29` | Device selection, explicit user gesture/permission, recording/stop/final chunk/MIME/local save |
| Web Audio/mix | `src/lib/audio/engine.ts:140`, `exportMix.ts:10` | User-gesture playback, decode, timeline, OfflineAudioContext render, WAV integrity |
| Web Locks | `src/lib/agent/runOwnership.ts:12`, `audioGeneration/batchRuntime.ts:21`, `taskWrapup.ts:78` | Actual `navigator.locks` support/exclusivity; use existing lock abstraction with native service only if needed, never silent ownership loss |
| Local/session state | ChatWorkspace, FloatingComposer, MusicWorkspacePage | Owner-specific preferences/drafts and variant relationships; no unwanted cross-profile storage |
| External links | WebResearchSources, AboutPage | Open through OS browser while retaining packaged navigation restrictions |
| Optional telemetry | `src/lib/umami.ts:3` | Do not expand remote `script-src` for parity; honor existing enablement and packaged environment |

## Network inventory

- `requestBoundary.ts:12` is the centralized request seam for chat/Responses, models/connection probes, AIHubMix, APIMart, MiMo and Tavily. Existing provider protocols support `fetchImpl` injection.
- `chatStream.ts:345`, `responsesStream.ts:146`, `boundedSse.ts:75`: keep streaming/reasoning/Stop/partial-failure algorithms.
- `aihubmix.ts:161` and `:363`, `apimart.ts:158` and `:372`: generation APIs, download and polling.
- `generationRuntime.ts:407` directly invokes `(options.fetchImpl ?? fetch)` for signed CDN downloads: include it in the runtime transport audit, preserving omitted API keys/cookies, `redirect:error` and byte limits.
- `mimoSpeech.ts:76`, `apimartAudio.ts:105`, `:215`, `:258` and audio runtime: speech/music plus query/unknown/stop recovery. Refresh/reopen never automatically resends paid POST.
- `tavily.ts:52`: search/extract with independent connection, cancellation/errors and sources.
- APIMart input includes FormData/reference-image upload; a JSON-only native transport cannot deliver parity.
- Local PDF/font/worker asset fetches retain the original bundled WebView behavior; do not route them through an HTTP-only service.

## Full feature / tool-family acceptance map

| ID | Existing product family | Minimum mapped evidence |
| --- | --- | --- |
| P1 | Agent conversation/execution | Existing shared UI; thread lifecycle, model/reasoning, ordinary/smart/task modes, project binding, attachments, body/reasoning stream, Stop/retry/resume, approval/denial, tool loading, plans/budgets, compaction, finishing/final review and raw history after reopen |
| P2 | Agent tasks/records | Board/Inspector, task lifecycle/requirements, records/versions/wrap-ups, message/tool/generation provenance; `task_read/create/update/record_write/record_read` |
| P3 | Video production | Film/series/project lifecycle/archive/IP, episodes/story/beats, shot relationships/order/copy/bulk/filter/undo, frame/clip/reference slots, cover/proposals/delivery/ZIP/CSV/storyboard |
| P4 | World and creative settings | Project world/background/rules; project/studio four entity types and details/CRUD/search; studio copy, default/three-state shot style and relationship cleanup |
| P5 | IP/material library | IP lifecycle/profiles/binding; global/IP/project scopes, media/documents/settings tabs, imports/preview/metadata/versions/adopt/update/promote/archive/release; all IP/material tool names |
| P6 | Audio | Chapters/scripts/segments/speakers/takes, import/record, timeline placement/edit/split/delete/play/mix export; single/batch speech, duration-based selection/arrangement/undo |
| P7 | Music | Drafts/variants, Flow/Suno submit/query/recovery, works/candidates/play/select/reuse/export |
| P8 | Image/video generation | Provider capabilities/defaults, prepare/confirm/submit/query/download/apply, batches/comparison/selection, conflict/failure/unknown-outcome recovery |
| P9 | Memory/references/research | Memory/version enablement and historical retrieval, documents/images/reference attachments, actual model image input, Tavily search/read/sources |
| P10 | Connections/settings/help/packages | Model/search connections, Agent permissions/skills/context, About, project ZIP import/export, common save boundary and old route alias resolution |

Authoritative tool families: `src/lib/agent/tools.ts` plus businessToolNames, audioMusicToolNames, materialToolNames, ipToolNames, memoryToolNames, referenceToolNames and webToolNames. Also include generationTools, taskTools and discoveryTools registration. The execution matrix must enumerate registered names and assign each to a family/evidence row; family-level spot checks alone do not prove every individual tool.

Existing not-implemented image and copywriting project kinds (`projectKinds.tsx`, `available:false`) remain unavailable. Complete parity covers existing implemented behavior; it does not create those new products.

Source: `next_native_slice` read-only whole-product runtime audit. No acceptance result is claimed here.

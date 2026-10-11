# Research: Tauri packaged compatibility fixture preflight

- Query: Prepare actionable Stage B fixture/helper/build evidence while native storage Stage A is being implemented; verify a real local Chinese PDF that loads package CMaps/fonts and identify existing deterministic media/document/print/export paths.
- Scope: mixed, read-only repository and installed-tool inspection plus an in-memory PDF parser probe; write ownership is this research file only. No installation, source/config/lifecycle edits, Git operation or native application launch.
- Date: 2026-10-11

## Findings

### Local fixtures and installed generators

There is no repository-owned MP4, PDF or DOCX binary in the inspected `tests/`, `scripts/`, `desktop/` or task archives after excluding node_modules/build/tool caches. Most PNGs in task archives are acceptance screenshots, not useful media inputs. Existing reusable material is:

| Path / generator | Use and finite evidence |
| --- | --- |
| `public/brand/logo-32.png` / `logo-256.png` | Actual repository PNGs for decode/import, without remote URLs. Prefer a newly generated colored 64×48 fixture for explicit width/height expectations; keep logo bytes unchanged. |
| `tests/references.test.ts:18` | Embedded PNG signature sample. Signature success alone does not prove browser decode; use a real generated PNG for Stage B. |
| `tests/references.test.ts:19` | JSZip generator of minimal real DOCX: `[Content_Types].xml`, `_rels/.rels`, `word/document.xml` containing two paragraphs. Uses installed root JSZip; no new document library needed. Set fixed ZIP entry dates when creating an immutable fixture, and escape arbitrary XML text. Existing test executes real Mammoth extraction at `:50`. |
| `tests/fixtures/e03/harness.tsx:22` | Deterministic valid 8 kHz mono PCM16 WAV (4 seconds, 220 Hz), header/sample generation in the fixture. Existing audio workspace seeding is a pattern, not permission to reuse its historical generation-job data wholesale. |
| `src/lib/audio/wav.ts:13` | Prefer invoking actual `encodePcm16Wav` on 48 kHz Float32Array samples to generate Stage B WAV; this helper produces stereo PCM16 even for a mono source. |
| `tests/fixtures/d03/harness.tsx:159` | Real decode/export integration recipe using `encodePcm16Wav`, `addAudioTake`, `addAudioClip`, `loadAudioBuffer` and `exportAudioMix`. It demonstrates how to exercise actual owners instead of fake Blob text. |
| `.trellis/tasks/archive/2026-10/09-22-audio-arrangement-experience/acceptance/local-duration-{1,2,3}.wav` | Actual inspected WAVs: 24 kHz, mono, PCM16; 1.25 / 2.5 / 3.75 seconds. Do not make permanent tests depend on archived task paths: copy only approved immutable inputs into the prototype fixture directory with provenance, or generate fresh fixtures. |

Inspected archived WAV provenance:

```text
local-duration-1.wav 60044 bytes  sha256 79bf3bdee88c572e485fb72554dcdd9025f88fbdd54ecce6326621cc3aac2caf
local-duration-2.wav 120044 bytes sha256 ada2b2908276966fa6f2efbefcfcc93e8d60ee9512834d380de4cf9ff756889e
local-duration-3.wav 180044 bytes sha256 7ccbb6b9805b4f7807b9c23523321757bdbc610708c91863af8247dbf91caad5
```

Root-installed modules were resolved through the user's Node 24.11.0 executable: Vite 7.3.6, TypeScript 5.9.3, JSZip 3.10.2, pdfjs-dist 5.4.530, Mammoth 1.12.0 and @tailwindcss/vite 4.3.3. Root `pdf-lib` and `docx` are absent. The dependency-runtime inventory supplies existing Python at `/Users/xiaomengdao/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3`, containing ReportLab 4.4.9, Pillow 12.3.0, python-docx 1.2.0 and pypdf 6.10.0; its Node library directory has @napi-rs/canvas and pdf-lib. Use these only as developer fixture-generation/preflight tools; packaged app runtime must not depend on them. Never invoke its bundled pnpm. The project package manager remains `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm`.

No ffmpeg/ffprobe/mutool/gs/pdftotext executable was found on the current command PATH; dependency-runtime bin inventory contains pdftoppm/pdfinfo but no ffmpeg. `xcrun --find swift` resolves `/Library/Developer/CommandLineTools/usr/bin/swift`, and `/usr/bin/sips` exists. A small local MP4 can therefore be generated later with a macOS-only Swift AVFoundation `AVAssetWriter` fixture generator using fixed frame dimensions/colors, H.264 and explicit CMTime timestamps. This generator has not been compiled or executed; do not assume encoder availability or deterministic container bytes. Record the generated file's actual hash/duration/codec and then test decode/play/seek in WKWebView. A browser canvas/MediaRecorder output is an alternative only after MIME support is demonstrated; relabeling WebM as MP4 is unacceptable. No remote media download is needed.

### Chinese PDF: verified actual parser and package assets

The proposed PDF uses ReportLab `UnicodeCIDFont("STSong-Light")` for Chinese plus Helvetica for Latin text. This deliberately exercises CJK package CMaps and standard font data. [ReportLab's font guide](https://docs.reportlab.com/reportlab/userguide/ch3_fonts/) documents UnicodeCIDFont and Asian fonts; [PDF.js API](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib.html) documents document loading/options.

Executed entirely in memory, without writing a PDF file:

```python
import io
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
pdfmetrics.registerFont(UnicodeCIDFont("STSong-Light"))
buffer = io.BytesIO()
c = canvas.Canvas(buffer, pagesize=(595, 842), invariant=1, pageCompression=0)
c.setFont("STSong-Light", 16)
c.drawString(72, 760, "第一场：雨夜；角色：林一；保持红色雨伞。")
c.setFont("Helvetica", 12)
c.drawString(72, 720, "Cuepoint fixture 2026-10-11")
c.showPage()
c.setFont("STSong-Light", 16)
c.drawString(72, 760, "第二场：清晨；素材属于工作区。")
c.save()
pdf_bytes = buffer.getvalue()
```

The generated **2,949 bytes** had SHA-256 **6b6d61a8f1e10939236e9a93ab5b9c605f7d2104571b3a904eb7563c66d324bf**. Real root `pdfjs-dist` 5.4.530 `getDocument()` / `getPage()` / `getTextContent()` extracted:

```text
page 1: 第一场：雨夜；角色：林一；保持红色雨伞。
        Cuepoint fixture 2026-10-11
page 2: 第二场：清晨；素材属于工作区。
```

Asset factories actually read installed package bytes for **UniGB-UCS2-H.bcmap**, **Adobe-GB1-UCS2.bcmap** and **LiberationSans-Regular.ttf**. Probe options match `src/lib/references/pdf.ts:37`: `isEvalSupported:false`, `useSystemFonts:false`, `disableFontFace:true`, `stopAtErrors:true`, `useWasm:false`, `useWorkerFetch:false`, custom CMap/font factories. Node used real @napi-rs/canvas DOMMatrix/Path2D/ImageData exports, not fake class stubs. The standard PDF.js build warned that Node should use its legacy build; this probe used the same installed package entry as the app for a finite parser preflight, not a Node compatibility claim.

Stage B must still call **actual** `parsePdfReference(buffer, signal)` or `parseReferenceFile(buffer, "pdf", "application/pdf", signal)` inside the packaged WKWebView. The real helper's asset factories fetch Vite-resolved URLs at `pdf.ts:17`, worker import is `:3`, eager package glob maps are `:6` and `:11`; the Node probe replaced URL fetch with file-backed package readers and therefore does not validate the app origin, Vite rewriting, worker or CSP. Require correct Chinese chunks/page locators/coverage and evidence of the three package asset loads with network disabled; test corrupt bytes and cancellation separately. A canned parser result or ASCII-only PDF cannot satisfy this gate.

### Isolated Vite, Router and Dexie closure

`vite.config.ts:7` enables TanStack file-route generation, React and Tailwind. Stage B must use `configFile:false`, the real React/Tailwind plugins and root `@` alias, without the TanStack generator. `scripts/b01-browser-regression.mjs:51` is a working installed-tool pattern; `scripts/native-fixture-ready.mjs:4` preflights Vite static transformation but explicitly cannot establish runtime/CSS/IndexedDB readiness. Do not import `src/main.tsx`: it mounts the entire generated route tree and initializes Umami.

Use the package UI as Vite root, explicit fixture index and built output directory, source-root alias, and packaged frontendDist. Set `assetsInlineLimit:0` to keep PDF CMaps/fonts as real bundled asset URLs rather than introducing data-URL fetch/CSP ambiguity. Retain normal worker handling (or explicit `worker.format:"es"` after actual build verification); DOCX's real `new Worker(new URL("./docx.worker.ts", import.meta.url), {type:"module"})` appears in `src/lib/references/import.ts:17`. Do not replace it with synchronous direct parsing in the compatibility acceptance.

`StoryboardPrintPage` at `src/components/produce/StoryboardPrintPage.tsx:13` can be imported directly; it requires Router context because of its return Link (`:104`) and real `db` / `useLiveQuery` / `useShotMedia`. A minimal manual route tree should provide the print page plus `/p/$projectId/e/$episodeId/produce` for that Link. Use an isolated router registration/type closure if needed, avoiding root `src/main.tsx:11` registration and file-route modules. `tests/fixtures/b01/harness.tsx:59-90` demonstrates a manual RouterProvider and real print component, but imports unrelated root file-route modules and extensive test gates; reuse the pattern, not the entire harness.

Do not solve type closure with `any`, route-generator execution, or a copied print implementation. Use strict frontend TS with explicit entry/includes and follow value imports; unreferenced root main/routeTree need not be runtime entries. Vite build does not replace typechecking. Include `src/lib/references/mammoth.d.ts` and Vite client ambient types for the real worker/browser imports. No generated-route modification is necessary for this fixture.

Import `@/styles.css`: its actual Tailwind imports/tokens are at `:1`, and A4 landscape/10mm margins plus chrome suppression/multi-page card rules are at `:259-310`. Separate fixture chrome should be hidden by print-specific selectors; do not rewrite current print CSS or claim a screenshot of screen CSS validates native pagination.

`src/db/database.ts:112` fixes database name to `aifenjing`. Existing real UI/reference/package helpers therefore need an **isolated native-app WebView data store/profile and actual packaged origin**, not a renamed mock DB or production browser storage. Seed only fixture IDs after opening this isolated DB; `tests/fixtures/e04-library/harness.tsx:9,92` shows `emptyProject`/production-record factories, and `tests/episodeDelivery.test.ts:27,69` provides typed project/episode/shot defaults. Seeding print needs project, episode, shots and referenced media; characters/scenes/props/styles may be empty but must finish real live queries. `src/lib/useShotMedia.ts:7` waits only for referenced media. Use actual decoded PNG Blob bytes for visual slots. Avoid historical fake Blob strings from unit tests as image/audio compatibility inputs.

This Dexie usage is explicitly a disposable **compatibility fixture projection**, not a production migration or native SQLite backend claim. Stage A's authoritative native workspace must be tested independently; when copying native asset bytes into these fixture-only UI rows, record that projection and never treat the renderer's Dexie writes as native metadata commits.

### Actual helper invocations and outputs

| API / source | Stage B invocation and required evidence |
| --- | --- |
| `src/lib/audio/wav.ts:13` | `encodePcm16Wav({length, sampleRate:48000, numberOfChannels:1, getChannelData:()=>pcm}).blob`; generate a quiet sine, not fake text. Use actual header/decoded duration/channel assertions. |
| `src/lib/audio/engine.ts:13,117,169` / `schedule.ts:74` | `decoded=await decodeAudioBlob(blob)`; `buffers=new Map([[mediaId,decoded]])`; `schedule=buildAudioSchedule(typedRows)`; under a user gesture `await player.play(schedule,buffers,0)`, then pause/seek/dispose; `await renderAudioMix(schedule,buffers,{signal})`. Save exact output Blob and re-decode; test missing buffers/cancellation. Runtime constructor presence is insufficient. |
| `src/lib/references/import.ts:39` | `await parseReferenceFile(buffer,"docx",docxMime,signal)` exercises the actual module worker; known Chinese paragraph extraction, malformed ZIP and abort/worker cleanup. `parseDocxReference()` alone only proves parser compatibility. |
| `src/lib/agent/generationMedia.ts:2` / `references/import.ts:39` | `generationImageDimensions(blob)` verifies headers; `parseReferenceFile(buffer,"image","image/png")` adds browser decode when supported. Also require real `<img>` load/naturalWidth/naturalHeight; header parsing alone is insufficient. |
| `src/lib/episodeDelivery.ts:68,145,181` | `delivery=deriveEpisodeDelivery(typedFixture)`; `csv=episodeDeliveryCsv(delivery)`; `filename=episodeDeliveryFilename(delivery)`; UTF-8 Blob includes BOM, CRLF, escaped quotes/comma/newline and Chinese. Save through narrow native dialog/byte command and compare resulting bytes/hash. |
| `src/lib/projectPackage.ts:71,194` | `blob=await exportProjectZip(fixtureProjectId)` on the real isolated Dexie fixture; inspect using root JSZip.loadAsync and, if within scope, real `importProjectZip(blob)` into a distinct fixture project. Verify manifest/rows/media and actual owned bytes. Export embeds `nowIso()` and JSZip dates, so compare exact bytes **from that generated export** after native save/reopen, not a supposed repeatable ZIP hash. |
| `src/lib/episodeDelivery.ts:192` / `projectPackage.ts:344` | Browser anchor-download wrappers are separate transport tests; plain anchor click is not proof that a WKWebView saved a file. Keep pure CSV/ZIP generation and provide a narrow trusted native save adapter if needed; report whether browser download or native adapted output passed. |
| `src/components/produce/StoryboardPrintPage.tsx:101` | Real page and real CSS with sufficiently many long/multiline rows to force multiple pages. Readable native preview or user confirmation must check white background, A4 landscape, absent navigation/toolbar and full content. Use previously researched allow-listed macOS `WebviewWindow::print()` only as an explicit fallback if needed. |

Managed read transport uses stable asset IDs, bounded chunks (fixture ≤32 MiB), Blob/object URLs and explicit revocation; no absolute native path reaches renderer and no wildcard asset protocol is enabled. Require checksum/size or one protected read operation to avoid mixed bytes if a file changes across reads.

### Origin, SSE and permissions

[Tauri configuration](https://v2.tauri.app/reference/config/#usehttpsscheme) distinguishes macOS/Linux `<scheme>://localhost` protocols from Windows/Android HTTP(S) localhost origins. Record actual `location.href`, `location.origin`, secure-context/API flags, native trusted window URL and isolated data-store identifier in packaged acceptance; do not infer them from the Vite dev server. Switching the scheme can change IndexedDB/localStorage location, so avoid scheme changes between fixture phases that masquerade as lost/recovered data.

[Tauri CSP](https://v2.tauri.app/security/csp/) requires explicit policy and automatically augments bundled scripts/styles; its IPC example is `connect-src ipc: http://ipc.localhost`. Add only the concrete local packaged asset/worker/blob sources required by real tests. Blob media, actual module workers, PDF package fetches and channel IPC all need separate runtime evidence. Do not disable CSP or allow arbitrary remote URLs to make a fixture pass.

[Tauri channels](https://v2.tauri.app/develop/calling-rust/#channels) support streamed native→frontend chunks. A delayed fixture Rust command can emit UTF-8 SSE bytes to a Channel; adapt to a ReadableStream/Response and execute **actual** `readSseEvents(response,signal)` (`src/lib/ai/boundedSse.ts:76`). Split Chinese UTF-8 and CRLF boundaries, confirm chunks arrive before stream completion, and cancel with exact AbortSignal reason/partial output retained. Label this result **native channel + browser parser**, not HTTP/CORS/provider streaming. It needs no new server dependency.

If real renderer fetch streaming is also required, use a test-only local loopback SSE endpoint with exact CSP connect-src and narrowly matching CORS Origin (record observed request Origin, including opaque-origin behavior instead of guessing). Flush delayed chunks rather than buffering; stop on disconnect/cancel. Keep endpoint and permission exceptions outside normal builds. A Node-based local fixture server could use the already installed user Node and built-in `http`; no paid API/provider credential or new server package is necessary. Core custom-command ACL/trusted-origin constraints remain those documented in `tauri-prototype-plan-research.md`.

## Related Specs and Files

- `.trellis/spec/frontend/delivery-export.md`: real CSV/print scope, BOM/CRLF, scoped rows/assets, multi-page print completeness.
- `.trellis/spec/frontend/audio-music.md`: shared real schedule/decode/render behavior, immutable media, recording consent and no silent omitted clips.
- `.trellis/spec/frontend/quality-guidelines.md`: actual browser evidence, stable fixture provenance, source hashes, no archived-task runtime dependency or assertion-free success claim.
- `.trellis/spec/frontend/workspace-storage.md` / `checkpoint-protocol.md`: native authority and managed-byte separation; renderer fixture Dexie is not migration.
- `research/tauri-prototype-plan-research.md`: approved pinned/runtime/storage plan and separate Stage A/B gates; this file does not replace it.

## Caveats / Not Found

- Stage A is still being implemented by a separate owner; this research does not authorize Stage B to start before native acceptance.
- No repository MP4/PDF/DOCX binary was located; WAVs exist in archived acceptance and document generators exist in actual tests. The Chinese PDF was generated/parsed only in memory with real libraries; no packaged app, native preview, module-worker/CSP, MP4 encoder or microphone was exercised here.
- Installed bundled developer libraries are available now but do not become app/runtime dependencies; pin generated fixture bytes/provenance and use the project's explicit local pnpm for implementation.
- The actual root print/ZIP/reference helpers intentionally depend on Dexie/React/Router; using them in an isolated fixture is meaningful compatibility evidence but does not prove native SQLite integration or production-record migration.
- CJK PDF preflight read genuine packaged font/CMap bytes through Node readers, whereas the app helper fetches Vite URLs. Packaged offline asset loads remain a required Stage B check.
- Current microphone consent is a separate explicit native-app decision; this research did not prompt or record audio.

# Research: Existing packaged media fixtures and safe persistence evidence

- Query: Find existing genuine playable synthetic video above 32 MiB, image/document/audio inputs, fixed isolated app storage paths, and existing UI flows for root-owned packaged acceptance.
- Scope: internal; read-only source, existing synthetic fixtures, and existence metadata of the exact current isolated root.
- Date: 2026-10-12 (Asia/Shanghai).
- Owner: packaged_media_fixture research agent. No product/source changes, fixture generation, app/probe launch, CUA, Git operations, database payload reads, previous profile reads, keys, or downloads were performed. This file is the only written output.

## Findings

### 1. Ready-to-import large playable video

The existing ignored fixture **exists and was independently SHA-256 checked during this research**:

`/Users/xiaomengdao/WebstormProjects/aifenjing/desktop/tauri/.acceptance/large-playback/range-video.mp4`

| Property | Verified source/evidence |
| --- | --- |
| Current byte length | 89,613,670 bytes (85.46 MiB), actual current file |
| Current SHA-256 | `6f361344b18c5aac5b7ea8706d2783fa450907e788d3e19dd325ada3617fdee7`, actual current file |
| Duration | 30 seconds, existing actual AVFoundation inspection |
| Video | H.264 `avc1`, 640×360, 30 fps, 900 decoded frames |
| Generator | `research/large-playback-fixture.swift`, deterministic noise frames, existing derived Swift generator |
| Generator hash | `b4f69572e908561cd7698291dd0898147a8649aa9f4fba2997c224871fb47e41`, recorded in `large-playback-fixture.json` |
| Existing receipt/log | `large-playback-fixture.json`, `large-playback-fixture-generation.log` |
| Established proof | Synthetic bytes and actual AVFoundation decode completed; no WebKit/UI playback proof follows from this |

There is no need to generate or download another video. The committed `desktop/tauri/fixtures/media/movie.mp4` is only 11,940 bytes / 2 seconds, and is useful for small previews but cannot satisfy the large-file gate.

If the ignored large fixture is later absent, the safe existing generator is the task-local Swift file derived from `desktop/tauri/scripts/generate-video.swift`. Compile it to a **new task-owned disposable path**, then run its `video <new-destination.mp4>` mode and retain its JSON/log/hash. It refuses an existing destination. `/usr/bin/swiftc` is present. Existing sources use `@main`, so compilation needs `-parse-as-library`; the compiler may use a task-owned module cache. No generation/compilation was run by this researcher. Regeneration is root-owned and should not overwrite any committed fixture or prior evidence.

### 2. Existing small image, documents, and audio

All files below were independently checked and match `desktop/tauri/fixtures/media-provenance.json`. Base directory:

`/Users/xiaomengdao/WebstormProjects/aifenjing/desktop/tauri/fixtures/media/`

| File | Bytes | Current SHA-256 |
| --- | ---: | --- |
| `image.png` | 177 | `626815c78eaad46cad849732d1598b45b91700ce046c1ee3f4e2444db80aa32a` |
| `document.pdf` | 3,033 | `ee62307e225b723a2ed696922cfd849ddcdc14f35cd564d08a96b771a3d01717` |
| `document.docx` | 1,084 | `ce29dc1edf52d07a8d442e89dd5e44af208748a79c53092262dc661f94bad26a` |
| `tone.wav` | 384,044 | `e4baf034e8b57f82d42dc121292b8684d087a73eba60475fbd0eb54cb052ace4` |
| `tone.mp3` | 16,300 | `36e3d42060787c920f505b69879fecd7417c017e78bb2c3b2255f8bd18b72a2c` |
| `tone.aac` | 8,900 | `9e3ec7c7e1a24b4c76730c12fe4737695cf8413fb00a6f9139b50325273d48b6` |
| `tone.m4a` | 12,324 | `2493423bb0a6636b1da138a5c2db6c258d788841a30f8e5e8a28860436ed5f6f` |
| `movie.mp4` | 11,940 | `91f3d0a1a72de8355add6814fa4ed8b47bc3cac5ebb02c62dcd8b5b7a5a32341` |

`generate-fixtures.py` creates a 64×48 RGB PNG and deterministic two-page Chinese PDF. The PDF text is “第一场：雨夜；角色：林一；保持红色雨伞。” / “第二场：清晨；素材属于工作区。” `generate-fixtures.mjs` creates a DOCX with “第一段：雨夜的红色雨伞。” / “第二段：素材复制到工作区。” and records provenance. `fixture-audio.ts:3–6` produces 2 seconds of a quiet 440 Hz sine through the actual shared WAV encoder; MP3 generation uses pinned `lamejs` 1.2.1. Reuse these existing files; rerunning generators would write committed fixtures and is unnecessary.

For external-source-removal acceptance, root should create a **fresh disposable copy** of a fixture, import that copy through the UI, record the new managed row/file/hash, and remove **only that newly owned source copy**. Do not remove the committed fixture, large original fixture, old acceptance sources, or an unknown file. This researcher did not create/remove any source copy.

### 3. Exact isolated SQLite and managed-file root

`desktop/tauri/src-tauri/src/desktop.rs:64–76` resolves trusted `app_data_dir()` and joins `product-workspace-v1`; it never takes an absolute renderer path. `full_product_store/mod.rs:184` resolves `.local/state.sqlite` inside that root.

The bundled current identifier is `dev.cuepoint.review.sqlite20261012final`, per `research/resume-after-unlock.json`. Local pinned Tauri 2.12.2 source `src/path/desktop.rs:247–256` resolves the application directory as `dirs::data_dir()/identifier`; local `dirs` 7.0.0 `src/mac.rs:7,12` returns `~/Library/Application Support`. Therefore the exact root is:

`/Users/xiaomengdao/Library/Application Support/dev.cuepoint.review.sqlite20261012final/product-workspace-v1`

The exact root and its `.local/state.sqlite` **exist**, verified by existence metadata only. No SQLite connection, row query, payload/key read, or previous application-profile lookup was performed by this researcher.

Schema anchors:

- `full_product_store/mod.rs:21–56`: `product_workspace` stores persistent identity/schema/registry/change sequence; `product_records` stores logical `table_name`, `row_key`, tagged `payload`, revision; there are separate indexes/operations/changes tables.
- `product_binary.rs:15–26`: `product_binaries` stores binary UUID, length, MIME, SHA-256, operation and physical identity; `product_binary_intents` records staging/publication state.
- `product_binary.rs:361–370`: managed bytes live at `assets/id-<lowercase hex of exact UTF-8 binary UUID>`, not a hex digest of file contents and not a literal original filename. For a known binary UUID, Python derivation is `"assets/id-" + binary_id.encode("utf-8").hex()`.
- `src/lib/storage/codec.ts:48–78,84–110`: payload is tagged local encoding (`obj` contains key/value pairs; `binary` contains an opaque managed ref), so `json_extract(payload,'$.name')` does not read a normal object. Any inspection must use the actual codec representation, not invent ordinary JSON storage.

### 4. Safe evidence hooks for root

`/usr/bin/sqlite3` is installed. Root may collect **read-only metadata evidence from this exact disposable profile**, preferably immediately before quit and after UI-driven relaunch, by opening SQLite with `mode=ro` and using a read transaction. Useful bounded queries without credentials or authored payloads:

```sql
SELECT id,schema,registry_hash,change_sequence FROM product_workspace;
SELECT table_name,count(*) AS rows FROM product_records GROUP BY table_name ORDER BY table_name;
SELECT binary_id,byte_length,mime_type,content_hash FROM product_binaries ORDER BY binary_id;
SELECT count(*) AS pending_intents FROM product_binary_intents;
SELECT status,count(*) FROM product_operations GROUP BY status;
```

Do not use `immutable=1` against an active WAL database, discard WAL/SHM files, checkpoint the application, write SQL, or dump all payloads/connection tables. Close each read transaction quickly before UI mutations. Table counts and binary hashes are corroborating persistence evidence; root must separately observe actual UI content/playback/relaunch. To compare domain field persistence, selectively decode only known current fixture records and omit device connection keys. Hash only known current synthetic managed files, derived from their returned binary UUID, not every profile file.

`src-tauri/src/bin/product_store_probe.rs:1–2,31–74` is a test-hooks executable intentionally accepting a disposable absolute root, opening the engine and recovery owner. **Do not point it at the running packaged application's root**: it competes with the exclusive lock and can invoke recovery. Existing `native-final-02` receipts already establish the actual probe lane; these cannot substitute for bundled UI evidence. The normal product has no broad acceptance-report/injection hook promised by this research. Use CUA plus narrow read-only fixture corroboration, preserving actual UI failures.

### 5. Exact existing UI flows

| Flow | Existing entry and source anchor | Suggested current fixture assertions |
| --- | --- | --- |
| Global file materials | `/assets` → “导入素材” (`MaterialLibraryPage.tsx:68–73`), “保存位置” → 全局, “选择文件”, “导入 N 个文件” (`MaterialImportDialog.tsx:59–77`) | Import image, WAV, PDF/DOCX and large video; the existing loop calls actual `createFileMaterial` per file (`:39–45`). |
| Real video/audio playback and Save | Open material card; detail calls inspected `MaterialPreview` (`MaterialDetailPanel.tsx:170–178`); `<video controls>` labeled “视频素材预览” (`MaterialPreview.tsx:64–66`), `<audio controls>` at `:67–68`; “下载原文件” at `:76–79` | Large video's metadata 30 sec, advancing play, later seek, EOF; opaque URL and real WK request evidence; actual Save byte/hash equality, cancel preserves data. |
| Version/use/history | Detail “上传新版本” or “从原设定保存新版本” (`MaterialDetailPanel.tsx:214–225`); “使用素材的目标项目” / “用于项目” (`:242–253`); historical versions (`:172–178`), uses/events (`:256–285`) | New immutable version remains distinct; adopt into a linked/eligible project, older version remains pinned, actual event records appear. |
| IP and scope | `/ips` → “新建 IP” (`IpProfilesPage.tsx:66–67`, `IpProfileEditor.tsx:131–166`); detail “关联项目” / “专属素材” (`IpProfilesPage.tsx:140–179`); `/projects` → “新建项目” with 所属 IP (`ProjectGalleryPage.tsx:321–327`) | Create fixture IP, link video/audio project, import IP-specific file, eligible project adoption; reopen preserves identity/link. |
| Setting snapshots | `/assets` → “创作设定” and linked role/scene/prop/style pages; existing originals section “现有素材” → selected card → “保存为独立素材” (`LegacyMaterialSources.tsx:93–121`) | Create/edit original via existing full editor; publish snapshot including image, change original, inspect saved snapshot/use history; no second native UI. |
| Audio source/internal copy | Audio project “添加声音” (`AudioInspector.tsx:71`) → “上传音频” / “从素材库选择” (`AudioSources.tsx:100–102`) | Upload WAV or adopt existing audio material; library explicitly calls `adoptMaterialInProject`, actual managed decode and `addAudioTake` (`AudioSources.tsx:239–255`). |
| Timeline/mix | Voice/take inspector “加入时间线” (`AudioInspector.tsx:106–122`); timeline “音轨” → voice/music/effects (`AudioTimeline.tsx:522–526`); “撤销时间线编辑” (`:421`) → “导出” → “导出 WAV” (`:504–514`) | Add/edit/undo clip, retain actual mixed WAV/media/export; cancel external Save still displays “WAV 已保存到项目，已取消另存文件。” (`:244–258`), later “试听成品” (`AudioExports.tsx:20–44`). |
| Music durable drafts | Music project “新建创作” / “创作草稿” (`MusicWorkspacePage.tsx:127–150`); “简单” / “自定义” and “音乐引擎与模型” (`MusicCreation.tsx:78–94`), description/lyrics/title fields (`:101–130`) | Enter distinct settings, switch variants, create new draft, relaunch and confirm associations. Works/generation require root-owned deterministic provider; the local WAV alone is not a music-generation UI result. |
| Package copy-import | Project card menu “备份项目（zip）” (`ProjectGalleryPage.tsx:290–302`), native Save; sidebar “导入项目” (`AppFrame.tsx:52–64`, `_studio.tsx:15–21`) | Save this new fixture project ZIP, import its bytes through UI; new IDs, content/managed files/references preserved. No old-user backup import. |

### Files found

- `desktop/tauri/fixtures/media-provenance.json`: known small synthetic fixture hashes and generator provenance.
- `desktop/tauri/fixtures/media/*`: current image, two document formats, four audio formats and small playable video.
- `desktop/tauri/.acceptance/large-playback/range-video.mp4`: existing ignored large playable synthetic video, independently byte/hash checked.
- `research/large-playback-fixture.{swift,json}` and generation log: existing generator and AVFoundation decode receipt.
- `src-tauri/src/desktop.rs`, `full_product_store/mod.rs`, `product_binary.rs`: trusted root, SQLite schema and managed relative path owners.
- `src/lib/storage/codec.ts`: actual tagged row payload encoding.
- Existing material/IP/project/audio/music components and routes cited above: same product UI and commands used in packaged acceptance.

### External references and versions

No network lookup was needed or performed. The locating rule is read directly from pinned locally installed **Tauri 2.12.2** and **dirs 7.0.0** primary source in `desktop/tauri/.tools/cargo/registry/src/index.crates.io-1949cf8c6b5b557f/`. Existing provenance names **lamejs 1.2.1**. AVFoundation/CoreMedia/CoreVideo are the existing macOS system encoder/decoder used by the recorded Swift generator. Neither this source inspection nor the old decode receipt is an actual WebKit playback gate.

### Related specs

Read `.trellis/workflow.md`, task `prd.md` / `design.md` / `implement.md`, `research/packaged-acceptance-checklist.md` and `resume-after-unlock.json`; research-only context did not load `implement.jsonl` or `check.jsonl`.

Relevant contracts: `.trellis/spec/frontend/shared-product-storage.md` (sole selected owner, closed transactions, opaque managed references, bounded media and pending actual host gate), `native-product-runtime.md` (shared routes/native HTTP/Save/fixed isolated identity), `workspace-storage.md` (copy source internally, missing bytes retain logical row), `video-workspace.md` (same existing full-product UI), `native-workspace.md` (historical prototype is a separate test lane).

## Caveats / Not Found

- Existing large bytes/decode are verified; actual current bundled WK metadata/playback/seek/relaunch must still be recorded by root. A 90 MiB rawHTTP test body labeled video is not this valid H264 fixture.
- No genuine provider connection was read or configured; locally generated fixtures and deterministic provider acceptance do not prove paid provider/model behavior.
- More than 64 idle capabilities is a genuine mounted-grid gate. Creating many copies/rows through a test probe is not equivalent to actual UI mount; root owns any fixture generation/UI steps and should record real grid observations plus descriptor counts.
- Current exact root existence does not prove SQLite mutations, internal-byte source independence, a successful import, or relaunch. No DB content was inspected during this research.
- Original source-removal and missing/corrupt internal-file tests should manipulate only freshly identified disposable fixture paths, preserve known restore bytes, and retain logical rows; never delete original tracked fixtures or unknown profile content.
- No Git operation, normal owner activation, app launch, heavy build or automated UI operation was performed.

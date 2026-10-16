# Research: Local skill installation, storage and retained versions

- Query: What existing desktop filesystem and ProductStore boundaries can support E09 directory snapshot installation, update, uninstall and on-demand resources on macOS, Windows and the browser?
- Scope: internal; recommendations describe a proposed first version, not approved implementation.
- Date: 2026-10-16

Final-design reconciliation: the initial single revision-value layout and numeric
envelopes below are research alternatives. The final `design.md` chooses separate
manifest/body/per-resource device-setting rows, managed as one atomic retained
revision group, so body reads do not hydrate unrelated resources. Its concrete
limit table is authoritative. See `planning-review.md` for the resolved finding.

## Findings

### Existing owners and evidence

| File | Responsibility / observed pattern |
| --- | --- |
| `packages/studio/src/platform/product/store.ts:13` | Chooses one fixed browser or native ProductStore before product use. Native services are installed beside the actual driver and receive its session; no runtime fallback to a second store. |
| `packages/studio/src/platform/storage/schema.json:1350` | `deviceSettings` is an existing device-scoped keyed table, without indexes. |
| `packages/studio/src/features/settings/commands/deviceSettings.ts:5` | Existing settings values have a 2 MiB **serialized JSON UTF-8** limit, and keys match `[A-Za-z0-9][A-Za-z0-9._:-]{0,127}`. `putDeviceSetting`/`deleteDeviceSetting` accept an explicit ProductStore and join compatible transactions. |
| `packages/studio/src/features/settings/commands/deviceSettings.ts:13` | Convenience reads deliberately turn missing, malformed **and failing** reads into `undefined`; that behavior is unsuitable for authoritative catalog mutation or retention accounting. |
| `tests/deviceSettings.test.ts:51` | Existing regression proves device values do not appear in project ZIP exports. |
| `apps/desktop/src-tauri/src/desktop.rs:94` | E08's native directory picker lives inside the closed media request owner, validates the trusted window, actual native session and project, and reads sources only through opaque grants. |
| `apps/desktop/src-tauri/src/desktop_media.rs:36` | Media envelopes/actions are closed Serde DTOs; grants are explicitly session/project scoped, not generic renderer file access. |
| `apps/desktop/src-tauri/src/desktop.rs:650` | `trusted` requires the bundled `main` window and accepted bundled origin. |
| `apps/desktop/src-tauri/capabilities/main.json:8` | The renderer has named product commands; generic filesystem/dialog/shell permissions are absent. |
| `apps/desktop/src-tauri/src/paths.rs:152` | Existing native path primitives reject aliases and unexpected hard links, inspect stable object identity, and guard owned directories. |
| `apps/desktop/src-tauri/src/paths/windows.rs:37` | Current Windows identity primitives require a **local fixed NTFS volume**; SMB, removable volumes and other filesystems do not become supported by reusing these helpers. |
| `apps/desktop/src-tauri/src/paths.rs:417` | Existing bounded hashing checks an ordinary source before opening, compares the actual opened file identity, bounds observed bytes, and checks final identity/size/mtime. Reuse the pattern, not a second read that can capture different bytes. |
| `packages/studio/src/features/agent/models/agent.ts:103` | Runs persist frozen execution inputs, permission ceiling and instruction state. |
| `packages/studio/src/features/agent/commands/agentRuns.ts:89` | Run admission already uses one ProductStore transaction; new run construction can atomically capture skill revision references and retention accounting. |
| `packages/studio/src/features/agent/commands/agentRuns.ts:102` | Retries resolve an explicit previous run, receive a new run ID, and reuse frozen settings/request context. |
| `packages/studio/src/features/agent/commands/agentTools.ts:225` | Resume reuses the same durable run. It must not acquire today's installed skill version. |
| `packages/studio/src/features/agent/commands/agentTools.ts:29` | Runs with tools can resume from `waiting_approval`, `interrupted` or `failed`; `running` alone does not define version retention. |
| `packages/studio/src/features/agent/commands/lifecycle.ts:8` | The existing chat aggregate deletion owns the sole product deletion of its run records (`:45`); use that transaction for releasing version references. |
| `packages/studio/src/features/projects/commands/lifecycle.ts:30` | Project deletion does not delete Agent runs/chats. It is not a signal to free their skill snapshots. |
| `packages/studio/src/features/library/ui/materials/MaterialImportDialog.tsx:135` | Shared browser UI already consumes user-selected File lists, but no directory selection adapter exists. Repository search found no `showDirectoryPicker` or `webkitdirectory` implementation. |

### Smallest storage arrangement

Use the existing `deviceSettings` table for a local installed-skill catalog, immutable text revisions and small retention records. This avoids a new schema/table, a second native registry, an application-owned skill-file tree, managed binary claims and filesystem garbage collection.

Proposed key families (names are illustrative):

| Key | Value / purpose |
| --- | --- |
| `agentSkills.catalog` | Versioned bounded catalog: installation ID, declared skill name, description, enabled flag, current revision hash, source display label and revision/CAS marker. Discovery reads this row only. |
| `agentSkills.revision:<sha256>` | Immutable validated text payload: format version, parsed metadata, SKILL.md body and an ordered resource map/array. Hash covers the exact canonical payload, including paths/content. It contains no OS path, live handle, credential or permission. |
| `agentSkills.retention:<sha256>` | Small mutable `{runRefCount, serializedBytes}` record. Separating it from content keeps revision bytes immutable and prevents bookkeeping/discovery from hydrating skill bodies. |

Use strict reads through the supplied transaction for commands: a failed read, invalid catalog or invalid reference count is an error, not an empty installation. The existing forgiving `getDeviceSetting` may serve optional display, but its error-to-undefined behavior must not overwrite a catalog or reset a counter. All writes still use the same validated per-value size/key rules. Exact catalog/retention schema validation belongs to the Agent skill feature, not Rust business logic.

Read and validate source bytes **before** opening a write transaction. Commit new immutable revision, retention record and catalog pointer together, using an expected catalog revision/current content hash to reject concurrent updates. Unknown commit outcomes retain existing ProductStore certainty and operation identity; the UI must reconcile rather than retry a mutation automatically.

The proposal is device-global installation with the existing global Agent's available skill set. It adds no project roots, project overrides, auto-discovery, cross-device sync or installation export inside project packages. Future project-scoped selection can be designed separately; existing business tool project scopes remain unchanged.

### Directory capture and platform boundary

Desktop needs one **independent finite instruction-import service**, installed beside the actual native ProductStore driver, with the existing trusted-window/origin and current native session checks. A user gesture opens the native folder picker. The service returns a bounded text snapshot and source display label; cancellation returns an ordinary canceled result. It must not accept renderer/model source paths, mint a reusable directory grant, expose arbitrary reads, execute anything or publish skill rows itself.

Do not extend `desktop_media_request`, reuse a media grant, or route through retained `workspace_request`: E08's envelope is project-owned video authority and its scanner filters video formats. Importing instructions into device settings has a different lifetime and owner. The only shared mechanism is native picker/path/identity enforcement, not permission state or a second business implementation.

For the first implementation, reuse the actual safe path primitives and accurately retain their Windows local fixed NTFS source limitation. Supporting removable/exFAT/network/cloud-placeholder sources would require separately reviewing weaker source-read identity semantics; do not quietly relax shared managed-file helpers. Both operating systems still need actual picker/source-replacement acceptance at the batch gate.

Browser can supply the same importer from a user-selected directory FileList when the runtime supports directory selection. Validate every browser relative name as data: normalize separators once, strip the one selected root only, reject absolute paths, traversal, empty/dot components, duplicate names and portable case-fold collisions. No browser File object becomes OS path authority. A browser capability gap should display unavailable import while retained installed snapshots and built-in capabilities continue working. A flat multi-file fallback is possible later but does not preserve nested resources reliably without a defined format.

Source bytes are captured once for one preview/install attempt; the preview and installed hash must describe those same bytes. Directory/source changes during native capture reject the attempt. A later source edit/deletion has no effect on the installed immutable snapshot. Updates explicitly pick a directory again. No saved source path, watcher, startup home-directory scan, registry download or shell install hook is needed.

The new native response must have an explicit finite serialized size bound. Do not raise the existing ProductStore/binary 262144-byte transport ceiling or reuse a path-taking generic chunk protocol. A response containing the whole small instruction bundle can have its own reviewed finite DTO limit; if paging is chosen, opaque session-bound snapshot IDs and ordered bounded reads must refer to the already captured snapshot, never reread the live source by a caller path.

### Bounded text inputs and visible exclusions

The exact format limits are planning recommendations, not inferred user approval. A practical small envelope is one root `SKILL.md` (up to 64 KiB), at most 32 accepted text resources (up to 64 KiB each), depth up to 8 and at most 1024 observed directory entries. Independently cap total accepted raw bytes (for example 1 MiB) **and** reject when the final version value's actual serialized JSON UTF-8 exceeds the existing 2 MiB limit. Raw byte sums do not prove JSON size: control characters, escaping, path metadata and repeated syntax expand it. Never truncate a skill or silently omit an oversized accepted resource to make installation succeed.

Start with an explicit non-executable text-resource allowlist under documented resource directories, such as Markdown/TXT and selected data/template formats. Decode UTF-8 strictly, permit a documented BOM/newline normalization, reject NUL/binary payloads, and hash the defined canonical snapshot. The existing reference-text decoder (`features/references/documents/parse.ts:34`) demonstrates strict decoding and binary rejection, but it also accepts UTF-16 and normalizes content: it is not automatically the E09 format contract.

Do not follow symlinks, reparse points, unexpected hard links or path escapes. Treat accepted-file containment/identity failures as installation failure rather than silently approving a partial dependency. Skip known unsupported `scripts/`, binaries and unsupported assets without reading/executing their contents, but show bounded excluded counts/categories in the import preview and installed details. A skill that instructs use of an excluded script remains instruction-only and cannot truthfully claim that step is available. An unsupported directory is not a reason to recursively inspect unlimited children: entry/depth bounds still apply, and a wholly excluded subtree can be pruned.

### Version references, update, uninstall and cleanup

Freeze metadata plus `{installationId, revisionHash}` for every enabled installed skill admitted to a new executable run; this makes skills discovered but not yet loaded available from the same frozen revision later in that run. Do not read all revision bodies at admission. Add one retention reference for each **distinct revision** in that run, in the same transaction that inserts the run. Permission/tool registry snapshots remain separate.

Proposed lifecycle rules:

| Event | Catalog behavior | Retention behavior |
| --- | --- | --- |
| Install | New stable installation ID; current hash points at validated immutable payload. | Create/reuse revision and accounting; no run reference until admission. |
| Enable/disable | Changes future new-run discovery only. | Existing run references do not change. |
| Update | Explicit target installation and expected current hash; atomically switch pointer. Same content hash is an unchanged result. | Retain old revision if any run refers to it; otherwise delete its revision/accounting if no installation still points at it. |
| Uninstall | Remove installation from future discovery. | Delete content immediately only when no current installation and no durable run references it. Otherwise retain it for the frozen runs. |
| Resume | Do not consult today's installation for a replacement. | Same run and reference count; use the frozen revision. |
| Regenerate/retry | Reuse previous run's frozen catalog/revisions, even after update/disable/uninstall. | New run adds its own references exactly once; same admission ID must not double-count. |
| Run finishes/fails/is interrupted | No installation change. | Keep references; do not infer irrecoverability from status. |
| Chat deletion | No unrelated installation change. | Within `deleteChatThread`'s transaction, read that chat's runs, decrement each run's distinct revision references once, delete runs, and reclaim versions only when zero references and no current installation. Repeated deletion must not decrement twice. |

Holding references through actual chat deletion is deliberately conservative and gives one reliable release owner. It preserves restart recovery, retries and historical skill provenance without full-history scans on update/uninstall or a second pin table. The cost is retained old text while the conversation remains in history; explain that in installed-version details rather than promising immediate physical deletion. Run records without the new optional snapshot are legacy and contribute no references; do not retrofit them with current instructions.

Keep installation count and cumulative retained serialized-byte budgets explicit in the catalog/accounting design (concrete limits should be reviewed). Reclamation can remove unreferenced noncurrent revisions before admitting a new snapshot, but must never evict a referenced revision to fit a budget. If retained versions consume the budget, reject the new install/update without changing the current version and explain that conversation history retains old versions. Missing/corrupt retention accounting should fail closed and retain content, not guess a lower count. No automatic counter repair or startup history sweep is part of the minimal first version.

### Identity and same-name conflicts

Use an opaque installation ID plus immutable revision hash for actual selection; neither folder name nor description grants identity. Imported skills occupy an explicit installed namespace and cannot replace built-in creative group IDs or tools. A second import with the same canonical declared name must not silently win by path order: offer the explicit update action for the existing installation or reject the duplicate. An update targets the selected installation and retains its declared identity; a changed declared name is a different installation rather than an implicit rename/replacement. Case/portable path collision rules must be identical across hosts.

### Resource access and authority

After installation, resource reads resolve only `(runId, installationId, frozenRevisionHash, validatedRelativeResourceName)` against that run's saved catalog and immutable ProductStore value. Resource keys are names inside the imported package; they are not paths passed to Rust. If a selected version/body/resource is absent or corrupt, return an explicit error, never the current version or live directory contents. Reading one resource should not place every other resource into model context. Imported URLs are plain instruction data; loading a body does not fetch them.

An installed skill describes workflow instructions and optional text resources. It does not add tool names to `enabledToolNames`, grant media directories, authorize process/network/MCP access, open a picker from instruction text, install dependencies, register callbacks or bypass existing confirmations. The current 36-tool/two-group limits and exact per-request offers remain authoritative (`runtime/toolLoading.ts:20`, `:85`, and `spec/frontend/agent-library-tools.md:17`).

### Necessary verification for the implementation plan

- Strict parser/import fixtures: valid nested text package, missing/duplicate `SKILL.md`, bad UTF-8/NUL, file/path/case collision, observed-byte overflow, escaping that exceeds 2 MiB despite raw bytes fitting, and visible script/binary exclusions. Assert no partial durable catalog on rejection.
- ProductStore command cases: metadata discovery does not load version bodies; immutable content/hash roundtrip; same-name explicit update; opt-out persistence; current-pointer CAS conflict; all-or-nothing catalog/version/accounting writes; unreadable catalog never becomes an empty overwrite; unknown commit is not retried.
- Actual run admission/retry/resume/tool-loading cases: frozen metadata/body/resource survives update/uninstall and restart; retries add one reference for the new run, resume adds none; discovery never expands permission; missing frozen content never substitutes today's version.
- Lifecycle cases: two runs/chats share a revision, update/uninstall before release, delete one chat versus the last chat, repeated delete, failure rollback and concurrent admission/deletion. Project deletion must not free surviving chat snapshots. Legacy runs remain unchanged.
- Native source fixtures: actual directory read, source/ancestor replacement, symlink/reparse/hard-link rejection, cancellation, traversal-free closed DTO and finite bytes. Windows fixed NTFS classification needs Windows execution, not a macOS mock. Add only focused new native tests now; actual system-picker and installed-app checks remain batch-end evidence.
- Browser FileList adapter/UI: nested mapping, unsupported runtime, cancellation, immediate pending state and duplicate-click exclusion; error/success represents durable command result. Do not introduce normal send-status captions or drawers.
- Run only affected source tests/type/lint/architecture during this task. Full build, emitted/packed library checks, complete native regression and real macOS/Windows installation/picker acceptance follow the owner's end-of-epic batch cadence.

## Related specs

- `.trellis/spec/frontend/shared-product-storage.md`: one ProductStore, generic device settings, actual serialized size, explicit StoreTx propagation and unknown-commit certainty.
- `.trellis/spec/frontend/desktop-media-import.md`: E08 grants are project/session video authority; its native picker, finite actions and Windows limits must not become generic skill file access.
- `.trellis/spec/frontend/native-product-runtime.md` and `.trellis/spec/desktop/runtime/index.md`: trusted main-window native services, shared product pages and source/native acceptance distinction.
- `.trellis/spec/frontend/agent-library-tools.md` and `.trellis/spec/frontend/agent-creative-skills.md`: frozen per-run permission ceiling, retry snapshots, actual per-request offers and built-in opt-outs.
- `.trellis/spec/agent-core/library/capabilities.md`: loading metadata/instructions never grants external authority; concrete host effect boundaries stay responsible.
- `.trellis/spec/frontend/feature-organization.md` and `.trellis/spec/frontend/monorepo-boundaries.md`: pure reusable contracts in Agent packages, product catalog/commands in Studio, OS source capture in desktop; no sibling-source bypass or second registry/database.
- `.trellis/spec/frontend/agent-execution-feedback.md`: quiet successful bubbles, meaningful actual action feedback, no preparation/model-confirmation captions.
- `.trellis/spec/guides/task-artifact-retention.md`: retain authored conclusions, not raw logs/copied source trees.

## External references (docs, versions)

No internet sources were needed for this repository inspection. Observed native dependency pins are in `apps/desktop/src-tauri/Cargo.toml`: Tauri `=2.12.2`, dialog plugin `=2.8.1`, windows-sys `=0.61.2`; these are repository versions, not claims about latest upstream releases. Browser directory capability support was not researched across browser versions; runtime feature detection and actual host verification are required before claiming availability.

## Caveats / Not Found

- This research implemented no product code and ran no tests, package builds, native pickers or Windows host checks.
- No current generic skill installer, browser directory importer or resource reader was found. Existing media import is not such an API.
- Installed text in device settings is excluded from project exports by the existing contract. That does not promise portable skill/run restore or cloud synchronization; those need their own reviewed projection.
- Reference counting is a proposed minimal lifecycle design, not an existing facility. Its admission/retry/chat-deletion transaction changes and strict accounting errors must be included in the E09 implementation/review scope; silently omitting them would break retained-version correctness.
- Source limits, exact resource extensions, catalog capacity and retained-byte budget remain implementation-plan decisions to make explicit before activation. This document does not claim support for arbitrary third-party executable skills or every SKILL.md ecosystem field.

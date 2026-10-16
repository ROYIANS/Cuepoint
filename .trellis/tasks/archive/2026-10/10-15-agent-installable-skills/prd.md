# E09: 可安装创作技能与按需加载

## Goal and user value

Let users install reusable workflow knowledge from a local skill directory, manage
it beside the conversation, and let the Agent read only the instructions and text
references needed for its current task. Reuse the neutral skill contracts in other
projects without adopting Cuepoint storage or creative entities. Loading reusable
creative workflow instructions remains independent from tool execution authority.

## Status and authorization

Planning under [the evolution epic](../../../10-15-agent-experience-desktop-evolution/prd.md).
On 2026-10-16 the owner accepted the E09 outline: metadata/body/resource separation,
local-directory installation and management, unchanged execution authority,
immutable active-run behavior and neutral reusable ownership. The owner approved this concrete PRD/design/implementation plan and requested
implementation on 2026-10-16. The task is now active. Existing authorization for sequential stage
commits and necessary affected tests continues to apply after activation.

## Background and confirmed constraints

- Current builtin skills combine instructions and code-owned tool allowlists;
  instruction-only entries are filtered out by existing tool-group discovery.
  Preserve those groups and explicit user opt-outs rather than redefining them.
  Evidence: `packages/studio/src/features/agent/runtime/skills.ts:12`,
  `packages/agent-core/src/capabilities.ts:8`,
  `packages/studio/src/features/agent/commands/agentSettings.ts:15`.
- Runs already freeze settings; retries retain prior execution snapshots.
  Builtin guidance refresh can replace the aggregate instruction field, so
  requested external bodies belong in durable attributed tool results.
  Evidence: `packages/studio/src/features/agent/commands/agentRuns.ts:127`,
  `packages/studio/src/features/agent/runtime/toolLoading.ts:99`.
- `deviceSettings` is the existing device-local ProductStore owner, with a 2 MiB
  limit per serialized value; new device state adds keys rather than tables.
  Evidence: `packages/studio/src/features/settings/commands/deviceSettings.ts:5`
  and [shared storage](../../../../spec/frontend/shared-product-storage.md).
- The existing skill entry and ContextPanel allow management without leaving
  chat: `packages/studio/src/features/agent/ui/AgentControls.tsx:275`,
  `packages/studio/src/app/layout/context-panel.tsx:36`.
- Prerequisite E06 is delivered: [capability/resource contracts](../10-15-agent-resource-capabilities/prd.md).
  E08's video workflow provides an optional example integration, not a prerequisite
  for importing instruction-only skills or authority to extend its media grants.

## Proposed delivery scope

- One explicitly selected local directory containing root `SKILL.md`; support a
  documented UTF-8 text subset of the portable format plus bounded text resources.
- macOS and Windows desktop selection; browser FileList directory import where
  supported. All use the same validation, storage, management and Agent behavior.
  Windows native sources initially share the existing local fixed NTFS baseline;
  unsupported volumes fail with a useful explanation.
- Device-local installed catalogue, usable across this device's projects according
  to the current global Agent model. No project override or cross-device sync.
- View, explicitly enable/disable, manually update from a directory, and uninstall.
  Installation review offers an explicit enable choice; imported content is never
  silently enabled merely because it was discovered or inspected.
- Search/quick switches stay in the plus-menu skill entry. Management and detail
  use the existing right panel; narrow windows use in-workspace full-width detail
  with Return to conversation while chat stays mounted and running.

## Requirements

- **E09-R1 — Progressive disclosure.** Store a separate bounded metadata catalogue.
  A new eligible Agent run advertises only enabled names/descriptions/identities.
  `load_skill` supplies one captured instruction body; `read_skill_resource`
  supplies only a requested range of a captured manifest text resource. Import-time
  validation may read the bounded package; runtime discovery must not read or
  inject every body/resource. Retain current built-in creative groups.
- **E09-R2 — Predictable local installation.** Explicit selection/import creates
  an immutable owned text snapshot. Define installation generation, content
  revision, quotas and canonical relative resources. There are no automatic roots
  or precedence layers: builtin IDs are reserved and same-name installed content
  requires an explicit update target. Validation and publication are atomic;
  failed update retains the prior usable version. Uninstall removes future
  availability, retaining versions referenced by recorded runs.
- **E09-R3 — Instructions do not confer authority.** Imported fields, prose and
  resources cannot enable tools, issue filesystem/process/network/server grants,
  install dependencies or bypass existing confirmation. Optional `allowed-tools`
  is non-authoritative and visibly unsupported as execution policy. Resources
  resolve only inside the captured text manifest, never arbitrary host paths.
- **E09-R4 — Stable running and historical behavior.** Capture enabled installed
  metadata and exact revision references atomically when admitting a new run.
  Update/disable/uninstall affects new sends; retry/resume retains old references
  and accepted tool identities. A missing/corrupt revision fails explicitly, never
  substitutes current content. Historical loaded-content inspection uses durable
  call/results. Legacy and conversation-only runs do not gain installed tools.
- **E09-R5 — Direct retained-workspace interaction.** Install/update review,
  content inspection and local failures remain in the skills panel. Reflect a
  clicked action immediately, exclude duplicates, preserve the user's selection
  after known failure and keep ordinary success quiet. No drawer, chat-stop
  navigation, unsolicited success toast or transient technical status text.
- **E09-R6 — Reusable contracts and bounded operation.** Generic metadata,
  logical resource validation and disclosure contracts live behind the existing
  neutral core public API, independently exercised by another host fixture.
  Studio owns YAML decoding, installation, persistence, enablement and product
  bindings. Native owns one-shot bounded directory reading. Keep one loop and
  one ProductStore; catalogue, imports, retained revisions and outputs have finite
  budgets. Excess limits fail visibly without evicting referenced versions.

## Acceptance criteria

- [ ] **E09-AC1 (R1,R6):** Metadata is discoverable without loading body/resource
  records. First model request omits their text; actual body and resource requests
  load only the captured selected content, without hydrating unrelated resource
  rows. Both supported protocols retain correct tool envelopes through builtin-group
  changes and context compaction.
- [ ] **E09-AC2 (R2,R4):** Manual update, disable and uninstall change a new send's
  availability; an existing/retried/resumed run still reads its exact old revision.
  Reinstalling the same name cannot revive the old installation identity or
  rewrite an accepted business tool. Referenced content survives uninstall/reopen.
- [ ] **E09-AC3 (R3):** A skill requesting arbitrary files, scripts, disabled tools,
  MCP or unconfirmed paid/media effects gains zero additional authority. Escaping,
  foreign or unlisted resource names reject before access.
- [ ] **E09-AC4 (R2,R6):** Invalid YAML/UTF-8, ambiguous paths, duplicate identities,
  changed input, unsupported native sources and count/byte limits fail before
  publication. Known-failed publication rolls back catalogue/content/retention;
  uncertain commit requires readback, not a duplicate installation.
- [ ] **E09-AC5 (R4,R6):** Concurrent run admission/update/uninstall/delete preserves
  exact reference counts and never deletes a pinned revision. Deleting the final
  owning thread can collect an uninstalled obsolete revision. Preview and actual
  dispatch use the same installed catalogue and shared context budget.
- [ ] **E09-AC6 (R5):** Install, enable/disable, inspect, update and uninstall work
  from retained chat in wide/narrow layouts; keyboard focus/return and existing
  unsaved-editor guards work. Delayed or failed persistence does not duplicate an
  action, discard the selected content, stop chat or flash redundant status copy.
- [ ] **E09-AC7 (R6):** A consumer using the neutral public API can validate and
  discover/load the same instruction fixture with its own in-memory byte source,
  without Studio, React, ProductStore, Tauri, Node-only APIs or a second Agent loop.

## Out of scope

Online catalogues, Git/npm/archive installation, auto-watch/update, recursive
multi-skill roots, executable plugins, bundled script execution/dependency setup,
binary image/PDF/DOCX resources, generic file read/write, MCP, slash-command
infrastructure, project-specific overrides, sync, background Agent lifetime,
delegation and scheduling. Extra files excluded by the supported text subset are
reported during import; their required functionality is not advertised as working.

## Validation cadence and remaining evidence

Each implementation stage receives scoped review, necessary affected checks and a
commit. Full regression, emitted/packed consumer, production build, packaging and
actual native/installed macOS+Windows acceptance remain at the owner's epic-end
batch boundary. Source fixtures do not establish actual picker/webview/platform
behavior. All three implementation stages are source-complete and have passed their necessary affected checks and independent review; evidence lives in `research/stage-1-review.md`, `research/stage-2-review.md` and `research/stage-3-review.md`. The acceptance checkboxes above remain for final batch confirmation, including the actual installed UI/native platforms. Source evidence does not establish those host flows. No paid/live model calls are required.

## Supporting artifacts

- [Design](./design.md): owners, import/storage/run contracts, limits and rollback.
- [Implementation plan](./implement.md): stages and necessary/deferred checks.
- [Current runtime](./research/current-runtime.md),
  [install/storage](./research/install-storage.md),
  [reference comparison](./research/reference-skills.md),
  [format/interaction](./research/format-and-interaction.md).
- [Original capability comparison](../../../10-15-desktop-agent-capability-research/research/capability-comparison.md).

## Source acceptance coverage — 2026-10-16

| Criterion | Source evidence; final acceptance remains above |
| --- | --- |
| AC1 | Both protocols through actual runtime; metadata-only first request, selected immutable body/resource reads, group refresh and actual compaction preserve exact tool/opaque suffixes. |
| AC2 | Real update/disable/uninstall/reinstall plus frozen retry/resume and reopened-store version tests; fresh installation identity cannot replace a saved one. |
| AC3 | Strict unsafe/unlisted paths and actual model attempts to load a disabled native group/call native, paid or invented tools are denied without effects. Approval waits preserve original business calls. |
| AC4 | Strict format/UTF-8/path/quota, real native capture and changed-source helper tests, atomic late-fault rollback and unknown readback. Actual system picker/Windows execution remains pending. |
| AC5 | Actual admission/version pin transaction, independent concurrent update, duplicate/uncertain admission, thread deletion rollback/collection and project-retained pins. Preview uses the shared surface. |
| AC6 | Held ReactDOM management/quick switches, guarded replacement, wide/narrow same-node retention/focus and known/unknown persistence tests. Actual installed interaction remains pending. |
| AC7 | Neutral public-root independent in-memory host fixture passes without Studio; emitted/packed consumer remains deferred. |

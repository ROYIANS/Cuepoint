# Research: Current skill, tool-loading and run boundaries

- Query: What is the smallest reusable seam for installable SKILL.md metadata, body and resource loading without changing execution authority or an accepted run?
- Scope: internal; Studio runtime and `@cuepoint/agent-core` source, specs and affected test fixtures. No implementation or tests executed.
- Date: 2026-10-16

## Findings

### Existing code and owners

| File | Current responsibility and evidence |
| --- | --- |
| `packages/studio/src/features/agent/runtime/skills.ts:12` | Static product-owned creative catalogue. Every entry combines display metadata, instructions and a code-owned `toolNames` allowlist. `assembleSkills` at line 113 rejects nonbuiltin IDs and derives both tools and instructions. |
| `packages/studio/src/features/agent/runtime/toolLoading.ts:20` | Freezes permitted builtin groups when creating a run; project-kind preference may preload audio/music. Lines 27–34 expose metadata for deferred groups and instructions for loaded groups. |
| `packages/agent-core/src/capabilities.ts:7` | Shared group filtering, loading selection and offer predicates. Line 8 drops groups with zero permitted tools; line 24 enforces 36 total offered tools. Lines 19–25 retain unsettled calls while changing groups. |
| `packages/studio/src/features/agent/commands/agentRuns.ts:127` | Creation freezes interaction mode, builtin tool ceiling, loading state and instructions. Lines 132–136 reuse prior snapshots on retry; lines 152–162 retain frozen request/context; lines 178–193 save agent and execution settings. |
| `packages/studio/src/features/agent/commands/agentTools.ts:77` | Persists actual offered names by step. `saveToolRound` at line 119 rejects a nonoffered call unless recording the explicit already-failed unavailable shape; it preserves original wire arguments. |
| `packages/studio/src/features/agent/runtime/runChat.ts:68` | Between settled rounds, refreshes builtin guidance, project context, memory and budget before admitting another model request. Lines 114–126 preserve scope, fresh call, metadata and approval checks before claim. |
| `packages/studio/src/features/agent/runtime/toolLoading.ts:99` | Replaces only an exactly verified upcoming base envelope, retaining Chat/Responses suffixes; refuses switching with unsettled calls. It currently reconstructs all `skillInstructions` from builtin loading state at lines 108–116. |
| `packages/agent-core/src/runtime.ts:217` | The sole reusable execution loop. Lines 226–232 copy/freeze the actual offered definitions before awaiting the model. Lines 95–105 preserve the offered callback/parser and reject metadata drift; lines 143–155 freshly reread and claim calls. |
| `packages/agent-core/src/capabilityRegistry.ts:40` | Runtime-neutral registered executable capabilities, unique identities and disposable installation generations. No filesystem, installation, dynamic-code loader or skill format. |
| `packages/agent-core/src/tools.ts:89` | Exact executable metadata and binding identity comparison; mandatory confirmation precedes even full permission at line 100. |
| `packages/studio/src/features/agent/runtime/contextPlanner.ts:35` | Builds the actual initial system/base envelope. At present builtin skill instructions are combined with trusted agent instructions. Shared budget arithmetic counts serialized request and definitions at line 60. |
| `packages/studio/src/features/agent/runtime/contextCompaction.ts:39` | Compaction activation rebuilds the current skill-bearing base, verifies exact old prefixes for both protocols and preserves opaque suffixes. |
| `packages/studio/src/features/agent/ui/ContextUsagePanel.tsx:100` | Composer preview derives the same builtin catalogue/loading paths, or the active run snapshot. Any installed metadata must participate in both preview and actual send. |
| `packages/studio/src/features/agent/commands/agentSettings.ts:55` | Global builtin skill toggles validate through `assembleSkills`; current config has only builtin `enabledSkillIds`. Defaults migration explicitly preserves opt-outs (lines 15–38). |
| `packages/studio/src/features/agent/ui/AgentControls.tsx:170` | Search/toggle UI enumerates only `AGENT_SKILLS` and states that changes apply to new executions. |

### Evidence-based constraints

1. **Instruction-only installed skills cannot reuse a tool group directly.** The shared group builder intentionally removes an entry with no allowed tools. Inventing a dummy tool or treating manifest `allowed-tools` as an allowlist would couple new instructions to authority. Existing builtin skills remain tool groups; imported workflow documents need a separate catalogue.
2. **The existing snapshot model is a useful fit.** Configuration changes affect a new send; retries reuse the previous enabled tools/loading/instructions. A new optional installed-skill snapshot should follow that model and treat absence on an old run as absence, rather than importing today's installed skills during retry/resume.
3. **Do not append installed bodies into the existing aggregate blindly.** `refreshRunToolLoading` rebuilds `skillInstructions` from builtin state; a later builtin switch would erase an appended installed layer. Compaction also rebuilds this field into the base. Returning requested bodies as ordinary durable tool results is the smaller integration: builtin base refresh and protected Chat/Responses tool chains already preserve those results.
4. **One new helper is still part of the offered-tool budget.** `getOfferedToolNames` only offers the frozen foundation and loaded tool names. Skill read helpers must be code-owned and deliberately placed in the foundation where installed skills exist, with conversation mode still tool-free. The two-group/36-tool limit must account for them; do not simply raise the cap or weaken the current combined story/asset test.
5. **E06 binding generations protect executable tools, not document versions.** Installable instructions need immutable document revision/byte identity. They do not need registration as executable capabilities, and updates must not replace static business tool metadata or inherit accepted approvals. Existing concrete resource grants still apply when the skill later asks the model to invoke media/project tools.

### Recommended minimal design (proposal, not current behavior)

- Add a small pure skill-document module to the existing neutral `@cuepoint/agent-core` public root: bounded frontmatter/body **splitting**, strict validation of host-parsed `unknown` metadata, serializable descriptor/revision types, bounded catalogue formatting and validation of logical resource names. Preserve core's current zero runtime dependencies. Studio uses a maintained safe YAML parser and passes its result as `unknown`; do not handwrite YAML or move a parser/runtime filesystem owner into core. No new runtime loop/package hierarchy, React, ProductStore, Tauri, Node filesystem, directory scanning, watcher or resource-grant issuer enters core. Keep `.js` ESM closure and root exports.
- `pnpm-lock.yaml:5255` already resolves `yaml@2.9.1`, but `packages/studio/package.json` has no direct `yaml` dependency. Declare the actual Studio runtime dependency during approved implementation rather than depending on transitive hoisting; no dependency installation was performed in research. Host parser fixtures must enforce bounded input, duplicate-key/alias/tag policy and safe primitive/object output before neutral validation. The parser setting syntax itself needs its official documentation checked during format implementation.
- Studio owns immutable installed revisions, user enablement, import/update/uninstall commands and the run-level catalogue snapshot. The main session selected the existing `deviceSettings` owner for the configuration index and immutable version records; `.trellis/spec/frontend/shared-product-storage.md:50–55` explicitly requires new device-local state to add a key instead of a table and bounds each value to 2 MiB. Revision storage must fit those limits and retain old run references. New installed IDs must be separate from legacy builtin IDs so existing strict `assembleSkills` and defaults migration continue to work. Namespaced installation IDs prevent collisions with builtin group IDs; display names are not lookup authority.
- The initial request contains only enabled installed metadata and exact identifiers/revisions plus a bounded explanation of the fixed skill-reading tools. Body text and resource contents enter only after an actual model/user selection requests them. Import-time validation may read bytes; runtime discovery must not inject those bodies or all resources into the prompt.
- Metadata remains imported text even when formatted by a neutral helper. Serialize an explicitly whitelisted descriptor shape with deterministic JSON/string escaping and a clear data boundary; do not interpolate names/descriptions into executable XML/Markdown delimiters, host instructions or HTML. Bound/control-check strings before formatting, never allow extra YAML fields/prototype keys to enter the catalogue, and never treat descriptor text as proof of permission. Preview and dispatch should share that same serializer.
- Use fixed, trusted tools (for example `load_skill` and `read_skill_resource`; naming is a planning choice). Resolve only a skill/revision in the current run's snapshot. Return body as a clearly attributed tool result with immutable revision and a bounded manifest of readable resource names, then read selected **text** resources through the second tool. Never interpret a resource name as an arbitrary host path or execute bundled scripts. Each invocation remains inside the existing ownership, scope, cancellation, offered-step and durable tool-result path.
- Store/pin the bytes of the selected revision, not merely its current install ID. Updating/uninstalling removes availability from new runs, while existing run references retain their old bounded content for explicit continuation. If revision bytes cannot be recovered, return an explicit missing-revision failure; never fetch a replacement. The storage owner must define retention/GC from actual run references. Reinstallation is a new installation generation; a same name must not revive a removed identity.
- A skill may explain which existing creative groups are needed, but loading it never enables a disabled group, grants a directory, initiates paid effects or overrides confirmation. Treat optional format fields such as `allowed-tools` as unsupported/advisory metadata with an explicit import result, never executable policy. User-facing format/compatibility policy belongs in the final design.
- Avoid rewriting prompts/envelopes to follow installation changes. Active runs retain their metadata and bytes. Bodies returned as tool results remain attributed workflow guidance under product policy; do not elevate imported frontmatter/body into trusted host authority. Existing builtin groups can remain unchanged in this first stage.

### Failure cases that should shape acceptance

| Trigger | Required observable outcome |
| --- | --- |
| Installed skill contains no tools | Its metadata is discoverable and body is readable; it is not filtered out as an empty builtin group. |
| Read an installed skill, then switch builtin tool groups | Loaded document result and both protocol chains survive unchanged. |
| Import or enable after a run has started | Existing run does not gain it; a fresh send can discover it. |
| Update/uninstall during model wait, parked approval or restart | Existing run reads its pinned revision or fails explicitly if missing; it never reads replacement bytes or replaces accepted business metadata. |
| Retry a legacy/tool-free run | No current installed catalogue or helper tools are injected; conversation mode remains tool-free. |
| Skill asks for disabled generation, an arbitrary directory, shell or MCP | No tool authority is added; current permission/resource guards still reject unsupported effects and mandatory paid/media confirmations still apply. |
| Request a foreign skill, revision or resource | Zero arbitrary filesystem reads; rejection before materialization. |
| Oversized body/resource/catalogue or repeated large loads | Bound before context construction, report truncation/remaining range honestly and use the existing common budget; no invisible complete-resource claim. |
| Stop/delete while a read is materializing | No new result/context resurrection, consistent with existing run ownership/terminal writers. |

### Necessary affected checks and source-mode caveats

- New neutral splitter/metadata/descriptor/path fixtures should cover valid metadata/body separation, bounded sizes, invalid host-parsed values, unsafe resource identities and deterministic revision/catalogue behavior. Include metadata containing delimiters, quotes, newlines, control characters and attempted field/prototype injection to verify the actual serializer boundary. Separate Studio YAML fixtures cover the actual selected library's malformed/duplicate/alias/tag cases. Test actual parsing behavior rather than implementation shape.
- Extend focused `tests/agentSettings.test.ts` and `tests/agentRuns.test.ts`: persisted enable/disable, existing opt-outs, new-run-only availability, immutable retry/resume and legacy/conversation absence.
- Add an actual Studio tool-chain fixture alongside `tests/toolLoading.test.ts`: metadata-only first request; requested body/resource only in subsequent tool results; both Chat Completions and Responses; switching groups/compaction preserves envelopes; foreign revision and permission escalation deny. Preserve its current >60% builtin startup reduction and 36-tool assertions (`tests/toolLoading.test.ts:54–108`).
- Reuse `packages/agent-core/src/runtime.test.ts:96–176` only if executable offer/binding behavior actually changes; it already covers immutable schemas/callbacks, changed installations, parked approvals and async-preparation drift. A document-only feature should not rewrite core execution.
- Public-root type witnesses should demonstrate reuse without Studio imports or a YAML runtime dependency. If pure splitters/validators become new exports, register their source tests and source aliases in the existing profiles. `vitest.agent-source.config.ts:18–24` has an explicit include list, so a new test does not run there automatically.
- `packages/agent-core/package.json` `test` and root `test`/`lint` scripts invoke `tooling/build-agent-packages.mjs`. For the owner's necessary-check-only cadence, use explicit existing source profiles/affected files and no-emit configs; do not claim packed/emitted acceptance from source tests or trigger aggregate builds just to run one parser fixture. Run with the machine pnpm 9 path and Node 24.11+ where required.
- Full build/package, external packed consumer, real native integration and platform acceptance stay at the epic-end batch gate. This research did not run any checks or establish OS confinement.

## Related specs

- `.trellis/spec/agent-core/library/index.md`, `runtime.md`, `capabilities.md`: neutral core boundary, exact offers/identity, grant admission and deferred artifact evidence.
- `.trellis/spec/frontend/agent-tools.md`: frozen permissions/settings, conversation mode, offered-tool integrity, typed tool metadata and composer preview parity.
- `.trellis/spec/frontend/agent-creative-skills.md`: preserve builtin creative groups, current product policies and concrete effect confirmation.
- `.trellis/spec/frontend/agent-context.md`: shared preview/dispatch budget, protected live chains and exact envelope replacement.
- `.trellis/spec/frontend/monorepo-boundaries.md`: public-root exports, neutral imports and source-vs-artifact distinction.
- `.trellis/spec/frontend/shared-product-storage.md`: sole transaction owner and known/unknown certainty.
- `.trellis/spec/guides/task-artifact-retention.md`: retain authored findings rather than raw copied logs.

## External references

None consulted for this internal-runtime topic. The local package declares `@cuepoint/agent-core` 0.1.3. Format compatibility and reference-project research should be supplied by the separate format investigation; no external SKILL specification compliance is established here.

## Caveats / Not Found

- There is no current generic installable-skill model, SKILL.md parser, installed catalogue or skill resource port in the inspected runtime. `AGENT_SKILLS` is a product builtin registry, not a disk skill loader.
- Core immutable offers are implemented; Studio's static host currently ignores the fourth `request` argument and regenerates schemas from its static registry (`runChat.ts:80–90`). That is compatible with retaining E09's static code-owned tools. Adding dynamically executable installed tools would require adopting the exact passed definitions and durable binding lifecycle, which is outside the instruction-only recommendation.
- This topic does not decide actual import containment, Windows/macOS directory handles, exact `deviceSettings` key/value layout and retention mechanics, supported frontmatter syntax or user management placement; those require the separate host/format/UI findings and final design.

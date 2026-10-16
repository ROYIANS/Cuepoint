# Research: Reference project skill loading and installation patterns

- Query: Which DeepSeek Harness skill mechanisms should Cuepoint adopt for E09 local-directory installation, metadata discovery, on-demand instructions/resources, and management?
- Scope: mixed — Cuepoint specs/current source and the user-authorized local reference checkout; no network lookup or runtime execution.
- Date: 2026-10-16
- Reference root: `/Users/xiaomengdao/WebstormProjects/deepseek-harness` (paths prefixed `DSH/` below resolve against this root).
- Planning status: recommendations for design review, not newly approved product scope or implementation.

## Findings

### Files found

| File | Responsibility |
| --- | --- |
| `DSH/packages/skill/skill/src/index.ts` | Provider-neutral summaries/definitions, scoped registry, deterministic duplicate resolution, rendering. |
| `DSH/packages/skill/skill-filesystem/src/index.ts` | Disk roots, YAML parsing, directory/flat-file discovery, current-body reads, watchers. |
| `DSH/packages/skill/tool-skill/src/index.ts` | Metadata catalog, exact loader tool, direct user invocation, retained catalog updates. |
| `DSH/packages/api/session-controller/src/skill-catalog.ts` | Session-scoped user-visible metadata without starting an Agent. |
| `DSH/packages/client/ui-skill/src/client/index.ts` | Composer discovery, per-session metadata cache, right-side resource opening. |
| `DSH/packages/client/ui-skill/src/client/SkillRow.tsx` | Conversation skill row derived from durable call/result contents. |
| `DSH/packages/client/ui-plugin-manager/README.md` | Separate executable-plugin installation/enable/update/remove UX; not a skill-directory installer. |
| `DSH/packages/sandbox/sandbox-windows-acl/src/acl-skill.ts` | Example packaged skill whose provider owns copied resources. |
| `packages/studio/src/features/agent/runtime/skills.ts` | Current Cuepoint built-in instruction groups and code-owned tool allowlists. |

### 1. Separate reusable skill data from host storage and tool execution

DSH defines `SkillSummary`, `SkillCandidate`, and `SkillDefinition` separately. Summaries contain routing data; candidates additionally carry precedence and an opaque provider locator; definitions add the instruction body. `SkillProvider.list()` and `get()` are separate operations (`DSH/packages/skill/skill/src/index.ts:56`, `:76`, `:86`, `:246`). Filesystem discovery and the model-facing tool live in other packages. This is a useful separation to reproduce without adopting Cordis or its many-package topology.

For Cuepoint, keep the text format, validated identity and metadata/body/resource contracts reusable and free of Studio project entities, Dexie, Tauri, Node and filesystem paths. The host owns directory selection, reading/copying, storage, enabled state and effective tool permissions. A small neutral API is sufficient; a pluggable provider framework is not justified solely by this reference.

Current Cuepoint `AGENT_SKILLS` explicitly couples built-in instructions to a code-owned `toolNames` allowlist (`packages/studio/src/features/agent/runtime/skills.ts:12`). `assembleSkills()` validates those IDs and derives tool access (`:113`). Imported instruction packages must not acquire this code-owned allowlist behavior through frontmatter names such as `tools`, `permissions` or `allowed-tools`.

### 2. Metadata-only model context is distinct from metadata-only disk I/O

DSH's model catalog contains only names and capped descriptions. A `skill({name})` call then returns the full body, provider and resource base (`DSH/packages/skill/tool-skill/src/index.ts:82`, `:128`, `:256`). Loading rechecks invocation policy on the actual definition, not only on an earlier summary (`:136`, `:143`). The catalog is omitted if the exact registered loader tool is unavailable or shadowed (`:208`, `:222`). These are good coherence rules: never tell the model to call an unavailable loader, and do not preload every instruction body into the prompt.

However, filesystem discovery calls `parseSkillFile()` for every candidate, which reads the entire file before extracting frontmatter (`DSH/packages/skill/skill-filesystem/src/index.ts:730`, `:741`, `:804`, `:853`). Therefore the reference proves deferred **model-context loading**, not bounded frontmatter-only physical reads. Resource files are not enumerated by its load result; only a base directory/URL/provider hint is supplied (`DSH/packages/skill/skill/src/index.ts:162`, `:185`).

Recommended E09 distinction: import may validate a bounded package once and persist a separate metadata index; ordinary catalog reads must not reread bodies or resources. A body/resource request names the immutable installed version. Explicitly budget file bytes, metadata bytes, file count, path depth, total package bytes and emitted text; the inspected DSH parser does not itself establish all these limits. A description cap alone is not an import/body/output bound.

### 3. Format compatibility can be narrow and honest

DSH recognizes one-level `<root>/<name>/SKILL.md` and `<root>/<name>.md`, not recursively nested skills. It requires YAML `name`/`description`, validates kebab-case names, and optionally reads `whenToUse`, `metadata`, `disable-model-invocation` and `user-invocable` (`DSH/packages/skill/skill-filesystem/src/index.ts:730`, `:821`, `:924`, `:1007`). Missing/malformed metadata logs a warning and drops that entry (`:814`, `:824`, `:835`).

For E09, one explicitly chosen package directory with root `SKILL.md` is enough. Supporting root folders containing many skills, flat-file variants, arbitrary YAML objects, all third-party frontmatter extensions or automatic recursive discovery is additional product scope. Unknown execution/permission frontmatter must never grant effects. Unsupported behavior should be reported during import rather than silently promising complete ecosystem compatibility. Preserve a usable validation diagnostic instead of making malformed local content mysteriously disappear.

The reference uses the maintained `yaml` dependency rather than attempting YAML with a regular expression. Its extraction locates delimiters but semantic parsing uses `parseYaml` (`DSH/packages/skill/skill-filesystem/src/index.ts:19`, `:924`). Cuepoint should either use a deliberately supported bounded YAML subset with an explicit compatibility statement or a maintained safe parser already compatible with the neutral package; dependency choice remains implementation design, not evidence that unrestricted YAML is necessary.

### 4. Do not inherit automatic root precedence or live-body changes

DSH scans the nearest Git project roots, custom roots, user roots and a bundled root. Numeric ranks put project entries above runtime/custom/user/bundled entries (`DSH/packages/skill/skill-filesystem/src/index.ts:35`, `:244`). Registry scope layers can override a same-name entry before rank is considered (`DSH/packages/skill/skill/src/index.ts:345`, `:551`); within a layer rank, provider order and local order decide (`:567`, `:807`). This suits an extensible coding harness but is an unnecessarily surprising first-version rule for Cuepoint.

DSH loads the current file body each time (`DSH/packages/skill/skill-filesystem/src/index.ts:209`). Its README explicitly states there is no body revision protocol: later edits affect later loads without rewriting earlier results (`DSH/packages/skill/skill-filesystem/README.md:151`). A name-changed load is rejected, but a same-name changed body is accepted (`DSH/packages/skill/skill/src/index.ts:500`). This does **not** establish E09's installation-generation/run-snapshot requirement.

Recommended E09 policy: explicit import creates an owned immutable content version; manual update creates a new version after validation, then changes the installed current pointer. Duplicate identifiers produce an explicit update/conflict path. Built-in identifiers remain reserved rather than silently shadowed. Enable/disable, update and uninstall affect future run availability while accepted/current-run reads remain tied to their captured installation/version. Uninstall removes future selection; bytes needed by unfinished or retained evidence must follow a documented retention rule. Do not delete those bytes merely because the current catalog entry disappeared.

This is a proposed Cuepoint policy derived from its requirements, not a policy found in DSH. Exact retention/restart semantics must be defined in the E09 design.

### 5. Installation is not permission to execute resource files

DSH represents resource bases as directory, URL or opaque data (`DSH/packages/skill/skill/src/index.ts:42`). Its renderer tells the model how relative references resolve; it does not confer a filesystem or shell grant (`:185`). The local provider uses `ctx.fs` for non-bundled reads when available and otherwise falls back to Node `realpath`/`readFile`; bundled host resources take a trusted path (`DSH/packages/skill/skill-filesystem/src/index.ts:760`, `:853`). The rendering comment explicitly treats local skill bodies as trusted content and embeds the body verbatim (`DSH/packages/skill/skill/src/index.ts:162`). That trust assumption must not be imported as Cuepoint authorization.

For E09, imported instructions may guide existing enabled tools. Their local text resources should be read through a bounded package-relative accessor tied to the captured content version. A resource reference must not become a renderer-supplied absolute path, external URL fetch, arbitrary file read, executable plugin or shell request. Reject escaping paths and link/reparse-point traversal at the host read/copy boundary. Scripts included in a third-party package are not automatically executable; either explicitly reject unsupported resource kinds or retain them as inert bytes with clearly bounded access. The product design should choose one behavior and disclose it.

DSH's Windows ACL example materializes only known packaged files in a private owned directory, registers the provider and removes its directory on disposal (`DSH/packages/sandbox/sandbox-windows-acl/src/acl-skill.ts:44`). It is useful ownership evidence for packaged resources, but it is a built-in trusted provider and cannot justify executing arbitrary imported scripts or using ephemeral temporary directories for durable E09 installation.

### 6. Adopt stable historical inspection and right-side previews

DSH's conversation skill row derives name, state and exact contents solely from its persisted call/result slice, never from the live catalog (`DSH/packages/client/ui-skill/src/client/SkillRow.tsx:57`, `:98`, `:157`). This directly supports Cuepoint's update/uninstall expectations: an old run must not display new instructions under the old load result.

Its composer offers discoverable skill suggestions and inserts a literal `/name` (`DSH/packages/client/ui-skill/src/client/index.ts:164`, `:221`). Clicking a recognized skill reference opens its source through `sidebarRight.openResource` without navigating away (`:202`). Cuepoint can reuse the interaction principle through its existing side-by-side workspace: metadata/contents open in the right pane, with narrow-width in-workspace full-width switching and the conversation remaining mounted. A slash-command system is optional scope; existing skill selection can provide first-version explicit use without rebuilding composer routing.

The reference metadata endpoint can list skills for a cold session without activating an Agent (`DSH/packages/api/session-controller/src/skill-catalog.ts:19`, `:36`). Cuepoint's management/catalog reads likewise should not start model work. DSH caches client discovery per session and invalidates on preset changes/connection reset (`DSH/packages/client/ui-skill/src/client/index.ts:112`, `:245`); E09's own import/update/toggle/remove commits must invalidate its affected catalog rather than relying on unrelated remounts.

### 7. Keep executable-plugin management outside this task

DSH has a separate plugin manager for package/Git/local-directory installation, script approval, runtime composition and restart requirements (`DSH/packages/client/ui-plugin-manager/README.md:30`, `:36`, `:42`). Its update flow can remove the old dependency before the replacement install succeeds (`:36`). This is not a skill-directory import implementation and should not be treated as a safe atomic-update pattern for Cuepoint.

Recommended E09 management flow: select local directory → validate bounded contents and explain metadata/resources/unsupported features → explicitly import → view installed version and enablement; later choose update from a directory, validate before replacing current availability, or disable/uninstall. Keep the previous usable version if validation/storage fails. Use one installed-list/detail interaction within existing product UI, no drawer or chat-stop navigation. Defer package managers, online catalogs, Git downloads, automatic watch/reload, executable extensions, dependency installation and script permission UX.

### Adopt / defer comparison

| Mechanism | E09 recommendation | Reason |
| --- | --- | --- |
| Summary/body/resource distinction | Adopt | Reusable data model and smaller prompts. |
| Explicit loader and exact available catalog | Adopt | Discovery never advertises an unusable operation. |
| Retained load results for history | Adopt | Updates cannot rewrite old user-visible evidence. |
| Right-side source/details preview | Adopt through existing workspace | Inspect without stopping the conversation. |
| Live disk body and watcher invalidation | Defer | Extra lifecycle/platform complexity; conflicts with immutable installation snapshots. |
| Root precedence and scope shadowing | Defer | Explicit conflict/update behavior is clearer for a first installed catalog. |
| Flat files and recursive multi-package import | Defer | Not required for a chosen root `SKILL.md` directory. |
| Invocation-policy matrix/slash parser | Optional later design | Separate user invocation and model matching are useful but are not local installation prerequisites. |
| npm/Git plugin manager and script approval | Outside E09 | Adds executable code and process/network authority beyond instructions. |

## External references and versions

- Inspected primary source is the local DSH checkout, not a claim about the newest upstream release. `DSH/packages/skill/{skill,skill-filesystem,tool-skill}/package.json` each declares `0.2.1-alpha.3`; filesystem dependencies include `yaml: ^2.4.2` and `chokidar: 5.0.0`.
- Canonical local subsystem description: `DSH/docs/subsystems/skills.md`; provider behavior and acknowledged limits: `DSH/packages/skill/skill-filesystem/README.md:34`, `:79`, `:140`.
- Read-only source inspection only. No reference build, tests, package installation, OS sandbox acceptance or live model invocation was performed or claimed.

## Related specs

- `.trellis/spec/agent-core/library/index.md` — neutral public ownership; no Studio, Tauri, Node or storage dependency in core.
- `.trellis/spec/agent-core/library/capabilities.md` — exact registration identity, frozen offered definitions, no resource authority from metadata or permission mode.
- `.trellis/spec/frontend/agent-creative-skills.md` — built-in tool groups, existing opt-outs, retained run permissions and creative confirmation.
- `.trellis/spec/frontend/agent-tools.md` — execution-side permission and argument validation.
- `.trellis/spec/frontend/shared-product-storage.md` — preserve the sole product transaction owner; installation state cannot introduce a competing database owner.
- `.trellis/spec/frontend/interaction-feedback.md` — do not add transient internal preparation labels or unsolicited success feedback.
- `.trellis/spec/guides/task-artifact-retention.md` — retain authored findings; no copied reference workspace or raw tool log.

## Caveats / Not Found

- No dedicated local-directory **skill** install/update/uninstall API or per-skill persistent enable-toggle UI was found in the inspected skill packages, client skill integration, CLI plugin entry and settings searches. DSH's separate executable-plugin manager must not be presented as that feature.
- No immutable imported-package generation or whole-run skill content snapshot protocol was found. Existing persisted tool results provide historical stability after a body is loaded, a narrower guarantee.
- DSH filesystem/provider source does not itself prove complete package-relative containment, import byte limits, parser alias/complexity limits or script isolation. Its larger filesystem/shell/sandbox composition may enforce additional policy; this research did not audit that whole stack.
- Suggested Cuepoint identity, update, resource allowlist and retention behaviors are design proposals needing the owning plan, not facts inferred from DSH or additional user approvals.

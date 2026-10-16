# E09 format and interaction research

Date: 2026-10-16. Planning evidence only; no product code or host checks executed.

## Format evidence

The primary [Agent Skills specification](https://agentskills.io/specification),
checked on this date, defines a directory with YAML-frontmatter `SKILL.md`, required
name/description, optional supporting files and progressive loading of metadata,
instructions and resources. Optional `allowed-tools` is experimental and host
support varies. This supports portable documents without adopting executable
plugin installation. E09 should advertise a documented **text-only subset**, not
claim complete ecosystem compatibility or support for bundled programs.

Use a maintained YAML parser in Studio to decode a bounded frontmatter into
`unknown`; reject aliases, custom tags, duplicate keys, multiple documents and
excessive nesting before converting values. `pnpm-lock.yaml:5255` already records
`yaml@2.9.1`, but this is a transitive entry, not permission to import an undeclared
dependency. Any use needs an explicit Studio dependency, machine-pnpm lock update
and focused parser checks during implementation. Keep neutral metadata, logical
path and snapshot validation in core; do not implement another full YAML parser or
add Node filesystem dependencies to core. Pin the reviewed parser version after
checking its actual local API; this research has not verified a specific parsing
option or treated it as an implemented security guarantee.

## Existing interaction evidence

| Evidence | Consequence |
| --- | --- |
| `packages/studio/src/features/agent/ui/AgentControls.tsx:139` and `:170` | Skills already have a searchable plus-menu entry. Extend this entry rather than adding permanent composer controls. |
| `packages/studio/src/features/agent/ui/AgentControls.tsx:275` | Current skill view is a compact list of builtin switches; keep quick switches there, with a management/detail action opening a proper reading surface. |
| `packages/studio/src/features/agent/ui/AgentControls.tsx:175` and `:295` | Current settings save emits a success toast plus a pending caption. These are existing behavior, not the desired precedent for new E09 success feedback. Scope any change to the skill controls being modified. |
| `packages/studio/src/features/agent/commands/agentSettings.ts:15` and `:61` | Builtin defaults preserve explicit opt-outs; builtin ID validation is strict. Installed documents need a separate ID/config model, not expansion of the builtin allowlist. |
| `packages/studio/src/app/layout/context-panel.tsx:36` and `:78` | The existing ContextPanel keeps one detail subtree while docking/full-width changes. Use this named presentation entry, with feature-owned selection/import state. |
| `packages/studio/src/app/layout/ContextPanelHost.tsx:41` and `:78` | Host arbitrates replacement/departure and switches to full-width when space is insufficient. It already supports the owner's no-drawer requirement. |
| `packages/studio/src/features/settings/ui/SettingsPage.tsx:74` | Settings is a separate routed module. Opening it for every skill read would depart from the current workspace; an in-chat management entry is smaller and preserves the conversation. |

## Recommended first interaction (proposal for final review)

- Plus menu → Skills: keep existing builtin switches and show installed workflow
  names separately. A single “管理技能” entry opens the right ContextPanel.
- The panel owns installed-list, detail and import-review views. Narrow mode
  offers “返回对话”; the conversation/controller stays mounted and running. No
  modal drawer or route navigation. Opening/replacing the panel respects another
  editor's existing unsaved/departure guard.
- “从文件夹安装” selects one skill directory. Review name, description, source
  label, readable resources and any excluded files before an explicit install
  action. File chooser authorization permits only this import; it is not later
  general filesystem access. New external instructions start disabled; the
  install action can explicitly include enabling them for new executions.
- Update explicitly selects the directory again, shows changed metadata/file
  counts and publishes only after confirmation. The active revision remains
  unchanged if parsing/storage fails. No watch, background refresh or source-path
  persistence is necessary for this version.
- Disable/uninstall affect subsequent executions. Explain this consequence next
  to the action when relevant; don't stop the conversation or imply that
  uninstall erases guidance already read by a model.
- Respond in the clicked control immediately; exclude duplicate gestures. Show
  useful pending state for the actual import/update, visible saved state on
  completion, and local actionable errors. No routine success toast or short
  technical captions. Existing skill switches may show a local optimistic choice
  with owned rollback on known failure; uncertain persistence requires readback
  before another mutation.
- Detail renders plain escaped text/Markdown through the existing safe renderer.
  Resource links select only manifest-relative text resources; remote links never
  trigger automatic fetches, and imported HTML never executes.

## Scope choices requiring the final task review

The proposed installed catalogue is device-local and follows the existing global
Agent enablement scope, without project-specific overrides or cross-device sync.
Import/update use immutable text snapshots. Images, documents, scripts, archives,
remote registries/Git downloads and live source watching are outside this MVP.
Browser directory selection is capability-dependent and must fail explicitly when
unavailable; real macOS/Windows webview and installed acceptance remains separate
from source/parser tests. These are proposed scope choices, not facts inferred
from existing code or a claim that the owner has individually selected them.

## Related specs

- `.trellis/spec/frontend/interaction-feedback.md`: direct feedback, quiet success,
  owned rollback and no internal phase narration.
- `.trellis/spec/frontend/agent-business-details.md`: retained conversation and
  guarded ContextPanel replacement.
- `.trellis/spec/frontend/feature-organization.md`: feature-owned UI/commands,
  narrow app presentation entry and explicit ProductStore propagation.
- `.trellis/spec/guides/task-artifact-retention.md`: authored conclusions only.

# E09 design: installed text skills

Status: approved for implementation on 2026-10-16. Requirement/acceptance
ownership remains in `prd.md`; execute the staged plan without expanding scope.

## Architecture and owners

| Owner | Responsibility |
| --- | --- |
| `packages/agent-core` public root | Pure validated skill descriptors, exact revision/manifest identity, bounded catalogue rendering and logical resource/range validation. Host-supplied decoded metadata/bytes; no YAML library, filesystem, product entity or new execution loop. |
| Studio `features/agent/skills/` | Safe YAML decoding, import package validation, immutable version assembly and catalogue projections. Keep models/commands/queries/runtime/UI in named submodules rather than adding an omnibus barrel. |
| Studio Agent commands/runtime | ProductStore installation/update/retention commands; frozen run snapshot, fixed read tools and protocol/context integration. Builtin skills retain their existing owner/IDs/tool policy. |
| Studio Agent UI | Plus-menu quick selection and retained ContextPanel management/detail/import review. Consume named feature commands/queries, never direct native IPC or arbitrary store mutation. |
| Studio platform runtime + desktop native | Typed one-shot `pickSkillDirectory` service; native picker and bounded text snapshot capture. No persistent source grant or broad filesystem bridge. |
| Existing ProductStore | Sole catalogue/content/retention transaction owner through `deviceSettings`; existing `agentRuns` owns per-run references. No new table or second on-disk installer registry. |

The native service copies bounded text into an import candidate, not into a second
authoritative disk installation. Source directory modification after candidate
capture does not change that candidate. Final installation publishes exactly the
reviewed candidate bytes. No subsequent operation reads the original source path.

## Supported package and parsing

One selected directory has root `SKILL.md` with YAML frontmatter. Validate an ASCII
lowercase kebab-case name (1–64 characters, no consecutive/edge hyphen, matching
the selected directory name), a nonempty description (<=1,024 characters), and
supported optional descriptive fields. Display labels can contain Chinese through
description/metadata; the portable identifier remains separate. The checked format
source and compatibility caveats are in `research/format-and-interaction.md`.
Use an explicitly declared maintained YAML dependency in Studio; a strict
non-executing parse produces `unknown`, then neutral validators construct owned
plain values. Reject aliases, custom tags, duplicate keys, multiple YAML documents,
unexpected structured values and depth/byte excess before conversion. Preserve
UTF-8 text; support CRLF and an initial BOM without changing stored content hashes.

Supported resource locations are `references/` and `assets/` with text extensions
`.md`, `.txt`, `.json`, `.yaml`, `.yml`, `.csv`; root `LICENSE`/`LICENSE.txt` may be
included as inert text. JSON/YAML resources are plain text, not parsed/executed
configuration. Exclude `scripts/`, executable/binary files, nested skill packages,
hidden directories and unsupported extensions. Return a bounded exclusion summary
in review; never silently claim excluded dependencies are available. Unknown
frontmatter behavior is disclosed and cannot become host policy. `allowed-tools`
may be displayed as unsupported advisory metadata but has no enable/approval effect.

Canonical logical names are slash-separated relative names, never paths supplied
to an OS API by the model. Reject empty/absolute/drive/UNC paths, backslashes,
`.`/`..`, NUL/control characters, colon/alternate-stream syntax, Windows device
segments, trailing dot/space, case-fold collisions and oversized components. Check
native containment and file identity before/after reading; reject symlinks,
reparse points, mount/volume changes and concurrently changed candidate files.
Logical path validation cannot substitute for the native read boundary.

Initial finite budgets (implementation constants, covered by boundary fixtures):

| Item | Limit |
| --- | --- |
| Frontmatter bytes / SKILL body bytes | 8 KiB / 32 KiB |
| One text resource / total raw supported text | 128 KiB / 512 KiB |
| Imported text files / path depth | 32 including `SKILL.md` / 4 segments |
| Directory entries examined / path bytes | 1,024 / 512 UTF-8 bytes |
| Installed entries / simultaneously enabled entries | 32 / 16 |
| Model-visible catalogue | 24 KiB serialized UTF-8; reject enabling above budget |
| One persisted value / complete revision group | Actual serialized JSON UTF-8 <= 2 MiB, including escaping |
| Current + retained revisions | 128 revisions and 64 MiB serialized content total |
| Resource read page | <= 8,192 Unicode scalar values, with explicit next offset/end |

Count and byte budgets are distinct. Stop traversal when examined-entry bounds are
exceeded; do not scan a huge tree just to count exclusions. Reject oversize rather
than truncate installed text or silently drop eligible files. A candidate that
cannot fit the actual serialized ProductStore value is invalid even below the raw
text cap. Resource paging uses validated scalar-value offsets, not unsafe byte or
UTF-16 splits. Shared context budget checks still apply before the next model
request; these byte caps are not a tokenizer guarantee.

## Import transport and source compatibility

Desktop uses a new closed trusted-window/session service for one human-selected
directory, reading only the supported bounded package while the request is live.
It accepts no renderer/model absolute path, shell command or arbitrary filename
read. Do not reuse or widen `desktop_media_request`/E08 grants. Reuse reviewed
low-level containment/file-identity helpers only where their assumptions hold.
macOS and Windows support are in source scope; native Windows initially supports
local fixed NTFS sources, rejects network/removable/reparse sources explicitly and
requires real-host acceptance later. No hidden fallback to a less confined reader.

This service has a separate closed snapshot response with an actual serialized
UTF-8 ceiling of 2 MiB, verified before crossing IPC. Do not raise the existing
ProductStore/binary transport limit or expose its transfer operations as a file
reader. A single bounded response is sufficient for the 512 KiB raw-text package;
reject a candidate whose framing/escaping exceeds the response ceiling. Any need
for chunking must preserve a captured snapshot identity rather than reread paths.

Browser uses explicit directory FileList selection, validates the chosen root and
each supplied relative path, then passes bytes through the same Studio parser.
Feature-detect the input capability; unsupported browsers retain management of
existing content and explain import unavailability. Do not promise browser
enumeration can prove native alias identity. The browser operates solely on files
the user supplied, with no persistent directory permission.

The import candidate is bounded ephemeral UI state. Cancelling review writes
nothing. Closing/replacing a panel discards that review after an appropriate
departure guard; installation already accepted by ProductStore settles normally
and is reconciled if the response is uncertain. Native chooser cancellation is a
quiet no-op. Cancellation cannot claim a system chooser has closed unless the
native API actually confirms it; late picker responses do not auto-install.

## Identity and durable storage

Suggested device-setting namespace (all keys follow the existing key grammar):

- `agentSkills.catalog.v1`: version/revision plus entries containing install UUID,
  validated skill name/description, enabled state, source kind/short label,
  installed/updated timestamps and current content revision. No full source path.
- `agentSkills.content.<revision>`: immutable metadata/manifest with each component's
  digest, byte length and canonical sorted ordinal. Revision is SHA-256 over
  deterministic sorted path + exact UTF-8 byte framing, never a display version
  string from frontmatter. No body/resource text is stored in this manifest row.
- `agentSkills.body.<revision>`: exact root document text/body for that version.
- `agentSkills.resource.<revision>.<ordinal>`: one immutable text resource per row,
  resolved only through its manifest entry. Ordinals are canonical import data,
  never arbitrary row keys supplied by the model.
- `agentSkills.retention.<revision>`: independent counts of current catalogue
  references and retained run references, plus the recorded serialized byte size
  of the entire revision group.

Split manifest/body/resource rows are necessary for physical on-demand storage
reads: metadata discovery reads only the catalogue; load reads only the chosen
manifest/body; resource access reads only the manifest and selected resource row.
Putting a whole package in one value would hydrate all resources on body access.
Import verifies the complete package; later reads verify the selected component's
digest/length against the immutable manifest without reading every other component.
One retention entry owns collection of the complete manifest/body/resource group.

Installation identity and content identity are distinct. Identical bytes can share
a content row, but a reinstall receives a fresh install UUID. Builtin group IDs
are reserved; installed same-name conflict leads to explicit update selection,
never silent shadowing or directory-rank precedence. Metadata version/author is
display data, not identity. Reimporting identical bytes against the same installation
is a no-op; it does not create another installation or new runtime authority.

Commands accept an explicit ProductStore/StoreTx and enforce quotas in the same
transaction as all writes. Import/update carry an operation ID and expected
catalogue revision/current content revision; a compare-and-set prevents two panels
overwriting one another. Catalogue keeps bounded last-operation identity/result
needed to reconcile uncertain native commits. Only one unresolved mutation per
panel is admitted; if another writer changes the catalogue before reconciliation,
read back installation identity/revision and report conflict, never guess success
or repeat an ambiguous install. Do not use `getDeviceSetting`'s forgiving undefined
on a mutation path: corrupt/unreadable catalogue is a distinct error from missing.

Installation/update transaction: validate and hash candidate before transaction →
read strict catalogue/retention → assert expected version/quotas → add immutable
manifest/body/resource group if missing → change current pointer and counts →
commit catalogue and receipt together. Validation or known transaction failure
preserves old state.
Unknown commit uses readback through existing certainty semantics. No source
filesystem operation occurs inside a ProductStore callback.

Uninstall removes the installation from future discovery, decrements its current
reference and collects the revision group only when both current/run counts are zero. Disable
keeps the current installed version and only changes future enablement. No normal
operation evicts a referenced version to make space; quota exhaustion explains
which retained work prevents a new version. Content corruption or unexpected
retention counts fail closed; do not repair by substituting the latest version.

## Run snapshot and retention

Add optional versioned installed-skill snapshot to `AgentRun`, separate from
`enabledSkillIds`, builtin loading state and executable binding metadata. A snapshot
contains bounded exact install IDs, content revisions and validated metadata. The
same run-admission transaction reads the catalogue, increments each distinct
revision's run count once and writes the run. It reads metadata/retention only,
not all bodies. New conversation-only runs omit the snapshot/read tools.

Retry creates a new run with the prior snapshot and increments its references;
resume keeps the original run and does not increment again. Legacy runs without
the field keep their legacy surface. Do not add today's installations during
retry, resume, reload or context compaction. All recorded runs retain their
references until actual run deletion, including failed/interrupted/cancelled runs
that may still be inspected/retried.

`deleteChatThread` releases the exact deleted runs' references in the same
ProductStore transaction before deleting the records; extend its transaction scope
rather than opening independent writes. Current project deletion retains Agent
chats/runs and therefore retains their pins; do not change that aggregate behavior.
Deleting the last run can collect an obsolete/uninstalled revision. Audit every
actual run-deletion owner during implementation, not just a grep assumption.
Model/tool results already persisted remain historical evidence independently of
the live catalogue. Cleanup never recreates a deleted thread or alters paid-job
ownership.

## Runtime progressive disclosure and permission boundary

Keep existing builtin `AGENT_SKILLS`, `load_tool_groups`, defaults migration and
code-owned allowlists unchanged in meaning. Add two static read-only tools only
when an eligible new run has installed skills:

1. `load_skill({skillId})` resolves the exact install ID/revision in that run's
   snapshot, reads only its manifest/body rows and returns attributed body plus
   the bounded readable resource manifest. Revision is host-resolved, not a model
   replacement parameter.
2. `read_skill_resource({skillId, path, offset?, limit?})` requires a prior successful
   load in this run, validates the manifest name and returns one bounded range
   with identity/offset/end. It never opens the source folder or an external URL.

Use the existing offered-step checks, strict argument schemas, scope/run ownership,
Stop/terminal writers and durable tool ledger. Fixed helpers count within the
36-tool offer budget; do not increase that cap or unpin unsettled tools to fit
them. First-request catalogue is displayed only with the actual available helper
surface. Metadata formatting escapes delimiter/control content so installed
descriptions cannot fabricate host instruction boundaries. The common host text
states that installed guidance is subordinate to product policy and that tools
must be separately enabled. Optional format permissions never enter tool policy.

Requested bodies/resources are tool results, not appended to trusted agent
instructions or loaded by rerunning builtin assembly. Keep original results and
Chat/Responses envelopes immutable. Refresh and compaction preserve the installed
metadata layer without duplicating or dropping protected live tool chains.
BudgetContext and ContextUsagePanel share the actual catalogue/definitions; do
not add independent token arithmetic. Loading a skill does not load its suggested
tool groups, grant E08 directory access, install executables, start MCP or approve
generation. Subsequent effects retain the existing exact preview, current
credentials, resource predicates, paid confirmation and unknown-outcome rules.

An independent host fixture consumes the same neutral validation/disclosure API
with its own byte map. This proves source-level reuse without Studio imports;
emitted/packed consumer proof is deferred to the epic batch gate.

## Management interaction and rollback

Plus menu → Skills keeps quick builtin/installed switches, with one management
entry. Agent-owned ContextPanel provides list/detail/import-review views; no route
change or modal drawer. Keep one mounted detail subtree through docking changes,
use Return to conversation when narrow, and respect existing other-editor guards.
No new permanent composer button. Management reads do not start model work.

Review shows name, description, optional compatibility, supported resource list,
excluded-file summary and explicit enable choice. Update selects a folder again
and shows old/new descriptive metadata and changed-file counts before publishing.
Enable/disable and uninstall explicitly affect new executions; existing runs may
retain/read the old version. Historical result links inspect stored call results,
not the current same-name installation. Render escaped text/safe Markdown and
resolve package-resource links through the manifest; no auto-fetch or active HTML.

Clicked controls update immediately and block duplicate gestures. Prefer visible
saved state to success toasts. Keep pending feedback on the action that actually
waits; a known failure restores owned optimistic state and preserves import data.
Unknown persistence shows one readback action and blocks repeat mutation. Local
errors stay next to the relevant action. Do not add preparation narration, flash
captions beside chat bubbles or claim an install succeeded before durable proof.

Rollback during development restores the prior source checkpoint, never deletes
user-installed content or pinned versions. New optional run fields are additive;
old runs remain valid. Catalogue format is versioned and unsupported future data
is reported, not silently reset. Any new dependency/export source must join the
actual type/lint/architecture/test discovery and final artifact closure.

# E09 Stage 3 independent review

Date: 2026-10-16. Scope: recorded-run installed metadata and version pins,
admission/retry/resume, actual thread deletion, shared context preview, fixed
progressive read tools, builtin refresh and both provider protocol chains.
Stage 1/2 import and management owners remain unchanged by this review.

## Finding corrected during review

### Escaped load results have a separate tool-output budget

`skills/runtime/tools.ts` originally relied on `executeAtomicTool`'s generic
65,536-character result rejection. A valid installed 32 KiB body can serialize
above that bound because of JSON escaping, with its resource manifest adding
more output. The generic failure preserved safety but gave no useful recovery
for a package that had legitimately passed import validation.

The reviewer reported this boundary to the main session without changing the
portable format or public interface. The main session explicitly kept the
existing independent output cap. The tool owner added an actual serialized
result check before returning the load result, with a message explaining that
the user must shorten the SKILL.md body or resource paths and manually update.
It neither truncates the body nor marks the call completed. A real installed
12,000-control-character fixture reaches this failure and retains no successful
load result. This finding is closed; the separate raw-import/result limits are
now explicit in the installed-skills spec.

## Reviewed production boundaries

- New admission reads the strict installed catalogue and retention records,
  increments distinct revision references, and adds messages/run in the same
  explicit ProductStore transaction. It does not hydrate manifests, bodies or
  resources. Late run-write failure and duplicate reserved identities roll back
  pins and message writes. A lost committed admission reply is reconciled with
  the existing admission identity reader, without a second admission or pin.
- Retry retains only the old snapshot and adds its own recorded-run references;
  resume retains the original references. Legacy missing snapshots remain
  absent, and conversation mode does not query the installed catalogue or gain
  helper tools. Update/disable/uninstall and same-name reinstallation cannot
  change the retained old installation identity or bytes.
- Source inspection of actual deletion operations found `deleteChatThread` as
  the production run-deletion owner. It now includes deviceSettings in the
  existing aggregate transaction and releases exactly those deleted runs before
  deleting records. A late thread-delete fault rolls back both collection and
  aggregate deletion. Project deletion still retains Agent chats/runs and their
  pins; deleting their actual thread can collect the final obsolete revision.
- `composeRunSkills` is the shared admission/next-send assembly. Fixed read tools
  enter the foundation before capability preload calculations and count within
  the existing 36-tool/two-business-group rules. The actual ContextPanel usage
  consumer uses the resulting definitions/instructions with the common budget.
  Preview adds deviceSettings to its explicit finite readonly scope, reads only
  catalogue metadata, and never pins. Saved/legacy previews retain saved fields
  without querying a changed or corrupt current catalogue.
- Both helpers use strict parsers and the existing atomic ledger owner. Inside
  the real transaction they recheck run/thread/project, running call identity,
  exact recorded parsed arguments, read/atomic metadata and the actual offered
  step. A model cannot override revision or select a current same-name install.
  Body loading reads only the chosen manifest/body; resource loading reads only
  the chosen manifest/resource row. Corrupt or missing content fails explicitly.
- Resource access requires an earlier successful completed load in the same
  run/thread, matching saved arguments and attributed skill/revision/name.
  Earlier order in the same round is valid; later, pending, failed, rejected,
  unknown and foreign calls are not evidence. Unsafe/unlisted paths cannot read
  arbitrary content. Unicode scalar pagination uses the shared bounded reader.
- Stop after the selected storage read aborts before completion. Deleted or
  terminal runs cannot recreate a call/thread. Reached completion faults roll
  back; a committed result whose acknowledgement is lost is reused without
  another content read. Documents and allowed-tools metadata do not enable
  disabled tools, grants, MCP, scripts or paid effects.
- Actual Chat Completions and Responses executions cover a held first model
  request while a human updates/uninstalls/reinstalls the same name, followed by
  exact old body and selected resource reads. Actual approval waits preserve
  original business arguments/preview and ask-mode policy despite global
  configuration changes; approve/resume creates the project once and reads the
  old resource. Builtin refresh and actual compaction preserve one metadata
  layer, exact tool/result pairs and opaque Responses reasoning suffixes.
- The portable media-intake example names the existing E08 tools and explicitly
  requires their real availability, project scope and normal confirmations. It
  is not installed/enabled automatically and grants no native authority. The
  actual checked-in document/reference pass through the shared import parser.
  Additional real executions for both protocols load guidance successfully,
  then reject a disabled desktop-media group and attempted desktop_media_scan,
  submit_generation and invented arbitrary_shell calls. The durable calls are
  failed; generation jobs, desktop imports and projects all remain zero.

## Findings left unresolved

No unresolved Stage 3 correctness finding remains after review and the scoped
checks below. Complexity warnings remain visible; this task does not authorize
a general admission/context UI refactor. The known older permission-settings
uncertainty path recorded in the Stage 2 review is outside this Stage 3 change.

## Verification

Independent reviewer execution on the frozen A/B/main-session source:

- Machine pnpm finite source Vitest, one command selecting
  `installedSkillRuns.test.ts`, `installedSkillTools.test.ts` and
  `installedSkillProtocols.test.ts`: **3 files, 50 passed** (16 admission/
  lifecycle/preview, 28 tool, 6 protocol cases).
- After the main session added only three protocol/example cases, independent
  reviewer reran the affected protocol file alone: **1 file, 9 passed** at
  10:57:51. The original 16 run and 28 tool cases are unchanged. Final new-case
  coverage is therefore **53 distinct cases across these executions**, not a
  claimed single 53-case command. No production/lint scope changed afterward.
- Source-only noEmit using
  `tests/typecheck/tsconfig.installable-skills-source.json`: **passed**.
- Existing full ESLint rules, using the finite source profile through the Node
  API parser project override, across all **10 changed production TS/TSX
  files**: **0 errors, 10 visible warnings**. Warnings are preview selector
  complexity 24; admission callback cognitive complexity 53/complexity 111;
  tool loading's existing nested ternary/refresh complexity 22; context usage
  functions complexity 46, panel cognitive complexity 36 and two nested
  ternaries. No rule disable, type bypass or persistent lint workaround was added.

Additional actual receipts supplied by the respective owners, not a claimed
single aggregate reviewer execution:

- A's run/tool-loading/context preview/compaction baseline selection: **77
  passed**, including the 16 new run cases. Its first concurrency-fixture attempt
  incorrectly inherited a Dexie ambient transaction; using the existing
  `Dexie.ignoreTransaction` boundary now models a separate UI event, without a
  production change. Reached old-revision pin/current-count assertions remain.
- B's tools selection: **28 passed**, source noEmit passed, four production
  files with complete ESLint rules: 0 errors/2 visible warnings.
- Main session's protocol selection: **6 passed**, source noEmit passed. The
  initial protocol fixture missed the existing terminal finishing-review request;
  corrected assertions explicitly retain that fifth request and its terminal
  review evidence rather than removing the product behavior. The final
  example/authority supplement subsequently passed **9 protocol cases** and
  source noEmit in the main session. Its first new error-text expectation was
  corrected to the existing disabled/unknown-tool policy message; this was a
  fixture expectation correction, not a production policy change.
- Main session reports affected preexisting baselines **61 passed**, and actual
  architecture discovery **685 files / 2,699 static / 14 dynamic edges / 0
  cycles / 0 failures**. Final staged source/whitespace closure belongs to the
  main session after this report.

No full regression, production build, emitted/packed consumer, native-installed
or macOS/Windows system-dialog acceptance ran during this review. Those remain
at the owner's epic-end boundary; these source fixtures do not establish actual
installed platform behavior. No production file was edited by this reviewer in
Stage 3, and no commit was created by the reviewer.

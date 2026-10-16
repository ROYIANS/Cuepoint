# E09 Stage 2 independent review

Date: 2026-10-16. Scope: separate native one-shot capture, its trusted command and
normal/acceptance ACL closure, fixed-session TypeScript transport, browser
FileList capture, and retained skill management/quick switches. Stage 3 run
snapshots, runtime tools and deletion integration are outside this review.

## Findings corrected during review

### Browser identity checks preceded by file reads

`skills/runtime/browserImport.ts` originally validated each path and complete
case-folded filename before reading, but deferred resource-component identity
checks to the common parser after `arrayBuffer()`. Folder component case/Unicode
collisions, file-versus-directory collisions, a noncanonical `References/`
prefix and invalid portable root names could therefore read selected content
before rejection, contrary to the explicit pre-read contract.

The UI worker corrected the finding by applying the precise root-name contract
and the neutral `validateSkillResourcePaths` to all accepted resources before
any file read. Eight additional fixtures assert that neither root nor resource
readers run for those invalid candidates. Scripts, binary, hidden and nested
package files remain excluded without reads.

### Agent typography contract

`ui/installedSkills.css` introduced multiple 13px body styles, despite the
component spec's explicit Agent 12/14/16 scale and prohibition of 13px. The
reviewer corrected those to 14px, the empty-state heading from 15px to 16px,
and resource/control labels from 11px to 12px. This is a local style correction;
no interface, control behavior or new design system was added.

### Builtin quick-switch uncertainty and captured intent

`ui/AgentControls.tsx:toggleSkill` catches an uncertain builtin-settings write as
an ordinary failure, displays a retry instruction, clears its optimistic state
and unlocks subsequent toggles. If the disable write actually committed but its
reply was lost, a retry reads the already-disabled saved state and computes its
inverse, enabling the skill again. This path was rewritten in Stage 2, although
the former shared save helper had a similar preexisting certainty limitation.

The main session approved the local recovery correction and the UI owner fixed
this changed path. The switch now captures the requested enabled value from the
actual control, applies that target to the latest configuration while preserving
other skills, and retains its optimistic intent/lock for typed unknown certainty.
Inline recovery instructs reopening/reloading the workspace to inspect settings;
there is no invented receipt, ordinary failure/retry classification or second
write. The unrelated existing permission-control save flow was left unchanged.

The reviewer reread the frozen implementation and both actual Antd/Composer
ReactDOM regressions: a committed write with a lost reply stays blocked across
menu close/reopen, and a held latest-config read cannot invert the captured
intent or remove another skill enabled by a competing source. The finding is
closed. No unresolved Stage 2 code finding remains.

## Existing path left outside Stage 2

The existing permission-mode control still uses `useAgentSettings.save`, whose
generic catch presents unknown persistence as an ordinary settings-save failure.
The main session explicitly kept that old permission flow outside this skills
change. Its later certainty review should distinguish confirmed failure from
unknown outcome; this review neither changed it nor counts it as repaired by
the builtin skill-switch correction.

## Other reviewed boundaries

- Rust accepts no renderer-selected source path. The command checks the trusted
  main window/origin and actual ProductStore session before/after the chooser
  and throughout capture. Normal and acceptance handler/build ACLs include the
  same command. The narrow acceptance-origin helper correction restores the
  existing bundled-origin owner without widening accepted entry points.
- Real native busy ownership lasts until picker/capture returns. Reload/session
  invalidation cannot admit a second still-open chooser or publish stale output.
- Enumeration is bounded before sorting/descent; excluded subtrees are pruned.
  Selected/canonical roots, ordinary ancestors and accepted directories/files
  receive actual identity checks. Accepted files are checked through opened
  handles and again before returning the snapshot. Windows reuses the current
  fixed-local-NTFS and no-follow/pinned-directory primitives.
- Response validation keeps the independent 2 MiB serialized ceiling and strict
  closed fields, root/files/count/text/path limits. It neither widens the
  ProductStore transport nor issues media/native resource grants.
- Real ReactDOM fixtures retain the same conversation and detail nodes during
  wide/narrow changes. Departure guards protect review/pending ownership;
  obsolete chooser tickets are ignored. Installed mutation uncertainty stays
  quarantined, and readback never repeats publication. Rendering uses escaped
  text and manifest resource buttons, with no imported HTML/external fetch.

## Verification and limits

Independent reviewer execution on the corrected browser/UI tree before the final
builtin correction, plus actual final-scope checks from its owners:

- Finite source Vitest: 4 files, **90 passed** (UI 8, browser 16, transport 41,
  storage/parser 25).
- After the builtin correction, the UI worker reran **51 passed** (UI 10,
  browser 16, storage/parser 25). The main session independently reran the final
  UI file: **10 passed**. The unchanged transport file remains covered by its
  41 passed cases. These receipts cover 92 distinct cases across the final
  necessary lanes; they are not a claimed single 92-case command execution.
- Source-only noEmit profile: reviewer passed before the builtin correction;
  worker and main session passed again on the final frozen source.
- Existing full ESLint rules with the finite source type profile: 8 production
  TypeScript files, **0 errors, 6 visible warnings**. Two existing AgentControls
  nested ternaries remain; new Panel has complexity 26/two nested ternaries and
  Detail complexity 22. No disable or suppression was added.
  The worker reran final AgentControls through the same complete rules after
  its correction: 0 errors, the same 2 existing nested-ternary warnings.
- `git diff --check`: passed for tracked changes; the main session must include
  new files in its final staged whitespace/architecture closure.

Native worker-reported actual execution, not independently rerun by reviewer:

- Rust desktop `--lib skill_import`: 11 passed, 94 filtered.
- Normal desktop focused compilation/test and acceptance profile check passed.
  The acceptance check needed the main-authorized replacement of an already
  removed `is_entry_path` call with the existing `bundled_origin::accepts` owner.
- Existing vendored HTTP unused-variable warnings remain separately identified.

Actual Windows cfg execution/cross-compilation and installed macOS/Windows
chooser/webview acceptance are pending. No full regression, production build,
emitted/packed consumer or packaging gate ran in this review; those remain at
the owner's epic-end boundary. Source/native helper fixtures do not establish
actual system-dialog or installed application behavior.

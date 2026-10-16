# Stage 3 Agent offers, approval and retained certainty

Status: source implementation and independent final check passed on 2026-10-16.
Checkpoint parent: Stage 2 commit 9d2d2de6. No native code or SDK dependency
changed in this stage. Management and browser production work remain Stage 4.

## Delivered source behavior

Admission and new-context preview share a pure capture of already-connected
generations. Network/host operations never run inside the ProductStore
transaction; final publication checks the actual catalogue and local current
owner. Conversation mode and historical retries without a saved MCP snapshot
do not acquire today's connected tools. Connection replacement notifies preview
subscribers before awaiting old-owner cleanup.

Each execution materializes the exact saved snapshot through core's immutable
capability registry. Both model protocols receive the actual core-supplied
offeredDefinitions. Loading a group changes the next model request; a tool
which was never offered in this response remains rejected. Task, installed-skill,
report and resource helpers all count toward the 36-tool budget. Existing groups
which become too large after resource helpers are stably partitioned by final
capacity; the two-group and pending-pin rules remain enforced.

Round rows, claim fingerprints and E07 envelopes retain explicit bindings.
Existing ask/assist/full approval remains the policy owner. Preparing acquires
ephemeral host authority for exact scope/arguments/target; immediate execution
reuses it, while an approved same-generation resume prepares anew without
retargeting. Saved previews contain safe facts only. A changed binding or new
connection cannot inherit an old approval. Native independently checks final
effect authority after Studio's final local/store claim.

External tools use network/high-risk/non-atomic policy without an automatic
recovery marker. E07 retains bounded untrusted text/JSON and exact original
operation evidence. An unknown report remains readable while its original
call stays unknown; ToolPendingError prevents core's success/continuation path.
Known predispatch refusal is recorded as not started. A verified late original
reply settles only the surviving original job/call even after interruption or
retirement. Deletion and explicit output clear cannot resurrect records.

The report exposes a production readback-only action for original receipts still
held by the foreground host. A bounded WeakMap holds the minimal original
authority/job/context, without arguments, run factory, preview or AbortSignal.
It calls invocationStatus, never execute/invoke. Reload or host release loses
that authority and leaves historical unknown evidence unresolved. Retained
reports remain readable offline. Resource listing uses four-entry pages bounded
even after JSON escaping; reading uses captured handles only. Binary and links
do not initiate downloads or arbitrary file/network reads.

Review rationale and corrections are recorded in
[stage-3-review-notes.md](./stage-3-review-notes.md).

## Necessary executed evidence

Implementation-owner receipts before independent final review:

- Finite source profile: 12 files / 138 tests passed, including existing
  catalogue/manifest/native-port/connection suites and necessary Agent/E07
  regressions. Both wire protocols, same-generation approval resume, replacement
  rejection, final claim binding drift and eight resource servers loading every
  final group were exercised through production owners.
- MCP execution/E07/report subset: 3 files / 36 tests passed. A production core
  loop stops on unknown with no next model request; its report status action
  later settles a known original result with the effect counter still one.
  Actual report controls exercise the same action. Lost admission/start/output
  acknowledgements, stopped/late/deleted ownership and escaped pagination are
  included. These tests overlap the 138-test finite profile; do not add counts.
- Finite noEmit passed. New MCP source lint has no warnings; the existing Agent
  integration owners retain 11 baseline complexity warnings, and existing
  E07/report owners retain 10. No lint suppression was added. Affected
  architecture scan covered 664 Studio / 712 graph files with zero failures.
- Tracked whitespace check passed. Final staged validation includes new files
  before committing.

Independent frozen-scope check passed: 12 suites / 138 tests; finite noEmit;
19 changed Studio source files with zero ESLint errors and 21 reviewed existing
complexity warnings (11 existing Agent owners plus 10 E07/report owners), with
all seven new MCP modules at zero warnings; 664-file ownership check with no
failures; whitespace check with no diagnostics. The reviewer found no remaining
Stage 3 blockers and made no source changes. This is affected-scope evidence,
not the complete formal quality gate.

## Evidence limits

Actual ProductStore/core/model-wire fixtures and controlled finite host replies
do not establish installed native or browser CORS/OAuth behavior. Native Stage 2
evidence remains unchanged. Actual Keychain authorization, Windows vault/Job
Object, system browser/firewall/loopback and signed installed paths stay pending.
Whole formal/regression/build/emitted/packed/installed acceptance belongs to the
parent epic's final batch. Stage 4 preparation files and its privacy test are
not a Stage 3 browser/UI execution claim.

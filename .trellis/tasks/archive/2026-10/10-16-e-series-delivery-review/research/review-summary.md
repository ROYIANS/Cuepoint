# E01-E11 / E16 delivery review summary

Scope: code on `codex/agent-background-host`. Method: static reading plus targeted existing tests; no builds, native or installed checks. Details are in `review-E*.md`.

## Verdict

Source quality is **good overall: no P0 in any delivery**. The weak spots are:
1. Platform evidence: Windows and installed acceptance is missing for E08, E10 and E11. Archive status `completed` overstates that.
2. Stale tests and claims left behind by later stacked deliveries.
3. Several unknown-outcome and lifecycle edges that have no UI exit.

## Coverage matrix

| ID | Verdict | Top finding |
| --- | --- | --- |
| E01 | Met at source; responsive ACs claim-only | Browser script is not in `npm test`; detail pane lifetime tied to AgentChatPage; shot controls have no baseline vs Agent edits |
| E02 | Met | P2: retry omits `modelMetadata`; unknown send has no UI exit |
| E03 | Met; "measured" is capability only | P2: output-commit sampling reruns every delta; marks not collectable |
| E04 | Partly: AC1 departure | `useThreadDeparture` removed by E11 `fe4fcb59` but the PRD still ticks it |
| E05 | Met | P2: unknown create blocks until remount; import queue silently dropped on unmount |
| E16 | Met for shots + 4 asset kinds | P2: handoff depends on Radix `onCloseAutoFocus` with no fallback; other entity families unowned |
| E06 | Partly | **P1** authority is create-only (`complete_todo`/`list_todos` ungranted); `assertCurrent` never called by core; only Todo uses the registry |
| E07 | Met at source | **P1 (verified)** `tests/d05ToolCatalog.test.ts` 2 failures on HEAD (E09 added `load_skill`, `read_skill_resource`); 2 MiB re-read per page; clear leaves 8,000-unit preview; job slots not freed |
| E08 | Partly | **P1** Windows scan aborts on any reparse point (`stat_file` errors before skip, `paths/windows.rs:127-134`); **P1** unsupported-volume error unmapped; no Job Object; hash-then-exec window |
| E09 | Met (strongest) | P2: browser import rejects folders native accepts; 128-revision cap can block updates; Windows placeholders abort import |
| E10 | Met on fixtures | P2: OAuth loopback aborted by one bad connection; 30 s/65 s deadline makes long calls "unknown"; no native consent for stdio; OAuth discovery allows private hosts |
| E11 | Partly | **P1** execution lives in one WebView with no crash/terminate handling; **P1** Quit AC rests on fake-port tests; slow renderer skips draft decision; drafts/attempts memory-only |

## Cross-delivery risks

- E06 contracts are barely consumed: E10 built its own binding/authority instead of the registry, so E06's "reusable" claim is not exercised in Studio.
- Stacked-branch drift: E07's evidence and E04's PRD were invalidated by E09/E11.
- E07 batches and E11 share the per-thread slot, so a running batch blocks a new send.
- Memory-only attempts/drafts (E02/E03 in E11 service) are lost on crash or Quit.
- Unverified platforms: Windows (E08/E10/E11), installed macOS, real Keychain/browser OAuth.

## dsh comparison

- dsh runs the agent in a separate Host process; ours is a single WebView (E11 P1).
- dsh uses a kill-on-close Job Object, head-and-tail spill files, `job_list`, and real confinement typing; ours is narrower (foreground jobs) but stronger on durable owner-checked results (E07).
- E10: ours is stronger than dsh on OAuth, vault, bounded HTTP, teardown and no-replay.
- dsh has Windows session-end and macOS fullscreen handling before hide, and Quit warnings; ours does not (E11).

## Recommended follow-ups (priority)

1. Fix the two stale `d05ToolCatalog` tests and re-run E07 evidence.
2. Windows: skip aliases during scan, map `nativeFilesystem` error, add a Job Object (E08).
3. E11: handle WebView crash while hidden; make Quit wait for the draft decision; warn when Quit affects running work; persist attempts/drafts if required.
4. E06: grant `complete_todo`/`list_todos` or narrow the PRD; move E10 onto the registry or document the divergence.
5. UI exits for unknown send/create (E02/E05); add `modelMetadata` to the frozen retry attempt.
6. Add an `onCloseAutoFocus` fallback (E16); wire the E01 browser script into a gate.
7. Update `task.json` status/commits for E08, E10, E11 to reflect pending acceptance.

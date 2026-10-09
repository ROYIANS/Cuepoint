Completed bounded follow-up, 2026-10-09. H-SUP-01 is resolved on current `src/lib/debouncedDraft.ts` SHA-256 `9bb9227893fb76c038c9d391592586213f75d8531f7465eba46e775ac6739f3a`. Exact prior dependency-only source SHA-256 `13b31cb3c090df4a3c5ad46a1a8b6897c58c109bf8d7df4e3da0b1ee78e1eebd` remains permanent and byte-identical in `tests/fixtures/e07-draft-rebase/debouncedDraft-before.ts`. Main restored the guarded every-render effect; JSON external-version bookkeeping still advances only after `rebase` succeeds. No product edit was made by this worker. Original completed sidecar md/json hashes match their prior artifact manifest.

The new permanent producer is `scripts/e07-draft-rebase-browser.mjs`; fixture and immutable counterexample are `tests/fixtures/e07-draft-rebase/**`; root discovery includes `tests/e07DraftRebase.test.ts` through the unchanged `tests/**/*.test.ts` config. Actual ReactDOM, TextDraftField/current hook and native Dexie project rename are used. There is no fake React/jsdom replacement. The writer performs a real durable rename, then holds completion; an external live DB value becomes `External newest` while the UI retains `Local edit`/saving. After releasing the writer, the current guard adopts the external latest value and keeps it through three unrelated renders. The same positive assertions against the exact original hook fail both at settlement and after unrelated renders.

| Variant | Input shape | Result after save | Result after unrelated renders | Exit |
| --- | --- | --- | --- | --- |
| Exact old source | primitive string | Local edit / DB External newest / saved — FAIL | Same stale draft — FAIL | 1 |
| Exact old source | stable useMemo object | Local edit / DB External newest / saved — FAIL | Same stale draft — FAIL | 1 |
| Current guarded source | primitive string | External newest / saved — PASS | External newest / saved — PASS | 0 |
| Current guarded source | stable useMemo object | External newest / saved — PASS | External newest / saved — PASS | 0 |

All variants retain pending text and execute exactly one durable write. Memo identity stays fixed after the external update; current fixture records10 memo renders, seven with reused identity. Each of four browser runs captures22 loaded modules, rehashes them unchanged afterwards, and distinguishes loaded current hook bytes from delivered old/current bytes. Both current runs actually delivered the reviewed `9bb9227893fb76c038c9d391592586213f75d8531f7465eba46e775ac6739f3a` hook. Final evidence is `E07-hooks-sidecar-followup/native-03/{regression,current}/report.json` with per-shape source identities, original bodies and screenshots. Source/producer inputs remain equal before/after.

Native-enabled root command passes3 files/20 tests, including both new test cases with zero skip; `native-test-03.log` retains it. Targeted test+fixture TypeScript and node syntax checks pass. Without the native runtime variables, root discovery passes the immutable-snapshot case and explicitly skips the native case; `default-test.log` records1passed/1skipped. That non-native case is evidence integrity only, not scheduling proof. No install or shared Vitest/config change is needed.

Replay with existing injected runtime:

```sh
E07_PLAYWRIGHT_PATH=/absolute/path/to/playwright/index.mjs \
E07_CHROMIUM_PATH=/absolute/path/to/chrome-headless-shell \
E07_DRAFT_REBASE_TEST_OUTPUT_DIR=/absolute/path/to/review-output \
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm test \
  tests/e07DraftRebase.test.ts tests/debouncedDraft.test.ts \
  tests/d08TextDraftComponents.test.ts --maxWorkers=1
```

The root native test requires exact prior red failure names and current green assertions. A setup/browser timeout, source drift or unexpected failure cannot count as the old-red proof. Direct producer `current` must exit0; `regression` intentionally exits1. The fixture README documents output/runtime usage; no task/archive path is imported at runtime.

The first attempt failed because a broad status locator also matched the implicit role of `<output>` elements. `native-test-01.log`, old reports and screenshots remain preserved. The locator now scopes to the actual editor; contract assertions/browser timeout were not relaxed. Successful native02 remains; final native03 also verifies the complete loaded source closure.

New files individually reviewed:

| File | SHA-256 | Reason |
| --- | --- | --- |
| `tests/e07DraftRebase.test.ts` | `226ab865babdecf9909b5c34f1b781fe8c4521823dc6157e2ea739132a3032f3` | Existing root include discovers .test.ts. Immutable snapshot integrity always runs; explicit native runtime enables actual browser red/green. Red requires only exact expected rebase contract failures, not setup failure. Green requires same positive assertions. No mocked React hooks or optional DOM runtime. |
| `scripts/e07-draft-rebase-browser.mjs` | `83e3875db72e8355db8ace4ee3a8d4ea08d3e315ad0f7ff7d283a9e6b0661804` | Two fresh isolated Vite/Chromium/IndexedDB shapes per variant. Waits for actual source static readiness, preserves browser10s/default load/main-document contracts. Writes real DB name, holds completion, external DB newest, releases then checks settled and three unrelated parent renders. Captures raw vs delivered source and end rehash; regression snapshot substitution only current module body. |
| `tests/fixtures/e07-draft-rebase/README.md` | `6cc51035897d3842fb2bd83a23c9f63f6c437ef5fef3356f9158fc72e3887a84` | Documents injected existing runtime/authorized pnpm, explicit default skip, expected red exit1/current exit0, retained evidence and finite browser limits. |
| `tests/fixtures/e07-draft-rebase/debouncedDraft-before.ts` | `13b31cb3c090df4a3c5ad46a1a8b6897c58c109bf8d7df4e3da0b1ee78e1eebd` | Exact main pre-fix source copied without edits; immutable counterexample containing [initialValue,controller] effect. Permanent fixture independent of active/archive paths. |
| `tests/fixtures/e07-draft-rebase/harness.tsx` | `7c385f3f4235934c5195a27b91278ca3dff5c5ea5cd7dec5f7ece01e928e712d` | Actual ReactDOM and current TextDraftField primitive input; stable useMemo({name}) object with actual hook/status. Native current create/rename/project reads. Post-durable-write completion gate only. Host instrumented identity/render counts do not replace production hook behavior. |
| `tests/fixtures/e07-draft-rebase/index.html` | `e032048fd5b28299ec26cf73a98947a0819450d2b7bb63ac357741c39f9c4caf` | One actual module entry, native browser DOM root; no alternate app or document reload. |
| `tests/fixtures/e07-draft-rebase/provenance.json` | `be19471c354e077a5552efad4416d5c14b5398fbd98164eb9845f72e70297bb4` | Records exact originalSHA256/sourcePath/snapshotPath and shared import boundary. No active task runtime import. |

Additional permanent typing entry: `tests/fixtures/e07-draft-rebase/tsconfig.json`, SHA-256 `6247ff689855f3b33fad7429870a50e07a93477604550d7c03a85175f7eb0aaa`. Portable extends actual app tsconfig, disables incremental/build-info, includes actual native harness/new root test/Vite ambient. Uses existing node/Vitest types; immutable old counterexample is data, not current source target. Permanent targeted tsc exits0.

Final reviewed source hashes:

| File | Final SHA-256 | Attribution |
| --- | --- | --- |
| `src/components/agent/AgentChatPage.tsx` | `b93fac4d36768b0739075ed63310599bdd80ededb60eb02b83602be845ed6f02` | unchanged frozen13 |
| `src/components/agent/AgentRunDetails.tsx` | `d428f9d2cf2de9ca4bf7f3901605ff8b33ca420d05cd2e311a70790a8223e020` | unchanged frozen13 |
| `src/components/agent/ReferenceAttachments.tsx` | `73eb869da08ebc02d8f780de9fe31f6471e5a2de708072f8a09d1a24e7f86c7a` | unchanged frozen13 |
| `src/components/agent/TaskWrapup.tsx` | `99e3de127ab987a833e372678c3558e20b3d0b69adb40001a1c7e1375b73575e` | unchanged frozen13 |
| `src/components/agent/useChatSelection.ts` | `40c0592b8de6c6e59c6f679c678d8853def469f643e65fb379b4b28003153adf` | unchanged frozen13 |
| `src/components/agent/useReferenceDraft.ts` | `ff87223b74e607da20fbcb3832a88b5dc8bf8c711d29cecbe9cfe6c9cadb135c` | unchanged frozen13 |
| `src/components/audio/AudioTimeline.tsx` | `ec5ba4fda12adf8a42bd4798ff3f0bae9fcbfe19f206c0946183c3e49b590bba` | unchanged frozen13 |
| `src/components/audio/AudioSources.tsx` | `4bd751d7e136dacfceefc9c57b62b54721f26b500f513ce46993c0e213a0f532` | unchanged frozen13 |
| `src/components/studio/ConnectorsPage.tsx` | `27d1b85031a3f7a7c80f14390fba63c16f01a5fba8225c13d588c0aa5c44f59d` | unchanged frozen13 |
| `src/components/studio/ProjectGalleryPage.tsx` | `4a33de135b4edd3b4e5d2caab67fcd6e31cd8665fc461e1d9d72358a23bc1329` | unchanged frozen13 |
| `src/components/studio/materials/MaterialDetailPanel.tsx` | `4756ea00e80904c1669d1408575545ad82c58d24836b84d68eebefd9d6f7cf67` | unchanged frozen13 |
| `src/components/shots/ShotRow.tsx` | `b33d4c918e1573cc2ec4766eadb6ebebe5ee3698f91822a0d64fa63335942d45` | unchanged frozen13 |
| `tests/e07HookContracts.test.ts` | `ed37421149cdcdaddda7104b40bca69778a465e32f8c251e86cbd844a3e91c5b` | unchanged frozen13 |
| `src/lib/debouncedDraft.ts` | `9bb9227893fb76c038c9d391592586213f75d8531f7465eba46e775ac6739f3a` | main guarded-rebase repair independently red/green verified |

Limits and main handoff:

- This follow-up accepts only the main guarded-rebase repair and the new permanent regression scope. No whole E07/QG01/E completion, task status/spec/git/CI/Node22/full-suite/build/model claim.
- Native root case is explicitly skipped without both existing runtime env vars. Always-run snapshot integrity protects original evidence but is not ReactDOM behavior proof. Final native-enabled run executes both tests without skipping.
- Original comparator shares actual current React/TextDraftField/DB dependencies; only the hook body is original. It proves the dependency-only boundary on that shared closure, not a historical whole-app reproduction.
- Native observations use two animation frames and three explicit parent renders, real browser event scheduling, original10s timeout. They do not prove every concurrency/device/latency or all failed-save cases.
- Scan/transform/static-idle preflight records distinct stages, fresh cache and one main document. It does not attribute the earlier E01/writes cold timeout to concurrent baseline or guarantee runtime dynamic/CSS/font readiness.
- No dependency installation or config edits. Main clean Node22 mirror must explicitly update the one changed product source plus new tests/fixture/producer and run affected checks with a new delta/hash receipt; this sidecar did not execute that mirror or require reinstall.

This follow-up is complete; it does not finish the Trellis task.

Final completion freeze: `E07-hooks-sidecar-followup/final-completion-freeze.json`. All13 original frozen owners remain byte-identical, zero worker product writes and zero source drift. Current main guard hash is `9bb9227893fb76c038c9d391592586213f75d8531f7465eba46e775ac6739f3a`; H-SUP-01 is resolved on that exact source.

A portable permanent type config now exists at `tests/fixtures/e07-draft-rebase/tsconfig.json`; its actual test/harness/app ambient check exits0 (`typecheck-permanent.log`). The fixture README documents it. Those config/doc changes do not alter native03 runtime inputs, which were rehashed and still match. Eight new permanent files are frozen in the final JSON. No extra browser cases were run for this finalization.

The current one-count Hooks allowance reason accurately describes the red/green-proven guarded effect. Its document hash/entry are captured in the completion JSON; formal semantic signature matching and global quality acceptance remain owned by main/gate-sidecar. Finite bounds are explicit: two value shapes, one real durable writer gated after write, one external DB update, two animation frames and three parent renders, four fresh native runs,22unchangedloadedmodules each. No broader scheduler/CI/Node22/device or whole-E07 conclusion follows.

Actual final handoff confirmed: `E07-hooks-sidecar-followup/final-acceptance-handoff.json`, status **COMPLETED**, assigned work remaining **none**. All8 owned new files and all13 original frozen files rehashed without drift; current main guard remains `9bb9227893fb76c038c9d391592586213f75d8531f7465eba46e775ac6739f3a`. Original completed reports retain their recorded hashes.

Read-only confirmation of main Node22clean02 evidence: effective runtimev22.21.1,1023before/mirror-after/root-after input records identical,172testfiles/3028testsPASS. The retained permanent native reports execute both primitive and memo shapes: exact old source has only the two expected stale-rebase failures per shape, current source has zero contract failures. Source captures retain the exact reviewed hook and unchanged loaded closures. All8 new files and14reviewedsourcefiles match the actual clean mirror and its1023inputs. This reviews main's retained actual run; no new install/fullsuite/native execution occurred in this sidecar.

Generated-route attribution from native06 is outside the hooks scope and stays main-owned. Whole E07/E/QG01 acceptance likewise remains main-owned. No new product scope or extra browser case was added.

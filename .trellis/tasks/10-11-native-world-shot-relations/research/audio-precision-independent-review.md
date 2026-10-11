# Independent clip-inspector precision review

Reviewed on 2026-10-11 (Asia/Shanghai) by the independently dispatched `trellis-check` reviewer. Active task: `.trellis/tasks/10-11-native-world-shot-relations`.

## Scope and conclusion

**Pass for the scoped source and behavioral change; no issue found.** The final product correction changes only ClipInspector's six numeric controls from `step={.01}` to `step="any"`. This removes the HTML step-grid mismatch for the retained recording's real `trimEndSec=8.945` and other finite continuous source/edit values. It does not round, rewrite or truncate those values, remove required/min/gain constraints, alter repository validation, or change undo/CAS ownership.

This review read `audio-precision-fix.md`, the full new focused test, the actual component submit/history callbacks, the shared Input DOM forwarding, the actual finite-number/source/fade validators and transactional history implementation, and the owning audio-music specification sections. No product, test, spec, task-state or existing provenance-inventory file was changed; only this review report was written. No CUA, microphone, supplier request or user-data store was accessed.

The existing task's earlier awaited native WAV-save caller change is still present in the same AudioTimeline diff. It is not a new part of this precision correction and was preserved. This report does not repeat or replace its earlier independent caller review.

## Actual path and retained boundaries

| Boundary | Reviewed actual path | Result |
| --- | --- | --- |
| Input attributes | `AudioTimeline.tsx:707` numeric field map and shared `Input` component | Every field retains number type, `required` and `min=0`; gain retains `max=4`. Shared Input forwards the supplied step/validation props to the DOM input. |
| Conversion and save | `ClipInspector` submit → `Number(values[key])` → parent `action` → `history.executePatch(selected, patch)` | No rounding or alternate persistence route. Invalid direct-callback numbers still reach the repository's actual guards. |
| Finite numbers | `src/db/audioShared.ts:18` `finiteAudioNumber` | Rejects NaN, positive/negative Infinity and values outside the unchanged min/max; the default upper bound is `Number.MAX_SAFE_INTEGER`. `step="any"` does not bypass this boundary. |
| Source range | `src/db/audio.ts:85` `validateAudioClip` | Start/trim values retain finite/nonnegative checks. End must not exceed the owned take's actual duration; end minus start must be positive. |
| Gain and fades | Same actual validator | Gain stays 0–4; each fade stays 0–clip duration, and their sum must not exceed that duration. No tolerance, normalization or relaxed comparison was introduced. |
| Ownership and CAS | `validateAudioClip`, `replaceAudioClips`, `assertAudioClipDocument` | Project/chapter/track/take checks, whole-document IDs/revisions and transactional all-or-nothing writes remain intact. |
| History and source bytes | `AudioClipHistory.executePatch/execute/undo/redo` | History is appended only after successful transactional replacement. Undo/redo revalidates the current document and restores exact field values. Source take/media are not copied or modified. |

The validator/history/Input source files are byte-for-byte unchanged from current HEAD. The single new attribute remains within the existing specification's finite continuous source-offset contract. No specification relaxation is needed for this correction.

## Meaningful regression coverage

The twelve new cases invoke the actual AudioTimeline and private ClipInspector callbacks through the existing lightweight hook-host pattern. They use real AudioClipHistory and Dexie repository writes rather than a substitute save stub.

- The original unchanged 8.945-second end remains exact while gain and fade values are edited, and the controls retain their HTML bounds.
- All six values with three to six decimal places persist exactly; actual timeline undo/redo callbacks restore the original fields and reapply the exact edit.
- The source take count, media count and original synthetic source Blob bytes stay unchanged.
- Ten invalid edit cases exercise NaN, Infinity, negative position, out-of-source end, empty/reversed trim length, negative/excess gain, excessive individual fades and excessive combined fades. The original clip remains unchanged and no undo/redo entry is created.
- Existing neighboring command/foundation/timeline/shortcut cases retain source independence, ownership, stale-document rejection, split/duplicate/undo/redo and interaction guards.

The new harness is **not ReactDOM or WebKit's native HTML constraint-validation engine**. Its source-prop assertions and callback/repository tests prove the wiring and owner behavior, not the OS/WebView submit outcome. The worker's before-fix log deliberately showed one failed step-property case; it is preserved as the original failed observation. The main session must separately record the rebuilt packaged input submission against the real retained recording, followed by actual undo/persistence. This reviewer has not marked that packaged gate passed.

## Independent verification

Commands used the authorized local pnpm path, with no source changes between inspection and checks:

```sh
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec vitest run tests/audioClipInspectorPrecision.test.ts tests/audioEngineCommands.test.ts tests/audioFoundation.test.ts tests/audioEngineTimeline.test.ts tests/audioTimelineShortcuts.test.ts --maxWorkers=4
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm lint
git diff --check -- src/components/audio/AudioTimeline.tsx
```

Focused test command exit: **0**. Original independent command output:

```text
RUN  v5.0.1 /Users/xiaomengdao/WebstormProjects/aifenjing


 Test Files  5 passed (5)
      Tests  63 passed (63)
   Start at  16:59:38
   Duration  1.60s (tests 48%, transform 30%, setup 12%, import 10%)
```

Root lint / TypeCheck exit: **0**. This project's `lint` command is the strict `tsc -b --pretty false` typecheck:

```text
> cuepoint@0.1.0 lint /Users/xiaomengdao/WebstormProjects/aifenjing
> tsc -b --pretty false
```

Owned tracked source whitespace check: exit **0**. No full aggregate was repeated for this one-attribute correction; the relevant focused files and current strict root types were rerun independently. Complete final-source gates/build/evidence remain main-session owners.

## Captured source identity

| Path | SHA-256 | Current HEAD comparison |
| --- | --- | --- |
| `src/components/audio/AudioTimeline.tsx` | `9eaa60641c61b19fbaf8e894a139538e4894d4509933eb5df1c46a9704454c81` | Contains approved native export integration plus this one-attribute precision correction |
| `tests/audioClipInspectorPrecision.test.ts` | `3fab68565f9c453fb57e41db2924bcbd3d72d8eb1bce4db924fa060417b36202` | New focused regression |
| `src/db/audio.ts` | `72808d100983aa94c74cb2916360efc74365e6b9c933748311c20cdefb4906c7` | Unchanged |
| `src/db/audioShared.ts` | `612a90f8be92b154f0cccff2b4e9dbc9f5b8fe152266600a769d74aeacad1692` | Unchanged |
| `src/lib/audio/commands.ts` | `f53e70d9538c3ffc76cd125aa8d4a53d15aa2d1e8bdbd1a2a98b8473d3e52ae5` | Unchanged |
| `src/components/ui/input.tsx` | `7d0a115d1f1f1ae6da7d733f66b441d63cb58f01845a61522f6cc8d16a973d30` | Unchanged |

Both correction/test hashes match the implementer's source-freeze report. These are captured source hashes, not a claim that the previously built normal bundle contains the correction. The main session reported opening rebuilt isolated bundle `1791708898849` with retained profile data; actual native submit/undo evidence and the normal final-source bundle rebuild remain separately owned.

## Findings (fixed)

None. No mechanical or behavioral defect was found in the scoped correction, and no source/test self-fix was required.

## Findings (not fixed)

No source finding remains for this precision correction. The remaining **packaged native HTML submit/undo/persistence evidence** is an acceptance item owned by the main session, not proven by this hook-host test. Final all-path provenance rescan and the final concrete commit plan remain separate; the earlier inventory snapshot was intentionally not rewritten.

## Verification summary

- Lint: pass, current strict root command exit 0.
- TypeCheck: pass, same actual project command exit 0.
- Focused tests: pass, 5 files / 63 tests (including 12 new cases), exit 0.
- Source whitespace: pass, exit 0.
- CUA/provider/system acceptance performed here: none.
- Product/test/spec/task-state/inventory edits: none.
- Commit, push, archival or main merge: none.


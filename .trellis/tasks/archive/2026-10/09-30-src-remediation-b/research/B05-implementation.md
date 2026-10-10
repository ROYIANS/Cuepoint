# B05 implementation / checker handoff

Date: 2026-09-30. Active task: `.trellis/tasks/09-30-src-remediation-b`.
Base HEAD: `20b0204c9fab43e1265b94761ee880649be2fca9`.
Role: direct `trellis-implement`; B05 PM-03 / PM-04 / PM-06 only, following B04 PASS authorization.
Implementation and self-verification are complete. This is a handoff for the coordinator's independent check; it does not close findings or update task state.

## Changed files and behavior

- `src/lib/audioGeneration/taskIds.ts` (new): pure shared ID predicate, canonicalizer and strict collection validator. An ID must be a string with nonblank `trim()`, at most 512 UTF-16 code units, no C0/DEL/C1 controls, and not exactly `.` or `..`. Otherwise IDs stay opaque: slash and surrounding nonblank whitespace are not rewritten. Canonicalization deduplicates in first-seen order and accepts at most 100 unique IDs. Invalid entries, including sparse array holes, fail the entire collection. New storage/import rejects duplicates; prepared music and speech `[]` remain valid.
- `src/lib/ai/apimartAudio.ts`: successful music submission validates/canonicalizes every returned ID before success. Invalid IDs or excessive unique count are protocol failures; the existing runtime maps them to uncertain after the single POST. Detail reads reject invalid IDs before constructing/fetching a URL, while `task/1` remains encoded within the detail segment. A private cancellation predicate recognizes aborted signals and independent Error/DOMException named AbortError in fetch, JSON body, HTTP error body, speech binary and CDN reads. Ordinary malformed JSON remains protocol (or HTTP for an already failed HTTP response).
- `src/lib/audioGeneration/observations.ts`: validates the task ID collection before the optional-observations early return, and applies the shared predicate to observation IDs. Observation field allowlists, timestamps, uniqueness, membership and lastVerified consistency remain strict.
- `src/lib/audioGeneration/runtime.ts`: after owned read and project check, recoverable jobs canonicalize duplicate legacy IDs through the existing revision-checked write checkpoint before strict observation validation, downloads or GET loops. The checkpoint only patches taskIds. Results, previous verified evidence, connector, input, source and owned media remain intact. Malformed legacy IDs reject locally with a keep-history diagnostic; nothing is written and no endpoint is called. The existing auto-monitor catches the rejection and pauses the job; explicit query shows its error.
- `tests/apimartAudio.test.ts`: ID bounds/uniqueness, real Request URL behavior, malformed provider success, cancellation classification and exact call counts.
- `tests/audioGenerationRecoveryAudit.test.ts`: actual Dexie/fake-indexeddb submit/recovery/checkpoints, partial sibling downloads and retry, paid uncertain outcomes, strict store/snapshot/import rejection and atomic import nonmutation, empty speech compatibility.
- `tests/audioTaskEvidence.test.ts`: actual recovery keeps original agent task ownership, saved outputs and historical evidence; unknown/processing current observations cannot certify the whole generation or attach it to another task.

No direct edits were necessary in `src/db/audioGeneration.ts` or `src/lib/audioProjectPackage.ts`: existing prepare/claim/patch validation and both snapshot/import validation loops already invoke `validateAudioTaskObservations`. Strengthening that boundary now validates IDs even when observations are absent. Regressions exercise those actual call sites rather than duplicating their validators in tests.

## Root-finding behavioral evidence

| Finding | Executed proof |
| --- | --- |
| PM-03 | Duplicate normal provider success is stored once, then two unique tasks complete via 2 GETs + 2 CDN downloads, with exactly 1 original POST. Legacy submitted duplicate IDs without observations repair and finish via 2 GETs + 2 downloads and 0 POST. |
| PM-03, retained evidence | Legacy duplicates with completed/processing observations and an existing result are checkpointed uniquely before the first GET. The first pass downloads only the completed sibling; a later query failure retains the processing lastVerified and saved sibling. Final retry completes via a total of 6 GETs + 2 CDN downloads and 0 POST. The stored source/input/connector and original agent task attribution remain unchanged. |
| PM-04 | Exact dot segments, blank, overlength and controls return validation without fetch. A real Request for `task/1` has `/v1/music/tasks/task%2F1`; the maximum 512-character ID also stays on the detail endpoint. Invalid legacy collections issue zero fetches and preserve the full original DB row. |
| PM-06 | Both POST-submit and GET-detail JSON body reads classify signal cancellation, independent Error AbortError and DOMException AbortError as aborted; ordinary SyntaxError is protocol. Each operation makes exactly one call. Binary speech/CDN fetch and body cancellation also make one call. Actual paid submission retains uncertain and never repeats its POST after cancellation or malformed JSON. |
| Store/package boundary | Duplicate, blank, dot, overlength, control and 101-unique collections fail even with no observations. Revision and row stay unchanged on patch failure. Corrupted ZIP import leaves every table unchanged. Snapshot rejects the same collections. Prepared empty speech IDs round trip through dormant imported history. |

## Verification: final code

All commands use the explicitly authorized local executable:
`/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm`.
Actual executable version: **10.15.0** (not the historical 9.12.0 description). Local Node: **v24.11.0**. Vitest: **5.0.1**. No install was run.

```sh
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec vitest run tests/apimartAudio.test.ts tests/audioGenerationRecoveryAudit.test.ts tests/audioGenerationRuntime.test.ts tests/audioTaskEvidence.test.ts tests/audioFoundation.test.ts tests/projectPackage.test.ts tests/audioGenerationAgent.test.ts tests/audioAgentExecution.test.ts tests/audioOutputEvidence.test.ts --reporter=json --outputFile=/tmp/b05-final-tests.json
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm lint
```

Final Vitest exit **0**, JSON `success: true`: **9 files, 188 passed, 0 failed, 0 pending**. Results and assertion details: `/tmp/b05-final-tests.json`; command output: `/tmp/b05-final-tests.log`.

| Test file | Passed cases | Result |
| --- | ---: | --- |
| `apimartAudio.test.ts` | 38 | PASS |
| `audioAgentExecution.test.ts` | 18 | PASS |
| `audioFoundation.test.ts` | 10 | PASS |
| `audioGenerationAgent.test.ts` | 17 | PASS |
| `audioGenerationRecoveryAudit.test.ts` | 39 | PASS |
| `audioGenerationRuntime.test.ts` | 21 | PASS |
| `audioOutputEvidence.test.ts` | 12 | PASS |
| `audioTaskEvidence.test.ts` | 16 | PASS |
| `projectPackage.test.ts` | 17 | PASS |

Final lint exit **0**: `tsc -b --pretty false`, no diagnostics. Log: `/tmp/b05-lint.log`.
`git diff --check` over the six tracked B05 product/test files: exit **0**.
Earlier six-file runs and related-caller runs also passed; the final combined run supersedes them.

## SHA-256 at handoff

These hashes cover the seven edited/new product and test files; the report itself is excluded.

| Path | SHA-256 |
| --- | --- |
| `src/lib/ai/apimartAudio.ts` | `072ef52ecadf96230346389a22bb14e3f630cc0ac590a9e538abdb0d7caa3611` |
| `src/lib/audioGeneration/taskIds.ts` | `4cf403cb20330f015bf6bfb0b8c99d43f82e328ffa92e8c801deaa63e2bef002` |
| `src/lib/audioGeneration/observations.ts` | `3a4eaa6f6cf3c0186ff5d129bdaa07acf59df509b19523301d7237d502963cbe` |
| `src/lib/audioGeneration/runtime.ts` | `e63f2ea630494265031c7110a7beac4dd190dfe61e7dbefbb7d10caf7cefb054` |
| `tests/apimartAudio.test.ts` | `720c185ec45cd25cf717f832955fdee7329a0cb318af8324b503d7f9b0bb62af` |
| `tests/audioGenerationRecoveryAudit.test.ts` | `ff9598355ff7e5c91e0379337f699e285537c2c2f9e0e300209a974d1b082523` |
| `tests/audioTaskEvidence.test.ts` | `55726461495950bea18a3cfe2479be9f2078231fd76c242d9ffaa69faad6ceb2` |

## Limits and next owner

The tests use actual Dexie repositories and fake-indexeddb with mocked Response/fetch and a deterministic audio decode seam. URL normalization is exercised through real Request. No live paid provider, browser-native IndexedDB transaction scheduling, real CDN, real WebAudio decoder or browser UI automation was exercised. No whole-batch build/full-suite claim is made.

The invalid legacy diagnostic is a local rejected operation, intentionally leaving paid history untouched; no migration, silent removal, provider status fabrication or automatic paid retry is introduced. Dormant/imported, prepared and already saved jobs retain their existing early-return behavior.

Coordinator: independently check PM-03/04/06 as one B05 root unit, verify these source hashes against the current shared tree, then decide finding closure and metadata/spec/ledger updates. No agents were spawned, no commit/push/install/archive/state/spec/ledger changes were made by this implement role. B01–B04 work was preserved. B06/C/D were not started.

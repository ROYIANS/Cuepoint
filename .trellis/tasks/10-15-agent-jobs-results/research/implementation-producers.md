# E07 producer implementation

Status: **FREEZE**. Producer scope implemented; final focused verification recorded below. No core, schema, storage command, UI, ownership-policy, build, installation, native acceptance or Git changes belong to this producer scope.

## Actual integration

`web_read` now admits a durable job before the existing Tavily adapter can dispatch. The adapter retains the entire sanitized accepted extraction within its existing 2 MiB HTTP response limit. The producer publishes that extraction through `publishAgentJob`; the storage owner atomically writes result chunks, the bounded descriptor and the original call completion. The original result remains at most 16,000 serialized characters, with a preview at most 8,000; the next model request uses that descriptor instead of injecting the extraction. Existing public-URL checks, credential redaction, prepared connection revision, paid-request uncertainty, no automatic retry and the independent 65K tool-result guard remain active. `web_search` retains its existing bounded behavior.

The new static `read_job_result` consumer reads existing chunks with the actual current durable caller identity and thread/project checks. It does not call Tavily. Pages are at most 6,000 characters and carry `untrusted: true`; the storage API supplies advancing, surrogate-safe continuation offsets. Historical web source rendering also recognizes retained web descriptors, while continuing to support old web-read results.

The new `project_media_check` consumer resolves the actual bound video project, freezes exact selected IDs/metadata and keeps binary references only in invocation memory. It accepts at most 64 unique video IDs, checks each declared binary size at most 512 MiB and total at most 2 GiB, and serially invokes the existing `binaryAvailability` service. It checks actual owner/existence/revision before and after reads and again before publication. Deleted/changed items become findings; they do not cause foreign reads. Only observations and report text are retained. The storage command owns the single report formatter and the final transaction snapshot check, including changes in the last publication gap.

Both producers serialize their stopping/checkpoint/publication commands. Media Stop marks the durable job `stopping` while the current uncancellable native availability request drains. That request deliberately receives no aborted signal, so its real finding can be retained; no following item starts. The foreground execution lock remains held until the read and queued updates drain. Browser `ready` means Blob availability only; neither the report nor tool guidance claims a hash/codec/video-content verification. Metadata revision is not a binary hash.

Admission or publication uncertainty never authorizes another backend request. Media uncertainty is surfaced through the existing pending/unknown tool path. Existing completed-call evidence wins if Stop or an exception arrives after atomic publication. Typed, known web admission limits return only a fixed, bounded actionable `retention_unavailable` failure with `serviceMayHaveRun: false`; unknown admission/storage errors are not converted into known no-dispatch successes or arbitrary public exception text. Explicit post-approval disabled/changed connection failures preserve `serviceMayHaveRun: false` through final publication.

The static registry uses the existing single dispatch erasure. `business-read` explicitly includes the two new report capabilities; `web-research` includes `read_job_result`. `BUSINESS_TOOL_GROUPS.read` retains its original four entries so the existing combined story/asset offer remains within 36 tools. The two-group and 36-tool limits and same-round pending pinning remain unchanged.

## Producer-owned files

- `packages/studio/src/features/references/providers/tavily.ts`
- `packages/studio/src/features/references/agent/webTools.ts`
- `packages/studio/src/features/references/agent/webToolNames.ts`
- `packages/studio/src/features/settings/models/search.ts`
- `packages/studio/src/features/video/agent/mediaCheckTools.ts` (new; `MEDIA_CHECK_TOOLS`)
- `packages/studio/src/features/agent/runtime/jobTools.ts` (new; `JOB_TOOLS`)
- `packages/studio/src/features/agent/runtime/tools.ts`
- `packages/studio/src/features/agent/runtime/skills.ts`
- `tests/agentJobProducers.test.ts` (new)
- `tests/webResearch.test.ts`
- `tests/d05ToolCatalog.test.ts`
- `tests/toolLoading.test.ts`
- This report.

Reviewed cross-feature command imports are `admitAgentJob`, `markAgentJobRunning`, `stopAgentJob`, `checkpointAgentJob`, `publishAgentJob`, plus the concrete `AgentJobAdmissionError` in the web producer. The agent-private page reader uses `readAgentJobPage`. Root owns their ownership/discovery registration; this report does not change it.

## Verification evidence

All commands used the local `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/node` and the explicit source configuration. No default freshness wrapper or emitted package build was invoked.

- Focused source run of `tests/agentJobProducers.test.ts`, `tests/toolLoading.test.ts`, and `tests/d05ToolCatalog.test.ts`: **38/38 passed**, 3 suites. This includes the final typed admission-limit path and the combined story/asset 36-tool regression.
- After adding the actual discovery-entry regression, `tests/toolLoading.test.ts`: **13/13 passed**. The actual model/`load_tool_groups`/next-model-request path offers `project_media_check`, `web_read` and one deduplicated `read_job_result` from enabled business-read/web-research groups, within the existing budget. Producer lifecycle fixtures intentionally start after discovery; this separate regression supplies the real loader evidence.
- Earlier finite source run of these producer/catalog/loading suites plus `tests/webResearch.test.ts`, `tests/webResearchRuntime.test.ts`, `tests/sharedRegisteredToolArguments.test.ts`: **172/172 passed**, 6 suites. Subsequent changes were the fixed known-admission message/class and targeted loading coverage; those changed suites were rerun as recorded above. This earlier count is not represented as a final whole-stage check.
- Final strict Studio source types: `node node_modules/typescript/bin/tsc -p tests/typecheck/tsconfig.studio-agent-source.json --pretty false`: **passed**.
- ESLint API over the eight actual changed production files, using the source type project: **0 errors / 14 warnings**. Warnings are the provider and URL/result decoder complexity/nesting findings. Root-level tests are outside this typed lint target; their passing execution is not claimed as typed lint coverage.

The producer suite runs the actual shared core through Studio `executeChatRun`/approval/resume and the real browser product store. It checks Chat and Responses extraction larger than 65K, complete sanitized page reconstruction after same-process store reopen, bounded next requests, preserved opaque Responses continuation, one external request, current/foreign readers, known no-dispatch configuration drift, stopping during held requests, exact video selection, unchanged project media, native missing/corrupt/read errors, deletion/owner drift, lock drainage, completed publication winning late Stop, and unknown admission/publication with no replay. Registered argument/catalog cases cover the two additional static definitions.

The native read fixtures invoke the actual native TypeScript service over a held closed transport reply and a branded reference, through the producer's real availability boundary. They do not exercise Rust, real disk corruption or the packaged native runtime. Store reopen is a same-process reopen, not process-kill recovery. The model/provider replies are local deterministic fixtures; no live paid service was called.

## Deliberate boundaries

No media decoding/transcription/hash implementation, arbitrary filesystem tool, worker/background lifetime, remote generation redesign, automatic repair/retry, network atomicity claim, new core hook, generic report registry or permission dashboard was introduced. Real native/disk/packaged/process acceptance and final whole-stage checks remain with the designated owner and deferred final gates.

## Independent review follow-up and renewed freeze

The independent checker reported **208/208 tests across 11 source suites**, plus source types/lint passing, before identifying one architecture-only import-boundary issue. The producer changed only the `AgentToolContext` type import in `mediaCheckTools.ts` to the reviewed public `agent/runtime/tools` entry; the `defineTool` value import and runtime behavior remain unchanged. The checker owns the targeted post-fix types/lint/architecture verification; the already passing 208 tests need not be repeated for this erased type import. The discovery tool name in this record was also corrected to its actual `DISCOVERY_TOOL_NAME`, `load_tool_groups`.

Renewed **FREEZE** SHA-256 for `packages/studio/src/features/video/agent/mediaCheckTools.ts`: `1ed99b7d9f1864510ec77617102b5648aadefde3c73286f9dcef7b77c880151b`.

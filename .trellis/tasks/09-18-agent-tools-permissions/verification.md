# Verification — 2026-09-18

## Automated gate
- Independent full-scope trellis-check completed with no remaining findings.
- Lint/typecheck passed.
- Full Vitest: 503 tests across 38 files passed.
- Production build passed after final review fixes; existing oversized Agent chunk warning remains (~7.9 MB raw).
- git diff --check and task context validation passed.

## Independent review fixes
- Recover crash between saved awaiting-approval call and parking the run without stranding decisions.
- Failed/interrupted runs with pending approvals can still receive scoped decisions after latest-run/ownership/unknown-effect checks. Preserve original failure state until explicit continuation.
- Seven additional tests cover those windows, mixed approvals, unchanged permission snapshots, superseded/mismatched ownership, live-tab locks, deletion during tool completion, and unknown-effect precedence.

## Browser smoke
Temporary isolated localhost:5176 storage and local fixture provider on localhost:4318, no real provider credentials or paid calls.
- Sent request producing workspace_overview + update_run_plan; both call results and plan rendered, followed by a model summary.
- Seeded test-only pending approval using the real builtin read tool (ordinary production read does not require approval). Reload retained approval card and arguments; approving continued to completed result and model answer.
- A separate seeded call was rejected; rejected status persisted and result was sent into continuation without invoking the tool.
- Skill menu displayed both real capabilities and permission controls fit the composer. Temporary fixture page/services removed/stopped.

## Scope
Only tools/permissions child implemented. Task board, actual business writes, search connectors, generation, attachments, memory and specialist delegation remain deferred. Permission write/network/high-risk paths are covered through injected controlled test definitions; no fake production tools ship.

## Repository
First child committed as 0e10553 and archived. This child is verified but awaits a separate work commit; .tanstack/ remains unrelated.

## Final UI / reasoning / Responses increment — 2026-09-19
- Lint/typecheck passed; **536 tests across 43 files passed**; production build passed (existing large Agent bundle warning remains); diff/context validation passed.
- Independent review identified and resolved: per-thread reasoning persistence/isolation, malformed model-list metadata guards, conservative duplicate context capacities, metrics-aware message memo, model search autofocus, terminal-only SSE timing, and saved Responses envelope validation before side effects.
- Browser (isolated localhost:5176, fixture provider localhost:4318): chose GPT-5.6 Luna + high effort, refreshed and confirmed retained choice; server recorded two `/v1/responses` requests with `reasoning.effort: high`, second with `function_call_output`. Actual builtin overview completed once, final reply rendered model icon, measured 102.6 tok/s and provider-reported cumulative 1,080 tokens (fixture values). Refresh retained result/metrics; activity expanded correctly.
- Provider metadata fixture returned 128,000 context tokens; model detail/context inspector used it instead of the 1,050,000 official reference. Unknown model limit remained unknown.
- Verified flat plus search/home/skills surfaces, compact context popup, outside-click dismissal for context and model picker, Escape dismissal and returned focus. 390px viewport model picker stacks list/details; context popup fits width. Restored viewport.
- Fixed focus-induced outer-shell scroll (decorative overflow previously allowed programmatic scrolling despite overflow:hidden); Agent shell now clips, and transcript retains sole scrolling ownership.
- No real provider credentials used and no paid provider requests made. Actual provider compatibility beyond documented protocols remains subject to its gateway implementation.
- This child now includes reasoning configuration and a bounded Responses adapter in addition to tools/permissions. Attachments, search/MCP, business mutation/generation tools and task board remain future work. Files/MCP placeholders are not exposed.

## Home/detail surfaces and expanded editor — 2026-09-19
- Full Vitest: **540 tests across 43 files passed**. Lint/typecheck, production build and diff whitespace checks passed; existing large Agent bundle warning remains.
- Traced LobeHub context capacity to its private workspace model-bank, provider metadata merging and tokenx estimates. Recorded exact source references in research/lobehub-context-and-composer.md. Known-model context references now work independently of connector reasoning support; provider-reported capacity retains priority.
- Home exposes Agent/task entry selection without permissions/context. Detail exposes persisted smart/conversation mode, permissions/context, expanded editing and send-shortcut preferences. Conversation runs omit tools and skill instructions; retries preserve original mode/tool snapshots, including legacy snapshots without tool fields.
- Isolated headless Edge at localhost:5176 with fixture-only storage/provider: verified desktop expanded editor stays within the right chat column, preserves both left navigation columns, starts text at the top and anchors toolbars at the bottom. No translucent viewport overlay or nested editor border.
- Verified 120-line draft scrolls inside textarea, collapse preserves draft, conversation selection persists on reload, expanded Enter inserts a newline, context popup opens and dismisses on outside click. At 390px width, expanded editor fills the available column and mobile navigation trigger does not obscure text.
- Browser speech recognition is capability-detected, with stop/cleanup/error handling. No microphone recording or live speech service verification was performed.
- No real provider credentials or paid model calls used. Temporary verification server stopped after checks. Work remains uncommitted; task board and other deferred capabilities retain their previous scope.

## Manual Model Bank — 2026-09-19
- Full suite: 548 tests across 44 files passed. Final metadata provenance refinement:
  21 targeted model-bank/metadata/reasoning tests passed; lint/typecheck and production
  build passed. Existing large Agent bundle warning remains. Diff whitespace check passed.
- Added eight tests covering field-level precedence, unknown IDs, malformed limits,
  gateway restrictions, 1.05M formatting, AST-only reading, missing upstream records
  and duplicate/computed/syntax-error failures.
- Compared against local LobeHub revision ebe586289d55936b738e4dc822dbdd745196b4f3,
  OpenAI catalog SHA256 8f97e351887d9356024a3095247f3b2d5b5bd96593096f6380275acafa256e85.
  Five exact IDs match context/output fields; dated GPT-5 remains explicitly missing
  upstream and preserved locally. Untracked upstream IDs are reported for manual review.
- No upstream code executed, no network/paid model calls, no dependency installation,
  no scheduled automation and no commit. User selected manual maintenance on demand.

## Complete upstream Model Bank — supersedes curated subset, 2026-09-19
- Source: local LobeHub packages/model-bank at revision
  ebe586289d55936b738e4dc822dbdd745196b4f3. All 197 package files copied byte-for-byte,
  with original root LICENSE retained. SHA-256 manifest verified against both the
  copied package and actual local upstream files; no files modified or omitted.
- Generated all 85 static provider model exports: 1,855 records, 1,399 distinct IDs.
  Counts: chat 1,630; image 114; video 88; embedding 12; tts 3; asr 3; realtime 5.
  Empty providers, disabled entries, duplicates across providers, all nested fields,
  prices and generation parameters preserved. Complete provider config/types/shared
  schemas/tests also remain in the original package snapshot.
- Independently derived model exports and limit index from the upstream directory
  and copied directory; both serialized outputs are exactly equal. Generated JSON
  is checked for complete reproducibility by application tests.
- The new generator evaluates trusted local snapshot data modules in a restricted
  VM with only local modules and installed zod. This replaces the earlier limited
  AST-only comparison; no network/process/filesystem exposed to snapshot modules.
- Removed the six-record bank. Exact provider-aware lookup reads the generated full
  data index, preserving OpenAI Luna 1.05M vs ChatGPT Luna 272K. Original application
  wire allowlist remains separate; no automatic new protocol support is claimed.
- Lint/typecheck passed; 548 tests across 44 files passed; production build passed
  (existing oversized Agent chunk warning remains); git diff --check passed.
- Upstream tests are retained verbatim but excluded from application test discovery.
  No dependency installation, real provider request, scheduled job or git commit.

## Batch 2 closeout
- Root MIT LICENSE applies to Cuepoint original code; README acknowledgments include
  verified official LobeHub repository and the direct dependency projects. Separate
  THIRD_PARTY_NOTICES preserves LobeHub Community License for snapshot/derived data.
- Existing TanStack temporary build cache is ignored, not committed or deleted.
- User explicitly authorized committing all batch 2 work and archiving this child.
  Parent Agent core and task workspace child remain open for the next batch.

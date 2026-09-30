# B04 / PM-02 implementation handoff

2026-09-30, Asia/Shanghai. Direct trellis-implement work after B03 independent PASS. Implementation and focused verification are complete; independent B04 review and finding closure remain coordinator-owned.

## Changes and protocol behavior

Product changes are confined to `src/lib/ai/openaiCompatible.ts`. One private unknown-input model-directory decoder is used by both listModels and testConnection. A directory must be a non-array object without a non-null error or success:false, contain a data array, and have a record/nonblank string ID in every row. One malformed row rejects the whole directory. Valid empty arrays remain successful; IDs retain trimming, deduplication and sorting, and probe modelCount retains raw row count. Existing parseModelMetadata/collectModelMetadata preserve optional invalid-limit tolerance, conservative duplicate metadata merge and special-key handling.

GET fetch is caught separately from all response/body/decoder processing. Only GET fetch TypeError or HTTP404/405 reaches the original single minimal chat POST. HTML, malformed JSON, empty body, error envelopes, malformed directories, and body TypeError/SyntaxError/AbortError return failure after one GET. Ordinary fetch errors and all other HTTP statuses also stay at one GET. Missing credentials make zero requests.

The permitted POST keeps the original endpoint, Bearer/JSON headers, trimmed default model or gpt-4o-mini, messages:[{role:"user",content:"ping"}], and max_tokens:1. It requires a valid nonempty choices array, first choice/message records, assistant role, and valid optional text fields. Empty, null or absent output text is accepted for a one-token probe. Error envelopes take priority over otherwise valid choices. Failed POST HTTP/fetch/body/envelope/choices/message returns failure without another request. No new public result shape or provider kind API was introduced.

serviceEnvelope uses explicit early error branches in order: error.message, error string, envelope.message, default error. Protocol/network failures use centralized failure redaction before 300-character truncation; the existing HTTP formatter retains auth semantics and redacts before its 200-character truncation. All helpers remain private and local to the adapter.

Specialized MiMo/APIMart/AIHubMix implementations were untouched. Connector regressions verify their protocol failures and transport/HTTP gates stay read-only.

## Regression evidence

Changed tests only: openaiCompatible.test.ts, connectors.test.ts and modelMetadata.test.ts. Old id-only chat-success fixtures now use valid choices/message responses; the old `{data:{}}` empty-success expectation now requires failure.

The parameterized matrix asserts exact zero/one/two requests and GET→POST methods, original endpoint/headers/body/default model, legal empty directories, duplicate ID behavior, malformed rows and error priority. For GET protocol failure, the mock returns a valid success if an accidental POST occurs; failure-result and exact-one-GET assertions therefore detect hidden paid fallback. For each permitted fallback trigger, malformed POST bodies and fetch/HTTP failures assert exactly two attempts and one POST. Each case creates a fresh Response. Connector all/chat/discover/probe entry points propagate general provider failures; specialized provider probes reject HTTP200 protocol failures without POST. Metadata coverage retains absent-limit tolerance and conservative duplicate merges. Long-key diagnostics exercise redaction across the truncation boundary.

Final verification, after the requested early-branch style adjustment:

```sh
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec vitest run tests/openaiCompatible.test.ts tests/connectors.test.ts tests/modelMetadata.test.ts tests/agentAuditRemediation.test.ts
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm run lint
git diff --check
```

- Vitest 5.0.1: **4 files / 331 tests passed**, exit 0. Start 15:41:45; duration 1.46 seconds. Includes the existing audit connection-fallback credential-redaction regression.
- Lint/typecheck: `tsc -b --pretty false`, exit 0.
- Diff whitespace check: exit 0.
- B03 ContextParameters, contextSettings, repo, ShotEditorPage and b03IntentBoundaries hashes still match B03-check.md exactly.

## Limits and ownership

Tests execute the actual adapters/connector dispatch using mocked fetch and real Response objects, including injected body-read rejection. They establish request attempts/methods/payloads without a real provider, paid request or browser connector-page integration. Existing audit tests use the project test environment. No full suite, browser run, install, commit, push, archive, task-status/spec/ledger update or B05 implementation was performed. This handoff does not claim independent review or whole-batch acceptance.

Only the four implementation/test files above and this research report were written by this agent. Existing B01–B03 and coordinator edits were preserved.

## SHA-256 of final implementation and tests

| Path | SHA-256 |
| --- | --- |
| `src/lib/ai/openaiCompatible.ts` | `58af82f28f70dbd361d9bfc43b4201186407060c67ad6fd3f342e20a65c29912` |
| `tests/openaiCompatible.test.ts` | `5e9a68d32f76c79fdcfbba647280b7af85202c0a8867cb0daeb3c0bdd86b9fbf` |
| `tests/connectors.test.ts` | `e5d146330a2f663bff417f8a03479393b351436e954d1614cc5e530e65751d68` |
| `tests/modelMetadata.test.ts` | `91d2f9e15f232a20ecb66c84daca31e989d1e32f3423e0a3322b0771e4cf3f57` |

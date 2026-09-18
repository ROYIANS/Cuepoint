# APIMart connector and image/video API adapters

## Goal

Establish APIMart as a studio-global BYOK connector and expose reusable image/video API adapters for future generation entry points.

## Confirmed scope

The user prioritizes infrastructure before film Agent workflows and selected: “先完成 connector 和生图／视频适配层，使用入口后续再做”. Existing connectors persist locally and stay outside project ZIPs. Official-source findings are in `research/apimart.md`.

## Requirements

- R1: Add APIMart to the existing connection catalog with default Base URL `https://api.apimart.ai/v1`. Support local save/edit/disconnect and read-only connectivity testing; never submit generation as a probe.
- R2: Expose model IDs, categories, capability tags and optional parameter schemas. Preserve unknown categories and absent schemas explicitly. APIMart chat discovery must exclude known image/video/audio models; other connectors retain existing behavior.
- R3: Submit model-specific JSON bodies to standard image/video generation endpoints and return all submitted task IDs. Preserve native fields such as `size`, `aspect_ratio`, `generate_audio` and first/last-frame roles, without imposing a fixed model list.
- R4: Expose multipart image Blob/File upload, validate documented format/size limits and return provider URL plus metadata. Stricter per-model reference limits remain the caller's responsibility.
- R5: Query a task by provider ID and return status, progress, image/video URL collections, expiry and available error/cost metadata. Distinguish pending, processing, completed, failed, cancelled and unknown states; malformed envelopes must not become empty success.
- R6: Support abort signals and injectable fetch; never automatically retry generation submissions after ambiguous failure. Local abort does not mean remote task cancellation. Do not send keys to result URLs or arbitrary metadata-provided hosts.
- R7: Preserve existing connector storage, compatible chat transport and ZIP secret exclusion.
- R8: User approved follow-up: known APIMart image/video/audio models must be excluded from manual-search and saved-model reinsertion as well as discovery. Preserve old messages and show a clear warning for an incompatible saved selection. Validate compatibility before creating/sending chat messages; unknown custom models remain manually usable. Provider metadata, not guessed names, is authoritative.

## Acceptance Criteria

- AC1 (R1, R7): APIMart configuration survives reload; existing providers still load; probe uses read-only requests; keys remain absent from project exports.
- AC2 (R2): Mixed model fixtures expose categories/capabilities/schema, and APIMart chat options filter media models with explicit handling of missing metadata.
- AC3 (R3): Representative image/video fixture tests verify paths, auth, model-specific JSON fields and non-empty task IDs, including multiple returned tasks.
- AC4 (R4): Upload tests verify multipart body, correct limits and metadata without a manually assigned JSON Content-Type.
- AC5 (R5, R6): Cover documented task states, multiple result URLs/expiry, HTTP/provider errors, invalid JSON/envelopes, abort and no automatic submission retry.
- AC6 (R7): Lint, full tests and production build pass. Report mocked contract validation separately from live provider validation.
- AC7 (R8): Tests cover search and saved-selection bypasses, connector switching/loading, known-media send rejection and unknown custom-model allowance. No chat POST or message creation occurs for rejected selections.

## Out of scope

- Generation buttons/forms, slot integration, Agent tools and task boards.
- Persistent generation jobs, automatic polling, refresh recovery, result downloads into Dexie and slot result selection.
- Custom Midjourney operations, video editing/extension, audio generation, webhooks, proxy/backend and undocumented provider cancellation.
- Exhaustive model presets or a complete JSON Schema form/validation engine.

## Review status

User approved original plan with “ook” and the detailed model-compatibility follow-up with “可以，改一改”. Original scope and R8 implementation/full-scope review passed; final checks (187 tests) are in `verification.md`. Commit approval/bookkeeping remain pending.

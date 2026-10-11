# AIHubMix GPT-6 Luna public vision declaration

Read-only research, 2026-10-11. No keys, app profile reads, product changes or paid inference.

## Authoritative supplier evidence

- [Official model page](https://aihubmix.com/model/gpt-6-luna): exact `gpt-6-luna`, input modalities Text and Vision, output Text.
- [Official preview model page](https://preview.aihubmix.com/model/gpt-6-luna): exact ID and an explicit text/image input declaration.
- [Public model directory](https://aihubmix.com/api/v1/models): unauthenticated GET returned HTTP 200, `success:true`, 870 entries. The exact model declares `input_modalities:"text,image"`, `output_modalities:"text"`, `types:"llm"`, `context_length:1050000`, `max_output:128000`. It has no `capabilities` field. Its `schema_checked:false` remains an independent provider parameter-schema flag, not a denial of the separately declared input modalities.

Selected raw fields, fetch time, response byte count and full-response SHA-256 are preserved in `aihubmix-gpt6-luna-public-vision.json`. No full catalog or unrelated prices are copied here. The web text parser could not open the API response; the receipt comes from a bounded unauthenticated Node GET to that exact official endpoint.

## Current mapping gap

`src/lib/ai/aihubmix.ts:219` parses supplier `input_modalities` with the existing lowercase/comma/array token parser and preserves `inputModalities`, but derives `metadata` only through `parseModelMetadata(row)`.

`src/lib/ai/modelMetadata.ts:46` derives vision only from explicit boolean `capabilities.vision`. `src/lib/ai/connectors.ts:58` carries `metadata` into the composer catalog, not `inputModalities`. The local model bank has no exact `gpt-6-luna` record. Therefore the existing `resolveVisionCapability` reaches unknown and the initial attachment guard rolls back message creation.

This is evidence for a focused supplier-metadata mapping repair, not permission to infer from a model name or weaken `requireVision`. Map a valid explicit supplier image input declaration into provider vision metadata, preserve explicit false/conflicting/invalid declarations conservatively, and retain unknown when the supplier does not declare a usable input capability. Existing duplicate-row metadata collection already makes an explicit false dominate true.

Meaningful checks should include the exact public row shape, normalized string and array modalities, text-only declarations, missing/empty/malformed input declarations, explicit false/conflicts and duplicate rows. Verify both `listAIHubMixModels` and `discoverConnectorChatModels` carry the resulting metadata; preserve existing input/output model classification. Source focus: `tests/aihubmix.test.ts`, `tests/connectors.test.ts`, and `tests/modelMetadata.test.ts`.

The source receipt proves what the supplier declares. It does not prove current API-key model entitlement, actual visual answer quality, a successful paid request or native pixel persistence; those remain actual product acceptance checks after a reviewed repair/build.

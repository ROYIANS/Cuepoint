# Audio pilot verification

Status: independently ACCEPTED by boundary_check after actual CLI closure at 2026-10-15 03:06:34 UTC. Other feature moves then followed the accepted pattern.

## Actual owners and contracts

`quality/studio-ownership.json` is the disk-coverage and dependency policy used by the production architecture CLI. Rows retain original/current/final paths, feature owner and reviewed value/type entries. `tooling/quality/studio.mjs` applies cross-feature ownership even to unmoved callers (for example `db/music.ts`). The static graph records imported symbols, including types, rather than skipping every type-only import. A missing policy with a Studio source directory fails. Public model type names and required non-model API types are explicit; feature UI/private types do not gain a general exception.

- `platform/product/store.ts`: the original single import-time ProductStore and startup initializer; no new owner or mutable locator.
- `platform/storage/{types,browser,native,store,schema,...}`: typed contracts/adapters/one schema. No React/product/app import; central model types and exact historical browser parsers remain explicit.
- `platform/product/queries.ts`: the original React observation binding to the fixed owner.
- `platform/product/scopes.ts`: actual audio transaction descriptors. Table descriptors define scope; operations rebind to the supplied transaction.
- `features/audio/queries/snapshot.ts`: actual `getAudioProjectSnapshot`, same supplied ProductStore, readonly scope and validation; commands no longer re-export it.
- `features/audio/commands/{audio,arrangement,generation,batches}`: unchanged business operations and explicit optional store propagation.
- `features/audio/commands/rowPatch.ts`: the single actual `patchAudioRow` CAS boundary required by Audio and Music, with no extra helper export.
- `features/audio/commands/ownership.ts`, `models/row.ts`, `commands/history.ts`: actual ownership guards, row construction and generation-history detach, with no old audioShared bridge.
- `platform/data/revision.ts`: original canonical revision functions; video target validation remains in `features/video/models/productionRevision.ts`.
- `platform/product/httpPolicy.ts`: current connector/search-origin policy, reread per request/redirect. No policy caching or permission change.
- `features/audio/ui/AudioGenerationBatches.tsx`: only `AgentAudioBatches` is a public cross-feature presentation symbol. Other view helpers stay private.

Feature UI consumes named shared app presentation/departure entries with exact exported symbols. Frame `context-panel` is planned under app/layout, because it uses frame arbitration. AudioPlayer calls the actual runtimeSave download owner directly.

## Verification and limits

- `pnpm lint`: PASS on the final pilot after splits and co-location.
- `pnpm exec vitest run tests/audio*.test.ts tests/mimo*.test.ts tests/d03AudioCommands.test.ts tests/sharedProductQueryHooks.test.ts tests/sharedStorageContract.test.ts packages/studio/src/features/audio/**/*.test.ts`: **31 files / 506 tests PASS** after the CAS owner and five focused test relocations. The exact command uses the approved absolute machine pnpm path.
- `features/audio/commands/audioStore.test.ts`: separate real browser ProductStore, explicit StoreTx nested add→snapshot→CAS→snapshot, late duplicate ledger constraint reached and entire mutation rolled back, default store unaffected, positive commit afterward. The same test now runs `observe(tx => getAudioProjectSnapshot(..., tx))` and verifies initial and changed snapshots after an external committed Audio command; standalone rerun PASS. This test is independent browser transaction proof, not native evidence.
- `tests/sharedProductQueryHooks.test.ts`: actual useProductQuery callback receives explicit Tx; old-owner late replies and cleanup/error/recovery behavior pass.
- `tests/audioMusicAgentTools.test.ts`: actual registered `audio_create` executes through executeAtomicTool; saved completed result replay does not duplicate a script; late agentToolCalls update fault rolls back the speaker and leaves no result. This is distinct from the independent-store constraint test.
- `node tooling/quality-check.mjs --only architecture`: PASS, 576 TypeScript files, 2328 static value edges, 10 literal dynamic edges, no cycles/failures before the final additional source-only gate test case.
- `node --test tooling/studio.test.mjs`: actual production CLI fixtures reject cross-feature private value and private UI type imports, commands→UI, platform/product/runtime→app, storage→product/React, neutral UI→business, and non-approved app symbol access; allow explicit model type + named app presentation entry. Also reject omitted disk source, duplicate owner, pending complete destination, old bridge and missing policy. A legacy db/music owner case is included.
- `node --test tooling/workspace.test.mjs`: both existing workspace/assembly tests PASS after the shared fixture gained its minimal ownership policy.

Relocation comparison: 84 moved TypeScript bodies unchanged after normalizing only import/export module specifiers; 365 actual current consumer bodies unchanged after import/mock normalization and three individually reviewed source-anchor maps (landing forbidden aliases, popup source locator and schema file URL); 47 declarations in the three split modules match original bodies exactly. Four unintended dot-prefixed data literal rewrites were found and restored: task `.` and `..` guards, storage key `.`, VoiceReferencePicker accept `.wav,.mp3,audio/wav,audio/mpeg`. The mover now rewrites actual module syntax only. No test assertion was weakened. The newly type-checked existing clip-history fixture receives its required filename (`audio.wav`); this is the only test-fixture body addition from co-location. Raw comparison outputs remain under /tmp and are not retained task artifacts.

Five focused tests now live in `features/audio/tests`; native suite and owner-assertion source locators follow the real move. Cross-feature ZIP/native/integration tests remain with their existing integration owner. Immutable snapshot bodies and schema bytes have not changed.

Full root quality PASS after refreshing only existing reviewed contract evidence identities following the body proofs: lint retains its 12 reviewed allowances with zero failures, architecture has zero failures/cycles, and all 15 unused contracts match. Final full root/native acceptance remains required after the complete feature move and review closure. No native all-suite acceptance is claimed for this pilot; native freshness now includes the executable quality policy directory.

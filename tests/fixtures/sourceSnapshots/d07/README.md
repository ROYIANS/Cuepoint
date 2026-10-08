# D07 original-source test fixtures

Copied byte for byte from `.trellis/tasks/10-08-src-remediation-d/research/D07-evidence/before/src`; the exact original paths and SHA-256 hashes are below.

Keep these files unchanged. Comparator tests execute the original implementations, with relative imports resolved inside this tree. Existing `@/` imports continue to resolve to current `src/` through the Vitest alias.

The existing `vi.mock` factories for `modelMetadata` and `visionCapability` still import the actual, byte-identical current modules. Their fixture files are copied for mock module resolution; their outgoing historical dependencies are not executed or needed. No replacement parser or canned result is used.

| Original path | Copied path | SHA-256 |
| --- | --- | --- |
| `.trellis/tasks/10-08-src-remediation-d/research/D07-evidence/before/src/lib/ai/apimart.ts` | `src/lib/ai/apimart.ts` | `0aaf9904b526ce8ca63cdc67535f7b245fbf182e5e4b93a6185633916118c65e` |
| `.trellis/tasks/10-08-src-remediation-d/research/D07-evidence/before/src/lib/ai/apimartAudio.ts` | `src/lib/ai/apimartAudio.ts` | `b039e073947defcfc5b69a1e33fd2b7a39779c33159ba4eb65cd632509362d9e` |
| `.trellis/tasks/10-08-src-remediation-d/research/D07-evidence/before/src/lib/ai/aihubmix.ts` | `src/lib/ai/aihubmix.ts` | `c6a66b5fdb0904d1765b70f04b38769f55ec5a6c70feae757396adffbb4233c9` |
| `.trellis/tasks/10-08-src-remediation-d/research/D07-evidence/before/src/lib/ai/mimoSpeech.ts` | `src/lib/ai/mimoSpeech.ts` | `0be180a9ed8767321126cc7b49ba3f16836e625466e3d43c105c46e9dcaf62c8` |
| `.trellis/tasks/10-08-src-remediation-d/research/D07-evidence/before/src/lib/ai/openaiCompatible.ts` | `src/lib/ai/openaiCompatible.ts` | `58af82f28f70dbd361d9bfc43b4201186407060c67ad6fd3f342e20a65c29912` |
| `.trellis/tasks/10-08-src-remediation-d/research/D07-evidence/before/src/lib/ai/chatStream.ts` | `src/lib/ai/chatStream.ts` | `ede7b8806f165128a864f948435defc700c226a4656041c6a485c0f3342cdf6d` |
| `.trellis/tasks/10-08-src-remediation-d/research/D07-evidence/before/src/lib/ai/responsesStream.ts` | `src/lib/ai/responsesStream.ts` | `7a641a8da7404523939998ea6618989e9823bb1f63e24dec9aad5076e2eabee7` |
| `.trellis/tasks/10-08-src-remediation-d/research/D07-evidence/before/src/lib/ai/tavily.ts` | `src/lib/ai/tavily.ts` | `b24c36e3ef77e85585b6d72ca684b40e2f7c7e5d758696abea5ea945a0c98ae4` |
| `.trellis/tasks/10-08-src-remediation-d/research/D07-evidence/before/src/lib/ai/safeError.ts` | `src/lib/ai/safeError.ts` | `aaca8cbeafa33d6d2d7f12668f858827de788b1b3737bf9a909cdb255dca5d12` |
| `.trellis/tasks/10-08-src-remediation-d/research/D07-evidence/before/src/lib/ai/boundedResponse.ts` | `src/lib/ai/boundedResponse.ts` | `92cc47f78623f8c1c8e7d864a9f4af655c5b498077f8b0e93de25eefc9be8384` |
| `.trellis/tasks/10-08-src-remediation-d/research/D07-evidence/before/src/lib/ai/modelMetadata.ts` | `src/lib/ai/modelMetadata.ts` | `9ea70a6c9172cbab757550440888fbda56a5ec6f89aa95111405accd3db175aa` |
| `.trellis/tasks/10-08-src-remediation-d/research/D07-evidence/before/src/lib/ai/boundedSse.ts` | `src/lib/ai/boundedSse.ts` | `8626015eebd251a1956992f6274d679f8e3cd6af556e2e4acb9acf72fe925894` |
| `.trellis/tasks/10-08-src-remediation-d/research/D07-evidence/before/src/lib/ai/referenceWire.ts` | `src/lib/ai/referenceWire.ts` | `12e661d548816a5e99285ccef20aeb0bb7353f7f289d61a4ac763ff941bd74a8` |
| `.trellis/tasks/10-08-src-remediation-d/research/D07-evidence/before/src/lib/ai/visionCapability.ts` | `src/lib/ai/visionCapability.ts` | `a4d73f99782eea0fa7bd3611b56a540909f34baf879f6bc1dd108479a436f349` |

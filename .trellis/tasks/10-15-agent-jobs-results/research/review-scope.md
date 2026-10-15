# E07 frozen review scope

Frozen after all implementation owners released their source scope on 2026-10-15. This manifest covers **50 changed product/test/config/discovery/canonical-spec files**, plus **15 unchanged directly consumed validation support files**. It includes new untracked files as well as the tracked diff; a tracked-only diff is insufficient.

The 11-suite / 208-test run and initial source types/lint used this same snapshot except the subsequent mechanical type-import repair in `mediaCheckTools.ts` (old `80da6a82328e31983233d2e3340d71a25fc6e08b321fcaf3a6ca27543ec342e4`, final hash below) and submission-time removal of an extra blank line at EOF in `tests/agentJobProducers.test.ts` (test-run hash `3aa22dfc871cf3171566560bd515779f88c3e77488d4edaeba1df88bf201ac1a`, final hash below). The value `defineTool` import, runtime body and test tokens stayed unchanged. After the type-import repair, strict source types, the affected file's typed lint and actual whole architecture were rerun and passed. Neither the erased type-only repair nor EOF whitespace normalization changes runtime behavior, so the 208 tests were not repeated. Comparing all 65 final rows after EOF normalization found only the documented test-file whitespace change since the prior frozen ledger; the other 64 inputs matched.

Coverage labels distinguish actual execution from source review. Hashing a Rust/config/spec file does not establish native, emitted, packed or full unused acceptance. The actual architecture tool independently inventories its full registered graph and rejected input drift; this focused ledger does not claim to list all 660 graph nodes or every installed dependency.

| File | SHA-256 | Actual coverage |
| --- | --- | --- |
| `.trellis/spec/frontend/agent-jobs-results.md` | `e1dfd0ba7782bf17a4cb54511bb770dcc59f1064f0708e70c5884b512efd871c` | Canonical source contract review |
| `.trellis/spec/frontend/agent-web-research.md` | `a084ce950616c9f86c7a9b1b0fdfc2677a2ef098f3d82ff29ede65d43b44ca8b` | Canonical source contract review |
| `.trellis/spec/frontend/index.md` | `56ee6f8af36a66093017d78ecbc2d0f5f003b804db450cce10cddca15d397f20` | Canonical source contract review |
| `.trellis/spec/frontend/monorepo-boundaries.md` | `f93d23793ffc053e223e1936b86b11f432814ccffc1575c549323af4b9441bbd` | Canonical source contract review |
| `.trellis/spec/frontend/native-product-runtime.md` | `5713bef083f3d2d76075281e19b859f6817eed78c3ba662cf8c2f06a5bb8ce67` | Canonical source contract review |
| `.trellis/spec/frontend/quality-guidelines.md` | `33b0a0c3b11ceb4ce746586f6759fbdc12b73350ed31ead2553f7b10a5ae9c11` | Canonical source contract review |
| `.trellis/spec/frontend/shared-product-storage.md` | `2637898020aef07eca598679b5cc323e48be87b8d8f1fe19ee7e8d79f3fd6d70` | Canonical source contract review |
| `.trellis/spec/studio/frontend/index.md` | `ea5b75f5017f9c8a0e49931ae9e8e1aec0c0738bf94cc50549f672b018d2642f` | Canonical source contract review |
| `apps/desktop/src-tauri/src/full_product_store/mod.rs` | `128799df32204b23c33e3e393d69e0206fa2dc658eb029029b74bfdb9d5b3d13` | Rust source/registry review only; execution deferred |
| `apps/desktop/src-tauri/src/full_product_store/registry.rs` | `c72b2be926a332fec7c1246f2a4e9d636ce11da9d0a41fbfa173a4ef2aa78479` | Rust source/registry review only; execution deferred |
| `apps/desktop/src-tauri/src/full_product_store/tests.rs` | `e9f99b6f5e8eaf6d00008e9a06ec79a0300b1b597f7a08c17a81ed73bd8a1aa3` | Rust source/registry review only; execution deferred |
| `eslint.config.mjs` | `c402976bc289e66e3a39ae439a7b0d19ec5e910e36de05944a5e38c25607073a` | Unchanged consumed validation support; source reviewed |
| `knip.json` | `869d2daff58ca25466623bc7e59da62ea9f50ddefb69495d04e8032ac4277f1a` | Discovery/source review + actual architecture where applicable; full Knip deferred |
| `packages/studio/src/features/agent/commands/agentJobs.ts` | `4578fe9b32072b90b94062e84095bc4df0b0b2ee1f14a17c83390da577a7f771` | Strict source types + scoped typed ESLint + architecture; affected tests |
| `packages/studio/src/features/agent/commands/agentTools.ts` | `57dddd23dc3b7c092718f26b3741b0b71f9f4c35e3c0b0059b5023282264a8d5` | Strict source types + scoped typed ESLint + architecture; affected tests |
| `packages/studio/src/features/agent/commands/lifecycle.ts` | `a75218c2ea221ae4b083d0513e4a4561ce61be21526aaccee98a64b18823e3d7` | Strict source types + scoped typed ESLint + architecture; affected tests |
| `packages/studio/src/features/agent/models/agentJob.ts` | `22b2ae2cc462515f786c266a809722b5082e5f75fc2ac90ccee01434f2b27c31` | Strict source types + scoped typed ESLint + architecture; affected tests |
| `packages/studio/src/features/agent/runtime/jobTools.ts` | `4b01c1d8c465ebfadf94ab69bbd3fe2410ec99e1a7464149bc147ab78ea3a62a` | Strict source types + scoped typed ESLint + architecture; affected tests |
| `packages/studio/src/features/agent/runtime/runChat.ts` | `5b4ab90e9cc8eebbc578d0da146820130bd93e1636ee257f395905c61fb1a85c` | Strict source types + scoped typed ESLint + architecture; affected tests |
| `packages/studio/src/features/agent/runtime/runOwnership.ts` | `08baf9e1c88cf177c5f636da7f4eea17f903c37f85de4985027be034cd03d881` | Strict source types + scoped typed ESLint + architecture; affected tests |
| `packages/studio/src/features/agent/runtime/skills.ts` | `7e66af0af4668d5536abcf880f924b750a6fe06c513ecdcc522ffbbe52704d35` | Strict source types + scoped typed ESLint + architecture; affected tests |
| `packages/studio/src/features/agent/runtime/tools.ts` | `62cc6314d279a4707c3ec18a7b0740400d183d085826efb023b0ec96cdc7f488` | Strict source types + scoped typed ESLint + architecture; affected tests |
| `packages/studio/src/features/agent/ui/AgentJobReport.tsx` | `1a21bc600dd45a1f8cad97fd1647e279c267e2c7861a4fb940523d4024d9a755` | Strict source types + scoped typed ESLint + architecture; affected tests |
| `packages/studio/src/features/agent/ui/AgentRunDetails.tsx` | `7cd9322caa70bf37537658417607f9a2edb4134747397bf63b50388b24967e7f` | Strict source types + scoped typed ESLint + architecture; affected tests |
| `packages/studio/src/features/agent/ui/executionActivity.css` | `972b8cb904d2641af9b3df33c1548a3912a227cd8b8a545af919793fd243e483` | Source/style review + DOM contract; pixel layout deferred |
| `packages/studio/src/features/projects/commands/lifecycle.ts` | `9417d8950cc22b8d6f9fab664c5a5f9181fd8779da4fff70d20d6792ec2b597a` | Strict source types + scoped typed ESLint + architecture; affected tests |
| `packages/studio/src/features/references/agent/webToolNames.ts` | `4906761335a9ccd4c61828b5e004f72eb219d7a6be9170bf2b97ab89ede3f9ad` | Strict source types + scoped typed ESLint + architecture; affected tests |
| `packages/studio/src/features/references/agent/webTools.ts` | `85de74460327d719c013337418b2e19ac3ef1497e796a0887222c9fd8a5381d8` | Strict source types + scoped typed ESLint + architecture; affected tests |
| `packages/studio/src/features/references/providers/tavily.ts` | `ba92bb2d13c8b2f1deedd614a198cfe6dec8b2ca7973c11b94028b503973744a` | Strict source types + scoped typed ESLint + architecture; affected tests |
| `packages/studio/src/features/settings/models/search.ts` | `e766845303f74b7086b490307a81f2f7f2f05dae5efb16d0e490f03d39cac99a` | Strict source types + scoped typed ESLint + architecture; affected tests |
| `packages/studio/src/features/video/agent/mediaCheckTools.ts` | `1ed99b7d9f1864510ec77617102b5648aadefde3c73286f9dcef7b77c880151b` | Strict source types + scoped typed ESLint + architecture; affected tests |
| `packages/studio/src/platform/storage/browserDatabase.ts` | `b8dd13d1b2ab05ce07fc6725e8e2299f69f324f6efb3316d6646b1527d182532` | Strict source types + scoped typed ESLint + architecture; affected tests |
| `packages/studio/src/platform/storage/schema.json` | `867d327e86650f8df0464bef1e63975df895b0905afc703cb10932d6a2afc35e` | Current52/hash/owner assertions + actual browser-store tests |
| `packages/studio/src/platform/storage/schema.ts` | `1d05fd45a2b717c18b01e526629820d15765d4f1e3050f4ff3751720a72a623d` | Strict source types + scoped typed ESLint + architecture; affected tests |
| `packages/studio/src/platform/storage/tableTypes.ts` | `b95097c049f4d54a042589fdecaf37e15898a20772349800969abe0490736e8c` | Strict source types + scoped typed ESLint + architecture; affected tests |
| `quality/studio-ownership.json` | `1bd77ac6db178947332b1c8958c31bb99fe10d03d56de94947f5b35e2be65309` | Discovery/source review + actual architecture where applicable; full Knip deferred |
| `quality/workspaces.json` | `f4f90047c25ea7bd000131d26e68f85e30d430dd0646abf557556ed567ec5500` | Unchanged consumed validation support; source reviewed |
| `tests/agentJobProducers.test.ts` | `c5b33c1199c00d075f8f860e101e21545dbe1a7b0d68976089bbffb79e201849` | Finite source suite execution; EOF blank-line trim only afterward |
| `tests/agentJobs.test.ts` | `9c387130ffdd1b92e6a0f732750f1fb9be8aa25794d449102dccb382f890fbb0` | Finite source suite execution |
| `tests/agentJobsUi.test.ts` | `1b83ade9f644124052ce32836033ba3c7298dc418766dd16b64e8fb22bc897b1` | Finite source suite execution |
| `tests/agentRuntimeClaimRaces.test.ts` | `da7708bb2c0600655e082fec9675f8aadf8c4bfa6d44eae17051b9e49983999d` | Finite source suite execution |
| `tests/agentRuntimeOwnership.test.ts` | `4822e8a6f83dd513e84ee79966f7fe23efc3163b6709c2c414fa21fae872c661` | Finite source suite execution |
| `tests/d05ToolCatalog.test.ts` | `457a372ac8999c6c50ff3821c91fa4145b1a01b01a15216150ff688f1a087537` | Finite source suite execution |
| `tests/fixtures/d05/catalog.json` | `e65fd7347d3f0f4f7558d0ce013a388085e026fa4c7528896391358b190a3f21` | Unchanged consumed validation support; source reviewed |
| `tests/fixtures/shared-storage/nativeAcceptanceSuites.json` | `0a60f8477d45b87a7d07f18bfca6e2e73f3eeaefa35cdf9b541b805ce77f3ce5` | Native discovery/owner-anchor assertion; execution deferred |
| `tests/fixtures/shared-storage/nativeOwnerAssertions.json` | `cac0cf829961512dccc4f73efbd3255ee3a4ab92e6a85b02fda5ffc41fadaa97` | Native discovery/owner-anchor assertion; execution deferred |
| `tests/fixtures/shared-storage/storeFactory.ts` | `4fdac0e506509323337f9acfbf4ecede7492c1e09b2f5032a9e687c1e98df88c` | Unchanged consumed validation support; source reviewed |
| `tests/helpers/d05BacklogCompatibility.ts` | `185121b8121ef36b035440106e30b21bc738c88c614539b346bd712f85b8cf50` | Unchanged consumed validation support; source reviewed |
| `tests/helpers/storeFaults.ts` | `ed3d4a07e0d657daf3e9633c37112809802db8cca5231ff59e054b0e2fa09985` | Unchanged consumed validation support; source reviewed |
| `tests/helpers/toolDispatch.ts` | `1cbda2952e5533b52a7c26c6b1f962457c1c3e86c6ad9fd460ede95c28f9b8fa` | Unchanged consumed validation support; source reviewed |
| `tests/setup.ts` | `d3698b83d9993c6b0652e1359fe7a160a2afab5d19d1c7201956354e0427e2dd` | Unchanged consumed validation support; source reviewed |
| `tests/sharedRegisteredToolArguments.test.ts` | `ebe8811952c3ecbf0b74998db4cdc0b06b97c63a6d6bd6c0fd64c6f3e055507f` | Finite source suite execution |
| `tests/storageRegistryHash.test.ts` | `6e9284443ff6d6a850b6c39131b686af7a848a5cb8ca6832ca71b4b6f6fb8ca7` | Finite source suite execution |
| `tests/toolLoading.test.ts` | `69eebf83f7077be1e88188eba402001db129cb485838350d36b696680e46ce8d` | Finite source suite execution |
| `tests/typecheck/tsconfig.studio-agent-source.json` | `277b7cc54a3eb851a815382dd7c99447ad031e7a974f55e724459104346d8787` | Strict noEmit configuration executed |
| `tests/webResearch.test.ts` | `d6efa80aa2fef782ffaa71addd388ca519ce63ed1bb03080a4dfe6b2499c1cd7` | Finite source suite execution |
| `tests/webResearchRuntime.test.ts` | `91c7c3f1b1147c2d598c9f118a691fd84e2d47103cd6777bdbf5357d24a3279b` | Finite source suite execution |
| `tooling/agent-source-exports.ts` | `9d4b1124f3e3906224010ee6c791e47a61c68fee1429618c842867e9e1414ca9` | Unchanged consumed validation support; source reviewed |
| `tooling/quality-check.mjs` | `86ed91772f986684a525102ef0d8285996a8f0b7442a2f999baa7e6bd092801c` | Discovery/source review + actual architecture where applicable; full Knip deferred |
| `tooling/snapshot-owners.ts` | `5013ca1229ba96f2c70fd4f14dc828b28bba2c815e81840d07ec54c41a608869` | Unchanged consumed validation support; source reviewed |
| `tooling/vitest.studio.ts` | `6f4e0b253fe4e8a1c03828dca2b9a2ee316e81fa6684f4a19900f0ffed319b50` | Actual config assertions + Node types; explicit source runner |
| `tsconfig.app.json` | `a53a54967a7299d3977ee11f1e6cf1f8fb6e77ba985101181554d072aa6ff8dc` | Unchanged consumed validation support; source reviewed |
| `tsconfig.node.json` | `8d2b7e79710bf5f01be27fd8941ecaf758d3746ce6bcde1be2ceb3f1c61794dc` | Node config typecheck executed |
| `vitest.config.ts` | `81539ec70c82fbe6f064be8260d8fdb007ea35842f6dd137647669f7a14ae906` | Actual config assertions + Node types; explicit source runner |
| `vitest.studio-source.config.ts` | `811046dbe1dae39f4cac0e205835c97829fe0242864dd989dc9739df5b1972cd` | Actual config assertions + Node types; explicit source runner |

## Task/lifecycle and planning changes

The following changed/new files were read and classified separately from product/config inputs. They describe the current task, earlier design evidence, implementation logs or future scope. Main may update AC checkboxes, task status, archive paths and journal references after this review without invalidating frozen product checks. They are deliberately not part of the product-source hash claim.

- `.trellis/tasks/10-15-agent-experience-desktop-evolution/roadmap.md`
- `.trellis/tasks/10-15-agent-experience-desktop-evolution/task.json`
- `.trellis/tasks/10-15-agent-jobs-results/check.jsonl`
- `.trellis/tasks/10-15-agent-jobs-results/design.md`
- `.trellis/tasks/10-15-agent-jobs-results/implement.jsonl`
- `.trellis/tasks/10-15-agent-jobs-results/implement.md`
- `.trellis/tasks/10-15-agent-jobs-results/prd.md`
- `.trellis/tasks/10-15-agent-jobs-results/research/implementation-producers.md`
- `.trellis/tasks/10-15-agent-jobs-results/research/implementation-storage.md`
- `.trellis/tasks/10-15-agent-jobs-results/research/implementation-ui.md`
- `.trellis/tasks/10-15-agent-jobs-results/research/implementation-validation.md`
- `.trellis/tasks/10-15-agent-jobs-results/research/jobs-results-design.md`
- `.trellis/tasks/10-15-agent-jobs-results/task.json`
- `.trellis/tasks/10-15-desktop-workspace-media/prd.md`

The parent roadmap/task metadata records the selected E07 foreground slice and its status. The E08 PRD change only assigns actual OS-process-stop acceptance to the future selected backend; no E08 implementation is included. Main's subsequent E08 planning note, `.trellis/tasks/10-15-desktop-workspace-media/research/native-media-boundary.md`, was authored after these checks and is explicitly excluded from the E07 product checks and stage-commit scope. The E07 research/design/implementation/check context and implementation notes are authored Markdown or existing task lifecycle artifacts, not generated runtime evidence. This `review.md` / `review-scope.md` pair is independent review evidence. No new journal file was changed when this snapshot was captured; any later main-authored journal/archive entry is likewise lifecycle documentation outside the product digest. No raw report JSON artifact was written into the task.

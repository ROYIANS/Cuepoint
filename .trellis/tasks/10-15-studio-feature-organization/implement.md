# Studio Organization Execution

## Before activation

- [ ] Follow parent `research/context-loading.md`; read required canonical specs through EOF in chunks when injection truncates or omits them.
- [ ] Confirm parent approval, accepted child-1 verification and current working tree.
- [ ] Load parent mapping and curated feature/storage/Agent specs. Enumerate actual studio paths after child 1.
- [ ] Record dependency baseline and transaction/query tests before moving sources.

## Ordered implementation

1. Define source owners, narrow feature APIs, cross-feature workflow owners, central registry and type-only model dependencies.
2. Move audio vertically, including UI/models/queries/commands/tests/product Agent adapters. Separate storage mechanisms from business orchestration while retaining explicit transaction propagation.
3. Verify audio behavior/subscriptions/atomicity and boundary rules; review the pilot pattern.
4. Apply the pattern to remaining features in reviewable slices; serialize writes to shared registry/composition modules.
5. Finish typed app composition and platform/UI ownership without introducing another store owner or synchronization path.
6. Update generated/test/quality paths with each slice; remove bridges and document actual APIs/spec anchors.

## Required verification

Every pnpm invocation uses `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm`.

- [ ] Focused feature tests retain query updates, explicit store propagation, atomic rollback, ZIP and lifecycle behavior; avoid tests that merely assert directory names.
- [ ] Existing approval/cancellation/recovery/provider/context/evidence regressions still exercise the studio implementation.
- [ ] Real-native all-suite acceptance and desktop parity/native checks use the actual adapter/probe. Record normal UI checks separately.
- [ ] Root `lint`, `quality`, `quality:self-test`, `test`, `models-dev:verify`, `build`, `landing:budget` and affected app builds pass with full discovery.
- [ ] Forbidden deep/runtime imports fail and permitted type-only models compile. Every source is mapped; schema/loop/store owner is singular and no bridge remains.
- [ ] Independent review and authored `verification.md` map FA1-FA5 to evidence and final feature/API/transaction owners for child 3.

## Completion boundary

Record an accepted checkpoint without reverting others' changes. Child 3 waits for accepted final behavior/data flow; generic Agent extraction does not begin here.

# Studio Feature Ownership

## 1. Scope / Trigger

Read when adding or moving Studio sources, exposing a feature API, changing app
composition or binding a feature to storage/runtime services. Application exports
and deployment follow [Monorepo Boundaries](./monorepo-boundaries.md). Agent core
extraction is a separate task; relocating product Agent code does not create a
second execution loop or authorize changing its behavior.

## 2. Signatures and Owners

All paths below are relative to `packages/studio/src`.

| Owner | Concrete responsibility |
| --- | --- |
| `app/` | Bootstrap, router/routes, frame, editor departure integration and named cross-feature import/export/checkpoint workflows. |
| `features/{projects,video,audio,music,library,references,memory,settings,agent}/` | Business models, commands, queries, services, UI, focused tests and the feature's product Agent adapters. |
| `platform/storage/` | ProductStore/StoreTx protocol, adapters, row/schema registration, binary and notification mechanisms. No React or product initialization. |
| `platform/product/store.ts` | One fixed ProductStore selected from the trusted startup profile, exported as `db`; `initializeProductStorage(): Promise<void>`. |
| `platform/product/queries.ts` | React observation binding: `useProductQuery<T>(query: (tx: StoreTx) => Promise<T> \| T, dependencies?, defaultResult?)` and `useProductQueryState`. |
| `platform/product/httpPolicy.ts` | Current product configuration and per-request/redirect authorization for the shared HTTP transport. |
| `platform/{runtime,http,media,data}/` | Named runtime/transport/media/data mechanisms; neutral canonical revision calculation lives in `platform/data/revision.ts`. |
| `ui/` | Neutral controls, icons and theme; no business records, fixed-store access or workflow orchestration. |

Feature entries are concrete modules, rather than an all-source barrel. For
example, `features/audio/queries/snapshot.ts` owns
`getAudioProjectSnapshot(projectId: string, store?: ProductStore): Promise<AudioProjectSnapshot>`.
The query opens one readonly transaction on the supplied store, validates the
project and reads its related rows through that transaction. Audio UI belongs
under `features/audio/ui`; audio-specific tool behavior belongs under
`features/audio/agent` even when the chat composition registers it.

The executable ownership policy is `quality/studio-ownership.json`, consumed by
`tooling/quality/studio.mjs` through the actual architecture gate. Its current
file, owner, destination, public-entry and named integration relationships must
agree with source discovery. Cross-owner checks use that ownership even when a
consumer is still at its previous path. During a reviewed migration, a pending destination
is explicit; final acceptance requires completed destinations and no old-source
bridge. The ledger does not make every source an application reachability entry.

## 3. Contracts

- A feature owns its business rules and entity definitions once. Cross-feature
  callers use documented command/query/service/adapter entries. A private helper
  becoming reachable during relocation is not justification to publish its whole
  module. Extract the required narrow contract or declare the exact reviewed
  exported symbols.
- Pure model relationships use `import type` from the actual owner. Private UI
  internals are not public merely because an import is type-only; legitimate
  non-model API types need named contracts. The central
  typed table registry may import these models. Existing historical adapter
  normalizers have individually named pure-parser exceptions; this does not
  permit storage to execute feature commands or import UI.
- App composes the product. Features may consume individually named shared app
  presentation/departure contracts where the current UI requires them. Model,
  command and query code never gains that presentation exception. Platform
  never imports app initialization or app workflows; neutral UI never imports
  feature behavior or the fixed product store.
- `platform/product` explicitly integrates the fixed product owner with neutral
  mechanisms. It is not a mutable registry or arbitrary-service container. Keep
  the same trusted profile, database identity, schema bytes and bootstrap-before-
  render behavior. Do not create a per-feature store or automatic fallback.
- Propagate an explicitly supplied ProductStore/StoreTx through every nested
  reader, validator, write, evidence record and tool result. A table descriptor
  may define transaction scope; it cannot substitute a default-store table for
  the actual transaction-bound access. Cross-feature ZIP workflows and
  aggregate-root lifecycle commands retain one root transaction and their existing late-failure rollback.
- Project, episode and chat deletion belong to their aggregate-root feature
  command owners (`features/projects/commands/lifecycle.ts`,
  `features/video/commands/episodes.ts` and `features/agent/commands/lifecycle.ts`), including the complete cascade transaction. They
  are callable by actual services/Agent adapters without a feature-to-app edge.
  App retains ZIP/import/checkpoint/sync user workflows; do not keep a forwarding
  lifecycle barrel or copy shared helpers to make the old layout appear valid.
- Pure canonical revision calculation is neutral; video target validation stays
  video-owned. Product HTTP authorization remains bound to current saved
  configuration on every request/redirect. Directory placement never relaxes
  ownership, paid-request, recovery or durable-certainty contracts.
- Co-locate focused feature tests. Keep real-store/cross-feature fixtures and
  shared test infrastructure with their integration owner. Update all actual
  source consumers, package exports, route generators, test/native discovery and
  formal evidence identities with a move. Historical aliases are resolved only
  for immutable comparator requesters. Standalone Vite fixtures need their own
  scoped module delivery seam; browser ESM virtual exports must omit pure types.
  Current product imports receive no old-path compatibility. Immutable comparator bodies remain
  unchanged.
- Relocation tools rewrite imports and specifically identified source anchors.
  They must not rewrite arbitrary strings beginning with a dot: `'.'`, `'..'`,
  filename suffixes and an input's `.wav,.mp3,audio/wav,audio/mpeg` accept value
  are application data. Compare normalized original/current emitted bodies and
  review each intentional non-import change; passing focused tests alone does
  not prove that arbitrary strings survived.
- Relative configuration is behavior too. `ui/theme.css` imports Tailwind with
  `source("..")` so scanning still covers the entire Studio `src`, including
  feature/app classes. Leaving the old `source(".")` after moving the stylesheet
  would silently scan only `ui`. Verify representative feature/print/arbitrary
  selectors in the actual built CSS; equal stylesheet body bytes do not prove
  equal build semantics at a new path.

## 4. Validation and Error Matrix

| Condition | Required outcome |
| --- | --- |
| Missing/duplicate owner or a source omitted from discovery | Architecture/coverage gate fails. |
| Completed move retains its original source or a compatibility bridge | Gate fails; remove the duplicate owner. |
| Forbidden feature deep/value import | Actual architecture gate fails; broad public flags do not replace a contract. |
| Genuine cross-feature type-only model relation | Compiles and passes the feature boundary gate. |
| Platform imports app; neutral UI imports business/store; storage imports React/product | Gate fails. |
| Feature command/query/model imports presentation | Gate fails even when a UI consumer may use that named entry. |
| Supplied transaction, late nested validation/evidence/result failure | Same transaction reaches every operation; all earlier effects roll back. |
| Native commit outcome is uncertain | Existing uncertainty is retained; no paid-request replay or invented rollback proof. |
| Source move changes schema, route, media ownership, parser or data string | Block structural acceptance until corrected or separately authorized and verified. |
| A consumed input changes during a final gate | Reject the stale result and rerun the affected gate on the final scope. |

## 5. Good, Base and Bad Cases

Good: Audio UI, models, commands, snapshot query, engine and domain tools are
discoverable together; a chat adapter calls the named Audio command with its
existing explicit transaction. Base: move a large business module intact and
update its actual callers without rewriting the algorithm. Bad: replace
`lib/db/domain` with a new omnibus `shared/core`, expose every feature source,
or open separate transactions for business data and its Agent evidence.

## 6. Tests Required

- Run forbidden runtime/deep-import and permitted type-only cases through the
  production CLI gate, including platform-to-app and storage-to-product/React.
  Include side-effect imports: an empty imported-symbol list must not make a
  private module public through vacuous `every()` checks. Test full ownership
  coverage, duplicate/old paths and completed destinations;
  a copied predicate or empty graph is insufficient.
- Trace real query subscriptions, project ownership, revision CAS and
  whole-document edits. Use supplied stores/transactions and fault-reached
  late failures so fallback to the global owner or a separately committed inner
  write cannot pass accidentally. Preserve ZIP/lifecycle atomicity and paid
  generation/approval/cancellation/recovery regressions.
- Compare original/current emitted bodies after normalizing only accepted
  import/source-anchor changes. Verify literal input/identifier policies and
  immutable snapshot/schema bytes; enumerate actual symbol-level splits.
- After moving a stylesheet/configuration, verify its resolved source roots and
  actual emitted asset closure. Include feature-only arbitrary class selectors,
  responsive/print rules and referenced assets, rather than checking just the
  presence of an import string or a successful bundler exit.
- Complete root types/formal quality/self-test/tests/model verification/build,
  site budget and affected app/native gates with full source discovery. Run the
  real native all-suite adapter acceptance after the final input freeze. Keep
  actual browser/desktop interaction evidence and unperformed host/provider/
  Save checks distinct from compilation and callback-host proof.
- Final whitespace validation must include new, untracked destinations. A plain
  `git diff --check` only checks tracked worktree changes and can omit the new
  half of a move. Stage the reviewed scope and run `git diff --cached --check`
  before declaring full-scope formatting clean or committing. Any later format
  fix still changes consumed input bytes: prove token/body equivalence and
  refresh affected hash-bound quality/native receipts on the actual final tree.

## 7. Wrong Versus Correct

```ts
// Wrong: a nested business read escapes the caller's transaction.
const project = await db.projects.get(projectId);
// Correct: the caller's actual transaction owns the read and later effects.
const project = await tx.projects.get(projectId);
```

Wrong: allow every feature-to-app edge because Audio uses a page shell. Correct:
name the required presentation entry for UI callers, and reject the same edge
from command/query/model code.

Wrong: change every dot-prefixed string while moving imports. Correct: rewrite
actual module specifiers, keep authored data literals intact and prove emitted
body equivalence with individually reviewed extractions.

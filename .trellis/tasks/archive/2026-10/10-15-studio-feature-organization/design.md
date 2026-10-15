# Studio Feature Design

## Structure

Use `packages/studio/src/{app,features,platform,ui}`. App owns bootstrap/router/frame/service composition and named cross-feature import/export/checkpoint workflows. Features own business models/services/queries/commands/UI/tests. Platform owns storage/runtime/binary/transport mechanisms; UI owns neutral primitives.

Enumerate actual paths after child 1 using the parent's source-family map. Large files can move intact when splitting them would mix behavioral work with relocation. Favor narrow feature entry points over all-source barrels or a catch-all shared folder.

Audio pilots the vertical pattern, followed by video, projects, music, library, references, memory, settings and agent. Domain-specific product tools/instructions stay associated with their features; agent owns chat composition and shared product Agent contracts.

## Dependencies and data flow

App initializes the fixed store before rendering and composes typed feature services. `platform/product/store.ts` retains the existing import-time fixed-owner construction; `platform/product/queries.ts` owns its React observation binding. `platform/storage` contains neutral protocol/adapters and never imports React, product integration or app bootstrap. This preserves default-store command signatures without adding a mutable service registry or second owner.

Product HTTP configuration/authorization belongs to `platform/product/httpPolicy.ts`, retaining fresh saved-configuration checks on every request/redirect. Pure canonical revision calculation belongs to `platform/data/revision.ts`; video-specific target validation remains video-owned. Central typed table/schema registration stays singular. Its actual historical pure-parser dependencies are named exceptions, rather than permission to invoke business orchestration.

Cross-feature consumers use documented APIs. Pure model relations use type-only imports from their named owner. Central table/schema registration stays singular with explicit model dependencies; distinguish these from runtime orchestration. Do not copy shared entities or invent a universal repository facade.

Cross-feature workflows receive explicit transaction context and preserve one root transaction through nested commands/readers, business effects, Agent evidence and final tool results. Relocation must never create a separate store or unrelated inner transaction.

Project/episode/chat deletion functions belong to their aggregate-root feature lifecycle commands, preserving the complete cascade transaction. Actual repository/Agent callers must not depend on app composition merely to delete their aggregate. App retains ZIP/import/checkpoint/sync user workflows. No lifecycle forwarding barrel or duplicated helper implementation remains.

## Preserved integration and checks

Move native/browser adapters and query subscriptions without changing selection, DB names or schemas. Agent execution/provider behavior remains in studio until child 3; do not introduce a parallel generic loop.

Co-locate focused feature tests; retain explicit integration ownership for real-store/cross-feature fixtures and immutable comparator bytes. Update route/model/asset inputs and formal-rule paths with each slice.

Boundary tests reject prohibited runtime/deep edges and allow genuine type-only model relationships; do not allowlist runtime cycles. Inventory and source discovery must agree. Complete/check audio before further moves, remove temporary bridges before acceptance and document final APIs/transaction owners for child 3.

Migration scripts rewrite actual module specifiers and explicitly identified source-consumer anchors only. The Audio pilot caught dot-prefixed application strings being rewritten as paths; those strings must be restored exactly and every affected body compared against the committed predecessor, with explicit review of genuine symbol-level splits. Focused passing tests alone do not prove relocation equivalence.

# Studio Feature Design

## Structure

Use `packages/studio/src/{app,features,platform,ui}`. App owns bootstrap/router/frame/service composition and named cross-feature lifecycle/import/export workflows. Features own business models/services/queries/commands/UI/tests. Platform owns storage/runtime/binary/transport mechanisms; UI owns neutral primitives.

Enumerate actual paths after child 1 using the parent's source-family map. Large files can move intact when splitting them would mix behavioral work with relocation. Favor narrow feature entry points over all-source barrels or a catch-all shared folder.

Audio pilots the vertical pattern, followed by video, projects, music, library, references, memory, settings and agent. Domain-specific product tools/instructions stay associated with their features; agent owns chat composition and shared product Agent contracts.

## Dependencies and data flow

App constructs the fixed store and composes typed feature services. Platform storage never imports app bootstrap. React query hooks use the configured store through the integration/feature layer; low-level storage contracts stay UI-neutral.

Cross-feature consumers use documented APIs. Pure model relations use type-only imports from their named owner. Central table/schema registration stays singular with explicit model dependencies; distinguish these from runtime orchestration. Do not copy shared entities or invent a universal repository facade.

Cross-feature workflows receive explicit transaction context and preserve one root transaction through nested commands/readers, business effects, Agent evidence and final tool results. Relocation must never create a separate store or unrelated inner transaction.

## Preserved integration and checks

Move native/browser adapters and query subscriptions without changing selection, DB names or schemas. Agent execution/provider behavior remains in studio until child 3; do not introduce a parallel generic loop.

Co-locate focused feature tests; retain explicit integration ownership for real-store/cross-feature fixtures and immutable comparator bytes. Update route/model/asset inputs and formal-rule paths with each slice.

Boundary tests reject prohibited runtime/deep edges and allow genuine type-only model relationships; do not allowlist runtime cycles. Inventory and source discovery must agree. Complete/check audio before further moves, remove temporary bridges before acceptance and document final APIs/transaction owners for child 3.

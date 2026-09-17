# Implementation Plan — 项目世界与工作室资产快照

1. Add generic media-remapped snapshot-copy helpers and source metadata.
2. Add project prop/style routes and reuse existing detail components.
3. Replace world placeholders with CRUD lists for props/styles.
4. Add studio pickers to all four world tabs and prevent accidental duplicate source copies.
5. Complete package parse/export/import and media remapping for all asset types.
6. Test copy independence, media ownership/deduplication, deletion, and package round-trip.
7. Run test, lint, build, and four-tab manual acceptance.

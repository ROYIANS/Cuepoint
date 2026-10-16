# Desktop Runtime and Delivery

## Scope

`apps/desktop` owns the normal Tauri entry, Rust runtime, native build/test/installer tooling and explicitly classified reference lanes. Browser and desktop consume one shared studio; product business behavior does not move into a native-only page tree.

## Pre-Development Checklist

- Read [native runtime](../../frontend/native-product-runtime.md), [shared storage](../../frontend/shared-product-storage.md) and [desktop distribution](../../frontend/desktop-distribution.md) through their required sections, including tails beyond injection caps.
- Read [native workspace/reference boundaries](../../frontend/native-workspace.md) when changing retained reference lanes.
- Read [granted desktop media import](../../frontend/desktop-media-import.md) before changing directory grants, decoder resources/processes or managed import adoption.
- Read [quality](../../frontend/quality-guidelines.md), [directory ownership](../../frontend/directory-structure.md) and [guides](../../guides/index.md).
- Verify actual pinned tool/probe paths and the shared schema/release input closure before building. Reuse local ignored dependencies/tools without treating them as source evidence.

## Quality Check

- Normal frontend consumes shared studio; Rust embeds the single current schema and real adapters preserve transaction/managed-file semantics.
- Desktop types/lint/unused/parity/native/release checks retain their actual scope. Root checks do not imply desktop checks passed.
- Keep packaging-only hosted delivery policy, current release identity/version, source receipts and standalone verification. A successful package is not runtime acceptance.
- Record host/manual limits honestly; do not infer real Save, installer or other-OS behavior from mocks or compilation.

# Implementation plan

Status: implementation and independent full-scope review complete; user authorized workflow 3.4 commit. User approved the final plan on 2026-09-18.

1. Load frontend specs and this task's research. Add AIHubMix client contracts and route/error helpers without altering APIMart parsing.
2. Implement public catalog/schema lookups and authenticated read-only connection test. Add fixture tests proving public listing is not key validation.
3. Implement native image/video submit, separate detail readers and guarded explicit binary retrieval. Cover state/envelope/payload/error/cancellation contracts.
4. Register provider, capabilities, display mark and connector-page copy; extend provider dispatch and shared chat policy without introducing new generation UI.
5. Add regression tests for metadata compatibility, manual/saved options, no-side-effect send rejection, provider switches, connector persistence and ZIP exclusion.
6. Update product connector doc and frontend connector spec. Smoke-test connector install/configuration and empty-key behavior without paid calls.
7. Independent full-task check per workflow 2.2; resolve findings and record verification/known limitations. Present concrete commit scope at workflow 3.4.

## Validation
Use only `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm`:
- `.../pnpm lint` (TypeScript project check)
- `.../pnpm test`
- `.../pnpm build`
- `git diff --check`

## Ownership / risk
Provider client and tests can be implemented together; orchestrator owns integration/docs if delegated. Workers must not revert parallel edits. Review must cover entire task after integration. Risk areas: base-prefix routing, public-vs-authenticated probes, classification metadata uncertainty, protected content URL validation, failed-task-vs-request distinction, connector switching during send. Leave unrelated `.tanstack/` untouched. No dependency update or database migration.

## Before activation
PRD/design/research and real JSONL manifests are ready. User approval received and task activated. Provider client/tests delegated; root owns connector integration, regression coverage and documentation.


## Completed implementation boundary
- New provider client/tests own public metadata, schema, authenticated probe and native media/result contracts.
- Catalog/domain register AIHubMix; connector dispatch/policy extend existing chat validation. Connector page distinguishes public discovery from authenticated-read success. No Agent page rewrite or new generation UI.
- Integration tests parameterize existing APIMart send/persistence cases for AIHubMix and add protocol/output classification; old generic-provider behavior is retained.
- Product docs and frontend connector spec capture protected result handling and public-directory limitations.
- Browser smoke passed for card/modal/default URL/empty key and real public catalog discovery. No credentials saved, paid call or authenticated provider call performed.


## Final checks
Independent review corrected one video test fixture to match documented native reference structures; no product-code findings remain. Final lint/typecheck passed; 22 files / 308 tests passed; production build passed (26.58s) with existing large-chunk warning. See verification.md for evidence and live-provider limits. Proposed work commit: `feat: add AIHubMix connector and media adapters`; excludes pre-existing `.tanstack/`. User authorized commit and archive on 2026-09-18.

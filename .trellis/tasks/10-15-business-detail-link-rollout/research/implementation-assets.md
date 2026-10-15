# E16 Library implementation

Status: FREEZE after focused verification. Main owns final integrated checks, registry updates and Git.

## Delivered boundary

- Public `models/assetDetailTarget.ts`: `AssetDetailTarget` and `assetDetailHref`. Four finite kinds, explicit Studio/project owner, exact entity ID. Only Library resolves `STUDIO_LIBRARY_ID`.
- Public `ui/AssetDetailPanel.tsx`: session props follow the shared type-only `detailPanelSession.ts` protocol. Incoming refusal identifies the incoming request; a frozen guarded candidate survives a competing request; same-target new request IDs preserve editor DOM. Close and source return use the existing draft guard; presented acknowledgement comes from connected ContextPanel DOM and is deduplicated by request ID.
- Private `ui/assetDetailFields.tsx`: actual extracted character/scene/prop/style labels, text controls and generation slots. Four existing routes and the embedded panel reuse these bodies and the existing commands/CAS/slot baselines. Embedded layout uses one column within the narrow pane; route layout preserves its existing responsive grid.
- Private `ui/AssetDetailContent.tsx`: real readonly selector captures kind/owner/entity identity inside its result envelope, verifies project existence for project targets and independently validates the returned record. Loading, missing and genuine read error stay local. Only the exact matching dirty/pending snapshot is retained, and every field/slot/retry entry receives unavailable while ownership/read availability is absent.
- `AssetTextField.tsx`: synchronous input departure reporting, frozen persistence callback, unavailable write guard, and owner/kind/entity/field-scoped draft keys. Typed unknown commit quarantines that current text intent before React updates. Ordinary retry is absent; background/manual flush, unmount and retained-controller resume cannot invoke its command again. Explicit discard clears that intent; a new intent may then save.
- Text and open-slot states aggregate for local close/replacement. Route flags contain only inline fields; the existing media dialog continues to own its own actual route guard and cleanup.

## Files

New source modules: `packages/studio/src/features/library/models/assetDetailTarget.ts`, `ui/AssetDetailPanel.tsx`, `ui/AssetDetailContent.tsx`, `ui/assetDetailFields.tsx`.

Existing source updates: `AssetTextField.tsx`, `CharacterDetailPage.tsx`, `SceneDetailPage.tsx`, `PropDetailPage.tsx`, `StyleDetailPage.tsx` in the same Library UI folder. No storage schema, asset command or generation-slot service changes.

New tests: `tests/e16AssetDetailPanel.test.ts`, `tests/e16AssetDetailQueries.test.ts`.

Existing test boundary adaptations: `tests/manualDraftWiring.test.ts`, `tests/b01QueryIdentity.test.ts` now traverse the actual reused fields and consume the captured query envelope. Existing callback, stale-data, foreign-owner and baseline assertions remain.

## Focused evidence

Explicit package manager: `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm`.

`exec vitest run tests/e16AssetDetailPanel.test.ts tests/e16AssetDetailQueries.test.ts`: **2 suites / 19 tests passed**. Actual React DOM, Radix confirmations, ContextPanelHost, real StoreTx reads and existing commands are exercised. Query notification delivery is deliberately controlled outside database transactions.

Panel test names:

1. reports input synchronously before an immediate close and keeps its frozen command target through a delayed save
2. protects input→immediate replacement, reports the refused incoming ID, and accepts only the frozen candidate under competition
3. keeps the exact editor DOM across width and same-target new request IDs, with guarded return in both presentations
4. preserves field CAS conflicts and merges an independent Agent edit with a known-rollback retry
5. quarantines an unknown text commit across flush and resume until only that intent is explicitly discarded
6. retains real slot session and its own route guard while aggregating local panel departure

Query test names:

- Eight parameterized actual table/owner cases: reads the exact owned table row and rejects the same ID under the other owner (`character|scene|prop|style` × `project|studio`).
- requires an actual project even when a project target spells the Studio sentinel
- retires the old observation and independently rejects an injected foreign row envelope
- keeps a genuine StoreTx read failure local and retries only the same target
- retains the same dirty input through read failure and retry with writes disabled until ownership returns
- retains only a matching missing draft as read-only and permits explicit discard

`exec vitest run tests/manualDraftWiring.test.ts tests/b01QueryIdentity.test.ts`: **2 suites / 23 tests passed** after the final AssetTextField behavior change.

Both new E16 suites fit the existing native business lane's actual StoreTx/commands pattern and may be registered by main. This worker ran the ordinary IndexedDB fixture lane only; no native suite was run.

## Limits and follow-up

- Main's integrated checker owns the final changed-source lint, Studio type check and architecture check. This report does not claim those global gates passed.
- jsdom host width changes prove stable actual editor DOM and return callback semantics; they are not a browser screenshot or native window integration claim.
- Typed unknown quarantine added here applies to AssetTextField's current text intent. GenerationSlotEditor's existing storage-error handling is preserved; this change does not expand the slot service's recovery protocol.
- Unsupported asset families and whole collection workflows remain outside this finite rollout. No generic registry, copied app-level forms, write reconciliation or automatic replay was added.

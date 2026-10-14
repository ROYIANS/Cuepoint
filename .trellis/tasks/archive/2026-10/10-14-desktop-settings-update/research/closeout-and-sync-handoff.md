# Settings closeout and synchronization handoff — 2026-10-14

## Closure decision and delivered source

The user confirmed this work can close and asked to archive the current task before preparing cross-device synchronization. This archives the settings implementation and its release delivery; it does not manufacture missing device-specific test results. This turn changes task records only. The separate `10-12-desktop-release-pipeline` task is not archived implicitly.

The settings source is merged into main. `desktop-v0.1.3` resolves to `cedb6cca482bc35fd2592197b752943e62e98ccc`. Final local verification after the 0.0.104 model refresh passed all ten gates, 4655 tests (7 skipped), 88 quality self-tests and 65 scoped release protocol/HTTP tests. A 1260-file source/configuration/documentation snapshot remained unchanged through final verification. The previous browser checkpoint covered all five settings sections at 1280×800 and 390×800 and actual Tavily autofill/draft callbacks.

On this closeout, read-only GitHub inspection found:

- [Desktop workflow run 38550667540](https://github.com/ROYIANS/Cuepoint/actions/runs/38550667540): prepare, four native target builds, collection and draft publication all completed successfully at the expected source.
- [Cuepoint 0.1.3 (test)](https://github.com/ROYIANS/Cuepoint/releases/tag/desktop-v0.1.3), Release ID 412611571: publicly published as a prerelease on 2026-10-14 at 18:57:21 Asia/Shanghai; `draft: false`, `prerelease: true`.
- Exact expected seven asset names are present: two Mac DMGs, Windows NSIS EXE, Linux AppImage and DEB, SHA256SUMS and release-manifest.json. The API reports each asset's size and SHA-256 digest; this closeout does not independently download and rehash installer bytes.
- The existing publisher ownership marker reports `status: complete`, the expected tag and source. No remote write, public-body edit, tag movement or push was performed in this closeout.

The packaging workflow proves delivery of packages, not installed application acceptance. PRD A6 (real Save), A9c (short-window popup geometry) and A10 (device-specific installation/runtime checks) have no itemized new device test record in this session. They remain explicitly unchecked follow-up checks under the user's closure decision. They are not prerequisites for starting a separately planned synchronization implementation.

## Existing synchronization decisions to carry forward

Authoritative prior decisions are in the archived [desktop storage and sync PRD](../../10-10-desktop-storage-sync/prd.md), the [checkpoint/provider child](../../10-10-storage-checkpoint-plugin-foundation/prd.md), and the [checkpoint protocol spec](../../../../../spec/frontend/checkpoint-protocol.md).

- One person switches between devices, usually sequentially; simultaneous collaboration and multiplayer permissions are outside the agreed first scope.
- Cuepoint owns its local records and managed asset/output copies. Desktop uses the shared ProductStore's SQLite/files owner; browser uses its IndexedDB adapter. Do not synchronize a live SQLite database file or reuse project ZIP copying as identity-preserving synchronization.
- Receiving devices automatically obtain project records and required bytes for offline use. A provider upload acknowledgement is distinct from a receiving device's applied/offline-ready state.
- Credentials and continuation tokens stay local. Preserve reviewed original chat/tool arguments/results and their associations as dormant history; imported history must not authorize, claim, retry or replay paid execution.
- Preserve immutable revisions, verify binary hashes/sizes before application, retain divergent offline work and distinguish local save, remote publication and device application.
- Managed-service-first onboarding was already chosen, with optional provider adapters for advanced users. Account model, quota/cost and concrete hosting are later decisions; no deployment or spending is implied here.

## Actual gap and proposed next planning boundary

`src/lib/checkpoint.ts` currently accepts only `cuepoint.protocol-fixture.v1` / schema 1 and rejects Studio production coverage. `src/lib/syncProvider.ts` implements an internal registry, immutable publication/CAS and application-owner ports. Existing tests exercise isolated fixture devices, not real-user workspace synchronization. Completed native storage coverage does not supply the missing portable production codecs.

The next implementation should be separately planned around real production checkpoints and verified device handoff:

1. Inventory current production record families and binary ownership, including Studio/shared content, complete original chat/tool history, safe settings/connector metadata, deletions and explicit local-only fields. Recount current tables; the historical 49-table inventory is evidence of that earlier revision, not an unchecked current count.
2. Define versioned portable projections and stable workspace identity, immutable ancestry and binary reference closure. Specify safe atomic staging/application and dormant incoming history on the current storage adapters.
3. Prove export from one isolated device and complete application to another, offline reopen, idempotent retry, cancellation/interruption, corrupted/missing files and stale-device divergence without overwriting local work.
4. Connect the validated application boundary to a concrete managed provider, account/credential UX, automatic transfer, progress and restore/history UI after the remaining service decisions are resolved.

This is a proposed dependency order, not a newly approved scope or activated task. No sync code, provider, account service or production deployment is created by this closeout.

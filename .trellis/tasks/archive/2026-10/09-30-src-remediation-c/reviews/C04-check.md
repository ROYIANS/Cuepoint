# C04 independent check — PASS

Reviewed the complete five-file C04 scope from original entry backups through the final sources and the actual create/compare/package consumers. Final SHA256 maps for **all five files** are in `C04-check-snapshot.json`: `before` (C04 entry; two new files are null), `beforeSelfFix` (implementation handoff), and `after` (this verdict). AudioTimeline and AudioExports remain at their handed-off hashes.

## Correction verified

Found a real stale→current failure: an export with a recognized v0/v1 fingerprint became current after package allowlisting dropped newer metadata on the current source. `C04-check-red.log` records two meaningful failures (expected stale, received current), without bootstrap/export failures.

Corrected `audioProjectPackage.ts::parseAudioPackageData` and `fingerprint.ts::preserveAudioExportFreshness`: compare against full source rows, including future take/provenance fields, **before** outgoing snapshot or incoming parse allowlisting, and preserve a recognized stale verdict with the existing v1 sticky flag. Returned package rows still follow the allowlist; unknown fingerprints remain untouched. Known metadata/signatures are compared in full without acoustic projection. Regression covers both boundaries, both v0/v1, source and nested provenance metadata, and repeated ZIP roundtrips. Also strengthened array-order assertions with two distinct actual sources/clips.

## Acceptance and checks

- True `getAudioProjectSnapshot` full takes and real `addAudioExport`/ZIPs preserve project/chapter current→current and stale→stale after two roundtrips, including separate name/revision changes, trim/gain, optional missing-job cleanup, and deleted chapter scope/title/history. Unknown/future/malformed strings stay byte-for-byte unknown; absent historical IDs do not reject import.
- Raw minimal/full v0 and strict v1 are supported. Object insertion order is canonical; source/clip/envelope array order remains meaningful. Actual source/export media bytes survive and remain retrievable.
- Independently executed absolute local pnpm focused Vitest: **4 files / 67 tests passed**. Absolute local pnpm lint/typecheck passed. `git diff --check` passed.
- Independently executed inherited static tooling: **0 added diagnostics**, package 6 / Timeline 8 / Exports 0 / helper 0. Package remap complexity/cognitive complexity remain **36/64**. Only embedded diagnostic line locations normalize; raw messages are retained.
- All **25** previous C01/C02/C03 reviewed hash records checked: **24 unchanged**; the sole authorized drift is AudioPackage, fully covered by C04.

No remaining C04 blocker. Evidence commands, exit codes, log hashes, prior reviewed hashes and final five-file SHA256 maps are recorded in the snapshot. No original-entry red run is claimed; the meaningful red used the implementation handoff before this correction. No full suite, browser, decode/playback/render, spec/ledger, commit/archive or C05 work was performed.

# Local Mac candidate: native Save and managed-file restart proof

Date: 2026-10-12. Status: passed, with the finite scope below. No commit or
remote activation occurred during this check.

The dirty-source ARM64 normal `Cuepoint.app` candidate passed version,
identifier, executable architecture, approved icon and strict ad-hoc signature
inspection. Its existing normal user profile was not opened. A separate unique
`dev.cuepoint.review.releasepipeline20261012a` SQLite review candidate used the
same root product frontend asset names and existing project/material UI. The
review title and profile intentionally isolate the task's disposable data.
Neither candidate is an eligible clean-source release installer receipt.

## Actual sequence and evidence

1. Created project `Release smoke 046ef750-fedb-4349-8b95-5266680a86d5` through
   the existing project form. Imported a task-created 630,060-byte TXT through
   the native Open panel and existing material import form. Observed version1
   and marker `CUEPOINT_RELEASE_SMOKE_046ef750-fedb-4349-8b95-5266680a86d5` in
   the material preview. Evidence: logs/local-mac-candidate/import-preview.txt
   and import-preview.png.
2. Clicked the existing Download Original action. The automation saw disabled
   Save/New Folder controls; the owner confirmed Save was clickable and saved
   `saved-original.txt` in the named task fixture directory. The regular,
   single-link output is 630,060 bytes with SHA256
   `42164eec70a5b2005759b9b8ad2e18b075bc1b86580c6dd19bf9c45055f7f86a`, equal
   to the exact import source. Evidence: native-save.json and save-complete-ui.txt.
3. Quit through the app's native keyboard action. Observed the exact archived
   candidate process absent, verified the original fixture's regular-file
   identity/hash and the preserved saved export, then removed only that
   task-created original source. Evidence: source-removal.json. The saved export
   and managed workspace files were preserved.
4. Relaunched the exact same archived review executable. Observed the project
   in the Projects page, then opened the existing material in the library and
   observed the original marker and version1 with the source absent. Evidence:
   reopen-launch.json, reopened-projects.txt and reopened-material-preview.txt/png.
5. Quit normally again and observed process absence before external SQLite
   inspection. The read-only, immutable verifier passed SQLite integrity,
   workspace owner, project/material/version identities, the committed binary
   reference and operation, zero incomplete binary intents, exact managed-file
   bytes/hash and source absence. Evidence: ui-reopen.json,
   reopened-disk-proof.json and reopened-disk-proof-final.stdout.log.

## Reached verifier defect and correction

The first disk verifier failed because it compared a raw WireText SQL row key
with a plaintext decoded payload ID. The real records were present and the
preview worked. Its synthetic fixtures had used plaintext row keys, masking
the contract mismatch. The external-only correction decodes canonical lowercase
four-hex UTF-16 units, rejects malformed keys and still requires decoded keys
to match payload IDs. Fixtures now use production encoding. The reached failure,
before-fix fixture regression, corrected 16-case Python suite and actual QA
pass are retained in logs/native-runtime-check/verifier-reached-fix. Every QA
workspace file hash remained identical through this read-only inspection.

No product store rows, file bytes, UI, native implementation or application
bundle were changed to satisfy the verifier. The earlier frozen shared suite
contains 997 inventory inputs; only its two external Python verifier inputs
changed, with their own corrected frozen check receipt. The remaining 995
inputs, all tested product/Agent code, 38 Rust inputs and 26 reviewed pipeline
inputs remain unchanged.

## Limits and later gates

This proves local ARM64 candidate project/material UI, native Save and
SQLite/managed-file persistence across normal close/reopen. It does not prove
eligible DMG delivery, Intel UI, Windows/Linux compilation or install behavior,
power-loss persistence, codecs, paid providers, microphone or printing. H1a
and H1b remain required owner-activated gates. The task stays in progress.

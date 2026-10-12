# Reached actual-product verifier correction

Date: 2026-10-12. Reviewer follow-up scope is the external verifier and its
Python contracts only. The actual application had already created/imported
through shared UI, saved through the system panel, quit, lost only its original
fixture source, reopened, and displayed the retained project and document.
Root preserved the reached pre-fix error in local-mac-candidate/
reopened-disk-proof.stderr.log and stdout.log; neither was overwritten.

## Cause and fix

The real QA `product_records.row_key` is canonical lowercase four-hex-digit
UTF-16 text from Rust `full_product_store::protocol::WireText::from_units` and
`ToSql`. The external verifier compared this SQL representation directly with
the tagged payload's decoded `id`. Its synthetic SQLite fixtures incorrectly
used plaintext primary keys, so their happy path did not establish the real
key contract.

Read-only inspection found the UI-created project, material, immutable version
and committed managed binary. The database hash was unchanged after inspection.
This was an external verifier defect, not lost product data.

`decode_stored_key` now validates the exact native lower-hex/multiple-of-four
representation and decodes UTF-16BE with surrogate preservation before existing
identity comparisons. There is no plaintext/legacy fallback or relaxed identity
check. Synthetic fixtures and mutation helpers now store the same production
encoding. Three added contracts cover literal actual-project/native Unicode
keys (including supplementary pairs, NUL, empty and lone-surrogate text),
malformed/plaintext rejection, and mismatched decoded primary keys for each of
projects/libraryMaterials/materialVersions. Existing binary, operation, scope,
intent, WAL and exact-file failure checks remain active.

The actual stored project key/decoded ID pair used in the literal regression is
fixture-only QA evidence; tests do not read the dated task or application data.

## Evidence

- Production-encoded fixtures run against the old verifier failed as expected:
  13 tests, 7 failures/1 error. The exact valid case reached the same
  `Expected one persisted UI project` error. Raw log:
  `production-key-fixtures-before-fix.log`.
- Corrected Python suite: **16 passed**, no skips on this Mac.
- In-memory Python syntax compilation: pass, no generated pycache.
- `git diff --check`: pass.
- Actual isolated QA verifier: **passed** using `mode=ro&immutable=1` and
  `PRAGMA query_only=ON`. It verified the same UI project/material/version,
  committed binary operation, no incomplete intent, original source absence
  and exact owned file:
  630060 bytes,
  SHA256 `42164eec70a5b2005759b9b8ad2e18b075bc1b86580c6dd19bf9c45055f7f86a`.
- Database and all ordinary files inside this isolated QA workspace have
  identical before/after SHA256 maps. The SQLite database remains
  `8aaade61ae85b07e31b250a1dc84279f7a439e4e312aa4397d61fa33f1e5a977`.
- Exact source hashes, commands, exits and before/after workspace proofs:
  `receipt.json`; stdout/stderr kept per command alongside it.

## Source freeze and limits

Only `scripts/verify-release-smoke-store.py` and its Python test changed.
Product/native/renderer/bundle bytes were not edited or rebuilt. Prior frozen
Rust receipts remain valid. Earlier verifier-path hashes and 13-test Python
results are superseded by this correction; root should update its final source
inventory and retain both reached failure and final actual proof. Root's local
candidate evidence and commit plan were not edited by this reviewer.

No SQL write/repair, app interaction, build, paid request, remote action or
commit occurred. This is actual read-only isolated Mac candidate evidence; it
does not establish hosted Windows/Linux/Intel packages or H1a/H1b completion.

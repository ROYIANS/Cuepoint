# Local implementation and acceptance status

Date: 2026-10-12. Branch `codex/desktop-release-pipeline`, baseline main
`92bb6d4120053453036fbdb1b3b8f23fb9c56385`. Local implementation approval is active;
The checks below were recorded before the C0 commits. The owner subsequently
confirmed the exact grouped local commit plan with “行”; work-commit checkpoints
are recorded in task.json. No push, tag, dispatch, Release mutation or public
publication occurred.

## Subsequent hosted cold-probe correction

After C0 was merged into local main, the owner supplied an actual hosted root
test failure: six native test files/92 cases failed with ENOENT for the absent
`product_store_probe`. The former local checks remain historical proof of their
recorded inputs; warm generated native output did not establish a fresh quality
job's prerequisite. Both GHCR and desktop quality workflows now prepare a fresh
pinned no-GUI probe before the full root suite. No native assertions, default
database owner or opt-in skip boundaries were removed or changed.

The new correction reproduces the same six-file/92-case missing-path failure,
then builds and checks the actual probe in a fresh target. The unchanged complete
root suite passes under Node22.21.1: 228 files/3,955 cases passed, with the same
one file/seven cases explicitly skipped. The 1,021 runtime/test/script/config
input hashes match before/after that full run. New preparation contracts pass
on Node22 and Node24; exact final receipts and independent review are recorded
in ci-probe-readiness.md, ci-probe-check.md and their logs. The former C0 source
receipts are not relabeled as matching the now-changed workflow/build helpers.

This is local cold preparation/test proof. The next actual GitHub quality run
and H1a four-host installer outcomes remain pending. No remote action or new
version tag has been performed by this correction.

## Checks executed

| Current check | Outcome | Evidence |
| --- | --- | --- |
| Root types/lint, corrected formal quality, model bank and production build | Passed | pipeline-check.md and logs/pipeline-check |
| Root browser test suite | 228 files, 3,955 tests passed; 1 file/7 tests explicitly skipped | logs/pipeline-check/test.log |
| Quality self-test | 88 passed | logs/pipeline-check/quality-self-test.log |
| Desktop types/lint/unused code | Passed | pipeline-check and native-runtime-check logs |
| Release/peer support Node suite | 46 passed | logs/pipeline-check/release-tests.log |
| External read-only Python verifier contracts | 16 passed after the reached production row-key codec correction; prior 13-case snapshot superseded | logs/native-runtime-check/verifier-reached-fix/receipt.json |
| Frozen Rust fmt and strict all-target clippy, both feature lanes | Passed | logs/native-runtime-check/final-frozen/receipt.json |
| Full product-sqlite,test-hooks Rust lane | 131 passed | final-frozen/rust-tests-product.log |
| No-GUI test-hooks Rust lane | 114 passed; overlaps product lane, not additive | final-frozen/rust-tests-hooks.log |
| Frozen shared SQLite all suite | 108 files/1,903 tests passed, plus 6 self-hosted native and 5 explicit browser checks | logs/frozen-shared-storage-all/acceptance.json |
| Current native business/Agent coverage | 95 registered tools and 49 table families; no required coverage gaps | frozen-shared-storage-all/tool-and-table-coverage.json |
| Normal local Mac ARM64 candidate app | Built, identity/version/icon/ad-hoc signature verified; normal user profile not opened | logs/local-mac-candidate/normal-bundle-integrity.json |
| Unique isolated SQLite shared-product candidate | Built and actual UI project creation, 630,060-byte document import and marker preview observed | logs/local-mac-candidate/import-preview.txt/png |
| Local native Save and observed exit/source removal/reopen | Passed: owner clicked Save; export and managed bytes match exactly; source removed only after exit; project and material marker observed after reopen; read-only SQLite proof passed | logs/local-mac-candidate/native-save.json, ui-reopen.json and reopened-disk-proof.json |

The first shared-storage run passed its 1,903 main cases and 6/5 additional
checks but correctly returned exit1 because three Rust inputs changed during
the final cleanup fix. It is retained under logs/final-shared-storage-all as a
superseded attempt, not final proof. The subsequent frozen run returns exit0
with sourceBefore=sourceAfter and zero changedInputs; 995 of its 997 input hashes still
match current source; only the two external Python verifier inputs changed for
the reached correction and have a new passing frozen receipt. Rust feature-lane hashes also match before/after. The
pipeline review's exact authored source hashes are retained separately.

Root browser batch saw only the documented Knip and external harness changes;
the actual React/business/Agent test inputs remained unchanged. Corrected
quality, affected desktop/release/harness checks passed after those edits. It is
not described as a single fully frozen all-file batch. Initial failures and
superseded counts remain recorded; overlapping/repeated cases are not summed.

The real post-reopen verifier initially failed to match the persisted project
because its synthetic fixtures used plaintext row keys. Production SQLite uses
canonical WireText (four lowercase hex digits per UTF-16 unit). The external
verifier now decodes the production key representation without a plaintext
fallback; all fixtures use that encoding and include malformed/mismatched and
Unicode regressions. The original failure remains in local-mac-candidate/
reopened-disk-proof.stderr.log. The corrected 16-case Python suite and actual
read-only QA verification pass, with every QA workspace file hash unchanged.
This correction changes only the two external Python files included in the
997-input inventory; the remaining 995 inputs, all tested product/Agent behavior,
38 Rust inputs and 26 pipeline-reviewed inputs remain unchanged. The earlier
shared suite was fully frozen during execution; it is not described as matching
all 997 current files after the narrow verifier correction.

See [local Mac candidate proof](local-mac-candidate.md) for the exact UI,
native Save, process exit and source-removal sequence. The automation-visible
disabled Save state was a system-panel observation limitation: the owner
successfully clicked Save and the resulting exact file hash was verified.

## Required later gates

H1a requires an owner-pushed clean reviewed source and actual four native hosts:
Windows API/NTFS/junction/flush/process recovery, Windows/Linux actual installer
UI/import/reopen, both independent Linux formats, Mac DMG/Intel launch, and the
actual Linux bundled-library/license inventory. H1b requires the owner-created
version tag and actual owned draft upload/verification/retry evidence.

C0 is a preliminary local source commit review. Eligible release builds reject
dirty source, so local candidate apps are not eligible installer receipts.
The task remains active until required hosted criteria have actual outcomes.
No old-data compatibility, paid provider, microphone or printing gate was added.

## Staged inventory formatting

The full staged 483-path check additionally reached whitespace emitted by the
original tool logs: trailing spaces and blank EOF lines in raw `.log` evidence
only. These outputs are preserved verbatim rather than reformatted. The full
product/config/spec/documentation scope passes `git diff --cached --check` with
only this task's research/logs directory excluded. Exact warnings and command
are recorded in logs/c0-final-source-validation.json. This formatting note does
not change any test result or waive a product-code quality failure.

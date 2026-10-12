# Independent check: exact MiMo audio boundary

Status: **PASS** for this narrow correction and its final frozen local gates.
All 11 commands completed successfully, and all 1058 recorded inputs match
before/after/current identities. Baseline
`d6a7fa68d3ee1e850b86f1cfebc84ba062022402`. Hosted quality and H1a/H1b remain
pending actual corresponding-host execution.

## Review boundary and findings

No actionable source or specification defect was found in the assigned change.
No product/test/configuration mutation was made by this reviewer. The only
product replacement is the existing binary-string-to-byte-array conversion in
`src/lib/ai/mimoSpeech.ts`. A byte-for-byte baseline replacement check confirms
that every other source byte in the module remains unchanged.

`atob` returns binary code units in the range 0–255. Iterating by numeric index
and writing each `charCodeAt(index)` into an exactly sized `Uint8Array` therefore
preserves the original iterable mapping, including NUL and high bytes. The
preallocation removes costly iterable intermediates. No Node Buffer or optional
new WebView decoder API enters shared product code; browser/Tauri use the same
standard primitives as before.

The strict syntax/length guard and padding-adjusted decoded-size calculation
remain before `atob` and allocation. The dedicated bounded speech envelope,
32 MiB raw limit, Blob-size check, MIME-empty WAV signature validation and
optimized-text preview requirement remain on the same actual path. Transport,
request bodies/auth, once-only submission, pre-abort and body-read cleanup,
error/protocol/HTTP/uncertain-state handling are unchanged. Cancellation during
the synchronous copy has the same event-loop semantics as the previous mapping;
this change adds no new cancellation or retry policy.

`tests/boundedInput.test.ts` remains exactly the baseline SHA256
`e8b8b385012157a718eebb8a46a26048f93094c1003621dd15fb58f6a3a1b761`.
Its original 32 MiB acceptance, +1/+2 decoded-size rejection before `atob`,
assertions and ordinary 5000 ms deadline remain intact. No worker, resource,
dependency, workflow, native protocol or storage contract changed.

The three new actual-provider parity tests cycle all 256 byte values through
otherwise valid WAV bodies of lengths 65535/65536/65537. These cover all modulo-3
residues and no/one/two base64 padding characters, repeated NUL/high bytes and
final-byte preservation. Each compares the complete returned Blob bytes and
MIME and asserts one fetch. The cases validate behavior rather than spying on
the chosen implementation; performance evidence comes from the separate actual
production profile and original exact-boundary test.

The `ai-connectors.md` addition accurately records this decoder contract and
preservation requirements. It makes no hosted timing or memory safety promise.

## Profile and proof review

The finite original/candidate Vite transforms preserve the actual provider,
bounded reader, MIME detector, original fixture, assertions and ordinary
deadline, while adding stage measurements. Local original success does not
erase the owner's reached hosted timeout. The receipts identify original and
candidate source hashes, unchanged inputs and successful exit codes. The
primitive 32 MiB comparison checks full-byte SHA256, and is correctly labelled
as corroboration rather than adapter acceptance.

Reported marker RSS/heap deltas are sampled observations, not continuous peak
memory or general OOM proof. The reports retain that qualification and do not
claim a specific hosted CPU/memory contention cause. Actual-provider fixture
performance supports the narrow copy optimization; subsequent GitHub/Linux
outcomes remain pending.

Root's frozen runner reuses only the prior identity/environment/command helper
function definitions, not historical executable gate bodies. It preserves the
explicit approved machine pnpm, clears owner/test-coverage overrides for ordinary
root runs, uses the real existing Rust probe and runs heavy gates sequentially.
Full native acceptance separately rebuilds/records its locked real probe.
Before/after identities and failed-command authority remain enforced.

## Verification

- Static product replacement/source boundary: pass; finite receipt in
  `logs/ci-mimo-boundary-check/static-review.json`.
- Existing implementer focused suites: 3 files / 56 tests pass, original default
  configuration and unchanged input hashes; independently inspected receipt.
- Frozen complete ordinary root Node22 and Node24: each **228 files / 3960
  tests pass**, with the existing one file / seven tests skipped. Both commands
  retain the real probe and ordinary original worker/deadline configuration.
- Complete native SQLite business/Agent gate: **108 files / 1905 tests pass**;
  all 95 registered tool coverage requirements and every missing-coverage array
  are complete/empty. The separately rebuilt actual probe and 999 native inputs
  match their current hashes. Additional actual native-binary six tests and
  explicit browser-capability five tests pass; their evidence lanes remain
  correctly distinguished.
- Root and desktop types: pass.
- Root formal quality, desktop ESLint and desktop Knip: pass. Root retains the
  existing **12 reviewed allowances and 585 review warnings**, with zero
  failures. Allowance/unused-contract/lint/Knip/quality-runner files are
  byte-identical to baseline; no suppression or new exception was introduced.
  The warning count matches the prior snapshot; this is not a zero-warning claim
  or a claim that each diagnostic's source location/complexity value is fixed.
- Quality self-test: **88 cases pass**. Model verification: **197 files / 85
  providers / 1855 models verified**. Production build: pass.

Independent reconciliation verifies all 11 command exits, exact copied native
acceptance bytes, probe/helper identities and frozen source equality. Finite
inspection is retained in `logs/ci-mimo-boundary-check/final-gate-inspection.json`.
No independent extra test or heavy-check reruns were launched; this reviewer
inspected the root-owned real runs and their source identities.
Hosted Linux quality, four-target installer H1a and actual tag/draft H1b remain
pending. No remote action, Git mutation or archival was performed by this check.

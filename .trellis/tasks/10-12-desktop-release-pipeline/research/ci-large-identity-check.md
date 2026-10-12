# Independent check: oversized native selector grouping

Date: 2026-10-12. Checker: `/root/ci_probe_readiness_check` (Trellis check).
Baseline: `db52aedb382f83bb49f24908131eeebf1eb3401d`.
Status: **PASS for the reviewed local correction and final frozen gates.**
Hosted GitHub/Linux and installer acceptance remain pending separately.

## Findings (fixed)

No production/configuration source correction was needed in this independent
review. The implementation peer added explicit encoded-byte, singleton,
deduplication and actual `[256,256,88]` grouping assertions following review
feedback before the final source freeze. The initially incorrect new epoch-test
expectation was corrected against the actual Rust behavior: group two is
attempted, but the native table guard rejects it before returning its epoch.
The failed attempt remains in the implementation evidence.

## Findings (not fixed)

No unresolved source defect or design decision was identified. Hosted Linux
latency and installer acceptance remain external evidence boundaries. The
original 30-second GitHub failure did not reproduce locally; the measured
selector replay is an actual amplification mechanism, not proof of a particular
hosted runner resource bottleneck.

`src/lib/storage/native.ts:106` has one additional review-only ESLint
`complexity` warning: `query` scores 23 against threshold 20. Its existing
cognitive-complexity warning changes from 23 to 32; the point-read warning is
unchanged at 21. Actual current-versus-HEAD `ESLint.lintText` reports zero errors
in both versions, two warnings before / three after. This judgment-based
refactoring opportunity is left unchanged: the bounded single-pass loop must
handle encoded byte/count budgets and singleton admission, while keeping the
existing epoch/overlay/global ordering paths limits behavioral scope. Extracting
a helper merely to reduce the counter supplies no demonstrated correctness
benefit for this correction. No allowance or suppression was added. Raw
diagnostics are in `logs/ci-large-identity-check/native-eslint-review.json`.

## Reviewed source and contracts

The three authored inputs were frozen at:

| Input | SHA256 |
| --- | --- |
| `src/lib/storage/native.ts` | `4532d47791ac0ad389a73ede820bb5c1cf38f695878fd308ac3ab232eb5948a6` |
| `tests/sharedNativeStorageContract.test.ts` | `7b38de5b8c532fba42a096d38e181f23540d5ede39adfbee9aab8e3858f5d642` |
| `desktop/tauri/knip.json` | `8a230e61dd2d05dfb7ca07427b493bd7cc46b9b8c88519dd3046620429558554` |

The reviewed specs also remain frozen since their independent content review:

| Spec | SHA256 |
| --- | --- |
| `.trellis/spec/frontend/shared-product-storage.md` | `cc9adb2a90840f535bee083eb44fe18bc9e5bc304181a871a0171da0e75ce607` |
| `.trellis/spec/frontend/quality-guidelines.md` | `77d8a305de636c94f541b94cbb4b8a8d116f71fa19604e91821b9103b019ac86` |

The query schedules deduplicated typed selectors using the actual UTF8 bytes
of serialized `encodeWireKey` output. Accounting starts with the two array
brackets, adds separators between keys and resets for each published group.
The maximum group remains 256 keys. A single larger key is admitted alone;
the existing request transfer carries it without a new key or metadata cap.

The scope/dependency registration before grouping and the entire query path
after grouping are byte-identical to the baseline. This retains the common
epoch across groups/pages, cursor authority, primary-row deduplication,
indexed/primary-key ordering, reverse, readonly limit and staged overlay.
Readonly top-k from each group is sufficient for the final global top-k;
read/write reads continue without pushing a premature limit. `count` is
byte-identical and retains its separate aggregate grouping.

The original complete test file can be reconstructed byte-for-byte by removing
only the new imports, two new cases and additive assertions. Every original
input, assertion and 30000ms deadline remains. Protocol, bridge, WireText,
collection/key implementation, Rust query/owner, worker configuration and both
workflows are unchanged from the baseline. The two updated spec sections agree
with these executable contracts and distinguish local proof from hosted proof.

The accepted independent Knip review remains in `ci-probe-knip-check.md`.
Its exact frozen config retains original desktop entries/projects/issues,
resolves real root CLI consumers and disables unrelated discovery only in the
new parent workspace. Actual clean/unused-export/removed-caller negative copies
prove the gate still rejects genuine unused exports.

## Verification

- Independent source ledger: 16 checks passed; 15 source/spec hashes recorded
  in `logs/ci-large-identity-check/source-review-ledger.json`.
- Actual Node22 real-probe focused receipt inspected: 71 adapter cases passed
  in 14.55s on frozen source. The new cases cover lossless compound multibyte,
  escaped and lone-surrogate identities, genuine oversized singleton transfer,
  duplicates, global order/reverse/limit/first/zero, staged deletion/index
  changes/insertion, external epoch conflict, callback-once and rollback.
- Retained meaningful negative receipt inspected: baseline adapter plus the
  additive 4 MiB assertion fails with 43,732,895 request bytes. The fixture and
  30-second deadline remain unchanged.
- Current frozen actual profile inspected: 41 query pages, 2,643,011 total
  array-phase request bytes, zero selector-upload chunks in that phase,
  252,453 maximum request envelope, 0.881s array phase / 4.232s full workload.
  These are local measurements rather than a timing promise.
- Final ordinary Node22 root suite: raw log confirms 228 passing files / 3957
  passing tests, with the existing one skipped file / seven skipped tests.
  The initial harness's 1058 inputs match before/after/current, and the final
  recheck harness explicitly verifies that exact source set before reusing
  this ordinary-root receipt.
- Complete Node24 SQLite `--suite all` recheck: raw log confirms 108 passing
  files / 1905 passing tests in 258.61s. Permanent runner receipt exits zero,
  builds the actual probe and contains no changed inputs. All six missing
  coverage arrays are empty for the 95 registered tools and native table
  business/assertion coverage. Additional genuine-probe binary lane: six
  tests passed; explicit browser-only capability lane: five tests passed.
  Receipt's 999 frozen inputs match before/after/current. Independent receipt
  inspection is in `logs/ci-large-identity-check/native-recheck-inspection.json`.
- The first complete SQLite attempt remains retained as exit one: 1904 passed
  plus the existing 32-request-segment Agent case's 20000ms timeout. Read-only
  research preserved both 32-turn segments, all 15 original assertions and
  the native 20000ms deadline; its actual 553 query requests were all `equals`,
  with zero `anyOf` entries. The new scheduling branch was absent. The unchanged
  focused contract passed, then one justified complete recheck passed with the
  original `maxWorkers:2`, `testTimeout:20000`, `hookTimeout:20000`. These facts
  support retaining the successful complete gate alongside the initial failed
  attempt; no CPU/disk cause, repeated stability or hosted result is inferred.
  See `ci-native-loop-timeout.md` and both complete native receipt directories.
- Final root/desktop type-check, desktop lint and both quality commands have
  exited zero on the final frozen source. Root quality reports 585 review
  warnings and the same 12 reviewed error allowances, with zero failures.
  Desktop Knip exits zero without hints. The additional review warning was
  inspected using the actual ESLint API as described above.
- Final quality self-test: 88 cases passed. Model snapshot verification:
  197 files / 85 providers / 1855 models verified. Production Vite build:
  passed in 21.54s. All nine final harness commands exit zero; final receipt
  exits zero and its 1058 before/after/current inputs match without changes.
  Both spec hashes still match the initial independent content review.
  Final reconciliation is in
  `logs/ci-large-identity-check/final-gate-inspection.json`; inspected root
  receipt SHA256 is
  `a45d700e1d5b991645a96b67749db4478c939fbe2ced0c025666e6645e9e9ceb`.

The checker did not duplicate the focused or broad test runs during the root's
coordinated final harness. Existing meaningful positive/negative real-probe
evidence was inspected against exact source identities. No source changes,
GUI, providers, installer builds, user data, dependency installation, Git
mutation or remote operation were performed by this check.

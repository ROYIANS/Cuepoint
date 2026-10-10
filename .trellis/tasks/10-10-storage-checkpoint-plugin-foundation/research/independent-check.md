# Independent checkpoint/provider acceptance review

Status: **PASS for the bounded partial protocol foundation** on the quality-repaired frozen source of 2026-10-10. No unresolved in-scope findings remain. This is not acceptance of a production workspace synchronization feature.

## Scope, ownership and source provenance

The sole supported format is `cuepoint.protocol-fixture.v1`, schema 1, with explicitly partial single-project/media fixture projections. These are not production table codecs. No live transport, real user data, native filesystem, SQLite binding, credential vault, UI or paid execution was used.

Loaded the complete saved hook context, curated `check.jsonl`, PRD/design/implementation plan, adversarial review plan and the Trellis check skill. Reviewed actual implementation bodies and actual test-port failure/commit paths. Root owns specs/task lifecycle/commits; the implementer repaired product/tests. This checker changed only independent research probes, configs, snapshots, logs, manifests and this report.

The final owner freeze was `quality-repaired-final-source-2026-10-10`, against base commit `8b8b709e85b390e2c4f68cc8e931487703ab9144`. Final product hashes:

| File | SHA-256 |
| --- | --- |
| `src/lib/checkpoint.ts` | `afc98bfca19cbc3994421c506f3a65e61127d58bd9489c8380348fda679e1eb9` |
| `src/lib/syncProvider.ts` | `d2b9d745a20d6aacd3f915621230125756a221a821d020a845615fb0b7d045dd` |

All six owner product/formal-test hashes match `implementation-source-manifest.json`. Thirty source/dependency/spec/task/probe/config inputs remained unchanged through independent revalidation and final owner gates. `independent-final-source-manifest.json` retains those hashes and hashes of four independent logs plus all eight owner gate logs. `independent-review-ledger.json` records complete review of the six owner files. Dependency hashes, compiler scope and gate execution do not imply whole-repository manual body review. Generated-route formatting verification remains root-owned.

Later root acceptance-criteria, status, journal or archive updates are acceptance metadata. They do not change this frozen runtime/spec proof; source hashes must still be checked if runtime/spec files change.

## Findings (fixed)

Repairs below were implemented by the product/test owner after concrete independent findings. The desired-contract probes are independent task evidence; permanent regressions were added under `tests/`.

| File / boundary | Confirmed issue | Verified repair |
| --- | --- | --- |
| `checkpoint.ts`, preparation metadata | Records/parents/coverage/workspace were read after binary awaits; changing title at the first await changed the returned revision. | Validate and snapshot all portable metadata before yielding. Original `Before` versus `After` failure now passes unchanged. |
| `checkpoint.ts`, ArrayBuffer ownership | `new Uint8Array(buffer)` retained caller ownership; changing unread tail bytes after a chunk changed prepared bytes. | Take an owned ArrayBuffer copy before yielding. Private prepared bytes remain independent. Content-sized allocation/copy cost remains explicit. |
| `checkpoint.ts`, canonical wire | Equivalent record permutations had the same revision but different wire JSON. | Canonicalize unordered parent/record/binary/coverage lists for both revision identity and JSON output using exact locale-independent ordering. |
| `checkpoint.ts`, final cancellation | One-chunk preparation could resolve after immediate cancellation. | Check cancellation after asynchronous reading and before certified result return, including record-only preparation. |
| `syncProvider.ts`, stale candidates | A preflight stale-head return skipped remote immutable candidate retention. | Stage the complete validated objects/manifest before CAS for both stale-before-call and concurrent-race candidates. Head remains unchanged on conflict. |
| `syncProvider.ts`, operation input ownership | `expectedHead` was ancestry-checked then reread after awaits; caller mutation could publish a candidate without the winner as parent. | Capture expected head, signal and progress callback once at entry and reuse the same values for checks/CAS/results. |
| `syncProvider.ts`, lifecycle after progress | Closing the transport in the final manifest progress callback still allowed CAS. | Recheck lifecycle/capabilities and cancellation after the callback immediately before CAS. Immutable staging may remain; no head update occurs. |
| `checkpointProtocolFixture.ts`, actual commit boundary | The fixture ignored signal and committed after cancellation during asynchronous before-commit staging. The original test treated this as postcommit cancellation. | Check signal after queued/staging work and immediately before synchronous records/files/ledger commit. Cancellation after the actual commit returns the committed receipt. |
| `syncProvider.ts`, runtime CAS result | A truthy nonboolean `updated` value could produce acknowledgement. | Narrow object, boolean status and valid current-head identity before reporting success/conflict; inconsistent successful head identity rejects. |

The initial coordinator findings were also inspected in the repaired bodies and meaningful regressions: incremental digest reuse replaces a second full-file synchronous hash; prepared entries/references/arrays are frozen; media titles use the correct variant guard; exact ordering replaces locale collation; immutable objects use `sha256:<digest>` rather than mutable logical IDs; only private WeakSet-certified complete preparation may publish; capabilities, media limits and closed lifecycle gate actual operations. Delivery remains bound to the requested workspace/revision, and application receipt identity/boolean outcomes are checked.

Formal quality subsequently found seven new lint errors and eighteen unallowed unused exports/types. The owner fixed unknown-array/history narrowing, redundant assertions/unions and timer error handling, removed unused singleton/conflict/map helpers, and internalized unnecessary names. No new broad allowance was introduced. The final repair diff was reviewed against the accepted contracts. All delivery callers use the narrowed Map input. Omission labels receive stricter string validation while authored titles remain preserved content. Real macrotask opportunities and cancellation remain tested.

## Findings (not fixed)

No unresolved issues remain within this child's declared protocol/fixture scope. The following required parent gates remain intentionally unimplemented here:

- All 49 durable production tables still need reviewed identity-preserving codecs, complete binary/reference closure, compatible apply owners and portable version handling. The fixture `project`/`media` variants do not establish coverage of even their similarly named production tables. Existing ZIP imports remap identities and are not used as sync apply.
- Connector secrets, opaque results/history/continuation, approval authority and imported execution claims require field-specific projections and dormant-execution contracts. Allowlisted title text and binary contents are authored content; no keyword scrubber or universal secrecy claim is made.
- Persisted native workspace identity, file/record durability, SQLite migration, backups/rollback, real-root/symlink containment and native crash recovery remain separate storage gates. Independent fixture roots/maps and retained ledgers prove logical application/restart only.
- Live provider authentication, encrypted/authenticated delivery, actual service durability, quota/retention/billing, production branch/restore/tombstone policy and user-facing offline handoff/history remain parent deliverables. SHA-256 proves integrity addressing, not authentication/encryption. A narrow trusted TypeScript port is not an arbitrary-JavaScript sandbox.

These were not fixed because they are outside the explicitly approved partial child. No fixture or green gate result is represented as proof of production synchronization, native persistence or live service behavior.

## Verification

All commands used local Node v24.11.0 and explicit `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm`; no dependency install or service termination occurred.

| Check | Result | Evidence / ownership |
| --- | --- | --- |
| Project lint (`tsc -b`) | PASS, exit 0 | Independent `independent-quality-repaired-lint.log`; matching owner log also pass |
| Extra strict application/formal-test/fixture/probe TypeScript | PASS, exit 0, no diagnostics | Independent `independent-quality-repaired-strict-types.log` and `independent-tsconfig.json` |
| Independent adversarial probes | PASS, 27/27 | `independent-quality-repaired-probes.log` |
| Affected checkpoint/provider/workspace regressions | PASS, 7 files / 127 tests | Independently run `independent-quality-repaired-regressions.log`; includes 71 protocol/provider tests |
| Full suite | PASS, 188 files / 3355 tests, 1 existing skip | Hash-matched owner `quality-repaired-final-full-tests.log` |
| Production build | PASS, exit 0 | Hash-matched owner `quality-repaired-final-build.log`; existing large-chunk advisory remains |
| Serial formal quality | PASS, exit 0 | Hash-matched owner `quality-repaired-final-quality.log`: 13 reviewed allowances, 554 visible review warnings, zero unallowed lint/unused failures, 444 graph files / 1802 static value edges / 6 literal dynamic edges, zero static cycles/architecture failures |
| Quality CLI self-tests | PASS, 88 cases | Hash-matched owner `quality-repaired-final-quality-self-test.log`; expected negative-case exits are intentional assertions |
| Model snapshot verification | PASS | Hash-matched owner `quality-repaired-final-model-bank.log`: 197 files, 85 providers, 1855 models; revision `ebe586289d55936b738e4dc822dbdd745196b4f3` |

`quality-repaired-final-gates.json` records the eight owner commands, elapsed times, exact log paths and all exit codes 0. Reuse is based on matching frozen source, unchanged scoped inputs, actual log inspection and final manifest verification. Nonblocking review/build warnings are retained; PASS does not mean zero warnings.

## Preserved failure history

Failures were not overwritten by later green runs:

- `independent-probes-provisional.log` and `independent-probes-provisional-2.log`: original metadata, ArrayBuffer, canonical-wire and final-cancellation failures.
- `provisional-source/`, `independent-probes-frozen-draft-source.ts.snapshot`, `independent-probes-frozen-draft.log` and corresponding before/after manifests: the same initial four probes failed against fixed retained draft aliases, with matching execution hashes.
- `first-freeze-source/`, `independent-first-freeze-before.json`, `independent-first-freeze-after.json`, `independent-first-freeze-probes.log`: initial owner freeze produced 23 passes / 3 failures; fixed source/probe hashes matched before/after.
- `independent-first-freeze-cas-shape.log`: supplemental nonboolean CAS failure against retained first-freeze product aliases.
- `second-freeze-source/`, `independent-second-freeze-source-manifest.json`, `independent-final-*` logs/manifests and original `final-quality.log`: behavior/type/full-suite/build passed, but formal quality failed; this attempt was not accepted.
- Final accepted results use `independent-quality-repaired-*` and `quality-repaired-final-*` names, with final source manifest/ledger. All prior attempts remain distinct.

# E07 gate sidecar completed review

**Completed sidecar, with two confirmed blocking producer findings. This is not final E07 acceptance.** The specifically authorized external-evidence inventory fix is complete and all62 persistent CLI self-tests pass. Anonymous callback identity and unexplained Knip exit handling remain unchanged because those producer fixes were outside the authorization.

## Confirmed findings

1. **P2 — anonymous sibling callbacks inherit a reviewed debt identity** (`scripts/quality/identity.mjs:23`). `ownerName` identifies a direct anonymous callback by callee tokens alone. Moving `throw value` from `invoke("first", callback)` to `invoke("second", callback)` inside the same named function retains `FunctionDeclaration:flow/Callback:[["Identifier","invoke"]]`, diagnostic node `Identifier:value`, and signature `3c6b4ff23d849618154dee67c253e8eb865cfde7e3b8dcdb2f6d9caf5405c123`. The production CLI exits0, although the moved violation should require review and fail. Adding a second identical throw does correctly fail multiplicity; repairing the throw correctly leaves stale debt. Required follow-up: distinguish semantic sibling call ownership and reject ambiguous anchors, preserving formatting/line relocation. Exact evidence: `E07-gate-sidecar/{10-anonymous-first-unallowed,11-anonymous-first-reviewed,12-anonymous-sibling-transfer-should-fail}` and `early-findings.json`. Current main debt includes callback owners, so this is relevant to the installed mechanism rather than only a hypothetical unused feature.

2. **P2 — a configured Knip hint error is masked** (`scripts/quality/unused.mjs:44`). Actual installed Knip6.40.0 with `treatConfigHintsAsErrors:true` and a nonexistent `ignoreDependencies` entry emits `{"issues":[]}` and exits1 in full mode. The wrapper permits exit1, normalizes no findings and exits0. Production mode exited0 in this fixture. This does not affect the current default root hint setting, but it violates nonzero tool authority under a supported root policy. Actual invalid Knip JSON still exits2 and an unresolved module still fails normally. Required follow-up: distinguish accounted-for reportable findings from unexplained/config-hint exits; do not indiscriminately reject every Knip exit1, because individually reviewed genuine findings legitimately require allowance interpretation. Evidence: `26-actual-knip-config-hint-error-should-fail` and `knip-exit-finding.json`.

3. **P2 — external contract evidence was absent from before/after input closure; fixed** (`scripts/quality-check.mjs`). Original CLI reads and checks an external retention document, but the document is absent from normal inventory roots. Instrumenting only the actual external file read proves a change immediately after validation is accepted by the original producer (exit0). The authorized fix collects exact relative evidence files named in `quality/unused-contracts.json`, checks relative path safety, deduplicates paths and includes them in both inventories. No blanket `.trellis` scan. After the same boundary mutation, the CLI exits1 with `inputs-changed-during-run`; restoring bytes passes. Evidence: `33-original-producer-external-read-race-should-fail`, `31-external-change-after-validation-rejected`, `32-external-closure-race-repair-pass`, and `inventory-fix.diff`. The original producer was reconstructed byte-for-byte from the preserved56-case producer sources; tool implementations and reports were not replaced.

## Strict throws and current rule policy

The installed primary `only-throw-error` implementation defaults `allowThrowingAny`, `allowThrowingUnknown`, and `allowRethrowing` to true. The current root explicitly sets any/unknown to false, rethrow to true, and allows only package-origin `Redirect` from `@tanstack/router-core`. That current policy is intentional and independently exercised: raw unknown, raw any and newly inferred any throws fail with the actual throw rule; direct observable catch/rethrow and Promise catch/rethrow pass; an unrelated catch-like object and a local namesake Redirect fail; actual TanStack redirect passes. A reviewed exact unknown-throw debt passes, while moving it into another named owner fails. The original56 case called `unknown-throw-fails` actually throws `{value}`; it did not prove raw unknown enforcement.

Only ERROR diagnostics are eligible for exact rule/file/signature/count/reason/owner debt. Counts must equal the reviewed multiplicity, so increases, decreases, repairs and stale rows fail. Duplicate allowance keys and duplicate JSON properties are rejected, including a new nested duplicate-property case. Warnings remain individually visible review signals and cannot be baselined. Current observation:12 manually explained debt entries, identity producer unchanged;7 current unused contracts, all evidence hashes matching. Main's report02 correctly rejected three stale E06 Playwright allowances; main subsequently shrank those10 entries to7. This observation is not a new root acceptance run by this sidecar.

## Architecture, unused scope and source coverage

The full producer was read in full. Actual resolver/AST checks exclude type-only static imports and reexports, preserve mixed value clauses, enforce domain→DB/UI and DB→UI boundaries, and keep literal dynamic loading separate from eager static SCCs. Independent additions verify `typeof import(...)` is type-only, a dynamic boundary fails without being called an eager cycle, a shadowed local require is excluded, and malformed source fails. The original56 proof covers static SCC/repair, all-type named/star forms, mixed reexports, actual unused file/export repair, test-only consumption, evidence/count/schema/stale failures and warning behavior.

Observed current `src` inventory is444 files, including421 TS/TSX and two declaration files. The original completed report checks420 lint files: all421 TS/TSX except the generated route tree. Architecture owns419 non-declaration TS/TSX, including generated routes. Generated ModelIconMapping is included in lint. The earlier449 estimate is not the current observed scope. This sidecar does not independently accept all source-worker changes or claim runtime reachability for computed imports/requires. Unused source/contracts retain exact finding keys and source hashes; current canonical audio evidence is `.trellis/spec/frontend/audio-music.md`, now included by exact reference rather than a task/archive scan.

## Validation and producer evolution

All ten original producer hashes match the completed worker manifest at entry. Independently verified every original56 case's actual command/report exit, input text hashes and complete producer source/hash closure. All56 expected results match; preserved original reports remain unchanged.

After the authorized changes, ran the actual persistent self-test with the explicit machine Node v24.11.0:

```sh
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/node scripts/quality/self-test.mjs --output .trellis/tasks/10-09-src-remediation-e/reviews/E07-gate-sidecar/self-test-after-inventory
```

**PASS,62 cases.** The original56 semantic cases are retained, with four strict-throw/caught-rethrow cases and two external-evidence inventory/hash cases added. Every command/report exit, input/source hash and producer hash verified; producer remained unchanged across all62 cases. The additional33 sidecar executions separately preserve newly discovered failing counterexamples, the original inventory failure and corrected fixture controls. A green62-case suite does not close the two newly discovered residual producer gaps.

Only these two product files changed:

| Producer | Original completed-worker SHA256 | After authorized sidecar fix SHA256 |
| --- | --- | --- |
| `scripts/quality-check.mjs` | `7b114c41f6424d77542d1e787f4a9869fd5a41d52ff0101e85286c8987330bbb` | `dfff1ce20c7b190d55e073e5eee2351a6a7319bb7835e2983b9f8bc0b5bbf296` |
| `scripts/quality/self-test.mjs` | `0711cb2297288506a69de546582d1099311e7082be2a21cd8cd44d449518ca4b` | `a10e398d99a4213c05cf99983bf1a55054d4c52f9d2e87b7976736ded61e4760` |

The other eight hashes remain exact, including identity `3143cfd59f8ab94cdea49665de5fd3cd2654331e62471ed35bea88c586ac4ec9` and unused `a6c1f28aec18f3dc4e17b13aa6e7b7e82a4ad8202edaa5eb3277ae86fcdce195`. Full original→after maps and source copies are in `producer-evolution.json`, `quality-check-before-inventory-fix.mjs`, `self-test-before-inventory-fix.mjs`, and the machine check report. Exact reviewed root policy SHA256: `d2851b0e467e5aa8957e974d0c7d227575212fad12cca8fa51f111415363807d`.

## Limits and retained failures

Only authorized producer changes and owned review outputs were written. Root configurations, debt/contracts, source workers, specs, task/status/ledger and Git remain outside sidecar writes. No package installation, application full tests, model verification, build, browser, CI or Node22 clean-install work ran. Main's concurrent root integration requires a final frozen rerun after these producer changes and resolution/disposition of the two residual blockers.

One initial owned runner import used six parent directories rather than five; `ERR_MODULE_NOT_FOUND` is retained in `setup-failure-01.json`. The first bare catch/rethrow fixture correctly emitted no throw-rule error but failed `no-useless-catch`; the observable catch handler passes in case22 and the persistent suite. Messaging the native ancestor through the app tool is unavailable; early findings were recorded in owned artifacts and commentary. These limits do not weaken the preserved actual CLI failures.

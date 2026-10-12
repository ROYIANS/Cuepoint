# E07 gate sidecar independent follow-up

**Completed independent follow-up: two residual semantic-owner blockers prevent producer PASS.** No product edits were made. All writes are in this new follow-up directory; the original sidecar report and failing evidence remain preserved. This is not final E07 acceptance.

## Repaired behavior verified

Independent actual production-CLI cases confirm that the original direct anonymous sibling transfer now fails. Different call labels and callback argument roles produce different signatures, formatting/line relocation retains the reviewed signature, and indistinguishable direct siblings emit `signature:null` with `unanchorable-diagnostic`. A `new Promise` callback supports reviewed identity and formatting stability; two indistinguishable sibling Promise callbacks are unanchorable.

The Knip fix also passes independent proof. Both configuration-hint failures with no issues and failures mixed with an actual unused file exit2, preserving raw Knip exit1/stdout in `toolEvidence`. Commands contain the supported `--max-issues 9007199254740991`. Ordinary Knip findings now enumerate with tool exit0 and are still rejected by the wrapper's owned exact-finding comparison. A real individually reviewed retained-file contract passes. This verifies that the max-issues option does not silently allow unused findings.

## Residual findings

1. **P2 — parenthesized sibling callback transfer still passes** (`scripts/quality/identity.mjs`, anonymous owner context). With `invoke("first", (() => { throw value; }))` and a safe sibling `invoke("second", (() => { console.log(value); }))`, immediate parent is `ParenthesizedExpression`, so ownerName falls back to callback-body tokens. Moving the exact reviewed throw body into the second parenthesized callback retains signature `b095680c0b76fae632ef5f54973f2b86c1a0a207910eab5ea18a69083444978c`; the actual CLI exits0 instead of1. Resolve transparent expression wrappers to the actual call argument and retain precise call context/ambiguity handling. Evidence: cases19–21 and `early-residual-findings.json`.

2. **P2 — direct call and constructor call share a callback owner** (`scripts/quality/identity.mjs`, CallExpression/NewExpression owner). A TypeScript-declared dual callable/constructable value is legal: `{ (label: string, cb: () => void): void; new(label: string, cb: () => void): object }`. Changing its reviewed `invoke("first", callback)` to `new invoke("first", callback)` retains signature `1a93cf6dae549874717a28dd25358aca06c2113efa0f725c2dd6d55bc6d0c897`; the actual CLI exits0. The two invocation forms can have different runtime behavior. Include CallExpression versus NewExpression in the stable context key. Evidence: cases17–18 and `early-residual-findings.json`.

These are independent cases beyond the69 persistent cases, not failures in the original direct-sibling repair. Both belong to the semantic identity contract and require renewed failure/repair proof before PASS.

## Actual validation and debt provenance

Ran21 bounded production-CLI cases with machine Node v24.11.0;19 behaved as required and two residuals incorrectly passed. Each case retains input text/hash, complete report, exact command/stdout/stderr/exit. No full self-test rerun duplicated main's work.

Main's `research/e07-gate-blocker-fix/self-test-01/summary.json` is PASS with69 cases. Independently verified every expected command/report exit, recorded report digest, input digest, producer source digest, complete producer map and equality with actual current producer bytes. Producer remains stable at this follow-up's final hash check. Receipt: `main-self-test-69-independent-receipt.json`.

Independently recomputed all12 manually reviewed debt identities against current source with the actual identity producer. Exact rule/file/nodeKind/nodeTokens/count/reason/review-owner match the prior individually reviewed rows; only semantic-owner producer changes update the affected signatures. The prior root report is stale for concurrent `debouncedDraft.ts` changes, so its whole-file hashes cannot be adopted as current source proof. This qualification is explicit in `independent-reviewed-debt-verification.json`.

Also ran actual root-configured ESLint over the eight debt source files only, with before/after hashes stable. Every one of the12 reviewed diagnostics actually emitted with its refreshed signature and exact count; no reviewed entry mismatch occurred. The check additionally observed one unallowed `react-hooks/exhaustive-deps` diagnostic at current `src/lib/debouncedDraft.ts:263`, signature `7ade399a29cd6d6450d718b4a2287564c6c8e4c1bed020038f5d14f88e5bc8ed`. This is concurrent source integration, outside producer ownership; it is recorded separately, not added as debt. Evidence: `current-eight-file-debt-eslint.json`. A historical root PASS is not current acceptance after that source changed.

## Exact producer signatures at completion

| File | SHA256 |
| --- | --- |
| `scripts/quality-check.mjs` | `dfff1ce20c7b190d55e073e5eee2351a6a7319bb7835e2983b9f8bc0b5bbf296` |
| `scripts/quality/identity.mjs` | `cf67cd0cda47bbe95545fd351e4395f85caf6a73232af36e0f6c4316ce1a8885` |
| `scripts/quality/unused.mjs` | `38d171f8e57d2bf8e57522d0434b0d984f5ecb0e7c23a9ff0626d3e1a735beb0` |
| `scripts/quality/self-test.mjs` | `c2f7ffbd7a9303e62bc44b20c93a87d7a75e3336e5728978f4f8051503290ef8` |

The full ten-file map, entry→completion comparison and root policy/debt/config hashes are in `report.json` and `producer-freeze-after-check.json`. No file in the producer map changed during this independent follow-up. Identity/debt producer both use TypeScript5.9.3.

## Limits

No product edits, installation, full application tests, model verification, build, browser, CI, Node22 clean-install, task/spec/status/ledger or Git action. Current main source integration remains concurrent. The69-case receipt establishes that suite's actual frozen execution; it does not cover the two new owner-transfer counterexamples. This follow-up cannot issue PASS until those failures are resolved and final producer/debt signatures are independently checked again.

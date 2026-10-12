# Final owner-context revision independent check

**Completed bounded independent check: prior reported context transfers are repaired; one named function-expression callback transfer still blocks producer PASS.** No product edits. Prior completed sidecar/follow-up/control-flow reports remain byte-identical. All outputs are new in this directory. This is not final E07 acceptance.

## Confirmed residual

**P2 — named function-expression callbacks bypass invocation context** (`scripts/quality/identity.mjs`, early `FunctionExpression:name` return). Two callbacks both named `callback` are legal separate function-expression binding scopes. A reviewed throw in `invoke("first", function callback() { throw value; })` can move into sibling `invoke("second", function callback() { throw value; })` and reuse the same allowance.

Actual production CLI evidence: original throw fails unallowed, exact reviewed original passes, then the transferred throw incorrectly exits0 instead of1. The diagnostic retains `FunctionDeclaration:flow/FunctionExpression:callback`, Identifier `value`, multiplicity1, and signature `30fc19947543e3bbb3931e808ddd0ecbc6f5b7781016c57f83305d6a3f0cc3d1`.

The early named-expression return bypasses containingArgument, invocation kind/optional bit/flavor, other arguments, and callback ambiguity detection. Preserve the local function-expression self-binding name while also deriving the actual invocation argument context; apply indistinguishable context rejection equally. Evidence: cases27–29 and `early-named-callback-finding.json`. This proves enforcement failure; no claim a current production debt node has moved.

## Independently repaired and extended cases

29 bounded actual CLI cases verify:

- Parenthesized callback transfer fails; transparent parentheses, as/type assertions, non-null and satisfies all preserve the reviewed throw's correct argument identity.
- Direct call→new transfer fails. Optional-call and async/flavor changes receive different signatures and fail reviewed transfer.
- Guard a→b and then→else changes fail; formatting/line relocation preserves identity.
- Indistinguishable repeated guard headers yield signature:null with unanchorable failure.
- Switch case, try-body→finally, and while-guard transfers fail.

Three deliberately transparent assertion fixtures were initially labeled expected0 but actually exit1 because the strict root correctly reports `no-unnecessary-type-assertion`. Their reviewed throw signature still matches; the only unallowed errors are the separate assertions. These are fixture expectation qualifications, not producer regressions. Inputs/reports remain untouched; `transparent-wrapper-fixture-qualification.json` preserves the exact interpretation. All other tested mechanisms behave as expected except the concrete named-expression transfer.

## Main self-test receipt and exact debt check

Main's `research/e07-gate-owner-context-fix/self-test-02` is PASS with80 cases. Independently verified each expected command/report exit, recorded report digest, full input digest, producer source digest, complete producer map and actual current producer equality. Producer unchanged throughout main80. No duplicate full self-test run. Receipt: `main-self-test-80-independent-receipt.json`.

Main's first owner-context run FAIL remains preserved. Its old multiplicity fixture added a new `If` owner, so it correctly no longer represented an identical violation under the same semantic owner. The retained failed assertion, producer stability and corrected actual same-owner repetition are qualified in report.json. The80-case run verifies strict exact multiplicity after that fixture correction.

All13 reviewed debt nodes were independently recomputed from current source against the prior reviewed root report04 and debt-before. Exact source hashes, rule/file, nodeKind/nodeTokens, multiplicity/count, reason and review owner all remain equal; only deliberate semantic-owner anchoring updates signatures. No new diagnostics were automatically accepted. Evidence: `independent-thirteen-debt-evolution.json`.

Actual root-configured ESLint over the eight reviewed source files emits exactly13 errors; every one matches its reviewed signature/count, with no extra unallowed diagnostic. Before/after inputs stable and identity/debt producer exact. Evidence: `current-thirteen-debt-eslint.json`.

## Exact completion signatures

| File | SHA256 |
| --- | --- |
| `scripts/quality/identity.mjs` | `bbd37c5dfed34b12b7fea232ad6faa663e9421b6e862cece776d9fa037fd77f4` |
| `scripts/quality/self-test.mjs` | `de4cecef0fa38061ca15a60be668d4773656b3b3d2e65567e57fc55b3222bfb5` |
| `scripts/quality/unused.mjs` | `38d171f8e57d2bf8e57522d0434b0d984f5ecb0e7c23a9ff0626d3e1a735beb0` |
| `scripts/quality-check.mjs` | `dfff1ce20c7b190d55e073e5eee2351a6a7319bb7835e2983b9f8bc0b5bbf296` |

All ten gate producer files, root policy and13-debt/unused-contract inputs stayed unchanged from entry through completion. Full map: `producer-final-hashes.json`. TypeScript5.9.3, machine Node24.11.0.

## Limits

No product/source/config/debt edits, installation, full application tests, model/build/browser/CI/Node22 clean-install, task/spec/status/ledger/Git action. This is bounded mechanism and exact reviewed-node evidence, not exhaustive JavaScript control-flow proof or final E07 acceptance. Named function-expression invocation context requires a concrete correction and independent failure/repair proof before producer PASS.

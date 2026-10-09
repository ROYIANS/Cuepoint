# E07 diagnostic identity proof — preparation only

Activate after E06 acceptance and actual fresh chosen-rule diagnostics. This contract does not approve a debt entry or introduce a gate implementation.

A temporary per-file rule/message/count multiset is insufficient: replacing one unsafe expression with another at the same count may pass. Any required narrow debt allowance must identify actual rule, file, structural owner and the diagnostic node's normalized semantic tokens (or another demonstrably equivalent semantic identity), plus count/reason/owner. Exact line/column is location evidence, not identity. Never assign all emitted warnings to allowances automatically. Read existing source and contract before proposing an intentional exception. Legitimate framework/library contracts may instead have precise supported rule configuration that is independently tested against an unrelated violation.

A conservative identity can include named enclosing ownership plus tokenized diagnostic node with trivia excluded. It must distinguish copying the same expression into a different function or another file. Repeated identical nodes within the same owner require explicit multiplicity. Meaningful node changes require renewed interpretation; don't fall back to message-only allowance when token identity changes. Report impossible/ambiguous anchors explicitly rather than authorizing arbitrary neighboring code. Source schema/version and producer identity must be frozen so changes to identity algorithm cannot silently bless old entries.

Required synthetic proof for the final actual command/producer:

1. Baseline line relocation and format-only whitespace change leave the same reviewed violation identity (if any accepted debt exists).
2. Same rule/message in a different named owner fails, even if total file diagnostic count stays the same.
3. Another identical unsafe node added in the same owner fails the allowed multiplicity.
4. Mutating a semantic argument/member/expression fails rather than inheriting allowance from a nearby line.
5. Repair removes the violation, and its remaining allowance fails as stale until explicitly removed; shrunk baseline then passes.
6. Invalid/missing reason or owner, duplicate allowance keys, wrong rule/path, and unused allowance fail deterministically.
7. A real unrelated unallowed ESLint and selected SonarJS violation fails; repaired versions pass.
8. Architecture permits type-only import/export forms and rejects a real static value cycle and enforced boundary; repaired versions pass. Literal dynamic loading attribution remains separate.
9. Verified-unused assertion fails on an actual new unreferenced owned file/export and passes after removal/legitimate consumer; production-only absence cannot suppress meaningful full/test reachability.

Do not use mutation snapshots whose dependencies or TS context differ from the final root. An isolated complete source/config/dependency mirror or temporary bounded fixture with the same parser/project/rules and exact input provenance can establish synthetic behavior. Never leave intentional failing files under active product or test roots. Preserve mutation inputs, command stdout/exit, before/after hashes and failed attempts. Gate self-tests are meaningful behavioral tests of a persistent enforcement mechanism; they must exercise the public local command or its exact production entry, not a duplicate toy implementation.

Metric/clone/control-flow style signals need manual responsibility review and explicitly chosen enforcement policy. Reporting these signals is distinct from blanket disabling meaningful typed/Hooks rules and distinct from accepting hundreds of warnings as debt. The final policy must state what fails the gate, what remains review-only, and why, with concrete coverage and future regression proof.

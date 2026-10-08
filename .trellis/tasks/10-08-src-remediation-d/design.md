# Design and constraints

The existing parent design and original remediation-plan are the source requirements. Structural changes must retain atomic cross-table commands, immutable evidence/history, permissions and scope, callback/session identity, legacy imports, resource budgets and paid-request recovery. Extract actual shared behavior into small meaningful leaves, avoiding registries, new global services, dynamic-import cycle workarounds or bulk directory moves.

D01 starts from the current C state, not the original eight-node SCC: separate generation target DB reads, transaction-external snapshot/input preparation, task edit guard and pure tool selection. The authoritative proposal is parent research/D01-cycle-break-plan.md; current minimum is three remaining edge cuts. Keep public compatibility exports when actual callers need them, with all DB callers directed to the leaf owners. Preserve transaction boundaries; preparation hashing/flush/transport stays outside writes.

D02–D08 receive scoped current-source plans before writing each unit. Product writers are sequential; main owns specs/task/ledger and integration, implement owns product changes, checker independently reviews and self-fixes confirmed gaps. Later research may run in parallel only with disjoint task-artifact ownership.

Each unit captures source before/after hashes and latest file attribution. Full acceptance covers all final product files, including overlapping later changes. C archival requires current references to use archive/2026-10/09-30-src-remediation-c; historical evidence content remains unchanged.

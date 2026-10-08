# Final D commit grouping policy

Preparation only. No concrete grouping or commit approval is claimed while D05–D08/final acceptance are incomplete.

Per-unit final hash attribution is not a commit dependency plan. A file touched by D01, D02 and D05 has one final body; blindly committing it in the latest-unit group can leave earlier commits importing new owners or protocol leaves that do not exist yet. The concrete plan must use the final accepted source graph and real type/value dependencies.

Before generating `commit-groups.json`:

1. Inventory every dirty source/test/script/native runner path against whole-D final acceptance, with null hashes for deletion. Keep original source baseline distinct from actual pre-commit HEAD bookkeeping.
2. Form a small number of coherent changes by actual final responsibility (persistence/agent protocol and real consumers, feature session/UI/package/draft ownership, capability/transport boundaries where their dependency edges permit). These are candidate domains, not preapproved groups. Shared leaves and new consumers must land together or in dependency order.
3. Review new imports, removed files/exports, actual test mock module identities and transitive type dependencies at each boundary. Existing unchanged APIs may remain dependencies from the base; a new API used by an earlier commit cannot be postponed to a later commit. Merge groups when a cycle or inseparable coupling prevents a valid intermediate tree; do not split merely to match unit IDs.
4. Assign each file once, including native/compiler runners and their fixtures and relevant contract documents. All final source/test/script hashes must match reviewed artifacts; helper/evidence/task/parent ledger changes belong in a final record commit unless directly required to run a native verification entry point.
5. Keep the original baseline source/tests out of evidence groups' implementation accounting. Archived prior evidence and hashes stay immutable. Unrecognized dirty paths are explicitly excluded and displayed for the human, never silently staged.
6. Render exact messages/file lists/counts and final base revision after full gates and independent PASS. Request one human approval under workflow 3.4. Execute only the agreed plan, no amend/push. Archive and journal are later separate workflow commits.

The renderer cannot invent this grouping: it validates explicit coordinator-provided disjoint files, complete final product coverage, final review hashes and evidence. Whole-batch tests establish final behavior, while the dependency-order check establishes reviewable logical commit boundaries.

Concrete grouping separates application source/tests/scripts (explicit feature batches) from task-native/historical evidence runners (the final displayed record batch). Those reviewed `.mjs` paths remain in whole-D product/hash acceptance, but belong with their original snapshots/reports, not an application commit without their historical inputs. Renderer may auto-assign ONLY reviewed task-local research/review `.mjs` to that final exact record list; application files cannot be silently omitted. Intermediate compiler proof checks source and permanent test imports; CSS/assets use actual existence rather than TypeScript module resolution.

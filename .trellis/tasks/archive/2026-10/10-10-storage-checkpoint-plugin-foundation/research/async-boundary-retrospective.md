# Bug Analysis: mutable asynchronous publication and commit boundaries

## 1. Root Cause Category

- **E — Implicit assumption:** TypeScript `readonly` was treated as runtime ownership. Callers can retain aliases and mutate metadata, buffers or options after an asynchronous operation begins.
- **B — Cross-layer contract:** entering an application method was conflated with beginning its actual atomic commit. A staging callback may still await before records, files and the ledger change together.
- **D — Test coverage gap:** ordinary happy paths and even complete regression suites did not exercise caller mutation, callback-driven closure or cancellation at the actual commit boundary. Independent executable probes did.

The evidence is behavioral: the retained first-freeze source produced 23 passing and three failing independent probes. The failures changed expected-head ancestry during upload, closed the transport from progress before CAS, and canceled the fixture during pre-commit staging. Earlier fixed-draft probes separately demonstrated metadata/buffer drift, noncanonical wire order and final preparation cancellation. These are reproduced mechanisms; no retrospective numerical prior is invented.

## 2. Why Fixes Failed

The first repair isolated portable metadata and bytes but did not expand the ownership audit to publication options. The base validated before upload could therefore differ from the base passed to CAS. The lifecycle guard was before a caller progress callback, so the callback could invalidate that guard. The fixture's cancellation test used method entry rather than the synchronous state/ledger change as its boundary.

## 3. Prevention Mechanisms

| Priority | Mechanism | Specific action | Status |
| --- | --- | --- | --- |
| P0 | Runtime ownership | Capture operation metadata, expected head, signal and callback once before yielding; use that same base for validation and CAS | Done; independently accepted in independent-check.md |
| P0 | Commit guard | Gate lifecycle after callbacks and directly before CAS/application; the application owner checks cancellation after staging and before its real commit | Done; independently accepted in independent-check.md |
| P0 | Adversarial regression | Retain mutation, closure and before/after-commit probes; add permanent regression cases in the owned test suite | Done; 27 independent probes and 71 permanent cases passed |
| P1 | Executable contract | Update the domain-specific checkpoint specification and independent review plan | Done |
| P1 | Provenance | Preserve defective source snapshots and failed logs; freeze repaired sources before rerunning acceptance gates | Done; final source hashes and eight successful gates reviewed |

## 4. Systematic Expansion

- Apply the same ownership audit to preparation, publication, delivery, listing and future native staging. A readonly type, copied outer object or early permission check alone does not establish a stable asynchronous operation.
- Treat caller callbacks as possible state changes. After a callback, previously read lifecycle/cancellation state may be stale.
- Keep the application's atomic commit in its owner. A late abort must not hide a completed commit, while a pre-commit abort must not be called a completed write.
- Do not expand this fixture into a claim about native SQLite crash recovery, arbitrary plugin isolation or live service guarantees.

## 5. Knowledge Capture

- [x] Updated `.trellis/spec/frontend/checkpoint-protocol.md` with operation-input snapshots, callback-aware commit guards and the real application commit boundary.
- [x] Updated the child's independent review plan and preserved pre-repair provenance.
- [x] Final corrected-source evidence and permanent regressions accepted by the independent checker.
- [ ] Include the specification and this analysis in the approved work-commit batch before archive/journal bookkeeping.

This application repository has no `src/templates/markdown/spec/` template tree. No unrelated Trellis distribution templates are created or changed. Commit/archive remain subject to the existing project workflow; the analysis does not bypass that gate.

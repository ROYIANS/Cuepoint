# Bound project read recovery

The reported UI shows an assigned project while repeated audio reads return the generic instruction to open a project conversation. Source inspection confirms that missing binding and wrong explicit project ID share this error. Browser access is unavailable, so the exact original arguments are not yet verified.

Boundary: improve the existing audio/music tool scope contract, not chat binding or authority. Read tools may omit projectId and resolve it from the durable run/thread binding. Explicit mismatches must still reject with the current bound project ID and actionable correction guidance. Missing binding, forged execution context, deleted projects and foreign writes remain rejected. Return projectId in read results for subsequent writes. Use the same scope resolver before audio/music edits and paid generation; preserve frozen arguments and approvals.

Files: projectScope.ts for authoritative resolution; audioTools.ts/musicTools.ts for optional scoped reads; audioGenerationTools.ts for shared diagnostic guard; skills.ts for corrected model guidance; focused tests and frontend spec for the behavior contract. No UI redesign, data migration, automatic project rebinding, silent foreign target replacement or live paid requests.

Validation: bound optional/explicit reads, wrong-ID recovery followed by valid reads and writes, unbound/forged/deleted rejection, generation rejection before network, existing approval/revision suites, typecheck and full tests.

## Results

- Added 10 regression cases. Focused suites: 2 files / 31 tests passed.
- Final full suite: 113 files / 1296 tests passed.
- Final typecheck and production build passed; existing large-chunk warnings remain.
- `git diff --check` passed.
- Regression tests exposed music generation preview reading a draft before scope validation; scope is now checked first, before draft access.
- No live paid requests. Browser tooling returned `Codex auth token is unavailable`; original screenshot arguments and live conversation retry could not be inspected. The generic diagnostic defect and wrong-ID recovery are verified in repository/tool tests, not a claim to have reproduced the original user's calls.
- Changes remain uncommitted for review.

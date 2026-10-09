# E01 SS06 static fix supplement — 2026-10-09

**Result: SS06_STATIC_FIX_PASS.** This supplement is separate from the immutable prior SS06 review and producer proof; it does not accept integrated E01.

The two requested label calculations now use local labels and straightforward branches. Gallery creation preserves submitting > available > upcoming priority and all existing Chinese text. Episode status preserves add / reorder / delete labels and the existing pending-only rendering. The actual newly introduced gallery archive pending label also uses local branching, retaining pending > archived > archive priority.

Raw baseline diagnostics reveal why three expressions were corrected: gallery creation's nested expression already existed at baseline line 325; current line 275 archive pending label is new. Main's count-only multiset paired the baseline warning with archive's earlier warning and attributed the remaining warning to creation line 413. We repaired both rather than relying on equal warning counts to hide replacement. No rule suppression, configuration change or metric abstraction was added.

Canonical scoped typed ESLint on the two modified production owners, using the unchanged main tool versions/config, removes all three pre-fix nested-expression warnings and introduces zero diagnostics. Gallery cyclomatic complexity is 27 at canonical baseline and 31 both before and after label correction. Unchanged cognitive complexity and actual branch inventory were inspected. The four added points are the rename error conditional render, rename pending caption, delete error conditional render and delete pending caption. Each serves E01's action/error ownership. Async write logic stays in local handlers, with captured inputs, ref locks and caught errors; repository responsibility remains unchanged. This is bounded responsibility acceptance of E01 changes, not approval of pre-existing complexity debt or formal QG01 acceptance. No unnecessary helper was extracted to lower the count.

Independent current native runner: 20 PASS, zero page errors; focused repository suite: 9 files / 120 PASS; typecheck PASS. The native rerun initially failed after three cases because two identical audio/music failure toasts were still mounted. The runner now records existing toast nodes before releasing the next rejected command and waits for a newly mounted matching error toast; all existing form/DB/duplicate/dismissal assertions and the 10000ms timeout remain. Failed log, screenshot, HTML and call trace are preserved. No product behavior was changed for this observation issue.

Scoped static helper failures are preserved too: the initial AST parser API used unsupported parse instead of parseForESLint; a later assertion still expected two removals after the third concrete expression was corrected. Both were corrected in isolated evidence, preserving attempt source/logs. The final scoped proof requires three removals, zero remaining nested warnings and zero added diagnostics.

The original E01-SS06-check.md/json, review snapshots/artifacts and producer evidence all remain byte-identical (33 files verified). Exact correction snapshots/hashes, commands, logs, and main inputs are in the companion JSON.

Main's accepted candidate hashes cover gallery 80e370f5fcc969c7ee517911be2afff5ac6dcbaa10f76fac169f8a0b64b2d765 and the original runner. The extra archive-label correction and strengthened native toast observation postdate that freeze. Their final hashes are recorded here; those main results cannot be relabeled as final for these bytes. Integrated review must refresh relevant static/graph/freeze and affected proof. No status/ledger/spec/package/CI or commits were changed.

- `src/components/studio/ProjectGalleryPage.tsx`: before `945f07573b7535eee1326c0ff08e50627ccf2152e32069540c14311add186034` → after `c23024ec2c6eabb2b0e85da04c3108015026eadf5b35ff0e988b8db1eb641a3b`.

- `src/components/workspace/EpisodeListPage.tsx`: before `a881f4c4f1f2e375a03135ae2df50379358d2b1404e184b3b3afc0a22d907ed9` → after `601fe123c44ca98ff66e4ab00c22fc825b55f3101ef181ab1681ccf1ac3dde51`.

- `scripts/e01-writes-browser-regression.mjs`: before `5133e571fa553b7b5c09e5499d253d68a56f5295addaf67f70dc35c9be30b0d2` → after `14f937c95d7bdc64f5c4806a220c73275f5879b385bad972c7f2a39de8af3bcf`.

A second native attempt passed 18 cases before a task-evidence HTML write triggered Vite reload and destroyed the bridge. That failure log is retained. Explicit HMR disabling and task/scripts/other-fixture watch exclusions isolate the runner; each case now also requires exactly the one initial main-document request. Attempt 3 passes 20 cases with zero page errors. The final runner change is test isolation and stronger observation, not a product fix.

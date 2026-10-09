# E01 independent integrated review

**PASS — AU02 / PU10 / SS06 on the exact 17-path frozen root.** No unresolved review blockers. Main may use this acceptance for its spec/ledger workflow. E01/task status was not changed by this reviewer; no commit/push/agent dispatch.

The initial producer candidate passed its existing tests but independent native probes reproduced three acceptance defects: a promotion MemoryEditor route discard left the parent confirmation stuck; local voice/record close followed by POP used overlapping confirmations; current-thread deletion dismissed its pending owner and its old completion navigated away from a newer thread. Scoped corrective changes and real repository/browser proof are recorded separately from the immutable producer reports.

## Corrective responsibility

- Shared guard now freezes the initiating local request synchronously, reuses the parent arbiter for child local actions, and resets a later POP before completing the original local action. Local discard does not remount unrelated editors. Optional route-state delegation leaves the existing MemoryEditor route blocker responsible for the promotion candidate while preserving parent local ownership and wrapup draft protection.
- Agent deletion acquires a captured-target lock only after deliberate draft departure; its confirmation stays pending, rejects duplicate/dismiss/newtopic actions, and mounted/current-thread checks prevent old completion navigation into a new thread. Inspector/voice mounted checks suppress retired state/error callbacks; promotion preparation publishes immediate ref ownership.
- Gallery/Episode label corrections and writes-runner new-toast/HMR isolation remain in the distinct immutable SS06 static supplement. Final unnecessary `candidate` dependency was mechanically removed after promotion phase ref became the state reader source. No suppression, timeout weakening, production CAS change or copied production fixture logic.
- The CAS probe failure selected a different requirement record for its concurrent update. Final proof selects “Saved record”, verifies identical third-argument ID, and checks original expectedRevision on both conflicts/retries. A subsequent ID assertion parameter mistake is preserved as attempt8; it was corrected to the repository signature, without changing product CAS or weakening the intended assertion.

## Exact current verification

| Evidence | Current result |
|---|---|
| Main audited frozen five-gate run | 5/5 exit0; 711 root inputs PRE=POST and still current |
| Typecheck | PASS on final freeze |
| Full tests | 160 files / 2556 tests PASS |
| Native drafts / writes / B01 compatibility | 19 / 20 / 19 PASS |
| Independent integrated supplement | 7 critical cases PASS / 0 page errors; held-delete newtopic addendum PASS |
| Earlier immutable independent SS06 | 20 native + 11 supplement; focused9/120 and type PASS, coverage reused |
| Earlier integrated focused proof | 9 files / 121 tests PASS; final full suite confirms freeze |
| Current same-version typed static (9 TS) | before3 errors/34 warnings → current2/33; 0 new non-complexity |
| Current source AST | 419 TS / 2498 edges / 0 parse errors / 0 static value cycles |

Main current gates are `reviews/E01-current-accepted-candidate/`; producing `tools/run-root-gates.py` was read in full and hashed. Its actual argv/exit/logs/pre/post are audited in the snapshot. Earlier `E01-corrections-gates` changed TaskWrapup mid-run and is explicitly excluded from current acceptance. Historical full160/2554 also remains historical.

## Responsibility and metric limits

Gallery cyclomatic is exactly **27 → 31**, not the earlier uncertain30. The four additions are same-owner rename/delete inline errors and pending captions. The mechanical label removals retain31 and do not add a cognitive diagnostic. This responsibility stays with the existing Gallery mutation UI; no artificial helper split was used. AgentChatInner is **100 → 101 cyclomatic / 57 → 58 cognitive**; its one outer increase is the delete pending caption. Nested callback lock/current-thread decisions protect that existing deletion responsibility. These values remain debt and are accepted only as E01 behavioral responsibility, not formal QG01 debt approval.

Typed static tools use the restored same-version stack (ESLint9.39.5, TS-eslint8.71.1, hooks7.1.1, Sonar3.0.7, isolated TS5.9.2); production typecheck uses project TS5.9.3. Diagnostic multiset relocation can misattribute equal messages, so full-body/source review remains essential. Source AST is a syntactic signal with the limits below.

## Full per-file coverage

### `scripts/e01-drafts-browser-regression.mjs`

- Whole transport transformer/server/runner/observer/failure capture and all19 cases reviewed. Only actual exported DB/reference commands are renamed/wrapped; hold/reject precedes real repository command, success calls original production implementation.
- Real ReactDOM, TanStack browser history, Radix UI and native IndexedDB; offline MiMo transport returns WAV but production durable prepare/submit/reference/media paths execute. Unique Vite cache, permanent HTML entry, strict5197, disabled HMR/evidence watches and single-document/pageerror assertions prevent reload false positives.
- Producer and independent entry19/current19 logs reviewed. Failure HTML/PNG/observations retained. Actual hidden sidebar callbacks are DOM-dispatched and explicitly limited; native accessible keyboard/pointer actions cover visible modal actions.

### `scripts/e01-writes-browser-regression.mjs`

- Full runner and pre-transform inspected, including all 20 assertions and failure artifacts
- Explicit exported repository declaration checks; pre-wrapper calls real original command on successful writes/retries; deliberate rejection is before original command
- No production component transforms or copied persistence implementations
- Actual Radix/TanStack/React/Dexie execution observed with fresh Vite cache and fixture optimize entry; cleanup in finally
- Native call arguments, immediate duplicate counts, pending dismissal, retained failures, success DB/navigation, undo and stale owners asserted
- Review supplement waits for original command settlement plus two animation frames so stale-handler assertions cross UI continuation
- Latest matching-new-toast DOM identity check, HMR/watch isolation and single main-document assertion reviewed; prior strict duplicate-toast/reload failures retained, no timeout or assertion weakened. Final current native20 passes.

### `src/components/agent/AgentChatPage.tsx`

- Whole body, actual persistent /_studio/agent layout and threadId pathname, tasks/home/sidebar/inspector callers reviewed; same pathname/search is distinct from actual thread pathname departure.
- Registered stable inspector departure ref is consulted by openThread, board, new topic and current-thread deletion; callbacks remain behind real modal inertness.
- Delete captures target; lock acquired synchronously on authorized submission; owning modal reopened after draft discard; Action prevents default; pending cancel/Escape/backdrop and duplicate delete rejected; new-topic callback refuses while lock held.
- Current-thread ref and mounted check suppress old navigation after held real cascade delete; original owner DB command is allowed to finish. Native before failures independently reproduced missing pending modal and stale /agent navigation; corrected held delete, duplicate, newtopic attempt and Task B preservation proved.

### `src/components/agent/TaskInspector.tsx`

- Whole wrapper/content, goal/criteria/plan dialogs, tabs and task lifecycle/result controls reviewed. Previous task/thread/project/open state survives external owner replacement; keyed session changes only after resolved departure.
- Own baseline equality combines record/wrapup synchronous refs; optional delegated route state keeps MemoryEditor route ownership. Stable child/parent callbacks do not introduce effect loops.
- Goal/plan native clean opening/revert, keyboard close, held duplicate submit, pending departure, reject/input retention, success and original expectedRevision retry verified. Plan duplicate titles consume matches once and retain distinct IDs/order.
- Local dialog requests use parent arbiter plus local discard without replacing unrelated child editors. Retired mutate success/error/publish gated by mounted content; actual command parameters retain old task scope.

### `src/components/agent/TaskRecords.tsx`

- Whole body including record query, call/evidence picker, source/Todo fields, history, mutation and all dialog actions reviewed.
- Opening baseline and frozen record/task/thread/project/input match repository CAS; sync change/pending reader publishes before batching. Failed save and two real CAS conflicts retain exact input and original expectedRevision.
- Parent local arbiter fixes local cancel plus POP overlap; standalone local guard remains supported. Native Escape/close/backdrop/caret/scroll, owner switch, route, clean/revert and retired completion tested.

### `src/components/agent/TaskWrapup.tsx`

- Whole body including evidence/source selectors, manual/generate/save/confirm/lifecycle actions, current/historical promotion, failure queries and retained editor reviewed against actual wrapup/memory repositories.
- Draft captures revision/content/sources/owner; JSON baseline includes source IDs. Synchronous lock/draft ref and mounted epoch suppress stale publish. Existing confirmed evidence and task source/CAS checks remain.
- Memory candidate retains existing promotion epoch/key/frozen source and project. Preparation phase publishes immediately; parent local ownership remains conservative while editing; route state delegates candidate to existing MemoryEditor blocker, keeping distinct actual wrapup dirty/pending.
- Real promotion candidate was generated/confirmed via DB commands, edited, locally cancelled/continued and route cancelled/discarded with one MemoryEditor prompt; title/body/source remained and discard created no memory. Original B02 source/CAS/epoch tests and promotion lifetime tests retained.

### `src/components/audio/VoiceLibrary.tsx`

- Whole wrapper/library/editor body plus actual AudioWorkspacePage, SpeechControls, VoiceReferencePicker, MimoConnection and durable generation/defaults callers reviewed.
- Project/editor baseline covers name/mode/preset/instruction/clone reference/sample text; synchronous draft/reference/persistence locks feed parent state before replacement. Real route owner is AudioWorkspace project pathname/key.
- Library local requests reuse parent arbiter; close/back plus POP uses one initiating confirmation. Choice continuation is mounted-gated to avoid closing/error publication into another owner.
- Native clean/revert, real keyboard/pointer dismissal, project replacement, reference validation/import, audition transport, durable retained media, pending/failure/retry and captured speaker revision/project verified. No media cleanup or paid provider call added.

### `src/components/studio/AssetLibraryPages.tsx`

- Full body; four actual studio routes, kinds, keys and STUDIO_LIBRARY_ID reviewed
- All four add/delete repository command owners and correct destination routes retained
- Synchronous create/delete mutual exclusion; frozen delete object, pending dismiss guards and preventDefault verified
- All four create rows persisted in real native IndexedDB with projectId studio; each deletion retains unrelated new row
- All four immediate duplicate/failure/retry/dismiss cases executed by original runner
- Old library create success and delete rejection suppress navigation/state/error in new owner

### `src/components/studio/ProjectGalleryPage.tsx`

- Full body and actual /projects route reviewed
- Create video/audio/music: synchronous lock, captured arguments, pending close/cancel/Escape/backdrop, retained failed fields, success navigation only while mounted
- Rename/delete: frozen target/value, ref lock before await, Radix Action default prevented, pending cancellation rejected, inline caught failure, retry and success-only clear
- Existing IP binding catch verified against before snapshot; new ref lock/captured target and pending selection retention verified
- Archive/restore: captured project and boolean; page lock, toast and original-command retry verified
- Backup flush → export → download → catch block byte-for-byte unchanged; focused debounce barrier tests passed
- Old gallery create success and rename rejection cannot overwrite newer form/navigation/error
- Latest create/archive/pending label branches fully reread; three nested ternary removals are behavior-equivalent. Baseline27/final31 responsibility attributed to inline rename/delete error and pending captions; backup unchanged.

### `src/components/workspace/EpisodeListPage.tsx`

- Full body and actual ProjectHomePage series/film/audio/music dispatch reviewed
- Keyed project owner initializes queries and editing scope; null-vs-loading query preserved
- Shared synchronous add/reorder/delete lock and captured project/order/delete id
- Rejected reorder retains DB order; successful reorder and actual UndoProvider restore original full order
- Delete keeps target/modal on rejection; success deletes native shot cascade; actual undo restores original episode identity/content/order and shot IDs
- SeriesLoglineEditor complete body byte-for-byte unchanged; original debounce scope and updateSeriesLogline CAS retained
- Old owner delete success preserves new modal; reorder success suppresses new-owner undo; add failure suppresses new-owner toast
- Latest add/delete/move pending label branch reread; unchanged priority and captions.

### `src/lib/useManualDraftGuard.tsx`

- Whole shared guard and route-only compatibility wrapper reviewed, including all current call sites in settings/story/shots/generation slots and native B01 proof.
- Optional routeDirty/routePending delegates nested MemoryEditor without removing local protection. Local request ref freezes initiating action before batching; subsequent POP is reset on local discard; failure keeps request/error retryable.
- Synchronous readState refuses captured stale discard while pending. Continue restores connected focus/scroll and selection only when numeric supported; number/range/date/color/checkbox cannot call unsupported setSelectionRange.
- Actual browser overlaps and shared unsupported-selection case plus four deterministic actual-production-callback tests are complementary; mock host is not native DOM proof.

### `tests/b02MemoryPromotion.test.ts`

- Whole deterministic hook host and every actual TaskWrapup/MemoryEditor session case reviewed. The only producer change is compatible useCallback mock; source coherence, epoch retirement, duplicate lock, saved/unmounted callbacks, explicit latest-revision reconciliation and effect replay assertions remain.
- Full current suite and focused nine-file suite execute these existing source/CAS contracts; fake IndexedDB/hook-host results are explicitly separated from native route proof.

### `tests/e01ManualDraftDeparture.test.ts`

- Whole actual callback host and all four assertions reviewed: synchronous reader/search behavior, stale pending discard refusal, retryable failed discard, route delegation while local protected, initiating request freeze and later POP reset.
- Two reviewer cases add behavioral coverage; original assertions retained. Focused 9 files/121 tests, final full160/2556 tests pass.

### `tests/fixtures/e01-drafts/harness.tsx`

- Whole fixture reviewed: imports real AgentChatPage, Inspector, VoiceLibrary and shared guard; real repositories seed projects/tasks/record/speaker/wrapup/source; browser history and live queries execute actual components.
- Control functions mutate only fixture owner state/navigation or hold gates; no copied production dirty/save/departure logic. MiMo fetch fixture intercepts only offline test domain. Standalone owner switch/retire probes differ from actual Agent pathname integration and are reported separately.

### `tests/fixtures/e01-drafts/index.html`

- Whole permanent HTML entry reviewed: root + module harness only, explicit optimizer entry, no app behavior stub.

### `tests/fixtures/e01-writes/harness.tsx`

- Full fixture inspected: imports actual 3 production owners/all4 libraries, real browser history, Radix via production primitives, Sonner, UndoProvider, native Dexie
- Gates/failed-command registry/call records run only at named repository wrappers; successful calls execute production transaction owner
- Real project/library/episode/shot/IP seed commands; same-path project parameter owner switching executes actual keyed EpisodeList
- Destination renderers intentionally stubbed; no claim of full product shell or target detail page execution

### `tests/fixtures/e01-writes/index.html`

- Entire one-line document inspected; actual fixture module entry is explicit; no mock production behavior

## Provenance and evidence

The JSON snapshot includes canonical before, Git before, entry snapshot, review-entry, final hashes and complete per-file writer → static fix → independent correction attribution. All17 root paths match the audited main pre/post and source freeze. Root-source before snapshots and producer scope union were independently verified, including absent new files.

Producer originals are untouched: draft preserved84/84, draft declared82/82, draft static evidence10/10, writes evidence12/12, SS06 originals/preservation33/33 and SS06 static own evidence33/33 all match. Reports and task-native/analysis tools are hashed. Every captured native failure directory is copied into isolated final-review evidence, retaining original HTML/PNG/observations/logs; the immutable original raw records were not replaced.

Exact commands/environment/counts, producing-tool audit, read-only caller hashes, current gate hashes and evidence hashes are in `E01-check-snapshot.json`; detailed verification is `e01-final/provenance.json`. The final JSON self hash is deliberately external to avoid a circular manifest.

## Limits

- Local headless Chromium/native IndexedDB/React/Radix/TanStack; no WebKit/mobile/real assistive-reader/OS beforeunload presentation or paid providers claim.
- Actual Agent sidebar is inert behind modal. Thread switch/newtopic/delete initiation DOM-dispatch invokes real rendered callbacks defensively; it is not proof that background pointer/keyboard is accessible. Visible dismissal, discard and input actions use native keyboard/pointer.
- SS06 destination pages are fixture placeholders; write-owning components/repositories execute production behavior. Studio navigation target strings and persisted correct-kind/project rows checked.
- MemoryEditor itself was not edited. Candidate preparation/epoch/source/CAS and inherited clean baseline retention remain. Parent conservatively owns open candidate for local departure, while candidate own existing blocker owns its route edit. Native ordinary edited-candidate path proves one prompt; deterministic B02 proves epoch/CAS. No unrelated B02 UI redesign or expanded exhaustive UX acceptance.
- Selection restoration skips unsupported input types; native number/range/date/color and record/source checkbox paths support source-level generic checkbox safety, not an OS/browser matrix.
- Temporary diagnostic multiset cannot establish stable semantic debt identity (it mislocated a Gallery nested ternary by count matching); whole-body/manual responsibility review supplemented it. Existing errors/warnings and complexity remain. E01 acceptance is not formal QG01 debt approval or full E completion.
- AST is syntactic literal import/reexport analysis; computed dynamic imports unresolved, one-node self-loop not reported by SCC, no runtime reachability or formal architecture certification.
- Historical original/full/nonfrozen checkpoints are preserved but not substituted for final current 711-input pre/post gate. Intermediate failing probes include locator/parameter-target mistakes; only final unweakened successful runs are accepted. Historical scripts for every failed intermediate attempt were not all snapshotted; retained logs and original HTML/PNG/observations are honest evidence.
- Full current suite reused from audited main frozen gate, not independently rerun twice. Independent critical native execution and exact gate/root/tool hash audit establish review confidence.

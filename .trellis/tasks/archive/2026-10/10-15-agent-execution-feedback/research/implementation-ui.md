# E03 UI implementation evidence

## Scope and owner corrections

The UI extends the existing execution session, flow callbacks, composer controls and public output owners. No new normal bubble caption, progress area, dependency, persisted state or live output overlay was added. The owner explicitly rejected normal sending/saved captions and the model-confirmation hint. `AgentChatPage` now returns no model warning while compatibility discovery is pending (unless incompatibility is already known), and preparation stays quiet even after admission rather than falling back to a generic execution label. Real completed compatibility errors still use `chatModelIssue`.

## Behavior

- `useChatExecutionSession` owns one feedback controller and gives each acquired execution token its own invocation. Explicit Stop records stopping before abort, acknowledges once through a synchronous ref, disables repeated Stop and retains the original controller/send lock until the flow's existing final release. Release still rejects old tokens. Mounted guards and reusable controller cleanup preserve effect replay and suppress late state writes after unmount.
- New submission, durable regeneration and explicit resume pass the optional invocation observer through the existing flow/runtime calls. E02's exact admission, failed/uncertain attempts, new drafts and explicit recovery remain authoritative. Accepted in-flight admission still enters the existing aborted runtime cleanup; the UI never rewrites terminal rows or releases thread ownership itself.
- Preparing and advancing public output remain quiet. Actual model request invocation can use the existing composer strip's waiting text; explicit Stop uses the same strip and existing stop button labels. Tools and approval keep their existing presentation.
- `ExecutionFeedback.tsx` contains only React and a runtime type import, preserving the eager plain submission and lazy rich transcript dependency boundary. Public answer and open reasoning bodies report transient source text to the bounded controller only after an actual eligible DOM subtree exists. Run/message identity, current confirmed output signatures and saved baseline exclude foreign or old resume output. Hidden, folded, inert, opacity-zero and hidden-document ancestors cannot manufacture display.
- Retained current invocation identity allows a store query to publish eligible DOM after execution release. Attribute/child mutations and document visibility can reveal retained chat without new output. Once `publicCommitted` returns true, the probe disconnects and remembers completion by invocation; subsequent streaming text updates do not walk styles or install observers again.

## Necessary checks

All commands use `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm`.

- Focused integration: `exec vitest run tests/b07ComposeSessions.test.ts tests/e02SubmissionPresentation.test.ts tests/e03ExecutionPresentation.test.ts tests/agentMessagePresentation.test.ts` — **4 suites / 63 tests passed**. B07 adds pending compatibility without a caption, retained real compatibility failure, Stop during held compatibility/begin/final flush, same-tick duplicate exclusion, actual request-vs-receipt feedback and effect replay/stale token protection.
- After the final boolean sampling completion API and probe optimization, `exec vitest run tests/e03ExecutionPresentation.test.ts tests/b07ComposeSessions.test.ts` — **2 suites / 48 tests passed**. This includes the assertion that subsequent text does not call `getComputedStyle` after successful first display. The final local observer declaration cleanup reran the **3 DOM tests**, all passed.
- `exec tsc -p tsconfig.app.json --noEmit --pretty false` — **passed** after the integrated UI/controller changes.
- ESLint on the eleven changed production UI files — **0 errors / 34 visible review warnings** (complexity, cognitive complexity, nested ternaries and depth). The new probe file's final standalone lint is clean. Integration tests are outside this ESLint configuration, not covered by that production lint claim.
- `git diff --check` — **passed** before final probe declaration cleanup; root will repeat on the final frozen change set.

## Limits and handoff

The B07 host runs actual page/hooks/callbacks with mocked provider/UI leaves. The DOM tests run ReactDOM in jsdom with explicit geometry because jsdom has no layout engine; hidden/inert/disclosure and rendered text remain actual DOM assertions. These establish callback/DOM commit eligibility, not compositor paint, real provider latency or packaged native acceptance. Runtime protocol/transaction settlement evidence belongs to the runtime worker. Broad suites, builds and packaging remain deferred under the owner's batch cadence. No paid requests, install or commit was run by this worker.

Product files and focused UI tests are frozen for independent review.

# E04 reading navigation implementation

## Owned changes

- `packages/studio/src/features/agent/ui/MessageList.tsx`: explicit required `threadId: string | undefined`, authoritative following/manual-navigation refs, one local paused transition boolean and one native `返回最新` button. Only new user identity or explicit topic entry resets following; same canonical user identity does not. Resize remains instant and respects the ref. The initial bounded animation-frame callback now checks current following intent so a same-frame manual pause survives.
- `packages/studio/src/features/agent/ui/ChatWorkspace.tsx`: supplies active topic identity, falling back to its scoped E02 attempt's reserved thread ID during handoff; existing workspace/execution/composer keys and lazy transcript boundary remain intact.
- `packages/studio/src/features/agent/ui/turnNavigation.css`: theme-based native control within the existing navigation shell, above the measured composer-safe area; narrow gutter and focus-visible style. No animation, status label, toast or unread count.
- `tests/agentMessagePresentation.test.ts`: existing direct MessageList host now supplies its explicit thread identity.
- `tests/e04ReadingNavigation.test.ts`: actual MessageList/TurnNavigation ReactDOM with controlled scroll geometry, content ResizeObserver and initial frame scheduling. Rich content/business subowners are mocked; the scroll/following/rail code is production code.

The button resumes following and assigns the existing scroll target synchronously. It moves focus to the named viewport with `preventScroll` before React removes the button. Ordinary streaming/resize never calls focus. E01 retained workspace/details, E02 eager fallback/canonical joining and E03 output-probe ownership are unchanged. No new production module or ownership-registry entry was needed.

## Verification

All commands use `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm`.

- `exec vitest run tests/e04ReadingNavigation.test.ts tests/agentMessagePresentation.test.ts tests/chatScroll.test.ts tests/e02SubmissionPresentation.test.ts`: **4 files, 25 tests passed** after the final test-only addition. Reading cases cover paused content growth and initial-frame races; native button activation/focus/renewed following; unchanged 301/300px boundary; same-ID optimistic acknowledgement versus a new user ID; explicit topic identity; actual rail/activity pause; disclosure pointer and Enter pause. Observer/frame cleanup is asserted after every reading case.
- `exec tsc -p packages/studio/tsconfig.json --noEmit --pretty false`: passed, no diagnostics. This check ran after the final production-source change; subsequent edits only added a reading test case.
- `exec eslint packages/studio/src/features/agent/ui/MessageList.tsx packages/studio/src/features/agent/ui/ChatWorkspace.tsx tests/e04ReadingNavigation.test.ts tests/agentMessagePresentation.test.ts`: exit0, **0 errors**. The source has three existing warnings: ChatWorkspace's retained nested ternary and the untouched AgentChatMessageItem body/comparator complexity. Both test paths are ignored by the current ESLint configuration, so this is not test-lint evidence.

One initial reading test failed because its newly captured attempt used the machine clock while earlier fixture rows used a later fixed timestamp, placing the attempt before the existing user turn. The test now freezes a later explicit attempt timestamp and gives the canonical row the same timestamp; production chronological ordering was retained. The final actual canonical-join case passes.

## Limits and handoff

- Controlled jsdom geometry proves the exercised callback, DOM and ownership assertions. It does not establish physical browser layout, compositor paint, actual keyboard-default dispatch or touch-device behavior. The native button's click/focus semantics and disclosure keyboard handlers are exercised; no custom button keyboard emulation was added.
- No full suite, build/package/native/live-provider command, dependency install or Git operation was run by this worker. Root owns independent review, full changed-scope architecture evidence, specs/task/ledger and commit.
- Production changes and focused tests are frozen for review. Preserve sibling query/departure edits; this worker did not own them.

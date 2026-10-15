# Return-to-latest placement correction

The owner's screenshot correction replaces the original right-edge text pill with a compact circular down-arrow centered inside the transcript/workspace, just above the composer.

`MessageList.tsx` uses the existing shared `ArrowDown` icon (`size18`, decorative `aria-hidden`) inside its existing native button, with `aria-label="返回最新"` and no visible caption. `turnNavigation.css` centers that button with `left:50%` and `translateX(-50%)` relative to the retained `.agent-message-navigation-shell`, which is scoped to the chat column rather than the application window. The circle is36px, consistent with the existing compact Agent icon controls; the existing measured composer-safe offset plus8px, theme/focus/hover and z-index are retained. The obsolete narrow right-alignment override is removed.

No following, focus, thread, runtime or composer behavior changed. The existing first reading test now checks the accessible name, absent visible caption and decorative SVG instead of expecting button text.

Necessary checks using `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm`:

- `exec vitest run tests/e04ReadingNavigation.test.ts`: **7/7 passed**.
- `exec eslint packages/studio/src/features/agent/ui/MessageList.tsx`: **0 errors**, two existing untouched message-item/comparator complexity warnings.

No broad tests, builds, packages, dependency installs or Git writes. CSS placement is source-reviewed here; this worker did not claim an actual-browser layout measurement. Changes are frozen for independent review and root commit.

## Root actual-browser check

Ran the unmodified current Vite product root at localhost in a fresh disposable Chromium context, seeded through actual production project/shot/chat commands. No model request or real-user browser storage was used. Inspected the resulting screenshot. At 1440×900 both normal conversation and an open actual shot detail, and at 390×844 after closing the detail, the button is 36×36px, its horizontal center differs from the current conversation shell center by 0px, and its bottom is 24px above the composer dock. The visible caption is empty and its accessible name remains `返回最新`. Actual click removes the button and restores message-viewport focus. No page exceptions.

The ephemeral browser report and three screenshots are under `/tmp/cuepoint-e04-button-layout-1792061502882`; this compact record preserves the outcome without copying raw browser artifacts into the task. This is current Chromium layout evidence; no native WebView, physical device, build or package claim.

# Focused packaged departure diagnosis — 2026-10-12

Status: the reported packaged WKWebView interaction remains **unresolved actual-host evidence**. No shared guard defect was reproduced, and no product source was changed.

## Reported actual host observation

Root's final isolated SQLite product accepted story and beat edits. Root independently checked the actual SQLite episode: title, logline, script, beat title, content and time of day had all persisted. A pathname departure attempted while beat autosave was pending opened the shared alert. Its title changed from `正在处理修改` to `保留未保存的修改？` after settlement, but root's native automation attempts to cancel, discard or activate the alert by keyboard left it visible. Native menus remained interactive. After restarting, root could interact with a connection form and its live local fixture model probe. These observations do not establish a SQLite deadlock or a global WebView event failure.

This reviewer did not control the native application, inspect old profiles, read keys or send provider requests. Root remains sole native UI owner. Host observations above are attributed to root; the independent reproductions below are actual Chromium evidence.

## Source path and hypothesis checks

- `src/components/story/StoryPage.tsx` installs a **pending-only** guard: `useManualDraftGuard(false, beatText.pending, () => undefined)`.
- `src/lib/useManualDraftGuard.tsx` blocks different pathnames while pending/dirty. Once TanStack's resolver is blocked it stays blocked until Cancel or Discard resolves that request. The current generic settled title does not demonstrate an unsaved database row.
- Cancel is disabled only while an explicit discard is in progress, not while an autosave is pending. Its own button handler calls the current `blocker.reset()` and preserves the local draft.
- The installed TanStack `useBlocker` reset resolves its navigation promise with `true`, then clears its resolver state to idle. The history owner returns without applying the canceled navigation.
- Radix `AlertDialogCancel`'s composed preventDefault suppresses its generic close handler, while the actual child button executes the deliberate router reset. The controlled `open` then follows the resolver state.
- Escape is not equivalent to successfully activating the explicit Cancel action on a Radix alert dialog. Its observed lack of closure alone is insufficient failure evidence.

## Real ReactDOM experiments

Both lanes use installed real Chromium, ReactDOM, current Radix components, current TanStack `createHashHistory`, current `StoryPage`/`BeatTextField`/`TextDraftField`/`useDebouncedDraft`/shared storage facade, and an isolated actual IndexedDB database. No guard, dialog, router or save-controller mock substitutes for their behavior. A documented fixture transform holds `patchStoryBeat` **before** calling the actual current business command, allowing deterministic pending navigation; releasing it performs real storage writes. It does not change guard behavior.

1. `departure-reactdom-01/`: minimal surrounding routes, actual StoryPage, actual hash Link.
2. `departure-reactdom-02/`: complete current generated `routeTree`, real RootLayout/WorkspaceChrome, actual world route, and StrictMode. This checks the actual parent structure instead of inferring it from the narrow fixture.

Each lane passed the same four assertions:

- Three beat fields are edited; navigating during held persistence shows `正在处理修改` and no discard button. Releasing persistence saves all three actual database fields and changes the title. A real trusted click on `继续编辑` closes the resolver, retains the exact scene and keeps the story route.
- A new navigation after that cancellation reaches the world route normally.
- A further pending save settles; a trusted `放弃并离开` click resolves the original blocked route and reaches the world page.
- Another pending save settles; focusing Cancel and pressing Enter generates trusted keyboard/click events and closes the resolver while retaining the story route.

Result: **8/8 actual ReactDOM scenarios passed**, no page errors. At the settled first departure each lane observed **one alertdialog**. All seven key product source hashes are unchanged before/after in the reports. The headless processes and temporary Vite caches were closed/removed normally. Fixture sources, raw logs, reports, synthetic screenshots and a hash manifest remain under the task's research directory.

## Verification

- Explicit machine pnpm `lint` (application TypeScript build): exit 0.
- Explicit machine pnpm `quality`: exit 0; 12 reviewed allowances, 584 visible review warnings, zero failures. No allowance was added or changed.
- Focused existing production tests: 4 files / **38 tests passed** (`e01ManualDraftDeparture`, `manualDraftWiring`, `debouncedDraft`, `draftConcurrency`).
- No tracked product/spec/config diff was introduced by this review. All changes are new task-local diagnostic evidence.

## Conclusion and next discrimination

There is no demonstrated mechanical code defect to safely fix. These Chromium passes do **not** clear the reported packaged WKWebView behavior, prove native keyboard delivery, or satisfy AC8. Keep the actual-host failure open. On the next actual native attempt, distinguish whether the alert action receives a real DOM event, whether the button is disabled, whether focus enters the alert, and whether there is more than one resolver/overlay. Root can compare a normal alert action in another current screen with this pending-only departure without changing persistence ownership. If a repeatable WK-only failure is established, preserve its native/build identity and rerun affected acceptance after a narrow evidenced fix.

The generic settled prompt title is inherited and was reproduced in both passing lanes. Changing that copy or automatically proceeding after autosave settlement is a product behavior choice, not the cause established by this investigation; this reviewer left it unchanged.

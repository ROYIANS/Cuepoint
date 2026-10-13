# Research: Unified Window History Navigation

- Query: Identify the owner and safe browser/native implementation of global back/forward controls; distinguish chronological history, parent links and local editor returns.
- Scope: Mixed (read-only application/dependency source and official TanStack documentation).
- Date: 2026-10-13

## Findings

### Files found and current owners

| File | Role / evidence |
| --- | --- |
| `src/main.tsx:13` | Creates the single application router before mounting the root. |
| `src/lib/productRouterHistory.ts:4` | Selects browser path history or genuine native hash history; native traversal/reload stays on the trusted entry document. |
| `src/components/layout/AppFrame.tsx:67` | Owns the shared outer topbar, macOS traffic-light reservation and interactive drag exclusions. This is the correct UI location for the arrows. |
| `src/components/layout/AppHeaderPortal.tsx:6` | Moves actual feature header presentation without moving its React owner. |
| `src/routes/_studio.tsx:13` and `src/routes/p.$projectId.tsx:10` | Studio and project route shells instantiate distinct AppFrames; project shell is keyed by project ID. A history tracker inside AppFrame would reset while navigating between these shells. |
| `src/lib/useManualDraftGuard.tsx:54` | Shared route/unload blocker and explicit continue/discard resolver; also arbitrates local owner departures. |
| `src/components/workspace/WorkspaceChrome.tsx:185` | Existing topbar back links point to project collection or episode collection, not the previous chronological entry. |
| `src/components/assets/CharacterDetailPage.tsx:57` | Contextual asset parent link (global character library vs this project's World). Scene/Prop/Style detail pages follow the same pattern. |
| `src/components/studio/IpProfilesPage.tsx:127` | IP detail parent link always points to `/ips`. |
| `src/components/produce/StoryboardPrintPage.tsx:93` | Print toolbar parent link returns to this episode's Produce page. |
| `tests/productRouterHistory.test.ts:35` | Existing browser/native path and reload tests; current fake window does not execute POP. |
| `scripts/b01-browser-regression.mjs:336` | Existing actual browser-history slot-draft scenario: back, Continue preserves input, second back/Discard proceeds, unload protection clears. Read only; not run in this research. |
| `scripts/e01-drafts-browser-regression.mjs:128,219,239` | Existing POP/Continue and explicit departure scenarios for task inspector/voice owner. Read only. |

### Installed API and POP protection

Manifest requests `@tanstack/react-router ^1.131.50` (`package.json:40`); lock/install resolves React Router **1.170.38**, Router Core **1.171.32** and History **1.162.4** (`pnpm-lock.yaml:6319`). Installed files are authoritative for this implementation.

- `node_modules/@tanstack/react-router/src/useCanGoBack.ts:5` tests `location.state.__TSR_index !== 0`. It is a back-boundary hint, not an inventory of valid adjacent application entries; there is no matching forward hook in the installed public history API.
- `node_modules/.pnpm/@tanstack+history@1.162.4/node_modules/@tanstack/history/src/index.ts:23` exposes `subscribe`, `push`, `replace`, `go`, `back`, `forward`, `canGoBack`, `block`, `flush` and `destroy`. `length` is the browser's entire session history length (`:524`), which includes entries before the application and has no current-position information. Do not use it to enable Forward.
- `index.ts:336` gives a fresh direct entry index zero unless it already has a TanStack key. Ordinary document reload can preserve the browser entry's key/index. `createHashHistory` delegates to the same browser implementation (`:609`) and only adapts URL formatting/parsing; no second native navigation stack is needed.
- Back/Forward call the underlying browser traversal (`index.ts:527`) and the resulting POP handler sequentially awaits all registered blockers (`:434-485`). A canceled POP rolls the browser back and notifies subscribers with the **old accepted location** (`:473-476`). Successful POP publishes the next location only after blockers resolve (`:483`).
- `useBlocker.tsx:176-253` installs the owner callback into `history.block`, parses current/next route identities and resolves Continue/Discard via reset/proceed. Calling `router.history.back()` / `.forward()` **without `ignoreBlocker`** retains this protection for both runtimes. No new global draft/discard service is needed.
- Browser `beforeunload` is a separate protection path (`index.ts:487`); it is not fired by ordinary same-document history traversal. Do not rely on unload alone for SPA departure.

### Existing draft protection and local returns

| Owner / return | Existing policy | Proposed handling |
| --- | --- | --- |
| Slot, relationship and output forms | Shared `useManualDraftGuard`; pathname change blocks dirty/pending, same-path search retains owner (`useManualDraftGuard.tsx:55-65`). Output settings wire it at `ProjectSettingsPanel.tsx:177`; Story pending text at `StoryPage.tsx:57`; Shot relationship/text at `ShotEditorPage.tsx:189`. | Route history arrows use existing history/blocker. Preserve form mount, owner and confirmation. |
| IP editor, material detail, memory editor, generation batch edits | Their own `useBlocker` protects dirty/pending, including POP (`IpProfileEditor.tsx:88`, `MaterialControls.tsx:91`, `MemoryEditor.tsx:135`, `AgentGenerationBatches.tsx:184`). Some also block search-only changes. | Do not weaken predicates to make arrows appear more responsive. |
| Voice editor → voice list | `VoiceLibrary.tsx:47,101-131` uses synchronous draft-state refs plus `requestDeparture(leaveEditor)`. No URL change. | Keep local return; global Back is a different action. |
| Task inspector close, board opening and owner replacement | `TaskInspector.tsx:79,156-163,245` aggregates nested local/route dirty and pending; `AgentChatPage.tsx:65-73` stores the existing departure callback. | Keep existing close/owner arbiter. Opening a routed destination may retain its local owner departure before the route call. |
| Memory detail → list | `ProjectMemoryPage.tsx:156` clears local selected ID. | Keep local return or design equivalent in-pane control; not history traversal. |
| Agent parameters/skills popup → menu | `AgentControls.tsx:240,276` and `ContextParameters` return a local popup view. | Keep inside popup; never route back. |
| ProjectPicker creation form → project choices | `ProjectPicker.tsx:100` toggles local `creating`; pending disables control. | Keep local return and pending lock. |
| Task board → assistant | `AgentChatPage.tsx:589` routes to `/agent`. | Can remove redundant page-level return if unified chronological arrows and a reliable Home/left-column destination remain. |
| Missing/unavailable page recovery | `WorkspaceChrome.tsx:110,130,182`, asset missing state and capability state supply specific known destinations. | Keep explicit recovery actions; unknown history may be unavailable on direct open. |

Autosaved text has a different owner: `debouncedDraft.ts:11,193,275-310` retains keyed scoped controllers, flushes on dispose/unregister, preserves failed detached flush registrations and installs unload protection. `TextDraftField.tsx:23,31-45` freezes field ownership and synchronously marks pending. Do not replace this with a generic titlebar save/flush callback; retain current page-specific guards.

Agent unsent composition is **not** a general cross-route durable draft: `useReferenceDraft.ts:23-39` stores scoped drafts in that hook's local state. It survives thread changes while the same AgentChatPage host is retained, but cannot guarantee retention after that host unmounts to a project or Studio destination. `useChatExecutionSession.ts:10-21` aborts the old request on unmount/thread replacement. This task should preserve those lifetimes and avoid claiming new persistence or execution continuity.

### Safe implementation direction

1. Keep native hash/browser path selection unchanged. Place the history capability tracker beside the one `createProductRouterHistory()` / router instance, or in a stable root provider bound to that instance. AppFrame only subscribes/renders muted accessible Back/Forward buttons after native reservation, with `data-tauri-drag-region="false"`.
2. Use the real installed history `.back()` / `.forward()`; do not implement navigation by replacing the current route with a remembered URL, call raw `window.history`, use `ignoreBlocker`, create another router or call native navigation IPC.
3. Recommended default is a bounded, volatile **known application-entry ledger**. A new direct entry/reload initializes only the current accepted entry as known. Enable a direction only when its actual adjacent entry is known in this application session. A new PUSH after Back discards the forward branch; REPLACE updates the current entry without adding a step; unknown POP/key/index mismatch resets the known range conservatively. Neither an index nor an action alone is proof of a reachable application destination.
4. Match entry identity/key and actual accepted location. Canceled POP emits a BACK/GO notification at the same old location; the ledger must not move or prune based on that action. PUSH notifications are optimistic, and browser pushes are microtask-coalesced (`history/index.ts:397-425`); multiple notifications can correspond to one committed browser entry. Record/deduplicate the final flushed browser entry, not each observed PUSH. Cover immediate double pushes, push+replace and forward truncation in targeted tests.
5. Serialize the titlebar's own traversal requests while a POP/owner resolver is pending to avoid repeated activation overwriting a pending destination. Return to enabled state on accepted or rejected traversal notification. Keep the existing confirmation modal's safe focus/Continue behavior; do not fabricate a timeout success when traversal has no completion signal.
6. A bounded validated sessionStorage ledger could preserve known ranges across reload, but it adds synchronization and recovery cases (current key/index match, branch changes, stale snapshot, reloadDocument reset, malformed/unavailable storage). It is unnecessary for the safe default unless the user explicitly requires history controls to survive reload. Keep it separate from ProductStore and workspace schema.

### Planning decisions to make explicit

- **Chronological vs parent fallback:** recommend true history arrows, disabled when unknown, and meaningful left-column collection/section links for parent navigation. A direct asset/detail entry should not silently reinterpret Back as "go to parent" because Forward and chronological semantics then diverge. If parent fallback is requested, give it explicit semantics/name and decide whether it creates a history entry.
- **Reload behavior:** recommend conservative reset of known traversable range while retaining the currently loaded URL. Previous browser-native toolbar history remains the browser's own behavior; this app's controls only expose proved in-app destinations. Ask only if preserving the pre-reload Back/Forward range is a product requirement.
- Local editor/menu returns and error recovery remain explicit owner actions. They are not duplicate chronological navigation, even if their icon currently points left.

### Verification needed during implementation

- Real browser and Tauri hash history: direct entry with older external browser history; PUSH → Back → Forward; Back → new PUSH; REPLACE filters/redirects/deleted-thread redirect; reload/deep-link reset; unknown/raw history entry; repeated/double traversal.
- Real POP blockers: dirty slot/output/IP/material/memory/batch; pending save; Continue preserves draft/owner/focus; Discard proceeds only after cleanup; failed cleanup stays; canceled POP preserves ledger and forward branch. Memory history alone cannot verify installed browser POP blocker behavior.
- Preserve voice local return and task-inspector nested owner protection, including local confirmation followed by attempted POP. New layout/sidebar must not re-key editors by selected navigation presentation.
- Verify single-row header and interactive native drag exclusion separately. A back button test cannot prove traffic-light geometry or native header drag behavior.

### External references

Context7 `/tanstack/router` was queried on this date; it corroborates hash history and `useBlocker` resolver/API. The exact pinned installed source above governs implementation; latest docs may describe another patch version.

- [Official History Types](https://raw.githubusercontent.com/TanStack/router/main/docs/router/guide/history-types.md): browser/hash/memory abstractions and passing one history instance to the router.
- [Official useCanGoBack API](https://raw.githubusercontent.com/TanStack/router/main/docs/router/api/router/useCanGoBack.md): experimental index-zero boundary and `reloadDocument` reset limitation.
- [Official Navigation Blocking](https://tanstack.com/router/latest/docs/guide/navigation-blocking): owner-driven hook and resolver plus distinct unload protection. Its introductory return-value prose is inconsistent with its current code examples; the installed `useBlocker` source and example use `true` to block.

### Related specs

- `.trellis/spec/frontend/desktop-ui.md:27,45-51`: one presentation shell, feature-header portal, native drag exclusions and overlay/draft ownership. Its current allowance for project tabs wrapping is intentionally superseded by this task's proposed single-row header; update through the spec owner after approval.
- `.trellis/spec/frontend/component-guidelines.md:217-231`: synchronous local draft arbiter, pathname/search distinction, frozen local request, pending discard refusal and focus/scroll restoration.
- `.trellis/spec/frontend/state-management.md:735-746,878-902`: keyed ownership, route protection and retained/error text drafts.
- `.trellis/spec/frontend/hook-guidelines.md:59`: install draft/unload protection before using keys to remount and separately guard local parent selection.
- `.trellis/spec/frontend/native-product-runtime.md`: shared product runtime and hash history on genuine native runtime; storage owner must remain independent.
- `.trellis/spec/guides/task-artifact-retention.md`: retain this authored conclusion, not copied sources/logs/screenshots.

## Caveats / Not Found

- No UI interaction, tests, product mutation or Git operation was performed. The browser scenarios listed above are existing source evidence, not a passing run for this new task.
- No built-in application-only forward-boundary API, complete history entry enumeration or stable product-owned history ledger exists in current source.
- Standard browser APIs do not expose the full surrounding stack; `document.referrer`, history length and maximum observed index alone cannot prove safe forward/back destinations.
- Ordinary reload preserves TanStack state when available; `reloadDocument` navigation resets the router index. Resetting only a new ledger does not alter existing URLs, browser history or persistence.
- Local reference composition currently has no cross-AppFrame-unmount persistence guarantee; preserving that behavior is in scope, inventing durable drafts is not.

## Implementation correction: blocked POP after rapid writes

The new executable browser/hash stack regression reproduced a dependency defect: two unflushed PUSH calls create one physical entry carrying index2. After pushing index3 and returning to index2, a blocked Back to index0 executes rollback go(2), physically landing on index3 while logical location remains index2. Both runtime variants failed before the correction.

The product history boundary now serializes public push/replace calls and flushes each accepted notification. A public block wrapper delegates the original owner callback and releases the queue after a denied write; it does not change the owner decision. Concurrent async accepting blockers otherwise allocate indices before either accepted write exists, which call-time flushing alone cannot repair. This keeps physical entries and assigned indices aligned without mutating TanStack internal state, bypassing blockers, replacing traversal with remembered URLs or modifying dependency source. Rapid accepted pushes now remain distinct real steps; denied writes add no entry. The tracker preserves explicit flush boundaries and validates accepted POP locations. Passing regression evidence is recorded separately from native UI evidence.

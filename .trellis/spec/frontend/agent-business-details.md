# Agent Business Details

## 1. Scope / trigger

E01 introduces in-workspace single-shot inspection/editing from Agent links without route departure. Application composition connects Agent to the existing Video owner. The shared ContextPanel presentation also applies to task, memory, material, audio and music panels. Other business entity link interception and handoff out of batch-review dialogs remain separate work (E16).

This contract changes app/feature APIs and draft departure reporting. It introduces no storage schema, new Agent execution host, router bypass or provider request.

## 2. Signatures and ownership

```ts
// features/video/models/shotDetailTarget.ts (declared feature entry)
type ShotDetailTarget = {projectId: string; episodeId: string; shotId: string};
shotDetailHref(target: ShotDetailTarget): string;

// app/details/shotDetailTarget.ts (private app parser)
readShotDetailTarget(href: string): ShotDetailTarget | undefined;

// app/details/ShotDetails.tsx (named feature-to-app composition entry)
ShotDetailsProvider({children: ReactNode});
ShotDetailLink({href, target?, ...anchorProps});
useShotDetailActivation(): (event: MouseEvent<HTMLElement>, target?: ShotDetailTarget) => void;

// features/video/ui/ShotDetailPanel.tsx (declared feature entry)
ShotDetailPanel({target, onTargetChange, onClose});

// Optional additions to existing field controls; existing callers remain valid.
TextDraftField.onDepartureState?: (state: ManualDraftState, discard: () => void) => void;
DurationInput.onDepartureState?: (state: ManualDraftState, discard: () => void) => void;
// ContextPanelContent returnLabel defaults to "返回工作区"; Agent uses "返回对话".
```

AgentChatPage retains its session/provider tree inside ShotDetailsProvider. The provider owns requested selection and lazy composition only. Video owns record loading, target ownership checks, editing and departure. Layout owns panel arbitration and presentation only. Keep exact entries synchronized in `quality/studio-ownership.json`; do not add a generic cross-feature registry or expose private implementations.

## 3. Contracts

- Recognized links have `/p/{projectId}/e/{episodeId}/shots?shot={shotId}` or its `#/…` form. Keep a canonical real anchor. Intercept only unmodified normal left/keyboard activation inside the provider and only if an explicitly supplied typed target matches the parsed target. Download, middle and modifier activation preserve native intent; arbitrary destinations, citations and footnotes retain publisher rendering and routing.
- Bound href to 2048 characters and each decoded ID to 256. Reject blank IDs, traversal IDs, path/control delimiters, malformed encodings, foreign/absolute URLs, extra/duplicate query keys and extra path/hash content. URL normalization must not expand the allowlist. This parser is not an ownership authorization check.
- Query through one explicit ProductStore readonly context, checking project, episode.projectId, shot.projectId and shot.episodeId. Return an envelope keyed by all three requested IDs even for a missing record. Loading, missing and genuine read errors have distinct local UI; no whole episode grid, filter change or throwing router loader.
- Reuse existing ShotTextField/DurationInput, relation commands and media-slot editors. Freeze each save to its original target and touched-field baseline. Existing field CAS, relation intent and slot baseline rules apply. No whole-record overwrite or implicit retry against a new revision.
- Report raw text/numeric input synchronously before queued React/controller updates. Aggregate dirty/error and pending state across fields, relations and operation editors. Read this live aggregate in close, return, replacement and same-registration A→B departure; effect-only reporting leaves an unsafe input-to-navigation gap.
- Invalid numeric raw text counts as dirty even when no command was started. Pending work blocks discard. Continue preserves draft, selection, focus/scroll and active target; explicit discard clears only the departing owner's drafts. A competing request cannot apply stale completion to a newer target.
- Media operation dialogs retain their own route/departure guards and cleanup. The pane uses total dirty/pending for local close/replacement and delegates media route protection through the existing optional routeDirty/routePending flags. Route confirmation and before-unload read the route flags; aggregate render comparisons cover all four flags so an inline save settling while media stays open updates the confirmation.
- Retain a matching opened snapshot while dirty/pending when the target disappears or reading fails. Show a local explanation and keep drafts readable; unavailable text, number, relation, media and retry entry points cannot write. New targets cannot reuse that snapshot.
- Dock only when measured surface width fits active navigation + panel + 480px center. Full-width mode uses the same portal/editor DOM, preserves main geometry/reading state, hides/inerts only the main working subtree and provides a visible return action. Global chrome stays usable. Focus cannot remain in the hidden subtree or a newly hidden return bar; queued Agent autofocus must yield to inert ancestors.
- Preserve existing real route-departure confirmation and execution cancellation rules. Opening or returning from detail does not arm a bypass or cancel the Agent request. Operation dialogs remain modal; deferred batch-review links keep their existing path until explicit handoff exists.

## 4. Validation and error matrix

| Condition | Required behavior |
| --- | --- |
| Valid normal shot link during a stream | Open detail inside workspace; stream and chat owner continue |
| Modifier/middle/external/footnote/citation activation | Preserve anchor/publisher behavior |
| Parsed IDs belong to different owners | Local missing state; no editable record or filter repair |
| Initial record read fails | Local error with explicit read retry; no unhandled rejection |
| Target deleted with dirty/pending draft | Retain readable draft, disable all writes and retries until available |
| Another field changes remotely | Touched-field command can merge under its existing contract |
| Same touched field changes remotely | Retain local draft and current remote value; require explicit conflict recovery |
| Invalid numeric input then close/switch | Departure confirmation protects the raw input |
| Pending save then close/discard/switch | No discard and no retargeting of the pending command |
| Rapid A→B→C / canceled replacement | Current guard decides once; stale completion cannot replace a newer owner |
| Width changes with caret/reading position | Same editor DOM and draft survive; hidden chat continues running |

## 5. Good / base / bad cases

- Good: a streamed Markdown shot link opens an editable side panel; resizing replaces only workspace presentation, and returning restores the retained transcript position.
- Base: a missing historical link opens a local missing-state panel while the conversation continues.
- Bad: navigating to the episode grid to inspect one filtered-out shot, confirming a session stop, clearing filters, rendering a second chat owner, or showing a non-interactive pane behind an operation dialog.

## 6. Tests required

- `tests/shotDetailTarget.test.ts`: canonical/hash forms, bounded IDs, traversal/encoding, extra/duplicate keys and noncanonical destinations.
- `tests/shotDetailPanel.test.ts`: actual DOM controls and ProductStore; invalid numeric departure, pending frozen saves, A/B/C cancel/discard, touched-field CAS, deletion retention and missing/foreign scope.
- `tests/shotDetailQueryLifecycle.test.ts`: actual StoreTx reads with controlled observation delivery; new-target loading excludes previous data, retired late results are ignored, actual read failures stay local and explicit retry recovers while retaining readable dirty drafts.
- Shared ContextPanel coordinator/DOM/focus-return and manual-draft suites: replacement cancellation, stale completions, return/focus/scroll and pending protections remain intact.
- `tooling/agent-parallel-details-browser.mjs`: real AgentChatPage/controller/session, controlled streaming transport, actual ProductStore and business components. Assert pointer/keyboard link paths, modifier intent, responsive same-DOM caret/store state, hidden conversation reading/draft, pending/CAS behavior and real route departure. A fixture is not packaged WebView acceptance.
- Real isolated packaged app: open the persisted Agent shot link, inspect/edit detail, resize wide/narrow and return; verify committed native SQLite data. Record actual host coverage and any limitations separately.
- Use the local pnpm path from AGENTS.md. For the current multi-task delivery, the owner's 2026-10-15 instruction selects directly affected regressions, type checks and scoped code/architecture review per task. Full root suites, native-store integration, build and packaged acceptance are deferred to the end of the complete batch; task notes must distinguish passed checks from deferred checks.

## 7. Wrong versus correct

```tsx
// Wrong: route departure invokes the chat blocker, and changing the tree loses drafts.
onClick={() => navigate({to: shotDetailHref(target)})}
return narrow ? <Dialog><ShotEditor/></Dialog> : <aside><ShotEditor/></aside>;

// Correct: named app bridge retains real href; one Video-owned editor survives modes.
<ShotDetailLink href={shotDetailHref(target)} target={target}>查看镜头</ShotDetailLink>
<ContextPanelContent returnLabel="返回对话"><VideoOwnedFields/></ContextPanelContent>
```

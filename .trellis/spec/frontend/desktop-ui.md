# Shared Desktop UI Contract

## 1. Scope and trigger

All Studio and project pages share window chrome, neutral surfaces, typography and overlay behavior. This contract was implemented on 2026-10-10 to prepare the existing application for desktop packaging. It governs presentation; feature owners retain queries, mutation commands, drafts, playback, runtime sessions and persistence barriers.

## 2. Signatures and owners

`src/components/layout/AppFrame.tsx` exports:

```ts
AppFrame({children, onImport?, contentScroll = "auto"}: {
  children: ReactNode;
  onImport?: () => void;
  contentScroll?: "auto" | "hidden";
})
```

`StudioShell` and `WorkspaceChrome` supply their existing import handlers and guarded content. `AppFrame` does not create a router, data provider, project owner or Agent runtime. Its `NAV` owns destination labels and active state; `/agent/tasks` must never activate the chat destination.

`src/components/layout/PageLayout.tsx` exports:

```ts
PageHeader({title, description?, count?, back?, actions?, dense?, className?})
PageToolbar(props: ComponentProps<"div">)
PageContent(props: ComponentProps<"div"> & {
  mode?: "collection" | "detail" | "document" | "workbench";
})
PageState({title, description?, action?, kind?, compact?, className?})
// kind: "loading" | "empty" | "missing" | "error"
```

Header slots accept ReactNode. `PageContent` renders a div and adds width/padding classes; keep or explicitly supply the page's `main` landmark. These helpers do not fetch data or add a scrollport. `LibraryHeader` adapts collection title/count, actions, search and sort to the same primitives.

## 3. Presentation and lifecycle contracts

- `src/styles.css` is the shared token owner: navigation `#0c0c0c`, application `#101010`, panel `#151515`, elevated `#202020`. Existing semantic foreground, border and focus tokens govern controls. Agent's LobeHub/antd adapter is scoped to `.agent-chat-root`; never import antd reset CSS globally.
- The frame fills `100dvh`, with no outer inset, decorative click canvas or additional rounded content frame. Navigation is 176px at widths >=1200, 64px at 768–1199, and a left Sheet below 768. All modes expose the same destinations and active state.
- Functional page h1 is sans 24px/600/32px; narrow (<768) and dense workbench h1 are 20px/600/28px. Body is 14px/22px, metadata 12px/18px. Use restrained neutral grouping; avoid decorative accent strips and nested cards. Keep shadcn control geometry and focus styling (normal 36px, compact 32px), rather than flattening every control with feature CSS.
- Shared Radix Tabs use `src/components/ui/tabs.tsx`: 36px panel-colored track and 32px triggers, with elevated surface for the selected trigger. Selection adds no static border, ring or shadow; keyboard `focus-visible` retains the shared ring. Consumers may adjust wrapping, width and compact inline padding, but must not replace the selected surface, radius or focus treatment. Do not mix a feature-specific underline/transparent/rectangular skin with the shared selected state. Navigation links and independent filters retain their own semantics.
- Collection content uses available width, detail content caps at 1040px, reading documents at 880px, workbenches use available width. Shared padding is 24px; workbenches 16px 20px; narrow pages 16px. Header actions and toolbars wrap without widening the window. Tables and timelines may scroll horizontally within their own containers.
- Each page keeps one primary vertical scroll owner. Studio asset details inherit frame scrolling; project details and workbenches preserve their existing feature scrollports. Do not wrap editors or media players in breakpoint-dependent alternate trees. Agent home/thread routes share the same `AgentChatPage` host; transcript and composer keep the 800px safe width. Topic navigation below 768 opens a **right** Sheet.
- Controlled `Dialog`, `Sheet` and `AlertDialog` integrate `createOverlayFocusReturn()` from `src/lib/overlayFocusReturn.ts`. It captures the opening focus, delegates caller autofocus handlers and queues a fallback only if the closing focus is body/null. It respects `preventDefault`, connectedness, a newer opening generation, Radix Trigger restoration and valid custom focus. It must not prevent AlertDialog's default initial Cancel focus.
- Every AlertDialog registers its safe cancellation control through `AlertDialogCancel`. Existing manual-close handlers may use `asChild` plus wrapper `onClick={event => event.preventDefault()}` so Slot runs the child owner once and suppresses duplicate primitive close behavior. Preserve disabled/pending/blocker behavior.
- Short-window overlays use bounded height, a scrollable body and reachable header/footer. Pending and failed writes retain existing owner rules and drafts. Escape and close restore focus after the closing animation, without scrolling the underlying page.
- Agent icon buttons requiring native keyboard activation import `ActionIcon` from `@lobehub/ui/base-ui`. The installed deprecated root export renders a focusable div without Enter/Space activation. Keep accessible labels and existing props/handlers; do not nest buttons in links.
- Print remains white A4 landscape with 10mm margins. `@media print` releases height/overflow of the frame, content surface and workspace ancestors, hides navigation/mobile header/workspace header/print toolbar/toasts, and keeps storyboard cards together where possible. Screen theme changes must not recolor printable output.

## 4. Validation and error matrix

| Condition | Required behavior |
| --- | --- |
| Query is still loading | `PageState kind="loading"` exposes status; no retained owner row is rendered |
| Current owner is missing or mismatched | Existing missing/owner guard blocks edits; never relabel it as loading forever |
| Empty list or search has no results | Contextual empty state and available recovery action; no fake success |
| Mutation fails / revision conflicts | Owner's error/retry/conflict state stays visible and draft remains available |
| Long title / narrow viewport | Header wraps or truncates deliberately; document width stays within viewport |
| Short window / long dialog | Body scrolls; close, cancel and commit remain reachable |
| Overlay caller prevents autofocus | Helper respects caller; no forced focus return |
| Opener removed or another element already focused | No fallback focus theft |
| Window crosses 768 or 1200 | Navigation changes presentation; runtime, input and playback owners remain mounted |

## 5. Good, base and bad cases

- Good: `PageContent mode="detail" role="main"` combines shared width with a feature's ownership guards; `PageHeader actions={<Button .../>}` keeps its existing command callback.
- Base: collection page uses `LibraryHeader`, `PageToolbar` and contextual `PageState`, preserving sort/search state and cards' keyboard menus.
- Bad: a new page adds a 36px marketing headline, custom global surface colors, another outer frame, or a scroll wrapper around an existing workbench. A controlled confirmation without `AlertDialogCancel` leaves initial focus outside the modal.

## 6. Verification and assertion points

- `tests/overlayFocusReturn.test.ts`: caller delegation/prevention, valid focus preservation, detached opener, current generation and fallback focus with preventScroll. Existing B01/B06 consumer harnesses must traverse presentation slots so query identity, revision guards, session ownership and redaction assertions still exercise actual controls.
- Native browser: all contextual pages' headers, landmarks and scroll ownership; widths 1440x900, 1280x720, 1024x640, 1280x600 and 390x844; both sides of 768/1200; dialog safe initial focus, Escape/close return after animation; Agent Space/Enter activation; draft and playback across resizing; long storyboard print layout.
- Tabs: verify Material media/settings, World query-backed categories and Music creator/workspace modes. Mouse selection has no permanent outline; arrow keys move selection and expose keyboard focus; narrow wrapping must not widen the document. Check settled content after route/draft changes before recording the selected state.
- Preserve meaningful business tests for asset ownership/drafts, shot filters/lazy rows/undo/episode delivery, audio arrangement and approvals, music variants/duration, memory CAS and Agent execution/context. Pure visual changes need native evidence, not implementation-mirroring snapshots.
- Full frontend gate: typecheck (`pnpm lint`), tests, quality, quality self-test, model-bank verification and build. Use the explicit local pnpm path from AGENTS.md. Record actual failures and fixes before the passing run.

## 7. Wrong versus correct

```tsx
// Wrong: a second scroll owner and a feature-specific headline system.
<div className="h-screen overflow-auto"><h1 className="text-4xl">Your creative universe</h1><ExistingWorkbench/></div>

// Correct: shared presentation inside the existing feature scroll owner.
<PageHeader title="音频制作" dense actions={existingActions}/>
<ExistingWorkbench/>
```

Do not derive desktop packaging, database migrations or provider behavior from this presentation contract. Those require their own implementation scope.

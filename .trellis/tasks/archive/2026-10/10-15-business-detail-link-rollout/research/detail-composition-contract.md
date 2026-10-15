# Research: Concrete E16 composition and retained-return contract

- Query: Exact minimal APIs for independently retained shot/asset owners, guarded admission and batch-review return tokens.
- Scope: Internal, preparatory design only. Extends the trusted `detail-rollout-design.md`; no repeated entity inventory, implementation, activation, spec/metadata edits, tests, builds, network or Git.
- Date: 2026-10-15

## Findings

### Current seams that require an explicit outcome

- `packages/studio/src/app/details/ShotDetails.tsx:10-25` owns one requested target and returns no opening result. The finite parser in `shotDetailTarget.ts:9-25` and real-anchor/modifier behavior at `ShotDetails.tsx:20-35` should remain the activation boundary.
- `features/video/ui/ShotDetailPanel.tsx:33-71` already owns retained `active`, synchronous draft aggregate and guarded same-family switching. Its cancellation restores the requested prop through `onTargetChange(active)`; clearing the provider instead would discard the existing editor.
- `app/layout/ContextPanelHost.tsx:51-75` retains the outgoing registration while its departure guard runs. It calls incoming `close()` for both busy and refusal, outgoing `close()` for accepted replacement, and has no positive admission notification. Those distinct outcomes cannot safely be inferred from a bare `onClose` callback.
- `app/layout/context-panel.tsx:50-65` maps all these cases into `onOpenChange(false)`. Content is actually mounted only at `:103-129`; host `setActive` is not DOM commitment or pixel paint. Its return bar is hidden while docked, so a label alone cannot provide a wide-screen batch-return action.
- `features/agent/ui/AgentGenerationBatches.tsx:129-188` retains drafts, revision, group, expanded row, pending lock, query and route blocker outside Dialog content. Normal close at `:249-255` refuses dirty/pending state; the handoff must bypass only presentation, never this draft owner. Modal content/overlay and unconditional trigger autofocus are at `:274-282`; the two target links are `:342` and `:368`.

Related contracts: `.trellis/spec/frontend/{agent-business-details,feature-organization,desktop-ui,interaction-feedback}.md`, `.trellis/workflow.md`, E16 PRD, and the existing rollout research. These signatures are proposals, not existing exports.

### Named app facade and outcomes

Keep the finite app facade in `app/details/BusinessDetails.tsx`, with parser helpers private to `app/details`. The target models remain feature-owned. Suggested exact public shape:

```ts
type BusinessDetailTarget =
  | {kind: 'shot'; target: ShotDetailTarget}
  | {kind: 'asset'; target: AssetDetailTarget};
type DetailReturnOrigin = {
  token: string; label: string;
  onEnd(event: {token: string; requestId: string;
                reason: 'return' | 'close' | 'replaced'}): void;
};
type DetailOpenResult =
  | {status: 'opened'; requestId: string}
  | {status: 'refused'; requestId: string;
     reason: 'guard' | 'busy' | 'superseded' | 'unavailable'};
interface BusinessDetailsApi {
  open(target: BusinessDetailTarget, options?: {origin?: DetailReturnOrigin}): Promise<DetailOpenResult>;
  returnToOrigin(token: string): Promise<'returned' | 'refused' | 'stale'>;
}
BusinessDetailsProvider({children}: {children: ReactNode}): ReactNode;
useBusinessDetails(): BusinessDetailsApi | null;
useBusinessDetailActivation(): (event: MouseEvent<HTMLElement>, target?: BusinessDetailTarget) => void;
BusinessDetailLink({href, target?, ...anchorProps});
```

`open` creates a monotonically unique local request ID before asynchronous work; refusal resolves a value, rather than rejecting a Promise with an ordinary guard result. `opened` means that exact request is selected and its detail frame has committed to the shared host (a local loading/missing frame counts); it does not mean entity read success or painted pixels. Lazy-load failure resolves `unavailable` locally and removes only the unadmitted incoming owner. A still-loading lazy module does not justify clearing an outgoing panel.

Keep the existing **actually consumed** `ShotDetailsProvider`, `ShotDetailLink` and `useShotDetailActivation` exports as thin delegates to this one facade. `ShotDetailLink.target?: ShotDetailTarget` maps to the shot variant; absent typed target permits the new finite parser to recognize shots/assets. No nested second provider, duplicated state, blanket interception or migration of every link consumer is necessary. Existing caller `onClick`, publisher footnotes/citations, real href, modifiers, middle-click and download remain intact. The new batch consumer uses `useBusinessDetails` directly only after validating its typed target against its canonical destination.

### Two retained slots; one selected presentation

Provider state contains **separate stable shot and asset slots**, each with `requested` and last `accepted` selection. Render each feature panel whenever its slot exists; never key the family panel by entity/request ID. Only its owned editor body is keyed by accepted target. A discriminated render that immediately swaps shot→asset would unmount the dirty outgoing owner before host arbitration.

Use one guarded transition (open or return) at a time, matching the host's existing pending policy. A competing `open` resolves `busy` without changing the in-flight candidate; it must not replace a dialog callback's target. All callbacks check request ID and the provider's current attempt before applying changes. Ordinary links need no busy toast. Do not use latest-wins mutation behind an already displayed departure confirmation. Provider teardown resolves outstanding open requests as `superseded` and pending returns as `stale`, with no origin callback or modal reopening from cleanup.

The small family-panel session protocol can be type-only layout composition data; it must not make Library import the app's business-target union:

```ts
type DetailPanelRequest<T> = {id: string; target: T};
type DetailPanelOutcome =
  | {requestId: string; status: 'presented'}
  | {requestId: string; status: 'refused'; reason: 'guard' | 'busy'};
type DetailPanelClose = {requestId: string; reason: 'close' | 'return' | 'replaced'};
type DetailPanelCloseRequest = {id: string; requestId: string; reason: 'return'};
// ShotDetailPanel and AssetDetailPanel use these exact shared session props:
{request: DetailPanelRequest<TheirOwnTarget>;
 onRequestOutcome: (event: DetailPanelOutcome) => void;
 onClosed: (event: DetailPanelClose) => void;
 closeRequest?: DetailPanelCloseRequest;
 onCloseRefused?: (closeRequestId: string) => void;
 returnLabel?: string;}
```

The feature owns `active: DetailPanelRequest<T>` and its draft guard. On same-family A→B: retain A until accepted; on refusal report **B refused**, retain A's editor/ID, and let the facade restore `requested=accepted`. Never emit `closed(A)` or clear the slot. On acceptance, commit B's keyed editor and report `presented(B)` only after the frame/content commit. A same-target request may adopt a new request ID/origin without remounting its editor; report after confirming the frame remains selected. Reject/ignore late callbacks by ID rather than target text.

`closeRequest` is consumed only when its `requestId` is the feature's accepted active selection, and goes through the same draft/pending departure guard as the visible return control. Refusal reports its close-request ID and preserves the active selection/origin. The facade resolves `stale` without sending a close when the token no longer owns the current selection. Normal close and explicit return differ only in their reason; both guard before `onClosed`.

### Small host/frame additions, preserving existing consumers

Keep `register/request/release` ownership and generation checks. Give the existing `Registration.close` a reason, rather than building another arbitration layer:

```ts
type ContextPanelHostCloseReason = 'replaced' | 'guard-refused' | 'busy';
// Registration.close(reason: ContextPanelHostCloseReason): void
// ContextPanel.onOpenChange(open: boolean, reason?: ContextPanelHostCloseReason): void
// ContextPanelContent.onPresented?: () => void
```

Host calls `close('busy')` for a competing incoming panel (`ContextPanelHost.tsx:54`), `close('guard-refused')` after the outgoing guard cancels (`:74`), and outgoing `close('replaced')` only after departure acceptance (`:68`). Existing callbacks that accept only the boolean remain valid. This reason is internal presentation data, not user-facing status. Content consumes `onPresented` itself (not a leaked DOM prop) in a layout effect after its shown frame/ref exists; use a live callback ref. That layout callback may run again after content commits; the feature deduplicates admission by its active request ID, so same-family selection can acknowledge its new ID while resizing cannot emit duplicate admission or remount the editor.

The panel maps initial incoming refusal to `onRequestOutcome`, never to closure of a previously accepted target. A selected outgoing panel maps `replaced` to `onClosed` only after its guard accepted; same-family refusal remains local and keeps the frame. The facade queues final origin notifications until the corresponding close/removal has committed, so reopening a modal does not compete with an outgoing detail still mounted. Effects/cleanup must not themselves be treated as a user return (including StrictMode or provider teardown).

### Batch token lifecycle and retained review

`BatchSurface` creates a token scoped to its mounted batch session, captures scroll and a stable item/control/caret bookmark, then sets `handoff` presentation state. Its local edits/revision/group/expanded/pending owner stays mounted. Render Dialog `open={open && !handoff}`; release/unmount modal content/overlay before invoking `api.open`. Do not call normal `onOpenChange(false)`, save/discard, confirm, start, or force-mount a hidden modal. Suppress trigger autofocus only for this transition. A post-unmount continuation/effect must check the same token before opening details.

Pass `{origin: {token, label: '返回批量审阅', onEnd}}`. The facade **arms the origin only after that request reports presented**. A refused open restores the exact source modal from its Promise result, conditional on the still-current source token; it never calls an unarmed origin's `onEnd`. Thus refusal by an already-open dirty shot/asset keeps that preexisting editor and restores the review without clearing either draft. A stale/superseded completion cannot reopen a different review.

For an armed origin, explicit return and normal detail close guard and remove the selected detail first; after that committed removal, invoke `onEnd` exactly once with its token/request ID. The source checks its live mounted session+token, clears handoff, reopens the retained review and restores bookmark/scroll after its modal DOM mounts. Show the return action in **both** docked and full-width layouts; the shared narrow return bar alone is insufficient. Pending review work may settle in the retained controller while away, preserving its receipt/error.

When a new detail request successfully replaces an origin-owned selection, retire the old origin with `reason:'replaced'`; **do not automatically reopen its modal over the new detail**. Its source clears the handoff presentation marker, keeps the review controller/draft and leaves ordinary “打开” reachable. There is no implicit origin inheritance to another entity/request. A request cancelled by the outgoing guard does not retire that outgoing origin. A later explicit source reveal while still handed off uses `returnToOrigin(token)` and the detail guard; a source with an already retired token simply opens its own retained review. This prevents two batches or late close callbacks from resolving the wrong return token.

### Smallest four-asset exports and implementation order

Library's cross-feature exports need only `features/library/models/assetDetailTarget.ts` (`AssetDetailTarget`, `assetDetailHref`) and `features/library/ui/AssetDetailPanel.tsx` (`AssetDetailPanel`). Suggested target is `{kind:'character'|'scene'|'prop'|'style'; owner:{kind:'studio'}|{kind:'project';projectId:string}; entityId:string}`; Library alone converts the owner to its sentinel. The app parser admits only exact existing canonical project/studio routes.

Within Library, extract the four existing field/slot bodies from `{Character,Scene,Prop,Style}DetailPage.tsx` into their corresponding private bodies, used by both route pages and `AssetDetailPanel`. One private finite `AssetDetailContent` selects the exact typed query/body; no table-name dispatch or generic form registry. Keep the existing patch/slot CAS commands and labels. `CharacterDetailPage.tsx:26-41,60-83` shows the scoped envelope and real slot/field commands to reuse.

`AssetTextField.tsx:8-29` needs optional `unavailable` and synchronous `onDepartureState` support, following `app/drafts/TextDraftField.tsx:24-51`. Its draft callback must report before queued state, disable unavailable retry/writes, and preserve frozen scope/baseline. Aggregate slot and text state exactly as the shot owner does; retain a matching dirty snapshot with local query error/missing UI. Route and panel reuse the same actual field bodies; none of those private bodies needs an app-facing export.

Implementation dependency order: (1) land host close reasons/DOM presentation hook and the small session types; (2) land finite target/parser + real Library body/panel and adapt shot to the session protocol; (3) land the composed facade and current export delegates; (4) wire batch handoff/return to those already available exports, then migrate other chosen link consumers. Keep named export/ownership records synchronized with actual uses. This order prevents consumers landing against missing interfaces. No Agent loop/query/scroll ownership, provider, schema, package or build change is needed.

## Caveats / Not Found

- Current host has no precise admission/refusal result; inferring success from setState, `onClose`, an arbitrary timeout or target existence would be unsafe. The proposed small callback additions are necessary protocol work.
- “Presented” is DOM commitment of the selected frame, not pixel paint or successful business read. Exact owner verification remains inside each feature.
- This is a concrete proposal for the already bounded shot/four-asset/batch slice. No additional product preference or permission question is required; later entity families remain in the prior coverage inventory.
- No tests/builds were run and no files outside this research artifact were changed. All paths other than `.trellis/` are relative to `packages/studio/src/` where abbreviated above.

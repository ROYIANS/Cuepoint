# E16 application composition and shot implementation

## Result

One finite BusinessDetails facade now composes independently retained shot and asset family owners. Existing ShotDetailsProvider, ShotDetailLink and useShotDetailActivation delegate to that facade, so existing recognized links widen to the four supported asset kinds without scattering handlers. Real anchors, publisher/caller cancellation, explicit typed-target agreement, download/modifier/middle intent and intentional workflow destinations remain intact. The parser admits only the canonical/hash shot and four-asset project/Studio routes; actual feature queries retain authorization.

The app serializes open/return attempts with request IDs. An open resolves only after the exact selected connected frame commits, including its owned loading/missing state. Refusal restores the accepted same-family selection, or removes only the unadmitted incoming family. Lazy incoming-family failure resolves unavailable while the outgoing editor and origin remain available. Feature guards retain frozen drafts and command ownership; the shot editor body and commands are unchanged.

Origin callbacks arm only after presentation. Guarded explicit return and ordinary close remove the detail before notifying the origin. Successful same/cross-family replacement retires the old origin with replaced; it does not reopen the source over the next detail or inherit its token. A commit revision binds queued notifications to the render containing the removal, because a child passive effect can request closure while the parent still has an older effect queued. Provider layout cleanup rejects stale feature callbacks; deferred teardown settles a pending open as superseded without returning an origin. StrictMode setup replay cancels that teardown.

ContextPanelHost close callbacks now distinguish replaced, guard-refused and busy; boolean-only ContextPanel consumers stay compatible. ContextPanelContent consumes onPresented only after connected shown DOM, and showReturnWhenDocked/onReturn supply an explicit origin action in both layouts. A visible docked origin return keeps focus across docking instead of being mistaken for the default hidden return bar.

ContextPanel registration cleanup now runs one microtask after actual cleanup, protected by its registration generation. An immediate effect setup replay replaces the registration and cancels the old cleanup, preserving a pending outgoing guard instead of requesting it twice. The host register API itself still unregisters synchronously and retains its existing stale acceptance tests. No fixed delays were introduced.

## Necessary verification

- Explicit machine pnpm: `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm`.
- Direct Vitest: businessDetailTarget, businessDetails, businessDetailUnavailable, shotDetailPanel, shotDetailQueryLifecycle, shotDetailTarget, contextPanelCoordinator, contextPanelDom, e01ManualDraftDeparture: **9 files / 95 tests passed** (2026-10-15 19:37 CST).
- Following the final lint-compatible registration lifetime object adjustment, direct Vitest businessDetails + contextPanelDom + contextPanelCoordinator: **3 files / 19 tests passed**, no React act warnings (19:38 CST).
- Direct changed-source ESLint over all seven production files below: **exit 0, no diagnostics**. The prior diagnostic about cleanup reading a ref was fixed by capturing the stable lifetime object in effect setup; no suppression or rule change.
- Direct `tsc --project tsconfig.app.json --noEmit --pretty false`: **exit 0**. This run was already started before main consolidated the final cross-worker types/architecture run; no additional types run was scheduled.
- First new DOM run exposed an origin callback before removal and a StrictMode duplicate registration guard. Tests reproduced both, implementations were fixed, and focused final regressions pass. Tests warm actual feature modules inside act only to control React.lazy scheduling; production remains lazy.

The new facade DOM cases cover loading-frame acknowledgement before business read completion, outgoing invalid-duration DOM retention on same/cross-family refusal, competing opener busy, accepted cross-family replacement retirement, same-target origin replacement without editor remount, guarded return/refusal/stale token, normal close, visible origin return at both widths, StrictMode pending registration, actual provider teardown, and existing link delegates with modifiers/download/typed mismatch/caller cancellation. The separate unavailable suite injects an incoming module failure and verifies the accepted outgoing frame/token remain usable.

## Scope and integration

Batch actual consumers use useBusinessDetails, BusinessDetailTarget, readBusinessDetailTarget and DetailReturnOrigin from BusinessDetails.tsx. The shared detailPanelSession module exports only DetailPanelRequest, DetailPanelOutcome, DetailPanelClose and DetailPanelCloseRequest. Main owns exact ledger/spec/task updates and Git. No private Library form or parser is published for batch consumers.

The old shot fixture competing B/C assertion now proves the new explicit serialized contract: frozen B is admitted after discard while C reports busy, rather than silently retargeting an already pending confirmation. Existing query, CAS, pending, deletion and media guard assertions stay intact.

Full builds, broad root wrappers/suites, packaged/native checks, paid providers and complete Agent/modal browser interaction remain deferred under the user-selected batch boundary. These actual ReactDOM + fake IndexedDB tests establish their bounded DOM/lifecycle/store assertions; they do not prove paint, native WebView behavior or complete physical keyboard/touch interaction.

## Frozen owned input SHA-256

| Path | SHA-256 |
| --- | --- |
| `packages/studio/src/app/layout/ContextPanelHost.tsx` | `e7eb233352fc8fe4cccb43fc3d810aa30f7cb8cef3c4b6d9b68ee6ed5fe15493` |
| `packages/studio/src/app/layout/context-panel.tsx` | `05751be8b2cb47f154b291f32d4f7c491ea29e29986d0764aa17bf08a07c13a1` |
| `packages/studio/src/app/layout/detailPanelSession.ts` | `554ed21da4a267791a2e11a6cc2779fb83ce95d6db7ff2bebbec0926b0b8ad0a` |
| `packages/studio/src/app/details/BusinessDetails.tsx` | `80d9aeff6d0c86f553fad8aea6dad541c15ea03dbdc8f7203e5c59771e33b46b` |
| `packages/studio/src/app/details/businessDetailTarget.ts` | `9245336a18c4f1689a344b36c96fc99acdc926c66624d9924c596e5a6533d5e3` |
| `packages/studio/src/app/details/ShotDetails.tsx` | `40aa3d7b0f76697cf74d817e14d7c2baf7ddaad9672f03ce035e3d13bd39d942` |
| `packages/studio/src/features/video/ui/ShotDetailPanel.tsx` | `d93814b6218c708430f38df4bd8fff6eb44dd1de79baf7da0d32d9ec444f3a6e` |
| `tests/businessDetailTarget.test.ts` | `2399a26b978ad7be445882db3e2281ce10b353636b1916c0b4133ab6ec73a82c` |
| `tests/businessDetails.test.ts` | `f8b7aa7dfcda929284a9228796d0d357e741e4eabc867603d3788c793173c752` |
| `tests/businessDetailUnavailable.test.ts` | `c297498cc007263189fe84c60ed2e80f538eb7f3eadc1859ca6a96446b06ea6c` |
| `tests/contextPanelCoordinator.test.ts` | `6c52038f818cac753b9982e1fc2b281418d235ec82264abbd485688ece5d9898` |
| `tests/contextPanelDom.test.ts` | `836371744a06c9504db5227912184ef0376214664d3f718e43af048e072b8a6b` |
| `tests/shotDetailPanel.test.ts` | `23ca939c5b1b3d0db8ce9f1fb17acd6524898ffc67cb55d3d0a189d7e03f307b` |
| `tests/shotDetailQueryLifecycle.test.ts` | `6280fcc3011253b7dda8479a0979959be392d708032187acfe81831d1337e061` |

Read-only native cold readiness supplement, 2026-10-09.

Main `reviews/E07-current-native-01` failed at the initial `page.goto` waiting for `load` with the original10s timeout. No business assertion executed. Independently compared all994 before/after input hashes: equal. The failure is retained. A simultaneous typed baseline scan is reported context, not measured cause. The log contains no unresolved-request/resource timings, so CPU/scanning/network/module root causes cannot be inferred.

The successful side E01 subset uses the permanent actual offline Dexie fixture and unchanged four selected business assertion callbacks. Before browser creation, it explicitly set `holdUntilCrawlEnd:false`, awaited scanner/discovered processing, transformed `/tests/fixtures/e01-drafts/harness.tsx`, and waited for requests idle. It then passed4 cases, zero page errors, one main document. Its7543ms logged preflight covers only the optimizer phase; transform/idle time was not separately measured. Writer chat05 adds a second scanner/discovered-processing wait after transform/idle and logged2705ms for its full preflight, but that different fixture cannot establish E01 cause.

Concrete readiness sequence for a fresh attempt, only if main adopts this bounded runner change:

```js
// Keep actual fixture entry, plugins, fresh isolated cache and all UI assertions.
// Set optimizeDeps.holdUntilCrawlEnd:false when using the waits below.
await server.listen();
const optimizer = server.environments.client.depsOptimizer;
await optimizer?.scanProcessing;
await Promise.all(Object.values(optimizer?.metadata.discovered ?? {})
    .map(info => info.processing));
const transformed = await server.transformRequest(
    "/tests/fixtures/e01-drafts/harness.tsx");
assert(transformed, "actual E01 fixture transform must complete");
await server.waitForRequestsIdle();
await optimizer?.scanProcessing;
await Promise.all(Object.values(optimizer?.metadata.discovered ?? {})
    .map(info => info.processing));
// Launch the browser only now. Existing10s/default load goto remains intact.
```

Installed Vite7.3.6 declares `waitForRequestsIdle` experimental. Its stated contract is processing the static imports after first transformRequest; the server delegates to client environment. The installed first-crawl completion promise resolves after50ms idle and is not an ongoing all-resource readiness barrier. Dynamic imports, CSS/font network, browser evaluation, top-level async IndexedDB and document load still require the original browser checks. Invoke this sequence outside transform/load hooks. `holdUntilCrawlEnd` defaults true in installed Vite; pre-waiting on discovered processing without the explicitfalse option must not be treated as safely independent of crawl.

Keep one fresh server/cache/browser/context per attempt. Transforming on server adds no browser document request and evaluates no fixture DB initialization. Require stage success and retain failure; do not add a warm browser navigation, reload, alternate source, increased UI timeout, different goto condition or assertion changes. Capture each optimizer/transform/idle stage duration separately. Before goto, attach request/finished/failed and pageerror listeners; on a failure save unresolved URL/resourceType/frame plus documents list. These diagnostics can locate future delays but cannot retroactively prove the first failure cause.

`native-readiness-review.json` contains exact main failure/input/API/producer hashes and structured limits. No permanent runner or product edit was made.

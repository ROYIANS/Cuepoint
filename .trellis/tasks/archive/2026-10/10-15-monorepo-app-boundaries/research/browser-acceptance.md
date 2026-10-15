# Built Browser Acceptance — Child 1

## Executed scope

Main session used the cached Chrome/151.0.7922.34 through raw Chrome DevTools Protocol, Node24.11.0 and a separate local Vite preview on port5319. A new temporary user-data directory isolated IndexedDB/preferences from the owner's browser. The profile, browser and preview were closed/removed after each run. The verifier lived outside the repository; no product code or dependency was added for this check.

At 1440x900, direct document navigation/reload of `/agent`, `/projects`, `/settings` and `/assets` reached the actual built shared Studio. Assertions required the exact requested pathname, page controls, expected current empty-state/settings text, no storage/open error screen and zero Runtime exceptions. Settings' actual switch reported aria-checked=false; IndexedDB enumeration contained the sole product namespace `aifenjing`.

## Result

All four routes passed. Agent correctly requested initial connector configuration; projects/materials showed current empty inventories; settings showed default automatic update checks off. This exercises real React/router/browser storage startup and built asset loading, without paid model work or the owner's data.

Build identity at verification:

- HTML: `apps/web/dist/index.html`, SHA-256 `a0f24a79084198d9aff505587e539ac665ed167d574d6a057becdf8a1940ff67`.
- Entry: `/assets/web/index-Butkrwy3.js`, SHA-256 `e18999b01e811020364cfb56a6c129180c776edce1ef1aeb6e35ba5cbcb1b722`.

Re-run if subsequent implementation changes these inputs or final runtime configuration. This observation does not freeze all source or claim the final child gates have already passed.

## Failed verifier attempt and limits

The first temporary verifier used an arbitrary minimum visible-text length and timed out on the healthy short Agent empty state. Inspection showed a correctly rendered page and zero exceptions; the readiness assertion was replaced with expected current content and the complete final run passed. No product fix or longer product timeout was introduced.

This is browser startup/route-refresh proof for the named built surfaces. It does not establish native WebKit, installer/Save, provider execution, media workflows, persistent user-data recovery, site-root Nginx deployment or other devices. Those retain their separate task acceptance requirements. No permanent raw browser log/screenshot/profile is retained.

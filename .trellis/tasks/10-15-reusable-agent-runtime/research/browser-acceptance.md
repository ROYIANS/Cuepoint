# Normal built browser and Agent acceptance

Status: **accepted for the current final source and built browser**. The latest
complete normal-product/Agent run below follows both the Desktop and native
transaction-spy test-fixture repairs and binds the latest whole-quality receipt. The earlier successful run remains
historical evidence; it is not substituted for this current input comparison.

## Real execution

The main session ran `/tmp/cuepoint-agent-browser-final.mjs` with
`AGENT_QUALITY_RECEIPT=/tmp/cuepoint-agent-native-repair-checks/quality.json` against the
new normal `apps/web/dist` build. It starts actual Vite preview processes and
Chrome **151.0.7922.34** using fresh disposable profiles. Normal product
operations use the visible forms/buttons and actual IndexedDB. Agent
configuration seeds only disposable connector/thread records; all tested sends,
approvals, rejections, Stop and resume execute the actual UI/product commands.

Raw report:
`/var/folders/m6/x3vx_lld0kg8rcgth931pll40000gn/T/cuepoint-agent-browser-final-bdrvZc/report.json`.
SHA-256: `5d94ea354cf82b5a3dc88c719df4469618f11324628fc64a30876db1d892c967`.
Run: `2026-10-15T06:31:09.319Z`–`2026-10-15T06:31:23.558Z`.

The wrapper verifies every one of the **1343 current quality input hashes**
before and after, verifies actual reusable package freshness, and compares all
**625 Web output hashes** before and after. Both comparisons passed without
drift. The actual HTML script is `assets/web/index-DThtrQvY.js`, SHA-256
`6d1990170a002bc0513471037dfbfe21ada7ae829ed0bbfc423d580cd7e7019e`.

## Normal product assertions

- Agent, Settings and Materials routes load their ordinary empty-state UI.
- Actual forms create Audio, Music and Video projects and navigate into their
  correct workspaces. A fresh profile ends with three persisted projects of
  the three respective kinds.
- The Audio UI adds its second chapter, reloads and retains both chapters and
  both tracks. Read-only actual IndexedDB inspection confirms counts 3/2/2.
- No page exceptions or failing same-origin HTTP resource responses occur.
  This does not claim that every external service was exercised.

## Agent assertions

- The normal tool-loading path offers the project tool. Its real write parks
  for approval with zero project mutation. Reload preserves that waiting run
  with zero additional model POST.
- Clicking the actual approval button produces one completed `project_create`
  result and one real Audio project. The run completes through the shared core.
- The actual rejection button saves a rejected call and completes without
  creating another project; the database retains only the approved project.
- `workspace_overview` finishes once. The following deterministic stream saves
  partial answer text. Clicking Stop preserves that output and interrupts the
  run. Reload adds zero model POST; expanding execution and clicking explicit
  resume completes from the saved read result without repeating the tool.

All four Agent scenarios pass using **11 deterministic local model POSTs**.
There are no page exceptions and no failing same-origin HTTP responses. Thirty
external font/icon requests are explicitly blocked by the test router (origins
`https://fonts.googleapis.com` and `https://registry.npmmirror.com`); they are
recorded, not described as successful remote resource checks. No paid provider
is contacted. The main session inspected the actual final resumed screenshot,
which shows the retained completed read and final answer in the normal UI.

## Boundaries

This acceptance exercises the normal built browser and its actual product
storage/commands. It does not prove paid-provider quality, native WebView or OS
Save/reopen, every viewport, microphone or decoded media playback. Actual SQLite
process death and complete real-native storage semantics have separate lanes.
All preview/model processes exit and disposable browser profiles are removed.

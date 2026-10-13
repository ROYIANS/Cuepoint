# Implementation Boundary — 2026-10-13

The gap is shared shell hierarchy: the current edge-to-edge frame and wide desktop navigation do not match the approved fixed icon rail, external top bar and rounded working surface. This presentation lives in AppFrame/styles and the Agent/workspace header owners; macOS native traffic lights are configured in the real desktop builder.

Frontend ownership is AppFrame/header bridge/nav silhouettes/styles, Agent home/detail/topic presentation, WorkspaceChrome header integration, and meaningful existing harness traversal updates. Native ownership is desktop builder/startup marker/capabilities and windowChrome.ts. Main owns task artifacts, specs, independent browser/macOS visual verification and final integration.

No business commands, ProductStore schema, provider protocols, data-profile identity, dependencies or publishing behavior are changed. Existing feature queries, guards, drafts, execution/playback owners and action closures stay in place. Moving headers through a stable React portal retains provider context. Actual menu, draft, resize and print checks establish behavioral preservation; snapshots of CSS do not.

Two implement sub-agents work on disjoint files and coordinate the getWindowChromeKind contract. Generated caches/logs and screenshots stay outside Trellis task records; concise authored conclusions remain here.

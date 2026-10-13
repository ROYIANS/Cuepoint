# Desktop Shell UI Design

## Presentation structure

`AppFrame` owns a stable shared top bar, desktop global icon rail, mobile application Sheet and one rounded working surface. Use an approximately 44px top row, 56px rail, 8px working-surface inset and 16px surface radius as initial values, adjusted through actual visual verification. Project tabs can add a second header row on narrow screens; do not force them into an inaccessible fixed height.

Shell/chrome surfaces should be slightly lighter than the working canvas, following the reference's neutral hierarchy. Preserve existing body typography and control tokens. Introduce only shell-specific tokens when appropriate; do not recolor every feature panel or broaden the Agent theme.

The rounded surface clips feature bodies but adds no scroll owner. `contentScroll` keeps its current auto/hidden contract. Agent keeps transcript scrolling and composer measurements; WorkspaceChrome keeps its video/audio/music scroll ownership.

## Header bridge

Create a small presentation-only header context/portal bridge under `AppFrame`. Its DOM target remains stable throughout the frame's lifecycle. Feature owners render their actual header JSX through the portal, preserving React provider context and action closures. It holds no ProductStore access, route data, Agent execution state or new business owner.

- `ChatWorkspace` moves the existing conversation title/menu/task action/topic toggle into the shared top bar. Agent home uses the same bridge for its relevant topic actions. Keep the Agent page, draft, composer and execution host mounted.
- `WorkspaceChrome` portals its existing guarded workspace-header JSX, retaining title, tabs, backup/settings callbacks and pending/missing behavior. A custom slot suppresses the fallback section title.
- Ordinary Studio pages use a section-level fallback title in the top bar, while preserving page headers, counts, search and editor actions inside the working surface.
- Mobile uses the same header target with CSS changes, not alternate feature trees. The left navigation trigger remains a native button; Agent topic navigation stays a right Sheet.

Portal content needs a dedicated scoped Agent style host without becoming the first ambiguous `.agent-chat-root` popup target. Use an explicit compatible popup host/ref and ensure menu/overlay DOM is outside shell clipping. The body retains its existing theme root and provider context. Remove the old absolute ChatHeader mask, transcript header offset, mobile hamburger reservation and turn-navigation offset only where the header has moved. Preserve expanded-composer presentation and safe bottom space.

## Navigation icons

Preserve the `NAV` destination and active predicates. General UI symbols use official @remixicon/react 4.9.0, with matched Line/Fill family components for the seven global navigation destinations. Replace all application Lucide imports and the hand-written selected SVGs; preserve model/provider logos and custom measurement graphics. A small statically imported semantic mapping adapts LobeHub transparent-fill/stroke forwarding so Remix paths remain visible; it must preserve size/color/aria/ref. Lucide remains a development dependency only for immutable historical comparisons.

Desktop rail is fixed at all widths >=768px. The Agent sidebar toggle has one meaning: topic-list collapse/expand. A tooltip and accessible name identify every global icon. Utility actions stay reachable at short window heights, and selected icon presentation does not replace focus-visible rings.

## Native macOS chrome

The main Tauri window is built from config in `desktop/tauri/src-tauri/src/desktop.rs:1693`. Configure macOS with native decorations, `TitleBarStyle::Overlay`, hidden title and calibrated native `traffic_light_position`. The initial 16x24 logical position is a calibration candidate, not acceptance evidence. Retain existing data-store identity and startup scripts.

Expose a frozen presentation-only platform/chrome marker from trusted Rust initialization if needed to reserve macOS traffic-light space. Keep it separate from the fixed storage-owner profile. Browser fallback must perform no native commands.

Use pinned Tauri's drag-region support, with a draggable blank/topbar region and explicit interactive exclusions. Add only `core:window:allow-start-dragging` and `core:window:allow-internal-toggle-maximize` when required by the actual integration. Real native traffic lights handle closing/minimizing/maximizing; no broad window capability or HTML replicas are needed.

Windows/Linux retain native decorations. They receive the same shared application layout without macOS spacing. A future frameless-window task would require actual host proof for system menus, snapping and resize behavior.

## Compatibility and rollback

No persisted schema, storage adapter, provider or data-profile identity changes. The approved icon follow-up adds one pinned Remix React dependency. Existing topic-collapse session state can be retained. Presentation changes are reversible as one shell feature; do not restore superseded no-rounded-frame spec statements after acceptance.

Risk areas are header portal ownership/theme, clipping, duplicate header height, draft retention, small-window actions, native drag interception and print overflow. Resolve failures in those owners rather than relaxing guards or replacing business harness assertions.

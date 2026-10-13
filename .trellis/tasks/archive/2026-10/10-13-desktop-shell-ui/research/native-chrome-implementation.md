# Native chrome implementation — 2026-10-13

## Change and boundary

The actual normal-product `WebviewWindowBuilder` now uses macOS native decorations with `TitleBarStyle::Overlay`, a hidden title and the calibrated logical traffic-light inset `(16, 24)`. The initial `(16, 17)` was refined after the user's side-by-side native screenshot. Windows/Linux keep the existing native title bar and profile-directory branch. Storage profiles, SHA-256 data-store identity, main navigation restrictions and product services are unchanged.

Native initialization separately installs the immutable, frozen `__CUEPOINT_WINDOW_CHROME__ = {version: 1, kind: "macos-overlay" | "native"}`. `getWindowChromeKind()` uses genuine Tauri runtime detection before reading this presentation marker, performs no IPC, ignores incidental browser globals and never derives chrome from the storage profile or user-agent string. An absent/unknown native marker uses ordinary native layout without reserving traffic-light space.

The main capability adds only `core:window:allow-start-dragging` and `core:window:allow-internal-toggle-maximize`. Native traffic lights own close/minimize/fullscreen; no renderer replicas or broad window permission set was introduced.

## API evidence

The pinned local Tauri 2.12.2 builder source confirms the macOS-only Overlay, hidden title and traffic-light-position APIs. Its bundled `drag.js` supports `data-tauri-drag-region="deep"` and explicit `"false"` exclusion, and blocks interactive tags, roles and focusable controls. Native macOS double-click maximization happens on mouseup and cancels when the pointer moves. The current [official configuration reference](https://v2.tauri.app/reference/config/#trafficlightposition) confirms traffic-light positioning requires Overlay and decorations; [window customization](https://v2.tauri.app/learn/window-customization/) documents the two required window actions, although its direct-element drag note predates the pinned implementation.

## Checks and remaining evidence

- `tests/windowChrome.test.ts`: 7 passing cases cover browser/no-window behavior, both independent storage modes and ordinary/unknown native chrome, with zero native calls.
- Helper-only ESLint passes. Including the test path in the initial command produced an ignored-file warning because the configured ESLint scope excludes tests; the corrected helper command passed, while Vitest covers the test file.
- Pinned Rust 1.99.0 and aarch64-apple-darwin toolchain were already available through the existing local tool resolver; no dependency/toolchain changes were required.
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` passes. The first invocation used the wrong manifest path relative to the resolver's desktop working directory; the corrected invocation passed.
- The initial locked normal `product-sqlite` `cargo check` compiled the pinned dependencies and reached `generate_context!`, then failed because yesterday's cleanup removed `desktop/tauri/dist/normal`. The main session subsequently generated the genuine frontend bundle. `cargo clippy --manifest-path src-tauri/Cargo.toml --locked --features product-sqlite --all-targets -- -D warnings` then passed, compiling the normal non-test-hooks window builder, and the repeated Rust format check passed. HTTP vendor code still emitted its existing unused `app`/`event` warnings at `vendor/tauri-plugin-http/src/lib.rs:136`; these dependency warnings did not block the crate gate, and vendor sources were not changed.
- The main session's packaged inspection established actual window controls, fullscreen and blank-header double-click zoom. The screen-sharing indicator obscured traffic lights in its screenshots, while the user's later side-by-side image exposed the initial vertical mismatch. The final calibration below still requires the main session's fresh packaged inspection. Windows/Linux runtime observations remain pending without matching hosts.

## Traffic-light calibration from native evidence

The user compared the actual Cuepoint and Codex windows: the initial Cuepoint native light center was approximately 15 logical pixels below the window top, while the reference's 44px toolbar centers its controls at 22px. The shared toolbar is consequently being adjusted to 44px by the main session.

This parameter is not a literal top-coordinate for the button. Pinned Tauri 2.12.2 stores `traffic_light_position` in the webview attributes; tauri-runtime-wry 2.12.1 passes it to Wry 0.57.0 `with_traffic_light_inset`. In `wkwebview/class/wry_web_view_parent.rs::inset_traffic_lights`, Wry sets the native title-bar-container height to `buttonHeight + y` and its bottom-origin position to `windowHeight - (buttonHeight + y)`. It changes only the button's x position, retaining its native y origin. Tao 0.37.1 `platform_impl/macos/view.rs::inset_traffic_lights` uses the same title-bar height/origin relationship.

Therefore the button's top-relative center increases by exactly the change in `y`, rather than moving upward as a bottom-origin button-coordinate might suggest. If `b` is the effective unchanged button origin in the container and `h` its height, the top-relative center is `y + h/2 - b`; the observed `(y=17, center≈15)` supplies the current native offset `h/2 - b≈-2`. For the new 44px toolbar target, `y = 22 - (-2) = 24`. The bounded Rust edit is thus `(16, 17) → (16, 24)`, leaving x unchanged because the observed horizontal alignment already matched.

This calculation uses the pinned native implementation and the user's actual observed center. It is not a claim of final visual acceptance. The main session owns rebuilding and measuring the resulting light center, including fullscreen/restore and minimum-size behavior; no product defaults, platform marker, permissions, services or other sources were changed for this calibration.

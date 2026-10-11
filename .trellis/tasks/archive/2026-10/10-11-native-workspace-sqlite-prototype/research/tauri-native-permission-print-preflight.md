# Research: Tauri 2.12.2 native microphone permission and print preflight

- Query: Verify release-matched Tauri/wry macOS permission and printing configuration for Stage B's real packaged WKWebView, without starting B or claiming runtime success.
- Scope: official primary source/docs plus read-only current plan and recorder inspection. Ownership is this research file only; no installs, fixtures, product/config/lifecycle/spec/Git edits or application launch.
- Date: 2026-10-11

## Findings

### Current authorization and execution boundary

The complete current plan is human approved and expressly includes **a user-gesture recording of about 3 seconds, kept only in the local fixture workspace**. Earlier research's pending-new-microphone-consent caveats are superseded by that approval. Do not seek the same consent again. Native OS permission dialogs can still require the user's actual click. Stage B implementation/execution continues to wait for independent Stage A acceptance; this file prepares configuration only.

Current plan anchors: `implement.md:15` and `:56`, `design.md:61-62`. Real recorder owner is `src/lib/audio/recorder.ts:46`; its start remains an explicit gesture, not mounting or an Agent tool.

### Exact native dependency/source boundary

Tauri 2.12.2's release uses runtime-wry `~2.12.1`; [runtime-wry 2.12.1 Cargo.toml](https://github.com/tauri-apps/tauri/blob/tauri-runtime-wry-v2.12.1/crates/tauri-runtime-wry/Cargo.toml#L13) requires **wry 0.57.0** with os-webview. Official crate metadata currently reports wry 0.57.0 as stable. Stage A's current Cargo.lock covers the storage-only crate, so this is a source-matched anticipated UI graph, not evidence that Stage B has already resolved/compiled it. Record the actual final Cargo.lock versions after adding the GUI dependencies; re-check source if resolution changes.

### Microphone has separate origin, WebKit, OS and app-policy gates

1. **Origin/API exposure.** [W3C Media Capture and Streams](https://www.w3.org/TR/mediacapture-streams/#navigator-interface-extensions) marks navigator.mediaDevices as SecureContext. Tauri's [useHttpsScheme configuration](https://v2.tauri.app/reference/config/#usehttpsscheme) is a Windows/Android HTTP(S) origin setting; it does not turn macOS custom protocol into HTTPS. In the actual packaged window record href/origin, `isSecureContext`, mediaDevices/getUserMedia, MediaRecorder and supported MIME types before requesting capture. Do not infer success from localhost spelling, Vite dev-server behavior or a Safari test. No unsupported private WKPreferences bypass is proposed.
2. **WebKit site permission.** The wry delegate participates in media permission decisions; this is separate from Tauri command ACL and OS authorization.
3. **OS TCC/application metadata.** A native app must have the microphone usage description and OS authorization. A webview-level Grant cannot bypass these requirements.
4. **Application policy/lifecycle.** Even with persistent permission, only the approved UI gesture starts capture; real recorder cleanup and late-permission-result disposal remain necessary.

[WebKit's MediaRecorder article](https://webkit.org/blog/11353/mediarecorder-api/) establishes WKWebView native-capture prerequisites and feature/MIME detection, but dates from 2020 and focuses on its initial support. Its historical MP4/AAC description is not a current exclusive codec list or proof for this host. Native WKWebView depends on the installed macOS/WebKit; a pinned Tauri crate does not pin that engine.

### Explicit permission handler is needed for predictable behavior

Release-matched [Tauri app builder](https://github.com/tauri-apps/tauri/blob/tauri-v2.12.2/crates/tauri/src/app.rs#L1856) provides:

```text
Builder::on_permission_request(
  Fn(Webview<R>, PermissionKind) -> PermissionResponse + Send + Sync + 'static
)
```

[WebviewWindowBuilder](https://github.com/tauri-apps/tauri/blob/tauri-v2.12.2/crates/tauri/src/webview/webview_window.rs#L437) has the equivalent per-view method. A per-view response other than Default bypasses the global handler. Permission handlers are documented to receive new requests; persistent saved browser decisions may skip them. They must not be used as the only recording lifecycle control.

[runtime-wry integration](https://github.com/tauri-apps/tauri/blob/tauri-runtime-wry-v2.12.1/crates/tauri-runtime-wry/src/lib.rs#L4891) forwards the handler into wry. In [wry 0.57.0's WKUIDelegate](https://github.com/tauri-apps/wry/blob/wry-v0.57.0/src/wkwebview/class/wry_web_view_ui_delegate.rs#L127):

| Native permission response | WKPermissionDecision |
| --- | --- |
| Allow | Grant |
| Deny | Deny |
| Default | Prompt |
| **No handler** | **Grant** |

The Apple callback is available on **macOS 12+**, and the wry source conditionally includes it when macOS 12 availability is not excluded. Apple documents a Prompt default when a native delegate does not implement the method; wry implements the method and supplies its own behavior, so the two defaults must not be conflated. [Apple WKUIDelegate documentation](https://developer.apple.com/documentation/webkit/wkuidelegate/webview(_:requestmediacapturepermissionfor:initiatedbyframe:type:decisionhandler:)) was checked through its first-party DocC JSON for availability and default discussion.

Recommended Stage B configuration: register an explicit app handler, validate the actual expected main Webview label/current bundled URL, return **Default for Microphone** from that trusted view, and **Deny for camera, combined/unrelated permissions or untrusted views**. This lets WebKit prompt rather than granting by omission. The abstraction passes kind/view, not requesting subframe origin; wry's underlying callback ignores origin/frame parameters. Keep remote navigation, extra windows and frames forbidden by the existing trusted-origin/CSP design; do not claim the handler distinguishes arbitrary embedded-frame origins. No extra microphone plugin or Tauri `allow-microphone` command capability is needed for browser getUserMedia.

If using per-view handlers, avoid conflicting global responses; verify exactly which handler handles the real window. Do not replace wry's whole UIDelegate with a custom ObjC delegate merely to grant permissions: that can disrupt existing navigation/dialog/print behavior and widens scope.

### Info.plist, entitlements and actual permission evidence

Add only the required `NSMicrophoneUsageDescription` string to `src-tauri/Info.plist`, or set `bundle.macOS.infoPlist` to its explicit path. [Tauri macOS config](https://v2.tauri.app/reference/config/#macconfig) merges that plist and also recognizes an Info.plist beside the configuration. Check the **built `.app/Contents/Info.plist`**, not only source metadata. Example meaning: “用于本机验收，录制约 3 秒音频并仅保存到本机项目。” No camera key is needed for audio-only capture.

[Apple NSMicrophoneUsageDescription](https://developer.apple.com/documentation/bundleresources/information-property-list/nsmicrophoneusagedescription) requires the key for microphone access. [Apple macOS capture authorization guidance](https://developer.apple.com/documentation/bundleresources/requesting-authorization-for-media-capture-on-macos) describes per-app persistent authorization and missing-key termination. Use a stable isolated bundle identifier/path for the actual acceptance build and record whether an OS prompt appeared, was accepted/denied, or permission already existed. Profile isolation is separate from OS app authorization. Do not reset system-wide privacy settings to manufacture a prompt.

For the built app's actual signing mode, inspect `codesign -d --entitlements :-` and flags. Tauri defaults `bundle.macOS.hardenedRuntime` to true; [Apple Audio Input entitlement](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.device.audio-input) documents `com.apple.security.device.audio-input=true` for microphone/Core Audio under hardened runtime. Supply a minimal entitlements file through `bundle.macOS.entitlements` when building a signed/hardened acceptance app, and inspect the resulting signature. Do not silently disable hardened runtime to make recording pass. Enabling App Sandbox is a separate packaging design and is not required by this bounded local prototype; do not add it or unrelated filesystem/camera entitlements here.

The existing `MicrophoneRecorder` already negotiates `[audio/webm;codecs=opus, audio/ogg;codecs=opus, audio/mp4, audio/webm]` (`recorder.ts:26`), uses the actual recorder.mimeType (`:147`), and captures final data/stop before returning a Blob. Stage B should use the real browser dependencies, not injected fake devices/recorder. Record the actual MIME, elapsed interval, bytes and decoded duration; save only local managed bytes and confirm tracks/nodes/context release after stop/dispose. [W3C recording specification](https://www.w3.org/TR/mediastream-recording/) supports checking MIME rather than assuming a fixed encoding. If the origin/API, permission, constructor or decode fails, retain the actual error as a failed/pending packaged gate rather than substituting generated audio and calling it microphone acceptance.

### Printing: window.print is already a Tauri IPC shim on macOS

Critical release-matched behavior:

- [Tauri webview plugin](https://github.com/tauri-apps/tauri/blob/tauri-v2.12.2/crates/tauri/src/webview/plugin.rs#L196) injects its print shim on macOS/iOS.
- [The actual shim](https://github.com/tauri-apps/tauri/blob/tauri-v2.12.2/crates/tauri/src/webview/scripts/print.js#L5) replaces window.print with an invocation of **`plugin:webview|print`**.
- [Tauri generated permission reference](https://github.com/tauri-apps/tauri/blob/tauri-v2.12.2/crates/tauri/permissions/webview/autogenerated/reference.md#L154) defines **`core:webview:allow-print`**. Its default permission list at the same file's start excludes print; [build.rs](https://github.com/tauri-apps/tauri/blob/tauri-v2.12.2/crates/tauri/build.rs#L145) marks print false for default inclusion.

Thus the existing `StoryboardPrintPage.tsx:101` window.print button needs **main-window capability `core:webview:allow-print`** for that path. Merely granting core:default does not establish print access. A rejected shim promise is an ACL failure, not evidence that WKWebView cannot print. Explicitly scope this permission to the existing trusted window and keep navigation/new-window restrictions. No print plugin/dependency is required.

The approved alternative is a narrow app command that validates its injected caller WebviewWindow, then calls [WebviewWindow::print()](https://github.com/tauri-apps/tauri/blob/tauri-v2.12.2/crates/tauri/src/webview/webview_window.rs#L2427). In that case grant its own generated app-command permission, rather than an unrestricted window-label/payload interface. Choose and test one deliberate UI bridge; do not bypass all command ACL just because an initial print attempt rejects.

### Native print limitations and preview gate

[wry 0.57.0 print implementation](https://github.com/tauri-apps/wry/blob/wry-v0.57.0/src/wkwebview/mod.rs#L879) calls Apple's `printOperationWithPrintInfo:` when the selector exists, creates a modal operation on the actual NSWindow, and sets default margins from PrintOptions. Its source identifies **macOS 11+**; [Apple printOperation documentation](https://developer.apple.com/documentation/webkit/wkwebview/printoperation(with:)) matches that availability. Critically, this implementation can return **Ok(()) even if the selector is unavailable**. It also does not return a structured “preview accepted/printed/cancelled” result, so success or lack of exception is not preview acceptance.

The wrapper has no documented page-size/orientation control in its simple `print()` API. Keep the existing actual `styles.css:259` A4-landscape rule, 10mm margins, print chrome suppression and full text; because native shared NSPrintInfo/margins and WebKit print CSS interact, verify the actual displayed preview rather than infer effective margins/page size. Wait for live queries, images and fonts before the user print action. Inspect white background, A4 landscape, hidden navigation/toolbar and complete multi-page text with readable automation or user confirmation. A screenshot of normal DOM or an IPC return cannot satisfy this check.

### Related files/specs

- `design.md:61-62` and `implement.md:15,56`: approved bounded microphone and actual multi-page printing.
- `src/lib/audio/recorder.ts:26,35,46,147`: real MIME negotiation, explicit gesture, capture lifecycle and actual Blob type.
- `src/components/produce/StoryboardPrintPage.tsx:101` and `src/styles.css:259`: unchanged real print action and layout contract.
- `.trellis/spec/frontend/audio-music.md`, `delivery-export.md`, `quality-guidelines.md`: real capture/render/print evidence, finite assertions and no silent feature waiver.
- `tauri-prototype-plan-research.md`, `tauri-packaged-fixture-preflight.md`: existing origin/ACL/profile/helper plan. This separate document preserves those curated inputs while correcting the now-obsolete consent caveat.

## Caveats / Not Found

- No actual packaged window, secure-origin check, OS prompt, recorder output, signature/entitlements or print preview was exercised in this research.
- macOS WebKit secure-context/API exposure for the actual custom bundled origin is a runtime gate; no release-source or historical blog reference proves it by itself.
- Source-matched anticipated GUI graph is Tauri 2.12.2 → runtime-wry 2.12.1 → wry 0.57.0; the storage-only current lock is not GUI resolution evidence. Recheck actual final lock and OS availability.
- Permission callbacks may be skipped for persistent saved decisions; they cannot replace user-gesture controls or cleanup. An OS authorization prompt is separate from the WebKit delegate and from Tauri command ACL.
- User consent for the planned local ~3-second recording is already present. Only actual system UI participation or a concrete runtime failure can remain pending; this research introduces no new approval request.
- Independent A acceptance still precedes B implementation/execution. All file writes here are limited to this new research document.

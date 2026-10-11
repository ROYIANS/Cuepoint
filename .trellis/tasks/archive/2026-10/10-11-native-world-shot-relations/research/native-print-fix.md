# Native storyboard print correction

## Result and actual boundary

Source correction is complete and frozen. Current root and desktop gates pass; the real system-print gate remains pending the newly built application. This reviewer did not build or operate the final app, save a PDF, claim physical print completion or close the overall task.

Packaged evidence 68 showed white content without application navigation, but a portrait macOS preview. Shared `src/styles.css` already declares A4 landscape and 10mm margins. This was a system print configuration gap, rather than a missing alternate storyboard renderer.

## Root cause

The pinned Tauri 2.12.2 macOS initialization replaces `window.print` with its core print command. The local `tauri-runtime-wry` 2.12.1 delegate reaches Wry 0.57.0 `wkwebview::print`, which supplies shared `NSPrintInfo` with default margin changes and no explicit A4 paper or landscape orientation. Existing print CSS still supplies the white/no-navigation styling; the portrait system preview does not prove all print CSS was ignored.

The correction uses Apple's typed [`WKWebView.printOperation(with:)`](https://developer.apple.com/documentation/webkit/wkwebview/printoperation(with:)) and [`NSPrintInfo` orientation](https://developer.apple.com/documentation/appkit/nsprintinfo/paperorientation) APIs. The generated objc2 bindings and installed Apple SDK signatures were inspected; the macOS implementation compiled in both normal and acceptance feature configurations. No guessed `msg_send` method signature was used.

## Implementation

- `src/lib/runtimePrint.ts` owns the small shared runtime seam. Browser mode still calls `window.print()` from the existing user control. Native mode awaits the fixed payloadless `product_print_storyboard` command. Native rejection propagates and does not retry using the default print delegate.
- `StoryboardPrintPage.tsx` uses that seam and shows a safe error when dispatch fails. The common page, layout and print CSS remain the renderer; initiating a dialog produces no printed-success toast.
- `native_print.rs` receives the trusted main window, rechecks it inside Tauri's main-thread `with_webview` callback, and borrows live `WKWebView`/`NSWindow` pointers only inside that callback. It requires the documented print selector and rejects an already-attached system sheet.
- The native operation uses a private copy of shared `NSPrintInfo`. It sets portrait A4 dimensions in points, then landscape orientation and all four 10mm margins. It initiates the window-modal operation and sends the callback result through a channel. The command waits for that result instead of resolving merely because work was queued. That result confirms dialog initiation, not cancellation status, printed pages or PDF completion.
- The command is registered in both desktop handlers and both build ACL paths, with permission only in the existing main capability. Non-macOS keeps the existing native delegate; its A4 behavior has no actual acceptance claim here.
- Cargo adds four target-macOS optional direct dependencies at the exact versions already resolved in the lock. Removing just the four added application dependency names recreates the prior lock hash. No new package/version/checksum resolution or vendor source change was required.

The frontend runtime and delivery guidelines now record the executable print contract. The previously recorded audio rules require exact stored numeric durations and visible warnings for `publishedWithError`. Two existing unused-contract evidence hashes were mechanically refreshed for the revised audio guideline; their contract reasons and allowances remain intact.

## Meaningful verification

`tests/runtimePrint.test.ts` has eight cases: browser behavior/error, the exact native command and awaited settlement, native errors without fallback, and the loaded shared page's real print callback/error feedback. Final native IPC and live-query values are injected. These are source/callback tests, not DOM or actual AppKit print observations. Two Rust tests independently check A4 point units, 10mm margins and landscape usable dimensions.

| Gate | Completed result | Raw evidence |
| --- | --- | --- |
| Full root Vitest | 211 files; 3586 passed; one skipped | `native-print-full-vitest-final.log`, 19:23:20 / 37.15s |
| Root TypeScript / strict new test | PASS / PASS | `native-print-root-types.log`, `native-print-test-types.log` |
| Root quality | PASS; 13 reviewed allowances / 567 visible warnings / zero failures | `native-print-root-quality-final.log` |
| Desktop types / lint / quality | PASS / PASS / PASS | `native-print-desktop-{types,lint,quality}.log` |
| Focused source controls | Five files / 63 cases PASS, including eight print cases | `native-print-focused-controls-final.log` |
| Rust suite | 61 PASS: previous 59 plus two paper-policy cases | `native-print-rust-tests-final.log` |
| Normal / acceptance native API compile | PASS / PASS | `native-print-normal-check-final.log`, `native-print-first-check.log` |
| Clippy / format | PASS / PASS | `native-print-clippy-final.log`, `native-print-fmt-final.log` |

All command exits were observed. Successful strict TypeScript/fmt logs are empty; their exit status is recorded in [the verification receipt](native-print-verification.json). Clippy/check logs retain the two existing cookie-disabled upstream vendor unused-variable warnings. The unchanged vendor's 18 actual TCP/resource tests are reused from their original log, rather than described as newly executed. All 27 retained vendor source/provenance files in the historical source manifest were recomputed unchanged, including the three patched files and 22 retained unchanged upstream files.

The first focused run failed because the test's `beforeEach` accidentally returned the reset mock as a cleanup function; the hook was corrected and the final focused/full runs passed. The first quality run failed on the now-stale audio-spec evidence hash; exactly two authorized existing hashes were refreshed and the final quality run passed. Both failed logs are retained and separately identified in the receipt.

## Frozen provenance and open gates

[The 16-path source freeze](native-print-source-freeze.json) records product/config/test/spec hashes and was reverified without drift after all checks. It supplements the earlier full-scope snapshot; it does not rewrite that historical snapshot or prove an earlier app used current source. Root owns new serial builds and system dialog evidence. Later root-owned fixture changes are outside this print correction and need their own follow-up source/evidence receipt; the old fixture annotation finding must not be treated as a fresh finding on those bytes.

New macOS actual preview must confirm landscape A4, margins, white background/no navigation and complete multi-page output. Browser and Windows/Linux actual print behavior, saved PDF/physical completion, final source-to-binary identity and the remaining whole-product UI/provider gates are not closed by these source tests. No user data, provider/Agent/storage behavior, paid requests or fixtures were changed by the print implementation.

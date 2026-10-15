//! Storyboard paper policy; business content and print CSS stay in the shared page.
#[cfg(any(target_os = "macos", test))]
const POINTS_PER_MM: f64 = 72.0 / 25.4;

#[cfg(any(target_os = "macos", test))]
fn storyboard_paper() -> (f64, f64, f64) {
    (
        210.0 * POINTS_PER_MM,
        297.0 * POINTS_PER_MM,
        10.0 * POINTS_PER_MM,
    )
}

#[cfg(all(feature = "desktop", target_os = "macos"))]
pub(crate) async fn open_storyboard(window: tauri::WebviewWindow) -> crate::Result<()> {
    use crate::{Error, desktop::trusted};
    use objc2::{MainThreadMarker, runtime::NSObjectProtocol};
    use objc2_app_kit::{NSPaperOrientation, NSPrintInfo, NSWindow};
    use objc2_foundation::{NSCopying, NSSize};
    use objc2_web_kit::WKWebView;

    let (sender, mut receiver) = tauri::async_runtime::channel(1);
    let caller = window.clone();
    window
        .with_webview(move |platform| {
            let result = (|| {
                // Recheck the original caller after dispatch, before using native objects.
                trusted(&caller)?;
                MainThreadMarker::new()
                    .ok_or_else(|| Error::new("print", "Printing requires the main thread"))?;
                // Tauri's main-thread PlatformWebview supplies live WKWebView/NSWindow
                // pointers. Borrow them only inside this callback, and never retain raw
                // pointers across an await or dispatch them to a background thread.
                let view = unsafe { platform.inner().cast::<WKWebView>().as_ref() }
                    .ok_or_else(|| Error::new("print", "Print webview is unavailable"))?;
                let parent = unsafe { platform.ns_window().cast::<NSWindow>().as_ref() }
                    .ok_or_else(|| Error::new("print", "Print window is unavailable"))?;
                if !view.respondsToSelector(objc2::sel!(printOperationWithPrintInfo:)) {
                    return Err(Error::new("print", "Printing is unsupported"));
                }
                if parent.attachedSheet().is_some() {
                    return Err(Error::new("print", "A system dialog is already open"));
                }
                // The operation owns a private copy; do not change app-wide defaults.
                let info = NSPrintInfo::sharedPrintInfo().copy();
                let (width, height, margin) = storyboard_paper();
                info.setPaperSize(NSSize::new(width, height));
                info.setOrientation(NSPaperOrientation::Landscape);
                info.setTopMargin(margin);
                info.setRightMargin(margin);
                info.setBottomMargin(margin);
                info.setLeftMargin(margin);
                // Typed SDK methods match WKWebView's documented print operation API.
                // No custom delegate/selector/context pointers cross this boundary.
                unsafe {
                    let operation = view.printOperationWithPrintInfo(&info);
                    operation.setCanSpawnSeparateThread(true);
                    operation.runOperationModalForWindow_delegate_didRunSelector_contextInfo(
                        parent,
                        None,
                        None,
                        std::ptr::null_mut(),
                    );
                }
                Ok(()) // Dialog initiated, not proof of print/PDF completion.
            })();
            let _ = sender.try_send(result);
        })
        .map_err(|_| Error::new("print", "Print dispatch failed"))?;
    receiver
        .recv()
        .await
        .ok_or_else(|| Error::new("print", "Print dispatch closed before opening the dialog"))?
}

#[cfg(all(feature = "desktop", not(target_os = "macos")))]
pub(crate) async fn open_storyboard(window: tauri::WebviewWindow) -> crate::Result<()> {
    // Existing platform delegate is retained. A4 behavior requires actual OS acceptance.
    window
        .print()
        .map_err(|_| crate::Error::new("print", "Print dispatch failed"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a4_dimensions_and_ten_mm_margin_use_points_not_pixels() {
        let (width, height, margin) = storyboard_paper();
        assert!((width - 595.275_590_551_181).abs() < 1e-9);
        assert!((height - 841.889_763_779_528).abs() < 1e-9);
        assert!((margin - 28.346_456_692_913).abs() < 1e-9);
    }

    #[test]
    fn landscape_has_a_positive_content_area_after_both_margins() {
        let (portrait_width, portrait_height, margin) = storyboard_paper();
        let (landscape_width, landscape_height) = (portrait_height, portrait_width);
        assert!(landscape_width > landscape_height);
        assert!(((landscape_width - 2.0 * margin) / POINTS_PER_MM - 277.0).abs() < 1e-9);
        assert!(((landscape_height - 2.0 * margin) / POINTS_PER_MM - 190.0).abs() < 1e-9);
    }
}

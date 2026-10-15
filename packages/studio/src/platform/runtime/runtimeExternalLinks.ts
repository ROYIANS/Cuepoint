import {toast} from "sonner";
import {isTauriRuntime} from "./runtimeIdentity";

/** Keep external content in the system browser and the product in its trusted WebView. */
export function installNativeExternalLinks(): void {
    if (!isTauriRuntime()) return;
    const open = (event: MouseEvent) => {
        if (event.defaultPrevented || event.button > 1 || !(event.target instanceof Element)) return;
        const anchor = event.target.closest("a[href]");
        if (!(anchor instanceof HTMLAnchorElement)) return;
        const url = new URL(anchor.href, document.baseURI);
        if (url.origin === new URL(document.baseURI).origin) return;
        if (url.protocol !== "http:" && url.protocol !== "https:") return;
        event.preventDefault();
        void import("./nativeSystemServices")
            .then(({nativeOpenExternalUrl}) => nativeOpenExternalUrl(url.href))
            .catch((error: unknown) => toast.error(error instanceof Error ? `打开链接失败：${error.message}` : "打开链接失败，请重试"));
    };
    document.addEventListener("click", open);
    document.addEventListener("auxclick", open);
}

import {isTauriRuntime} from "./runtimeIdentity";

/** Opens the host dialog; completion does not claim printed or saved PDF bytes. */
export async function printStoryboard(): Promise<void> {
    if (isTauriRuntime()) {
        const {invoke} = await import("@tauri-apps/api/core");
        await invoke("product_print_storyboard");
    } else {
        window.print();
    }
}

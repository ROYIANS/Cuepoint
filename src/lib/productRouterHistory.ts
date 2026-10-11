import {createBrowserHistory, createHashHistory} from "@tanstack/react-router";
import {isNativeWorkspaceRuntime} from "@/lib/nativeWorkspace";

/** Packaged navigation stays on the trusted entry document, including reload. */
export function createProductRouterHistory() {
    return isNativeWorkspaceRuntime() ? createHashHistory() : createBrowserHistory();
}

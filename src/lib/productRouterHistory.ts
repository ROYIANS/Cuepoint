import {createBrowserHistory, createHashHistory, type RouterHistory} from "@tanstack/react-router";
import {isNativeWorkspaceRuntime} from "@/lib/nativeWorkspace";

/** Packaged navigation stays on the trusted entry document, including reload. */
export function createProductRouterHistory() {
    const history = isNativeWorkspaceRuntime() ? createHashHistory() : createBrowserHistory();
    // Installed TanStack assigns indices before asynchronous blockers finish and
    // coalesces accepted writes. Serialize public writes, then flush each accepted
    // notification, so physical entries and blocked POP rollback stay aligned.
    const push = history.push;
    const replace = history.replace;
    const block = history.block;
    const queue: Array<() => void> = [];
    let writing = false;

    function finish() {
        if (!writing) return;
        writing = false;
        queueMicrotask(runNext);
    }

    function runNext() {
        if (writing || !queue.length) return;
        history.flush();
        writing = true;
        queue.shift()!();
    }

    history.subscribe(({action}) => {
        if (action.type !== "PUSH" && action.type !== "REPLACE") return;
        history.flush();
        finish();
    });
    history.block = (owner: Parameters<RouterHistory["block"]>[0]) => block({
        ...owner, blockerFn: async args => {
            try {
                const outcome: unknown = await owner.blockerFn(args);
                const denied = Boolean(outcome);
                if (denied && (args.action === "PUSH" || args.action === "REPLACE")) finish();
                return denied;
            } catch (cause) {
                if (args.action === "PUSH" || args.action === "REPLACE") finish();
                throw cause;
            }
        }
    });
    history.push = (...args) => {
        queue.push(() => push(...args));
        runNext();
    };
    history.replace = (...args) => {
        queue.push(() => replace(...args));
        runNext();
    };
    return history;
}

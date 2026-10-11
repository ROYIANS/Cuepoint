import {createFileRoute, redirect} from "@tanstack/react-router";
import {isNativeWorkspaceRuntime} from "@/lib/nativeWorkspace";

export const Route = createFileRoute("/_studio/")({
    beforeLoad: () => {
        throw redirect({to: isNativeWorkspaceRuntime() ? "/projects" : "/agent"});
    },
});

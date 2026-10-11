import {createFileRoute, redirect} from "@tanstack/react-router";
import {usesSqliteProductStorage} from "@/lib/productStorage";

export const Route = createFileRoute("/_studio/")({
    beforeLoad: () => {
        throw redirect({to: usesSqliteProductStorage() ? "/projects" : "/agent"});
    },
});

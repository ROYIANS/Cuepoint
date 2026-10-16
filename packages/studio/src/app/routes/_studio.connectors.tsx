import {createFileRoute, redirect} from "@tanstack/react-router";

// Keys and providers now live in settings; keep the old path working.
export const Route = createFileRoute("/_studio/connectors")({
    beforeLoad: () => {
        throw redirect({to: "/settings", search: {section: "models"}, replace: true});
    },
});

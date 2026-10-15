import {createRootRoute, Outlet} from "@tanstack/react-router";
import {Toaster} from "../../ui/sonner";
import {TooltipProvider} from "../../ui/tooltip";
import {UndoProvider} from "../drafts/undo";
import "../../ui/theme.css";

export const Route = createRootRoute({
    component: RootLayout,
});

function RootLayout() {
    return (
        <TooltipProvider>
            <UndoProvider>
                <Outlet/>
                <Toaster/>
            </UndoProvider>
        </TooltipProvider>
    );
}

import {StrictMode} from "react";
import {createRoot} from "react-dom/client";
import {createRouter, RouterProvider} from "@tanstack/react-router";
import {routeTree} from "./routeTree.gen";
import {initUmami} from "@/lib/umami";
import {createProductRouterHistory} from "@/lib/productRouterHistory";
import {installNativeExternalLinks} from "@/lib/runtimeExternalLinks";

initUmami();
installNativeExternalLinks();

const router = createRouter({routeTree, history: createProductRouterHistory()});

declare module "@tanstack/react-router" {
    interface Register {
        router: typeof router;
    }
}

const root = document.getElementById("root");
if (!root) throw new Error("root element missing");

createRoot(root).render(
    <StrictMode>
        <RouterProvider router={router}/>
    </StrictMode>,
);

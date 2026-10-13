import {StrictMode} from "react";
import {createRoot} from "react-dom/client";
import {createRouter, RouterProvider} from "@tanstack/react-router";
import {routeTree} from "./routeTree.gen";
import {initUmami} from "@/lib/umami";
import {getHistoryNavigation} from "@/lib/historyNavigation";
import {createProductRouterHistory} from "@/lib/productRouterHistory";
import {installNativeExternalLinks} from "@/lib/runtimeExternalLinks";
import {initializeProductStorage} from "@/db/database";
import {ErrorFallback, NotFound} from "@/components/errors/ErrorFallback";
import {RootErrorBoundary, RootErrorFallback} from "@/components/errors/RootErrorFallback";
import {ErrorDetailsDialog} from "@/components/errors/ErrorDetailsDialog";
import {installGlobalErrorHandlers} from "@/components/errors/showError";
import {addBreadcrumb} from "@/lib/diagnostics/breadcrumbs";
import {reportError} from "@/lib/diagnostics/reportError";

initUmami();
installNativeExternalLinks();

const router = createRouter({
    routeTree,
    history: createProductRouterHistory(),
    defaultErrorComponent: ErrorFallback,
    defaultNotFoundComponent: NotFound,
    defaultOnCatch: error => { reportError(error, {source: "boundary"}); },
});
getHistoryNavigation(router.history);
router.subscribe("onResolved", event => addBreadcrumb("route", event.toLocation.pathname));
installGlobalErrorHandlers();

declare module "@tanstack/react-router" {
    interface Register {
        router: typeof router;
    }
}

const root = document.getElementById("root");
if (!root) throw new Error("root element missing");

const applicationRoot = createRoot(root, {
    onCaughtError: error => { reportError(error, {source: "boundary"}); },
    onUncaughtError: error => { reportError(error, {source: "global"}); },
    onRecoverableError: error => { reportError(error, {source: "global"}); },
});

async function startApplication():Promise<void> {
    try {
        await initializeProductStorage();
        applicationRoot.render(
            <StrictMode>
                <RootErrorBoundary>
                    <RouterProvider router={router}/>
                </RootErrorBoundary>
                <ErrorDetailsDialog/>
            </StrictMode>,
        );
    } catch (cause) {
        reportError(cause, {source: "boundary"});
        applicationRoot.render(
            <>
                <RootErrorFallback
                    title="工作区无法打开"
                    description="本机存储初始化失败。请关闭应用后重新打开；现有文件会保留。"
                    error={cause}
                />
                <ErrorDetailsDialog/>
            </>,
        );
    }
}

void startApplication();

import {StrictMode} from "react";
import {createRoot} from "react-dom/client";
import {createRouter, RouterProvider} from "@tanstack/react-router";
import {routeTree} from "./routeTree.gen";
import {initUmami} from "@/lib/umami";
import {createProductRouterHistory} from "@/lib/productRouterHistory";
import {installNativeExternalLinks} from "@/lib/runtimeExternalLinks";
import {initializeProductStorage} from "@/db/database";

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

const applicationRoot = createRoot(root);

async function startApplication():Promise<void> {
    try {
        await initializeProductStorage();
        applicationRoot.render(
            <StrictMode>
                <RouterProvider router={router}/>
            </StrictMode>,
        );
    } catch (cause) {
        console.error("Product storage could not be opened", cause);
        applicationRoot.render(
            <main className="flex min-h-screen items-center justify-center bg-background p-8 text-foreground">
                <div className="max-w-lg space-y-4">
                    <h1 className="text-2xl font-semibold">工作区无法打开</h1>
                    <p className="text-muted-foreground">本机存储初始化失败。请关闭应用后重新打开；现有文件会保留。</p>
                    <p className="text-sm text-muted-foreground">{cause instanceof Error ? cause.message : "无法读取工作区"}</p>
                </div>
            </main>,
        );
    }
}

void startApplication();

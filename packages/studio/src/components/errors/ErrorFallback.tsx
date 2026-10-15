import type {ErrorComponentProps} from "@tanstack/react-router";
import {useRouter} from "@tanstack/react-router";
import {Button} from "../ui/button";
import {friendlyMessage} from "../../lib/diagnostics/friendlyMessage";
import {openErrorDetails} from "./errorDetailsStore";

export const AGENT_RETRY_NOTICE = "进行中的执行已保存进度，重试后可继续；输入框中未发送的内容可能丢失。";
const RETRY_NOTICE = "重试前请注意：当前页面内未发送的输入可能丢失。";

function isAgentPath(pathname: string): boolean {
    return pathname === "/agent" || pathname.startsWith("/agent/");
}

/** Presentation shared by the route fallback and its tests; rendered inside the working surface only. */
export function ErrorFallbackView({error, onRetry, onHome, onDetails, pathname}: {
    error: unknown; onRetry: () => void; onHome: () => void; onDetails: () => void; pathname: string;
}) {
    const friendly = friendlyMessage(error);
    return (
        <div role="alert" className="mx-auto flex max-w-lg flex-col gap-4 p-8">
            <h1 className="text-2xl font-semibold">这个页面出错了</h1>
            <p className="text-sm text-muted-foreground">{friendly.title}。页面内容暂时无法显示，其他页面不受影响，你可以从左侧导航切换。</p>
            <p className="text-sm text-muted-foreground">{isAgentPath(pathname) ? AGENT_RETRY_NOTICE : RETRY_NOTICE}</p>
            <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={onRetry}>重试</Button>
                <Button type="button" variant="outline" onClick={onHome}>回到首页</Button>
                <Button type="button" variant="ghost" onClick={onDetails}>查看详情</Button>
            </div>
        </div>
    );
}

/** `defaultErrorComponent`: TanStack renders it at the failed route match, so the shell around the Outlet stays mounted. */
export function ErrorFallback({error, reset}: ErrorComponentProps) {
    const router = useRouter();
    return (
        <ErrorFallbackView
            error={error}
            pathname={window.location.pathname}
            onRetry={reset}
            onHome={() => {
                void router.navigate({to: "/"});
            }}
            onDetails={openErrorDetails}
        />
    );
}

export function NotFoundView({onHome}: { onHome: () => void }) {
    return (
        <div className="mx-auto flex max-w-lg flex-col gap-4 p-8">
            <h1 className="text-2xl font-semibold">页面不存在</h1>
            <p className="text-sm text-muted-foreground">这个地址没有对应的内容，可能已被删除或链接有误。</p>
            <div><Button type="button" onClick={onHome}>回到首页</Button></div>
        </div>
    );
}

export function NotFound() {
    const router = useRouter();
    return <NotFoundView onHome={() => {
        void router.navigate({to: "/"});
    }}/>;
}

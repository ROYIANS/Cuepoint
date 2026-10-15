import {Button} from "../../ui/button";

/** Read failures retain the mounted editor and its drafts until the user retries. */
export function VideoWorkspaceReadNotice({error, retry}: { error?: string; retry: () => void }) {
    if (!error) return null;
    return <div role="alert" className="flex flex-wrap items-center gap-3 border-b px-4 py-3 text-sm">
        <span>读取工作区失败：{error}</span><Button size="sm" variant="outline" onClick={retry}>重新读取</Button>
    </div>;
}

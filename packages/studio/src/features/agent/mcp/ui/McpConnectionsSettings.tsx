import {useEffect, useRef, useState} from "react";
import {Button} from "../../../../ui/button";
import {Plug} from "../../../../ui/icons";
import {McpConnectionsPanel} from "../../ui/McpConnectionsPanel";
import {useMcpManagement} from "./management";

/** The sole named cross-feature Settings entry; model providers remain separate. */
export function McpConnectionsSettings({onEditorOpenChange}: {onEditorOpenChange: (open: boolean) => void}) {
    const [open, setOpen] = useState(false);
    const trigger = useRef<HTMLButtonElement>(null);
    const {owner} = useMcpManagement();
    useEffect(() => {
        const report = () => onEditorOpenChange(!!owner?.isEditing());
        report();
        const stop = owner?.subscribe(report);
        return () => {stop?.(); onEditorOpenChange(false);};
    }, [owner, onEditorOpenChange]);
    return <section className="mcp-settings-entry"><div className="settings-row">
        <Plug aria-hidden/><div className="settings-row-copy"><h3 className="settings-row-title">MCP 外部工具连接</h3><p className="settings-row-description">本地程序与远程工具服务，在对话旁管理连接和授权。</p></div>
        <Button type="button" variant="outline" ref={trigger} onClick={() => setOpen(true)}>管理 MCP 连接</Button>
    </div><McpConnectionsPanel open={open} onOpenChange={setOpen} returnFocus={trigger} returnLabel="返回设置"/></section>;
}

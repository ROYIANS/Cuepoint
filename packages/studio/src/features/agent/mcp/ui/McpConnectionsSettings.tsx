import {useEffect} from "react";
import {McpConnectionsPanel} from "../../ui/McpConnectionsPanel";
import {useMcpManagement} from "./management";

/** The sole named cross-feature Settings entry: the MCP section renders the shared management content in the page. */
export function McpConnectionsSettings({onEditorOpenChange}: {onEditorOpenChange: (open: boolean) => void}) {
    const {owner} = useMcpManagement();
    useEffect(() => {
        const report = () => onEditorOpenChange(!!owner?.isEditing());
        report();
        const stop = owner?.subscribe(report);
        return () => {stop?.(); onEditorOpenChange(false);};
    }, [owner, onEditorOpenChange]);
    // Leaving the section discards an unsaved draft exactly as closing the former panel did.
    useEffect(() => () => owner?.discardDraft(), [owner]);
    return <section className="mcp-settings-entry">
        <McpConnectionsPanel open inline onOpenChange={() => undefined}/>
    </section>;
}

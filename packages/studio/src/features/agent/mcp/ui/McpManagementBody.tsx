import {Button} from "../../../../ui/button";
import {ArrowLeft, Plus, Plug} from "../../../../ui/icons";
import type {McpManagementOwner, McpManagementState} from "./management";
import {McpConnectionEditor} from "./McpConnectionEditor";
import {McpConnectionDetail} from "./McpConnectionDetail";

function MutationNotice({owner, state}: {owner: McpManagementOwner; state: McpManagementState}) {
    if (!state.error) return null;
    const unresolved = state.unresolved;
    let action = <Button type="button" variant="outline" size="sm" disabled={!!state.pending} onClick={() => void owner.refresh()}>刷新连接列表</Button>;
    if (unresolved?.kind === "mutation") action = <Button type="button" variant="outline" size="sm" disabled={!!state.pending} onClick={() => void owner.reconcile()}>核对保存结果</Button>;
    if (unresolved?.kind === "session") action = <Button type="button" variant="outline" size="sm" disabled={!!state.pending} onClick={() => void owner.disconnect(unresolved.serverId)}>检查并断开原连接</Button>;
    return <div className="mcp-notice" role="alert"><p>{state.error}</p>{action}</div>;
}
function ConnectionList({owner, state}: {owner: McpManagementOwner; state: McpManagementState}) {
    const catalogue = state.catalogue;
    return <>
        <div className="mcp-toolbar"><span>{catalogue ? `${catalogue.entries.length} 条连接` : "读取连接列表…"}</span><Button type="button" size="sm" disabled={!catalogue || owner.isPending() || catalogue.entries.length >= 16} onClick={() => owner.edit()}><Plus/>添加连接</Button></div>
        {!catalogue?.entries.length && catalogue && <div className="mcp-empty"><Plug size={28} aria-hidden/><h3>把外部能力接入对话</h3><p>添加本地程序或远程服务，检查它提供的工具和资源，再交给助手使用。</p></div>}
        <div className="mcp-list">{catalogue?.entries.map(row => <div className="mcp-list-row" key={row.serverId}>
            <button type="button" className="mcp-open" disabled={!!state.pending} onClick={() => owner.select(row.serverId)}><strong>{row.label}</strong><span>{row.transport === "stdio" ? "本地进程" : "远程服务"} · {state.generations.some(item => item.binding.serverId === row.serverId) ? "已连接" : "未连接"}</span></button>
            <input type="checkbox" role="switch" aria-label={`启用 ${row.label}`} checked={row.enabled} disabled={owner.isPending()} onChange={event => void owner.toggle(row, event.target.checked)}/>
        </div>)}</div>
    </>;
}
export function McpManagementBody({owner, state, onBack}: {owner: McpManagementOwner; state: McpManagementState; onBack: () => void}) {
    const selected = state.catalogue?.entries.find(row => row.serverId === state.selected);
    let content = <ConnectionList owner={owner} state={state}/>;
    if (selected) content = <McpConnectionDetail row={selected} generation={state.generations.find(item => item.binding.serverId === selected.serverId)} owner={owner} state={state}/>;
    if (state.draft) content = <McpConnectionEditor owner={owner} draft={state.draft} disabled={owner.isPending()} onCancel={onBack}/>;
    return <>
        {(state.draft || selected) && <Button type="button" variant="ghost" size="sm" onClick={onBack}><ArrowLeft/>全部连接</Button>}
        <MutationNotice owner={owner} state={state}/>{content}
    </>;
}

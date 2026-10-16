import {useState} from "react";
import {Button} from "../../../../ui/button";
import {AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle} from "../../../../ui/alert-dialog";
import type {McpServerConfig} from "../models/connection";
import type {McpRunGeneration} from "../models/manifest";
import type {McpManagementOwner, McpManagementState} from "./management";

function McpCapabilityInspection({generation}: {generation: McpRunGeneration}) {
    return <section className="mcp-inspection"><h4>已发现的能力</h4><p className="mcp-hint">{generation.manifest.tools.length} 个工具 · {generation.manifest.resources.length} 个资源。仅显示目录，未调用工具或读取资源。</p>
        {generation.manifest.tools.map(tool => <details key={tool.name}><summary>{tool.rawName}</summary><p>{tool.description || "未提供说明"}</p><pre>{JSON.stringify(tool.inputSchema, null, 2)}</pre></details>)}
        {generation.manifest.resources.map(resource => <div className="mcp-resource" key={resource.handleId}><strong>{resource.name}</strong>{resource.description && <p>{resource.description}</p>}<code>{resource.uri}</code></div>)}
    </section>;
}

function connectionLabels(row: McpServerConfig, generation?: McpRunGeneration) {
    let status = row.enabled ? "未连接" : "未启用";
    if (generation) status = "已连接";
    let authentication = "无需认证";
    if (row.auth === "oauth") authentication = "OAuth";
    if (row.auth === "manual") authentication = "请求头认证";
    return {status, authentication};
}

export function McpConnectionDetail({row, generation, owner, state}: {row: McpServerConfig; generation?: McpRunGeneration; owner: McpManagementOwner; state: McpManagementState}) {
    const [removing, setRemoving] = useState(false);
    const supported = row.transport !== "stdio" || owner.runtime.host.capabilities.stdio;
    const blocked = owner.isPending(), login = state.login?.serverId === row.serverId ? state.login : undefined;
    const {status, authentication} = connectionLabels(row, generation);
    return <div className="mcp-detail">
        <div className="mcp-detail-heading"><h3>{row.label}</h3><span className="mcp-connection-status">{status}</span></div>
        <p className="mcp-hint">{row.transport === "stdio" ? "本地进程 · stdio" : `远程服务 · ${row.endpointDisplay ?? "Streamable HTTP"}`} · {authentication}</p>
        {!supported && <p className="mcp-hint">本地进程连接仅在桌面端可用。请使用 macOS / Windows 桌面端，或添加兼容的远程服务。</p>}
        <div className="mcp-actions">
            <Button type="button" disabled={blocked || !row.enabled || !supported} aria-busy={state.pending === "connect"} onClick={() => void owner.connect(row)}>{generation ? "重新连接" : "连接"}</Button>
            {row.auth === "oauth" && <Button type="button" variant="outline" disabled={blocked || !row.enabled || !supported} aria-busy={state.pending === "login"} onClick={() => void owner.login(row)}>登录授权</Button>}
            {generation && <Button type="button" variant="outline" disabled={blocked} aria-busy={state.pending === "disconnect"} onClick={() => void owner.disconnect(row.serverId)}>断开连接</Button>}
        </div>
        {login?.state === "pending" && <div className="mcp-login"><p>请在浏览器中完成授权，然后检查登录结果。</p><div className="mcp-actions">
            <Button type="button" size="sm" variant="outline" disabled={!!state.pending} onClick={() => void owner.checkLogin()}>检查登录结果</Button>
            <Button type="button" size="sm" variant="ghost" disabled={!!state.pending} onClick={() => void owner.cancelLogin()}>取消登录</Button></div></div>}
        {login?.state === "authorized" && <p className="mcp-hint">登录可用，请连接以读取服务能力。</p>}
        <div className="mcp-detail-settings">
            <label className="mcp-enable"><input type="checkbox" role="switch" aria-label={`启用 ${row.label}`} checked={row.enabled} disabled={blocked} onChange={event => void owner.toggle(row, event.target.checked)}/>启用此连接</label>
            <div className="mcp-actions"><Button type="button" variant="outline" size="sm" disabled={blocked} onClick={() => owner.edit(row)}>替换配置</Button>
                <Button type="button" variant="ghost" size="sm" disabled={blocked} onClick={() => setRemoving(true)}>移除连接</Button></div>
        </div>
        {generation ? <McpCapabilityInspection generation={generation}/> : <p className="mcp-hint">显式连接后，可在这里检查服务提供的工具和资源。</p>}
        <AlertDialog open={removing} onOpenChange={setRemoving}><AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>移除这条连接？</AlertDialogTitle><AlertDialogDescription>将断开“{row.label}”并移除当前设备配置。原有对话和历史结果会保留。</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel asChild><Button variant="outline" disabled={blocked}>取消</Button></AlertDialogCancel><Button variant="destructive" disabled={blocked} onClick={() => {void owner.remove(row).then(() => setRemoving(false));}}>确认移除</Button></AlertDialogFooter>
        </AlertDialogContent></AlertDialog>
    </div>;
}

import {Button} from "../../../../ui/button";
import {Field} from "../../../../ui/field";
import {Input} from "../../../../ui/input";
import {Textarea} from "../../../../ui/textarea";
import type {McpManagementOwner} from "./management";
import type {McpEditorDraft} from "./editor";

function authentication(value: string): "manual" | "oauth" | "none" {
    if (value === "manual" || value === "oauth") return value;
    return "none";
}

export function McpConnectionEditor({owner, draft, disabled, onCancel}: {owner: McpManagementOwner; draft: McpEditorDraft; disabled: boolean; onCancel: () => void}) {
    const update: McpManagementOwner["updateDraft"] = patch => owner.updateDraft(patch);
    const local = draft.transport === "stdio";
    const ready = !!draft.label.trim() && !!(local ? draft.executable.trim() : draft.endpoint.trim());
    return <form className="mcp-editor" autoComplete="off" onSubmit={event => {event.preventDefault(); void owner.save();}}>
        {draft.replacement && <p className="mcp-hint">已有私有配置不能回读。请填写完整替换配置；留空不会沿用原凭据。仅启用或停用连接无需重新填写。</p>}
        <fieldset disabled={disabled} className="mcp-editor-fields">
            <Field label="连接名称"><Input autoFocus value={draft.label} maxLength={128} onChange={event => update({label: event.target.value})}/></Field>
            <Field label="传输方式"><select aria-label="传输方式" className="mcp-select" value={draft.transport} onChange={event => update({transport: event.target.value === "stdio" ? "stdio" : "streamable_http"})}>
                <option value="stdio" disabled={!owner.runtime.host.capabilities.stdio}>本地进程 · stdio{!owner.runtime.host.capabilities.stdio ? "（仅桌面端）" : ""}</option>
                <option value="streamable_http">远程服务 · Streamable HTTP</option>
            </select></Field>
            {local ? <>
                <Field label="可执行文件绝对路径"><Input value={draft.executable} placeholder="/absolute/path/to/server" onChange={event => update({executable: event.target.value})}/></Field>
                <Field label="参数（JSON 数组）"><Textarea className="mcp-code-input" value={draft.args} onChange={event => update({args: event.target.value})}/></Field>
                <Field label="工作目录（可选）"><Input value={draft.cwd} placeholder="绝对路径" onChange={event => update({cwd: event.target.value})}/></Field>
                <Field label="环境变量（JSON 对象）"><Textarea className="mcp-code-input" autoComplete="off" spellCheck={false} value={draft.environment} onChange={event => update({environment: event.target.value})}/></Field>
                <p className="mcp-hint">连接时启动此程序。程序使用当前用户的系统权限；环境变量过滤不等同于文件或网络沙箱。</p>
            </> : <>
                {owner.runtime.host.capabilities.host === "browser" && <p className="mcp-hint">浏览器远程连接需要支持请求流的浏览器、HTTP/2 或 HTTP/3，以及允许此工作区来源的 CORS 配置。服务不兼容时请使用桌面端；浏览器不能启动本地程序。</p>}
                <Field label="服务地址"><Input type="url" value={draft.endpoint} placeholder="https://example.com/mcp" onChange={event => update({endpoint: event.target.value})}/></Field>
                <Field label="认证方式"><select aria-label="认证方式" className="mcp-select" value={draft.auth} onChange={event => update({auth: authentication(event.target.value)})}>
                    <option value="none">无需认证</option><option value="manual">Token / 请求头</option><option value="oauth" disabled={!owner.runtime.host.capabilities.oauth}>浏览器登录 · OAuth</option>
                </select></Field>
                {draft.auth === "manual" && <Field label="请求头（JSON 对象）"><Textarea className="mcp-code-input" autoComplete="off" spellCheck={false} value={draft.headers} placeholder={'{"Authorization":"Bearer …"}'} onChange={event => update({headers: event.target.value})}/></Field>}
                {draft.auth === "oauth" && <>
                    <Field label="OAuth Client ID（可选）"><Input value={draft.clientId} onChange={event => update({clientId: event.target.value})}/></Field>
                    <Field label="授权范围（JSON 数组）"><Textarea className="mcp-code-input" value={draft.scopes} onChange={event => update({scopes: event.target.value})}/></Field>
                    <p className="mcp-hint">保存后单独选择登录。未填写 Client ID 时，服务需支持公共客户端注册。</p>
                </>}
            </>}
            <label className="mcp-enable"><input type="checkbox" checked={draft.enabled} onChange={event => update({enabled: event.target.checked})}/>启用此连接</label>
            <p className="mcp-hint">保存不会启动程序或发起连接。{owner.runtime.host.capabilities.rememberedCredentials ? "凭据保存在当前设备的安全存储中。" : "浏览器凭据仅在当前页面会话中保留；刷新后需重新填写。"}</p>
        </fieldset>
        <div className="mcp-actions"><Button type="submit" disabled={disabled || !ready} aria-busy={disabled}>{draft.replacement ? "保存替换配置" : "保存连接"}</Button>
            <Button type="button" variant="outline" disabled={disabled} onClick={onCancel}>取消编辑</Button></div>
    </form>;
}

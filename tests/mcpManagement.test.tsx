// @vitest-environment jsdom
import React, {act, useRef, useState} from "react";
import {createRoot, type Root} from "react-dom/client";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {installMcpHostServices, clearMcpHostServices} from "@/platform/runtime/mcpServices";
import {McpHostError} from "@/platform/runtime/mcpErrors";
import type {McpHostServices} from "@/platform/runtime/mcp";
import {getMcpCatalogue} from "@/features/agent/mcp/queries/catalogue";
import {mutateMcpCatalogue} from "@/features/agent/mcp/commands/catalogue";
import {mcpManagementOwner} from "@/features/agent/mcp/ui/management";
import {McpConnectionsPanel} from "@/features/agent/ui/McpConnectionsPanel";
import {ContextPanel, ContextPanelContent, ContextPanelTitle, ContextPanelDescription} from "@/app/layout/context-panel";
import {ContextPanelHostProvider} from "@/app/layout/ContextPanelHost";
import {SettingsPage} from "@/features/settings/ui/SettingsPage";

vi.mock("@tanstack/react-router", () => ({useNavigate: () => vi.fn(), useBlocker: () => ({status: "idle", proceed: vi.fn(), reset: vi.fn()})}));
vi.mock("@/features/settings/ui/ConnectorsPage", () => ({ConnectorsSection: ({onEditorOpenChange}: {onEditorOpenChange: (open: boolean) => void}) => <><button onClick={() => onEditorOpenChange(true)}>打开模型配置</button><button onClick={() => onEditorOpenChange(false)}>关闭模型配置</button></>}));
const reference = {kind: "native_vault" as const, ownerId: "vault", revisionId: "private"};
function fixtureHost(): McpHostServices {
    let active = true, registration = 0;
    return {
        get active() {return active;}, capabilities: {host: "desktop", stdio: true, streamableHttp: true, oauth: true, rememberedCredentials: true},
        async initialize() {return this.capabilities;},
        preparePrivateRevision: vi.fn(async () => reference), privateRevisionStatus: vi.fn(async () => ({status: "prepared" as const, reference})),
        confirmPrivateRevision: vi.fn(async () => undefined), discardPrivateRevision: vi.fn(async () => undefined), retireServer: vi.fn(async () => ({status: "drained" as const})),
        connect: vi.fn(async input => ({binding: {serverId: input.serverId, configRevision: input.configRevision, manifestRevision: "raw", registrationId: `connection_${++registration}`, hostSessionId: "host", principalRevision: "principal"}, discovery: {tools: [{name: "inspect", description: "<script>untrusted</script>", inputSchema: {type: "object", properties: {}}}], resources: [{uri: "file:///do-not-open", name: "Resource"}]}})),
        disconnect: vi.fn(async () => ({status: "drained" as const})), prepare: vi.fn(async () => {throw new Error("unused");}),
        invoke: vi.fn(async () => {throw new Error("unused");}), invocationStatus: vi.fn(async () => {throw new Error("unused");}), stop: vi.fn(async () => {throw new Error("unused");}),
        oauthBegin: vi.fn(async () => ({attemptId: "login"})), oauthStatus: vi.fn(async () => ({attemptId: "login", state: "authorized" as const})), oauthCancel: vi.fn(async () => undefined),
        reserveOAuthPopup: vi.fn(), cancelReservedOAuthPopup: vi.fn(),
        dispose: vi.fn(async () => {active = false; return {status: "drained" as const};}),
    };
}
let root: Root, container: HTMLDivElement, portal: HTMLDivElement, host: McpHostServices;
function Fixture({width = 1440}: {width?: number}) {
    const [open, setOpen] = useState(false), [other, setOther] = useState(false), trigger = useRef<HTMLButtonElement>(null);
    return <ContextPanelHostProvider target={portal} surfaceWidth={width} navigationWidth={260}>
        <main data-context-panel-workspace><textarea aria-label="正在运行的对话" defaultValue="继续创作"/><button ref={trigger} onClick={() => setOpen(true)}>管理连接</button><button onClick={() => setOther(true)}>打开其他详情</button></main>
        <McpConnectionsPanel open={open} onOpenChange={setOpen} returnFocus={trigger}/>
        <ContextPanel open={other} onOpenChange={setOther}><ContextPanelContent data-other-panel><ContextPanelTitle>其他详情</ContextPanelTitle><ContextPanelDescription>保留的详情</ContextPanelDescription></ContextPanelContent></ContextPanel>
    </ContextPanelHostProvider>;
}
function deferred<T>() {let resolve!: (value: T) => void; const promise = new Promise<T>(yes => {resolve = yes;}); return {promise, resolve};}
function button(label: string) {const node = [...document.querySelectorAll<HTMLButtonElement>("button")].find(element => element.textContent?.trim() === label || element.getAttribute("aria-label") === label); expect(node, label).toBeTruthy(); return node!;}
async function click(label: string) {await act(async () => button(label).click());}
function control(label: string): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
    const direct = document.querySelector<HTMLInputElement>(`[aria-label="${label}"]`); if (direct) return direct;
    const id = [...document.querySelectorAll("label")].find(node => node.textContent === label)?.htmlFor;
    const node = id && document.getElementById(id); expect(node, label).toBeTruthy(); return node as HTMLInputElement;
}
function inputNow(node: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
    const prototype = node instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : node instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(node, value);
    node.dispatchEvent(new Event(node instanceof HTMLSelectElement ? "change" : "input", {bubbles: true}));
}
async function input(label: string, value: string) {await act(async () => inputNow(control(label), value));}
async function settle(check: () => void) {await vi.waitFor(async () => {await act(async () => {}); check();});}
async function newConnection(enabled = false, remote = false) {
    await click("管理连接"); await settle(() => expect(button("添加连接").disabled).toBe(false)); await click("添加连接");
    await input("连接名称", "Fixture server");
    if (remote) {await input("传输方式", "streamable_http"); await input("服务地址", "https://fixture.test/mcp?private=SECRET"); await input("认证方式", "oauth");}
    else {await input("可执行文件绝对路径", "/private/fixture-server"); await input("环境变量（JSON 对象）", '{"TOKEN":"PRIVATE_SECRET"}');}
    if (enabled) await act(async () => portal.querySelector<HTMLInputElement>('.mcp-enable input')!.click());
}
async function saveConnection(enabled = false, remote = false) {await newConnection(enabled, remote); await click("保存连接"); await settle(() => expect(button("替换配置")).toBeTruthy());}
beforeEach(async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("ResizeObserver", class {observe() {} unobserve() {} disconnect() {}});
    host = fixtureHost(); installMcpHostServices(host);
    container = document.createElement("div"); portal = document.createElement("div"); document.body.append(container, portal);
    root = createRoot(container); await act(async () => root.render(React.createElement(Fixture)));
});
afterEach(async () => {await act(async () => root.unmount()); await clearMcpHostServices(host); container.remove(); portal.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals();});

describe("actual shared MCP management controls", () => {
    it("saves quietly without enabling or connecting, toggles without rereading secrets and inspects only a connected catalogue", async () => {
        await newConnection(); expect(portal.querySelector<HTMLInputElement>('.mcp-enable input')!.checked).toBe(false);
        await click("保存连接"); await settle(() => expect(button("替换配置")).toBeTruthy());
        expect(host.connect).not.toHaveBeenCalled(); expect((await getMcpCatalogue()).entries[0].enabled).toBe(false);
        expect(portal.textContent).not.toMatch(/保存成功|已保存|PRIVATE_SECRET|fixture-server/);
        const toggle = portal.querySelector<HTMLInputElement>('[role="switch"]')!;
        await act(async () => toggle.click()); await settle(() => expect(button("连接").disabled).toBe(false));
        expect(host.preparePrivateRevision).toHaveBeenCalledTimes(1);
        await click("连接"); await settle(() => expect(portal.textContent).toContain("1 个工具 · 1 个资源"));
        expect(portal.querySelector("a, script")).toBeNull(); expect(host.invoke).not.toHaveBeenCalled();
        await click("替换配置"); expect(control("可执行文件绝对路径").value).toBe(""); expect(control("环境变量（JSON 对象）").value).toBe("{}");
        expect(portal.textContent).toContain("留空不会沿用原凭据");
    });
    it("locks a held save synchronously, guards pending departure and reconciles the original unknown after remount", async () => {
        const held = deferred<typeof reference>();
        vi.mocked(host.preparePrivateRevision).mockImplementationOnce(async () => {await held.promise; throw new McpHostError("reply_lost", "unknown", "original");});
        await newConnection(true); await click("保存连接"); await click("保存连接"); expect(host.preparePrivateRevision).toHaveBeenCalledTimes(1);
        await click("关闭"); expect(document.querySelector('[role="alertdialog"]')).not.toBeNull(); expect([...document.querySelectorAll("button")].some(node => node.textContent === "放弃并离开")).toBe(false); await click("继续编辑");
        await act(async () => held.resolve(reference)); await settle(() => expect(portal.textContent).toContain("保存结果尚未确认"));
        const original = vi.mocked(host.preparePrivateRevision).mock.calls[0][0].operationId;
        await act(async () => root.unmount()); root = createRoot(container); await act(async () => root.render(React.createElement(Fixture))); await click("管理连接");
        expect(button("保存连接").disabled).toBe(true); expect(control("环境变量（JSON 对象）").value).toContain("PRIVATE_SECRET");
        await click("核对保存结果"); await settle(() => expect(button("替换配置")).toBeTruthy());
        expect(host.preparePrivateRevision).toHaveBeenCalledTimes(1); expect(host.privateRevisionStatus).toHaveBeenCalledWith({operationId: original, serverId: (await getMcpCatalogue()).entries[0].serverId});
        expect(mcpManagementOwner()!.getSnapshot().unresolved).toBeUndefined();
    });
    it("retains a committed save until its original host publication is confirmed, then removes with explicit confirmation", async () => {
        vi.mocked(host.confirmPrivateRevision).mockRejectedValueOnce(new McpHostError("reply_lost", "unknown", "publication"));
        await newConnection(true); await click("保存连接");
        await settle(() => expect(portal.textContent).toContain("保存已确认"));
        expect((await getMcpCatalogue()).entries).toHaveLength(1);
        expect(button("保存连接").disabled).toBe(true);
        await click("关闭"); expect(document.querySelector('[role="alertdialog"]')).not.toBeNull();
        expect([...document.querySelectorAll("button")].some(node => node.textContent === "放弃并离开")).toBe(false); await click("继续编辑");
        await click("核对保存结果"); await settle(() => expect(button("替换配置")).toBeTruthy());
        expect(host.preparePrivateRevision).toHaveBeenCalledTimes(1); expect(host.confirmPrivateRevision).toHaveBeenCalledTimes(2);
        expect(vi.mocked(host.confirmPrivateRevision).mock.calls[0][0].operationId).toBe(vi.mocked(host.confirmPrivateRevision).mock.calls[1][0].operationId);
        await click("移除连接"); expect(document.querySelector('[role="alertdialog"]')).not.toBeNull(); await click("确认移除");
        await settle(() => expect(button("添加连接")).toBeTruthy()); expect((await getMcpCatalogue()).entries).toHaveLength(0);
        expect(host.retireServer).toHaveBeenCalled();
    });
    it("blocks an input and close in the same event and keeps a pending OAuth login guarded until explicit cancellation", async () => {
        await click("管理连接"); await settle(() => expect(button("添加连接").disabled).toBe(false)); await click("添加连接");
        await act(async () => {inputNow(control("连接名称"), "Same event draft"); button("关闭").click();});
        expect(document.querySelector('[role="alertdialog"]')).not.toBeNull(); await click("继续编辑");
        await click("全部连接"); await click("放弃并离开"); await click("关闭");
        await saveConnection(true, true); await click("登录授权"); await settle(() => expect(button("取消登录")).toBeTruthy());
        await click("关闭"); expect(document.querySelector('[role="alertdialog"]')).not.toBeNull();
        expect([...document.querySelectorAll("button")].some(node => node.textContent === "放弃并离开")).toBe(false); await click("继续编辑");
        await click("取消登录"); await settle(() => expect(host.oauthCancel).toHaveBeenCalledExactlyOnceWith("login"));
        await settle(() => expect(button("登录授权").disabled).toBe(false)); await click("关闭");
        expect(portal.querySelector('[data-mcp-management]')).toBeNull();
    });
    it("keeps failed replacement readable and shows a safe actionable error without copying rejected host secrets", async () => {
        vi.mocked(host.preparePrivateRevision).mockRejectedValueOnce(new McpHostError("vault_unavailable", "not_started", "failure"));
        await newConnection(); await click("保存连接"); await settle(() => expect(portal.querySelector('[role="alert"]')).not.toBeNull());
        expect(control("环境变量（JSON 对象）").value).toContain("PRIVATE_SECRET"); expect(button("保存连接").disabled).toBe(false);
        expect(portal.querySelector('[role="alert"]')!.textContent).not.toContain("PRIVATE_SECRET");
        await click("保存连接"); await settle(() => expect(button("替换配置")).toBeTruthy()); expect((await getMcpCatalogue()).entries).toHaveLength(1);
    });
    it("recovers a failed original login cancellation only after its original server is confirmed drained", async () => {
        await saveConnection(true, true); await click("登录授权"); await settle(() => expect(button("取消登录")).toBeTruthy());
        const manager = mcpManagementOwner()!, original = manager.getSnapshot().login!;
        vi.mocked(host.oauthCancel).mockRejectedValueOnce(new McpHostError("reply_lost", "unknown", original.attemptId));
        await click("取消登录"); await settle(() => expect(button("检查并断开原连接")).toBeTruthy());
        expect(manager.getSnapshot().login).toEqual(original);
        expect(manager.getSnapshot().unresolved).toEqual({kind: "session", operationId: original.attemptId, serverId: original.serverId});
        expect(manager.isPending()).toBe(true); expect(button("替换配置").disabled).toBe(true);
        await click("关闭"); expect(document.querySelector('[role="alertdialog"]')).not.toBeNull();
        expect([...document.querySelectorAll("button")].some(node => node.textContent === "放弃并离开")).toBe(false); await click("继续编辑");
        vi.mocked(host.retireServer).mockResolvedValueOnce({status: "draining"});
        const retireCount = vi.mocked(host.retireServer).mock.calls.length;
        await click("检查并断开原连接"); await settle(() => expect(portal.textContent).toContain("仍在释放进程或请求"));
        expect(host.retireServer).toHaveBeenLastCalledWith({serverId: original.serverId});
        expect(manager.getSnapshot().login).toEqual(original); expect(manager.getSnapshot().unresolved?.operationId).toBe(original.attemptId);
        expect(manager.isPending()).toBe(true); expect(button("替换配置").disabled).toBe(true);
        await click("检查并断开原连接"); await settle(() => expect(button("替换配置").disabled).toBe(false));
        expect(host.retireServer).toHaveBeenCalledTimes(retireCount + 2); expect(host.oauthCancel).toHaveBeenCalledTimes(1); expect(host.oauthBegin).toHaveBeenCalledTimes(1);
        expect(manager.getSnapshot().login).toBeUndefined(); expect(manager.getSnapshot().unresolved).toBeUndefined();
        await click("替换配置"); expect(control("服务地址").disabled).toBe(false);
    });
    it("offers original server retirement when an external catalogue edit retires a pending login", async () => {
        await saveConnection(true, true); await click("登录授权"); await settle(() => expect(button("检查登录结果")).toBeTruthy());
        const manager = mcpManagementOwner()!, original = manager.getSnapshot().login!, catalogue = await getMcpCatalogue(), row = catalogue.entries[0];
        await act(async () => {await mutateMcpCatalogue({kind: "set_enabled", operationId: "external_disable", serverId: row.serverId, catalogueRevision: catalogue.revision, expectedConfigRevision: row.configRevision, enabled: false});});
        await click("检查登录结果"); await settle(() => expect(button("检查并断开原连接")).toBeTruthy());
        expect(host.oauthStatus).not.toHaveBeenCalled(); expect(manager.getSnapshot().login).toEqual(original); expect(manager.isPending()).toBe(true);
        expect(manager.getSnapshot().unresolved).toEqual({kind: "session", operationId: original.attemptId, serverId: original.serverId});
        await click("检查并断开原连接"); await settle(() => expect(button("替换配置").disabled).toBe(false));
        expect(host.retireServer).toHaveBeenLastCalledWith({serverId: original.serverId}); expect(host.oauthBegin).toHaveBeenCalledTimes(1);
        expect(manager.getSnapshot().login).toBeUndefined(); expect(manager.isPending()).toBe(false); await click("替换配置");
        expect(control("服务地址").disabled).toBe(false);
    });
    it("retains the same editor and conversation DOM across widths and refused replacement, then restores focus", async () => {
        await newConnection(); const field = control("连接名称"), conversation = control("正在运行的对话");
        await act(async () => root.render(<Fixture width={760}/>)); expect(portal.querySelector('[data-mode="full-width"]')).not.toBeNull(); expect(control("连接名称")).toBe(field); expect(control("正在运行的对话")).toBe(conversation);
        await click("返回对话"); await click("继续编辑"); expect(control("连接名称")).toBe(field);
        await click("打开其他详情"); await click("继续编辑"); expect(portal.querySelector('[data-other-panel]')).toBeNull();
        await click("打开其他详情"); await click("放弃并离开"); await settle(() => expect(portal.querySelector('[data-other-panel]')).not.toBeNull());
        await click("返回工作区"); await click("管理连接"); await click("返回对话"); await settle(() => expect(document.activeElement).toBe(button("管理连接")));
        expect(control("正在运行的对话")).toBe(conversation); expect(conversation.value).toBe("继续创作");
    });
    it("bounds connect, login and disconnect clicks while each real host boundary is held", async () => {
        await saveConnection(true, true);
        const login = deferred<{attemptId: string}>(); vi.mocked(host.oauthBegin).mockReturnValueOnce(login.promise);
        await click("登录授权"); await click("登录授权"); expect(host.reserveOAuthPopup).toHaveBeenCalledTimes(1); expect(host.oauthBegin).toHaveBeenCalledTimes(1);
        expect(vi.mocked(host.reserveOAuthPopup!).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(host.oauthBegin).mock.invocationCallOrder[0]);
        await act(async () => login.resolve({attemptId: "login"})); await settle(() => expect(button("检查登录结果")).toBeTruthy()); await click("检查登录结果"); await settle(() => expect(button("连接").disabled).toBe(false)); expect(host.cancelReservedOAuthPopup).toHaveBeenCalledTimes(1);
        const connection = deferred<Awaited<ReturnType<McpHostServices["connect"]>>>(); const connect = host.connect;
        const nativeConnect = vi.mocked(connect).getMockImplementation()!; vi.mocked(connect).mockReturnValueOnce(connection.promise);
        await click("连接"); await click("连接"); await settle(() => expect(connect).toHaveBeenCalledTimes(1)); const args = vi.mocked(connect).mock.calls[0];
        await act(async () => connection.resolve(await nativeConnect(...args))); await settle(() => expect(button("断开连接")).toBeTruthy());
        const retired = deferred<{status: "drained"}>(); vi.mocked(host.retireServer).mockReturnValueOnce(retired.promise);
        const before = vi.mocked(host.retireServer).mock.calls.length;
        await click("断开连接"); expect(mcpManagementOwner()!.getSnapshot().generations).toEqual([]); await click("连接"); expect(connect).toHaveBeenCalledTimes(1); expect(host.retireServer).toHaveBeenCalledTimes(before + 1);
        await act(async () => retired.resolve({status: "drained"})); await settle(() => expect(button("连接").disabled).toBe(false));
    });
    it("guards settings search and navigation before the edit/autofill event finishes, with independent model-editor locks", async () => {
        const change = vi.fn();
        await act(async () => root.render(<ContextPanelHostProvider target={portal} surfaceWidth={1440} navigationWidth={260}><SettingsPage section="connections" onSectionChange={change}/></ContextPanelHostProvider>));
        await click("管理 MCP 连接"); await settle(() => expect(button("添加连接").disabled).toBe(false));
        const search = control("搜索设置");
        await act(async () => {button("添加连接").click(); inputNow(search, "autofill-before-render");});
        expect(search.value).toBe(""); expect(search.disabled).toBe(true); expect(control("连接名称")).toBeTruthy();
        await click("通用"); expect(change).not.toHaveBeenCalled();
        await click("打开模型配置"); await click("关闭模型配置"); expect(search.disabled).toBe(true);
        await click("关闭"); await settle(() => expect(search.disabled).toBe(false));
        await input("搜索设置", "MCP"); expect(container.textContent).toContain("管理 MCP 连接"); expect(container.querySelector("h1")?.textContent).toBe("连接与模型");
    });
});

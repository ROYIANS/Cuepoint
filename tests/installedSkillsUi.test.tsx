// @vitest-environment jsdom
import React, {act, createElement as h, useRef, useState} from "react";
import {createRoot, type Root} from "react-dom/client";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {ContextPanelHostProvider} from "@/app/layout/ContextPanelHost";
import {ContextPanel, ContextPanelContent, ContextPanelDescription, ContextPanelTitle} from "@/app/layout/context-panel";
import {ComposerPlusMenu} from "@/features/agent/ui/AgentControls";
import * as agentSettings from "@/features/agent/commands/agentSettings";
import {AGENT_SKILLS} from "@/features/agent/runtime/skills";
import {InstalledSkillsPanel} from "@/features/agent/ui/InstalledSkillsPanel";
import {useInstalledSkills} from "@/features/agent/ui/useInstalledSkills";
import * as commands from "@/features/agent/skills/commands/installations";
import * as skillQueries from "@/features/agent/skills/queries/installedSkills";
import {getInstalledSkillCatalogue} from "@/features/agent/skills/queries/installedSkills";
import {StorageError} from "@/platform/storage/errors";
import type {SkillDirectorySnapshot} from "@/platform/runtime/skillImport";

const {pick, runtime, navigate} = vi.hoisted(() => ({pick: vi.fn<(operationId: string) => Promise<SkillDirectorySnapshot>>(), runtime: {native: true}, navigate: vi.fn()}));
vi.mock("@/platform/runtime/skillImport", () => ({skillDirectoryImportServices: () => runtime.native ? {pickDirectory: pick} : undefined}));
vi.mock("@/features/agent/ui/ContextParameters", () => ({ContextParameters: () => null}));
vi.mock("@tanstack/react-router", () => ({useNavigate: () => navigate, useBlocker: () => ({status: "idle", proceed: vi.fn(), reset: vi.fn()})}));

let root: Root, container: HTMLDivElement, portal: HTMLDivElement;
function Fixture({width = 1440}: {width?: number}) {
    const [open, setOpen] = useState(false), [other, setOther] = useState(false);
    const trigger = useRef<HTMLButtonElement>(null);
    const controller = useInstalledSkills();
    return <ContextPanelHostProvider target={portal} surfaceWidth={width} navigationWidth={260}>
        <main data-context-panel-workspace><textarea aria-label="对话输入" defaultValue="继续创作"/>
            <button ref={trigger} onClick={() => setOpen(true)}>管理技能</button>
            <button onClick={() => setOther(true)}>打开其他详情</button></main>
        <InstalledSkillsPanel open={open} onOpenChange={setOpen} controller={controller} returnFocus={trigger}/>
        <ContextPanel open={other} onOpenChange={setOther}><ContextPanelContent data-other-panel><ContextPanelTitle>其他详情</ContextPanelTitle><ContextPanelDescription>另一个保留的编辑器</ContextPanelDescription></ContextPanelContent></ContextPanel>
    </ContextPanelHostProvider>;
}
function captured(operationId: string, body = "<script>window.bad = true</script>\n![hidden](https://invalid.test/a.png)"): SkillDirectorySnapshot {
    return {status: "captured", operationId, directoryName: "portable", files: [
        {path: "SKILL.md", text: `---\nname: portable\ndescription: A creative workflow\ncompatibility: Desktop tools required\nallowed-tools: shell\n---\n${body}`},
        {path: "references/guide.md", text: "Reference body"},
    ], exclusions: {count: 1, paths: ["scripts/run.sh"]}};
}
function deferred<T>() {let resolve!: (value: T) => void, reject!: (reason: unknown) => void; const promise = new Promise<T>((yes, no) => {resolve = yes; reject = no;}); return {promise, resolve, reject};}
async function settle(check: () => void) {await vi.waitFor(async () => {await act(async () => {}); check();});}
function button(label: string) {
    const result = [...document.querySelectorAll<HTMLButtonElement>("button")].find(node => node.textContent === label || node.getAttribute("aria-label") === label);
    expect(result, label).toBeTruthy(); return result!;
}
async function click(label: string) {await act(async () => button(label).click());}
async function review() {
    await click("管理技能");
    await settle(() => expect(button("导入技能").disabled).toBe(false));
    await click("导入技能");
    await settle(() => expect(portal.textContent).toContain("审阅新技能"));
}
async function openSkillQuickMenu() {
    await click("更多选项");
    await settle(() => expect(globalThis.document.querySelector('[role="menuitem"] .agent-plus-row')).not.toBeNull());
    const row = [...globalThis.document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(node => node.textContent?.startsWith("技能"))!;
    expect(row).toBeTruthy();
    await act(async () => row.click());
}
beforeEach(async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("ResizeObserver", class {observe() {} unobserve() {} disconnect() {}});
    vi.stubGlobal("matchMedia", () => ({matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}}));
    runtime.native = true;
    pick.mockReset().mockImplementation(async id => captured(id));
    container = document.createElement("div"); portal = document.createElement("div"); document.body.append(container, portal);
    root = createRoot(container);
    await act(async () => root.render(React.createElement(Fixture)));
});
afterEach(async () => {
    await act(async () => root.unmount()); container.remove(); portal.remove(); vi.restoreAllMocks();
});

describe("installed skill management in the retained workspace", () => {
    it("guards review replacement, keeps identical DOM through docking and returns focus to chat controls", async () => {
        await review();
        const document = portal.querySelector("pre")!, conversation = container.querySelector("textarea")!;
        expect(document.textContent).toContain("<script>");
        expect(portal.querySelector("script, img, a")).toBeNull();
        expect(portal.textContent).toContain("不会自动启用工具");
        expect(portal.textContent).toContain("scripts/run.sh");
        expect(portal.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked).toBe(false);
        expect(portal.querySelector("[data-mode=docked]")).not.toBeNull();
        await act(async () => root.render(h(Fixture, {width: 760})));
        expect(portal.querySelector("[data-mode=full-width]")).not.toBeNull();
        expect(portal.querySelector("pre")).toBe(document);
        expect(container.querySelector("textarea")).toBe(conversation); expect(conversation.value).toBe("继续创作");
        await click("返回对话"); await click("继续编辑");
        expect(portal.querySelector("pre")).toBe(document);
        await click("打开其他详情"); await click("继续编辑");
        expect(portal.querySelector("[data-other-panel]")).toBeNull(); expect(portal.querySelector("pre")).toBe(document);
        await click("打开其他详情"); await click("放弃并离开");
        await settle(() => expect(portal.querySelector("[data-other-panel]")).not.toBeNull());
        await click("返回工作区"); await click("管理技能");
        await settle(() => expect(portal.textContent).toContain("技能管理"));
        await click("返回对话");
        await settle(() => expect(globalThis.document.activeElement).toBe(button("管理技能")));
        expect(container.querySelector("textarea")).toBe(conversation);
    });
    it("ignores a late chooser after close/reopen and treats system cancellation quietly", async () => {
        const held = deferred<SkillDirectorySnapshot>();
        pick.mockImplementationOnce(() => held.promise);
        await click("管理技能"); await settle(() => expect(button("导入技能").disabled).toBe(false));
        await click("导入技能"); const operationId = pick.mock.calls[0][0];
        await click("关闭"); await click("管理技能");
        await act(async () => held.resolve(captured(operationId)));
        expect(portal.textContent).not.toContain("审阅新技能");
        expect((await getInstalledSkillCatalogue()).entries).toHaveLength(0);
        pick.mockImplementationOnce(async operationId => ({status: "canceled", operationId}));
        await click("导入技能");
        expect(portal.querySelector('[role="alert"]')).toBeNull(); expect(portal.textContent).not.toContain("审阅新技能");
    });
    it("locks duplicate publication, protects pending departure and preserves failed review before a successful install", async () => {
        const original = commands.installSkill, held = deferred<void>();
        const install = vi.spyOn(commands, "installSkill").mockImplementationOnce(async () => {await held.promise; throw new Error("磁盘暂时不可用");});
        await review(); await click("确认安装");
        expect(button("确认安装").disabled).toBe(true); await click("确认安装");
        expect(install).toHaveBeenCalledTimes(1);
        await click("关闭");
        expect(globalThis.document.querySelector('[role="alertdialog"]')).not.toBeNull();
        expect([...globalThis.document.querySelectorAll("button")].some(node => node.textContent === "放弃并离开")).toBe(false);
        await click("继续编辑");
        await act(async () => held.resolve());
        await settle(() => expect(portal.textContent).toContain("磁盘暂时不可用"));
        expect(portal.textContent).toContain("审阅新技能");
        install.mockImplementation(original);
        await click("确认安装");
        await settle(() => expect(portal.textContent).toContain("技能管理"));
        const catalogue = await getInstalledSkillCatalogue(); expect(catalogue.entries).toHaveLength(1); expect(catalogue.entries[0].enabled).toBe(false);
        expect(portal.textContent).not.toContain("安装成功");
    });
    it("quarantines an uncertain write and reconciles the actual receipt without replay", async () => {
        const original = commands.installSkill;
        const install = vi.spyOn(commands, "installSkill").mockImplementationOnce(async input => {await original(input); throw new StorageError("unknownCommit", "reply lost", "unknown");});
        await review(); await click("确认安装");
        await settle(() => expect(portal.textContent).toContain("保存结果尚未确认"));
        expect(button("确认安装").disabled).toBe(true); await click("确认安装");
        expect(install).toHaveBeenCalledTimes(1);
        await click("核对保存结果");
        await settle(() => expect(portal.textContent).toContain("技能管理"));
        expect((await getInstalledSkillCatalogue()).entries).toHaveLength(1); expect(install).toHaveBeenCalledTimes(1);
    });
    it("keeps unresolved readback blocked, then reports a conflicting writer without blind retry", async () => {
        const install = vi.spyOn(commands, "installSkill").mockRejectedValueOnce(new StorageError("unknownCommit", "unknown", "unknown"));
        const reconcile = vi.spyOn(commands, "reconcileSkillMutation").mockResolvedValueOnce({status: "unresolved"}).mockResolvedValueOnce({status: "conflict"});
        await review(); await click("确认安装"); await click("核对保存结果");
        expect(button("确认安装").disabled).toBe(true); expect(portal.textContent).toContain("仍无法确认");
        await click("核对保存结果"); expect(portal.textContent).toContain("其他操作已改变");
        expect(button("确认安装").disabled).toBe(true); expect(reconcile).toHaveBeenCalledTimes(2); expect(install).toHaveBeenCalledTimes(1);
        await click("重新查看当前列表"); await settle(() => expect(button("确认安装").disabled).toBe(false));
        expect(install).toHaveBeenCalledTimes(1);
    });
    it("retains an uncertain toggle in the composer menu and links to the skills settings section instead of managing inline", async () => {
        await review(); await click("确认安装");
        await settle(() => expect(portal.textContent).toContain("技能管理"));
        await act(async () => root.render(<ContextPanelHostProvider target={portal} surfaceWidth={1440} navigationWidth={260}><ComposerPlusMenu/></ContextPanelHostProvider>));
        await openSkillQuickMenu();
        const findQuickToggle = () => globalThis.document.querySelector<HTMLButtonElement>('[role="switch"][aria-label="启用 portable"]')!;
        await settle(() => expect(findQuickToggle()?.disabled).toBe(false));
        const command = vi.spyOn(commands, "setInstalledSkillEnabled").mockImplementationOnce(async () => {
            throw new StorageError("unknownCommit", "unknown", "unknown");
        });
        await act(async () => findQuickToggle().click());
        await settle(() => expect(globalThis.document.body.textContent).toContain("保存结果尚未确认"));
        expect(findQuickToggle().getAttribute("aria-checked")).toBe("true"); expect(findQuickToggle().disabled).toBe(true);
        await click("更多选项"); await openSkillQuickMenu();
        expect(findQuickToggle().getAttribute("aria-checked")).toBe("true"); expect(findQuickToggle().disabled).toBe(true);
        await act(async () => findQuickToggle().click()); expect(command).toHaveBeenCalledTimes(1);
        navigate.mockClear();
        await click("管理技能");
        expect(navigate).toHaveBeenCalledExactlyOnceWith({to: "/settings", search: {section: "skills"}});
        expect(globalThis.document.querySelector("[data-installed-skills]")).toBeNull();
    });
    it("retains an uncertain toggle in the management view across failed and unresolved readback, without replay", async () => {
        await review(); await click("确认安装");
        await settle(() => expect(portal.textContent).toContain("技能管理"));
        const original = commands.setInstalledSkillEnabled;
        let input!: Parameters<typeof original>[0];
        const command = vi.spyOn(commands, "setInstalledSkillEnabled").mockImplementationOnce(async captured => {
            input = captured;
            throw new StorageError("unknownCommit", "unknown", "unknown");
        });
        const findPanelToggle = () => portal.querySelector<HTMLInputElement>('[role="switch"][aria-label="启用 portable"]')!;
        await settle(() => expect(findPanelToggle()?.disabled).toBe(false));
        await act(async () => findPanelToggle().click());
        await settle(() => expect(portal.textContent).toContain("保存结果尚未确认"));
        expect(findPanelToggle().checked).toBe(true);
        expect(findPanelToggle().disabled).toBe(true);
        const held = deferred<Awaited<ReturnType<typeof commands.reconcileSkillMutation>>>();
        const reconcile = vi.spyOn(commands, "reconcileSkillMutation").mockImplementationOnce(() => held.promise)
            .mockRejectedValueOnce(new Error("核对暂时不可用")).mockResolvedValueOnce({status: "unresolved"});
        await click("核对保存结果");
        expect(findPanelToggle().checked).toBe(true); expect(button("核对保存结果").disabled).toBe(true);
        await act(async () => held.resolve({status: "unresolved"}));
        await settle(() => expect(portal.textContent).toContain("仍无法确认"));
        expect(findPanelToggle().checked).toBe(true); expect(findPanelToggle().disabled).toBe(true);
        await click("核对保存结果"); expect(portal.textContent).toContain("核对暂时不可用");
        expect(findPanelToggle().checked).toBe(true); expect(findPanelToggle().disabled).toBe(true);
        await click("核对保存结果"); expect(portal.textContent).toContain("仍无法确认");
        await click("关闭");
        expect(globalThis.document.querySelector('[role="alertdialog"]')).not.toBeNull();
        expect([...globalThis.document.querySelectorAll("button")].some(node => node.textContent === "放弃并离开")).toBe(false);
        await click("继续编辑");
        // The original write completes later; observing its row alone does not
        // release the quarantined operation. Only its explicit receipt does.
        await act(async () => original(input));
        expect(findPanelToggle().checked).toBe(true); expect(findPanelToggle().disabled).toBe(true);
        await click("核对保存结果");
        await settle(() => expect(findPanelToggle().disabled).toBe(false));
        expect(findPanelToggle().checked).toBe(true); expect(portal.querySelector('[role="alert"]')).toBeNull();
        expect(command).toHaveBeenCalledTimes(1); expect(reconcile).toHaveBeenCalledTimes(4);
    });
    it.each(["acknowledged", "reconciled"] as const)("keeps a %s toggle visible after readback fails, then yields to a newer catalogue", async confirmation => {
        await review(); await click("确认安装");
        await settle(() => expect(portal.textContent).toContain("技能管理"));
        const before = await getInstalledSkillCatalogue(), originalRead = skillQueries.getInstalledSkillCatalogue;
        const originalWrite = commands.setInstalledSkillEnabled;
        // Keep the previously observed snapshot while the post-commit direct
        // read fails. Actual observation reads still retain their dependencies.
        const read = vi.spyOn(skillQueries, "getInstalledSkillCatalogue").mockImplementation(async store => {
            if (!store) throw new Error("列表暂时不可用");
            await originalRead(store);
            return before;
        });
        const command = vi.spyOn(commands, "setInstalledSkillEnabled").mockImplementationOnce(async input => {
            const receipt = await originalWrite(input);
            if (confirmation === "reconciled") throw new StorageError("unknownCommit", "reply lost", "unknown");
            return receipt;
        });
        const toggle = portal.querySelector<HTMLInputElement>('[role="switch"]')!;
        await act(async () => toggle.click());
        if (confirmation === "reconciled") {
            await settle(() => expect(portal.textContent).toContain("保存结果尚未确认"));
            expect(toggle.checked).toBe(true); expect(toggle.disabled).toBe(true);
            await click("核对保存结果");
        }
        await settle(() => expect(toggle.disabled).toBe(false));
        expect(toggle.checked).toBe(true); expect(command).toHaveBeenCalledTimes(1);
        expect(portal.querySelector('[role="alert"]')).toBeNull();
        await click("关闭"); await click("管理技能");
        const reopened = portal.querySelector<HTMLInputElement>('[role="switch"]')!;
        expect(reopened.checked).toBe(true); expect(reopened.disabled).toBe(false);
        read.mockRestore();
        const current = await originalRead(), skill = current.entries[0];
        await act(async () => originalWrite({operationId: "newer-toggle", catalogueRevision: current.revision,
            skillId: skill.skillId, expectedRevision: skill.revision, enabled: false}));
        await settle(() => expect(reopened.checked).toBe(false));
        expect(reopened.disabled).toBe(false); expect(command).toHaveBeenCalledTimes(1);
    });
    it("retains a conflicting toggle until an explicit current-list acknowledgement succeeds", async () => {
        await review(); await click("确认安装");
        await settle(() => expect(portal.textContent).toContain("技能管理"));
        const originalWrite = commands.setInstalledSkillEnabled;
        const command = vi.spyOn(commands, "setInstalledSkillEnabled").mockRejectedValueOnce(new StorageError("unknownCommit", "unknown", "unknown"));
        const toggle = portal.querySelector<HTMLInputElement>('[role="switch"]')!;
        await act(async () => toggle.click());
        await settle(() => expect(portal.textContent).toContain("保存结果尚未确认"));
        const current = await getInstalledSkillCatalogue(), skill = current.entries[0];
        await act(async () => originalWrite({operationId: "conflicting-toggle", catalogueRevision: current.revision,
            skillId: skill.skillId, expectedRevision: skill.revision, enabled: false}));
        await click("核对保存结果"); await settle(() => expect(portal.textContent).toContain("其他操作已改变"));
        expect(toggle.checked).toBe(true); expect(toggle.disabled).toBe(true);
        const originalRead = skillQueries.getInstalledSkillCatalogue;
        const read = vi.spyOn(skillQueries, "getInstalledSkillCatalogue").mockImplementation(async store => {
            if (!store) throw new Error("当前列表读取失败");
            return originalRead(store);
        });
        await click("重新查看当前列表"); await settle(() => expect(portal.textContent).toContain("当前列表读取失败"));
        expect(toggle.checked).toBe(true); expect(toggle.disabled).toBe(true);
        read.mockRestore();
        await click("重新查看当前列表");
        await settle(() => expect(toggle.disabled).toBe(false));
        expect(toggle.checked).toBe(false); expect(portal.querySelector('[role="alert"]')).toBeNull();
        expect(command).toHaveBeenCalledTimes(1);
        await act(async () => toggle.click());
        await settle(() => expect(toggle.checked && !toggle.disabled).toBe(true));
        expect(command).toHaveBeenCalledTimes(2);
    });
    it("keeps existing management available when browser directory selection is unsupported", async () => {
        runtime.native = false;
        await click("管理技能");
        await settle(() => expect(portal.textContent).toContain("当前浏览器不支持目录导入"));
        expect(button("导入技能").disabled).toBe(true);
        expect(pick).not.toHaveBeenCalled();
    });
    it("accepts only the explicit browser FileList and quietly releases a canceled input", async () => {
        runtime.native = false;
        Object.defineProperty(HTMLInputElement.prototype, "webkitdirectory", {configurable: true, value: false});
        try {
            await click("管理技能"); await settle(() => expect(button("导入技能").disabled).toBe(false));
            await click("导入技能");
            const input = portal.querySelector<HTMLInputElement>('input[type="file"]')!;
            await act(async () => input.dispatchEvent(new Event("cancel")));
            expect(button("导入技能").disabled).toBe(false);
            await click("导入技能");
            const text = "---\nname: portable\ndescription: Browser workflow\n---\nNo extra permission.";
            const bytes = new TextEncoder().encode(text), file = new File([bytes], "SKILL.md");
            Object.defineProperty(file, "webkitRelativePath", {value: "portable/SKILL.md"});
            Object.defineProperty(file, "arrayBuffer", {value: async () => bytes.buffer});
            Object.defineProperty(input, "files", {value: [file], configurable: true});
            await act(async () => input.dispatchEvent(new Event("change", {bubbles: true})));
            await settle(() => expect(portal.textContent).toContain("审阅新技能"));
            expect(portal.textContent).toContain("Browser workflow"); expect(pick).not.toHaveBeenCalled();
            expect((await getInstalledSkillCatalogue()).entries).toHaveLength(0);
        } finally {delete (HTMLInputElement.prototype as {webkitdirectory?: boolean}).webkitdirectory;}
    });
    it("optimistically toggles once, rolls back a known failure, loads one resource and manually updates/uninstalls", async () => {
        await review(); await click("确认安装");
        await settle(() => expect(portal.textContent).toContain("技能管理"));
        const toggle = portal.querySelector<HTMLInputElement>('[role="switch"]')!;
        const failure = deferred<void>();
        const original = commands.setInstalledSkillEnabled;
        const command = vi.spyOn(commands, "setInstalledSkillEnabled").mockImplementationOnce(async () => {await failure.promise; throw new Error("保存失败");});
        await act(async () => toggle.click()); expect(toggle.checked).toBe(true); expect(toggle.disabled).toBe(true);
        await act(async () => toggle.click()); expect(command).toHaveBeenCalledTimes(1);
        await act(async () => failure.resolve()); await settle(() => expect(toggle.checked).toBe(false));
        command.mockImplementation(original);
        await act(async () => toggle.click()); await settle(() => expect(toggle.checked).toBe(true));
        await click("portableA creative workflow");
        await settle(() => expect(portal.querySelector('[aria-label="SKILL.md"]')).not.toBeNull());
        await click("references/guide.md"); await settle(() => expect(portal.querySelector('[aria-label="references/guide.md"]')?.textContent).toBe("Reference body"));
        pick.mockImplementationOnce(async id => captured(id, "Updated workflow"));
        await click("选择文件夹更新"); await settle(() => expect(portal.textContent).toContain("审阅技能更新"));
        expect(portal.textContent).toContain("修改 1"); await click("确认更新");
        await settle(() => expect(portal.textContent).toContain("技能管理"));
        await click("portableA creative workflow"); await click("卸载"); await click("确认卸载");
        await settle(() => expect(portal.textContent).toContain("把常用工作方法带进对话"));
        expect((await getInstalledSkillCatalogue()).entries).toHaveLength(0);
    });
});


describe("builtin skill quick switches", () => {
    async function openQuickSwitch() {
        await agentSettings.getGeneralAgentConfig();
        await agentSettings.updateGeneralAgentConfig({enabledSkillIds: []});
        await act(async () => root.render(h(ComposerPlusMenu)));
        await click("更多选项");
        await settle(() => expect(globalThis.document.querySelector('[role="menuitem"] .agent-plus-row')).not.toBeNull());
        const row = [...globalThis.document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(node => node.textContent?.startsWith("技能"))!;
        expect(row).toBeTruthy(); await act(async () => row.click());
        await settle(() => expect(globalThis.document.querySelector<HTMLButtonElement>(`[role="switch"][aria-label="${AGENT_SKILLS[0].name}"]`)?.disabled).toBe(false));
        return globalThis.document.querySelector<HTMLButtonElement>(`[role="switch"][aria-label="${AGENT_SKILLS[0].name}"]`)!;
    }
    it("keeps an uncertain builtin write isolated across menu reopen without another write or retry offer", async () => {
        const toggle = await openQuickSwitch(), original = agentSettings.updateGeneralAgentConfig;
        const write = vi.spyOn(agentSettings, "updateGeneralAgentConfig").mockImplementationOnce(async patch => {
            await original(patch);
            throw new StorageError("unknownCommit", "reply lost", "unknown");
        });
        await act(async () => toggle.click());
        await settle(() => expect(globalThis.document.body.textContent).toContain("请重新加载工作区并核对设置后再操作"));
        expect(toggle.disabled).toBe(true); expect(toggle.getAttribute("aria-checked")).toBe("true");
        expect(globalThis.document.body.textContent).not.toContain("内置技能设置保存失败，请重试");
        await act(async () => toggle.click()); expect(write).toHaveBeenCalledTimes(1);
        await click("更多选项"); await click("更多选项");
        await settle(() => expect(globalThis.document.querySelector('[role="menuitem"] .agent-plus-row')).not.toBeNull());
        const row = [...globalThis.document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(node => node.textContent?.startsWith("技能"))!;
        await act(async () => row.click());
        const reopened = globalThis.document.querySelector<HTMLButtonElement>(`[role="switch"][aria-label="${AGENT_SKILLS[0].name}"]`)!;
        expect(reopened.disabled).toBe(true); await act(async () => reopened.click());
        expect(write).toHaveBeenCalledTimes(1);
    });
    it("applies the captured enable target to the latest configuration after a held read", async () => {
        const toggle = await openQuickSwitch(), originalRead = agentSettings.getGeneralAgentConfig, originalWrite = agentSettings.updateGeneralAgentConfig;
        const held = deferred<Awaited<ReturnType<typeof originalRead>>>();
        vi.spyOn(agentSettings, "getGeneralAgentConfig").mockImplementationOnce(() => held.promise);
        const write = vi.spyOn(agentSettings, "updateGeneralAgentConfig");
        await act(async () => toggle.click());
        expect(toggle.getAttribute("aria-checked")).toBe("true"); expect(toggle.disabled).toBe(true);
        const key = AGENT_SKILLS[0].id, other = AGENT_SKILLS[1].id;
        // Another source enabled the same skill and a different skill while this
        // click's latest-config read was held. The captured intent remains enable.
        await act(async () => originalWrite({enabledSkillIds: [key, other]}));
        await act(async () => held.resolve(await originalRead()));
        await settle(() => expect(write).toHaveBeenCalledExactlyOnceWith({enabledSkillIds: [key, other]}));
        expect((await originalRead()).enabledSkillIds).toEqual([key, other]);
        await settle(() => expect(toggle.disabled).toBe(false));
        expect(toggle.getAttribute("aria-checked")).toBe("true");
    });
});

describe("installed skill management in the settings section", () => {
    it("renders the same management content inline and imports through the shared review without a context panel", async () => {
        const {InstalledSkillsSettings} = await import("@/features/agent/ui/InstalledSkillsSettings");
        await act(async () => root.render(<InstalledSkillsSettings/>));
        await settle(() => expect(button("导入技能").disabled).toBe(false));
        expect(document.querySelector("[data-installed-skills].installed-skills-inline")).not.toBeNull();
        expect(document.querySelector('[data-slot="context-panel-content"]')).toBeNull();
        await click("导入技能");
        await settle(() => expect(document.body.textContent).toContain("确认安装"));
        expect(document.body.textContent).toContain("portable");
        expect(button("确认安装").disabled).toBe(false);
    });
});

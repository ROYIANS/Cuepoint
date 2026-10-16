// @vitest-environment jsdom
import {Blob as NodeBlob} from "node:buffer";
import {act, createElement as h, StrictMode} from "react";
import {createRoot, type Root} from "react-dom/client";
import {afterEach, beforeEach, expect, it, vi} from "vitest";
import {DesktopMediaImportPanel} from "@/features/library/ui/DesktopMediaImportPanel";
import {AgentDesktopMediaReport} from "@/features/agent/ui/AgentDesktopMediaReport";
import * as runtime from "@/platform/runtime/desktopMedia";
import {db} from "@/platform/product/store";
import {TABLE_NAMES} from "@/platform/storage/schema";
import type {StoreObserver, StoreTx} from "@/platform/storage/types";
import {createProject} from "@/features/projects/commands/projects";
import {UnknownCommitError} from "@/platform/storage/errors";
import {failStoreTableOnce} from "./helpers/storeFaults";
import {desktopMediaHost, deferred} from "./helpers/desktopMediaHost";

type Read = {query: (tx: StoreTx) => unknown | Promise<unknown>; observer: StoreObserver<unknown>; stopped: boolean};
let root: Root, container: HTMLDivElement, reads: Read[];
beforeEach(() => {
    vi.stubGlobal("Blob", NodeBlob); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); reads = [];
    vi.spyOn(db, "observe").mockImplementation((query, observer) => {
        const read = {query, observer: observer as StoreObserver<unknown>, stopped: false}; reads.push(read);
        return () => {read.stopped = true;};
    });
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => {await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals();});
async function publish() {
    for (const read of reads.filter(value => !value.stopped)) {
        const value = await db.transaction("r", TABLE_NAMES, read.query);
        await act(async () => read.observer.next(value));
    }
}
async function draw(projectId: string) {await act(async () => root.render(h(StrictMode, null, h(DesktopMediaImportPanel, {projectId}))));}
const button = (text: string) => [...container.querySelectorAll<HTMLButtonElement>("button")].find(node => node.textContent === text)!;
async function click(text: string, twice = false) {await act(async () => {button(text).click(); if (twice) button(text).click();});}
async function selectAll() {await act(async () => {for (const input of container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')) input.click();});}

it("keeps browser folder import visibly unavailable and does not open a dialog", async () => {
    const project = await createProject("Browser"); vi.spyOn(runtime, "desktopMediaServices").mockReturnValue(undefined);
    await draw(project.id); await publish();
    expect(button("导入文件夹").disabled).toBe(true); expect(container.textContent).toContain("macOS 或 Windows 桌面版");
    expect(container.querySelector('[role="dialog"]')).toBeNull();
});

it("survives StrictMode, admits one same-tick picker/import, then shows only real saved counts", async () => {
    const project = await createProject("Desktop"), host = desktopMediaHost(2); vi.spyOn(runtime, "desktopMediaServices").mockReturnValue(host.services);
    await draw(project.id); expect(button("导入文件夹").disabled).toBe(true); await publish();
    await click("导入文件夹", true);
    await vi.waitFor(() => expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(2));
    expect(host.actions().filter(action => action.type === "pickDirectory")).toHaveLength(1);
    expect(container.textContent).toContain("3 项未纳入列表"); await selectAll();
    await click("导入所选 2 个视频", true);
    await vi.waitFor(async () => expect((await db.desktopMediaImports.toArray())[0]?.status).toBe("completed")); await publish();
    expect(host.actions().filter(action => action.type === "prepareVideo")).toHaveLength(2);
    expect(container.textContent).toContain("已导入 2 / 2 个视频"); expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(container.textContent).not.toMatch(/正在确认|正在准备|保存成功|清理成功/);
});

it("keeps scan Stop available and discards a stale project completion after the held page read", async () => {
    const a = await createProject("A"), b = await createProject("B"), host = desktopMediaHost(1), entered = deferred(), release = deferred();
    const original = host.call.getMockImplementation()!;
    host.call.mockImplementation(async (command, args) => {
        const request = args.request as {action: {type: string}};
        if (request.action.type === "readScanPage") {entered.resolve(); await release.promise;}
        return original(command, args);
    });
    vi.spyOn(runtime, "desktopMediaServices").mockReturnValue(host.services);
    await draw(a.id); await publish(); await click("导入文件夹"); await entered.promise;
    expect(button("停止")).toBeTruthy();
    await draw(b.id); await publish();
    await act(async () => {release.resolve();});
    await vi.waitFor(() => expect(host.actions().some(action => action.type === "revokeDirectory")).toBe(true));
    expect(container.textContent).not.toContain("clip-0.mp4"); expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
    expect(button("导入文件夹").disabled).toBe(false);
});

it("quarantines an uncertain admission instead of creating a second import intent", async () => {
    const project = await createProject("Unknown"), host = desktopMediaHost(1); vi.spyOn(runtime, "desktopMediaServices").mockReturnValue(host.services);
    await draw(project.id); await publish(); await click("导入文件夹");
    await vi.waitFor(() => expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(1)); await selectAll();
    const fault = failStoreTableOnce(db, "desktopMediaImports", "add", new UnknownCommitError("admission", host.session.workspaceId));
    try {await click("导入所选 1 个视频"); await vi.waitFor(() => expect(container.textContent).toContain("是否已受理尚未确认"));} finally {fault.mockRestore();}
    expect(container.textContent).toContain("是否已受理尚未确认"); expect(button("导入文件夹").disabled).toBe(true);
    expect(button("核对导入结果")).toBeTruthy(); expect(host.actions().some(action => action.type === "prepareVideo")).toBe(false);
});

it("ignores a foreign Agent call without observing or offering an import action", async () => {
    const run = {id: "run", threadId: "thread", projectId: "project"}, call = {id: "call", runId: "foreign", threadId: "thread", name: "desktop_media_import"};
    await act(async () => root.render(h(AgentDesktopMediaReport, {run: run as never, call: call as never})));
    expect(container.textContent).toBe(""); expect(reads).toHaveLength(0);
});

it("reads the exact Agent-owned import outside technical details and keeps readonly recovery passive", async () => {
    const project = await createProject("Report"), at = "2026-10-16T00:00:00Z";
    const run: import("@/features/agent/models/agent").AgentRun = {id: "report_run", threadId: "report_thread", projectId: project.id, userMessageId: "report_user", assistantMessageId: "report_assistant", agentId: "agent", agentSnapshot: {name: "Agent", instructions: ""}, connector: {id: "connector", definitionId: "openai-compatible", baseUrl: "https://unused.test"}, model: "fixture", status: "interrupted", requestMessages: [], checkpoint: 0, createdAt: at, updatedAt: at};
    const call: import("@/features/agent/models/agent").AgentToolCall = {id: "report_call", runId: run.id, threadId: run.threadId, providerCallId: "report_provider", name: "desktop_media_import", title: "导入本地视频", arguments: "{}", status: "unknown", step: 1, order: 0, effect: "write", highRisk: false, requiresConfirmation: true, createdAt: at, updatedAt: at};
    await db.chatThreads.add({id: run.threadId, projectId: project.id, title: "Report", connectorId: "connector", model: "fixture", createdAt: at, updatedAt: at});
    await db.agentRuns.add(run); await db.agentToolCalls.add(call);
    await db.desktopMediaImports.add({id: call.id, projectId: project.id, actor: {kind: "agent", runId: run.id, threadId: run.threadId, callId: call.id}, selection: {grantId: "grant", scanId: "scan", revision: "v1", items: [{entryId: "entry", filename: "actual.mp4", mimeType: "video/mp4", byteLength: 4, revision: "file-v1", sourceMediaId: "source", thumbnailMediaId: "thumbnail"}]}, status: "unknown", revision: 1, receipts: [], createdAt: at, updatedAt: at});
    await act(async () => root.render(h(StrictMode, null, h(AgentDesktopMediaReport, {run, call, readOnly: true})))); await publish();
    expect(container.textContent).toContain("已导入 0 / 1 个视频"); expect(container.textContent).toContain("导入结果待核对");
    expect(button("核对导入结果")).toBeUndefined(); expect(button("停止")).toBeUndefined(); expect(container.querySelector("pre")).toBeNull();
    await db.chatThreads.update(run.threadId, {projectId: "foreign"}); await publish();
    expect(container.textContent).toContain("导入记录不可用"); expect(container.querySelector("[data-desktop-media-import]")).toBeNull();
});

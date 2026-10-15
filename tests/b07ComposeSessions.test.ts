import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import type {ReactElement} from "react";

// Execute the real page/hooks and their effects/callbacks in a deterministic host.
// UI leaves and provider I/O are mocked; browser scheduling is not verified
// by this host. The separate B07 browser fixture reports its own coverage.
type Effect = {deps?: unknown[]; setup: () => void | (() => void); cleanup?: () => void};
type Host = {cells: unknown[]; cursor: number; effects: Array<() => void>; results: unknown[];
    queryIndex: number; mounted: boolean; lateWrites: number};
const runtime = vi.hoisted(() => ({active: undefined as Host | undefined}));
vi.mock("react", async original => {
    const react = await original<typeof import("react")>();
    return {...react,
        useState: (initial: unknown) => {
            const host = runtime.active!; const index = host.cursor++;
            if (!(index in host.cells)) host.cells[index] = typeof initial === "function" ? initial() : initial;
            return [host.cells[index], (next: unknown) => {
                if (!host.mounted) host.lateWrites++;
                host.cells[index] = typeof next === "function" ? next(host.cells[index]) : next;
            }];
        },
        useRef: (initial: unknown) => {
            const host = runtime.active!; const index = host.cursor++;
            if (!(index in host.cells)) host.cells[index] = {current: initial};
            return host.cells[index];
        },
        useEffect: (setup: Effect["setup"], deps?: unknown[]) => {
            const host = runtime.active!; const index = host.cursor++;
            const previous = host.cells[index] as Effect | undefined;
            if (!previous || !deps || deps.some((value, i) => !Object.is(value, previous.deps?.[i]))) {
                const cell: Effect = {deps, setup}; host.cells[index] = cell;
                host.effects.push(() => {previous?.cleanup?.(); cell.cleanup = setup() || undefined;});
            }
        },
        useMemo: (compute: () => unknown, deps: unknown[]) => {
            const host = runtime.active!; const index = host.cursor++;
            const previous = host.cells[index] as {deps: unknown[]; value: unknown} | undefined;
            if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) host.cells[index] = {deps, value: compute()};
            return (host.cells[index] as {value: unknown}).value;
        },
        useCallback: (callback: unknown, deps: unknown[]) => {
            const host = runtime.active!; const index = host.cursor++;
            const previous = host.cells[index] as {deps: unknown[]; value: unknown} | undefined;
            if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) host.cells[index] = {deps, value: callback};
            return (host.cells[index] as {value: unknown}).value;
        },
    };
});
vi.mock("@/platform/product/queries", () => {
    const read = () => {const host = runtime.active!; return host.results[host.queryIndex++];};
    return {useProductQuery: read, useProductQueryState: () => ({value: read(), error: null})};
});

const io = vi.hoisted(() => ({navigate: vi.fn(), create: vi.fn(), begin: vi.fn(), execute: vi.fn(),
    update: vi.fn(), resolveConnector: vi.fn(), reconcile: vi.fn(), importFile: vi.fn(), retryImport: vi.fn(), compatible: vi.fn(), lock: vi.fn()}));
vi.mock("@tanstack/react-router", () => ({useNavigate: () => io.navigate, Link: "a", useBlocker: () => ({status: "idle", proceed: vi.fn(), reset: vi.fn()})}));
vi.mock("sonner", () => ({toast: {error: vi.fn(), success: vi.fn()}}));
vi.mock("@/features/agent/commands/chat", async original => ({...await original<typeof import("@/features/agent/commands/chat")>(),
    createChatThread: io.create, updateChatThread: io.update}));
vi.mock("@/features/settings/commands/connectors", () => ({resolveConnector: io.resolveConnector}));
vi.mock("@/features/agent/queries/agentAdmission", () => ({readAgentAdmission: io.reconcile}));
vi.mock("@/platform/identity", async original => ({...await original<typeof import("@/platform/identity")>(),
    createId: (prefix: string) => prefix === "thread" ? "created" : `${prefix}_${crypto.randomUUID()}`}));
vi.mock("@/features/agent/commands/agentRuns", async original => ({...await original<typeof import("@/features/agent/commands/agentRuns")>(), beginAgentRun: io.begin}));
vi.mock("@/features/agent/runtime/runChat", () => ({executeChatRun: io.execute, resumeChatRun: vi.fn()}));
vi.mock("@/features/agent/runtime/runOwnership", () => ({recoverAbandonedRuns: vi.fn().mockResolvedValue(undefined), withThreadRunLock: io.lock}));
vi.mock("@/features/agent/runtime/taskWrapup", () => ({recoverTaskWrapups: vi.fn().mockResolvedValue(undefined)}));
vi.mock("@/features/video/agent/generationBatchRuntime", () => ({pauseThreadGeneration: vi.fn()}));
vi.mock("@/features/settings/models/connectors", () => ({runWithCompatibleChatModel: io.compatible,
    discoverConnectorChatModels: vi.fn().mockResolvedValue({models: ["model"]})}));
vi.mock("@/features/references/documents/import", () => ({importReferenceFile: io.importFile, retryReferenceImport: io.retryImport}));
vi.mock("@/features/agent/ui/AgentActivityNavigation", () => ({AgentActivityNavigationProvider: "navigation-provider"}));
vi.mock("@/features/agent/ui/HomeWelcome", () => ({HomeWelcome: "home"}));
vi.mock("@/features/agent/ui/ChatWorkspace", () => ({ChatWorkspace: "workspace"}));
vi.mock("@/features/agent/ui/TaskBoard", () => ({TaskBoard: "board"}));
vi.mock("@/features/agent/ui/TaskInspector", () => ({TaskInspector: "inspector"}));
vi.mock("@/features/agent/ui/AgentComposerAttention", () => ({AgentComposerAttention: "attention"}));
vi.mock("@/features/agent/ui/ContextUsagePanel", () => ({ContextUsageTrigger: "context"}));
vi.mock("@lobehub/ui", () => ({Button: "button", Empty: "empty", Flexbox: "div"}));

import {toast} from "sonner";
import {db} from "@/platform/product/store";
import {UnknownCommitError} from "@/platform/storage/errors";
import {resetReportedErrorsForTests} from "@/platform/diagnostics/reportError";
import {AgentChatPage} from "@/features/agent/ui/AgentChatPage";
import {useReferenceDraft} from "@/features/agent/ui/useReferenceDraft";
import type {ComposerProps} from "@/features/agent/ui/composerTypes";
import type {ChatThread} from "@/features/agent/models/chat";
import type {ConnectorConfig} from "@/features/settings/models/connector";
import type {Project} from "@/features/projects/models/project";
import type {ProjectReference} from "@/features/references/models/references";

type Node = ReactElement<Record<string, unknown>>;
const hosts: Host[] = [];
function mount(results: unknown[] = []) {
    const host: Host = {cells: [], cursor: 0, effects: [], results, queryIndex: 0, mounted: true, lateWrites: 0};
    hosts.push(host); return host;
}
function effects(host: Host) {return host.cells.filter((cell): cell is Effect => !!cell && typeof cell === "object" && "setup" in cell);}
function unmount(host: Host) {host.mounted = false; effects(host).forEach(cell => cell.cleanup?.());}
function replay(host: Host) {
    effects(host).forEach(cell => cell.cleanup?.());
    effects(host).forEach(cell => {cell.cleanup = cell.setup() || undefined;});
}
function nodes(tree: unknown): Node[] {
    if (Array.isArray(tree)) return tree.flatMap(nodes);
    if (!tree || typeof tree !== "object" || !("props" in tree)) return [];
    const node = tree as Node; return [node, ...nodes(node.props.children)];
}
function draw(host: Host, run: () => unknown) {
    runtime.active = host; host.cursor = 0; host.queryIndex = 0;
    const tree = nodes(run()); host.effects.splice(0).forEach(effect => effect()); return tree;
}

function deferred<T>() {
    let resolve!: (value: T) => void; let reject!: (reason: Error) => void;
    const promise = new Promise<T>((yes, no) => {resolve = yes; reject = no;}); return {promise, resolve, reject};
}
async function settle() {
    for (let i = 0; i < 8; i++) {await Promise.resolve(); await new Promise<void>(resolve => setImmediate(resolve));}
}
const connector: ConnectorConfig = {id: "connector", definitionId: "openai-compatible", protocol: "openai-compatible",
    baseUrl: "https://unused.invalid", apiKey: "mock-only", updatedAt: "2026-09-30"};
function thread(id: string, projectId = "p"): ChatThread {
    return {id, projectId, title: id, connectorId: connector.id, model: "model", createdAt: "2026-09-30", updatedAt: "2026-09-30"};
}
function page(initial?: string) {
    const host = mount(); let active = initial; let pendingOwnership = false;
    const threads = [thread("A"), thread("B")];
    const render = () => {
        host.results = [threads, [], [], [connector], [{id: "p"}, {id: "q"}] as Project[],
            pendingOwnership ? {forId: "old", thread: null} : {forId: active ?? null, thread: threads.find(item => item.id === active) ?? null}, [], [], []];
        return draw(host, () => {
            const wrapper = AgentChatPage({threadId: active}) as Node;
            const child = (wrapper.props.children as Node).props.children as Node;
            return (child.type as (props: unknown) => unknown)(child.props);
        });
    };
    const surface = () => render().find(node => node.type === "home" || node.type === "workspace")!;
    const composer = () => surface().props.composer as ComposerProps;
    const select = (id?: string) => {active = id; render(); render();};
    io.navigate.mockImplementation(async (options: {params?: {threadId: string}}) => {select(options.params?.threadId);});
    render(); render();
    const attempts = () => (surface().props.submissions ?? []) as import("@/features/agent/ui/chatSubmissionAttempts").ChatSubmissionAttempt[];
    const action = async (action: "retry" | "restore" | "check" | "recover", id = attempts()[0]?.admission.userMessageId) => {
        (surface().props.onSubmissionAction as (id: string, action: string) => void)(id, action); await settle();
    };
    return {host, threads, render, surface, composer, select, attempts, action, pendingOwnership: () => {pendingOwnership = true; active = "unknown";}, active: () => active, type: (value: string) => composer().onChange(value),
        attach: (id: string) => composer().onAttachReference!({referenceId: id, revision: 1}),
        // The UI deliberately discards handleSend's promise. Drain callbacks explicitly.
        send: async () => {composer().onSend(); await settle();}};
}
function reference(id: string, status: ProjectReference["status"] = "ready"): ProjectReference {
    return {id, projectId: "p", mediaId: `media-${id}`, digest: "digest", kind: "text", filename: "file.txt", mimeType: "text/plain",
        size: 3, revision: 1, status, operationId: "op", coverage: {totalUnits: 1, processedUnits: 1, emptyUnits: [], characters: 3, truncated: false},
        warnings: [], createdAt: "2026-09-30", updatedAt: "2026-09-30"};
}
beforeEach(async () => {
    await db.chatThreads.bulkPut([thread("A"), thread("B"), thread("created")]);
    hosts.length = 0; vi.clearAllMocks(); resetReportedErrorsForTests(); Object.values(io).forEach(mock => mock.mockReset());
    vi.stubGlobal("window", {addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn()});
    io.update.mockResolvedValue(undefined); io.execute.mockResolvedValue(undefined);
    io.resolveConnector.mockResolvedValue(connector); io.reconcile.mockResolvedValue({status: "absent"});
    io.begin.mockResolvedValue({id: "run"});
    io.compatible.mockImplementation(async (_connector, _model, operation, options) => {
        if (options.signal.aborted || !options.isCurrent()) return {ok: false, aborted: true};
        return {ok: true, value: await operation()};
    });
    io.lock.mockImplementation(async (_id, operation) => operation());
});
afterEach(() => {hosts.forEach(host => {if (host.mounted) unmount(host);}); vi.unstubAllGlobals();});

describe("B07 actual compose callbacks", () => {
    it("keeps text and attachments together across A/B/back", () => {
        const ui = page("A"); ui.type("draft A"); ui.attach("refA");
        (ui.surface().props.onSelectThread as (id: string) => void)("B");
        expect(ui.composer().value).toBe(""); ui.type("draft B"); ui.attach("refB");
        (ui.surface().props.onSelectThread as (id: string) => void)("A");
        expect(ui.composer().value).toBe("draft A");
        expect(ui.composer().attachments).toEqual([{referenceId: "refA", revision: 1}]);
        ui.select("B"); expect(ui.composer().value).toBe("draft B");
    });
    it("failed new-topic creation preserves unsent old text and references", async () => {
        const ui = page("A"); ui.type("unsent"); ui.attach("refA");
        io.create.mockRejectedValue(new Error("creation failed"));
        (ui.surface().props.onNewTopic as () => void)(); await settle();
        expect(ui.composer().value).toBe("unsent"); expect(ui.composer().attachments).toHaveLength(1);
        // Creation failures go through showError: a friendly title plus the 查看详情 action, never swallowed.
        expect(toast.error).toHaveBeenCalledWith("创建对话失败", expect.objectContaining({action: expect.objectContaining({label: "查看详情"})}));
    });
    it("a late begin cannot clear edited-then-reverted text", async () => {
        const ui = page("A"); ui.type("same"); const gate = deferred<{id: string}>(); io.begin.mockReturnValue(gate.promise);
        const pending = ui.send(); await settle(); ui.type("changed"); ui.type("same");
        gate.resolve({id: "run"}); await pending; await settle();
        expect(ui.composer().value).toBe("same");
    });
    it("a late begin cannot clear equal text belonging to another thread", async () => {
        const ui = page("A"); ui.type("same"); const gate = deferred<{id: string}>(); io.begin.mockReturnValue(gate.promise);
        const pending = ui.send(); await settle(); ui.select("B"); ui.type("same");
        gate.resolve({id: "run"}); await pending; await settle();
        expect(ui.composer().value).toBe("same");
    });
});


describe("B07 first send and ownership boundaries", () => {
    function home() {
        const ui = page(); ui.composer().onProjectChange("p"); ui.composer().onModelChange("model");
        ui.type(" submitted "); ui.attach("submitted-ref");
        const created = thread("created"); ui.threads.push(created);
        return {ui, created};
    }
    it("keeps captured payload in the attempt before navigation; keeps newer home text during deferred creation and begin", async () => {
        const {ui, created} = home(); const creation = deferred<ChatThread>(); const begin = deferred<{id: string}>();
        io.create.mockReturnValue(creation.promise); io.begin.mockReturnValue(begin.promise);
        const pending = ui.send(); await settle();
        expect(io.create).toHaveBeenCalledTimes(1); expect(io.begin).not.toHaveBeenCalled();
        ui.type("new home text");
        io.navigate.mockImplementation(async () => {
            ui.select(created.id);
            expect(ui.composer().value).toBe("");
            expect(ui.composer().attachments).toEqual([]);
            expect(ui.attempts()[0].submitted.text).toBe(" submitted ");
            expect(io.begin).not.toHaveBeenCalled();
        });
        creation.resolve(created); await settle();
        expect(io.begin.mock.calls[0][0]).toMatchObject({threadId: created.id, content: "submitted",
            attachments: [{referenceId: "submitted-ref", revision: 1}]});
        ui.type("new created text"); begin.resolve({id: "run"}); await pending; await settle();
        expect(ui.composer().value).toBe("new created text"); expect(ui.composer().attachments).toEqual([]);
        expect(io.execute.mock.calls[0][2].signal.aborted).toBe(false);
        ui.select(); expect(ui.composer().value).toBe("new home text"); expect(ui.composer().attachments).toEqual([]);
    });
    it("successful first begin clears unchanged destination and keeps home edit-then-revert", async () => {
        const {ui, created} = home(); const gate = deferred<ChatThread>(); io.create.mockReturnValue(gate.promise);
        const pending = ui.send(); await settle(); ui.type("different"); ui.type(" submitted ");
        gate.resolve(created); await pending; await settle();
        expect(ui.composer().value).toBe(""); expect(ui.composer().attachments).toEqual([]);
        ui.select(); expect(ui.composer().value).toBe(" submitted ");
        expect(io.begin).toHaveBeenCalledTimes(1); expect(io.execute).toHaveBeenCalledTimes(1);
    });
    it("failed begin retains submitted text and attachments visibly in the created thread for explicit retry", async () => {
        const {ui, created} = home(); io.create.mockResolvedValue(created); io.begin.mockRejectedValueOnce(new Error("begin failed"));
        await ui.send(); expect(ui.active()).toBe(created.id);
        expect(ui.composer().value).toBe(""); expect(ui.composer().attachments).toEqual([]);
        expect(ui.attempts()[0].submitted).toMatchObject({text: " submitted ", attachments: [{referenceId: "submitted-ref", revision: 1}]});
        expect(io.execute).not.toHaveBeenCalled(); expect(ui.composer().sending).toBe(false);
        expect(io.begin).toHaveBeenCalledTimes(1); io.begin.mockResolvedValueOnce({id: "retry-run"});
        await ui.action("retry"); expect(io.begin).toHaveBeenCalledTimes(2);
        expect(ui.composer().value).toBe(""); expect(ui.composer().attachments).toEqual([]);
        expect(io.create).toHaveBeenCalledTimes(1);
    });
    it("failed creation keeps origin contents and sends nothing", async () => {
        const {ui} = home(); io.create.mockRejectedValue(new Error("creation failed")); await ui.send();
        expect(ui.active()).toBeUndefined(); expect(ui.composer().value).toBe("");
        expect(ui.attempts()[0].submitted.text).toBe(" submitted ");
        expect(ui.composer().attachments).toEqual([]); expect(ui.attempts()[0].submitted.attachments).toHaveLength(1); expect(io.begin).not.toHaveBeenCalled();
        expect(io.execute).not.toHaveBeenCalled();
    });
    it("failed Web Lock acquisition preserves the origin before any transfer or navigation", async () => {
        const {ui, created} = home(); io.create.mockResolvedValue(created);
        io.lock.mockRejectedValue(new Error("thread already running"));
        await ui.send();
        expect(ui.active()).toBeUndefined(); expect(ui.composer().value).toBe("");
        expect(ui.attempts()[0].submitted.text).toBe(" submitted ");
        expect(ui.composer().attachments).toEqual([]);
        expect(ui.attempts()[0].submitted.attachments).toEqual([{referenceId: "submitted-ref", revision: 1}]);
        expect(ui.composer().sending).toBe(false); expect(io.navigate).not.toHaveBeenCalled();
        expect(io.begin).not.toHaveBeenCalled(); expect(io.execute).not.toHaveBeenCalled();
        expect(toast.error).toHaveBeenCalledWith("发送失败", expect.objectContaining({description: "thread already running"}));
    });
    it("failed navigation retains the attempt and explicit restoration recovers unchanged origin and no run begins", async () => {
        const {ui, created} = home(); io.create.mockResolvedValue(created); io.navigate.mockRejectedValue(new Error("navigation failed"));
        await ui.send(); expect(ui.active()).toBeUndefined(); expect(ui.composer().value).toBe("");
        expect(ui.attempts()[0].submitted.text).toBe(" submitted ");
        expect(ui.composer().attachments).toEqual([]); expect(ui.attempts()[0].submitted.attachments).toHaveLength(1); expect(io.begin).not.toHaveBeenCalled();
        ui.select(created.id); expect(ui.composer().value).toBe(""); expect(ui.composer().attachments).toEqual([]);
    });
    it("failed navigation keeps newer home edits and exposes preserved submitted payload in the created topic", async () => {
        const {ui, created} = home(); const gate = deferred<ChatThread>(); io.create.mockReturnValue(gate.promise);
        const pending = ui.send(); await settle(); ui.type("new home");
        io.navigate.mockRejectedValue(new Error("navigation failed")); gate.resolve(created); await pending; await settle();
        expect(ui.composer().value).toBe("new home"); expect(io.begin).not.toHaveBeenCalled();
        expect(toast.error).toHaveBeenCalledWith("发送失败", expect.objectContaining({description: "navigation failed"}));
        ui.select(created.id); expect(ui.composer().value).toBe(""); expect(ui.composer().attachments).toEqual([]);
        expect(ui.attempts()[0].submitted).toMatchObject({text: " submitted ", attachments: [{referenceId: "submitted-ref", revision: 1}]});
    });
    it("deferred failed navigation cannot roll back over post-transfer home edits", async () => {
        const {ui, created} = home(); io.create.mockResolvedValue(created); const nav = deferred<void>();
        io.navigate.mockReturnValue(nav.promise); const pending = ui.send(); await settle(); ui.type("after transfer");
        nav.reject(new Error("navigation failed")); await pending; await settle();
        expect(ui.composer().value).toBe("after transfer"); ui.select(created.id);
        expect(ui.composer().value).toBe(""); expect(ui.composer().attachments).toEqual([]);
        expect(ui.attempts()[0].submitted).toMatchObject({text: " submitted ", attachments: [{referenceId: "submitted-ref", revision: 1}]});
    });
    it("failed navigation cannot restore after target edits then reverts to the submitted text", async () => {
        const {ui, created} = home(); io.create.mockResolvedValue(created); const nav = deferred<void>();
        io.navigate.mockImplementation(() => {ui.select(created.id); return nav.promise;});
        const pending = ui.send(); await settle();
        expect(ui.composer().value).toBe(""); ui.type("edited target"); ui.type(" submitted ");
        nav.reject(new Error("navigation failed")); await pending; await settle();
        expect(ui.composer().value).toBe(" submitted ");
        expect(ui.composer().attachments).toEqual([]);
        expect(ui.attempts()[0].submitted.attachments).toEqual([{referenceId: "submitted-ref", revision: 1}]);
        expect(toast.error).toHaveBeenCalledWith("发送失败", expect.objectContaining({description: "navigation failed"}));
        expect(io.begin).not.toHaveBeenCalled(); expect(io.execute).not.toHaveBeenCalled();
        ui.select(); expect(ui.composer().value).toBe(""); expect(ui.composer().attachments).toEqual([]);
    });
    it("existing destination draft is never overwritten and origin stays intact", async () => {
        const {ui, created} = home(); ui.select(created.id); ui.type("existing target"); ui.attach("target-ref"); ui.select();
        io.create.mockResolvedValue(created); await ui.send();
        expect(io.navigate).not.toHaveBeenCalled(); expect(io.begin).not.toHaveBeenCalled();
        expect(ui.composer().value).toBe(""); expect(ui.composer().attachments).toEqual([]);
        expect(ui.attempts()[0].submitted).toMatchObject({text: " submitted ", attachments: [{referenceId: "submitted-ref", revision: 1}]});
        ui.select(created.id); expect(ui.composer().value).toBe("existing target");
        expect(ui.composer().attachments).toEqual([{referenceId: "target-ref", revision: 1}]);
    });
    it("switching during creation aborts old send before transfer/navigation", async () => {
        const {ui, created} = home(); const gate = deferred<ChatThread>(); io.create.mockReturnValue(gate.promise);
        const pending = ui.send(); await settle(); ui.select("B"); ui.type("other draft"); gate.resolve(created); await pending; await settle();
        expect(io.navigate).not.toHaveBeenCalled(); expect(io.begin).not.toHaveBeenCalled();
        expect(ui.composer().value).toBe("other draft"); ui.select();
        expect(ui.composer().value).toBe(""); expect(ui.composer().attachments).toEqual([]);
        expect(ui.attempts()[0].submitted).toMatchObject({text: " submitted ", attachments: [{referenceId: "submitted-ref", revision: 1}]});
    });
    it("late successful begin clears only its submitted owner and aborts execution after route switch", async () => {
        const ui = page("B"); ui.type("same"); ui.attach("refB"); ui.select("A"); ui.type("same"); ui.attach("refA"); const gate = deferred<{id: string}>(); io.begin.mockReturnValue(gate.promise);
        const pending = ui.send(); await settle(); ui.select("B"); ui.type("same");
        gate.resolve({id: "run"}); await pending; await settle();
        expect(ui.composer().value).toBe("same"); expect(ui.composer().attachments).toEqual([{referenceId: "refB", revision: 1}]);
        expect(io.execute.mock.calls[0][2].signal.aborted).toBe(true);
        ui.select("A"); expect(ui.composer().value).toBe(""); expect(ui.composer().attachments).toEqual([]);
    });
    it("existing-thread payload is consumed immediately and next edits survive execution completion", async () => {
        const ui = page("A"); ui.type("submitted"); ui.attach("refA"); const gate = deferred<void>(); io.execute.mockReturnValue(gate.promise);
        const pending = ui.send(); await settle(); expect(ui.composer().value).toBe(""); expect(ui.composer().attachments).toEqual([]);
        expect(ui.composer().sending).toBe(true); ui.type("next draft"); gate.resolve(); await pending; await settle();
        expect(ui.composer().value).toBe("next draft"); expect(ui.composer().sending).toBe(false);
    });
    it("failed existing-thread begin keeps attempted contents and run count and permits explicit retry", async () => {
        const ui = page("A"); ui.type("submitted"); ui.attach("refA"); io.begin.mockRejectedValueOnce(new Error("begin failed"));
        await ui.send(); expect(ui.composer().value).toBe(""); expect(ui.composer().attachments).toEqual([]);
        expect(ui.attempts()[0].submitted.text).toBe("submitted");
        expect(io.execute).not.toHaveBeenCalled(); expect(io.begin).toHaveBeenCalledTimes(1);
        await ui.action("retry"); expect(io.begin).toHaveBeenCalledTimes(2); expect(ui.composer().value).toBe("");
    });
    it("new topic success preserves old unsent draft and new topic starts empty", async () => {
        const ui = page("A"); ui.type("old unsent"); ui.attach("refA"); const created = thread("new-topic"); ui.threads.push(created);
        io.create.mockResolvedValue(created); (ui.surface().props.onNewTopic as () => void)(); await settle();
        expect(ui.composer().value).toBe(""); expect(ui.composer().attachments).toEqual([]);
        ui.select("A"); expect(ui.composer().value).toBe("old unsent"); expect(ui.composer().attachments).toHaveLength(1);
    });
    it("home project selection keeps independent text and attachments", async () => {
        const ui = page(); ui.composer().onProjectChange("p"); ui.type("project p"); ui.attach("p-ref");
        ui.composer().onProjectChange("q"); expect(ui.composer().value).toBe(""); ui.type("project q"); ui.attach("q-ref");
        ui.composer().onProjectChange("p"); expect(ui.composer().value).toBe("project p");
        expect(ui.composer().attachments).toEqual([{referenceId: "p-ref", revision: 1}]);
    });
    it("locks attachment mutation and duplicate sends while allowing text edits during send", async () => {
        const ui = page("A"); ui.type("submitted"); ui.attach("refA"); const gate = deferred<{id: string}>(); io.begin.mockReturnValue(gate.promise);
        const pending = ui.send(); await settle(); const composer = ui.composer();
        composer.onAttachReference!({referenceId: "new", revision: 1}); composer.onRemoveReference!({referenceId: "refA", revision: 1});
        composer.onImportReferences!([new File(["x"], "x.txt")]); composer.onCancelReferenceImport!("old-job");
        composer.onRetryReferenceImport!({id: "job", file: new File([], "file.txt"), filename: "file.txt", status: "failed"});
        await ui.send(); ui.type("new text");
        expect(ui.composer().attachments).toEqual([]); expect(ui.attempts()[0].submitted.attachments).toEqual([{referenceId: "refA", revision: 1}]); expect(io.importFile).not.toHaveBeenCalled();
        expect(io.retryImport).not.toHaveBeenCalled(); expect(io.begin).toHaveBeenCalledTimes(1);
        gate.resolve({id: "run"}); await pending; await settle(); expect(ui.composer().value).toBe("new text");
    });
    it("same-render text/reference edits are the exact submitted payload", async () => {
        const ui = page("A"); const composer = ui.composer();
        composer.onChange("immediate text"); composer.onAttachReference!({referenceId: "immediate-ref", revision: 2});
        composer.onSend(); await settle();
        expect(io.begin.mock.calls[0][0]).toMatchObject({content: "immediate text", attachments: [{referenceId: "immediate-ref", revision: 2}]});
        expect(ui.composer().value).toBe(""); expect(ui.composer().attachments).toEqual([]);
    });
    it("same-render import blocks the captured send callback until success", async () => {
        const ui = page("A"); const composer = ui.composer(); const gate = deferred<ProjectReference>(); io.importFile.mockReturnValue(gate.promise);
        composer.onChange("immediate text"); composer.onImportReferences!([new File(["x"], "file.txt")]); composer.onSend();
        await settle(); expect(io.begin).not.toHaveBeenCalled(); gate.resolve(reference("ref")); await settle();
        expect(ui.composer().value).toBe("immediate text"); expect(ui.composer().attachments).toHaveLength(1);
    });
    it("an existing destination edited back to empty still rejects transfer", async () => {
        const {ui, created} = home(); ui.select(created.id); ui.type("draft"); ui.type(""); ui.select();
        io.create.mockResolvedValue(created); await ui.send();
        expect(io.begin).not.toHaveBeenCalled(); expect(ui.composer().value).toBe("");
        expect(ui.attempts()[0].submitted.text).toBe(" submitted ");
        expect(ui.composer().attachments).toEqual([]);
    });
    it("execution failure after committed begin retains next edits and does not restore submitted draft", async () => {
        const {ui, created} = home(); io.create.mockResolvedValue(created); const gate = deferred<void>(); io.execute.mockReturnValue(gate.promise);
        const pending = ui.send(); await settle(); expect(ui.composer().value).toBe(""); ui.type("next");
        gate.reject(new Error("execution failed")); await pending; await settle();
        expect(ui.composer().value).toBe("next"); expect(ui.composer().attachments).toEqual([]);
        expect(toast.error).toHaveBeenCalledWith("发送失败", expect.objectContaining({description: "execution failed"})); expect(io.begin).toHaveBeenCalledTimes(1);
    });
    it("preserves composer loading gate when routed ownership is pending", () => {
        const ui = page(); ui.pendingOwnership();
        expect(ui.render().some(node => node.type === "workspace" || node.type === "home")).toBe(false);
    });
});

describe("E02 immediate submission recovery", () => {
    it("publishes exact payload and clears composer before preparation; same-tick duplicates stay one intent", async () => {
        const ui = page("A"); ui.type("  immediate  "); ui.attach("refA");
        const gate = deferred<{ok: false; message: string}>(); io.compatible.mockReturnValue(gate.promise);
        const composer = ui.composer(); composer.onSend(); composer.onSend();
        expect(ui.composer().value).toBe(""); expect(ui.composer().attachments).toEqual([]);
        expect(ui.attempts()).toHaveLength(1);
        expect(ui.attempts()[0]).toMatchObject({phase: "preparing", submitted: {text: "  immediate  ",
            attachments: [{referenceId: "refA", revision: 1}]}});
        expect(io.compatible).not.toHaveBeenCalled();
        ui.type("next draft"); await settle(); expect(io.compatible).toHaveBeenCalledTimes(1);
        gate.resolve({ok: false, message: "offline"}); await settle();
        expect(ui.attempts()[0]).toMatchObject({phase: "failed", error: "offline"});
        expect(ui.composer().value).toBe("next draft"); expect(io.begin).not.toHaveBeenCalled();
        expect(io.execute).not.toHaveBeenCalled();
    });
    it("restores exact failed text/references only into the unchanged consumed composer", async () => {
        const ui = page("A"); ui.type("  recover me  "); ui.attach("exact-ref");
        io.begin.mockRejectedValueOnce(new Error("rollback")); await ui.send();
        expect(ui.composer().value).toBe(""); expect(ui.attempts()[0].phase).toBe("failed");
        await ui.action("restore"); expect(ui.composer().value).toBe("  recover me  ");
        expect(ui.composer().attachments).toEqual([{referenceId: "exact-ref", revision: 1}]);
        expect(ui.attempts()).toEqual([]);
    });
    it("refuses restore after text edits back to empty or any attachment mutation", async () => {
        const ui = page("A"); ui.type("first"); io.begin.mockRejectedValueOnce(new Error("rollback")); await ui.send();
        ui.type("later"); ui.type(""); await ui.action("restore");
        expect(ui.composer().value).toBe(""); expect(ui.attempts()[0].submitted.text).toBe("first");
        ui.attach("later-ref"); ui.composer().onRemoveReference!({referenceId: "later-ref", revision: 1});
        await ui.action("restore"); expect(ui.composer().attachments).toEqual([]); expect(ui.attempts()).toHaveLength(1);
    });
    it("retains an earlier failed candidate when a later turn is submitted", async () => {
        const ui = page("A"); ui.type("failed first"); io.begin.mockRejectedValueOnce(new Error("rollback")); await ui.send();
        const first = ui.attempts()[0].admission.userMessageId;
        ui.type("next turn"); await ui.send();
        expect(ui.attempts()).toHaveLength(2); expect(ui.attempts()[0]).toMatchObject({phase: "failed", admission: {userMessageId: first}});
        expect(ui.attempts()[1].phase).toBe("accepted"); expect(io.execute).toHaveBeenCalledTimes(1);
    });
    it("unknown absent/read failure never permits retry, restore or automatic paid dispatch", async () => {
        const ui = page("A"); ui.type("uncertain"); io.begin.mockRejectedValueOnce(new UnknownCommitError("op", "workspace"));
        await ui.send(); expect(ui.attempts()[0].phase).toBe("uncertain");
        await ui.action("retry"); await ui.action("restore"); expect(io.begin).toHaveBeenCalledTimes(1);
        io.reconcile.mockRejectedValueOnce(new Error("read unavailable")); await ui.action("check");
        expect(ui.attempts()[0].phase).toBe("uncertain"); expect(ui.composer().value).toBe("");
        io.reconcile.mockResolvedValueOnce({status: "absent"}); await ui.action("check");
        expect(ui.attempts()[0].phase).toBe("uncertain");
        io.reconcile.mockResolvedValueOnce({status: "accepted", run: {status: "running"}}); await ui.action("check");
        expect(ui.attempts()[0].phase).toBe("accepted"); expect(io.execute).not.toHaveBeenCalled();
        expect(io.begin).toHaveBeenCalledTimes(1);
    });
    it("real lost acknowledgement keeps explicit owned state recovery and starts no model request", async () => {
        const {db} = await import("@/platform/product/store");
        const {createProject} = await import("@/features/projects/commands/projects");
        const commands = await vi.importActual<typeof import("@/features/agent/commands/agentRuns")>("@/features/agent/commands/agentRuns");
        const chat = await vi.importActual<typeof import("@/features/agent/commands/chat")>("@/features/agent/commands/chat");
        const reads = await vi.importActual<typeof import("@/features/agent/queries/agentAdmission")>("@/features/agent/queries/agentAdmission");
        const ownership = await vi.importActual<typeof import("@/features/agent/runtime/runOwnership")>("@/features/agent/runtime/runOwnership");
        const project = await createProject("lost acknowledgement"); await db.projects.add({...project, id: "p"});
        await db.chatThreads.delete("A"); await chat.createChatThread({id: "A", projectId: "p", connectorId: connector.id, model: "model"});
        io.begin.mockImplementation(async input => {await commands.beginAgentRun(input); throw new UnknownCommitError("lost-reply", "test-workspace");});
        io.reconcile.mockImplementation(reads.readAgentAdmission);
        const ui = page("A"); ui.type("one committed turn"); await ui.send();
        await vi.waitFor(async () => {await settle(); expect(ui.attempts()[0].phase).toBe("accepted");});
        const admission = ui.attempts()[0].admission;
        expect(await db.agentRuns.count()).toBe(1); expect(await db.chatMessages.count()).toBe(2);
        expect(await db.agentRuns.get(admission.runId)).toMatchObject({userMessageId: admission.userMessageId, assistantMessageId: admission.assistantMessageId});
        expect((await db.chatMessages.get(admission.userMessageId))?.content).toBe("one committed turn");
        expect(ui.attempts()[0].recoveryRequired).toBe(true);
        (ui.surface().props.onSubmissionObserved as (id: string) => void)(admission.userMessageId);
        expect(ui.attempts()).toHaveLength(1);
        await ui.action("retry"); await ui.action("restore"); await ui.action("check");
        expect(io.begin).toHaveBeenCalledTimes(1); expect(io.execute).not.toHaveBeenCalled();
        expect(ui.composer().value).toBe("");
        expect((await db.agentRuns.get(admission.runId))?.status).toBe("running");
        io.lock.mockImplementation((id, operation) => ownership.withThreadRunLock(id, operation, {
            request: (_name, _options, callback) => callback(null)
        }));
        await ui.action("recover");
        expect((await db.agentRuns.get(admission.runId))?.status).toBe("running");
        expect(ui.attempts()[0].recoveryRequired).toBe(true);
        expect(ui.attempts()[0].error).toContain("暂时无法恢复");
        io.lock.mockImplementation((id, operation) => ownership.withThreadRunLock(id, operation, {
            request: (_name, _options, callback) => callback({})
        }));
        await ui.action("recover");
        expect((await db.agentRuns.get(admission.runId))?.status).toBe("interrupted");
        expect(ui.attempts()[0].recoveryRequired).toBe(false);
        expect(io.begin).toHaveBeenCalledTimes(1); expect(io.execute).not.toHaveBeenCalled();
        expect(await db.agentRuns.count()).toBe(1); expect(await db.chatMessages.count()).toBe(2);
        (ui.surface().props.onSubmissionObserved as (id: string) => void)(admission.userMessageId);
        expect(ui.attempts()).toHaveLength(0);
    });
    it("a positively reconciled explicit retry joins accepted records without dispatching", async () => {
        const ui = page("A"); ui.type("accepted before lost reply"); io.begin.mockRejectedValueOnce(new Error("reply lost")); await ui.send();
        io.reconcile.mockResolvedValueOnce({status: "accepted", run: {status: "running"}}); await ui.action("retry");
        expect(ui.attempts()[0].phase).toBe("accepted"); expect(io.begin).toHaveBeenCalledTimes(1);
        expect(io.execute).not.toHaveBeenCalled(); expect(ui.composer().value).toBe("");
    });
    it("the real pre-begin transaction refuses changed project ownership before updating settings", async () => {
        const ui = page("A"); ui.type("frozen project");
        const gate = deferred<void>(); io.lock.mockImplementation(async (_id, operation) => {await gate.promise; return operation();});
        const pending = ui.send(); await settle(); await db.chatThreads.update("A", {projectId: "foreign"});
        gate.resolve(); await pending; await settle();
        expect(io.update).not.toHaveBeenCalled(); expect(io.begin).not.toHaveBeenCalled(); expect(io.execute).not.toHaveBeenCalled();
        expect(ui.attempts()[0].phase).toBe("failed"); expect((await db.chatThreads.get("A"))?.projectId).toBe("foreign");
    });
    it("Stop during deferred update never begins a new durable run and leaves recovery", async () => {
        const ui = page("A"); ui.type("stop before begin"); const gate = deferred<void>(); io.update.mockReturnValue(gate.promise);
        const pending = ui.send(); await settle(); ui.composer().onStop(); gate.resolve(); await pending; await settle();
        expect(io.begin).not.toHaveBeenCalled(); expect(io.execute).not.toHaveBeenCalled();
        expect(ui.attempts()[0].phase).toBe("failed"); await ui.action("restore");
        expect(ui.composer().value).toBe("stop before begin");
    });
    it("switching while retry credentials resolve cannot restart old work", async () => {
        const ui = page("A"); ui.type("old"); io.begin.mockRejectedValueOnce(new Error("rollback")); await ui.send();
        const gate = deferred<ConnectorConfig>(); io.resolveConnector.mockReturnValue(gate.promise);
        const pending = ui.action("retry"); await settle(); ui.select("B"); ui.type("new owner");
        gate.resolve(connector); await pending; await settle(); expect(io.begin).toHaveBeenCalledTimes(1);
        expect(io.execute).not.toHaveBeenCalled(); expect(ui.composer().value).toBe("new owner");
        ui.select("A"); expect(ui.attempts()[0].submitted.text).toBe("old");
    });
});

describe("B07 actual reference import callbacks", () => {
    it("origin-bound success preserves text/edit revision and leaves other scope alone", async () => {
        const host = mount(); let scope = "A"; const render = () => {
            let value!: ReturnType<typeof useReferenceDraft>; draw(host, () => {value = useReferenceDraft(scope, "p"); return null;}); return value;
        };
        render().setText("first"); const snapshot = render().capture(); const gate = deferred<ProjectReference>(); io.importFile.mockReturnValue(gate.promise);
        const importing = render().importFiles([new File(["x"], "file.txt")]);
        const options = io.importFile.mock.calls[0][2]; options.onProgress({id: "ref"});
        render().setText("edited"); render().setText("first"); const editedRevision = render().textRevision;
        scope = "B"; render().setText("other"); gate.resolve(reference("ref")); await importing;
        expect(render().text).toBe("other"); expect(render().attachments).toEqual([]);
        scope = "A"; expect(render().text).toBe("first"); expect(render().textRevision).toBe(editedRevision);
        expect(render().attachments).toEqual([{referenceId: "ref", revision: 1}]); expect(render().imports).toEqual([]);
        render().acknowledge(snapshot); expect(render().text).toBe("first"); expect(render().attachments).toHaveLength(1);
    });
    it("page import failure retains origin file/reference/error for retry without replacing compose fields", async () => {
        const ui = page("A"); ui.type("origin"); const file = new File(["resource"], "resource.txt"); const gate = deferred<ProjectReference>();
        io.importFile.mockReturnValue(gate.promise); ui.composer().onImportReferences!([file]);
        io.importFile.mock.calls[0][2].onProgress({id: "allocated-reference"}); ui.type("edited origin"); ui.select("B"); ui.type("other");
        gate.reject(new Error("parse failed")); await settle();
        expect(ui.composer().referenceImports).toEqual([]); ui.select("A");
        expect(ui.composer().value).toBe("edited origin"); const job = ui.composer().referenceImports![0];
        expect(job).toMatchObject({file, referenceId: "allocated-reference", status: "failed", error: "parse failed"});
        const retry = deferred<ProjectReference>(); io.retryImport.mockReturnValue(retry.promise); ui.composer().onRetryReferenceImport!(job);
        expect(io.retryImport.mock.calls[0].slice(0, 2)).toEqual(["p", "allocated-reference"]);
        ui.type("after retry started"); retry.resolve(reference("allocated-reference")); await settle();
        expect(ui.composer().value).toBe("after retry started"); expect(ui.composer().referenceImports).toEqual([]);
        expect(ui.composer().attachments).toEqual([{referenceId: "allocated-reference", revision: 1}]);
    });
    it("cancellation and unmount abort import and prevent late publish", async () => {
        const ui = page("A"); ui.type("keep"); const first = deferred<ProjectReference>(); io.importFile.mockReturnValueOnce(first.promise);
        ui.composer().onImportReferences!([new File(["x"], "file.txt")]); const firstSignal = io.importFile.mock.calls[0][2].signal as AbortSignal;
        ui.composer().onCancelReferenceImport!(ui.composer().referenceImports![0].id); first.resolve(reference("cancelled")); await settle();
        expect(firstSignal.aborted).toBe(true); expect(ui.composer().attachments).toEqual([]); expect(ui.composer().value).toBe("keep");
        const second = deferred<ProjectReference>(); io.importFile.mockReturnValueOnce(second.promise);
        ui.composer().onImportReferences!([new File(["x"], "file.txt")]); const secondSignal = io.importFile.mock.calls[1][2].signal as AbortSignal;
        unmount(ui.host); expect(secondSignal.aborted).toBe(true); second.resolve(reference("late")); await settle();
        expect(ui.host.lateWrites).toBe(0);
    });
    it("active import blocks send until ready; async success preserves page text", async () => {
        const ui = page("A"); ui.type("original"); const gate = deferred<ProjectReference>(); io.importFile.mockReturnValue(gate.promise);
        ui.composer().onImportReferences!([new File(["x"], "file.txt")]); await ui.send(); expect(io.begin).not.toHaveBeenCalled();
        ui.type("changed"); gate.resolve(reference("ref")); await settle();
        expect(ui.composer().value).toBe("changed"); await ui.send();
        expect(io.begin.mock.calls[0][0]).toMatchObject({content: "changed", attachments: [{referenceId: "ref", revision: 1}]});
    });
});

import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import type {ConnectorConfig} from "@/features/settings/models/connector";
import type {ChatThread} from "@/features/agent/models/chat";

const host = vi.hoisted(() => ({cells: [] as unknown[], cursor: 0, effects: [] as (() => void)[], cleanups: new Map<number, () => void>()}));
vi.mock("react", async original => ({...await original<typeof import("react")>(),
    useRef: (initial: unknown) => {const index = host.cursor++; if (!(index in host.cells)) host.cells[index] = {current: initial}; return host.cells[index];},
    useState: (initial: unknown) => {const index = host.cursor++; if (!(index in host.cells)) host.cells[index] = initial; return [host.cells[index], (next: unknown) => {host.cells[index] = typeof next === "function" ? next(host.cells[index]) : next;}];},
    useEffect: (setup: () => void | (() => void), deps: unknown[]) => {
        const index = host.cursor++, previous = host.cells[index] as unknown[] | undefined;
        if (!previous || deps.some((value, i) => !Object.is(value, previous[i]))) {
            host.cells[index] = deps;
            host.effects.push(() => {host.cleanups.get(index)?.(); const cleanup = setup(); if (cleanup) host.cleanups.set(index, cleanup);});
        }
    },
    useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot(),
    useMemo: (compute: () => unknown) => compute(), useCallback: (fn: unknown) => fn,
}));

import {reserveAgentThreadWork, currentAgentThreadWork} from "@/features/agent/runtime/threadWork";
import {agentExecution} from "@/features/agent/runtime/agentExecution";
import {useChatExecutionSession} from "@/features/agent/ui/useChatExecutionSession";
import {useChatSelection} from "@/features/agent/ui/useChatSelection";
import {createChatThread, updateChatThread} from "@/features/agent/commands/chat";
import {db} from "@/platform/product/store";

function render<T>(run: () => T): T {host.cursor = 0; const value = run(); host.effects.splice(0).forEach(fn => fn()); return value;}
beforeEach(() => {host.cells = []; host.cursor = 0; host.effects = []; host.cleanups.clear();});
afterEach(() => {for (const cleanup of host.cleanups.values()) cleanup();});
const connector: ConnectorConfig = {id: "d03-connector", definitionId: "openai-compatible", protocol: "openai-compatible", baseUrl: "https://d03.invalid/v1", apiKey: "local", updatedAt: "2026-10-08"};

describe("D03 execution and selection owners", () => {
    it("reserves synchronously per thread, retains A across route switches and ignores a stale release", async () => {
        let finishA!: () => void, finishB!: () => void;
        const a = reserveAgentThreadWork(db, {kind: "model", threadId: "A", invocationId: "A"}, new AbortController());
        a.follow(new Promise<void>(resolve => {finishA = resolve;}));
        expect(render(() => useChatExecutionSession("A", "A")).sending).toBe(true);
        expect(() => reserveAgentThreadWork(db, {kind: "model", threadId: "A", invocationId: "duplicate"}, new AbortController())).toThrow("尚有执行");
        expect(render(() => useChatExecutionSession("B", "B")).sending).toBe(false);
        expect(a.work.controller.signal.aborted).toBe(false);
        const b = reserveAgentThreadWork(db, {kind: "model", threadId: "B", invocationId: "B"}, new AbortController());
        b.follow(new Promise<void>(resolve => {finishB = resolve;}));
        finishA(); await a.work.done;
        expect(currentAgentThreadWork(db, "B")).toBe(b.work);
        expect(agentExecution.requestWorkStop({threadId: "B", work: a.work})).toBe(false);
        expect(b.work.controller.signal.aborted).toBe(false);
        finishB(); await b.work.done;
    });
    it("view cleanup/setup replay retains the captured original work and explicit Stop waits final flush", async () => {
        let finish!: () => void;
        const reservation = reserveAgentThreadWork(db, {kind: "model", threadId: "created", invocationId: "original"}, new AbortController());
        reservation.follow(new Promise<void>(resolve => {finish = resolve;}));
        render(() => useChatExecutionSession(undefined, "home"));
        for (const cleanup of host.cleanups.values()) cleanup();
        expect(reservation.work.controller.signal.aborted).toBe(false);
        expect(render(() => useChatExecutionSession("created", "created")).sending).toBe(true);
        expect(agentExecution.requestWorkStop({threadId: "created", work: reservation.work})).toBe(true);
        expect(currentAgentThreadWork(db, "created")).toBe(reservation.work);
        finish(); await reservation.work.done;
        expect(render(() => useChatExecutionSession("created", "created")).sending).toBe(false);
    });
    it("scopes interaction to thread and effort to connector/base/model, updates revision before persistence settles", async () => {
        let activeThread: ChatThread | undefined = await createChatThread({connectorId: connector.id, model: " original "});
        await updateChatThread(activeThread!.id, {interactionMode: "conversation"});
        activeThread = await db.chatThreads.get(activeThread!.id);
        const read = () => useChatSelection({loaded: true, activeThread, activeThreadId: activeThread?.id, connectorList: [connector]});
        render(read);
        let selection = render(read);
        expect(selection.snapshot).toMatchObject({model: "original", interactionMode: "conversation", scope: activeThread!.id});
        const revision = selection.selectionRevisionRef.current;
        const pending = selection.handleInteractionModeChange("smart");
        expect(selection.selectionRevisionRef.current).toBe(revision + 1);
        await pending;
        expect((await db.chatThreads.get(activeThread!.id))?.interactionMode).toBe("smart");
        const firstId = activeThread!.id;
        activeThread = await createChatThread({connectorId: connector.id, model: "other"});
        await updateChatThread(activeThread!.id, {interactionMode: "conversation"});
        activeThread = await db.chatThreads.get(activeThread!.id);
        render(read); selection = render(read);
        expect(selection.snapshot.scope).not.toBe(firstId);
        expect(selection.snapshot.interactionMode).toBe("conversation");
        const changed = selection.handleModelChange("different");
        expect(selection.selectionRevisionRef.current).toBe(revision + 2);
        await changed;
        selection = render(read);
        expect(selection.snapshot.model).toBe("different");
        expect(selection.snapshot.reasoningEffort).toBeUndefined();
    });
    it("applies effort only to its offering destination/model and falls back independently after a thread switch", async () => {
        let activeThread = await createChatThread({connectorId: connector.id, model: "gpt-5"});
        await updateChatThread(activeThread.id, {reasoningSelection: {connectorId: connector.id, baseUrl: connector.baseUrl, model: "gpt-5", value: "high"}});
        activeThread = (await db.chatThreads.get(activeThread.id))!;
        let currentConnector = connector;
        const read = () => useChatSelection({loaded: true, activeThread, activeThreadId: activeThread.id, connectorList: [currentConnector]});
        render(read);
        let selection = render(read);
        expect(selection.snapshot.reasoningEffort).toBe("high");
        const revision = selection.selectionRevisionRef.current;
        const save = selection.handleReasoningEffortChange("low");
        expect(selection.selectionRevisionRef.current).toBe(revision + 1);
        await save;
        selection = render(read);
        expect(selection.snapshot.reasoningEffort).toBe("low");
        currentConnector = {...connector, baseUrl: "https://other.invalid/v1"};
        selection = render(read);
        expect(selection.snapshot.reasoningEffort).toBeUndefined();
        currentConnector = connector;
        selection = render(read);
        expect(selection.snapshot.reasoningEffort).toBe("low");
        await selection.handleModelChange("gpt-5.1");
        activeThread = (await db.chatThreads.get(activeThread.id))!;
        selection = render(read);
        expect(selection.snapshot.reasoningEffort).toBeUndefined();
        activeThread = await createChatThread({connectorId: connector.id, model: "gpt-5"});
        render(read);
        selection = render(read);
        expect(selection.snapshot.reasoningEffort).toBeUndefined();
    });

});

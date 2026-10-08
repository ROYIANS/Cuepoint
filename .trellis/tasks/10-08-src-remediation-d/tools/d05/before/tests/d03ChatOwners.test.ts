import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import type {ConnectorConfig, ChatThread} from "@/domain/types";

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
    useMemo: (compute: () => unknown) => compute(), useCallback: (fn: unknown) => fn,
}));

import {useChatExecutionSession} from "@/components/agent/useChatExecutionSession";
import {useChatSelection} from "@/components/agent/useChatSelection";
import {createChatThread, updateChatThread} from "@/db/chat";
import {db} from "@/db/database";

function render<T>(run: () => T): T {host.cursor = 0; const value = run(); host.effects.splice(0).forEach(fn => fn()); return value;}
beforeEach(() => {host.cells = []; host.cursor = 0; host.effects = []; host.cleanups.clear();});
afterEach(() => {for (const cleanup of host.cleanups.values()) cleanup();});
const connector: ConnectorConfig = {id: "d03-connector", name: "test", definitionId: "openai-compatible", baseUrl: "https://d03.invalid/v1", apiKey: "local", updatedAt: "2026-10-08"};

describe("D03 execution and selection owners", () => {
    it("locks synchronously until final release, aborts old route and refuses old finally in a new epoch", () => {
        let session = render(() => useChatExecutionSession("A"));
        const first = session.acquire()!;
        expect(session.acquire()).toBeUndefined();
        session = render(() => useChatExecutionSession("B"));
        expect(first.controller.signal.aborted).toBe(true);
        expect(session.sendLockRef.current).toBe(true);
        session.release(first);
        const second = session.acquire()!;
        session.release(first);
        expect(session.sendLockRef.current).toBe(true);
        expect(session.abortRef.current).toBe(second.controller);
        session.release(second);
        expect(session.sendLockRef.current).toBe(false);
    });
    it("binds new-topic identity before navigation and unmount aborts without allowing late acquire", () => {
        let session = render(() => useChatExecutionSession());
        const token = session.acquire()!;
        session.executionThreadRef.current = "created";
        session = render(() => useChatExecutionSession("created"));
        expect(token.controller.signal.aborted).toBe(false);
        for (const cleanup of host.cleanups.values()) cleanup();
        expect(token.controller.signal.aborted).toBe(true);
        expect(session.acquire()).toBeUndefined();
        session.release(token);
    });
    it("effect cleanup/setup replay keeps an aborted execution locked until its final flush releases it", () => {
        let session = render(() => useChatExecutionSession("A"));
        const token = session.acquire()!;
        host.cleanups.get(6)!();
        host.cells[6] = undefined;
        session = render(() => useChatExecutionSession("A"));
        expect(token.controller.signal.aborted).toBe(true);
        expect(session.sendLockRef.current).toBe(true);
        expect(session.acquire()).toBeUndefined();
        session.release(token);
        expect(session.sendLockRef.current).toBe(false);
    });
    it("scopes interaction to thread and effort to connector/base/model, updates revision before persistence settles", async () => {
        let activeThread: ChatThread | undefined = await createChatThread({connectorId: connector.id, model: " original ", interactionMode: "conversation"});
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
        activeThread = await createChatThread({connectorId: connector.id, model: "other", interactionMode: "conversation"});
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

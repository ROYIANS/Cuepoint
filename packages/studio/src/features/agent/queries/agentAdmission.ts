import {db as productDb} from "../../../platform/product/store";
import type {ProductStore} from "../../../platform/storage/types";
import type {ReferenceAttachment} from "../../references/models/references";
import type {AgentRun} from "../models/agent";
import type {ChatMessage} from "../models/chat";
import {assertChatAdmissionIdentity, normalizeSubmittedChatContent} from "../models/chatSubmission";
import type {ChatAdmissionIdentity} from "../models/chatSubmission";

type AgentAdmission =
    | {status: "absent"}
    | {status: "accepted"; run: AgentRun; userMessage: ChatMessage; assistantMessage: ChatMessage}
    | {status: "mismatch"};

type AdmissionInput = {
    threadId: string;
    admission: ChatAdmissionIdentity;
    connector: AgentRun["connector"];
    model: string;
    content: string;
    attachments?: readonly ReferenceAttachment[];
    projectId?: string;
};

function sameAttachments(actual: ReferenceAttachment[] | undefined, expected: readonly ReferenceAttachment[]): boolean {
    return (actual?.length ?? 0) === expected.length && expected.every((reference, index) =>
        actual?.[index]?.referenceId === reference.referenceId && actual[index].revision === reference.revision);
}

function normalizedEndpoint(baseUrl: string): string | undefined {
    try {
        const url = new URL(baseUrl.trim());
        if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.search || url.hash) return undefined;
        return url.toString().replace(/\/+$/, "");
    } catch {
        return undefined;
    }
}

function matchesRun(run: AgentRun, input: AdmissionInput, endpoint: string): boolean {
    return run.id === input.admission.runId && run.threadId === input.threadId && run.projectId === input.projectId &&
        run.retryOfRunId === undefined && run.userMessageId === input.admission.userMessageId &&
        run.assistantMessageId === input.admission.assistantMessageId && run.connector.id === input.connector.id &&
        run.connector.definitionId === input.connector.definitionId && normalizedEndpoint(run.connector.baseUrl) === endpoint &&
        run.model === input.model && run.context?.draft === input.content &&
        sameAttachments(run.context?.selectedReferences?.references, input.attachments ?? []);
}

function matchesMessages(user: ChatMessage, assistant: ChatMessage, input: AdmissionInput): boolean {
    return user.id === input.admission.userMessageId && user.threadId === input.threadId && user.role === "user" &&
        user.content === input.content && sameAttachments(user.attachments, input.attachments ?? []) &&
        assistant.id === input.admission.assistantMessageId && assistant.threadId === input.threadId &&
        assistant.role === "assistant" && assistant.runId === input.admission.runId;
}

/**
 * Read facts from one snapshot. An absent result cannot resolve an unknown commit
 * or authorize another begin/dispatch; only accepted is positive admission proof.
 */
export async function readAgentAdmission(input: AdmissionInput, store?: ProductStore): Promise<AgentAdmission> {
    const db = store ?? productDb;
    const admission = {...input.admission};
    assertChatAdmissionIdentity(admission);
    const attachments = input.attachments?.map(reference => ({...reference})) ?? [];
    const content = normalizeSubmittedChatContent(input.content, attachments);
    const connector = {...input.connector};
    const endpoint = normalizedEndpoint(connector.baseUrl);
    const model = input.model.trim();
    const {threadId, projectId} = input;
    const expected = {threadId, projectId, admission, attachments, connector, model, content};
    return db.transaction("r", [db.chatThreads, db.agentRuns, db.chatMessages], async tx => {
        const [thread, run, userMessage, assistantMessage] = await Promise.all([
            tx.chatThreads.get(threadId),
            tx.agentRuns.get(admission.runId),
            tx.chatMessages.get(admission.userMessageId),
            tx.chatMessages.get(admission.assistantMessageId)
        ]);
        if (thread && thread.projectId !== projectId) return {status: "mismatch"};
        if (!run && !userMessage && !assistantMessage) return {status: "absent"};
        if (!thread || !run || !userMessage || !assistantMessage || !endpoint || !model || !content) return {status: "mismatch"};
        if (!matchesRun(run, expected, endpoint) ||
            !matchesMessages(userMessage, assistantMessage, expected)) return {status: "mismatch"};
        return {status: "accepted", run, userMessage, assistantMessage};
    });
}

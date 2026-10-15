import type {ReferenceAttachment} from "../../references/models/references";

/** Caller-owned identity for one fresh turn; these IDs do not authorize execution. */
export type ChatAdmissionIdentity = Readonly<{
    runId: string;
    userMessageId: string;
    assistantMessageId: string;
}>;

export function assertChatSubmissionId(id: string): void {
    if (typeof id !== "string" || !id.length || id.length > 256 || /[\p{Cc}\s]/u.test(id)) {
        throw new Error("消息提交标识无效，请重新发送");
    }
}

export function assertChatAdmissionIdentity(admission: ChatAdmissionIdentity): void {
    const ids = [admission.runId, admission.userMessageId, admission.assistantMessageId];
    ids.forEach(assertChatSubmissionId);
    if (new Set(ids).size !== ids.length) throw new Error("消息提交标识不能重复");
}

/** Match the durable user message, including an attachment-only submission. */
export function normalizeSubmittedChatContent(content?: string, attachments?: readonly ReferenceAttachment[]): string {
    return content?.trim() || (attachments?.length ? "请结合附加的参考资料协助我。" : "");
}

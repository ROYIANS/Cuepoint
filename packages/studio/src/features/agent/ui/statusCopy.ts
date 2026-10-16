/**
 * Shared status vocabulary. Every surface that names one of these states
 * (sidebar, run details, batches, jobs) reads the wording from here so the
 * same state reads the same everywhere.
 */
export const STATUS_COPY = {
    running: "运行中",
    needsApproval: "需要你批准",
    needsInput: "需要你输入",
    failed: "失败",
    done: "已完成",
    unread: "有未读内容",
    readFailed: "状态读取失败",
} as const;

/** Recovery wording for outcomes that could not be confirmed. */
export const RECOVERY_COPY = {
    notConfirmed: "未确认",
    check: "检查",
    retry: "重试",
    skip: "跳过",
} as const;

export interface TopicActivityFlags {
    readonly busy: boolean;
    readonly waitingApproval: boolean;
    readonly unread: boolean;
    readonly unavailable: boolean;
}

/** The single marker a conversation row shows. */
export type TopicMarker = "approval" | "running" | "error" | "unread" | "none";

/** Precedence: needs-your-action, then running, then error, then unread. */
export function resolveTopicMarker(activity: TopicActivityFlags): TopicMarker {
    if (activity.waitingApproval) return "approval";
    if (activity.busy) return "running";
    if (activity.unavailable) return "error";
    if (activity.unread) return "unread";
    return "none";
}

/** Accessible label: every active state is announced, not only the visible marker. */
export function topicActivityLabel(activity: TopicActivityFlags): string {
    return [
        activity.waitingApproval ? STATUS_COPY.needsApproval : undefined,
        activity.busy ? STATUS_COPY.running : undefined,
        activity.unavailable ? STATUS_COPY.readFailed : undefined,
        activity.unread ? STATUS_COPY.unread : undefined,
    ].filter(Boolean).join("，");
}

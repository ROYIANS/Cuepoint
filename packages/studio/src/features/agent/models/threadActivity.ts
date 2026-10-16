export type ThreadActivityIdentity = Readonly<{threadId: string; key: string}>;
export type ThreadReportActivity = Readonly<{
    jobId: string;
    assistantMessageId: string;
    publicRevision: number;
    readRevision: number;
}>;
export type ThreadActivityRecord = Readonly<{
    version: 1;
    threadId: string;
    publicRevision: number;
    readRevision: number;
    reports: readonly ThreadReportActivity[];
}>;
export const THREAD_REPORT_LIMIT = 128;
export function isActivityRevision(value: unknown): value is number {
    return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
function record(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("对话阅读状态无效");
    return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, names: readonly string[]): void {
    if (Object.keys(value).length !== names.length || Object.keys(value).some(key => !names.includes(key))) throw new Error("对话阅读状态字段无效");
}
export function parseThreadActivity(value: unknown, threadId: string): ThreadActivityRecord {
    const row = record(value);
    keys(row, ["version", "threadId", "publicRevision", "readRevision", "reports"]);
    if (row.version !== 1 || row.threadId !== threadId || !isActivityRevision(row.publicRevision) || !isActivityRevision(row.readRevision) ||
        row.readRevision > row.publicRevision || !Array.isArray(row.reports) || row.reports.length > THREAD_REPORT_LIMIT) throw new Error("对话阅读状态无效");
    const ids = new Set<string>();
    const reports = row.reports.map((raw: unknown): ThreadReportActivity => {
        const report = record(raw);
        keys(report, ["jobId", "assistantMessageId", "publicRevision", "readRevision"]);
        if (typeof report.jobId !== "string" || !report.jobId || typeof report.assistantMessageId !== "string" || !report.assistantMessageId ||
            ids.has(report.jobId) || !isActivityRevision(report.publicRevision) || report.publicRevision < 1 || !isActivityRevision(report.readRevision) || report.readRevision > report.publicRevision) throw new Error("报告阅读状态无效");
        ids.add(report.jobId);
        return Object.freeze({jobId: report.jobId, assistantMessageId: report.assistantMessageId, publicRevision: report.publicRevision, readRevision: report.readRevision});
    });
    return Object.freeze({version: 1, threadId, publicRevision: row.publicRevision, readRevision: row.readRevision, reports: Object.freeze(reports)});
}

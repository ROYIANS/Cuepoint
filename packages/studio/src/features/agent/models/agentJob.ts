export type AgentJobKind = 'web_read' | 'project_media_check';
export type AgentJobStatus = 'accepted' | 'running' | 'stopping' | 'stopped' | 'completed' | 'failed' | 'unknown';
export interface AgentJobMediaSelection {id: string; name: string; mimeType: string; size: number; revision: string}
export type AgentJobSelection = {kind: 'web_read'; urls: readonly string[]} |
    {kind: 'project_media_check'; media: readonly AgentJobMediaSelection[]};
export interface AgentJobObservation {
    mediaId: string;
    status: 'ready' | 'missing' | 'corrupt' | 'read_error' | 'changed';
    detail?: string;
}
export interface AgentJobOutputMetadata {
    urls?: string[];
    retrievedAt?: string;
    requestId?: string;
    coverage?: string;
}
export interface AgentJobOutput {
    version: 1;
    jobId: string;
    revision: number;
    retention: 'retained' | 'cleared';
    length: number;
    byteLength: number;
    preview: string;
    metadata?: AgentJobOutputMetadata;
}
export interface AgentJobResult {
    jobId: string;
    kind: AgentJobKind;
    status: 'completed' | 'stopped' | 'failed' | 'unknown';
    selected: number;
    completed: number;
    output?: AgentJobOutput;
    error?: string;
    serviceMayHaveRun?: boolean;
}
export interface AgentJob {
    id: string;
    threadId: string;
    runId: string;
    callId: string;
    projectId?: string;
    kind: AgentJobKind;
    revision: number;
    status: AgentJobStatus;
    /** Captured original call envelope: never retarget an existing admission. */
    callRevision: string;
    selection: AgentJobSelection;
    selected: number;
    completed: number;
    observations: AgentJobObservation[];
    reservedBytes: number;
    output?: AgentJobOutput;
    error?: string;
    serviceMayHaveRun?: boolean;
    createdAt: string;
    updatedAt: string;
}
export interface AgentJobResultChunk {
    id: string;
    jobId: string;
    ordinal: number;
    offset: number;
    text: string;
    byteLength: number;
}
export interface AgentJobReader {
    threadId: string;
    projectId?: string;
    /** Historical UI row, distinct from a later model read call. */
    original?: {runId: string; callId: string};
    /** Current read_job_result execution, checked against durable current scope. */
    caller?: {runId: string; callId: string};
}
export type AgentJobPage = {available: false; reason: 'unavailable' | 'cleared'} | {
    available: true; jobId: string; revision: number; status: AgentJobResult['status'];
    offset: number; text: string; nextOffset?: number; length: number; byteLength: number;
    selected: number; completed: number;
};

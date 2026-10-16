/** Finite transport boundary. IDs in saved product data confer no host authority. */
export interface McpHostBinding {
    readonly serverId: string;
    readonly configRevision: number;
    /** Opaque revision of the host's frozen raw catalogue; not Studio's normalized digest. */
    readonly manifestRevision: string;
    readonly registrationId: string;
    readonly hostSessionId: string;
    readonly principalRevision: string;
}

export interface McpPrivateRevisionRef {
    readonly kind: "native_vault" | "session_memory";
    readonly ownerId: string;
    readonly revisionId: string;
}

export type McpPrivateConfig =
    | {readonly transport: "stdio"; readonly executable: string; readonly args: readonly string[];
        readonly cwd?: string; readonly environment: Readonly<Record<string, string>>}
    | {readonly transport: "streamable_http"; readonly endpoint: string;
        readonly auth: {readonly kind: "none"} | {readonly kind: "manual"; readonly headers: Readonly<Record<string, string>>}
            | {readonly kind: "oauth"; readonly clientId?: string; readonly scopes: readonly string[]}};

export interface McpHostCapabilities {
    readonly host: "desktop" | "browser";
    readonly stdio: boolean;
    readonly streamableHttp: boolean;
    readonly oauth: boolean;
    readonly rememberedCredentials: boolean;
}

export interface McpHostScope {
    readonly runId: string;
    readonly callId: string;
    readonly scopeId: string;
}

export type McpHostTarget = {readonly kind: "tool"; readonly rawName: string}
    | {readonly kind: "resource"; readonly handleId: string};

/** An ephemeral host receipt, never serialized into a run or project export. */
export interface McpPreparedAuthority {
    readonly authorityId: string;
    readonly binding: McpHostBinding;
    readonly scope: McpHostScope;
    readonly target: McpHostTarget;
    readonly argumentsDigest: string;
}

export interface McpInvocationIdentity {
    readonly operationId: string;
    readonly authority: McpPreparedAuthority;
}

/** Status/readback never reissues the original effect. Error details are closed codes. */
export type McpInvocationOutcome =
    | {readonly status: "not_started"; readonly operationId: string; readonly code: "denied" | "retired" | "canceled" | "invalid"}
    | {readonly status: "completed"; readonly operationId: string; readonly result: unknown}
    | {readonly status: "protocol_error"; readonly operationId: string; readonly code: "remote_error" | "unsupported"}
    | {readonly status: "unknown"; readonly operationId: string; readonly code: "reply_lost" | "stopped" | "session_expired"};

export interface McpHostConnection {
    readonly binding: McpHostBinding;
    /** Still untrusted: Agent owns normalization and argument-schema admission. */
    readonly discovery: unknown;
}

export interface McpOAuthAttempt {
    readonly attemptId: string;
    readonly redirectDisplay?: string;
}

export interface McpOAuthStatus {
    readonly attemptId: string;
    readonly state: "pending" | "authorized" | "canceled" | "expired" | "failed";
}

export interface McpHostServices {
    readonly active: boolean;
    readonly capabilities: McpHostCapabilities;
    initialize(): Promise<McpHostCapabilities>;
    preparePrivateRevision(input: {readonly operationId: string; readonly serverId: string; readonly catalogueRevision: number; readonly expectedConfigRevision: number; readonly config: McpPrivateConfig}): Promise<McpPrivateRevisionRef>;
    /** Reconciles the original write without creating a second vault revision. */
    privateRevisionStatus(input: {readonly operationId: string; readonly serverId: string}): Promise<{readonly status: "prepared"; readonly reference: McpPrivateRevisionRef} | {readonly status: "unknown"}>;
    /** Native must serialize and reject references still used by the current catalogue. */
    discardPrivateRevision(input: {readonly serverId: string; readonly reference: McpPrivateRevisionRef}): Promise<void>;
    confirmPrivateRevision(input: {readonly operationId: string; readonly serverId: string; readonly reference: McpPrivateRevisionRef; readonly catalogueFingerprint: string}): Promise<void>;
    retireServer(input: {readonly serverId: string; readonly expectedConfigRevision?: number}): Promise<{readonly status: "drained" | "draining"}>;
    oauthBegin(input: {readonly operationId: string; readonly serverId: string; readonly configRevision: number; readonly privateRevision: McpPrivateRevisionRef}): Promise<McpOAuthAttempt>;
    oauthStatus(attemptId: string): Promise<McpOAuthStatus>;
    oauthCancel(attemptId: string): Promise<void>;
    connect(input: {readonly operationId: string; readonly serverId: string; readonly configRevision: number; readonly privateRevision: McpPrivateRevisionRef}, signal: AbortSignal): Promise<McpHostConnection>;
    disconnect(binding: McpHostBinding): Promise<{readonly status: "drained" | "draining"}>;
    prepare(input: {readonly binding: McpHostBinding; readonly scope: McpHostScope; readonly target: McpHostTarget; readonly arguments: unknown}): Promise<McpPreparedAuthority>;
    invoke(input: McpInvocationIdentity & {readonly arguments: unknown}, signal: AbortSignal): Promise<McpInvocationOutcome>;
    invocationStatus(input: McpInvocationIdentity): Promise<McpInvocationOutcome>;
    stop(input: McpInvocationIdentity): Promise<McpInvocationOutcome>;
    dispose(): Promise<{readonly status: "drained" | "draining"}>;
}

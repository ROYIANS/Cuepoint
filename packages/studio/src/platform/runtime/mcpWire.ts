import {z} from "zod";

const id = z.string().min(1).max(128).regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/u);
const revision = z.number().int().positive().max(Number.MAX_SAFE_INTEGER - 1);
export const mcpBindingSchema = z.object({serverId: id, configRevision: revision, manifestRevision: id, registrationId: id, hostSessionId: id, principalRevision: id}).strict();
export const mcpReferenceSchema = z.object({kind: z.enum(["native_vault", "session_memory"]), ownerId: id, revisionId: id}).strict();
export const mcpScopeSchema = z.object({runId: id, callId: id, scopeId: id}).strict();
export const mcpTargetSchema = z.discriminatedUnion("kind", [z.object({kind: z.literal("tool"), rawName: z.string().min(1).max(256)}).strict(), z.object({kind: z.literal("resource"), handleId: id}).strict()]);
export const mcpAuthoritySchema = z.object({authorityId: id, binding: mcpBindingSchema, scope: mcpScopeSchema, target: mcpTargetSchema, argumentsDigest: z.string().regex(/^[a-f0-9]{64}$/u)}).strict();
export const mcpIdentitySchema = z.object({operationId: id, authority: mcpAuthoritySchema}).strict();
export const mcpOAuthAttemptSchema = z.object({attemptId: id, redirectDisplay: z.string().max(512).optional()}).strict();
export const mcpOAuthStatusSchema = z.object({attemptId: id, state: z.enum(["pending", "authorized", "canceled", "expired", "failed"])}).strict();

export function mcpWireBytes(raw: unknown, maximum = 1_048_576): void {
    const json = JSON.stringify(raw);
    if (json === undefined || json.length > maximum || new TextEncoder().encode(json).byteLength > maximum) throw new Error("MCP 返回内容过大");
}
export const mcpWireId = id;
export const mcpWireRevision = revision;

const bytes = (value: string, maximum: number) => new TextEncoder().encode(value).byteLength <= maximum;
const privateText = z.string().max(8_192).refine(value => !value.includes("\0") && bytes(value, 8_192));
const absolutePath = z.string().min(1).max(4_096).refine(value => !value.includes("\0") && bytes(value, 4_096) && (/^\//u.test(value) || /^[A-Za-z]:[\\/]/u.test(value) || value.startsWith("\\\\")));
const environment = z.record(z.string().min(1).max(256).refine(value => !/[=\0]/u.test(value) && bytes(value, 256)), privateText).refine(value => Object.keys(value).length <= 64);
const headerName = z.string().min(1).max(256).regex(/^[!#$%&'*+.^_`|~A-Za-z0-9-]+$/u).refine(value => !["host", "content-length", "mcp-session-id", "accept", "content-type", "last-event-id"].includes(value.toLowerCase()));
const headers = z.record(headerName, privateText.refine(value => !/[\r\n]/u.test(value))).refine(value => Object.keys(value).length <= 32 && new Set(Object.keys(value).map(key => key.toLowerCase())).size === Object.keys(value).length);
export const mcpPrivateConfigSchema = z.discriminatedUnion("transport", [
    z.object({transport: z.literal("stdio"), executable: absolutePath, args: z.array(privateText).max(128), cwd: absolutePath.optional(), environment}).strict(),
    z.object({transport: z.literal("streamable_http"), endpoint: z.string().url().max(8_192).refine(value => {
        const url = new URL(value);
        return !url.username && !url.password && !url.hash && bytes(value, 8_192) && (url.protocol === "https:" || url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
    }), auth: z.discriminatedUnion("kind", [
        z.object({kind: z.literal("none")}).strict(),
        z.object({kind: z.literal("manual"), headers}).strict(),
        z.object({kind: z.literal("oauth"), clientId: z.string().min(1).max(2_048).refine(value => bytes(value, 2_048)).optional(), scopes: z.array(z.string().min(1).max(256).refine(value => bytes(value, 256) && !/[\p{Cc}]/u.test(value))).max(32)}).strict(),
    ])}).strict(),
]);
export const mcpConnectInputSchema = z.object({operationId: id, serverId: id, configRevision: revision, privateRevision: mcpReferenceSchema}).strict();
export const mcpPrivatePrepareInputSchema = z.object({operationId: id, serverId: id, catalogueRevision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER - 1), expectedConfigRevision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER - 1), config: mcpPrivateConfigSchema}).strict();
export const mcpPrivateConfirmInputSchema = z.object({operationId: id, serverId: id, reference: mcpReferenceSchema, catalogueFingerprint: z.string().regex(/^[a-f0-9]{64}$/u)}).strict();

/** Own bounded JSON before the first await; callers cannot retarget a queued action. */
export function ownMcpWireJson(raw: unknown, maximum: number): unknown {
    mcpWireBytes(raw, maximum);
    return JSON.parse(JSON.stringify(raw)) as unknown;
}

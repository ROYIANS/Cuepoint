import type {AgentToolCall, AgentToolEffect, AgentToolPreview} from '@/domain/agent';
import type {Spec} from './businessSchemas';

export interface AgentToolContext {
    projectId?: string;
    runId: string;
    threadId: string;
    callId: string;
    signal: AbortSignal;
    preview?: AgentToolPreview;
}

/** Callbacks consume this definition's parsed output, never untrusted model input. */
export interface TypedToolDefinition<Args, Name extends string = string> {
    name: Name;
    title: string;
    description: string;
    parameters: Record<string, unknown>;
    effect: AgentToolEffect;
    atomic?: boolean;
    requiresConfirmation?: boolean;
    recovery?: 'generation' | 'repeatable';
    parseArguments: (raw: unknown) => Args;
    highRisk: (args: Args) => boolean;
    prepare?: (args: Args, context: AgentToolContext) => Promise<AgentToolPreview>;
    execute: (args: Args, context: AgentToolContext) => Promise<unknown>;
}

export type AgentToolDefinition = TypedToolDefinition<unknown>;
export type ToolBody<Args, Name extends string> = Omit<TypedToolDefinition<Args, Name>, 'parameters' | 'parseArguments'>;

export function defineTool<Args, const Name extends string>(spec: Spec<Args>, body: ToolBody<NoInfer<Args>, Name>): TypedToolDefinition<Args, Name> {
    return {...body, parameters: spec.json, parseArguments: raw => spec.schema.parse(raw)};
}

export function assertUniqueToolNames(definitions: readonly {name: string}[]): void {
    const names = new Set<string>();
    for (const definition of definitions) {
        if (names.has(definition.name)) throw new Error('工具名称重复');
        names.add(definition.name);
    }
}

/** Types cannot prove durable metadata still agrees with current code after awaited work. */
export function toolMetadataMatches<Args>(tool: TypedToolDefinition<Args>, args: Args, call: Pick<AgentToolCall, 'effect' | 'highRisk' | 'atomic' | 'recovery' | 'requiresConfirmation'>): boolean {
    return tool.effect === call.effect && tool.highRisk(args) === call.highRisk &&
        Boolean(tool.atomic) === Boolean(call.atomic) && tool.recovery === call.recovery &&
        Boolean(tool.requiresConfirmation) === Boolean(call.requiresConfirmation);
}

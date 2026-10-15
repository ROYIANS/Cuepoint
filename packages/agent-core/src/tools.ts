import type {AgentToolEffect} from './types.js';

export interface ToolBindingIdentity {
    readonly capabilityId: string;
    readonly version: string;
    readonly registrationId: string;
}

/** An argument parser is the sole relationship between unknown input and callback arguments. */
export interface ToolSpec<Args> {
    schema: {parse: (raw: unknown) => Args};
    json: Record<string, unknown>;
}
export interface ToolContext<Preview> {
    runId: string;
    threadId: string;
    callId: string;
    signal: AbortSignal;
    preview?: Preview;
}
export interface ToolMetadata {
    binding?: ToolBindingIdentity;
    effect: AgentToolEffect;
    highRisk: boolean;
    atomic?: boolean;
    requiresConfirmation?: boolean;
    recovery?: string;
}
export interface ToolDefinition<Args, Context extends ToolContext<Preview>, Preview, Result, Name extends string = string> {
    binding?: ToolBindingIdentity;
    name: Name;
    title: string;
    description: string;
    parameters: Record<string, unknown>;
    effect: AgentToolEffect;
    atomic?: boolean;
    requiresConfirmation?: boolean;
    recovery?: string;
    parseArguments: (raw: unknown) => Args;
    highRisk: (args: Args) => boolean;
    prepare?: (args: Args, context: Context) => Promise<Preview>;
    execute: (args: Args, context: Context) => Promise<Result>;
}

/** A host selects its context/preview types once; every tool still infers arguments from its parser. */
export function createToolFactory<Context extends ToolContext<Preview>, Preview>() {
    return function defineTool<Args, const Name extends string, Result>(
        spec: ToolSpec<Args>,
        body: Omit<ToolDefinition<NoInfer<Args>, Context, Preview, Result, Name>, 'parameters' | 'parseArguments'>,
    ): ToolDefinition<Args, Context, Preview, Result, Name> {
        const parse = spec.schema.parse.bind(spec.schema);
        return {...body, parameters: spec.json, parseArguments: parse};
    };
}

export function assertUniqueToolNames(definitions: readonly {name: string}[]): void {
    const names = new Set<string>();
    for (const definition of definitions) {
        if (names.has(definition.name)) throw new Error('工具名称重复');
        names.add(definition.name);
    }
}

/** Dispatch checks are shared; hosts retain their own safe schema/domain diagnostics. */
export function validateToolInput<Tool extends {name: string; parseArguments: (raw: unknown) => unknown}>(
    name: string,
    raw: string,
    enabled: readonly string[],
    registry: readonly Tool[],
    errors: {
        unavailable: (name: string, enabled: readonly string[]) => Error;
        tooLarge: (tool: Tool, length: number) => Error;
        invalid: (tool: Tool, parsed: unknown, cause: unknown) => Error;
    },
) {
    assertUniqueToolNames(registry);
    const tool = registry.find(item => item.name === name);
    if (!enabled.includes(name) || !tool) throw errors.unavailable(name, enabled);
    if (raw.length > 32_768) throw errors.tooLarge(tool, raw.length);
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
        return {tool, args: tool.parseArguments(parsed)};
    } catch (cause) {
        throw errors.invalid(tool, parsed, cause);
    }
}

/** Types cannot prove durable metadata still agrees with current code after awaited work. */
export function toolMetadataMatches<Args>(tool: Pick<ToolDefinition<Args, ToolContext<unknown>, unknown, unknown>, 'effect' | 'atomic' | 'recovery' | 'requiresConfirmation' | 'highRisk' | 'binding'>, args: Args, call: ToolMetadata): boolean {
    return tool.effect === call.effect && tool.highRisk(args) === call.highRisk &&
        Boolean(tool.atomic) === Boolean(call.atomic) && tool.recovery === call.recovery &&
        Boolean(tool.requiresConfirmation) === Boolean(call.requiresConfirmation) &&
        (tool.binding === undefined && call.binding === undefined || !!tool.binding && !!call.binding &&
            tool.binding.capabilityId === call.binding.capabilityId && tool.binding.version === call.binding.version &&
            tool.binding.registrationId === call.binding.registrationId);
}

/** Hosts supply forced confirmation as metadata; a model cannot grant itself permission. */
export function requiresToolApproval<Args>(mode:import('./types.js').AgentPermissionMode,tool:Pick<ToolDefinition<Args,ToolContext<unknown>,unknown,unknown>,'effect'|'highRisk'|'requiresConfirmation'>,args:Args):boolean {
    if (!['ask','assist','full'].includes(mode)) throw new Error('未知授权模式');
    if (tool.requiresConfirmation) return true;
    if (mode === 'full') return false;
    if (tool.highRisk(args)) return true;
    return mode === 'ask' && (tool.effect === 'write' || tool.effect === 'network');
}

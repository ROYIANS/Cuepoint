import {assertUniqueToolNames, type ToolBindingIdentity, type ToolContext, type ToolDefinition} from './tools.js';

type DispatchTool<Context extends ToolContext<Preview>, Preview> = ToolDefinition<unknown, Context, Preview, unknown>;
export interface CapabilityRegistration<Context extends ToolContext<Preview>, Preview> {
    readonly identity: ToolBindingIdentity;
    readonly tools: readonly DispatchTool<Context, Preview>[];
}
export interface CapabilityRegistry<Context extends ToolContext<Preview>, Preview> {
    register(input: CapabilityRegistration<Context, Preview>): {dispose(): void};
    snapshot(): readonly DispatchTool<Context, Preview>[];
    assertCurrent(expected: ToolBindingIdentity): void;
}

function identityField(value: string): boolean {
    return typeof value === 'string' && value.length <= 128 && /^[A-Za-z0-9][A-Za-z0-9._:/+-]*$/.test(value);
}

/** Advertised JSON is a copied, frozen tree; functions remain trusted host implementations. */
function immutableJson(value: unknown, ancestors = new Set<object>(), depth = 0): unknown {
    if (value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value !== 'object' || depth > 64 || ancestors.has(value)) throw new Error('工具参数必须是有限的 JSON 数据');
    if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) throw new Error('工具参数必须是 JSON 对象');
    ancestors.add(value);
    const result: unknown = Array.isArray(value)
        ? value.map(item => immutableJson(item, ancestors, depth + 1))
        : Object.fromEntries(Object.entries(value).map(([key, item]) => [key, immutableJson(item, ancestors, depth + 1)]));
    ancestors.delete(value);
    return Object.freeze(result);
}

/** Copy envelope fields and callback identities before any asynchronous model work. */
export function snapshotToolDefinitions<Context extends ToolContext<Preview>, Preview>(definitions: readonly DispatchTool<Context, Preview>[]): readonly DispatchTool<Context, Preview>[] {
    assertUniqueToolNames(definitions);
    return Object.freeze(definitions.map(tool => Object.freeze({...tool,
        parameters: immutableJson(tool.parameters) as Record<string, unknown>,
        ...(tool.binding ? {binding: Object.freeze({...tool.binding})} : {}),
    })));
}

/** Neutral lifecycle only: no dynamic code loading, effect scheduling or resource issuance. */
export function createCapabilityRegistry<Context extends ToolContext<Preview>, Preview>(): CapabilityRegistry<Context, Preview> {
    const active = new Map<string, {identity: ToolBindingIdentity; tools: readonly DispatchTool<Context, Preview>[]}>();
    const generations = new Set<string>();
    return {
        register(input) {
            const identity = Object.freeze({...input.identity});
            if (![identity.capabilityId, identity.version, identity.registrationId].every(identityField)) throw new Error('能力注册标识无效');
            if (generations.has(identity.registrationId)) throw new Error('能力注册代号不可复用');
            if (active.has(identity.capabilityId)) throw new Error('能力已经注册');
            if (!input.tools.length) throw new Error('能力至少包含一个工具');
            const occupied = new Set([...active.values()].flatMap(entry => entry.tools.map(tool => tool.name)));
            if (input.tools.some(tool => occupied.has(tool.name))) throw new Error('工具名称重复');
            const tools = snapshotToolDefinitions(input.tools.map(tool => ({...tool, binding: identity})));
            const entry = {identity, tools};
            generations.add(identity.registrationId); active.set(identity.capabilityId, entry);
            return {dispose() {if (active.get(identity.capabilityId) === entry) active.delete(identity.capabilityId);}};
        },
        snapshot() {return Object.freeze([...active.values()].flatMap(entry => entry.tools));},
        assertCurrent(expected) {
            const current = active.get(expected.capabilityId)?.identity;
            if (!current || current.version !== expected.version || current.registrationId !== expected.registrationId) throw new Error('能力注册已失效，请重新发起操作');
        },
    };
}

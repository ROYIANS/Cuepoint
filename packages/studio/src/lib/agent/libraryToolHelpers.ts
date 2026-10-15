import {StorageError} from "../storage/errors";
import type {ProductStore} from "../storage/types";
import type {TypedToolDefinition} from './toolDefinition';
import {defineTool} from './toolDefinition';
import {db as productDb} from '../../db/database';
import {AtomicToolRollbackError, executeAtomicTool} from '../../db/agentTools';
import {flushPendingDrafts} from '../debouncedDraft';
import {targetRevision} from '../productionRevision';
import type {AgentToolPreview} from '../../domain/agent';
import type {AgentToolContext} from './tools';
import type {Spec} from './businessSchemas';
import {frozenProjectScope} from './projectScope';
import type {WriteReceipt} from './writeReceipt';
import {ToolRecoveryError} from './toolErrors';

export interface LibraryPreviewState {
    state: unknown;
    target?: AgentToolPreview['target'];
    changes: string[]
}

interface LibraryToolOptions<T, Name extends string> {
    name: Name;
    title: string;
    description: string;
    spec: Spec<T>;
    scope?: (args: NoInfer<T>, context: AgentToolContext) => Promise<void>;
    execute: (args: NoInfer<T>, context: AgentToolContext) => Promise<unknown>;
}

/** Only local database reads belong in this callback; parsing file bytes runs separately. */
export function libraryReadTool<T, const Name extends string>(options: LibraryToolOptions<T, Name>): TypedToolDefinition<T, Name> {
    return defineTool(options.spec, {
        name: options.name,
        title: options.title,
        description: options.description,
        effect: 'read',
        highRisk: () => false,
        async execute(raw, context) {
            const db = context.store ?? productDb;
            context.signal.throwIfAborted();
            return db.transaction('r', db.tables, async (db) => {
                const boundContext = {...context, store: db};
                const args = options.spec.schema.parse(raw);
                await frozenProjectScope(boundContext, db);
                await options.scope?.(args, boundContext);
                return options.execute(args, boundContext);
            });
        }
    });
}

/** Shared IP/library writes retain the same immutable-preview and atomic-ledger contract as business tools. */
type ResolvedLibraryArgs<T> = T & ("projectId" extends keyof T ? { projectId: string } : object);
type LibraryResolver<T> = (args: T, context: AgentToolContext) => Promise<ResolvedLibraryArgs<T>>;
type LibraryResolution<T> = { resolve?: LibraryResolver<T> } & (T extends { projectId: string } ? object :
    "projectId" extends keyof T ? { resolve: LibraryResolver<T> } : object);

export function libraryWriteTool<T, const Name extends string>(options: Omit<LibraryToolOptions<T, Name>, 'scope' | 'execute'> & LibraryResolution<NoInfer<T>> & {
    scope?: (args: NoInfer<ResolvedLibraryArgs<T>>, context: AgentToolContext) => Promise<void>;
    execute: (args: NoInfer<ResolvedLibraryArgs<T>>, context: AgentToolContext) => Promise<unknown>;
    prepare: (args: NoInfer<ResolvedLibraryArgs<T>>, context: AgentToolContext) => Promise<LibraryPreviewState>;
    owners?: (args: NoInfer<ResolvedLibraryArgs<T>>, context: AgentToolContext) => string[] | Promise<string[]>;
    highRisk?: boolean;
    requiresConfirmation?: boolean;
    receipt?: (args: NoInfer<ResolvedLibraryArgs<T>>, result: unknown) => WriteReceipt;
}): TypedToolDefinition<T, Name> {
    async function resolve(args: T, context: AgentToolContext): Promise<ResolvedLibraryArgs<T>> {
        if (options.resolve) return options.resolve(args, context);
        // The options type requires a resolver for an optional projectId. Other parsed recipes
        // already require that key or do not contain it; no raw input is coerced here.
        return args as ResolvedLibraryArgs<T>;
    }

    async function check(args: NoInfer<ResolvedLibraryArgs<T>>, context: AgentToolContext, store?: ProductStore) {
        const db = store ?? context.store ?? productDb;
        context.signal.throwIfAborted();
        await frozenProjectScope(context, db);
        await options.scope?.(args, context);
    }

    async function flush(args: NoInfer<ResolvedLibraryArgs<T>>, context: AgentToolContext) {
        for (const owner of new Set(await options.owners?.(args, context) ?? [])) await flushPendingDrafts(owner);
        context.signal.throwIfAborted();
    }

    async function preview(args: NoInfer<ResolvedLibraryArgs<T>>, context: AgentToolContext, store?: ProductStore): Promise<AgentToolPreview> {
        const db = store ?? context.store ?? productDb;
        await check(args, context, db);
        const info = await options.prepare(args, context);
        return {
            summary: options.title, changes: info.changes, target: info.target,
            revision: targetRevision({tool: options.name, args, state: info.state})
        };
    }

    return defineTool(options.spec, {
        name: options.name,
        title: options.title,
        description: options.description,
        effect: 'write',
        atomic: true,
        highRisk: () => options.highRisk ?? false,
        requiresConfirmation: options.requiresConfirmation,
        async prepare(raw, context) {
            const db = context.store ?? productDb;
            const args = await resolve(options.spec.schema.parse(raw), context);
            await check(args, context, db);
            await flush(args, context);
            return db.transaction('r', db.tables, async (db) => (async (boundContext: AgentToolContext) => await preview(await resolve(options.spec.schema.parse(raw), boundContext), boundContext, db))({
                ...context,
                store: db
            }));
        },
        async execute(raw, context) {
            const db = context.store ?? productDb;
            try {
                const args = await resolve(options.spec.schema.parse(raw), context);
                await check(args, context, db);
                await flush(args, context);
            } catch (error) {
                if (error instanceof StorageError && error.certainty === "unknown") throw error;
                throw new AtomicToolRollbackError(error instanceof Error ? error.message : '操作尚未开始', {cause: error});
            }
            return executeAtomicTool(context, async (db) => {
                const boundContext = {...context, store: db};
                const args = await resolve(options.spec.schema.parse(raw), boundContext);
                if (!boundContext.preview?.revision || boundContext.preview.revision !== (await preview(args, boundContext, db)).revision)
                    throw new ToolRecoveryError('STALE_TOOL_PREVIEW', '目标或影响范围已变化，请重新读取并提出操作，原批准不能覆盖新的内容');
                const result = await options.execute(args, boundContext);
                if (!options.receipt) return result;
                if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('写入记录需要对象结果');
                return {...result, writeReceipt: options.receipt(args, result)};
            }, db);
        }
    });
}

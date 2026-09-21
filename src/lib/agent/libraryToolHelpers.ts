import { db } from '@/db/database';
import { AtomicToolRollbackError, executeAtomicTool } from '@/db/agentTools';
import { flushPendingDrafts } from '@/lib/debouncedDraft';
import { targetRevision } from '@/lib/productionRevision';
import type { AgentToolPreview } from '@/domain/agent';
import type { AgentToolContext, AgentToolDefinition } from './tools';
import type { Spec } from './businessSchemas';
import { frozenProjectScope } from './projectScope';

export interface LibraryPreviewState { state: unknown; target?: AgentToolPreview['target']; changes: string[] }
interface LibraryToolOptions<T> {
  name: string; title: string; description: string; spec: Spec<T>;
  scope?: (args: T, context: AgentToolContext) => Promise<void>;
  execute: (args: T, context: AgentToolContext) => Promise<unknown>;
}

/** Only local database reads belong in this callback; parsing file bytes runs separately. */
export function libraryReadTool<T>(options: LibraryToolOptions<T>): AgentToolDefinition {
  return {
    name: options.name, title: options.title, description: options.description,
    effect: 'read', parameters: options.spec.json, highRisk: () => false,
    parseArguments: raw => options.spec.schema.parse(raw),
    async execute(raw, context) {
      context.signal.throwIfAborted();
      return db.transaction('r', db.tables, async () => {
        const args = options.spec.schema.parse(raw);
        await frozenProjectScope(context);
        await options.scope?.(args, context);
        return options.execute(args, context);
      });
    },
  };
}

/** Shared IP/library writes retain the same immutable-preview and atomic-ledger contract as business tools. */
export function libraryWriteTool<T>(options: LibraryToolOptions<T> & {
  prepare: (args: T, context: AgentToolContext) => Promise<LibraryPreviewState>;
  owners?: (args: T) => string[] | Promise<string[]>;
  highRisk?: boolean;
  requiresConfirmation?: boolean;
}): AgentToolDefinition {
  async function check(args: T, context: AgentToolContext) {
    context.signal.throwIfAborted();
    await frozenProjectScope(context);
    await options.scope?.(args, context);
  }
  async function flush(args: T, context: AgentToolContext) {
    for (const owner of new Set(await options.owners?.(args) ?? [])) await flushPendingDrafts(owner);
    context.signal.throwIfAborted();
  }
  async function preview(args: T, context: AgentToolContext): Promise<AgentToolPreview> {
    await check(args, context);
    const info = await options.prepare(args, context);
    return { summary: options.title, changes: info.changes, target: info.target,
      revision: targetRevision({ tool: options.name, args, state: info.state }) };
  }
  return {
    name: options.name, title: options.title, description: options.description,
    effect: 'write', atomic: true, parameters: options.spec.json,
    highRisk: () => options.highRisk ?? false, requiresConfirmation: options.requiresConfirmation,
    parseArguments: raw => options.spec.schema.parse(raw),
    async prepare(raw, context) {
      const args = options.spec.schema.parse(raw);
      await check(args, context);
      await flush(args, context);
      return db.transaction('r', db.tables, async () => await preview(args, context));
    },
    async execute(raw, context) {
      const args = options.spec.schema.parse(raw);
      try { await check(args, context); await flush(args, context); }
      catch (error) { throw new AtomicToolRollbackError(error instanceof Error ? error.message : '操作尚未开始'); }
      return executeAtomicTool(context, async () => {
        if (!context.preview?.revision || context.preview.revision !== (await preview(args, context)).revision)
          throw new Error('目标或影响范围已变化，请重新读取并提出操作，原批准不能覆盖新的内容');
        return options.execute(args, context);
      });
    },
  };
}

import {createToolFactory, validateToolInput, type ToolDefinition, type ToolSpec} from '@cuepoint/agent-core';
import type {Preview, TodoContext} from './types.js';

function object(raw: unknown): Record<string, unknown> {if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Expected object'); return raw as Record<string, unknown>;}
function text(raw: unknown): string {if (typeof raw !== 'string' || !raw.trim() || raw.length > 200) throw new Error('Expected bounded text'); return raw;}
const define = createToolFactory<TodoContext, Preview>();
const empty: ToolSpec<Record<string, never>> = {json: {type: 'object', properties: {}}, schema: {parse(raw) {object(raw); return {};}}};
const create: ToolSpec<{title: string}> = {json: {type: 'object', properties: {title: {type: 'string'}}, required: ['title']}, schema: {parse: raw => ({title: text(object(raw).title)})}};
const complete: ToolSpec<{id: string}> = {json: {type: 'object', properties: {id: {type: 'string'}}, required: ['id']}, schema: {parse: raw => ({id: text(object(raw).id)})}};
const loading: ToolSpec<{groups: string[]}> = {json: {type: 'object', properties: {groups: {type: 'array', items: {type: 'string'}}}}, schema: {parse(raw) {const value = object(raw).groups; if (!Array.isArray(value)) throw new Error('Expected groups'); return {groups: value.map(text)};}}};

export const registry = [
    define(empty, {name: 'list_todos', title: 'List todos', description: 'Read this list', effect: 'read', highRisk: () => false, execute: (_args, context) => Promise.resolve(context.services.list())}),
    define(create, {name: 'create_todo', title: 'Create todo', description: 'Create one todo', effect: 'write', atomic: true, highRisk: () => false, prepare: args => Promise.resolve({title: args.title}), execute: (args, context) => Promise.resolve(context.services.mutate(context.callId, context.signal, {kind: 'create', ...args}))}),
    define(complete, {name: 'complete_todo', title: 'Finish todo', description: 'Finish an existing todo', effect: 'write', atomic: true, highRisk: () => false, execute: (args, context) => Promise.resolve(context.services.mutate(context.callId, context.signal, {kind: 'complete', ...args}))}),
    define(loading, {name: 'load_tools', title: 'Load capabilities', description: 'Select enabled groups', effect: 'bookkeeping', atomic: true, highRisk: () => false, execute: (args, context) => Promise.resolve(context.services.load(context.callId, args.groups, context.signal))}),
    define(empty, {name: 'external_notice', title: 'External notice', description: 'Demonstrate uncertain external acknowledgement', effect: 'network', recovery: 'manual-confirmation', highRisk: () => true, execute: (_args, context) => Promise.resolve(context.services.external(context.callId, context.signal))}),
] as unknown as ToolDefinition<unknown, TodoContext, Preview, unknown>[];

export function validate(name: string, raw: string, offered: readonly string[]) {
    return validateToolInput(name, raw, offered, registry, {
        unavailable: name => new Error(`Unavailable tool: ${name}`),
        tooLarge: () => new Error('Arguments exceed limit'),
        invalid: (_tool, _parsed, cause) => new Error('Invalid arguments', {cause}),
    });
}

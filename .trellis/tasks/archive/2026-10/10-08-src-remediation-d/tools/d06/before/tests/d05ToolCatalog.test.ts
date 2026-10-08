import {describe, expect, it, vi} from 'vitest';
import {readFileSync, writeFileSync} from 'node:fs';
import {BUILTIN_TOOLS, toolSchemas, validateToolCall} from '@/lib/agent/tools';
import {IP_TOOLS} from '@/lib/agent/ipTools';
import {AUDIO_TOOLS} from '@/lib/agent/audioTools';
import {MUSIC_TOOLS} from '@/lib/agent/musicTools';
import {AUDIO_GENERATION_TOOLS} from '@/lib/agent/audioGenerationTools';
import {MATERIAL_TOOLS} from '@/lib/agent/materialTools';
import {DISCOVERY_TOOLS, toolNamesForCall, getOfferedToolNames} from '@/lib/agent/toolLoading';
import {TASK_TOOLS} from '@/lib/agent/taskTools';
import {BUSINESS_TOOLS, BUSINESS_TOOL_GROUPS} from '@/lib/agent/businessTools';
import {GENERATION_TOOLS} from '@/lib/agent/generationTools';
import {MEMORY_TOOLS} from '@/lib/agent/memoryTools';
import {REFERENCE_TOOLS} from '@/lib/agent/referenceTools';
import {WEB_TOOLS} from '@/lib/agent/webTools';
import {TASK_TOOL_NAMES} from "@/lib/agent/taskContext";
import {defineTool, assertUniqueToolNames} from '@/lib/agent/toolDefinition';
import * as s from '@/lib/agent/businessSchemas';
import {AGENT_SKILLS} from '@/lib/agent/skills';

const families = {
    foundation: BUILTIN_TOOLS.slice(0, 2), ip: IP_TOOLS, audio: AUDIO_TOOLS, music: MUSIC_TOOLS,
    soundGeneration: AUDIO_GENERATION_TOOLS, material: MATERIAL_TOOLS, discovery: DISCOVERY_TOOLS,
    task: TASK_TOOLS, business: BUSINESS_TOOLS, generation: GENERATION_TOOLS, memory: MEMORY_TOOLS,
    reference: REFERENCE_TOOLS, web: WEB_TOOLS,
};
const advertised = () => BUILTIN_TOOLS.map(tool => ({name: tool.name, title: tool.title, description: tool.description, parameters: tool.parameters, effect: tool.effect, atomic: tool.atomic, recovery: tool.recovery, requiresConfirmation: tool.requiresConfirmation}));

describe('schema-linked complete tool inventory', () => {
    it('retains every original advertised byte and metadata field', () => {
        expect(JSON.stringify(advertised(), null, 2) + '\n').toBe(readFileSync('tests/fixtures/d05/catalog.json', 'utf8'));
    });
    it('covers the real 13 families, 89 unique registrations and deduplicated skill catalog', () => {
        const counts = Object.fromEntries(Object.entries(families).map(([name, definitions]) => [name, definitions.length]));
        expect(counts).toEqual({foundation: 2, ip: 6, audio: 7, music: 4, soundGeneration: 4, material: 10, discovery: 1, task: 5, business: 33, generation: 7, memory: 4, reference: 4, web: 2});
        const names = BUILTIN_TOOLS.map(tool => tool.name);
        expect(Object.values(families).flat().map(tool => tool.name)).toEqual(names);
        expect(new Set(names).size).toBe(89);
        const catalog = [...new Set(AGENT_SKILLS.flatMap(skill => skill.toolNames).concat([...TASK_TOOL_NAMES, ...DISCOVERY_TOOLS.map(tool => tool.name)]))];
        expect(names.filter(name => !catalog.includes(name))).toEqual([]);
        expect(catalog.filter(name => !names.includes(name))).toEqual([]);
        expect(Object.values(BUSINESS_TOOL_GROUPS).flat().sort()).toEqual(BUSINESS_TOOLS.map(tool => tool.name).sort());
        writeFileSync('.trellis/tasks/10-08-src-remediation-d/tools/d05/runtime-catalog.json', JSON.stringify({counts, names, catalog, missing: [], unreachable: [], duplicates: []}, null, 2) + '\n');
    });
    it('rejects duplicate registrations before advertisement and parse/preparation/execute', () => {
        const base = BUILTIN_TOOLS[0];
        const parse = vi.fn(base.parseArguments), prepare = vi.fn(), execute = vi.fn();
        const registry = [{...base, parseArguments: parse, prepare, execute}, base];
        expect(() => assertUniqueToolNames(registry)).toThrow('重复');
        expect(() => toolSchemas([base.name], registry)).toThrow('重复');
        expect(() => validateToolCall(base.name, '{}', [base.name], registry)).toThrow('重复');
        expect(parse).not.toHaveBeenCalled(); expect(prepare).not.toHaveBeenCalled(); expect(execute).not.toHaveBeenCalled();
    });
    it('selects the same definition parser and restricts dispatch to the offered frozen intersection', () => {
        const tool = defineTool(s.object({value: s.defaulted(s.trimmedText(20), 'default')}), {
            name: 'fixture', title: 'fixture', description: 'fixture', effect: 'read', highRisk: args => args.value === 'risk',
            execute: async args => args.value,
        });
        expect(tool.parseArguments({})).toEqual({value: 'default'});
        const run = {enabledToolNames: ['workspace_overview'], toolLoading: {version: 1 as const, groups: [], foundationToolNames: ['workspace_overview', 'project_create'], foundationInstructions: '', loadedGroupIds: [], loadedToolNames: []}, offeredTools: [{step: 1, names: ['workspace_overview', 'project_create']}]};
        expect(getOfferedToolNames(run)).toEqual(['workspace_overview']);
        expect(toolNamesForCall(run, 1)).toEqual(['workspace_overview']);
        expect(() => validateToolCall('project_create', '{"name":"blocked"}', toolNamesForCall(run, 1))).toThrow('未启用');
        expect(toolNamesForCall(run, 2)).toEqual([]);
    });
});

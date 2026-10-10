import {expect, it} from 'vitest';
import {BUILTIN_TOOLS} from '@/lib/agent/tools';
import {BUILTIN_TOOLS as ORIGINAL_TOOLS} from './fixtures/sourceSnapshots/d05/src/lib/agent/tools';
import {generationSubmitSchema} from '@/lib/agent/generationProfiles';
import {generationSubmitSchema as originalGenerationSchema} from './fixtures/sourceSnapshots/d05/src/lib/agent/generationProfiles';
import {contextualField} from './helpers/d05BacklogCompatibility';

function minimal(schema: Record<string, unknown>, index = 0): unknown {
    const choice = schema.anyOf ?? schema.oneOf;
    if (Array.isArray(choice)) return minimal(choice[0], index);
    if (Array.isArray(schema.enum)) return schema.enum[0];
    if (schema.type === 'string') return 'x'.repeat(Math.max(1, Number(schema.minLength ?? 1))) + (index ? String(index) : '');
    if (schema.type === 'integer' || schema.type === 'number') return schema.minimum ?? 1;
    if (schema.type === 'boolean') return false;
    if (schema.type === 'array') return Array.from({length: Number(schema.minItems ?? 0)}, (_, i) => minimal(schema.items as Record<string, unknown>, i));
    const properties = schema.properties as Record<string, Record<string, unknown>> | undefined;
    return Object.fromEntries((schema.required as string[] ?? []).map(key => [key, minimal(properties?.[key] ?? {})]));
}
function outcome(parse: (raw: unknown) => unknown, raw: unknown) {
    try {return {output: JSON.stringify(parse(raw))};}
    catch (error) {
        if (error && typeof error === 'object' && 'issues' in error) return {issues: JSON.stringify(error.issues)};
        return {error: error instanceof Error ? error.message : String(error)};
    }
}
it('preserves original 89 parser outputs/diagnostics apart from exactly omitted contextual owner fields', () => {
    expect(BUILTIN_TOOLS.filter(tool => ORIGINAL_TOOLS.some(original => original.name === tool.name)).map(tool => tool.name)).toEqual(ORIGINAL_TOOLS.map(tool => tool.name));
    for (const original of ORIGINAL_TOOLS) {
        const current = BUILTIN_TOOLS.find(tool => tool.name === original.name)!;
        const valid = minimal(original.parameters);
        for (const raw of [valid, {}, null, [], {unexpected: true}, typeof valid === 'object' && valid !== null ? {...valid, unexpected: true} : valid]) {
            const field = contextualField(original.name);
            const omitted = field && raw !== null && typeof raw === 'object' && !Array.isArray(raw) && !Object.hasOwn(raw, field);
            const expected = outcome(value => {
                const parsed = original.parseArguments(value);
                if (omitted && parsed && typeof parsed === 'object' && !Array.isArray(parsed)) delete (parsed as Record<string, unknown>)[field];
                return parsed;
            }, omitted ? {...raw, [field]: 'd05-explicit-owner'} : raw);
            expect(outcome(current.parseArguments, raw), current.name).toEqual(expected);
        }
    }
});
it('retains generation defaults, trimming, output property order and native schema pick/omit/shape consumers', () => {
    const target = {kind: 'character', projectId: 'p', entityId: 'c', slot: 'front'};
    const fixtures = [
        {connectorId: ' connector ', model: 'gpt-image-2', prompt: ' prompt ', target},
        {connectorId: 'c', model: 'gpt-image-2', prompt: 'p', target, parameters: {size: '9:16', resolution: '2k'}, inputs: []},
        {connectorId: 'c', model: 'MiniMax-H3', prompt: 'p', target: {...target, kind: 'shot', episodeId: ' e ', slot: 'clip'}, parameters: {duration: 5, mode: 'frames'}, inputs: [{mediaId: ' m ', role: 'first-frame'}]},
        {connectorId: 'c', model: 'gpt-image-2', prompt: 'p', target, parameters: null},
        {connectorId: 'c', model: 'gpt-image-2', prompt: 'p', target: {...target, slot: ''}},
    ];
    for (const raw of fixtures) expect(outcome(generationSubmitSchema.parse.bind(generationSubmitSchema), raw)).toEqual(outcome(originalGenerationSchema.parse.bind(originalGenerationSchema), raw));
    expect(generationSubmitSchema.shape.parameters.removeDefault().parse({})).toEqual({});
    expect(generationSubmitSchema.pick({connectorId: true}).parse({connectorId: ' c '})).toEqual({connectorId: 'c'});
});

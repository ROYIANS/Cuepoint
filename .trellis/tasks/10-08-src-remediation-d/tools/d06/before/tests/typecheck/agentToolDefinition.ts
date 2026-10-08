/** Compiled by the project's actual strict compiler; never registered or executed. */
import {emptySlot} from '@/domain/slot';
import {z} from 'zod';
import {defineTool, type TypedToolDefinition} from '@/lib/agent/toolDefinition';
import * as s from '@/lib/agent/businessSchemas';
import {generationSubmitSpec, generationJobSpec, generationJobSchema} from '@/lib/agent/generationProfiles';
import {prepareAgentGeneration} from '@/lib/agent/generationRuntime';
import {libraryReadTool, libraryWriteTool} from '@/lib/agent/libraryToolHelpers';
import {AUDIO_TOOLS, audioMusicUnion} from '@/lib/agent/audioTools';
import {planSchema} from '@/lib/agent/tools';
import {patchStoryBeat} from '@/db/episodes';
import {setCharacterSlot, patchCharacter} from '@/db/assets';
import {patchShot} from '@/db/shots';
import {isCharacterSlot} from '@/lib/agent/businessTools';
import type {MemorySource} from '@/domain/projectMemory';

type IsAny<T> = 0 extends (1 & T) ? true : false;
export const wrongExecute = defineTool(generationSubmitSpec, {
    name: 'compile_submit', title: '', description: '', effect: 'network', highRisk: () => false,
    // @ts-expect-error submit output cannot be consumed as job-id arguments
    execute: async (_args: z.output<typeof generationJobSchema>) => ({}),
});
export const wrongPrepare = defineTool(generationJobSpec, {
    name: 'compile_job', title: '', description: '', effect: 'network', highRisk: () => false,
    // @ts-expect-error job output cannot be submitted to generation preparation
    prepare: (args, context) => prepareAgentGeneration(args, context),
    execute: async () => ({}),
});
export const wrongRisk = defineTool(generationJobSpec, {
    name: 'compile_risk', title: '', description: '', effect: 'read',
    // @ts-expect-error the callback cannot widen inference from the supplied schema
    highRisk: (_args: {prompt: string}) => false,
    execute: async () => ({}),
});
export const outputDefaults = defineTool(generationSubmitSpec, {
    name: 'compile_defaults', title: '', description: '', effect: 'read',
    highRisk: args => args.inputs.length > 0,
    prepare: async args => ({summary: args.prompt, changes: [String(args.parameters.mode)], revision: String(args.inputs.length)}),
    execute: async args => args.inputs.map(input => input.mediaId),
});
export const noParserOverride = defineTool(s.object({}), {
    name: 'compile_parser', title: '', description: '', effect: 'read', highRisk: () => false,
    execute: async () => ({}),
    // @ts-expect-error parsing is supplied only by the schema owner
    parseArguments: (_raw: unknown) => ({}),
});
export const noAdvertisementOverride = defineTool(s.object({}), {
    name: 'compile_advertisement', title: '', description: '', effect: 'read', highRisk: () => false,
    execute: async () => ({}),
    // @ts-expect-error advertisement is supplied only by the schema owner
    parameters: {},
});
export const wrongPlan: z.output<typeof planSchema> = {
    // @ts-expect-error actual plan statuses are a closed enum
    steps: [{id: 'x', title: 'x', status: 'finished'}],
};
export const wrongLibraryRead = libraryReadTool({
    name: 'compile_read', title: '', description: '', spec: s.object({text: s.text()}),
    // @ts-expect-error library helpers cannot widen schema Args through callbacks
    execute: async (_args: {text: number}) => ({}),
});
export const wrongLibraryWrite = libraryWriteTool({
    name: 'compile_write', title: '', description: '', spec: s.object({text: s.text()}),
    // @ts-expect-error prepare uses the schema's string output
    prepare: async (_args: {text: number}) => ({state: {}, changes: []}),
    execute: async () => ({}),
});
export const union = audioMusicUnion(s.object({kind: s.choice(['chapter']), title: s.text()}), s.object({kind: s.choice(['segment']), text: s.text()}));
export const unionIsAny: IsAny<z.output<typeof union.schema>> = false;
export function actualAudio(args: ReturnType<Extract<typeof AUDIO_TOOLS[number], {name: 'audio_create'}>['parseArguments']>) {
    const isAny: IsAny<typeof args> = false;
    if (args.kind === 'segment') {
        const text: string = args.text;
        // @ts-expect-error real audio segment text is not numeric
        const bad: number = args.text;
        return [isAny, text, bad];
    }
    if (args.kind === 'chapter') {
        // @ts-expect-error chapter has no speaker voice field
        return args.voice;
    }
    return isAny;
}
export function noErasure(tool: TypedToolDefinition<{text: string}>) {
    // @ts-expect-error a typed callback does not accept arbitrary unknown at family boundaries
    const erased: TypedToolDefinition<unknown> = tool;
    return erased;
}
const beatSpec = s.object(s.beatFields), shotSpec = s.object(s.shotFields);
export function nativePatch(args: z.output<typeof beatSpec.schema>, shot: z.output<typeof shotSpec.schema>, rawSlot: string) {
    // @ts-expect-error nullable scene needs native normalization
    void patchStoryBeat('episode', 'beat', args);
    const {sceneId, ...fields} = args;
    void patchStoryBeat('episode', 'beat', {...fields, sceneId: sceneId ?? undefined});
    // @ts-expect-error actual beat text is not numeric
    const badBeat: z.output<typeof beatSpec.schema> = {content: 1};
    // @ts-expect-error actual shot schema has no arbitrary command bag
    const badShot: z.output<typeof shotSpec.schema> = {admin: true};
    // @ts-expect-error arbitrary slot string has not passed a runtime catalog check
    void setCharacterSlot('character', rawSlot, emptySlot());
    if (isCharacterSlot(rawSlot)) void setCharacterSlot('character', rawSlot, emptySlot());
    const {sceneId: shotScene, beatId, inheritStyle, ...rest} = shot;
    void patchShot('shot', {...rest, sceneId: shotScene ?? undefined, beatId: beatId ?? undefined, ...(inheritStyle ? {styleId: undefined} : {})});
    // @ts-expect-error native character patches do not accept a numeric bio
    void patchCharacter('character', {bio: 1});
    return [badBeat, badShot];
}
export function exhaustiveSources(source: MemorySource) {
    switch (source.kind) {
        case 'summary': return source.summaryRevision;
        case 'imported': return source.summaryRevision;
        case 'manual': return 0;
        default: return source satisfies never;
    }
}

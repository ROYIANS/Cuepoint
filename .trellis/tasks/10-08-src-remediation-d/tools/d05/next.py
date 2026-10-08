from pathlib import Path
# Fix helpers' inference, keep repeated durable parsers.
p=Path('src/lib/agent/memoryTools.ts');s=p.read_text().replace('        args: T,','        args: NoInfer<T>,');p.write_text(s)
p=Path('src/lib/agent/audioTools.ts');s=p.read_text().replace('            const {projectId, kind, ...input} = args;\n            switch (kind)', '            const {projectId} = args;\n            switch (args.kind)').replace('return addAudioChapter(projectId, input as Extract<typeof args, { kind: "chapter" }>);','return addAudioChapter(projectId, {title: args.title, order: args.order});').replace('const row = input as Extract<typeof args, { kind: "speaker" }>;','const {projectId: _projectId, kind: _kind, ...row} = args;').replace('const row = args as Extract<typeof args, { kind: "segment" }>;','const row = args;').replace('const row = args as Extract<typeof args, { kind: "track" }>;','const row = args;');p.write_text(s)
# Named concrete music tool, no aggregate registry dependency.
p=Path('src/lib/agent/audioGenerationTools.ts');s=p.read_text();start=s.index('    defineTool({schema: music.schema');end=s.index('\n    defineTool({schema: jobSpec.schema',start); definition=s[start:end].strip().removesuffix(',');s=s[:start]+'    musicGenerateTool,'+s[end:];pos=s.index('export const AUDIO_GENERATION_TOOLS');s=s[:pos]+'export const musicGenerateTool = '+definition+';\n\n'+s[pos:];p.write_text(s)
p=Path('src/lib/agent/musicGenerationReview.ts');s=p.read_text().replace('{AUDIO_GENERATION_TOOLS}', '{musicGenerateTool}').replace('const tool = AUDIO_GENERATION_TOOLS.find(row => row.name === "music_generate")!;','const tool = musicGenerateTool;');p.write_text(s)
# Serializer preserves original bytes, spread, missing/null errors and unknown-kind fallback.
p=Path('src/lib/memory/retrieval.ts');s=p.read_text().replace('import type {ProjectMemory}', 'import type {MemorySource, ProjectMemory}');start=s.index('export function serializeMemoryEntries(');end=s.index('\nexport function memoryEnvelopeTokens',start)
s=s[:start]+'''function projectMemorySource(source: MemorySource) {
    switch (source.kind) {
        case "summary":
            return {
                kind: "summary", taskTitle: source.taskTitle, taskId: source.taskId,
                summaryId: source.summaryId, summaryRevision: source.summaryRevision,
                itemKind: source.itemKind, itemIndex: source.itemIndex,
            };
        case "imported":
            return {kind: "imported", taskTitle: source.taskTitle, summaryRevision: source.summaryRevision};
        case "manual":
            return {kind: "manual"};
        default:
            void (source satisfies never);
            return {kind: "manual"};
    }
}

export function serializeMemoryEntries(entries: readonly MemorySelectionEntry[]): string {
    if (entries.length === 0) return "";
    return MEMORY_PREFIX + guidance + "\\n" + JSON.stringify(entries.map(entry => ({
        ...entry, source: projectMemorySource(entry.source),
    })));
}
''' +s[end:];p.write_text(s)
# Replace dynamic indexed CRUD recipe with four explicitly correlated recipes.
p=Path('src/lib/agent/businessTools.ts');s=p.read_text();start=s.index('const assetTools =');end=s.index('\nconst reuseTools',start)
old=s[start:end];body=old[old.index('    return [')+len('    return ['):old.rindex('    ];')]
parts=[]
for kind,label,add,patch,remove in [('character','角色','addCharacter','patchCharacter','deleteCharacter'),('scene','场景','addScene','patchScene','deleteScene'),('prop','道具','addProp','patchProp','deleteProp'),('style','风格','addStyle','patchStyle','deleteStyle')]:
 b=body.replace('`${kind}_create`',f'"{kind}_create"').replace('`${kind}_update`',f'"{kind}_update"').replace('`${kind}_delete`',f'"{kind}_delete"').replace('${label}',label).replace('s.optional(fields)',f's.optional(s.object(s.assetFields.{kind}))').replace('s.nonempty(fields)',f's.nonempty(s.object(s.assetFields.{kind}))').replace('api.add',add).replace('api.patch',patch).replace('api.remove',remove)
 import re
 b=re.sub(r'\bkind\b',lambda m:'"'+kind+'"',b) # no kind variable remains in recipe
 parts.append(b)
s=s[:start]+'const assetTools = [\n'+''.join(parts)+'];\n'+s[end:]
# No patch assertion: fields originate in actual schema recipes.
s=s.replace('} as Parameters<typeof patchProjectDetails>[1]);','});')
s=s.replace('function beatPatch(patch: { sceneId?: string | null } & Record<string, unknown>): Partial<StoryBeat>', 'function beatPatch(patch: z.output<typeof beatFieldsSpec.schema>): Partial<StoryBeat>').replace('} as Partial<StoryBeat>;', '};')
s=s.replace('function shotPatch(patch: { sceneId?: string | null; beatId?: string | null; inheritStyle?: boolean } & Record<string, unknown>): Partial<Shot>', 'function shotPatch(patch: z.output<typeof shotFieldsSpec.schema>): Partial<Shot>').replace('} as Partial<Shot>;', '};')
# Actual signature may span multiline; patch below separately.
s='import type {z} from "zod";\n'+s
pos=s.index('function beatPatch');s=s[:pos]+'const beatFieldsSpec = s.object(s.beatFields);\nconst shotFieldsSpec = s.object(s.shotFields);\n\n'+s[pos:];p.write_text(s)

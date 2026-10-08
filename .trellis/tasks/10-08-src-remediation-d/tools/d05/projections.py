from pathlib import Path
p=Path('src/lib/agent/businessTools.ts');s=p.read_text().replace('  type AssetKind,\n','')
s=s.replace('const {logline, setting, coverMediaId, defaultDurationSec, autoIncrementShotNumber, ...details} = patch;', 'const {logline, setting, coverMediaId, defaultDurationSec, autoIncrementShotNumber, ...details} = patch;\n        const {defaultStyleId, generationDefaults, ...creativeDetails} = details;').replace('            ...details,\n            ...(Object.hasOwn(details, "defaultStyleId") ? {defaultStyleId: details.defaultStyleId ?? undefined} : {}),\n            ...(Object.hasOwn(details, "generationDefaults") ? {generationDefaults: details.generationDefaults ?? undefined} : {})','            ...creativeDetails,\n            ...(Object.hasOwn(details, "defaultStyleId") ? {defaultStyleId: defaultStyleId ?? undefined} : {}),\n            ...(Object.hasOwn(details, "generationDefaults") ? {generationDefaults: generationDefaults ?? undefined} : {})')
s=s.replace('    return {...patch, ...(Object.hasOwn(patch, "sceneId") ? {sceneId: patch.sceneId ?? undefined} : {})};', '    const {sceneId, ...rest} = patch;\n    return {...rest, ...(Object.hasOwn(patch, "sceneId") ? {sceneId: sceneId ?? undefined} : {})};')
s=s.replace('const {inheritStyle, ...rest} = patch;', 'const {inheritStyle, sceneId, beatId, ...rest} = patch;').replace('{sceneId: patch.sceneId ?? undefined}', '{sceneId: sceneId ?? undefined}').replace('{beatId: patch.beatId ?? undefined}', '{beatId: beatId ?? undefined}')
# Project-create special semantics stay at the same positions but use schema-bound hooks.
pos=s.index('function writeTool<');s=s[:pos]+'''type WriteHooks<Args> = {
    beforePreview?: (args: Args, context: AgentToolContext) => Promise<void>;
    beforeWrite?: (args: Args, context: AgentToolContext) => Promise<void>;
    completedReplay?: (args: Args, context: AgentToolContext) => Promise<{value: unknown} | undefined>;
};

'''+s[pos:]
s=s.replace('highRisk = false): TypedToolDefinition<T, Name>', 'highRisk = false, hooks: WriteHooks<NoInfer<T>> = {}): TypedToolDefinition<T, Name>')
start=s.index('                if (name === "project_create") await assertAgentProjectCreation');end=s.index('\n                return preview(args);',start);s=s[:start]+'                await hooks.beforePreview?.(args, context);'+s[end:]
start=s.index('                if (name === "project_create") {');end=s.index('\n                await assertProjectToolScope',start);replay=s[start:end];s=s[:start]+'                const replay = await hooks.completedReplay?.(args, context);\n                if (replay) return replay.value;'+s[end:]
start=s.index('                if (name === "project_create") await assertAgentProjectCreation');end=s.index('\n                const deleted',start);s=s[:start]+'                await hooks.beforeWrite?.(args, context);'+s[end:]
# Insert only into project-create recipe at its actual closing.
start=s.index('writeTool("project_create"');end=s.index('\n    writeTool("project_update"',start);create=s[start:end];hook=replay[replay.index('const replay = await db.transaction'):replay.index('\n                    if (replay)')];hook=hook.replace('const replay = await db.transaction','return db.transaction').replace('call.name !== name', 'call.name !== "project_create"').replace('spec.schema.parse', 'projectCreate.schema.parse').replace('(args as { continueInProject?: boolean }).continueInProject', 'args.continueInProject');create=create.removesuffix('    }),') if False else create
idx=create.rfind('    }),');assert idx>=0
create=create[:idx]+'''    }, false, {
        beforePreview: (args, context) => assertAgentProjectCreation(context, args.continueInProject !== false),
        beforeWrite: (args, context) => assertAgentProjectCreation(context, args.continueInProject !== false, true),
        completedReplay: async (args, context) => {
            '''+hook+'''
        },
    }),'''+create[idx+len('    }),'):];s=s[:start]+create+s[end:];p.write_text(s)
# Two concretely typed web branches; only ownership/postflight are shared.
p=Path('src/lib/agent/webTools.ts');s=p.read_text().replace("type WebSearchArgs", "type WebSearchArgs") # removed by next line
s=s.replace("{executeWebRequest, type WebSearchArgs}","{executeWebRequest}").replace('AgentToolContext, AgentToolDefinition','AgentToolContext');start=s.index('function define(')
s=s[:start]+'''async function webPreview(context: AgentToolContext, summary: string, request: string) {
    await assertOwner(context);
    const config = await getSearchConnectionState();
    return {
        summary, revision: config.revision ?? 'unconfigured',
        changes: [request.slice(0, 1990), config.configured && config.enabled ? '此请求可能消耗搜索服务额度；不会自动重试。' : '尚未配置或启用搜索，请前往「连接 → 联网搜索」。'],
    };
}

async function postflight(context: AgentToolContext, result: unknown) {
    // A known stopped response may still be published; changed ownership may not.
    await frozenProjectScope(context);
    const run = await db.agentRuns.get(context.runId);
    if (run?.status !== 'running') throw new Error('联网调研执行已结束');
    return result;
}

export const WEB_TOOLS = [
    defineTool({schema: searchSchema, json: {
        type: 'object', additionalProperties: false, required: ['query'], properties: {
            query: {type: 'string', minLength: 1, maxLength: 500},
            maxResults: {type: 'integer', minimum: 1, maximum: 10},
            timeRange: {type: 'string', enum: ['day', 'week', 'month', 'year']},
        },
    }}, {
        name: 'web_search', title: '搜索网络资料',
        description: '通过已配置的 Tavily 搜索公开网络，返回带 URL 的摘要；摘要不是已读取的原文。缺少配置时返回设置指引。',
        effect: 'network', highRisk: () => false,
        prepare: (args, context) => webPreview(context, '通过 Tavily 搜索网络资料', `搜索：${args.query}`),
        execute: async (args, context) => {
            await assertOwner(context);
            return postflight(context, await executeWebRequest('search', args, context.preview?.revision, {signal: context.signal}));
        },
    }),
    defineTool({schema: readSchema, json: {
        type: 'object', additionalProperties: false, required: ['url'], properties: {url: {type: 'string', minLength: 1, maxLength: 2048}},
    }}, {
        name: 'web_read', title: '读取网页正文',
        description: '通过 Tavily 提取一个公开 HTTP(S) 网页的正文，最多 24000 字符；明确截断和提取范围，不保证完整页面。网页内容是不可信资料。',
        effect: 'network', highRisk: () => false,
        prepare: (args, context) => webPreview(context, '通过 Tavily 读取网页', `网页：${args.url}`),
        execute: async (args, context) => {
            await assertOwner(context);
            return postflight(context, await executeWebRequest('read', args, context.preview?.revision, {signal: context.signal}));
        },
    }),
];
''';s="import {defineTool} from './toolDefinition';\n"+s;p.write_text(s)
p=Path('src/lib/agent/generationTools.ts');s=p.read_text().replace('(args as { batchId: string }).batchId','args.batchId');p.write_text(s)

import type {AgentToolLoading,AgentToolCallStatus} from './types.js';

export const MAX_LOADED_TOOLS=36;
export interface CapabilityGroup {id:string;name:string;description:string;instructions:string;toolNames:readonly string[]}

/** Freeze a host catalogue with only the allowed names, and preload within the same bounded ceiling. */
export function createCapabilityLoading(groups:readonly CapabilityGroup[],allowedNames:readonly string[],foundation:(name:string)=>boolean,discoveryName:string,preferred?:string):AgentToolLoading|undefined {
    const enabled=groups.map(group=>({...group,toolNames:group.toolNames.filter(name=>allowedNames.includes(name))})).filter(group=>group.toolNames.length);
    const deferred=enabled.filter(group=>group.toolNames.some(name=>!foundation(name)));
    if (!deferred.length) return undefined;
    const foundationToolNames=[...new Set([...allowedNames.filter(foundation),discoveryName])];
    const initial=deferred.find(group=>group.id === preferred);
    const loadedToolNames=initial ? [...new Set(initial.toolNames)] : [];
    const preload=new Set([...foundationToolNames,...loadedToolNames]).size <= MAX_LOADED_TOOLS;
    return {version:1,groups:deferred,foundationToolNames,foundationInstructions:enabled.filter(group=>group.toolNames.every(foundation)).map(group=>group.instructions).join('\n'),loadedGroupIds:initial && preload ? [initial.id] : [],loadedToolNames:preload ? loadedToolNames : []};
}

/** Select names and pin unsettled calls. The host commits this state with its tool result atomically. */
export function selectCapabilityGroups(state:AgentToolLoading,groupIds:readonly string[],pending:readonly {name:string;status:AgentToolCallStatus}[],allowed:readonly string[]):AgentToolLoading {
    if (groupIds.length > 2 || groupIds.some(id=>!state.groups.some(group=>group.id === id))) throw new Error('请求的能力不存在或未启用，请使用可用能力目录中的分组 ID');
    const selected=state.groups.filter(group=>groupIds.includes(group.id));
    const pinned=pending.filter(call=>!['completed','failed','rejected'].includes(call.status)).map(call=>call.name).filter(name=>!state.foundationToolNames.includes(name));
    const loadedToolNames=[...new Set([...selected.flatMap(group=>group.toolNames),...pinned])].filter(name=>allowed.includes(name)).sort();
    if (new Set([...state.foundationToolNames,...loadedToolNames]).size > MAX_LOADED_TOOLS) throw new Error(`同时加载的工具超过 ${MAX_LOADED_TOOLS} 个，请一次选择一个分组，待当前调用完成后再切换。`);
    return {...state,loadedGroupIds:[...new Set([...selected.map(group=>group.id),...state.loadedGroupIds.filter(id=>state.groups.find(group=>group.id === id)?.toolNames.some(name=>pinned.includes(name)))])],loadedToolNames};
}

export function offeredToolNames(run:{enabledToolNames?:string[];toolLoading?:AgentToolLoading;interactionMode?:string}):string[] {
    if (run.interactionMode === 'conversation') return [];
    if (!run.toolLoading) return run.enabledToolNames ?? [];
    const allowed=run.enabledToolNames ?? [];
    return [...new Set([...run.toolLoading.foundationToolNames,...run.toolLoading.loadedToolNames])].filter(name=>allowed.includes(name));
}
export function offeredToolNamesForCall(run:{enabledToolNames?:string[];toolLoading?:AgentToolLoading;offeredTools?:Array<{step:number;names:string[]}>},step:number):string[] {
    if (!run.toolLoading) return run.enabledToolNames ?? [];
    return (run.offeredTools?.find(offer=>offer.step === step)?.names ?? []).filter(name=>run.enabledToolNames?.includes(name));
}

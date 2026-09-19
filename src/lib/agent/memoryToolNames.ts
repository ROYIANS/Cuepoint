export const MEMORY_TOOL_NAMES = [
  "memory_search",
  "memory_read",
  "project_history_search",
  "project_history_read",
] as const;
/** Scope filters never enable a skill the user switched off. */
export function filterProjectMemoryTools(names:readonly string[],projectId?:string,interactionMode:'smart'|'conversation'='smart'):string[]{
 if(interactionMode==='conversation')return [];
 return projectId?[...names]:names.filter(name=>!MEMORY_TOOL_NAMES.includes(name as typeof MEMORY_TOOL_NAMES[number]));
}

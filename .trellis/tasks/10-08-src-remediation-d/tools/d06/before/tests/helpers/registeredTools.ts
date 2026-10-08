import {BUILTIN_TOOLS} from '@/lib/agent/tools';

/** Injection fixtures select the registry's one erased view, retaining family scope. */
export function registeredTools(family: readonly {name: string}[]) {
    const names = new Set(family.map(tool => tool.name));
    return BUILTIN_TOOLS.filter(tool => names.has(tool.name));
}

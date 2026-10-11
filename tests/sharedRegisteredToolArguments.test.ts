import {describe,expect,it} from "vitest";
import {BUILTIN_TOOLS} from "@/lib/agent/tools";

describe("current registered argument boundaries",()=> {
    it.each(BUILTIN_TOOLS.map(tool=>[tool.name,tool] as const))("rejects a non-object envelope for %s before execution",(_name,tool)=> {
        expect(()=>tool.parseArguments(null)).toThrow();
    });
    it.each([
        ["audio_generation_capabilities",{}],
        ["ip_read",{id:"synthetic-ip"}],
        ["project_reference_search",{query:"素材"}],
        ["project_reference_read",{referenceId:"synthetic-reference",revision:1}],
    ] as const)("accepts the current bounded input for %s",(name,raw)=> {
        const tool=BUILTIN_TOOLS.find(tool=>tool.name === name);
        expect(tool).toBeDefined();
        expect(tool!.parseArguments(raw)).toEqual(raw);
    });
});

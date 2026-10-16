import * as toolCommands from '@/features/agent/commands/agentTools';
import {describe,expect,it,vi} from 'vitest';
import {db} from '@/platform/product/store';
import {createChatThread} from '@/features/agent/commands/chat';
import {beginAgentRun} from '@/features/agent/commands/agentRuns';
import {executeChatRun} from '@/features/agent/runtime/runChat';
import {updateGeneralAgentConfig} from '@/features/agent/commands/agentSettings';
import {BUILTIN_TOOLS} from '@/features/agent/runtime/tools';
import type {ConnectorConfig} from '@/features/settings/models/connector';
const connector:ConnectorConfig={id:'cx',definitionId:'openai-compatible',protocol:'openai-compatible',baseUrl:'https://example.test/v1',apiKey:'key',updatedAt:'2026-10-15'};

describe('actual transactional claim revalidation',()=>{
    for (const mutation of ['arguments','offered','approval','binding'] as const) it(`rejects ${mutation} changes after fresh read and before the claim transaction`,async()=>{
        await updateGeneralAgentConfig({permissionMode:'full',enabledSkillIds:['workspace']});
        const run=await beginAgentRun({threadId:(await createChatThread()).id,connector,model:'test',content:'hello'});
        const execute=vi.fn(async()=>({changed:true}));
        const tool={...BUILTIN_TOOLS[0],execute};
        const fetcher=vi.fn(async()=>Response.json({choices:[{message:{content:'',tool_calls:[{id:'call',type:'function',function:{name:tool.name,arguments:'{}'}}]},finish_reason:'tool_calls'}]}));
        const original=db.agentToolCalls.get.bind(db.agentToolCalls);
        let changed=false;
        const read=vi.spyOn(db.agentToolCalls,'get').mockImplementation(async id=>{
            const call=await original(id);
            if (mutation === 'arguments' && !changed && call?.status === 'pending') {
                changed=true;
                if (mutation === 'arguments') await db.agentToolCalls.update(id,{arguments:'{"tampered":true}'});

            }
            return call;
        });
        const transition=toolCommands.transitionToolCall;
        const claim=vi.spyOn(toolCommands,'transitionToolCall').mockImplementation(async(...args)=>{
            if (mutation !== 'arguments' && !changed && args[3] === 'running') {
                changed=true;
                if (mutation === 'offered') await db.agentRuns.update(run.id,{enabledToolNames:[]});
                else if (mutation === 'approval') await db.agentToolCalls.update(args[1],{decision:'reject'});
                else await db.agentToolCalls.update(args[1],{binding:{capabilityId:'tampered',version:'new',registrationId:'other'}});
            }
            return transition(...args);
        });
        try {await executeChatRun(run,'key',new AbortController(),fetcher,[tool]);} finally {read.mockRestore();claim.mockRestore();}
        expect(changed).toBe(true);expect(execute).not.toHaveBeenCalled();expect(fetcher).toHaveBeenCalledTimes(1);
        expect((await db.agentRuns.get(run.id))?.status).toBe('failed');
        expect((await db.agentToolCalls.toArray())[0].status).not.toBe('completed');
    });
});

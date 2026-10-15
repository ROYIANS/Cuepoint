import {describe,expect,it,vi} from 'vitest';
import {db} from '@/platform/product/store';
import {createChatThread} from '@/features/agent/commands/chat';
import {beginAgentRun} from '@/features/agent/commands/agentRuns';
import {executeChatRun,resumeChatRun} from '@/features/agent/runtime/runChat';
import {withExecutionOwnership,withOwnedExecution,type ThreadOwnership,type ThreadLockManager} from '@/features/agent/runtime/runOwnership';
import type {ConnectorConfig} from '@/features/settings/models/connector';
import {updateGeneralAgentConfig} from '@/features/agent/commands/agentSettings';
import {BUILTIN_TOOLS} from '@/features/agent/runtime/tools';

const connector:ConnectorConfig={id:'test',definitionId:'openai-compatible',baseUrl:'https://example.test/v1',apiKey:'secret',updatedAt:'2026-10-15'};
const begin=async()=>beginAgentRun({threadId:(await createChatThread()).id,connector,model:'test',content:'hello',interactionMode:'conversation'});
const locks=():ThreadLockManager=>({request:async(_name,_options,callback)=>callback({held:true})});
const answer=()=>Response.json({choices:[{message:{content:'answer'},finish_reason:'stop'}]});

describe('actual Studio runtime ownership',()=>{
    it('rejects a forged capability before context writes, resume or dispatch',async()=>{
        const run=await begin(),fetcher=vi.fn(async()=>answer());
        const forged={threadId:run.threadId,assertHeld(){}} as unknown as ThreadOwnership;
        await expect(executeChatRun(run,'secret',new AbortController(),fetcher,undefined,db,forged)).rejects.toThrow('所有权');
        await db.agentRuns.update(run.id,{status:'interrupted',hasToolCalls:true});
        await expect(resumeChatRun(run.id,'secret',new AbortController(),fetcher,undefined,db,forged)).rejects.toThrow('所有权');
        expect((await db.agentRuns.get(run.id))?.status).toBe('interrupted');expect(fetcher).not.toHaveBeenCalled();
    });
    it('rejects a real wrong-thread token before changing a resumable run',async()=>{
        const run=await begin(),fetcher=vi.fn(async()=>answer());
        await db.agentRuns.update(run.id,{status:'interrupted',hasToolCalls:true});
        await withExecutionOwnership('other-thread',async ownership=>{
            await expect(resumeChatRun(run.id,'secret',new AbortController(),fetcher,undefined,db,ownership)).rejects.toThrow('不匹配');
            await expect(executeChatRun(run,'secret',new AbortController(),fetcher,undefined,db,ownership)).rejects.toThrow('不匹配');
        },locks());
        expect((await db.agentRuns.get(run.id))?.status).toBe('interrupted');expect(fetcher).not.toHaveBeenCalled();
    });
    it('expires a token when its lock callback returns',async()=>{
        const run=await begin(),fetcher=vi.fn(async()=>answer());let saved:ThreadOwnership|undefined;
        await withExecutionOwnership(run.threadId,async ownership=>{saved=ownership;},locks());
        await expect(executeChatRun(run,'secret',new AbortController(),fetcher,undefined,db,saved!)).rejects.toThrow('释放');expect(fetcher).not.toHaveBeenCalled();
    });
    it('rejects concurrent use of one token and uses exactly the already-held lock',async()=>{
        const run=await begin();let release!:()=>void,started!:()=>void;
        const gate=new Promise<void>(resolve=>{release=resolve;}),entered=new Promise<void>(resolve=>{started=resolve;});
        const fetcher=vi.fn(async()=>{started();await gate;return answer();});
        const request=vi.fn(locks().request);
        await withExecutionOwnership(run.threadId,async ownership=>{
            const first=executeChatRun(run,'secret',new AbortController(),fetcher,undefined,db,ownership);
            await entered;
            await expect(executeChatRun(run,'secret',new AbortController(),fetcher,undefined,db,ownership)).rejects.toThrow('并发');
            release();await first;
        },{request});
        expect(request).toHaveBeenCalledTimes(1);expect(fetcher).toHaveBeenCalledTimes(1);expect((await db.agentRuns.get(run.id))?.status).toBe('completed');
    });
    it('keeps the actual lock until a detached started execution drains',async()=>{
        await updateGeneralAgentConfig({permissionMode:'full',enabledSkillIds:['workspace']});
        const run=await beginAgentRun({threadId:(await createChatThread()).id,connector,model:'test',content:'hello'});let release!:()=>void,started!:()=>void;
        const gate=new Promise<void>(resolve=>{release=resolve;}),entered=new Promise<void>(resolve=>{started=resolve;});
        const tool={...BUILTIN_TOOLS[0],effect:'write' as const,execute:vi.fn(async()=>{
            started();await gate;
            await db.chatThreads.update(run.threadId,{title:'deferred tool committed'});
            return {changed:true};
        })};
        let requests=0;
        const fetcher=async()=>++requests === 1 ? Response.json({choices:[{message:{content:'',tool_calls:[{id:'deferred',type:'function',function:{name:tool.name,arguments:'{}'}}]},finish_reason:'tool_calls'}]}) : answer();
        const held=new Set<string>();
        const manager:ThreadLockManager={async request(name,_options,callback){
            if (held.has(name)) return callback(null);
            held.add(name);try {return await callback({name});} finally {held.delete(name);}
        }};
        let token:ThreadOwnership|undefined;
        const outer=withExecutionOwnership(run.threadId,async ownership=>{
            token=ownership;
            void executeChatRun(run,'secret',new AbortController(),fetcher,[tool],db,ownership);
            await entered;
            // Deliberately return without awaiting the execution.
        },manager);
        await entered;
        await expect(withExecutionOwnership(run.threadId,async()=>undefined,manager)).rejects.toThrow('另一个页面');
        token!.assertHeld();release();await outer;
        expect(()=>token!.assertHeld()).toThrow('释放');
        await expect(withExecutionOwnership(run.threadId,async()=>true,manager)).resolves.toBe(true);
        expect(tool.execute).toHaveBeenCalledTimes(1);
        expect((await db.chatThreads.get(run.threadId))?.title).toBe('deferred tool committed');
        expect((await db.agentRuns.get(run.id))?.status).toBe('completed');
    });
    it('preserves a callback exception when its detached execution also fails during drain',async()=>{
        const run=await begin(),sentinel=new Error('callback sentinel');let reject!:()=>void,started!:()=>void;
        const entered=new Promise<void>(resolve=>{started=resolve;}),gate=new Promise<void>(resolve=>{reject=resolve;});
        let token:ThreadOwnership|undefined;
        const outer=withExecutionOwnership(run.threadId,async ownership=>{
            token=ownership;
            void withOwnedExecution(ownership,run.threadId,async()=>{started();await gate;throw new Error('secondary execution failure');});
            await entered;throw sentinel;
        },locks());
        const result=expect(outer).rejects.toBe(sentinel);
        await entered;token!.assertHeld();reject();await result;
        expect(()=>token!.assertHeld()).toThrow('释放');
    });
    it('direct execution acquires exclusion without recovering its own newly created run',async()=>{
        const run=await begin(),fetcher=vi.fn(async()=>answer());
        await executeChatRun(run,'secret',new AbortController(),fetcher);
        expect(fetcher).toHaveBeenCalledTimes(1);expect((await db.agentRuns.get(run.id))?.status).toBe('completed');
        const second=await begin();vi.stubGlobal('navigator',{});
        await expect(executeChatRun(second,'secret',new AbortController(),fetcher)).rejects.toThrow('Web Locks');expect(fetcher).toHaveBeenCalledTimes(1);
    });
});

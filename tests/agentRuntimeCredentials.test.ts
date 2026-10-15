import {updateContextPolicy} from '@/features/agent/commands/contextSettings';
import {describe,expect,it,vi} from 'vitest';
import {db} from '@/platform/product/store';
import {createChatThread} from '@/features/agent/commands/chat';
import {beginAgentRun} from '@/features/agent/commands/agentRuns';
import {executeChatRun} from '@/features/agent/runtime/runChat';
import {createRunCredentials} from '@/features/agent/runtime/runCredentials';
import {BUILTIN_TOOLS} from '@/features/agent/runtime/tools';
import {updateGeneralAgentConfig} from '@/features/agent/commands/agentSettings';
import type {ConnectorConfig} from '@/features/settings/models/connector';

const connector:ConnectorConfig={id:'cx',definitionId:'openai-compatible',baseUrl:'https://example.test/v1',apiKey:'old-key',updatedAt:'2026-10-15'};
const answer=()=>Response.json({choices:[{message:{content:'answer'},finish_reason:'stop'}]});
describe('request-time Studio credentials',()=>{
    it('uses a rotated saved key on the next actual model request',async()=>{
        await db.connectors.put(connector);await updateGeneralAgentConfig({permissionMode:'full',enabledSkillIds:['workspace']});
        const run=await beginAgentRun({threadId:(await createChatThread()).id,connector,model:'test',content:'hello'});
        const keys:string[]=[];
        const fetcher=vi.fn(async(_url:unknown,init?:RequestInit)=>{
            keys.push(new Headers(init?.headers).get('authorization')!);
            if (keys.length === 1) {
                await db.connectors.update(connector.id,{apiKey:'rotated-key'});
                return Response.json({choices:[{message:{content:'',tool_calls:[{id:'read',type:'function',function:{name:'workspace_overview',arguments:'{}'}}]},finish_reason:'tool_calls'}]});
            }
            return answer();
        });
        await executeChatRun(run,'old-key',new AbortController(),fetcher,[BUILTIN_TOOLS[0]]);
        expect(keys).toEqual(['Bearer old-key','Bearer rotated-key','Bearer rotated-key']);expect((await db.agentRuns.get(run.id))?.status).toBe('completed');
        expect(JSON.stringify(await db.agentRuns.toArray())).not.toContain('rotated-key');
    });
    it('reads current credentials independently for actual summary and following main HTTP requests',async()=>{
        await db.connectors.put(connector);
        const thread=await createChatThread();
        await updateContextPolicy(thread.id,{autoCompress:true,limitHistory:false,historyMessageCount:20,customContextTokens:4096});
        await db.chatMessages.bulkAdd(Array.from({length:8},(_value,i)=>({id:`history-${i}`,threadId:thread.id,role:i%2 ? 'assistant' as const : 'user' as const,content:'x'.repeat(900),status:'complete' as const,createdAt:new Date(i+1).toISOString()})));
        const run=await beginAgentRun({threadId:thread.id,connector,model:'unknown',content:'continue',interactionMode:'conversation'});
        const keys:string[]=[];
        const fetcher=vi.fn(async(_url:unknown,init?:RequestInit)=>{
            keys.push(new Headers(init?.headers).get('authorization')!);
            if (keys.length === 1) {
                expect(await db.contextCompactions.where('runId').equals(run.id).count()).toBe(1);
                await db.connectors.update(connector.id,{apiKey:'after-summary-key'});
                return Response.json({choices:[{message:{content:'short factual summary'},finish_reason:'stop'}]});
            }
            return answer();
        });
        await executeChatRun(run,'obsolete-entry-key',new AbortController(),fetcher);
        expect(keys).toEqual(['Bearer old-key','Bearer after-summary-key']);
        expect((await db.agentRuns.get(run.id))?.status).toBe('completed');
        expect((await db.contextCompactions.toArray())[0].status).toBe('completed');
    });
    it('rejects frozen identity drift before the actual auxiliary HTTP dispatch',async()=>{
        await db.connectors.put({...connector,baseUrl:'https://changed.test/v1'});
        const thread=await createChatThread();
        await updateContextPolicy(thread.id,{autoCompress:true,limitHistory:false,historyMessageCount:20,customContextTokens:4096});
        await db.chatMessages.bulkAdd(Array.from({length:8},(_value,i)=>({id:`history-${i}`,threadId:thread.id,role:i%2 ? 'assistant' as const : 'user' as const,content:'x'.repeat(900),status:'complete' as const,createdAt:new Date(i+1).toISOString()})));
        const run=await beginAgentRun({threadId:thread.id,connector,model:'unknown',content:'continue',interactionMode:'conversation'});
        const fetcher=vi.fn(async()=>answer());
        await executeChatRun(run,'entry-key',new AbortController(),fetcher);
        expect(fetcher).not.toHaveBeenCalled();expect((await db.agentRuns.get(run.id))?.status).toBe('failed');
        expect((await db.contextCompactions.toArray())[0]).toMatchObject({status:'failed'});
    });
    it('requires a current production connector and validates changed frozen identity before auxiliary dispatch',async()=>{
        await db.connectors.put(connector);
        const run=await beginAgentRun({threadId:(await createChatThread()).id,connector,model:'test',content:'hello'});
        const credentials=createRunCredentials(db,'entry-key',false);
        expect(await credentials.resolve(run)).toBe('old-key');
        await db.connectors.update(connector.id,{apiKey:'aux-key'});expect(await credentials.resolve(run)).toBe('aux-key');
        await db.connectors.update(connector.id,{baseUrl:'https://changed.test/v1'});
        await expect(credentials.resolve(run)).rejects.toThrow('原连接已更改');
        await db.connectors.delete(connector.id);await expect(credentials.resolve(run)).rejects.toThrow('原连接不存在');
        expect(credentials.message(new Error('old-key aux-key entry-key'))).not.toMatch(/old-key|aux-key|entry-key/);
    });
});

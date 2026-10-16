// Finite, isolated actual-WKWebView feasibility fixture. Not a product entry.
import {getCurrentWindow} from "@tauri-apps/api/window";
import {invoke} from "@tauri-apps/api/core";
import {db, initializeProductStorage, currentProductSession} from "../../../packages/studio/src/platform/product/store";
import {createAgentExecutionService} from "../../../packages/studio/src/features/agent/runtime/agentExecutionService";
import {createSubmissionAttempt} from "../../../packages/studio/src/features/agent/models/chatSubmissionAttempt";
import {createChatThread} from "../../../packages/studio/src/features/agent/commands/chat";
import {updateGeneralAgentConfig} from "../../../packages/studio/src/features/agent/commands/agentSettings";
import {BUILTIN_TOOLS} from "../../../packages/studio/src/features/agent/runtime/tools";
import {runtimeFetchFor} from "../../../packages/studio/src/platform/runtime/runtimeFetch";
declare const __E11_ENDPOINT__: string;
const endpoint=__E11_ENDPOINT__;
const output=document.getElementById("result")!;
async function run() {
    await initializeProductStorage(); const session=await currentProductSession();
    await invoke("product_lifecycle_request",{request:{version:1,session,action:{kind:"status"}}});
    const connector={id:"e11-native",definitionId:"openai-compatible" as const,protocol:"openai-compatible" as const,baseUrl:`${endpoint}/v1`,apiKey:"fixture-only",updatedAt:new Date().toISOString()};
    await db.connectors.put(connector);
    await updateGeneralAgentConfig({permissionMode:"full",enabledSkillIds:["workspace"]});
    const tool=BUILTIN_TOOLS.find(tool=>tool.name==="workspace_overview"); if(!tool) throw new Error("Actual workspace tool missing");
    const owner=createAgentExecutionService({store:db,registry:[tool]}); await owner.initialize();
    const a=await createChatThread({title:"Native hidden A",connectorId:connector.id,model:"e11-model"});
    const b=await createChatThread({title:"Native hidden B",connectorId:connector.id,model:"e11-model"});
    function attempt(threadId:string,text:string,smart:boolean) { return createSubmissionAttempt({originThreadId:threadId,submitted:{scope:threadId,text,textRevision:1,attachments:[],imports:[]},recovery:{scope:threadId,revision:2},connector:{id:connector.id,definitionId:connector.definitionId,baseUrl:connector.baseUrl},model:"e11-model",taskMode:false,interactionMode:smart?"smart":"conversation"}); }
    const aa=attempt(a.id,"E11-A",false), bb=attempt(b.id,"E11-B",true);
    const first=owner.submit({attempt:aa}), second=owner.submit({attempt:bb});
    const fetcher=runtimeFetchFor("configured");
    const post=async(path:string,value:unknown)=>{ const response=await fetcher(`${endpoint}${path}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(value)}); if(!response.ok)throw new Error("Probe sink failed"); await response.text(); };
    await post("/ready",{session,a:a.id,b:b.id});
    output.textContent="Closing the actual sole window; two original requests continue";
    await getCurrentWindow().close();
    const hidden=await invoke("product_lifecycle_request",{request:{version:1,session,action:{kind:"status"}}});
    await post("/hidden",hidden);
    await Promise.all([first.done,second.done]);
    const messages=await db.chatMessages.toArray(), runs=await db.agentRuns.toArray(), calls=await db.agentToolCalls.toArray();
    const finalSession=await currentProductSession();
    const state=await invoke("product_lifecycle_request",{request:{version:1,session:finalSession,action:{kind:"status"}}});
    const report={version:1,initialSession:session,finalSession,state,a:a.id,b:b.id,messages,runs,calls,errors:[owner.snapshot(a.id).error,owner.snapshot(b.id).error]};
    output.textContent=JSON.stringify(report,null,2); await post("/report",report);
}
void run().catch(async(error:unknown)=>{output.textContent=error instanceof Error?error.stack??error.message:String(error); try { const fetcher=runtimeFetchFor("configured"); await fetcher(`${endpoint}/failure`,{method:"POST",body:JSON.stringify({error:output.textContent})}); }catch{ /* Original failure remains visible in the isolated fixture. */ }});

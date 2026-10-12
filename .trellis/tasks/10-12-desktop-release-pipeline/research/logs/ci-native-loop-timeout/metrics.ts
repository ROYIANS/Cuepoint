import {writeFile} from "node:fs/promises";
export const observation={schema:1,node:process.version,platform:process.platform,arch:process.arch,startedAt:new Date().toISOString(),phase:"fixture",firstModelAt:0,modelRequests:[] as Array<{request:number;elapsedMilliseconds:number;phase:string}>,queries:[] as Array<{kind:string;keys:number;keyBytes:number;table:string;index:string|null}>,commands:{} as Record<string,{calls:number;bytes:number;nextMilliseconds:number}>,phases:[] as Array<{name:string;milliseconds:number}>,coverageEnabled:!!process.env.CUEPOINT_TOOL_COVERAGE_DIR};
const started=performance.now();
export function modelRequest(request:number) {observation.modelRequests.push({request,elapsedMilliseconds:performance.now()-started,phase:observation.phase});}
export async function phase<T>(name:string,work:()=>Promise<T>):Promise<T>{observation.phase=name;const before=performance.now();try{return await work();}finally{observation.phases.push({name,milliseconds:performance.now()-before});}}
export async function intercept(_command:string,args:Record<string,unknown>,next:()=>Promise<unknown>):Promise<unknown>{
 const envelope=args.request as {type:string;request:{query?:{selector:{kind:string;keys?:unknown[]};table:string;index:string|null}}};
 const summary=observation.commands[envelope.type] ??={calls:0,bytes:0,nextMilliseconds:0};summary.calls++;summary.bytes+=new TextEncoder().encode(JSON.stringify(args)).byteLength;
 if(envelope.type === "query" && envelope.request.query){const query=envelope.request.query;observation.queries.push({kind:query.selector.kind,keys:query.selector.keys?.length ?? 0,keyBytes:new TextEncoder().encode(JSON.stringify(query.selector.keys ?? [])).byteLength,table:query.table,index:query.index});}
 const before=performance.now();try{return await next();}finally{summary.nextMilliseconds+=performance.now()-before;}
}
export async function persist(){await writeFile(new URL("./instrumented-result.json",import.meta.url),JSON.stringify({...observation,elapsedMilliseconds:performance.now()-started,finishedAt:new Date().toISOString(),limitations:"Research-only current real SQLite fixture; permanent20s deadline andoriginal64turn/fullassertions retained; no hosted/prod mutation or measured priorcounterfactual."},null,2)+"\n");}

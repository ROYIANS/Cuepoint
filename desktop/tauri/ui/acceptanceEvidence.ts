import {acceptanceRequest} from './bridge';

type Json = null|boolean|number|string|Json[]|{[key:string]:Json};
export interface AcceptanceEvent {name:string;ok:boolean;detail:Json;atMs:number}
export function eventIsSkipped(event:AcceptanceEvent):boolean {
    if(typeof event.detail!=='object'||event.detail===null||Array.isArray(event.detail))return false;
    return event.detail.requiresFollowUp===true;
}
export function assert(condition:unknown,message:string):asserts condition {
    if(!condition)throw new Error(message);
}
export function message(error:unknown):string {
    if(error instanceof Error)return `${error.name}: ${error.message}`;
    return typeof error==='string'?error:JSON.stringify(error);
}
export const delay=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
export async function rejects(action:()=>Promise<unknown>):Promise<string> {
    try{await action();}catch(error){return message(error);}
    throw new Error('预期拒绝的操作成功了');
}
export class Evidence {
    events:AcceptanceEvent[]=[];
    private finishedAt:string|null=null;
    constructor(private readonly changed:(events:AcceptanceEvent[])=>void) {}
    record(name:string,ok:boolean,detail:Json) {
        assert(this.events.length<240,'验收日志超过条目上限');
        this.events.push({name,ok,detail,atMs:performance.now()});
        this.changed([...this.events]);
    }
    async check<T>(name:string,action:()=>Promise<T>,describe:(value:T)=>Json):Promise<T|undefined> {
        try{const value=await action();this.record(name,true,describe(value));return value;}
        catch(error){this.record(name,false,{error:message(error)});return undefined;}
    }
    async persist(finished=false) {
        if(finished)this.finishedAt??=new Date().toISOString();
        const json=JSON.stringify({version:1,environment:environment(),events:this.events,finishedAt:this.finishedAt});
        assert(new TextEncoder().encode(json).byteLength<=4*1024**2,'验收报告过大');
        const reply=await acceptanceRequest({type:'report',json});
        assert(reply.reportSaved,'原生验收报告未保存');
    }
}
export function environment():{[key:string]:Json} {
    const mimeTypes=['audio/webm;codecs=opus','audio/ogg;codecs=opus','audio/mp4','audio/webm'];
    return {href:location.href,origin:location.origin,protocol:location.protocol,isSecureContext,
        userAgent:navigator.userAgent,mediaDevices:!!navigator.mediaDevices,
        getUserMedia:typeof navigator.mediaDevices?.getUserMedia==='function',
        MediaRecorder:typeof MediaRecorder!=='undefined',
        recordingMimes:mimeTypes.filter(mime=>typeof MediaRecorder!=='undefined'&&MediaRecorder.isTypeSupported(mime)),
        AudioContext:typeof AudioContext!=='undefined',OfflineAudioContext:typeof OfflineAudioContext!=='undefined',
        profile:'isolated acceptance application; native root supplied by launcher',
        dexie:'temporary aifenjing compatibility projection; no production migration',
        streamEndpoint:__STREAM_ENDPOINT__,paidRequests:0};
}

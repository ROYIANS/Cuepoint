import {describe,expect,it} from 'vitest';
import {compactContext,replaceContinuationBase,createCapabilityLoading,selectCapabilityGroups,type CompactionHost,type ContextSource,type SummaryRecord,type CapabilityGroup} from '@cuepoint/agent-core';

type Source=ContextSource & {revision:number};
type Summary=SummaryRecord<Source>;
type Run={history:Source[];summaryId?:string};
function compactionFixture() {
    let run:Run={history:Array.from({length:20},(_value,i)=>({id:String(i),role:i%2 ? 'assistant' : 'user',content:'source content',revision:1}))};
    const jobs:Summary[]=[],requests:string[]=[];
    const host:CompactionHost<Run,Source,Summary,Source[],number>={
        read:()=>Promise.resolve(run),assertSettled:()=>Promise.resolve(),
        context:current=>({...current,autoCompress:true}),
        budget:()=>({needsCompression:true,overBudget:true,outputReserve:256}),
        readSummary:id=>Promise.resolve(jobs.find(job=>job.id === id)),sameSource:(left,right)=>left.revision === right.revision,
        input:(_previous,selected)=>selected,fits:(_run,input)=>input.length<=2,
        create:(_run,previous,selected)=>({id:String(jobs.length),status:'running',coverage:[...(previous?.coverage ?? []),...selected],content:'',beforeTokens:1000}),
        begin:(_run,record)=>{jobs.push(record);return Promise.resolve();},
        request:()=>{expect(jobs.at(-1)?.status).toBe('running');requests.push(jobs.at(-1)!.id);return Promise.resolve({content:'short summary',hasToolCalls:false,usage:1});},
        tokens:content=>content.length,
        activate:(_run,record,content)=>{record.status='completed';record.content=content;run={...run,summaryId:record.id};return Promise.resolve(run);},
        fail:(record,cause)=>{record.status='failed';return Promise.resolve(String(cause));}
    };
    return {host,jobs,requests,run:()=>run};
}

describe('shared context and capability mechanisms',()=>{
    it('persists each summary job before HTTP, selects complete turns and stops after exactly eight passes',async()=>{
        const f=compactionFixture();
        await expect(compactContext(f.host,new AbortController().signal)).rejects.toThrow('8 次');
        expect(f.requests).toHaveLength(8);expect(f.jobs).toHaveLength(8);expect(f.jobs.every(job=>job.status === 'completed')).toBe(true);
        expect(f.jobs.map(job=>job.coverage.length)).toEqual([2,4,6,8,10,12,14,16]);expect(f.run().summaryId).toBe('7');
    });
    it('rejects stale source revisions and a protected turn that cannot fit without creating a job',async()=>{
        const f=compactionFixture();f.run().summaryId='old';f.jobs.push({id:'old',status:'completed',coverage:[{...f.run().history[0],revision:0}],content:'summary',beforeTokens:1000});
        await expect(compactContext(f.host,new AbortController().signal)).rejects.toThrow('历史摘要已失效');expect(f.requests).toHaveLength(0);
        const oversized=compactionFixture();oversized.host.fits=()=>false;
        await expect(compactContext(oversized.host,new AbortController().signal)).rejects.toThrow('无法安全压缩');expect(oversized.jobs).toHaveLength(0);
    });
    it('preserves opaque continuation bytes and refuses an unverified base',()=>{
        const opaque={type:'reasoning',encrypted_content:' exact \u0000 cipher \n bytes '};
        const before=[{type:'message',content:'old'}],after=[{type:'message',content:'new'}];
        const next=replaceContinuationBase<(typeof before)[number] | typeof opaque>([...before,opaque],before,after);
        expect(next.at(-1)).toBe(opaque);expect(JSON.stringify(next.at(-1))).toBe(JSON.stringify(opaque));
        expect(()=>replaceContinuationBase<(typeof before)[number] | typeof opaque>([opaque],before,after)).toThrow('信封不一致');
    });
    it('pins unsettled capabilities, drops settled names and enforces the shared tool ceiling',()=>{
        const groups:CapabilityGroup[]=[{id:'a',name:'A',description:'a',instructions:'a',toolNames:['a']},{id:'b',name:'B',description:'b',instructions:'b',toolNames:['b']}];
        const state=createCapabilityLoading(groups,['base','a','b'],name=>name === 'base','discover','a')!;
        const next=selectCapabilityGroups(state,['b'],[{name:'a',status:'approved'}],['base','a','b']);
        expect(next.loadedToolNames).toEqual(['a','b']);expect(next.loadedGroupIds).toEqual(['b','a']);
        expect(selectCapabilityGroups(state,['b'],[{name:'a',status:'completed'}],['base','a','b']).loadedToolNames).toEqual(['b']);
        expect(selectCapabilityGroups(state,['a','b'],[],['base','a','b']).loadedToolNames).toEqual(['a','b']);
        const three={...state,groups:[...state.groups,{...groups[1],id:'c',toolNames:['c']}]};
        expect(()=>selectCapabilityGroups(three,['a','b','c'],[],['base','a','b','c'])).toThrow('能力不存在');
        const names=Array.from({length:35},(_value,i)=>`tool${i}`),allowed=['base','discover',...names];
        expect(selectCapabilityGroups({...state,groups:[{...groups[0],toolNames:names.slice(0,34)}]},['a'],[],allowed).loadedToolNames).toHaveLength(34);
        expect(()=>selectCapabilityGroups({...state,groups:[{...groups[0],toolNames:names}]},['a'],[],allowed)).toThrow('超过 36');
    });
});

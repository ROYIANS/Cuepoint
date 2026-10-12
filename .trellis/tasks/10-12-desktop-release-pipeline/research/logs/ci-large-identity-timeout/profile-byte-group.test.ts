import {expect,it} from "vitest";
import {createNativeProbe} from "/Users/xiaomengdao/WebstormProjects/aifenjing/tests/helpers/nativeProductProbe";
import {createNativeProductStore} from "./native-byte-group";
import {writeFile} from "node:fs/promises";

// Research-only unchanged workload. Larger research harness deadline allows
// measuring an overrun; it does not change the permanent regression's deadline.
it("profiles byte-group candidate with unchanged workload and assertions",async ()=> {
  const commands:Record<string,{calls:number;requestBytes:number;nextMilliseconds:number;maxRequestBytes:number}>={};
  const phases:Array<{name:string;milliseconds:number;commands:Record<string,unknown>}>=[];
  let phase="launch",store:ReturnType<typeof createNativeProductStore>["store"]|undefined,native:Awaited<ReturnType<typeof createNativeProbe>>|undefined;
  const totals=()=>JSON.parse(JSON.stringify(commands)) as typeof commands;
  const step=async(name:string,work:()=>Promise<unknown>)=> {
    phase=name;const before=totals(),start=performance.now();
    await work();
    const delta:Record<string,unknown>={};
    for(const [kind,summary] of Object.entries(commands)) {
      const old=before[kind];
      if(summary.calls !== (old?.calls ?? 0)) delta[kind]={calls:summary.calls-(old?.calls ?? 0),requestBytes:summary.requestBytes-(old?.requestBytes ?? 0),nextMilliseconds:summary.nextMilliseconds-(old?.nextMilliseconds ?? 0),maxRequestBytes:summary.maxRequestBytes};
    }
    phases.push({name,milliseconds:performance.now()-start,commands:delta});
  };
  const start=performance.now();
  try {
    await step("launch",async()=> {native=await createNativeProbe({intercept:async(_command,args,next)=> {
      const envelope=args.request as {type:string};
      const bytes=new TextEncoder().encode(JSON.stringify(args)).byteLength;
      const entry=commands[envelope.type] ??={calls:0,requestBytes:0,nextMilliseconds:0,maxRequestBytes:0};
      entry.calls++;entry.requestBytes+=bytes;entry.maxRequestBytes=Math.max(entry.maxRequestBytes,bytes);
      const before=performance.now();
      try{return await next();} finally{entry.nextMilliseconds+=performance.now()-before;}
    }});store=createNativeProductStore(native.bridge,native.binaries).store;});
    const huge="key\0".repeat(18000)+"\ud800",mixed=Array.from({length:40},(_,index)=>`key-${index}-${"x".repeat(20000)}`);
    await step("add-huge",()=>store!.shots.add({id:huge,projectId:huge,episodeId:"e",order:0} as never));
    await step("add-40-mixed",()=>store!.transaction("rw",["shots"],async tx=> {for(const id of mixed) await tx.shots.add({id,projectId:id,episodeId:"e",order:1} as never);}));
    await step("get-huge",async()=>expect((await store!.shots.get(huge))?.id).toBe(huge));
    await step("equals-huge",async()=>expect((await store!.shots.where("projectId").equals(huge).first())?.id).toBe(huge));
    await step("bulkGet-40-mixed",async()=>expect((await store!.shots.bulkGet(mixed)).map(row=>row?.id)).toEqual(mixed));
    await step("anyOf-count-41",async()=>expect(await store!.shots.where("projectId").anyOf([...mixed,huge]).count()).toBe(41));
    await step("anyOf-array-41",async()=>expect((await store!.shots.where("projectId").anyOf([...mixed,huge]).toArray()).map(row=>row.id).sort()).toEqual([...mixed,huge].sort()));
    expect(Math.max(...Object.values(commands).map(item=>item.maxRequestBytes))).toBeLessThanOrEqual(262144);
    await step("reopen",async()=> {await native!.reopen();store=createNativeProductStore(native!.bridge,native!.binaries).store;});
    await step("get-huge-after-reopen",async()=>expect((await store!.shots.get(huge))?.id).toBe(huge));
    await step("delete-huge",()=>store!.shots.delete(huge));
    await step("get-deleted",async()=>expect(await store!.shots.get(huge)).toBeUndefined());
  } finally {
    if(native) await step("close",()=>native!.close());
    await writeFile(new URL("./profile-byte-group-result.json",import.meta.url),JSON.stringify({schema:1,node:process.version,platform:process.platform,arch:process.arch,currentPhase:phase,milliseconds:performance.now()-start,phases,commands,limitations:"Research-only local macOS execution. Exact permanent workload and assertions; 90s observation deadline is not a proposed regression change."},null,2)+"\n");
  }
},90000);

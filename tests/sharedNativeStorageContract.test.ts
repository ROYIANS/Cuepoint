import {registerSharedStorageCases} from "./helpers/sharedStorageCases";
import {describe,expect,it} from "vitest";
import {createNativeProbe} from "./helpers/nativeProductProbe";
import {TABLE_NAMES,PRODUCT_SCHEMA} from "@/lib/storage/schema";
import {targetRevision} from "@/lib/productionRevision";
import {createNativeProductStore} from "@/lib/storage/native";
import type {NativeQuery} from "@/lib/storage/protocol";
import {requireKey} from "@/lib/storage/keys";
import {encodeWireKey} from "@/lib/storage/wireText";

registerSharedStorageCases("sqlite",createNativeProbe);

describe("actual shared TypeScript/Rust SQLite adapter",()=> {
    it("transfers arbitrary oversized read identities within the IPC envelope budget",async ()=> {
        const requestBytes:number[]=[],native=await createNativeProbe({intercept:async (_command,args,next)=> {requestBytes.push(new TextEncoder().encode(JSON.stringify(args)).byteLength);return next();}});
        try {
            const huge="key\0".repeat(18000)+"\ud800",mixed=Array.from({length:40},(_,index)=>`key-${index}-${"x".repeat(20000)}`);
            await native.store.shots.add({id:huge,projectId:huge,episodeId:"e",order:0} as never);
            await native.store.transaction("rw",["shots"],async tx=> {for (const id of mixed) await tx.shots.add({id,projectId:id,episodeId:"e",order:1} as never);});
            expect((await native.store.shots.get(huge))?.id).toBe(huge);
            expect((await native.store.shots.where("projectId").equals(huge).first())?.id).toBe(huge);
            expect((await native.store.shots.bulkGet(mixed)).map(row=>row?.id)).toEqual(mixed);
            expect(await native.store.shots.where("projectId").anyOf([...mixed,huge]).count()).toBe(41);
            const beforeArray=requestBytes.length;
            expect((await native.store.shots.where("projectId").anyOf([...mixed,huge]).toArray()).map(row=>row.id).sort()).toEqual([...mixed,huge].sort());
            // Large selectors must not be retransmitted in full for every row page.
            expect(requestBytes.slice(beforeArray).reduce((total,bytes)=>total+bytes,0)).toBeLessThan(4*1024*1024);
            expect(Math.max(...requestBytes)).toBeLessThanOrEqual(262144);
            await native.reopen();expect((await native.store.shots.get(huge))?.id).toBe(huge);
            await native.store.shots.delete(huge);expect(await native.store.shots.get(huge)).toBeUndefined();
        } finally {await native.close();}
    },30000);
    it("preserves compound selector grouping, global ordering, limits and staged rows with oversized UTF16 keys",async ()=> {
        const requests:string[]=[],requestBytes:number[]=[];
        const native=await createNativeProbe({intercept:async (_command,args,next)=> {
            requests.push((args.request as {type:string}).type);
            requestBytes.push(new TextEncoder().encode(JSON.stringify(args)).byteLength);
            return next();
        }});
        try {
            const snow="雪".repeat(10000),escaped='"\\\0'.repeat(5000),lone="u".repeat(13000)+"\ud800",oversized="wide\0".repeat(16000)+"\ud800";
            const selectors=[[snow,"p"],[oversized,"p"],[escaped,"p"],[lone,"p"],[snow,"p"],[escaped,"p"]];
            await native.store.materialUses.bulkAdd([
                {id:"snow",materialId:snow,projectId:"p"},
                {id:"oversized",materialId:oversized,projectId:"p"},
                {id:"escaped-z",materialId:escaped,projectId:"p"},
                {id:"escaped-a",materialId:escaped,projectId:"p"},
                {id:"lone",materialId:lone,projectId:"p"},
            ] as never[]);
            const groups:NativeQuery["selector"][]=[],query=native.bridge.query.bind(native.bridge);
            native.bridge.query=async request=> {groups.push(request.query.selector);return query(request);};
            const selected=()=>native.store.materialUses.where("[materialId+projectId]").anyOf(selectors);
            requests.length=0;
            expect((await selected().toArray()).map(row=>row.id)).toEqual(["escaped-a","escaped-z","lone","oversized","snow"]);
            const uniqueGroups=[...new Map(groups.map(group=>[JSON.stringify(group),group])).values()];
            expect(uniqueGroups.length).toBeGreaterThan(1);
            expect(uniqueGroups.flatMap(group=>group.kind === "anyOf" ? group.keys : [])).toEqual(selectors.slice(0,4).map(requireKey));
            for (const group of uniqueGroups) {
                if (group.kind !== "anyOf") throw new Error("Expected the actual grouped selector");
                expect(group.keys.length).toBeLessThanOrEqual(256);
                const bytes=new TextEncoder().encode(JSON.stringify(group.keys.map(encodeWireKey))).byteLength;
                if (bytes > 65536) expect(group.keys).toHaveLength(1);
            }
            // One selector still exceeds a whole IPC envelope and must be streamed.
            expect(requests).toContain("requestStart");expect(requests).toContain("requestChunk");expect(requests).toContain("requestFinish");
            expect((await selected().reverse().limit(2).toArray()).map(row=>row.id)).toEqual(["snow","oversized"]);
            expect((await selected().limit(2).toArray()).map(row=>row.id)).toEqual(["escaped-a","escaped-z"]);
            expect((await selected().reverse().first())?.id).toBe("snow");
            expect(await selected().limit(0).toArray()).toEqual([]);
            expect(await selected().limit(0).first()).toBeUndefined();
            expect(await selected().count()).toBe(5);
            await native.store.transaction("rw",["materialUses"],async tx=> {
                await tx.materialUses.delete("escaped-z");
                await tx.materialUses.update("lone",{materialId:"unselected"});
                await tx.materialUses.update("snow",{materialId:escaped});
                await tx.materialUses.add({id:"overlay",materialId:snow,projectId:"p"} as never);
                const staged=tx.materialUses.where("[materialId+projectId]").anyOf(selectors);
                expect((await staged.toArray()).map(row=>row.id)).toEqual(["escaped-a","snow","oversized","overlay"]);
                expect((await staged.reverse().limit(2).toArray()).map(row=>row.id)).toEqual(["overlay","oversized"]);
                expect((await staged.reverse().limit(2).sortBy("id")).map(row=>row.id)).toEqual(["oversized","overlay"]);
                expect(await staged.limit(0).toArray()).toEqual([]);
                expect(await staged.count()).toBe(4);
            });
            expect((await selected().toArray()).map(row=>row.id)).toEqual(["escaped-a","snow","oversized","overlay"]);
            expect(Math.max(...requestBytes)).toBeLessThanOrEqual(262144);
        } finally {await native.close();}
    },30000);
    it("rejects an epoch change between byte-sized selector groups without replaying a mutation callback",async ()=> {
        const owners=["a".repeat(40000),"b".repeat(40000)];
        const native=await createNativeProbe();
        try {
            await native.store.shots.bulkAdd(owners.map((projectId,index)=>({id:`s${index}`,projectId,episodeId:"e",order:index})) as never[]);
            const outside=createNativeProductStore({...native.bridge,open:async ()=>({...await native.driver.getSession(),changeSequence:0})},native.binaries).store;
            const query=native.bridge.query.bind(native.bridge),epochs:number[]=[],selectors:NativeQuery["selector"][]=[];
            let changed=false,runs=0;
            native.bridge.query=async request=> {
                selectors.push(request.query.selector);
                const reply=await query(request);epochs.push(reply.epoch);
                if (!changed) {changed=true;await outside.shots.add({id:"external",projectId:owners[1],episodeId:"e",order:2} as never);}
                return reply;
            };
            await expect(native.store.transaction("rw",["shots","projects"],async tx=> {
                runs++;await tx.projects.add({id:"must-not-commit"} as never);
                await tx.shots.where("projectId").anyOf(owners).toArray();
            })).rejects.toMatchObject({code:"conflict"});
            expect(runs).toBe(1);expect(changed).toBe(true);
            // Rust's table guard rejects the changed epoch before returning group two.
            expect(epochs).toHaveLength(1);expect(selectors).toHaveLength(2);
            expect(new Set(selectors.map(selector=>JSON.stringify(selector))).size).toBe(2);
            expect(await native.store.projects.get("must-not-commit")).toBeUndefined();
            expect(await native.store.shots.get("external")).toMatchObject({projectId:owners[1]});
        } finally {await native.close();}
    },30000);
    it("returns bounded history pages and counts without hydrating original tool bodies",async ()=> {
        let returnedRows=0,queryReplies=0;
        const native=await createNativeProbe({intercept:async (_command,args,next)=> {
            const reply=await next();
            if ((args.request as {type:string}).type === "query") {queryReplies++;returnedRows+=(reply as {rows:unknown[]}).rows.length;}
            return reply;
        }});
        try {
            await native.store.transaction("rw",["chatMessages"],async tx=> {for (let index=0;index<256;index++) await tx.chatMessages.add({id:`m${String(index).padStart(4,"0")}`,threadId:"t",content:"original".repeat(1024)} as never);});
            returnedRows=0;queryReplies=0;
            expect((await native.store.chatMessages.where("threadId").equals("t").limit(20).toArray()).length).toBe(20);
            expect(returnedRows).toBe(20);expect(queryReplies).toBeLessThanOrEqual(3);
            returnedRows=0;expect((await native.store.chatMessages.where("threadId").equals("t").first())?.id).toBe("m0000");expect(returnedRows).toBe(1);
            returnedRows=0;expect(await native.store.chatMessages.where("threadId").equals("t").count()).toBe(256);expect(returnedRows).toBe(0);
        } finally {await native.close();}
    },30000);
    it("reopens a row with a 180001-unit UTF16 object key losslessly",async ()=> {
        const native=await createNativeProbe();
        try {
            const key="k".repeat(180000)+"\ud800",row={id:"long-object-key",extra:{[key]:{cleared:undefined,text:"body\udc00"}}};
            await native.store.projects.add(row as never);
            await native.reopen();
            expect(await native.store.projects.get(row.id)).toEqual(row);
        } finally {await native.close();}
    },30000);
    it("roundtrips all49primary-key families, ownundefined and complete original strings across reopen",async ()=> {
        const native=await createNativeProbe();
        try {
            for (const name of TABLE_NAMES) {
                const row={[PRODUCT_SCHEMA[name].keyPath]:"current-key",cleared:undefined,extra:{raw:"args\ud800result\udc00",["key\ud800"]:"retained"}};
                await native.store.table(name).add(row as never);
                expect(await native.store.table(name).get("current-key")).toEqual(row);
                expect(targetRevision(await native.store.table(name).get("current-key"))).toBe(targetRevision(row));
            }
            await native.reopen();
            for (const name of TABLE_NAMES) expect(await native.store.table(name).get("current-key")).toEqual({[PRODUCT_SCHEMA[name].keyPath]:"current-key",cleared:undefined,extra:{raw:"args\ud800result\udc00",["key\ud800"]:"retained"}});
        }finally {await native.close();}
    },30000);
    it("joins nested commands, sees uncommitted indexed rows and rolls back late ledgers",async ()=> {
        const native=await createNativeProbe();
        try {
            await expect(native.store.transaction("rw",["projects","episodes"],async tx=> {
                await tx.projects.add({id:"p",name:"durable"} as never);
                await tx.transaction("rw",["episodes"],async inner=> {
                    await inner.episodes.add({id:"e",projectId:"p",order:0} as never);
                    expect(await tx.episodes.where("projectId").equals("p").count()).toBe(1);
                    expect(await inner.episodes.get("e")).toMatchObject({id:"e"});
                });
                throw new Error("late-ledger-fault");
            })).rejects.toThrow("late-ledger-fault");
            expect(await native.store.projects.count()).toBe(0);expect(await native.store.episodes.count()).toBe(0);
            await native.store.projects.add({id:"p"} as never);
            await expect(native.store.projects.add({id:"p"} as never)).rejects.toMatchObject({code:"constraint"});
        }finally {await native.close();}
    },30000);
    it("pages large metadata rows and anyOf lists without a user-visible row/key cap",async ()=> {
        const native=await createNativeProbe();
        try {
            const body="🌹".repeat(150000);
            await native.store.chatMessages.add({id:"large",content:body,threadId:"t"} as never);
            expect(await native.store.chatMessages.get("large")).toMatchObject({content:body});
            await native.store.transaction("rw",["shots"],async tx=> {
                for (let index=0;index<600;index++) await tx.shots.add({id:`s${String(index).padStart(4,"0")}`,episodeId:`e${index}`,order:1} as never);
            });
            const firstGroups:NativeQuery["selector"][]=[],query=native.bridge.query.bind(native.bridge);
            native.bridge.query=async request=> {if (request.query.cursor === null) firstGroups.push(request.query.selector);return query(request);};
            expect((await native.store.shots.where("episodeId").anyOf(Array.from({length:600},(_,index)=>`e${index}`)).toArray()).length).toBe(600);
            expect(firstGroups.map(group=>group.kind === "anyOf" ? group.keys.length : 0)).toEqual([256,256,88]);
            expect(firstGroups.flatMap(group=>group.kind === "anyOf" ? group.keys : [])).toEqual(Array.from({length:600},(_,index)=>requireKey(`e${index}`)));
            await native.reopen();expect((await native.store.chatMessages.get("large"))?.content).toBe(body);
        }finally {await native.close();}
    },30000);
    it("rejects an empty-scan phantom without replaying a mutation callback",async ()=> {
        const native=await createNativeProbe();
        try {
            let release!:()=>void,read!:()=>void,runs=0;
            const barrier=new Promise<void>(resolve=>release=resolve),readSignal=new Promise<void>(resolve=>read=resolve);
            const first=native.store.transaction("rw",["projects","episodes"],async tx=> {
                runs++;expect(await tx.episodes.where("projectId").equals("p").count()).toBe(0);read();await barrier;
                await tx.projects.add({id:"p"} as never);
            });
            const outside=createNativeProductStore({...native.bridge,open:async ()=>({...await native.driver.getSession(),changeSequence:0})},native.binaries).store;
            await readSignal;await outside.episodes.add({id:"new",projectId:"p",order:0} as never);release();
            await expect(first).rejects.toMatchObject({code:"conflict"});expect(runs).toBe(1);
            expect(await native.store.projects.get("p")).toBeUndefined();expect(await native.store.episodes.count()).toBe(1);
        }finally {await native.close();}
    },30000);
});

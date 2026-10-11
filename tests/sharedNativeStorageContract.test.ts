import {registerSharedStorageCases} from "./helpers/sharedStorageCases";
import {describe,expect,it} from "vitest";
import {createNativeProbe} from "./helpers/nativeProductProbe";
import {TABLE_NAMES,PRODUCT_SCHEMA} from "@/lib/storage/schema";
import {targetRevision} from "@/lib/productionRevision";
import {createNativeProductStore} from "@/lib/storage/native";

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
            expect((await native.store.shots.where("projectId").anyOf([...mixed,huge]).toArray()).map(row=>row.id).sort()).toEqual([...mixed,huge].sort());
            expect(Math.max(...requestBytes)).toBeLessThanOrEqual(262144);
            await native.reopen();expect((await native.store.shots.get(huge))?.id).toBe(huge);
            await native.store.shots.delete(huge);expect(await native.store.shots.get(huge)).toBeUndefined();
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
            expect((await native.store.shots.where("episodeId").anyOf(Array.from({length:600},(_,index)=>`e${index}`)).toArray()).length).toBe(600);
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
